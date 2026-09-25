'use strict';
const { getSessionFromEvent } = require('./_lib/auth');

exports.handler = async (event) => {
  const session = getSessionFromEvent(event);
  if (!session) {
    return { statusCode: 401, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ok: false, error: 'Not signed in.' }) };
  }
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ok: true, uid: session.uid, name: session.name, role: session.role }),
  };
};
