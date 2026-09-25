import { getSessionFromRequest, json } from '../../lib/auth.js';
import { putFile } from '../../lib/store.js';

// KV values are capped at 25 MiB; base64 adds ~33% overhead, so this keeps
// the raw file comfortably under both that and Pages Functions' own request
// size limits.
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

export async function onRequestPost({ request, env }) {
  const session = await getSessionFromRequest(request, env);
  if (!session) return json(401, { error: 'Not signed in.' });

  let body;
  try { body = await request.json(); }
  catch (e) { return json(400, { error: 'Invalid request.' }); }

  const { filename, contentType, dataBase64 } = body;
  if (!dataBase64) return json(400, { error: 'No file data received.' });

  // rough size check from the base64 length (no need to decode first)
  const approxBytes = Math.floor(dataBase64.length * 0.75);
  if (approxBytes > MAX_BYTES) return json(413, { error: 'Files over 4 MB are not supported. Please attach a smaller file.' });

  const id = crypto.randomUUID();
  try {
    await putFile(env, id, dataBase64, {
      filename: (filename || 'file').slice(0, 200),
      contentType: contentType || 'application/octet-stream',
    });
  } catch (e) {
    console.error('upload function error:', e);
    return json(500, { error: 'Could not store the file. Please try again.' });
  }
  return json(200, { ok: true, id });
}
