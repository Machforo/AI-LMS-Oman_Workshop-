(function (global) {
  var GRANTS_KEY = 'traininglobe_hub_grants';
  var POLICIES_KEY = 'traininglobe_hub_policies';

  var CARD_IDS = ['playbook', 'ascent', 'hands-on'];

  function isLocalToken() {
    var token = global.HubAuth.currentToken();
    return token && String(token).indexOf('local-') === 0;
  }

  function readLocalJson(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (err) {
      return fallback;
    }
  }

  function writeLocalJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function defaultPolicies() {
    var out = {};
    CARD_IDS.forEach(function (id) {
      out[id] = { card_id: id, is_restricted: false, default_expiry_days: 30 };
    });
    return out;
  }

  function loadLocalState() {
    var policies = readLocalJson(POLICIES_KEY, null);
    if (!policies) {
      policies = defaultPolicies();
      writeLocalJson(POLICIES_KEY, policies);
    }
    var grants = readLocalJson(GRANTS_KEY, []);
    return { policies: policies, grants: grants };
  }

  function saveLocalState(policies, grants) {
    writeLocalJson(POLICIES_KEY, policies);
    writeLocalJson(GRANTS_KEY, grants);
  }

  function isExpired(expiresAt) {
    if (!expiresAt) return false;
    var t = new Date(expiresAt).getTime();
    return !isNaN(t) && t <= Date.now();
  }

  function permissionsFromLocal(username) {
    var state = loadLocalState();
    var restricted = [];
    var granted = [];
    CARD_IDS.forEach(function (cardId) {
      var policy = state.policies[cardId] || { is_restricted: false };
      var restrictedFlag = policy.is_restricted === true || String(policy.is_restricted).toUpperCase() === 'TRUE';
      if (restrictedFlag) restricted.push(cardId);
      var hit = state.grants.filter(function (g) {
        return String(g.username) === username &&
          String(g.card_id) === cardId &&
          String(g.status) === 'granted' &&
          !isExpired(g.expires_at);
      })[0];
      if (hit) granted.push(cardId);
    });
    return {
      ok: true,
      restricted_cards: restricted,
      granted_cards: granted,
      policies: state.policies,
      grants: state.grants
    };
  }

  function loadPermissions() {
    if (global.HubAuth.isAdmin()) {
      return Promise.resolve({
        ok: true,
        restricted_cards: [],
        granted_cards: CARD_IDS.slice(),
        policies: loadLocalState().policies,
        grants: loadLocalState().grants
      });
    }
    if (!global.HubApi || !global.HubApi.configured() || isLocalToken()) {
      return Promise.resolve(permissionsFromLocal(global.HubAuth.currentUser()));
    }
    return global.HubApi.permissions(global.HubAuth.currentToken()).then(function (result) {
      if (!result.ok) return permissionsFromLocal(global.HubAuth.currentUser());
      return result;
    });
  }

  function canOpenCard(cardId, permissions) {
    if (global.HubAuth.isAdmin()) return true;
    var restricted = permissions.restricted_cards || [];
    var granted = permissions.granted_cards || [];
    if (restricted.indexOf(cardId) === -1) return true;
    return granted.indexOf(cardId) !== -1;
  }

  function cardDestinationUrl(cardId) {
    var cards = (global.HubConfig && global.HubConfig.CARDS) || {};
    var card = cards[cardId];
    if (!card) return '';
    if (!card.sso) return card.url;
    var token = global.HubAuth.mintCardToken();
    if (!token) return card.url;
    var join = card.url.indexOf('?') === -1 ? '?' : '&';
    return card.url + join + 'hub_token=' + encodeURIComponent(token);
  }

  function openCard(cardId) {
    return loadPermissions().then(function (perms) {
      if (!canOpenCard(cardId, perms)) {
        return { ok: false, error: 'You do not have access to this card (restricted or expired).' };
      }
      var url = cardDestinationUrl(cardId);
      if (!url) return { ok: false, error: 'Unknown card.' };
      window.location.assign(url);
      return { ok: true };
    });
  }

  // --- local admin helpers (when API_URL empty) ---

  function localAdminGetData() {
    var state = loadLocalState();
    var users = (global.HubAuth.USERS || []).filter(function (u) {
      return u.role !== 'admin';
    });
    return {
      ok: true,
      users: users,
      policies: CARD_IDS.map(function (id) {
        return state.policies[id] || { card_id: id, is_restricted: false, default_expiry_days: 30 };
      }),
      grants: state.grants
    };
  }

  function localAdminSetPolicy(cardId, isRestricted, defaultExpiryDays) {
    var state = loadLocalState();
    state.policies[cardId] = {
      card_id: cardId,
      is_restricted: Boolean(isRestricted),
      default_expiry_days: Number(defaultExpiryDays) || 30,
      updated_at: new Date().toISOString()
    };
    saveLocalState(state.policies, state.grants);
    return { ok: true };
  }

  function localAdminGrant(username, cardId, expiresAt, adminNotes) {
    var state = loadLocalState();
    state.grants = state.grants.filter(function (g) {
      return !(String(g.username) === username && String(g.card_id) === cardId && String(g.status) === 'granted');
    });
    state.grants.push({
      id: 'g-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      username: username,
      card_id: cardId,
      status: 'granted',
      expires_at: expiresAt || '',
      admin_notes: adminNotes || '',
      granted_by: global.HubAuth.currentUser(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    saveLocalState(state.policies, state.grants);
    return { ok: true };
  }

  function localAdminRevoke(grantId) {
    var state = loadLocalState();
    state.grants = state.grants.map(function (g) {
      if (String(g.id) !== String(grantId)) return g;
      return Object.assign({}, g, { status: 'revoked', updated_at: new Date().toISOString() });
    });
    saveLocalState(state.policies, state.grants);
    return { ok: true };
  }

  function localAdminExtend(grantId, expiresAt) {
    var state = loadLocalState();
    state.grants = state.grants.map(function (g) {
      if (String(g.id) !== String(grantId)) return g;
      return Object.assign({}, g, { expires_at: expiresAt || '', updated_at: new Date().toISOString() });
    });
    saveLocalState(state.policies, state.grants);
    return { ok: true };
  }

  global.HubAccess = {
    CARD_IDS: CARD_IDS,
    loadPermissions: loadPermissions,
    canOpenCard: canOpenCard,
    openCard: openCard,
    cardDestinationUrl: cardDestinationUrl,
    localAdminGetData: localAdminGetData,
    localAdminSetPolicy: localAdminSetPolicy,
    localAdminGrant: localAdminGrant,
    localAdminRevoke: localAdminRevoke,
    localAdminExtend: localAdminExtend,
    loadLocalState: loadLocalState
  };
})(window);
