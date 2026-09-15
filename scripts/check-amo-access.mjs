// Can these credentials actually publish this add-on?
//
// The release failed at its last step with a 403 — "You do not have permission
// to perform this action" — after authenticating, reading the add-on's details
// and uploading the ZIP. The key was valid and belonged to a Mozilla account
// that owned no add-ons at all; the owner was a second account.
//
// Nothing caught it. `--dry-run` authenticates and stops BEFORE the submit
// call, so it green-lit a path that could never work, and the existing
// FIREFOX_EXTENSION_ID check only proved the slug resolves — which it does,
// for anybody, because the listing is public.
//
// This asks the one question that matters: is the account behind this key
// among the add-on's authors? Seconds, before anything is built.
import { createHmac, randomUUID } from 'node:crypto';

const API = 'https://addons.mozilla.org/api/v5';

const issuer = process.env.FIREFOX_JWT_ISSUER;
const secret = process.env.FIREFOX_JWT_SECRET;
const addon = process.env.FIREFOX_EXTENSION_ID;

const missing = [
  ['FIREFOX_JWT_ISSUER', issuer],
  ['FIREFOX_JWT_SECRET', secret],
  ['FIREFOX_EXTENSION_ID', addon],
].filter(([, v]) => !v).map(([n]) => n);

if (missing.length) {
  console.error(`missing: ${missing.join(', ')}`);
  process.exit(1);
}

const b64url = (input) => Buffer.from(input).toString('base64url');

/** AMO's JWT: HS256, short-lived, the issuer as `iss`. */
function token() {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const payload = b64url(JSON.stringify({ iss: issuer, jti: randomUUID(), iat: now, exp: now + 60 }));
  const signature = createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

async function get(path, authed) {
  const res = await fetch(`${API}${path}`, {
    headers: authed ? { Authorization: `JWT ${token()}` } : {},
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

// 1. Who does this key belong to? Authenticated, so a bad secret fails here.
const me = await get('/accounts/profile/', true);
if (me.status !== 200) {
  console.error(`the credentials were refused: HTTP ${me.status} ${me.body?.detail ?? ''}`);
  console.error('FIREFOX_JWT_ISSUER and FIREFOX_JWT_SECRET come from the AMO Developer Hub,');
  console.error('and belong to the account that generated them.');
  process.exit(1);
}

// 2. Who may publish this add-on? Public, so this works for anyone — which is
//    exactly why it is not evidence on its own.
const it = await get(`/addons/addon/${encodeURIComponent(addon)}/`, false);
if (it.status !== 200) {
  console.error(`no add-on at FIREFOX_EXTENSION_ID=${addon}: HTTP ${it.status}`);
  console.error('AMO takes a slug, a numeric id or a GUID — but a GUID has braces,');
  console.error('they are not URL-safe, and they are passed through raw. Use the slug.');
  process.exit(1);
}

const authors = it.body.authors ?? [];
const mine = authors.some((a) => a.id === me.body.id);

console.log(`add-on:  ${it.body.slug} (${it.body.name?.['en-US'] ?? '?'}), currently ${it.body.current_version?.version ?? '?'}`);
console.log(`key:     account ${me.body.id}`);
console.log(`authors: ${authors.map((a) => a.id).join(', ') || '(none listed)'}`);

if (!mine) {
  console.error('');
  console.error(`✗ account ${me.body.id} is not an author of ${it.body.slug}, so it cannot publish it.`);
  console.error('  The submission would fail with 403 after building, uploading and validating.');
  console.error('  Either sign in as an owning account and generate the key there, or add this');
  console.error('  account under Manage Authors on the Developer Hub.');
  process.exit(1);
}

console.log('');
console.log('✓ these credentials may publish this add-on');
