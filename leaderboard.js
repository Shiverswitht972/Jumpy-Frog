// Leaderboard service. The game only talks to JF.Leaderboard.
// To connect a real backend, write a provider with the same two methods and
// set JF.Leaderboard.provider = RemoteProvider (example at the bottom).
(function () {
  const SIZE = JF.CONFIG.leaderboardSize;
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };

  const dayKey = (d = new Date()) => d.toISOString().slice(0, 10);
  function weekKey(d = new Date()) {                 // Monday of the current week (UTC)
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7));
    return t.toISOString().slice(0, 10);
  }
  function seeded(str) {
    let s = 0; for (const c of str) s = (s * 31 + c.charCodeAt(0)) >>> 0;
    return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  }

  const NAMES = ['LILYPAD','HOPPER','TOADY','RIBBIT','SPLASH','MOSSY','BOUNCE','PIXEL','CROAK','SWAMPY',
                 'FLYCATCH','NOVA','TADPOLE','ZIPPY','CLOVER','BUBBLES'];
  const RANGE = { daily: [250, 1400], weekly: [600, 2800], alltime: [1500, 6000] };

  // Placeholder players. They change every day/week so it feels alive.
  function fakeBoard(period) {
    const key = period + (period === 'daily' ? dayKey() : period === 'weekly' ? weekKey() : '');
    const r = seeded(key), pool = NAMES.slice(), [lo, hi] = RANGE[period], out = [];
    for (let i = 0; i < 12; i++) {
      out.push({ name: pool.splice(Math.floor(r() * pool.length), 1)[0], score: Math.round(lo + r() * (hi - lo)) });
    }
    return out;
  }

  const LocalProvider = {
    async fetchTop(period) {
      const bests = load('jf_daybests', {});          // { "2026-10-03": 540, ... }
      const from = period === 'daily' ? dayKey() : period === 'weekly' ? weekKey() : '';
      let mine = 0;
      for (const day in bests) if (!from || day >= from) mine = Math.max(mine, bests[day]);
      const rows = fakeBoard(period);
      if (mine > 0) rows.push({ name: JF.Leaderboard.getName(), score: mine, you: true });
      return rows.sort((a, b) => b.score - a.score).slice(0, SIZE);
    },
    async submit(score) {
      const bests = load('jf_daybests', {}), k = dayKey();
      if (score > (bests[k] || 0)) { bests[k] = score; save('jf_daybests', bests); }
    }
  };

  /* Example real backend (replace the URL, keep the shape):
  const RemoteProvider = {
    async fetchTop(period) {
      const res = await fetch('/api/leaderboard?period=' + period);
      return res.json();            // [{ name, score, you? }, ...] sorted, max 10
    },
    async submit(score) {
      await fetch('/api/score', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: JF.Leaderboard.getName(), score }) });
    }
  }; */

  JF.Leaderboard = {
    provider: LocalProvider,
    getTop(period) { return this.provider.fetchTop(period); },
    submit(score) { return score > 0 ? this.provider.submit(score) : Promise.resolve(); },
    getName() { return localStorage.getItem('jf_name') || 'YOU'; },
    setName(n) { localStorage.setItem('jf_name', (n || 'YOU').trim().slice(0, 10).toUpperCase() || 'YOU'); }
  };
})();
