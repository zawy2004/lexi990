/* Persistent learner state in localStorage. Exposed as Lexi.store. */
(function () {
  'use strict';
  const L = window.Lexi;
  const { dayKey } = L.util;
  const KEY = 'lexi990.v1';

  const DEFAULT_SETTINGS = {
    newPerDay: 15,
    reviewLimit: 200,
    course: ['s600', 's1500', 'sbook'],
    autoplay: true,
    voice: '',
    rate: 0.95,
    direction: 'en-vi', // en-vi | vi-en | mix
    theme: 'auto',
    speakVi: true,
    practiceGoal: 20,
  };

  function fresh() {
    return {
      v: 1,
      created: Date.now(),
      settings: Object.assign({}, DEFAULT_SETTINGS),
      cards: {},   // key -> SRS card
      stats: {},   // key -> { c: correct, w: wrong, t: last wrong ts }
      marks: {},   // key -> 1 (bookmarked)
      log: {},     // 'YYYY-MM-DD' -> { new, rev, quiz, ok, ms }
      tests: [],   // finished mock tests
      draft: null, // test in progress
    };
  }

  let state = fresh();
  let storageOk = true;

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const data = JSON.parse(raw);
        state = Object.assign(fresh(), data);
        state.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings || {});
      }
    } catch (e) {
      storageOk = false;
    }
    return state;
  }

  let timer = null;
  const listeners = [];
  function saveNow() {
    clearTimeout(timer);
    timer = null;
    state.updated = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
    listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } });
  }
  function onSave(fn) { listeners.push(fn); }

  // ---------------------------------------------------------------- multi-device merge
  /** The part of the state that is synced between devices (no UI prefs). */
  function syncable() {
    const s = state;
    return { v: s.v, epoch: s.epoch || 0, created: s.created, updated: s.updated, settings: s.settings, settingsAt: s.settingsAt || 0,
      cards: s.cards, stats: s.stats, marks: s.marks, unmarks: s.unmarks || {}, log: s.log, tests: s.tests,
      draft: s.draft, draftAt: s.draftAt || 0 };
  }

  /**
   * Merge another device's progress into the current state, in place.
   * Rules: newest review wins per word, counters take the max, bookmarks follow the latest
   * mark/unmark, finished tests are unioned. Returns true when anything changed.
   */
  function mergeIn(r) {
    if (!r || typeof r !== 'object' || !r.cards) return false;
    if ((state.epoch || 0) > (r.epoch || 0)) return false; // remote predates a reset/restore here
    if ((r.epoch || 0) > (state.epoch || 0)) {             // reset/restore happened on another device
      const ui = state.ui;
      state = Object.assign(fresh(), r, { ui });
      state.settings = Object.assign({}, DEFAULT_SETTINGS, r.settings || {});
      saveNow();
      return true;
    }
    const before = JSON.stringify(syncable());
    const s = state;
    Object.keys(r.cards).forEach((k) => {
      const a = s.cards[k];
      const b = r.cards[k];
      if (!a || (b.last || 0) > (a.last || 0) || ((b.last || 0) === (a.last || 0) && (b.reps || 0) > (a.reps || 0))) s.cards[k] = b;
    });
    Object.keys(r.stats || {}).forEach((k) => {
      const a = s.stats[k] || { c: 0, w: 0, t: 0 };
      const b = r.stats[k];
      s.stats[k] = { c: Math.max(a.c, b.c || 0), w: Math.max(a.w, b.w || 0), t: Math.max(a.t || 0, b.t || 0) };
    });
    s.unmarks = s.unmarks || {};
    const keys = new Set(Object.keys(s.marks).concat(Object.keys(r.marks || {}), Object.keys(s.unmarks), Object.keys(r.unmarks || {})));
    keys.forEach((k) => {
      const mt = Math.max(+s.marks[k] || 0, +(r.marks || {})[k] || 0);
      const ut = Math.max(+s.unmarks[k] || 0, +(r.unmarks || {})[k] || 0);
      if (mt > ut) { s.marks[k] = mt; delete s.unmarks[k]; } else { delete s.marks[k]; if (ut) s.unmarks[k] = ut; }
    });
    Object.keys(r.log || {}).forEach((d) => {
      const a = s.log[d] || (s.log[d] = { new: 0, rev: 0, quiz: 0, ok: 0, ms: 0 });
      const b = r.log[d];
      Object.keys(a).forEach((f) => { a[f] = Math.max(a[f] || 0, b[f] || 0); });
    });
    const ids = new Set(s.tests.map((t) => t.id));
    (r.tests || []).forEach((t) => { if (!ids.has(t.id)) s.tests.push(t); });
    s.tests.sort((a, b) => a.id - b.id);
    if ((r.draftAt || 0) > (s.draftAt || 0)) { s.draft = r.draft || null; s.draftAt = r.draftAt; }
    if ((r.settingsAt || 0) > (s.settingsAt || 0)) { s.settings = Object.assign({}, DEFAULT_SETTINGS, r.settings); s.settingsAt = r.settingsAt; }
    s.created = Math.min(s.created || Date.now(), r.created || Date.now());
    const changed = JSON.stringify(syncable()) !== before;
    if (changed) saveNow();
    return changed;
  }

  function touchSettings() { state.settingsAt = Date.now(); save(); }
  function touchDraft() { state.draftAt = Date.now(); save(); }

  function setMark(key, on) {
    state.unmarks = state.unmarks || {};
    if (on) { state.marks[key] = Date.now(); delete state.unmarks[key]; }
    else { delete state.marks[key]; state.unmarks[key] = Date.now(); }
    save();
  }

  /** Forget a word's schedule but keep a timestamp so other devices don't bring it back. */
  function resetCard(key) {
    const now = Date.now();
    state.cards[key] = { s: 0, due: now, ivl: 0, ef: 2.5, reps: 0, lapses: 0, step: 0, last: now, seen: 0 };
    save();
  }
  function save() {
    if (timer) return;
    timer = setTimeout(saveNow, 400);
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden && timer) saveNow(); });
  window.addEventListener('pagehide', () => { if (timer) saveNow(); });

  function today() {
    const k = dayKey();
    if (!state.log[k]) state.log[k] = { new: 0, rev: 0, quiz: 0, ok: 0, ms: 0 };
    return state.log[k];
  }

  function bump(field, n) {
    today()[field] += n == null ? 1 : n;
    save();
  }

  function streak() {
    let n = 0;
    const d = new Date();
    const active = (k) => {
      const e = state.log[k];
      return e && (e.new + e.rev + e.quiz) > 0;
    };
    if (!active(dayKey(d))) d.setDate(d.getDate() - 1); // today not done yet: count from yesterday
    while (active(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }

  function recordAnswer(key, ok) {
    const s = state.stats[key] || (state.stats[key] = { c: 0, w: 0, t: 0 });
    if (ok) s.c++; else { s.w++; s.t = Date.now(); }
    save();
  }

  function exportJSON() {
    return JSON.stringify(Object.assign({ app: 'lexi990', exported: new Date().toISOString() }, state), null, 1);
  }

  function importJSON(text) {
    const data = JSON.parse(text);
    if (!data || typeof data !== 'object' || !data.cards || !data.settings) {
      throw new Error('Tệp không phải bản sao lưu của Lexi990.');
    }
    delete data.app; delete data.exported;
    state = Object.assign(fresh(), data);
    state.settings = Object.assign({}, DEFAULT_SETTINGS, data.settings);
    state.epoch = Date.now(); // other synced devices adopt this copy instead of merging
    saveNow();
  }

  function reset() {
    const keepSettings = state.settings;
    state = fresh();
    state.settings = keepSettings;
    state.epoch = Date.now();
    saveNow();
  }

  L.store = {
    load, save, saveNow, today, bump, streak, recordAnswer, exportJSON, importJSON, reset,
    onSave, syncable, mergeIn, touchSettings, touchDraft, setMark, resetCard,
    get state() { return state; },
    get settings() { return state.settings; },
    get ok() { return storageOk; },
    DEFAULT_SETTINGS,
  };
})();
