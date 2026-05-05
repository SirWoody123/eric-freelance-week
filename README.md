# ERIC Freelance Week — Analytics Dashboard

A self-contained, single-file analytics dashboard hosted on GitHub Pages. No build tools, no frameworks, no server — just vanilla HTML/CSS/JS.

---

## File overview

```
eric-freelance-week/
├── index.html                          ← The dashboard (deploy this to GitHub Pages)
├── README.md                           ← This file
└── google-apps-script/
    ├── sheets-proxy.gs                 ← Apps Script: reads FW Registrations sheet → JSON
    └── ga4-proxy.gs                    ← Apps Script: calls GA4 Data API → JSON
```

---

## Step 1 — Deploy the Sheets proxy

1. Open [script.google.com](https://script.google.com) and create a **New project**.
2. Paste the contents of `google-apps-script/sheets-proxy.gs` into the editor.
3. Make sure the script is **bound to your Google Sheet**, or open the spreadsheet and go to **Extensions → Apps Script** to create it there (it will auto-bind).
4. Click **Deploy → New deployment**.
   - Type: **Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
5. Click **Deploy**, authorise when prompted, then copy the **Web app URL**.

> The sheet tab must be named exactly **`FW Registrations`** with the column headers in row 1 matching the spec (Date, Time, Name, Email, Type, Age, Career Stage, Industries, Postcode, Days Interested, Institution, Role, Inst Postcode, Inst Type, Student Count, Source, Timestamp).

---

## Step 2 — Deploy the GA4 proxy

1. Open [script.google.com](https://script.google.com) and create another **New project** (separate from the Sheets one).
2. Paste the contents of `google-apps-script/ga4-proxy.gs`.
3. **Enable the GA4 Data API service**:
   - In the left sidebar click **+** next to *Services*
   - Find **Google Analytics Data API** and click **Add**
4. Set your GA4 property ID at the top of the script:
   ```js
   var GA4_PROPERTY_ID = '123456789'; // your numeric property ID
   ```
   Find this in GA4 → Admin → Property Settings → Property ID.
5. Make sure the Google account running the script has at least **Viewer** access to the GA4 property (GA4 → Admin → Property Access Management).
6. Deploy as a Web app with the same settings as above. Copy the **Web app URL**.

---

## Step 3 — Paste the URLs into index.html

Open `index.html` and find the `CONFIG` block near the bottom of the file:

```js
const CONFIG = {
  SHEETS_URL: '',   // ← paste your Sheets proxy URL here
  GA4_URL:    '',   // ← paste your GA4 proxy URL here
  REFRESH_INTERVAL_MS: 5 * 60 * 1000,
};
```

Example:

```js
const CONFIG = {
  SHEETS_URL: 'https://script.google.com/macros/s/AKfycb.../exec',
  GA4_URL:    'https://script.google.com/macros/s/AKfycb.../exec',
  REFRESH_INTERVAL_MS: 5 * 60 * 1000,
};
```

---

## Step 4 — Publish to GitHub Pages

1. Create a new GitHub repository (public).
2. Push `index.html` (and optionally the rest of the files) to the repo.
3. Go to **Settings → Pages → Source** and select `main` branch, `/ (root)`.
4. GitHub Pages will publish the dashboard at `https://<your-username>.github.io/<repo-name>/`.

> Only `index.html` needs to be in the root. The `google-apps-script/` folder is just for version control — it's not served.

---

## How it works

```
Browser (GitHub Pages)
  │
  ├─ fetch(CONFIG.SHEETS_URL) ──→ Apps Script Web App ──→ Google Sheets
  │                                  (sheets-proxy.gs)         │
  │                                                      returns JSON:
  │                                                      { registrations[], industries[] }
  │
  └─ fetch(CONFIG.GA4_URL) ────→ Apps Script Web App ──→ GA4 Data API
                                    (ga4-proxy.gs)            │
                                                       returns JSON:
                                                       { pageViews, users, sessions[], … }
```

No API keys are ever exposed in the HTML. The Apps Script Web Apps act as authenticated proxies — they run under your Google account and pass data back as anonymous JSON.

---

## Demo mode

If either URL is empty or the fetch fails, the dashboard automatically falls back to built-in placeholder data so the page always looks good. A banner at the top indicates when demo data is active.

---

## Customisation tips

| What | Where |
|---|---|
| Event dates | `DATE_START` / `DATE_END` in `ga4-proxy.gs` |
| Max rows fetched from Sheet | `MAX_ROWS` in `sheets-proxy.gs` |
| Auto-refresh interval | `CONFIG.REFRESH_INTERVAL_MS` in `index.html` |
| Colour accents | CSS custom properties / hex codes in `<style>` block |
| Table row limit | `slice(0, 20)` in `populateTable()` |

---

## Troubleshooting

**Dashboard shows demo data even after pasting URLs**
- Open your browser console. Look for fetch errors.
- Make sure both Web Apps are deployed with **Who has access: Anyone**.
- Re-deploy after any code change — Apps Script caches old versions.

**GA4 proxy throws an error about the service**
- Confirm you added the *Google Analytics Data API* service in the Apps Script editor.
- Confirm your numeric `GA4_PROPERTY_ID` is correct (no `properties/` prefix).

**Sheet data is empty**
- Check the tab name is exactly `FW Registrations` (case-sensitive).
- Ensure the script is bound to the correct spreadsheet.
