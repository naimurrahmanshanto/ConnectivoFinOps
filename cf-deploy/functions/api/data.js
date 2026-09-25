import { getSessionFromRequest, json } from '../../lib/auth.js';
import { readCollection, writeCollection } from '../../lib/store.js';

const ALLOWED_COLLECTIONS = new Set([
  'transactions', 'accounts', 'categories', 'businessUnits',
  'auditLogs', 'roles', 'documents', 'counters',
]);

export async function onRequestPost({ request, env }) {
  // This is the real access-control boundary for the whole app: every read
  // and write is rejected here without a valid, unexpired session — not
  // just hidden in the UI.
  const session = await getSessionFromRequest(request, env);
  if (!session) return json(401, { error: 'Not signed in.' });

  let req;
  try { req = await request.json(); }
  catch (e) { return json(400, { error: 'Invalid request.' }); }

  const { op, collection, id, data } = req;
  if (!ALLOWED_COLLECTIONS.has(collection)) return json(400, { error: 'Unknown collection.' });
  if (!['list', 'get', 'set', 'update', 'delete'].includes(op)) return json(400, { error: 'Unknown operation.' });
  if (op !== 'list' && !id) return json(400, { error: 'Missing document id.' });

  // Changing someone ELSE's account status/role record requires CEO or
  // Developer — mirrors the UI's own rule, enforced here too.
  if (collection === 'roles' && (op === 'set' || op === 'update') && id !== session.uid) {
    if (session.role !== 'ceo' && session.role !== 'developer') return json(403, { error: 'Not authorized to change that account.' });
  }
  // Hard delete is a developer-only, superadmin capability.
  if (op === 'delete' && session.role !== 'developer') return json(403, { error: 'Not authorized. Hard delete is restricted to the developer account.' });

  try {
    const store = await readCollection(env, collection);

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
      await writeCollection(env, collection, store);
      return json(200, { ok: true, id });
    }
    if (op === 'update') {
      if (!store[id]) return json(400, { error: 'Document does not exist.' });
      store[id] = { ...store[id], ...(data && typeof data === 'object' ? data : {}) };
      await writeCollection(env, collection, store);
      return json(200, { ok: true, id });
    }
    if (op === 'delete') {
      delete store[id];
      await writeCollection(env, collection, store);
      return json(200, { ok: true, id });
    }
  } catch (e) {
    console.error('data function error:', e);
    return json(500, { error: 'Server error. Please try again.' });
  }
}
