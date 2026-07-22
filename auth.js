(function (global) {
  var SESSION_KEY = 'traininglobe_hub_session';

  var LOCAL_USERS = [
    { username: 'Admin', password: 'Admin@123', name: 'Admin', role: 'admin' },
    { username: 'juma.almughairi@opaloman.org', password: 'Juma@123#', name: 'Juma', role: 'learner' },
    { username: 'marwan.zadjali@db.om', password: 'Marwan@123#', name: 'Marwan', role: 'learner' },
    { username: 'abeer.balushi@db.om', password: 'Abeer@123#', name: 'Abeer', role: 'learner' },
    { username: 'f.houti@db.om', password: 'Faisal@123#', name: 'Faisal', role: 'learner' },
    { username: 'nsalsaadi@sai.gov.om', password: 'Nasser@123#', name: 'Nasser', role: 'learner' },
    { username: 'Nasser.ALMukhaini@duqm.gov.om', password: 'Nasser@123#', name: 'Nasser', role: 'learner' },
    { username: 'Ilham.Alharthy@tashgheel.om', password: 'Ilham@123#', name: 'Ilham', role: 'learner' },
    { username: 'halaghbari@gccstat.org', password: 'Hamad@123#', name: 'Hamad', role: 'learner' },
    { username: 'ialfarai@gccstat.org', password: 'Ibrahim@123#', name: 'Ibrahim', role: 'learner' },
    { username: 'Salrumhi@gccstat.org', password: 'Sheikhan@123#', name: 'Sheikhan', role: 'learner' },
    { username: 'Nalghanami@gccstat.org', password: 'Najat@123#', name: 'Najat', role: 'learner' },
    { username: 'salamah@taageer.com', password: 'Salamah@123#', name: 'Salamah', role: 'learner' },
    { username: 'afrah.al-ajmi@taageer.com', password: 'Afrah@123#', name: 'Afrah', role: 'learner' },
    { username: 'buthaina.al-balushi@taageer.com', password: 'Buthaina@123#', name: 'Buthaina', role: 'learner' },
    { username: 'zamzam@oaaaqa.gov.om', password: 'Zamzam@123#', name: 'Zamzam', role: 'learner' },
    { username: 'ahmed.allawati@oaaaqa.gov.om', password: 'Ahmed@123#', name: 'Ahmed', role: 'learner' },
    { username: 'salrashdi@oaaaqa.gov.om', password: 'Samar@123#', name: 'Samar', role: 'learner' },
    { username: 'saidf@oaaaqa.gov.om', password: 'Said@123#', name: 'Said', role: 'learner' },
    { username: 'reemm@oaaaqa.gov.om', password: 'Reem@123#', name: 'Reem', role: 'learner' },
    { username: 'alhusain.alkazruni@oaaaqa.gov.om', password: 'Hussein@123#', name: 'Hussein', role: 'learner' },
    { username: 'Omar.AlMukhaini@rop.gov.om', password: 'Omar@123#', name: 'Omar', role: 'learner' },
    { username: 'ghaida.s.almamari@gmail.com', password: 'Ghaida@123#', name: 'Ghaida', role: 'learner' },
    { username: 'Nabeel.h.albalushi@gmail.com', password: 'Nabeel@123#', name: 'Nabeel', role: 'learner' },
    { username: 'maram@mrblawfirm.com', password: 'Maram@123#', name: 'Maram', role: 'learner' }
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

  function currentName() {
    var session = readSession();
    if (session && session.name) return session.name;
    var user = currentUser();
    if (!user) return null;
    for (var i = 0; i < LOCAL_USERS.length; i += 1) {
      if (String(LOCAL_USERS[i].username).toLowerCase() === String(user).toLowerCase()) {
        return LOCAL_USERS[i].name || user;
      }
    }
    return user;
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
    var uLower = u.toLowerCase();
    for (var i = 0; i < LOCAL_USERS.length; i += 1) {
      if (String(LOCAL_USERS[i].username).toLowerCase() === uLower && LOCAL_USERS[i].password === p) {
        writeSession({
          username: LOCAL_USERS[i].username,
          name: LOCAL_USERS[i].name || LOCAL_USERS[i].username,
          role: LOCAL_USERS[i].role,
          token: 'local-' + LOCAL_USERS[i].username,
          expires_at: new Date(Date.now() + 86400000).toISOString()
        });
        return Promise.resolve({
          ok: true,
          username: LOCAL_USERS[i].username,
          name: LOCAL_USERS[i].name || LOCAL_USERS[i].username,
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
      var local = null;
      for (var i = 0; i < LOCAL_USERS.length; i += 1) {
        if (String(LOCAL_USERS[i].username).toLowerCase() === String(result.username).toLowerCase()) {
          local = LOCAL_USERS[i];
          break;
        }
      }
      writeSession({
        username: result.username,
        name: (local && local.name) || result.name || result.username,
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
    currentName: currentName,
    currentRole: currentRole,
    currentToken: currentToken,
    requireAuth: requireAuth,
    requireGuest: requireGuest,
    requireAdmin: requireAdmin,
    mintCardToken: mintCardToken,
    getSession: readSession
  };
})(window);
