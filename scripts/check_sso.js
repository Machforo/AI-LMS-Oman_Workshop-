#!/usr/bin/env node
/** Self-check: hub SSO mint/verify round-trip. Run: node scripts/check_sso.js */
'use strict';

function b64urlEncode(str) {
  return Buffer.from(str, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function b64urlDecode(str) {
  var b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  return Buffer.from(b64, 'base64').toString('utf8');
}

function softSign(message, secret) {
  var s = String(secret) + '|' + String(message);
  var h = 2166136261;
  for (var i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16);
}

function mint(username, role, secret, hours) {
  var payload = { u: username, role: role, exp: Date.now() + hours * 3600000 };
  var body = b64urlEncode(JSON.stringify(payload));
  return body + '.' + softSign(body, secret);
}

function verify(token, secret) {
  var parts = String(token).split('.');
  if (parts.length !== 2) return null;
  if (softSign(parts[0], secret) !== parts[1]) return null;
  var payload = JSON.parse(b64urlDecode(parts[0]));
  if (!payload.u || payload.exp <= Date.now()) return null;
  return payload;
}

var secret = 'traininglobe-hub-sso-v1';
var token = mint('demo1', 'learner', secret, 12);
var ok = verify(token, secret);
if (!ok || ok.u !== 'demo1') {
  console.error('FAIL: verify', ok);
  process.exit(1);
}
if (verify(token, 'wrong-secret')) {
  console.error('FAIL: bad secret accepted');
  process.exit(1);
}
var expired = b64urlEncode(JSON.stringify({ u: 'demo1', role: 'learner', exp: Date.now() - 1000 }));
expired = expired + '.' + softSign(expired, secret);
if (verify(expired, secret)) {
  console.error('FAIL: expired accepted');
  process.exit(1);
}
console.log('ok: hub SSO mint/verify');
