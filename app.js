console.log('[reqord] v0.6.1');
const SUPABASE_URL = 'https://htyfykkurammflwefxgw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iUul7iVeH-ReFlSxVT-ulQ_qhkgzPAz';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;
const STORAGE_KEY = 'reqord-request-work-orders';
const ACTIVITIES_KEY = 'reqord-activities';
const LEGACY_STORAGE_KEY = 'synaps-project-work-orders';
const groups = { new_request: 'New Request', waiting_brief: 'Waiting Brief', working: 'Working', draft_preview: '1st Draft', revision: 'In Revision', preview: 'Preview', on_hold: 'On Hold', approved: 'Approved', done: 'Done', daily: 'Daily', cancelled: 'Cancelled' };
let userName = '';
try { const stored = localStorage.getItem('reqord-username'); if (stored) userName = atob(stored); } catch(e) {}
let isAdmin = false;
let items = repairItemIds(loadItems());
let openedFileName = '';
let hasUnsavedChanges = false;
let hasUnsyncedChanges = false;
let syncSnapshot = new Map(); // id -> signature terakhir yang ada di cloud
let lastSyncedIds = loadLastSyncedIds(); // id yang terakhir ada di cloud (untuk deteksi hapus remote)
let pendingDeletes = loadPendingDeletes(); // id yang gagal dihapus dari cloud (akan di-retry saat sync)
let lastSyncTime = null;
let isLoadingFromCloud = false;
let syncState = 'idle'; // idle | syncing | error
let syncProgress = { done: 0, total: 0 };
let activities = loadStoredActivities();
let isSaving = false;
let deletedItem = null;
let priorityFilter = 'all';
let sortFilter = 'newest';
let monthFilter = 'all';
let requestorFilter = 'all';
const selectedIds = new Set();
const PANEL_PAGE_SIZE = 20;
const panelLimits = {};
function resetPanelLimits() { Object.keys(panelLimits).forEach(key => delete panelLimits[key]); }

function loadItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    console.log('[reqord] loadItems: raw =', raw ? raw.slice(0, 100) : 'null');
    const current = JSON.parse(raw);
    if (Array.isArray(current)) {
      console.log('[reqord] loadItems: loaded', current.length, 'items');
      return current.map(normalizeItem);
    }
    const legacy = JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY));
    if (Array.isArray(legacy)) {
      const migrated = legacy.map(normalizeItem);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));
      return migrated;
    }
    console.log('[reqord] loadItems: no data, starting empty');
    return [];
  } catch (e) {
    console.error('[reqord] loadItems error:', e);
    return [];
  }
}
function saveItems() { hasUnsavedChanges = true; hasUnsyncedChanges = true; persistDraft(); updateSyncStatus(); return items; }
function persistDraft() {
  try {
    const json = JSON.stringify(items);
    localStorage.setItem(STORAGE_KEY, json);
    try { localStorage.setItem(ACTIVITIES_KEY, JSON.stringify(activities)); } catch { /* ignore */ }
    console.log('[reqord] persistDraft: saved', items.length, 'items');
    return true;
  } catch (e) {
    showToast('Gagal simpan: ' + (e.message || 'storage tidak tersedia'));
    console.error('[reqord] persistDraft error:', e);
    return false;
  }
}

