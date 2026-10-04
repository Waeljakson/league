const http = require("http");
const { createClient } = require("redis");

const PORT = process.env.PORT || 10000;
const REDIS_URL = process.env.REDIS_URL;
const ADMIN_KEY = String(process.env.ADMIN_KEY || "1234");
const STATE_KEY = "mishkat:league:results:v1";

if (!REDIS_URL) {
  console.error("REDIS_URL is required");
  process.exit(1);
}

const redis = createClient({ url: REDIS_URL });
redis.on("error", (err) => console.error("Redis error:", err.message));

const clients = new Set();

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
}

function json(res, status, data) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
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

async function getState() {
  const raw = await redis.get(STATE_KEY);
  if (!raw) return { results: {}, updatedAt: null };
  try { return JSON.parse(raw); } catch { return { results: {}, updatedAt: null }; }
}

async function saveState(state) {
  state.updatedAt = new Date().toISOString();
  await redis.set(STATE_KEY, JSON.stringify(state));
  for (const res of clients) {
    try { res.write("event: update\ndata: " + JSON.stringify({ updatedAt: state.updatedAt }) + "\n\n"); } catch {}
  }
  return state;
}

function validMatchNo(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 1 && n <= 16 ? n : null;
}

function validScore(value) {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n <= 99 ? n : null;
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
      if (String(body.adminKey || "") !== ADMIN_KEY) {
        return json(res, 403, { error: "INVALID_ADMIN_KEY" });
      }

      const matchNo = validMatchNo(body.matchNo);
      if (!matchNo) return json(res, 400, { error: "INVALID_MATCH" });

      const state = await getState();
      state.results ||= {};

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

    return json(res, 404, { error: "NOT_FOUND" });
  } catch (err) {
    console.error(err);
    return json(res, 500, { error: "SERVER_ERROR" });
  }
});

(async () => {
  await redis.connect();
  server.listen(PORT, "0.0.0.0", () => console.log("League API listening on", PORT));
})();