'use strict';
const { checkCredentials, cookieFor, makeSessionToken } = require('./_lib/auth');

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }
  let body;
  try { body = JSON.parse(event.body || '{}'); }
  catch (e) { return json(400, { error: 'Invalid request.' }); }

  const acct = await checkCredentials(body.username, body.password);
  if (!acct) return json(401, { error: 'Incorrect username or password.' });

  const token = makeSessionToken(acct);
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json', 'Set-Cookie': cookieFor(token) },
    body: JSON.stringify({ ok: true, uid: acct.uid, name: acct.name, role: acct.role }),
  };
};

function json(statusCode, obj) {
  return { statusCode, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj) };
}
