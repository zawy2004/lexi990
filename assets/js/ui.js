/* Shared UI pieces: icons, toast, bubble strips, word snippets. Exposed as Lexi.ui. */
(function () {
  'use strict';
  const L = window.Lexi;
  const { esc } = L.util;

  const P = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M10 21v-6h4v6"/>',
    book: '<path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M4 21.5V4.5"/><path d="M8 7h8"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
    sheet: '<rect x="4" y="2.5" width="16" height="19" rx="2"/><circle cx="9" cy="8" r="1.6"/><circle cx="15" cy="8" r="1.6" fill="currentColor"/><circle cx="9" cy="13" r="1.6" fill="currentColor"/><circle cx="15" cy="13" r="1.6"/><path d="M8 18h8"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    gear: '<path d="M4 6h10M18 6h2M4 12h3M11 12h9M4 18h12M20 18h0"/><circle cx="16" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="18" cy="18" r="2"/>',
    speaker: '<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6"/><path d="M18 6.5a7.5 7.5 0 0 1 0 11"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    next: '<path d="M9 5l7 7-7 7"/>',
    star: '<path d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z"/>',
    play: '<path d="M7 4.5v15l12-7.5z"/>',
    stop: '<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
    up: '<path d="M6 14l6-6 6 6"/>',
    down: '<path d="M6 10l6 6 6-6"/>',
    grid: '<circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>',
  };

  function icon(name, extra) {
    const fill = name === 'play' || name === 'stop' ? 'currentColor' : 'none';
    return '<svg viewBox="0 0 24 24" fill="' + fill + '" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || '') + '>' + (P[name] || '') + '</svg>';
  }

  function fillIcons(root) {
    (root || document).querySelectorAll('[data-icon]').forEach((el) => {
      if (el.dataset.iconDone) return;
      el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon));
      el.dataset.iconDone = '1';
    });
  }

  let toastTimer;
  function toast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
  }

  const bub = (level, cls) => '<i class="bub l' + (level || 0) + (cls ? ' ' + cls : '') + '" aria-hidden="true"></i>';

  /** One bubble per word in a lesson: empty new, dot learning, half known, full mastered. */
  function dots(keys) {
    return '<span class="dots" aria-hidden="true">' + keys.map((k) => bub(L.lex.level(k))).join('') + '</span>';
  }

  /** n bubbles with the first `filled` marked. */
  function meter(n, filled, cls) {
    let s = '<span class="dots" aria-hidden="true">';
    for (let i = 0; i < n; i++) s += bub(i < filled ? 3 : 0, cls);
    return s + '</span>';
  }

  function speakBtn(text, small, label) {
    if (!L.speech.supported || !text) return '';
    return '<button type="button" class="speak' + (small ? ' sm' : '') + '" data-say="' + esc(text) + '" aria-label="' + esc(label || 'Nghe phát âm') + '">' + icon('speaker') + '</button>';
  }

  /** Example sentence with the headword highlighted. */
  function exampleHtml(word, en) {
    const loc = L.quiz.locate(word, en);
    if (!loc) return esc(en);
    return esc(en.slice(0, loc.start)) + '<mark>' + esc(en.slice(loc.start, loc.end)) + '</mark>' + esc(en.slice(loc.end));
  }

  function posLabel(pos) {
    return pos && pos.length ? '<span class="pos">' + esc(Array.isArray(pos) ? pos.join(', ') : pos) + '</span>' : '';
  }

  const legend = () =>
    '<div class="legend">' +
    ['Chưa học', 'Đang học', 'Đã nhớ', 'Thuộc lòng'].map((t, i) => '<span>' + bub(i) + t + '</span>').join('') +
    '</div>';

  function srcTag(sid) {
    return '<span class="tag">' + esc(L.lex.SOURCE_SHORT[sid] || sid) + '</span>';
  }

  /** Inline two-step confirmation instead of a blocking dialog. */
  function armConfirm(btn, label, onConfirm) {
    btn.addEventListener('click', () => {
      if (btn.dataset.armed) { delete btn.dataset.armed; onConfirm(); return; }
      btn.dataset.armed = '1';
      const old = btn.textContent;
      btn.textContent = label;
      setTimeout(() => { if (btn.dataset.armed) { delete btn.dataset.armed; btn.textContent = old; } }, 4000);
    });
  }

  function setTitle(t) { document.title = (t ? t + ' – ' : '') + 'Lexi990'; }

  L.ui = { icon, fillIcons, toast, bub, dots, meter, speakBtn, exampleHtml, posLabel, legend, srcTag, armConfirm, setTitle };
  L.views = L.views || {};
})();
