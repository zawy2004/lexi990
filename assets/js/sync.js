/*
 * Cloud sync through a private (secret) GitHub Gist, so progress follows you to any device.
 * The token and gist id stay in this browser only (separate key, never exported).
 * Flow: on open → pull + merge; after every save → (debounced) pull + merge + push.
 */
(function () {
  'use strict';
  const L = window.Lexi;
  const KEY = 'lexi990.sync';
  const FILE = 'lexi990-progress.json';
  const API = 'https://api.github.com';
  const PUSH_DELAY = 4000;

  let cfg = null;      // { token, gistId, login, lastSync }
  let status = 'off';  // off | idle | syncing | error
  let lastError = '';
  let dirty = false;
  let busy = null;
  let pushTimer = null;
  let suppress = false; // ignore saves caused by our own merge
  const listeners = [];

  function loadCfg() {
    try { cfg = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { cfg = null; }
    status = cfg ? 'idle' : 'off';
  }
  function saveCfg() {
    try {
      if (cfg) localStorage.setItem(KEY, JSON.stringify(cfg)); else localStorage.removeItem(KEY);
    } catch (e) { /* ignore */ }
  }
  function emit() { listeners.forEach((fn) => { try { fn(); } catch (e) { /* ignore */ } }); }
  function setStatus(s, err) { status = s; lastError = err || ''; emit(); }

  async function api(path, opts, token) {
    const res = await fetch(API + path, Object.assign({
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: 'Bearer ' + (token || cfg.token),
        'Content-Type': 'application/json',
      },
    }, opts || {}));
    if (res.status === 401) throw new Error('Token không hợp lệ hoặc đã hết hạn.');
    if (res.status === 403 || res.status === 429) throw new Error('GitHub đang giới hạn yêu cầu, sẽ thử lại sau.');
    if (res.status === 404) { const e = new Error('Không tìm thấy gist (có thể đã bị xóa).'); e.code = 404; throw e; }
    if (!res.ok) throw new Error('GitHub trả lỗi ' + res.status + '.');
    return res.status === 204 ? null : res.json();
  }

  async function readGist() {
    const g = await api('/gists/' + cfg.gistId);
    const f = g.files && g.files[FILE];
    if (!f) return null;
    let text = f.content;
    if (f.truncated && f.raw_url) text = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
    try { return JSON.parse(text); } catch (e) { return null; }
  }

  async function writeGist() {
    const content = JSON.stringify(L.store.syncable());
    await api('/gists/' + cfg.gistId, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content } } }) });
  }

  /** Find this app's gist in the account, or create a new secret one. */
  async function ensureGist(token) {
    const gists = await api('/gists?per_page=100', null, token);
    const found = (gists || []).find((g) => g.files && g.files[FILE]);
    if (found) return found.id;
    const g = await api('/gists', {
      method: 'POST',
      body: JSON.stringify({ description: 'Lexi990 – tiến độ học (tự động đồng bộ)', public: false, files: { [FILE]: { content: JSON.stringify(L.store.syncable()) } } }),
    }, token);
    return g.id;
  }

  function mergeRemote(remote) {
    suppress = true;
    try { return L.store.mergeIn(remote); } finally { suppress = false; }
  }

  /** Pull, merge, and push if this device has anything the gist lacks. */
  async function run(push) {
    if (!cfg) return false;
    if (busy) { dirty = dirty || push; return busy; }
    busy = (async () => {
      setStatus('syncing');
      let changed = false;
      try {
        if (!cfg.gistId) { cfg.gistId = await ensureGist(); saveCfg(); }
        const remote = await readGist();
        changed = remote ? mergeRemote(remote) : false;
        const local = JSON.stringify(L.store.syncable());
        if (push || !remote || local !== JSON.stringify(remote)) {
          dirty = false;
          await writeGist();
        }
        cfg.lastSync = Date.now();
        saveCfg();
        setStatus('idle');
      } catch (err) {
        if (err.code === 404) { cfg.gistId = null; saveCfg(); }
        setStatus('error', navigator.onLine === false ? 'Đang ngoại tuyến, sẽ đồng bộ khi có mạng.' : (err.message || 'Không kết nối được GitHub.'));
        clearTimeout(pushTimer);
        if (!/Token/.test(err.message || '')) pushTimer = setTimeout(() => run(true), 2 * 60 * 1000);
      }
      return changed;
    })();
    try { return await busy; } finally {
      busy = null;
      if (dirty && status !== 'error') schedulePush();
    }
  }

  function schedulePush() {
    if (!cfg) return;
    dirty = true;
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => run(true), PUSH_DELAY);
  }

  /** Validate the token, find or create the gist, then do the first sync. */
  async function connect(token) {
    token = (token || '').trim();
    if (!token) throw new Error('Hãy dán token vào ô trên.');
    setStatus('syncing');
    try {
      const user = await api('/user', null, token);
      const gistId = await ensureGist(token);
      cfg = { token, gistId, login: user.login, lastSync: 0 };
      saveCfg();
    } catch (err) {
      setStatus(cfg ? 'idle' : 'off');
      throw err;
    }
    return run(false);
  }

  function disconnect() {
    clearTimeout(pushTimer);
    cfg = null;
    saveCfg();
    setStatus('off');
  }

  function init(onRemoteChange) {
    loadCfg();
    L.store.onSave(() => { if (!suppress) schedulePush(); });
    if (!cfg) return;
    run(false).then((changed) => { if (changed) onRemoteChange(); });
    let hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
      if (!cfg) return;
      if (document.hidden) {
        hiddenAt = Date.now();
        if (dirty) { clearTimeout(pushTimer); run(true); }
      } else if (Date.now() - hiddenAt > 30 * 1000) {
        run(false).then((changed) => { if (changed) onRemoteChange(); });
      }
    });
    window.addEventListener('online', () => { if (cfg) run(dirty); });
  }

  L.sync = {
    init, connect, disconnect,
    now: () => run(true),
    onChange(fn) { listeners.push(fn); return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); }; },
    get enabled() { return !!cfg; },
    get status() { return status; },
    get error() { return lastError; },
    get login() { return cfg && cfg.login; },
    get lastSync() { return cfg && cfg.lastSync; },
  };
})();
