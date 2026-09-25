import { getSessionFromRequest } from '../../lib/auth.js';
import { getFile } from '../../lib/store.js';

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function onRequestGet({ request, env }) {
  const session = await getSessionFromRequest(request, env);
  if (!session) return new Response('Not signed in.', { status: 401 });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response('Missing id.', { status: 400 });

  try {
    const result = await getFile(env, id);
    if (!result) return new Response('Not found.', { status: 404 });
    const bytes = base64ToBytes(result.base64);
    const safeName = String(result.meta.filename || 'file').replace(/[^\w.\- ]/g, '_');
    return new Response(bytes, {
      status: 200,
      headers: {
        'Content-Type': result.meta.contentType || 'application/octet-stream',
        'Content-Disposition': `inline; filename="${safeName}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (e) {
    console.error('file function error:', e);
    return new Response('Server error.', { status: 500 });
  }
}
