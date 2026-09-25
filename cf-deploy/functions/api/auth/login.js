import { checkCredentials, makeSessionToken, cookieFor, json } from '../../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  let body;
  try { body = await request.json(); }
  catch (e) { return json(400, { error: 'Invalid request.' }); }

  const acct = await checkCredentials(body.username, body.password, env);
  if (!acct) return json(401, { error: 'Incorrect username or password.' });

  const token = await makeSessionToken(acct, env);
  return json(200, { ok: true, uid: acct.uid, name: acct.name, role: acct.role }, { 'Set-Cookie': cookieFor(token) });
}
