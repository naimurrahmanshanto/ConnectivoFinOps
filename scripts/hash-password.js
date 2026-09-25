#!/usr/bin/env node
// Run this locally whenever you need to set or change a login password:
//   node scripts/hash-password.js "TheNewPassword"
// It prints a "salt:hash" string — paste that (the whole string) as the
// value of the matching AUTH_..._HASH environment variable in the Netlify
// dashboard. This script needs nothing but Node itself (no npm install).
'use strict';
const crypto = require('crypto');

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/hash-password.js "YourPassword"');
  process.exit(1);
}

const salt = crypto.randomBytes(16).toString('hex');
const derivedKey = crypto.scryptSync(password, salt, 64);
console.log(`${salt}:${derivedKey.toString('hex')}`);
