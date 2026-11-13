const assert = require('node:assert/strict');
const { escapeHtml, formatExcelDateTime, validateWorkbookRow, filterDefaultSheetNames } = require('../workbook-utils');

assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
assert.equal(formatExcelDateTime('2026-09-22T07:31'), '2026-09-22 07:31');
assert.deepEqual(validateWorkbookRow({ Title: 'Update website' }), { valid: true, title: 'Update website' });
assert.deepEqual(validateWorkbookRow({ Title: '' }), { valid: false, reason: 'empty-title' });
assert.deepEqual(filterDefaultSheetNames(['Sheet1', 'Request List', 'Sheet 2', 'Activity']), ['Request List', 'Activity']);

console.log('Workbook utility checks passed');
