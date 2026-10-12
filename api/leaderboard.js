// GET ?period=daily|weekly|alltime&id=PLAYERID  Returns the top 10 as [{ name, score, you }]
const { pipeline, keys } = require('./_redis');

module.exports = async (req, res) => {
  try {
    const period = ['daily', 'weekly', 'alltime'].includes(req.query.period) ? req.query.period : 'daily';
    const me = String(req.query.id || '');
    const [flat] = await pipeline([['ZRANGE', keys()[period], 0, 9, 'REV', 'WITHSCORES']]);
    const ids = [], scores = [];
    for (let i = 0; i < flat.length; i += 2) { ids.push(flat[i]); scores.push(Number(flat[i + 1])); }
    let names = [];
    if (ids.length) names = (await pipeline([['HMGET', 'jf:names', ...ids]]))[0];
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(ids.map((id, i) => ({ name: names[i] || 'PLAYER', score: scores[i], you: id === me })));
  } catch (e) { res.status(500).json({ error: String(e.message || e) }); }
};
