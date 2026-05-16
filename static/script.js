document.addEventListener('click', function (e) {
  var el = e.target.closest('.copy-email');
  if (!el) return;
  // don't intercept if the user is selecting the email text
  if (window.getSelection && window.getSelection().toString().length > 0) return;
  var email = el.getAttribute('data-email');
  navigator.clipboard.writeText(email).then(function () {
    var toast = document.getElementById('copy-toast');
    if (!toast) return;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { toast.classList.remove('show'); }, 2000);
  });
});

var THEMES = ['tokyo-night', 'gruvbox', 'dracula', 'rose-pine', 'github-light', 'papercolor-light'];
var LIGHT_THEMES = ['rose-pine', 'github-light', 'papercolor-light'];

function applyTheme(name) {
  document.documentElement.setAttribute('data-theme', name);
  localStorage.setItem('theme', name);
  if (window._invalidateAccentCache) window._invalidateAccentCache();
  var isLight = LIGHT_THEMES.indexOf(name) >= 0;
  var t = document.getElementById('t');
  if (t) t.textContent = isLight ? '[light]' : '[dark]';
  var items = document.querySelectorAll('.tp-item');
  for (var i = 0; i < items.length; i++)
    items[i].classList.toggle('active', items[i].getAttribute('data-t') === name);
}

function toggleTheme() {
  var cur = document.documentElement.getAttribute('data-theme');
  var idx = THEMES.indexOf(cur);
  applyTheme(THEMES[(idx + 1) % THEMES.length]);
}

(function () {
  var saved = localStorage.getItem('theme') || 'tokyo-night';
  if (saved === 'dark') saved = 'tokyo-night';
  if (saved === 'light') saved = 'rose-pine';
  if (saved === 'solarized-light' || saved === 'flexoki-light' || saved === 'ayu-light') saved = 'github-light';
  if (saved === 'kanagawa') saved = 'dracula';
  if (THEMES.indexOf(saved) < 0) saved = 'tokyo-night';
  applyTheme(saved);

  document.addEventListener('DOMContentLoaded', function () {
    applyTheme(document.documentElement.getAttribute('data-theme'));

    // Theme picker (nerdy :colorscheme style)
    var pickerBtn  = document.getElementById('theme-picker-btn');
    var pickerMenu = document.getElementById('theme-picker-menu');
    if (pickerBtn && pickerMenu) {
      pickerBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        pickerMenu.classList.toggle('open');
      });
      document.addEventListener('click', function () {
        pickerMenu.classList.remove('open');
      });
      pickerMenu.addEventListener('click', function (e) { e.stopPropagation(); });
      var items = document.querySelectorAll('.tp-item');
      for (var i = 0; i < items.length; i++) {
        items[i].addEventListener('click', (function (item) {
          return function () {
            applyTheme(item.getAttribute('data-t'));
            pickerMenu.classList.remove('open');
          };
        })(items[i]));
      }
    }
  });
})();

