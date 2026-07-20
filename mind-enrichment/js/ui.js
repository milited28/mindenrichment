// ============================================================================
// UI.JS — all rendering, filtering, dashboards, modal, theme, and view logic.
// Depends on data from database.js and auth state from auth.js (currentUser).
// ============================================================================

let activeFilter = "all";

/* ---------------- CHECKLIST + PARSER ---------------- */

function parseRequest(){
  const text = document.getElementById('request-input').value.toLowerCase();

  const hasLevel = LEVEL_KEYWORDS.some(k => text.includes(k));
  const hasSubject = SUBJECT_KEYWORDS.some(k => text.includes(k));
  const hasAbility = ABILITY_KEYWORDS.some(k => text.includes(k)) || FOCUS_TRIGGERS.some(k => text.includes(k));
  const hasStyle = STYLE_KEYWORDS.some(k => text.includes(k));
  const hasPref = PREF_KEYWORDS.some(k => text.includes(k));

  setCheck('chk-level', hasLevel);
  setCheck('chk-subject', hasSubject);
  setCheck('chk-ability', hasAbility);
  setCheck('chk-style', hasStyle);
  setCheck('chk-pref', hasPref);

  const doneCount = [hasLevel, hasSubject, hasAbility, hasStyle, hasPref].filter(Boolean).length;
  document.getElementById('checklist-hint').textContent = doneCount + ' of 5 filled in';
}

function setCheck(id, done){
  const el = document.getElementById(id);
  el.classList.toggle('done', done);
  const circle = el.querySelector('.check-circle');
  circle.innerHTML = done ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5"><path d="M20 6L9 17l-5-5"/></svg>' : '';
}

function usePrompt(idx){
  const ta = document.getElementById('request-input');
  const hints = ["Secondary 3, ", "needs help with A-Math, ", "weak in algebra, ", "prefers a patient tutor who keeps lessons interactive"];
  ta.value = (ta.value ? ta.value + ' ' : '') + hints[idx];
  ta.focus();
  parseRequest();
}

function runSearch(){
  const text = document.getElementById('request-input').value.toLowerCase();
  if(!text.trim()){ renderResults(EDUCATORS); return; }
  const matched = EDUCATORS.filter(e => {
    const haystack = (e.subjects.join(' ') + ' ' + e.levels.join(' ') + ' ' + e.headline).toLowerCase();
    return SUBJECT_KEYWORDS.some(k => text.includes(k) && haystack.includes(k)) ||
           LEVEL_KEYWORDS.some(k => text.includes(k) && haystack.includes(k));
  });
  activeFilter = "all";
  renderFilterPills();
  renderResults(matched.length ? matched : EDUCATORS);
  document.getElementById('results-grid').scrollIntoView({behavior:'smooth', block:'start'});
}

/* ---------------- FILTER PILLS ---------------- */

function renderFilterPills(){
  const row = document.getElementById('filter-row');
  const cats = ["all", ...Object.keys(CATEGORY_LABELS)];
  row.innerHTML = cats.map(c => {
    const label = c === "all" ? "All categories" : CATEGORY_LABELS[c];
    return '<button class="filter-pill '+(activeFilter===c?'active':'')+'" onclick="filterByCategory(\''+c+'\')">'+label+'</button>';
  }).join('');
}

function filterByCategory(cat){
  activeFilter = cat;
  renderFilterPills();
  applyAllFilters();
}

/* ---------------- MANUAL FILTERS (multi-select chip pickers) ---------------- */

function hourKey(day, hour){ return day + '-' + hour; }

function expandSlotsToHours(slots){
  const set = new Set();
  slots.forEach(s => { for(let h = s.start; h < s.end - 1e-9; h += SLOT_DURATION) set.add(hourKey(s.day, h)); });
  return set;
}

function compressHoursToSlots(hourSet){
  const byDay = {};
  DAYS.forEach(d => byDay[d] = []);
  hourSet.forEach(k => {
    const idx = k.lastIndexOf('-');
    byDay[k.slice(0, idx)].push(parseFloat(k.slice(idx + 1)));
  });
  const slots = [];
  DAYS.forEach(day => {
    const hours = byDay[day].sort((a,b) => a-b);
    let start = null, prev = null;
    hours.forEach(h => {
      if(start === null){ start = h; prev = h; }
      else if(Math.abs(h - (prev + SLOT_DURATION)) < 1e-9){ prev = h; }
      else { slots.push({day, start, end: prev+SLOT_DURATION}); start = h; prev = h; }
    });
    if(start !== null) slots.push({day, start, end: prev+SLOT_DURATION});
  });
  return slots;
}

