import { getSessionFromRequest, json } from '../../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const session = await getSessionFromRequest(request, env);
  if (!session) return json(401, { ok: false, error: 'Not signed in.' });
  return json(200, { ok: true, uid: session.uid, name: session.name, role: session.role });
}
