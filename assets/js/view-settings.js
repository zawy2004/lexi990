/* "Cài đặt": study plan, audio, appearance, backup. */
(function () {
  'use strict';
  const L = window.Lexi;
  const { esc } = L.util;

  function applyTheme() {
    const t = L.store.settings.theme;
    if (t === 'auto') delete document.documentElement.dataset.theme;
    else document.documentElement.dataset.theme = t;
  }

  L.views.settings = {
    nav: '',
    render(root) {
      L.ui.setTitle('Cài đặt');
      const S = L.store.settings;

      function draw() {
        const voices = L.speech.englishVoices();
        const cur = L.speech.englishVoice();
        const vi = L.speech.vietnameseVoice();
        const totals = L.lex.totals();
        root.innerHTML =
          '<h1 class="h1">Cài đặt</h1><p class="lead">Mọi tiến độ được lưu ngay trên trình duyệt này. Hãy sao lưu nếu bạn muốn chuyển sang máy khác.</p>' +

          '<h2 class="h2">Kế hoạch học</h2><div class="spacer"></div>' +
          '<div class="field"><label for="newPerDay">Từ mới mỗi ngày: <span class="num" id="newPerDayV">' + S.newPerDay + '</span></label>' +
          '<input type="range" id="newPerDay" min="5" max="60" step="5" value="' + S.newPerDay + '">' +
          '<span class="hint">Với ' + S.newPerDay + ' từ/ngày, bạn gặp hết ' + totals.total + ' từ sau khoảng ' + Math.ceil(totals.total / S.newPerDay) + ' ngày.</span></div>' +
          '<div class="field"><label for="reviewLimit">Giới hạn lượt ôn mỗi ngày</label><select id="reviewLimit">' +
          [50, 100, 200, 400, 9999].map((n) => '<option value="' + n + '"' + (S.reviewLimit === n ? ' selected' : '') + '>' + (n === 9999 ? 'Không giới hạn' : n + ' lượt') + '</option>').join('') + '</select></div>' +
          '<div class="field"><label for="practiceGoal">Mục tiêu luyện tập mỗi ngày</label><select id="practiceGoal">' +
          [10, 20, 30, 50].map((n) => '<option value="' + n + '"' + (S.practiceGoal === n ? ' selected' : '') + '>' + n + ' câu</option>').join('') + '</select></div>' +
          '<div class="field"><span class="label">Lộ trình từ mới</span><span class="hint">Từ mới được lấy lần lượt theo thứ tự này. Từ trùng giữa các bộ chỉ học một lần.</span>' +
          '<div class="rows">' + S.course.map((sid, i) =>
            '<div class="row"><span class="obub" style="width:28px;height:28px"><span>' + (i + 1) + '</span></span><div class="row-main"><div class="row-title">' + esc(L.lex.sources[sid].title) + '</div></div>' +
            '<button class="icon-btn" data-move="' + i + ':-1" aria-label="Đưa lên"' + (i === 0 ? ' disabled' : '') + '>' + L.ui.icon('up') + '</button>' +
            '<button class="icon-btn" data-move="' + i + ':1" aria-label="Đưa xuống"' + (i === S.course.length - 1 ? ' disabled' : '') + '>' + L.ui.icon('down') + '</button></div>').join('') + '</div></div>' +
          '<div class="field"><span class="label">Mặt trước thẻ khi ôn</span><div class="seg">' +
          [['en-vi', 'Từ tiếng Anh'], ['vi-en', 'Nghĩa tiếng Việt'], ['mix', 'Trộn']].map(([v, n]) => '<button class="' + (S.direction === v ? 'on' : '') + '" data-dir="' + v + '">' + n + '</button>').join('') + '</div>' +
          '<span class="hint">Từ mới luôn hiện mặt tiếng Anh trước.</span></div>' +

          '<h2 class="h2 section">Âm thanh</h2>' +
          (L.speech.supported
            ? '<div class="field" style="margin-top:12px"><label for="voice">Giọng đọc tiếng Anh</label><select id="voice"><option value="">Tự chọn giọng tốt nhất</option>' +
              voices.map((v) => '<option value="' + esc(v.voiceURI) + '"' + (S.voice === v.voiceURI ? ' selected' : '') + '>' + esc(v.name) + ' (' + esc(v.lang) + ')</option>').join('') + '</select>' +
              '<span class="hint">Đang dùng: ' + esc(cur ? cur.name : 'mặc định của trình duyệt') + '. Giọng có chữ "Natural" hoặc "Google" thường nghe tự nhiên hơn.</span></div>' +
              '<div class="field"><label for="rate">Tốc độ đọc: <span class="num" id="rateV">' + S.rate.toFixed(2) + '</span></label><input type="range" id="rate" min="0.6" max="1.3" step="0.05" value="' + S.rate + '">' +
              '<div><button class="btn small line" data-act="test-voice">' + L.ui.icon('speaker') + 'Nghe thử</button></div></div>' +
              '<label class="switch"><span><span class="label" style="font-weight:600">Tự phát âm khi lật thẻ</span></span><input type="checkbox" id="autoplay"' + (S.autoplay ? ' checked' : '') + '></label>' +
              '<label class="switch"><span><span style="font-weight:600">Đọc nghĩa tiếng Việt khi nghe cả bài</span><br><span class="small muted">' + (vi ? 'Giọng: ' + esc(vi.name) : 'Máy này chưa có giọng đọc tiếng Việt.') + '</span></span><input type="checkbox" id="speakVi"' + (S.speakVi ? ' checked' : '') + (vi ? '' : ' disabled') + '></label>'
            : '<p class="muted">Trình duyệt này không hỗ trợ giọng đọc (Web Speech API). Hãy dùng Chrome, Edge hoặc Safari bản mới.</p>') +

          '<h2 class="h2 section">Giao diện</h2><div class="seg" style="margin-top:12px">' +
          [['auto', 'Theo máy'], ['light', 'Sáng'], ['dark', 'Tối']].map(([v, n]) => '<button class="' + (S.theme === v ? 'on' : '') + '" data-th="' + v + '">' + n + '</button>').join('') + '</div>' +

          '<h2 class="h2 section">Dữ liệu</h2><p class="small muted" style="margin-top:8px">' + (L.store.ok ? '' : 'Trình duyệt đang chặn lưu trữ, tiến độ sẽ mất khi đóng trang. ') +
          'Đã có ' + Object.keys(L.store.state.cards).length + ' từ có lịch ôn và ' + L.store.state.tests.length + ' bài thi thử.</p>' +
          '<div class="btn-row"><button class="btn line small" data-act="export">Tải bản sao lưu</button>' +
          '<label class="btn line small" style="cursor:pointer">Khôi phục từ tệp<input type="file" id="import" accept="application/json,.json" hidden></label>' +
          '<button class="btn ghost small" data-act="reset" style="color:var(--bad)">Xóa toàn bộ tiến độ</button></div>' +

          '<h2 class="h2 section">Nguồn nội dung</h2><dl class="kv" style="margin-top:10px">' +
          L.lex.SOURCE_ORDER.map((sid) => { const s = L.lex.sources[sid]; return '<dt>' + esc(s.short) + '</dt><dd>' + esc(s.title) + ': ' + s.items.length + ' mục, ' + s.lessons.length + ' bài</dd>'; }).join('') +
          '<dt>Thi thử</dt><dd>' + esc((window.LEXI_DATA.test || {}).title || '') + '</dd></dl>' +
          '<p class="small muted" style="margin-top:12px">Nội dung được biên soạn lại từ tài liệu học TOEIC phục vụ việc tự học. Lexi990 chạy hoàn toàn trên máy bạn và dùng được khi không có mạng sau lần mở đầu tiên.</p>';
      }
      draw();

      const set = (k, v) => { S[k] = v; L.store.save(); };

      root.addEventListener('input', (e) => {
        if (e.target.id === 'newPerDay') { set('newPerDay', +e.target.value); root.querySelector('#newPerDayV').textContent = e.target.value; }
        if (e.target.id === 'rate') { set('rate', +e.target.value); root.querySelector('#rateV').textContent = (+e.target.value).toFixed(2); }
      });
      root.addEventListener('change', (e) => {
        const id = e.target.id;
        if (id === 'newPerDay') draw();
        else if (id === 'reviewLimit' || id === 'practiceGoal') set(id, +e.target.value);
        else if (id === 'voice') { set('voice', e.target.value); draw(); L.speech.speak('This is how I sound.'); }
        else if (id === 'autoplay' || id === 'speakVi') set(id, e.target.checked);
        else if (id === 'import' && e.target.files[0]) {
          const reader = new FileReader();
          reader.onload = () => {
            try { L.store.importJSON(reader.result); applyTheme(); L.lex.invalidateCourse(); L.ui.toast('Đã khôi phục tiến độ'); draw(); }
            catch (err) { L.ui.toast(err.message || 'Không đọc được tệp sao lưu'); }
          };
          reader.readAsText(e.target.files[0]);
        }
      });
      root.addEventListener('click', (e) => {
        const mv = e.target.closest('[data-move]');
        if (mv) {
          const [i, d] = mv.dataset.move.split(':').map(Number);
          const c = S.course.slice();
          const j = i + d;
          [c[i], c[j]] = [c[j], c[i]];
          set('course', c);
          L.lex.invalidateCourse();
          draw();
          return;
        }
        const dir = e.target.closest('[data-dir]');
        if (dir) { set('direction', dir.dataset.dir); draw(); return; }
        const th = e.target.closest('[data-th]');
        if (th) { set('theme', th.dataset.th); applyTheme(); draw(); return; }
        const a = e.target.closest('[data-act]');
        if (!a) return;
        if (a.dataset.act === 'test-voice') L.speech.speak('Welcome to the TOEIC test. Please listen carefully.');
        if (a.dataset.act === 'export') {
          const blob = new Blob([L.store.exportJSON()], { type: 'application/json' });
          const link = document.createElement('a');
          link.href = URL.createObjectURL(blob);
          link.download = 'lexi990-' + L.util.dayKey() + '.json';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => { URL.revokeObjectURL(link.href); link.remove(); }, 500);
        }
        if (a.dataset.act === 'reset') {
          if (!a.dataset.armed) { a.dataset.armed = '1'; a.textContent = 'Bấm lần nữa để xóa hết'; return; }
          L.store.reset();
          L.ui.toast('Đã xóa tiến độ');
          draw();
        }
      });

      const onVoices = () => { if (document.body.contains(root) && !root.querySelector('select:focus')) draw(); };
      if (window.speechSynthesis && window.speechSynthesis.addEventListener) window.speechSynthesis.addEventListener('voiceschanged', onVoices);
      return { destroy() { if (window.speechSynthesis && window.speechSynthesis.removeEventListener) window.speechSynthesis.removeEventListener('voiceschanged', onVoices); } };
    },
  };

  L.applyTheme = applyTheme;
})();
