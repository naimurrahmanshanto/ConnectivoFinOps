import { clearCookie, json } from '../../../lib/auth.js';

export async function onRequestPost() {
  return json(200, { ok: true }, { 'Set-Cookie': clearCookie() });
}
