(function (global) {
  var SESSION_KEY = 'traininglobe_hub_session';

  var LOCAL_USERS = [
    { username: 'Admin', password: 'Admin@123', role: 'admin' },
    { username: 'demo1', password: 'demo123', role: 'learner' },
    { username: 'demo2', password: 'demo123', role: 'learner' },
    { username: 'demo3', password: 'demo123', role: 'learner' },
    { username: 'demo4', password: 'demo123', role: 'learner' },
    { username: 'demo5', password: 'demo123', role: 'learner' },
    { username: 'demo6', password: 'demo123', role: 'learner' },
    { username: 'demo7', password: 'demo123', role: 'learner' },
    { username: 'demo8', password: 'demo123', role: 'learner' },
    { username: 'demo9', password: 'demo123', role: 'learner' },
    { username: 'demo10', password: 'demo123', role: 'learner' }
  ];

  function readSession() {
    try {
      var raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function writeSession(data) {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(data));
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  function currentUser() {
    var session = readSession();
    return session && session.username ? session.username : null;
  }

  function currentRole() {
    var session = readSession();
    if (session && session.role) return session.role;
    if (session && String(session.username).toLowerCase() === 'admin') return 'admin';
    return 'learner';
  }

  function currentToken() {
    var session = readSession();
    return session && session.token ? session.token : null;
  }

  function isLoggedIn() {
    return Boolean(currentToken() && currentUser());
  }

  function isAdmin() {
    return currentRole() === 'admin' && String(currentUser()).toLowerCase() === 'admin';
  }

  function loginLocalFallback(username, password) {
    // ponytail: offline/demo fallback when API_URL is not set yet.
    var u = String(username || '').trim();
    var p = String(password || '').trim();
    for (var i = 0; i < LOCAL_USERS.length; i += 1) {
      if (LOCAL_USERS[i].username === u && LOCAL_USERS[i].password === p) {
        writeSession({
          username: LOCAL_USERS[i].username,
          role: LOCAL_USERS[i].role,
          token: 'local-' + LOCAL_USERS[i].username,
          expires_at: new Date(Date.now() + 86400000).toISOString()
        });
        return Promise.resolve({
          ok: true,
          username: LOCAL_USERS[i].username,
          role: LOCAL_USERS[i].role
        });
      }
    }
    return Promise.resolve({ ok: false, error: 'Invalid username or password.' });
  }

  function login(username, password) {
    if (!global.HubApi || !global.HubApi.configured()) {
      return loginLocalFallback(username, password);
    }
    return global.HubApi.login(username, password).then(function (result) {
      if (!result.ok) return result;
      writeSession({
        username: result.username,
        role: result.role,
        token: result.token,
        expires_at: result.expires_at
      });
      return result;
    });
  }

  function logout() {
    clearSession();
  }

  function requireAuth(loginPage) {
    if (isLoggedIn()) return true;
    location.replace(loginPage || 'index.html');
    return false;
  }

  function requireGuest(homePage) {
    if (!isLoggedIn()) return true;
    location.replace(homePage || 'home.html');
    return false;
  }

  function requireAdmin(loginPage) {
    requireAuth(loginPage);
    if (!isAdmin()) location.replace('home.html');
  }

  function mintCardToken() {
    var secret = (global.HubConfig && global.HubConfig.HUB_SSO_SECRET) || '';
    var hours = (global.HubConfig && global.HubConfig.HUB_SSO_HOURS) || 12;
    if (!global.HubSso || !secret || !isLoggedIn()) return '';
    return global.HubSso.mint(currentUser(), currentRole(), secret, hours);
  }

  global.HubAuth = {
    USERS: LOCAL_USERS,
    login: login,
    logout: logout,
    isLoggedIn: isLoggedIn,
    isAdmin: isAdmin,
    currentUser: currentUser,
    currentRole: currentRole,
    currentToken: currentToken,
    requireAuth: requireAuth,
    requireGuest: requireGuest,
    requireAdmin: requireAdmin,
    mintCardToken: mintCardToken,
    getSession: readSession
  };
})(window);