function loadStoredActivities() { try { const raw = localStorage.getItem(ACTIVITIES_KEY); const parsed = JSON.parse(raw); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function loadLastSyncedIds() { try { const raw = localStorage.getItem('reqord-last-synced-ids'); const parsed = JSON.parse(raw); return new Set(Array.isArray(parsed) ? parsed : []); } catch { return new Set(); } }
function persistLastSyncedIds() { try { localStorage.setItem('reqord-last-synced-ids', JSON.stringify([...lastSyncedIds])); } catch { /* ignore */ } }
function loadPendingDeletes() { try { const raw = localStorage.getItem('reqord-pending-deletes'); const parsed = JSON.parse(raw); return new Set(Array.isArray(parsed) ? parsed : []); } catch { return new Set(); } }
function persistPendingDeletes() { try { localStorage.setItem('reqord-pending-deletes', JSON.stringify([...pendingDeletes])); } catch { /* ignore */ } }
function activityKey(activity) { return [activity.date, activity.action, activity.title, activity.details].join('|'); }
function addActivity(action, item = {}, details = '') { activities.unshift({ date: nowDateTime(), action, title: item.title || '', requestor: item.requestor || '', details, user: userName || 'Guest' }); persistDraft(); renderActivities(); }
function renderActivities() { const list = document.querySelector('#activityList'); if (!list) return; list.innerHTML = activities.length ? activities.map(activity => `<div class="activity-item"><strong>${escapeHtml(activity.action)}</strong><span>${escapeHtml(activity.title || activity.details || 'reqord')}</span><small>${escapeHtml(activity.user || 'Guest')}${activity.requestor ? ` · ${escapeHtml(activity.requestor)}` : ''} · ${escapeHtml(displayDate(activity.date, true))}</small></div>`).join('') : '<p class="activity-empty">Belum ada activity.</p>'; }
function normalizeDailyProgressCells() { document.querySelectorAll('#dailyTable tr').forEach(row => { const item = findItem(row.querySelector('[data-id]')?.dataset.id); const title = row.querySelector('.title-cell'); const requestor = row.querySelector('td:nth-child(2)'); const priority = row.querySelector('.priority-select')?.closest('td'); if (!item || !title || !requestor || !priority) return; [...row.children].forEach(cell => { if (![title, requestor, priority].includes(cell)) cell.remove(); }); const progress = document.createElement('td'); progress.className = 'daily-progress-cell-wrap'; const done = isDailyDone(item); progress.innerHTML = `<span class="daily-progress-cell"><small>${escapeHtml(displayDate(today(), false))}</small><button class="action-button complete-action daily-check ${done ? 'daily-done' : ''}" data-row-action="daily-done" data-id="${item.id}" title="${done ? 'Selesai, klik untuk batalkan' : 'Tandai selesai'}" aria-label="${done ? 'Selesai, klik untuk batalkan' : 'Tandai selesai'}" aria-pressed="${done}">${done ? '☑' : '☐'}</button></span>`; priority.after(progress); }); }
function renderInlineSubitems() { document.querySelectorAll('.subitem-inline').forEach(row => row.remove()); const statusOrder = ['new_request', 'waiting_brief', 'working', 'draft_preview', 'revision', 'preview', 'on_hold', 'approved', 'done', 'daily', 'cancelled']; statusOrder.forEach(status => { const tbody = document.querySelector(`#${status}Table`); if (!tbody) return; tbody.querySelectorAll('tr:not(.subitem-inline)').forEach(row => { const control = row.querySelector('[data-id]'); const item = control && findItem(control.dataset.id); if (!item || item.type !== 'project') return; item.subitems = Array.isArray(item.subitems) ? item.subitems : []; if (!item.subitems.length) return; const table = row.closest('table'); const inlineRow = document.createElement('tr'); inlineRow.className = 'subitem-inline'; inlineRow.dataset.parentId = item.id; const cell = document.createElement('td'); cell.colSpan = table?.tHead?.rows[0]?.cells.length || 7; cell.innerHTML = `<div class="subitem-inline-list">${item.subitems.map(subitem => `<label class="subitem-inline-item"><input type="checkbox" data-inline-subitem-parent="${item.id}" data-inline-subitem-id="${subitem.id}" ${subitem.done ? 'checked' : ''}><span>${escapeHtml(subitem.title)}</span></label>`).join('')}</div>`; inlineRow.append(cell); row.after(inlineRow); }); }); }
function removeActionCells() { document.querySelectorAll('.table-scroll tbody tr .row-actions').forEach(actions => actions.remove()); }
function makeRowsEditable() { if (!isAdmin) return; document.querySelectorAll('.table-scroll tbody tr').forEach(row => { const control = row.querySelector('[data-id]'); if (!control) return; const id = control.dataset.id; const item = findItem(id); const title = row.querySelector('.title-cell'); const requestor = row.querySelector('td:nth-child(2)'); if (title) { title.removeAttribute('contenteditable'); title.removeAttribute('data-action'); title.removeAttribute('data-id'); title.classList.add('has-subitems'); title.dataset.subitemId = id; title.tabIndex = 0; title.setAttribute('role', 'button'); title.setAttribute('aria-label', `Tambah subitem untuk ${item?.title || 'work order'}`); } if (requestor) { requestor.removeAttribute('contenteditable'); requestor.removeAttribute('data-action'); requestor.removeAttribute('data-id'); } const actions = row.querySelector('.row-actions'); const status = item.status; if (actions && !actions.querySelector('[data-row-action="edit"]')) actions.insertAdjacentHTML('afterbegin', `<button class="action-button edit-action" data-row-action="edit" data-id="${id}" title="Edit work order" aria-label="Edit work order">✎</button>`); if (actions && status === 'done') { if (!actions.querySelector('[data-row-action="revision"]')) actions.insertAdjacentHTML('beforeend', `<button class="action-button revision-action" data-row-action="revision" data-id="${id}" title="Kembalikan untuk revisi" aria-label="Kembalikan untuk revisi">↻</button>`); if (!actions.querySelector('[data-row-action="delete"]')) actions.insertAdjacentHTML('beforeend', `<button class="action-button delete-action" data-row-action="delete" data-id="${id}" title="Hapus" aria-label="Hapus">⌫</button>`); } if (status === 'new_request') actions.querySelector('[data-row-action="complete"]')?.remove();  }); }
function renderActiveFile() { const label = document.querySelector('#activeFileName'); const name = openedFileName || 'Siap'; const fileIsDirty = Boolean(openedFileName && hasUnsavedChanges); if (label) { label.innerHTML = `<i class="sync-dot"></i>${escapeHtml(name)}`; label.classList.toggle('is-dirty', fileIsDirty); } }
function escapeHtml(value) { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])); }
let _itemSeq = 0;
function generateItemId() { return `${Date.now().toString(36)}-${(++_itemSeq).toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
function repairItemIds(list) { const seen = new Set(); return (Array.isArray(list) ? list : []).map(item => { const id = String(item.id); if (seen.has(id)) return { ...item, id: generateItemId() }; seen.add(id); return item; }); }
function normalizeItem(item) { return { ...item, id: String(item.id || generateItemId()), title: String(item.title || '').trim(), requestor: String(item.requestor || item.owner || '').trim(), subitems: Array.isArray(item.subitems) ? item.subitems.map((subitem, index) => ({ id: subitem.id || `${item.id}-${index}`, title: String(subitem.title || '').trim(), done: Boolean(subitem.done), order: subitem.order ?? index })).filter(subitem => subitem.title) : [], type: item.type === 'daily' || item.status === 'daily' ? 'daily' : 'project', status: normalizeStatus(item.status), priority: normalizePriority(item.priority), requestDate: normalizeDateValue(item.requestDate), date: normalizeDateValue(item.date || item.targetDone) || defaultDeadline(normalizeDateValue(item.requestDate)), done: Boolean(item.done), completedAt: item.completedAt || '', dailyDoneDate: item.dailyDoneDate || (item.done && item.type === 'daily' ? today() : ''), updatedAt: item.updatedAt || '' }; }
function normalizeStatus(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('daily')) return 'daily';
  if (text.includes('waiting') && (text.includes('brief') || text.includes('full'))) return 'waiting_brief';
  if (text.includes('revision') || text.includes('revisi')) return 'revision';
  if (text.includes('1st') || text.includes('first') || text.includes('draft')) return 'draft_preview';
  if (text.includes('preview') || text.includes('review')) return 'preview';
  if (text.includes('working') || text.includes('ongoing') || text.includes('progress') || text.includes('kerja')) return 'working';
  if (text.includes('done') || text.includes('selesai') || text.includes('complete')) return 'done';
  if (text.includes('cancelled') || text.includes('cancel') || text.includes('batal')) return 'cancelled';
  if (text.includes('on hold') || text.includes('on_hold') || text.includes('hold')) return 'on_hold';
  if (text.includes('approved') || text.includes('approve')) return 'approved';
  return 'new_request';
}
function normalizePriority(value) { const text = String(value || 'normal').toLowerCase(); return text.includes('high') || text.includes('penting') ? 'high' : text.includes('low') || text.includes('nanti') ? 'low' : 'normal'; }

function normalizeDateValue(value) { if (!value) return ''; if (value instanceof Date) return `${localDate(value)}T${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`; return String(value).trim().replace(' ', 'T').slice(0, 16); }
function defaultDeadline(requestDate) { if (!requestDate) return ''; const base = new Date(requestDate.includes('T') ? requestDate : `${requestDate}T00:00:00`); if (Number.isNaN(base.getTime())) return ''; base.setDate(base.getDate() + 3); return normalizeDateValue(base); }
function nowDateTime() { const date = new Date(); return `${localDate(date)}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`; }
function itemSignature(item) { const compact = {}; Object.entries(normalizeItem(item)).forEach(([key, value]) => { if (key === 'updatedAt' || value === undefined || value === null || value === '') return; compact[key] = value; }); return JSON.stringify(compact); }
function today() { return localDate(new Date()); }
function isDailyDone(item) { return item.type === 'daily' && item.dailyDoneDate === today(); }
function scheduleDailyReset() { const nextDay = new Date(); nextDay.setHours(24, 0, 1, 0); setTimeout(() => { items.filter(item => item.type === 'daily' && item.dailyDoneDate !== today()).forEach(item => { item.dailyDoneDate = ''; item.done = false; }); persistDraft(); render(); scheduleDailyReset(); }, nextDay.getTime() - Date.now()); }
function localDate(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function displayDate(value, includeTime = false) { if (!value) return 'No date'; const date = new Date(value.includes('T') ? value : `${value}T00:00:00`); if (Number.isNaN(date.getTime())) return value; return date.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', ...(includeTime ? { year: 'numeric' } : {}) }) + (includeTime && value.includes('T') ? `, ${date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}` : ''); }
function targetDoneLabel(value) { if (!value) return '<span class="target-empty">No deadline</span>'; const target = new Date(`${String(value).slice(0, 10)}T00:00:00`); const current = new Date(`${today()}T00:00:00`); if (Number.isNaN(target.getTime())) return escapeHtml(value); const days = Math.ceil((target - current) / 86400000); const date = target.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }); const detail = days < 0 ? `Terlambat ${Math.abs(days)} hari` : days === 0 ? 'Hari ini' : days === 1 ? 'Besok' : `${days} hari lagi`; return `<span class="target-date">${escapeHtml(date)}</span><small class="target-detail">${detail}</small>`; }
function urgencyClass() { return ''; }
function requestors() { return [...new Set(items.flatMap(item => String(item.requestor || '').split(',')).map(name => name.trim()).filter(Boolean))]; }
function similarityScore(query, name) { if (!query) return 1; if (name === query) return 100; if (name.includes(query)) return 80 - name.indexOf(query); if (query.length < 3) return 0; const matches = [...query].filter(character => name.includes(character)).length; return matches / query.length >= .7 ? 40 - (name.length - query.length) : 0; }
let requestorMatches = [];
let requestorActiveIndex = -1;
function initials(name) { return String(name).split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase(); }
function renderRequestorSuggestions(inputId = 'requestorInput', suggestionsId = 'requestorSuggestions') { const input = document.querySelector('#' + inputId); const suggestions = document.querySelector('#' + suggestionsId); if (!input || !suggestions) return; const rawQuery = input.value.trim().toLowerCase(); const query = rawQuery.split(',').pop().trim(); if (!query && document.activeElement !== input) { closeRequestorSuggestions(suggestionsId, inputId); return; } requestorMatches = requestors().map(name => ({ name, score: similarityScore(query, name.toLowerCase()) })).filter(item => !query || item.score > 0).sort((a, b) => b.score - a.score).slice(0, 6).map(item => item.name); requestorActiveIndex = -1; suggestions.innerHTML = requestorMatches.length ? `<div class="suggestion-heading">${query ? 'Matching requestors' : 'Recent requestors'}<span>${requestorMatches.length}</span></div>${requestorMatches.map((name, index) => `<button type="button" role="option" aria-selected="false" data-index="${index}" data-requestor="${escapeHtml(name)}"><span class="suggestion-avatar">${escapeHtml(initials(name))}</span><span class="suggestion-name">${escapeHtml(name)}</span><span class="suggestion-arrow">↵</span></button>`).join('')}` : `<div class="suggestion-empty">Belum ada requestor yang cocok</div>`; suggestions.hidden = !requestorMatches.length; input.setAttribute('aria-expanded', String(requestorMatches.length > 0)); syncSuggestionSpacer(suggestionsId); }
function closeRequestorSuggestions(suggestionsId = 'requestorSuggestions', inputId = 'requestorInput') { const suggestions = document.querySelector('#' + suggestionsId); const input = document.querySelector('#' + inputId); if (!suggestions || !input) return; suggestions.hidden = true; input.setAttribute('aria-expanded', 'false'); requestorActiveIndex = -1; syncSuggestionSpacer(suggestionsId); }
function syncSuggestionSpacer(suggestionsId) { const suggestions = document.querySelector('#' + suggestionsId); if (!suggestions) return; const field = suggestions.closest('.edit-field'); const spacer = field ? field.querySelector('.suggestion-spacer') : null; if (!spacer) return; const h = suggestions.hidden ? 0 : (suggestions.offsetHeight || 0) + 8; spacer.style.height = h + 'px'; }
function chooseRequestor(name, inputId = 'requestorInput', suggestionsId = 'requestorSuggestions') { const input = document.querySelector('#' + inputId); if (!input) return; const parts = input.value.split(',').map(part => part.trim()).filter(Boolean); parts[parts.length - 1] = name; const unique = [...new Set(parts)]; input.value = unique.join(', '); closeRequestorSuggestions(suggestionsId, inputId); }
function titleSimilarity(query, title) { const words = query.toLowerCase().split(/\s+/).filter(Boolean); const candidate = title.toLowerCase(); if (!words.length) return 0; return words.filter(word => candidate.includes(word)).length / words.length; }
function renderTitleSuggestions() { const input = document.querySelector('#titleInput'); const suggestions = document.querySelector('#titleSuggestions'); if (!input || !suggestions) return; const query = input.value.trim(); if (query.length < 3) { suggestions.hidden = true; syncSuggestionSpacer('titleSuggestions'); return; } const matches = items.map(item => ({ item, score: titleSimilarity(query, item.title) })).filter(match => match.score >= .5).sort((a, b) => b.score - a.score).slice(0, 5); suggestions.innerHTML = matches.length ? `<div class="suggestion-heading">Similar work orders<span>${matches.length}</span></div>${matches.map(({ item }) => `<button type="button" role="option" data-title-id="${item.id}"><span class="suggestion-name">${escapeHtml(item.title)}</span><small>${escapeHtml(groups[item.status] || 'Daily task')} · ${escapeHtml(item.requestor || 'No requestor')}</small></button>`).join('')}` : ''; suggestions.hidden = !matches.length; syncSuggestionSpacer('titleSuggestions'); }
function closeTitleSuggestions() { const s = document.querySelector('#titleSuggestions'); if (s) { s.hidden = true; syncSuggestionSpacer('titleSuggestions'); } }
function render() {
  const query = document.querySelector('#searchInput').value.trim().toLowerCase();
  let visible = items.filter(item => (!query || `${item.title} ${item.requestor}`.toLowerCase().includes(query)) && (priorityFilter === 'all' || item.priority === priorityFilter) && (monthFilter === 'all' || item.month === monthFilter) && (requestorFilter === 'all' || item.requestor.split(',').map(r => r.trim()).includes(requestorFilter)));
  visible.sort((a, b) => {
    if (sortFilter === 'priority') return ['high', 'normal', 'low'].indexOf(a.priority) - ['high', 'normal', 'low'].indexOf(b.priority);
    if (sortFilter === 'target') return (a.date || '').localeCompare(b.date || '');
    const result = (a.requestDate || '').localeCompare(b.requestDate || '');
    return sortFilter === 'oldest' ? result : -result;
  });

  // Group visible items by status
  const statusOrder = ['new_request', 'waiting_brief', 'working', 'draft_preview', 'revision', 'preview', 'on_hold', 'approved', 'done', 'daily', 'cancelled'];
  statusOrder.forEach(status => {
    const statusItems = visible.filter(item => item.status === status);
    const tbody = document.querySelector(`#${status}Table`);
    const countEl = document.querySelector(`#${status}Count`);
    const emptyEl = document.querySelector(`#${status}Empty`);
    const panelEl = document.querySelector(`.table-panel[data-status="${status}"]`);
    const limit = panelLimits[status] || PANEL_PAGE_SIZE;
    const shownItems = statusItems.slice(0, limit);
    if (tbody) tbody.innerHTML = shownItems.map(renderRow).join('');
    if (countEl) countEl.textContent = statusItems.length;
    if (emptyEl) emptyEl.hidden = statusItems.length !== 0;
    if (panelEl) panelEl.classList.toggle('is-empty', statusItems.length === 0);
    const loadMoreBtn = document.querySelector(`#${status}LoadMore`);
    if (loadMoreBtn) {
      const remaining = statusItems.length - shownItems.length;
      loadMoreBtn.hidden = remaining <= 0;
      loadMoreBtn.textContent = `Show more (${remaining} lagi)`;
    }
  });

  const totalItems = items.filter(item => item.type === 'project' || item.type === 'daily').length;
  document.querySelector('#resultCount').textContent = `${visible.length} of ${items.length}`;
  makeRowsEditable();
  removeActionCells();
  renderInlineSubitems();
  normalizeDailyProgressCells();
  renderActiveFile();
  renderRequestorSuggestions('requestorInput', 'requestorSuggestions');
  renderRequestorSuggestions('editRequestorInput', 'editRequestorSuggestions');
  refreshMonthFilter();
  refreshRequestorFilter();
}
function renderRow(item) {
  const canEdit = isAdmin;
  const isDaily = item.type === 'daily';
  const doneToday = isDaily && item.dailyDoneDate === today();
  const orphanBadge = item.orphan ? `<span class="orphan-badge" title="Folder tidak ditemukan di Drive (orphan)">⚠</span>` : '';
  const checkBox = canEdit ? `<input type="checkbox" class="row-check" data-id="${item.id}" ${selectedIds.has(String(item.id)) ? 'checked' : ''} aria-label="Pilih ${escapeHtml(item.title)}">` : '';
  const takeButton = canEdit && item.status === 'new_request' ? `<button class="action-button take-action" data-row-action="take" data-id="${item.id}" title="Saya mau kerjain" aria-label="Saya mau kerjain">▶</button>` : '';
  const completeButton = canEdit && !isDaily && item.status !== 'done' && item.status !== 'cancelled' ? `<button class="action-button complete-action" data-row-action="complete" data-id="${item.id}" title="Tandai selesai" aria-label="Tandai selesai">✓</button>` : '';
  const revisionButton = canEdit && !isDaily && item.status === 'done' ? `<button class="action-button revision-action" data-row-action="revision" data-id="${item.id}" title="Kembalikan untuk revisi" aria-label="Kembalikan untuk revisi">↻</button>` : '';
  const deleteButton = canEdit ? `<button class="action-button delete-action" data-row-action="delete" data-id="${item.id}" title="Hapus" aria-label="Hapus">⌫</button>` : '';
  const disabledAttr = canEdit ? '' : 'disabled';
  const statusOptions = `<option value="new_request" ${item.status === 'new_request' ? 'selected' : ''}>New Request</option><option value="waiting_brief" ${item.status === 'waiting_brief' ? 'selected' : ''}>Waiting Brief</option><option value="working" ${item.status === 'working' ? 'selected' : ''}>Working</option><option value="draft_preview" ${item.status === 'draft_preview' ? 'selected' : ''}>1st Draft</option><option value="revision" ${item.status === 'revision' ? 'selected' : ''}>In Revision</option><option value="preview" ${item.status === 'preview' ? 'selected' : ''}>Preview</option><option value="on_hold" ${item.status === 'on_hold' ? 'selected' : ''}>On Hold</option><option value="approved" ${item.status === 'approved' ? 'selected' : ''}>Approved</option><option value="done" ${item.status === 'done' ? 'selected' : ''}>Done</option><option value="daily" ${isDaily ? 'selected' : ''}>Daily</option><option value="cancelled" ${item.status === 'cancelled' ? 'selected' : ''}>Cancelled</option>`;
  const dailyStatus = isDaily ? `<span class="daily-status-label ${doneToday ? 'is-done' : ''}">${doneToday ? 'Selesai' : 'Belum selesai'}<small>${escapeHtml(displayDate(today(), false))}</small></span>` : '';
  const dailyCheck = isDaily ? `<button class="action-button complete-action daily-check ${doneToday ? 'daily-done' : ''}" data-row-action="daily-done" data-id="${item.id}" title="${doneToday ? 'Selesai, klik untuk batalkan' : 'Tandai selesai hari ini'}" aria-label="${doneToday ? 'Selesai, klik untuk batalkan' : 'Tandai selesai hari ini'}" aria-pressed="${doneToday}">${doneToday ? '☑' : '☐'}</button>` : '';
  return `<tr class="${urgencyClass(item.date)} ${isDaily && doneToday ? 'daily-row-done' : ''}"><td class="title-cell ${isDaily && doneToday ? 'daily-title-done' : ''}">${checkBox}<span class="title-text">${escapeHtml(item.title)}</span>${orphanBadge}</td><td>${escapeHtml(item.requestor)}</td><td><select class="status-select status-${item.status}" data-action="status" data-id="${item.id}" aria-label="Status" ${disabledAttr}>${statusOptions}</select></td><td><select class="priority-select priority-${item.priority}" data-action="priority" data-id="${item.id}" aria-label="Priority" ${disabledAttr}><option value="high" ${item.priority === 'high' ? 'selected' : ''}>High</option><option value="normal" ${item.priority === 'normal' ? 'selected' : ''}>Normal</option><option value="low" ${item.priority === 'low' ? 'selected' : ''}>Low</option></select></td><td>${escapeHtml(displayDate(item.requestDate, true))}</td><td class="target-cell deadline-cell" title="Deadline: ${escapeHtml(displayDate(item.date, true))}">${isDaily ? dailyStatus : targetDoneLabel(item.date)}</td><td class="row-actions">${takeButton}${completeButton}${revisionButton}${dailyCheck}${deleteButton}</td></tr>`;
}
function updateSyncStatus() {
  const el = document.querySelector('#saveState');
  const dot = document.querySelector('#activeFileName .sync-dot');
  const syncBtn = document.querySelector('#syncCloudButton');
  if (!el) return;
  el.classList.remove('syncing', 'is-dirty', 'is-pending', 'is-error');
  if (dot) dot.classList.remove('syncing', 'is-pending', 'is-error');
  if (syncBtn) syncBtn.classList.toggle('has-pending', hasUnsyncedChanges && syncState !== 'syncing');
  if (!supabaseClient) { el.textContent = 'Offline (localStorage)'; return; }
  if (syncState === 'syncing') {
    el.textContent = syncProgress.total > 1 ? `Menyinkron… ${syncProgress.done}/${syncProgress.total}` : 'Menyinkron…';
    el.classList.add('syncing'); if (dot) dot.classList.add('syncing');
  } else if (syncState === 'error') {
    el.textContent = 'Gagal sinkron'; el.classList.add('is-error'); if (dot) dot.classList.add('is-error');
  } else if (hasUnsyncedChanges) {
    el.textContent = 'Ada perubahan · belum disinkron'; el.classList.add('is-pending'); if (dot) dot.classList.add('is-pending');
  } else if (lastSyncTime) {
    const mins = Math.max(0, Math.round((Date.now() - lastSyncTime.getTime()) / 60000));
    el.textContent = mins < 1 ? 'Tersinkron · baru saja' : `Tersinkron · ${mins} mnt lalu`;
  } else {
    el.textContent = 'Belum sinkron';
  }
}
setInterval(() => { if (document.visibilityState === 'visible') updateSyncStatus(); }, 30000);
function showToast(message) { const toast = document.querySelector('#toast'); toast.textContent = message; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 2400); }
function findItem(id) { return items.find(item => String(item.id) === String(id)); }

