// Pandoc-style math renderer for KaTeX.
// Replaces KaTeX's naive auto-render with rules that don't false-positive on
// prose like "I paid $5 and got $3 back". Rules:
//   • $$...$$ and \[...\]  -> always display math
//   • \(...\)              -> always inline math
//   • $...$                -> inline ONLY if the opening $ has no space after,
//                            the closing $ has no space before, and the closing
//                            $ is not immediately followed by a digit
//                            (matches Pandoc / Markdown+TeX behaviour)
(function () {
  var IGNORED = { SCRIPT:1, NOSCRIPT:1, STYLE:1, TEXTAREA:1, PRE:1, CODE:1, OPTION:1, KBD:1 };

  function isDigit(c) { return c >= '0' && c <= '9'; }
  function isSpace(c) { return c === ' ' || c === '\t' || c === '\n' || c === '\r'; }

  // Find one math segment starting at or after `from`.
  // Returns {start, end, body, display} or null.
  function findOne(text, from) {
    for (var i = from; i < text.length; i++) {
      var c = text[i];

      if (c === '$' && text[i + 1] === '$') {
        var close = text.indexOf('$$', i + 2);
        if (close === -1) return null;
        return { start: i, end: close + 2, body: text.slice(i + 2, close), display: true };
      }

      if (c === '\\' && text[i + 1] === '[') {
        var close2 = text.indexOf('\\]', i + 2);
        if (close2 === -1) continue;
        return { start: i, end: close2 + 2, body: text.slice(i + 2, close2), display: true };
      }

      if (c === '\\' && text[i + 1] === '(') {
        var close3 = text.indexOf('\\)', i + 2);
        if (close3 === -1) continue;
        return { start: i, end: close3 + 2, body: text.slice(i + 2, close3), display: false };
      }

      if (c === '$') {
        var next = text[i + 1];
        if (next === undefined || isSpace(next)) continue;

        var j = i + 1;
        while (j < text.length) {
          var k = text.indexOf('$', j);
          if (k === -1) break;
          if (text[k - 1] === '\\') { j = k + 1; continue; }
          var before = text[k - 1];
          var after  = text[k + 1];
          if (isSpace(before)) { j = k + 1; continue; }
          if (after !== undefined && isDigit(after)) { j = k + 1; continue; }
          return { start: i, end: k + 1, body: text.slice(i + 1, k), display: false };
        }
      }
    }
    return null;
  }

  function findAll(text) {
    var out = [], cur = 0, hit;
    while ((hit = findOne(text, cur))) {
      out.push(hit);
      cur = hit.end;
    }
    return out;
  }

  function renderTextNode(node) {
    var text = node.nodeValue;
    if (text.indexOf('$') < 0 && text.indexOf('\\(') < 0 && text.indexOf('\\[') < 0) return;

    var matches = findAll(text);
    if (!matches.length) return;

    var frag = document.createDocumentFragment();
    var cursor = 0;
    for (var i = 0; i < matches.length; i++) {
      var m = matches[i];
      if (m.start > cursor) frag.appendChild(document.createTextNode(text.slice(cursor, m.start)));
      var host = document.createElement(m.display ? 'div' : 'span');
      if (m.display) host.className = 'katex-block';
      try {
        window.katex.render(m.body, host, { displayMode: m.display, throwOnError: false });
      } catch (e) {
        host.textContent = text.slice(m.start, m.end);
      }
      frag.appendChild(host);
      cursor = m.end;
    }
    if (cursor < text.length) frag.appendChild(document.createTextNode(text.slice(cursor)));
    node.parentNode.replaceChild(frag, node);
  }

  function walk(root) {
    var stack = [root];
    while (stack.length) {
      var node = stack.pop();
      var child = node.firstChild;
      while (child) {
        var nx = child.nextSibling;
        if (child.nodeType === 3) {
          renderTextNode(child);
        } else if (child.nodeType === 1 && !IGNORED[child.tagName] && !child.classList.contains('no-math')) {
          stack.push(child);
        }
        child = nx;
      }
    }
  }

  function go() {
    if (typeof window.katex === 'undefined') { setTimeout(go, 30); return; }
    var main = document.getElementById('main') || document.body;
    walk(main);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
  else go();
})();
