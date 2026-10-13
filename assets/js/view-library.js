/* "Bài học": the three books, their lessons, and a single lesson page. */
(function () {
  'use strict';
  const L = window.Lexi;
  const { esc } = L.util;

  function uiPref(name, value) {
    const ui = L.store.state.ui || (L.store.state.ui = {});
    if (value === undefined) return ui[name];
    ui[name] = value;
    L.store.save();
    return value;
  }

  L.views.library = {
    nav: 'library',
    render(root, ctx) {
      L.ui.setTitle('Bài học');
      const sid = ctx.query.src && L.lex.sources[ctx.query.src] ? ctx.query.src : uiPref('librarySrc') || 's1500';
      uiPref('librarySrc', sid);
      const s = L.lex.sources[sid];
      const tot = L.lex.sourceTotals(sid);

      const seg = '<div class="seg" role="tablist" aria-label="Chọn bộ từ">' + L.lex.SOURCE_ORDER.map((id) =>
        '<button role="tab" aria-selected="' + (id === sid) + '" class="' + (id === sid ? 'on' : '') + '" data-src="' + id + '">' + esc(L.lex.SOURCE_SHORT[id]) + '</button>').join('') + '</div>';

      const groups = s.groups.map((g) => {
        const ls = g.lessons.map((lid) => L.lex.lessons.get(lid));
        const known = ls.reduce((n, l) => n + L.lex.lessonProgress(l).known, 0);
        const total = ls.reduce((n, l) => n + l.keys.length, 0);
        return '<h2 class="group-title"><span>' + esc(g.title) + '</span><span class="muted num">' + known + '/' + total + '</span></h2><div class="rows">' +
          ls.map((l) => {
            const p = L.lex.lessonProgress(l);
            return '<a class="row" href="#/lesson/' + esc(l.id) + '"><div class="row-main"><div class="row-title">' + esc(l.title) + '</div>' +
              (l.sub ? '<div class="row-sub">' + esc(l.sub) + '</div>' : '') + L.ui.dots(l.keys) +
              '</div><div class="row-side num">' + p.known + '/' + p.total + '</div></a>';
          }).join('') + '</div>';
      }).join('');

      root.innerHTML =
        '<h1 class="h1">Bài học</h1><p class="lead">Mỗi ô tròn là một từ trong bài. Ô được tô càng kín, bạn càng nhớ lâu.</p>' +
        seg +
        '<div class="spacer"></div><h2 class="h2">' + esc(s.title) + '</h2><p class="muted small">' + esc(s.desc) + ' ' +
        tot.total + ' từ, đã nhớ ' + (tot.levels[2] + tot.levels[3]) + '.</p>' + L.ui.legend() + groups;

      root.querySelector('.seg').addEventListener('click', (e) => {
        const b = e.target.closest('[data-src]');
        if (b) location.hash = '#/library?src=' + b.dataset.src;
      });
    },
  };

  // ------------------------------------------------------------ one lesson
  L.views.lesson = {
    nav: 'library',
    render(root, ctx) {
      const l = L.lex.lessons.get(ctx.parts[1]);
      if (!l) { root.innerHTML = '<p class="empty">Không tìm thấy bài này. <a href="#/library">Về danh sách bài</a></p>'; return; }
      L.ui.setTitle(l.title);
      const src = L.lex.sources[l.src];
      let listening = false;

      function draw() {
        const p = L.lex.lessonProgress(l);
        const now = Date.now();
        const fresh = l.keys.filter(L.lex.isNew).length;
        const due = l.keys.filter((k) => { const c = L.lex.card(k); return c && c.s > 0 && c.due <= now; }).length;
        const studyLabel = fresh ? 'Học ' + fresh + ' từ mới' : due ? 'Ôn ' + due + ' từ đến hạn' : 'Đã học hết bài';
        const items = l.ids.map((id) => L.lex.items.get(id)).filter(Boolean);
        root.innerHTML =
          '<a class="small" href="#/library?src=' + l.src + '">' + esc(src.short) + '</a>' +
          '<h1 class="h1" style="margin-top:6px">' + esc(l.title) + '</h1>' +
          '<p class="lead">' + esc([l.sub, l.group && l.group.title].filter(Boolean).join('. ')) + '</p>' +
          L.ui.dots(l.keys) +
          '<p class="small muted" style="margin-top:8px">' + L.srs.LEVEL_NAMES.map((n, i) => n + ': ' + p.levels[i]).join(', ') + '</p>' +
          '<div class="btn-row" style="margin:16px 0 8px">' +
          '<a class="btn' + (fresh || due ? '' : ' line') + '" href="#/study?lesson=' + encodeURIComponent(l.id) + '"' + (fresh || due ? '' : ' aria-disabled="true"') + '>' + studyLabel + '</a>' +
          '<a class="btn line" href="#/quiz?scope=' + encodeURIComponent('lesson:' + l.id) + '&mode=mix&n=' + Math.min(20, l.keys.length) + '">Luyện tập bài này</a>' +
          (L.speech.supported ? '<button class="btn ghost" data-act="listen">' + L.ui.icon(listening ? 'stop' : 'play') + (listening ? 'Dừng nghe' : 'Nghe cả bài') + '</button>' : '') +
          '</div>' +
          '<div class="rows">' + items.map((it) => {
            const lv = L.lex.level(it.key);
            return '<div class="row" data-key="' + esc(it.key) + '">' + L.ui.bub(lv) +
              '<a class="row-main" href="#/word/' + encodeURIComponent(it.key) + '" style="text-decoration:none;color:inherit">' +
              '<div><span class="row-word">' + esc(it.w) + '</span> ' + (it.i ? '<span class="ipa">' + esc(it.i) + '</span> ' : '') + L.ui.posLabel(it.p) + '</div>' +
              '<div class="row-sub">' + esc(it.m || '') + (it.d ? ' <span class="def" style="display:inline">(' + esc(it.d) + ')</span>' : '') + '</div></a>' +
              L.ui.speakBtn(it.w, true) + '</div>';
          }).join('') + '</div>';
      }
      draw();

      async function listenAll() {
        listening = true;
        draw();
        const rows = Array.from(root.querySelectorAll('.row[data-key]'));
        const viVoice = L.store.settings.speakVi && L.speech.vietnameseVoice();
        for (const row of rows) {
          if (!listening) break;
          rows.forEach((r) => r.classList.remove('cur'));
          row.style.background = 'var(--hl-soft)';
          row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          const e = L.lex.entry(row.dataset.key);
          const parts = [{ text: e.w }, { pause: 500 }];
          if (viVoice) parts.push({ text: L.lex.shortMeaning(e.key), voice: viVoice, rate: 1 }, { pause: 400 });
          if (e.examples[0]) parts.push({ text: e.examples[0].en }, { pause: 300 });
          parts.push({ text: e.w }, { pause: 900 });
          const ok = await L.speech.play(parts);
          row.style.background = '';
          if (!ok) break;
        }
        listening = false;
        if (document.body.contains(root)) draw();
      }

      root.addEventListener('click', (e) => {
        const b = e.target.closest('[data-act="listen"]');
        if (!b) return;
        if (listening) { listening = false; L.speech.stop(); draw(); } else listenAll();
      });
      return { destroy() { listening = false; L.speech.stop(); } };
    },
  };
})();
