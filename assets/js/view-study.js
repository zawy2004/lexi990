/* Flashcard session with spaced repetition. Routes: #/study, #/study?lesson=ID, #/study?extra=10 */
(function () {
  'use strict';
  const L = window.Lexi;
  const U = L.util;
  const { esc } = U;
  const LEARN_AHEAD = 20 * U.MIN;

  const RATE = [
    { r: 1, name: 'Quên', cls: 'again' },
    { r: 2, name: 'Khó', cls: '' },
    { r: 3, name: 'Nhớ', cls: 'good' },
    { r: 4, name: 'Dễ', cls: '' },
  ];

  function interleave(reviews, fresh) {
    const out = [];
    let i = 0;
    let j = 0;
    while (i < reviews.length || j < fresh.length) {
      for (let k = 0; k < 3 && i < reviews.length; k++) out.push(reviews[i++]);
      if (j < fresh.length) out.push(fresh[j++]);
    }
    return out;
  }

  function backHtml(e) {
    let h = '<div class="card-back">';
    h += '<ul class="meaning-list">' + e.meanings.slice(0, 3).map((m) =>
      '<li class="meaning">' + (m.pos && e.meanings.length > 1 ? '<span class="pos">' + esc(m.pos) + '</span> ' : '') + esc(m.text) + '</li>').join('') + '</ul>';
    if (e.defs.length) h += '<div class="def">' + esc(e.defs[0].text) + '</div>';
    e.examples.slice(0, 2).forEach((x) => {
      h += '<div class="exblock"><div style="display:flex;gap:10px;align-items:flex-start"><div style="flex:1"><div class="ex">' + L.ui.exampleHtml(e.w, x.en) + '</div>' +
        (x.vi ? '<div class="ex-vi">' + esc(x.vi) + '</div>' : '') + '</div>' + L.ui.speakBtn(x.en, true, 'Nghe câu ví dụ') + '</div></div>';
    });
    if (e.notes.length) h += '<div class="note">' + esc(e.notes[0]) + '</div>';
    const rel = [];
    if (e.syn.length) rel.push(['Đồng nghĩa', e.syn]);
    if (e.ant.length) rel.push(['Trái nghĩa', e.ant]);
    if (rel.length || e.forms.length) {
      h += '<dl class="rel">' + rel.map(([t, list]) => '<div><dt>' + t + '</dt><dd>' + list.slice(0, 3).map((r) =>
        '<span class="word">' + esc(r.w) + '</span>' + (r.m ? ' <span class="muted">' + esc(r.m) + '</span>' : '')).join('; ') + '</dd></div>').join('') +
        (e.forms.length ? '<div><dt>Họ từ</dt><dd>' + esc(e.forms.join('; ')) + '</dd></div>' : '') + '</dl>';
    }
    return h + '</div>';
  }

  L.views.study = {
    nav: 'today',
    focus: true,
    render(root, ctx) {
      L.ui.setTitle('Học');
      const S = L.store.settings;
      const now0 = Date.now();
      const t = L.store.today();
      const lesson = ctx.query.lesson ? L.lex.lessons.get(ctx.query.lesson) : null;
      let reviews;
      let fresh;
      if (lesson) {
        reviews = lesson.keys.filter((k) => { const c = L.lex.card(k); return c && c.s > 0 && c.due <= now0; });
        fresh = lesson.keys.filter(L.lex.isNew);
      } else {
        reviews = L.lex.dueKeys(now0).slice(0, Math.max(0, S.reviewLimit - t.rev));
        const extra = parseInt(ctx.query.extra, 10);
        fresh = L.lex.nextNew(extra > 0 ? extra : Math.max(0, S.newPerDay - t.new));
      }
      const queue = interleave(reviews, fresh);
      const isFresh = new Set(fresh);
      const pending = []; // { key, due } learning cards coming back this session
      const done = { rev: 0, fresh: 0, again: 0, started: Date.now() };
      const exitHref = lesson ? '#/lesson/' + encodeURIComponent(lesson.id) : '#/';
      let current = null;
      let revealed = false;
      let shownAt = 0;
      let front = 'en';
      let lastKey = null;

      if (!queue.length) {
        document.body.classList.remove('focus');
        const newLeft = Math.max(0, S.newPerDay - t.new);
        root.innerHTML =
          '<h1 class="h1">Không có thẻ nào cần học</h1>' +
          '<p class="lead">' + (lesson ? 'Bạn đã học hết từ mới của bài này và chưa có từ nào đến hạn ôn.'
            : newLeft ? 'Lộ trình đã hết từ mới và chưa có từ nào đến hạn ôn.'
              : 'Bạn đã học đủ ' + S.newPerDay + ' từ mới hôm nay và ôn xong các từ đến hạn.') + '</p>' +
          '<div class="btn-row">' + (lesson ? '' : '<a class="btn" href="#/study?extra=10">Học thêm 10 từ mới</a>') +
          '<a class="btn line" href="#/practice">Luyện tập</a><a class="btn ghost" href="' + exitHref + '">Quay lại</a></div>';
        return;
      }

      function remaining() { return queue.length + pending.length + (current ? 1 : 0); }

      function pickNext() {
        const now = Date.now();
        pending.sort((a, b) => a.due - b.due);
        if (pending.length && pending[0].due <= now && !(pending[0].key === lastKey && queue.length)) return pending.shift().key;
        if (queue.length) return queue.shift();
        if (pending.length && pending[0].due <= now + LEARN_AHEAD) return pending.shift().key;
        if (pending.length) return pending.shift().key;
        return null;
      }

      function show() {
        current = pickNext();
        if (!current) return finish();
        revealed = false;
        shownAt = Date.now();
        const c = L.lex.card(current);
        const isNewCard = !c || c.s === 0;
        front = isNewCard ? 'en' : S.direction === 'vi-en' ? 'vi' : S.direction === 'mix' ? (Math.random() < 0.5 ? 'vi' : 'en') : 'en';
        if (isNewCard) revealed = true;
        draw();
        if (S.autoplay && front === 'en') L.speech.speak(L.lex.entry(current).w);
      }

      function draw() {
        const e = L.lex.entry(current);
        const c = L.lex.card(current);
        const isNewCard = !c || c.s === 0;
        const status = isNewCard ? 'Từ mới' : c.s === 2 ? 'Ôn tập' : 'Đang học';
        const marked = !!L.store.state.marks[current];
        const total = done.rev + done.fresh + remaining();
        const pct = (100 * (done.rev + done.fresh) / Math.max(1, total)).toFixed(1);
        const pv = L.srs.preview(c, Date.now());
        const frontHtml = front === 'en'
          ? '<div class="card-word">' + esc(e.w) + '</div><div class="card-sub">' + (e.ipa ? '<span class="ipa">' + esc(e.ipa) + '</span>' : '') + L.ui.posLabel(e.pos) + L.ui.speakBtn(e.w) + '</div>'
          : '<div class="card-word vi">' + esc(L.lex.shortMeaning(current)) + '</div><div class="card-sub">' + L.ui.posLabel(e.pos) + '<span class="muted small">Từ tiếng Anh là gì?</span></div>';
        const revealFront = front === 'vi' && revealed
          ? '<div class="card-sub" style="margin-top:16px"><span class="word" style="font-size:30px">' + esc(e.w) + '</span>' + (e.ipa ? '<span class="ipa">' + esc(e.ipa) + '</span>' : '') + L.ui.speakBtn(e.w) + '</div>'
          : '';
        root.innerHTML =
          '<div class="runner-top"><a class="icon-btn" href="' + exitHref + '" aria-label="Kết thúc phiên học">' + L.ui.icon('x') + '</a>' +
          '<div class="bar" role="progressbar" aria-valuenow="' + Math.round(pct) + '" aria-valuemin="0" aria-valuemax="100"><i style="width:' + pct + '%"></i></div>' +
          '<span class="count num">' + remaining() + ' thẻ</span></div>' +
          '<article class="card" data-act="reveal">' +
          '<div class="card-meta"><span class="tag' + (isNewCard ? ' ink' : '') + '">' + status + '</span><span>' +
          e.items.map((i) => L.lex.SOURCE_SHORT[i.src]).filter((v, i, a) => a.indexOf(v) === i).join(', ') +
          ' <button class="icon-btn" data-act="mark" aria-pressed="' + marked + '" aria-label="' + (marked ? 'Bỏ đánh dấu' : 'Đánh dấu từ này') + '" style="width:34px;height:34px;color:' + (marked ? 'var(--ink)' : 'var(--muted)') + '">' +
          L.ui.icon('star', marked ? ' fill="currentColor"' : '') + '</button></span></div>' +
          '<div class="card-front">' + frontHtml + revealFront + '</div>' +
          (revealed ? backHtml(e) : '<div class="reveal-hint">Chạm vào thẻ để xem nghĩa <span class="hide-touch"><span class="kbd">Space</span></span></div>') +
          '</article>' +
          (revealed
            ? '<div class="rate" role="group" aria-label="Bạn nhớ từ này đến đâu?">' + RATE.map((x) =>
              '<button class="' + x.cls + '" data-rate="' + x.r + '">' + (isNewCard && x.r === 1 ? 'Chưa nhớ' : isNewCard && x.r === 4 ? 'Đã biết' : x.name) +
              '<small>' + U.fmtDelay(pv[x.r]) + '</small><span class="hide-touch"><span class="kbd">' + x.r + '</span></span></button>').join('') + '</div>'
            : '<div class="next-bar"><button class="btn wide" data-act="reveal-btn">Xem nghĩa</button></div>');
      }

      function reveal() {
        if (revealed) return;
        revealed = true;
        draw();
        if (S.autoplay && front === 'vi') L.speech.speak(L.lex.entry(current).w);
      }

      function rate(r) {
        if (!revealed || !current) return;
        const now = Date.now();
        const before = L.lex.card(current);
        const wasNew = !before || before.s === 0;
        const c = L.srs.schedule(before, r, now);
        L.store.state.cards[current] = c;
        if (wasNew) { L.store.bump('new'); done.fresh++; } else { L.store.bump('rev'); done.rev++; }
        L.store.bump('ms', Math.min(60000, now - shownAt));
        if (r === 1) {
          done.again++;
          if (!wasNew) L.store.recordAnswer(current, false); // not knowing a brand-new word is not a mistake
        } else if (r >= 3 && !wasNew) L.store.recordAnswer(current, true);
        if ((c.s === 1 || c.s === 3) && c.due - now < 60 * U.MIN) pending.push({ key: current, due: c.due });
        lastKey = current;
        current = null;
        L.store.save();
        show();
      }

      function finish() {
        L.speech.stop();
        current = null;
        document.body.classList.remove('focus');
        const mins = Math.max(1, Math.round((Date.now() - done.started) / U.MIN));
        root.innerHTML =
          '<h1 class="h1">Xong phiên học</h1><p class="lead">Lịch ôn tiếp theo đã được tính cho từng từ.</p>' +
          '<div class="stat-line"><div><b>' + done.fresh + '</b><span>từ mới</span></div><div><b>' + done.rev + '</b><span>lượt ôn</span></div>' +
          '<div><b>' + done.again + '</b><span>lần chọn Quên</span></div><div><b>' + mins + '</b><span>phút</span></div></div>' +
          '<div class="btn-row">' +
          (L.quiz.scopeKeys('today').length >= 4 ? '<a class="btn" href="#/quiz?scope=today&mode=mix&n=' + Math.min(20, Math.max(8, done.fresh + done.rev)) + '">Luyện tập từ vừa học</a>' : '') +
          '<a class="btn line" href="' + exitHref + '">' + (lesson ? 'Về bài học' : 'Về trang hôm nay') + '</a></div>';
      }

      root.addEventListener('click', (e) => {
        if (e.target.closest('[data-say]')) return;
        const m = e.target.closest('[data-act="mark"]');
        if (m) {
          e.stopPropagation();
          const marks = L.store.state.marks;
          if (marks[current]) delete marks[current]; else marks[current] = 1;
          L.store.save();
          draw();
          return;
        }
        const r = e.target.closest('[data-rate]');
        if (r) { rate(+r.dataset.rate); return; }
        if (e.target.closest('[data-act="reveal"], [data-act="reveal-btn"]') && !e.target.closest('a')) reveal();
      });

      show();
      return {
        onKey(ev) {
          if (!current) return;
          if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); if (!revealed) reveal(); else rate(3); }
          else if (/^[1-4]$/.test(ev.key)) rate(+ev.key);
          else if (ev.key.toLowerCase() === 's' || ev.key.toLowerCase() === 'p') L.speech.speak(L.lex.entry(current).w);
          else if (ev.key === 'Escape') location.hash = exitHref;
        },
        destroy() { L.speech.stop(); },
      };
    },
  };
})();