function renderScheduleGrid(containerId, opts){
  let html = '<div class="sched-grid-wrap"><table class="sched-grid"><thead><tr><th></th>';
  DAYS.forEach(d => html += '<th>'+d.slice(0,3)+'</th>');
  html += '</tr></thead><tbody>';
  GRID_SLOTS.forEach(h => {
    const isWholeHour = Math.abs(h % 1) < 1e-9;
    html += '<tr><td class="sched-hour-label'+(isWholeHour ? '' : ' sched-half-label')+'">'+(isWholeHour ? hourLabel(h) : '')+'</td>';
    DAYS.forEach(d => {
      const state = opts.getCellState(d, h);
      const clickable = state !== 'booked';
      let styleAttr = '';
      let title = '';

      if(state === 'booked' && opts.getBookedEntry){
        const b = opts.getBookedEntry(d, h);
        if(b){
          title = b.label + ' (' + formatTimeDecimal(b.start) + '–' + formatTimeDecimal(b.end) + ')';
          const startFrac = Math.max(0, Math.min(1, (b.start - h) / SLOT_DURATION));
          const endFrac = Math.max(0, Math.min(1, (b.end - h) / SLOT_DURATION));
          const startPct = (startFrac * 100).toFixed(1);
          const endPct = (endFrac * 100).toFixed(1);
          styleAttr = ' style="background-color:var(--bg); background-image:linear-gradient(to bottom, transparent 0%, transparent '+startPct+'%, var(--warning) '+startPct+'%, var(--warning) '+endPct+'%, transparent '+endPct+'%, transparent 100%), linear-gradient(to bottom, transparent 49%, rgba(148,163,184,0.35) 49%, rgba(148,163,184,0.35) 51%, transparent 51%);"';
        }
      }

      html += '<td class="sched-cell '+state+'"'+styleAttr+' '+(clickable ? 'onclick="'+opts.onClickName+'(\''+d+'\','+h+')"' : '')+' title="'+title+'"></td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  document.getElementById(containerId).innerHTML = html;
}

/* ---- Parent schedule state ---- */

let parentFreeHours = new Set();
let parentBookedLessons = []; // no real bookings system yet — starts empty, not fake data
let parentSavedSchedule = [];
let parentScheduleLoaded = false;

async function renderParentSchedulePanel(){
  if(!parentScheduleLoaded){
    parentScheduleLoaded = true;
    if(window.storage){
      try{
        const r = await window.storage.get('parent-schedule:' + currentUser.id, false);
        if(r && r.value){
          parentSavedSchedule = JSON.parse(r.value);
          parentFreeHours = expandSlotsToHours(parentSavedSchedule);
        }
      }catch(e){ /* nothing saved yet */ }
      try{
        const r2 = await window.storage.get('parent-bookings:' + currentUser.id, false);
        if(r2 && r2.value) parentBookedLessons = JSON.parse(r2.value);
      }catch(e){ /* nothing saved yet */ }
    }
  }

  const el = document.getElementById('dash-panel');
  el.innerHTML = '<h3>My schedule</h3><p class="panel-sub">Click a cell to mark your child\'s free time. Sessions already booked show automatically.</p>'+
    '<div class="sched-legend"><span><span class="sched-legend-dot" style="background:var(--green);"></span>Free time</span><span><span class="sched-legend-dot" style="background:var(--warning);"></span>Scheduled tuition</span></div>'+
    '<div id="parent-sched-grid"></div>'+
    '<div style="display:flex;gap:10px;align-items:center;margin-top:16px;margin-bottom:20px;">'+
      '<button class="btn-ask" onclick="saveParentSchedule()">Save schedule</button>'+
      '<span id="parent-sched-saved-msg" style="display:none;font-size:12.5px;color:var(--green-text);font-weight:700;">Saved — available to use in search filters ✓</span>'+
    '</div>'+
    bookingFormHTML('parent')+
    bookingListHTML(parentBookedLessons, 'parent');
  renderScheduleGrid('parent-sched-grid', {
    getCellState: (d,h) => {
      if(parentBookedLessons.some(b => b.day===d && h<b.end && (h+SLOT_DURATION)>b.start)) return 'booked';
      return parentFreeHours.has(hourKey(d,h)) ? 'marked' : 'empty';
    },
    getBookedEntry: (d,h) => parentBookedLessons.find(b=>b.day===d && h<b.end && (h+SLOT_DURATION)>b.start),
    onClickName: 'toggleParentHour'
  });
  renderBookingPickers('parent');
}

function toggleParentHour(day, hour){
  const key = hourKey(day, hour);
  if(parentFreeHours.has(key)) parentFreeHours.delete(key); else parentFreeHours.add(key);
  renderParentSchedulePanel();
}

function saveParentSchedule(){
  parentSavedSchedule = compressHoursToSlots(parentFreeHours);
  const msg = document.getElementById('parent-sched-saved-msg');
  msg.style.display = 'inline';
  setTimeout(() => { msg.style.display = 'none'; }, 2500);
  if(window.storage){
    try{ window.storage.set('parent-schedule:' + currentUser.id, JSON.stringify(parentSavedSchedule), false); }catch(e){}
  }
}

function useMySavedSchedule(){
  if(parentSavedSchedule.length === 0){
    alert("You haven't saved a free-time schedule yet. Sign in as a parent, go to My Schedule, mark your free time, and save it — then it'll be available here.");
    return;
  }
  parentSlots = parentSavedSchedule.map(s => ({...s}));
  renderScheduleTags();
  updateDropdownTrigger('schedule');
}

/* ---- Shared: booking a session from an external source (WhatsApp, existing student, etc.) ---- */

function bookingFormHTML(role){
  return '<div style="padding-top:16px;border-top:1px solid var(--hairline);margin-bottom:16px;">'+
    '<p style="font-size:12px;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.03em;margin:0 0 10px;">Add a booked session (e.g. from WhatsApp or an existing student)</p>'+
    '<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">'+
      '<select id="'+role+'-book-day" class="mini-select"></select>'+
      '<span style="font-size:12px;color:var(--text-secondary);">from</span>'+
      '<select id="'+role+'-book-start" class="mini-select"></select>'+
      '<span style="font-size:12px;color:var(--text-secondary);">to</span>'+
      '<select id="'+role+'-book-end" class="mini-select"></select>'+
      '<input type="text" id="'+role+'-book-label" placeholder="e.g. Math with Ethan" class="mini-select" style="flex:1;min-width:140px;" />'+
      '<button class="btn-outline" style="padding:6px 12px;font-size:12px;" onclick="addBookedSession(\''+role+'\')">+ Add</button>'+
    '</div>'+
    '<p id="'+role+'-book-warning" style="display:none;font-size:11.5px;color:var(--error);margin:0;">End time must be after start time, and a label helps you remember what it is.</p>'+
  '</div>';
}

function bookingListHTML(list, role){
  if(!list || list.length===0) return '';
  return '<div style="margin-bottom:16px;">'+
    list.map((b,i)=>'<div class="sched-tag" style="margin-bottom:6px;"><span>'+b.day+', '+formatTimeDecimal(b.start)+'–'+formatTimeDecimal(b.end)+' — '+b.label+'</span><button onclick="removeBookedSession(\''+role+'\','+i+')">&times;</button></div>').join('')+
  '</div>';
}

const TIME_OPTIONS = (() => {
  const opts = [];
  for(let h = 7; h <= 22; h++){
    for(let m = 0; m < 60; m += 5){
      if(h === 22 && m > 0) break; // stop at 10:00pm
      const dec = h + m/60;
      opts.push({ value: dec, label: formatTimeDecimalFull(dec) });
    }
  }
  return opts;
})();

function formatTimeDecimalFull(dec){
  // Always shows minutes, e.g. "7:00am", "7:05am" — used for dropdown option labels.
  const h = Math.floor(dec);
  const m = Math.round((dec - h) * 60);
  const period = h < 12 ? 'am' : 'pm';
  let displayHour = h % 12;
  if(displayHour === 0) displayHour = 12;
  return displayHour + ':' + String(m).padStart(2,'0') + period;
}

function renderBookingPickers(role){
  document.getElementById(role+'-book-day').innerHTML = DAYS.map(d => '<option>'+d+'</option>').join('');
  const optionsHTML = TIME_OPTIONS.map(o => '<option value="'+o.value+'">'+o.label+'</option>').join('');
  document.getElementById(role+'-book-start').innerHTML = optionsHTML;
  document.getElementById(role+'-book-end').innerHTML = optionsHTML;
  document.getElementById(role+'-book-end').selectedIndex = TIME_OPTIONS.length - 1;
}

function formatTimeDecimal(dec){
  let h = Math.floor(dec);
  const m = Math.round((dec - h) * 60);
  const period = h < 12 ? 'am' : 'pm';
  let displayHour = h % 12;
  if(displayHour === 0) displayHour = 12;
  return displayHour + (m > 0 ? ':' + String(m).padStart(2,'0') : '') + period;
}

async function addBookedSession(role){
  const day = document.getElementById(role+'-book-day').value;
  const start = parseFloat(document.getElementById(role+'-book-start').value);
  const end = parseFloat(document.getElementById(role+'-book-end').value);
  const label = document.getElementById(role+'-book-label').value.trim();
  const warning = document.getElementById(role+'-book-warning');

  if(isNaN(start) || isNaN(end) || end <= start || !label){
    warning.style.display = 'block';
    return;
  }
  warning.style.display = 'none';

  const entry = { day, start, end, label };
  const storageKey = role + '-bookings:' + currentUser.id;

  if(role === 'parent'){
    parentBookedLessons.push(entry);
    if(window.storage){ try{ window.storage.set(storageKey, JSON.stringify(parentBookedLessons), false); }catch(e){} }
    renderParentSchedulePanel();
  } else {
    eduBookedSlots.push(entry);
    if(window.storage){ try{ window.storage.set(storageKey, JSON.stringify(eduBookedSlots), false); }catch(e){} }

    renderEducatorSchedulePanel();
  }
}

function removeBookedSession(role, idx){
  const storageKey = role + '-bookings:' + currentUser.id;
  if(role === 'parent'){
    parentBookedLessons.splice(idx, 1);
    if(window.storage){ try{ window.storage.set(storageKey, JSON.stringify(parentBookedLessons), false); }catch(e){} }
    renderParentSchedulePanel();
  } else {
    eduBookedSlots.splice(idx, 1);
    if(window.storage){ try{ window.storage.set(storageKey, JSON.stringify(eduBookedSlots), false); }catch(e){} }
    renderEducatorSchedulePanel();
  }
}

/* ---- Educator schedule state ---- */

let currentEduAvailableHours = new Set();
let eduScheduleInited = false;
let eduBookedSlots = []; // no real bookings system yet — starts empty, loaded from storage if saved before

async function renderEducatorSchedulePanel(){
  if(!eduScheduleInited){
    eduScheduleInited = true;
    if(window.storage){
      try{
        const r = await window.storage.get('educator-schedule:' + currentUser.id, false);
        if(r && r.value) currentEduAvailableHours = expandSlotsToHours(JSON.parse(r.value));
      }catch(e){ /* nothing saved yet */ }
      try{
        const r2 = await window.storage.get('educator-bookings:' + currentUser.id, false);
        if(r2 && r2.value) eduBookedSlots = JSON.parse(r2.value);
      }catch(e){ /* nothing saved yet */ }
    }
  }

  const el = document.getElementById('edu-dash-panel');
  el.innerHTML = '<h3>My schedule</h3><p class="panel-sub">Click a cell to mark yourself available. Booked lessons show automatically and can\'t be edited here.</p>'+
    '<div class="sched-legend"><span><span class="sched-legend-dot" style="background:var(--blue);"></span>Available</span><span><span class="sched-legend-dot" style="background:var(--warning);"></span>Booked lesson</span></div>'+
    '<div id="edu-sched-grid"></div>'+
    '<div style="display:flex;gap:10px;align-items:center;margin-top:16px;margin-bottom:20px;">'+
      '<button class="btn-ask" onclick="saveEducatorSchedule()">Save schedule</button>'+
      '<span id="edu-sched-saved-msg" style="display:none;font-size:12.5px;color:var(--green-text);font-weight:700;">Saved ✓</span>'+
    '</div>'+
    bookingFormHTML('educator')+
    bookingListHTML(eduBookedSlots, 'educator');
  renderScheduleGrid('edu-sched-grid', {
    getCellState: (d,h) => {
      if(eduBookedSlots.some(b => b.day===d && h<b.end && (h+SLOT_DURATION)>b.start)) return 'booked';
      return currentEduAvailableHours.has(hourKey(d,h)) ? 'available' : 'empty';
    },
    getBookedEntry: (d,h) => eduBookedSlots.find(b=>b.day===d && h<b.end && (h+SLOT_DURATION)>b.start),
    onClickName: 'toggleEducatorHour'
  });
  renderBookingPickers('educator');
}

function toggleEducatorHour(day, hour){
  const key = hourKey(day, hour);
  if(currentEduAvailableHours.has(key)) currentEduAvailableHours.delete(key); else currentEduAvailableHours.add(key);
  renderEducatorSchedulePanel();
}

function saveEducatorSchedule(){
  const slots = compressHoursToSlots(currentEduAvailableHours);
  const msg = document.getElementById('edu-sched-saved-msg');
  msg.style.display = 'inline';
  setTimeout(() => { msg.style.display = 'none'; }, 2500);
  if(window.storage){
    try{ window.storage.set('educator-schedule:' + currentUser.id, JSON.stringify(slots), false); }catch(e){}
  }
}

function hourLabel(h){
  if(h === 12) return "12pm";
  if(h === 0) return "12am";
  return h < 12 ? h + "am" : (h - 12) + "pm";
}

const filterState = {
  level: new Set(), subject: new Set(),
  quallevel: new Set(), background: new Set(), gender: new Set(), race: new Set()
};

let parentSlots = []; // {day, start, end} — a parent's own free-time entries, built one at a time

function renderDropdownPanel(ddKey){
  const panel = document.getElementById('ddpanel-' + ddKey);
  panel.innerHTML = DROPDOWNS[ddKey].groups.map(g =>
    '<div class="dd-group-label">'+g.label+'</div><div class="chip-picker">'+
    g.options.map(opt => '<div class="fchip'+(filterState[g.stateKey].has(opt)?' active':'')+'" onclick="toggleChip(\''+g.stateKey+'\', this)">'+opt+'</div>').join('') +
    '</div>'
  ).join('');
}

/* Subject options depend on which level(s) are selected — Music/Other Skills are never restricted. */

function getAllowedSubjects(){
  if(filterState.level.size === 0) return null; // null = no restriction, show everything
  const allowed = new Set();
  filterState.level.forEach(lvl => (LEVEL_SUBJECTS[lvl] || []).forEach(s => allowed.add(s)));
  return allowed;
}

function renderSubjectPanel(){
  const allowed = getAllowedSubjects();
  const panel = document.getElementById('ddpanel-subject');
  panel.innerHTML = DROPDOWNS.subject.groups.map(g => {
    const isCurriculumBound = (g.label === "Academic" || g.label === "Humanities" || g.label === "Mother Tongue");
    const opts = (isCurriculumBound && allowed) ? g.options.filter(o => allowed.has(o)) : g.options;
    if(opts.length === 0) return '';
    return '<div class="dd-group-label">'+g.label+'</div><div class="chip-picker">'+
      opts.map(opt => '<div class="fchip'+(filterState.subject.has(opt)?' active':'')+'" onclick="toggleChip(\'subject\', this)">'+opt+'</div>').join('') +
    '</div>';
  }).join('');
  if(allowed){
    [...filterState.subject].forEach(s => { if(!allowed.has(s)) filterState.subject.delete(s); });
  }
  updateDropdownTrigger('subject');
}

function toggleChip(stateKey, el){
  const value = el.textContent;
  el.classList.toggle('active');
  if(filterState[stateKey].has(value)) filterState[stateKey].delete(value);
  else filterState[stateKey].add(value);
  Object.keys(DROPDOWNS).forEach(updateDropdownTrigger);
  if(stateKey === 'level') renderSubjectPanel(); // subject options depend on level
}

function updateDropdownTrigger(ddKey){
  let total;
  if(ddKey === 'schedule'){
    total = parentSlots.length;
  } else {
    const stateKeys = [...new Set(DROPDOWNS[ddKey].groups.map(g => g.stateKey))];
    total = stateKeys.reduce((sum, k) => sum + filterState[k].size, 0);
  }
  const trigger = document.getElementById('ddtrigger-' + ddKey);
  const countEl = trigger.querySelector('.dd-count');
  if(total > 0){
    countEl.textContent = total;
    countEl.style.display = 'inline-block';
    trigger.classList.add('has-selection');
  } else {
    countEl.style.display = 'none';
    trigger.classList.remove('has-selection');
  }
}

function toggleDropdown(ddKey){
  const panel = document.getElementById('ddpanel-' + ddKey);
  const isOpen = panel.classList.contains('open');
  document.querySelectorAll('.dd-panel').forEach(p => p.classList.remove('open'));
  if(!isOpen) panel.classList.add('open');
}

document.addEventListener('click', function(ev){
  if(!ev.target.closest('.filter-dd')){
    document.querySelectorAll('.dd-panel').forEach(p => p.classList.remove('open'));
  }
});

/* ---------------- SCHEDULE BUILDER (per-day free-time entries) ---------------- */

function renderSchedulePickers(){
  document.getElementById('sched-day').innerHTML = DAYS.map(d => '<option>'+d+'</option>').join('');
  document.getElementById('sched-start').innerHTML = HOUR_MARKS.slice(0, -1).map(h => '<option value="'+h+'">'+hourLabel(h)+'</option>').join('');
  document.getElementById('sched-end').innerHTML = HOUR_MARKS.slice(1).map(h => '<option value="'+h+'">'+hourLabel(h)+'</option>').join('');
  document.getElementById('sched-end').selectedIndex = document.getElementById('sched-end').options.length - 1;
}

function addScheduleSlot(){
  const day = document.getElementById('sched-day').value;
  const start = parseInt(document.getElementById('sched-start').value, 10);
  const end = parseInt(document.getElementById('sched-end').value, 10);
  const warning = document.getElementById('sched-warning');
  if(end <= start){
    warning.style.display = 'block';
    return;
  }
  warning.style.display = 'none';
  parentSlots.push({day, start, end});
  renderScheduleTags();
  updateDropdownTrigger('schedule');
}

function removeScheduleSlot(idx){
  parentSlots.splice(idx, 1);
  renderScheduleTags();
  updateDropdownTrigger('schedule');
}

function renderScheduleTags(){
  const list = document.getElementById('sched-slots-list');
  if(parentSlots.length === 0){
    list.innerHTML = '<p style="font-size:12px;color:var(--text-secondary);margin:10px 0 0;">No specific times added yet — add one above, or leave blank to match any schedule.</p>';
    return;
  }
  list.innerHTML = parentSlots.map((s,i) =>
    '<div class="sched-tag"><span>'+s.day+', '+hourLabel(s.start)+' – '+hourLabel(s.end)+'</span><button onclick="removeScheduleSlot('+i+')">&times;</button></div>'
  ).join('');
}

function initFilterPickers(){
  Object.keys(DROPDOWNS).forEach(k => {
    if(k === 'subject') renderSubjectPanel();
    else if(k === 'schedule'){ /* handled by renderSchedulePickers/renderScheduleTags below */ }
    else renderDropdownPanel(k);
    updateDropdownTrigger(k);
  });
  renderSchedulePickers();
  renderScheduleTags();
}

function scheduleMatches(educator){
  if(parentSlots.length === 0) return true;
  return educator.availability.some(slot =>
    parentSlots.some(ps => ps.day === slot.day && slot.start < ps.end && slot.end > ps.start)
  );
}

function applyAllFilters(){
  let list = activeFilter === "all" ? EDUCATORS : EDUCATORS.filter(e => e.category === activeFilter);

  if(filterState.level.size) list = list.filter(e => e.levels.some(l => filterState.level.has(l)));
  if(filterState.subject.size) list = list.filter(e => e.subjects.some(s => filterState.subject.has(s)));
  list = list.filter(scheduleMatches);
  if(filterState.quallevel.size) list = list.filter(e => filterState.quallevel.has(e.qualLevel));
  if(filterState.background.size) list = list.filter(e => e.background.some(b => filterState.background.has(b)));
  if(filterState.gender.size) list = list.filter(e => filterState.gender.has(e.gender === 'female' ? 'Female' : 'Male'));
  if(filterState.race.size) list = list.filter(e => filterState.race.has(e.ethnicity));

  renderResults(list);
}

function applyManualFilters(){
  applyAllFilters();
  document.querySelectorAll('.dd-panel').forEach(p => p.classList.remove('open'));
  document.getElementById('results-grid').scrollIntoView({behavior:'smooth', block:'start'});
}

function clearManualFilters(){
  Object.keys(filterState).forEach(k => filterState[k].clear());
  parentSlots = [];
  document.querySelectorAll('.fchip.active').forEach(el => el.classList.remove('active'));
  renderSubjectPanel();
  renderScheduleTags();
  Object.keys(DROPDOWNS).forEach(updateDropdownTrigger);
  applyAllFilters();
}

/* ---------------- RESULTS RENDER ---------------- */

function showMoreEducators(){
  document.getElementById('more-educators-note').style.display = 'block';
}

function renderResults(list){
  const grid = document.getElementById('results-grid');
  document.getElementById('results-count').textContent = list.length + (list.length===1?' educator':' educators');
  if(!list.length){
    grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1;"><h3>No educators match those filters</h3><p>Try loosening a filter — schedule and race are usually the most restrictive.</p><button class="btn-outline" onclick="clearManualFilters()">Clear filters</button></div>';
    return;
  }
  grid.innerHTML = list.map(e => cardHTML(e)).join('');
}

function initials(name){ return name.split(' ').map(p=>p[0]).slice(0,2).join('').toUpperCase(); }

function cardHTML(e, matchScore){
  const badge = e.verified === "approved"
    ? '<span class="verified-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>Verified</span>'
    : '<span class="pending-badge">Verification pending</span>';
  const matchTier = matchScore >= 85 ? 'high' : matchScore >= 65 ? 'mid' : '';
  const matchHTML = (matchScore !== undefined) ? '<div class="match-badge '+matchTier+'">'+matchScore+'% match</div>' : '';
  return '<div class="card" onclick="openProfile('+e.id+')">'+
    matchHTML+
    '<div class="card-top">'+
      '<div class="avatar" style="background:'+e.color+'">'+initials(e.name)+'</div>'+
      '<div><div class="card-name-row"><h3>'+e.name+'</h3>'+badge+'</div><p class="card-headline">'+e.headline+'</p></div>'+
    '</div>'+
    '<div class="card-tags">'+ e.subjects.map(s=>'<span class="tag">'+s+'</span>').join('') + '<span class="tag">'+e.mode+'</span>' +'</div>'+
    '<div class="card-footer">'+
      '<div class="rating"><span class="stars">&#9733;</span>'+e.rating+' <span style="color:var(--text-secondary);font-weight:400;">('+e.reviews+')</span></div>'+
      '<div class="rate">'+e.rate+'</div>'+
    '</div>'+
  '</div>';
}

/* ---------------- MATCH SCORING ---------------- */

function computeMatchScore(text, e){
  const haystack = (e.subjects.join(' ') + ' ' + e.levels.join(' ') + ' ' + e.headline + ' ' + e.bio + ' ' + e.category).toLowerCase();
  let score = 0;

  const subjectHit = SUBJECT_KEYWORDS.some(k => text.includes(k) && haystack.includes(k));
  if(subjectHit) score += 42;

  const levelHit = LEVEL_KEYWORDS.some(k => text.includes(k) && haystack.includes(k));
  if(levelHit) score += 28;

  const styleHit = STYLE_KEYWORDS.some(k => text.includes(k) && (haystack.includes('patient') || haystack.includes('encourag') || haystack.includes('structured') || haystack.includes('hands-on') || haystack.includes('warm')));
  if(styleHit) score += 10;

  // small baseline so nothing scores 0, plus a rating-based nudge so strong educators edge ahead among ties
  score += Math.round((e.rating / 5) * 15);
  score += 5;

  return Math.min(98, score);
}

function buildSummaryChips(text){
  if(!text) return '';
  const foundLevel = LEVEL_KEYWORDS.find(k => text.includes(k));
  const foundSubject = SUBJECT_KEYWORDS.find(k => text.includes(k));
  let foundAbility = ABILITY_KEYWORDS.find(k => text.includes(k));
  if(!foundAbility) foundAbility = FOCUS_TRIGGERS.find(k => text.includes(k));
  const foundStyle = STYLE_KEYWORDS.find(k => text.includes(k));
  const foundPref = PREF_KEYWORDS.find(k => text.includes(k));

  const chip = (cls, label, value) => '<div class="chip '+cls+'"><span class="chip-label">'+label+'</span>'+value+'</div>';

  let html = '';
  if(foundLevel) html += chip('level','Level', foundLevel);
  if(foundSubject) html += chip('subject','Subject', foundSubject);
  if(foundAbility) html += chip('focus','Ability', foundAbility);
  if(foundStyle) html += chip('pref','Style', foundStyle);
  if(foundPref) html += chip('pref','Preference', foundPref);
  return html;
}

function goToMatches(){
  const text = document.getElementById('request-input').value.toLowerCase().trim();
  const chipsSource = buildSummaryChips(text);

  const scored = EDUCATORS.map(e => ({ e, score: text ? computeMatchScore(text, e) : Math.round((e.rating/5)*60 + 20) }))
    .sort((a,b) => b.score - a.score);

  document.getElementById('matches-subline').textContent = text
    ? "Based on what you told ME, ranked by fit."
    : "Tell ME more about your child on the search page for a personalised ranking — for now, here's our top-rated educators.";
  document.getElementById('matches-chips').innerHTML = chipsSource;

  document.getElementById('matches-grid').innerHTML = scored.map(s => cardHTML(s.e, s.score)).join('');
  showView('matches');
}

/* ---------------- PROFILE MODAL ---------------- */

function openProfile(id){
  const e = EDUCATORS.find(x=>x.id===id);
  const overlay = document.getElementById('modal-overlay');
  const badge = e.verified === "approved"
    ? '<span class="verified-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>Verified educator</span>'
    : '<span class="pending-badge">Verification in progress</span>';

  document.getElementById('modal-content').innerHTML =
  '<div class="modal-header">'+
    '<button class="modal-close" onclick="closeModal()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg></button>'+
    '<div class="modal-profile-top">'+
      '<div class="modal-avatar" style="background:'+e.color+'">'+initials(e.name)+'</div>'+
      '<div><h2>'+e.name+'</h2><p class="card-headline" style="margin-bottom:8px;">'+e.headline+'</p>'+badge+'</div>'+
    '</div>'+
  '</div>'+
  '<div class="modal-body">'+
    '<div class="card-tags" style="margin-bottom:16px;">'+ e.subjects.map(s=>'<span class="tag">'+s+'</span>').join('') + e.levels.slice(0,3).map(l=>'<span class="tag">'+l+'</span>').join('') + '<span class="tag">'+e.mode+'</span>' +'</div>'+
    '<div style="display:flex;gap:20px;font-size:13.5px;color:var(--text-secondary);">'+
      '<div><span class="stars" style="color:var(--warning);">&#9733;</span> <strong style="color:var(--text-primary);">'+e.rating+'</strong> ('+e.reviews+' reviews)</div>'+
      '<div><strong style="color:var(--text-primary);">'+e.rate+'</strong></div>'+
    '</div>'+
    '<div class="modal-section"><h4>About</h4><p>'+e.bio+'</p></div>'+
    '<div class="modal-section"><h4>Experience</h4>'+
      e.experience.map(x=>'<div class="exp-item"><div class="exp-dot"></div><div class="exp-text"><strong>'+x.role+'</strong><br>'+x.org+'<br><span class="exp-meta">'+x.dates+'</span></div></div>').join('')+
    '</div>'+
    '<div class="modal-section"><h4>Qualifications</h4>'+
      e.quals.map(q => {
        const statusBadge = q.status === "approved" ? '<span class="verified-badge" style="margin-left:8px;">Verified</span>' : '<span class="pending-badge" style="margin-left:8px;">Pending review</span>';
        return '<div class="qual-item"><div class="qual-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z"/></svg></div><div class="qual-text"><strong>'+q.title+statusBadge+'</strong><span class="qual-meta">'+q.institution+' &middot; '+q.year+'</span></div></div>';
      }).join('')+
    '</div>'+
    '<div class="modal-section"><h4>What parents say</h4>'+
      e.testimonials.map(t=>'<div class="review-item"><div class="review-top"><span class="review-author">'+t.author+'</span><span class="review-stars">'+'&#9733;'.repeat(t.rating)+'</span></div><p class="review-text">'+t.text+'</p></div>').join('')+
    '</div>'+
  '</div>';

  overlay.classList.remove('hidden');
}

function closeModal(){ document.getElementById('modal-overlay').classList.add('hidden'); }

function closeModalOnOverlay(ev){ if(ev.target.id === 'modal-overlay') closeModal(); }

/* ---------------- NAV / VIEW SWITCHING ---------------- */

function showView(view){
  ['market','teach','parent','about','educator','matches'].forEach(v=>{
    const el = document.getElementById('view-'+v);
    if(el) el.style.display = (v===view) ? 'block' : 'none';
  });
  ['market','teach'].forEach(v => {
    document.getElementById('nav-'+v)?.classList.toggle('active', v===view);
  });
  if(view==='parent'){ showDashPanel('children'); loadDashboardGreeting('parent'); }
  if(view==='educator'){ showEduDashPanel('profile'); loadDashboardGreeting('educator'); }
  window.scrollTo({top:0, behavior:'smooth'});
}

async function loadDashboardGreeting(role){
  const headingId = role==='parent' ? 'parent-welcome-heading' : 'educator-welcome-heading';
  const heading = document.getElementById(headingId);

  if(currentUser && currentUser.name){
    heading.textContent = 'Welcome back, ' + currentUser.name;
    return;
  }
  if(!currentUser){ heading.textContent = 'Welcome back'; return; }

  // Signed in via login (not signup), so we don't have the name cached locally yet — fetch it.
  const table = role==='parent' ? 'parents' : 'educators';
  const { data } = await sb.from(table).select('full_name').eq('user_id', currentUser.id).single();
  if(data && data.full_name){
    currentUser.name = data.full_name;
    heading.textContent = 'Welcome back, ' + data.full_name;
  } else {
    heading.textContent = 'Welcome back';
  }
}

/* ---------------- EDUCATOR DASHBOARD SCAFFOLD ---------------- */

let myEducatorProfile = null; // cached after first fetch, to avoid refetching on every tab click

async function fetchMyEducatorProfile(forceRefresh){
  if(myEducatorProfile && !forceRefresh) return myEducatorProfile;
  const { data } = await sb.from('educators')
    .select('full_name, headline, bio, years_experience, verification_status, hourly_rate_min, hourly_rate_max, location_area, languages_spoken, teaching_mode, profile_photo_url')
    .eq('user_id', currentUser.id).single();
  myEducatorProfile = data;
  return data;
}

async function renderQualsPanel(el){
  const { data: quals } = await sb.from('qualifications')
    .select('id, title, institution, year_obtained, qualification_type, verification_status, document_url')
    .eq('educator_id', currentUser.id)
    .order('created_at', { ascending: false });

  el.innerHTML = '<h3>Qualifications & certificates</h3><p class="panel-sub">Each one is reviewed independently by our verification team.</p>'+
    '<div id="quals-list">'+
    (!quals || quals.length===0
      ? '<div class="empty-state"><h3>No qualifications added yet</h3><p>Add your degrees, diplomas, or certificates so parents can see them.</p></div>'
      : quals.map(q=>{
          const badge = q.verification_status==='approved' ? '<span class="verified-badge">Verified</span>' : '<span class="pending-badge">Pending review</span>';
          const viewLink = q.document_url ? ' &middot; <span style="color:var(--blue);cursor:pointer;font-weight:600;" onclick="viewCertificate(\''+q.document_url+'\')">View certificate</span>' : '';
          return '<div class="qual-item" style="margin-bottom:14px;"><div class="qual-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z"/></svg></div><div class="qual-text"><strong>'+q.title+' '+badge+'</strong><span class="qual-meta">'+(q.institution||'')+' &middot; '+(q.qualification_type||'')+' &middot; '+(q.year_obtained||'')+viewLink+'</span></div></div>';
        }).join('')
    )+
    '</div>'+
    '<button class="btn-outline" id="btn-show-add-qual" style="margin-top:8px;" onclick="showAddQualForm()">+ Add a qualification</button>'+
    '<div id="add-qual-form" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--hairline);">'+
      '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Title</label>'+
      '<input type="text" id="qual-title-input" placeholder="e.g. B.Sc (Hons) Mathematics" class="signin-input" />'+
      '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Type</label>'+
      '<select id="qual-type-input" class="signin-input">'+
        '<option value="degree">Degree</option><option value="diploma">Diploma</option>'+
        '<option value="certification">Certification</option><option value="license">License</option>'+
        '<option value="award">Award</option><option value="other">Other</option>'+
      '</select>'+
      '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Institution</label>'+
      '<input type="text" id="qual-institution-input" placeholder="e.g. National University of Singapore" class="signin-input" />'+
      '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Year obtained</label>'+
      '<input type="number" id="qual-year-input" min="1950" max="2030" class="signin-input" />'+
      '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Certificate (PDF or image)</label>'+
      '<input type="file" id="qual-file-input" accept="application/pdf,image/*" class="signin-input" />'+
      '<p id="qual-form-error" style="display:none;font-size:12.5px;color:var(--error);font-weight:600;margin:0 0 12px;"></p>'+
      '<div style="display:flex;gap:10px;">'+
        '<button class="btn-ask" onclick="submitNewQual()">Save qualification</button>'+
        '<button class="btn-outline" onclick="hideAddQualForm()">Cancel</button>'+
      '</div>'+
    '</div>';
}

function showAddQualForm(){
  document.getElementById('add-qual-form').style.display = 'block';
  document.getElementById('btn-show-add-qual').style.display = 'none';
}
function hideAddQualForm(){
  document.getElementById('add-qual-form').style.display = 'none';
  document.getElementById('btn-show-add-qual').style.display = 'inline-block';
}

async function submitNewQual(){
  const title = document.getElementById('qual-title-input').value.trim();
  const type = document.getElementById('qual-type-input').value;
  const institution = document.getElementById('qual-institution-input').value.trim();
  const year = document.getElementById('qual-year-input').value;
  const file = document.getElementById('qual-file-input').files[0];
  const errorEl = document.getElementById('qual-form-error');

  if(!title){
    errorEl.textContent = 'Please enter a title.';
    errorEl.style.display = 'block';
    return;
  }
  errorEl.style.display = 'none';

  let documentPath = null;
  if(file){
    const path = currentUser.id + '/' + Date.now() + '_' + file.name;
    const { error: uploadError } = await sb.storage.from('certificates').upload(path, file, { upsert: true });
    if(uploadError){
      errorEl.textContent = 'Certificate upload failed: ' + uploadError.message;
      errorEl.style.display = 'block';
      return;
    }
    documentPath = path;
  }

  const { error } = await sb.from('qualifications').insert({
    educator_id: currentUser.id,
    title,
    qualification_type: type,
    institution: institution || null,
    year_obtained: year ? parseInt(year, 10) : null,
    document_url: documentPath
  });

  if(error){
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
    return;
  }

  showEduDashPanel('quals'); // reload the list, now including the new one
}

async function viewCertificate(path){
  const { data, error } = await sb.storage.from('certificates').createSignedUrl(path, 60);
  if(error){ alert('Could not open certificate: ' + error.message); return; }
  window.open(data.signedUrl, '_blank');
}

async function uploadProfilePhoto(input){
  const file = input.files[0];
  if(!file) return;
  const statusEl = document.getElementById('photo-upload-status');
  statusEl.style.display = 'block';
  statusEl.style.color = 'var(--text-secondary)';
  statusEl.textContent = 'Uploading...';

  const path = currentUser.id + '/' + Date.now() + '_' + file.name;
  const { error: uploadError } = await sb.storage.from('profile-photos').upload(path, file, { upsert: true });

  if(uploadError){
    statusEl.style.color = 'var(--error)';
    statusEl.textContent = uploadError.message;
    return;
  }

  const { data: urlData } = sb.storage.from('profile-photos').getPublicUrl(path);
  const { error: updateError } = await sb.from('educators').update({ profile_photo_url: urlData.publicUrl }).eq('user_id', currentUser.id);

  if(updateError){
    statusEl.style.color = 'var(--error)';
    statusEl.textContent = updateError.message;
    return;
  }

  showEduDashPanel('profile', true); // reload with the new photo
}

function showEditProfileForm(){
  document.getElementById('edit-profile-form').style.display = 'block';
  document.getElementById('btn-show-edit-profile').style.display = 'none';
}
function hideEditProfileForm(){
  document.getElementById('edit-profile-form').style.display = 'none';
  document.getElementById('btn-show-edit-profile').style.display = 'inline-block';
}

async function submitProfileEdit(){
  const errorEl = document.getElementById('edit-profile-error');
  const rateMin = document.getElementById('edit-rate-min-input').value;
  const rateMax = document.getElementById('edit-rate-max-input').value;

  if(rateMin && rateMax && parseFloat(rateMin) > parseFloat(rateMax)){
    errorEl.textContent = 'Minimum rate must be less than or equal to maximum rate.';
    errorEl.style.display = 'block';
    return;
  }
  errorEl.style.display = 'none';

  const languages = document.getElementById('edit-languages-input').value
    .split(',').map(s => s.trim()).filter(Boolean);

  const { error } = await sb.from('educators').update({
    headline: document.getElementById('edit-headline-input').value.trim(),
    bio: document.getElementById('edit-bio-input').value.trim(),
    hourly_rate_min: rateMin ? parseFloat(rateMin) : null,
    hourly_rate_max: rateMax ? parseFloat(rateMax) : null,
    location_area: document.getElementById('edit-location-input').value.trim() || null,
    languages_spoken: languages.length ? languages : null,
    teaching_mode: document.getElementById('edit-mode-input').value
  }).eq('user_id', currentUser.id);

  if(error){
    errorEl.textContent = error.message;
    errorEl.style.display = 'block';
    return;
  }

  await showEduDashPanel('profile', true); // reload with fresh data
}

async function showEduDashPanel(panel, forceRefresh){
  document.querySelectorAll('#edu-dash-nav button').forEach((b,i)=>{
    b.classList.toggle('active', ['profile','schedule','quals','requests','reviews','settings'][i]===panel);
  });
  const el = document.getElementById('edu-dash-panel');

  if(panel==='profile'){
    el.innerHTML = '<p class="panel-sub">Loading your profile...</p>';
    const p = await fetchMyEducatorProfile(forceRefresh);
    if(!p){ el.innerHTML = '<h3>My profile</h3><p class="panel-sub">Couldn\'t load your profile — try refreshing the page.</p>'; return; }
    const badge = p.verification_status === 'approved'
      ? '<span class="verified-badge"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>Verified educator</span>'
      : '<span class="pending-badge">'+(p.verification_status||'pending').replace('_',' ')+'</span>';
    const avatarHTML = p.profile_photo_url
      ? '<img src="'+p.profile_photo_url+'" style="width:60px;height:60px;border-radius:50%;object-fit:cover;" />'
      : '<div class="avatar" style="background:var(--blue);width:60px;height:60px;font-size:19px;">'+initials(p.full_name||'?')+'</div>';
    el.innerHTML = '<h3>My profile</h3><p class="panel-sub">This is what parents see on the marketplace.</p>'+
      '<div style="margin-bottom:16px;">'+badge+'</div>'+
      '<div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;">'+
        avatarHTML+
        '<div><strong style="display:block;font-size:16px;">'+(p.full_name||'')+'</strong><span style="font-size:13px;color:var(--text-secondary);">'+(p.headline||'No headline set yet')+'</span></div>'+
      '</div>'+
      '<label class="btn-outline" style="display:inline-block;cursor:pointer;margin-bottom:20px;">'+
        'Change profile photo<input type="file" id="photo-upload-input" accept="image/*" style="display:none;" onchange="uploadProfilePhoto(this)" />'+
      '</label>'+
      '<p id="photo-upload-status" style="font-size:12.5px;color:var(--text-secondary);display:none;"></p>'+
      '<p style="font-size:13.5px;color:var(--text-secondary);margin-bottom:8px;">'+(p.bio||'No bio yet.')+' &middot; '+(p.years_experience||0)+' yrs experience</p>'+
      '<p style="font-size:13px;color:var(--text-secondary);margin-bottom:16px;">'+
        (p.hourly_rate_min ? '$'+p.hourly_rate_min+'-'+p.hourly_rate_max+'/hr' : 'Rate not set')+' &middot; '+
        (p.location_area || 'Location not set')+' &middot; '+
        (p.languages_spoken && p.languages_spoken.length ? p.languages_spoken.join(', ') : 'Languages not set')+
      '</p>'+
      '<button class="btn-outline" id="btn-show-edit-profile" onclick="showEditProfileForm()">Edit profile details</button>'+
      '<div id="edit-profile-form" style="display:none;margin-top:16px;padding-top:16px;border-top:1px solid var(--hairline);">'+
        '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Headline</label>'+
        '<input type="text" id="edit-headline-input" value="'+(p.headline||'')+'" class="signin-input" />'+
        '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Bio</label>'+
        '<textarea id="edit-bio-input" rows="3" class="signin-input" style="resize:none;">'+(p.bio||'')+'</textarea>'+
        '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Hourly rate (min - max, SGD)</label>'+
        '<div style="display:flex;gap:8px;margin-bottom:14px;">'+
          '<input type="number" id="edit-rate-min-input" min="0" placeholder="Min" value="'+(p.hourly_rate_min||'')+'" class="signin-input" style="margin-bottom:0;" />'+
          '<input type="number" id="edit-rate-max-input" min="0" placeholder="Max" value="'+(p.hourly_rate_max||'')+'" class="signin-input" style="margin-bottom:0;" />'+
        '</div>'+
        '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Location / area</label>'+
        '<input type="text" id="edit-location-input" placeholder="e.g. Bukit Timah, or Islandwide" value="'+(p.location_area||'')+'" class="signin-input" />'+
        '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Languages spoken (comma-separated)</label>'+
        '<input type="text" id="edit-languages-input" placeholder="e.g. English, Mandarin" value="'+(p.languages_spoken?p.languages_spoken.join(', '):'')+'" class="signin-input" />'+
        '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Teaching mode</label>'+
        '<select id="edit-mode-input" class="signin-input">'+
          '<option value="online"'+(p.teaching_mode==='online'?' selected':'')+'>Online</option>'+
          '<option value="in_person"'+(p.teaching_mode==='in_person'?' selected':'')+'>In-person</option>'+
          '<option value="hybrid"'+(p.teaching_mode==='hybrid'?' selected':'')+'>Hybrid</option>'+
        '</select>'+
        '<p id="edit-profile-error" style="display:none;font-size:12.5px;color:var(--error);font-weight:600;margin:0 0 12px;"></p>'+
        '<div style="display:flex;gap:10px;">'+
          '<button class="btn-ask" onclick="submitProfileEdit()">Save changes</button>'+
          '<button class="btn-outline" onclick="hideEditProfileForm()">Cancel</button>'+
        '</div>'+
      '</div>';

  } else if(panel==='schedule'){
    renderEducatorSchedulePanel();

  } else if(panel==='quals'){
    el.innerHTML = '<p class="panel-sub">Loading...</p>';
    await renderQualsPanel(el);

  } else if(panel==='requests'){
    el.innerHTML = '<h3>Requests from parents</h3><p class="panel-sub">Parents whose ME AI match included you.</p>'+
      '<div class="empty-state"><h3>No requests yet</h3><p>When a parent\'s search matches your profile, it\'ll show up here.</p></div>';

  } else if(panel==='reviews'){
    el.innerHTML = '<p class="panel-sub">Loading...</p>';
    const { data: reviews } = await sb.from('reviews').select('rating, comment').eq('educator_id', currentUser.id).eq('status', 'published');
    el.innerHTML = '<h3>Reviews</h3><p class="panel-sub">Feedback from parents after completed lessons.</p>'+
      (!reviews || reviews.length===0
        ? '<div class="empty-state"><h3>No reviews yet</h3><p>Reviews from parents will appear here after completed lessons.</p></div>'
        : reviews.map(r=>'<div class="review-item"><div class="review-top"><span class="review-stars">'+'&#9733;'.repeat(r.rating)+'</span></div><p class="review-text">'+r.comment+'</p></div>').join('')
      );

  } else if(panel==='settings'){
    renderAccountSettingsPanel(el);
  }
}

/* ---------------- SHARED: ACCOUNT SETTINGS (real) ---------------- */

function renderAccountSettingsPanel(el){
  el.innerHTML = '<h3>Account settings</h3><p class="panel-sub">Update your email or password.</p>'+
    '<div style="max-width:360px;">'+
      '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Email</label>'+
      '<input type="email" id="settings-email-input" value="'+(currentUser.email||'')+'" class="signin-input" />'+
      '<button class="btn-outline" style="margin-bottom:20px;" onclick="updateMyEmail()">Update email</button>'+
      '<p id="settings-email-status" style="display:none;font-size:12.5px;margin:-14px 0 20px;"></p>'+

      '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">New password</label>'+
      '<input type="password" id="settings-password-input" placeholder="At least 6 characters" class="signin-input" />'+
      '<label style="font-size:12px;font-weight:700;color:var(--text-secondary);display:block;margin-bottom:6px;">Confirm new password</label>'+
      '<input type="password" id="settings-password-confirm-input" class="signin-input" />'+
      '<p id="settings-password-status" style="display:none;font-size:12.5px;margin:-2px 0 14px;"></p>'+
      '<button class="btn-ask" onclick="updateMyPassword()">Update password</button>'+
    '</div>';
}

async function updateMyEmail(){
  const newEmail = document.getElementById('settings-email-input').value.trim();
  const statusEl = document.getElementById('settings-email-status');
  statusEl.style.display = 'block';

  if(!newEmail || newEmail === currentUser.email){
    statusEl.style.color = 'var(--error)';
    statusEl.textContent = 'Enter a different email address.';
    return;
  }

  const { error } = await sb.auth.updateUser({ email: newEmail });
  if(error){
    statusEl.style.color = 'var(--error)';
    statusEl.textContent = error.message;
    return;
  }
  statusEl.style.color = 'var(--green-text)';
  statusEl.textContent = 'Check both your old and new email inboxes to confirm this change.';
}

async function updateMyPassword(){
  const pw = document.getElementById('settings-password-input').value;
  const confirm = document.getElementById('settings-password-confirm-input').value;
  const statusEl = document.getElementById('settings-password-status');
  statusEl.style.display = 'block';

  if(pw.length < 6){
    statusEl.style.color = 'var(--error)';
    statusEl.textContent = 'Password must be at least 6 characters.';
    return;
  }
  if(pw !== confirm){
    statusEl.style.color = 'var(--error)';
    statusEl.textContent = "Passwords don't match.";
    return;
  }

  const { error } = await sb.auth.updateUser({ password: pw });
  if(error){
    statusEl.style.color = 'var(--error)';
    statusEl.textContent = error.message;
    return;
  }
  statusEl.style.color = 'var(--green-text)';
  statusEl.textContent = 'Password updated ✓';
  document.getElementById('settings-password-input').value = '';
  document.getElementById('settings-password-confirm-input').value = '';
}

/* ---------------- PARENT DASHBOARD SCAFFOLD ---------------- */

async function showDashPanel(panel){
  document.querySelectorAll('#dash-nav button').forEach((b,i)=>{
    b.classList.toggle('active', ['children','schedule','saved','requests','settings'][i]===panel);
  });
  const el = document.getElementById('dash-panel');

  if(panel==='children'){
    el.innerHTML = '<p class="panel-sub">Loading...</p>';
    const { data: children } = await sb.from('students').select('full_name, education_levels(name)').eq('parent_id', currentUser.id);
    el.innerHTML = '<h3>My children</h3><p class="panel-sub">Add a child\'s profile so ME AI and requests can be tailored to their level.</p>'+
      (!children || children.length===0
        ? '<div class="empty-state"><h3>No children added yet</h3><p>Add your child\'s details to get better educator matches.</p></div>'
        : children.map(c=>'<div class="child-card"><div class="child-avatar">'+initials(c.full_name)+'</div><div class="child-info"><strong>'+c.full_name+'</strong><span>'+(c.education_levels?.name||'Level not set')+'</span></div></div>').join('')
      )+
      '<button class="btn-outline" style="margin-top:8px;">+ Add a child</button>';

  } else if(panel==='schedule'){
    renderParentSchedulePanel();

  } else if(panel==='saved'){
    el.innerHTML = '<h3>Saved educators</h3><p class="panel-sub">Educators you\'ve bookmarked while browsing.</p>'+
      '<div class="empty-state"><h3>No saved educators yet</h3><p>Browse the marketplace and tap the heart on a profile to save it here.</p><button class="btn-outline" onclick="showView(\'market\')">Find an educator</button></div>';

  } else if(panel==='requests'){
    el.innerHTML = '<h3>My requests</h3><p class="panel-sub">Requests you\'ve made through ME AI.</p>'+
      '<div class="empty-state"><h3>No requests yet</h3><p>Use "Ask ME" on the homepage to get matched with educators.</p></div>';

  } else if(panel==='settings'){
    renderAccountSettingsPanel(el);
  }
}

function sendPromptSafe(text){ if(window.sendPrompt) window.sendPrompt(text); }

/* ---------------- THEME TOGGLE ---------------- */

function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('theme-icon-sun').style.display = theme === 'dark' ? 'block' : 'none';
  document.getElementById('theme-icon-moon').style.display = theme === 'dark' ? 'none' : 'block';
  document.getElementById('theme-toggle-btn').title = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
}

function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  if(window.storage){
    try{ window.storage.set('theme-preference', next, false); }catch(e){}
  }
}

async function loadPersistedTheme(){
  if(!window.storage){ applyTheme('light'); return; }
  try{
    const r = await window.storage.get('theme-preference', false);
    applyTheme(r && r.value === 'dark' ? 'dark' : 'light');
  }catch(e){
    applyTheme('light'); // no saved preference yet
  }
}

