const http = require("http");
const { randomUUID } = require("crypto");
const { createClient } = require("redis");
const postgres = require("postgres");

const PORT = process.env.PORT || 10000;
const REDIS_URL = process.env.REDIS_URL;
const ADMIN_KEY = String(process.env.ADMIN_KEY || "1234");
const STATE_KEY = "mishkat:league:results:v1";
const VALID_TEAMS = new Set(["أول 1","أول 2","أول 3","ثاني 1","ثاني 2","ثاني 3","ثالث 1","ثالث 2"]);

if (!REDIS_URL) {
  console.error("REDIS_URL is required");
  process.exit(1);
}

const redis = createClient({ url: REDIS_URL });
redis.on("error", (err) => console.error("Redis error:", err.message));

const clients = new Set();

async function runOneoffNeonTask() {
  const url = process.env.ONEOFF_DB_URL;
  if (!url) return;
  const sql = postgres(url, { ssl: "require", max: 1, idle_timeout: 5, connect_timeout: 10 });
  try {
    await sql.unsafe(`
      CREATE OR REPLACE FUNCTION public.api_admin_competition_list()
      RETURNS jsonb
      LANGUAGE plpgsql
      STABLE
      SECURITY DEFINER
      SET search_path TO 'public','pg_temp'
      AS $
      DECLARE
        v_auth uuid;
        v_actor uuid;
        v_school uuid;
      BEGIN
        v_auth:=NULLIF(auth.user_id(),'')::uuid;
        SELECT au.id,au.school_id INTO v_actor,v_school
        FROM public.app_users au
        WHERE au.auth_user_id=v_auth AND au.is_active=true
        LIMIT 1;

        IF v_actor IS NULL OR NOT EXISTS(
          SELECT 1 FROM public.user_roles ur
          WHERE ur.user_id=v_actor AND ur.role IN ('SUPER_ADMIN','SCHOOL_ADMIN','PRINCIPAL')
        ) THEN
          RAISE EXCEPTION 'ADMIN_REQUIRED';
        END IF;

        RETURN COALESCE((
          SELECT jsonb_agg(jsonb_build_object(
            'id',ca.id,
            'title_ar',ca.title_ar,
            'body_ar',ca.body_ar,
            'starts_at',ca.starts_at,
            'ends_at',ca.ends_at,
            'is_published',ca.is_published,
            'closed_at',ca.closed_at,
            'announcement_type',ca.announcement_type,
            'participant_count',(SELECT count(*) FROM public.competition_participants cp WHERE cp.competition_id=ca.id),
            'target_classes',COALESCE((
              SELECT jsonb_agg(jsonb_build_object(
                'id',cl.id,
                'grade_name',g.name_ar,
                'class_name',cl.name_ar
              ) ORDER BY g.sort_order,cl.name_ar)
              FROM jsonb_array_elements_text(COALESCE(ca.target_class_ids,'[]'::jsonb)) j(value)
              JOIN public.classes cl ON cl.id=j.value::uuid
              JOIN public.grades g ON g.id=cl.grade_id
            ),'[]'::jsonb)
          ) ORDER BY ca.created_at DESC)
          FROM public.competition_announcements ca
          WHERE ca.school_id=v_school
            AND ca.deleted_at IS NULL
            AND ca.announcement_type='TARGETED_COMPETITION'
        ),'[]'::jsonb);
      END;
      $;
      GRANT EXECUTE ON FUNCTION public.api_admin_competition_list() TO authenticated;
      NOTIFY pgrst, 'reload schema';
    `);
    const verify = await sql`
      select position('cl.sort_order' in pg_get_functiondef(p.oid)) as bad_ref,
             position('ORDER BY g.sort_order,cl.name_ar' in pg_get_functiondef(p.oid)) as good_ref
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname='api_admin_competition_list'
      limit 1
    `;
    console.log("ONEOFF_COMP_LIST_FIX_OK", JSON.stringify(verify));
  } finally { await sql.end({ timeout: 2 }); }
}

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function json(res, status, data) {
  cors(res);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 100000) throw new Error("BODY_TOO_LARGE");
  }
  return raw ? JSON.parse(raw) : {};
}

function normalizeState(state) {
  const next = state && typeof state === "object" ? state : {};
  next.results ||= {};
  next.discipline = Array.isArray(next.discipline) ? next.discipline : [];
  next.updatedAt ||= null;
  return next;
}

async function getState() {
  const raw = await redis.get(STATE_KEY);
  if (!raw) return normalizeState({});
  try {
    return normalizeState(JSON.parse(raw));
  } catch {
    return normalizeState({});
  }
}

