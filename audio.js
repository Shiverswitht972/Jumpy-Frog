// Tiny arcade sounds made with WebAudio. No audio files needed.
(function () {
  let ctx = null, muted = localStorage.getItem('jf_mute') === '1';

  function init() {
    if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }
  function tone(f1, f2, dur, type, vol, delay) {
    if (muted || !ctx) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f1, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(f2, 20), t + dur);
    g.gain.setValueAtTime(vol || 0.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  }

  JF.Audio = {
    init,
    isMuted: () => muted,
    setMuted(m) { muted = m; localStorage.setItem('jf_mute', m ? '1' : '0'); },
    jump()  { tone(320, 760, 0.16, 'square', 0.09); },
    move()  { tone(260, 300, 0.04, 'triangle', 0.07); },
    coin()  { tone(880, 1320, 0.1, 'square', 0.08); tone(1320, 1760, 0.12, 'square', 0.08, 0.07); },
    hit()   { tone(240, 40, 0.45, 'sawtooth', 0.16); tone(120, 30, 0.35, 'square', 0.1, 0.05); },
    click() { tone(520, 520, 0.05, 'square', 0.07); }
  };
})();
