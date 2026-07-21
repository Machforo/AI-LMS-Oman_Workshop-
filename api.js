(function (global) {
  function apiUrl() {
    return (global.HubConfig && global.HubConfig.API_URL) || '';
  }

  function apiConfigured() {
    return Boolean(apiUrl());
  }

  function callApi(payload) {
    var url = apiUrl();
    if (!url) {
      return Promise.resolve({ ok: false, error: 'API_URL is not configured in config.js' });
    }
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (response) {
      return response.json();
    }).catch(function (err) {
      return { ok: false, error: String(err.message || err) };
    });
  }

  global.HubApi = {
    configured: apiConfigured,
    login: function (username, password) {
      return callApi({ action: 'login', username: username, password: password });
    },
    permissions: function (token) {
      return callApi({ action: 'permissions', token: token });
    },
    adminGetData: function (token) {
      return callApi({ action: 'adminGetData', token: token });
    },
    adminSetPolicy: function (token, cardId, isRestricted, defaultExpiryDays) {
      return callApi({
        action: 'adminSetPolicy',
        token: token,
        card_id: cardId,
        is_restricted: isRestricted,
        default_expiry_days: defaultExpiryDays
      });
    },
    adminGrant: function (token, username, cardId, expiresAt, adminNotes) {
      return callApi({
        action: 'adminGrant',
        token: token,
        username: username,
        card_id: cardId,
        expires_at: expiresAt || '',
        admin_notes: adminNotes || ''
      });
    },
    adminRevoke: function (token, grantId) {
      return callApi({ action: 'adminRevoke', token: token, grant_id: grantId });
    },
    adminExtend: function (token, grantId, expiresAt) {
      return callApi({ action: 'adminExtend', token: token, grant_id: grantId, expires_at: expiresAt });
    }
  };
})(window);
