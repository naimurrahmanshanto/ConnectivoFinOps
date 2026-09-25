# Connectivo FinOps — Cloudflare Pages deployment package

Same app, moved off Netlify after its credits ran out. This version's
backend runs on **Cloudflare Pages Functions** with **Cloudflare KV** as
the database — Cloudflare's free tier isn't credit-metered the way
Netlify's now is, and explicitly allows commercial use.

## What's in here

```
index.html                       the whole frontend (one file, as before)
_headers                         security headers (Cloudflare's equivalent of netlify.toml's headers block)
functions/api/
  auth/login.js                  checks username+password, issues a session cookie
  auth/logout.js                 clears the session cookie
  auth/session.js                "am I still signed in?"
  data.js                        every database read/write goes through here
  upload.js / file.js            document attachment upload/download
lib/
  auth.js                        credential table, password check, session signing
  store.js                       Cloudflare KV helper
scripts/hash-password.js         run this to generate a new password's hash
```

**Important:** `lib/` sits at the top level, *outside* `functions/` —
don't move it inside `functions/`. That exact kind of misplacement is what
caused all the Netlify trouble, so this package is laid out to make it
hard to repeat: nothing here needs to move anywhere for it to work.

## One-time setup

### 1. Create the KV namespace (the database)

In the Cloudflare dashboard: **Workers & Pages → KV → Create namespace**.
Name it anything, e.g. `connectivo-finops-db`.

### 2. Create the Pages project from your GitHub repo

**Workers & Pages → Create → Pages → Connect to Git** → pick your
`ConnectivoFinOps` repo (or a fresh one with these files). Build settings:
leave the build command **empty** and the output directory as `/` (this
site has no build step — `index.html` is served as-is).

### 3. Bind the KV namespace to the project

On the project: **Settings → Functions → KV namespace bindings → Add
binding**. Variable name must be exactly `DB` (the code expects
`env.DB`) → select the namespace you created in step 1.

### 4. Add the environment variables (as Secrets)

**Settings → Environment variables → Add variable** (mark each as
**Secret** so it's encrypted at rest), for both Production and Preview:

| Key | Value |
|---|---|
| `SESSION_SECRET` | any long random string — `openssl rand -hex 32`, or mash the keyboard for 40+ characters |
| `AUTH_SHANTO_HASH` | `210000:39a7f56a457059fbcd9f80a4c83bca32:ade4f638849ad328bbdac5097444845d80bc01e3d3cd81838f19ee7cd1747b46` |
| `AUTH_SHOMVOB_HASH` | `210000:a4f7fbb7037411c8d65b705b00745c48:c15d8deea217322f2267284742a2b77d161b616ed1ef38dc357ade3f357c26e5` |
| `AUTH_SHOIKOT_HASH` | `210000:907feed83a455242b355eb66d4732151:97fa74b2d6b674949fbe298d0c2174b07f795e60d90f0a0e60d1fb87f1306c46` |

Those three hashes match the same passwords as before (Shanto/Eminem02,
Shomvob/Connectivoceo2026, Shoikot/Connectivoadm2026) — no need to
regenerate anything to get started. This is a **different hash format**
than the Netlify version used (`iterations:salt:hash` instead of
`salt:hash`) because Cloudflare Workers can't run Node's `scrypt` — see
"Why the hash format changed" below.

### 5. Redeploy

**Deployments → Retry deployment** (or just push any commit — bindings
and env vars only take effect on the *next* deploy after you add them).

## How to tell it's actually working

Open your Cloudflare Pages URL (`your-project.pages.dev`, or a custom
domain if you set one up). The login screen should say *"Your password is
checked on Connectivo's own server and never stored in this page."* Sign
in, open Developer Console (as Shanto) — **Runtime Mode** should say
**"Live server backend."**

## Changing a password later

```bash
node scripts/hash-password.js "TheNewPassword"
```

Copy the full `iterations:salt:hash` string into the matching
`AUTH_..._HASH` variable, then redeploy.

## Why the hash format changed

The Netlify version hashed passwords with `scrypt`, a Node.js built-in.
Cloudflare Workers run a Web-standard JavaScript runtime, not full
Node.js, and don't support `scrypt`. This version uses **PBKDF2-SHA256
with 210,000 iterations** instead, via the standard Web Crypto API
(`crypto.subtle`) — still a real, industry-standard, deliberately slow
password hash (this iteration count matches OWASP's current PBKDF2-SHA256
recommendation), just the one that's natively supported here without
adding a dependency. Verified end-to-end before shipping: correct
passwords succeed, wrong ones and tampered session tokens are rejected,
and Node's own `crypto.pbkdf2Sync` (used by the local hashing script)
produces byte-identical output to what the Worker computes at sign-in, so
hashes generated locally are guaranteed to verify correctly.

## What's genuinely secure, same as before

- Passwords checked server-side, never sent to or stored in the browser page.
- Sessions: an `HttpOnly`, `Secure`, `SameSite=Strict` cookie, HMAC-signed
  so it can't be forged without `SESSION_SECRET`.
- Every data read and write is rejected server-side without a valid
  session — not just hidden in the UI.
- Hard delete (permanently erasing a record) is restricted to the
  developer account, enforced in the API itself, not just the interface.

## Honest limits

- **Cloudflare KV is eventually consistent** — a write can take a few
  seconds (rarely, up to ~60s) to show up from a different location.
  Usually much faster in practice, but don't be alarmed by a brief delay
  after entering a transaction before it appears in another browser.
- `SESSION_SECRET` and the three `AUTH_*_HASH` values are only as safe as
  your Cloudflare account's own login and who has access to it.
- No rate-limiting on login attempts and no 2FA in this version — Cloudflare's
  free Web Application Firewall / rate limiting rules are a reasonable
  next step if this will hold real client financial data long-term.
- One KV namespace, `DB`, holds everything — structured records under a
  `data:` prefix and file attachments (capped at 4 MB each) under `file:`/
  `filemeta:` prefixes. That's a deliberate simplification to keep setup
  to one binding; splitting attachments into R2 (Cloudflare's object
  storage) would be the natural upgrade if attachments grow large or numerous.
