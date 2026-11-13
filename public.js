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

const boardBody = document.querySelector('#boardBody');
const liveState = document.querySelector('#liveState');
const resultCount = document.querySelector('#resultCount');
const searchInput = document.querySelector('#searchInput');
const statusSelect = document.querySelector('#statusFilter');
const monthSelect = document.querySelector('#monthFilter');

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function normalizeStatus(value) {
  const text = String(value || '').toLowerCase();
  if (text.includes('daily')) return 'daily';
  if (text.includes('waiting') && (text.includes('brief') || text.includes('full'))) return 'waiting_brief';
  if (text.includes('preview') || text.includes('review')) return 'preview';
  if (text.includes('revision') || text.includes('revisi')) return 'revision';
  if (text.includes('ongoing') || text.includes('progress') || text.includes('kerja')) return 'working';
  if (text.includes('done') || text.includes('selesai') || text.includes('complete')) return 'done';
  if (text.includes('cancelled') || text.includes('cancel') || text.includes('batal')) return 'cancelled';
  if (text.includes('on hold') || text.includes('on_hold') || text.includes('hold')) return 'on_hold';
  if (text.includes('approved') || text.includes('approve')) return 'approved';
  if (text.includes('1st') || text.includes('first') || text.includes('draft')) return 'draft_preview';
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
  boardBody.innerHTML = visible.map(item => `<tr class="status-${item.status}"><td class="title-cell">${escapeHtml(item.title)}</td><td>${escapeHtml(item.requestor)}</td><td><span class="status-pill pill-${item.status}">${escapeHtml(statusLabels[item.status] || item.status)}</span></td><td><span class="priority-pill priority-${item.priority}">${escapeHtml(item.priority)}</span></td><td>${escapeHtml(item.requestDate)}</td><td>${escapeHtml(item.date) || 'No deadline'}</td></tr>`).join('');
  resultCount.textContent = `${visible.length} work orders`;
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

searchInput.addEventListener('input', event => { searchQuery = event.target.value; render(); });
statusSelect.addEventListener('change', event => { statusFilter = event.target.value; render(); });
monthSelect.addEventListener('change', event => { monthFilter = event.target.value; render(); });

loadItems();
if (supabaseClient) {
  supabaseClient.channel('public_work_orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => loadItems())
    .subscribe();
}
