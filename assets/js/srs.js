/*
 * Spaced repetition scheduler (SM-2 family with learning steps, like Anki).
 *
 * card = { s, due, ivl, ef, reps, lapses, step, last, seen }
 *   s: 0 new, 1 learning, 2 review, 3 relearning
 *   ivl: current interval in days (review cards), ef: ease factor
 * rating: 1 Quên (again), 2 Khó (hard), 3 Nhớ (good), 4 Dễ (easy)
 */
(function () {
  'use strict';
  const L = window.Lexi;
  const { MIN, DAY } = L.util;

  const LEARN = [1 * MIN, 10 * MIN];
  const RELEARN = [10 * MIN];
  const MASTERED_DAYS = 21;

  function blank(now) {
    return { s: 0, due: now, ivl: 0, ef: 2.5, reps: 0, lapses: 0, step: 0, last: 0, seen: 0 };
  }

  function fuzz(days, random) {
    if (!random || days < 3) return Math.round(days);
    return Math.round(days * (0.95 + Math.random() * 0.1));
  }

  function graduate(c, days, now) {
    c.s = 2; c.step = 0; c.ivl = days; c.due = now + days * DAY;
  }

  function schedule(card, rating, now, random) {
    if (random === undefined) random = true;
    const c = Object.assign(blank(now), card || {});
    c.reps++;
    c.last = now;
    if (c.s === 0) c.seen = now;

    if (c.s === 0 || c.s === 1) {
      c.s = 1;
      if (rating === 1) {
        c.step = 0; c.due = now + LEARN[0];
      } else if (rating === 2) {
        const a = LEARN[c.step] || LEARN[0];
        const b = LEARN[c.step + 1] || a;
        c.due = now + (a + b) / 2;
      } else if (rating === 3) {
        c.step++;
        if (c.step >= LEARN.length) graduate(c, 1, now);
        else c.due = now + LEARN[c.step];
      } else {
        graduate(c, 4, now);
        c.ef += 0.15;
      }
    } else if (c.s === 2) {
      const overdue = Math.max(0, (now - c.due) / DAY);
      if (rating === 1) {
        c.lapses++;
        c.ef = Math.max(1.3, c.ef - 0.2);
        c.ivl = Math.max(1, Math.round(c.ivl * 0.4));
        c.s = 3; c.step = 0; c.due = now + RELEARN[0];
      } else {
        let ivl;
        if (rating === 2) { ivl = c.ivl * 1.2; c.ef = Math.max(1.3, c.ef - 0.15); }
        else if (rating === 3) ivl = (c.ivl + overdue / 2) * c.ef;
        else { ivl = (c.ivl + overdue) * c.ef * 1.3; c.ef += 0.15; }
        c.ivl = Math.min(3650, fuzz(Math.max(c.ivl + 1, ivl), random));
        c.due = now + c.ivl * DAY;
      }
    } else { // relearning
      if (rating === 1) c.due = now + RELEARN[0];
      else { c.s = 2; if (rating === 4) c.ivl += 1; c.due = now + c.ivl * DAY; }
    }
    return c;
  }

  /** Delay (ms) each rating would give, for button labels. */
  function preview(card, now) {
    const out = {};
    [1, 2, 3, 4].forEach((r) => { out[r] = schedule(card, r, now, false).due - now; });
    return out;
  }

  /** 0 new · 1 learning · 2 known (reviewing) · 3 mastered */
  function level(card) {
    if (!card || card.s === 0) return 0;
    if (card.s === 2) return card.ivl >= MASTERED_DAYS ? 3 : 2;
    return 1;
  }

  const LEVEL_NAMES = ['Chưa học', 'Đang học', 'Đã nhớ', 'Thuộc lòng'];

  L.srs = { blank, schedule, preview, level, LEVEL_NAMES, MASTERED_DAYS, LEARN };
})();
