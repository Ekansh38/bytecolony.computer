// ================================================================
// DIAGRAM LIGHTBOX + FRAME EXPLORER
//
// Zoom mode (SVGs and GIFs without frames): click any .svg-diagram to
// enlarge it in a blurred-backdrop overlay with its caption below.
//
// Frame mode (GIFs listed in /assets/frames-gen/index.json): clicking
// the GIF opens a stepper viewer laid out like a video player — stage
// with edge chevrons, a control bar underneath (play, speed slider,
// counter, grid), caption panel on the right, filmstrip below. Space
// plays at the GIF's own timing scaled by the slider; arrows step.
// Grid mode replaces the whole viewer with every frame + caption at
// once; clicking a cell or Esc returns. Frame position is mirrored to
// #f=name:N for deep links; ?frames=all inline-expands every framed
// GIF into its gallery for read-as-comic mode.
// ================================================================
(function () {
  var overlay = null;
  var framesIndex;            // undefined = not fetched, object once fetched
  var manifests = {};         // name -> manifest (cached)
  var st = {
    mode: 'zoom',             // zoom | frames | gallery
    name: '',
    manifest: null,
    frame: 0,
    speed: 1,
    playing: false,
    playTimer: null
  };

  // ── data ─────────────────────────────────────────────────────
  function getIndex() {
    if (framesIndex !== undefined) return Promise.resolve(framesIndex);
    return fetch('/assets/frames-gen/index.json')
      .then(function (r) { return r.ok ? r.json() : {}; })
      .catch(function () { return {}; })
      .then(function (d) { framesIndex = d; return d; });
  }

  function getManifest(name) {
    if (manifests[name]) return Promise.resolve(manifests[name]);
    return fetch('/assets/frames-gen/' + name + '/manifest.json')
      .then(function (r) { return r.ok ? r.json() : null; })
      .catch(function () { return null; })
      .then(function (m) { if (m) manifests[name] = m; return m; });
  }

  function gifName(diagram) {
    var img = diagram.querySelector('img');
    if (!img) return '';
    var m = /\/([^\/]+)\.gif(\?|#|$)/.exec(img.getAttribute('src') || '');
    return m ? m[1] : '';
  }

  function findDiagram(name) {
    var imgs = document.querySelectorAll('.svg-diagram img');
    for (var i = 0; i < imgs.length; i++) {
      if ((imgs[i].getAttribute('src') || '').indexOf('/' + name + '.gif') >= 0)
        return imgs[i].closest('.svg-diagram');
    }
    return null;
  }

  function figureCaption(diagram) {
    var next = diagram && diagram.nextElementSibling;
    return (next && next.tagName === 'P') ? next.textContent.trim() : '';
  }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  // ── overlay skeleton ─────────────────────────────────────────
  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.createElement('div');
    overlay.className = 'diagram-lightbox';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<button class="diagram-lightbox-close" type="button" aria-label="Close">esc</button>' +
      '<div class="diagram-lightbox-inner" role="dialog" aria-modal="true" aria-label="Diagram viewer">' +
        '<div class="diagram-lightbox-panel"></div>' +
        '<div class="diagram-lightbox-caption"></div>' +
        '<div class="fx" hidden>' +
          '<div class="fx-main">' +
            '<div class="fx-stage-wrap">' +
              '<div class="fx-stage">' +
                '<img class="fx-img" alt="">' +
                '<button class="fx-zone fx-zone-prev" type="button" aria-label="Previous frame"></button>' +
                '<button class="fx-zone fx-zone-next" type="button" aria-label="Next frame"></button>' +
              '</div>' +
              '<div class="fx-controlbar">' +
                '<button class="fx-btn fx-play" type="button">play</button>' +
                '<div class="fx-speedwrap" title="Playback speed">' +
                  '<input class="fx-speed-slider" type="range" min="0.25" max="4" step="0.25" value="1" aria-label="Playback speed">' +
                  '<span class="fx-speed-label">1x</span>' +
                '</div>' +
                '<span class="fx-counter"></span>' +
                '<button class="fx-btn fx-grid-btn" type="button">grid</button>' +
              '</div>' +
            '</div>' +
            '<div class="fx-side">' +
              '<div class="fx-side-title"></div>' +
              '<div class="fx-side-caption"></div>' +
            '</div>' +
          '</div>' +
          '<div class="fx-strip" role="listbox" aria-label="Frames"></div>' +
          '<div class="fx-gallery" hidden></div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('.diagram-lightbox-close').addEventListener('click', closeAll);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) closeAll();
    });
    wire('.fx-zone-prev', function () { step(-1); });
    wire('.fx-zone-next', function () { step(1); });
    wire('.fx-play', togglePlay);
    wire('.fx-grid-btn', toggleGallery);

    var slider = overlay.querySelector('.fx-speed-slider');
    slider.addEventListener('input', function () {
      st.speed = parseFloat(slider.value) || 1;
      overlay.querySelector('.fx-speed-label').textContent =
        String(st.speed).replace(/^0\./, '.') + 'x';
    });

    // wheel over the stage steps frames (throttled per gesture)
    var wheelLock = 0;
    overlay.querySelector('.fx-stage').addEventListener('wheel', function (e) {
      if (st.mode !== 'frames') return;
      e.preventDefault();
      var now = Date.now();
      if (now - wheelLock < 180) return;
      wheelLock = now;
      step(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });

    document.addEventListener('keydown', function (e) {
      if (!overlay.classList.contains('open')) return;
      if (e.key === 'Escape') {
        if (st.mode === 'gallery') exitGallery(st.frame);
        else closeAll();
      } else if (st.mode === 'frames' || st.mode === 'gallery') {
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
        else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
      }
    });
    return overlay;
  }

  // click handler that also drops focus so the browser's focus ring
  // doesn't appear when the user switches back to keyboard stepping
  function wire(sel, fn) {
    var el = overlay.querySelector(sel);
    el.addEventListener('click', function () { fn(); el.blur(); });
  }

  function q(sel) { return overlay.querySelector(sel); }

  // ── zoom mode (svg / unframed gif) ───────────────────────────
  function openZoom(diagram) {
    var ov = ensureOverlay();
    stopPlay();
    st.mode = 'zoom';
    st.name = gifName(diagram);
    q('.fx').hidden = true;
    q('.diagram-lightbox-panel').style.display = '';
    q('.diagram-lightbox-caption').style.display = '';

    var panel = q('.diagram-lightbox-panel');
    panel.innerHTML = '';
    var content = diagram.querySelector('svg, img');
    if (content) {
      var clone = content.cloneNode(true);
      clone.removeAttribute('width');
      clone.removeAttribute('height');
      if (clone.tagName.toLowerCase() === 'svg') {
        // A viewBox-only SVG has no intrinsic size and collapses inside the
        // flex panel; size it explicitly to fill the available space.
        var vb = (clone.getAttribute('viewBox') || '').trim().split(/[\s,]+/);
        var aspect = (vb.length === 4 && +vb[2] > 0 && +vb[3] > 0) ? (+vb[2] / +vb[3]) : 4 / 3;
        var availW = Math.min(1200, window.innerWidth * 0.95) - 48;
        var availH = window.innerHeight * 0.8 - 44;
        var w = Math.min(availW, availH * aspect);
        clone.style.width = w + 'px';
        clone.style.height = (w / aspect) + 'px';
      }
      panel.appendChild(clone);
    }
    var captionText = figureCaption(diagram);
    var captionEl = q('.diagram-lightbox-caption');
    captionEl.textContent = captionText;
    captionEl.style.display = captionText ? '' : 'none';

    ov.classList.add('open');
    ov.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
  }

  // ── frame mode ───────────────────────────────────────────────
  function enterFrames(name, frameIdx) {
    getManifest(name).then(function (m) {
      if (!m || !m.frames.length) return;
      ensureOverlay();
      st.mode = 'frames';
      st.name = name;
      st.manifest = m;
      // fresh open: playback speed back to normal
      st.speed = 1;
      q('.fx-speed-slider').value = '1';
      q('.fx-speed-label').textContent = '1x';
      q('.diagram-lightbox-panel').style.display = 'none';
      q('.diagram-lightbox-caption').style.display = 'none';
      q('.fx').hidden = false;
      q('.fx-gallery').hidden = true;
      q('.fx-main').hidden = false;
      q('.fx-strip').hidden = false;
      q('.fx-grid-btn').textContent = 'grid';
      q('.fx-side-title').textContent = figureCaption(findDiagram(name)) || m.title;
      buildStrip(m);
      showFrame(Math.max(0, Math.min(frameIdx || 0, m.frames.length - 1)));
      overlay.classList.add('open');
      overlay.setAttribute('aria-hidden', 'false');
      document.body.classList.add('lightbox-open');
    });
  }

  function buildStrip(m) {
    var strip = q('.fx-strip');
    strip.innerHTML = '';
    m.frames.forEach(function (f, i) {
      var b = document.createElement('button');
      b.className = 'fx-thumb';
      b.type = 'button';
      b.setAttribute('role', 'option');
      b.setAttribute('aria-label', 'Frame ' + (i + 1));
      var img = document.createElement('img');
      img.src = f.src;
      img.alt = '';
      img.loading = 'lazy';
      var num = document.createElement('span');
      num.className = 'fx-thumb-num';
      num.textContent = pad2(i + 1);
      b.appendChild(img);
      b.appendChild(num);
      b.addEventListener('click', function () { showFrame(i); b.blur(); });
      strip.appendChild(b);
    });
  }

  function showFrame(i) {
    var m = st.manifest;
    if (!m) return;
    st.frame = i;
    var f = m.frames[i];
    q('.fx-img').src = f.src;
    q('.fx-counter').textContent = pad2(i + 1) + ' / ' + pad2(m.frames.length);
    var cap = q('.fx-side-caption');
    cap.classList.toggle('empty', !f.caption);
    cap.textContent = f.caption || 'no caption for this frame yet';

    var thumbs = q('.fx-strip').children;
    for (var t = 0; t < thumbs.length; t++)
      thumbs[t].classList.toggle('current', t === i);
    if (thumbs[i] && thumbs[i].scrollIntoView)
      thumbs[i].scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });

    // preload neighbours so stepping feels instant
    [i - 1, i + 1].forEach(function (j) {
      if (j >= 0 && j < m.frames.length) { var p = new Image(); p.src = m.frames[j].src; }
    });
    updateHash();
    var cells = q('.fx-gallery').children;
    for (var c = 0; c < cells.length; c++)
      cells[c].classList.toggle('current', c === i);
  }

  function step(d) {
    var m = st.manifest;
    if (!m) return;
    stopPlay();
    showFrame((st.frame + d + m.frames.length) % m.frames.length);
  }

  // ── play/pause at the gif's own cadence, scaled by the slider ──
  function togglePlay() {
    if (st.playing) { stopPlay(); return; }
    if (!st.manifest || st.mode !== 'frames') return;
    st.playing = true;
    var btn = q('.fx-play');
    btn.textContent = 'stop';
    btn.classList.add('playing');
    q('.fx-stage').classList.add('playing');
    tick();
  }
  function tick() {
    if (!st.playing) return;
    var m = st.manifest;
    var delay = (m.frames[st.frame].delay || 100) / st.speed;
    st.playTimer = setTimeout(function () {
      if (!st.playing) return;
      showFrame((st.frame + 1) % m.frames.length);
      tick();
    }, delay);
  }
  function stopPlay() {
    st.playing = false;
    if (st.playTimer) { clearTimeout(st.playTimer); st.playTimer = null; }
    if (overlay) {
      var btn = q('.fx-play');
      btn.textContent = 'play';
      btn.classList.remove('playing');
      q('.fx-stage').classList.remove('playing');
    }
  }

  // ── gallery mode: the grid takes over the whole viewer ───────
  function exitGallery(frameIdx) {
    st.mode = 'frames';
    q('.fx-gallery').hidden = true;
    q('.fx-main').hidden = false;
    q('.fx-strip').hidden = false;
    showFrame(frameIdx);
  }

  function toggleGallery() {
    if (st.mode === 'gallery') { exitGallery(st.frame); return; }
    if (st.mode !== 'frames') return;
    stopPlay();
    st.mode = 'gallery';
    buildGallery(q('.fx-gallery'), st.manifest, exitGallery, st.frame);
    q('.fx-main').hidden = true;
    q('.fx-strip').hidden = true;
    q('.fx-gallery').hidden = false;
  }

  function buildGallery(container, m, onPick, currentIdx) {
    container.innerHTML = '';
    // pick a column count that fits every frame on screen at once
    var cols = m.grid > 0 ? m.grid : Math.ceil(Math.sqrt(m.frames.length));
    container.style.setProperty('--fx-cols', cols);
    container.style.setProperty('--fx-rows', Math.ceil(m.frames.length / cols));
    m.frames.forEach(function (f, i) {
      var cell = document.createElement('div');
      cell.className = 'fx-cell' + (i === currentIdx ? ' current' : '');
      var pic = document.createElement('img');
      pic.src = f.src;
      pic.alt = 'Frame ' + (i + 1);
      pic.loading = 'lazy';
      var meta = document.createElement('div');
      meta.className = 'fx-cell-meta';
      var num = document.createElement('span');
      num.className = 'fx-cell-num';
      num.textContent = pad2(i + 1);
      var txt = document.createElement('span');
      txt.className = 'fx-cell-caption';
      txt.textContent = f.caption || '';
      meta.appendChild(num);
      meta.appendChild(txt);
      cell.appendChild(pic);
      cell.appendChild(meta);
      if (onPick) cell.addEventListener('click', function () { onPick(i); });
      container.appendChild(cell);
    });
  }

  // ── url hash bookmarking (#f=name:N) ─────────────────────────
  function updateHash() {
    if (st.mode !== 'frames' && st.mode !== 'gallery') return;
    var h = '#f=' + st.name + ':' + (st.frame + 1);
    if (location.hash !== h)
      history.replaceState(null, '', location.pathname + location.search + h);
  }
  function clearHash() {
    if (/^#f=/.test(location.hash))
      history.replaceState(null, '', location.pathname + location.search);
  }

  function closeAll() {
    stopPlay();
    clearHash();
    st.mode = 'zoom';
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
  }

  // ── click wiring ─────────────────────────────────────────────
  document.addEventListener('click', function (e) {
    var inlineImg = e.target.closest('.fx-inline .fx-cell');
    if (inlineImg) {
      var host = inlineImg.closest('.fx-inline');
      enterFrames(host.getAttribute('data-name'),
                  [].indexOf.call(host.children, inlineImg));
      return;
    }
    var diagram = e.target.closest('.svg-diagram');
    if (!diagram) return;
    if (e.target.closest('a')) return;
    e.preventDefault();
    var name = gifName(diagram);
    if (name) {
      // GIFs with extracted frames open straight into the frame explorer
      getIndex().then(function (idx) {
        if (idx[name]) enterFrames(name, 0);
        else openZoom(diagram);
      });
    } else {
      openZoom(diagram);
    }
  });

  // ── page-load entries: #f= deep link, ?frames=all reader mode ─
  function boot() {
    // stop native image dragging from eating clicks on diagrams
    document.querySelectorAll('.svg-diagram img').forEach(function (img) {
      img.draggable = false;
    });
    // warm the index so the first diagram click opens without a wait
    if (document.querySelector('.svg-diagram img')) getIndex();
    var m = /^#f=([a-z0-9-]+):(\d+)$/i.exec(location.hash);
    if (m) {
      var name = m[1], idx = parseInt(m[2], 10) - 1;
      var diagram = findDiagram(name);
      if (diagram) diagram.scrollIntoView({ block: 'center' });
      getIndex().then(function (idx2) {
        if (idx2[name]) enterFrames(name, idx);
      });
    }
    if (new URLSearchParams(location.search).get('frames') === 'all') {
      getIndex().then(function (idx3) {
        Object.keys(idx3).forEach(function (name) {
          var diagram = findDiagram(name);
          if (!diagram) return;
          getManifest(name).then(function (mf) {
            if (!mf) return;
            var img = diagram.querySelector('img');
            if (!img) return;
            var gal = document.createElement('div');
            gal.className = 'fx-inline fx-gallery';
            gal.setAttribute('data-name', name);
            buildGallery(gal, mf, null, -1);
            img.replaceWith(gal);
            diagram.classList.add('has-inline-frames');
          });
        });
      });
    }
  }
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
