/*
 * Question generator for practice sessions. Picks words weighted by how often they were
 * missed, chooses plausible distractors (same lesson, same part of speech, look-alike
 * spellings, word-family forms for sentence gaps) and builds 7 kinds of questions.
 */
(function () {
  'use strict';
  const L = window.Lexi;
  const U = L.util;

  const MODES = {
    mix: { name: 'Trộn thông minh', desc: 'Kết hợp các dạng bên dưới, ưu tiên từ bạn hay sai.' },
    meaning: { name: 'Chọn nghĩa', desc: 'Xem từ tiếng Anh, chọn nghĩa tiếng Việt.' },
    reverse: { name: 'Chọn từ', desc: 'Xem nghĩa tiếng Việt, chọn từ tiếng Anh.' },
    cloze: { name: 'Điền vào câu', desc: 'Chọn từ còn thiếu trong câu ví dụ, như Part 5.' },
    listen: { name: 'Nghe chọn nghĩa', desc: 'Nghe phát âm, chọn nghĩa đúng.', tts: true },
    spell: { name: 'Viết từ', desc: 'Xem nghĩa, gõ lại từ tiếng Anh.' },
    dictation: { name: 'Nghe và viết', desc: 'Nghe từ, gõ đúng chính tả.', tts: true },
    synonym: { name: 'Đồng nghĩa, trái nghĩa', desc: 'Dùng dữ liệu đồng/trái nghĩa của sách Từ & cụm từ.' },
  };
  const MIX_WEIGHTS = { meaning: 3, reverse: 2, cloze: 3, listen: 1.5, spell: 1, dictation: 1, synonym: 1.5 };
  const LETTERS = ['A', 'B', 'C', 'D'];

  const lex = () => L.lex;
  const entry = (k) => L.lex.entry(k);

  // ------------------------------------------------------------ scope
  function scopeKeys(scope) {
    const st = L.store.state;
    const all = Array.from(lex().words.keys());
    if (!scope || scope === 'learned') return all.filter((k) => st.cards[k] && st.cards[k].s > 0);
    if (scope === 'all') return all;
    if (scope === 'weak') return weakKeys(60);
    if (scope === 'today') {
      const sod = U.startOfDay();
      return Object.keys(st.cards).filter((k) => st.cards[k].last >= sod && lex().words.has(k));
    }
    if (scope.startsWith('keys:')) return scope.slice(5).split('|').filter((k) => lex().words.has(k));
    if (scope === 'marked') return Object.keys(st.marks).filter((k) => lex().words.has(k));
    if (scope.startsWith('src:')) {
      const s = lex().sources[scope.slice(4)];
      return s ? Array.from(new Set(s.items.map((i) => i.key))) : [];
    }
    if (scope.startsWith('lesson:')) {
      const l = lex().lessons.get(scope.slice(7));
      return l ? l.keys.slice() : [];
    }
    return all;
  }

  function weakness(key) {
    const s = L.store.state.stats[key];
    const c = L.store.state.cards[key];
    let w = 1;
    if (s) {
      w += 4 * ((s.w + 0.5) / (s.c + s.w + 1)) - 2 / 3;
      if (s.t && Date.now() - s.t < 3 * U.DAY) w += 1;
    }
    if (c) {
      w += Math.min(3, c.lapses * 0.7);
      if (c.s === 1 || c.s === 3) w += 0.5;
      if (c.ef < 2) w += 0.5;
    }
    return Math.max(0.2, w);
  }

  function weakKeys(n) {
    const st = L.store.state;
    const keys = Object.keys(st.stats).filter((k) => st.stats[k].w > 0 && lex().words.has(k));
    Object.keys(st.cards).forEach((k) => { if (st.cards[k].lapses > 0 && !keys.includes(k)) keys.push(k); });
    return keys.sort((a, b) => weakness(b) - weakness(a)).slice(0, n || 50);
  }

  // ------------------------------------------------------------ helpers
  const TYPEABLE = /^[a-z][a-z' -]*[a-z]$/i;
  function typeable(w) {
    return TYPEABLE.test(w) && w.length <= 24 && w.split(' ').length <= 3 && !/\b(sb|sth|one's)\b/i.test(w);
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  const SHORT = new Set(['a', 'an', 'the', 'to', 'of', 'in', 'on', 'at', 'by', 'for', 'up', 'out', 'off', 'be', 'as', 'or', 'and', 'with', 'from', 'into', 'over', 'down']);

  function tokenPattern(t) {
    if (t.length <= 2 || SHORT.has(t)) return escapeRe(t);
    const last = t.slice(-1);
    if (/e$/.test(t) && !/ee$/.test(t)) return escapeRe(t.slice(0, -1)) + '(?:e|es|ed|ing|er|ers|ion|ions)?';
    if (/[^aeiou]y$/.test(t)) return escapeRe(t.slice(0, -1)) + '(?:y|ies|ied|ying)';
    return escapeRe(t) + '(?:' + escapeRe(last) + '?(?:ed|ing)|s|es|er|ers)?';
  }

  /** Find the headword (in any simple inflection) inside a sentence. */
  function locate(word, sentence) {
    const base = word.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[[\]~…]/g, ' ').trim();
    if (!base || /\b(sb|sth|somebody|something|one's)\b/.test(base)) return null;
    const toks = base.split(/\s+/);
    if (toks.length > 4) return null;
    const re = new RegExp('(^|[^A-Za-z])(' + toks.map(tokenPattern).join("[\\s-]+") + ')(?![A-Za-z])', 'i');
    const m = re.exec(sentence);
    if (!m) return null;
    const start = m.index + m[1].length;
    return { start, end: start + m[2].length, text: m[2] };
  }

  function suffixOf(base, surface) {
    base = base.toLowerCase(); surface = surface.toLowerCase();
    if (surface === base) return '';
    if (surface.startsWith(base)) return surface.slice(base.length).replace(/^(.)\1?(ed|ing)$/, '$2');
    if (/e$/.test(base) && surface.startsWith(base.slice(0, -1))) return surface.slice(base.length - 1);
    if (/y$/.test(base) && surface.startsWith(base.slice(0, -1))) return surface.slice(base.length - 1).replace(/^ie/, 'e');
    return null;
  }

  function applySuffix(w, suf) {
    if (!suf || w.includes(' ')) return w;
    if (suf === 'ing') return /[^e]e$/.test(w) ? w.slice(0, -1) + 'ing' : w + 'ing';
    if (suf === 'ed' || suf === 'd') {
      if (/e$/.test(w)) return w + 'd';
      if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ied';
      return w + 'ed';
    }
    if (suf === 's' || suf === 'es') {
      if (/(s|x|z|ch|sh)$/.test(w)) return w + 'es';
      if (/[^aeiou]y$/.test(w)) return w.slice(0, -1) + 'ies';
      return w + 's';
    }
    return null;
  }

  function samePos(a, b) {
    const pa = entry(a).pos;
    const pb = entry(b).pos;
    if (!pa.length || !pb.length) return true;
    return pa.some((p) => pb.includes(p));
  }

  /** Candidate distractor keys, nearest first: same lesson, then same source + part of speech. */
  function neighbours(key, accept) {
    const e = entry(key);
    const out = [];
    const seen = new Set([key]);
    const take = (list, max) => {
      let n = 0;
      for (const k of U.shuffle(list.slice())) {
        if (n >= max) break;
        if (seen.has(k) || !accept(k)) continue;
        seen.add(k); out.push(k); n++;
      }
    };
    e.lessons.forEach((lid) => { const l = lex().lessons.get(lid); if (l) take(l.keys, 2); });
    const src = e.items[0].src;
    const pool = Array.from(new Set(lex().sources[src].items.map((i) => i.key)));
    take(pool.filter((k) => samePos(key, k)), 8);
    take(Array.from(lex().words.keys()), 8);
    return out;
  }

  function optionSet(answer, distractors) {
    const opts = U.shuffle([answer].concat(distractors.slice(0, 3)));
    return { options: opts, answer: opts.indexOf(answer) };
  }

  // ------------------------------------------------------------ question builders
  const builders = {
    meaning(key) {
      const e = entry(key);
      const ans = L.lex.shortMeaning(key);
      if (!ans) return null;
      const fa = U.fold(ans);
      const ds = neighbours(key, (k) => {
        const m = U.fold(L.lex.shortMeaning(k));
        return m && m !== fa && !m.startsWith(fa.slice(0, 8));
      }).map((k) => L.lex.shortMeaning(k));
      if (ds.length < 3) return null;
      return Object.assign({ key, mode: 'meaning', ask: 'Nghĩa của từ này là gì?', show: { word: e.w, ipa: e.ipa, pos: e.pos.join(', ') }, speak: e.w }, optionSet(ans, ds));
    },
    listen(key) {
      if (!L.speech.supported) return null;
      const q = builders.meaning(key);
      if (!q) return null;
      return Object.assign(q, { mode: 'listen', ask: 'Nghe và chọn nghĩa đúng.', show: { audio: true }, autoplay: true });
    },
    reverse(key) {
      const e = entry(key);
      const m = L.lex.shortMeaning(key);
      if (!m) return null;
      const fm = U.fold(m);
      const accept = (k) => U.fold(L.lex.shortMeaning(k)) !== fm;
      const all = Array.from(L.lex.words.keys());
      const look = all.filter((k) => k !== key && Math.abs(k.length - key.length) <= 2 && k[0] === key[0] && U.lev(k, key) <= Math.max(2, Math.floor(key.length / 4)) && accept(k));
      const ds = U.shuffle(look).slice(0, 1).concat(neighbours(key, (k) => accept(k) && !look.includes(k)));
      const words = ds.map((k) => entry(k).w);
      if (words.length < 3) return null;
      return Object.assign({ key, mode: 'reverse', ask: 'Từ tiếng Anh nào mang nghĩa này?', show: { vi: m, pos: e.pos.join(', ') }, optWords: true }, optionSet(e.w, words));
    },
    cloze(key) {
      const e = entry(key);
      for (const ex of U.shuffle(e.examples.slice())) {
        const loc = locate(e.w, ex.en);
        if (!loc) continue;
        const surface = loc.text;
        const isCap = /^[A-Z]/.test(surface) && loc.start === 0;
        const norm = (w) => (isCap ? w.charAt(0).toUpperCase() + w.slice(1) : w);
        const suf = suffixOf(e.w, surface);
        const fam = L.lex.family(key).filter((w) => w !== surface.toLowerCase()).slice(0, 2);
        const ds = fam.map(norm);
        neighbours(key, (k) => samePos(key, k) && !k.includes(' ') === !e.w.includes(' ')).some((k) => {
          let w = entry(k).w;
          if (suf) w = applySuffix(w, suf);
          if (w && !ds.includes(norm(w)) && norm(w).toLowerCase() !== surface.toLowerCase()) ds.push(norm(w));
          return ds.length >= 3;
        });
        if (ds.length < 3) continue;
        return Object.assign({
          key, mode: 'cloze', ask: 'Chọn từ phù hợp nhất để điền vào chỗ trống.',
          show: { before: ex.en.slice(0, loc.start), after: ex.en.slice(loc.end), vi: ex.vi },
          optWords: true, explain: ex,
        }, optionSet(surface, ds));
      }
      return null;
    },
    spell(key) {
      const e = entry(key);
      if (!typeable(e.w)) return null;
      const m = L.lex.shortMeaning(key);
      const hint = e.w.split(' ').map((t) => t[0] + '·'.repeat(t.length - 1)).join(' ');
      return { key, mode: 'spell', ask: 'Gõ từ tiếng Anh có nghĩa sau.', show: { vi: m, pos: e.pos.join(', '), hint }, typed: true, expect: e.w };
    },
    dictation(key) {
      if (!L.speech.supported) return null;
      const e = entry(key);
      if (!typeable(e.w)) return null;
      return { key, mode: 'dictation', ask: 'Nghe và gõ lại từ bạn nghe được.', show: { audio: true }, typed: true, expect: e.w, speak: e.w, autoplay: true };
    },
    synonym(key) {
      const e = entry(key);
      const lists = [];
      if (e.syn.length) lists.push(['syn', e.syn]);
      if (e.ant.length) lists.push(['ant', e.ant]);
      if (!lists.length) return null;
      const [kind, rel] = U.pick(lists);
      const pool = [];
      rel.forEach((r) => r.w.split(' - ').forEach((w) => { w = w.trim(); if (w && w.length < 28) pool.push(w); }));
      if (!pool.length) return null;
      const ans = U.pick(pool);
      const banned = new Set(e.syn.concat(e.ant).flatMap((r) => r.w.split(' - ').map((w) => w.trim().toLowerCase())));
      banned.add(e.w.toLowerCase());
      const ds = neighbours(key, (k) => !banned.has(k) && samePos(key, k)).map((k) => entry(k).w);
      if (ds.length < 3) return null;
      return Object.assign({
        key, mode: 'synonym', ask: kind === 'syn' ? 'Từ nào gần nghĩa nhất với từ này?' : 'Từ nào trái nghĩa với từ này?',
        show: { word: e.w, ipa: e.ipa, pos: e.pos.join(', ') }, optWords: true, speak: e.w,
      }, optionSet(ans, ds));
    },
  };

  function makeQuestion(key, mode) {
    if (mode !== 'mix') return builders[mode] ? builders[mode](key) : null;
    const modes = Object.keys(MIX_WEIGHTS).filter((m) => !(MODES[m].tts && !L.speech.supported));
    const order = U.weightedSample(modes, modes.map((m) => MIX_WEIGHTS[m]), modes.length);
    for (const m of order) {
      const q = builders[m](key);
      if (q) return q;
    }
    return null;
  }

  /** Build up to n questions from the keys in scope. */
  function build(scope, mode, n) {
    const keys = scopeKeys(scope);
    if (keys.length < 4) return { questions: [], reason: 'few', available: keys.length };
    const ordered = U.weightedSample(keys, keys.map(weakness), Math.min(keys.length, n * 3));
    const questions = [];
    for (const k of ordered) {
      if (questions.length >= n) break;
      const q = makeQuestion(k, mode);
      if (q) questions.push(q);
    }
    return { questions, reason: questions.length ? '' : 'none', available: keys.length };
  }

  function checkTyped(q, typed) {
    const a = U.normAnswer(typed);
    const b = U.normAnswer(q.expect);
    if (a === b) return 'ok';
    if (b.length >= 5 && U.lev(a, b) === 1) return 'close';
    return 'bad';
  }

  L.quiz = { MODES, LETTERS, build, scopeKeys, weakKeys, weakness, checkTyped, locate };
})();
