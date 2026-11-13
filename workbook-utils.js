function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character]));
}

function formatExcelDateTime(value) {
  return String(value || '').trim().replace('T', ' ');
}

function validateWorkbookRow(row) {
  const title = String(row.Title || row.title || row.Name || '').trim();
  if (!title) return { valid: false, reason: 'empty-title' };
  return { valid: true, title };
}

function filterDefaultSheetNames(sheetNames) {
  return sheetNames.filter(name => !/^(sheet\s*1|sheet\s*2|sheet\s*3)$/i.test(String(name).trim()));
}

if (typeof module !== 'undefined') module.exports = { escapeHtml, formatExcelDateTime, validateWorkbookRow, filterDefaultSheetNames };
