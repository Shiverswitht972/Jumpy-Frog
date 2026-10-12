// Shared helper for the leaderboard functions (files starting with _ are not public routes).
const BASE = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').replace(/\/$/, '');
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function pipeline(commands) {
  if (!BASE || !TOKEN) throw new Error('Database not connected');
  const r = await fetch(BASE + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands.map(c => c.map(String)))
  });
  if (!r.ok) throw new Error('Database error ' + r.status);
  return (await r.json()).map(x => { if (x.error) throw new Error(x.error); return x.result; });
}

// One scoreboard per day, per week (Monday start) and all time. Times are UTC.
function keys() {
  const now = new Date(), day = now.toISOString().slice(0, 10);
  const t = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
  return { daily: 'jf:daily:' + day, weekly: 'jf:weekly:' + t.toISOString().slice(0, 10), alltime: 'jf:alltime' };
}

module.exports = { pipeline, keys };
