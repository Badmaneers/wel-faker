/* ============================================================
   wel-faker / script.js
   Single-file logic for the Digital Wellbeing mock generator.
   ============================================================ */

'use strict';

// ─── STATE ────────────────────────────────────────────────────────────────────
const DEFAULT_STATE = {
  statusBar: {
    time:    '7:24',
    battery: 40,
    network: '4G LTE',
    signal:  4,
    speed:   '34.0 KB/S',
    notifIcons: [],
  },
  title:      'App activity details',
  dayLabel:   'Wed, 11 Mar',
  todayIndex: 2,                          // 0=Mon … 6=Sun; highlighted bar
  weekData:   [6, 9, 3, 0, 0, 0, 0],     // hours per day (Mon–Sun)
  apps: [
    { id: uid(), name: 'YouTube',   minutes: 158, iconData: 'src/youtube.png',   emoji: '▶' },
    { id: uid(), name: 'Instagram', minutes: 53,  iconData: 'src/instagram.png', emoji: '📷' },
    { id: uid(), name: 'Chess',     minutes: 8,   iconData: 'src/chess.png',     emoji: '♟' },
  ],
};

let state = deepClone(DEFAULT_STATE);
let _addAppIconSrc = null; // icon src/dataURL chosen for the next app to be added

// ─── CHART INSTANCE ──────────────────────────────────────────────────────────
let weeklyChart = null;

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Format total minutes → "X hrs, Y mins" or "Y mins"
 */
function formatTime(totalMinutes) {
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h > 0 && m > 0) return `${h} hrs, ${m} mins`;
  if (h > 0)           return `${h} hrs`;
  return `${m} mins`;
}

/**
 * Read a file input and return a Promise<base64 dataURL>.
 */
