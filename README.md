# AACAHB Weekly Epidemiological Bulletin Generator

Interactive weekly epi bulletin for the Addis Ababa City Administration Health Bureau (AACAHB / APHREM). It reads IDSR, CEBS and MPDSR data from Google Sheets and Drive, and produces a 6-page bulletin with KPIs, outbreak maps, disease trends and timeliness/completeness charts. It exports to **PDF** and **editable PowerPoint (PPTX)**.

**Live site:** https://aardmc.github.io/Bulletin_Generator/

## Architecture

```
GitHub Pages (static front-end)  ──fetch (?api=1)──▶  Google Apps Script web app  ──▶  Google Sheets + Drive
        index.html                                          Code.gs                     (IDSR data, GeoJSON,
                                                                                         logo, icons)
```

- **Front-end (`index.html`)** renders the bulletin in the browser using Chart.js and PptxGenJS (both loaded from a CDN).
- **Back-end (`Code.gs`)** reads and aggregates the data, caches it, and returns JSON when called with `?api=1`.
- Opening the Apps Script URL without `?api=1` still serves the original Apps Script page (needs `Bulletin.html` in the Apps Script project).

## Repository structure

```
Bulletin_Generator/
├─ index.html          # Front-end (serve from root, or place in /docs)
├─ apps-script/
│  └─ Code.gs          # Back-end copy (the live copy lives in Apps Script)
└─ README.md
```

## Setup

### 1. Back-end (Google Apps Script)

1. Open your Apps Script project and paste in `Code.gs`.
2. Keep your existing `Bulletin.html` in the project (fallback page).
3. Update the `CFG` block with your sheet, GeoJSON, logo and icon-folder IDs.
4. Optional: run `buildHistorySummary()` once (historical years), then `prebuild()` and `installTriggers()` (3-hourly cache rebuild and Monday email).
5. **Deploy → New deployment → Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
6. Copy the `/exec` URL.
7. Optional but recommended: **Project Settings → Script properties** → add `API_TOKEN` with a long random value.

### 2. Front-end

In `index.html`, set:

```js
const API_URL = 'https://script.google.com/macros/s/XXXX/exec';
const API_TOKEN = '';   // same value as the API_TOKEN script property, or empty
```

### 3. Publish with GitHub Pages

1. Commit `index.html` to the repository.
2. **Settings → Pages → Branch: `main`**, folder `/ (root)` (or `/docs` if you put the file there) → **Save**.
3. Open https://aardmc.github.io/Bulletin_Generator/ after about a minute.

## Using the bulletin

- Filters: **Sub City**, **Woreda**, **Year**, **Epi Week**, **Layout** (Landscape / Portrait / Full Screen).
- **Apply** loads the selection, **Reset** returns to the latest week, **Refresh** rebuilds the server cache.
- **Export → As PDF** uses the browser print dialog (choose "Save as PDF", margins none, background graphics on).
- **Export → As PPT** downloads native, editable slides (charts, tables and text boxes). Landscape gives 16:9 slides.

## Updating

| Change | What to do |
|---|---|
| Front-end change | Edit `index.html`, commit. Pages redeploys automatically. |
| Back-end change | Edit `Code.gs` in Apps Script, then **Deploy → Manage deployments → Edit → New version**. The `/exec` URL stays the same. |
| New weekly data | Add rows to the source sheet, then press **Refresh** (or wait for the 3-hourly trigger). |
| Narrative text, contributors, links | Edit the `Manual` sheet (keys such as `weekly_alert`, `contributors`, `sources`, `feedback_url`). |

## Troubleshooting

Open the browser console (F12).

| Symptom | Cause / fix |
|---|---|
| `Unauthorized` | `API_TOKEN` in `index.html` does not match the script property. |
| CORS error or blank page | Deployment access is not **Anyone**, or `API_URL` is wrong. |
| Old data after editing `Code.gs` | Create a new deployment version. |
| Map missing or "GeoJSON could not be matched" | Run `diagnoseGeo()` in Apps Script and check the name properties. |
| Hospital in the wrong sub-city | Run `diagnoseHospitals()` and review `HOSPITAL_LOC`. |
| Slow first load | The first request includes the logo, icons and GeoJSON as base64. |

## Security and privacy

- The `/exec` URL and token are visible in `index.html`, so anyone with the page can request the same data. The token only deters casual scraping.
- Do not expose patient-level or identifiable data. This app should use aggregated counts only.
- For restricted access, use a private repository (GitHub Pages on private repos needs a paid plan) or place the site behind authentication.

## Credits

Designed by the Addis Ababa City Data Management Center for Health. Outbreak thresholds follow the PHEM Guideline (2nd ed., December 2022).
