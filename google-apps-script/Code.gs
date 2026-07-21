/**
 * Traininglobe Hub — card access API (Google Sheet + Apps Script).
 * Deploy as Web App: Execute as Me, Who has access: Anyone.
 */

var SHEETS = {
  USERS: 'Users',
  POLICIES: 'CardPolicies',
  GRANTS: 'AccessGrants',
  SESSIONS: 'Sessions'
};

var HEADERS = {
  USERS: ['username', 'password', 'role', 'is_active'],
  POLICIES: ['card_id', 'is_restricted', 'default_expiry_days', 'updated_by', 'updated_at'],
  GRANTS: ['id', 'username', 'card_id', 'status', 'expires_at', 'request_notes', 'admin_notes', 'granted_by', 'created_at', 'updated_at', 'reviewed_at'],
  SESSIONS: ['token', 'username', 'role', 'expires_at']
};

var CARD_IDS = ['playbook', 'ascent', 'hands-on'];

var SEED_USERS = [
  ['Admin', 'Admin@123', 'admin', 'TRUE'],
  ['demo1', 'demo123', 'learner', 'TRUE'],
  ['demo2', 'demo123', 'learner', 'TRUE'],
  ['demo3', 'demo123', 'learner', 'TRUE'],
  ['demo4', 'demo123', 'learner', 'TRUE'],
  ['demo5', 'demo123', 'learner', 'TRUE'],
  ['demo6', 'demo123', 'learner', 'TRUE'],
  ['demo7', 'demo123', 'learner', 'TRUE'],
  ['demo8', 'demo123', 'learner', 'TRUE'],
  ['demo9', 'demo123', 'learner', 'TRUE'],
  ['demo10', 'demo123', 'learner', 'TRUE']
];

function doGet() {
  return jsonOutput({ ok: true, service: 'traininglobe-hub-access-api' });
}

function doPost(e) {
  try {
    var body = e && e.postData && e.postData.contents ? JSON.parse(e.postData.contents) : {};
    return jsonOutput(routeAction(body));
  } catch (err) {
    return jsonOutput({ ok: false, error: String(err.message || err) });
  }
}

function routeAction(body) {
  var action = body.action || '';
  switch (action) {
    case 'login':
      return login(body.username, body.password);
    case 'permissions':
      return getPermissions(requireSession(body.token));
    case 'adminGetData':
      return adminGetData(requireAdmin(body.token));
    case 'adminSetPolicy':
      return adminSetPolicy(requireAdmin(body.token), body.card_id, body.is_restricted, body.default_expiry_days);
    case 'adminGrant':
      return adminGrant(requireAdmin(body.token), body.username, body.card_id, body.expires_at, body.admin_notes);
    case 'adminRevoke':
      return adminRevoke(requireAdmin(body.token), body.grant_id);
    case 'adminExtend':
      return adminExtend(requireAdmin(body.token), body.grant_id, body.expires_at);
    default:
      return { ok: false, error: 'Unknown action: ' + action };
  }
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ss() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function sheet(name) {
  return ss().getSheetByName(name);
}

function setupSheets() {
  Object.keys(SHEETS).forEach(function (key) {
    var name = SHEETS[key];
    var sh = sheet(name);
    if (!sh) sh = ss().insertSheet(name);
    var headers = HEADERS[key];
    sh.clear();
    sh.getRange(1, 1, 1, headers.length).setValues([headers]);
    sh.setFrozenRows(1);
  });

  var users = sheet(SHEETS.USERS);
  if (users.getLastRow() === 1) {
    users.getRange(2, 1, SEED_USERS.length, SEED_USERS[0].length).setValues(SEED_USERS);
  }
}

function rows(name) {
  var sh = sheet(name);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0];
  return values.slice(1).map(function (row) {
    var obj = {};
    headers.forEach(function (h, i) { obj[h] = row[i]; });
    return obj;
  });
}

function appendRow(name, obj) {
  var sh = sheet(name);
  var headers = HEADERS[Object.keys(SHEETS).filter(function (k) { return SHEETS[k] === name; })[0]];
  var row = headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sh.appendRow(row);
}

function updateGrantRow(id, patch) {
  var sh = sheet(SHEETS.GRANTS);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idCol = headers.indexOf('id');
  for (var r = 1; r < values.length; r += 1) {
    if (String(values[r][idCol]) === String(id)) {
      headers.forEach(function (h, c) {
        if (patch[h] !== undefined) sh.getRange(r + 1, c + 1).setValue(patch[h]);
      });
      return true;
    }
  }
  return false;
}

function nowIso() {
  return new Date().toISOString();
}