function readFileAsDataURL(file) {
  return new Promise((resolve) => {
    if (!file) { resolve(null); return; }
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}

// ─── PERSIST ─────────────────────────────────────────────────────────────────
const STATE_VERSION = 2; // bump when defaults change to auto-clear stale cache

function saveState() {
  try {
    localStorage.setItem('wf_state', JSON.stringify({ ...state, _v: STATE_VERSION }));
  } catch (_) { /* quota errors ignored */ }
}

function loadState() {
  try {
    const raw = localStorage.getItem('wf_state');
    if (raw) {
      const parsed = JSON.parse(raw);
      // If version mismatch, drop saved state and use defaults
      if (parsed._v !== STATE_VERSION) {
        localStorage.removeItem('wf_state');
        state = deepClone(DEFAULT_STATE);
        return;
      }
      state = Object.assign(deepClone(DEFAULT_STATE), parsed);
      state.apps = (state.apps || []).map(a => ({ ...a, id: a.id || uid() }));
    }
  } catch (_) {
    state = deepClone(DEFAULT_STATE);
  }
}

// ─── STATUS BAR ──────────────────────────────────────────────────────────────
function renderStatusBar() {
  const sb = state.statusBar;

  // Time
  document.getElementById('sb-time').textContent = sb.time;

  // Battery fill
  const pct = Math.max(0, Math.min(100, sb.battery));
  document.getElementById('sb-battery-fill').style.width = pct + '%';
  document.getElementById('sb-battery-pct').textContent = pct + '%';

  const isWifi = (sb.network || '').toLowerCase() === 'wifi';

  // WiFi vs Mobile mode
  const netEl       = document.getElementById('sb-network');
  const signalBars  = document.getElementById('sb-signal-bars');
  const wifiIcon    = document.getElementById('sb-wifi-icon');
  const speedEl     = document.getElementById('sb-speed');

  if (isWifi) {
    netEl.style.display      = 'none';
    wifiIcon.style.display   = 'flex';
  } else {
    netEl.style.display      = '';
    wifiIcon.style.display   = 'none';

    // Network – split the value into two lines
    const netParts = sb.network.split(' ');
    if (netParts.length >= 2) {
      netEl.innerHTML = netParts[0] + '<br/>' + netParts.slice(1).join(' ');
    } else {
      netEl.textContent = sb.network;
    }
  }

  // Speed
  const rawSpeed = sb.speed || '';
  const speedParts = rawSpeed.split(' ');
  if (speedParts.length >= 2) {
    speedEl.innerHTML = speedParts[0] + '<br/>' + speedParts.slice(1).join(' ');
  } else {
    speedEl.textContent = rawSpeed;
  }

  // Signal bars
  const bars = document.querySelectorAll('#sb-signal-bars .bar');
  bars.forEach((bar, i) => {
    bar.classList.toggle('active', i < sb.signal);
  });


}

// ─── TITLE ───────────────────────────────────────────────────────────────────
function renderTitle() {
  document.getElementById('main-title').textContent = state.title;
}

// ─── DAY LABEL ───────────────────────────────────────────────────────────────
function renderDayLabel() {
  document.getElementById('day-label').textContent = state.dayLabel;
}

// ─── TOTAL TIME ──────────────────────────────────────────────────────────────
function renderTotalTime() {
  const totalMins = state.apps.reduce((sum, a) => sum + (a.minutes || 0), 0);
  document.getElementById('total-time-display').textContent = formatTime(totalMins);

  // Keep today's bar in sync with the calculated total
  const todayIdx = state.todayIndex ?? 2;
  const todayHrs = parseFloat((totalMins / 60).toFixed(2));
  state.weekData[todayIdx] = todayHrs;

  // Sync the editor input for today's day so it stays consistent
  const todayInput = document.querySelector(`.day-input[data-day="${todayIdx}"]`);
  if (todayInput) {
    todayInput.value = todayHrs;
    // Mark all inputs: remove old auto-today, apply to current today
    document.querySelectorAll('.day-input').forEach(i => i.classList.remove('auto-today'));
    todayInput.classList.add('auto-today');
  }

  renderChart();
  saveState();
}

// ─── CHART ───────────────────────────────────────────────────────────────────
function buildChartConfig() {
  const labels   = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const data     = state.weekData.map(v => Number(v) || 0);
  const dataMax  = Math.max(...data, 0);
  const todayIdx = state.todayIndex ?? 2;

  // ── Dynamic scale ──────────────────────────────────────────────────────────
  // ≤ 14h  →  max=14,  step=7  (ticks: 0 / 7  / 14)
  // > 14h and ≤ 15h  →  max=15,  step=5  (ticks: 0 / 5  / 10 / 15)
  // > 15h  →  ceil to nearest 6, step=6  (ticks: 0 / 6  / 12 / 18 …)
  let maxVal, stepSize;
  if (dataMax <= 14) {
    maxVal   = 14;
    stepSize = 7;
  } else if (dataMax <= 15) {
    maxVal   = 15;
    stepSize = 5;
  } else {
    maxVal   = Math.ceil(dataMax / 6) * 6;   // e.g. 15.5 → 18, 18.1 → 24
    stepSize = 6;
  }

  const barColors = data.map((v, i) => {
    if (v === 0) return 'rgba(0,0,0,0)';
    return i === todayIdx
      ? 'rgba(205, 118, 98, 1)'       // today – salmon
      : 'rgba(240, 220, 212, 0.98)';  // other – near-white blush
  });

  return {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: barColors,
        borderRadius: { topLeft: 5, topRight: 5, bottomLeft: 0, bottomRight: 0 },
        borderSkipped: 'bottom',
        barPercentage: 0.75,
        categoryPercentage: 0.88,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      layout: { padding: { top: 2, right: 2, bottom: 0, left: 0 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => `${ctx.raw} hrs` },
          backgroundColor: 'rgba(20,8,5,0.95)',
          titleColor: '#f0d0c0',
          bodyColor:  '#c0a090',
          padding: 10,
          cornerRadius: 8,
        },
      },
      scales: {
        x: {
          border:   { display: false },
          grid: {
            display: true,
            drawOnChartArea: false,
            drawTicks: true,
            tickLength: 5,
            color: 'rgba(255, 255, 255, 0.45)',
            lineWidth: 2,
            offset: false,
          },
          ticks: {
            color:  'rgba(160,125,108,0.95)',
            font:   { size: 11, family: "'Roboto', system-ui, sans-serif" },
            padding: 6,
          },
        },
        y: {
          position: 'right',
          border:   { display: false },
          min: 0,
          max: maxVal,
          afterBuildTicks(axis) {
            const ticks = [];
            for (let v = 0; v <= maxVal; v += stepSize) ticks.push({ value: v });
            axis.ticks = ticks;
          },
          ticks: {
            color:    'rgba(180,145,125,0.85)',
            font:     { size: 10 },
            padding:  8,
            callback: v => v === 0 ? '0h' : `${v}h`,
          },
          grid: {
            color:     'rgba(255,255,255,0.45)', // Brighter, more solid
            lineWidth: 2,                        // Thicker lines
            drawTicks: false,
          },
        },
      },
    },
  };
}