document.querySelector('#searchInput').addEventListener('input', () => { resetPanelLimits(); render(); });
document.querySelector('#priorityFilter').addEventListener('change', event => { priorityFilter = event.target.value; resetPanelLimits(); render(); });
document.querySelector('#sortFilter').addEventListener('change', event => { sortFilter = event.target.value; resetPanelLimits(); render(); });
document.querySelector('#monthFilter').addEventListener('change', event => { monthFilter = event.target.value; resetPanelLimits(); render(); });
document.querySelector('#requestorFilter').addEventListener('change', event => { requestorFilter = event.target.value; resetPanelLimits(); render(); });

// Add "Show more" button to each status panel
document.querySelectorAll('.table-panel').forEach(panel => {
  const status = panel.dataset.status;
  if (!status) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'load-more-button';
  btn.id = `${status}LoadMore`;
  btn.hidden = true;
  btn.textContent = 'Show more';
  panel.appendChild(btn);
  btn.addEventListener('click', () => {
    panelLimits[status] = (panelLimits[status] || PANEL_PAGE_SIZE) + PANEL_PAGE_SIZE;
    render();
  });
});

function refreshMonthFilter() {
  const select = document.querySelector('#monthFilter');
  if (!select) return;
  const months = [...new Set(items.map(item => item.month).filter(Boolean))].sort();
  const current = select.value;
  select.innerHTML = '<option value="all">All months</option>' + months.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  if (months.includes(current)) select.value = current;
}
function refreshRequestorFilter() {
  const select = document.querySelector('#requestorFilter');
  if (!select) return;
  const names = [...new Set(items.flatMap(item => String(item.requestor || '').split(',')).map(name => name.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'id'));
  const current = select.value;
  select.innerHTML = '<option value="all">Semua requestor</option>' + names.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
  if (names.includes(current)) select.value = current;
}

// === Bulk selection ===
function updateBulkBar() {
  const bar = document.querySelector('#bulkBar');
  if (!bar) return;
  bar.hidden = selectedIds.size === 0;
  const count = document.querySelector('#bulkCount');
  if (count) count.textContent = String(selectedIds.size);
  const openButton = document.querySelector('#bulkOpen');
  if (openButton) openButton.textContent = `Ubah Status (${selectedIds.size})`;
  document.querySelectorAll('.check-all').forEach(box => {
    const tbody = box.closest('table')?.querySelector('tbody');
    if (!tbody) return;
    const boxes = [...tbody.querySelectorAll('.row-check')];
    box.checked = boxes.length > 0 && boxes.every(input => input.checked);
  });
}
document.querySelectorAll('.check-all').forEach(box => box.addEventListener('change', event => {
  const tbody = event.target.closest('table')?.querySelector('tbody');
  if (!tbody) return;
  tbody.querySelectorAll('.row-check').forEach(input => {
    input.checked = event.target.checked;
    if (event.target.checked) selectedIds.add(input.dataset.id); else selectedIds.delete(input.dataset.id);
  });
  updateBulkBar();
}));
document.querySelector('#selectAllButton').addEventListener('click', () => {
  const boxes = [...document.querySelectorAll('.row-check')];
  const allChecked = boxes.length > 0 && boxes.every(input => input.checked);
  boxes.forEach(input => {
    input.checked = !allChecked;
    if (!allChecked) selectedIds.add(input.dataset.id); else selectedIds.delete(input.dataset.id);
  });
  updateBulkBar();
});
const bulkDialog = document.querySelector('#bulkDialog');
document.querySelector('#bulkOpen').addEventListener('click', () => {
  if (!selectedIds.size) return;
  document.querySelector('#bulkDialogMessage').textContent = `Ubah ${selectedIds.size} work order menjadi:`;
  bulkDialog.showModal();
});
document.querySelector('#closeBulkDialog').addEventListener('click', () => bulkDialog.close());
document.querySelector('#cancelBulkDialog').addEventListener('click', () => bulkDialog.close());
bulkDialog.addEventListener('click', event => { if (event.target === bulkDialog) bulkDialog.close(); });
document.querySelector('#applyBulkDialog').addEventListener('click', () => {
  const status = document.querySelector('#bulkDialogStatus').value;
  if (!selectedIds.size) { bulkDialog.close(); return; }
  let changed = 0;
  selectedIds.forEach(id => {
    const item = findItem(id);
    if (!item) return;
    item.status = normalizeStatus(status);
    item.type = item.status === 'daily' ? 'daily' : 'project';
    if (item.status === 'done') { item.done = true; item.completedAt = item.completedAt || new Date().toISOString(); }
    changed += 1;
  });
  const label = groups[status] || status;
  if (changed) {
    addActivity(`${changed} work order dijadikan ${label}`, {}, `${changed} item`);
    saveItems();
  }
  selectedIds.clear();
  updateBulkBar();
  render();
  bulkDialog.close();
  showToast(`${changed} work order dijadikan ${label}`);
});
document.querySelector('.table-stack').addEventListener('change', event => {
  const input = event.target.closest('.row-check');
  if (!input) return;
  if (input.checked) selectedIds.add(input.dataset.id); else selectedIds.delete(input.dataset.id);
  updateBulkBar();
});
document.querySelector('#bulkDelete').addEventListener('click', async () => {
  if (!selectedIds.size) return;
  const ok = await confirmModal(`Hapus ${selectedIds.size} work order secara permanen?`, { title: 'Hapus work order?', eyebrow: 'PERMANENT ACTION', confirmLabel: 'Hapus' });
  if (!ok) return;
  let deleted = 0;
  selectedIds.forEach(id => {
    const item = findItem(id);
    if (!item) return;
    addActivity('Work order dihapus', item);
    sbDeleteItem(id);
    deleted += 1;
  });
  items = items.filter(item => !selectedIds.has(String(item.id)));
  selectedIds.clear();
  updateBulkBar();
  saveItems();
  render();
  showToast(`${deleted} work order dihapus`);
});
document.querySelector('#bulkClear').addEventListener('click', () => {
  selectedIds.clear();
  document.querySelectorAll('.row-check').forEach(input => { input.checked = false; });
  document.querySelectorAll('.check-all').forEach(input => { input.checked = false; });
  updateBulkBar();
});

// === Add work order ===
const addDialog = document.querySelector('#addDialog');
document.querySelector('#addWorkOrderButton').addEventListener('click', () => { addDialog.showModal(); setTimeout(() => document.querySelector('#titleInput').focus(), 50); });
document.querySelector('#closeAddDialog').addEventListener('click', () => addDialog.close());
document.querySelector('#cancelAddDialog').addEventListener('click', () => addDialog.close());
addDialog.addEventListener('click', event => { if (event.target === addDialog) addDialog.close(); });
document.querySelector('#submitAddDialog').addEventListener('click', () => {
  const title = document.querySelector('#titleInput').value.trim();
  const requestor = document.querySelector('#requestorInput').value.trim();
  const priority = document.querySelector('#addPriority').value;
  if (!title || !requestor) { showToast('Title dan requestor wajib diisi'); return; }
  const item = normalizeItem({ id: generateItemId(), title, requestor, priority, status: 'new_request', type: 'project', requestDate: nowDateTime() });
  items = [...items, item];
  addActivity('Work order ditambahkan', item);
  saveItems();
  addDialog.close();
  document.querySelector('#titleInput').value = '';
  document.querySelector('#requestorInput').value = '';
  document.querySelector('#addPriority').value = 'normal';
  render();
  showToast('Work order ditambahkan');
});
document.querySelector('#requestorInput').addEventListener('input', () => renderRequestorSuggestions('requestorInput', 'requestorSuggestions'));
document.querySelector('#titleInput').addEventListener('input', renderTitleSuggestions);
document.querySelector('#requestorSuggestions').addEventListener('mousedown', event => { event.preventDefault(); const btn = event.target.closest('[data-requestor]'); if (btn) chooseRequestor(btn.dataset.requestor, 'requestorInput', 'requestorSuggestions'); });
document.querySelector('#editRequestorInput').addEventListener('input', () => renderRequestorSuggestions('editRequestorInput', 'editRequestorSuggestions'));
document.querySelector('#editRequestorSuggestions').addEventListener('mousedown', event => { event.preventDefault(); const btn = event.target.closest('[data-requestor]'); if (btn) chooseRequestor(btn.dataset.requestor, 'editRequestorInput', 'editRequestorSuggestions'); });
document.querySelector('#titleSuggestions').addEventListener('mousedown', event => {
  event.preventDefault();
  const btn = event.target.closest('[data-title-id]');
  if (!btn) return;
  document.querySelector('#titleInput').value = btn.querySelector('.suggestion-name')?.textContent || '';
  closeTitleSuggestions();
});
let editTargetId = null;
const editDialog = document.querySelector('#editDialog');
const noteDialog = document.querySelector('#noteDialog');
let noteTargetId = null;
function openNoteDialog(id) { const item = findItem(id); if (!item) return; noteTargetId = item.id; document.querySelector('#noteDialogTitle').textContent = item.title; document.querySelector('#noteDialogBody').textContent = item.note || 'Belum ada catatan untuk work order ini.'; noteDialog.showModal(); }
document.querySelector('#closeNoteButton').addEventListener('click', () => noteDialog.close()); document.querySelector('#editNoteButton').addEventListener('click', () => { noteDialog.close(); openEditDialog(noteTargetId); setTimeout(() => document.querySelector('#editNoteInput').focus(), 0); }); noteDialog.addEventListener('click', event => { if (event.target === noteDialog) noteDialog.close(); });
const editTitleInput = document.querySelector('#editTitleInput');
const editRequestorInput = document.querySelector('#editRequestorInput');
function openEditDialog(id) { const item = findItem(id); if (!item) return; editTargetId = item.id; editTitleInput.value = item.title; editRequestorInput.value = item.requestor; document.querySelector('#editRequestDateInput').value = item.requestDate ? item.requestDate.slice(0, 16) : ''; document.querySelector('#editNoteInput').value = item.note || ''; document.querySelector('#editDeadlineInput').value = item.date ? item.date.slice(0, 10) : ''; renderEditSubitems(); editDialog.showModal(); editTitleInput.focus(); }
function renderEditSubitems() { const item = findItem(editTargetId); const list = document.querySelector('#editSubitemList'); if (!list) return; if (!item) { list.innerHTML = ''; return; } item.subitems = Array.isArray(item.subitems) ? item.subitems : []; list.innerHTML = item.subitems.length ? item.subitems.map(subitem => `<div class="subitem-row"><label class="subitem-label"><input type="checkbox" data-edit-subitem-id="${subitem.id}" ${subitem.done ? 'checked' : ''}><span>${escapeHtml(subitem.title)}</span></label><button type="button" class="subitem-delete" data-delete-subitem-id="${subitem.id}" aria-label="Hapus subitem ${escapeHtml(subitem.title)}">×</button></div>`).join('') : '<p class="subitem-empty">Belum ada subitem. Tambahkan di bawah.</p>'; }
function closeEditDialog() { editTargetId = null; editDialog.close(); }
document.querySelector('#editForm').addEventListener('submit', event => { event.preventDefault(); const item = findItem(editTargetId); const title = editTitleInput.value.trim(); const requestor = editRequestorInput.value.trim(); const requestDate = document.querySelector('#editRequestDateInput').value; const note = document.querySelector('#editNoteInput').value.trim(); const deadline = document.querySelector('#editDeadlineInput').value; if (!item || !title || !requestor) return; const nextDate = deadline ? `${deadline}T00:00` : ''; const nextRequestDate = requestDate || ''; const changed = item.title !== title || item.requestor !== requestor || item.note !== note || nextDate !== item.date || nextRequestDate !== item.requestDate; item.title = title; item.requestor = requestor; item.requestDate = nextRequestDate; item.note = note; item.date = nextDate; if (changed) { saveItems(); addActivity('Work order diedit', item, 'Title, requestor, tanggal, deadline, atau catatan diperbarui'); } closeEditDialog(); render(); showToast(changed ? 'Work order diperbarui' : 'Tidak ada perubahan'); });
document.querySelector('#deleteFromEditButton').addEventListener('click', async () => { const item = findItem(editTargetId); if (!item) return; const okDelete = await confirmModal(`Request "${item.title}" akan dihapus permanen.`, { title: 'Delete request?', eyebrow: 'PERMANENT ACTION', confirmLabel: 'Delete' }); if (!okDelete) return; deletedItem = { item, index: items.indexOf(item) }; items = items.filter(candidate => candidate.id !== item.id); sbDeleteItem(item.id); saveItems(); addActivity('Request dihapus', item); closeEditDialog(); render(); showToast('Request dihapus · klik Undo dalam 5 detik'); setTimeout(() => { deletedItem = null; }, 5000); });
document.querySelector('#closeEditButton').addEventListener('click', closeEditDialog); document.querySelector('#cancelEditButton').addEventListener('click', closeEditDialog); editDialog.addEventListener('click', event => { if (event.target === editDialog) closeEditDialog(); });
document.querySelector('#editSubitemInput').addEventListener('keydown', event => { if (event.key !== 'Enter') return; event.preventDefault(); const title = event.currentTarget.value.trim(); const item = findItem(editTargetId); if (!item || !title) return; item.subitems = Array.isArray(item.subitems) ? item.subitems : []; item.subitems.push({ id: `${item.id}-${Date.now()}`, title, done: false, order: item.subitems.length }); saveItems(); addActivity('Subitem ditambahkan', item, title); event.currentTarget.value = ''; renderEditSubitems(); render(); });
document.querySelector('#editSubitemList').addEventListener('change', event => { const checkbox = event.target.closest('[data-edit-subitem-id]'); const item = findItem(editTargetId); const subitem = item?.subitems.find(candidate => String(candidate.id) === String(checkbox?.dataset.editSubitemId)); if (!subitem) return; subitem.done = checkbox.checked; saveItems(); addActivity(subitem.done ? 'Subitem selesai' : 'Subitem dibuka lagi', item, subitem.title); renderEditSubitems(); render(); });
document.querySelector('#editSubitemList').addEventListener('click', async event => { const button = event.target.closest('[data-delete-subitem-id]'); if (!button) return; const item = findItem(editTargetId); const index = item?.subitems.findIndex(candidate => String(candidate.id) === String(button.dataset.deleteSubitemId)); if (!item || index < 0) return; const okSubitem = await confirmModal(`Hapus subitem "${item.subitems[index].title}"?`, { title: 'Hapus subitem?', confirmLabel: 'Hapus' }); if (!okSubitem) return; const [removed] = item.subitems.splice(index, 1); saveItems(); addActivity('Subitem dihapus', item, removed.title); renderEditSubitems(); render(); });
const profileDialog = document.querySelector('#profileDialog');
document.querySelector('#makerButton').addEventListener('click', () => profileDialog.showModal());
document.querySelector('#closeProfileButton').addEventListener('click', () => profileDialog.close());
profileDialog.addEventListener('click', event => { if (event.target === profileDialog) profileDialog.close(); });
document.querySelectorAll('[data-maker-tab]').forEach(tab => tab.addEventListener('click', () => { document.querySelectorAll('[data-maker-tab]').forEach(button => button.classList.toggle('active', button === tab)); document.querySelectorAll('[data-maker-content]').forEach(content => { content.hidden = content.dataset.makerContent !== tab.dataset.makerTab; }); }));
document.querySelector('.profile-footer span').innerHTML = '<i class="sync-dot"></i> reqord v0.6.1';
const fallbackReleaseNotes = [
  { version: 'v0.5.0', date: '2026-11-12', dateLabel: '12 Nov 2026', title: 'Scan folder, sync cloud & public board', highlights: ['Scan Folder: pilih folder Google Drive, work order langsung terisi dari nama folder', 'Login username + kode, sync otomatis ke Supabase, dan Public board read-only', 'Aksi massal: pilih banyak work order, ubah status atau hapus sekaligus', 'Layout mobile diperbaiki: tabel penuh, filter wrap, header rapat', 'Tombol Tambah dan Export/Import JSON tersedia kembali'] },
  { version: 'v0.3.0', date: '2026-09-23', dateLabel: '23 Sep 2026', title: 'Subitems inline & status Preview/Revision', highlights: ['Subitems ala Monday.com: tampil inline di bawah tiap request + checklist modal', 'Tambah, centang, dan hapus subitem; tersimpan ke sheet Subitems + restore saat Load', 'Status baru Preview dan On revision, pindah full via dropdown', 'Delete pindah ke modal edit + undo; kolom Est. bisa diedit manual', 'Progress Daily = tanggal + checkbox; subitem selalu ikut tabel parentnya'] },
  { version: 'v0.3.0', date: '2026-09-22', dateLabel: '22 Sep 2026', title: 'Durasi, catatan & rapikan tabel', highlights: ['Estimasi diganti waktu pengerjaan aktual (Est.) yang dihitung saat request selesai', 'Catatan per work order: kolom Catatan, popup, dan tersimpan di Excel', 'Urutan tabel final + kolom Date/Priority diselaraskan + grid seragam tanpa scrollbar', 'Validasi baris saat import + laporan hasil Load; workbook kosong tetap bisa dibuka', 'Save as New dihapus; alur jadi Load → Edit → Save (aman buat OneDrive)', 'F5 = reset bersih; tanggal Excel tanpa huruf T; tombol/icon actions dirapikan'] },
  { version: 'v0.2.0', date: '2026-09-21', dateLabel: '21 Sep 2026', title: 'Buat satu sekarang aja, activity & tampilan baru', highlights: ['Mode draft lokal (New/Load/Save) + autosave + nama file aktif + status unsaved', 'Panel History & Activity + sheet Activity di workbook + timestamp lokal', 'Alur status lengkap + modal edit + hapus pakai konfirmasi + undo', 'Daily: label/kolom tanggal, reset tengah malam, strikethrough, checkbox jelas', 'Ikon actions dirapikan + tipografi tabel + fokus tipis + date picker matcha', 'Save anti file 0 byte + izin tulis + banner kalau library Excel gagal dimuat', 'Tab Recent changes di modal maker + judul mirip anti-duplikat + favicon RQ'] },
  { version: 'v0.1.0', date: '2026-09-20', dateLabel: '20 Sep 2026', title: 'Prototype spreadsheet work order', highlights: ['Spreadsheet work order pertama: tiga tabel Request/Ongoing/Done', 'Buka file Excel dulu baru bisa simpan; template workbook bisa diunduh', 'Save menimpa file yang sama + template kosong tetap bisa dibuka', 'Daily task reset tiap hari + Done tampil 10 per batch + tombol load more', 'Peringatan kalau ada perubahan belum disimpan'] }
];
let releaseNotesData = [];
const recentDateSelect = document.querySelector('#recentDateSelect');
const recentReleaseDetail = document.querySelector('#recentReleaseDetail');
const recentMeta = document.querySelector('[data-maker-content="recent"] .changelog-meta');
function renderReleaseDetail(date) { const entry = releaseNotesData.find(note => note.date === date) || releaseNotesData[0]; if (!entry || !recentReleaseDetail) return; if (recentMeta) recentMeta.innerHTML = `<strong>${escapeHtml(entry.version)}</strong><span>Updated · ${escapeHtml(entry.dateLabel)}</span>`; recentReleaseDetail.innerHTML = `<strong>${escapeHtml(entry.version)} · ${escapeHtml(entry.title)}</strong><ul>${entry.highlights.map(point => `<li>${escapeHtml(point)}</li>`).join('')}</ul>`; }
function renderReleaseDateOptions(notes) { releaseNotesData = Array.isArray(notes) ? notes : []; if (!recentDateSelect) return; recentDateSelect.innerHTML = releaseNotesData.map(note => `<option value="${escapeHtml(note.date)}">${escapeHtml(note.dateLabel)} · ${escapeHtml(note.version)}</option>`).join(''); renderReleaseDetail(recentDateSelect.value || releaseNotesData[0]?.date); }
function loadReleaseNotes() { fetch('release-notes.json', { cache: 'no-store' }).then(response => response.ok ? response.json() : Promise.reject()).then(renderReleaseDateOptions).catch(() => renderReleaseDateOptions(fallbackReleaseNotes)); }
if (recentDateSelect) { recentDateSelect.addEventListener('change', event => renderReleaseDetail(event.target.value)); loadReleaseNotes(); }
const activityPanel = document.querySelector('#activityPanel');
document.querySelector('#activityButton').addEventListener('click', () => { activityPanel.classList.add('open'); activityPanel.setAttribute('aria-hidden', 'false'); });
document.querySelector('#closeActivityButton').addEventListener('click', () => { activityPanel.classList.remove('open'); activityPanel.setAttribute('aria-hidden', 'true'); });
document.querySelector('.table-stack').addEventListener('change', event => { const control = event.target; const item = findItem(control.dataset.id); if (!item) return; if (control.dataset.action === 'status') { item.status = normalizeStatus(control.value); item.type = item.status === 'daily' ? 'daily' : 'project'; if (item.status === 'done') { item.done = true; item.completedAt = item.completedAt || new Date().toISOString(); } } else if (control.dataset.action === 'priority') item.priority = control.value; else return; saveItems(); addActivity(control.dataset.action === 'priority' ? 'Priority diubah' : `Status menjadi ${item.status}`, item); render(); showToast(item.type === 'daily' ? 'Dipindahkan ke Daily tasks' : item.status === 'done' ? 'Request selesai' : 'Request diperbarui'); });
let deleteTargetId = null;
const deleteDialog = document.querySelector('#deleteDialog');
const deleteConfirmInput = document.querySelector('#deleteConfirmInput');
const confirmDeleteButton = document.querySelector('#confirmDeleteButton');
function openDeleteDialog(id) { deleteTargetId = id; deleteConfirmInput.value = ''; confirmDeleteButton.disabled = true; deleteDialog.showModal(); setTimeout(() => deleteConfirmInput.focus(), 0); }
function closeDeleteDialog() { deleteTargetId = null; deleteDialog.close(); }
document.querySelector('.table-stack').addEventListener('click', event => { const button = event.target.closest('[data-row-action]'); if (!button) return; const item = findItem(button.dataset.id); if (!item) return; if (button.dataset.rowAction === 'daily-done') { item.dailyDoneDate = isDailyDone(item) ? '' : today(); saveItems(); addActivity(item.dailyDoneDate ? 'Daily task selesai hari ini' : 'Daily task dibuka lagi', item); render(); showToast(item.dailyDoneDate ? 'Daily task selesai hari ini' : 'Daily task dibuka lagi'); return; } if (button.dataset.rowAction === 'take') { item.status = 'working'; item.type = 'project'; item.done = false; saveItems(); addActivity('Request mulai dikerjakan', item); render(); showToast('Saya kerjain request ini'); return; } if (button.dataset.rowAction === 'complete') { item.status = 'done'; item.type = 'project'; item.done = true; saveItems(); addActivity('Request selesai', item); render(); showToast('Request ditandai selesai'); return; } if (button.dataset.rowAction === 'revision') { item.status = 'working'; item.type = 'project'; item.done = false; saveItems(); addActivity('Request dikembalikan untuk revisi', item); render(); showToast('Request dikembalikan untuk revisi'); return; } if (button.dataset.rowAction === 'delete') openDeleteDialog(item.id); });
deleteConfirmInput.addEventListener('input', () => { confirmDeleteButton.disabled = deleteConfirmInput.value.trim().toLowerCase() !== 'saya sudah pikirin'; });
confirmDeleteButton.addEventListener('click', () => { if (confirmDeleteButton.disabled || deleteTargetId === null) return; const item = findItem(deleteTargetId); deletedItem = { item, index: items.indexOf(item) }; items = items.filter(candidate => candidate.id !== deleteTargetId); sbDeleteItem(deleteTargetId); saveItems(); addActivity('Request dihapus', item); closeDeleteDialog(); render(); showToast('Request dihapus · klik Undo dalam 5 detik'); setTimeout(() => { deletedItem = null; }, 5000); });
document.querySelector('#toast').addEventListener('click', () => { if (!deletedItem) return; items.splice(Math.max(0, deletedItem.index), 0, deletedItem.item); saveItems(); addActivity('Request dipulihkan', deletedItem.item); deletedItem = null; render(); showToast('Request dipulihkan'); });
document.querySelector('#closeDeleteButton').addEventListener('click', closeDeleteDialog); document.querySelector('#cancelDeleteButton').addEventListener('click', closeDeleteDialog); deleteDialog.addEventListener('click', event => { if (event.target === deleteDialog) closeDeleteDialog(); });
const confirmDialog = document.querySelector('#confirmDialog'); let confirmResolver = null;
function confirmModal(message, options = {}) {
  return new Promise(resolve => {
    try { if (confirmDialog.open) confirmDialog.close(); } catch { /* ignore */ }
    document.querySelector('#confirmDialogTitle').textContent = options.title || 'Yakin?';
    document.querySelector('#confirmDialogEyebrow').textContent = options.eyebrow || 'CONFIRM';
    document.querySelector('#confirmDialogMessage').innerHTML = escapeHtml(message).replace(/\n/g, '<br>');
    document.querySelector('#acceptConfirmButton').textContent = options.confirmLabel || 'Ya, lanjutkan';
    confirmResolver = resolve;
    try { confirmDialog.showModal(); } catch (e) { console.error('[reqord] confirmModal error:', e); resolve(false); }
  });
}
function resolveConfirm(value) { confirmDialog.close(); if (confirmResolver) { confirmResolver(value); confirmResolver = null; } }
document.querySelector('#acceptConfirmButton').addEventListener('click', () => resolveConfirm(true)); document.querySelector('#cancelConfirmButton').addEventListener('click', () => resolveConfirm(false)); document.querySelector('#closeConfirmButton').addEventListener('click', () => resolveConfirm(false)); confirmDialog.addEventListener('click', event => { if (event.target === confirmDialog) resolveConfirm(false); });
document.querySelector('.table-stack').addEventListener('click', event => { const button = event.target.closest('[data-row-action="edit"]'); if (button) { event.stopPropagation(); openEditDialog(button.dataset.id); } });
document.querySelector('.table-stack').addEventListener('click', event => { const button = event.target.closest('[data-row-action="note"]'); if (button) { event.stopPropagation(); openNoteDialog(button.dataset.id); } });
document.querySelector('.table-stack').addEventListener('click', event => { if (event.target.closest('.row-check')) return; const title = event.target.closest('.title-cell.has-note'); if (title) openNoteDialog(title.dataset.noteId); });
document.querySelector('.table-stack').addEventListener('click', event => { const note = event.target.closest('.note-cell.has-note'); if (note) openNoteDialog(note.dataset.noteId); });
document.querySelector('.table-stack').addEventListener('keydown', event => { if (event.target.closest('.row-check')) return; const title = event.target.closest('.title-cell.has-note'); if (title && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openNoteDialog(title.dataset.noteId); } });
const subitemDialog = document.querySelector('#subitemDialog'); let subitemTargetId = null;
document.querySelector('#subitemInput').addEventListener('keydown', event => { if (event.key !== 'Enter') return; event.preventDefault(); const title = event.currentTarget.value.trim(); const item = findItem(subitemTargetId); if (!item || !title) return; item.subitems = Array.isArray(item.subitems) ? item.subitems : []; item.subitems.push({ id: `${item.id}-${Date.now()}`, title, done: false, order: item.subitems.length }); saveItems(); addActivity('Subitem ditambahkan', item, title); event.currentTarget.value = ''; render(); });
document.querySelector('.table-stack').addEventListener('change', event => { const checkbox = event.target.closest('[data-inline-subitem-id]'); if (!checkbox) return; const item = findItem(checkbox.dataset.inlineSubitemParent); const subitem = item?.subitems.find(candidate => String(candidate.id) === String(checkbox.dataset.inlineSubitemId)); if (!subitem) return; subitem.done = checkbox.checked; saveItems(); addActivity(subitem.done ? 'Subitem selesai' : 'Subitem dibuka lagi', item, subitem.title); render(); });
document.querySelector('#closeSubitemButton').addEventListener('click', () => subitemDialog.close()); subitemDialog.addEventListener('click', event => { if (event.target === subitemDialog) subitemDialog.close(); });
document.querySelector('.table-stack').addEventListener('click', event => { if (event.target.closest('.row-check')) return; const title = event.target.closest('.title-cell.has-subitems'); if (title) openEditDialog(title.dataset.subitemId); }); document.querySelector('.table-stack').addEventListener('keydown', event => { if (event.target.closest('.row-check')) return; const title = event.target.closest('.title-cell.has-subitems'); if (title && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); openEditDialog(title.dataset.subitemId); } });
document.querySelector('.table-stack').addEventListener('click', event => { const button = event.target.closest('[data-row-action="complete"]'); if (button) { const item = findItem(button.dataset.id); if (item && !item.completedAt) item.completedAt = new Date().toISOString(); } }, true);