// ================================================================
// BG EFFECT — switchable background simulation
// Modes: life → boids → off
// Click the mode button or press 'b' to cycle modes.
// To remove: delete this section, the BG EFFECT block in style.css,
//            <canvas id="bg-canvas"> and #bg-mode-btn from templates.
// ================================================================
(function () {
  // Disable sim entirely on touch-only devices (phones/tablets)
  if (window.matchMedia('(hover: none) and (pointer: coarse)').matches) return;

  var canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');

  var MODES = ['life', 'boids', 'combo', 'off'];
  var modeIdx = Math.max(0, MODES.indexOf(localStorage.getItem('bgMode') || 'combo'));
  var lifeSpeedLevel  = Math.max(0, Math.min(100, parseInt(localStorage.getItem('bgLifeSpeed')  || '15')));
  var boidsSpeedLevel = Math.max(0, Math.min(100, parseInt(localStorage.getItem('bgBoidsSpeed') || '15')));
  var W, H;

  function isDark() {
    var t = document.documentElement.getAttribute('data-theme');
    return LIGHT_THEMES.indexOf(t) < 0;
  }

  function updateBtn() {
    canvas.style.display = MODES[modeIdx] === 'off' ? 'none' : '';
  }

  function initMode(mode) {
    ctx.clearRect(0, 0, W, H);
    if (mode === 'boids') initBoids();
    if (mode === 'life')  initLife();
    if (mode === 'combo') { initLife(); initBoids(); }
  }

  function cycleMode() {
    modeIdx = (modeIdx + 1) % MODES.length;
    localStorage.setItem('bgMode', MODES[modeIdx]);
    updateBtn();
    initMode(MODES[modeIdx]);
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'b' && !e.ctrlKey && !e.metaKey && !e.altKey &&
        e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      cycleMode();
    }
  });

  // ===== BOIDS ==============================================
  // Three classic steering rules. Fewer boids (120) for cleaner
  // flocking shapes. Soft trail via partial-fade instead of clearRect.
  // Each boid is a concave arrow pointing in its velocity direction.

  var N          = 120;
  var MAX_SPEED  = 1.0,  MIN_SPEED  = 0.3;
  var PERCEPTION = 52,   SEP_DIST   = 38;
  var SEP_W      = 0.16, ALI_W      = 0.05, COH_W = 0.003;
  var MAX_FORCE  = 0.03;
  var SEP_FORCE  = 0.10;  // separation gets a higher cap to prevent overlap
  var MARGIN     = 100,  TURN       = 0.10;
  var SPREAD_R   = 140,  SPREAD_W   = 0.04;
  var WANDER     = 0.018;
  var BOID_LEN     = 14;
  var BOID_HALF    = 5.5;
  var BOID_OPACITY = 0.14;
  var BOID_GLOW    = 0;

  var boids = [];

  function clamp2(vx, vy, max) {
    var m2 = vx*vx + vy*vy;
    if (m2 > max*max) { var sc = max/Math.sqrt(m2); return [vx*sc, vy*sc]; }
    return [vx, vy];
  }

  function initBoids() {
    boids = [];
    for (var i = 0; i < N; i++) {
      var a = Math.random() * Math.PI * 2;
      var s = MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED);
      boids.push({ x: Math.random()*W, y: Math.random()*H,
                   vx: Math.cos(a)*s,  vy: Math.sin(a)*s,
                   op: 0.13 + Math.random() * 0.18,       // per-boid opacity 0.13–0.31
                   wa: Math.random() * Math.PI * 2,        // wander angle, drifts slowly
                   pr: PERCEPTION * (0.55 + Math.random() * 0.9),  // per-boid perception radius
                   ms: MAX_SPEED  * (0.7  + Math.random() * 0.6),  // per-boid max speed
                   wd: 0.015 + Math.random() * 0.012 });            // per-boid wander drift rate
    }
  }

  function updateBoids() {
    var S2 = SEP_DIST*SEP_DIST, SP2 = SPREAD_R*SPREAD_R;
    var sp = (1 + boidsCurrentSpeed / 100 * 19) / 5;
    var i, j, b, o, dx, dy, d2, d, spd, tmp;

    for (i = 0; i < N; i++) {
      b = boids[i];
      var fx=0, fy=0, sx=0, sy=0, ax=0, ay=0, cx=0, cy=0;
      var sc=0, ac=0, cc=0, rpx=0, rpy=0, rpc=0;

      for (j = 0; j < N; j++) {
        if (i === j) continue;
        o  = boids[j];
        dx = o.x - b.x; dy = o.y - b.y;
        d2 = dx*dx + dy*dy;

        if (d2 > S2 && d2 < SP2 && d2 > 0) {
          d = Math.sqrt(d2);
          rpx -= dx/d; rpy -= dy/d; rpc++;
        }

        if (d2 < b.pr*b.pr) {
          cx += o.x; cy += o.y; cc++;
          ax += o.vx; ay += o.vy; ac++;
          if (d2 < S2 && d2 > 0) {
            d = Math.sqrt(d2);
            var w = 1.0 - d / SEP_DIST;  // stronger when closer
            sx -= (dx/d) * w; sy -= (dy/d) * w; sc++;
          }
        }
      }

      if (sc  > 0) { tmp = clamp2(sx*SEP_W,  sy*SEP_W,  SEP_FORCE); fx += tmp[0]; fy += tmp[1]; }
      if (ac  > 0) {
        tmp = clamp2(ax/ac, ay/ac, b.ms);
        tmp = clamp2((tmp[0]-b.vx)*ALI_W, (tmp[1]-b.vy)*ALI_W, MAX_FORCE);
        fx += tmp[0]; fy += tmp[1];
      }
      if (cc  > 0) { tmp = clamp2((cx/cc-b.x)*COH_W, (cy/cc-b.y)*COH_W, MAX_FORCE); fx += tmp[0]; fy += tmp[1]; }
      if (rpc > 0) { tmp = clamp2(rpx/rpc*SPREAD_W, rpy/rpc*SPREAD_W, MAX_FORCE); fx += tmp[0]; fy += tmp[1]; }

      if (b.x < MARGIN)   fx += TURN*(1-b.x/MARGIN);
      if (b.x > W-MARGIN) fx -= TURN*(1-(W-b.x)/MARGIN);
      if (b.y < MARGIN)   fy += TURN*(1-b.y/MARGIN);
      if (b.y > H-MARGIN) fy -= TURN*(1-(H-b.y)/MARGIN);

      b.wa += (Math.random() - 0.5) * b.wd * 14;  // per-boid wander drift rate
      b.vx += fx + Math.cos(b.wa) * WANDER;
      b.vy += fy + Math.sin(b.wa) * WANDER;
      spd = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
      if (spd > b.ms) { b.vx = b.vx/spd*b.ms; b.vy = b.vy/spd*b.ms; }
      else if (spd < MIN_SPEED && spd > 1e-4) { b.vx = b.vx/spd*MIN_SPEED; b.vy = b.vy/spd*MIN_SPEED; }

      b.x += b.vx * sp; b.y += b.vy * sp;
      if (b.x < -20) b.x = W+20; else if (b.x > W+20) b.x = -20;
      if (b.y < -20) b.y = H+20; else if (b.y > H+20) b.y = -20;
    }
  }

  function isHome() { return window.location.pathname === '/'; }

  var _accentRgb = null;
  function accentRgba(alpha) {
    if (!_accentRgb) {
      var hex = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      _accentRgb = [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
    }
    return 'rgba('+_accentRgb[0]+','+_accentRgb[1]+','+_accentRgb[2]+','+alpha+')';
  }
  window._invalidateAccentCache = function () { _accentRgb = null; };

  function drawBoids(noClear) {
    if (!noClear) ctx.clearRect(0, 0, W, H);
    if (BOID_GLOW > 0) {
      ctx.shadowColor = accentRgba(1);
      ctx.shadowBlur  = BOID_GLOW;
    } else {
      ctx.shadowBlur = 0;
    }
    for (var i = 0; i < N; i++) {
      var b   = boids[i];
      var spd = Math.sqrt(b.vx*b.vx + b.vy*b.vy);
      if (spd < 1e-4) continue;
      var nx = b.vx/spd, ny = b.vy/spd;  // forward unit vector
      var px = -ny,      py = nx;          // perpendicular unit vector
      ctx.fillStyle = accentRgba(b.op !== undefined ? b.op : BOID_OPACITY);
      // Concave arrow shape (tip → left wing → notch → right wing)
      ctx.beginPath();
      ctx.moveTo(b.x + nx*BOID_LEN*0.65,                  b.y + ny*BOID_LEN*0.65);
      ctx.lineTo(b.x - nx*BOID_LEN*0.35 + px*BOID_HALF,   b.y - ny*BOID_LEN*0.35 + py*BOID_HALF);
      ctx.lineTo(b.x - nx*BOID_LEN*0.10,                  b.y - ny*BOID_LEN*0.10);
      ctx.lineTo(b.x - nx*BOID_LEN*0.35 - px*BOID_HALF,   b.y - ny*BOID_LEN*0.35 - py*BOID_HALF);
      ctx.closePath();
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  // ===== CONWAY'S GAME OF LIFE ==============================
  // Toroidal wrapping grid. Seeded with known long-lived patterns
  // (R-pentomino, Acorn, gliders, oscillators) plus a sparse random
  // base. Auto-fertilises by dropping structured patterns, not blobs.

  var CELL          = 7;
  var LIFE_OPACITY  = 0.09;
  var LIFE_GLOW     = 0;
  var LIFE_AUTOFILL = 1;
  var GW, GH;
  var grid, next;
  var lifeFrame = 0;
  var liveCount = 0;
  var lifeCurrentSpeed  = lifeSpeedLevel;
  var boidsCurrentSpeed = boidsSpeedLevel;
  var LIFE_RAINBOW   = 0;   // 0=off 1=time 2=age 3=position
  var lifeRainbowHue = 0;
  var cellAge        = null;

  var TRAIL_ON    = 0;    // 0=off 1=on
  var TRAIL_SIZE  = 2;    // 1=single cell  2=cross(5)  3=wide cross(9)
  var TRAIL_GLOW  = 12;   // 0-100 → extra opacity boost at peak heat
  var TRAIL_DECAY = 80;   // 0-100 → fade speed (0=slowest 100=fastest)
  var trailHeat   = null; // Float32Array, same dims as grid

  // Known patterns as [dx, dy] offsets from placement origin
  var PAT_GLIDER_SE = [[1,0],[2,1],[0,2],[1,2],[2,2]];            // moves SE
  var PAT_GLIDER_SW = [[1,0],[0,1],[2,1],[0,2],[1,2]];            // moves SW
  var PAT_GLIDER_NE = [[0,0],[1,0],[2,0],[2,1],[1,2]];            // moves NE
  var PAT_GLIDER_NW = [[0,0],[1,0],[2,0],[0,1],[1,2]];            // moves NW
  var PAT_RPENTO    = [[1,0],[2,0],[0,1],[1,1],[1,2]];            // ~1103 gen chaos
  var PAT_ACORN     = [[1,0],[3,1],[0,2],[1,2],[4,2],[5,2],[6,2]];// ~5206 gen chaos
  var PAT_DIEHARD   = [[6,0],[0,1],[1,1],[1,2],[5,2],[6,2],[7,2]];// 130 gens
  var PAT_BLINKER   = [[0,0],[1,0],[2,0]];                        // period-2
  var PAT_TOAD      = [[1,0],[2,0],[3,0],[0,1],[1,1],[2,1]];      // period-2
  var PAT_BEACON    = [[0,0],[1,0],[0,1],[3,2],[2,3],[3,3]];      // period-2

  // ── Spawnable complex structures ──────────────────────────
  var PAT_GOSPER_GUN = [                                          // infinite glider factory
    [24,0],
    [22,1],[24,1],
    [12,2],[13,2],[20,2],[21,2],[34,2],[35,2],
    [11,3],[15,3],[20,3],[21,3],[34,3],[35,3],
    [0,4],[1,4],[10,4],[16,4],[20,4],[21,4],
    [0,5],[1,5],[10,5],[14,5],[16,5],[17,5],[22,5],[24,5],
    [10,6],[16,6],[24,6],
    [11,7],[15,7],
    [12,8],[13,8]
  ];
  var PAT_PULSAR = [                                              // period-3 oscillator
    [2,0],[3,0],[4,0],[8,0],[9,0],[10,0],
    [0,2],[5,2],[7,2],[12,2],
    [0,3],[5,3],[7,3],[12,3],
    [0,4],[5,4],[7,4],[12,4],
    [2,5],[3,5],[4,5],[8,5],[9,5],[10,5],
    [2,7],[3,7],[4,7],[8,7],[9,7],[10,7],
    [0,8],[5,8],[7,8],[12,8],
    [0,9],[5,9],[7,9],[12,9],
    [0,10],[5,10],[7,10],[12,10],
    [2,12],[3,12],[4,12],[8,12],[9,12],[10,12]
  ];
  var PAT_LWSS = [                                                // lightweight spaceship
    [1,0],[2,0],[3,0],[4,0],
    [0,1],[4,1],
    [4,2],
    [0,3],[3,3]
  ];
  var PAT_PENTADECATHLON = [                                      // period-15 oscillator
    [1,0],[2,0],[3,0],
    [0,1],[4,1],
    [1,2],[2,2],[3,2],
    [1,3],[2,3],[3,3],
    [1,4],[2,4],[3,4],
    [1,5],[2,5],[3,5],
    [0,6],[4,6],
    [1,7],[2,7],[3,7]
  ];
  var PAT_SWITCHENGINE = [                                        // infinite growth
    [0,0],[2,0],
    [1,1],[2,1],[4,2],[5,2],[6,2],
    [0,2],[1,4],[2,4],[4,4],[5,4],[6,4],
    [1,5],[4,5]
  ];

  var PAT_HWSS = [                                                // heavyweight spaceship (13 cells, c/2) x=7,y=5 RLE: 3b2o2b$bo4bo$o6b$o5bo$6o!
    [3,0],[4,0],
    [1,1],[6,1],
    [0,2],
    [0,3],[6,3],
    [0,4],[1,4],[2,4],[3,4],[4,4],[5,4]
  ];
  // RLE source: conwaylife.com URL param — period-30 oscillator (26 cells, 22×7) found by Gosper 1970
  var PAT_QUEEN_BEE = [                                           // queen bee shuttle — RLE: 9b2o$9bobo$4b2o6bo7b2o$2obo2bo2bo2bo7b2o$2o2b2o6bo$9bobo$9b2o!
    [9,0],[10,0],
    [9,1],[11,1],
    [4,2],[5,2],[12,2],[20,2],[21,2],
    [0,3],[1,3],[3,3],[6,3],[9,3],[12,3],[20,3],[21,3],
    [0,4],[1,4],[4,4],[5,4],[12,4],
    [9,5],[11,5],
    [9,6],[10,6]
  ];

  var SPAWN_PATTERNS = {
    'r-pentomino':    PAT_RPENTO,
    'acorn':          PAT_ACORN,
    'gosper-gun':     PAT_GOSPER_GUN,
    'queen-bee':      PAT_QUEEN_BEE,
    'pulsar':         PAT_PULSAR,
    'pentadecathlon': PAT_PENTADECATHLON,
    'lwss':           PAT_LWSS,
    'hwss':           PAT_HWSS,
  };

  function placePattern(cx, cy, cells) {
    for (var i = 0; i < cells.length; i++) {
      var x = ((cx + cells[i][0]) % GW + GW) % GW;
      var y = ((cy + cells[i][1]) % GH + GH) % GH;
      if (!grid[y * GW + x]) { grid[y * GW + x] = 1; liveCount++; }
    }
  }

  function initLife() {
    GW        = Math.ceil(W / CELL);
    GH        = Math.ceil(H / CELL);
    grid      = new Uint8Array(GW * GH);
    next      = new Uint8Array(GW * GH);
    liveCount = 0;
    lifeFrame = 0;
    cellAge   = LIFE_RAINBOW === 2 ? new Uint16Array(GW * GH) : null;
    trailHeat = new Float32Array(GW * GH);

    // Sparse random base — density scales with autofill (>1 = overpopulated)
    var fillRate = LIFE_AUTOFILL <= 1
      ? 0.12 * LIFE_AUTOFILL
      : 0.12 + (LIFE_AUTOFILL - 1) * 0.43;  // 1→12%, 2→55%
    for (var i = 0; i < GW * GH; i++) {
      if (Math.random() < fillRate) { grid[i] = 1; liveCount++; }
    }

    if (LIFE_AUTOFILL > 0) {
      // Scatter gliders in all four directions
      var gliders = [PAT_GLIDER_SE, PAT_GLIDER_SW, PAT_GLIDER_NE, PAT_GLIDER_NW];
      for (var k = 0; k < Math.round(16 * LIFE_AUTOFILL); k++) {
        placePattern(Math.floor(Math.random() * GW), Math.floor(Math.random() * GH), gliders[k % 4]);
      }
      // Long-lived chaos seeds that produce gliders and complex structures
      for (var k = 0; k < Math.round(10 * LIFE_AUTOFILL); k++) {
        placePattern(Math.floor(Math.random() * GW), Math.floor(Math.random() * GH), PAT_RPENTO);
      }
      for (var k = 0; k < Math.round(5 * LIFE_AUTOFILL); k++) {
        placePattern(Math.floor(Math.random() * GW), Math.floor(Math.random() * GH), PAT_ACORN);
      }
      for (var k = 0; k < Math.round(4 * LIFE_AUTOFILL); k++) {
        placePattern(Math.floor(Math.random() * GW), Math.floor(Math.random() * GH), PAT_DIEHARD);
      }
      // Quick oscillators for immediate visual interest
      var oscs = [PAT_BLINKER, PAT_TOAD, PAT_BEACON];
      for (var k = 0; k < Math.round(24 * LIFE_AUTOFILL); k++) {
        placePattern(Math.floor(Math.random() * GW), Math.floor(Math.random() * GH), oscs[k % 3]);
      }
    }
  }

  function stepLife() {
    liveCount = 0;
    for (var y = 0; y < GH; y++) {
      for (var x = 0; x < GW; x++) {
        var n = 0;
        for (var dy = -1; dy <= 1; dy++) {
          for (var dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;
            n += grid[((y+dy+GH)%GH)*GW + ((x+dx+GW)%GW)];
          }
        }
        var alive = grid[y*GW + x];
        next[y*GW + x] = alive ? (n===2||n===3 ? 1:0) : (n===3 ? 1:0);
        if (next[y*GW + x]) liveCount++;
      }
    }
    var tmp = grid; grid = next; next = tmp;
    if (LIFE_RAINBOW === 1) lifeRainbowHue = (lifeRainbowHue + 2) % 360;
    if (LIFE_RAINBOW === 2 && cellAge) {
      for (var i = 0; i < GW * GH; i++)
        cellAge[i] = grid[i] ? Math.min(65535, cellAge[i] + 1) : 0;
    }
    // Auto-fertilise: keep activity up so the sim never looks like it stalled
    if (LIFE_AUTOFILL > 0 && liveCount < GW * GH * 0.05 * LIFE_AUTOFILL) {
      var seeds = [PAT_RPENTO, PAT_ACORN, PAT_DIEHARD, PAT_GLIDER_SE, PAT_GLIDER_NW];
      var numSeeds = Math.max(1, Math.round(5 * LIFE_AUTOFILL));
      for (var k = 0; k < numSeeds; k++) {
        placePattern(
          Math.floor(Math.random() * GW),
          Math.floor(Math.random() * GH),
          seeds[k % seeds.length]
        );
      }
    }
  }

  function drawLife(noClear) {
    if (!noClear) ctx.clearRect(0, 0, W, H);
    if (LIFE_GLOW > 0) {
      ctx.shadowColor = LIFE_RAINBOW > 0 ? 'rgba(255,255,255,0.8)' : accentRgba(1);
      ctx.shadowBlur  = LIFE_GLOW;
    } else {
      ctx.shadowBlur = 0;
    }
    if (LIFE_RAINBOW === 0) {
      ctx.fillStyle = accentRgba(LIFE_OPACITY);
      for (var y = 0; y < GH; y++)
        for (var x = 0; x < GW; x++)
          if (grid[y*GW + x]) ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
    } else if (LIFE_RAINBOW === 1) {
      // time: all cells same hue, rotates each step
      ctx.fillStyle = 'hsla(' + lifeRainbowHue + ',72%,60%,' + LIFE_OPACITY + ')';
      for (var y = 0; y < GH; y++)
        for (var x = 0; x < GW; x++)
          if (grid[y*GW + x]) ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
    } else if (LIFE_RAINBOW === 2) {
      // age: newly born = red, older cycles through spectrum
      for (var y = 0; y < GH; y++) {
        for (var x = 0; x < GW; x++) {
          if (!grid[y*GW + x]) continue;
          var age = cellAge ? cellAge[y*GW + x] : 0;
          ctx.fillStyle = 'hsla(' + (age * 4 % 360) + ',72%,60%,' + LIFE_OPACITY + ')';
          ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
        }
      }
    } else if (LIFE_RAINBOW === 3) {
      // position: diagonal spatial rainbow
      for (var y = 0; y < GH; y++) {
        for (var x = 0; x < GW; x++) {
          if (!grid[y*GW + x]) continue;
          var hue = Math.round((x + y) * 360 / (GW + GH)) % 360;
          ctx.fillStyle = 'hsla(' + hue + ',72%,60%,' + LIFE_OPACITY + ')';
          ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
        }
      }
    }
    ctx.shadowBlur = 0;

    // trail glow: second pass — hot cells drawn brighter on top
    if (TRAIL_ON && TRAIL_GLOW > 0 && trailHeat) {
      for (var y = 0; y < GH; y++) {
        for (var x = 0; x < GW; x++) {
          var idx = y * GW + x;
          var h = trailHeat[idx];
          if (!grid[idx] || h < 0.005) continue;
          var extra = h * (TRAIL_GLOW / 100);
          ctx.shadowColor = accentRgba(1);
          ctx.shadowBlur  = extra * 12;
          ctx.fillStyle   = accentRgba(Math.min(1, LIFE_OPACITY + extra));
          ctx.fillRect(x*CELL+1, y*CELL+1, CELL-2, CELL-2);
        }
      }
      ctx.shadowBlur = 0;
    }
  }

  // ===== RESIZE / LOOP ======================================

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    initMode(MODES[modeIdx]);
  }

  // Returns {skip, multi} for a given speed percentage 0–100.
  // Converts pct→1–20 equivalent, then: skip=N means step every N frames; multi=N means N steps per frame.
  function lifeStepRate(pct) {
    var sp = 1 + pct / 100 * 19;
    if (sp <= 10) return { skip: Math.max(1, Math.round(36 * Math.pow(1/36, (sp-1)/9))), multi: 1 };
    return { skip: 1, multi: Math.round(1 + (sp - 10) * 1.2) };
  }

  function loop() {
    if (document.hidden) { requestAnimationFrame(loop); return; }
    lifeCurrentSpeed  += (lifeSpeedLevel  - lifeCurrentSpeed)  * 0.07;
    boidsCurrentSpeed += (boidsSpeedLevel - boidsCurrentSpeed) * 0.07;

    // decay trail heat every frame for smooth fade regardless of sim speed
    if (TRAIL_ON && trailHeat) {
      var dr = 0.998 - (TRAIL_DECAY / 100) * 0.198;
      for (var i = 0; i < trailHeat.length; i++) {
        if (trailHeat[i] > 0.001) trailHeat[i] *= dr;
        else if (trailHeat[i] > 0) trailHeat[i] = 0;
      }
    }

    var mode = MODES[modeIdx];
    if (mode === 'life') {
      if (lifeSpeedLevel > 0) {
        lifeFrame++;
        var lr = lifeStepRate(lifeCurrentSpeed);
        if (lr.multi > 1) { for (var i = 0; i < lr.multi; i++) stepLife(); }
        else if (lifeFrame % lr.skip === 0) stepLife();
      }
      drawLife(false);
    } else if (mode === 'boids') {
      if (boidsSpeedLevel > 0) updateBoids();
      drawBoids(false);
    } else if (mode === 'combo') {
      if (lifeSpeedLevel > 0) {
        lifeFrame++;
        var lr = lifeStepRate(lifeCurrentSpeed);
        if (lr.multi > 1) { for (var i = 0; i < lr.multi; i++) stepLife(); }
        else if (lifeFrame % lr.skip === 0) stepLife();
      }
      if (boidsSpeedLevel > 0) updateBoids();
      ctx.clearRect(0, 0, W, H);
      drawLife(true);   // noClear=true: life drawn on fresh canvas
      drawBoids(true);  // noClear=true: boids drawn on top
    } else {
      ctx.clearRect(0, 0, W, H);
    }
    requestAnimationFrame(loop);
  }

  resize();
  updateBtn();
  window.addEventListener('resize', resize);
  requestAnimationFrame(loop);

  // ── Mouse trail: plant live cells where the cursor moves ──
  var _trailGX = -1, _trailGY = -1, _trailBlocked = false;
  var TRAIL_PATTERNS = [
    [[0,0]],
    [[0,0],[1,0],[-1,0],[0,1],[0,-1]],
    [[0,0],[1,0],[-1,0],[0,1],[0,-1],[2,0],[-2,0],[0,2],[0,-2]],
  ];
  window.addEventListener('mousemove', function (e) {
    var mode = MODES[modeIdx];
    if (!TRAIL_ON || (mode !== 'life' && mode !== 'combo') || window._pendingSpawn || _trailBlocked) return;
    if (!grid) return;
    var gx = Math.floor(e.clientX / CELL);
    var gy = Math.floor(e.clientY / CELL);
    if (gx === _trailGX && gy === _trailGY) return;
    _trailGX = gx; _trailGY = gy;
    var pts = TRAIL_PATTERNS[Math.max(0, Math.min(2, TRAIL_SIZE - 1))];
    for (var i = 0; i < pts.length; i++) {
      var cx = gx + pts[i][0], cy = gy + pts[i][1];
      if (cx >= 0 && cx < GW && cy >= 0 && cy < GH) {
        var idx = cy * GW + cx;
        if (!grid[idx]) { grid[idx] = 1; liveCount++; }
        if (trailHeat) trailHeat[idx] = 1.0;
      }
    }
  }, { passive: true });

  // expose controls for terminal commands
  window.setBgMode = function (m) {
    var idx = MODES.indexOf(m);
    if (idx < 0) return false;
    modeIdx = idx;
    localStorage.setItem('bgMode', m);
    updateBtn();
    initMode(m);
    if (window._rebuildPresetPicker) window._rebuildPresetPicker();
    return true;
  };
  window.getBgMode    = function () { return MODES[modeIdx]; };
  window.setLifeSpeed = function (n) {
    lifeSpeedLevel = Math.max(0, Math.min(100, Math.round(n)));
    localStorage.setItem('bgLifeSpeed', lifeSpeedLevel);
  };
  window.setBoidsSpeed = function (n) {
    boidsSpeedLevel = Math.max(0, Math.min(100, Math.round(n)));
    localStorage.setItem('bgBoidsSpeed', boidsSpeedLevel);
  };
  window.setBgSpeed = function (n) {  // sets both (backward compat)
    window.setLifeSpeed(n); window.setBoidsSpeed(n);
  };
  window.getLifeSpeed  = function () { return lifeSpeedLevel; };
  window.getBoidsSpeed = function () { return boidsSpeedLevel; };
  window.getBgSpeed    = function () { return lifeSpeedLevel; };
  window.resetBg       = function () { LIFE_AUTOFILL = 1; initMode(MODES[modeIdx]); };

  function ensureLife() {
    if (MODES[modeIdx] !== 'life' && MODES[modeIdx] !== 'combo') {
      modeIdx = MODES.indexOf('life'); initMode('life'); updateBtn();
    } else if (MODES[modeIdx] === 'combo' && !grid) {
      initLife();
    }
  }

  window.spawnPattern = function (name) {
    var pat = SPAWN_PATTERNS[name];
    if (!pat) return false;
    ensureLife();
    if (!grid) return false;
    placePattern(Math.floor(Math.random() * GW), Math.floor(Math.random() * GH), pat);
    return true;
  };

  var spawnOverlay = document.getElementById('spawn-overlay');
  var spawnHint    = document.getElementById('spawn-hint');

  function updateSpawnHint() {
    if (!spawnHint) return;
    var n = window._pendingSpawnCount || 1;
    var name = window._pendingSpawn || '';
    var countStr = n > 1 ? ' <span class="sh-count">(' + n + ' left)</span>' : '';
    spawnHint.innerHTML =
      '<span class="sh-name">' + name + '</span>' + countStr +
      ' &nbsp;·&nbsp; click to place &nbsp;·&nbsp; <span class="sh-esc">esc to cancel</span>';
  }

  function cancelSpawn() {
    window._pendingSpawn = null;
    window._pendingSpawnCount = 0;
    if (spawnOverlay) spawnOverlay.classList.remove('active');
    _trailGX = -1; _trailGY = -1;
    _trailBlocked = true;
    setTimeout(function () { _trailBlocked = false; }, 500);
  }
  window.cancelSpawn = cancelSpawn;

  if (spawnOverlay) {
    spawnOverlay.addEventListener('click', function (e) {
      var name = window._pendingSpawn;
      if (!name) return;
      var pat = SPAWN_PATTERNS[name];
      if (!pat || !grid) { cancelSpawn(); return; }
      var gx = Math.floor(e.clientX / CELL);
      var gy = Math.floor(e.clientY / CELL);
      placePattern(gx, gy, pat);
      window._pendingSpawnCount = (window._pendingSpawnCount || 1) - 1;
      if (window._pendingSpawnCount <= 0) {
        cancelSpawn();
      } else {
        updateSpawnHint();
      }
    });
  }

  window.queueSpawn = function (name, count) {
    if (!SPAWN_PATTERNS[name]) return false;
    ensureLife();
    window._pendingSpawn = name;
    window._pendingSpawnCount = Math.max(1, Math.min(20, count || 1));
    updateSpawnHint();
    if (spawnOverlay) spawnOverlay.classList.add('active');
    var termOverlay = document.getElementById('term-overlay');
    if (termOverlay) termOverlay.classList.remove('open');
    return true;
  };

  window.clearLife = function () {
    ensureLife();
    if (!grid) return false;
    grid.fill(0);
    liveCount = 0;
    LIFE_AUTOFILL = 0;
    return true;
  };

  window.setLifeAutofill = function (val) { LIFE_AUTOFILL = Math.max(0, Math.min(2, parseFloat(val) || 0)); };

  window.startAutofill = function () {
    ensureLife();
    LIFE_AUTOFILL = 1;
    /* seed a few patterns immediately so something appears */
    var seeds = [PAT_RPENTO, PAT_ACORN, PAT_DIEHARD, PAT_GLIDER_SE];
    for (var k = 0; k < seeds.length; k++) {
      placePattern(Math.floor(Math.random() * GW), Math.floor(Math.random() * GH), seeds[k]);
    }
  };

  window.spawnPatternNames = function () { return Object.keys(SPAWN_PATTERNS); };

  window.getBgParams = function () {
    return {
      'life.cell':      CELL,
      'life.opacity':   Math.round(LIFE_OPACITY * 100),
      'life.glow':      Math.round(LIFE_GLOW / 40 * 100),
      'life.autofill':  Math.round(LIFE_AUTOFILL / 2 * 100),
      'life.rainbow':   LIFE_RAINBOW,
      'life.speed':     lifeSpeedLevel,
      'boids.n':          N,
      'boids.size':       BOID_LEN,
      'boids.tick':       MAX_SPEED,
      'boids.perception': PERCEPTION,
      'boids.separation': SEP_DIST,
      'boids.opacity':    Math.round(BOID_OPACITY * 100),
      'boids.glow':       Math.round(BOID_GLOW / 40 * 100),
      'boids.speed':      boidsSpeedLevel,
      'trail.on':         TRAIL_ON,
      'trail.size':       TRAIL_SIZE,
      'trail.glow':       TRAIL_GLOW,
      'trail.decay':      TRAIL_DECAY,
    };
  };

  window.setParam = function (key, val) {
    switch (key) {
      case 'life.cell':
        CELL = Math.max(1, Math.min(80, Math.round(val)));
        if (MODES[modeIdx] === 'life' || MODES[modeIdx] === 'combo') initLife();
        return true;
      case 'life.opacity':
        LIFE_OPACITY = Math.max(0.01, Math.min(1, parseFloat(val) / 100));
        return true;
      case 'life.glow':
        LIFE_GLOW = Math.max(0, Math.min(40, (parseFloat(val) / 100) * 40));
        return true;
      case 'life.autofill':
        LIFE_AUTOFILL = Math.max(0, Math.min(2, (parseFloat(val) / 100) * 2));
        if (MODES[modeIdx] === 'life' || MODES[modeIdx] === 'combo') initLife();
        return true;
      case 'life.rainbow':
        LIFE_RAINBOW = Math.max(0, Math.min(3, Math.round(parseFloat(val) || 0)));
        if (LIFE_RAINBOW === 2 && !cellAge && grid) cellAge = new Uint16Array(GW * GH);
        return true;
      case 'life.speed':
        window.setLifeSpeed(parseFloat(val));
        return true;
      case 'boids.speed':
        window.setBoidsSpeed(parseFloat(val));
        return true;
      case 'boids.n':
        N = Math.max(1, Math.min(1000, Math.round(val)));
        if (MODES[modeIdx] === 'boids' || MODES[modeIdx] === 'combo') initBoids();
        return true;
      case 'boids.size':
        BOID_LEN  = Math.max(1, Math.min(200, val));
        BOID_HALF = BOID_LEN * 0.393;
        return true;
      case 'boids.tick':
        MAX_SPEED = Math.max(0, Math.min(30, val));
        MIN_SPEED = Math.min(MIN_SPEED, Math.max(0, MAX_SPEED * 0.33));
        return true;
      case 'boids.perception':
        PERCEPTION = Math.max(1, Math.min(2000, val));
        return true;
      case 'boids.separation':
        SEP_DIST = Math.max(0, Math.min(1000, val));
        return true;
      case 'boids.opacity':
        BOID_OPACITY = Math.max(0.01, Math.min(1, parseFloat(val) / 100));
        return true;
      case 'boids.glow':
        BOID_GLOW = Math.max(0, Math.min(40, (parseFloat(val) / 100) * 40));
        return true;
      case 'trail.on':
        TRAIL_ON = val ? 1 : 0;
        return true;
      case 'trail.size':
        TRAIL_SIZE = Math.max(1, Math.min(3, Math.round(val)));
        return true;
      case 'trail.glow':
        TRAIL_GLOW = Math.max(0, Math.min(100, Math.round(parseFloat(val))));
        return true;
      case 'trail.decay':
        TRAIL_DECAY = Math.max(0, Math.min(100, Math.round(parseFloat(val))));
        return true;
      default:
        return false;
    }
  };

  // wrap setParam to persist individual param changes to localStorage
  var _origSetParam = window.setParam;
  window.setParam = function (key, val) {
    var ok = _origSetParam(key, val);
    if (ok) localStorage.setItem('p:' + key, String(val));
    return ok;
  };

  // ── presets ──────────────────────────────────────────────────
  // All speeds (lspeed/bspeed) are 0–100%. Opacity/glow/autofill params also 0–100%.
  var PRESETS = {
    // default — exact site defaults + tokyo-night
    'default':  { sim:'combo', lspeed:15, bspeed:15, theme:'tokyo-night', desc:'site defaults',
      params:{'life.cell':7,  'life.opacity':9,  'life.glow':0,  'life.autofill':50, 'life.rainbow':0,
              'boids.n':120, 'boids.size':14, 'boids.tick':1.8, 'boids.opacity':14, 'boids.glow':0,
              'trail.on':0,  'trail.size':2,  'trail.glow':12, 'trail.decay':80} },
    // ghost — same as default, any theme
    ghost:     { sim:'combo', lspeed:15, bspeed:15, desc:'any theme',
      params:{'life.cell':7,  'life.opacity':9,  'life.glow':0,  'life.autofill':50, 'life.rainbow':0,
              'boids.n':120, 'boids.size':14, 'boids.tick':1.8, 'boids.opacity':14, 'boids.glow':0,
              'trail.on':0,  'trail.size':2,  'trail.glow':12, 'trail.decay':80} },
    // mist — barely there life
    mist:      { sim:'life',  lspeed:12, bspeed:null,
      desc:'barely there',
      params:{'life.cell':8,  'life.opacity':6,  'life.glow':0,  'life.autofill':40, 'life.rainbow':0,
              'trail.on':0} },
    bloom:     { sim:'life',  lspeed:20, bspeed:null, theme:'tokyo-night',
      desc:'glow + trail',
      params:{'life.cell':5,  'life.opacity':70, 'life.glow':80, 'life.autofill':55, 'life.rainbow':0,
              'trail.on':1,   'trail.glow':45,   'trail.decay':60, 'trail.size':2} },
    ember:     { sim:'life',  lspeed:18, bspeed:null, theme:'gruvbox',
      desc:'warm glow',
      params:{'life.cell':8,  'life.opacity':35, 'life.glow':55, 'life.autofill':50, 'life.rainbow':0,
              'trail.on':0} },
    chromatic: { sim:'life',  lspeed:20, bspeed:null,
      desc:'rainbow',
      params:{'life.cell':6,  'life.opacity':55, 'life.glow':20, 'life.autofill':50, 'life.rainbow':1,
              'trail.on':0} },
    paper:     { sim:'life',  lspeed:12, bspeed:null, theme:'papercolor-light',
      desc:'soft cells',
      params:{'life.cell':10, 'life.opacity':20, 'life.glow':0,  'life.autofill':35, 'life.rainbow':0,
              'trail.on':0} },
    // boids
    flock:     { sim:'boids', lspeed:null, bspeed:18,
      desc:'calm flock',
      params:{'boids.n':80,  'boids.size':15, 'boids.tick':1.4, 'boids.opacity':15, 'boids.glow':0,
              'boids.perception':80, 'boids.separation':40} },
    midnight:  { sim:'boids', lspeed:null, bspeed:15, theme:'tokyo-night',
      desc:'dark glow',
      params:{'boids.n':50,  'boids.size':20, 'boids.tick':1.0, 'boids.opacity':85, 'boids.glow':70,
              'boids.perception':100, 'boids.separation':60} },
    dusk:      { sim:'boids', lspeed:null, bspeed:14, theme:'dracula',
      desc:'purple glow',
      params:{'boids.n':40,  'boids.size':28, 'boids.tick':0.9, 'boids.opacity':75, 'boids.glow':65,
              'boids.perception':120, 'boids.separation':80} },
    soft:      { sim:'boids', lspeed:null, bspeed:10, theme:'rose-pine',
      desc:'slow drift',
      params:{'boids.n':20,  'boids.size':45, 'boids.tick':0.5, 'boids.opacity':60, 'boids.glow':30,
              'boids.perception':150, 'boids.separation':100} },
    swarm:     { sim:'boids', lspeed:null, bspeed:20, theme:'gruvbox',
      desc:'fast dense',
      params:{'boids.n':300, 'boids.size':6,  'boids.tick':3.5, 'boids.opacity':22, 'boids.glow':0,
              'boids.perception':60,  'boids.separation':30} },
  };

  window.getPresetNames = function () { return Object.keys(PRESETS); };
  window.getPresetsForMode = function (mode) {
    return Object.keys(PRESETS).filter(function (k) { return PRESETS[k].sim === mode; });
  };

  // ── preset picker — shows all presets; applying one switches mode automatically ─
  var THEME_ACCENTS = {
    'tokyo-night':      '#7aa2f7',
    'gruvbox':          '#d79921',
    'dracula':          '#bd93f9',
    'rose-pine':        '#b4637a',
    'github-light':     '#0969da',
    'papercolor-light': '#005f87'
  };

  function rebuildPresetPicker() {
    var menu = document.getElementById('preset-picker-menu');
    if (!menu) return;
    menu.innerHTML = '';
    var header = document.createElement('div');
    header.className = 'tp-header';
    header.textContent = ':preset';
    menu.appendChild(header);
    var names = window.getPresetNames();
    names.forEach(function (name) {
      var p = PRESETS[name];
      var btn = document.createElement('button');
      btn.className = 'tp-item' + (activePreset === name ? ' active' : '');
      var themeTag = p.theme && THEME_ACCENTS[p.theme]
        ? '<span class="tp-swatch" style="background:' + THEME_ACCENTS[p.theme] + '" title="' + p.theme + '"></span>'
        : '<span class="tp-variant">any</span>';
      btn.innerHTML = '<span class="tp-arrow">▶</span>' + name + themeTag;
      btn.addEventListener('click', function () {
        window.applyPreset(name);
        document.getElementById('preset-picker-menu').classList.remove('open');
      });
      menu.appendChild(btn);
    });
  }
  window._rebuildPresetPicker = rebuildPresetPicker;

  document.addEventListener('DOMContentLoaded', function () {
    // restore individual params (overrides preset defaults with any manually-changed values)
    var PARAM_KEYS = ['life.cell','life.opacity','life.glow','life.autofill','life.rainbow',
      'boids.n','boids.size','boids.tick','boids.opacity','boids.glow','boids.perception','boids.separation',
      'trail.on','trail.size','trail.glow','trail.decay'];
    var savedPreset = localStorage.getItem('preset');
    if (savedPreset && PRESETS[savedPreset]) window.applyPreset(savedPreset);
    for (var ki = 0; ki < PARAM_KEYS.length; ki++) {
      var sv = localStorage.getItem('p:' + PARAM_KEYS[ki]);
      if (sv !== null) _origSetParam(PARAM_KEYS[ki], parseFloat(sv));
    }
    rebuildPresetPicker();
    var ppBtn  = document.getElementById('preset-picker-btn');
    var ppMenu = document.getElementById('preset-picker-menu');
    if (ppBtn && ppMenu) {
      ppBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        rebuildPresetPicker();
        ppMenu.classList.toggle('open');
      });
      document.addEventListener('click', function () { ppMenu.classList.remove('open'); });
      ppMenu.addEventListener('click', function (e) { e.stopPropagation(); });
    }
  });

  // rebuild picker whenever mode changes
  var _origCycleMode = cycleMode;
  cycleMode = function () { _origCycleMode(); rebuildPresetPicker(); };

  var activePreset = null;
  window.applyPreset = function (name) {
    var p = PRESETS[name];
    if (!p) return false;
    if (p.theme) applyTheme(p.theme);
    if (p.sim) window.setBgMode(p.sim);
    if (p.lspeed != null) window.setLifeSpeed(p.lspeed);
    if (p.bspeed != null) window.setBoidsSpeed(p.bspeed);
    var keys = Object.keys(p.params);
    for (var i = 0; i < keys.length; i++) window.setParam(keys[i], p.params[keys[i]]);
    activePreset = name;
    localStorage.setItem('preset', name);
    if (window._rebuildPresetPicker) window._rebuildPresetPicker();
    return true;
  };
  window.getActivePreset = function () { return activePreset; };
})();
// ================================================================
// END BG EFFECT
// ================================================================