function renderChart() {
  const canvas = document.getElementById('weekly-chart');

  // Always destroy first – direct mutation of Chart.js internals is unreliable
  if (weeklyChart) {
    weeklyChart.destroy();
    weeklyChart = null;
  }

  weeklyChart = new Chart(canvas, buildChartConfig());
}

// ─── APP LIST ─────────────────────────────────────────────────────────────────
function renderAppList() {
  const container = document.getElementById('app-list');
  container.innerHTML = '';

  state.apps.forEach((app) => {
    const row = document.createElement('div');
    row.className = 'app-row';
    row.dataset.id = app.id;

    // Icon wrapper
    const iconWrap = document.createElement('div');
    iconWrap.className = 'app-icon-wrap';

    if (app.iconData) {
      const img = document.createElement('img');
      img.className = 'app-icon';
      img.src = app.iconData;
      img.alt = app.name;
      iconWrap.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'app-icon-placeholder';
      ph.textContent = app.emoji || '📱';
      iconWrap.appendChild(ph);
    }

    // Upload overlay
    const overlay = document.createElement('div');
    overlay.className = 'icon-upload-overlay';
    overlay.textContent = '📂';
    overlay.title = 'Upload icon';
    overlay.addEventListener('click', () => triggerIconUpload(app.id));
    iconWrap.appendChild(overlay);

    // App info
    const info = document.createElement('div');
    info.className = 'app-info';

    const nameEl = document.createElement('div');
    nameEl.className = 'app-name';
    nameEl.textContent = app.name;
    nameEl.title = 'Click to rename';
    nameEl.addEventListener('click', () => renameApp(app.id, nameEl));

    const timeEl = document.createElement('div');
    timeEl.className = 'app-time';
    timeEl.textContent = formatTime(app.minutes);
    timeEl.title = 'Click to edit time';
    timeEl.addEventListener('click', () => editAppTime(app.id, timeEl));

    info.appendChild(nameEl);
    info.appendChild(timeEl);

    // Vertical separator before hourglass (matches Android DW screenshot)
    const rowDivider = document.createElement('div');
    rowDivider.className = 'app-row-divider';

    // Hourglass – SVG outline style matching Android timer icon
    const hg = document.createElement('span');
    hg.className = 'app-hourglass';
    hg.innerHTML = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 2h12v4l-4.5 4L18 14v8H6v-8l4.5-4L6 6V2z"/><line x1="6" y1="2" x2="18" y2="2"/><line x1="6" y1="22" x2="18" y2="22"/></svg>';

    // Delete button
    const del = document.createElement('button');
    del.className = 'app-delete-btn';
    del.textContent = '×';
    del.title = 'Delete app';
    del.addEventListener('click', () => deleteApp(app.id));

    row.appendChild(iconWrap);
    row.appendChild(info);
    row.appendChild(rowDivider);
    row.appendChild(hg);
    row.appendChild(del);

    container.appendChild(row);
  });
}

// ─── APP ACTIONS ──────────────────────────────────────────────────────────────
// ─── CAP VALIDATION ──────────────────────────────────────────────────────────
const MAX_MINUTES = 24 * 60; // 1440

/**
 * Total minutes already used by all apps, optionally excluding one (for edits).
 */
function usedMinutes(excludeId = null) {
  return state.apps
    .filter(a => a.id !== excludeId)
    .reduce((sum, a) => sum + (a.minutes || 0), 0);
}

/**
 * Returns an error string if the proposed minutes violate a cap, else null.
 * @param {number} proposed  minutes for this single app
 * @param {string|null} excludeId  app id to exclude from total (for edits)
 */
function validateMinutes(proposed, excludeId = null) {
  if (proposed > MAX_MINUTES)
    return `A single app can't exceed 24 hrs (you entered ${formatTime(proposed)}).`;
  const newTotal = usedMinutes(excludeId) + proposed;
  if (newTotal > MAX_MINUTES)
    return `Total across all apps can't exceed 24 hrs. Already at ${formatTime(usedMinutes(excludeId))}, tried to add ${formatTime(proposed)}.`;
  return null;
}

