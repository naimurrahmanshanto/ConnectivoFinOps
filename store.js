// Thin wrapper around Netlify Blobs — the actual "database" for this app.
// One JSON blob per collection (a map of {docId: docBody}), which keeps
// this simple and avoids pagination for a small-business-sized ledger.
'use strict';
const { connectLambda, getStore } = require('@netlify/blobs');

const DB_STORE = 'connectivo-finops-db';
const FILES_STORE = 'connectivo-finops-files';

function dataStore(event) {
  connectLambda(event); // required for Blobs in classic Lambda-style functions
  return getStore(DB_STORE);
}
function filesStore(event) {
  connectLambda(event);
  return getStore(FILES_STORE);
}

async function readCollection(event, name) {
  const store = dataStore(event);
  const val = await store.get(name, { type: 'json' });
  return val || {};
}
async function writeCollection(event, name, obj) {
  const store = dataStore(event);
  await store.setJSON(name, obj);
}

module.exports = { dataStore, filesStore, readCollection, writeCollection };
