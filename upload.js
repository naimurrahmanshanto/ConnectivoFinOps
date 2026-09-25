'use strict';
const crypto = require('crypto');
const { getSessionFromEvent } = require('./_lib/auth');
const { filesStore } = require('./_lib/store');

// Netlify Functions have a request-size ceiling; base64 adds ~33%
// overhead, so this keeps the raw file comfortably under that.
const MAX_BYTES = 4 * 1024 * 1024; // 4 MB

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed.' });
  const session = getSessionFromEvent(event);
  if (!session) return json(401, { error: 'Not signed in.' });

  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Invalid request.' }); }

  const { filename, contentType, dataBase64 } = body;
  if (!dataBase64) return json(400, { error: 'No file data received.' });

  let buf;
  try { buf = Buffer.from(dataBase64, 'base64'); }
  catch (e) { return json(400, { error: 'Malformed file data.' }); }
  if (buf.length > MAX_BYTES) return json(413, { error: 'Files over 4 MB are not supported. Please attach a smaller file.' });

  const id = crypto.randomUUID();
  try {
    const store = filesStore(event);
    await store.set(id, buf, {
      metadata: { filename: (filename || 'file').slice(0, 200), contentType: contentType || 'application/octet-stream' },
    });
  } catch (e) {
    console.error('upload function error:', e);
    return json(500, { error: 'Could not store the file. Please try again.' });
  }
  return json(200, { ok: true, id });
};

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