/**
 * Show a brief error toast below the editor header.
 */
function showCapError(msg) {
  let toast = document.getElementById('cap-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cap-toast';
    document.getElementById('editor-body').prepend(toast);
  }
  toast.textContent = '⚠ ' + msg;
  toast.classList.add('visible');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => toast.classList.remove('visible'), 3500);
}

function addApp() {
  const nameInput  = document.getElementById('add-app-name');
  const hoursInput = document.getElementById('add-app-hours');
  const minsInput  = document.getElementById('add-app-mins');
  const iconInput  = document.getElementById('add-app-icon');

  const name = nameInput.value.trim() || 'New App';
  const hours = Math.max(0, parseInt(hoursInput.value, 10) || 0);
  const mins  = Math.max(0, parseInt(minsInput.value,  10) || 0);
  const totalMinutes = hours * 60 + mins;

  // ── Cap validation ──
  const err = validateMinutes(totalMinutes);
  if (err) { showCapError(err); return; }

  const file = iconInput.files[0];

  const doAdd = (iconData) => {
    state.apps.push({
      id: uid(),
      name,
      minutes: totalMinutes,
      iconData: iconData || null,
      emoji: '📱',
    });

    // Reset form
    nameInput.value  = '';
    hoursInput.value = '0';
    minsInput.value  = '0';
    iconInput.value  = '';
    _addAppIconSrc   = null;
    document.getElementById('add-icon-preview').innerHTML = '';

    saveState();
    renderAppList();
    renderTotalTime();
  };

  // Priority: uploaded file > bundled pick
  if (file) {
    readFileAsDataURL(file).then(doAdd);
  } else if (_addAppIconSrc) {
    doAdd(_addAppIconSrc);
  } else {
    doAdd(null);
  }
}

function deleteApp(id) {
  state.apps = state.apps.filter(a => a.id !== id);
  saveState();
  renderAppList();
  renderTotalTime();
}

function renameApp(id, el) {
  const current = el.textContent;
  const input = document.createElement('input');
  input.type  = 'text';
  input.value = current;
  input.style.cssText = `
    background:#2a1a10; border:1px solid #7a4030; border-radius:4px;
    color:#f0e0d8; padding:2px 6px; font-size:14px; width:140px; outline:none;
  `;
  el.replaceWith(input);
  input.focus();
  input.select();

  const commit = () => {
    const newName = input.value.trim() || current;
    const app = state.apps.find(a => a.id === id);
    if (app) { app.name = newName; saveState(); }
    input.replaceWith(el);
    el.textContent = newName;
  };

  input.addEventListener('blur',  commit);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter')  commit();
    if (e.key === 'Escape') { input.replaceWith(el); }
  });
}

function editAppTime(id, el) {
  const app     = state.apps.find(a => a.id === id);
  if (!app) return;

  const h = Math.floor(app.minutes / 60);
  const m = app.minutes % 60;

  const wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex; gap:4px; align-items:center;';

  const hInput = document.createElement('input');
  hInput.type  = 'number'; hInput.min = '0'; hInput.max = '24';
  hInput.value = h;
  hInput.style.cssText = inputStyle();

  const mInput = document.createElement('input');
  mInput.type  = 'number'; mInput.min = '0'; mInput.max = '59';
  mInput.value = m;
  mInput.style.cssText = inputStyle();

  const span = document.createElement('span');
  span.textContent = 'h / m';
  span.style.cssText = 'font-size:11px; color:#888;';

  wrap.appendChild(hInput);
  wrap.appendChild(mInput);
  wrap.appendChild(span);
  el.replaceWith(wrap);
  hInput.focus();

  const commit = () => {
    const nh = Math.max(0, parseInt(hInput.value, 10) || 0);
    const nm = Math.max(0, Math.min(59, parseInt(mInput.value, 10) || 0));
    const proposed = nh * 60 + nm;

    // ── Cap validation ──
    const err = validateMinutes(proposed, app.id);
    if (err) { showCapError(err); return; }

    app.minutes = proposed;
    saveState();
    wrap.replaceWith(el);
    el.textContent = formatTime(app.minutes);
    renderTotalTime();
  };

  [hInput, mInput].forEach(inp => {
    inp.addEventListener('blur',   () => setTimeout(commit, 120));
    inp.addEventListener('keydown', e => { if (e.key === 'Enter') commit(); });
  });
}