function parseDate(value) {
  if (!value) return null;
  var d = value instanceof Date ? value : new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

function isExpired(expiresAt) {
  var d = parseDate(expiresAt);
  return d ? d.getTime() <= Date.now() : false;
}

function login(username, password) {
  var u = String(username || '').trim();
  var p = String(password || '').trim();
  if (!u || !p) return { ok: false, error: 'Username and password required.' };

  var match = rows(SHEETS.USERS).filter(function (row) {
    return String(row.username) === u &&
      String(row.password) === p &&
      String(row.is_active).toUpperCase() !== 'FALSE';
  })[0];

  if (!match) return { ok: false, error: 'Invalid credentials.' };

  var token = Utilities.getUuid();
  var expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  appendRow(SHEETS.SESSIONS, {
    token: token,
    username: match.username,
    role: match.role || 'learner',
    expires_at: expires.toISOString()
  });

  return {
    ok: true,
    token: token,
    username: match.username,
    role: match.role || 'learner',
    expires_at: expires.toISOString()
  };
}

function requireSession(token) {
  var t = String(token || '').trim();
  if (!t) throw new Error('Missing session token.');
  var session = rows(SHEETS.SESSIONS).filter(function (row) {
    return String(row.token) === t;
  })[0];
  if (!session) throw new Error('Invalid session.');
  if (isExpired(session.expires_at)) throw new Error('Session expired.');
  return session;
}

function requireAdmin(token) {
  var session = requireSession(token);
  if (String(session.role) !== 'admin') throw new Error('Admin access required.');
  return session;
}

function expireOldGrants() {
  rows(SHEETS.GRANTS).forEach(function (row) {
    if (String(row.status) === 'granted' && isExpired(row.expires_at)) {
      updateGrantRow(row.id, { status: 'expired', updated_at: nowIso() });
    }
  });
}

function activePolicies() {
  var map = {};
  rows(SHEETS.POLICIES).forEach(function (row) {
    map[String(row.card_id)] = row;
  });
  return map;
}

function getPermissions(session) {
  expireOldGrants();
  if (String(session.role) === 'admin') {
    return {
      ok: true,
      restricted_cards: [],
      granted_cards: CARD_IDS.slice()
    };
  }

  var policies = activePolicies();
  var restricted = CARD_IDS.filter(function (id) {
    var p = policies[id];
    return p && String(p.is_restricted).toUpperCase() === 'TRUE';
  });

  var granted = rows(SHEETS.GRANTS).filter(function (row) {
    return String(row.username) === String(session.username) &&
      String(row.status) === 'granted' &&
      !isExpired(row.expires_at);
  }).map(function (row) { return String(row.card_id); });

  return {
    ok: true,
    restricted_cards: restricted,
    granted_cards: granted
  };
}

function adminGetData(session) {
  expireOldGrants();
  return {
    ok: true,
    users: rows(SHEETS.USERS).map(function (u) {
      return { username: u.username, role: u.role, is_active: u.is_active };
    }),
    policies: rows(SHEETS.POLICIES),
    grants: rows(SHEETS.GRANTS)
  };
}

function adminSetPolicy(session, cardId, isRestricted, defaultExpiryDays) {
  var id = String(cardId || '');
  if (CARD_IDS.indexOf(id) === -1) return { ok: false, error: 'Unknown card_id' };

  var existing = rows(SHEETS.POLICIES).filter(function (r) { return String(r.card_id) === id; })[0];
  var payload = {
    card_id: id,
    is_restricted: isRestricted ? 'TRUE' : 'FALSE',
    default_expiry_days: Number(defaultExpiryDays) || 30,
    updated_by: session.username,
    updated_at: nowIso()
  };

  if (existing) {
    var sh = sheet(SHEETS.POLICIES);
    var values = sh.getDataRange().getValues();
    var headers = values[0];
    var cardCol = headers.indexOf('card_id');
    for (var r = 1; r < values.length; r += 1) {
      if (String(values[r][cardCol]) === id) {
        headers.forEach(function (h, c) {
          if (payload[h] !== undefined) sh.getRange(r + 1, c + 1).setValue(payload[h]);
        });
        break;
      }
    }
  } else {
    appendRow(SHEETS.POLICIES, payload);
  }
  return { ok: true };
}

function adminGrant(session, username, cardId, expiresAt, adminNotes) {
  var id = String(cardId || '');
  if (CARD_IDS.indexOf(id) === -1) return { ok: false, error: 'Unknown card_id' };
  var u = String(username || '').trim();
  if (!u) return { ok: false, error: 'Username required' };

  rows(SHEETS.GRANTS).forEach(function (row) {
    if (String(row.username) === u && String(row.card_id) === id && String(row.status) === 'granted') {
      updateGrantRow(row.id, { status: 'revoked', updated_at: nowIso() });
    }
  });

  appendRow(SHEETS.GRANTS, {
    id: Utilities.getUuid(),
    username: u,
    card_id: id,
    status: 'granted',
    expires_at: expiresAt || '',
    request_notes: '',
    admin_notes: adminNotes || '',
    granted_by: session.username,
    created_at: nowIso(),
    updated_at: nowIso(),
    reviewed_at: nowIso()
  });
  return { ok: true };
}

function adminRevoke(session, grantId) {
  if (!updateGrantRow(grantId, { status: 'revoked', updated_at: nowIso(), reviewed_at: nowIso() })) {
    return { ok: false, error: 'Grant not found' };
  }
  return { ok: true };
}

function adminExtend(session, grantId, expiresAt) {
  if (!updateGrantRow(grantId, { expires_at: expiresAt || '', updated_at: nowIso() })) {
    return { ok: false, error: 'Grant not found' };
  }
  return { ok: true };
}
