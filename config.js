// All tunable settings live here. Change numbers, not game code.
window.JF = window.JF || {};
JF.CONFIG = {
  W: 360,                 // logical game width (height adapts to the screen)
  roadX: 36, laneW: 96,   // road left edge and lane width (3 lanes)
  frogBottom: 150,        // frog distance from the bottom of the screen
  maxDpr: 1.5,            // lower this (1) for very weak phones

  speed: { base: 250, max: 620, ramp: 1000 }, // px per second, ramp = metres to reach ~63% of max
  pxPerMeter: 40,
  jumpTime: 0.5,          // seconds in the air
  laneLerp: 24,           // higher = snappier lane changes
  swipeMin: 20,           // pixels of finger travel to count as a swipe
  coinBonus: 10,
  leaderboardSize: 10,

  colors: { grass: '#6fd05a', road: '#4a4e5a' },

  // ARTWORK: put an image path here to replace the drawn placeholder.
  // Example: frog: 'art/frog.png'  (transparent PNG, facing up, about 88x96)
  ART: { frog: null, car: null, log: null, rock: null, coin: null }
};
