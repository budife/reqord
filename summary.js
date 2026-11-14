const SUPABASE_URL = 'https://htyfykkurammflwefxgw.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_iUul7iVeH-ReFlSxVT-ulQ_qhkgzPAz';
const supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

const statusLabels = {
  new_request: 'New Request', waiting_brief: 'Waiting Brief', working: 'Working',
  draft_preview: '1st Draft', revision: 'In Revision', preview: 'Preview',
  on_hold: 'On Hold', approved: 'Approved', done: 'Done', daily: 'Daily', cancelled: 'Cancelled'
};

const statusOrder = ['new_request','waiting_brief','working','draft_preview','revision','preview','on_hold','approved','done','daily','cancelled'];
const priorityOrder = ['high','normal','low'];

let items = [];
let currentTimeRange = '6';

function getMonthRange(range) {
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth();
  const months = [];
  const count = range === 'all' ? 999 : parseInt(range, 10);
  for (let i = count - 1; i >= 0; i--) {
    let y = endYear;
    let m = endMonth - i;
    while (m < 0) { m += 12; y -= 1; }
    months.push(`${y}-${String(m + 1).padStart(2, '0')}`);
  }
  return months;
}

function filterItemsByRange(items, range) {
  if (range === 'all') return items;
  const validMonths = new Set(getMonthRange(range));
  return items.filter(i => i.month && validMonths.has(i.month));
}

function setLive(text) {
  const el = document.getElementById('liveState');
  if (el) el.textContent = text;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
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

function renderSummaryCards() {
  const filtered = filterItemsByRange(items, currentTimeRange);
  const total = filtered.length;
  const done = filtered.filter(i => i.status === 'done').length;
  const working = filtered.filter(i => ['working','draft_preview','revision','preview'].includes(i.status)).length;
  const pending = filtered.filter(i => ['new_request','waiting_brief'].includes(i.status)).length;
  const onHold = filtered.filter(i => i.status === 'on_hold').length;
  const high = filtered.filter(i => i.priority === 'high').length;
  const overdue = filtered.filter(i => i.date && new Date(i.date) < new Date() && i.status !== 'done').length;

  const grid = document.getElementById('summaryGrid');
  grid.innerHTML = `
    <div class="summary-card"><span class="summary-value">${total}</span><span class="summary-label">Total</span></div>
    <div class="summary-card done"><span class="summary-value">${done}</span><span class="summary-label">Selesai</span></div>
    <div class="summary-card working"><span class="summary-value">${working}</span><span class="summary-label">Sedang Proses</span></div>
    <div class="summary-card pending"><span class="summary-value">${pending}</span><span class="summary-label">Pending</span></div>
    <div class="summary-card hold"><span class="summary-value">${onHold}</span><span class="summary-label">On Hold</span></div>
    <div class="summary-card high"><span class="summary-value">${high}</span><span class="summary-label">Prioritas Tinggi</span></div>
    <div class="summary-card overdue"><span class="summary-value">${overdue}</span><span class="summary-label">Overdue</span></div>
  `;
}

function renderBars(containerId, data, maxVal) {
  const container = document.getElementById(containerId);
  container.innerHTML = data.map(d => `
    <div class="chart-bar-row">
      <span class="chart-bar-label">${escapeHtml(d.label)}</span>
      <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${maxVal > 0 ? (d.value / maxVal * 100) : 0}%"></div></div>
      <span class="chart-bar-value">${d.value}</span>
    </div>
  `).join('');
}

function renderCharts() {
  const filtered = filterItemsByRange(items, currentTimeRange);

  const statusData = statusOrder.map(s => ({
    label: statusLabels[s] || s,
    value: filtered.filter(i => i.status === s).length
  })).filter(d => d.value > 0);
  renderBars('statusBars', statusData, Math.max(...statusData.map(d => d.value), 1));

  const priorityData = priorityOrder.map(p => ({
    label: p.charAt(0).toUpperCase() + p.slice(1),
    value: filtered.filter(i => i.priority === p).length
  }));
  renderBars('priorityBars', priorityData, Math.max(...priorityData.map(d => d.value), 1));

  const monthLabels = currentTimeRange === 'all'
    ? [...new Set(items.map(i => i.month).filter(Boolean))].sort()
    : getMonthRange(currentTimeRange);
  const monthData = monthLabels.map(m => ({
    label: m,
    value: filtered.filter(i => i.month === m).length
  }));
  renderBars('monthBars', monthData, Math.max(...monthData.map(d => d.value), 1));

  const monthTitle = document.querySelector('.chart-card:nth-child(3) h3');
  if (monthTitle) {
    const label = currentTimeRange === 'all' ? 'Semua waktu' : `${currentTimeRange} bulan terakhir`;
    monthTitle.textContent = `Per Bulan (${label})`;
  }
}

function renderRequestorTable() {
  const filtered = filterItemsByRange(items, currentTimeRange);
  const byRequestor = {};
  filtered.forEach(item => {
    const r = item.requestor || 'Unknown';
    if (!byRequestor[r]) byRequestor[r] = { total: 0, done: 0, working: 0, pending: 0 };
    byRequestor[r].total++;
    if (item.status === 'done') byRequestor[r].done++;
    else if (['working','draft_preview','revision','preview'].includes(item.status)) byRequestor[r].working++;
    else if (['new_request','waiting_brief'].includes(item.status)) byRequestor[r].pending++;
  });

  const rows = Object.entries(byRequestor)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 20)
    .map(([name, stats]) => `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td>${stats.total}</td>
        <td class="done-cell">${stats.done}</td>
        <td class="working-cell">${stats.working}</td>
        <td class="pending-cell">${stats.pending}</td>
      </tr>
    `).join('');
  document.getElementById('requestorTable').innerHTML = rows || '<tr><td colspan="5" style="text-align:center">Belum ada data</td></tr>';
}

async function loadItems() {
  if (!supabaseClient) { setLive('Supabase tidak tersedia'); return; }
  const { data, error } = await supabaseClient
    .from('work_orders')
    .select('id,title,requestor,status,priority,month,request_date,date,created_at')
    .order('created_at', { ascending: false });
  if (error) { setLive('Gagal memuat'); console.error('[reqord-summary] load error:', error); return; }
  items = (data || []).map(normalizeItem);
  renderSummaryCards();
  renderCharts();
  renderRequestorTable();
  setLive('Live');

  const filterEl = document.getElementById('timeRangeFilter');
  if (filterEl) {
    filterEl.value = currentTimeRange;
    filterEl.addEventListener('change', e => {
      currentTimeRange = e.target.value;
      renderCharts();
      renderSummaryCards();
      renderRequestorTable();
    });
  }
}

loadItems();
if (supabaseClient) {
  supabaseClient.channel('summary_work_orders')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'work_orders' }, () => loadItems())
    .subscribe();
}