// Jumpy Frog engine: movement, input, obstacles, collisions, difficulty, drawing.
(function () {
  'use strict';
  const C = JF.CONFIG, W = C.W, LANES = 3;
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });
  const app = document.getElementById('app');
  const rnd = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const laneX = i => C.roadX + C.laneW * (i + 0.5);
  const CAR_COLORS = ['#ff5a5f', '#4da6ff', '#ffb142', '#a55eea', '#f5f6fa', '#2ed573'];

  let H = 640, px = 1;                 // logical height, pixel ratio
  let mode = 'menu';                   // menu | play | over
  let frog, items, parts, deco;
  let dist, bonus, speed, scroll, worldPx, nextRow, lastOpen, lastWall, shake, overT, time = 0, shown = -1;

  /* ---------- optional artwork overrides ---------- */
  const art = {};
  Object.keys(C.ART).forEach(k => { if (C.ART[k]) { art[k] = new Image(); art[k].src = C.ART[k]; } });
  function sprite(k, w, h) {
    const im = art[k];
    if (im && im.complete && im.naturalWidth) { ctx.drawImage(im, -w / 2, -h / 2, w, h); return true; }
    return false;
  }

  /* ---------- sizing ---------- */
  function resize() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const scale = Math.min(vw / W, vh / 560);
    H = vh / scale;
    px = scale * Math.min(window.devicePixelRatio || 1, C.maxDpr);
    app.style.width = W * scale + 'px';
    app.style.height = vh + 'px';
    canvas.width = Math.round(W * px);
    canvas.height = Math.round(vh * px / scale);
  }
  const frogY = () => H - C.frogBottom;

  /* ---------- state ---------- */
  function initDeco() {
    deco = [];
    for (let i = 0; i < 9; i++) {
      deco.push({ side: i % 2, y: (i * 90) % 800, r: rnd(9, 15), c: Math.random() < 0.6 ? '#3fa84a' : '#f7a8c8' });
    }
  }
  function reset() {
    frog = { lane: 1, x: laneX(1), air: false, jt: 0, buf: 0, lean: 0 };
    items = []; parts = [];
    dist = 0; bonus = 0; speed = C.speed.base; scroll = 0; worldPx = 0;
    nextRow = 420; lastOpen = 1; lastWall = -999; shake = 0; overT = 0; shown = -1;
  }
  const score = () => Math.floor(dist) + bonus;

  /* ---------- controls ---------- */
  function move(dir) {
    if (mode !== 'play') return;
    const n = clamp(frog.lane + dir, 0, LANES - 1);
    if (n !== frog.lane) { frog.lane = n; JF.Audio.move(); }
  }
  function jump() {
    if (mode !== 'play') return;
    if (frog.air) { if (frog.jt / C.jumpTime > 0.65) frog.buf = 0.18; return; } // buffered jump
    frog.air = true; frog.jt = 0; JF.Audio.jump();
  }

  let pid = null, sx = 0, sy = 0, st = 0, acted = false;
  app.addEventListener('pointerdown', e => {
    if (mode !== 'play') return;
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; st = performance.now(); acted = false;
  });
  app.addEventListener('pointermove', e => {
    if (e.pointerId !== pid || mode !== 'play') return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) >= C.swipeMin) { move(dx > 0 ? 1 : -1); sx = e.clientX; sy = e.clientY; acted = true; }
    } else if (-dy >= C.swipeMin) { jump(); sx = e.clientX; sy = e.clientY; acted = true; }
  });
  const end = e => {
    if (e.pointerId !== pid) return;
    if (!acted && performance.now() - st < 300) jump();   // quick tap = jump
    pid = null;
  };
  app.addEventListener('pointerup', end);
  app.addEventListener('pointercancel', () => { pid = null; });

  window.addEventListener('keydown', e => {
    const k = e.key;
    if (k === 'ArrowLeft' || k === 'a') move(-1);
    else if (k === 'ArrowRight' || k === 'd') move(1);
    else if (k === 'ArrowUp' || k === 'w' || k === ' ') { jump(); e.preventDefault(); }
    else if (k === 'Enter' && mode === 'over' && JF.Game.onEnter) JF.Game.onEnter();
  });

  /* ---------- obstacles ---------- */
  function mk(type, lane, y) {
    const o = { type, x: laneX(lane), y, extra: 0 };
    if (type === 'car') {
      o.hw = 17; o.hh = 31; o.color = CAR_COLORS[(Math.random() * CAR_COLORS.length) | 0];
      if (dist > 200 && Math.random() < 0.4) o.extra = rnd(30, 40 + 80 * Math.min(1, dist / 1500));
    }
    else if (type === 'log') { o.hw = 36; o.hh = 11; }
    else if (type === 'rock') { o.hw = 15; o.hh = 12; }
    else { o.hw = 12; o.hh = 12; }
    return o;
  }

  // Adds one row of obstacles. Always leaves a reachable open lane. Returns extra gap.
  function spawnRow() {
    const d = Math.min(1, dist / 1500), y = -90;
    // Jump wall: logs across every lane, you must hop (appears after 300m)
    if (dist > 300 && dist - lastWall > 150 && Math.random() < 0.1 + 0.1 * d) {
      lastWall = dist;
      for (let l = 0; l < LANES; l++) items.push(mk('log', l, y));
      return 70;
    }
    let open = lastOpen + (Math.random() < 0.6 ? (Math.random() < 0.5 ? -1 : 1) : 0);
    open = clamp(open, 0, LANES - 1); lastOpen = open;
    const others = [0, 1, 2].filter(l => l !== open).sort(() => Math.random() - 0.5);
    const n = dist < 100 ? 1 : (Math.random() < 0.15 + 0.55 * d ? 2 : 1);
    others.slice(0, n).forEach(l => {
      const low = dist >= 60 && Math.random() < 0.28;
      items.push(mk(low ? (Math.random() < 0.5 ? 'log' : 'rock') : 'car', l, y));
    });
    if (Math.random() < 0.45) for (let k = 0; k < 3; k++) items.push(mk('coin', open, y - k * 46));
    return 0;
  }

  /* ---------- update ---------- */
  function advance(mv) {
    scroll = (scroll + mv) % 60; worldPx += mv;
    deco.forEach(d => { d.y += mv; if (d.y > H + 30) { d.y = -30; d.r = rnd(9, 15); } });
  }
  function burst(x, y, color, n) {
    for (let i = 0; i < n && parts.length < 50; i++) {
      parts.push({ x, y, vx: rnd(-170, 170), vy: rnd(-220, 60), life: 0.5, c: color });
    }
  }
  function updateParts(dt) {
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 520 * dt; p.life -= dt;
      if (p.life <= 0) parts.splice(i, 1);
    }
  }
  function die() {
    mode = 'over'; shake = 9; overT = 0.55;
    JF.Audio.hit(); burst(frog.x, frogY(), '#5ed36b', 16);
    if (navigator.vibrate) navigator.vibrate(60);
  }

  function update(dt) {
    time += dt;
    if (mode === 'menu') { advance(140 * dt); return; }
    if (mode === 'over') {
      shake = Math.max(0, shake - 30 * dt); updateParts(dt);
      if (overT > 0 && (overT -= dt) <= 0) JF.Game.onGameOver(score());
      return;
    }

    const d = Math.min(1, dist / 1500);
    speed = C.speed.base + (C.speed.max - C.speed.base) * (1 - Math.exp(-dist / C.speed.ramp));
    const mv = speed * dt;
    advance(mv); dist += mv / C.pxPerMeter;

    // frog: smooth lane slide + jump timer
    const tx = laneX(frog.lane);
    frog.x += (tx - frog.x) * Math.min(1, dt * C.laneLerp);
    frog.lean = clamp((tx - frog.x) / 50, -1, 1);
    if (frog.air && (frog.jt += dt) >= C.jumpTime) {
      frog.air = false; frog.jt = 0;
      if (frog.buf > 0) jump();
    }
    if (frog.buf > 0) frog.buf -= dt;

    // spawn
    if (worldPx >= nextRow) {
      const extra = spawnRow();
      nextRow = worldPx + 240 + 160 * (1 - d) + rnd(0, 60) + extra;
    }

    // move + collide
    const fy = frogY(), jp = frog.air ? frog.jt / C.jumpTime : 0;
    const flying = frog.air && jp > 0.12 && jp < 0.88;
    for (let i = items.length - 1; i >= 0; i--) {
      const o = items[i];
      o.y += (speed + o.extra) * dt;
      if (o.y > H + 80) { items.splice(i, 1); continue; }
      if (Math.abs(o.x - frog.x) < o.hw + 12 && Math.abs(o.y - fy) < o.hh + 13) {
        if (o.type === 'coin') {
          bonus += C.coinBonus; JF.Audio.coin(); burst(o.x, o.y, '#ffd43b', 6); items.splice(i, 1);
        } else if (o.type === 'car' || !flying) { die(); return; }
      }
    }
    updateParts(dt);

    const s = score();
    if (s !== shown) { shown = s; JF.Game.onScore(s); }
  }

  /* ---------- drawing ---------- */
  function rr(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
  }
  function oval(x, y, rx, ry, rot) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, rot || 0, 0, 6.2832); ctx.fill(); }

  function drawCar(o) {
    if (sprite('car', 48, 78)) return;
    ctx.fillStyle = '#1b1b22';
    ctx.fillRect(-24, -26, 5, 14); ctx.fillRect(19, -26, 5, 14); ctx.fillRect(-24, 10, 5, 14); ctx.fillRect(19, 10, 5, 14);
    ctx.fillStyle = o.color; rr(-21, -36, 42, 72, 10);
    ctx.fillStyle = 'rgba(0,0,0,.18)'; rr(-15, -14, 30, 22, 5);
    ctx.fillStyle = '#bfe9ff'; rr(-15, 9, 30, 13, 4);
    ctx.fillStyle = '#8fc7e6'; rr(-15, -28, 30, 9, 4);
    ctx.fillStyle = '#ffe66d'; ctx.fillRect(-17, 31, 8, 5); ctx.fillRect(9, 31, 8, 5);
  }
  function drawLog() {
    if (sprite('log', 88, 30)) return;
    ctx.fillStyle = '#8a5a30'; rr(-42, -14, 84, 28, 12);
    ctx.fillStyle = '#c99a63'; oval(-36, 0, 8, 12); oval(36, 0, 8, 12);
    ctx.fillStyle = '#6f4623'; ctx.fillRect(-26, -5, 50, 3); ctx.fillRect(-20, 4, 40, 3);
  }
  function drawRock() {
    if (sprite('rock', 38, 32)) return;
    ctx.fillStyle = '#8d94a0'; oval(0, 0, 19, 15);
    ctx.fillStyle = '#b3bac5'; oval(-5, -4, 9, 6);
  }
  function drawCoin(o) {
    if (sprite('coin', 24, 24)) return;
    const s = 0.75 + 0.25 * Math.abs(Math.sin(time * 5 + o.y * 0.02));
    ctx.save(); ctx.scale(s, 1);
    ctx.fillStyle = '#f0a500'; oval(0, 0, 12, 12);
    ctx.fillStyle = '#ffd43b'; oval(0, 0, 9.5, 9.5);
    ctx.fillStyle = '#fff3a0'; oval(-2, -2, 4, 4);
    ctx.restore();
  }

  function drawFrog(x, y, jp, lean) {
    const lift = jp > 0 ? Math.sin(jp * Math.PI) : 0, s = 1 + 0.4 * lift;
    ctx.fillStyle = 'rgba(0,0,0,.25)'; oval(x + lift * 8, y + 14 + lift * 10, 16 * (1 - 0.2 * lift), 8 * (1 - 0.2 * lift));
    ctx.save(); ctx.translate(x, y - lift * 20); ctx.rotate(lean * 0.35); ctx.scale(s, s);
    if (!sprite('frog', 44, 48)) {
      ctx.fillStyle = '#3fae4f';
      oval(-17, 11, 8, 11 + 8 * lift, 0.35); oval(17, 11, 8, 11 + 8 * lift, -0.35);
      oval(-15, -8, 6, 8, -0.4); oval(15, -8, 6, 8, 0.4);
      ctx.fillStyle = '#5ed36b'; oval(0, 2, 16, 19);
      ctx.fillStyle = '#b4f2a8'; oval(0, 7, 10, 11);
      ctx.fillStyle = '#fff'; oval(-9, -16, 7, 7); oval(9, -16, 7, 7);
      ctx.fillStyle = '#16301b'; oval(-9, -17, 3.3, 3.3); oval(9, -17, 3.3, 3.3);
      ctx.fillStyle = '#ff9db1'; oval(-12, -3, 3, 2.2); oval(12, -3, 3, 2.2);
      ctx.strokeStyle = '#16301b'; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.arc(0, -6, 6, 0.2 * Math.PI, 0.8 * Math.PI); ctx.stroke();
    }
    ctx.restore();
  }

  function draw() {
    ctx.setTransform(px, 0, 0, px, 0, 0);
    if (shake > 0) ctx.translate(rnd(-shake, shake), rnd(-shake, shake));
    ctx.fillStyle = C.colors.grass; ctx.fillRect(-12, -12, W + 24, H + 24);
    deco.forEach(d => {
      const x = d.side ? W - 18 : 18;
      ctx.fillStyle = d.c; oval(x, d.y, d.r, d.r);
    });
    const rw = C.laneW * LANES;
    ctx.fillStyle = C.colors.road; ctx.fillRect(C.roadX, -12, rw, H + 24);
    ctx.fillStyle = '#fff'; ctx.fillRect(C.roadX - 3, -12, 3, H + 24); ctx.fillRect(C.roadX + rw, -12, 3, H + 24);
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3;
    ctx.setLineDash([28, 32]); ctx.lineDashOffset = -scroll; ctx.beginPath();
    for (let i = 1; i < LANES; i++) { const x = C.roadX + C.laneW * i; ctx.moveTo(x, -60); ctx.lineTo(x, H + 60); }
    ctx.stroke(); ctx.setLineDash([]);

    for (let i = 0; i < items.length; i++) {
      const o = items[i];
      ctx.save(); ctx.translate(o.x, o.y);
      if (o.type === 'car') drawCar(o); else if (o.type === 'log') drawLog();
      else if (o.type === 'rock') drawRock(); else drawCoin(o);
      ctx.restore();
    }
    if (mode === 'menu') {
      const t = time % 1.7, jp = t < 0.6 ? t / 0.6 : 0;
      drawFrog(laneX(1), frogY(), jp, 0);
    } else if (mode === 'play') drawFrog(frog.x, frogY(), frog.air ? frog.jt / C.jumpTime : 0, frog.lean);

    for (let i = 0; i < parts.length; i++) { const p = parts[i]; ctx.fillStyle = p.c; ctx.fillRect(p.x - 3, p.y - 3, 6, 6); }
  }

  /* ---------- loop + public API ---------- */
  let last = 0;
  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.033, (t - last) / 1000 || 0.016); last = t;
    update(dt); draw();
  }

  JF.Game = {
    start() { reset(); mode = 'play'; JF.Game.onScore(0); },
    showMenu() { reset(); mode = 'menu'; },
    onScore() {}, onGameOver() {}, onEnter: null
  };

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  resize(); initDeco(); reset(); requestAnimationFrame(frame);
})();
