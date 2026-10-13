/* "Luyện tập": choose a question type and scope (#/practice), then answer (#/quiz?...). */
(function () {
  'use strict';
  const L = window.Lexi;
  const U = L.util;
  const { esc } = U;

  function scopes() {
    const list = [
      ['learned', 'Từ đã học'],
      ['today', 'Học hôm nay'],
      ['weak', 'Từ hay sai'],
      ['marked', 'Đã đánh dấu'],
      ['src:s1500', 'Cả bộ 1500 từ'],
      ['src:s600', 'Cả bộ 600 từ'],
      ['src:sbook', 'Cả sách Từ & cụm từ'],
    ];
    return list.map(([id, name]) => ({ id, name, n: L.quiz.scopeKeys(id).length }));
  }

  L.views.practice = {
    nav: 'practice',
    render(root) {
      L.ui.setTitle('Luyện tập');
      const ui = L.store.state.ui || (L.store.state.ui = {});
      const sc = scopes();
      let mode = ui.qMode || 'mix';
      let scope = ui.qScope || (sc[0].n >= 4 ? 'learned' : 'src:s600');
      let n = ui.qN || 20;

      function draw() {
        const modes = Object.keys(L.quiz.MODES);
        const scList = sc.slice();
        const lessonOpts = L.lex.SOURCE_ORDER.map((sid) => '<optgroup label="' + esc(L.lex.sources[sid].short) + '">' +
          L.lex.sources[sid].lessons.map((l) => '<option value="lesson:' + esc(l.id) + '"' + (scope === 'lesson:' + l.id ? ' selected' : '') + '>' + esc(l.title) + (l.sub ? ' – ' + esc(l.sub) : '') + '</option>').join('') +
          '</optgroup>').join('');
        const cur = scList.find((s) => s.id === scope);
        const avail = cur ? cur.n : L.quiz.scopeKeys(scope).length;
        root.innerHTML =
          '<h1 class="h1">Luyện tập</h1><p class="lead">Câu hỏi được tạo từ chính dữ liệu của 3 bộ sách. Từ bạn trả lời sai sẽ được hỏi lại nhiều hơn và đưa vào hàng ôn.</p>' +
          '<h2 class="h2">Dạng câu hỏi</h2><div class="rows mode-list" role="radiogroup" style="margin:10px 0 28px">' +
          modes.map((m, i) => {
            const info = L.quiz.MODES[m];
            const off = info.tts && !L.speech.supported;
            return '<button class="row' + (m === mode ? ' on' : '') + (off ? ' off' : '') + '" role="radio" aria-checked="' + (m === mode) + '" data-mode="' + m + '"' + (off ? ' disabled' : '') + '>' +
              '<span class="obub"><span>' + String.fromCharCode(65 + i) + '</span></span><span class="row-main"><span class="row-title">' + esc(info.name) + '</span>' +
              '<span class="row-sub" style="display:block">' + esc(off ? 'Trình duyệt này không có giọng đọc.' : info.desc) + '</span></span></button>';
          }).join('') + '</div>' +
          '<h2 class="h2">Phạm vi</h2><div class="chips" style="margin:10px 0 12px">' +
          scList.map((s) => '<button class="chip' + (s.id === scope ? ' on' : '') + '" data-scope="' + s.id + '"' + (s.n < 4 ? ' disabled style="opacity:.5"' : '') + '>' + esc(s.name) + ' <span class="muted num">' + s.n + '</span></button>').join('') +
          '</div><div class="field"><label for="lesson-pick">Hoặc chọn một bài</label><select id="lesson-pick"><option value="">Chọn bài…</option>' + lessonOpts + '</select></div>' +
          '<h2 class="h2">Số câu</h2><div class="seg" style="margin:10px 0 24px">' + [10, 20, 30, 50].map((x) => '<button class="' + (x === n ? 'on' : '') + '" data-n="' + x + '">' + x + '</button>').join('') + '</div>' +
          '<div class="btn-row"><button class="btn" data-act="start"' + (avail < 4 ? ' disabled' : '') + '>Bắt đầu</button><span class="small muted">' +
          (avail < 4 ? 'Cần ít nhất 4 từ trong phạm vi này. Hãy học thêm hoặc chọn phạm vi khác.' : avail + ' từ trong phạm vi') + '</span></div>';
      }
      draw();

      root.addEventListener('click', (e) => {
        const m = e.target.closest('[data-mode]');
        if (m) { mode = m.dataset.mode; draw(); return; }
        const s = e.target.closest('[data-scope]');
        if (s) { scope = s.dataset.scope; draw(); return; }
        const k = e.target.closest('[data-n]');
        if (k) { n = +k.dataset.n; draw(); return; }
        if (e.target.closest('[data-act="start"]')) {
          Object.assign(ui, { qMode: mode, qScope: scope, qN: n });
          L.store.save();
          location.hash = '#/quiz?mode=' + mode + '&scope=' + encodeURIComponent(scope) + '&n=' + n;
        }
      });
      root.addEventListener('change', (e) => {
        if (e.target.id === 'lesson-pick' && e.target.value) { scope = e.target.value; draw(); }
      });
    },
  };

  // ------------------------------------------------------------ runner
  L.views.quiz = {
    nav: 'practice',
    focus: true,
    render(root, ctx) {
      L.ui.setTitle('Luyện tập');
      const mode = L.quiz.MODES[ctx.query.mode] ? ctx.query.mode : 'mix';
      const scope = ctx.query.scope || 'learned';
      const n = Math.min(100, Math.max(1, parseInt(ctx.query.n, 10) || 20));
      const built = L.quiz.build(scope, mode, n);
      const qs = built.questions;
      const results = [];
      let i = 0;
      let answered = null; // { ok, chosen, typed }

      if (!qs.length) {
        document.body.classList.remove('focus');
        root.innerHTML = '<h1 class="h1">Chưa tạo được câu hỏi</h1><p class="lead">' +
          (built.reason === 'few' ? 'Phạm vi này mới có ' + built.available + ' từ. Cần ít nhất 4 từ để tạo câu hỏi.' : 'Các từ trong phạm vi này không đủ dữ liệu cho dạng câu hỏi đã chọn. Hãy thử dạng Trộn thông minh.') +
          '</p><div class="btn-row"><a class="btn" href="#/practice">Chọn lại</a><a class="btn line" href="#/study">Học từ mới</a></div>';
        return;
      }

      function promptHtml(q) {
        const s = q.show;
        if (s.audio) {
          return '<div style="display:flex;align-items:center;gap:14px;margin:8px 0 4px"><button class="btn line" data-say="' + esc(q.speak || q.expect) + '">' + L.ui.icon('speaker') + 'Nghe lại</button>' +
            (answered ? '<span class="word" style="font-size:26px">' + esc(L.lex.entry(q.key).w) + '</span>' : '<span class="muted small">Phím <span class="kbd">R</span> để nghe lại</span>') + '</div>';
        }
        if (s.word) {
          return '<div class="q-word">' + esc(s.word) + '</div><div class="card-sub" style="justify-content:flex-start">' + (s.ipa ? '<span class="ipa">' + esc(s.ipa) + '</span>' : '') + L.ui.posLabel(s.pos) + L.ui.speakBtn(s.word, true) + '</div>';
        }
        if (s.before !== undefined) {
          const fill = answered ? '<mark>' + esc(q.options[q.answer]) + '</mark>' : '<span class="blank">&nbsp;</span>';
          return '<div class="q-sentence">' + esc(s.before) + fill + esc(s.after) + '</div>' + (answered && s.vi ? '<div class="ex-vi" style="margin-top:8px">' + esc(s.vi) + '</div>' : '');
        }
        return '<div class="q-vi">' + esc(s.vi) + '</div><div class="small muted" style="margin-top:6px">' + L.ui.posLabel(s.pos) +
          (s.hint ? ' <span class="word" style="letter-spacing:.12em">' + esc(s.hint) + '</span> <span class="muted">(' + q.expect.replace(/ /g, '').length + ' chữ cái)</span>' : '') + '</div>';
      }

      function optionsHtml(q) {
        if (q.typed) {
          const cls = answered ? (answered.ok === 'ok' ? 'ok' : 'bad') : '';
          return '<form class="typein" data-act="type" autocomplete="off"><input type="text" id="typed" aria-label="Gõ câu trả lời" spellcheck="false" autocapitalize="off" autocorrect="off" class="' + cls + '"' +
            (answered ? ' value="' + esc(answered.typed) + '" disabled' : '') + ' placeholder="Gõ từ tiếng Anh…"><button class="btn" type="submit"' + (answered ? ' disabled' : '') + '>Kiểm tra</button></form>';
        }
        return '<div class="opts" role="group" aria-label="Các phương án">' + q.options.map((o, k) => {
          let cls = '';
          if (answered) {
            if (k === answered.chosen) cls += ' chosen';
            if (k === q.answer) cls += ' right';
            else if (k === answered.chosen) cls += ' wrong';
          }
          return '<button class="opt' + cls + '" data-opt="' + k + '"' + (answered ? ' disabled' : '') + '><span class="obub"><span>' + L.quiz.LETTERS[k] + '</span></span>' +
            '<span class="otext' + (q.optWords ? ' word' : '') + '">' + esc(o) + '</span></button>';
        }).join('') + '</div>';
      }

      function feedbackHtml(q) {
        if (!answered) return '';
        const e = L.lex.entry(q.key);
        const ok = answered.ok === true || answered.ok === 'ok';
        const title = ok ? 'Chính xác' : answered.ok === 'close' ? 'Gần đúng, sai một chữ' : 'Chưa đúng';
        const ex = q.explain || e.examples[0];
        return '<div class="feedback' + (ok ? '' : ' bad') + '"><div class="h3">' + title + '</div>' +
          '<div><a class="word" href="#/word/' + encodeURIComponent(q.key) + '" style="font-size:19px;color:inherit">' + esc(e.w) + '</a> ' +
          (e.ipa ? '<span class="ipa">' + esc(e.ipa) + '</span> ' : '') + L.ui.posLabel(e.pos) + ' ' + L.ui.speakBtn(e.w, true) + '</div>' +
          '<div>' + esc(L.lex.shortMeaning(q.key)) + '</div>' +
          (ex && q.mode !== 'cloze' ? '<div class="small" style="margin-top:6px"><span class="ex">' + L.ui.exampleHtml(e.w, ex.en) + '</span>' + (ex.vi ? '<br><span class="muted">' + esc(ex.vi) + '</span>' : '') + '</div>' : '') +
          '</div><div class="next-bar"><button class="btn" data-act="next">' + (i + 1 < qs.length ? 'Câu tiếp' : 'Xem kết quả') + ' <span class="hide-touch"><span class="kbd">Enter</span></span></button></div>';
      }

      function draw() {
        const q = qs[i];
        const pct = (100 * (i + (answered ? 1 : 0)) / qs.length).toFixed(1);
        root.innerHTML =
          '<div class="runner-top"><a class="icon-btn" href="#/practice" aria-label="Thoát luyện tập">' + L.ui.icon('x') + '</a>' +
          '<div class="bar"><i style="width:' + pct + '%"></i></div><span class="count num">' + (i + 1) + '/' + qs.length + '</span></div>' +
          '<div class="q-kind">' + esc(L.quiz.MODES[q.mode].name) + '. ' + esc(q.ask) + '</div>' +
          '<div class="q-prompt">' + promptHtml(q) + '</div>' + optionsHtml(q) + feedbackHtml(q);
        if (q.typed && !answered) {
          const inp = root.querySelector('#typed');
          if (inp) inp.focus();
        }
      }

      function show() {
        answered = null;
        draw();
        const q = qs[i];
        if (q.autoplay || (L.store.settings.autoplay && q.mode === 'meaning')) setTimeout(() => L.speech.speak(q.speak || q.expect), 150);
      }

      function commit(ok, extra) {
        const q = qs[i];
        const good = ok === true || ok === 'ok';
        answered = Object.assign({ ok }, extra);
        results.push({ key: q.key, ok: good, mode: q.mode });
        L.store.recordAnswer(q.key, good);
        L.store.bump('quiz');
        if (good) L.store.bump('ok');
        else {
          const c = L.store.state.cards[q.key];
          if (c && c.s === 2 && c.due > Date.now()) { c.due = Date.now(); L.store.save(); }
        }
        draw();
        const nb = root.querySelector('[data-act="next"]');
        if (nb) nb.focus({ preventScroll: true });
        if (q.mode === 'cloze' || q.mode === 'reverse' || q.mode === 'synonym') L.speech.speak(L.lex.entry(q.key).w);
      }

      function choose(k) {
        if (answered) return;
        commit(k === qs[i].answer, { chosen: k });
      }

      function next() {
        if (!answered) return;
        if (i + 1 < qs.length) { i++; show(); } else finish();
      }

      function finish() {
        L.speech.stop();
        document.body.classList.remove('focus');
        const ok = results.filter((r) => r.ok).length;
        const wrong = results.filter((r) => !r.ok);
        const wrongKeys = Array.from(new Set(wrong.map((r) => r.key)));
        const pct = Math.round(100 * ok / results.length);
        root.innerHTML =
          '<h1 class="h1">Kết quả</h1><p class="lead">' + (pct >= 90 ? 'Rất tốt. Những từ này đang nằm chắc trong trí nhớ.' : pct >= 70 ? 'Khá ổn. Ôn lại vài từ sai là chắc hơn.' : 'Các từ sai đã được đưa vào hàng ôn tập.') + '</p>' +
          '<div style="display:flex;align-items:baseline;gap:12px;margin-bottom:12px"><span class="score-big num">' + ok + '/' + results.length + '</span><span class="muted">' + pct + '% đúng</span></div>' +
          '<div class="dots" style="margin-bottom:24px" aria-hidden="true">' + results.map((r) => L.ui.bub(r.ok ? 3 : 0, r.ok ? '' : 'bad-ring')).join('') + '</div>' +
          (wrongKeys.length ? '<h2 class="h2">Từ cần xem lại</h2><div class="rows" style="margin:8px 0 22px">' + wrongKeys.map((k) => {
            const e = L.lex.entry(k);
            return '<a class="row" href="#/word/' + encodeURIComponent(k) + '"><div class="row-main"><span class="row-word">' + esc(e.w) + '</span> ' + L.ui.posLabel(e.pos) +
              '<div class="row-sub">' + esc(L.lex.shortMeaning(k)) + '</div></div>' + L.ui.speakBtn(e.w, true) + '</a>';
          }).join('') + '</div>' : '') +
          '<div class="btn-row">' +
          (wrongKeys.length >= 4 ? '<a class="btn" href="#/quiz?mode=' + mode + '&scope=' + encodeURIComponent('keys:' + wrongKeys.join('|')) + '&n=' + wrongKeys.length + '">Làm lại các câu sai</a>' : '') +
          '<a class="btn' + (wrongKeys.length >= 4 ? ' line' : '') + '" href="#/quiz?mode=' + mode + '&scope=' + encodeURIComponent(scope) + '&n=' + n + '&r=' + Date.now() + '">Làm lượt mới</a>' +
          '<a class="btn ghost" href="#/practice">Đổi dạng bài</a></div>';
      }

      root.addEventListener('click', (e) => {
        if (e.target.closest('[data-say]')) return;
        const o = e.target.closest('[data-opt]');
        if (o) { choose(+o.dataset.opt); return; }
        if (e.target.closest('[data-act="next"]')) next();
      });
      root.addEventListener('submit', (e) => {
        if (!e.target.matches('[data-act="type"]')) return;
        e.preventDefault();
        if (answered) return;
        const val = root.querySelector('#typed').value;
        if (!val.trim()) return;
        commit(L.quiz.checkTyped(qs[i], val), { typed: val });
      });

      show();
      return {
        onKey(ev) {
          const q = qs[i];
          if (!q) return;
          const typing = ev.target && ev.target.tagName === 'INPUT';
          if (ev.key === 'Enter' && answered) { ev.preventDefault(); next(); return; }
          if (typing) return;
          const k = ev.key.toUpperCase();
          if (!answered && !q.typed) {
            const idx = '1234'.indexOf(k) >= 0 ? '1234'.indexOf(k) : 'ABCD'.indexOf(k);
            if (idx >= 0 && idx < q.options.length) { choose(idx); return; }
          }
          if (k === 'R') L.speech.speak(q.speak || L.lex.entry(q.key).w);
          if (ev.key === 'Escape') location.hash = '#/practice';
        },
        destroy() { L.speech.stop(); },
      };
    },
  };
})();
