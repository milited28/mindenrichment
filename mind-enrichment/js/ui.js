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
  slots.forEach(s => { for(let h = s.start; h < s.end; h++) set.add(hourKey(s.day, h)); });
  return set;
}

function compressHoursToSlots(hourSet){
  const byDay = {};
  DAYS.forEach(d => byDay[d] = []);
  hourSet.forEach(k => {
    const idx = k.lastIndexOf('-');
    byDay[k.slice(0, idx)].push(parseInt(k.slice(idx + 1), 10));
  });
  const slots = [];
  DAYS.forEach(day => {
    const hours = byDay[day].sort((a,b) => a-b);
    let start = null, prev = null;
    hours.forEach(h => {
      if(start === null){ start = h; prev = h; }
      else if(h === prev + 1){ prev = h; }
      else { slots.push({day, start, end: prev+1}); start = h; prev = h; }
    });
    if(start !== null) slots.push({day, start, end: prev+1});
  });
  return slots;
}

function renderScheduleGrid(containerId, opts){
  let html = '<div class="sched-grid-wrap"><table class="sched-grid"><thead><tr><th></th>';
  DAYS.forEach(d => html += '<th>'+d.slice(0,3)+'</th>');
  html += '</tr></thead><tbody>';
  GRID_HOURS.forEach(h => {
    html += '<tr><td class="sched-hour-label">'+hourLabel(h)+'</td>';
    DAYS.forEach(d => {
      const state = opts.getCellState(d, h);
      const clickable = state !== 'booked';
      const title = state === 'booked' ? (opts.bookedLabel(d,h) || 'Booked') : '';
      html += '<td class="sched-cell '+state+'" '+(clickable ? 'onclick="'+opts.onClickName+'(\''+d+'\','+h+')"' : '')+' title="'+title+'"></td>';
    });
    html += '</tr>';
  });
  html += '</tbody></table></div>';
  document.getElementById(containerId).innerHTML = html;
}

/* ---- Parent schedule state ---- */

let parentFreeHours = new Set();

let parentBookedLessons = [{day:"Tuesday", start:17, end:19, label:"Math with Serena Tan"}];

let parentSavedSchedule = [];