async function saveState(state) {
  const next = normalizeState(state);
  next.updatedAt = new Date().toISOString();
  await redis.set(STATE_KEY, JSON.stringify(next));

  for (const res of clients) {
    try {
      res.write("event: update\ndata: " + JSON.stringify({ updatedAt: next.updatedAt }) + "\n\n");
    } catch {}
  }
  return next;
}

function validMatchNo(value, allowEmpty = false) {
  if (allowEmpty && (value === null || value === undefined || value === "")) return null;
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 16 ? n : false;
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

function requireAdmin(body, res) {
  if (String(body.adminKey || "") !== ADMIN_KEY) {
    json(res, 403, { error: "INVALID_ADMIN_KEY" });
    return false;
  }
  return true;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      cors(res);
      res.writeHead(204);
      return res.end();
    }

    const url = new URL(req.url, "http://localhost");

    if (req.method === "GET" && url.pathname === "/health") {
      return json(res, 200, { ok: true });
    }

    if (req.method === "GET" && url.pathname === "/state") {
      return json(res, 200, await getState());
    }

    if (req.method === "GET" && url.pathname === "/events") {
      cors(res);
      res.writeHead(200, {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive"
      });
      res.write("event: ready\ndata: {}\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (req.method === "POST" && ["/score","/reset","/postpone"].includes(url.pathname)) {
      const body = await readBody(req);
      if (!requireAdmin(body, res)) return;

      const matchNo = validMatchNo(body.matchNo);
      if (!matchNo) return json(res, 400, { error: "INVALID_MATCH" });

      const state = await getState();

      if (url.pathname === "/score") {
        const homeScore = validScore(body.homeScore);
        const awayScore = validScore(body.awayScore);
        if (homeScore === null || awayScore === null) {
          return json(res, 400, { error: "INVALID_SCORE" });
        }
        state.results[matchNo] = { matchNo, homeScore, awayScore, status: "completed" };
      } else if (url.pathname === "/reset") {
        state.results[matchNo] = { matchNo, homeScore: null, awayScore: null, status: "scheduled" };
      } else {
        state.results[matchNo] = { matchNo, homeScore: null, awayScore: null, status: "postponed" };
      }

      await saveState(state);
      return json(res, 200, { ok: true, result: state.results[matchNo], updatedAt: state.updatedAt });
    }

    if (req.method === "POST" && url.pathname === "/discipline/add") {
      const body = await readBody(req);
      if (!requireAdmin(body, res)) return;

      const player = cleanText(body.player, 70);
      const team = cleanText(body.team, 30);
      const cardType = body.cardType === "red" ? "red" : body.cardType === "yellow" ? "yellow" : "";
      const matchNo = validMatchNo(body.matchNo, true);
      const suspensionMatches = validSuspension(body.suspensionMatches);

      if (player.length < 2) return json(res, 400, { error: "INVALID_PLAYER" });
      if (!VALID_TEAMS.has(team)) return json(res, 400, { error: "INVALID_TEAM" });
      if (!cardType) return json(res, 400, { error: "INVALID_CARD" });
      if (matchNo === false) return json(res, 400, { error: "INVALID_MATCH" });
      if (suspensionMatches === null) return json(res, 400, { error: "INVALID_SUSPENSION" });

      const state = await getState();
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

      state.discipline.push(record);
      await saveState(state);
      return json(res, 200, { ok: true, record, updatedAt: state.updatedAt });
    }

    if (req.method === "POST" && url.pathname === "/discipline/serve") {
      const body = await readBody(req);
      if (!requireAdmin(body, res)) return;

      const id = cleanText(body.id, 80);
      const state = await getState();
      const record = state.discipline.find(r => r.id === id);
      if (!record) return json(res, 404, { error: "DISCIPLINE_NOT_FOUND" });

      record.remainingSuspension = Math.max(0, Number(record.remainingSuspension || 0) - 1);
      await saveState(state);
      return json(res, 200, { ok: true, record, updatedAt: state.updatedAt });
    }

    if (req.method === "POST" && url.pathname === "/discipline/delete") {
      const body = await readBody(req);
      if (!requireAdmin(body, res)) return;

      const id = cleanText(body.id, 80);
      const state = await getState();
      const before = state.discipline.length;
      state.discipline = state.discipline.filter(r => r.id !== id);
      if (state.discipline.length === before) {
        return json(res, 404, { error: "DISCIPLINE_NOT_FOUND" });
      }

      await saveState(state);
      return json(res, 200, { ok: true, updatedAt: state.updatedAt });
    }

    return json(res, 404, { error: "NOT_FOUND" });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: "SERVER_ERROR" });
  }
});

(async () => {
  await runOneoffNeonTask();
  await redis.connect();
  server.listen(PORT, "0.0.0.0", () => console.log("League API listening on", PORT));
})();