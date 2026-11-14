const SUPABASE_URL = 'https://htyfykkurammflwefxgw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iUul7iVeH-ReFlSxVT-ulQ_qhkgzPAz';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const statusLabels = {
  new_request: 'New Request',
  waiting_brief: 'Waiting Brief',
  working: 'Working',
  draft_preview: '1st Draft',
  revision: 'In Revision',
  preview: 'Preview',
  on_hold: 'On Hold',
  approved: 'Approved',
  done: 'Done',
  daily: 'Daily',
  cancelled: 'Cancelled'
};

let items = [];
let searchQuery = '';
let statusFilter = 'all';
let monthFilter = 'all';
const PAGE_SIZE = 20;
let visibleLimit = PAGE_SIZE;

const boardBody = document.querySelector('#boardBody');
const liveState = document.querySelector('#liveState');
const resultCount = document.querySelector('#resultCount');
const searchInput = document.querySelector('#searchInput');
const statusSelect = document.querySelector('#statusFilter');
const monthSelect = document.querySelector('#monthFilter');
const loadMoreButton = document.querySelector('#loadMoreButton');

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function getRequestorColor(name) {
  const colors = [
    '#4ade80', '#60a5fa', '#fbbf24', '#f87171', '#a78bfa',
    '#f472b6', '#34d399', '#fb923c', '#818cf8', '#22d3ee',
    '#eab308', '#ef4444', '#14b8a6', '#ec4899', '#6366f1'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = ((hash << 5) - hash) + name.charCodeAt(i);
  return colors[Math.abs(hash) % colors.length];
}

function renderRequestorPills(requestor) {
  if (!requestor) return '<span class="requestor-pill" style="background:#9ca3af">Unknown</span>';
  return requestor.split(',').map(r => r.trim()).filter(Boolean).map(r => {
    const color = getRequestorColor(r);
    return `<span class="requestor-pill" style="background:${color}">${escapeHtml(r)}</span>`;
  }).join(' ');
}

function normalizeStatus(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('waiting') && (text.includes('brief') || text.includes('full'))) return 'waiting_brief';
  if (text.includes('revision') || text.includes('revisi')) return 'revision';
  if (text.includes('1st') || text.includes('first') || text.includes('draft')) return 'draft_preview';
  if (text.includes('preview') || text.includes('review')) return 'preview';
  if (text.includes('working') || text.includes('ongoing') || text.includes('progress') || text.includes('kerja')) return 'working';
  if (text.includes('done') || text.includes('selesai') || text.includes('complete')) return 'done';
  if (text.includes('daily') || text.includes('harian')) return 'daily';
  if (text.includes('cancelled') || text.includes('cancel') || text.includes('batal')) return 'cancelled';
  if (text.includes('on hold') || text.includes('on_hold') || text.includes('hold')) return 'on_hold';
  if (text.includes('approved') || text.includes('approve')) return 'approved';
  return 'new_request';
}

function normalizeItem(row) {
  return {
    id: String(row.id || ''),
    title: String(row.title || '').trim(),
    requestor: String(row.requestor || '').trim(),
    status: normalizeStatus(row.status),
    priority: String(row.priority || 'normal'),
    month: String(row.month || ''),
    requestDate: row.request_date ? String(row.request_date).replace('T', ' ').slice(0, 16) : '',
    date: row.date ? String(row.date).replace('T', ' ').slice(0, 16) : ''
  };
}

function setLive(text) {
  if (liveState) liveState.textContent = text;
}

function refreshMonthFilter() {
  const months = [...new Set(items.map(item => item.month).filter(Boolean))].sort();
  const current = monthSelect.value;
  monthSelect.innerHTML = '<option value="all">Semua bulan</option>' + months.map(m => `<option value="${escapeHtml(m)}">${escapeHtml(m)}</option>`).join('');
  if (months.includes(current)) monthSelect.value = current;
}

function render() {
  const query = searchQuery.trim().toLowerCase();
  const visible = items.filter(item => (!query || `${item.title} ${item.requestor}`.toLowerCase().includes(query)) && (statusFilter === 'all' || item.status === statusFilter) && (monthFilter === 'all' || item.month === monthFilter));
  const shown = visible.slice(0, visibleLimit);
  boardBody.innerHTML = shown.map(item => `<tr class="status-${item.status}"><td class="title-cell">${escapeHtml(item.title)}</td><td>${renderRequestorPills(item.requestor)}</td><td><span class="status-pill pill-${item.status}">${escapeHtml(statusLabels[item.status] || item.status)}</span></td><td><span class="priority-pill priority-${item.priority}">${escapeHtml(item.priority)}</span></td><td>${escapeHtml(item.requestDate)}</td><td>${escapeHtml(item.date) || 'No deadline'}</td></tr>`).join('');
  resultCount.textContent = `${visible.length} work orders`;
  if (loadMoreButton) {
    const remaining = visible.length - shown.length;
    loadMoreButton.hidden = remaining <= 0;
    loadMoreButton.textContent = `Show more (${remaining} lagi)`;
  }
  refreshMonthFilter();
}

async function loadItems() {
  if (!supabaseClient) { setLive('Supabase tidak tersedia'); return; }
  const { data, error } = await supabaseClient
    .from('work_orders')
    .select('id,title,requestor,status,priority,month,request_date,date,created_at')
    .order('created_at', { ascending: false });
  if (error) { setLive('Gagal memuat'); console.error('[reqord-public] load error:', error); return; }
  items = (data || []).map(normalizeItem);
  render();
  setLive('Live');
}

searchInput.addEventListener('input', event => { searchQuery = event.target.value; visibleLimit = PAGE_SIZE; render(); });
statusSelect.addEventListener('change', event => { statusFilter = event.target.value; visibleLimit = PAGE_SIZE; render(); });
monthSelect.addEventListener('change', event => { monthFilter = event.target.value; visibleLimit = PAGE_SIZE; render(); });
if (loadMoreButton) loadMoreButton.addEventListener('click', () => { visibleLimit += PAGE_SIZE; render(); });

loadItems();
if (supabaseClient) {
  supabaseClient.channel('public_work_orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => loadItems())
    .subscribe();
}
