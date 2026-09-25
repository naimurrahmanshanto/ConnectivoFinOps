'use strict';
const { getSessionFromEvent } = require('./_lib/auth');
const { filesStore } = require('./_lib/store');

exports.handler = async (event) => {
  const session = getSessionFromEvent(event);
  if (!session) return { statusCode: 401, body: 'Not signed in.' };

  const id = (event.queryStringParameters || {}).id;
  if (!id) return { statusCode: 400, body: 'Missing id.' };

  try {
    const store = filesStore(event);
    const result = await store.getWithMetadata(id, { type: 'arrayBuffer' });
    if (!result) return { statusCode: 404, body: 'Not found.' };
    const meta = result.metadata || {};
    const buf = Buffer.from(result.data);
    const safeName = String(meta.filename || 'file').replace(/[^\w.\- ]/g, '_');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': meta.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
      body: buf.toString('base64'),
      isBase64Encoded: true,
    };
  } catch (e) {
    console.error('file function error:', e);
    return { statusCode: 500, body: 'Server error.' };
  }
};
