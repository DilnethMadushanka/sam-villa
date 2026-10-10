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
  function pill(status) { return h('span', { class: 'ad-pill ad-pill--' + String(status).replace(/[^a-z]/g, ''), text: status }); }

  var fb = null, unsubs = [], idleT = null;

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
      show('dash-view'); armIdle(); build();
    }).catch(function () {
      fb.au.signOut(fb.auth); show('login-view');
      var e = $('login-error'); e.textContent = 'Could not verify access. Try again.'; e.hidden = false;
    });
  }
  function stop() {
    unsubs.forEach(function (f) { try { f(); } catch (e) {} }); unsubs = [];
    ['bookings', 'messages', 'rooms', 'reviews', 'content'].forEach(function (p) { clear($('panel-' + p)); });
    clearTimeout(idleT);
  }

  function bindShell() {
    $('logout').addEventListener('click', function () { fb.au.signOut(fb.auth); });
    $('tabs').addEventListener('click', function (e) {
      var b = e.target.closest('[data-tab]'); if (!b) return;
      document.querySelectorAll('.ad-tab').forEach(function (t) { t.classList.toggle('is-on', t === b); t.setAttribute('aria-selected', String(t === b)); });
      document.querySelectorAll('.ad-panel').forEach(function (p) { p.hidden = p.id !== 'panel-' + b.dataset.tab; });
    });
  }

  function build() { bookings(); messages(); rooms(); reviews(); content(); }
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
  function bookings() {
    var fs = fb.fs, p = $('panel-bookings');
    var body = h('tbody');
    p.appendChild(h('div', { class: 'ad-bar' }, h('h1', { class: 'ad-h', text: 'Bookings' }), h('p', { class: 'ad-muted', text: 'Newest first. Change a status to confirm or cancel.' })));
    p.appendChild(h('div', { class: 'ad-tablewrap' }, h('table', { class: 'ad-table' },
      h('thead', {}, h('tr', {}, ['Received', 'Guest', 'Room', 'Stay', 'Total', 'Status', ''].map(function (t) { return h('th', { text: t }); }))), body)));
    var q = fs.query(fs.collection(fb.db, 'bookings'), fs.orderBy('createdAt', 'desc'), fs.limit(200));
    unsubs.push(fs.onSnapshot(q, function (snap) {
      clear(body); var fresh = 0;
      if (snap.empty) body.appendChild(h('tr', {}, h('td', { colspan: 7, class: 'ad-empty', text: 'No bookings yet.' })));
      snap.forEach(function (d) {
        var b = d.data(); if (b.status === 'new') fresh++;
        var sel = h('select', { class: 'ad-sel', 'aria-label': 'Status' }, ['new', 'confirmed', 'paid', 'cancelled'].map(function (s) { return h('option', { value: s, text: s, selected: s === b.status }); }));
        sel.addEventListener('change', function () { fs.updateDoc(fs.doc(fb.db, 'bookings', d.id), { status: sel.value }).then(function () { toast('Status updated'); }).catch(fail); });
        var del = h('button', { class: 'ad-btn ad-btn--danger ad-btn--sm', type: 'button', text: 'Delete' });
        del.addEventListener('click', function () { if (confirm('Delete this booking permanently?')) fs.deleteDoc(fs.doc(fb.db, 'bookings', d.id)).catch(fail); });
        var rc = h('button', { class: 'ad-btn ad-btn--sm', type: 'button', text: 'Email receipt' });
        rc.addEventListener('click', function () { sendReceipt(d.id, b, rc); });
        body.appendChild(h('tr', { class: b.status === 'new' ? 'is-new' : '' },
          h('td', { text: fmt(b.createdAt) }),
          h('td', {}, h('strong', { text: b.name }), h('span', { class: 'ad-sub', text: b.email }), h('span', { class: 'ad-sub', text: b.phone || '' }), b.notes ? h('span', { class: 'ad-sub ad-msg', text: 'Note: ' + b.notes }) : null),
          h('td', { text: b.room }),
          h('td', {}, b.checkIn + ' to ' + b.checkOut, h('span', { class: 'ad-sub', text: b.nights + ' nights, ' + b.guests + ' guests' })),
          h('td', { text: money(b.total) }),
          h('td', {}, sel), h('td', {}, rc, ' ', del)));
      });
      var c = $('bk-count'); c.textContent = fresh; c.hidden = !fresh;
    }, fail));
  }

  /* ---------- messages ---------- */
  function messages() {
    var fs = fb.fs, p = $('panel-messages');
    var body = h('tbody');
    p.appendChild(h('div', { class: 'ad-bar' }, h('h1', { class: 'ad-h', text: 'Messages' }), h('p', { class: 'ad-muted', text: 'Sent from the contact form.' })));
    p.appendChild(h('div', { class: 'ad-tablewrap' }, h('table', { class: 'ad-table' },
      h('thead', {}, h('tr', {}, ['Received', 'From', 'Message', 'Status', ''].map(function (t) { return h('th', { text: t }); }))), body)));
    var q = fs.query(fs.collection(fb.db, 'messages'), fs.orderBy('createdAt', 'desc'), fs.limit(200));
    unsubs.push(fs.onSnapshot(q, function (snap) {
      clear(body); var fresh = 0;
      if (snap.empty) body.appendChild(h('tr', {}, h('td', { colspan: 5, class: 'ad-empty', text: 'No messages yet.' })));
      snap.forEach(function (d) {
        var m = d.data(); if (m.status === 'new') fresh++;
        var toggle = h('button', { class: 'ad-btn ad-btn--sm', type: 'button', text: m.status === 'new' ? 'Mark read' : 'Mark new' });
        toggle.addEventListener('click', function () { fs.updateDoc(fs.doc(fb.db, 'messages', d.id), { status: m.status === 'new' ? 'read' : 'new' }).catch(fail); });
        var del = h('button', { class: 'ad-btn ad-btn--danger ad-btn--sm', type: 'button', text: 'Delete' });
        del.addEventListener('click', function () { if (confirm('Delete this message permanently?')) fs.deleteDoc(fs.doc(fb.db, 'messages', d.id)).catch(fail); });
        body.appendChild(h('tr', { class: m.status === 'new' ? 'is-new' : '' },
          h('td', { text: fmt(m.createdAt) }),
          h('td', {}, h('strong', { text: m.name }), h('span', { class: 'ad-sub', text: m.email })),
          h('td', { class: 'ad-msg', text: m.message }),
          h('td', {}, pill(m.status)),
          h('td', {}, h('div', { class: 'ad-actions' }, toggle, del))));
      });
      var c = $('ms-count'); c.textContent = fresh; c.hidden = !fresh;
    }, fail));
  }

  /* ---------- rooms and rates ---------- */
  var DEFAULT_ROOMS = [
    { id: 'garden-suite', name: 'Garden Suite', rate: 85, sleeps: 2, status: 'available' },
    { id: 'family-room', name: 'Family Room', rate: 120, sleeps: 4, status: 'few' },
    { id: 'veranda-room', name: 'Veranda Room', rate: 70, sleeps: 2, status: 'booked' }
  ];
  function rooms() {
    var fs = fb.fs, p = $('panel-rooms'), grid = h('div', { class: 'ad-grid' });
    var seed = h('button', { class: 'ad-btn', type: 'button', text: 'Add the three default rooms', hidden: true });
    p.appendChild(h('div', { class: 'ad-bar' }, h('h1', { class: 'ad-h', text: 'Rooms and rates' }), seed));
    p.appendChild(h('p', { class: 'ad-muted', text: 'Changes show on the public site straight away. Rates are per night.' }));
    p.appendChild(grid);
    seed.addEventListener('click', function () {
      Promise.all(DEFAULT_ROOMS.map(function (r) { return fs.setDoc(fs.doc(fb.db, 'rooms', r.id), { name: r.name, rate: r.rate, sleeps: r.sleeps, status: r.status }); }))
        .then(function () { toast('Rooms added'); }).catch(fail);
    });
    unsubs.push(fs.onSnapshot(fs.collection(fb.db, 'rooms'), function (snap) {
      clear(grid); seed.hidden = !snap.empty;
      snap.forEach(function (d) {
        var r = d.data();
        var rate = h('input', { type: 'number', min: 1, max: 100000, step: 1, value: r.rate });
        var sleeps = h('input', { type: 'number', min: 1, max: 12, step: 1, value: r.sleeps });
        var status = h('select', {}, [['available', 'Available'], ['few', 'Few nights left'], ['booked', 'Fully booked']].map(function (o) { return h('option', { value: o[0], text: o[1], selected: o[0] === r.status }); }));
        var note = h('input', { type: 'text', maxlength: 80, value: r.note || '', placeholder: 'e.g. 2 nights left in November' });
        var save = h('button', { class: 'ad-btn ad-btn--primary', type: 'submit', text: 'Save' });
        var form = h('form', { class: 'ad-form' },
          h('h2', { class: 'ad-h2', text: r.name }),
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
    p.appendChild(h('div', { class: 'ad-bar' }, h('h1', { class: 'ad-h', text: 'Reviews' })));
    p.appendChild(h('p', { class: 'ad-muted', text: 'Only published reviews appear on the site. Use real guest reviews.' }));
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
    p.appendChild(h('div', { class: 'ad-bar' }, h('h1', { class: 'ad-h', text: 'Site content' })));
    p.appendChild(h('p', { class: 'ad-muted', text: 'Leave a field empty to keep the default text on the site.' }));
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

  /* ---------- start ---------- */
  window.svFirebase({ auth: true }).then(function (r) {
    if (!r) { show('setup-view'); return; }
    fb = r;
    bindLogin(); bindShell();
    fb.au.setPersistence(fb.auth, fb.au.browserSessionPersistence).catch(function () {}).then(function () {
      fb.au.onAuthStateChanged(fb.auth, onUser);
    });
  });
})();
