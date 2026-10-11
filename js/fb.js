/* Lazy Firebase loader. Returns null when the config is still empty, so the site works without a backend. */
(function () {
  var V = '10.14.1', base = 'https://www.gstatic.com/firebasejs/' + V + '/';
  var cache = {};
  window.svFirebase = function (opts) {
    var cfg = window.SV_FIREBASE;
    if (!cfg || !cfg.apiKey || !cfg.projectId) return Promise.resolve(null);
    var needAuth = !!(opts && opts.auth), key = needAuth ? 'a' : 'p';
    if (cache[key]) return cache[key];
    var loads = [import(base + 'firebase-app.js'), import(base + 'firebase-firestore.js')];
    if (needAuth) loads.push(import(base + 'firebase-auth.js'));
    cache[key] = Promise.all(loads).then(function (m) {
      var app = m[0].getApps().length ? m[0].getApp() : m[0].initializeApp(cfg);
      var out = { app: app, fs: m[1], db: m[1].getFirestore(app) };
      if (needAuth) { out.au = m[2]; out.auth = m[2].getAuth(app); }
      return out;
    }).catch(function (e) { console.error('Firebase failed to load', e); window.svFirebaseError = e || true; return null; });
    return cache[key];
  };
})();
