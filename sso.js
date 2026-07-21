(function (global) {
  // ponytail: soft signed token for cohort SSO — not DRM. Ceiling: secret is in static JS;
  // upgrade: server-issued one-time tokens via Apps Script.

  function b64urlEncode(str) {
    var b64 = btoa(unescape(encodeURIComponent(str)));
    return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
  }

  function b64urlDecode(str) {
    var b64 = String(str || '').replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    return decodeURIComponent(escape(atob(b64)));
  }

  function softSign(message, secret) {
    var s = String(secret || '') + '|' + String(message || '');
    var h = 2166136261;
    for (var i = 0; i < s.length; i += 1) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }

  function mint(username, role, secret, hours) {
    var ttl = (Number(hours) > 0 ? Number(hours) : 12) * 3600000;
    var payload = {
      u: String(username || ''),
      role: String(role || 'learner'),
      exp: Date.now() + ttl
    };
    var body = b64urlEncode(JSON.stringify(payload));
    return body + '.' + softSign(body, secret);
  }

  function verify(token, secret) {
    var parts = String(token || '').split('.');
    if (parts.length !== 2) return null;
    var body = parts[0];
    var sig = parts[1];
    if (softSign(body, secret) !== sig) return null;
    try {
      var payload = JSON.parse(b64urlDecode(body));
      if (!payload || !payload.u || !payload.exp) return null;
      if (Number(payload.exp) <= Date.now()) return null;
      return {
        username: String(payload.u),
        role: String(payload.role || 'learner'),
        exp: Number(payload.exp)
      };
    } catch (err) {
      return null;
    }
  }

  global.HubSso = { mint: mint, verify: verify };
})(window);
