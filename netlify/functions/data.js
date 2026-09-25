'use strict';
const { getSessionFromEvent } = require('./_lib/auth');
const { readCollection, writeCollection } = require('./_lib/store');

const ALLOWED_COLLECTIONS = new Set([
  'transactions', 'accounts', 'categories', 'businessUnits',
  'auditLogs', 'roles', 'documents', 'counters',
]);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });

  // This is the real access-control boundary for the whole app: every
  // single read and write — not just what the UI happens to show — is
  // rejected here unless the request carries a valid, unexpired session
  // cookie. Nothing about role or identity is ever trusted from the
  // request body.
  const session = getSessionFromEvent(event);
  if (!session) return json(401, { error: 'Not signed in.' });

  let req;
  try { req = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Invalid request.' }); }

  const { op, collection, id, data } = req;
  if (!ALLOWED_COLLECTIONS.has(collection)) return json(400, { error: 'Unknown collection.' });
  if (!['list', 'get', 'set', 'update', 'delete'].includes(op)) return json(400, { error: 'Unknown operation.' });
  if (op !== 'list' && !id) return json(400, { error: 'Missing document id.' });

  // Extra server-side authorization: changing someone ELSE's account
  // status/role record requires CEO or Developer — mirrors the UI's own
  // rule, but enforced here too since the UI can't be trusted alone.
  if (collection === 'roles' && (op === 'set' || op === 'update') && id !== session.uid) {
    if (session.role !== 'ceo' && session.role !== 'developer') {
      return json(403, { error: 'Not authorized to change that account.' });
    }
  }
  // Hard delete is a developer-only, superadmin capability — everyone
  // else (CEO included) works through the void workflow, which keeps a
  // permanent record. This mirrors the same rule enforced in the UI, but
  // enforced here too since the UI alone can't be trusted.
  if (op === 'delete' && session.role !== 'developer') {
    return json(403, { error: 'Not authorized. Hard delete is restricted to the developer account.' });
  }

  try {
    const store = await readCollection(event, collection);

    if (op === 'list') {
      const docs = Object.keys(store).map((k) => ({ id: k, ...store[k] }));
      return json(200, { ok: true, docs });
    }
    if (op === 'get') {
      const doc = store[id];
      return json(200, { ok: true, doc: doc ? { id, ...doc } : null });
    }
    if (op === 'set') {
      store[id] = data && typeof data === 'object' ? data : {};
      await writeCollection(event, collection, store);
      return json(200, { ok: true, id });
    }
    if (op === 'update') {
      if (!store[id]) return json(400, { error: 'Document does not exist.' });
      store[id] = { ...store[id], ...(data && typeof data === 'object' ? data : {}) };
      await writeCollection(event, collection, store);
      return json(200, { ok: true, id });
    }
    if (op === 'delete') {
      delete store[id];
      await writeCollection(event, collection, store);
      return json(200, { ok: true, id });
    }
  } catch (e) {
    console.error('data function error:', e);
    return json(500, { error: 'Server error. Please try again.' });
  }
};

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
