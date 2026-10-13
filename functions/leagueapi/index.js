import { Hono } from "hono";
import { Pool } from "pg";
import { randomUUID } from "node:crypto";

const app = new Hono();
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 5 });
const ADMIN_KEY = "1234";

app.use("*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Headers", "Content-Type");
  c.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  c.header("Cache-Control", "no-store");
});

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: "SERVER_ERROR" }, 500);
});

app.options("*", (c) => c.body(null, 204));

function requireAdmin(body) {
  return String(body?.adminKey || "") === ADMIN_KEY;
}

function validMatchNo(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 16 ? n : null;
}

function validScore(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
}

function validSuspension(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 10 ? n : null;
}

function cleanText(value, max = 80) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

async function reconstructDiscipline() {
  const { rows } = await pool.query(
    "select action,payload,created_at from audit_log where action in ('discipline_add','discipline_serve','discipline_delete') order by id asc"
  );

  const map = new Map();

  for (const row of rows) {
    const p = row.payload || {};
    const id = String(p.id || "");

    if (row.action === "discipline_add" && id) {
      map.set(id, {
        id,
        player: String(p.player || ""),
        team: String(p.team || ""),
        cardType: p.cardType === "red" ? "red" : "yellow",
        matchNo: p.matchNo == null ? null : Number(p.matchNo),
        suspensionMatches: Number(p.suspensionMatches || 0),
        remainingSuspension: Number(p.remainingSuspension ?? p.suspensionMatches ?? 0),
        createdAt: p.createdAt || row.created_at
      });
    } else if (row.action === "discipline_serve" && id && map.has(id)) {
      const rec = map.get(id);
      rec.remainingSuspension = Math.max(0, Number(rec.remainingSuspension || 0) - 1);
    } else if (row.action === "discipline_delete" && id) {
      map.delete(id);
    }
  }

  return [...map.values()];
}

app.get("/", (c) => c.json({ ok: true, service: "mishkat-league-api" }));
app.get("/health", (c) => c.json({ ok: true }));

app.get("/state", async (c) => {
  const { rows } = await pool.query(
    "select match_no,home_score,away_score,status,updated_at from matches order by match_no"
  );

  const results = {};
  let updatedAt = null;

  for (const r of rows) {
    results[r.match_no] = {
      matchNo: Number(r.match_no),
      homeScore: r.home_score == null ? null : Number(r.home_score),
      awayScore: r.away_score == null ? null : Number(r.away_score),
      status: r.status
    };

    if (!updatedAt || new Date(r.updated_at) > new Date(updatedAt)) {
      updatedAt = r.updated_at;
    }
  }

  const discipline = await reconstructDiscipline();
  return c.json({ results, discipline, updatedAt });
});

app.post("/score", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!requireAdmin(body)) return c.json({ error: "INVALID_ADMIN_KEY" }, 403);

  const matchNo = validMatchNo(body.matchNo);
  const homeScore = validScore(body.homeScore);
  const awayScore = validScore(body.awayScore);

  if (!matchNo) return c.json({ error: "INVALID_MATCH" }, 400);
  if (homeScore === null || awayScore === null) {
    return c.json({ error: "INVALID_SCORE" }, 400);
  }

  const { rows } = await pool.query(
    "update matches set home_score=$1,away_score=$2,status='completed',updated_at=now() where match_no=$3 returning match_no,home_score,away_score,status,updated_at",
    [homeScore, awayScore, matchNo]
  );

  if (!rows.length) return c.json({ error: "INVALID_MATCH" }, 404);

  return c.json({
    ok: true,
    result: rows[0],
    updatedAt: rows[0].updated_at
  });
});

app.post("/reset", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!requireAdmin(body)) return c.json({ error: "INVALID_ADMIN_KEY" }, 403);

  const matchNo = validMatchNo(body.matchNo);
  if (!matchNo) return c.json({ error: "INVALID_MATCH" }, 400);

  const { rows } = await pool.query(
    "update matches set home_score=null,away_score=null,status='scheduled',updated_at=now() where match_no=$1 returning match_no,status,updated_at",
    [matchNo]
  );

  if (!rows.length) return c.json({ error: "INVALID_MATCH" }, 404);
  return c.json({ ok: true, result: rows[0], updatedAt: rows[0].updated_at });
});

app.post("/postpone", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!requireAdmin(body)) return c.json({ error: "INVALID_ADMIN_KEY" }, 403);

  const matchNo = validMatchNo(body.matchNo);
  if (!matchNo) return c.json({ error: "INVALID_MATCH" }, 400);

  const { rows } = await pool.query(
    "update matches set home_score=null,away_score=null,status='postponed',updated_at=now() where match_no=$1 returning match_no,status,updated_at",
    [matchNo]
  );

  if (!rows.length) return c.json({ error: "INVALID_MATCH" }, 404);
  return c.json({ ok: true, result: rows[0], updatedAt: rows[0].updated_at });
});

app.post("/discipline/add", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!requireAdmin(body)) return c.json({ error: "INVALID_ADMIN_KEY" }, 403);

  const player = cleanText(body.player, 70);
  const team = cleanText(body.team, 30);
  const cardType =
    body.cardType === "red" ? "red" :
    body.cardType === "yellow" ? "yellow" : "";

  const matchNo =
    body.matchNo == null || body.matchNo === "" ? null : validMatchNo(body.matchNo);

  const suspensionMatches = validSuspension(body.suspensionMatches);

  if (player.length < 2) return c.json({ error: "INVALID_PLAYER" }, 400);
  if (!team) return c.json({ error: "INVALID_TEAM" }, 400);
  if (!cardType) return c.json({ error: "INVALID_CARD" }, 400);

  if (body.matchNo != null && body.matchNo !== "" && !matchNo) {
    return c.json({ error: "INVALID_MATCH" }, 400);
  }

  if (suspensionMatches === null) {
    return c.json({ error: "INVALID_SUSPENSION" }, 400);
  }

  const record = {
    id: randomUUID(),
    player,
    team,
    cardType,
    matchNo,
    suspensionMatches,
    remainingSuspension: suspensionMatches,
    createdAt: new Date().toISOString()
  };

  await pool.query(
    "insert into audit_log(action,match_id,payload) values ('discipline_add',(select id from matches where match_no=$1),$2::jsonb)",
    [matchNo, JSON.stringify(record)]
  );

  return c.json({ ok: true, record });
});

app.post("/discipline/serve", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!requireAdmin(body)) return c.json({ error: "INVALID_ADMIN_KEY" }, 403);

  const id = cleanText(body.id, 80);
  if (!id) return c.json({ error: "DISCIPLINE_NOT_FOUND" }, 404);

  await pool.query(
    "insert into audit_log(action,payload) values ('discipline_serve',$1::jsonb)",
    [JSON.stringify({ id })]
  );

  return c.json({ ok: true });
});

app.post("/discipline/delete", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  if (!requireAdmin(body)) return c.json({ error: "INVALID_ADMIN_KEY" }, 403);

  const id = cleanText(body.id, 80);
  if (!id) return c.json({ error: "DISCIPLINE_NOT_FOUND" }, 404);

  await pool.query(
    "insert into audit_log(action,payload) values ('discipline_delete',$1::jsonb)",
    [JSON.stringify({ id })]
  );

  return c.json({ ok: true });
});

export default app;
