/* "Tra từ": accent-insensitive search (#/dict?q=) and the merged word page (#/word/<key>). */
(function () {
  'use strict';
  const L = window.Lexi;
  const U = L.util;
  const { esc } = U;

  function resultRow(k) {
    const e = L.lex.entry(k);
    const srcs = Array.from(new Set(e.items.map((i) => i.src)));
    return '<a class="row" href="#/word/' + encodeURIComponent(k) + '">' + L.ui.bub(L.lex.level(k)) +
      '<div class="row-main"><div><span class="row-word">' + esc(e.w) + '</span> ' + (e.ipa ? '<span class="ipa">' + esc(e.ipa) + '</span> ' : '') + L.ui.posLabel(e.pos) + '</div>' +
      '<div class="row-sub clip">' + esc(e.meanings.map((m) => m.text).join('; ')) + '</div></div>' +
      '<div class="row-side">' + srcs.map((s) => L.lex.SOURCE_SHORT[s]).join(', ') + '</div></a>';
  }

  L.views.dict = {
    nav: 'dict',
    render(root, ctx) {
      L.ui.setTitle('Tra từ');
      let q = ctx.query.q || '';
      let src = ctx.query.src || '';

      root.innerHTML =
        '<h1 class="h1">Tra từ</h1><p class="lead">Tìm bằng tiếng Anh hoặc tiếng Việt, gõ không dấu cũng được (ví dụ: "hop dong").</p>' +
        '<form class="search" role="search" data-act="search"><span data-icon="search"></span><input type="search" id="q" value="' + esc(q) + '" placeholder="negotiate, bảo hiểm, giao hàng…" aria-label="Từ cần tra" autocomplete="off" spellcheck="false"></form>' +
        '<div class="chips" style="margin:12px 0 4px">' + [['', 'Tất cả']].concat(L.lex.SOURCE_ORDER.map((s) => [s, L.lex.SOURCE_SHORT[s]])).map(([id, name]) =>
          '<button class="chip' + (id === src ? ' on' : '') + '" data-src="' + id + '">' + esc(name) + '</button>').join('') + '</div>' +
        '<div id="results"></div>';
      L.ui.fillIcons(root);
      const input = root.querySelector('#q');
      const out = root.querySelector('#results');

      function suggestions() {
        const st = L.store.state;
        const marked = Object.keys(st.marks).filter((k) => L.lex.words.has(k));
        const recent = Object.keys(st.cards).filter((k) => L.lex.words.has(k)).sort((a, b) => st.cards[b].last - st.cards[a].last).slice(0, 8);
        let h = '';
        if (marked.length) h += '<h2 class="group-title">Đã đánh dấu <span class="muted">' + marked.length + '</span></h2><div class="rows">' + marked.slice(0, 30).map(resultRow).join('') + '</div>';
        if (recent.length) h += '<h2 class="group-title">Học gần đây</h2><div class="rows">' + recent.map(resultRow).join('') + '</div>';
        h += '<div class="btn-row" style="margin-top:20px"><button class="btn line" data-act="random">Xem một từ ngẫu nhiên</button></div>';
        return h;
      }

      function update() {
        const keys = L.lex.search(q, src);
        if (!q.trim()) out.innerHTML = suggestions();
        else if (!keys.length) out.innerHTML = '<p class="empty" style="margin-top:16px">Không có từ nào khớp với “' + esc(q) + '”. Thử gõ ngắn hơn hoặc bỏ dấu.</p>';
        else out.innerHTML = '<p class="small muted" style="margin:14px 0 4px">' + keys.length + (keys.length === 80 ? '+' : '') + ' kết quả</p><div class="rows">' + keys.map(resultRow).join('') + '</div>';
        const h = '#/dict' + (q || src ? '?' + [q ? 'q=' + encodeURIComponent(q) : '', src ? 'src=' + src : ''].filter(Boolean).join('&') : '');
        history.replaceState(null, '', h);
      }
      update();
      if (window.matchMedia('(hover: hover)').matches) input.focus();

      input.addEventListener('input', U.debounce(() => { q = input.value; update(); }, 120));
      root.addEventListener('submit', (e) => { e.preventDefault(); const first = out.querySelector('a.row'); if (first) location.hash = first.getAttribute('href'); });
      root.addEventListener('click', (e) => {
        const c = e.target.closest('[data-src]');
        if (c) {
          src = c.dataset.src;
          root.querySelectorAll('[data-src]').forEach((b) => b.classList.toggle('on', b.dataset.src === src));
          update();
          return;
        }
        if (e.target.closest('[data-act="random"]')) {
          const keys = Array.from(L.lex.words.keys());
          location.hash = '#/word/' + encodeURIComponent(U.pick(keys));
        }
      });
    },
  };

  // ------------------------------------------------------------ word page
  function relList(title, list) {
    if (!list.length) return '';
    return '<div><dt>' + title + '</dt><dd>' + list.map((r) =>
      '<span class="word">' + esc(r.w) + '</span>' + (r.pos ? ' <span class="pos">' + esc(r.pos) + '</span>' : '') + (r.m ? ' <span class="muted">' + esc(r.m) + '</span>' : '')).join('<br>') + '</dd></div>';
  }

  function itemBlock(it) {
    const l = it.lesson && L.lex.lessons.get(it.lesson);
    let h = '<div class="src-block">' + L.ui.srcTag(it.src) + (l ? ' <a class="small" href="#/lesson/' + encodeURIComponent(l.id) + '">' + esc(l.title) + '</a>' : '');
    h += '<div style="margin-top:8px"><span class="word" style="font-size:18px">' + esc(it.w) + '</span> ' + (it.i ? '<span class="ipa">' + esc(it.i) + '</span> ' : '') + L.ui.posLabel(it.p) + '</div>';
    if (it.m) h += '<div class="meaning" style="font-size:18px;margin-top:4px">' + esc(it.m) + '</div>';
    if (it.d) h += '<div class="def">' + esc(it.d) + '</div>';
    const exs = [];
    if (it.e) exs.push([it.e, it.ev]);
    (it.x || []).forEach((x) => exs.push(x));
    exs.forEach(([en, vi]) => {
      h += '<div class="exblock"><div style="display:flex;gap:10px;align-items:flex-start"><div style="flex:1"><div class="ex">' + L.ui.exampleHtml(it.w, en) + '</div>' +
        (vi ? '<div class="ex-vi">' + esc(vi) + '</div>' : '') + '</div>' + L.ui.speakBtn(en, true, 'Nghe câu ví dụ') + '</div></div>';
    });
    if (it.n) h += '<div class="note"><b>Giải thích:</b> ' + esc(it.n) + '</div>';
    const toObj = (arr) => (arr || []).map((r) => ({ w: r[0], pos: r[1], m: r[2] }));
    const rel = relList('Đồng nghĩa', toObj(it.s)) + relList('Trái nghĩa', toObj(it.a)) + relList('Từ liên quan', toObj(it.r)) + relList('So sánh', toObj(it.c));
    if (rel || it.f) h += '<dl class="rel">' + rel + (it.f ? '<div><dt>Họ từ</dt><dd>' + esc(it.f) + '</dd></div>' : '') + '</dl>';
    return h + '</div>';
  }

  L.views.word = {
    nav: 'dict',
    render(root, ctx) {
      const key = decodeURIComponent(ctx.parts.slice(1).join('/'));
      const e = L.lex.entry(key);
      if (!e) { root.innerHTML = '<p class="empty">Không tìm thấy từ “' + esc(key) + '”. <a href="#/dict">Tra từ khác</a></p>'; return; }
      L.ui.setTitle(e.w);

      function draw() {
        const st = L.store.state;
        const c = st.cards[key];
        const lv = L.srs.level(c);
        const s = st.stats[key];
        const marked = !!st.marks[key];
        let when = '';
        if (c && c.s > 0) {
          const ms = c.due - Date.now();
          when = ms <= 0 ? ', đến hạn ôn' : ', ôn lại sau ' + U.fmtDelay(ms);
        }
        root.innerHTML =
          '<button class="link-btn small" data-act="back">' + 'Quay lại' + '</button>' +
          '<div class="word-head" style="margin-top:12px"><div style="flex:1;min-width:0"><div class="card-word">' + esc(e.w) + '</div>' +
          '<div class="card-sub" style="justify-content:flex-start">' + (e.ipa ? '<span class="ipa">' + esc(e.ipa) + '</span>' : '') + L.ui.posLabel(e.pos) + L.ui.speakBtn(e.w) + '</div></div></div>' +
          '<div class="state-line">' + L.ui.bub(lv) + '<span>' + L.srs.LEVEL_NAMES[lv] + when + (s ? '. Trả lời đúng ' + s.c + ', sai ' + s.w : '') + '</span></div>' +
          '<div class="btn-row" style="margin-top:14px">' +
          '<button class="btn small' + (marked ? '' : ' line') + '" data-act="mark">' + L.ui.icon('star', marked ? ' fill="currentColor"' : '') + (marked ? 'Đã đánh dấu' : 'Đánh dấu') + '</button>' +
          (lv === 0 ? '<button class="btn small line" data-act="learn">Học từ này ngay</button>' : '') +
          (lv < 3 ? '<button class="btn small ghost" data-act="known">Tôi đã biết từ này</button>' : '') +
          (lv > 0 ? '<button class="btn small ghost" data-act="reset">Học lại từ đầu</button>' : '') +
          '</div>' +
          e.items.map(itemBlock).join('');
      }
      draw();

      root.addEventListener('click', (ev) => {
        const a = ev.target.closest('[data-act]');
        if (!a) return;
        const st = L.store.state;
        const now = Date.now();
        switch (a.dataset.act) {
          case 'back': if (history.length > 1) history.back(); else location.hash = '#/dict'; return;
          case 'mark': L.store.setMark(key, !st.marks[key]); L.ui.toast(st.marks[key] ? 'Đã đánh dấu' : 'Đã bỏ đánh dấu'); break;
          case 'learn': st.cards[key] = Object.assign(L.srs.blank(now), { s: 1, due: now, seen: now, last: now }); L.ui.toast('Đã thêm vào hàng ôn tập'); break;
          case 'known': st.cards[key] = Object.assign(L.srs.blank(now), st.cards[key] || {}, { s: 2, ivl: L.srs.MASTERED_DAYS, due: now + L.srs.MASTERED_DAYS * U.DAY, seen: (st.cards[key] && st.cards[key].seen) || now, last: now }); L.ui.toast('Đã đánh dấu là thuộc lòng'); break;
          case 'reset': L.store.resetCard(key); L.ui.toast('Từ này sẽ được học lại như từ mới'); break;
          default: return;
        }
        L.store.save();
        draw();
      });
    },
  };
})();
