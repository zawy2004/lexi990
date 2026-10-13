/* Boot, hash router, global handlers, offline support. */
(function () {
  'use strict';
  const L = window.Lexi;
  const U = L.util;

  const ROUTES = {
    '': 'today', library: 'library', lesson: 'lesson', study: 'study', practice: 'practice', quiz: 'quiz',
    test: 'test', dict: 'dict', word: 'word', settings: 'settings',
  };

  let current = null;
  const root = document.getElementById('view');

  function parseHash() {
    const h = location.hash.replace(/^#\/?/, '');
    const qi = h.indexOf('?');
    const path = qi < 0 ? h : h.slice(0, qi);
    const query = U.parseQuery(qi < 0 ? '' : h.slice(qi + 1));
    const parts = path.split('/').filter(Boolean);
    return { parts: parts.length ? parts : [''], query };
  }

  function updateChrome(view) {
    document.querySelectorAll('[data-nav]').forEach((a) => {
      const on = a.dataset.nav === view.nav;
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    const s = L.store.streak();
    const el = document.getElementById('streak');
    el.innerHTML = s ? L.ui.bub(3) + '<span class="num">' + s + '</span>' : '';
    el.title = s ? 'Học ' + s + ' ngày liên tiếp' : '';
  }

  function route() {
    if (current && current.destroy) { try { current.destroy(); } catch (e) { /* ignore */ } }
    current = null;
    L.speech.stop();
    const ctx = parseHash();
    const name = ROUTES[ctx.parts[0]] || 'today';
    const view = L.views[name];
    document.body.classList.toggle('focus', !!view.focus);
    updateChrome(view);
    root.innerHTML = '';
    try {
      current = view.render(root, ctx) || null;
    } catch (err) {
      console.error(err);
      root.innerHTML = '<div class="empty"><p>Đã có lỗi khi mở trang này.</p><p class="small">' + U.esc(err.message) + '</p><a class="btn" href="#/">Về trang hôm nay</a></div>';
    }
    L.ui.fillIcons(root);
    if (!ctx.query.keep) window.scrollTo(0, 0);
    root.focus({ preventScroll: true });
  }

  function boot() {
    if (!window.LEXI_DATA || !window.LEXI_DATA.s1500) {
      root.innerHTML = '<p class="empty">Không tải được dữ liệu từ vựng. Hãy tải lại trang.</p>';
      return;
    }
    L.store.load();
    L.lex.init();
    L.applyTheme();
    L.ui.fillIcons(document);

    document.addEventListener('click', (e) => {
      const say = e.target.closest('[data-say]');
      if (say) { e.preventDefault(); e.stopPropagation(); L.speech.speak(say.dataset.say); }
    }, true);

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (current && current.onKey) {
        const tag = e.target && e.target.tagName;
        if ((tag === 'SELECT' || tag === 'TEXTAREA') && e.key !== 'Escape') return;
        current.onKey(e);
      }
    });

    // Re-render "today" when the day changes or the tab comes back after a while.
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) { hiddenAt = Date.now(); return; }
      const name = ROUTES[parseHash().parts[0]] || 'today';
      if (name === 'today' && Date.now() - hiddenAt > 60 * 1000) route();
    });

    window.addEventListener('hashchange', route);
    route();

    if ('serviceWorker' in navigator && location.protocol === 'https:') {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
