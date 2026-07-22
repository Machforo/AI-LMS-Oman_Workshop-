# Deploy the Traininglobe Hub Access API

## 1. Create the Google Sheet

1. Create a blank spreadsheet named **Traininglobe Hub Access**.
2. **Extensions → Apps Script**, paste `Code.gs`, save.

## 2. Initialize sheets

1. Run **`setupSheets`** once and approve permissions.
2. Tabs: **Users**, **CardPolicies**, **AccessGrants**, **Sessions** (seeded with Admin + Muscat cohort emails).

## 3. Deploy as Web App

1. **Deploy → New deployment → Web app**
2. **Execute as:** Me
3. **Who has access:** Anyone
4. Copy the `/exec` URL into hub `config.js` as `API_URL`.

Until `API_URL` is set, the hub stores policies/grants in browser `localStorage` (offline admin).
