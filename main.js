// Menus, overlays and wiring between the UI and the game.
(function () {
  const $ = id => document.getElementById(id);
  const screens = { menu: $('menu'), over: $('over'), lb: $('lb') };
  let best = +localStorage.getItem('jf_best') || 0;
  let current = 'menu', cameFrom = 'menu', period = 'daily', token = 0;

  function show(name) {                       // name = null while playing
    current = name;
    Object.keys(screens).forEach(k => screens[k].classList.toggle('hidden', k !== name));
    $('hud').classList.toggle('hidden', name !== null);
    $('mute').classList.toggle('hidden', name === null);
  }
  function play() { JF.Audio.click(); JF.Game.start(); show(null); }

  $('btn-play').onclick = play;
  $('btn-again').onclick = play;
  JF.Game.onEnter = play;

  function openLB() { JF.Audio.click(); cameFrom = current; show('lb'); renderLB(); }
  $('btn-lb').onclick = openLB;
  $('btn-lb2').onclick = openLB;
  $('btn-back').onclick = () => { JF.Audio.click(); show(cameFrom); };

  document.querySelectorAll('.tabs button').forEach(b => b.onclick = () => {
    JF.Audio.click(); period = b.dataset.p;
    document.querySelectorAll('.tabs button').forEach(x => x.classList.toggle('on', x === b));
    renderLB();
  });

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  async function renderLB() {
    const my = ++token, list = $('lb-list');
    list.innerHTML = '<li class="empty">Loading...</li>';
    let rows = [];
    try { rows = await JF.Leaderboard.getTop(period); } catch (e) {}
    if (my !== token) return;
    list.innerHTML = rows.length
      ? rows.map((r, i) => `<li class="${r.you ? 'you' : ''}"><span class="rk">${i + 1}</span><span class="nm">${esc(r.name)}</span><span>${r.score}</span></li>`).join('')
      : '<li class="empty">No scores yet</li>';
  }

  const nameEl = $('name');
  nameEl.value = JF.Leaderboard.getName();
  nameEl.onchange = () => { JF.Leaderboard.setName(nameEl.value); nameEl.value = JF.Leaderboard.getName(); renderLB(); };

  JF.Game.onScore = s => { $('score').textContent = s; };
  JF.Game.onGameOver = s => {
    const isNew = s > best;
    if (isNew) { best = s; localStorage.setItem('jf_best', best); }
    JF.Leaderboard.submit(s);
    $('o-score').textContent = s; $('o-best').textContent = best;
    $('newbest').classList.toggle('hidden', !(isNew && s > 0));
    show('over');
  };

  const muteBtn = $('mute');
  const paintMute = () => { muteBtn.textContent = JF.Audio.isMuted() ? '🔇' : '🔊'; };
  muteBtn.onclick = () => { JF.Audio.init(); JF.Audio.setMuted(!JF.Audio.isMuted()); paintMute(); JF.Audio.click(); };
  paintMute();

  document.addEventListener('pointerdown', JF.Audio.init);   // unlock audio on first touch
  show('menu');
})();