function doExportJson() {
  if (!items.length) { showToast('Tidak ada data untuk diexport'); return; }
  const data = JSON.stringify({ items, activities, exportedAt: new Date().toISOString() }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reqord-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('JSON diexport');
}

function doImportJson() {
  document.querySelector('#jsonFileInput').click();
}

const settingsExport = document.querySelector('#settingsExport');
if (settingsExport) settingsExport.addEventListener('click', () => {
  doExportJson();
  document.querySelector('#settingsDialog').close();
});

const settingsImport = document.querySelector('#settingsImport');
if (settingsImport) settingsImport.addEventListener('click', () => {
  doImportJson();
  document.querySelector('#settingsDialog').close();
});

const settingsChangePass = document.querySelector('#settingsChangePass');
if (settingsChangePass) settingsChangePass.addEventListener('click', () => {
  document.querySelector('#settingsDialog').close();
  document.querySelector('#changePassDialog').showModal();
});

const jsonInput = document.querySelector('#jsonFileInput');
if (jsonInput) jsonInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const data = JSON.parse(text);
    if (Array.isArray(data)) {
      items = data.map(normalizeItem);
    } else if (data.items && Array.isArray(data.items)) {
      items = data.items.map(normalizeItem);
      if (Array.isArray(data.activities)) activities = data.activities;
    } else {
      throw new Error('Format JSON tidak valid');
    }
    saveItems();
    renderActivities();
    render();
    showToast(`${items.length} item diimport dari JSON`);
  } catch (error) {
    showToast(`Import JSON gagal: ${error.message}`);
  }
  event.target.value = '';
});

