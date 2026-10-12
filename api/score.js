// POST { id, name, score }  Saves a player's name and keeps their best score.
const { pipeline, keys } = require('./_redis');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  try {
    const b = req.body || {};
    const id = String(b.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
    const name = String(b.name || '').replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 10) || 'PLAYER';
    const score = Math.floor(Number(b.score) || 0);
    if (id.length < 8 || score < 0 || score > 100000) return res.status(400).json({ error: 'bad request' });

    const k = keys();
    const cmds = [['HSET', 'jf:names', id, name]];
    if (score > 0) {                                   // GT = only replace if the new score is higher
      cmds.push(['ZADD', k.daily, 'GT', score, id], ['EXPIRE', k.daily, 259200],
                ['ZADD', k.weekly, 'GT', score, id], ['EXPIRE', k.weekly, 1209600],
                ['ZADD', k.alltime, 'GT', score, id]);
    }
    await pipeline(cmds);
    res.status(200).json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
