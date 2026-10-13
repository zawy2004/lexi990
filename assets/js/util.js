/* Small helpers shared by every module. Exposed as Lexi.util. */
(function () {
  'use strict';
  const L = (window.Lexi = window.Lexi || {});

  const MIN = 60 * 1000;
  const DAY = 24 * 60 * MIN;

  const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC[c]);

  const pad = (n) => String(n).padStart(2, '0');
  function dayKey(ts) {
    const d = new Date(ts == null ? Date.now() : ts);
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function startOfDay(ts) {
    const d = new Date(ts == null ? Date.now() : ts);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  const pick = (a) => a[Math.floor(Math.random() * a.length)];

  /** Weighted sampling without replacement. weights: same length as items. */
  function weightedSample(items, weights, n) {
    const pool = items.map((it, i) => ({ it, w: Math.max(0.0001, weights[i]) }));
    const out = [];
    while (out.length < n && pool.length) {
      const total = pool.reduce((s, p) => s + p.w, 0);
      let r = Math.random() * total;
      let k = 0;
      for (; k < pool.length - 1; k++) { r -= pool[k].w; if (r <= 0) break; }
      out.push(pool[k].it);
      pool.splice(k, 1);
    }
    return out;
  }

  /** Lower-case, no Vietnamese diacritics — for accent-insensitive search. */
  function fold(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
  }

  /** Same normalisation as tools/build_data.py word_key(). */
  function normKey(w) {
    return String(w || '').toLowerCase().replace(/’/g, "'").replace(/\s+/g, ' ').trim().replace(/^[ .,;:]+|[ .,;:]+$/g, '');
  }

  /** Normalise a typed answer: case, spacing, punctuation, hyphens. */
  function normAnswer(s) {
    return String(s || '').toLowerCase().replace(/’/g, "'").replace(/[-‐–]/g, ' ')
      .replace(/[^a-z0-9' ]/g, '').replace(/\s+/g, ' ').trim();
  }

  function lev(a, b) {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    return prev[b.length];
  }

  /** Human label for a delay in milliseconds. */
  function fmtDelay(ms) {
    if (ms < 60 * MIN) return Math.max(1, Math.round(ms / MIN)) + ' phút';
    if (ms < DAY) return Math.round(ms / (60 * MIN)) + ' giờ';
    const d = ms / DAY;
    if (d < 30) return Math.round(d) + ' ngày';
    if (d < 365) return Math.round(d / 30) + ' tháng';
    return (d / 365).toFixed(1).replace('.0', '') + ' năm';
  }

  function fmtClock(sec) {
    sec = Math.max(0, Math.round(sec));
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return (h ? h + ':' + pad(m) : m) + ':' + pad(s);
  }

  const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

  function debounce(fn, ms) {
    let t;
    return function () {
      const args = arguments;
      clearTimeout(t);
      t = setTimeout(() => fn.apply(null, args), ms);
    };
  }

  function parseQuery(q) {
    const out = {};
    (q || '').split('&').forEach((p) => {
      if (!p) return;
      const i = p.indexOf('=');
      const k = decodeURIComponent(i < 0 ? p : p.slice(0, i));
      out[k] = i < 0 ? '' : decodeURIComponent(p.slice(i + 1));
    });
    return out;
  }

  function plural(n, word) { return n + ' ' + word; }

  L.util = {
    MIN, DAY, esc, dayKey, startOfDay, shuffle, pick, weightedSample, fold, normKey, normAnswer,
    lev, fmtDelay, fmtClock, WEEKDAYS, debounce, parseQuery, plural,
  };
})();
