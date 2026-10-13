/*
 * In-memory index over the three word lists. The same headword can appear in several
 * sources (e.g. "negotiate"); it is learnt once — progress is keyed by the normalised
 * headword — and its detail view merges everything the sources say about it.
 */
(function () {
  'use strict';
  const L = window.Lexi;
  const { normKey, fold } = L.util;
  const D = window.LEXI_DATA || {};

  const SOURCE_ORDER = ['s1500', 's600', 'sbook'];
  const DETAIL_ORDER = ['sbook', 's1500', 's600'];
  const SOURCE_SHORT = { s1500: '1500 từ', s600: '600 từ', sbook: 'Từ & cụm từ' };

  const sources = {};
  const items = new Map();
  const words = new Map();
  const lessons = new Map();
  let searchList = [];
  let courseCache = null;

  function init() {
    SOURCE_ORDER.forEach((sid) => {
      const s = D[sid];
      if (!s) return;
      sources[sid] = s;
      s.items.forEach((it) => {
        it.src = sid;
        it.key = normKey(it.w);
        items.set(it.id, it);
        let w = words.get(it.key);
        if (!w) words.set(it.key, (w = { key: it.key, items: [] }));
        w.items.push(it);
      });
      s.lessons.forEach((l, i) => {
        l.src = sid;
        l.index = i;
        const keys = [];
        l.ids.forEach((id) => {
          const it = items.get(id);
          if (!it) return;
          it.lesson = l.id;
          if (!keys.includes(it.key)) keys.push(it.key);
        });
        l.keys = keys;
        lessons.set(l.id, l);
      });
      s.groups.forEach((g) => {
        g.src = sid;
        g.lessons.forEach((lid) => { const l = lessons.get(lid); if (l) l.group = g; });
      });
    });
    searchList = Array.from(words.values()).map((w) => ({
      key: w.key,
      fk: fold(w.key),
      fm: fold(w.items.map((i) => i.m || '').join(' ; ')),
    }));
  }

  const cards = () => L.store.state.cards;
  const card = (key) => cards()[key];
  const level = (key) => L.srs.level(cards()[key]);

  function headword(w) {
    const lower = w.items.map((i) => i.w).find((x) => x && x[0] === x[0].toLowerCase());
    return lower || w.items[0].w;
  }

  function entry(key) {
    const w = words.get(key);
    if (!w) return null;
    if (w._e) return w._e;
    const its = w.items.slice().sort((a, b) => DETAIL_ORDER.indexOf(a.src) - DETAIL_ORDER.indexOf(b.src));
    const seenM = new Set();
    const seenE = new Set();
    const e = {
      key,
      w: headword(w),
      ipa: (its.find((i) => i.i) || {}).i || '',
      pos: [],
      meanings: [],
      defs: [],
      examples: [],
      notes: [],
      syn: [], ant: [], rel: [], cmp: [],
      forms: [],
      phrase: its.some((i) => i.k === 'phrase'),
      items: its,
      lessons: its.map((i) => i.lesson).filter(Boolean),
    };
    its.forEach((i) => {
      (i.p || '').split(' ').forEach((p) => { if (p && !e.pos.includes(p)) e.pos.push(p); });
      if (i.m && !seenM.has(fold(i.m))) { seenM.add(fold(i.m)); e.meanings.push({ src: i.src, text: i.m, pos: i.p || '' }); }
      if (i.d) e.defs.push({ src: i.src, text: i.d, pos: i.p || '' });
      const exs = [];
      if (i.e) exs.push([i.e, i.ev || '']);
      (i.x || []).forEach((x) => exs.push(x));
      exs.forEach(([en, vi]) => {
        if (!en || seenE.has(fold(en))) return;
        seenE.add(fold(en));
        e.examples.push({ en, vi, src: i.src });
      });
      if (i.n) e.notes.push(i.n);
      ['s', 'a', 'r', 'c'].forEach((k, idx) => {
        (i[k] || []).forEach((rel) => e[['syn', 'ant', 'rel', 'cmp'][idx]].push({ w: rel[0], pos: rel[1], m: rel[2] }));
      });
      if (i.f) e.forms.push(i.f);
    });
    w._e = e;
    return e;
  }

  /** A short meaning suitable for an answer option. */
  function shortMeaning(key, preferSrc) {
    const e = entry(key);
    if (!e) return '';
    const m = (preferSrc && e.meanings.find((x) => x.src === preferSrc)) || e.meanings[0];
    let t = (m && m.text) || '';
    if (t.length > 70) {
      const cut = t.slice(0, 70).lastIndexOf(',');
      t = cut > 20 ? t.slice(0, cut) : t.slice(0, 68) + '…';
    }
    return t;
  }

  /** Other members of the word family (single words), for word-form questions. */
  function family(key) {
    const e = entry(key);
    if (!e) return [];
    const out = [];
    const add = (w) => {
      w = (w || '').trim().toLowerCase();
      if (!w || w.includes(' ') || w === key || out.includes(w)) return;
      if (!/^[a-z][a-z'-]+$/.test(w)) return;
      out.push(w);
    };
    e.forms.forEach((f) => f.split(',').forEach((part) => add(part.replace(/\(.*?\)/g, ''))));
    e.rel.forEach((r) => r.w.split(' - ').forEach(add));
    return out;
  }

  function search(q, srcFilter) {
    q = (q || '').trim();
    if (!q) return [];
    const nq = normKey(q);
    const fq = fold(q);
    const out = [];
    for (const s of searchList) {
      let score = 0;
      if (s.key === nq) score = 100;
      else if (s.key.startsWith(nq)) score = 80 - Math.min(30, s.key.length - nq.length);
      else if ((' ' + s.key).includes(' ' + nq)) score = 55;
      else if (nq.length > 2 && s.key.includes(nq)) score = 40;
      if (fq.length > 1) {
        const i = s.fm.indexOf(fq);
        if (i >= 0) {
          const segs = s.fm.split(/[;,]/).map((x) => x.replace(/\(.*?\)/g, '').trim());
          let ms = (i === 0 || /[\s,;(]/.test(s.fm[i - 1])) ? 30 : 15;
          if (segs.some((g) => g.startsWith(fq))) ms = 38;
          if (segs.some((g) => g === fq)) ms = 46;
          score = Math.max(score, ms);
        }
      }
      if (!score) continue;
      if (srcFilter && !words.get(s.key).items.some((i) => i.src === srcFilter)) continue;
      out.push({ key: s.key, score });
    }
    out.sort((a, b) => b.score - a.score || a.key.length - b.key.length || a.key.localeCompare(b.key));
    return out.slice(0, 80).map((o) => o.key);
  }

  function courseKeys() {
    const order = L.store.settings.course.join(',');
    if (courseCache && courseCache.order === order) return courseCache.keys;
    const keys = [];
    const seen = new Set();
    L.store.settings.course.forEach((sid) => {
      const s = sources[sid];
      if (!s) return;
      s.lessons.forEach((l) => l.keys.forEach((k) => { if (!seen.has(k)) { seen.add(k); keys.push(k); } }));
    });
    courseCache = { order, keys };
    return keys;
  }

  function isNew(key) {
    const c = card(key);
    return !c || c.s === 0;
  }

  function nextNew(n, exclude) {
    const out = [];
    for (const k of courseKeys()) {
      if (out.length >= n) break;
      if (isNew(k) && !(exclude && exclude.has(k))) out.push(k);
    }
    return out;
  }

  function dueKeys(now, within) {
    const cs = cards();
    const limit = now + (within || 0);
    return Object.keys(cs)
      .filter((k) => cs[k].s > 0 && cs[k].due <= limit && words.has(k))
      .sort((a, b) => cs[a].due - cs[b].due);
  }

  function lessonProgress(l) {
    const n = [0, 0, 0, 0];
    l.keys.forEach((k) => n[level(k)]++);
    return { total: l.keys.length, levels: n, started: n[1] + n[2] + n[3], known: n[2] + n[3] };
  }

  /** First lesson along the course that still has unseen words. */
  function currentLesson() {
    for (const sid of L.store.settings.course) {
      const s = sources[sid];
      if (!s) continue;
      for (const l of s.lessons) {
        const lesson = lessons.get(l.id);
        if (lesson.keys.some(isNew)) return lesson;
      }
    }
    return null;
  }

  function totals() {
    const n = [0, 0, 0, 0];
    words.forEach((w) => n[level(w.key)]++);
    return { total: words.size, levels: n };
  }

  function sourceTotals(sid) {
    const s = sources[sid];
    const keys = new Set(s.items.map((i) => i.key));
    const n = [0, 0, 0, 0];
    keys.forEach((k) => n[level(k)]++);
    return { total: keys.size, levels: n };
  }

  L.lex = {
    init, entry, shortMeaning, family, search, courseKeys, nextNew, dueKeys, lessonProgress, currentLesson,
    totals, sourceTotals, card, level, isNew,
    sources, items, words, lessons, SOURCE_ORDER, SOURCE_SHORT,
    invalidateCourse() { courseCache = null; },
  };
})();
