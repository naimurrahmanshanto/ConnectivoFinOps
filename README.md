# Connectivo FinOps — Netlify deployment package

This turns the site from a single static file into a real, functioning app:
a real server-side login (Netlify Functions) and a real database (Netlify
Blobs) — both hosted entirely on Netlify, no third-party service needed.

## What's in here

```
index.html                       the whole frontend (one file, as before)
netlify.toml                     site config: functions folder, API routes, headers
package.json                     the one dependency (@netlify/blobs)
netlify/functions/
  auth-login.js                  checks username+password, issues a session cookie
  auth-logout.js                 clears the session cookie
  auth-session.js                "am I still signed in?"
  data.js                        every database read/write goes through here
  upload.js / file.js            document attachment upload/download
  _lib/auth.js                   credential table, password check, session signing
  _lib/store.js                  Netlify Blobs helper
scripts/hash-password.js         run this to generate a new password's hash
```

## Why this needs a real deploy, not drag-and-drop

The version you already drag-and-dropped only had the static `index.html`
— that's why the login was client-side (and honestly not very secure: the
page itself had to contain the password check). The functions in this
package fix that, but Netlify's drag-and-drop upload box only publishes
static files — it does not reliably build and deploy the `netlify/functions`
folder. To get the functions live, use one of these two paths instead:

### Option A — Connect this to GitHub (recommended, and you said you wanted this anyway)

1. Push this entire folder to the GitHub repo you're setting up (see the
   note on GitHub at the end).
2. On Netlify: **Add new site → Import an existing project → GitHub** →
   pick the repo.
3. Build settings: leave the build command as `npm install` (already set
   in `netlify.toml`) and publish directory as `.` (also already set) —
   Netlify reads both from `netlify.toml` automatically, so you can just
   click **Deploy**.
4. Every future `git push` redeploys automatically, functions included.

### Option B — Netlify CLI (no GitHub required)

```bash
npm install -g netlify-cli
cd connectivo-finops          # this folder
netlify login
netlify link                  # choose the site you already created
netlify deploy --prod
```

The CLI bundles and uploads the functions correctly, unlike the drag-and-drop box.

## One-time setup: environment variables

Your actual passwords are **not** in any file here — that's deliberate, so
they never end up in Git history even if the repo is public. Instead they
live only in Netlify's own environment variable store.



### Changing a password later

```bash
node scripts/hash-password.js "TheNewPassword"
```

This prints a `salt:hash` string — copy the **entire** string as the new
value of that person's `AUTH_..._HASH` variable in the Netlify dashboard,
then trigger a new deploy. Nobody, including you, can work backwards from
the hash to the original password.

## How to tell it's actually working

Open your Netlify site URL. The login screen should say *"Your password is
checked on Connectivo's own server and never stored in this page"* — if it
instead says the "no server behind it" version, the functions aren't live
yet (double check the environment variables are set and you redeployed
after adding them).

Once signed in, open your browser's dev tools → Network tab → do anything
in the app (record a transaction) — you'll see requests going to
`/api/data`, not to `localStorage`. That's the real database.

## What's genuinely secure now, versus before

- **Passwords**: checked server-side with `scrypt` (a deliberately slow,
  salted hashing algorithm built into Node — nothing exotic, but real) and
  compared with a constant-time comparison. The password itself is never
  sent to, or stored in, the browser page.
- **Sessions**: an `HttpOnly`, `Secure`, `SameSite=Strict` cookie your
  page's JavaScript can't even read, signed with an HMAC so it can't be
  forged without `SESSION_SECRET`.
- **Every** data read and write is rejected server-side without a valid
  session — not just hidden in the UI. Suspending someone in Users &
  Access takes effect immediately, even if they already know a valid
  password.
- **Data**: stored in Netlify Blobs, which lives entirely in your Netlify
  account, not in the browser of whoever happens to open the page.

## Honest limits, even with this backend

- `SESSION_SECRET` and the three `AUTH_*_HASH` values are only as safe as
  your Netlify account's own login and who has access to your team there.
  Anyone with access to Site settings can read (and change) them.
- There's no rate-limiting on login attempts and no 2FA in this version —
  someone could still script repeated guesses against the login function.
  Adding rate limiting (e.g. via Netlify's Firewall/Traffic Rules, or a
  simple attempt counter in Blobs) is a reasonable next step if this will
  hold real client financial data long-term.
- This is still a three-person, fixed-account system, not a full
  identity provider. That matches what you asked for; if the team grows,
  a proper auth provider (Auth0, Clerk, Netlify's own Identity options)
  would scale better than adding more hardcoded accounts.
