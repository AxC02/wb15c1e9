'use strict';
(function () {
  var KEY = 'whiteboard-data-v1';
  var COLORS = ['yellow', 'pink', 'green', 'blue', 'purple'];
  var HEX = { yellow: '#ffe680', pink: '#ffb8d2', green: '#b8f0c2', blue: '#b5dcff', purple: '#d9c2ff' };
  var $ = function (id) { return document.getElementById(id); };
  var uid = function () { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); };

  function blank(name) { return { id: uid(), name: name, notes: [], view: { x: 0, y: 60, z: 1 } }; }
  var data;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { data = null; }
  if (!valid(data)) { var b = blank('My board'); data = { boards: [b], current: b.id }; }
  function valid(d) { return d && Array.isArray(d.boards) && d.boards.length > 0; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch (e) {} }
  function board() { return data.boards.find(function (b) { return b.id === data.current; }) || (data.current = data.boards[0].id, data.boards[0]); }

  var vp = $('viewport'), world = $('world');
  function applyView() {
    var v = board().view;
    world.style.transform = 'translate(' + v.x + 'px,' + v.y + 'px) scale(' + v.z + ')';
    var g = 24 * v.z;
    vp.style.backgroundSize = g + 'px ' + g + 'px';
    vp.style.backgroundPosition = v.x + 'px ' + v.y + 'px';
    $('zoomReset').textContent = Math.round(v.z * 100) + '%';
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function noteHTML(n) {
    var h = n.title ? '<h3>' + esc(n.title) + '</h3>' : '';
    if (n.kind === 'list') h += '<div class="body"><ul>' + n.items.map(function (i) { return '<li class="' + (i.done ? 'done' : '') + '">' + esc(i.text) + '</li>'; }).join('') + '</ul></div>';
    else h += '<div class="body">' + esc(n.text || '') + '</div>';
    return h + '<div class="rz" data-rz></div>';
  }
  function render() {
    var b = board();
    $('boardName').textContent = b.name;
    world.innerHTML = '';
    b.notes.forEach(function (n) {
      var el = document.createElement('div');
      el.className = 'note c-' + n.color; el.dataset.id = n.id;
      el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; el.style.width = n.w + 'px'; el.style.minHeight = n.h + 'px';
      el.innerHTML = noteHTML(n);
      world.appendChild(el);
    });
    $('empty').style.display = b.notes.length ? 'none' : '';
    applyView();
  }

  // ---- Gestures ----
  var pts = new Map(), g = null;
  function local(cx, cy) { var v = board().view; return { x: (cx - v.x) / v.z, y: (cy - v.y) / v.z }; }
  function startPinch() {
    var a = Array.from(pts.values()), v = board().view;
    if (g && g.el) g.el.classList.remove('drag');
    g = { type: 'pinch', d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, mx: (a[0].x + a[1].x) / 2, my: (a[0].y + a[1].y) / 2, v: { x: v.x, y: v.y, z: v.z } };
  }
  vp.addEventListener('pointerdown', function (e) {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { vp.setPointerCapture(e.pointerId); } catch (_) {}
    if (pts.size === 2) { startPinch(); return; }
    if (pts.size > 2) return;
    var noteEl = e.target.closest('.note');
    if (noteEl) {
      var n = board().notes.find(function (x) { return x.id === noteEl.dataset.id; });
      g = { type: e.target.hasAttribute('data-rz') ? 'resize' : 'note', el: noteEl, n: n, sx: e.clientX, sy: e.clientY, ox: n.x, oy: n.y, ow: n.w, oh: noteEl.offsetHeight, moved: false };
      // bring to front
      var arr = board().notes; arr.splice(arr.indexOf(n), 1); arr.push(n); world.appendChild(noteEl);
    } else {
      var v = board().view;
      g = { type: 'pan', sx: e.clientX, sy: e.clientY, ox: v.x, oy: v.y };
    }
    e.preventDefault();
  });
  vp.addEventListener('pointermove', function (e) {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (!g) return;
    var v = board().view;
    if (g.type === 'pinch' && pts.size >= 2) {
      var a = Array.from(pts.values());
      var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y), mx = (a[0].x + a[1].x) / 2, my = (a[0].y + a[1].y) / 2;
      var z = Math.min(3, Math.max(0.25, g.v.z * d / g.d));
      var wx = (g.mx - g.v.x) / g.v.z, wy = (g.my - g.v.y) / g.v.z;
      v.z = z; v.x = mx - wx * z; v.y = my - wy * z; applyView(); return;
    }
    var dx = e.clientX - g.sx, dy = e.clientY - g.sy;
    if (g.type === 'pan') { v.x = g.ox + dx; v.y = g.oy + dy; applyView(); return; }
    if (!g.moved && Math.hypot(dx, dy) < 8) return;
    g.moved = true;
    if (g.type === 'note') {
      g.el.classList.add('drag');
      g.n.x = Math.round(g.ox + dx / v.z); g.n.y = Math.round(g.oy + dy / v.z);
      g.el.style.left = g.n.x + 'px'; g.el.style.top = g.n.y + 'px';
    } else if (g.type === 'resize') {
      g.n.w = Math.max(140, Math.round(g.ow + dx / v.z)); g.n.h = Math.max(110, Math.round(g.oh + dy / v.z));
      g.el.style.width = g.n.w + 'px'; g.el.style.minHeight = g.n.h + 'px';
    }
  });
  function end(e) {
    if (!pts.has(e.pointerId)) return;
    pts.delete(e.pointerId);
    if (g && (g.type === 'note' || g.type === 'resize') && pts.size === 0) {
      g.el.classList.remove('drag');
      if (!g.moved && g.type === 'note' && e.type === 'pointerup') openEdit(g.n.id);
      save();
    }
    if (g && g.type === 'pinch') {
      save();
      if (pts.size === 1) { var p = Array.from(pts.values())[0], v = board().view; g = { type: 'pan', sx: p.x, sy: p.y, ox: v.x, oy: v.y }; return; }
    }
    if (g && g.type === 'pan') save();
    if (pts.size === 0) g = null;
  }
  vp.addEventListener('pointerup', end); vp.addEventListener('pointercancel', end);
  vp.addEventListener('wheel', function (e) {
    e.preventDefault(); var v = board().view;
    if (e.ctrlKey) { var z = Math.min(3, Math.max(0.25, v.z * Math.exp(-e.deltaY / 100))); zoomAt(e.clientX, e.clientY, z); }
    else { v.x -= e.deltaX; v.y -= e.deltaY; applyView(); }
    save();
  }, { passive: false });
  ['gesturestart', 'gesturechange'].forEach(function (t) { document.addEventListener(t, function (e) { e.preventDefault(); }); });
  function zoomAt(cx, cy, z) { var v = board().view, w = local(cx, cy); v.z = z; v.x = cx - w.x * z; v.y = cy - w.y * z; applyView(); }
  var cx = function () { return innerWidth / 2; }, cy = function () { return innerHeight / 2; };
  $('zoomIn').onclick = function () { zoomAt(cx(), cy(), Math.min(3, board().view.z * 1.25)); save(); };
  $('zoomOut').onclick = function () { zoomAt(cx(), cy(), Math.max(0.25, board().view.z / 1.25)); save(); };
  $('zoomReset').onclick = function () { zoomAt(cx(), cy(), 1); save(); };

  // ---- Sheets ----
  var shownAt = 0;
  function show(id) { $(id).hidden = false; shownAt = Date.now(); }
  function hide(id) { $(id).hidden = true; }
  document.querySelectorAll('.sheet').forEach(function (s) {
    s.addEventListener('click', function (e) { if ((e.target === s && Date.now() - shownAt > 450) || e.target.hasAttribute('data-close')) { s.hidden = true; if (s.id === 'editSheet') closeEdit(); } });
  });
  function swatches(box, cur, onPick) {
    box.innerHTML = '';
    COLORS.forEach(function (c) {
      var b = document.createElement('button'); b.type = 'button'; b.style.background = HEX[c]; b.setAttribute('aria-label', c);
      if (c === cur) b.className = 'on';
      b.onclick = function () { onPick(c); swatches(box, c, onPick); };
      box.appendChild(b);
    });
  }

  // ---- Add note ----
  var newColor = 'yellow';
  $('add').onclick = function () { swatches($('colorPick'), newColor, function (c) { newColor = c; }); show('colorSheet'); };
  document.querySelectorAll('#colorSheet [data-kind]').forEach(function (btn) {
    btn.onclick = function () {
      var b = board(), p = local(cx(), cy()), off = (b.notes.length % 6) * 16;
      var n = { id: uid(), color: newColor, kind: btn.dataset.kind, title: '', text: '', items: [], x: Math.round(p.x - 100 + off), y: Math.round(p.y - 90 + off), w: 200, h: 160 };
      b.notes.push(n); save(); render(); hide('colorSheet'); openEdit(n.id, true);
    };
  });

  // ---- Edit note ----
  var cur = null;
  function findNote(id) { return board().notes.find(function (n) { return n.id === id; }); }
  function openEdit(id, fresh) {
    cur = findNote(id); if (!cur) return;
    $('edTitle').value = cur.title; $('edText').value = cur.text;
    swatches($('edColors'), cur.color, function (c) { cur.color = c; save(); render(); });
    setMode(cur.kind); show('editSheet');
    if (fresh) setTimeout(function () { $('edTitle').focus(); }, 50);
  }
  function setMode(m) {
    cur.kind = m;
    document.querySelectorAll('.seg button').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === m); });
    $('edText').hidden = m !== 'text'; $('edList').hidden = m !== 'list';
    if (m === 'list' && !cur.items.length && cur.text.trim()) {
      cur.items = cur.text.split('\n').filter(function (s) { return s.trim(); }).map(function (s) { return { id: uid(), text: s.trim(), done: false }; });
    }
    drawItems(); save(); render();
  }
  document.querySelectorAll('.seg button').forEach(function (b) { b.onclick = function () { setMode(b.dataset.mode); }; });
  $('edTitle').oninput = function () { cur.title = this.value; save(); render(); };
  $('edText').oninput = function () { cur.text = this.value; save(); render(); };
  function drawItems() {
    var ul = $('items'); ul.innerHTML = '';
    cur.items.forEach(function (it) {
      var li = document.createElement('li'); if (it.done) li.className = 'done';
      li.innerHTML = '<button type="button" class="chk">' + (it.done ? '☑' : '☐') + '</button><span class="txt">' + esc(it.text) + '</span><button type="button" class="del" aria-label="Delete item">✕</button>';
      li.querySelector('.chk').onclick = function () { it.done = !it.done; save(); drawItems(); render(); };
      li.querySelector('.txt').onclick = li.querySelector('.chk').onclick;
      li.querySelector('.del').onclick = function () { cur.items.splice(cur.items.indexOf(it), 1); save(); drawItems(); render(); };
      ul.appendChild(li);
    });
  }
  $('addItem').onsubmit = function (e) {
    e.preventDefault(); var v = $('itemIn').value.trim(); if (!v) return;
    cur.items.push({ id: uid(), text: v, done: false }); $('itemIn').value = ''; save(); drawItems(); render(); $('itemIn').focus();
  };
  $('delNote').onclick = function () {
    if (!confirm('Delete this note?')) return;
    var a = board().notes; a.splice(a.indexOf(cur), 1); cur = null; save(); hide('editSheet'); render();
  };
  function closeEdit() {
    if (cur && $('itemIn').value.trim()) { cur.items.push({ id: uid(), text: $('itemIn').value.trim(), done: false }); $('itemIn').value = ''; }
    cur = null; save(); render(); document.activeElement && document.activeElement.blur();
  }

  // ---- Boards ----
  function drawBoards() {
    var ul = $('boards'); ul.innerHTML = '';
    data.boards.forEach(function (b) {
      var li = document.createElement('li'); if (b.id === data.current) li.className = 'cur';
      li.innerHTML = '<button type="button" class="open"></button><button type="button" class="act ren">Rename</button><button type="button" class="act rm">Delete</button>';
      li.querySelector('.open').textContent = b.name + ' (' + b.notes.length + ')';
      li.querySelector('.open').onclick = function () { data.current = b.id; save(); render(); hide('boardSheet'); };
      li.querySelector('.ren').onclick = function () { var n = prompt('Board name', b.name); if (n && n.trim()) { b.name = n.trim(); save(); drawBoards(); render(); } };
      li.querySelector('.rm').onclick = function () {
        if (data.boards.length === 1) { alert('You need at least one board.'); return; }
        if (!confirm('Delete "' + b.name + '" and all its notes?')) return;
        data.boards.splice(data.boards.indexOf(b), 1); if (data.current === b.id) data.current = data.boards[0].id; save(); drawBoards(); render();
      };
      ul.appendChild(li);
    });
  }
  $('boardBtn').onclick = function () { drawBoards(); show('boardSheet'); };
  $('newBoard').onclick = function () { var n = prompt('New board name', 'Board ' + (data.boards.length + 1)); if (!n || !n.trim()) return; var b = blank(n.trim()); data.boards.push(b); data.current = b.id; save(); render(); hide('boardSheet'); };
  $('exportBtn').onclick = function () {
    var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'whiteboard-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  };
  $('importBtn').onclick = function () { $('importFile').click(); };
  $('importFile').onchange = function () {
    var f = this.files[0]; if (!f) return;
    f.text().then(function (t) {
      var d = JSON.parse(t); if (!valid(d)) throw 0;
      if (!confirm('Replace all boards with this backup?')) return;
      data = d; if (!data.cal) data.cal = {}; if (!findB(data.current)) data.current = data.boards[0].id; save(); render(); drawCal(); hide('boardSheet');
    }).catch(function () { alert("That file isn't a whiteboard backup."); });
    this.value = '';
  };
  function findB(id) { return data.boards.some(function (b) { return b.id === id; }); }

  // ---- Calendar ----
  if (!data.cal || typeof data.cal !== 'object') data.cal = {};
  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var shown = new Date(); shown.setDate(1);
  var pad = function (n) { return (n < 10 ? '0' : '') + n; };
  var keyOf = function (d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); };
  function setTab(c) {
    document.body.classList.toggle('calmode', c); $('cal').hidden = !c;
    $('tabB').classList.toggle('on', !c); $('tabC').classList.toggle('on', c);
    if (c) drawCal();
  }
  $('tabB').onclick = function () { setTab(false); }; $('tabC').onclick = function () { setTab(true); };
  function drawCal() {
    $('monthName').textContent = MONTHS[shown.getMonth()] + ' ' + shown.getFullYear();
    var g = $('grid'); g.innerHTML = ''; var today = keyOf(new Date());
    var d = new Date(shown); d.setDate(1 - shown.getDay());
    for (var i = 0; i < 42; i++) {
      var k = keyOf(d), b = document.createElement('button'); b.type = 'button'; b.textContent = d.getDate(); b.dataset.day = k;
      var cls = []; if (d.getMonth() !== shown.getMonth()) cls.push('out'); if (k === today) cls.push('today'); if ((data.cal[k] || []).length) cls.push('has');
      b.className = cls.join(' '); b.onclick = (function (k) { return function () { openDay(k); }; })(k);
      g.appendChild(b); d.setDate(d.getDate() + 1);
      if (i === 34 && d.getMonth() !== shown.getMonth()) break;
    }
  }
  $('prevM').onclick = function () { shown.setMonth(shown.getMonth() - 1); drawCal(); };
  $('nextM').onclick = function () { shown.setMonth(shown.getMonth() + 1); drawCal(); };
  $('todayBtn').onclick = function () { shown = new Date(); shown.setDate(1); drawCal(); openDay(keyOf(new Date())); };
  var day = null, editing = null;
  function fmtTime(t) { if (!t) return ''; var h = +t.slice(0, 2), m = t.slice(3); return ((h % 12) || 12) + ':' + m + (h < 12 ? ' AM' : ' PM'); }
  function openDay(k) {
    day = k; editing = null; resetForm();
    var p = k.split('-'), dt = new Date(+p[0], p[1] - 1, +p[2]);
    $('dayName').textContent = dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    drawDay(); show('daySheet');
  }
  function resetForm() { $('dayTitle').value = ''; $('dayTime').value = ''; $('daySubmit').textContent = 'Add'; editing = null; }
  function items() { return data.cal[day] || []; }
  function drawDay() {
    var ul = $('dayItems'); ul.innerHTML = '';
    var list = items().slice().sort(function (a, b) { return (a.time || '99') < (b.time || '99') ? -1 : 1; });
    if (!list.length) ul.innerHTML = '<li class="empty2">Nothing yet</li>';
    list.forEach(function (it) {
      var li = document.createElement('li'); if (it.done) li.className = 'done';
      li.innerHTML = '<button type="button" class="chk">' + (it.done ? '☑' : '☐') + '</button><button type="button" class="txt">' + (it.time ? '<span class="tm">' + fmtTime(it.time) + '</span>' : '') + esc(it.title) + '</button><button type="button" class="del" aria-label="Delete">✕</button>';
      li.querySelector('.chk').onclick = function () { it.done = !it.done; save(); drawDay(); };
      li.querySelector('.txt').onclick = function () { editing = it; $('dayTitle').value = it.title; $('dayTime').value = it.time || ''; $('daySubmit').textContent = 'Save'; $('dayTitle').focus(); };
      li.querySelector('.del').onclick = function () {
        if (!confirm('Delete "' + it.title + '"?')) return;
        var a = items(); a.splice(a.indexOf(it), 1); if (!a.length) delete data.cal[day]; if (editing === it) resetForm(); save(); drawDay(); drawCal();
      };
      ul.appendChild(li);
    });
  }
  $('dayForm').onsubmit = function (e) {
    e.preventDefault(); var t = $('dayTitle').value.trim(); if (!t) return;
    if (editing) { editing.title = t; editing.time = $('dayTime').value; }
    else { (data.cal[day] = data.cal[day] || []).push({ id: uid(), title: t, time: $('dayTime').value, done: false }); }
    resetForm(); save(); drawDay(); drawCal();
  };

  render();
  if ('serviceWorker' in navigator) addEventListener('load', function () { navigator.serviceWorker.register('service-worker.js').catch(function () {}); });
})();
