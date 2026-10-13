/* "Hôm nay": the daily answer sheet, current lesson, progress and weak words. */
(function () {
  'use strict';
  const L = window.Lexi;
  const U = L.util;
  const { esc } = U;

  function calendar() {
    const log = L.store.state.log;
    const end = new Date(); end.setHours(0, 0, 0, 0);
    const start = new Date(end);
    start.setDate(start.getDate() - ((end.getDay() + 6) % 7) - 7 * 11); // Monday, 11 weeks back
    let html = '';
    const todayKey = U.dayKey();
    for (let i = 0; i < 84; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const k = U.dayKey(d);
      const e = log[k];
      const n = e ? e.new + e.rev + e.quiz : 0;
      const future = d > end;
      const lv = future || n === 0 ? 0 : n < 20 ? 1 : n < 60 ? 2 : 3;
      const label = d.getDate() + '/' + (d.getMonth() + 1) + ': ' + (n ? n + ' lượt học' : 'không học');
      html += '<i class="bub l' + lv + (k === todayKey ? ' today' : '') + '" title="' + label + '"' + (future ? ' style="visibility:hidden"' : '') + '></i>';
    }
    return '<div class="cal" role="img" aria-label="Lịch học 12 tuần gần đây">' + html + '</div>';
  }

  function forecast() {
    const cards = L.store.state.cards;
    const sod = U.startOfDay();
    const counts = [0, 0, 0, 0, 0, 0, 0];
    Object.values(cards).forEach((c) => {
      if (!c.s) return;
      const i = Math.max(0, Math.floor((c.due - sod) / U.DAY));
      if (i < 7) counts[i]++;
    });
    return '<div class="forecast">' + counts.map((n, i) => {
      const d = new Date(sod + i * U.DAY);
      const lbl = i === 0 ? 'Hôm nay' : i === 1 ? 'Mai' : U.WEEKDAYS[d.getDay()];
      return '<div><b>' + n + '</b><span>' + lbl + '</span></div>';
    }).join('') + '</div>';
  }

  function progressBar(t) {
    const pct = (n) => (100 * n / Math.max(1, t.total)).toFixed(2) + '%';
    return '<div class="bar" aria-hidden="true"><i class="g" style="width:' + pct(t.levels[3]) + '"></i><i style="width:' + pct(t.levels[2]) + '"></i><i class="s" style="width:' + pct(t.levels[1]) + '"></i></div>';
  }

  L.views.today = {
    nav: 'today',
    render(root) {
      L.ui.setTitle('Hôm nay');
      const st = L.store.state;
      const S = st.settings;
      const now = Date.now();
      const t = L.store.today();
      const due = L.lex.dueKeys(now).length;
      const dueCapped = Math.min(due, Math.max(0, S.reviewLimit - t.rev));
      const newLeft = Math.max(0, S.newPerDay - t.new);
      const newAvail = L.lex.nextNew(newLeft).length;
      const learned = L.quiz.scopeKeys('learned').length;
      const totals = L.lex.totals();
      const seen = totals.levels[1] + totals.levels[2] + totals.levels[3];
      const first = seen === 0;

      const revFill = t.rev + due ? Math.round(10 * t.rev / (t.rev + due)) : 0;
      const newDots = Math.min(S.newPerDay, 20);
      const newFill = Math.round(newDots * Math.min(1, t.new / S.newPerDay));
      const quizFill = Math.round(10 * Math.min(1, t.quiz / S.practiceGoal));
      const d = new Date();
      const dateStr = U.WEEKDAYS[d.getDay()] + ', ' + d.getDate() + '/' + (d.getMonth() + 1);

      let mainBtn;
      if (dueCapped + newAvail > 0) {
        const parts = [];
        if (dueCapped) parts.push('ôn ' + dueCapped);
        if (newAvail) parts.push(newAvail + ' từ mới');
        mainBtn = '<a class="btn" href="#/study">Bắt đầu học</a><span class="muted small">' + parts.join(', ') + '</span>';
      } else if (learned >= 4) {
        mainBtn = '<a class="btn" href="#/quiz?scope=learned&mode=mix&n=' + S.practiceGoal + '">Luyện ' + S.practiceGoal + ' câu</a><span class="muted small">Đã xong phần ôn và từ mới hôm nay</span>';
      } else {
        mainBtn = '<a class="btn" href="#/study?extra=10">Học thêm 10 từ</a>';
      }

      const cur = L.lex.currentLesson();
      let curHtml = '';
      if (cur) {
        const p = L.lex.lessonProgress(cur);
        curHtml =
          '<section class="section"><div class="section-head"><h2 class="h2">Bài đang học</h2><a class="small" href="#/library?src=' + cur.src + '">Tất cả bài</a></div>' +
          '<div class="rows"><a class="row" href="#/lesson/' + esc(cur.id) + '"><div class="row-main">' +
          '<div class="row-title">' + esc(cur.title) + '</div><div class="row-sub">' + esc(L.lex.SOURCE_SHORT[cur.src]) + (cur.sub ? ', ' + esc(cur.sub) : '') + '</div>' +
          L.ui.dots(cur.keys) + '</div><div class="row-side num">' + p.known + '/' + p.total + '</div></a></div></section>';
      }

      const weak = L.quiz.weakKeys(6);
      let weakHtml = '';
      if (weak.length) {
        weakHtml =
          '<section class="section"><div class="section-head"><h2 class="h2">Từ hay sai</h2>' +
          (weak.length >= 4 ? '<a class="small" href="#/quiz?scope=weak&mode=mix&n=12">Luyện các từ này</a>' : '') + '</div><div class="rows">' +
          weak.map((k) => {
            const e = L.lex.entry(k);
            const s = st.stats[k] || { c: 0, w: 0 };
            return '<a class="row" href="#/word/' + encodeURIComponent(k) + '">' + L.ui.bub(L.lex.level(k)) +
              '<div class="row-main"><span class="row-word">' + esc(e.w) + '</span> <span class="muted small">' + esc(L.lex.shortMeaning(k)) + '</span></div>' +
              '<div class="row-side num">sai ' + s.w + '</div></a>';
          }).join('') + '</div></section>';
      }

      const intro = first
        ? '<section class="section"><h2 class="h2">Cách học với Lexi990</h2><div class="rows">' +
          '<div class="row"><div class="row-main"><div class="row-title">Mỗi ngày học ' + S.newPerDay + ' từ mới</div><div class="row-sub">Đi lần lượt theo lộ trình: ' + S.course.map((s) => L.lex.SOURCE_SHORT[s]).join(', rồi ') + '. Đổi lộ trình và số từ trong Cài đặt.</div></div></div>' +
          '<div class="row"><div class="row-main"><div class="row-title">Ôn đúng lúc sắp quên</div><div class="row-sub">Sau mỗi thẻ, bạn tự chấm Quên, Khó, Nhớ hoặc Dễ. App tính ngày ôn lại cho từng từ.</div></div></div>' +
          '<div class="row"><div class="row-main"><div class="row-title">Luyện tập và thi thử</div><div class="row-sub">7 dạng câu hỏi tự tạo từ dữ liệu, cùng đề thi thử 200 câu có giọng đọc phần nghe.</div></div></div>' +
          '</div></section>'
        : '';

      root.innerHTML =
        '<h1 class="h1">Phiếu học hôm nay</h1><p class="lead">' + dateStr + '. ' +
        (L.store.streak() ? 'Bạn đã học ' + L.store.streak() + ' ngày liên tiếp.' : 'Học một chút mỗi ngày để giữ chuỗi.') + '</p>' +
        '<div class="sheet">' +
        '<div class="sheet-head"><h2 class="h2">Việc cần làm</h2><span class="small muted">' + seen + '/' + totals.total + ' từ đã gặp</span></div>' +
        '<div class="sheet-row"><span class="label">Ôn tập</span>' + L.ui.meter(10, revFill) + '<span class="count num">' +
        (due ? due + ' từ đến hạn' : t.rev ? 'Đã ôn ' + t.rev + ' lượt' : 'Chưa có từ đến hạn') + '</span></div>' +
        '<div class="sheet-row"><span class="label">Từ mới</span>' + L.ui.meter(newDots, newFill) + '<span class="count num">' + t.new + '/' + S.newPerDay + '</span></div>' +
        '<div class="sheet-row"><span class="label">Luyện tập</span>' + L.ui.meter(10, quizFill) + '<span class="count num">' + t.quiz + '/' + S.practiceGoal + ' câu</span></div>' +
        '<div class="sheet-foot">' + mainBtn + '</div>' +
        '</div>' +
        intro + curHtml +
        '<section class="section"><div class="section-head"><h2 class="h2">Tiến độ</h2><span class="small muted num">' + totals.total + ' từ và cụm từ</span></div>' +
        '<div class="stat-line"><div><b>' + seen + '</b><span>đã gặp</span></div><div><b>' + (totals.levels[2] + totals.levels[3]) + '</b><span>đã nhớ</span></div><div><b>' + totals.levels[3] + '</b><span>thuộc lòng</span></div><div><b>' + L.store.streak() + '</b><span>ngày liên tiếp</span></div></div>' +
        L.lex.SOURCE_ORDER.map((sid) => {
          const s = L.lex.sourceTotals(sid);
          const k = s.levels[1] + s.levels[2] + s.levels[3];
          return '<a class="row" href="#/library?src=' + sid + '"><div class="row-main"><div class="row-title">' + esc(L.lex.sources[sid].title) + '</div>' + progressBar(s) + '</div><div class="row-side num">' + k + '/' + s.total + '</div></a>';
        }).join('') +
        '</section>' +
        weakHtml +
        '<section class="section"><div class="section-head"><h2 class="h2">12 tuần gần đây</h2></div>' + calendar() + '</section>' +
        (seen ? '<section class="section"><div class="section-head"><h2 class="h2">Lịch ôn 7 ngày tới</h2></div>' + forecast() + '</section>' : '');
    },
  };
})();
