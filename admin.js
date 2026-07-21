(function () {
  var state = { policies: {}, grants: [], users: [], selectedCard: null };

  var TITLES = {
    playbook: 'AI Tools Playbook',
    ascent: 'AI Ascent',
    'hands-on': 'Hands-on Practice'
  };

  function msg(text, isError) {
    var el = document.getElementById('admin-msg');
    el.textContent = text;
    el.classList.toggle('error', Boolean(isError));
    el.hidden = !text;
  }

  function cardTitle(id) {
    return TITLES[id] || id;
  }

  function policyFor(cardId) {
    return state.policies[cardId] || { is_restricted: false, default_expiry_days: 30 };
  }

  function timeLeft(expiresAt) {
    if (!expiresAt) return 'No expiry';
    var ms = new Date(expiresAt).getTime() - Date.now();
    if (ms <= 0) return 'Expired';
    var days = Math.floor(ms / 86400000);
    var hours = Math.floor((ms % 86400000) / 3600000);
    return days + 'd ' + hours + 'h';
  }

  function normalizePolicies(listOrMap) {
    var map = {};
    if (Array.isArray(listOrMap)) {
      listOrMap.forEach(function (p) {
        map[String(p.card_id)] = p;
      });
    } else if (listOrMap && typeof listOrMap === 'object') {
      map = listOrMap;
    }
    HubAccess.CARD_IDS.forEach(function (id) {
      if (!map[id]) map[id] = { card_id: id, is_restricted: false, default_expiry_days: 30 };
    });
    return map;
  }

  function loadData() {
    if (!HubApi.configured()) {
      var local = HubAccess.localAdminGetData();
      state.users = local.users || [];
      state.grants = local.grants || [];
      state.policies = normalizePolicies(local.policies);
      renderAll();
      msg('Using local storage for policies/grants. Set API_URL in config.js to persist in Google Sheets.', true);
      return Promise.resolve();
    }
    return HubApi.adminGetData(HubAuth.currentToken()).then(function (result) {
      if (!result.ok) {
        var fallback = HubAccess.localAdminGetData();
        state.users = fallback.users || [];
        state.grants = fallback.grants || [];
        state.policies = normalizePolicies(fallback.policies);
        renderAll();
        msg(result.error || 'API error — showing local data.', true);
        return;
      }
      state.users = result.users || [];
      state.grants = result.grants || [];
      state.policies = normalizePolicies(result.policies);
      renderAll();
      msg('');
    });
  }

  function renderTree() {
    var root = document.getElementById('card-tree');
    root.innerHTML = '';
    HubAccess.CARD_IDS.forEach(function (id) {
      var item = document.createElement('div');
      item.className = 'tree-item' + (state.selectedCard === id ? ' is-selected' : '');
      var restricted = String(policyFor(id).is_restricted).toUpperCase() === 'TRUE' || policyFor(id).is_restricted === true;
      item.innerHTML =
        '<div><div class="tree-title">' + cardTitle(id) + '</div>' +
        '<div class="tree-meta">' + id + '</div></div>' +
        (restricted ? '<span class="badge">Restricted</span>' : '');
      item.addEventListener('click', function () {
        state.selectedCard = id;
        document.getElementById('policy-card-id').value = id;
        document.getElementById('selected-card-label').textContent = cardTitle(id) + ' (' + id + ')';
        document.getElementById('policy-restricted').checked = restricted;
        document.getElementById('policy-expiry-days').value = policyFor(id).default_expiry_days || 30;
        renderTree();
      });
      root.appendChild(item);
    });
  }

  function renderUsers() {
    var select = document.getElementById('grant-username');
    select.innerHTML = '';
    state.users.filter(function (u) { return String(u.role) !== 'admin'; }).forEach(function (u) {
      var opt = document.createElement('option');
      opt.value = u.username;
      opt.textContent = u.username;
      select.appendChild(opt);
    });
  }

  function renderGrants() {
    var body = document.getElementById('grants-body');
    body.innerHTML = '';
    state.grants.filter(function (g) { return String(g.status) === 'granted'; }).forEach(function (g) {
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + g.username + '</td>' +
        '<td>' + cardTitle(g.card_id) + '</td>' +
        '<td>' + (g.expires_at || '—') + '</td>' +
        '<td>' + timeLeft(g.expires_at) + '</td>' +
        '<td>' + (g.granted_by || '') + '</td>' +
        '<td></td>';
      var actions = tr.lastChild;
      var revoke = document.createElement('button');
      revoke.type = 'button';
      revoke.className = 'btn btn-secondary';
      revoke.textContent = 'Revoke';
      revoke.addEventListener('click', function () {
        doRevoke(g.id);
      });
      var extend = document.createElement('button');
      extend.type = 'button';
      extend.className = 'btn btn-secondary';
      extend.style.marginLeft = '.35rem';
      extend.textContent = 'Extend +30d';
      extend.addEventListener('click', function () {
        var next = new Date(Date.now() + 30 * 86400000).toISOString();
        doExtend(g.id, next);
      });
      actions.appendChild(revoke);
      actions.appendChild(extend);
      body.appendChild(tr);
    });
  }

  function renderAll() {
    renderTree();
    renderUsers();
    renderGrants();
  }

  function doSetPolicy(cardId, isRestricted, days) {
    if (!HubApi.configured()) {
      HubAccess.localAdminSetPolicy(cardId, isRestricted, days);
      return loadData().then(function () { msg('Policy saved locally.'); });
    }
    return HubApi.adminSetPolicy(HubAuth.currentToken(), cardId, isRestricted, days).then(function (result) {
      if (!result.ok) {
        msg(result.error || 'Could not save policy.', true);
        return;
      }
      return loadData().then(function () { msg('Policy saved.'); });
    });
  }

  function doGrant(username, cardId, expiresAt, notes) {
    if (!HubApi.configured()) {
      HubAccess.localAdminGrant(username, cardId, expiresAt, notes);
      return loadData().then(function () { msg('Grant saved locally.'); });
    }
    return HubApi.adminGrant(HubAuth.currentToken(), username, cardId, expiresAt, notes).then(function (result) {
      if (!result.ok) {
        msg(result.error || 'Could not grant.', true);
        return;
      }
      return loadData().then(function () { msg('Grant saved.'); });
    });
  }

  function doRevoke(grantId) {
    if (!HubApi.configured()) {
      HubAccess.localAdminRevoke(grantId);
      return loadData().then(function () { msg('Revoked locally.'); });
    }
    return HubApi.adminRevoke(HubAuth.currentToken(), grantId).then(function (result) {
      if (!result.ok) {
        msg(result.error || 'Could not revoke.', true);
        return;
      }
      return loadData().then(function () { msg('Revoked.'); });
    });
  }

  function doExtend(grantId, expiresAt) {
    if (!HubApi.configured()) {
      HubAccess.localAdminExtend(grantId, expiresAt);
      return loadData().then(function () { msg('Extended locally.'); });
    }
    return HubApi.adminExtend(HubAuth.currentToken(), grantId, expiresAt).then(function (result) {
      if (!result.ok) {
        msg(result.error || 'Could not extend.', true);
        return;
      }
      return loadData().then(function () { msg('Extended.'); });
    });
  }

  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (t) { t.classList.remove('is-active'); });
      tab.classList.add('is-active');
      var name = tab.getAttribute('data-tab');
      document.querySelectorAll('[data-panel]').forEach(function (panel) {
        panel.hidden = panel.getAttribute('data-panel') !== name;
      });
    });
  });

  document.getElementById('policy-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var cardId = document.getElementById('policy-card-id').value;
    if (!cardId) {
      msg('Select a card first.', true);
      return;
    }
    doSetPolicy(
      cardId,
      document.getElementById('policy-restricted').checked,
      document.getElementById('policy-expiry-days').value
    );
  });

  document.getElementById('manual-grant-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var cardId = document.getElementById('policy-card-id').value || state.selectedCard;
    if (!cardId) {
      msg('Select a card first.', true);
      return;
    }
    var username = document.getElementById('grant-username').value;
    var local = document.getElementById('grant-expires').value;
    var expiresAt = local ? new Date(local).toISOString() : '';
    if (!expiresAt) {
      var days = Number(document.getElementById('policy-expiry-days').value) || 30;
      var policy = policyFor(cardId);
      if (policy.is_restricted === true || String(policy.is_restricted).toUpperCase() === 'TRUE') {
        expiresAt = new Date(Date.now() + days * 86400000).toISOString();
      }
    }
    doGrant(username, cardId, expiresAt, document.getElementById('grant-notes').value);
  });

  loadData();
})();
