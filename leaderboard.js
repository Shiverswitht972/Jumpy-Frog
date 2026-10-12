// Shared online leaderboard. The game only talks to JF.Leaderboard.
// Scores live in a Redis database behind /api/score and /api/leaderboard.
(function () {
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  function getId() {                                   // anonymous id for this device
    let id = store.get('jf_id');
    if (!id) {
      id = (window.crypto && crypto.randomUUID) ? crypto.randomUUID()
         : 'p' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      store.set('jf_id', id);
    }
    return id;
  }
  function getName() {
    let n = store.get('jf_name');
    if (!n) { n = 'FROG' + (100 + Math.floor(Math.random() * 900)); store.set('jf_name', n); }
    return n;
  }

  const RemoteProvider = {
    async fetchTop(period) {
      const r = await fetch('/api/leaderboard?period=' + period + '&id=' + encodeURIComponent(getId()), { cache: 'no-store' });
      if (!r.ok) throw new Error('leaderboard ' + r.status);
      return r.json();                                 // [{ name, score, you }]
    },
    async submit(score) {
      const r = await fetch('/api/score', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: getId(), name: getName(), score })
      });
      if (!r.ok) throw new Error('score ' + r.status);
    }
  };

  JF.Leaderboard = {
    provider: RemoteProvider,                          // swap this to change backend
    pending: null,
    async getTop(period) { try { await this.pending; } catch (e) {} return this.provider.fetchTop(period); },
    submit(score) {
      if (score <= 0) return Promise.resolve();
      this.pending = this.provider.submit(score).catch(() => {});
      return this.pending;
    },
    syncName() { this.pending = this.provider.submit(0).catch(() => {}); return this.pending; },
    getName,
    setName(n) { store.set('jf_name', (n || '').trim().slice(0, 10).toUpperCase() || getName()); }
  };
})();
