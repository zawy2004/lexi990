/* "Thi thử": the 200-question sample test. Routes: #/test, #/test/run, #/test/review/<id> */
(function () {
  'use strict';
  const L = window.Lexi;
  const U = L.util;
  const { esc } = U;
  const LET = ['A', 'B', 'C', 'D'];
  const SEC_PER_Q = { listen: 27, read: 45 };

  const T = () => (window.LEXI_DATA || {}).test;
  const partById = (id) => T().parts.find((p) => p.id === id);
  const partQs = (p) => (p.qs ? p.qs : p.groups.flatMap((g) => g.qs));

  function screensFor(partIds) {
    const out = [];
    T().parts.filter((p) => partIds.includes(p.id)).forEach((p) => {
      if (p.qs) p.qs.forEach((q) => out.push({ part: p, qs: [q] }));
      else p.groups.forEach((g) => out.push({ part: p, group: g, qs: g.qs }));
    });
    return out;
  }

  function timeLimit(partIds) {
    return partIds.reduce((s, id) => {
      const p = partById(id);
      return s + partQs(p).length * (p.listen ? SEC_PER_Q.listen : SEC_PER_Q.read);
    }, 0);
  }

  // Approximate raw → scaled conversion (published practice-test style tables).
  const L_TABLE = [[0, 5], [10, 15], [20, 60], [30, 115], [40, 175], [50, 240], [60, 300], [70, 360], [80, 415], [90, 460], [96, 495], [100, 495]];
  const R_TABLE = [[0, 5], [10, 5], [20, 45], [30, 95], [40, 155], [50, 215], [60, 275], [70, 335], [80, 390], [90, 440], [97, 495], [100, 495]];
  function scale(raw, table) {
    for (let i = 1; i < table.length; i++) {
      const [x1, y1] = table[i];
      const [x0, y0] = table[i - 1];
      if (raw <= x1) return Math.round((y0 + (y1 - y0) * (raw - x0) / (x1 - x0)) / 5) * 5;
    }
    return 495;
  }

  function audioParts(sc) {
    const p = sc.part;
    const V = L.speech.dialogueVoices();
    const opt = (o, i) => [{ text: LET[i] + '. ' + o }, { pause: 650 }];
    if (p.id === 1) {
      const q = sc.qs[0];
      return [{ text: 'Number ' + q.n + '. Look at the picture.' }, { pause: 600 }].concat(q.o.flatMap(opt));
    }
    if (p.id === 2) {
      const q = sc.qs[0];
      return [{ text: 'Number ' + q.n + '.' }, { pause: 350 }, { text: q.q }, { pause: 800 }].concat(q.o.flatMap(opt));
    }
    const g = sc.group;
    const intro = g.intro || 'Questions ' + g.from + ' through ' + g.to + ' refer to the following conversation.';
    return [{ text: intro }, { pause: 600 }].concat(g.lines.flatMap(([sp, text]) => {
      const v = V[sp] || V.N;
      return [{ text, voice: v.voice, pitch: v.pitch }, { pause: 300 }];
    }));
  }

  function scriptHtml(sc) {
    const p = sc.part;
    if (p.id === 1) return '<div class="script">' + sc.qs[0].o.map((o, i) => '<p><b>' + LET[i] + '.</b> ' + esc(o) + '</p>').join('') + '</div>';
    if (p.id === 2) {
      const q = sc.qs[0];
      return '<div class="script"><p><b>' + q.n + '.</b> ' + esc(q.q) + '</p>' + q.o.map((o, i) => '<p><b>' + LET[i] + '.</b> ' + esc(o) + '</p>').join('') + '</div>';
    }
    const g = sc.group;
    return '<div class="script">' + (g.intro ? '<p class="muted">' + esc(g.intro) + '</p>' : '') +
      g.lines.map(([sp, t]) => '<p>' + (sp === 'N' ? '' : '<b>' + (sp === 'M' ? 'Nam' : 'Nữ') + ':</b> ') + esc(t) + '</p>').join('') + '</div>';
  }

  function passageHtml(g, part) {
    const body = g.text.map((line) => {
      if (/^—+$/.test(line)) return '<hr style="border:0;border-top:1px dashed var(--line);margin:14px 0">';
      const h = esc(line).replace(/__(\d+)__/g, '<span class="gap">$1</span>');
      return '<p>' + h + '</p>';
    }).join('');
    return (g.intro ? '<p class="small muted">' + esc(g.intro) + '</p>' : part === 6 ? '<p class="small muted">Questions ' + g.from + '–' + g.to + '</p>' : '') +
      '<div class="passage">' + body + '</div>';
  }

  /**
   * One question with its options.
   * o: { chosen, showText, judge } — judge marks right/wrong (practice feedback or review).
   */
  function questionHtml(q, part, o) {
    const lettersOnly = (part.id === 1 || part.id === 2) && !o.showText;
    let head = '';
    if (part.id === 5) head = esc(q.q).replace(/_{3,}/g, '<span class="blank" style="display:inline-block;min-width:4em;border-bottom:2px solid var(--graphite)">&nbsp;</span>');
    else if (part.id === 2 && !o.showText) head = 'Chọn câu trả lời đúng';
    else if (part.id === 1) head = 'Chọn câu mô tả đúng nhất';
    else head = esc(q.q || '');
    const opts = q.o.map((t, k) => {
      let cls = '';
      if (o.chosen === k) cls += ' chosen';
      if (o.judge) { if (k === q.a) cls += ' right'; else if (o.chosen === k) cls += ' wrong'; }
      const text = lettersOnly ? '' : '<span class="otext">' + esc(t) + '</span>';
      return '<button class="opt' + cls + '" data-q="' + q.n + '" data-k="' + k + '"' + (o.locked ? ' disabled' : '') +
        (lettersOnly ? ' aria-label="Đáp án ' + LET[k] + '"' : '') + '><span class="obub"><span>' + LET[k] + '</span></span>' + text + '</button>';
    }).join('');
    return '<div class="tq" id="q' + q.n + '"><div class="tq-q"><span class="n">' + q.n + '.</span><span>' + head + '</span></div>' +
      '<div class="opts' + (lettersOnly ? ' letters' : '') + '">' + opts + '</div></div>';
  }

  function omrHtml(qsList, answers, curNums, judge) {
    return '<div class="omr">' + qsList.map((q) => {
      const ch = answers[q.n];
      return '<button data-jump="' + q.n + '" class="' + (curNums && curNums.includes(q.n) ? 'cur' : '') + '"><span class="n">' + q.n + '</span>' +
        q.o.map((_, k) => {
          let cls = 'bub';
          if (judge) { if (k === q.a) cls += ' hl'; else if (k === ch) cls += ' bad'; }
          else if (k === ch) cls += ' on';
          return '<i class="' + cls + '">' + LET[k] + '</i>';
        }).join('') + '</button>';
    }).join('') + '</div>';
  }

  function grade(partIds, answers) {
    const per = {};
    let lc = 0, lt = 0, rc = 0, rt = 0;
    partIds.forEach((id) => {
      const p = partById(id);
      const qs = partQs(p);
      const c = qs.filter((q) => answers[q.n] === q.a).length;
      per[id] = [c, qs.length];
      if (p.listen) { lc += c; lt += qs.length; } else { rc += c; rt += qs.length; }
    });
    const fullL = [1, 2, 3, 4].every((id) => partIds.includes(id));
    const fullR = [5, 6, 7].every((id) => partIds.includes(id));
    return { per, lc, lt, rc, rt, sl: fullL ? scale(lc, L_TABLE) : null, sr: fullR ? scale(rc, R_TABLE) : null };
  }

  // ------------------------------------------------------------ home
  function home(root) {
    L.ui.setTitle('Thi thử');
    const st = L.store.state;
    const ui = st.ui || (st.ui = {});
    let mode = ui.testMode || 'practice';
    let parts = ui.testParts || [1, 2, 3, 4, 5, 6, 7];

    function draw() {
      const draft = st.draft;
      const nq = parts.reduce((s, id) => s + partQs(partById(id)).length, 0);
      const mins = Math.round(timeLimit(parts) / 60);
      const presets = [
        ['Toàn bộ đề', [1, 2, 3, 4, 5, 6, 7]],
        ['Listening', [1, 2, 3, 4]],
        ['Reading', [5, 6, 7]],
      ];
      const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));
      root.innerHTML =
        '<h1 class="h1">Thi thử</h1><p class="lead">Đề New TOEIC 200 câu trong sách Từ &amp; cụm từ 0–990. Phần nghe được đọc bằng giọng đọc của trình duyệt, kèm ảnh Part 1 từ sách.</p>' +
        (draft ? '<div class="sheet" style="margin-bottom:28px"><div class="sheet-head"><h2 class="h2">Bài đang làm dở</h2><span class="small muted">' + Object.keys(draft.answers).length + ' câu đã chọn</span></div>' +
          '<div class="sheet-foot"><a class="btn" href="#/test/run">Làm tiếp</a><button class="btn ghost" data-act="drop">Bỏ bài này</button></div></div>' : '') +
        '<h2 class="h2">Chế độ</h2><div class="seg" style="margin:10px 0 6px">' +
        '<button class="' + (mode === 'practice' ? 'on' : '') + '" data-mode="practice">Luyện tập</button>' +
        '<button class="' + (mode === 'exam' ? 'on' : '') + '" data-mode="exam">Thi thật</button></div>' +
        '<p class="small muted">' + (mode === 'practice'
          ? 'Biết đúng sai ngay sau mỗi câu, nghe lại thoải mái, xem được lời thoại.'
          : 'Đếm ngược ' + mins + ' phút, tự phát âm thanh, chỉ biết kết quả khi nộp bài.') + '</p>' +
        '<h2 class="h2" style="margin-top:24px">Phần thi</h2><div class="chips" style="margin:10px 0 8px">' +
        presets.map(([name, ids]) => '<button class="chip' + (same(ids, parts) ? ' on' : '') + '" data-preset="' + ids.join(',') + '">' + name + '</button>').join('') + '</div>' +
        '<div class="rows">' + T().parts.map((p) => {
          const n = partQs(p).length;
          return '<label class="test-part"><input type="checkbox" data-part="' + p.id + '"' + (parts.includes(p.id) ? ' checked' : '') + ' style="width:20px;height:20px;accent-color:var(--ink)">' +
            '<span style="flex:1"><span class="row-title" style="display:block">' + esc(p.name) + '</span><span class="row-sub">' + esc(p.help) + '</span></span><span class="row-side num">' + n + ' câu</span></label>';
        }).join('') + '</div>' +
        (!L.speech.supported && parts.some((id) => partById(id).listen) ? '<p class="small muted" style="margin-top:10px">Trình duyệt này không có giọng đọc, phần nghe sẽ hiện lời thoại để đọc thay.</p>' : '') +
        '<div class="btn-row" style="margin-top:20px"><button class="btn" data-act="start"' + (parts.length ? '' : ' disabled') + '>Bắt đầu ' + nq + ' câu</button>' +
        '<span class="small muted">khoảng ' + mins + ' phút</span></div>' +
        (st.tests.length ? '<section class="section"><h2 class="h2">Kết quả đã làm</h2><div class="rows" style="margin-top:8px">' +
          st.tests.slice().reverse().map((t) => {
            const d = new Date(t.date);
            const total = t.sl != null && t.sr != null ? (t.sl + t.sr) + ' điểm' : (t.sl != null ? 'Nghe ' + t.sl : '') + (t.sr != null ? (t.sl != null ? ', ' : '') + 'Đọc ' + t.sr : '');
            return '<a class="row" href="#/test/review/' + t.id + '"><div class="row-main"><div class="row-title">' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() +
              ', ' + (t.mode === 'exam' ? 'thi thật' : 'luyện tập') + '</div><div class="row-sub">Part ' + t.parts.join(', ') + '. Đúng ' + (t.lc + t.rc) + '/' + (t.lt + t.rt) + ' câu</div></div>' +
              '<div class="row-side">' + esc(total) + '</div></a>';
          }).join('') + '</div></section>' : '');
    }
    draw();

    root.addEventListener('click', (e) => {
      const m = e.target.closest('[data-mode]');
      if (m) { mode = m.dataset.mode; ui.testMode = mode; L.store.save(); draw(); return; }
      const p = e.target.closest('[data-preset]');
      if (p) { parts = p.dataset.preset.split(',').map(Number); ui.testParts = parts; L.store.save(); draw(); return; }
      if (e.target.closest('[data-act="start"]')) {
        st.draft = { parts: parts.slice().sort(), mode, answers: {}, elapsed: 0, screen: 0, limit: mode === 'exam' ? timeLimit(parts) : 0, started: Date.now() };
        L.store.saveNow();
        location.hash = '#/test/run';
        return;
      }
      if (e.target.closest('[data-act="drop"]')) {
        const b = e.target.closest('[data-act="drop"]');
        if (b.dataset.armed) { st.draft = null; L.store.saveNow(); draw(); }
        else { b.dataset.armed = '1'; b.textContent = 'Bấm lần nữa để bỏ'; }
      }
    });
    root.addEventListener('change', (e) => {
      const c = e.target.closest('[data-part]');
      if (!c) return;
      const id = +c.dataset.part;
      parts = c.checked ? parts.concat(id).sort() : parts.filter((x) => x !== id);
      ui.testParts = parts;
      L.store.save();
      draw();
    });
  }

  // ------------------------------------------------------------ runner
  function run(root) {
    const st = L.store.state;
    const d = st.draft;
    if (!d) { location.hash = '#/test'; return; }
    L.ui.setTitle('Đang thi thử');
    const screens = screensFor(d.parts);
    const allQs = screens.flatMap((s) => s.qs);
    const practice = d.mode === 'practice';
    let showSheet = false;
    let showScript = {};
    let playing = false;
    let lastTick = Date.now();
    let autoplayed = {};

    function tick() {
      const now = Date.now();
      d.elapsed += (now - lastTick) / 1000;
      lastTick = now;
      const el = root.querySelector('.timer');
      if (el) el.textContent = d.limit ? U.fmtClock(d.limit - d.elapsed) : U.fmtClock(d.elapsed);
      if (d.limit && d.elapsed >= d.limit) { submit(); return; }
      if (Math.round(d.elapsed) % 5 === 0) L.store.save();
    }
    const timer = setInterval(tick, 1000);

    async function playAudio() {
      const sc = screens[d.screen];
      if (!sc.part.listen || !L.speech.supported) return;
      playing = true;
      draw();
      await L.speech.play(audioParts(sc));
      playing = false;
      if (document.body.contains(root) && screens[d.screen] === sc) draw();
    }

    function draw() {
      const sc = screens[d.screen];
      const p = sc.part;
      const firstOfPart = d.screen === 0 || screens[d.screen - 1].part !== p;
      const answeredCount = Object.keys(d.answers).length;
      const noTts = !L.speech.supported;
      const scriptOpen = showScript[d.screen] || noTts;
      const judged = (q) => practice && d.answers[q.n] !== undefined;
      let body = '';
      if (firstOfPart) body += '<p class="small muted" style="margin-bottom:14px">' + esc(p.help) + '</p>';
      if (p.id === 1) body += '<img class="photo" src="' + esc(sc.qs[0].img) + '" alt="Ảnh câu ' + sc.qs[0].n + '">';
      if (p.listen) {
        body += '<div class="audio-bar">' + (noTts ? '<span class="muted">Không có giọng đọc, hãy đọc lời thoại bên dưới.</span>'
          : '<button class="btn small' + (playing ? ' line' : '') + '" data-act="play">' + L.ui.icon(playing ? 'stop' : 'play') + (playing ? 'Dừng' : 'Nghe') + '</button><span class="muted">' +
            (playing ? 'Đang phát…' : 'Phím P để nghe lại') + '</span>') +
          (practice && !noTts ? '<button class="link-btn small" data-act="script">' + (scriptOpen ? 'Ẩn lời thoại' : 'Hiện lời thoại') + '</button>' : '') + '</div>';
        if (scriptOpen && (practice || noTts)) body += scriptHtml(sc);
      }
      if (sc.group && !p.listen) body += passageHtml(sc.group, p.id);
      body += sc.qs.map((q) => questionHtml(q, p, {
        chosen: d.answers[q.n],
        showText: scriptOpen || judged(q) || noTts,
        judge: judged(q),
        locked: judged(q),
      })).join('');
      const last = d.screen === screens.length - 1;
      root.innerHTML =
        '<div class="runner-top"><a class="icon-btn" href="#/test" aria-label="Lưu và thoát">' + L.ui.icon('x') + '</a>' +
        '<div style="flex:1;min-width:0"><div class="small" style="font-weight:600">' + esc(p.name) + '</div>' +
        '<div class="bar" style="margin-top:4px"><i style="width:' + (100 * answeredCount / allQs.length).toFixed(1) + '%"></i></div></div>' +
        '<span class="timer small" aria-label="Thời gian">' + (d.limit ? U.fmtClock(d.limit - d.elapsed) : U.fmtClock(d.elapsed)) + '</span>' +
        '<button class="icon-btn" data-act="sheet" aria-expanded="' + showSheet + '" aria-label="Phiếu trả lời">' + L.ui.icon('grid') + '</button></div>' +
        (showSheet ? '<div class="sheet" style="margin-bottom:20px"><div class="sheet-head"><h2 class="h2">Phiếu trả lời</h2><span class="small muted">' + answeredCount + '/' + allQs.length + ' câu</span></div>' +
          '<div style="padding:12px">' + omrHtml(allQs, d.answers, sc.qs.map((q) => q.n), false) + '</div>' +
          '<div class="sheet-foot"><button class="btn" data-act="submit">Nộp bài</button></div></div>' : '') +
        body +
        '<div class="next-bar" style="justify-content:space-between">' +
        '<button class="btn ghost" data-act="prev"' + (d.screen === 0 ? ' disabled' : '') + '>' + L.ui.icon('back') + 'Trước</button>' +
        (last ? '<button class="btn" data-act="submit">Nộp bài</button>' : '<button class="btn" data-act="next">Tiếp' + L.ui.icon('next') + '</button>') + '</div>';
    }

    function go(i) {
      L.speech.stop();
      playing = false;
      d.screen = Math.max(0, Math.min(screens.length - 1, i));
      L.store.save();
      draw();
      window.scrollTo(0, 0);
      const sc = screens[d.screen];
      if (sc.part.listen && L.speech.supported && (!practice || L.store.settings.autoplay) && !autoplayed[d.screen]) {
        autoplayed[d.screen] = true;
        setTimeout(playAudio, 300);
      }
    }

    function answer(n, k) {
      const q = allQs.find((x) => x.n === n);
      if (!q) return;
      if (practice && d.answers[n] !== undefined) return;
      d.answers[n] = k;
      L.store.save();
      draw(); // playback keeps going; the button label refreshes when it ends
    }

    function submit() {
      clearInterval(timer);
      L.speech.stop();
      const g = grade(d.parts, d.answers);
      const rec = Object.assign({ id: Date.now(), date: Date.now(), mode: d.mode, parts: d.parts, answers: d.answers, secs: Math.round(d.elapsed) }, g);
      st.tests.push(rec);
      st.draft = null;
      L.store.saveNow();
      location.hash = '#/test/review/' + rec.id;
    }

    root.addEventListener('click', (e) => {
      const o = e.target.closest('[data-q]');
      if (o) { answer(+o.dataset.q, +o.dataset.k); return; }
      const j = e.target.closest('[data-jump]');
      if (j) {
        const n = +j.dataset.jump;
        const idx = screens.findIndex((s) => s.qs.some((q) => q.n === n));
        showSheet = false;
        go(idx);
        const el = document.getElementById('q' + n);
        if (el) el.scrollIntoView({ block: 'center' });
        return;
      }
      const a = e.target.closest('[data-act]');
      if (!a) return;
      const act = a.dataset.act;
      if (act === 'next') go(d.screen + 1);
      else if (act === 'prev') go(d.screen - 1);
      else if (act === 'play') { if (playing) { L.speech.stop(); playing = false; draw(); } else playAudio(); }
      else if (act === 'script') { showScript[d.screen] = !showScript[d.screen]; draw(); }
      else if (act === 'sheet') { showSheet = !showSheet; draw(); }
      else if (act === 'submit') {
        const left = allQs.length - Object.keys(d.answers).length;
        if (left && !a.dataset.armed) { a.dataset.armed = '1'; a.textContent = 'Còn ' + left + ' câu trống, bấm lần nữa để nộp'; return; }
        submit();
      }
    });

    go(d.screen);
    return {
      onKey(ev) {
        const sc = screens[d.screen];
        if (ev.key === 'ArrowRight') go(d.screen + 1);
        else if (ev.key === 'ArrowLeft') go(d.screen - 1);
        else if (ev.key.toLowerCase() === 'p' && sc.part.listen) { if (!playing) playAudio(); }
        else if (sc.qs.length === 1) {
          const k = 'ABCD'.indexOf(ev.key.toUpperCase());
          const k2 = '1234'.indexOf(ev.key);
          const idx = k >= 0 ? k : k2;
          if (idx >= 0 && idx < sc.qs[0].o.length) answer(sc.qs[0].n, idx);
        }
      },
      destroy() { clearInterval(timer); L.speech.stop(); if (st.draft) { st.draft.elapsed = d.elapsed; L.store.saveNow(); } },
    };
  }

  // ------------------------------------------------------------ review
  function review(root, id) {
    const st = L.store.state;
    const t = st.tests.find((x) => String(x.id) === String(id));
    if (!t) { root.innerHTML = '<p class="empty">Không tìm thấy kết quả này. <a href="#/test">Về trang thi thử</a></p>'; return; }
    L.ui.setTitle('Kết quả thi thử');
    let filter = 'wrong';

    function draw() {
      const screens = screensFor(t.parts);
      const allQs = screens.flatMap((s) => s.qs);
      const total = t.sl != null && t.sr != null ? t.sl + t.sr : null;
      const d = new Date(t.date);
      const list = screens.filter((sc) => filter === 'all' || sc.qs.some((q) => t.answers[q.n] !== q.a));
      root.innerHTML =
        '<a class="small" href="#/test">Thi thử</a><h1 class="h1" style="margin-top:6px">Kết quả</h1>' +
        '<p class="lead">' + d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear() + ', ' + (t.mode === 'exam' ? 'thi thật' : 'luyện tập') + ', ' + U.fmtClock(t.secs) + '.</p>' +
        '<div style="display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin-bottom:6px">' +
        (total != null ? '<span class="score-big num">' + total + '</span><span class="muted">điểm ước tính trên 990</span>'
          : '<span class="score-big num">' + (t.lc + t.rc) + '/' + (t.lt + t.rt) + '</span><span class="muted">câu đúng</span>') + '</div>' +
        '<p class="small muted">Điểm quy đổi chỉ mang tính ước lượng theo bảng tham khảo, không phải điểm chính thức.</p>' +
        '<div class="part-score" style="margin:16px 0 8px">' +
        (t.lt ? '<span>Listening: ' + t.lc + '/' + t.lt + ' câu</span><b class="num">' + (t.sl != null ? t.sl + '/495' : Math.round(100 * t.lc / t.lt) + '%') + '</b>' : '') +
        (t.rt ? '<span>Reading: ' + t.rc + '/' + t.rt + ' câu</span><b class="num">' + (t.sr != null ? t.sr + '/495' : Math.round(100 * t.rc / t.rt) + '%') + '</b>' : '') +
        t.parts.map((pid) => { const [c, n] = t.per[pid]; return '<span class="muted">' + esc(partById(pid).name) + '</span><span class="num muted">' + c + '/' + n + '</span>'; }).join('') +
        '</div>' +
        '<details class="more"><summary>Phiếu trả lời</summary>' + omrHtml(allQs, t.answers, null, true) + '</details>' +
        '<div class="btn-row" style="margin:18px 0 8px"><button class="btn" data-act="again">Làm lại các phần này</button></div>' +
        '<div class="section-head section"><h2 class="h2">Xem lại</h2><div class="seg"><button class="' + (filter === 'wrong' ? 'on' : '') + '" data-f="wrong">Câu sai</button><button class="' + (filter === 'all' ? 'on' : '') + '" data-f="all">Tất cả</button></div></div>' +
        (list.length ? list.map((sc) => {
          const p = sc.part;
          let h = '<div class="review-q"><div class="small muted" style="margin-bottom:8px">' + esc(p.name) + '</div>';
          if (p.id === 1) h += '<img class="photo" style="max-width:320px" src="' + esc(sc.qs[0].img) + '" alt="">';
          if (p.listen) h += (L.speech.supported ? '<button class="btn small line" data-play="' + screens.indexOf(sc) + '" style="margin-bottom:10px">' + L.ui.icon('play') + 'Nghe lại</button>' : '') + scriptHtml(sc);
          if (sc.group && !p.listen) h += '<details class="more"' + (filter === 'all' ? '' : ' open') + '><summary>Đoạn văn</summary>' + passageHtml(sc.group, p.id) + '</details>';
          h += sc.qs.map((q) => {
            const ch = t.answers[q.n];
            const ok = ch === q.a;
            return questionHtml(q, p, { chosen: ch, showText: true, judge: true, locked: true }) +
              '<div class="ans small" style="margin:-14px 0 18px">' + (ch === undefined ? '<span class="no">Bỏ trống.</span> ' : ok ? '<span class="ok">Đúng.</span> ' : '<span class="no">Bạn chọn ' + LET[ch] + '.</span> ') +
              'Đáp án: <b>' + LET[q.a] + '</b></div>';
          }).join('');
          return h + '</div>';
        }).join('') : '<p class="empty">Không có câu sai nào. Rất tốt!</p>');
    }
    draw();

    root.addEventListener('click', (e) => {
      const f = e.target.closest('[data-f]');
      if (f) { filter = f.dataset.f; draw(); return; }
      const pl = e.target.closest('[data-play]');
      if (pl) { L.speech.play(audioParts(screensFor(t.parts)[+pl.dataset.play])); return; }
      if (e.target.closest('[data-act="again"]')) {
        st.draft = { parts: t.parts.slice(), mode: t.mode, answers: {}, elapsed: 0, screen: 0, limit: t.mode === 'exam' ? timeLimit(t.parts) : 0, started: Date.now() };
        L.store.saveNow();
        location.hash = '#/test/run';
      }
    });
    return { destroy() { L.speech.stop(); } };
  }

  L.views.test = {
    nav: 'test',
    render(root, ctx) {
      if (!T()) { root.innerHTML = '<p class="empty">Không tải được dữ liệu đề thi.</p>'; return; }
      const sub = ctx.parts[1];
      if (sub === 'run') { document.body.classList.add('focus'); return run(root); }
      if (sub === 'review') return review(root, ctx.parts[2]);
      return home(root);
    },
  };
})();
