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
  function saveNow() {
    clearTimeout(timer);
    timer = null;
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
      storageOk = true;
    } catch (e) {
      storageOk = false;
    }
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
    saveNow();
  }

  function reset() {
    const keepSettings = state.settings;
    state = fresh();
    state.settings = keepSettings;
    saveNow();
  }

  L.store = {
    load, save, saveNow, today, bump, streak, recordAnswer, exportJSON, importJSON, reset,
    get state() { return state; },
    get settings() { return state.settings; },
    get ok() { return storageOk; },
    DEFAULT_SETTINGS,
  };
})();