function inputStyle() {
  return `
    width:44px; background:#2a1a10; border:1px solid #7a4030;
    border-radius:4px; color:#f0e0d8; padding:2px 4px; font-size:12px;
    outline:none; text-align:center;
  `;
}

// ─── ICON PICKER ─────────────────────────────────────────────────────────────
const BUNDLED_ICONS = [
  { label: 'YouTube',     src: 'src/youtube.png' },
  { label: 'Instagram',   src: 'src/instagram.png' },
  { label: 'Telegram',    src: 'src/telegram.png' },
  { label: 'Chrome',      src: 'src/chrome.png' },
  { label: 'Google Chr.', src: 'src/google-chrome-icon.png' },
  { label: 'Firefox',     src: 'src/firefox-browser-icon.png' },
  { label: 'Brave',       src: 'src/brave-browser-icon.png' },
  { label: 'Chess',       src: 'src/chess.png' },
  { label: 'Spotify',     src: 'src/spotify.png' },
];

let _pickerCallback = null; // called with chosen src when user picks an icon

function showIconPicker(callback) {
  _pickerCallback = callback;

  const grid = document.getElementById('icon-picker-grid');
  grid.innerHTML = '';

  BUNDLED_ICONS.forEach(icon => {
    const item = document.createElement('div');
    item.className = 'icon-picker-item';

    const img = document.createElement('img');
    img.src = icon.src;
    img.alt = icon.label;

    const label = document.createElement('span');
    label.textContent = icon.label;

    item.appendChild(img);
    item.appendChild(label);

    item.addEventListener('click', () => {
      if (_pickerCallback) _pickerCallback(icon.src);
      closeIconPicker();
    });

    grid.appendChild(item);
  });

  // Wire custom upload inside modal
  const uploadInput = document.getElementById('icon-picker-upload');
  uploadInput.value = '';
  uploadInput.onchange = async () => {
    const file = uploadInput.files[0];
    if (!file) return;
    const dataURL = await readFileAsDataURL(file);
    if (_pickerCallback) _pickerCallback(dataURL);
    closeIconPicker();
  };

  document.getElementById('icon-picker-backdrop').classList.add('open');
}

function closeIconPicker() {
  document.getElementById('icon-picker-backdrop').classList.remove('open');
  _pickerCallback = null;
}

// ─── ADD-APP picked icon state ────────────────────────────────────────────────
function setAddAppIcon(src) {
  _addAppIconSrc = src;
  document.getElementById('add-app-icon').value = '';
  const preview = document.getElementById('add-icon-preview');
  preview.innerHTML = '';
  const img = document.createElement('img');
  img.src = src;
  preview.appendChild(img);
}

// ─── ICON UPLOAD (from list row) ─────────────────────────────────────────────
function triggerIconUpload(appId) {
  // Always show the picker – user can choose bundled or upload custom
  showIconPicker((src) => {
    const app = state.apps.find(a => a.id === appId);
    if (app) {
      app.iconData = src;
      saveState();
      renderAppList();
    }
  });
}

// ─── EDITOR CONTROLS ─────────────────────────────────────────────────────────
function syncEditorToState() {
  // Status bar inputs
  document.getElementById('ed-time').value    = state.statusBar.time;
  document.getElementById('ed-battery').value = state.statusBar.battery;
  document.getElementById('ed-network').value = state.statusBar.network;
  document.getElementById('ed-signal').value  = state.statusBar.signal;

  // Speed – split into value + unit
  const speedParts = (state.statusBar.speed || '34.0 KB/S').split(' ');
  document.getElementById('ed-speed-val').value  = speedParts[0] || '34.0';
  document.getElementById('ed-speed-unit').value = speedParts.slice(1).join(' ') || 'KB/S';

  // Title / day
  // title is fixed – no editor input
  document.getElementById('ed-day-label').value = state.dayLabel;

  // Week data
  const todayIdx2 = state.todayIndex ?? 2;
  document.querySelectorAll('.day-input').forEach(inp => {
    const day = parseInt(inp.dataset.day, 10);
    inp.value = state.weekData[day] ?? 0;
    inp.classList.toggle('auto-today', day === todayIdx2);
  });

  // Today index
  const todayEl = document.getElementById('ed-today-index');
  if (todayEl) todayEl.value = state.todayIndex ?? 2;
}

