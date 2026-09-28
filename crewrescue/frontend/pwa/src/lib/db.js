// ─────────────────────────────────────────────────────────────────────────────
// CrewRescue Field App — IndexedDB Offline Storage
// Uses idb (a lightweight wrapper over the native IndexedDB API)
// ─────────────────────────────────────────────────────────────────────────────

import { openDB } from 'idb';

const DB_NAME    = 'crewrescue-field';
const DB_VERSION = 1;

let _db = null;

export async function getDB() {
  if (_db) return _db;
  _db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Work orders store — keyed by _id string
      if (!db.objectStoreNames.contains('workOrders')) {
        const store = db.createObjectStore('workOrders', { keyPath: '_id' });
        store.createIndex('status', 'status');
        store.createIndex('severity', 'severity');
        store.createIndex('syncedAt', 'syncedAt');
      }

      // Pending outbox — stores actions queued while offline
      if (!db.objectStoreNames.contains('outbox')) {
        const store = db.createObjectStore('outbox', { autoIncrement: true });
        store.createIndex('type', 'type');
        store.createIndex('createdAt', 'createdAt');
      }

      // Cached photos — base64 blobs linked to work order
      if (!db.objectStoreNames.contains('photos')) {
        const store = db.createObjectStore('photos', { autoIncrement: true });
        store.createIndex('workOrderId', 'workOrderId');
      }

      // Auth token cache
      if (!db.objectStoreNames.contains('auth')) {
        db.createObjectStore('auth', { keyPath: 'key' });
      }
    },
  });
  return _db;
}

// ── Work Orders ───────────────────────────────────────────────────────────────

export async function cacheWorkOrders(workOrders) {
  const db = await getDB();
  const tx = db.transaction('workOrders', 'readwrite');
  const now = Date.now();
  await Promise.all([
    ...workOrders.map(wo => tx.store.put({ ...wo, syncedAt: now })),
    tx.done,
  ]);
}

export async function getCachedWorkOrders(statusFilter = null) {
  const db = await getDB();
  if (statusFilter) {
    return db.getAllFromIndex('workOrders', 'status', statusFilter);
  }
  return db.getAll('workOrders');
}

export async function getCachedWorkOrder(id) {
  const db = await getDB();
  return db.get('workOrders', id);
}

export async function updateCachedWorkOrderStatus(id, status) {
  const db = await getDB();
  const wo = await db.get('workOrders', id);
  if (wo) {
    wo.status = status;
    wo.lastLocalUpdate = Date.now();
    await db.put('workOrders', wo);
  }
}

// ── Outbox (offline actions) ──────────────────────────────────────────────────

/**
 * Queue an action to be synced when network is restored.
 * @param {Object} action - { type, payload }
 */
export async function enqueueAction(action) {
  const db = await getDB();
  await db.add('outbox', {
    ...action,
    createdAt: Date.now(),
    synced: false,
  });
}

export async function getPendingActions() {
  const db = await getDB();
  return db.getAll('outbox');
}

export async function clearOutboxItem(key) {
  const db = await getDB();
  await db.delete('outbox', key);
}

export async function clearAllOutbox() {
  const db = await getDB();
  await db.clear('outbox');
}

// ── Photos ────────────────────────────────────────────────────────────────────

export async function savePhoto(workOrderId, dataUrl, note = '') {
  const db = await getDB();
  return db.add('photos', { workOrderId, dataUrl, note, capturedAt: Date.now() });
}

export async function getPhotosForWorkOrder(workOrderId) {
  const db = await getDB();
  return db.getAllFromIndex('photos', 'workOrderId', workOrderId);
}

export async function deletePhoto(key) {
  const db = await getDB();
  await db.delete('photos', key);
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function saveAuthToken(token) {
  const db = await getDB();
  await db.put('auth', { key: 'accessToken', value: token, savedAt: Date.now() });
}

export async function getAuthToken() {
  const db = await getDB();
  const record = await db.get('auth', 'accessToken');
  return record?.value ?? null;
}

export async function clearAuth() {
  const db = await getDB();
  await db.clear('auth');
}