function renderParentSchedulePanel(){
  const el = document.getElementById('dash-panel');
  el.innerHTML = '<h3>My schedule</h3><p class="panel-sub">Click a cell to mark your child\'s free time. Sessions already booked show automatically.</p>'+
    '<div class="sched-legend"><span><span class="sched-legend-dot" style="background:var(--green);"></span>Free time</span><span><span class="sched-legend-dot" style="background:var(--warning);"></span>Scheduled tuition</span></div>'+
    '<div id="parent-sched-grid"></div>'+
    '<div style="display:flex;gap:10px;align-items:center;margin-top:16px;">'+
      '<button class="btn-ask" onclick="saveParentSchedule()">Save schedule</button>'+
      '<span id="parent-sched-saved-msg" style="display:none;font-size:12.5px;color:var(--green-text);font-weight:700;">Saved — available to use in search filters ✓</span>'+
    '</div>';
  renderScheduleGrid('parent-sched-grid', {
    getCellState: (d,h) => {
      if(parentBookedLessons.some(b => b.day===d && h>=b.start && h<b.end)) return 'booked';
      return parentFreeHours.has(hourKey(d,h)) ? 'marked' : 'empty';
    },
    bookedLabel: (d,h) => { const b = parentBookedLessons.find(b=>b.day===d && h>=b.start && h<b.end); return b ? b.label : ''; },
    onClickName: 'toggleParentHour'
  });
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
    try{ window.storage.set('parent-schedule:mrs-lim', JSON.stringify(parentSavedSchedule), false); }catch(e){}
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

/* ---- Educator schedule state ---- */

let currentEduAvailableHours = new Set();

let eduScheduleInited = false;

let eduBookedSlots = [{day:"Tuesday", start:17, end:19, label:"Ethan Lim — A-Math"}];

function renderEducatorSchedulePanel(){
  if(!eduScheduleInited){
    currentEduAvailableHours = expandSlotsToHours(EDUCATORS[0].availability);
    eduScheduleInited = true;
  }
  const el = document.getElementById('edu-dash-panel');
  el.innerHTML = '<h3>My schedule</h3><p class="panel-sub">Click a cell to mark yourself available. Booked lessons show automatically and can\'t be edited here.</p>'+
    '<div class="sched-legend"><span><span class="sched-legend-dot" style="background:var(--blue);"></span>Available</span><span><span class="sched-legend-dot" style="background:var(--warning);"></span>Booked lesson</span></div>'+
    '<div id="edu-sched-grid"></div>'+
    '<div style="display:flex;gap:10px;align-items:center;margin-top:16px;">'+
      '<button class="btn-ask" onclick="saveEducatorSchedule()">Save schedule</button>'+
      '<span id="edu-sched-saved-msg" style="display:none;font-size:12.5px;color:var(--green-text);font-weight:700;">Saved — this updates your public availability ✓</span>'+
    '</div>';
  renderScheduleGrid('edu-sched-grid', {
    getCellState: (d,h) => {
      if(eduBookedSlots.some(b => b.day===d && h>=b.start && h<b.end)) return 'booked';
      return currentEduAvailableHours.has(hourKey(d,h)) ? 'available' : 'empty';
    },
    bookedLabel: (d,h) => { const b = eduBookedSlots.find(b=>b.day===d && h>=b.start && h<b.end); return b ? b.label : ''; },
    onClickName: 'toggleEducatorHour'
  });
}

function toggleEducatorHour(day, hour){
  const key = hourKey(day, hour);
  if(currentEduAvailableHours.has(key)) currentEduAvailableHours.delete(key); else currentEduAvailableHours.add(key);
  renderEducatorSchedulePanel();
}

function saveEducatorSchedule(){
  const slots = compressHoursToSlots(currentEduAvailableHours);
  EDUCATORS[0].availability = slots; // live update — search filters reflect this immediately
  const msg = document.getElementById('edu-sched-saved-msg');
  msg.style.display = 'inline';
  setTimeout(() => { msg.style.display = 'none'; }, 2500);
  if(window.storage){
    try{ window.storage.set('educator-schedule:serena-tan', JSON.stringify(slots), false); }catch(e){}
  }
}

async function loadPersistedSchedules(){
  if(!window.storage) return;
  try{
    const r = await window.storage.get('parent-schedule:mrs-lim', false);
    if(r && r.value) parentSavedSchedule = JSON.parse(r.value);
  }catch(e){ /* not saved yet */ }
  try{
    const r2 = await window.storage.get('educator-schedule:serena-tan', false);
    if(r2 && r2.value) EDUCATORS[0].availability = JSON.parse(r2.value);
  }catch(e){ /* not saved yet */ }
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

function showEduDashPanel(panel){
  document.querySelectorAll('#edu-dash-nav button').forEach((b,i)=>{
    b.classList.toggle('active', ['profile','schedule','quals','requests','reviews','settings'][i]===panel);
  });
  const el = document.getElementById('edu-dash-panel');
  if(panel==='profile'){
    el.innerHTML = '<h3>My profile</h3><p class="panel-sub">This is what parents see on the marketplace.</p>'+
      '<div class="verified-badge" style="margin-bottom:16px;"><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>Verified educator</div>'+
      '<div style="display:flex;gap:16px;align-items:center;margin-bottom:20px;">'+
        '<div class="avatar" style="background:var(--blue);width:60px;height:60px;font-size:19px;">ST</div>'+
        '<div><strong style="display:block;font-size:16px;">Serena Tan</strong><span style="font-size:13px;color:var(--text-secondary);">Ex-MOE Math teacher, 8 yrs experience</span></div>'+
      '</div>'+
      '<button class="btn-outline">Edit profile details</button>';
  } else if(panel==='schedule'){
    renderEducatorSchedulePanel();
  } else if(panel==='quals'){
    el.innerHTML = '<h3>Qualifications & certificates</h3><p class="panel-sub">Each one is reviewed independently by our verification team.</p>'+
      MOCK_MY_QUALS.map(q=>{
        const badge = q.status==='approved' ? '<span class="verified-badge">Verified</span>' : '<span class="pending-badge">Pending review</span>';
        return '<div class="qual-item" style="margin-bottom:14px;"><div class="qual-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l7 4v6c0 5-3.5 8-7 10-3.5-2-7-5-7-10V6l7-4z"/></svg></div><div class="qual-text"><strong>'+q.title+' '+badge+'</strong><span class="qual-meta">'+q.institution+' &middot; '+q.year+'</span></div></div>';
      }).join('')+
      '<button class="btn-outline" style="margin-top:8px;">+ Upload a new certificate</button>';
  } else if(panel==='requests'){
    el.innerHTML = '<h3>Requests from parents</h3><p class="panel-sub">Parents whose ME AI match included you.</p>'+
      MOCK_EDU_REQUESTS.map(r=>'<div class="request-row"><span class="req-text">'+r.text+'</span><span class="status-pill '+(r.status==='new'?'searching':'matched')+'">'+(r.status==='new'?'New':'Responded')+'</span></div>').join('');
  } else if(panel==='reviews'){
    el.innerHTML = '<h3>Reviews</h3><p class="panel-sub">Feedback from parents after completed lessons.</p>'+
      '<div class="review-item"><div class="review-top"><span class="review-author">Mrs Ong</span><span class="review-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span></div><p class="review-text">My son went from a C6 to an A2 in one year for A-Math. Ms Tan is patient and explains concepts very clearly.</p></div>'+
      '<div class="review-item"><div class="review-top"><span class="review-author">Mr Farid</span><span class="review-stars">&#9733;&#9733;&#9733;&#9733;&#9733;</span></div><p class="review-text">Very structured lessons, always on time, and gives useful practice questions targeted at weak areas.</p></div>';
  } else if(panel==='settings'){
    el.innerHTML = '<h3>Account settings</h3><p class="panel-sub">Manage your contact details, payout info, and notifications.</p>'+
      '<div class="empty-state"><h3>Coming soon</h3><p>This is a placeholder — account editing will go here.</p></div>';
  }
}

/* ---------------- PARENT DASHBOARD SCAFFOLD ---------------- */

function showDashPanel(panel){
  document.querySelectorAll('#dash-nav button').forEach((b,i)=>{
    b.classList.toggle('active', ['children','schedule','saved','requests','settings'][i]===panel);
  });
  const el = document.getElementById('dash-panel');
  if(panel==='children'){
    el.innerHTML = '<h3>My children</h3><p class="panel-sub">Add a child\'s profile so ME AI and requests can be tailored to their level.</p>'+
      MOCK_CHILDREN.map(c=>'<div class="child-card"><div class="child-avatar">'+c.initials+'</div><div class="child-info"><strong>'+c.name+'</strong><span>'+c.level+'</span></div></div>').join('')+
      '<button class="btn-outline" style="margin-top:8px;">+ Add a child</button>';
  } else if(panel==='schedule'){
    renderParentSchedulePanel();
  } else if(panel==='saved'){
    el.innerHTML = '<h3>Saved educators</h3><p class="panel-sub">Educators you\'ve bookmarked while browsing.</p>'+
      '<div class="empty-state"><h3>No saved educators yet</h3><p>Browse the marketplace and tap the heart on a profile to save it here.</p><button class="btn-outline" onclick="showView(\'market\')">Find an educator</button></div>';
  } else if(panel==='requests'){
    el.innerHTML = '<h3>My requests</h3><p class="panel-sub">Requests you\'ve made through ME AI.</p>'+
      MOCK_REQUESTS.map(r=>'<div class="request-row"><span class="req-text">'+r.text+'</span><span class="status-pill '+r.status+'">'+(r.status==='matched'?'Matched':'Searching')+'</span></div>').join('');
  } else if(panel==='settings'){
    el.innerHTML = '<h3>Account settings</h3><p class="panel-sub">Manage your contact details and notification preferences.</p>'+
      '<div class="empty-state"><h3>Coming soon</h3><p>This is a placeholder — profile editing will go here.</p></div>';
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