function bindEditorEvents() {
  // Status bar: live update on change/input
  bind('ed-time',    'input',  () => { state.statusBar.time    = v('ed-time');    renderStatusBar(); saveState(); });
  bind('ed-battery', 'input',  () => { state.statusBar.battery = num('ed-battery'); renderStatusBar(); saveState(); });
  bind('ed-network', 'change', () => { state.statusBar.network = v('ed-network'); renderStatusBar(); saveState(); });
  bind('ed-signal',  'input',  () => { state.statusBar.signal  = num('ed-signal'); renderStatusBar(); saveState(); });

  // Speed – combine value + unit
  const updateSpeed = () => {
    state.statusBar.speed = v('ed-speed-val') + ' ' + v('ed-speed-unit');
    renderStatusBar();
    saveState();
  };
  bind('ed-speed-val',  'input',  updateSpeed);
  bind('ed-speed-unit', 'change', updateSpeed);

  // Day label
  bind('ed-day-label', 'input', () => {
    state.dayLabel = v('ed-day-label');
    renderDayLabel();
    saveState();
  });

  // Weekly day inputs (today's column is read-only – driven by app totals)
  document.querySelectorAll('.day-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const day = parseInt(inp.dataset.day, 10);
      if (day === (state.todayIndex ?? 2)) {
        // Restore the auto-calculated value
        const totalMins = state.apps.reduce((s, a) => s + (a.minutes || 0), 0);
        inp.value = parseFloat((totalMins / 60).toFixed(2));
        return;
      }
      state.weekData[day] = parseFloat(inp.value) || 0;
      renderChart();
      saveState();
    });
  });

  // Today bar highlight – re-sync the new today column with current total
  bind('ed-today-index', 'change', () => {
    state.todayIndex = parseInt(v('ed-today-index'), 10);
    renderTotalTime(); // recalculates total and pushes to new todayIndex
  });
}

function bind(id, event, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener(event, fn);
}

function bindFileIcon(id, index) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('change', async () => {
    const file = el.files[0];
    if (!file) return;
    const data = await readFileAsDataURL(file);
    state.statusBar.notifIcons[index] = data;
    renderStatusBar();
    saveState();
  });
}

function v(id)   { return document.getElementById(id)?.value ?? ''; }
function num(id) { return parseInt(document.getElementById(id)?.value || '0', 10) || 0; }

// ─── EDITOR TOGGLE ────────────────────────────────────────────────────────────
function toggleEditor() {
  const body = document.getElementById('editor-body');
  const icon = document.getElementById('editor-toggle-icon');
  const isOpen = body.classList.toggle('open');
  icon.textContent = isOpen ? '▲' : '▼';
}

// ─── SCREENSHOT EXPORT ────────────────────────────────────────────────────────
async function exportScreenshot() {
  const target = document.getElementById('mock-ui');
  document.body.classList.add('exporting');

  // Small delay to let CSS hide panels
  await new Promise(r => setTimeout(r, 80));

  try {
    const canvas = await html2canvas(target, {
      backgroundColor: null,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      logging: false,
    });

    const link = document.createElement('a');
    link.download = 'wellbeing_mock.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  } catch (err) {
    console.error('Export failed:', err);
    alert('Export failed: ' + err.message);
  } finally {
    document.body.classList.remove('exporting');
  }
}

// ─── RESET ────────────────────────────────────────────────────────────────────
function resetAll() {
  if (!confirm('Reset all data to defaults?')) return;
  state = deepClone(DEFAULT_STATE);
  saveState();
  init();
}

// ─── INIT ─────────────────────────────────────────────────────────────────────
function init() {
  loadState();
  syncEditorToState();
  renderStatusBar();
  renderTitle();
  renderDayLabel();
  renderTotalTime();
  renderChart();
  renderAppList();

  // Open editor by default on first load
  const body = document.getElementById('editor-body');
  const icon = document.getElementById('editor-toggle-icon');
  if (!body.classList.contains('open')) {
    body.classList.add('open');
    icon.textContent = '▲';
  }
}

// ─── BOOT ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  bindEditorEvents();
  init();
});
