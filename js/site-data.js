/* Public site data: loads rooms, reviews and content from Firestore, and sends bookings and messages.
   Everything is optional. With no Firebase config the page keeps its built-in text and the forms say
   they are not connected yet. All stored text is inserted with textContent, never innerHTML. */
(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  var EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var fbp = window.svFirebase ? window.svFirebase() : Promise.resolve(null);
  var connected = false;

  /* ---------- helpers ---------- */
  function throttled(key, ms) {
    try {
      var t = +localStorage.getItem(key) || 0;
      if (Date.now() - t < ms) return true;
    } catch (e) {}
    return false;
  }
  function stamp(key) { try { localStorage.setItem(key, String(Date.now())); } catch (e) {} }
  function say(el, text, bad) { el.textContent = text; el.style.color = bad ? 'var(--error)' : 'var(--jungle)'; }

  /* ---------- live content ---------- */
  function applyRooms(fb) {
    fb.fs.getDocs(fb.fs.collection(fb.db, 'rooms')).then(function (snap) {
      snap.forEach(function (d) {
        var r = d.data();
        document.querySelectorAll('[data-room]').forEach(function (el) {
          if (el.dataset.room !== r.name) return;
          el.dataset.rate = r.rate; el.dataset.sleeps = r.sleeps; el.dataset.status = r.status;
          var price = el.querySelector('.sv-price');
          if (price && price.firstChild) price.firstChild.textContent = '$' + r.rate + ' ';
          var pill = el.querySelector('.sv-pill');
          if (pill) {
            pill.className = 'sv-pill sv-pill--' + (r.status === 'booked' ? 'booked' : r.status === 'few' ? 'few' : 'available');
            pill.textContent = r.status === 'booked' ? 'Fully booked' : r.status === 'few' ? (r.note || 'Few nights left') : 'Available';
          }
        });
      });
    }).catch(function () {});
  }

  function applyReviews(fb) {
    var fs = fb.fs;
    fs.getDocs(fs.query(fs.collection(fb.db, 'reviews'), fs.where('published', '==', true))).then(function (snap) {
      var list = []; snap.forEach(function (d) { list.push(d.data()); });
      if (!list.length) return;
      list.sort(function (a, b) { return ((b.createdAt && b.createdAt.seconds) || 0) - ((a.createdAt && a.createdAt.seconds) || 0); });
      var quote = document.querySelector('.sv-quote'), snaps = document.querySelector('.sv-snaps');
      var first = list[0];
      if (quote) {
        quote.querySelector('.sv-quote__text').textContent = '“' + first.text + '”';
        var who = quote.querySelector('.sv-quote__who');
        if (who) {
          who.querySelector('.sv-avatar').textContent = (first.author || 'G').charAt(0).toUpperCase();
          var box = who.querySelector('span:last-child');
          while (box.firstChild) box.removeChild(box.firstChild);
          var s = document.createElement('strong'); s.textContent = first.author; box.appendChild(s);
          box.appendChild(document.createTextNode(first.detail || ''));
        }
      }
      if (snaps && snaps.firstElementChild) {
        var tpl = snaps.firstElementChild.cloneNode(true);
        while (snaps.firstChild) snaps.removeChild(snaps.firstChild);
        list.slice(1, 9).forEach(function (r) {
          var c = tpl.cloneNode(true);
          var stars = c.querySelectorAll('.sv-stars .sv-icon');
          stars.forEach(function (st, i) { st.style.opacity = i < r.stars ? '1' : '.25'; });
          c.querySelector('.sv-review__text').textContent = '“' + r.text + '”';
          c.querySelector('.sv-review__who').textContent = r.author + (r.detail ? ', ' + r.detail : '');
          c.classList.remove('fx'); c.classList.add('in');
          snaps.appendChild(c);
        });
      }
    }).catch(function () {});
  }

  function applyContent(fb) {
    fb.fs.getDoc(fb.fs.doc(fb.db, 'content', 'site')).then(function (s) {
      if (!s.exists()) return;
      var c = s.data();
      if (c.heroLede) { var l = document.querySelector('.sv-stage .sv-lede'); if (l) l.textContent = c.heroLede; }
      document.querySelectorAll('[data-copy]').forEach(function (b) {
        var isMail = b.dataset.copy.indexOf('@') > -1;
        var isWa = !isMail && /whatsapp/i.test(b.lastChild.textContent);
        var v = isMail ? c.email : isWa ? (c.whatsapp || c.phone) : c.phone;
        if (!v) return;
        b.dataset.copy = v;
        if (!isWa) b.lastChild.textContent = v;
      });
    }).catch(function () {});
  }

  fbp.then(function (fb) {
    connected = !!fb;
    if (!fb) return;
    applyRooms(fb); applyReviews(fb); applyContent(fb);
  });

  /* ---------- reserve dialog ---------- */
  var dlg = $('reserve-dialog'), form = $('rv-form'), pending = null;
  if (dlg && dlg.showModal && form) {
    var status = $('rv-status');
    document.addEventListener('sv:reserve', function (e) {
      pending = e.detail;
      $('rv-summary').textContent = pending.room + ', ' + pending.nights + (pending.nights === 1 ? ' night' : ' nights') + ', ' + pending.guests + (pending.guests === 1 ? ' guest' : ' guests') + ', $' + pending.total + ' total';
      say(status, connected ? '' : 'Online booking is not connected yet. Please send us a message instead.', !connected);
      form.querySelector('[type=submit]').disabled = !connected;
      dlg.showModal();
    });
    dlg.addEventListener('click', function (e) {
      var r = dlg.getBoundingClientRect();
      if (e.target.closest('[data-close]') || e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dlg.close();
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!pending) return;
      if (form.elements.website.value) return;                 /* honeypot: bots fill it, people never see it */
      var name = form.elements.name.value.trim(), email = form.elements.email.value.trim(), phone = form.elements.phone.value.trim(), notes = form.elements.notes.value.trim();
      if (name.length < 2 || name.length > 100) return say(status, 'Please enter your name.', true);
      if (!EMAIL.test(email) || email.length > 120) return say(status, 'Please enter a valid email.', true);
      if (!/^[0-9+()\-\s]{0,30}$/.test(phone)) return say(status, 'Phone can only contain numbers, spaces and + ( ) -', true);
      if (notes.length > 500) return say(status, 'Notes are limited to 500 characters.', true);
      if (throttled('svLastBooking', 30000)) return say(status, 'Please wait a few seconds before sending again.', true);
      fbp.then(function (fb) {
        if (!fb) return say(status, 'Online booking is not connected yet.', true);
        var btn = form.querySelector('[type=submit]'); btn.disabled = true;
        return fb.fs.addDoc(fb.fs.collection(fb.db, 'bookings'), {
          name: name, email: email, phone: phone, room: pending.room,
          checkIn: pending.checkIn, checkOut: pending.checkOut,
          guests: pending.guests, nights: pending.nights, total: pending.total,
          notes: notes, status: 'new', createdAt: fb.fs.serverTimestamp()
        }).then(function () {
          stamp('svLastBooking'); form.reset();
          say(status, 'Thank you. We have your request and will confirm within a few hours.');
          var m = $('bk-msg'); if (m) m.textContent = 'Request sent. We will confirm shortly.';
          setTimeout(function () { dlg.close(); }, 2200);
        }).catch(function () { say(status, 'Could not send. Please try again or message us.', true); })
          .then(function () { btn.disabled = false; });
      });
    });
  }

  /* ---------- contact form ---------- */
  var mf = $('msg-form');
  if (mf) {
    var ms = $('mf-status');
    if (!window.SV_FIREBASE || !window.SV_FIREBASE.apiKey) say(ms, 'Messaging is not connected yet.', true);
    mf.addEventListener('submit', function (e) {
      e.preventDefault();
      if (mf.elements.website.value) return;
      var name = mf.elements.name.value.trim(), email = mf.elements.email.value.trim(), msg = mf.elements.message.value.trim();
      if (name.length < 2 || name.length > 100) return say(ms, 'Please enter your name.', true);
      if (!EMAIL.test(email) || email.length > 120) return say(ms, 'Please enter a valid email.', true);
      if (msg.length < 5 || msg.length > 2000) return say(ms, 'Write a message between 5 and 2000 characters.', true);
      if (throttled('svLastMessage', 30000)) return say(ms, 'Please wait a few seconds before sending again.', true);
      fbp.then(function (fb) {
        if (!fb) return say(ms, 'Messaging is not connected yet.', true);
        var btn = mf.querySelector('[type=submit]'); btn.disabled = true;
        return fb.fs.addDoc(fb.fs.collection(fb.db, 'messages'), { name: name, email: email, message: msg, status: 'new', createdAt: fb.fs.serverTimestamp() })
          .then(function () { stamp('svLastMessage'); mf.reset(); say(ms, 'Thank you. We will reply by email soon.'); })
          .catch(function () { say(ms, 'Could not send. Please try again.', true); })
          .then(function () { btn.disabled = false; });
      });
    });
  }
})();
