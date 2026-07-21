# Traininglobe Hub

Single login → three product cards (AI Tools Playbook, AI Ascent, Hands-on Practice).

**Intended GitHub Pages URL:** `https://biswajitchatterjee98.github.io/traininglobe-hub/`

## Accounts

| Username | Password | Role |
|----------|----------|------|
| `demo1` … `demo10` | `demo123` | learner |
| `Admin` | `Admin@123` | admin (cards + hub ACL) |

## Local open

```bash
cd traininglobe-hub
python3 -m http.server 8090
# http://localhost:8090
```

## Flow

1. Sign in on `index.html` (hub only).
2. `home.html` shows up to three cards (restricted cards need a grant / non-expired access).
3. **Playbook / Ascent / Hands-on** open as plain links — handbook login pages are removed/redirected. LMS login must be removed on the Vercel deploy by that team.

## Hands-on LMS prerequisite (you own this)

Remove or bypass the LMS login on the Vercel deploy so the Hands-on card lands inside the app. The hub cannot set a session on another origin. Do **not** put LMS passwords in this repo.

## Handbook note

AI Tools Playbook and AI Ascent no longer gate content behind their own login. Push those repos to GitHub Pages after pulling the auth changes, or cards will still hit the old published login.

## Admin ACL

- Open **Admin** after signing in as `Admin`.
- Restrict a card → only users with an active grant can open it.
- Grant with optional expiry (“time it”).
- Offline (`API_URL` empty): policies/grants live in browser `localStorage`.
- Optional Sheets API: see [`google-apps-script/README.md`](google-apps-script/README.md).

## Deploy hub to GitHub Pages

1. Create repo `traininglobe-hub` (or push this folder).
2. Enable Pages from `main` / root.
3. Point cohorts at the Pages URL (not the individual handbook logins).

Handbook SSO only works after the updated `auth.js` / `config.js` on Ascent and Playbook are also published to their Pages sites.