function doExportExcel() {
  if (!window.XLSX) { showToast('Library Excel belum tersedia'); return; }
  if (!items.length) { showToast('Tidak ada data untuk diexport'); return; }
  const rows = items.map(item => ({
    Title: item.title,
    Requestor: item.requestor,
    Type: item.type === 'daily' ? 'Daily' : 'Project',
    Status: groups[item.status] || item.status,
    Priority: item.priority,
    RequestDate: item.requestDate,
    Deadline: item.date || ''
  }));
  const sheet = XLSX.utils.json_to_sheet(rows);
  sheet['!cols'] = [{ wch: 42 }, { wch: 22 }, { wch: 10 }, { wch: 16 }, { wch: 10 }, { wch: 20 }, { wch: 20 }];
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, sheet, 'Work Orders');
  const file = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const url = URL.createObjectURL(new Blob([file], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `reqord-${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast('Excel diexport');
}

function doImportExcel() {
  document.querySelector('#excelFileInput').click();
}

const settingsExportExcel = document.querySelector('#settingsExportExcel');
if (settingsExportExcel) settingsExportExcel.addEventListener('click', () => {
  doExportExcel();
  document.querySelector('#settingsDialog').close();
});

const settingsImportExcel = document.querySelector('#settingsImportExcel');
if (settingsImportExcel) settingsImportExcel.addEventListener('click', () => {
  doImportExcel();
  document.querySelector('#settingsDialog').close();
});

const excelInput = document.querySelector('#excelFileInput');
if (excelInput) excelInput.addEventListener('change', async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (!window.XLSX) throw new Error('Library Excel belum tersedia');
    const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
    const sheetName = workbook.SheetNames.find(name => /work order/i.test(name)) || workbook.SheetNames[0];
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    if (!rows.length) throw new Error('Tidak ada data di sheet');
    const imported = rows.map((row, index) => normalizeItem({
      id: Date.now() + index,
      title: row.Title || row.title || row.Name || '',
      requestor: row.Requestor || row.requestor || '',
      type: /daily/i.test(row.Type || '') ? 'daily' : 'project',
      status: row.Status || '',
      priority: row.Priority || 'normal',
      requestDate: normalizeDateValue(row.RequestDate || row.requestDate) || today(),
      date: normalizeDateValue(row.Deadline || row.TargetDone || row.date) || ''
    })).filter(item => item.title);
    if (!imported.length) throw new Error('Tidak ada baris valid');
    items = imported;
    saveItems();
    render();
    showToast(`${imported.length} item diimport dari Excel`);
  } catch (error) {
    showToast(`Import Excel gagal: ${error.message}`);
  }
  event.target.value = '';
});

document.querySelector('#syncCloudButton').addEventListener('click', async () => {
  if (!supabaseClient) { showToast('Supabase tidak tersedia'); return; }
  // Require login
  if (!localStorage.getItem('reqord-access-code') || !localStorage.getItem('reqord-username')) {
    const dialog = document.querySelector('#loginDialog');
    if (dialog) dialog.showModal();
    return;
  }
  const user = await sbGetUser();
  if (!user) {
    const storedCode = localStorage.getItem('reqord-access-code');
    let code = storedCode ? atob(storedCode) : null;
    if (!code) {
      const dialog = document.querySelector('#loginDialog');
      if (dialog) dialog.showModal();
      showToast('Sesi berakhir. Silakan login lagi.');
      return;
    }
    const email = userName + '@gmail.com';
    let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password: code });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        localStorage.removeItem('reqord-access-code');
      }
      const res = await supabaseClient.auth.signUp({ email, password: code });
      if (res.error) { 
        if (res.error.message.includes('rate limit') || res.error.message.includes('after') || res.error.message.includes('security')) {
          showToast('Terlalu banyak percobaan. Tunggu 1 menit lalu coba lagi.');
        } else {
          showToast('Auth gagal: ' + res.error.message);
          localStorage.removeItem('reqord-access-code');
        }
        console.error('[reqord] auth error:', res.error); 
        return; 
      }
      showToast('Kode baru terdaftar');
    } else {
      showToast('Kode valid');
    }
    localStorage.setItem('reqord-access-code', code);
  }
  try {
    showToast('Syncing...');
    await sbSyncAll();
    await sbLoadItems();
    showToast('Sync selesai');
  } catch (e) {
    showToast('Sync gagal: ' + (e.message || 'unknown'));
    console.error('[reqord] sync error:', e);
  }
});

// Logout button handler
const logoutBtn = document.querySelector('#logoutBtn');
if (logoutBtn) {
  logoutBtn.addEventListener('click', () => {
    localStorage.removeItem('reqord-username');
    localStorage.removeItem('reqord-access-code');
    localStorage.removeItem('reqord-is-admin');
    localStorage.removeItem('reqord-session');
    if (supabaseClient) supabaseClient.auth.signOut();
    window.location.reload();
  });
}

// User menu dropdown toggle
const userMenuTrigger = document.querySelector('#userMenuTrigger');
const userMenuDropdown = document.querySelector('#userMenuDropdown');
const userMenuText = document.querySelector('#userMenuText');
function closeUserMenu() {
  if (userMenuTrigger) userMenuTrigger.setAttribute('aria-expanded', 'false');
  if (userMenuDropdown) userMenuDropdown.hidden = true;
}
if (userMenuTrigger && userMenuDropdown) {
  userMenuTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const expanded = userMenuTrigger.getAttribute('aria-expanded') === 'true';
    userMenuTrigger.setAttribute('aria-expanded', !expanded);
    userMenuDropdown.hidden = expanded;
  });
  document.addEventListener('click', (e) => {
    if (!userMenuTrigger.contains(e.target) && !userMenuDropdown.contains(e.target)) {
      closeUserMenu();
    }
  });
}
// Login modal handler
const loginLink = document.querySelector('#loginLink');
if (loginLink) {
  loginLink.addEventListener('click', (e) => {
    e.preventDefault();
    closeUserMenu();
    const dialog = document.querySelector('#loginDialog');
    if (dialog) dialog.showModal();
  });
}
const closeLoginDialog = document.querySelector('#closeLoginDialog');
if (closeLoginDialog) {
  closeLoginDialog.addEventListener('click', () => {
    document.querySelector('#loginDialog').close();
  });
}
const cancelLoginDialog = document.querySelector('#cancelLoginDialog');
if (cancelLoginDialog) {
  cancelLoginDialog.addEventListener('click', () => {
    document.querySelector('#loginDialog').close();
  });
}
const submitLoginDialog = document.querySelector('#submitLoginDialog');
if (submitLoginDialog) {
  submitLoginDialog.addEventListener('click', async () => {
    const username = normalizeUsername(document.querySelector('#loginNameInput').value);
    const password = document.querySelector('#loginCodeInput').value.trim();
    if (!username) { showToast('Username wajib diisi'); return; }
    if (!password) { showToast('Password wajib diisi'); return; }
    if (!supabaseClient) { showToast('Supabase tidak tersedia'); return; }
    const email = username + '@gmail.com';
    let { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('not confirmed')) showToast('Akun belum terkonfirmasi. Daftar ulang pakai username baru.');
      else showToast(`Login gagal untuk ${email}: ${error.message || 'username/password salah'}`);
      return;
    }
    localStorage.setItem('reqord-username', btoa(username.toLowerCase()));
    localStorage.setItem('reqord-access-code', btoa(password));
    const user = data.user;
    const isAdminUser = user?.user_metadata?.role === 'admin';
    localStorage.setItem('reqord-is-admin', isAdminUser ? '1' : '0');
    document.querySelector('#loginDialog').close();
    window.location.reload();
  });
}
// Register modal handler
const showRegisterLink = document.querySelector('#showRegisterLink');
if (showRegisterLink) {
  showRegisterLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('#loginDialog').close();
    document.querySelector('#registerDialog').showModal();
  });
}
const showLoginLink = document.querySelector('#showLoginLink');
if (showLoginLink) {
  showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector('#registerDialog').close();
    document.querySelector('#loginDialog').showModal();
  });
}
const closeRegisterDialog = document.querySelector('#closeRegisterDialog');
if (closeRegisterDialog) {
  closeRegisterDialog.addEventListener('click', () => {
    document.querySelector('#registerDialog').close();
  });
}
const cancelRegisterDialog = document.querySelector('#cancelRegisterDialog');
if (cancelRegisterDialog) {
  cancelRegisterDialog.addEventListener('click', () => {
    document.querySelector('#registerDialog').close();
  });
}
const submitRegisterDialog = document.querySelector('#submitRegisterDialog');
if (submitRegisterDialog) {
  submitRegisterDialog.addEventListener('click', async () => {
    const username = normalizeUsername(document.querySelector('#registerNameInput').value);
    const password = document.querySelector('#registerPassInput').value.trim();
    const invite = document.querySelector('#registerInviteInput').value.trim();
    if (!username) { showToast('Username wajib diisi'); return; }
    if (!password || password.length < 4) { showToast('Password minimal 4 karakter'); return; }
    if (invite !== 'budd-reqord') { showToast('Kode invitation wajib diisi dan valid'); return; }
    if (!supabaseClient) { showToast('Supabase tidak tersedia'); return; }
    const email = username + '@gmail.com';
    const isAdminUser = invite === 'budd-reqord';
    const { data, error } = await supabaseClient.auth.signUp({
      email,
      password,
      options: { data: { role: isAdminUser ? 'admin' : 'viewer', username } }
    });
    if (error) {
      if (error.message.includes('rate limit') || error.message.includes('after') || error.message.includes('security')) {
        showToast('Terlalu banyak percobaan. Tunggu 1 menit.');
      } else if (error.message.includes('already registered')) {
        showToast('Username sudah dipakai. Silakan login atau pakai username lain.');
      } else {
        showToast('Register gagal: ' + error.message);
      }
      return;
    }
    localStorage.setItem('reqord-username', btoa(username.toLowerCase()));
    localStorage.setItem('reqord-access-code', btoa(password));
    localStorage.setItem('reqord-is-admin', isAdminUser ? '1' : '0');
    document.querySelector('#registerDialog').close();
    showToast(isAdminUser ? 'Admin terdaftar!' : 'Akun terdaftar!');
    window.location.reload();
  });
}
// Change password modal handler
const closeChangePassDialog = document.querySelector('#closeChangePassDialog');
if (closeChangePassDialog) {
  closeChangePassDialog.addEventListener('click', () => {
    document.querySelector('#changePassDialog').close();
  });
}
const cancelChangePassDialog = document.querySelector('#cancelChangePassDialog');
if (cancelChangePassDialog) {
  cancelChangePassDialog.addEventListener('click', () => {
    document.querySelector('#changePassDialog').close();
  });
}
const submitChangePassDialog = document.querySelector('#submitChangePassDialog');
if (submitChangePassDialog) {
  submitChangePassDialog.addEventListener('click', async () => {
    const newPass = document.querySelector('#newPassInput').value.trim();
    const confirmPass = document.querySelector('#confirmPassInput').value.trim();
    if (!newPass || newPass.length < 4) { showToast('Password minimal 4 karakter'); return; }
    if (newPass !== confirmPass) { showToast('Password tidak cocok'); return; }
    if (!supabaseClient) { showToast('Supabase tidak tersedia'); return; }
    const { error } = await supabaseClient.auth.updateUser({ password: newPass });
    if (error) {
      showToast('Gagal ubah password: ' + error.message);
      return;
    }
    localStorage.setItem('reqord-access-code', btoa(newPass));
    document.querySelector('#changePassDialog').close();
    showToast('Password berhasil diubah');
  });
}
const settingsLink = document.querySelector('#settingsLink');
if (settingsLink) {
  settingsLink.addEventListener('click', () => {
    closeUserMenu();
    document.querySelector('#settingsDialog').showModal();
  });
}
const closeSettingsDialog = document.querySelector('#closeSettingsDialog');
if (closeSettingsDialog) {
  closeSettingsDialog.addEventListener('click', () => {
    document.querySelector('#settingsDialog').close();
  });
}
window.addEventListener('beforeunload', event => { if (!hasUnsavedChanges) return; event.preventDefault(); event.returnValue = 'Perubahan belum disimpan. Simpan dulu sebelum keluar?'; });
const _logoutBtn = document.querySelector('#logoutBtn');
const _settingsLink = document.querySelector('#settingsLink');
const _loginLink = document.querySelector('#loginLink');
const hasCode = !!localStorage.getItem('reqord-access-code');
isAdmin = localStorage.getItem('reqord-is-admin') === '1';
if (hasCode && userName) {
  if (_logoutBtn) _logoutBtn.style.display = '';
  if (_settingsLink) _settingsLink.style.display = '';
  if (_loginLink) _loginLink.style.display = 'none';
  if (userMenuText) userMenuText.textContent = userName;
} else {
  if (_logoutBtn) _logoutBtn.style.display = 'none';
  if (_settingsLink) _settingsLink.style.display = 'none';
  if (_loginLink) _loginLink.style.display = '';
  if (userMenuText) userMenuText.textContent = 'Login';
}
document.body.classList.toggle('is-admin', isAdmin);
updateSyncStatus(); renderActiveFile(); renderActivities(); render(); scheduleDailyReset();
if (supabaseClient) {
  sbLoadItems(true).then(() => {
    console.log('[reqord] init: loaded from Supabase');
  }).catch(e => {
    console.log('[reqord] init: Supabase load failed, using localStorage', e);
  });
  sbLoadActivities();
  let _realtimeTimer = null;
  supabaseClient.channel('work_orders_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, (payload) => {
      console.log('[reqord] realtime:', payload.eventType, payload.new?.id);
      if (_realtimeTimer) clearTimeout(_realtimeTimer);
      _realtimeTimer = setTimeout(() => { _realtimeTimer = null; sbLoadItems(); }, 1500);
    })
    .subscribe();
}

// === Supabase Auth & Sync ===
function normalizeUsername(value) { return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, ''); }
async function sbGetUser() {
  if (!supabaseClient) return null;
  const { data } = await supabaseClient.auth.getUser();
  return data?.user || null;
}

async function sbLoadItems(showLoading = false) {
  if (!supabaseClient) return;
  if (showLoading) { isLoadingFromCloud = true; updateSyncStatus(); }
  const { data, error } = await supabaseClient
    .from('work_orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) { 
    showToast('Load gagal: ' + error.message); 
    console.error('[reqord] sbLoadItems error:', error); 
    if (showLoading) isLoadingFromCloud = false;
    updateSyncStatus();
    return; 
  }
  const remote = (data || []).map(sbToItem);
  // Merge: keep newer by updated_at, don't overwrite local changes
  items = repairItemIds(items);
  const byId = new Map(items.map(i => [String(i.id), i]));
  // Buang item yang ada di pending deletes (gagal dihapus sebelumnya) supaya tidak muncul lagi
  for (const id of pendingDeletes) byId.delete(id);
  for (const r of remote) {
    const local = byId.get(String(r.id));
    if (!local || (r.updatedAt && local.updatedAt && r.updatedAt > local.updatedAt)) {
      byId.set(String(r.id), r);
    }
  }
  // Hapus item lokal yang terakhir ada di cloud tapi sekarang hilang (dihapus di device lain)
  // Guard: hanya jalankan bila fetch remote berhasil dan tidak kosong (hindari false positive saat koneksi transient)
  const remoteIds = new Set(remote.map(r => String(r.id)));
  let removedRemote = 0;
  if (remote.length > 0 || lastSyncedIds.size === 0) {
    for (const id of [...lastSyncedIds]) {
      if (!remoteIds.has(id) && byId.has(id)) {
        byId.delete(id);
        removedRemote++;
        syncSnapshot.delete(id);
      }
    }
  }
  const next = [...byId.values()];
  const signature = list => JSON.stringify([...list].sort((a, b) => String(a.id).localeCompare(String(b.id))).map(item => ({ ...normalizeItem(item), updatedAt: '' })));
  const unchanged = signature(next) === signature(items);
  items = next;
  lastSyncedIds = new Set(remoteIds);
  persistLastSyncedIds();
  if (showLoading) { lastSyncTime = new Date(); syncState = 'idle'; }
  // Jangan re-render bila isinya sama saja — re-render akan menutup dropdown status yang sedang dibuka.
  if (!unchanged) { persistDraft(); render(); }
  syncSnapshot = new Map(remote.map(r => [String(r.id), itemSignature(r)]));
  if (showLoading) isLoadingFromCloud = false;
  updateSyncStatus();
  console.log('[reqord] sbLoadItems: merged', remote.length, 'remote items, total', items.length, removedRemote ? `, removed ${removedRemote} remote-deleted` : '', unchanged ? '(tanpa perubahan)' : '');
}

function sbToItem(row) {
  return normalizeItem({
    id: row.id,
    title: row.title,
    requestor: row.requestor,
    month: row.month,
    priority: row.priority,
    status: row.status,
    type: row.type,
    date: row.date ? row.date.replace('T', ' ').slice(0, 16) : '',
    requestDate: row.request_date ? row.request_date.replace('T', ' ').slice(0, 16) : '',
    done: row.done,
    completedAt: row.completed_at ? row.completed_at.replace('T', ' ').slice(0, 16) : '',
    dailyDoneDate: row.daily_done_date,
    subitems: row.subitems || [],
    note: row.note,
    folderKey: row.folder_key || '',
    updatedAt: row.updated_at
  });
}

function itemToSb(item, userId) {
  return {
    id: String(item.id),
    user_id: userId,
    title: item.title,
    requestor: item.requestor,
    month: item.month,
    priority: item.priority,
    status: item.status,
    type: item.type,
    date: item.date ? item.date.replace(' ', 'T') : null,
    request_date: item.requestDate ? item.requestDate.replace(' ', 'T') : null,
    done: item.done,
    completed_at: item.completedAt ? item.completedAt.replace(' ', 'T') : null,
    daily_done_date: item.dailyDoneDate,
    subitems: item.subitems || [],
    note: item.note,
    folder_key: item.folderKey || null
  };
}

async function ensureAuth() {
  if (!supabaseClient) return null;
  const user = await sbGetUser();
  if (user) return user;
  const storedCode = localStorage.getItem('reqord-access-code');
  const storedName = localStorage.getItem('reqord-username');
  if (!storedCode || !storedName) return null;
  try {
    const code = atob(storedCode);
    const name = atob(storedName);
    const { data, error } = await supabaseClient.auth.signInWithPassword({ email: name + '@gmail.com', password: code });
    if (error) return null;
    return data.user || null;
  } catch { return null; }
}

async function sbDeleteItem(id) {
  if (!supabaseClient) { pendingDeletes.add(String(id)); persistPendingDeletes(); return; }
  const user = await ensureAuth();
  if (!user) { showToast('Login dulu untuk menghapus data di cloud'); pendingDeletes.add(String(id)); persistPendingDeletes(); return; }
  const { error } = await supabaseClient
    .from('work_orders')
    .delete()
    .eq('id', id);
  if (error) { showToast('Hapus gagal: ' + error.message); pendingDeletes.add(String(id)); persistPendingDeletes(); return; }
  // Berhasil: bersihkan snapshot + tandai pending
  syncSnapshot.delete(String(id));
  lastSyncedIds.delete(String(id));
  pendingDeletes.delete(String(id));
  persistLastSyncedIds();
  persistPendingDeletes();
}

async function sbSyncAll() {
  if (!supabaseClient) return;
  const user = await sbGetUser();
  if (!user) { syncState = 'idle'; updateSyncStatus(); return; }
  
  // 1. Fetch all from Supabase for reconcile
  let dbItems = [];
  try {
    const { data, error } = await supabaseClient.from('work_orders').select('id, folder_key, title, requestor, status');
    if (!error && data) dbItems = data;
  } catch (e) { console.warn('[reqord] reconcile fetch failed:', e); }
  
  // 1b. Reconcile: buang item lokal yang terakhir ada di cloud tapi sekarang hilang (dihapus device lain)
  if (dbItems.length > 0 || lastSyncedIds.size === 0) {
    const dbIds = new Set(dbItems.map(d => String(d.id)));
    const beforeCount = items.length;
    items = items.filter(item => !lastSyncedIds.has(String(item.id)) || dbIds.has(String(item.id)));
    const removedRemote = beforeCount - items.length;
    if (removedRemote) {
      console.log('[reqord] sbSyncAll: removed', removedRemote, 'remote-deleted items');
      persistDraft();
    }
  }
  
  // 2. Get current scanned folderKeys from localStorage
  const scannedFolderKeys = new Set(items.filter(i => i.folderKey).map(i => i.folderKey));
  
  // 3. Mark orphans: in DB but folderKey not in current scan
  const orphanIds = new Set(dbItems.filter(db => db.folder_key && !scannedFolderKeys.has(db.folder_key)).map(db => db.id));
  items.forEach(item => {
    if (orphanIds.has(String(item.id))) item.orphan = true;
    else delete item.orphan;
  });
  
  // 3b. Proses pending deletes (yang gagal dihapus sebelumnya)
  if (pendingDeletes.size) {
    const idsToDelete = [...pendingDeletes];
    const { error } = await supabaseClient.from('work_orders').delete().in('id', idsToDelete);
    if (!error) {
      idsToDelete.forEach(id => { syncSnapshot.delete(id); lastSyncedIds.delete(id); });
      pendingDeletes.clear();
      persistPendingDeletes();
      persistLastSyncedIds();
      console.log('[reqord] sbSyncAll: processed', idsToDelete.length, 'pending deletes');
    } else {
      console.warn('[reqord] sbSyncAll: pending delete failed:', error.message);
    }
  }
  
  // 4. Push local changes (existing logic)
  const dirty = items.filter(item => syncSnapshot.get(String(item.id)) !== itemSignature(item));
  const staleIds = [...syncSnapshot.keys()].filter(id => !items.some(item => String(item.id) === id));
  if (!dirty.length && !staleIds.length) {
    hasUnsyncedChanges = false;
    lastSyncTime = new Date();
    updateSyncStatus();
    showToast('Tidak ada perubahan yang perlu disinkronkan');
    return;
  }
  syncState = 'syncing';
  syncProgress = { done: 0, total: dirty.length + staleIds.length };
  updateSyncStatus();
  const CHUNK = 50;
  let failed = false;
  const rows = dirty.map(item => itemToSb(item, user.id));
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    let { error } = await supabaseClient.from('work_orders').upsert(chunk);
    if (error && /folder_key/i.test(error.message)) {
      const stripped = chunk.map(({ folder_key, ...rest }) => rest);
      ({ error } = await supabaseClient.from('work_orders').upsert(stripped));
    }
    if (error) { failed = true; console.error('[reqord] sbSyncAll chunk error:', error); showToast('Sync gagal: ' + error.message); }
    syncProgress.done = Math.min(start + CHUNK, rows.length);
    updateSyncStatus();
  }
  if (staleIds.length) {
    const { error } = await supabaseClient.from('work_orders').delete().in('id', staleIds);
    if (error) { failed = true; console.error('[reqord] sbSyncAll delete error:', error); showToast('Hapus sync gagal: ' + error.message); }
    syncProgress.done = dirty.length + staleIds.length;
    updateSyncStatus();
  }
  if (!failed && !(await sbSaveActivities())) failed = true;
  syncState = failed ? 'error' : 'idle';
  if (!failed) {
    hasUnsyncedChanges = false;
    lastSyncTime = new Date();
    syncSnapshot = new Map(items.map(item => [String(item.id), itemSignature(item)]));
    lastSyncedIds = new Set(items.map(item => String(item.id)));
    persistLastSyncedIds();
  }
  updateSyncStatus();
  render(); // refresh badges
  console.log('[reqord] sbSyncAll: changed', dirty.length, 'deleted', staleIds.length, 'orphans', orphanIds.size, failed ? '(ada yang gagal)' : '');
}

// === Activity sync (reqord_meta) ===
async function sbSaveActivities() {
  if (!supabaseClient) return true;
  const { error } = await supabaseClient.from('reqord_meta').upsert({ key: 'activities', value: activities, updated_at: new Date().toISOString() });
  if (error) { console.error('[reqord] activity sync error:', error); return false; }
  return true;
}
async function sbLoadActivities() {
  if (!supabaseClient) return;
  const { data, error } = await supabaseClient.from('reqord_meta').select('value').eq('key', 'activities').maybeSingle();
  if (error || !data || !Array.isArray(data.value)) return;
  const seen = new Set(activities.map(activityKey));
  data.value.forEach(activity => { const key = activityKey(activity); if (!seen.has(key)) { activities.push(activity); seen.add(key); } });
  activities.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  renderActivities();
  console.log('[reqord] sbLoadActivities: merged', data.value.length, 'remote activities');
}

// Auth state listener
if (supabaseClient) {
  supabaseClient.auth.onAuthStateChange(async (event, session) => {
    console.log('[reqord] auth state:', event, session?.user?.email);
    if (event === 'SIGNED_IN') {
      await sbLoadItems();
    } else if (event === 'SIGNED_OUT') {
      items = [];
      persistDraft();
      render();
    }
  });
}

// Initial render
render();