// ================================================================
// HIDDEN TERMINAL — press ':' or click [:] to open
// ================================================================
(function () {
  var overlay    = document.getElementById('term-overlay');
  var output     = document.getElementById('term-output');
  var inp        = document.getElementById('term-input');
  var inpRow     = document.getElementById('term-input-row');
  var termPrompt = document.getElementById('term-prompt');
  if (!overlay || !output || !inp) return;
  var DEFAULT_PROMPT = termPrompt ? termPrompt.innerHTML : '~$&nbsp;';

  var hist = [], histIdx = -1, isOpen = false;
  var PAGE_START = Date.now();
  var _gameMode = false, _gameResume = null;
  var _gCache = null, _gCacheAt = 0, _gById = {}, G_TTL = 300000; // 5 min

  function _renderGames(gs) {
    if (!gs.length) { line('no games yet. visit /arcade to submit one.', 'term-line-ok'); return; }
    var W = 22;
    var rows = gs.map(function(g) {
      var t = g.title.length > W ? g.title.slice(0, W - 1) + '\u2026' : g.title;
      while (t.length < W) t += ' ';
      var a = 'by ' + g.author; if (a.length > 18) a = a.slice(0, 17) + '\u2026'; while (a.length < 18) a += ' ';
      return '  ' + t + '  ' + a + '  \u2192  play ' + g.id;
    });
    line(['', 'community arcade'].concat(rows).concat(['', 'play <id> to start  \u00b7  /arcade to submit']).join('\n'), 'term-line-pre');
  }

  var QUOTES = [
    '"the best code is no code at all."  (jeff atwood)',
    '"walking on water and developing software from a spec are easy if both are frozen."  (e.v. berard)',
    '"first, solve the problem. then, write the code."  (john johnson)',
    '"make it work, make it right, make it fast."  (kent beck)',
    '"any fool can write code a computer understands. good programmers write code humans understand."  (fowler)',
    '"debugging is twice as hard as writing the code in the first place."  (brian kernighan)',
    '"the most dangerous phrase: \'we\'ve always done it this way\'."  (grace hopper)',
    '"talk is cheap. show me the code."  (linus torvalds)',
    '"programs must be written for people to read, and only incidentally for machines to execute."  (abelson)',
    '"simplicity is the soul of efficiency."  (austin freeman)',
    '"it works on my machine."  (every developer)',
    '"weeks of coding can save you hours of planning."  (unknown)',
    '"a language that doesn\'t affect the way you think about programming is not worth knowing."  (alan perlis)',
    '"the computer was born to solve problems that did not exist before."  (bill gates)',
    '"software is like entropy: it is difficult to grasp, weighs nothing, and obeys the second law of thermodynamics."  (norman augustine)',
  ];

  // ── filesystem — populated by Hugo via baseof.html ─────────────────────────
  var FS = (typeof TERMINAL_DATA !== 'undefined') ? TERMINAL_DATA : { '': { type: 'dir' } };
  var cwd = '';

  function resolvePath(p) {
    if (!p || p === '~' || p === '/') return '';
    var base = (p[0] === '/') ? '' : (cwd ? cwd + '/' : '');
    var full = base + p.replace(/^\//, '');
    var parts = full.split('/').filter(Boolean);
    var stack = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] === '..') { if (stack.length) stack.pop(); }
      else if (parts[i] !== '.') { stack.push(parts[i]); }
    }
    return stack.join('/');
  }

  function lsChildren(dirPath) {
    var prefix = dirPath ? dirPath + '/' : '';
    var names = Object.keys(FS).filter(function (p) {
      if (!p || p === dirPath) return false;
      if (prefix && p.indexOf(prefix) !== 0) return false;
      if (!prefix && p.indexOf('/') !== -1) return false;
      return p.slice(prefix.length).indexOf('/') === -1;
    }).map(function (p) { return p.slice(prefix.length); });
    return names.sort(function (a, b) {
      var aDir = FS[prefix + a] && FS[prefix + a].type === 'dir';
      var bDir = FS[prefix + b] && FS[prefix + b].type === 'dir';
      if (aDir && !bDir) return -1;
      if (!aDir && bDir) return 1;
      return a.localeCompare(b);
    });
  }

  function updatePrompt() {
    var ps = document.getElementById('term-prompt');
    var pb = document.getElementById('term-path');
    var loc = cwd ? '~/' + cwd : '~';
    if (ps) ps.textContent = loc + '$\u00a0';
    if (pb) pb.textContent = 'ekansh@site:' + loc;
  }

  var NEOFETCH = [
    'ekansh@site',
    '──────────────────────────',
    'age       12',
    'editor    vim',
    'hobbies   bjj  music  cs  reading',
    '',
    'github    github.com/ekansh38',
  ].join('\n');

  // ── help system ─────────────────────────────────────────────
  var HELP_INDEX = [
    'help [topic|command]',
    '',
    '  nav    ls  cat  cd  pwd  open',
    '  bg     modes  speed  reset  preset  params  set',
    '  life   wipe  fill  spawn  life params',
    '  boids  boids params',
    '  trail  mouse trail params',
    '  look   colorscheme  color',
    '  sys    neofetch  top  ps  df  env  history  whoami',
    '  fun    cowsay  curl',
    '  arcade games  play  scores  source  delete',
    '',
    '  :     open   ·   esc   close   ·   tab   autocomplete',
  ].join('\n');

  var HELP_TOPICS = {
    help: [
      'help [topic|command]',
      '',
      '  help           this list',
      '  help nav       filesystem commands',
      '  help bg        simulation overview',
      '  help life      life sim params + commands',
      '  help boids     boids params',
      '  help trail     mouse trail params',
      '  help look      colorschemes',
      '  help sys       system commands',
      '  help fun       misc commands',
      '  help arcade    arcade commands',
      '  help <cmd>     usage for any command',
    ].join('\n'),

    nav: [
      'nav',
      '',
      '  ls [path]      list directory',
      '  cat <path>     print file',
      '  cd [path]      change dir  (cd ..  /  cd)',
      '  pwd            working dir',
      '  open <path>    navigate to page',
      '',
      '  projects/   writing/   music/   games/',
      '',
      '  ls projects/geno',
      '  cat music/btop',
      '  open projects/geno',
    ].join('\n'),

    bg: [
      'bg (simulation overview)',
      '',
      '  bg [life|boids|combo|off]    get/set mode',
      '  speed [life|boids] [0-100]   get/set speed (%)',
      '  reset                        reinit from scratch',
      '  preset <name>                apply a named preset',
      '  params                       all params + current values',
      '  set <param> <val>            change a param',
      '',
      'presets:  default  ghost  mist  bloom  ember  chromatic  paper',
      '          flock  midnight  dusk  soft  swarm',
      '',
      '  help life    life sim params + commands',
      '  help boids   boids params',
      '  help trail   mouse trail params',
    ].join('\n'),

    life: [
      'life (conway\'s game of life)',
      '',
      '  wipe                     clear grid, stop autofill',
      '  fill                     re-enable autofill',
      '  spawn <pat>              click to place pattern',
      '  spawn <pat> random [n]   n random placements',
      '',
      'patterns:',
      '  r-pentomino  acorn  gosper-gun  queen-bee',
      '  pulsar  pentadecathlon  lwss  hwss',
      '',
      'params:',
      '  life.cell      1–80    default 7',
      '  life.opacity   0–100%  default 9',
      '  life.glow      0–100%  default 0',
      '  life.autofill  0–100%  default 50',
      '  life.rainbow   0–3     default 0  (0=off 1=time 2=age 3=pos)',
      '  life.speed     0–100%  default 15  (sim tick rate)',
    ].join('\n'),

    boids: [
      'boids (flocking simulation)',
      '',
      'params:',
      '  boids.n           1–1000   default 120',
      '  boids.size        1–200    default 14',
      '  boids.tick        0–30     default 1.8  (velocity)',
      '  boids.speed       0–100%   default 15   (sim tick rate)',
      '  boids.perception  1–2000   default 55',
      '  boids.separation  0–1000   default 50',
      '  boids.opacity     0–100%   default 14',
      '  boids.glow        0–100%   default 0',
      '',
      '  <param>   →  prints current value',
    ].join('\n'),

    trail: [
      'trail (mouse trail, life/combo mode only)',
      '',
      '  move the cursor over the canvas to plant live cells',
      '  trail cells glow bright and fade back to base opacity',
      '',
      'params:',
      '  trail.on      0=off 1=on        default 1',
      '  trail.size    1–3               default 2  (1=dot 2=cross 3=wide)',
      '  trail.glow    0–100%            default 12 (brightness boost)',
      '  trail.decay   0–100%            default 80 (0=slow fade 100=fast)',
      '',
      '  set trail.glow 80    brighter trail',
      '  set trail.decay 20   trail lingers longer',
      '  set trail.on 0       disable',
    ].join('\n'),

    look: [
      'look',
      '',
      '  colorscheme [name]   list / apply',
      '  color                current palette',
      '',
      '  tokyo-night    dark  (default)',
      '  gruvbox        dark',
      '  kanagawa       dark',
      '  flexoki-light  light',
      '  rose-pine      light',
      '  ayu-light      light',
    ].join('\n'),

    sys: [
      'sys',
      '',
      '  neofetch       system info',
      '  top            processes',
      '  ps             process list',
      '  df             disk',
      '  env            site + sim vars',
      '  history        command log',
      '  whoami         you',
    ].join('\n'),

    fun: [
      'fun',
      '',
      '  cowsay [text]   ascii cow',
      '  curl -L <url>   try it',
      '',
      '  sudo   rm -rf /   vim',
    ].join('\n'),

    arcade: [
      'arcade (lua game platform)',
      '',
      '  games                   list all games',
      '  play <game-id>          run a game in terminal',
      '  source <game-id>        view source code',
      '  scores <game-id> [n]    leaderboard (default top 10)',
      '  delete <game-id> <code> delete (requires edit code)',
      '',
      '  editor                  open editor (new game)',
      '  editor <game-id>        edit existing game',
      '',
      'input:',
      '  io.read("prompt")       wait for Enter, return text',
      '  io.getkey()             single keypress, no Enter',
      '                          arrows: "up" "down" "left" "right"',
      '                          other: "space" "enter" or the char',
      '  wasd / arrows            "w" "a" "s" "d" / "up" "down" "left" "right"',
      '',
      'while a game is running:',
      '  esc   stop game',
    ].join('\n'),
  };

  var HELP_CMDS = {
    ls: [
      'ls [path]',
      '',
      '  ls                   top-level',
      '  ls projects          project list',
      '  ls projects/geno     articles',
      '  ls writing           posts',
      '  ls music             releases',
      '  ls games             games',
    ].join('\n'),

    cat: [
      'cat <path>',
      '',
      '  cat music/btop',
      '  cat writing/some-post',
      '  cat projects/geno',
    ].join('\n'),

    cd: [
      'cd [path]',
      '',
      '  cd projects     into projects/',
      '  cd geno         relative path',
      '  cd ..           up one level',
      '  cd              back to root',
    ].join('\n'),

    pwd:    'pwd',

    open: [
      'open <path>',
      '',
      '  open projects          /projects/',
      '  open projects/geno     project page',
      '  open music/btop        album page',
      '  open arcade            arcade home',
      '  open arcade/editor     write / edit a game',
    ].join('\n'),

    bg: [
      'bg [life|boids|combo|off]',
      '',
      '  bg           current mode',
      '  bg life      Conway\'s Game of Life',
      '  bg boids     flocking sim',
      '  bg combo     life + boids layers',
      '  bg off       disable',
      '',
      'help bg    full guide',
    ].join('\n'),

    speed: [
      'speed [life|boids] [0-100]',
      '',
      '  speed              show both speeds (%)',
      '  speed life         current life speed',
      '  speed boids        current boids speed',
      '  speed life 50      set life to 50%',
      '  speed boids 75     set boids to 75%',
      '  speed 25           set both to 25%',
      '  0%=slowest  100%=fastest',
    ].join('\n'),

    preset: [
      'preset <name>',
      '',
      'each preset switches mode automatically.',
      'some also change the colorscheme.',
      '',
      '  default    combo  · site defaults         (tokyo-night)',
      '  ghost      combo  · any theme',
      '  mist       life   · barely there',
      '  bloom      life   · glow + trail            (tokyo-night)',
      '  ember      life   · warm glow               (gruvbox)',
      '  chromatic  life   · rainbow',
      '  paper      life   · soft cells              (papercolor-light)',
      '  flock      boids  · calm flock',
      '  midnight   boids  · dark glow               (tokyo-night)',
      '  dusk       boids  · purple glow             (dracula)',
      '  soft       boids  · slow drift              (rose-pine)',
      '  swarm      boids  · fast dense              (gruvbox)',
    ].join('\n'),

    play: [
      'play <game-id>',
      '',
      '  play dungeon-strike   run by id',
      '  games                 list all game ids',
      '',
      '  esc   stop game',
    ].join('\n'),

    scores: [
      'scores <game-id> [n]',
      '',
      '  scores dungeon-strike      top 10',
      '  scores dungeon-strike 25   top 25  (max 50)',
    ].join('\n'),

    source: [
      'source <game-id>',
      '',
      '  print game source code',
      '  open arcade/editor?edit=<id>   edit in browser',
    ].join('\n'),

    delete: [
      'delete <game-id> <edit-code>',
      '',
      '  delete dungeon-strike xxxxx-xxxxx',
      '  edit code was given when you submitted the game',
    ].join('\n'),

    games: 'games\n  list all games in the arcade',

    reset:   'reset\n  reinit sim',

    params:  'params\n  all params + values\n  <param>         print value\n  set <p> <v>     change it',

    set: [
      'set <param> <value>',
      '  <param>   print current value',
      '',
      'life:',
      '  life.cell 1          pixel cells',
      '  life.cell 14         chunky',
      '  life.opacity 10      dim (10%)',
      '  life.opacity 100     full (100%)',
      '  life.glow 30         bloom (30%)',
      '  life.glow 80         heavy (80%)',
      '  life.autofill 0      = wipe',
      '  life.autofill 100    = overpopulated (100%)',
      '  life.rainbow off     no color',
      '  life.rainbow time    hue rotates',
      '  life.rainbow age     born=red → old',
      '  life.rainbow position  spatial',
      '  life.speed 25        slow tick (25%)',
      '  life.speed 75        fast tick (75%)',
      '',
      'boids:',
      '  boids.n 30           few',
      '  boids.n 1000         maxflock',
      '  boids.tick 0.5       slow velocity',
      '  boids.tick 8         fast velocity',
      '  boids.speed 50       mid ticks (50%)',
      '  boids.perception 20     blind',
      '  boids.perception 500    hive mind',
      '  boids.separation 0      merge',
      '  boids.opacity 90     bright (90%)',
      '  boids.glow 50        glow (50%)',
    ].join('\n'),

    wipe: [
      'wipe',
      '  clear grid + stop autofill',
      '',
      '  fill          restart autofill',
      '  spawn <pat>   place pattern',
      '  reset         full reinit',
    ].join('\n'),

    fill:   'fill\n  restart autofill',

    spawn: [
      'spawn [pattern] [random] [count]',
      '',
      '  spawn                     list patterns',
      '  spawn pulsar              click to place',
      '  spawn pulsar 3            click 3 times',
      '  spawn pulsar random       random location',
      '  spawn pulsar random 5     5 random',
      '',
      '  r-pentomino     5 cells, ~1103 gen chaos (1970)',
      '  acorn           7 cells, ~5206 gen chaos (1970s)',
      '  gosper-gun      infinite glider factory (1970)',
      '  queen-bee       period-30 oscillator (1970)',
      '  pulsar          period-3 oscillator',
      '  pentadecathlon  period-15 oscillator',
      '  lwss            lightweight spaceship (c/2)',
      '  hwss            heavyweight spaceship (c/2)',
      '',
      '  click mode: esc to cancel',
      '  wipe first for clean canvas',
    ].join('\n'),

    colorscheme: [
      'colorscheme [name]',
      '',
      '  colorscheme              list (▶ = active)',
      '  colorscheme gruvbox      apply',
      '',
      '  tokyo-night  gruvbox  kanagawa  (dark)',
      '  flexoki-light  rose-pine  ayu-light  (light)',
    ].join('\n'),

    color:   'color\n  bg  fg  accent  muted  border',
    whoami:  'whoami',
    pwd:     'pwd',
    cowsay:  'cowsay [text]\n  cowsay hello world',
    top:     'top',
    ps:      'ps',
    df:      'df',
    env:     'env\n  SITE  COLORSCHEME  BG_MODE  BG_SPEED(%)  all params',
    history: 'history',
    curl:    'curl -L <url>\n  curl -L ekanshgoenka.com',
    neofetch: 'neofetch',
  };

  // ── output helpers ──────────────────────────────────────────
  function line(text, cls) {
    var el = cls === 'term-line-pre'
      ? document.createElement('pre')
      : document.createElement('div');
    if (cls) el.className = cls;
    el.textContent = text;
    output.appendChild(el);
    output.scrollTop = output.scrollHeight;
  }
  function echoCmd(raw) { line((cwd ? '~/' + cwd : '~') + '$ ' + raw, 'term-line-cmd'); }

  // ── rm -rf / degradation ─────────────────────────────────────
  function startDegradation() {
    var GLITCH = '░▒▓▄▀█■□10!@#%&*[]{}|;:.<>/\\~`';

    // ── audio ── create immediately (needs user gesture context) ─
    var audioCtx = null;
    try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) {}

    function startAudio() {
      if (!audioCtx) return function(){};
      var now = audioCtx.currentTime;

      // low sawtooth drone — pitch drops as system dies
      var drone = audioCtx.createOscillator();
      var droneGain = audioCtx.createGain();
      drone.type = 'sawtooth';
      drone.frequency.setValueAtTime(110, now);
      drone.frequency.exponentialRampToValueAtTime(28, now + 9);
      droneGain.gain.setValueAtTime(0.001, now);
      droneGain.gain.linearRampToValueAtTime(0.18, now + 0.6);
      droneGain.gain.linearRampToValueAtTime(0, now + 9);
      drone.connect(droneGain);
      droneGain.connect(audioCtx.destination);
      drone.start(now);
      drone.stop(now + 9);

      // glitch beeps — short random square/sine chirps, accelerating
      var beepRate = 350;
      var beepTimer;
      function scheduleBeep() {
        var o = audioCtx.createOscillator();
        var g = audioCtx.createGain();
        var t = audioCtx.currentTime;
        o.type = Math.random() > 0.4 ? 'square' : 'sine';
        o.frequency.setValueAtTime(Math.random() * 2400 + 120, t);
        o.frequency.exponentialRampToValueAtTime(Math.random() * 800 + 80, t + 0.06);
        g.gain.setValueAtTime(0.09, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.07 + Math.random() * 0.08);
        o.connect(g); g.connect(audioCtx.destination);
        o.start(t); o.stop(t + 0.18);
        beepRate = Math.max(60, beepRate - 12);
        beepTimer = setTimeout(scheduleBeep, beepRate * (0.5 + Math.random()));
      }
      scheduleBeep();

      // bandpass-filtered noise bursts — crackle / static
      var noiseTimer;
      function scheduleNoise() {
        var dur    = 0.08 + Math.random() * 0.12;
        var size   = Math.ceil(audioCtx.sampleRate * dur);
        var buf    = audioCtx.createBuffer(1, size, audioCtx.sampleRate);
        var data   = buf.getChannelData(0);
        for (var i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
        var src    = audioCtx.createBufferSource();
        src.buffer = buf;
        var bp     = audioCtx.createBiquadFilter();
        bp.type    = 'bandpass';
        bp.frequency.value = 400 + Math.random() * 3600;
        bp.Q.value = 1.5 + Math.random() * 4;
        var ng     = audioCtx.createGain();
        var t      = audioCtx.currentTime;
        ng.gain.setValueAtTime(0.06, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + dur);
        src.connect(bp); bp.connect(ng); ng.connect(audioCtx.destination);
        src.start(t);
        noiseTimer = setTimeout(scheduleNoise, 80 + Math.random() * 220);
      }
      scheduleNoise();

      return function stopAudio() {
        clearTimeout(beepTimer);
        clearTimeout(noiseTimer);
        try { audioCtx.close(); } catch(e) {}
      };
    }

    var deletions = [
      ['removing /usr/bin...', 'term-line-ok'],
      ['removing /etc...', 'term-line-ok'],
      ['removing /home/ekansh...', 'term-line-ok'],
      ['removing /var/log...', 'term-line-ok'],
      ['removing /sys/kernel...', 'term-line-ok'],
      ['removing /proc...', 'term-line-ok'],
      ['i/o error on sector 0x00FF', 'term-line-err'],
      ['i/o error on sector 0x0100', 'term-line-err'],
      ['segmentation fault (core dumped)', 'term-line-err'],
    ];

    deletions.forEach(function (d, i) {
      setTimeout(function () { line(d[0], d[1]); }, i * 190);
    });

    setTimeout(function () {
      close();
      if (window.setBgSpeed) window.setBgSpeed(10);

      var stopAudio = startAudio();

      // blank ALL whitespace-only text nodes upfront so no phantom newlines remain
      (function stripWhitespace(node) {
        if (node.nodeType === 3 && !node.textContent.trim()) { node.textContent = ''; return; }
        for (var i = 0; i < node.childNodes.length; i++) stripWhitespace(node.childNodes[i]);
      })(document.body);

      // ── phase 1: text corruption ────────────────────────────
      var textNodes = [];
      (function collectText(node) {
        if (node.nodeType === 3 && node.textContent.length > 0) textNodes.push(node);
        for (var i = 0; i < node.childNodes.length; i++) collectText(node.childNodes[i]);
      })(document.body);

      var corruptRate = 1;
      var corruptTick = setInterval(function () {
        for (var i = 0; i < Math.ceil(corruptRate); i++) {
          if (!textNodes.length) break;
          var idx = Math.floor(Math.random() * textNodes.length);
          var tn  = textNodes[idx];
          if (!tn.parentNode) { textNodes.splice(idx, 1); continue; }
          var chars = tn.textContent.split('');
          if (!chars.length) { textNodes.splice(idx, 1); continue; }
          chars[Math.floor(Math.random() * chars.length)] =
            GLITCH[Math.floor(Math.random() * GLITCH.length)];
          tn.textContent = chars.join('');
        }
        corruptRate = Math.min(corruptRate + 0.4, 25);
      }, 70);

      // ── phase 2: element deletion ───────────────────────────
      setTimeout(function () {
        var sel = 'nav, .social, .tagline, li, p, h3, h2, footer, ' +
                  '.nav, h1, header, section, article, #theme-picker, main';
        var nodeList = document.querySelectorAll(sel);
        var els = [];
        for (var i = 0; i < nodeList.length; i++) els.push(nodeList[i]);
        for (var i = els.length - 1; i > 0; i--) {
          var j = Math.floor(Math.random() * (i + 1));
          var t = els[i]; els[i] = els[j]; els[j] = t;
        }

        var ri = 0;
        var removeTick = setInterval(function () {
          var batch = Math.min(Math.ceil(ri / 8) + 1, 4);
          for (var b = 0; b < batch; b++) {
            if (ri >= els.length) {
              clearInterval(removeTick);
              // sweep any remaining body children (script tags, term-overlay, stray nodes, etc.)
              var remaining = [];
              for (var k = 0; k < document.body.childNodes.length; k++)
                remaining.push(document.body.childNodes[k]);
              remaining.forEach(function (n) {
                if (n.id !== 'bg-canvas' && n.parentNode) n.parentNode.removeChild(n);
              });
              break;
            }
            var el = els[ri++];
            if (!el || !el.parentNode) continue;
            el.style.transition = 'opacity 0.12s, transform 0.12s';
            el.style.opacity    = '0';
            el.style.transform  = 'translateX(' + (Math.random() * 14 - 7) + 'px)';
            (function (e) {
              setTimeout(function () {
                if (e.parentNode) e.parentNode.removeChild(e);
              }, 130);
            })(el);
          }
        }, 100);
      }, 3000);

      // ── phase 3: color corruption ───────────────────────────
      setTimeout(function () {
        clearInterval(corruptTick);
        var hue = 0;
        var colorTick = setInterval(function () {
          hue = (hue + 31) % 360;
          document.documentElement.style.setProperty('--fg',     'hsl(' + hue + ',100%,55%)');
          document.documentElement.style.setProperty('--bg',     'hsl(' + ((hue + 137) % 360) + ',60%,6%)');
          document.documentElement.style.setProperty('--accent', 'hsl(' + ((hue + 251) % 360) + ',100%,50%)');
        }, 55);

        // ── phase 4: blackout ─────────────────────────────────
        setTimeout(function () {
          clearInterval(colorTick);
          stopAudio();
          var canvas = document.getElementById('bg-canvas');
          if (canvas) { canvas.style.transition = 'opacity 1.2s'; canvas.style.opacity = '0'; }
          document.body.style.transition = 'background 1.2s, color 1.2s';
          document.body.style.background = '#000';
          document.body.style.color      = '#000';
          document.documentElement.style.background = '#000';

          setTimeout(function () {
            localStorage.setItem('bgSpeed', '2');
            document.body.innerHTML = '';
            document.body.style.cssText = 'background:#000;margin:0;padding:0;height:100vh;';
          }, 1300);
        }, 1600);
      }, 6500);

    }, deletions.length * 190 + 250);
  }

  // ── arg validation helpers ───────────────────────────────────
  function tooMany(name) { line(name + ': too many arguments', 'term-line-err'); }
  function needArg(name, usage) { line(name + ': missing argument\nusage: ' + usage, 'term-line-err'); }

  // ── Lua arcade ───────────────────────────────────────────────
  var _fengariReady = false, _fengariLoading = false, _fengariQueue = [];

  function loadFengari(cb) {
    if (_fengariReady) { cb(); return; }
    _fengariQueue.push(cb);
    if (_fengariLoading) return;
    _fengariLoading = true;
    line('loading lua runtime...', 'term-line-ok');
    var s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/fengari-web@0.1.4/dist/fengari-web.js';
    s.onload = function() {
      _fengariReady = true; _fengariLoading = false;
      _fengariQueue.forEach(function(fn) { fn(); }); _fengariQueue = [];
    };
    s.onerror = function() {
      _fengariLoading = false; _fengariQueue = [];
      line('failed to load lua runtime', 'term-line-err');
    };
    document.head.appendChild(s);
  }

  // exposed for arcade page: check lua syntax without running
  window.luaCheck = function(code, cb) {
    loadFengari(function() {
      var fx = window.fengari;
      if (!fx) { cb(null); return; }
      var lua = fx.lua, lauxlib = fx.lauxlib;
      var L = lauxlib.luaL_newstate();
      var st = lauxlib.luaL_loadstring(L, fx.to_luastring(code));
      var err = null;
      if (st !== lua.LUA_OK) {
        var raw = lua.lua_tostring(L, -1);
        err = (raw ? fx.to_jsstring(raw) : 'syntax error')
          .replace(/^\[string "[^"]*"\]:(\d+):\s*/, 'line $1: ');
      }
      lua.lua_close(L);
      cb(err);
    });
  };

  // ── web audio sound effects ───────────────────────────────────────────────
  function arcadeSound(preset, dur, wave) {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      function tone(f, d, w, delay) {
        var osc = ctx.createOscillator(), g = ctx.createGain();
        osc.connect(g); g.connect(ctx.destination);
        osc.type = w || 'sine'; osc.frequency.value = f;
        var t0 = ctx.currentTime + (delay || 0);
        g.gain.setValueAtTime(0.22, t0);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + d);
        osc.start(t0); osc.stop(t0 + d);
      }
      if (preset === 'win')   { tone(523,.10,'sine',0); tone(659,.10,'sine',.11); tone(784,.25,'sine',.23); }
      else if (preset === 'lose')  { tone(300,.15,'sawtooth',0); tone(200,.30,'sawtooth',.16); }
      else if (preset === 'blip')  { tone(880,.06,'sine'); }
      else if (preset === 'buzz')  { tone(110,.30,'square'); }
      else if (preset === 'click') { tone(1200,.03,'sine'); }
      else if (preset === 'coin')  { tone(987,.05,'sine',0); tone(1319,.12,'sine',.06); }
      else { tone(typeof preset === 'number' ? preset : 440, dur || 0.15, wave || 'sine'); }
      setTimeout(function() { try { ctx.close(); } catch(e) {} }, 1200);
    } catch(e) {}
  }

  // ── ansi → html (for colored game output) ────────────────────────────────
  function ansiToHtml(text) {
    var s = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    var ANSI = {31:'#f7768e',32:'#9ece6a',33:'#e0af68',34:'#7aa2f7',35:'#bb9af7',36:'#73daca',37:'#c0caf5'};
    var open = 0;
    s = s.replace(/\x1b\[([0-9;]*)m/g, function(_, code) {
      if (!code || code === '0') { var c = '</span>'.repeat(open); open = 0; return c; }
      if (code === '1') { open++; return '<span style="font-weight:700">'; }
      var n = parseInt(code.split(';')[0]);
      if (ANSI[n]) { open++; return '<span style="color:' + ANSI[n] + '">'; }
      return '';
    });
    return s + '</span>'.repeat(open);
  }

  function runLuaGame(game) {
    var fx = window.fengari;
    if (!fx) { line('lua runtime not available', 'term-line-err'); return; }
    var lua = fx.lua, lauxlib = fx.lauxlib, lualib = fx.lualib;
    var toLua = fx.to_luastring, toJS = fx.to_jsstring;

    _gameMode = true;
    output.innerHTML = '';

    // game header bar (skip for test runs from editor/tutorial)
    if (game.id !== '_test_') {
      var ghdr = document.createElement('div');
      ghdr.className = 'term-game-header';
      ghdr.innerHTML = '<span>▶ ' + (game.title || 'game') + '</span>'
        + '<span class="term-game-header-id">' + (game.id || '') + '</span>';
      output.appendChild(ghdr);
    }

    var L = lauxlib.luaL_newstate();
    lualib.luaL_openlibs(L);

    // game print → colored terminal output
    var iobuf = '';
    function lineHtml(text) {
      var el = document.createElement('pre');
      el.className = 'term-line-pre';
      el.innerHTML = ansiToHtml(text);
      output.appendChild(el);
      output.scrollTop = output.scrollHeight;
    }
    function flushIoBuf() { if (iobuf) { lineHtml(iobuf); iobuf = ''; } }

    // print() — flushes io.write buffer first, then prints with newline
    lua.lua_pushcfunction(L, function(Ls) {
      flushIoBuf();
      var n = lua.lua_gettop(Ls), parts = [];
      for (var i = 1; i <= n; i++) {
        var t = lua.lua_type(Ls, i), s;
        if (t === lua.LUA_TSTRING) { var raw = lua.lua_tostring(Ls, i); s = raw ? toJS(raw) : ''; }
        else if (t === lua.LUA_TNUMBER) { s = String(lua.lua_tonumber(Ls, i)); }
        else if (t === lua.LUA_TBOOLEAN) { s = lua.lua_toboolean(Ls, i) ? 'true' : 'false'; }
        else if (t === lua.LUA_TNIL) { s = 'nil'; }
        else { var tn = lua.lua_typename(Ls, t); s = tn ? toJS(tn) : '?'; }
        parts.push(s);
      }
      lineHtml(parts.join('\t'));
      return 0;
    });
    lua.lua_setglobal(L, toLua('print'));

    // _iowrite() — write without newline; flushes on embedded \n
    lua.lua_pushcfunction(L, function(Ls) {
      var n = lua.lua_gettop(Ls), s = '';
      for (var i = 1; i <= n; i++) {
        var t = lua.lua_type(Ls, i);
        if (t === lua.LUA_TSTRING) { var r = lua.lua_tostring(Ls, i); s += r ? toJS(r) : ''; }
        else if (t === lua.LUA_TNUMBER) { s += String(lua.lua_tonumber(Ls, i)); }
        else if (t === lua.LUA_TBOOLEAN) { s += lua.lua_toboolean(Ls, i) ? 'true' : 'false'; }
      }
      var lines = (iobuf + s).split('\n');
      for (var j = 0; j < lines.length - 1; j++) lineHtml(lines[j]);
      iobuf = lines[lines.length - 1];
      return 0;
    });
    lua.lua_setglobal(L, toLua('_iowrite'));

    // _sound(preset_or_freq, dur?, wave?)
    lua.lua_pushcfunction(L, function(Ls) {
      var a1 = lua.lua_type(Ls, 1) === lua.LUA_TNUMBER
        ? lua.lua_tonumber(Ls, 1)
        : (lua.lua_type(Ls, 1) === lua.LUA_TSTRING ? toJS(lua.lua_tostring(Ls, 1)) : 440);
      var dur  = lua.lua_type(Ls, 2) === lua.LUA_TNUMBER ? lua.lua_tonumber(Ls, 2) : undefined;
      var wave = lua.lua_type(Ls, 3) === lua.LUA_TSTRING ? toJS(lua.lua_tostring(Ls, 3)) : undefined;
      arcadeSound(a1, dur, wave);
      return 0;
    });
    lua.lua_setglobal(L, toLua('_sound'));

    // clear() — wipe game output (also flushes iobuf)
    lua.lua_pushcfunction(L, function(Ls) { iobuf = ''; output.innerHTML = ''; return 0; });
    lua.lua_setglobal(L, toLua('clear'));

    // _pollkey() — non-blocking key read: returns last key pressed since last poll, or ""
    var _keyBuf = '';
    function _normalizeKey(e) {
      var k = e.key;
      if (k === 'ArrowUp') return 'up';
      if (k === 'ArrowDown') return 'down';
      if (k === 'ArrowLeft') return 'left';
      if (k === 'ArrowRight') return 'right';
      if (k === ' ') return 'space';
      if (k === 'Enter') return 'enter';
      if (k === 'Escape') return 'escape';
      if (k.length === 1) return k.toLowerCase();
      return k.toLowerCase();
    }
    function _gameKeyCapture(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (!_gameMode) return;
      e.preventDefault();
      e.stopPropagation();
      if (e.ctrlKey && (e.key === 'c' || e.key === 'C')) {
        _gameMode = false; _gameResume = null;
        flushIoBuf();
        document.removeEventListener('keydown', _gameKeyCapture, true);
        if (termPrompt) termPrompt.innerHTML = DEFAULT_PROMPT;
        line('^C  game stopped.', 'term-line-err');
        output.scrollTop = output.scrollHeight;
        return;
      }
      _keyBuf = _normalizeKey(e);
    }
    document.addEventListener('keydown', _gameKeyCapture, true);

    lua.lua_pushcfunction(L, function(Ls) {
      var k = _keyBuf;
      _keyBuf = '';
      lua.lua_pushstring(Ls, toLua(k));
      return 1;
    });
    lua.lua_setglobal(L, toLua('_pollkey'));

    // _clock — high-resolution time in seconds
    lua.lua_pushcfunction(L, function(Ls) {
      lua.lua_pushnumber(Ls, performance.now() / 1000);
      return 1;
    });
    lua.lua_setglobal(L, toLua('_clock'));

    // _setprompt(s) — flush pending io.write, then set iobuf for JS step function
    lua.lua_pushcfunction(L, function(Ls) {
      flushIoBuf();
      if (lua.lua_type(Ls, 1) === lua.LUA_TSTRING) {
        var r = lua.lua_tostring(Ls, 1);
        iobuf = r ? toJS(r) : '';
      } else {
        iobuf = '';
      }
      return 0;
    });
    lua.lua_setglobal(L, toLua('_setprompt'));

    // _net_collect() — called by net.top() after yield to read JS result table
    lua.lua_pushcfunction(L, function(Ls) {
      var buf = window._netBuf || [];
      window._netBuf = null;
      lua.lua_createtable(Ls, buf.length, 0);
      for (var i = 0; i < buf.length; i++) {
        lua.lua_createtable(Ls, 0, 2);
        lua.lua_pushstring(Ls, toLua(String(buf[i].name || '')));
        lua.lua_setfield(Ls, -2, toLua('name'));
        lua.lua_pushnumber(Ls, Number(buf[i].score) || 0);
        lua.lua_setfield(Ls, -2, toLua('score'));
        lua.lua_rawseti(Ls, -2, i + 1);
      }
      return 1;
    });
    lua.lua_setglobal(L, toLua('_net_collect'));

    // _fontsize(n) — set output font size by level 1–10 (output only, not input row)
    var _fontSizes = [14, 16, 18, 20, 24, 28, 32, 36, 42, 48];
    lua.lua_pushcfunction(L, function(Ls) {
      if (lua.lua_type(Ls, 1) !== lua.LUA_TNUMBER) return 0;
      var lvl = Math.floor(lua.lua_tonumber(Ls, 1));
      lvl = Math.max(1, Math.min(10, lvl));
      output.style.fontSize = _fontSizes[lvl - 1] + 'px';
      return 0;
    });
    lua.lua_setglobal(L, toLua('_fontsize'));

    var co = lua.lua_newthread(L);

    var sandbox = [
      'local _os_time=os.time; local _os_clock=os.clock; os={time=_os_time,clock=_os_clock}',
      'require=nil; load=nil; dofile=nil; loadfile=nil; collectgarbage=nil',
      // task state must be declared before io/print/sound closures reference _in_task
      'local _tasks={}',
      'local _task_active=false',
      'local _in_task=false',
      'local _PREEMPT={}',
      'io={',
      '  read =function(prompt) if type(prompt)=="string" then _setprompt(prompt) end return coroutine.yield() end,',
      '  getkey=function() _setprompt("__getkey__") return coroutine.yield() end,',
      '  pollkey=function() local k=_pollkey(); if _in_task then coroutine.yield(0) end; return k end,',
      '  write=function(...) local s="" for i=1,select("#",...)do s=s..tostring(select(i,...))end _iowrite(s); if _in_task then coroutine.yield(0) end end,',
      '  fontsize=function(n) _fontsize(n) end,',
      '}',
      // auto-yield helper: yields in task context every N calls
      'local _ty_n=0',
      'local function _ty() if not _in_task then return end; _ty_n=_ty_n+1; if _ty_n>=4 then _ty_n=0; coroutine.yield(0) end end',
      // color: ANSI escape constants
      'color={',
      '  red="\\27[31m", green="\\27[32m", yellow="\\27[33m",',
      '  blue="\\27[34m", purple="\\27[35m", cyan="\\27[36m",',
      '  white="\\27[37m", bold="\\27[1m", reset="\\27[0m"',
      '}',
      'function colored(text, col) return col .. tostring(text) .. color.reset end',
      // print/clear: auto-yield every 4 calls in task context
      'local _orig_print=print',
      'function print(...) _orig_print(...); _ty() end',
      'local _orig_clear=clear',
      'function clear() _orig_clear(); _ty() end',
      // sound: named presets + raw beep (auto-yield)
      'sound={',
      '  beep =function(freq,dur) _sound(freq or 440, dur or 0.15, "sine"); _ty() end,',
      '  blip =function() _sound("blip"); _ty() end,',
      '  buzz =function() _sound("buzz"); _ty() end,',
      '  win  =function() _sound("win"); _ty() end,',
      '  lose =function() _sound("lose"); _ty() end,',
      '  click=function() _sound("click"); _ty() end,',
      '  coin =function() _sound("coin"); _ty() end,',
      '}',
      // sleep(ms): yields with sentinel, resumed by setTimeout
      'function sleep(ms) coroutine.yield("\\0sleep\\0"..tostring(math.floor(ms or 100))) end',
      // net: key-value store + leaderboard, scoped to this game
      'net={',
      '  set =function(key,value) coroutine.yield("\\0net\\0set\\1"..tostring(key).."\\1"..tostring(value~=nil and value or "")) end,',
      '  get =function(key) return coroutine.yield("\\0net\\0get\\1"..tostring(key)) end,',
      '  rank=function(name,score) coroutine.yield("\\0net\\0rank\\1"..tostring(name).."\\1"..tostring(tonumber(score) or 0)) end,',
      '  top =function(n) coroutine.yield("\\0net\\0top\\1"..tostring(math.floor(tonumber(n) or 10))) return _net_collect() end,',
      '}',
      // tasks: scheduler with auto-yield on pollkey + debug.sethook fallback
      'tasks={',
      '  spawn=function(fn) _tasks[#_tasks+1]={co=coroutine.create(fn),wake=0} end,',
      '  stop=function() _task_active=false end,',
      '  run=function()',
      '    _task_active=true; _in_task=true',
      '    while _task_active and #_tasks>0 do',
      '      local now=_clock()',
      '      for i=#_tasks,1,-1 do',
      '        local t=_tasks[i]',
      '        if coroutine.status(t.co)=="dead" then',
      '          table.remove(_tasks,i)',
      '        elseif now>=t.wake then',
      '          debug.sethook(t.co,function() coroutine.yield(_PREEMPT) end,"",1000)',
      '          local ok,rv=coroutine.resume(t.co)',
      '          debug.sethook(t.co)',
      '          if not ok then',
      '            print(colored("task error: "..tostring(rv),color.red))',
      '            table.remove(_tasks,i)',
      '          elseif coroutine.status(t.co)=="dead" then',
      '            table.remove(_tasks,i)',
      '          else',
      '            local secs=0',
      '            if rv==_PREEMPT then secs=0',
      '            elseif type(rv)=="string" and string.sub(rv,1,7)=="\\0sleep\\0" then',
      '              secs=(tonumber(string.sub(rv,8)) or 0)/1000',
      '            elseif type(rv)=="number" then secs=rv',
      '            else',
      '              print(colored("tasks: use sleep() not io.getkey/io.read",color.red))',
      '              table.remove(_tasks,i)',
      '              secs=nil',
      '            end',
      '            if secs then t.wake=_clock()+secs end',
      '          end',
      '        end',
      '      end',
      '      if #_tasks==0 then break end',
      '      local nxt=_clock()+1',
      '      for _,t in ipairs(_tasks) do if t.wake<nxt then nxt=t.wake end end',
      '      local ms=math.max(10,math.floor((nxt-_clock())*1000))',
      '      sleep(ms)',
      '    end',
      '    _in_task=false; _tasks={}',
      '  end,',
      '}',
    ].join('\n');

    var status = lauxlib.luaL_loadstring(co, toLua(sandbox + '\n\n' + game.code));
    var SANDBOX_LINES = sandbox.split('\n').length + 2;

    function cleanErr(raw) {
      return raw.replace(/^\[string "[^"]*"\]:(\d+):\s*/, function(_, n) {
        var userLine = Math.max(1, parseInt(n) - SANDBOX_LINES);
        return 'line ' + userLine + ': ';
      });
    }

    if (status !== lua.LUA_OK) {
      var errStr = lua.lua_tostring(co, -1);
      line('error: ' + cleanErr(errStr ? toJS(errStr) : 'unknown'), 'term-line-err');
      _gameMode = false; return;
    }

    function exitGame() {
      flushIoBuf();
      document.removeEventListener('keydown', _gameKeyCapture, true);
      _gameMode = false; _gameResume = null;
      output.style.fontSize = '';
      if (termPrompt) termPrompt.innerHTML = DEFAULT_PROMPT;
    }

    function step(inputStr) {
      var nargs = 0;
      if (inputStr !== undefined) { lua.lua_pushstring(co, toLua(String(inputStr))); nargs = 1; }
      var st = lua.lua_resume(co, null, nargs);
      if (st === lua.LUA_YIELD) {
        if (lua.lua_type(co, -1) === lua.LUA_TSTRING) {
          var raw = lua.lua_tostring(co, -1);
          var sv = raw ? toJS(raw) : '';
          if (sv.charAt(0) === '\0') {
            // sleep sentinel: "\0sleep\0<ms>"
            if (sv.slice(0, 7) === '\0sleep\0') {
              var ms = parseInt(sv.slice(7)) || 100;
              setTimeout(function() { if (_gameMode) step(); }, ms);
              return;
            }
            // net sentinel: "\0net\0<op>\1<arg1>\1<arg2>..."
            if (sv.slice(0, 5) === '\0net\0') {
              var parts = sv.slice(5).split('\x01');
              var op = parts[0];
              var gid = encodeURIComponent(game.id || '_test_');
              if (op === 'get') {
                fetch('/api/net?op=get&game=' + gid + '&key=' + encodeURIComponent(parts[1] || ''))
                  .then(function(r) { return r.json(); })
                  .then(function(d) { if (_gameMode) step(d.value !== null && d.value !== undefined ? String(d.value) : ''); })
                  .catch(function() { if (_gameMode) step(''); });
                return;
              }
              if (op === 'set') {
                fetch('/api/net?game=' + gid, { method:'POST', headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({op:'set', key: parts[1] || '', value: parts[2] || ''}) })
                  .then(function(r) { return r.json(); })
                  .then(function(d) { if (_gameMode) step(d.ok ? 'ok' : 'err:' + (d.error || '?')); })
                  .catch(function() { if (_gameMode) step('err:network'); });
                return;
              }
              if (op === 'rank') {
                fetch('/api/net?game=' + gid, { method:'POST', headers:{'Content-Type':'application/json'},
                  body: JSON.stringify({op:'rank', name: parts[1] || '', score: parseFloat(parts[2]) || 0}) })
                  .then(function(r) { return r.json(); })
                  .then(function(d) { if (_gameMode) step(d.ok ? 'ok' : 'err:' + (d.error || '?')); })
                  .catch(function() { if (_gameMode) step('err:network'); });
                return;
              }
              if (op === 'top') {
                var n = parseInt(parts[1]) || 10;
                fetch('/api/net?op=top&game=' + gid + '&n=' + n)
                  .then(function(r) { return r.json(); })
                  .then(function(d) { window._netBuf = d.entries || []; if (_gameMode) step('\x01'); })
                  .catch(function() { window._netBuf = []; if (_gameMode) step('\x01'); });
                return;
              }
              if (_gameMode) step('err:unknown_op');
              return;
            }
          }
        }
        // io.getkey() — single keypress, no Enter required
        if (iobuf === '__getkey__') {
          iobuf = '';
          // show indicator inline in output area
          var gkEl = document.createElement('div');
          gkEl.className = 'term-io-inline';
          gkEl.innerHTML = '<i style="color:var(--muted)">[press any key]</i>';
          output.appendChild(gkEl);
          inp.blur();
          var handler = function(e) {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            e.preventDefault();
            e.stopPropagation(); // prevent Escape from closing terminal during getkey
            document.removeEventListener('keydown', handler, true);
            var k = e.key;
            if (k === 'ArrowUp') k = 'up';
            else if (k === 'ArrowDown') k = 'down';
            else if (k === 'ArrowLeft') k = 'left';
            else if (k === 'ArrowRight') k = 'right';
            else if (k === ' ') k = 'space';
            else if (k === 'Enter') k = 'enter';
            else if (k === 'Escape') k = 'escape';
            else if (k.length === 1) k = k.toLowerCase();
            else k = k.toLowerCase();
            if (gkEl.parentNode) gkEl.parentNode.removeChild(gkEl);
            if (_gameMode) step(k);
          };
          document.addEventListener('keydown', handler, true);
          output.scrollTop = output.scrollHeight;
          return;
        }
        // io.read() — render prompt + input inline in the output area
        var ioPrompt = iobuf; iobuf = '';
        var localResume = step;
        var ioRow = document.createElement('div');
        ioRow.className = 'term-io-inline';
        if (ioPrompt) {
          var ps = document.createElement('span');
          ps.innerHTML = ansiToHtml(ioPrompt);
          ioRow.appendChild(ps);
        }
        var ioInp = document.createElement('input');
        ioInp.className = 'term-io-input';
        ioInp.type = 'text';
        ioInp.autocomplete = 'off';
        ioInp.spellcheck = false;
        ioRow.appendChild(ioInp);
        output.appendChild(ioRow);
        output.scrollTop = output.scrollHeight;
        ioInp.focus();
        // click on output area should refocus inline input
        var _ioFocusClick = function() { if (ioInp.parentNode) ioInp.focus(); };
        output.addEventListener('click', _ioFocusClick);
        ioInp.addEventListener('keydown', function(ie) {
          if (ie.key !== 'Enter') return;
          var v = ioInp.value;
          output.removeEventListener('click', _ioFocusClick);
          // replace inline row with static echo
          var staticEl = document.createElement('pre');
          staticEl.className = 'term-line-pre';
          var safeVal = v.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
          staticEl.innerHTML = (ioPrompt ? ansiToHtml(ioPrompt) : '') + safeVal;
          if (ioRow.parentNode) ioRow.parentNode.replaceChild(staticEl, ioRow);
          if (v.trim() === 'quit' || v.trim() === 'exit' || v.trim() === 'q') {
            _gameMode = false; _gameResume = null;
            if (termPrompt) termPrompt.innerHTML = DEFAULT_PROMPT;
            line('─────────────────────────────────────────', 'term-line-pre');
            line('game exited.', 'term-line-ok');
          } else if (_gameMode && localResume) {
            localResume(v);
          }
        });
        _gameResume = null; // bottom bar cannot resume; only inline input can

      } else {
        if (st !== lua.LUA_OK) {
          var e = lua.lua_tostring(co, -1);
          line('error: ' + cleanErr(e ? toJS(e) : 'unknown error'), 'term-line-err');
        }
        exitGame();
      }
    }

    step();
  }

  // ── commands ────────────────────────────────────────────────
  var CMDS = {
    help: function (args) {
      var t = (args[0] || '').toLowerCase();
      if (!t)                    { line(HELP_INDEX,        'term-line-pre'); return; }
      if (HELP_TOPICS[t])        { line(HELP_TOPICS[t],    'term-line-pre'); return; }
      if (HELP_CMDS[t])          { line(HELP_CMDS[t],      'term-line-pre'); return; }
      line('no help for "' + t + '". try: help', 'term-line-err');
    },

    ls: function (args) {
      if (args.length > 1) { tooMany('ls'); return; }
      var target = args[0] ? resolvePath(args[0]) : cwd;
      var node = FS[target !== undefined ? target : ''];
      if (node === undefined) node = FS[''];
      var displayTarget = args[0] || '.';
      if (!FS.hasOwnProperty(target)) {
        line('ls: ' + displayTarget + ': no such file or directory', 'term-line-err'); return;
      }
      if (node.type !== 'dir') {
        line('ls: ' + displayTarget + ': not a directory', 'term-line-err'); return;
      }
      var kids = lsChildren(target);
      if (!kids.length) { line('(empty)'); return; }
      var prefix = target ? target + '/' : '';
      line(kids.map(function (n) {
        return FS[prefix + n] && FS[prefix + n].type === 'dir' ? n + '/' : n;
      }).join('  '));
    },

    cat: function (args) {
      if (!args[0]) { needArg('cat', 'cat <path>'); return; }
      if (args.length > 1) { tooMany('cat'); return; }
      var target = resolvePath(args[0]);
      if (!FS.hasOwnProperty(target)) {
        line('cat: ' + args[0] + ': no such file or directory', 'term-line-err'); return;
      }
      var node = FS[target];
      if (node.type === 'dir') {
        line('cat: ' + args[0] + ': is a directory', 'term-line-err'); return;
      }
      var name = target.split('/').pop();
      var head = node.title || name;
      var out  = head + '\n' + '─'.repeat(head.length);
      if (node.date)   out += '\n' + node.date;
      if (node.stack)  out += '\nstack:  ' + node.stack;
      if (node.status) out += '\nstatus: ' + node.status;
      if (node.engine) out += '\nengine: ' + node.engine;
      var body = node.body || node.desc || '';
      if (body) out += '\n\n' + body.trim();
      line(out, 'term-line-pre');
    },

    cd: function (args) {
      if (args.length > 1) { tooMany('cd'); return; }
      var target = args[0] || '';
      if (!target || target === '~' || target === '/') { cwd = ''; updatePrompt(); return; }
      var resolved = resolvePath(target);
      if (!FS.hasOwnProperty(resolved)) {
        line('cd: ' + target + ': no such file or directory', 'term-line-err');
      } else if (FS[resolved].type !== 'dir') {
        line('cd: ' + target + ': not a directory', 'term-line-err');
      } else {
        cwd = resolved; updatePrompt();
      }
    },

    pwd: function (args) {
      if (args.length) { tooMany('pwd'); return; }
      line('/' + cwd, 'term-line-ok');
    },

    open: function (args) {
      if (args.length > 1) { tooMany('open'); return; }
      var target = resolvePath((args[0] || '').replace(/^\//, ''));
      var node = FS.hasOwnProperty(target) ? FS[target] : null;
      var url = null;
      if (!target) {
        url = '/';
      } else if (node && node.url) {
        url = node.url;
      }
      if (url) {
        line('→ ' + url, 'term-line-ok');
        setTimeout(function () { window.location.href = url; }, 280);
      } else {
        line('open: ' + (args[0] || '?') + ': not found', 'term-line-err');
      }
    },

    editor: function (args) {
      if (args.length > 1) { tooMany('editor'); return; }
      var url = '/arcade/editor/';
      if (args[0]) url += '?edit=' + encodeURIComponent(args[0]);
      line('→ ' + url, 'term-line-ok');
      setTimeout(function () { window.location.href = url; }, 280);
    },

    whoami: function (args) {
      if (args.length) { tooMany('whoami'); return; }
      line('ekansh goenka. 12. building things. bjj. music.');
    },

    neofetch: function (args) {
      if (args.length) { tooMany('neofetch'); return; }
      line(NEOFETCH, 'term-line-pre');
    },

    colorscheme: function (args) {
      if (args.length > 1) { tooMany('colorscheme'); return; }
      var ALL = ['tokyo-night', 'gruvbox', 'kanagawa', 'flexoki-light', 'rose-pine', 'ayu-light'];
      var cur  = document.documentElement.getAttribute('data-theme');
      var name = args[0];
      if (!name) {
        var out = ALL.map(function (t) {
          return (t === cur ? '* ' : '  ') + t;
        }).join('\n');
        line(out, 'term-line-pre');
      } else if (ALL.indexOf(name) >= 0) {
        applyTheme(name);
        line('colorscheme → ' + name, 'term-line-ok');
      } else {
        line('unknown colorscheme. try: ' + ALL.join(', '), 'term-line-err');
      }
    },
    theme: function (args) { CMDS.colorscheme(args); },

    github: function (args) {
      if (args.length) { tooMany('github'); return; }
      line('opening github...', 'term-line-ok');
      setTimeout(function () { window.open((SITE_LINKS||{}).github||'#', '_blank'); }, 200);
    },
    youtube: function (args) {
      if (args.length) { tooMany('youtube'); return; }
      line('opening bytecolony...', 'term-line-ok');
      setTimeout(function () { window.open((SITE_LINKS||{}).youtube||'#', '_blank'); }, 200);
    },
    itch: function (args) {
      if (args.length) { tooMany('itch'); return; }
      line('opening itch.io...', 'term-line-ok');
      setTimeout(function () { window.open((SITE_LINKS||{}).itchio||'#', '_blank'); }, 200);
    },

    // ── background control ──────────────────────────────────────
    bg: function (args) {
      if (args.length > 1) { tooMany('bg'); return; }
      var m = args[0];
      if (!m) { line('bg: ' + (window.getBgMode ? window.getBgMode() : '?'), 'term-line-ok'); return; }
      if (!window.setBgMode || !window.setBgMode(m))
        line('bg: unknown mode. try: life  boids  combo  off', 'term-line-err');
      else
        line('bg → ' + m, 'term-line-ok');
    },

    speed: function (args) {
      // speed                      → show both (as %)
      // speed life|boids [0-100]   → set specific
      // speed [0-100]              → set both
      var ls = window.getLifeSpeed  ? window.getLifeSpeed()  : 21;
      var bs = window.getBoidsSpeed ? window.getBoidsSpeed() : 21;
      if (!args[0]) {
        line('life.speed = ' + ls + '%\nboids.speed = ' + bs + '%', 'term-line-ok');
        return;
      }
      if (args[0] === 'life' || args[0] === 'boids') {
        if (args.length > 2) { tooMany('speed'); return; }
        var which = args[0];
        if (!args[1]) { line(which + '.speed = ' + (which === 'life' ? ls : bs) + '%', 'term-line-ok'); return; }
        var n = parseInt(args[1]);
        if (isNaN(n) || n < 0 || n > 100) { line('speed: value must be 0–100 (%)', 'term-line-err'); return; }
        if (which === 'life'  && window.setLifeSpeed)  window.setLifeSpeed(n);
        if (which === 'boids' && window.setBoidsSpeed) window.setBoidsSpeed(n);
        line(which + '.speed → ' + n + '%', 'term-line-ok');
        return;
      }
      if (args.length > 1) { tooMany('speed'); return; }
      var n = parseInt(args[0]);
      if (isNaN(n) || n < 0 || n > 100) { line('speed: value must be 0–100 (%)', 'term-line-err'); return; }
      if (window.setLifeSpeed)  window.setLifeSpeed(n);
      if (window.setBoidsSpeed) window.setBoidsSpeed(n);
      line('speed → ' + n + '%  (life + boids)', 'term-line-ok');
    },

    reset: function (args) {
      if (args.length) { tooMany('reset'); return; }
      if (window.resetBg) window.resetBg();
      line('simulation reinitialized.', 'term-line-ok');
    },

    spawn: function (args) {
      var names = window.spawnPatternNames ? window.spawnPatternNames() : [];
      if (!args[0]) {
        line([
          'spawn <pattern> [random] [count]',
          '',
          '  r-pentomino     5 cells, ~1103 gen chaos (1970)',
          '  acorn           7 cells, ~5206 gen chaos (1970s)',
          '  gosper-gun      infinite glider factory (1970)',
          '  queen-bee       period-30 oscillator (1970)',
          '  pulsar          period-3 oscillator',
          '  pentadecathlon  period-15 oscillator',
          '  lwss / hwss     spaceships (c/2)',
          '',
          '  spawn pulsar           click to place',
          '  spawn pulsar 3         click 3 times',
          '  spawn pulsar random    random location',
          '  spawn pulsar random 5  5 random locations',
          '',
          '  tip: wipe first for a clean canvas',
        ].join('\n'), 'term-line-pre');
        return;
      }
      var name = args[0];
      var randomMode = false;
      var count = 1;
      for (var i = 1; i < args.length; i++) {
        if (args[i] === 'random') { randomMode = true; }
        else if (/^\d+$/.test(args[i])) { count = Math.max(1, Math.min(20, parseInt(args[i]))); }
        else { line('unknown flag: ' + args[i], 'term-line-err'); return; }
      }
      if (randomMode) {
        if (!window.spawnPattern || names.indexOf(name) < 0)
          { line('unknown pattern: ' + name, 'term-line-err'); return; }
        for (var k = 0; k < count; k++) window.spawnPattern(name);
        line('spawned ' + (count > 1 ? count + 'x ' : '') + name, 'term-line-ok');
      } else {
        if (!window.queueSpawn || !window.queueSpawn(name, count))
          { line('unknown pattern: ' + name, 'term-line-err'); return; }
        line(count > 1
          ? 'click ' + count + ' times to place ' + name + '  ·  esc to cancel'
          : 'click to place ' + name + '  ·  esc to cancel',
          'term-line-ok');
      }
    },

    wipe: function (args) {
      if (args.length) { tooMany('wipe'); return; }
      if (!window.clearLife || !window.clearLife())
        line('wipe: failed', 'term-line-err');
      else
        line('grid cleared. use spawn to place patterns, or fill to restore.', 'term-line-ok');
    },

    preset: function (args) {
      if (args.length > 1) { tooMany('preset'); return; }
      var names = window.getPresetNames ? window.getPresetNames() : [];
      if (!args[0]) {
        line([
          'preset <name>',
          '',
          'life:',
          '  sparse     dim (default)',
          '  bloom      full opacity + glow',
          '  coarse     chunky 14px cells',
          '  overdrive  tiny cells fast',
          '  chromatic  rainbow time-shift',
          '',
          'boids:',
          '  flock      120 boids (default)',
          '  swarm      350 fast small boids',
          '  drift      15 slow large + glow',
          '  glow       80 bright + glow',
          '  maxflock   1000 full opacity',
          '',
          'combo:',
          '  layered  chaos  spectrum',
        ].join('\n'), 'term-line-pre');
        return;
      }
      var name = args[0];
      if (!window.applyPreset || !window.applyPreset(name))
        line('unknown preset: ' + name + '  try: ' + names.join('  '), 'term-line-err');
      else
        line('preset → ' + name, 'term-line-ok');
    },

    fill: function (args) {
      if (args.length) { tooMany('fill'); return; }
      if (window.startAutofill) { window.startAutofill(); line('autofill enabled. background will seed itself.', 'term-line-ok'); }
      else line('fill: not available in current mode.', 'term-line-err');
    },

    params: function (args) {
      if (args.length) { tooMany('params'); return; }
      var p = window.getBgParams ? window.getBgParams() : {};
      function v(k) { return String(p[k] !== undefined ? p[k] : '?'); }
      line([
        'life:',
        '  life.cell        ' + v('life.cell')     + '\t(1–80)',
        '  life.opacity     ' + v('life.opacity')  + '%\t(0–100%)',
        '  life.glow        ' + v('life.glow')     + '%\t(0–100%)',
        '  life.autofill    ' + v('life.autofill') + '%\t(0–100%)',
        '  life.rainbow     ' + v('life.rainbow')  + '\t(0=off 1=time 2=age 3=pos)',
        '  life.speed       ' + v('life.speed')    + '%\t(0–100%  sim tick rate)',
        '',
        'boids:',
        '  boids.n          ' + v('boids.n')          + '\t(1–1000)',
        '  boids.size       ' + v('boids.size')        + '\t(1–200)',
        '  boids.tick       ' + v('boids.tick')        + '\t(0–30  velocity)',
        '  boids.speed      ' + v('boids.speed')       + '%\t(0–100%  sim tick rate)',
        '  boids.perception ' + v('boids.perception')  + '\t(1–2000)',
        '  boids.separation ' + v('boids.separation')  + '\t(0–1000)',
        '  boids.opacity    ' + v('boids.opacity')     + '%\t(0–100%)',
        '  boids.glow       ' + v('boids.glow')        + '%\t(0–100%)',
        '',
        'trail:',
        '  trail.on         ' + v('trail.on')    + '\t(0=off 1=on)',
        '  trail.size       ' + v('trail.size')  + '\t(1=single 2=cross 3=wide)',
        '  trail.glow       ' + v('trail.glow')  + '%\t(0–100%)',
        '  trail.decay      ' + v('trail.decay') + '%\t(0=slow 100=fast)',
        '',
        'set <param> <value>  to change',
      ].join('\n'), 'term-line-pre');
    },

    set: function (args) {
      if (args.length > 2) { tooMany('set'); return; }
      var key = args[0] || '';
      var rawVal = args[1];
      if (!key || rawVal === undefined) { line('usage: set <param> <value>   (see: params)', 'term-line-err'); return; }
      // life.rainbow accepts: off|time|age|position or 0|1|2|3
      var val;
      if (key === 'life.rainbow') {
        var rmap = { 'off':0, 'time':1, 'age':2, 'position':3, '0':0, '1':1, '2':2, '3':3 };
        if (rmap[rawVal] === undefined) { line('life.rainbow: off | time | age | position', 'term-line-err'); return; }
        val = rmap[rawVal];
      } else {
        val = parseFloat(rawVal);
        if (isNaN(val)) { line('usage: set <param> <value>   (see: params)', 'term-line-err'); return; }
      }
      if (!window.setParam || !window.setParam(key, val))
        line('unknown param "' + key + '". see: params', 'term-line-err');
      else
        line(key + ' = ' + val, 'term-line-ok');
    },

    // ── system ──────────────────────────────────────────────────
    ps: function (args) {
      if (args.length) { tooMany('ps'); return; }
      line([
        '  PID  COMMAND              CPU%   MEM%',
        '─────────────────────────────────────────',
        '    1  kernel               0.0    0.1',
        '   88  boids.wasm           2.1    1.4',
        '   89  life.sim             1.7    0.9',
        '  102  terminal.js          0.3    0.2',
        '  256  music-brain          0.1    ?.?',
        ' 1337  ekansh               99.9   ∞',
      ].join('\n'), 'term-line-pre');
    },

    top: function (args) {
      if (args.length) { tooMany('top'); return; }
      var p = window.getBgParams ? window.getBgParams() : {};
      line([
        'top - ' + new Date().toTimeString().slice(0,8) + '  up ' + (function(){
          var s=Math.floor((Date.now()-PAGE_START)/1000),m=Math.floor(s/60)%60,h=Math.floor(s/3600);
          return (h?h+'h ':'')+m+'m';
        })() + ',  tasks: 6 total',
        'cpu: usr 14.2%  sys 3.1%  idle 82.7%',
        'mem: 512M total  341M used  171M free',
        '',
        '  PID  USER     %CPU  %MEM  COMMAND',
        ' 1337  ekansh   99.9  ∞     ekansh',
        '   88  www      ' + (p['boids.n']||120)/6|0 + '.1   1.4   boids (n=' + (p['boids.n']||120) + ')',
        '   89  www       1.7   0.9   life (cell=' + (p['life.cell']||7) + 'px)',
        '  102  www       0.3   0.2   terminal.js',
        '    1  root      0.0   0.1   kernel',
      ].join('\n'), 'term-line-pre');
    },

    history: function (args) {
      if (args.length) { tooMany('history'); return; }
      if (!hist.length) { line('(no history)', 'term-line-err'); return; }
      var out = hist.slice().reverse().map(function (cmd, i) {
        var n = String(i + 1); while (n.length < 4) n = ' ' + n;
        return n + '  ' + cmd;
      }).join('\n');
      line(out, 'term-line-pre');
    },

    color: function (args) {
      if (args.length) { tooMany('color'); return; }
      var theme = document.documentElement.getAttribute('data-theme');
      var vars  = ['--bg', '--fg', '--accent', '--muted', '--border'];
      var cs    = getComputedStyle(document.documentElement);
      var out   = 'colorscheme: ' + theme + '\n';
      vars.forEach(function (v) {
        var val = cs.getPropertyValue(v).trim();
        var pad = v; while (pad.length < 10) pad += ' ';
        out += '\n  ' + pad + '  ' + val;
      });
      line(out, 'term-line-pre');
    },

    df: function (args) {
      if (args.length) { tooMany('df'); return; }
      line([
        'Filesystem        Size     Used     Avail    Use%  Mounted on',
        '/dev/brain        10.0PB   9.8PB    0.2PB    98%   /home/ekansh',
        '/dev/internet      ∞        ∞        ∞       ??%   /www',
        'tmpfs             16G      0.2G     15.8G     1%   /tmp',
      ].join('\n'), 'term-line-pre');
    },

    env: function (args) {
      if (args.length) { tooMany('env'); return; }
      var theme  = document.documentElement.getAttribute('data-theme');
      var mode   = window.getBgMode  ? window.getBgMode()  : 'life';
      var speed  = window.getBgSpeed ? window.getBgSpeed() : 5;
      var params = window.getBgParams ? window.getBgParams() : {};
      var vars = [
        'SITE=ekanshgoenka.com',
        'COLORSCHEME=' + theme,
        'BG_MODE=' + mode,
        'BG_SPEED=' + speed,
      ];
      Object.keys(params).forEach(function (k) { vars.push(k.toUpperCase().replace('.','_') + '=' + params[k]); });
      line(vars.join('\n'), 'term-line-pre');
    },

    // ── fun ─────────────────────────────────────────────────────
    cowsay: function (args) {
      var text = args.join(' ') || 'moo';
      var bar  = '-'.repeat(text.length + 2);
      line([
        ' ' + bar,
        '< ' + text + ' >',
        ' ' + bar,
        '        \\   ^__^',
        '         \\  (oo)\\_______',
        '            (__)\\       )',
        '                ||----w |',
        '                ||     ||',
      ].join('\n'), 'term-line-pre');
    },

    // ── misc ────────────────────────────────────────────────────
    man: function (a) {
      if (!a[0]) { line('what manual page do you want?', 'term-line-err'); return; }
      var entry = HELP_CMDS[a[0]] || HELP_TOPICS[a[0]];
      if (entry) line(entry, 'term-line-pre');
      else line('no manual entry for ' + a[0], 'term-line-err');
    },
    clear:  function (args) { if (args.length) { tooMany('clear'); return; } output.innerHTML = ''; },
    'default': function (args) {
      if (args.length) { tooMany('default'); return; }
      localStorage.clear();
      line('all settings cleared, reloading…', 'term-line-ok');
      setTimeout(function () { location.reload(); }, 700);
    },
    exit:   function (args) { if (args.length) { tooMany('exit'); return; } close(); },
    q:      function (args) { if (args.length) { tooMany('q'); return; } close(); },
    echo:   function (args) { line(args.join(' ')); },
    curl:   function (args) {
      var isSite = args.some(function (a) { return a.indexOf('ekanshgoenka') >= 0; });
      if (!isSite) { line('try: curl -L ekanshgoenka.com', 'term-line-ok'); return; }

      var CW = 66, CH = 13;
      var BG_TEXT = 'USE  A  BROWSER,  YOU  NERD';
      var BG_ROW  = Math.floor(CH / 2);
      var BG_COL  = Math.floor((CW - BG_TEXT.length) / 2);

      // build background text grid
      var bg = [];
      for (var y = 0; y < CH; y++) { bg[y] = []; for (var x = 0; x < CW; x++) bg[y][x] = null; }
      for (var i = 0; i < BG_TEXT.length; i++) if (BG_COL + i < CW) bg[BG_ROW][BG_COL + i] = BG_TEXT[i];

      // rain columns
      var cols = [];
      for (var x = 0; x < CW; x++) {
        cols.push({ y: -Math.floor(Math.random() * CH * 2), spd: 0.4 + Math.random() * 0.6,
                    len: 2 + Math.floor(Math.random() * 4), on: Math.random() > 0.45 });
      }

      function stepRain() {
        for (var i = 0; i < cols.length; i++) {
          var c = cols[i]; if (!c.on) continue;
          c.y += c.spd;
          if (c.y - c.len > CH) {
            c.y = -Math.floor(Math.random() * 6); c.len = 2 + Math.floor(Math.random() * 4);
            c.spd = 0.4 + Math.random() * 0.6;   c.on  = Math.random() > 0.2;
          }
        }
      }

      function renderFrame(fadeRatio) {
        var html = '';
        for (var y = 0; y < CH; y++) {
          for (var x = 0; x < CW; x++) {
            var col = cols[x], hy = Math.floor(col.y), dist = hy - y;
            var ch = null, style = '';
            if (col.on) {
              if (dist === 0)                         { ch = '.'; style = 'color:var(--accent)'; }
              else if (dist > 0 && dist <= col.len)   { ch = '|'; style = dist < 2 ? 'color:var(--accent)' : 'color:var(--muted)'; }
            }
            if (ch && fadeRatio > 0 && Math.random() < fadeRatio) ch = null;
            if (ch)            html += '<span style="' + style + '">' + ch + '</span>';
            else if (bg[y][x]) html += '<span style="color:var(--fg);font-weight:bold">' + bg[y][x] + '</span>';
            else               html += ' ';
          }
          if (y < CH - 1) html += '\n';
        }
        return html;
      }

      var pre = document.createElement('pre');
      pre.className = 'term-line-pre';
      output.appendChild(pre);
      output.scrollTop = output.scrollHeight;

      var frame = 0, MAIN = 75, FADE = 10;
      var timer = setInterval(function () {
        stepRain();
        if (frame < MAIN) {
          pre.innerHTML = renderFrame(0);
        } else if (frame < MAIN + FADE) {
          pre.innerHTML = renderFrame((frame - MAIN + 1) / FADE);
        } else {
          clearInterval(timer);
          pre.innerHTML = '';
          line('JUST USE A REGULAR BROWSER!!!', 'term-line-ok');
          output.scrollTop = output.scrollHeight;
          return;
        }
        frame++;
        output.scrollTop = output.scrollHeight;
      }, 80);
    },
    sudo:   function ()  { line('ekansh is not in the sudoers file. this incident will be reported.', 'term-line-err'); },
    vim:    function (args) { if (args.length) { tooMany('vim'); return; } line('you\'re already in vim (spiritually).', 'term-line-ok'); },
    rm: function (a) {
      var flags = a.filter(function (x) { return x[0] === '-'; }).join('');
      var paths = a.filter(function (x) { return x[0] !== '-'; });
      var isRF  = flags.indexOf('r') >= 0 && flags.indexOf('f') >= 0;
      var isRoot = paths.indexOf('/') >= 0;
      if (isRF && isRoot) { startDegradation(); return; }
      if (isRF) { line('rm: ' + (paths[0] || '/') + ': permission denied', 'term-line-err'); return; }
      line('rm: ' + (a[0] || '?') + ': permission denied', 'term-line-err');
    },
    true:   function ()  { /* exits 0, outputs nothing, as god intended */ },
    false:  function ()  { line('false: exited with status 1', 'term-line-err'); },
    ':':    function ()  { /* the shell builtin : always succeeds */ },

    // ── arcade ──────────────────────────────────────────────────
    games: function(args) {
      if (args.length) { tooMany('games'); return; }
      var now = Date.now();
      if (_gCache && now - _gCacheAt < G_TTL) { _renderGames(_gCache); return; }
      line('fetching games...', 'term-line-ok');
      fetch('/api/games').then(function(r) { return r.json(); }).then(function(gs) {
        _gCache = gs; _gCacheAt = Date.now(); _renderGames(gs);
      }).catch(function() { line('could not fetch games', 'term-line-err'); });
    },

    source: function(args) {
      if (!args[0]) { needArg('source', 'source <game-id>'); return; }
      var id = args[0];
      var cached = _gById[id];
      if (cached) { line('── ' + cached.title + ' by ' + cached.author + ' ──\n\n' + cached.code, 'term-line-pre'); return; }
      fetch('/api/games?id=' + encodeURIComponent(id)).then(function(r) { return r.json(); }).then(function(g) {
        if (g.error) { line('game not found: ' + id, 'term-line-err'); return; }
        _gById[id] = g;
        line('── ' + g.title + ' by ' + g.author + ' ──\n\n' + g.code, 'term-line-pre');
      }).catch(function() { line('could not fetch source', 'term-line-err'); });
    },

    scores: function(args) {
      if (!args[0]) { needArg('scores', 'scores <game-id> [n]'); return; }
      var id = args[0], n = Math.min(parseInt(args[1]) || 10, 50);
      line('fetching scores for ' + id + '...', 'term-line-ok');
      fetch('/api/net?op=top&game=' + encodeURIComponent(id) + '&n=' + n)
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var entries = data.entries || [];
          if (!entries.length) { line('no scores for ' + id, 'term-line-ok'); return; }
          line('\x1b[36m── ' + id + ' leaderboard ──\x1b[0m', 'term-line-pre');
          entries.forEach(function(e, i) {
            var rank = ('  ' + (i + 1) + '.').slice(-4);
            var nm   = (e.name + '                ').slice(0, 16);
            line(rank + ' ' + nm + '\x1b[33m' + e.score + '\x1b[0m', 'term-line-pre');
          });
        })
        .catch(function() { line('network error', 'term-line-err'); });
    },

    delete: function(args) {
      if (!args[0] || !args[1]) { needArg('delete', 'delete <game-id> <edit-code>'); return; }
      var id = args[0], code = args[1];
      fetch('/api/games?id=' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code })
      }).then(function(r) { return r.json(); }).then(function(data) {
        if (data.ok) { _gCache = null; delete _gById[id]; line('deleted: ' + id, 'term-line-ok'); }
        else line(data.error || 'delete failed', 'term-line-err');
      }).catch(function() { line('network error', 'term-line-err'); });
    },

    play: function(args) {
      if (!args[0]) { needArg('play', 'play <game-id>  (see: games)'); return; }
      var id = args[0];
      if (_gById[id]) { loadFengari(function() { runLuaGame(_gById[id]); }); return; }
      line('fetching ' + id + '...', 'term-line-ok');
      fetch('/api/games?id=' + encodeURIComponent(id)).then(function(r) { return r.json(); }).then(function(game) {
        if (game.error) { line('game not found: ' + id + '  (see: games)', 'term-line-err'); return; }
        _gById[id] = game;
        loadFengari(function() { runLuaGame(game); });
      }).catch(function() { line('could not load game', 'term-line-err'); });
    },
  };

  // ── tab completion ──────────────────────────────────────────
  var CMD_NAMES = Object.keys(CMDS);

  function commonPrefix(strs) {
    if (!strs.length) return '';
    var p = strs[0];
    for (var i = 1; i < strs.length; i++) {
      while (strs[i].slice(0, p.length) !== p) { p = p.slice(0, -1); if (!p) return ''; }
    }
    return p;
  }

  // returns completion hits for a partially-typed path argument
  function completePath(typed) {
    var lastSlash = typed.lastIndexOf('/');
    var dirPart, namePart, dirPath;
    if (lastSlash >= 0) {
      dirPart  = typed.slice(0, lastSlash + 1);       // e.g. "projects/"
      namePart = typed.slice(lastSlash + 1);           // e.g. "b"
      dirPath  = resolvePath(typed.slice(0, lastSlash) || '');
    } else {
      dirPart  = '';
      namePart = typed;
      dirPath  = cwd;                                  // relative to current dir
    }
    var prefix = dirPath ? dirPath + '/' : '';
    return lsChildren(dirPath)
      .filter(function (n) { return n.indexOf(namePart) === 0; })
      .map(function (n) {
        var isDir = FS[prefix + n] && FS[prefix + n].type === 'dir';
        return dirPart + n + (isDir ? '/' : '');
      });
  }

  var ALL_THEMES    = ['tokyo-night', 'gruvbox', 'kanagawa', 'flexoki-light', 'rose-pine', 'ayu-light'];
  var ALL_PARAMS    = ['life.cell','life.opacity','life.glow','life.autofill','life.rainbow','life.speed','boids.n','boids.size','boids.tick','boids.speed','boids.perception','boids.separation','boids.opacity','boids.glow','trail.on','trail.size','trail.glow','trail.decay'];
  var ALL_PATTERNS  = ['r-pentomino','acorn','gosper-gun','queen-bee','pulsar','pentadecathlon','lwss','hwss'];
  var HELP_KEYS     = Object.keys(HELP_TOPICS).concat(Object.keys(HELP_CMDS)).sort();

  function completeArg(cmd, pos, typed) {
    var CMAP = {
      colorscheme: function (p) { return p === 0 ? ALL_THEMES : []; },
      theme:       function (p) { return p === 0 ? ALL_THEMES : []; },
      bg:          function (p) { return p === 0 ? ['life', 'boids', 'combo', 'off'] : []; },
      speed:       function (p) { return p === 0 ? ['life','boids','0','10','25','50','75','100'] : p === 1 ? ['0','10','25','50','75','100'] : []; },
      set:         function (p) { return p === 0 ? ALL_PARAMS : []; },
      spawn: function (p, args) {
        if (p === 0) return ALL_PATTERNS;
        if (p === 1) return ['random','1','2','3','4','5'];
        if (p === 2) return ['1','2','3','4','5'];
        return [];
      },
      preset:      function (p) { return p === 0 ? (window.getPresetNames ? window.getPresetNames() : []) : []; },
      help:        function (p) { return p === 0 ? HELP_KEYS : []; },
      man:         function (p) { return p === 0 ? CMD_NAMES.concat(Object.keys(HELP_TOPICS)).sort() : []; },
      which:       function (p) { return p === 0 ? CMD_NAMES : []; },
      curl:        function (p) { return p === 0 ? ['-L'] : p === 1 ? ['ekanshgoenka.com'] : []; },
      rm:          function ()  { return completePath(typed); },
    };
    var fn = CMAP[cmd];
    if (fn) return fn(pos).filter(function (s) { return s.indexOf(typed) === 0; });
    if (['ls','cat','cd','open'].indexOf(cmd) >= 0) return completePath(typed);
    return [];
  }

  function complete(val) {
    var parts = val.trimStart().split(/\s+/);
    var isCmd = parts.length === 1;
    var typed = parts[parts.length - 1];

    var hits;
    if (isCmd) {
      var paramKeys = window.getBgParams ? Object.keys(window.getBgParams()) : [];
      hits = CMD_NAMES.concat(paramKeys).filter(function (c) { return c.indexOf(typed) === 0; });
    } else {
      var cmd = parts[0].toLowerCase();
      var pos = parts.length - 2;  // 0-indexed arg position
      hits = completeArg(cmd, pos, typed);
    }

    if (!hits.length) return val;

    if (hits.length === 1) {
      parts[parts.length - 1] = hits[0];
      return parts.join(' ');
    }

    // advance to longest common prefix
    var cp = commonPrefix(hits);
    if (cp.length > typed.length) {
      parts[parts.length - 1] = cp;
      return parts.join(' ');
    }

    // already at common prefix — show options (basenames only)
    echoCmd(val);
    line(hits.map(function (h) {
      var cut = h.length - (h.endsWith('/') ? 1 : 0);
      var slash = h.lastIndexOf('/', cut - 1);
      return h.slice(slash + 1);
    }).join('  '));
    return val;
  }

  // ── open / close ────────────────────────────────────────────
  function open() {
    overlay.classList.add('open');
    inp.focus();
    isOpen = true;
  }
  function close() {
    overlay.classList.remove('open');
    isOpen = false;
    if (termPrompt) termPrompt.innerHTML = DEFAULT_PROMPT;
    // clean up any inline game input
    var inl = output.querySelector('.term-io-inline');
    if (inl) inl.parentNode.removeChild(inl);
    _gameMode = false; _gameResume = null;
  }

  // expose for arcade page buttons
  window.termOpen   = open;
  window.termRun    = function(cmd) { output.innerHTML = ''; open(); setTimeout(function() { run(cmd); }, 80); };
  window.termRunLua = function(code) { output.innerHTML = ''; open(); setTimeout(function() { loadFengari(function() { runLuaGame({ id: '_test_', title: 'test run', author: 'you', code: code }); }); }, 80); };

  // ── run a command ───────────────────────────────────────────
  function run(raw) {
    var cmd = raw.trim();
    if (!cmd) return;
    hist.unshift(cmd); histIdx = -1;
    echoCmd(cmd);
    var tokens = cmd.split(/\s+/);
    var fn = CMDS[tokens[0].toLowerCase()];
    if (fn) fn(tokens.slice(1));
    else {
      var p = window.getBgParams ? window.getBgParams() : {};
      if (p.hasOwnProperty(tokens[0])) {
        if (tokens.length > 1)
          line('tip: use: set ' + tokens[0] + ' ' + tokens.slice(1).join(' '), 'term-line-err');
        else
          line(tokens[0] + ' = ' + p[tokens[0]], 'term-line-ok');
      } else line('command not found: ' + tokens[0], 'term-line-err');
    }
  }

  // ── event wiring ────────────────────────────────────────────
  document.addEventListener('keydown', function (e) {
    if (e.key === ':' && !e.ctrlKey && !e.metaKey && !e.altKey &&
        e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') {
      e.preventDefault(); open();
    }
    if (e.key === 'Escape' && window._pendingSpawn) { if (window.cancelSpawn) window.cancelSpawn(); return; }
    if (e.key === 'Escape' && isOpen) close();
  });

  inp.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') {
      var v = inp.value; inp.value = '';
      if (_gameMode) {
        if (v.trim() === 'quit' || v.trim() === 'exit' || v.trim() === 'q') {
          _gameMode = false; _gameResume = null;
          // remove any inline input
          var inl = output.querySelector('.term-io-inline');
          if (inl) inl.parentNode.removeChild(inl);
          if (termPrompt) termPrompt.innerHTML = DEFAULT_PROMPT;
          line('─────────────────────────────────────────', 'term-line-pre');
          line('game exited.', 'term-line-ok');
        }
        // all other game input handled by inline input in output area
      } else { run(v); }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (histIdx < hist.length - 1) inp.value = hist[++histIdx] || '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (histIdx > 0) inp.value = hist[--histIdx] || '';
      else { histIdx = -1; inp.value = ''; }
    } else if (e.key === 'Tab') {
      e.preventDefault(); inp.value = complete(inp.value);
    } else if (e.key === 'Escape') {
      close();
    }
  });

  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) close();
  });

  var btn = document.getElementById('term-btn');
  if (btn) btn.addEventListener('click', open);
  var cls = document.getElementById('term-close');
  if (cls) cls.addEventListener('click', close);
})();
// ================================================================
// END HIDDEN TERMINAL
// ================================================================

