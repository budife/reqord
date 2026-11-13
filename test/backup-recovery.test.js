// Functional test for the data-safety layer: rolling backup, corrupt-storage fallback,
// per-user parked items on logout, and sync-state reset on user switch.
// The real functions are extracted from app.js (so we test shipped code, not a copy)
// and run in a vm sandbox with a mock localStorage.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const source = fs.readFileSync('app.js', 'utf8');

function extractFn(src, name) {
  const start = src.search(new RegExp(`function ${name}\\b`));
  assert.notEqual(start, -1, `function ${name} not found`);
  const braceStart = src.indexOf('{', start);
  let depth = 0;
  for (let i = braceStart; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start, i + 1); }
  }
  throw new Error('unbalanced braces for ' + name);
}

function makeLocalStorage() {
  // Objeck-nya sendiri jadi backing store supaya Object.keys(localStorage) ikut melihat isinya
  // (app.js pakai Object.keys untuk enumerasi backup).
  return {
    getItem(k) { return k in this ? this[k] : null; },
    setItem(k, v) { this[k] = String(v); },
    removeItem(k) { delete this[k]; },
  };
}

const storage = makeLocalStorage();
let items = [];
let activities = [];
let lastSyncedIds = new Set();
let syncSnapshot = new Map();
let pendingDeletes = new Set();

const sandbox = {
  console,
  localStorage: storage,
  showToast: () => {},
  items: null,
  normalizeItem: item => ({ ...item }),
  repairItemIds: list => list,
  // constants used by the extracted code
  STORAGE_KEY: 'reqord-request-work-orders',
  ACTIVITIES_KEY: 'reqord-activities',
  LEGACY_STORAGE_KEY: 'synaps-project-work-orders',
  BACKUP_PREFIX: 'reqord-backup-',
  BACKUP_LIMIT: 5,
};
sandbox.window = sandbox;
vm.createContext(sandbox);

const names = ['listBackupKeys', 'rotateBackup', 'latestBackup', 'loadItems',
  'parkLocalItems', 'restoreParkedItems', 'resetSyncStateForUserChange',
  'loadLastSyncedUser', 'persistLastSyncedUser',
  'loadPendingDeletes', 'persistPendingDeletes', 'loadLastSyncedIds', 'persistLastSyncedIds',
  'persistDraft'];
for (const name of names) vm.runInContext(extractFn(source, name), sandbox, { filename: 'extracted:' + name });
vm.runInContext(`
  var items = []; var activities = []; var lastSyncedIds = new Set();
  var syncSnapshot = new Map(); var pendingDeletes = new Set();
  var hasUnsavedChanges = false;
`, sandbox);

const run = code => vm.runInContext(code, sandbox);

// --- Test 1: rolling backup keeps at most BACKUP_LIMIT entries ---
storage.setItem('reqord-request-work-orders', JSON.stringify([{ id: 'a', title: 'A' }]));
run(`rotateBackup(localStorage.getItem(STORAGE_KEY));`);
storage.setItem('reqord-request-work-orders', JSON.stringify([{ id: 'b' }]));
run(`rotateBackup(localStorage.getItem(STORAGE_KEY));`);
assert.equal(run(`listBackupKeys().length`), 2, 'two backups expected');
for (let i = 3; i <= 7; i++) {
  storage.setItem('reqord-request-work-orders', JSON.stringify([{ id: 'x' + i }]));
  run(`rotateBackup(localStorage.getItem(STORAGE_KEY));`);
}
assert.equal(run(`listBackupKeys().length`), 5, 'backup count capped at 5');

// --- Test 2: loadItems falls back to the latest backup when main storage is corrupt ---
storage.setItem('reqord-request-work-orders', '{ this is not valid json !!');
run(`items = []`);
const recovered = run(`loadItems()`);
assert.ok(Array.isArray(recovered), 'loadItems returns array after corruption');
assert.ok(recovered.length > 0, 'recovered items from backup');
assert.equal(JSON.parse(storage.getItem('reqord-request-work-orders')).length, recovered.length,
  'corrupt main storage rewritten from backup');

// --- Test 3: park on logout + restore on login for the SAME user ---
storage.setItem('reqord-request-work-orders', JSON.stringify([{ id: 'p1', title: 'Parked' }]));
run(`items = repairItemIds(loadItems());`);
run(`parkLocalItems('budi');`);
assert.ok(storage.getItem('reqord-parked-budi'), 'parked key written');
run(`items = [];`);
assert.equal(run(`items.length`), 0, 'local cleared after logout');
run(`var restored = restoreParkedItems('budi');`);
assert.equal(run(`restored`), true, 'restore reports success');
assert.equal(run(`items.length`), 1, 'parked item restored');
assert.equal(run(`items[0].title`), 'Parked');
assert.equal(storage.getItem('reqord-parked-budi'), null, 'parked key consumed');

// --- Test 4: other user does NOT see parked data ---
run(`parkLocalItems('budi'); items = [];`);
run(`var restoredB = restoreParkedItems('sinta');`);
assert.equal(run(`restoredB`), false, 'different user gets nothing');
assert.equal(run(`items.length`), 0);
assert.ok(storage.getItem('reqord-parked-budi'), 'parked data for budi untouched');

// --- Test 5: resetSyncStateForUserChange clears bookkeeping but never touches items ---
run(`items = [{ id: 'z1' }, { id: 'z2' }];
     lastSyncedIds = new Set(['z1','z2','old']);
     syncSnapshot = new Map([['z1','sig']]);
     pendingDeletes = new Set(['old'])`);
run(`resetSyncStateForUserChange('budi')`);
assert.equal(run(`lastSyncedIds.size`), 0, 'lastSyncedIds cleared');
assert.equal(run(`syncSnapshot.size`), 0, 'syncSnapshot cleared');
assert.equal(run(`pendingDeletes.size`), 0, 'pendingDeletes cleared');
assert.equal(run(`items.length`), 2, 'items survive reset');
assert.equal(storage.getItem('reqord-last-synced-user'), 'budi', 'user recorded');

console.log('backup/recovery/park tests passed');