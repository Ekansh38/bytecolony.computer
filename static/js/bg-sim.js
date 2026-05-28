// ================================================================
(function () {
  // Reduced sim on touch-only devices (phones/tablets)
  var _isMobile = window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  var canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  if (_isMobile) { canvas.style.display = 'none'; return; }
  var ctx = canvas.getContext('2d');

  var MODES = ['life', 'boids', 'combo', 'off'];
  // one-time migration: if sim was previously disabled, re-enable it
  var _savedMode = localStorage.getItem('bgMode');
  if (!localStorage.getItem('_msim3')) {
    localStorage.setItem('_msim3', '1');
    if (_savedMode === 'off') {
      _savedMode = _isMobile ? 'boids' : 'combo';
      localStorage.setItem('bgMode', _savedMode);
    }
  }
  if (!_savedMode) _savedMode = _isMobile ? 'boids' : 'combo';
  var modeIdx = Math.max(0, MODES.indexOf(_savedMode));
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

  var N          = _isMobile ? 60 : 120;
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

      // cursor interaction: gentle attract from afar, scatter when close
      // tap-to-scatter: burst widens repel radius and amplifies force
      if (_mouseActive) {
        var burstR = CURSOR_REPEL_R + _burstStrength * 180; // 60 → 240px during burst
        var burstW = CURSOR_REPEL_W + _burstStrength * 0.35; // 0.08 → 0.43 during burst
        dx = _mouseX - b.x; dy = _mouseY - b.y;
        d2 = dx*dx + dy*dy;
        if (d2 > 1) {
          d = Math.sqrt(d2);
          if (d < burstR) {
            var repel = (1 - d / burstR);
            repel = repel * repel;
            fx -= (dx/d) * repel * burstW;
            fy -= (dy/d) * repel * burstW;
          } else if (_burstStrength < 0.1 && d < CURSOR_ATTRACT_R) {
            var attract = (1 - (d - CURSOR_REPEL_R) / (CURSOR_ATTRACT_R - CURSOR_REPEL_R));
            fx += (dx/d) * attract * CURSOR_ATTRACT_W;
            fy += (dy/d) * attract * CURSOR_ATTRACT_W;
          }
        }
      }

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

  // ── cursor interaction ──
  var _mouseX = -9999, _mouseY = -9999, _mouseActive = false, _mouseTimer = 0;
  var CURSOR_ATTRACT_R = 200, CURSOR_REPEL_R = 60;
  var CURSOR_ATTRACT_W = 0.0004, CURSOR_REPEL_W = 0.08;
  var CURSOR_IDLE_MS = 2000;
  var _burstStrength = 0; // tap-to-scatter: decays each frame

  document.addEventListener('mousemove', function(e) {
    _mouseX = e.clientX; _mouseY = e.clientY;
    _mouseActive = true;
    clearTimeout(_mouseTimer);
    _mouseTimer = setTimeout(function() { _mouseActive = false; }, CURSOR_IDLE_MS);
  });
  document.addEventListener('mouseleave', function() { _mouseActive = false; });

  // touch interaction for mobile boids
  document.addEventListener('touchmove', function(e) {
    var t = e.touches[0];
    if (!t) return;
    _mouseX = t.clientX; _mouseY = t.clientY;
    _mouseActive = true;
    clearTimeout(_mouseTimer);
    _mouseTimer = setTimeout(function() { _mouseActive = false; }, CURSOR_IDLE_MS);
  }, { passive: true });
  document.addEventListener('touchstart', function(e) {
    var t = e.touches[0];
    if (!t) return;
    _mouseX = t.clientX; _mouseY = t.clientY;
    _mouseActive = true;
    _burstStrength = 1.0; // trigger scatter burst
    clearTimeout(_mouseTimer);
    _mouseTimer = setTimeout(function() { _mouseActive = false; }, CURSOR_IDLE_MS);
  }, { passive: true });
  document.addEventListener('touchend', function() {
    clearTimeout(_mouseTimer);
    _mouseTimer = setTimeout(function() { _mouseActive = false; }, 500);
  });

  var _accentRgb = null;
  var _accentCache = {};
  function accentRgba(alpha) {
    if (!_accentRgb) {
      var hex = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      _accentRgb = [parseInt(hex.slice(1,3),16), parseInt(hex.slice(3,5),16), parseInt(hex.slice(5,7),16)];
      _accentCache = {};
    }
    var key = alpha;
    if (_accentCache[key]) return _accentCache[key];
    var s = 'rgba('+_accentRgb[0]+','+_accentRgb[1]+','+_accentRgb[2]+','+alpha+')';
    _accentCache[key] = s;
    return s;
  }
  window._invalidateAccentCache = function () { _accentRgb = null; _accentCache = {}; };

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
    if (_burstStrength > 0.001) _burstStrength *= 0.92; else _burstStrength = 0;

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
    drawGhost();
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

  // ghost preview state
  var _ghostGX = -1, _ghostGY = -1, _ghostPat = null, _ghostStart = 0;

  function cancelSpawn() {
    window._pendingSpawn = null;
    window._pendingSpawnCount = 0;
    _ghostPat = null; _ghostGX = -1; _ghostGY = -1;
    if (spawnOverlay) spawnOverlay.classList.remove('active');
    _trailGX = -1; _trailGY = -1;
    _trailBlocked = true;
    setTimeout(function () { _trailBlocked = false; }, 500);
  }
  window.cancelSpawn = cancelSpawn;

  if (spawnOverlay) {
    spawnOverlay.addEventListener('mousemove', function(e) {
      var name = window._pendingSpawn;
      if (!name) { _ghostPat = null; return; }
      _ghostGX = Math.floor(e.clientX / CELL);
      _ghostGY = Math.floor(e.clientY / CELL);
      _ghostPat = SPAWN_PATTERNS[name] || null;
      if (!_ghostStart) _ghostStart = performance.now();
    });
    spawnOverlay.addEventListener('mouseleave', function() {
      _ghostPat = null; _ghostGX = -1; _ghostGY = -1;
    });

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
        _ghostStart = performance.now();
        updateSpawnHint();
      }
    });
  }

  function drawGhost() {
    if (!_ghostPat || _ghostGX < 0) return;
    var t = (performance.now() - _ghostStart) * 0.003;
    var pulse = 0.4 + 0.25 * Math.sin(t); // 0.15–0.65 opacity pulse
    var glowPulse = 6 + 4 * Math.sin(t);
    ctx.save();
    ctx.shadowColor = accentRgba(0.9);
    ctx.shadowBlur  = glowPulse;
    ctx.fillStyle   = accentRgba(pulse);
    for (var i = 0; i < _ghostPat.length; i++) {
      var x = ((_ghostGX + _ghostPat[i][0]) % GW + GW) % GW;
      var y = ((_ghostGY + _ghostPat[i][1]) % GH + GH) % GH;
      ctx.fillRect(x * CELL + 1, y * CELL + 1, CELL - 2, CELL - 2);
    }
    ctx.restore();
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
        var n = Math.round(val);
        if (_isMobile) n = Math.round(n / 2);
        N = Math.max(1, Math.min(_isMobile ? 60 : 1000, n));
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
    // 1. default — site defaults + tokyo-night
    'default':  { sim:'combo', lspeed:15, bspeed:15, theme:'tokyo-night', desc:'site defaults',
      params:{'life.cell':7,  'life.opacity':9,  'life.glow':0,  'life.autofill':50, 'life.rainbow':0,
              'boids.n':120, 'boids.size':14, 'boids.tick':1.8, 'boids.opacity':14, 'boids.glow':0,
              'trail.on':0,  'trail.size':2,  'trail.glow':12, 'trail.decay':80} },
    // 2. dusk — purple glow + life
    dusk:      { sim:'combo', lspeed:15, bspeed:14, theme:'dracula',
      desc:'purple glow + life',
      params:{'life.cell':9,  'life.opacity':9,  'life.glow':0,  'life.autofill':50, 'life.rainbow':0,
              'boids.n':40,  'boids.size':28, 'boids.tick':0.9, 'boids.opacity':75, 'boids.glow':65,
              'boids.perception':120, 'boids.separation':80,
              'trail.on':0} },
    // 3. soft — gentle layers
    soft:      { sim:'combo', lspeed:10, bspeed:10, theme:'rose-pine',
      desc:'gentle layers',
      params:{'life.cell':9, 'life.opacity':30, 'life.glow':20, 'life.autofill':40, 'life.rainbow':0,
              'boids.n':20,  'boids.size':45, 'boids.tick':0.5, 'boids.opacity':60, 'boids.glow':30,
              'boids.perception':150, 'boids.separation':100, 'trail.on':0} },
    // 4. aurora — rainbow + boids
    aurora:    { sim:'combo', lspeed:20, bspeed:12, theme:'tokyo-night',
      desc:'rainbow + boids',
      params:{'life.cell':6,  'life.opacity':50, 'life.glow':25, 'life.autofill':50, 'life.rainbow':3,
              'boids.n':60,  'boids.size':18, 'boids.tick':1.2, 'boids.opacity':20, 'boids.glow':15,
              'boids.perception':100, 'boids.separation':50,
              'trail.on':0} },
    // 5. canvas — light rainbow
    canvas:    { sim:'combo', lspeed:10, bspeed:10, theme:'github-light',
      desc:'light rainbow',
      params:{'life.cell':7,  'life.opacity':30, 'life.glow':20, 'life.autofill':40, 'life.rainbow':3,
              'boids.n':20,  'boids.size':45, 'boids.tick':0.5, 'boids.opacity':60, 'boids.glow':30,
              'boids.perception':150, 'boids.separation':100,
              'trail.on':0} },
    // 6. prism — position rainbow
    prism:     { sim:'life',  lspeed:30, bspeed:null,
      desc:'position rainbow',
      params:{'life.cell':4,  'life.opacity':80, 'life.glow':50, 'life.autofill':60, 'life.rainbow':3,
              'trail.on':1, 'trail.glow':30, 'trail.decay':70, 'trail.size':2} },
    // 7. swarm — fast dense
    swarm:     { sim:'boids', lspeed:null, bspeed:20, theme:'gruvbox',
      desc:'fast dense',
      params:{'boids.n':300, 'boids.size':25, 'boids.tick':3.5, 'boids.opacity':22, 'boids.glow':0,
              'boids.perception':60,  'boids.separation':30} },
    // 8+
    ghost:     { sim:'combo', lspeed:15, bspeed:15, desc:'any theme',
      params:{'life.cell':7,  'life.opacity':9,  'life.glow':0,  'life.autofill':50, 'life.rainbow':0,
              'boids.n':120, 'boids.size':14, 'boids.tick':1.8, 'boids.opacity':14, 'boids.glow':0,
              'trail.on':0,  'trail.size':2,  'trail.glow':12, 'trail.decay':80} },
    bloom:     { sim:'life',  lspeed:20, bspeed:null, theme:'tokyo-night',
      desc:'glow + trail',
      params:{'life.cell':5,  'life.opacity':70, 'life.glow':80, 'life.autofill':55, 'life.rainbow':0,
              'trail.on':1,   'trail.glow':45,   'trail.decay':60, 'trail.size':2} },
    midnight:  { sim:'boids', lspeed:null, bspeed:15, theme:'tokyo-night',
      desc:'dark glow',
      params:{'boids.n':50,  'boids.size':20, 'boids.tick':1.0, 'boids.opacity':85, 'boids.glow':70,
              'boids.perception':100, 'boids.separation':60} },
    ember:     { sim:'life',  lspeed:18, bspeed:null, theme:'gruvbox',
      desc:'warm glow',
      params:{'life.cell':8,  'life.opacity':35, 'life.glow':55, 'life.autofill':50, 'life.rainbow':0,
              'trail.on':0} },
    chromatic: { sim:'life',  lspeed:20, bspeed:null,
      desc:'rainbow',
      params:{'life.cell':6,  'life.opacity':55, 'life.glow':20, 'life.autofill':50, 'life.rainbow':1,
              'trail.on':0} },
    fog:       { sim:'life',  lspeed:12, bspeed:null,
      desc:'barely there',
      params:{'life.cell':8,  'life.opacity':6,  'life.glow':0,  'life.autofill':40, 'life.rainbow':0,
              'trail.on':0} },
    paper:     { sim:'life',  lspeed:12, bspeed:null, theme:'papercolor-light',
      desc:'soft cells',
      params:{'life.cell':10, 'life.opacity':20, 'life.glow':0,  'life.autofill':35, 'life.rainbow':0,
              'trail.on':0} },
    drift:     { sim:'boids', lspeed:null, bspeed:18,
      desc:'calm flock',
      params:{'boids.n':80,  'boids.size':15, 'boids.tick':1.4, 'boids.opacity':15, 'boids.glow':0,
              'boids.perception':80, 'boids.separation':40} },
  };

  window.getPresetNames = function () { return Object.keys(PRESETS); };
  window._getPresetData = function (name) { return PRESETS[name] || null; };
  window._setPresetData = function (name, data) { if (data && typeof data === 'object') PRESETS[name] = data; };
  window.getPresetsForMode = function (mode) {
    return Object.keys(PRESETS).filter(function (k) { return PRESETS[k].sim === mode; });
  };

  // ── load DB presets (override hardcoded defaults) ─────────────────────────────
  (function loadDbPresets() {
    fetch('/api/themes?action=presets').then(function (r) { return r.json(); }).then(function (d) {
      if (!d.presets || typeof d.presets !== 'object') return;
      var keys = Object.keys(d.presets);
      if (!keys.length) return;
      // replace entirely — remove hardcoded presets not in DB
      var old = Object.keys(PRESETS);
      for (var i = 0; i < old.length; i++) {
        if (!d.presets[old[i]]) delete PRESETS[old[i]];
      }
      for (var i = 0; i < keys.length; i++) {
        PRESETS[keys[i]] = d.presets[keys[i]];
      }
      // rebuild pickers with updated presets
      if (window._rebuildPresetPicker) window._rebuildPresetPicker();
    }).catch(function () {});
  })();

  // ── preset picker — shows all presets; applying one switches mode automatically ─
  var THEME_ACCENTS = {
    'tokyo-night':      '#7aa2f7',
    'gruvbox':          '#d79921',
    'dracula':          '#bd93f9',
    'rose-pine':        '#b4637a',
    'github-light':     '#0969da',
    'papercolor-light': '#005f87',
    'hacker':           '#00ff41'
  };

  // ── desktop settings panel builder ──
  var DS_SLIDERS = [
    { key: 'life.speed',      label: 'speed',      min: 0, max: 100, step: 1, mode: 'life' },
    { key: 'life.cell',       label: 'cell size',   min: 1, max: 80,  step: 1, mode: 'life' },
    { key: 'life.opacity',    label: 'opacity',     min: 1, max: 100, step: 1, mode: 'life' },
    { key: 'life.glow',       label: 'glow',        min: 0, max: 100, step: 1, mode: 'life' },
    { key: 'life.autofill',   label: 'autofill',    min: 0, max: 100, step: 1, mode: 'life' },
    { key: 'boids.speed',     label: 'speed',       min: 0, max: 100, step: 1, mode: 'boids' },
    { key: 'boids.n',         label: 'count',       min: 1, max: 1000,step: 1, mode: 'boids' },
    { key: 'boids.size',      label: 'size',        min: 1, max: 200, step: 1, mode: 'boids' },
    { key: 'boids.opacity',   label: 'opacity',     min: 1, max: 100, step: 1, mode: 'boids' },
    { key: 'boids.glow',      label: 'glow',        min: 0, max: 100, step: 1, mode: 'boids' },
    { key: 'boids.perception',label: 'perception',  min: 1, max: 500, step: 1, mode: 'boids' },
    { key: 'boids.separation',label: 'separation',  min: 0, max: 300, step: 1, mode: 'boids' },
  ];
  var RAINBOW_LABELS = ['off', 'time', 'age', 'position'];

  function _buildDesktopSettings() {
    var mode = window.getBgMode ? window.getBgMode() : 'boids';
    var params = window.getBgParams ? window.getBgParams() : {};
    var showLife  = mode === 'life' || mode === 'combo';
    var showBoids = mode === 'boids' || mode === 'combo';

    // ── themes (only rebuild if changed) ──
    var themesC = document.getElementById('ds-themes');
    if (themesC && !themesC.childElementCount) {
      var cur = document.documentElement.getAttribute('data-theme');
      THEMES.forEach(function (t) {
        var dot = document.createElement('button');
        dot.className = 'ds-theme-dot' + (t === cur ? ' active' : '');
        dot.setAttribute('data-t', t);
        dot.innerHTML = '<span class="ds-dot-inner" style="background:' +
          (THEME_ACCENTS[t] || 'var(--accent)') + '"></span>' +
          '<span class="ds-dot-label">' + t + '</span>';
        dot.addEventListener('click', function () {
          applyTheme(t);
          themesC.querySelectorAll('.ds-theme-dot').forEach(function (d) {
            d.classList.toggle('active', d.getAttribute('data-t') === t);
          });
        });
        themesC.appendChild(dot);
      });
    } else if (themesC) {
      var cur = document.documentElement.getAttribute('data-theme');
      themesC.querySelectorAll('.ds-theme-dot').forEach(function (d) {
        d.classList.toggle('active', d.getAttribute('data-t') === cur);
      });
    }

    // ── mode seg (just update active states) ──
    var seg = document.getElementById('ds-mode-seg');
    if (seg) {
      var btns = seg.querySelectorAll('button');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].getAttribute('data-mode') === mode);
        if (!btns[i]._wired) {
          btns[i]._wired = true;
          btns[i].addEventListener('click', (function (btn) {
            return function () {
              if (window.setBgMode) window.setBgMode(btn.getAttribute('data-mode'));
              _buildDesktopSettings();
            };
          })(btns[i]));
        }
      }
    }

    // ── presets (all presets, independent of mode) ──
    var presetsC = document.getElementById('ds-presets');
    if (presetsC && !presetsC.childElementCount) {
      var names = window.getPresetNames ? window.getPresetNames() : [];
      // random button
      var rBtn = document.createElement('button');
      rBtn.className = 'ds-preset ds-preset-rand';
      rBtn.textContent = '↻';
      rBtn.title = 'random preset';
      rBtn.addEventListener('click', function () {
        var n = window.getPresetNames ? window.getPresetNames() : [];
        var pick = n.filter(function (x) { return x !== activePreset; });
        if (!pick.length) return;
        window.applyPreset(pick[Math.floor(Math.random() * pick.length)]);
        _buildDesktopSettings();
      });
      presetsC.appendChild(rBtn);
      names.forEach(function (name) {
        var p = PRESETS[name];
        var btn = document.createElement('button');
        btn.className = 'ds-preset' + (activePreset === name ? ' active' : '');
        btn.setAttribute('data-preset', name);
        var dot = document.createElement('span');
        dot.className = 'ds-preset-dot';
        if (p.theme && THEME_ACCENTS[p.theme]) {
          dot.style.background = THEME_ACCENTS[p.theme];
        } else {
          dot.classList.add('ds-preset-dot-none');
        }
        btn.appendChild(dot);
        btn.appendChild(document.createTextNode(name));
        btn.title = p.desc || '';
        btn.addEventListener('click', function () {
          window.applyPreset(name);
          _buildDesktopSettings();
        });
        presetsC.appendChild(btn);
      });
    } else if (presetsC) {
      presetsC.querySelectorAll('.ds-preset').forEach(function (btn) {
        btn.classList.toggle('active', btn.getAttribute('data-preset') === activePreset);
      });
    }

    // ── sliders ──
    var slidersC = document.getElementById('ds-sliders');
    if (!slidersC) return;

    // fade out, rebuild, fade in
    slidersC.style.opacity = '0';
    setTimeout(function () {
      slidersC.innerHTML = '';
      if (mode === 'off') {
        slidersC.innerHTML = '<div class="ds-empty">background disabled</div>';
      } else {
        if (showLife) {
          slidersC.appendChild(_dsGroupLabel('life'));
          DS_SLIDERS.forEach(function (s) {
            if (s.mode === 'life') slidersC.appendChild(_dsSliderRow(s, params));
          });
          slidersC.appendChild(_dsRainbowControl(params));
          slidersC.appendChild(_dsTrailSection(params));
        }
        if (showBoids) {
          slidersC.appendChild(_dsGroupLabel('boids'));
          DS_SLIDERS.forEach(function (s) {
            if (s.mode === 'boids') slidersC.appendChild(_dsSliderRow(s, params));
          });
          if (!showLife) {
            slidersC.appendChild(_dsTrailSection(params));
          }
        }
      }
      slidersC.style.opacity = '1';
    }, 120);
  }

  function _dsGroupLabel(text) {
    var d = document.createElement('div');
    d.className = 'ds-group-label';
    d.textContent = text;
    return d;
  }

  function _getActivePresetParams() {
    if (!activePreset || !PRESETS[activePreset]) return null;
    return PRESETS[activePreset].params;
  }

  function _dsSliderRow(s, params) {
    var val = params[s.key] != null ? params[s.key] : 0;
    var presetParams = _getActivePresetParams();
    var isNone = presetParams && !(s.key in presetParams);

    var row = document.createElement('div');
    row.className = 'ds-slider-row' + (isNone ? ' ds-slider-none' : '');

    var label = document.createElement('span');
    label.className = 'ds-slider-label';
    label.textContent = s.label;

    var slider = document.createElement('input');
    slider.type = 'range';
    slider.className = 'ds-slider';
    slider.min = s.min; slider.max = s.max; slider.step = s.step;
    slider.value = val;

    var valSpan = document.createElement('span');
    valSpan.className = 'ds-slider-val';
    valSpan.textContent = isNone ? 'none' : Math.round(val);

    var numInput = document.createElement('input');
    numInput.type = 'text';
    numInput.inputMode = 'numeric';
    numInput.className = 'ds-slider-val-input';
    numInput.value = Math.round(val);
    numInput.style.display = 'none';

    function applyTyped() {
      var v = parseFloat(numInput.value);
      if (isNaN(v)) v = parseFloat(s.min);
      v = Math.max(parseFloat(s.min), Math.min(parseFloat(s.max), v));
      slider.value = v;
      valSpan.textContent = Math.round(v);
      numInput.style.display = 'none';
      valSpan.style.display = '';
      if (window.setParam) window.setParam(s.key, v);
    }

    valSpan.addEventListener('click', function () {
      if (isNone) return;
      numInput.value = valSpan.textContent;
      valSpan.style.display = 'none';
      numInput.style.display = '';
      numInput.focus();
      numInput.select();
    });
    numInput.addEventListener('blur', applyTyped);
    numInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); numInput.blur(); }
      if (e.key === 'Escape') {
        numInput.style.display = 'none';
        valSpan.style.display = '';
      }
    });

    slider.addEventListener('input', function () {
      var v = parseFloat(slider.value);
      valSpan.textContent = Math.round(v);
      numInput.value = Math.round(v);
      if (window.setParam) window.setParam(s.key, v);
    });

    row.appendChild(label);
    row.appendChild(slider);
    row.appendChild(valSpan);
    row.appendChild(numInput);
    return row;
  }

  function _dsRainbowControl(params) {
    var cur = params['life.rainbow'] || 0;
    var presetParams = _getActivePresetParams();
    var isNone = presetParams && !('life.rainbow' in presetParams);
    var row = document.createElement('div');
    row.className = 'ds-control-row' + (isNone ? ' ds-slider-none' : '');
    var label = document.createElement('span');
    label.className = 'ds-slider-label';
    label.textContent = 'rainbow';
    row.appendChild(label);

    if (isNone) {
      var noneLabel = document.createElement('span');
      noneLabel.className = 'ds-slider-val';
      noneLabel.textContent = 'none';
      row.appendChild(noneLabel);
    } else {
      var seg = document.createElement('div');
      seg.className = 'ds-mini-seg';
      RAINBOW_LABELS.forEach(function (lbl, i) {
        var btn = document.createElement('button');
        btn.textContent = lbl;
        btn.className = i === cur ? 'active' : '';
        btn.addEventListener('click', function () {
          if (window.setParam) window.setParam('life.rainbow', i);
          seg.querySelectorAll('button').forEach(function (b, j) {
            b.classList.toggle('active', j === i);
          });
        });
        seg.appendChild(btn);
      });
      row.appendChild(seg);
    }
    return row;
  }

  var TRAIL_SLIDERS = [
    { key: 'trail.size',  label: 'size',  min: 1, max: 3,   step: 1 },
    { key: 'trail.glow',  label: 'glow',  min: 0, max: 100, step: 1 },
    { key: 'trail.decay', label: 'decay', min: 0, max: 100, step: 1 },
  ];

  function _dsTrailSection(params) {
    var wrap = document.createElement('div');
    var presetParams = _getActivePresetParams();
    var trailNone = presetParams && !('trail.on' in presetParams);
    var on = params['trail.on'] ? true : false;

    // toggle row
    var row = document.createElement('div');
    row.className = 'ds-control-row' + (trailNone ? ' ds-slider-none' : '');
    var label = document.createElement('span');
    label.className = 'ds-slider-label';
    label.textContent = 'trail';
    row.appendChild(label);

    if (trailNone) {
      var noneLabel = document.createElement('span');
      noneLabel.className = 'ds-slider-val';
      noneLabel.textContent = 'none';
      row.appendChild(noneLabel);
      wrap.appendChild(row);
    } else {
      var toggle = document.createElement('button');
      toggle.className = 'ds-toggle' + (on ? ' active' : '');
      toggle.innerHTML = '<span class="ds-toggle-knob"></span>';
      wrap.appendChild(row);

      // sub-sliders container
      var sub = document.createElement('div');
      sub.className = 'ds-trail-sub';
      sub.style.display = on ? '' : 'none';
      TRAIL_SLIDERS.forEach(function (s) {
        sub.appendChild(_dsSliderRow(s, params));
      });
      wrap.appendChild(sub);

      toggle.addEventListener('click', function () {
        on = !on;
        toggle.classList.toggle('active', on);
        sub.style.display = on ? '' : 'none';
        if (window.setParam) window.setParam('trail.on', on ? 1 : 0);
      });
      row.appendChild(toggle);
    }

    return wrap;
  }

  window._buildDesktopSettings = _buildDesktopSettings;
  window._rebuildPresetPicker = _buildDesktopSettings;

  document.addEventListener('DOMContentLoaded', function () {
    var PARAM_KEYS = ['life.cell','life.opacity','life.glow','life.autofill','life.rainbow',
      'boids.n','boids.size','boids.tick','boids.opacity','boids.glow','boids.perception','boids.separation',
      'trail.on','trail.size','trail.glow','trail.decay'];
    for (var ki = 0; ki < PARAM_KEYS.length; ki++) {
      var sv = localStorage.getItem('p:' + PARAM_KEYS[ki]);
      if (sv !== null) _origSetParam(PARAM_KEYS[ki], parseFloat(sv));
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
    if (window._rebuildPresetPicker) window._rebuildPresetPicker();
    return true;
  };
  window.getActivePreset = function () { return activePreset; };
})();