// ================================================================
// READING PROGRESS COLUMN
// Shows a column of Life-cell-style squares on article pages
// that fill top→bottom as the user scrolls
// ================================================================
(function () {
  if (!document.body.classList.contains('page')) return;

  var CELLS      = 28;   // total cells in the column
  var CELL_SIZE  = 7;    // px per cell (square)
  var CELL_GAP   = 3;    // gap between cells (must match CSS gap)

  var container = document.createElement('div');
  container.id = 'read-progress';

  // one canvas per cell for simplicity
  var canvases = [];
  for (var i = 0; i < CELLS; i++) {
    var c = document.createElement('canvas');
    c.width  = CELL_SIZE;
    c.height = CELL_SIZE;
    container.appendChild(c);
    canvases.push(c);
  }
  document.body.appendChild(container);

  function getCSSVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function draw(progress) {
    // progress 0..1
    var filled = Math.round(progress * CELLS);
    var accent = getCSSVar('--accent');
    var border = getCSSVar('--border');
    for (var i = 0; i < CELLS; i++) {
      var ctx = canvases[i].getContext('2d');
      ctx.clearRect(0, 0, CELL_SIZE, CELL_SIZE);
      if (i < filled) {
        ctx.fillStyle = accent;
        ctx.fillRect(0, 0, CELL_SIZE, CELL_SIZE);
      } else {
        // empty cell: just a 1px border square
        ctx.strokeStyle = border;
        ctx.lineWidth = 1;
        ctx.strokeRect(0.5, 0.5, CELL_SIZE - 1, CELL_SIZE - 1);
      }
    }
  }

  function getProgress() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    var docH  = document.documentElement.scrollHeight;
    var winH  = window.innerHeight;
    var max   = docH - winH;
    if (max <= 0) return 1;
    return Math.min(1, Math.max(0, scrollTop / max));
  }

  draw(getProgress());

  window.addEventListener('scroll', function () { draw(getProgress()); }, { passive: true });

  // redraw on theme change
  var obs = new MutationObserver(function () { draw(getProgress()); });
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();


