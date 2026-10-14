/* Sam Villa admin. Security notes:
   - Every piece of stored data is shown with textContent (never innerHTML), so stored text cannot run as script.
   - Real authorization is firestore.rules (admin uid document). This file only controls what the UI shows.
   - Sign-in uses session-only persistence, a client lockout after repeated failures, and a 15 minute idle logout. */
(function () {
  'use strict';
  var IDLE_MS = 15 * 60 * 1000;

  function $(id) { return document.getElementById(id); }
  function h(tag, props) {
    var el = document.createElement(tag);
    props = props || {};
    Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v === false || v == null) return;
      if (k === 'text') el.textContent = v;
      else if (k === 'class') el.className = v;
      else if (k === 'value') el.value = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) add(el, arguments[i]);
    return el;
  }
  function add(el, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach(function (x) { add(el, x); });
    else el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  function clear(el) { while (el.firstChild) el.removeChild(el.firstChild); }
  function show(id) { ['login-view', 'setup-view', 'dash-view'].forEach(function (v) { $(v).hidden = v !== id; }); }
  var toastT;
  function toast(msg, err) {
    var t = $('toast'); t.textContent = msg; t.className = 'ad-toast' + (err ? ' is-err' : ''); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3200);
  }
  function fmt(ts) { try { return ts && ts.toDate ? ts.toDate().toLocaleString() : ''; } catch (e) { return ''; } }
  function money(n) { return '$' + Number(n || 0).toLocaleString('en-US'); }
  function day(iso) { try { return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }); } catch (e) { return iso; } }
  function today() { var d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function pill(status) { return h('span', { class: 'ad-pill ad-pill--' + String(status).replace(/[^a-z]/g, ''), text: status }); }

  var fb = null, unsubs = [], idleT = null;
  var state = { bookings: [], messages: [] };   /* latest snapshots, shared by Overview and the lists */

  /* ---------- sign-in with lockout ---------- */
  function lockInfo() {
    try { return JSON.parse(sessionStorage.getItem('svAdminLock') || '{}'); } catch (e) { return {}; }
  }
  function setLock(o) { try { sessionStorage.setItem('svAdminLock', JSON.stringify(o)); } catch (e) {} }
  function bindLogin() {
    var form = $('login-form'), err = $('login-error'), btn = $('login-btn');
    function fail(m) { err.textContent = m; err.hidden = false; }
    form.addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true;
      var li = lockInfo();
      if (li.until && Date.now() < li.until) { fail('Too many attempts. Try again in ' + Math.ceil((li.until - Date.now()) / 1000) + ' seconds.'); return; }
      var email = $('login-email').value.trim(), pass = $('login-pass').value;
      if (!email || !pass) { fail('Enter your email and password.'); return; }
      btn.disabled = true;
      fb.au.signInWithEmailAndPassword(fb.auth, email, pass).then(function () {
        setLock({}); $('login-pass').value = '';
      }).catch(function () {
        var n = (li.n || 0) + 1, o = { n: n };
        if (n >= 5) { o.until = Date.now() + Math.min(60000 * Math.pow(2, n - 5), 15 * 60000); }
        setLock(o);
        fail('Email or password is incorrect.'); /* same message for every failure: no account enumeration */
      }).then(function () { btn.disabled = false; });
    });
  }

  /* ---------- idle logout ---------- */
  function armIdle() {
    clearTimeout(idleT);
    idleT = setTimeout(function () { fb.au.signOut(fb.auth); }, IDLE_MS);
  }
  ['click', 'keydown', 'pointerdown', 'scroll'].forEach(function (ev) {
    window.addEventListener(ev, function () { if (!$('dash-view').hidden) armIdle(); }, { passive: true });
  });

  /* ---------- session ---------- */
  function onUser(user) {
    stop();
    if (!user) { show('login-view'); return; }
    var fs = fb.fs;
    fs.getDoc(fs.doc(fb.db, 'admins', user.uid)).then(function (snap) {
      if (!snap.exists()) {
        fb.au.signOut(fb.auth);
        show('login-view');
        var e = $('login-error'); e.textContent = 'This account does not have admin access.'; e.hidden = false;
        return;
      }
      $('who').textContent = user.email || '';
      $('who-init').textContent = (user.email || 'A').charAt(0).toUpperCase();
      show('dash-view'); armIdle(); build();
    }).catch(function () {
      fb.au.signOut(fb.auth); show('login-view');
      var e = $('login-error'); e.textContent = 'Could not verify access. Try again.'; e.hidden = false;
    });
  }
  function stop() {
    unsubs.forEach(function (f) { try { f(); } catch (e) {} }); unsubs = [];
    ['overview', 'bookings', 'messages', 'rooms', 'reviews', 'content'].forEach(function (p) { clear($('panel-' + p)); });
    state = { bookings: [], messages: [] }; ov = null;
    go('overview');
    clearTimeout(idleT);
  }

  function bindShell() {
    $('logout').addEventListener('click', function () { fb.au.signOut(fb.auth); });
    document.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]'); if (b) go(b.dataset.tab);
    });
  }
  function go(tab) {
    document.querySelectorAll('.ad-tab').forEach(function (t) { var on = t.dataset.tab === tab; t.classList.toggle('is-on', on); t.setAttribute('aria-selected', String(on)); });
    document.querySelectorAll('.ad-panel').forEach(function (p) { p.hidden = p.id !== 'panel-' + tab; });
    window.scrollTo(0, 0);
    centerTab();
    if (tab === 'overview') renderRevenue();
  }
  /* On phones the tabs are a sideways strip: keep the selected one in view instead of cut off at the edge. */
  function centerTab() {
    var strip = $('tabs'), on = strip.querySelector('.is-on');
    if (!on || strip.scrollWidth <= strip.clientWidth) return;
    var sr = strip.getBoundingClientRect(), r = on.getBoundingClientRect();
    strip.scrollTo({ left: strip.scrollLeft + r.left - sr.left - (sr.width - r.width) / 2 });
  }
  var resizeT;
  window.addEventListener('resize', function () { clearTimeout(resizeT); resizeT = setTimeout(renderRevenue, 150); });

  function build() { overview(); bookings(); messages(); rooms(); reviews(); content(); }
  function head(p, title, sub, extra) {
    p.appendChild(h('div', { class: 'ad-bar' }, h('div', { class: 'ad-bar__t' }, h('h1', { class: 'ad-h', text: title }), sub ? h('p', { class: 'ad-muted', text: sub }) : null), extra || null));
  }

  /* ---------- overview ---------- */
  var ov = null;
  function overview() {
    var p = $('panel-overview');
    var hr = new Date().getHours();
    head(p, (hr < 12 ? 'Good morning' : hr < 18 ? 'Good afternoon' : 'Good evening'), new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }));
    ov = { stats: h('div', { class: 'ad-stats' }), arrivals: h('div', { class: 'ad-list' }), recent: h('div', { class: 'ad-list' }), rooms: h('div', { class: 'ad-bars' }), rev: h('div', { class: 'ad-rev' }), revHead: h('div', { class: 'ad-rev__head' }), range: 6 };
    var ranges = h('div', { class: 'ad-chips', role: 'group', 'aria-label': 'Chart range' });
    [6, 12].forEach(function (n) {
      var b = h('button', { class: 'ad-chip' + (n === ov.range ? ' is-on' : ''), type: 'button', 'aria-pressed': String(n === ov.range), text: n + ' months' });
      b.addEventListener('click', function () { ov.range = n; ranges.querySelectorAll('.ad-chip').forEach(function (c) { c.classList.toggle('is-on', c === b); c.setAttribute('aria-pressed', String(c === b)); }); renderRevenue(); });
      ranges.appendChild(b);
    });
    p.appendChild(ov.stats);
    p.appendChild(h('div', { class: 'ad-card' },
      h('div', { class: 'ad-bar' }, h('div', { class: 'ad-bar__t' }, h('h2', { class: 'ad-h2', text: 'Monthly revenue' }), h('p', { class: 'ad-muted ad-small', text: 'Paid bookings, by month of stay' })), ranges),
      ov.revHead, ov.rev));
    p.appendChild(h('div', { class: 'ad-cols' },
      h('div', { class: 'ad-card' }, h('div', { class: 'ad-bar' }, h('h2', { class: 'ad-h2', text: 'Upcoming arrivals' }), h('button', { class: 'ad-btn ad-btn--sm', type: 'button', 'data-tab': 'bookings', text: 'All bookings' })), ov.arrivals),
      h('div', { class: 'ad-card' }, h('div', { class: 'ad-bar' }, h('h2', { class: 'ad-h2', text: 'Latest messages' }), h('button', { class: 'ad-btn ad-btn--sm', type: 'button', 'data-tab': 'messages', text: 'Inbox' })), ov.recent)));
    p.appendChild(h('div', { class: 'ad-card' }, h('h2', { class: 'ad-h2', text: 'Bookings by room' }), ov.rooms));
    renderOverview();
  }
  function stat(label, value, note, tone, tab) {
    return h('button', { class: 'ad-stat' + (tone ? ' ad-stat--' + tone : ''), type: 'button', 'data-tab': tab },
      h('span', { class: 'ad-stat__l', text: label }), h('strong', { class: 'ad-stat__v', text: String(value) }), h('span', { class: 'ad-stat__n', text: note }));
  }
  function renderOverview() {
    if (!ov) return;
    var B = state.bookings, M = state.messages, t = today(), month = t.slice(0, 7);
    var live = B.filter(function (b) { return b.status !== 'cancelled'; });
    var fresh = B.filter(function (b) { return b.status === 'new'; }).length;
    var upcoming = live.filter(function (b) { return b.checkOut >= t; }).sort(function (a, b) { return a.checkIn < b.checkIn ? -1 : 1; });
    var inHouse = live.filter(function (b) { return b.checkIn <= t && b.checkOut > t; }).length;
    var paid = B.filter(function (b) { return b.status === 'paid' && (b.checkIn || '').slice(0, 7) === month; }).reduce(function (n, b) { return n + (b.total || 0); }, 0);
    var unread = M.filter(function (m) { return m.status === 'new'; }).length;
    clear(ov.stats);
    add(ov.stats, [
      stat('New requests', fresh, fresh ? 'Waiting for you' : 'All caught up', fresh ? 'hot' : '', 'bookings'),
      stat('Upcoming stays', upcoming.length, inHouse + ' in house today', '', 'bookings'),
      stat('Paid this month', money(paid), 'Stays starting in ' + new Date().toLocaleDateString(undefined, { month: 'long' }), 'good', 'bookings'),
      stat('Unread messages', unread, M.length + ' in total', unread ? 'hot' : '', 'messages')]);
    clear(ov.arrivals);
    if (!upcoming.length) ov.arrivals.appendChild(h('p', { class: 'ad-empty', text: 'No upcoming stays.' }));
    upcoming.slice(0, 6).forEach(function (b) {
      var d = new Date(b.checkIn + 'T00:00:00');
      ov.arrivals.appendChild(h('div', { class: 'ad-item' },
        h('span', { class: 'ad-date' }, h('b', { text: String(d.getDate()) }), d.toLocaleDateString(undefined, { month: 'short' })),
        h('span', { class: 'ad-item__b' }, h('strong', { text: b.name }), h('span', { class: 'ad-sub', text: b.room + ' · ' + b.nights + (b.nights === 1 ? ' night' : ' nights') + ' · ' + b.guests + ' guests' })),
        pill(b.status)));
    });
    clear(ov.recent);
    if (!M.length) ov.recent.appendChild(h('p', { class: 'ad-empty', text: 'No messages yet.' }));
    M.slice(0, 5).forEach(function (m) {
      ov.recent.appendChild(h('div', { class: 'ad-item' + (m.status === 'new' ? ' is-new' : '') },
        h('span', { class: 'ad-avatar', text: (m.name || '?').charAt(0).toUpperCase() }),
        h('span', { class: 'ad-item__b' }, h('strong', { text: m.name }), h('span', { class: 'ad-sub ad-clip', text: m.message })),
        h('span', { class: 'ad-sub', text: m.createdAt && m.createdAt.toDate ? m.createdAt.toDate().toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : '' })));
    });
    renderRevenue();
    clear(ov.rooms);
    var by = {}; live.forEach(function (b) { by[b.room] = (by[b.room] || 0) + 1; });
    var names = Object.keys(by).sort(function (a, b) { return by[b] - by[a]; }), max = Math.max.apply(null, names.map(function (n) { return by[n]; }).concat(1));
    if (!names.length) ov.rooms.appendChild(h('p', { class: 'ad-empty', text: 'No bookings yet.' }));
    names.forEach(function (n) {
      var bar = h('span', { class: 'ad-bars__fill' }); bar.style.width = (by[n] / max * 100) + '%';
      ov.rooms.appendChild(h('div', { class: 'ad-bars__row' }, h('span', { class: 'ad-bars__l', text: n }), h('span', { class: 'ad-bars__track' }, bar), h('b', { text: String(by[n]) })));
    });
  }

  /* ---------- monthly revenue chart (single series: paid totals by check-in month) ---------- */
  var SVG = 'http://www.w3.org/2000/svg';
  function sv(tag, attrs, text) {
    var el = document.createElementNS(SVG, tag);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (text != null) el.textContent = text;
    return el;
  }
  function short(n) { return n >= 1000 ? '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k' : '$' + n; }
  function niceMax(v) { if (v <= 0) return 100; var e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; }
  function renderRevenue() {
    if (!ov) return;
    var now = new Date(), months = [];
    for (var i = ov.range - 1; i >= 0; i--) {
      var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ key: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), label: d.toLocaleDateString(undefined, { month: 'short' }), full: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }), total: 0, count: 0 });
    }
    var byKey = {}; months.forEach(function (m) { byKey[m.key] = m; });
    state.bookings.forEach(function (b) {
      var m = b.status === 'paid' && byKey[(b.checkIn || '').slice(0, 7)];
      if (m) { m.total += b.total || 0; m.count++; }
    });
    var cur = months[months.length - 1], prev = months[months.length - 2], sum = months.reduce(function (n, m) { return n + m.total; }, 0);
    var delta = prev.total ? Math.round((cur.total - prev.total) / prev.total * 100) : null;
    clear(ov.revHead);
    add(ov.revHead, [
      h('div', {}, h('span', { class: 'ad-stat__l', text: 'This month' }), h('strong', { class: 'ad-rev__big', text: money(cur.total) }),
        h('span', { class: 'ad-delta' + (delta == null ? '' : delta >= 0 ? ' is-up' : ' is-down'), text: delta == null ? 'No paid stays last month' : (delta >= 0 ? '▲ ' : '▼ ') + Math.abs(delta) + '% vs ' + prev.label })),
      h('div', {}, h('span', { class: 'ad-stat__l', text: 'Last ' + ov.range + ' months' }), h('strong', { class: 'ad-rev__mid', text: money(sum) }), h('span', { class: 'ad-sub', text: 'Average ' + money(Math.round(sum / ov.range)) + ' a month' }))]);

    clear(ov.rev);
    var W = Math.max(300, Math.round(ov.rev.clientWidth) || 720), H = W < 500 ? 200 : 240, L = 48, R = 8, T = 12, B = 28, iw = W - L - R, ih = H - T - B;
    var max = niceMax(Math.max.apply(null, months.map(function (m) { return m.total; }))), step = iw / months.length, bw = Math.min(44, step * (W < 500 ? 0.62 : 0.56));
    var svg = sv('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'ad-chart', role: 'img', 'aria-label': 'Monthly paid revenue, last ' + ov.range + ' months' });
    [0, 0.5, 1].forEach(function (f) {
      var y = T + ih - f * ih;
      svg.appendChild(sv('line', { x1: L, x2: W - R, y1: y, y2: y, class: f ? 'ad-chart__grid' : 'ad-chart__base' }));
      svg.appendChild(sv('text', { x: L - 8, y: y + 4, 'text-anchor': 'end', class: 'ad-chart__tick' }, short(max * f)));
    });
    var tip = h('div', { class: 'ad-tip', hidden: true });
    months.forEach(function (m, i) {
      var x = L + i * step + (step - bw) / 2, bh = m.total / max * ih, y = T + ih - bh, cx = x + bw / 2;
      var g = sv('g', { class: 'ad-chart__col' + (m === cur ? ' is-cur' : ''), tabindex: '0', 'aria-label': m.full + ': ' + money(m.total) + ', ' + m.count + ' paid stays' });
      g.appendChild(sv('rect', { x: L + i * step, y: T, width: step, height: ih, class: 'ad-chart__hit' }));
      if (bh > 0) {
        var r = Math.min(4, bh, bw / 2);   /* rounded data end, square on the baseline */
        g.appendChild(sv('path', { class: 'ad-chart__bar', d: 'M' + x + ',' + (T + ih) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + bw - r) + 'Q' + (x + bw) + ',' + y + ' ' + (x + bw) + ',' + (y + r) + 'V' + (T + ih) + 'Z' }));
      }
      if (m === cur && m.total) g.appendChild(sv('text', { x: cx, y: y - 6, 'text-anchor': 'middle', class: 'ad-chart__val' }, short(m.total)));
      g.appendChild(sv('text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'ad-chart__tick' + (m === cur ? ' is-cur' : '') }, m.label));
      function show() {
        clear(tip); add(tip, [h('strong', { text: m.full }), h('span', { text: money(m.total) + ' · ' + m.count + (m.count === 1 ? ' paid stay' : ' paid stays') })]);
        tip.hidden = false;
        var box = ov.rev.getBoundingClientRect(), k = box.width / W;
        tip.style.left = Math.max(0, Math.min(box.width - tip.offsetWidth, cx * k - tip.offsetWidth / 2)) + 'px';
        tip.style.top = Math.max(0, (T + ih - bh) * k - tip.offsetHeight - 10) + 'px';
      }
      g.addEventListener('pointerenter', show); g.addEventListener('focus', show);
      g.addEventListener('pointerleave', function () { tip.hidden = true; }); g.addEventListener('blur', function () { tip.hidden = true; });
      svg.appendChild(g);
    });
    ov.rev.appendChild(svg); ov.rev.appendChild(tip);
    /* same numbers as a table, for screen readers */
    ov.rev.appendChild(h('table', { class: 'ad-sr' }, h('caption', { text: 'Monthly paid revenue' }),
      h('tbody', {}, months.map(function (m) { return h('tr', {}, h('th', { text: m.full }), h('td', { text: money(m.total) })); }))));
  }

  /* ---------- CSV export ---------- */
  function csv(rows, name) {
    var text = rows.map(function (r) { return r.map(function (v) { v = v == null ? '' : String(v); if (/^[=+\-@]/.test(v)) v = "'" + v; return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }).join(','); }).join('\r\n');
    var url = URL.createObjectURL(new Blob(['\ufeff' + text], { type: 'text/csv' }));
    var a = h('a', { href: url, download: name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function fail(e) { toast((e && e.code === 'permission-denied') ? 'Not allowed.' : 'Something went wrong. Try again.', true); }

  /* ---------- receipt email (EmailJS free plan) ---------- */
  function sendReceipt(id, b, btn) {
    var ej = (window.SV_PAY || {}).emailjs || {};
    if (!ej.publicKey || !ej.serviceId || !ej.templateId) return toast('Email is not set up yet. See ADMIN.md.', true);
    if (!confirm('Email a receipt to ' + b.email + '?')) return;
    btn.disabled = true;
    fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service_id: ej.serviceId, template_id: ej.templateId, user_id: ej.publicKey, template_params: {
        to_email: b.email, guest_name: b.name, reference: id.slice(0, 8).toUpperCase(), room: b.room,
        check_in: b.checkIn, check_out: b.checkOut, nights: b.nights, guests: b.guests, total: money(b.total), status: b.status
      } })
    }).then(function (r) { if (!r.ok) throw 0; toast('Receipt sent'); }).catch(function () { toast('Could not send the receipt.', true); })
      .then(function () { btn.disabled = false; });
  }

  /* ---------- bookings ---------- */
  var STATUSES = ['new', 'confirmed', 'paid', 'cancelled'];
  function bookings() {
    var fs = fb.fs, p = $('panel-bookings'), filter = 'all', term = '', docs = [];
    var body = h('tbody'), count = h('span', { class: 'ad-muted' });
    var search = h('input', { class: 'ad-search', type: 'search', placeholder: 'Search name, email, room or reference', 'aria-label': 'Search bookings' });
    var chips = h('div', { class: 'ad-chips', role: 'group', 'aria-label': 'Filter by status' });
    var exp = h('button', { class: 'ad-btn ad-btn--sm', type: 'button', text: 'Export CSV' });
    head(p, 'Bookings', 'Newest first. Change a status to confirm, mark paid or cancel.', exp);
    p.appendChild(h('div', { class: 'ad-tools' }, search, chips, count));
    p.appendChild(h('div', { class: 'ad-tablewrap' }, h('table', { class: 'ad-table' },
      h('thead', {}, h('tr', {}, ['Guest', 'Room', 'Stay', 'Total', 'Status', ''].map(function (t) { return h('th', { text: t }); }))), body)));
    search.addEventListener('input', function () { term = search.value.trim().toLowerCase(); render(); });
    exp.addEventListener('click', function () {
      csv([['Reference', 'Received', 'Name', 'Email', 'Phone', 'Room', 'Check-in', 'Check-out', 'Nights', 'Guests', 'Total USD', 'Status', 'Notes']].concat(shown().map(function (d) {
        var b = d.data(); return [d.id.slice(0, 8).toUpperCase(), fmt(b.createdAt), b.name, b.email, b.phone, b.room, b.checkIn, b.checkOut, b.nights, b.guests, b.total, b.status, b.notes];
      })), 'sam-villa-bookings-' + today() + '.csv');
    });
    function chipsDraw() {
      clear(chips);
      ['all'].concat(STATUSES).forEach(function (s) {
        var n = s === 'all' ? docs.length : docs.filter(function (d) { return d.data().status === s; }).length;
        var c = h('button', { class: 'ad-chip' + (s === filter ? ' is-on' : ''), type: 'button', 'aria-pressed': String(s === filter) }, s === 'all' ? 'All' : s, h('span', { text: String(n) }));
        c.addEventListener('click', function () { filter = s; chipsDraw(); render(); });
        chips.appendChild(c);
      });
    }
    function shown() {
      return docs.filter(function (d) {
        var b = d.data();
        if (filter !== 'all' && b.status !== filter) return false;
        return !term || [b.name, b.email, b.phone, b.room, d.id.slice(0, 8)].join(' ').toLowerCase().indexOf(term) > -1;
      });
    }
    function render() {
      clear(body); var list = shown();
      count.textContent = list.length + (list.length === 1 ? ' booking' : ' bookings');
      if (!list.length) body.appendChild(h('tr', {}, h('td', { colspan: 6, class: 'ad-empty', text: docs.length ? 'Nothing matches this filter.' : 'No bookings yet.' })));
      list.forEach(function (d) {
        var b = d.data();
        var sel = h('select', { class: 'ad-sel ad-sel--' + b.status, 'aria-label': 'Status' }, STATUSES.map(function (s) { return h('option', { value: s, text: s, selected: s === b.status }); }));
        sel.addEventListener('change', function () { fs.updateDoc(fs.doc(fb.db, 'bookings', d.id), { status: sel.value }).then(function () { toast('Status updated'); }).catch(fail); });
        var del = h('button', { class: 'ad-btn ad-btn--danger ad-btn--sm', type: 'button', text: 'Delete' });
        del.addEventListener('click', function () { if (confirm('Delete this booking permanently?')) fs.deleteDoc(fs.doc(fb.db, 'bookings', d.id)).catch(fail); });
        var rc = h('button', { class: 'ad-btn ad-btn--sm', type: 'button', text: 'Email receipt' });
        rc.addEventListener('click', function () { sendReceipt(d.id, b, rc); });
        body.appendChild(h('tr', { class: b.status === 'new' ? 'is-new' : '' },
          h('td', { class: 'ad-td-main' }, h('div', { class: 'ad-guest' }, h('span', { class: 'ad-avatar', text: (b.name || '?').charAt(0).toUpperCase() }), h('span', {},
            h('strong', { text: b.name }), h('span', { class: 'ad-sub', text: b.email }), h('span', { class: 'ad-sub', text: [b.phone, 'Ref ' + d.id.slice(0, 8).toUpperCase(), fmt(b.createdAt)].filter(Boolean).join(' · ') }),
            b.notes ? h('span', { class: 'ad-sub ad-msg ad-note', text: b.notes }) : null))),
          h('td', { 'data-label': 'Room' }, h('span', { class: 'ad-roomtag' + (b.room === 'Whole Villa' ? ' is-villa' : ''), text: b.room })),
          h('td', { 'data-label': 'Stay' }, day(b.checkIn) + ' → ' + day(b.checkOut), h('span', { class: 'ad-sub', text: b.nights + (b.nights === 1 ? ' night, ' : ' nights, ') + b.guests + (b.guests === 1 ? ' guest' : ' guests') })),
          h('td', { 'data-label': 'Total' }, h('strong', { text: money(b.total) })),
          h('td', { 'data-label': 'Status' }, sel), h('td', { class: 'ad-td-actions' }, h('div', { class: 'ad-actions' }, rc, del))));
      });
    }
    var q = fs.query(fs.collection(fb.db, 'bookings'), fs.orderBy('createdAt', 'desc'), fs.limit(500));
    unsubs.push(fs.onSnapshot(q, function (snap) {
      docs = []; snap.forEach(function (d) { docs.push(d); });
      state.bookings = docs.map(function (d) { return d.data(); });
      var fresh = state.bookings.filter(function (b) { return b.status === 'new'; }).length;
      var c = $('bk-count'); c.textContent = fresh; c.hidden = !fresh;
      chipsDraw(); render(); renderOverview();
    }, fail));
  }

  /* ---------- messages ---------- */
  function messages() {
    var fs = fb.fs, p = $('panel-messages');
    var body = h('tbody');
    head(p, 'Messages', 'Sent from the contact form. Reply opens your email app.');
    p.appendChild(h('div', { class: 'ad-tablewrap' }, h('table', { class: 'ad-table' },
      h('thead', {}, h('tr', {}, ['Received', 'From', 'Message', 'Status', ''].map(function (t) { return h('th', { text: t }); }))), body)));
    var q = fs.query(fs.collection(fb.db, 'messages'), fs.orderBy('createdAt', 'desc'), fs.limit(200));
    unsubs.push(fs.onSnapshot(q, function (snap) {
      clear(body); var fresh = 0; state.messages = [];
      if (snap.empty) body.appendChild(h('tr', {}, h('td', { colspan: 5, class: 'ad-empty', text: 'No messages yet.' })));
      snap.forEach(function (d) {
        var m = d.data(); if (m.status === 'new') fresh++; state.messages.push(m);
        var reply = h('a', { class: 'ad-btn ad-btn--primary ad-btn--sm', href: 'mailto:' + encodeURIComponent(m.email).replace(/%40/g, '@') + '?subject=' + encodeURIComponent('Re: your message to Sam Villa'), text: 'Reply' });
        var toggle = h('button', { class: 'ad-btn ad-btn--sm', type: 'button', text: m.status === 'new' ? 'Mark read' : 'Mark new' });
        toggle.addEventListener('click', function () { fs.updateDoc(fs.doc(fb.db, 'messages', d.id), { status: m.status === 'new' ? 'read' : 'new' }).catch(fail); });
        var del = h('button', { class: 'ad-btn ad-btn--danger ad-btn--sm', type: 'button', text: 'Delete' });
        del.addEventListener('click', function () { if (confirm('Delete this message permanently?')) fs.deleteDoc(fs.doc(fb.db, 'messages', d.id)).catch(fail); });
        body.appendChild(h('tr', { class: m.status === 'new' ? 'is-new' : '' },
          h('td', { 'data-label': 'Received', text: fmt(m.createdAt) }),
          h('td', { class: 'ad-td-main' }, h('strong', { text: m.name }), h('span', { class: 'ad-sub', text: m.email })),
          h('td', { class: 'ad-msg ad-td-full', text: m.message }),
          h('td', { 'data-label': 'Status' }, pill(m.status)),
          h('td', { class: 'ad-td-actions' }, h('div', { class: 'ad-actions' }, reply, toggle, del))));
      });
      var c = $('ms-count'); c.textContent = fresh; c.hidden = !fresh;
      renderOverview();
    }, fail));
  }

  /* ---------- rooms and rates ---------- */
  var DEFAULT_ROOMS = [
    { id: 'garden-suite', name: 'Garden Suite', rate: 85, sleeps: 2, status: 'available' },
    { id: 'family-room', name: 'Family Room', rate: 120, sleeps: 4, status: 'few' },
    { id: 'veranda-room', name: 'Veranda Room', rate: 70, sleeps: 2, status: 'booked' },
    { id: 'whole-villa', name: 'Whole Villa', rate: 250, sleeps: 8, status: 'available' }
  ];
  function rooms() {
    var fs = fb.fs, p = $('panel-rooms'), grid = h('div', { class: 'ad-grid' });
    var have = {};
    var seed = h('button', { class: 'ad-btn', type: 'button', text: 'Add missing default rooms', hidden: true });
    head(p, 'Rooms and rates', 'Changes show on the public site straight away. Rates are per night.', seed);
    p.appendChild(grid);
    seed.addEventListener('click', function () {
      Promise.all(DEFAULT_ROOMS.filter(function (r) { return !have[r.id]; }).map(function (r) { return fs.setDoc(fs.doc(fb.db, 'rooms', r.id), { name: r.name, rate: r.rate, sleeps: r.sleeps, status: r.status }); }))
        .then(function () { toast('Rooms added'); }).catch(fail);
    });
    unsubs.push(fs.onSnapshot(fs.collection(fb.db, 'rooms'), function (snap) {
      clear(grid); have = {};
      snap.forEach(function (d) { have[d.id] = true; });
      seed.hidden = DEFAULT_ROOMS.every(function (r) { return have[r.id]; });
      snap.forEach(function (d) {
        var r = d.data();
        var rate = h('input', { type: 'number', min: 1, max: 100000, step: 1, value: r.rate });
        var sleeps = h('input', { type: 'number', min: 1, max: 12, step: 1, value: r.sleeps });
        var status = h('select', {}, [['available', 'Available'], ['few', 'Few nights left'], ['booked', 'Fully booked']].map(function (o) { return h('option', { value: o[0], text: o[1], selected: o[0] === r.status }); }));
        var note = h('input', { type: 'text', maxlength: 80, value: r.note || '', placeholder: 'e.g. 2 nights left in November' });
        var save = h('button', { class: 'ad-btn ad-btn--primary', type: 'submit', text: 'Save' });
        var form = h('form', { class: 'ad-form' },
          h('div', { class: 'ad-bar' }, h('h2', { class: 'ad-h2', text: r.name }), h('span', { class: 'ad-pill ad-pill--' + r.status, text: r.status === 'few' ? 'few left' : r.status })),
          h('div', { class: 'ad-two' }, h('label', { class: 'ad-field' }, h('span', { text: 'Rate per night ($)' }), rate), h('label', { class: 'ad-field' }, h('span', { text: 'Sleeps' }), sleeps)),
          h('label', { class: 'ad-field' }, h('span', { text: 'Availability' }), status),
          h('label', { class: 'ad-field' }, h('span', { text: 'Note (optional)' }), note), save);
        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var data = { name: r.name, rate: Number(rate.value), sleeps: parseInt(sleeps.value, 10), status: status.value };
          if (note.value.trim()) data.note = note.value.trim();
          if (!(data.rate >= 1 && data.rate <= 100000) || !(data.sleeps >= 1 && data.sleeps <= 12)) { toast('Check the rate and sleeps values.', true); return; }
          fs.setDoc(fs.doc(fb.db, 'rooms', d.id), data).then(function () { toast(r.name + ' saved'); }).catch(fail);
        });
        grid.appendChild(h('div', { class: 'ad-card' }, form));
      });
    }, fail));
  }

  /* ---------- reviews ---------- */
  function reviews() {
    var fs = fb.fs, p = $('panel-reviews'), list = h('div', { class: 'ad-grid' });
    head(p, 'Reviews', 'Only published reviews appear on the site. Use real guest reviews.');
    p.appendChild(h('div', { class: 'ad-card' }, reviewForm(null, null)));
    p.appendChild(list);
    unsubs.push(fs.onSnapshot(fs.collection(fb.db, 'reviews'), function (snap) {
      clear(list);
      var docs = []; snap.forEach(function (d) { docs.push(d); });
      docs.sort(function (a, b) { var x = a.data().createdAt, y = b.data().createdAt; return (y && y.seconds || 0) - (x && x.seconds || 0); });
      docs.forEach(function (d) {
        var r = d.data();
        list.appendChild(h('div', { class: 'ad-card' }, h('div', { class: 'ad-bar' }, h('strong', { text: r.author }), pill(r.published ? 'live' : 'draft')), reviewForm(d.id, r)));
      });
    }, fail));
  }
  function reviewForm(id, r) {
    var fs = fb.fs;
    var author = h('input', { type: 'text', maxlength: 80, required: true, value: r ? r.author : '' });
    var detail = h('input', { type: 'text', maxlength: 120, value: r ? (r.detail || '') : '', placeholder: 'e.g. Stayed in the Garden Suite' });
    var text = h('textarea', { maxlength: 400, required: true }); text.value = r ? r.text : '';
    var stars = h('select', {}, [5, 4, 3, 2, 1].map(function (n) { return h('option', { value: n, text: n + (n === 1 ? ' star' : ' stars'), selected: r ? r.stars === n : n === 5 }); }));
    var pub = h('input', { type: 'checkbox', checked: r ? !!r.published : true });
    var save = h('button', { class: 'ad-btn ad-btn--primary', type: 'submit', text: id ? 'Save' : 'Add review' });
    var del = id ? h('button', { class: 'ad-btn ad-btn--danger', type: 'button', text: 'Delete' }) : null;
    var form = h('form', { class: 'ad-form' },
      h('div', { class: 'ad-two' }, h('label', { class: 'ad-field' }, h('span', { text: 'Guest name' }), author), h('label', { class: 'ad-field' }, h('span', { text: 'Rating' }), stars)),
      h('label', { class: 'ad-field' }, h('span', { text: 'Detail (optional)' }), detail),
      h('label', { class: 'ad-field' }, h('span', { text: 'Review' }), text),
      h('label', { class: 'ad-check' }, pub, 'Published'),
      h('div', { class: 'ad-actions' }, save, del));
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = { author: author.value.trim(), text: text.value.trim(), stars: parseInt(stars.value, 10), published: pub.checked };
      if (detail.value.trim()) data.detail = detail.value.trim();
      if (!data.author || data.text.length < 5) { toast('Add a name and a review.', true); return; }
      var op;
      if (id) { op = fs.setDoc(fs.doc(fb.db, 'reviews', id), Object.assign({ createdAt: r.createdAt || fs.serverTimestamp() }, data)); }
      else { data.createdAt = fs.serverTimestamp(); op = fs.addDoc(fs.collection(fb.db, 'reviews'), data); }
      op.then(function () { toast('Review saved'); if (!id) form.reset(); }).catch(fail);
    });
    if (del) del.addEventListener('click', function () { if (confirm('Delete this review?')) fs.deleteDoc(fs.doc(fb.db, 'reviews', id)).catch(fail); });
    return form;
  }

  /* ---------- content ---------- */
  function content() {
    var fs = fb.fs, p = $('panel-content');
    var lede = h('textarea', { maxlength: 200 }), phone = h('input', { type: 'text', maxlength: 30 }), wa = h('input', { type: 'text', maxlength: 30 }), email = h('input', { type: 'email', maxlength: 120 });
    var save = h('button', { class: 'ad-btn ad-btn--primary', type: 'submit', text: 'Save content' });
    var form = h('form', { class: 'ad-form' },
      h('label', { class: 'ad-field' }, h('span', { text: 'Hero line under the headline' }), lede),
      h('div', { class: 'ad-two' }, h('label', { class: 'ad-field' }, h('span', { text: 'Phone' }), phone), h('label', { class: 'ad-field' }, h('span', { text: 'WhatsApp number' }), wa)),
      h('label', { class: 'ad-field' }, h('span', { text: 'Email' }), email), save);
    head(p, 'Site content', 'Leave a field empty to keep the default text on the site.');
    p.appendChild(h('div', { class: 'ad-card' }, form));
    fs.getDoc(fs.doc(fb.db, 'content', 'site')).then(function (s) {
      var c = s.exists() ? s.data() : {};
      lede.value = c.heroLede || ''; phone.value = c.phone || ''; wa.value = c.whatsapp || ''; email.value = c.email || '';
    }).catch(fail);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var data = { heroLede: lede.value.trim(), phone: phone.value.trim(), whatsapp: wa.value.trim(), email: email.value.trim() };
      fs.setDoc(fs.doc(fb.db, 'content', 'site'), data).then(function () { toast('Content saved'); }).catch(fail);
    });
  }

  /* ---------- start ----------
     The sign-in card shows straight away with "Connecting...", so the page is never blank. If Firebase cannot
     load (offline, or a browser extension blocking www.gstatic.com / googleapis.com), the card says so. */
  var ready = false;
  function loadFailed() {
    if (ready) return;
    show('login-view');
    $('login-status').hidden = true;
    var e = $('login-error');
    e.textContent = 'Could not reach the sign-in service. Check your connection and reload. If you use an ad blocker or privacy extension, allow this site and reload.';
    e.hidden = false;
  }
  var loadT = setTimeout(loadFailed, 12000);
  window.svFirebase({ auth: true }).then(function (r) {
    if (!r) {
      clearTimeout(loadT);
      if (window.svFirebaseError) loadFailed(); else show('setup-view');
      return;
    }
    fb = r;
    bindLogin(); bindShell();
    fb.au.setPersistence(fb.auth, fb.au.browserSessionPersistence).catch(function () {}).then(function () {
      fb.au.onAuthStateChanged(fb.auth, function (user) {
        if (!ready) { ready = true; clearTimeout(loadT); $('login-status').hidden = true; $('login-btn').disabled = false; }
        onUser(user);
      });
    });
  });
})();
