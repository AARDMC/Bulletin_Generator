import re, pathlib

API_URL = "PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE"
API_TOKEN = ""   # optional, must match Script Property API_TOKEN

def sub(pattern, repl, text, flags=re.S):
    new, n = re.subn(pattern, lambda m: m.expand(repl) if '\\' in repl else repl, text, count=1, flags=flags)
    if n != 1:
        raise SystemExit("PATTERN NOT FOUND: " + pattern[:70])
    return new

# ---------------- HTML ----------------
h = pathlib.Path("originals/Bulletin.html").read_text(encoding="utf-8")

# 1) data placeholder -> API client
h = h.replace("let D = <?!= D ?>;", f"""let D = null;
const API_URL = '{API_URL}';
const API_TOKEN = '{API_TOKEN}';
function callApi(year, week, sub, wor, refresh, assets) {{
  const q = new URLSearchParams({{ api: 1, year: year || 0, week: week || 0,
    subcity: sub || '', woreda: wor || '', refresh: refresh ? 1 : 0,
    assets: assets ? 1 : 0, token: API_TOKEN }});
  return fetch(API_URL + '?' + q.toString()).then(r => r.json());
}}""", 1)
assert "callApi" in h

# 2) applyFilters
h = sub(r"google\.script\.run\s*\.withSuccessHandler\(res => \{(.*?)\}\)\s*"
        r"\.withFailureHandler\(err => \{ ld\.classList\.remove\('on'\); showErr\('Call failed: ' \+ err\.message\); \}\)\s*"
        r"\.getBulletin\(year, week, subcity, woreda, !!refresh\);",
        "callApi(year, week, subcity, woreda, !!refresh, false).then(res => {\\1})"
        ".catch(err => { ld.classList.remove('on'); showErr('Call failed: ' + err.message); });", h)

# 3) onYearChange
h = sub(r"google\.script\.run\.withSuccessHandler\(res => \{(.*?)\}\)\.getBulletin\(year, 0, '', '', false\);",
        "callApi(year, 0, '', '', false, false).then(res => {\\1})"
        ".catch(e => showErr('Year load failed: ' + e.message));", h)

# 4) bootstrap
h = sub(r"try \{\n  if \(!D \|\| !D\.meta\).*?catch \(e\) \{ showErr\('Render error: ' \+ e\.message\); \}",
        """(function boot() {
  const ld = document.getElementById('loading'); ld.classList.add('on');
  callApi(0, 0, '', '', false, true).then(res => {
    ld.classList.remove('on');
    if (!res || !res.ok) { showErr('Server: ' + (res && res.error || 'unknown')); return; }
    D = res.data;
    try { render(); populateFilters(); } catch (e) { showErr('Render error: ' + e.message); }
  }).catch(e => { ld.classList.remove('on'); showErr('Load failed: ' + e.message); });
})();""", h)

assert "google.script" not in h
pathlib.Path("docs").mkdir(exist_ok=True)
pathlib.Path("docs/index.html").write_text(h, encoding="utf-8")

# ---------------- Code.gs ----------------
g = pathlib.Path("originals/Code.gs").read_text(encoding="utf-8")
g = g.replace("function doGet(e) {", """function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.api === '1') {
    const out = o => ContentService.createTextOutput(JSON.stringify(o))
      .setMimeType(ContentService.MimeType.JSON);
    try {
      const tok = PropertiesService.getScriptProperties().getProperty('API_TOKEN');
      if (tok && p.token !== tok) return out({ ok: false, error: 'Unauthorized' });
      const year = +p.year || CFG.currentYear;
      if (p.refresh === '1') refreshCache_(year);
      const data = buildData_(year, +p.week || 0,
        { subcity: p.subcity || '', woreda: p.woreda || '' }, p.assets === '1');
      return out({ ok: true, data: data });
    } catch (err) { return out({ ok: false, error: err.message }); }
  }
  return doGetPage_(e);
}
function doGetPage_(e) {""", 1)
pathlib.Path("apps-script").mkdir(exist_ok=True)
pathlib.Path("apps-script/Code.gs").write_text(g, encoding="utf-8")
print("Done: docs/index.html and apps-script/Code.gs")
