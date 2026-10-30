/**
 * AACAHB / APHREM Weekly Epi Bulletin — Addis Ababa IDSR (wide format)
 *
 * ONE-TIME SETUP
 *   buildHistorySummary()  → epi_history_summary.json (per Sub-City)
 *   prebuild()             → warms epi_year_<year>.json + GeoJSON caches
 *   diagnoseGeo()          → logs which names match / do not match the GeoJSON
 *   diagnoseHospitals()    → confirms all 14 public hospitals have correct location
 *   installTriggers()      → 3-hourly cache rebuild + Monday email
 *
 * GITHUB PAGES MODE
 *   doGet() returns JSON when called with ?api=1 (used by docs/index.html).
 *   Optional Script Property API_TOKEN: if set, requests must pass ?token=...
 */
const CFG = {
  histCsvId:      '1JAOtWf_cg1wWUBy3DkEG5I0JZND4lBAc',
  currentSheetId: '1yUKNSoMFKyOa9WSMVt1ucmndXE9uveigVnvKzOT3wck',
  currentYear:    2026,

  subcityGeoId:      '1MHezY_kdcWhO723gCfmGg3k3ID7trnwt',
  woredaGeoId:       '1rSldbypbmJVTMwc7JfkT--KSrAAhVZYZ',
  subcityGeoNameProp:'AllSubcity_georef',
  woredaGeoNameProp: 'AllWoreda_georef',

  logoId:        '1770mO4Tj7Iz43yy0TrgHwKAF8F5jUyXf',
  iconsFolderId: '1Fjlbqas9pR367UuvcgQo9SVreIdA5dFE',
  trendYears:    4,
  emailTo:       '',

  subcities: ['Addis Ketema','Akaki Kality','Arada','Bole','Gulele','Kirkos',
              'Kolfe Keranyo','Lemi Kura','Lideta','Nifas Silk Lafto','Yeka'],

  subAliases: {
    'Addis Ketema':     ['addisketema','addisketemaa','addiskitema'],
    'Akaki Kality':     ['akakikality','akakikaliti','akakikalit'],
    'Arada':            ['arada','aradaa'],
    'Bole':             ['bole'],
    'Gulele':           ['gulele','gullele'],
    'Kirkos':           ['kirkos','kirkoss','kirkus'],
    'Kolfe Keranyo':    ['kolfekeranyo','kolfekeranio','kolfekeraniyo','kolfekerania'],
    'Lemi Kura':        ['lemikura','lemikuraa','lemikurra','lemmikura'],
    'Lideta':           ['lideta','lidetta'],
    'Nifas Silk Lafto': ['nifassilklafto','nifassilk','nifasilklafto'],
    'Yeka':             ['yeka','yekaa']
  },

  hospitals: [
    'AaBET Hospital','Abebech Gobena MCH Hospital','ALERT Comprehensive Specialized Hospital',
    'Amanuel Psychiatry And Rehabilitation Center','Dagmawi Minilik Comprehensive Specialized Hospital',
    'Eka Kotebe General Hospital','Gandhi Maternal And Child Health Specialty Center',
    'Ras Desta Damitew General Hospital',"St Paulo's Comprehensive Specialized Hospital",
    'St. Peter General Hospital','Tikur Anbessa Comprehensive Specialized Hospital',
    'Tirunesh Beijing General Hospital','Yekatit 12 Medical College General Hospital',
    'Zewditu Memorial General Hospital'
  ],

  /* OUTBREAK THRESHOLDS — PHEM Guideline (2nd ed., December 2022)
   *  • Rabies — Table 4-1: single suspected case = suspected outbreak (min 1).
   *  • Relapsing fever — Table 4-5: "unusual increase OR doubling of cases
   *    on subsequent weeks"; floor of 2 cases per woreda. */
  outbreakRules: [
    { d: 'human_rabies',   key: 'human_rabies',   min: 1 },
    { d: 'relapsing_fever',key: 'relapsing_fever',min: 2, doubling: true }
  ],

  immediate: [
    { key: 'chemical_poisoning', label: 'Chemical Poisoning' },
    { key: 'perinatal_death',    label: 'Perinatal Death' },
    { key: 'measles',            label: 'Measles' },
    { key: 'rabies_exposure',    label: 'Suspected Human Rabies Exposure' },
    { key: 'afp_polio',          label: 'Suspected AFP / Polio' }
  ],

  weekly: [
    { key: 'malaria',            label: 'Malaria' },
    { key: 'diarrhea_u5',        label: 'Diarrhea (U5)' },
    { key: 'severe_pneumonia_u5',label: 'Severe Pneumonia (U5)' },
    { key: 'relapsing_fever',    label: 'Relapsing Fever' }
  ]
};

/* ------------------------------------------------------------------ *
 * HOSPITAL → SUB-CITY / WOREDA (authoritative overrides)
 * ------------------------------------------------------------------ */
const HOSPITAL_LOC = {
  'AaBET Hospital':                                     { sub: 'Arada',          wor: 'Woreda 02' },
  'Abebech Gobena MCH Hospital':                        { sub: 'Arada',          wor: 'Woreda 02' },
  'ALERT Comprehensive Specialized Hospital':           { sub: 'Kolfe Keranyo',  wor: 'Woreda 01' },
  'Amanuel Psychiatry And Rehabilitation Center':       { sub: 'Addis Ketema',   wor: 'Woreda 09' },
  'Dagmawi Minilik Comprehensive Specialized Hospital': { sub: 'Yeka',           wor: 'Woreda 04' },
  'Eka Kotebe General Hospital':                        { sub: 'Yeka',           wor: 'Woreda 12' },
  'Gandhi Maternal And Child Health Specialty Center':  { sub: 'Kirkos',         wor: 'Woreda 07' },
  'Ras Desta Damitew General Hospital':                 { sub: 'Arada',          wor: 'Woreda 04' },
  "St Paulo's Comprehensive Specialized Hospital":      { sub: 'Gulele',         wor: 'Woreda 09' },
  'St. Peter General Hospital':                         { sub: 'Gulele',         wor: 'Woreda 01' },
  'Tikur Anbessa Comprehensive Specialized Hospital':   { sub: 'Lideta',         wor: 'Woreda 03' },
  'Tirunesh Beijing General Hospital':                  { sub: 'Akaki Kality',   wor: 'Woreda 09' },
  'Yekatit 12 Medical College General Hospital':        { sub: 'Arada',          wor: 'Woreda 06' },
  'Zewditu Memorial General Hospital':                  { sub: 'Kirkos',         wor: 'Woreda 07' }
};

const HOSP_ALIASES = {
  'Abebech Gobena Maternal And Child Health Specialty Center': 'Abebech Gobena MCH Hospital'
};

const HOSP_SHORT = {
  'AaBET Hospital':                                    'AaBET',
  'Abebech Gobena MCH Hospital':                       'Abebech Gobena',
  'ALERT Comprehensive Specialized Hospital':          'ALERT',
  'Amanuel Psychiatry And Rehabilitation Center':       'Amanuel',
  'Dagmawi Minilik Comprehensive Specialized Hospital': 'Dagmawi Minilik',
  'Eka Kotebe General Hospital':                       'Eka Kotebe',
  'Gandhi Maternal And Child Health Specialty Center':  'Gandhi MCH',
  'Ras Desta Damitew General Hospital':                 'Ras Desta',
  "St Paulo's Comprehensive Specialized Hospital":      "St. Paulo's",
  'St. Peter General Hospital':                         'St. Peter',
  'Tikur Anbessa Comprehensive Specialized Hospital':   'Tikur Anbessa',
  'Tirunesh Beijing General Hospital':                  'Tirunesh Beijing',
  'Yekatit 12 Medical College General Hospital':        'Yekatit 12',
  'Zewditu Memorial General Hospital':                  'Zewditu'
};

const normName_ = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const HOSPITAL_LOC_NORM = {};
Object.keys(HOSPITAL_LOC).forEach(k => { HOSPITAL_LOC_NORM[normName_(k)] = HOSPITAL_LOC[k]; });
Object.keys(HOSP_ALIASES).forEach(k => {
  const target = HOSP_ALIASES[k];
  if (HOSPITAL_LOC[target]) HOSPITAL_LOC_NORM[normName_(k)] = HOSPITAL_LOC[target];
});

const shortFac = n => {
  if (HOSP_SHORT[n]) return HOSP_SHORT[n];
  const alias = HOSP_ALIASES[n];
  if (alias && HOSP_SHORT[alias]) return HOSP_SHORT[alias];
  return n;
};

/* ------------------------------------------------------------------ *
 * INDICATOR COLUMNS
 * ------------------------------------------------------------------ */
const IND = {
  malaria:            { v: 'Total_Malaria_Confirmed_and_Clinical', d: 'TMalaria_InP_Deaths' },
  malaria_pf:         { v: 'PosMalaria_RDT_or_Microscopy_PF_OutP_Cases' },
  malaria_pv:         { v: 'PosMalaria_RDT_or_Microscopy_PV_OutP_Cases' },
  malaria_mx:         { v: 'PosMalaria_RDT_or_Microscopy_Mixed_OutP_Cases' },
  fever_exam:         { v: 'TMSuspected_Fever_Examined' },
  diarrhea_u5:        { v: 'Diarrhea_with_dehydration_U5_Total_Cases', d: 'Diarrhea_with_dehydration_U5__InP_Deaths' },
  severe_pneumonia_u5:{ v: 'Sever_pneumonia_in_children_U5_Total_Cases', d: 'Sever_pneumonia_in_children_U5_InP_Deaths' },
  relapsing_fever:    { v: 'Relapsing_fever_total_Cases', d: 'Relapsing_fever_InP_Deaths' },
  chemical_poisoning: { v: 'Chemical_Poisoning_Cases' },
  perinatal_death:    { v: 'Perinatal_death' },
  measles:            { v: 'Measles_Cases' },
  rabies_exposure:    { v: 'Suspected_rabies_exposure_Cases' },
  afp_polio:          { v: 'AFP_Polio_Cases' },
  human_rabies:       { v: 'Human_Rabies_Cases' },
  maternal_death:     { v: 'Maternal_death' },
  cn_total:           { v: 'Community_Notifications_Total' },
  cn_def:             { v: 'Community_Notifications_Case_Definition' },
  cn_30:              { v: 'Community_Notifications_30min' },
  expected:           { v: 'All_Total_sites_Expected_by_RHB' },
  reported:           { v: 'All_Total_sites_Reported' },
  ontime:             { v: 'All_Total_sites_Reported_Ontime' }
};
const IND_KEYS = Object.keys(IND);
const KI = {}; IND_KEYS.forEach((k, i) => KI[k] = i);
const INDV = IND_KEYS.join('|') + '|v4';

const CONSULT_KEYS = ['malaria','diarrhea_u5','severe_pneumonia_u5','relapsing_fever',
  'chemical_poisoning','perinatal_death','measles','rabies_exposure','afp_polio',
  'human_rabies','maternal_death'];

const ICON_MAP = {
  malaria:'malaria', malaria_pf:'malaria', malaria_pv:'malaria', malaria_mx:'malaria',
  fever_exam:'fever', diarrhea_u5:'diarrhea', severe_pneumonia_u5:'pneumonia',
  relapsing_fever:'fever', chemical_poisoning:'chemical-biological-radio-nuclear-agents',
  perinatal_death:'perinatal-death', measles:'measles', rabies_exposure:'rabies',
  afp_polio:'poliomyelitis', human_rabies:'rabies', maternal_death:'maternal'
};

/* ============================ WEB ENTRY ============================ */
/**
 * ?api=1  → JSON API for the GitHub Pages front-end
 * (default) → original Apps Script-served page (kept as fallback)
 */
function doGet(e) {
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
    } catch (err) {
      return out({ ok: false, error: err.message });
    }
  }
  try { return doGet_(e); } catch (err) {
    return HtmlService.createHtmlOutput('<pre style="font:14px monospace;color:#900;white-space:pre-wrap">Server error: ' +
      err.message + '\n' + (err.stack || '') + '</pre>');
  }
}
function doGet_(e) {
  const p = (e && e.parameter) || {};
  const year = +p.year || CFG.currentYear, week = +p.week || 0;
  const filter = { subcity: p.subcity || '', woreda: p.woreda || '' };
  const data = buildData_(year, week, filter, true);
  const t = HtmlService.createTemplateFromFile('Bulletin');
  t.D = JSON.stringify(data).replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
  return t.evaluate().setTitle('Epi Bulletin')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
function getBulletin(year, week, subcity, woreda, refresh) {
  try {
    if (refresh) refreshCache_(year);
    const data = buildData_(+year || CFG.currentYear, +week || 0,
      { subcity: subcity || '', woreda: woreda || '' }, false);
    return { ok: true, data: data };
  } catch (e) {
    return { ok: false, error: e.message + ' ' + (e.stack || '') };
  }
}
function refreshCache_(year) {
  try {
    const name = 'epi_year_' + year + '.json';
    const it = DriveApp.getFilesByName(name);
    if (it.hasNext()) it.next().setTrashed(true);
    PropertiesService.getScriptProperties().deleteProperty('YEAR_' + year + '_TS');
    AVAIL_YEARS_ = null; SUMMARY_ = null; GEO_ = {};
  } catch (e) {}
}

/* ============================ UTILITIES ============================ */
function canonicalSub_(name) {
  const n = normName_(name); if (!n) return '';
  for (const s of CFG.subcities) if (normName_(s) === n) return s;
  for (const s of CFG.subcities) {
    const m = normName_(s);
    if (n.length > 5 && (m.indexOf(n) === 0 || n.indexOf(m) === 0)) return s;
  }
  return '';
}
const isHospital_ = name => {
  const n = normName_(name);
  if (CFG.hospitals.some(h => normName_(h) === n)) return true;
  return /\bhospital\b/i.test(String(name || ''));
};
const isPublicHospital_ = name => {
  const n = normName_(name);
  if (HOSPITAL_LOC_NORM[n]) return true;
  return CFG.hospitals.some(h => normName_(h) === n);
};
const uniqSorted = a => Array.from(new Set(a)).sort((x, y) => x < y ? -1 : x > y ? 1 : 0);
const pct_ = p => p === 100 || p === undefined ? p : Math.round(p * 10) / 10;
const avg = a => a.length ? Math.round(a.reduce((s, x) => s + x, 0) / a.length * 10) / 10 : 0;

function headerMap_(hdr) {
  const H = {}; hdr.forEach((h, i) => H[String(h).replace(/^\uFEFF/, '').trim().toLowerCase()] = i); return H;
}
function isoWeekRange_(y, w) {
  const j = new Date(Date.UTC(y, 0, 4)), dow = j.getUTCDay() || 7;
  const mon = new Date(j.getTime() + ((w - 1) * 7 - (dow - 1)) * 864e5);
  const f = d => Utilities.formatDate(d, 'UTC', 'dd/MM/yyyy');
  return f(mon) + ' – ' + f(new Date(mon.getTime() + 6 * 864e5));
}
function manual_(ss) {
  const m = {}, s = ss.getSheetByName('Manual');
  if (s) s.getDataRange().getValues().slice(1).forEach(r => m[String(r[0]).trim()] = { v: r[1], p: r[2] });
  return m;
}

/* ============================ GEOJSON ============================ */
const SUB_NAME_PROPS_ = ['subcity','sub_city','SubCity','Sub_City','SUBCITY','zone','Zone','ZONE','zone_name',
  'adm3_name','ADM3_EN','ADM3_NAME','name','Name','NAME','shapeName','Shape_Name','SHAPENAME','label','LABEL','title'];
const WOR_NAME_PROPS_ = ['woreda','Woreda','WOREDA','woreda_name','Woreda_Name','WoredaName','wereda',
  'adm4_name','ADM4_EN','ADM4_NAME','name','Name','NAME','shapeName','Shape_Name','SHAPENAME','label','LABEL','title'];
const SUB_OF_WOR_PROPS_ = ['subcity','sub_city','SubCity','Sub_City','SUBCITY','zone','Zone','ZONE','zone_name',
  'adm3_name','ADM3_EN','ADM3_NAME'];

let GEO_ = {};
const geoNorm_ = s => String(s || '').toLowerCase()
  .replace(/sub[\s_\-]*city/g, '').replace(/kifle[\s_\-]*ketema/g, '')
  .replace(/[^a-z0-9]/g, '');

function canonSubGeo_(name) {
  const n = geoNorm_(name); if (!n) return '';
  for (const s of CFG.subcities) {
    if (geoNorm_(s) === n) return s;
    if ((CFG.subAliases[s] || []).indexOf(n) >= 0) return s;
  }
  return '';
}
function woredaNum_(name) {
  const s = String(name || '');
  const m = s.match(/(?:woreda|wereda|wor)[\s_\-\.]*0*(\d+)/i) || s.match(/(\d+)\s*$/);
  return m ? parseInt(m[1], 10) : null;
}
function subHint_(name) {
  const s = String(name || '');
  let m = s.match(/^(.*?)[\s_\-]*(?:woreda|wereda)/i);
  if (m && canonSubGeo_(m[1])) return canonSubGeo_(m[1]);
  m = s.match(/^(.*?)[\s_\-]*0*\d+\s*$/);
  return m ? canonSubGeo_(m[1]) : '';
}

function cachePutBig_(key, obj) {
  try {
    const s = JSON.stringify(obj), cache = CacheService.getScriptCache(), SZ = 90000;
    const n = Math.ceil(s.length / SZ), o = {};
    for (let i = 0; i < n; i++) o[key + '_' + i] = s.substr(i * SZ, SZ);
    o[key + '_n'] = String(n);
    cache.putAll(o, 21600);
  } catch (e) {}
}
function cacheGetBig_(key) {
  try {
    const cache = CacheService.getScriptCache();
    const n = +cache.get(key + '_n'); if (!n) return null;
    const ks = []; for (let i = 0; i < n; i++) ks.push(key + '_' + i);
    const m = cache.getAll(ks); let s = '';
    for (let i = 0; i < n; i++) { if (m[ks[i]] === undefined) return null; s += m[ks[i]]; }
    return JSON.parse(s);
  } catch (e) { return null; }
}

function reduceGeo_(raw, kind) {
  const feats = raw.type === 'FeatureCollection' ? (raw.features || [])
              : raw.type === 'Feature' ? [raw] : [];
  const cfgProp = kind === 'sub' ? CFG.subcityGeoNameProp : CFG.woredaGeoNameProp;
  const nameProps = [cfgProp].concat(kind === 'sub' ? SUB_NAME_PROPS_ : WOR_NAME_PROPS_);
  const subProps = [CFG.subcityGeoNameProp, 'AllSubCity_georef'].concat(SUB_OF_WOR_PROPS_);
  const warn = [], out = [];
  let usedFallbackProp = '', unnamed = 0, badCrs = false;

  const rnd = c => typeof c[0] === 'number'
    ? (Math.abs(c[0]) > 180 || Math.abs(c[1]) > 90 ? (badCrs = true, [c[0], c[1]]) : [+c[0].toFixed(5), +c[1].toFixed(5)])
    : c.map(rnd);

  feats.forEach(f => {
    const g = f && f.geometry;
    if (!g || (g.type !== 'Polygon' && g.type !== 'MultiPolygon') || !g.coordinates) return;
    const p = f.properties || {};
    let n = '', np = '';
    for (const k of nameProps) {
      if (p[k] !== undefined && p[k] !== null && String(p[k]).trim() !== '') { n = String(p[k]).trim(); np = k; break; }
    }
    if (!n) { unnamed++; }
    if (np && np !== cfgProp) usedFallbackProp = np;
    let s = '';
    if (kind === 'wor') {
      for (const k of subProps) {
        if (k === np) continue;
        const c = canonSubGeo_(p[k]); if (c) { s = c; break; }
      }
    }
    out.push({ type: 'Feature', properties: { n: n, s: s },
               geometry: { type: g.type, coordinates: rnd(g.coordinates) } });
  });
  const label = kind === 'sub' ? 'Sub-city' : 'Woreda';
  if (!out.length) warn.push(label + ' GeoJSON has no Polygon / MultiPolygon features.');
  if (usedFallbackProp) warn.push(label + ' GeoJSON: property "' + cfgProp + '" not found on some features; used "' + usedFallbackProp + '".');
  if (unnamed) warn.push(label + ' GeoJSON: ' + unnamed + ' feature(s) have no usable name property.');
  if (badCrs) warn.push(label + ' GeoJSON coordinates are not lon/lat (WGS84).');
  return { features: out, warn: warn };
}

function loadGeo_(kind) {
  if (GEO_[kind]) return GEO_[kind];
  const id = kind === 'sub' ? CFG.subcityGeoId : CFG.woredaGeoId;
  if (!id || id.indexOf('PASTE') >= 0) return null;
  const file = DriveApp.getFileById(id);
  const key = 'geo_' + kind + '_' + id + '_' + file.getLastUpdated().getTime();
  let g = cacheGetBig_(key);
  if (!g) {
    g = reduceGeo_(JSON.parse(file.getBlob().getDataAsString()), kind);
    cachePutBig_(key, g);
  }
  GEO_[kind] = g;
  return g;
}

function buildGeoMap_(Y) {
  const out = { sub: {}, wor: {}, worSub: {}, report: { sub: null, wor: null, warn: [] } };
  let gs = null, gw = null;
  try { gs = loadGeo_('sub'); } catch (e) { out.report.warn.push('Sub-city GeoJSON could not be read: ' + e.message); }
  try { gw = loadGeo_('wor'); } catch (e) { out.report.warn.push('Woreda GeoJSON could not be read: ' + e.message); }
  [gs, gw].forEach(g => { if (g) (g.warn || []).forEach(w => out.report.warn.push(w)); });

  const facs = Y.facs || [];
  const dataSubs = uniqSorted(facs.map(f => f.s).filter(Boolean));
  const dataWors = uniqSorted(facs.map(f => f.w).filter(Boolean));
  const worSubOf = {};
  facs.forEach(f => { if (f.w && f.s && !worSubOf[f.w]) worSubOf[f.w] = f.s; });

  if (gs) {
    const byKey = {};
    gs.features.forEach((f, i) => {
      const k = canonSubGeo_(f.properties.n) || geoNorm_(f.properties.n);
      (byKey[k] = byKey[k] || []).push(i);
    });
    const used = {}, miss = [];
    dataSubs.forEach(s => {
      const k = canonSubGeo_(s) || geoNorm_(s);
      if (byKey[k]) { out.sub[s] = byKey[k]; used[k] = 1; } else miss.push(s);
    });
    const noData = Object.keys(byKey).filter(k => !used[k]).map(k => gs.features[byKey[k][0]].properties.n);
    out.report.sub = { features: gs.features.length, data: dataSubs.length,
      matched: dataSubs.length - miss.length, unmatchedData: miss, geoWithoutData: noData };
  }

  if (gw) {
    const fe = gw.features.map((f, i) => {
      const n = f.properties.n;
      return { i: i, nn: geoNorm_(n), num: woredaNum_(n), sub: f.properties.s || subHint_(n) };
    });
    fe.forEach(x => { out.worSub[x.i] = x.sub; });
    const anySubInfo = fe.some(x => x.sub);
    const miss = [], amb = [];
    dataWors.forEach(w => {
      const wn = geoNorm_(w), ws = canonSubGeo_(worSubOf[w]) || worSubOf[w] || '', num = woredaNum_(w);
      const sameParts = c => c.length > 1 && c.every(x => x.sub === c[0].sub && x.nn === c[0].nn);
      let c = fe.filter(x => x.nn === wn);
      if (c.length > 1 && ws) { const n2 = c.filter(x => x.sub === ws); if (n2.length) c = n2; }
      if (!c.length && num !== null) {
        c = fe.filter(x => x.num === num && (ws ? x.sub === ws : true));
        if (!c.length && ws && !anySubInfo) { const c2 = fe.filter(x => x.num === num); if (c2.length === 1) c = c2; }
      }
      if (c.length === 1 || sameParts(c)) out.wor[w] = c.map(x => x.i);
      else if (c.length > 1) amb.push(w);
      else miss.push(w);
    });
    const usedIdx = {}; Object.keys(out.wor).forEach(k => out.wor[k].forEach(i => usedIdx[i] = 1));
    const noData = fe.filter(x => !usedIdx[x.i]).map(x => gw.features[x.i].properties.n);
    out.report.wor = { features: gw.features.length, data: dataWors.length,
      matched: Object.keys(out.wor).length, unmatchedData: miss, ambiguous: amb, geoWithoutData: noData };
  }
  return out;
}

function diagnoseGeo() {
  const Y = loadYear_(CFG.currentYear);
  const m = buildGeoMap_(Y);
  console.log(JSON.stringify(m.report, null, 2));
}

/* ============================ HISTORICAL SUMMARY ============================ */
function buildHistorySummary() {
  const id = CFG.histCsvId, tok = ScriptApp.getOAuthToken(), CH = 8 * 1024 * 1024;
  const base = 'https://www.googleapis.com/drive/v3/files/' + id, hdrs = { Authorization: 'Bearer ' + tok };
  const size = +JSON.parse(UrlFetchApp.fetch(base + '?fields=size&supportsAllDrives=true',
    { headers: hdrs }).getContentText()).size;
  const tot = {}, subs = [];
  let pos = 0, carry = [], H = null;
  while (pos < size) {
    const end = Math.min(pos + CH, size) - 1;
    const resp = UrlFetchApp.fetch(base + '?alt=media&supportsAllDrives=true',
      { headers: { Authorization: 'Bearer ' + tok, Range: 'bytes=' + pos + '-' + end } });
    const bytes = carry.concat(resp.getContent());
    const last = end >= size - 1 ? bytes.length : bytes.lastIndexOf(10) + 1;
    const grid = Utilities.parseCsv(Utilities.newBlob(bytes.slice(0, last)).getDataAsString('UTF-8'));
    carry = bytes.slice(last);
    if (!H) H = headerMap_(grid.shift());
    aggregateHist_(grid, H, tot, CFG.currentYear, subs);
    pos = end + 1;
    console.log('done ' + Math.round(pos / size * 100) + '%');
  }
  const f = DriveApp.createFile('epi_history_summary.json',
    JSON.stringify({ subs: subs.sort(), t: tot }), 'application/json');
  PropertiesService.getScriptProperties().setProperty('SUMMARY_ID', f.getId());
  SUMMARY_ = null; AVAIL_YEARS_ = null;
  console.log('Summary saved: ' + f.getUrl());
}
function aggregateHist_(grid, H, tot, skipYear, subs) {
  const col = n => H[n.toLowerCase()];
  const yC = col('year'), wC = col('epi_week'), zC = col('zone'), woC = col('woreda');
  const add = (k, y, w, v, sub) => { const id = k+'|'+y+'|'+w+'|'+sub; tot[id] = (tot[id]||0) + v; };
  grid.forEach(r => {
    const y = +r[yC], w = +r[wC]; if (!y || !w || y === skipYear) return;
    let sub = zC !== undefined ? String(r[zC]).trim() : '';
    if (!sub) sub = woC !== undefined ? String(r[woC]).trim() : '';
    sub = canonicalSub_(sub) || sub || 'Unknown';
    if (subs.indexOf(sub) < 0) subs.push(sub);
    Object.keys(IND).forEach(k => {
      const vc = col(IND[k].v);
      add(k, y, w, vc !== undefined ? (+r[vc]||0) : 0, sub);
      if (IND[k].d) { const dc = col(IND[k].d); add(k+'_d', y, w, dc !== undefined ? (+r[dc]||0) : 0, sub); }
    });
  });
}
let SUMMARY_ = null;
function summary_() {
  if (SUMMARY_) return SUMMARY_;
  const id = PropertiesService.getScriptProperties().getProperty('SUMMARY_ID');
  if (!id) { SUMMARY_ = { subs: [], t: {} }; return SUMMARY_; }
  const raw = JSON.parse(DriveApp.getFileById(id).getBlob().getDataAsString());
  SUMMARY_ = !raw.t ? { subs: [], t: raw } : raw; return SUMMARY_;
}
function histVal_(k, y, w, sub) {
  const S = summary_();
  if (!S.subs || !S.subs.length) return S.t[k+'|'+y+'|'+w] || 0;
  if (sub) return S.t[k+'|'+y+'|'+w+'|'+sub] || 0;
  let s = 0; for (const sb of S.subs) s += S.t[k+'|'+y+'|'+w+'|'+sb] || 0; return s;
}

/* ============================ AVAILABLE YEARS ============================ */
let AVAIL_YEARS_ = null;
function availableYears_() {
  if (AVAIL_YEARS_) return AVAIL_YEARS_;
  const years = new Set([CFG.currentYear]);
  try {
    const S = summary_();
    Object.keys(S.t || {}).forEach(k => {
      const p = k.split('|');
      const y = +p[1];
      if (y) years.add(y);
    });
  } catch (e) {}
  try {
    const cur = loadYear_(CFG.currentYear);
    (cur.yearsSeen || []).forEach(y => years.add(y));
  } catch (e) {}
  AVAIL_YEARS_ = [...years].sort((a, b) => a - b);
  return AVAIL_YEARS_;
}

/* ============================ YEAR CACHE ============================ */
function loadYear_(year) {
  const name = 'epi_year_' + year + '.json';
  const props = PropertiesService.getScriptProperties();
  const tsKey = 'YEAR_' + year + '_TS';
  const it = DriveApp.getFilesByName(name);
  const f = it.hasNext() ? it.next() : null;
  const ts = +props.getProperty(tsKey) || 0;
  if (f && Date.now() - ts < 6*3600*1000) {
    try { const Y = JSON.parse(f.getBlob().getDataAsString()); if (Y.indv === INDV) return Y; } catch(e) {}
  }
  const Y = buildYear_(year); Y.indv = INDV;
  const json = JSON.stringify(Y);
  if (f) f.setContent(json); else DriveApp.createFile(name, json, 'application/json');
  props.setProperty(tsKey, String(Date.now()));
  return Y;
}

const GENERIC_WOREDA_    = /^\s*(?:woreda|wereda|wor|w)?[\s_\-\.]*0*\d+\s*$/i;
const SUB_PREFIX_WOREDA_ = /^(.+?)[\s_\-]+(?:woreda|wereda)[\s_\-\.]*0*(\d+)\s*$/i;
function canonWoreda_(worName, canonSub) {
  if (!worName || !canonSub) return worName;
  const m1 = String(worName).match(SUB_PREFIX_WOREDA_);
  if (m1 && canonicalSub_(m1[1])) {
    const num = parseInt(m1[2], 10);
    if (!isNaN(num)) return canonSub + ' - Woreda ' + (num < 10 ? '0' + num : String(num));
  }
  if (GENERIC_WOREDA_.test(worName)) {
    const num = woredaNum_(worName);
    if (num !== null && !isNaN(num)) return canonSub + ' - Woreda ' + (num < 10 ? '0' + num : String(num));
  }
  return worName;
}

function buildYear_(year) {
  const ss = SpreadsheetApp.openById(CFG.currentSheetId);
  const rows = [], facMap = {}, facs = [], worToSub = {}, yearsSeen = {};
  ss.getSheets().forEach(s => {
    const v = s.getDataRange().getValues();
    if (v.length < 2) return;
    const H = headerMap_(v[0]); if (H['epi_week'] === undefined) return;
    const col = n => H[n.toLowerCase()];
    const yC = col('year'), wC = col('epi_week'), fC = col('health_facility'),
          zC = col('zone'), woC = col('woreda'), cC = col('completeness'), tC = col('timeliness');
    const indCols = IND_KEYS.map(k => ({ k, vc: col(IND[k].v), dc: IND[k].d ? col(IND[k].d) : undefined }));
    for (let i = 1; i < v.length; i++) {
      const r = v[i]; const y = +r[yC], w = +r[wC]; if (!y || !w) continue;
      yearsSeen[y] = 1; if (y !== year) continue;
      const facName = String(fC !== undefined ? r[fC] : '').trim();
      let worName = String(woC !== undefined ? r[woC] : '').trim();
      let zoneName = zC !== undefined ? String(r[zC]).trim() : '';
      if (!zoneName) zoneName = worName;
      const mapped = HOSPITAL_LOC_NORM[normName_(facName)];
      if (mapped) { zoneName = mapped.sub; worName = mapped.wor; }
      const canon = canonicalSub_(zoneName) || zoneName;
      if (worName && canon) worName = canonWoreda_(worName, canon);
      if (worName && canon && !worToSub[worName]) worToSub[worName] = canon;
      const fkey = facName + '||' + worName;
      let fi = facMap[fkey];
      if (fi === undefined) {
        fi = facs.length; facMap[fkey] = fi;
        facs.push({ n: facName, s: canon, w: worName,
          t: isPublicHospital_(facName) ? 'H' : (isHospital_(facName) ? 'h' : 'F') });
      }
      const vArr = [], dArr = [];
      indCols.forEach(ic => {
        vArr.push(ic.vc !== undefined ? (+r[ic.vc]||0) : 0);
        dArr.push(ic.dc !== undefined ? (+r[ic.dc]||0) : 0);
      });
      rows.push({ w, f: fi, c: cC !== undefined ? (+r[cC]||0) : 0, t: tC !== undefined ? (+r[tC]||0) : 0, v: vArr, d: dArr });
    }
  });
  return { rows, facs, worToSub,
    yearsSeen: Object.keys(yearsSeen).map(Number).sort((a,b)=>a-b),
    manual: manual_(ss) };
}

/* ============================ HISTORICAL FALLBACK ============================ */
function loadYearFromSummary_(year) {
  const S = summary_();
  const subs = S.subs || [];
  const t = S.t || {};
  const rows = [], facs = [], facsIdx = {};
  subs.forEach((sb, i) => { facs.push({ n: sb, s: sb, w: '', t: 'F' }); facsIdx[sb] = i; });
  const weekSet = new Set();
  Object.keys(t).forEach(k => {
    const p = k.split('|');
    if (+p[1] === year) weekSet.add(+p[2]);
  });
  const weeks = [...weekSet].sort((a, b) => a - b);
  weeks.forEach(w => {
    subs.forEach(sb => {
      if (t['malaria|' + year + '|' + w + '|' + sb] === undefined) return;
      const fi = facsIdx[sb];
      const vArr = IND_KEYS.map(k => t[k + '|' + year + '|' + w + '|' + sb] || 0);
      const dArr = IND_KEYS.map(k => IND[k].d ? (t[k + '_d|' + year + '|' + w + '|' + sb] || 0) : 0);
      rows.push({ w, f: fi, c: 0, t: 0, v: vArr, d: dArr });
    });
  });
  let manualData = {};
  try {
    const ss = SpreadsheetApp.openById(CFG.currentSheetId);
    manualData = manual_(ss);
  } catch (e) {}
  return { rows, facs, worToSub: {}, yearsSeen: [year], manual: manualData };
}

/* ============================ BUILD DATA ============================ */
function buildData_(year, week, filter, includeAssets) {
  filter = filter || {};
  let Y = loadYear_(year);
  const hasSheetData = (Y.rows || []).length > 0;
  if (!hasSheetData) {
    Y = loadYearFromSummary_(year);
    if (filter.woreda) filter = { subcity: filter.subcity || '', woreda: '' };
  }

  const F = Y.facs;
  const fsN = normName_(filter.subcity), fwN = normName_(filter.woreda);
  const pass = r => {
    const f = F[r.f];
    if (fsN && normName_(f.s) !== fsN) return false;
    if (fwN && normName_(f.w) !== fwN) return false;
    return true;
  };
  const rowsAll = Y.rows.filter(pass);
  if (!rowsAll.length) throw new Error('No data for year ' + year + ' with current filters.');
  let weeks = uniqSorted(rowsAll.map(r => r.w));
  if (!week || weeks.indexOf(week) < 0) week = weeks.length ? weeks[weeks.length - 1] : 0;
  const cur  = rowsAll.filter(r => r.w === week);
  const prev = rowsAll.filter(r => r.w === week - 1);
  const ytd  = rowsAll.filter(r => r.w <= week);

  const V    = (r, k) => r.v[KI[k]] || 0;
  const Dd   = (r, k) => IND[k].d ? (r.d[KI[k]] || 0) : 0;
  const sumK = (list, k) => list.reduce((a, r) => a + V(r, k), 0);
  const sumD = (list, k) => list.reduce((a, r) => a + Dd(r, k), 0);

  const wkTot = {};
  const buildWk = k => {
    if (wkTot[k]) return wkTot[k];
    const m = {}; rowsAll.forEach(r => { m[r.w] = (m[r.w] || 0) + V(r, k); });
    wkTot[k] = m; return m;
  };

  let scopeSub = '';
  if (filter.subcity) scopeSub = canonicalSub_(filter.subcity) || filter.subcity;
  else if (filter.woreda) scopeSub = Y.worToSub[filter.woreda] || '';

  const scopeSubName = fsN ? (F.map(f => f.s).find(s => s && normName_(s) === fsN) || '') : '';
  const scopeWorName = fwN ? (F.map(f => f.w).find(w => w && normName_(w) === fwN) || '') : '';

  const M   = Y.manual || {};
  const mv  = k => M[k] ? (+M[k].v || 0) : 0;
  const mvs = k => M[k] ? String(M[k].v || '') : '';
  const mp  = k => M[k] ? (+M[k].p || 0) : 0;
  const chg = (v, p) => ({ v, pct: p ? Math.round((v - p) / p * 100) : 0 });

  /* Total consultations = sum of ALL case values, deaths excluded */
  const totalConsult = CONSULT_KEYS.reduce((s, k) => s + sumK(cur,  k), 0);
  const prevConsult  = CONSULT_KEYS.reduce((s, k) => s + sumK(prev, k), 0);
  const cn30 = sumK(cur, 'cn_30');

  /* OUTBREAK DETECTION — PHEM Guideline (2nd ed., Dec 2022)
   *   outbreaks       → woredas that PASS the guideline threshold
   *   outbreakSignals → ALL woredas with any case > 0 (map source) */
  const outbreaks       = [];
  const outbreakSignals = [];

  CFG.outbreakRules.forEach(R => {
    const cur_m = {};
    cur.forEach(r => {
      const s = F[r.f].s || 'Unknown';
      const w = F[r.f].w || '';
      const key = s + '||' + w;
      cur_m[key] = (cur_m[key] || 0) + V(r, R.key);
    });

    Object.keys(cur_m).forEach(k => {
      if (cur_m[k] > 0) {
        const parts = k.split('||');
        outbreakSignals.push({ d: R.d, sub: parts[0], wor: parts[1], v: cur_m[k] });
      }
    });

    if (R.doubling) {
      const prev_m = {};
      prev.forEach(r => {
        const s = F[r.f].s || 'Unknown';
        const w = F[r.f].w || '';
        const key = s + '||' + w;
        prev_m[key] = (prev_m[key] || 0) + V(r, R.key);
      });

      const hist4 = {};
      for (let i = 1; i <= 4; i++) {
        const wk = week - i;
        if (wk < 1) continue;
        rowsAll.filter(r => r.w === wk).forEach(r => {
          const s = F[r.f].s || 'Unknown';
          const w = F[r.f].w || '';
          const key = s + '||' + w;
          hist4[key] = (hist4[key] || 0) + V(r, R.key);
        });
      }

      Object.keys(cur_m).forEach(k => {
        const c = cur_m[k];
        if (c < R.min) return;
        const p  = prev_m[k] || 0;
        const h4 = (hist4[k] || 0) / 4;

        const doubling = (p > 0 && c >= 2 * p) || (p === 0 && c >= 2);
        const unusual  = (h4 > 0 && c >= 2 * h4 && c >= 2);

        if (doubling || unusual) {
          const parts = k.split('||');
          outbreaks.push({ d: R.d, sub: parts[0], wor: parts[1], v: c });
        }
      });
      return;
    }

    Object.keys(cur_m).forEach(k => {
      if (cur_m[k] >= R.min) {
        const parts = k.split('||');
        outbreaks.push({ d: R.d, sub: parts[0], wor: parts[1], v: cur_m[k] });
      }
    });
  });

  const nOut = M.outbreaks
    ? +M.outbreaks.v
    : new Set(outbreaks.map(o => o.d)).size;

  /* T&C — District: non-hospital facilities by sub-city */
  const norm01 = v => v <= 1 ? v * 100 : v;
  const E = sumK(cur, 'expected');
  const bySub = {};
  cur.filter(r => F[r.f].t === 'F').forEach(r => {
    const s = F[r.f].s || 'Unknown';
    (bySub[s] = bySub[s] || []).push(r);
  });
  let tcFac = Object.keys(bySub).map(s => ({
    f: s,
    c: avg(bySub[s].map(r => norm01(r.c))),
    t: avg(bySub[s].map(r => norm01(r.t)))
  }));
  if (tcFac.every(x => x.c === 0 && x.t === 0)) tcFac = [];

  /* T&C — Hospital: public hospitals only */
  const byH = {};
  cur.filter(r => F[r.f].t === 'H').forEach(r => {
    const n = F[r.f].n;
    (byH[n] = byH[n] || []).push(r);
  });
  let tcHosp = Object.keys(byH).map(n => ({
    f: shortFac(n),
    c: avg(byH[n].map(r => norm01(r.c))),
    t: avg(byH[n].map(r => norm01(r.t)))
  }));
  if (tcHosp.every(x => x.c === 0 && x.t === 0)) tcHosp = [];

  const pf = sumK(cur,'malaria_pf'), pv = sumK(cur,'malaria_pv'),
        mx = sumK(cur,'malaria_mx'), fever = sumK(cur,'fever_exam');

  /* Disease block builder */
  const mk = d => {
    const total = sumK(cur, d.key);

    const sm = {};
    cur.forEach(r => { const s = F[r.f].s || 'Unknown'; sm[s] = (sm[s] || 0) + V(r, d.key); });
    const sub = Object.keys(sm).map(n => [n, sm[n]]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);

    const wm = {};
    cur.forEach(r => { const w = F[r.f].w; if (!w) return; wm[w] = (wm[w] || 0) + V(r, d.key); });
    const wor = Object.keys(wm).map(n => [n, wm[n]]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);

    const fm = {};
    cur.forEach(r => { const n = F[r.f].n; fm[n] = (fm[n] || 0) + V(r, d.key); });
    const fac = Object.keys(fm).map(n => [shortFac(n), fm[n]])
      .filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]);

    const deaths = cur.filter(r => Dd(r, d.key))
      .map(r => [shortFac(F[r.f].n), Dd(r, d.key)]);

    const trend = {};
    for (let y = year - CFG.trendYears + 1; y <= year; y++) {
      const arr = new Array(52).fill(null);
      if (y === year) {
        const m = buildWk(d.key);
        for (let w = 1; w <= 52; w++) arr[w - 1] = w > week ? null : (m[w] || 0);
      } else {
        for (let w = 1; w <= 52; w++) arr[w - 1] = histVal_(d.key, y, w, scopeSub);
      }
      trend[y] = arr;
    }
    const narrative = mvs(d.key + '_narrative') || '';
    return { key: d.key, label: d.label, total, fac, sub, wor, deaths, trend, narrative };
  };

  /* CEBS aggregation */
  const cebs = [{ src: 'CEBS', dom: 'Human', n: sumK(cur,'cn_total'), ver: sumK(cur,'cn_def') }];
  if (M.call_centre_signals) cebs.push({ src:'Call centre (6406)', dom:'Human',
    n: mv('call_centre_signals'), ver: mv('call_centre_verified') });
  if (M.eios_signals) cebs.push({ src:'EIOS / Media', dom:'Human',
    n: mv('eios_signals'), ver: mv('eios_verified') });
  const notifiedPct = mv('notified_pct') || 100;

  const scope = filter.woreda ? [filter.subcity, filter.woreda].filter(Boolean).join(' · ')
    : (filter.subcity || 'All Sub-Cities');

  const maternal = {
    ytd: mv('maternal_deaths_ytd') || ytd.reduce((a, r) => a + V(r,'maternal_death'), 0),
    reviewed: mv('maternal_reviewed_pct'),
    preventable: mv('maternal_preventable_pct'),
    delay3: mv('maternal_delay3_pct')
  };
  const perinatal = {
    ytd: mv('perinatal_deaths_ytd') || ytd.reduce((a, r) => a + V(r,'perinatal_death'), 0),
    reviewed: mv('perinatal_reviewed_pct'),
    preventable: mv('perinatal_preventable_pct'),
    delay3: mv('perinatal_delay3_pct')
  };

  const years = availableYears_();
  const options = {
    years, weeks: weeks.length ? weeks : Array.from({length:52},(_,i)=>i+1),
    subcities: uniqSorted(Y.facs.map(f=>f.s).filter(Boolean)),
    woredas:   uniqSorted(Y.facs.map(f=>f.w).filter(Boolean)),
    worToSub:  Y.worToSub,
    year, week,
    filter: { subcity: filter.subcity||'', woreda: filter.woreda||'' },
    historical: !hasSheetData
  };

  /* Assets only on first load — subsequent filter changes reuse them */
  let icons = null, logo = '', geo = null;
  if (includeAssets) {
    icons = {};
    CFG.immediate.concat(CFG.weekly).forEach(d => { icons[d.key] = icon_(d.key); });
    icons['human_rabies'] = icon_('human_rabies');
    logo = b64_(CFG.logoId);
    try { geo = { sub: loadGeo_('sub'), wor: loadGeo_('wor') }; } catch (e) { geo = null; }
  }
  let geoMap = null;
  try { geoMap = buildGeoMap_(Y); } catch (e) {
    geoMap = { sub: {}, wor: {}, worSub: {}, report: { warn: ['Geo matching failed: ' + e.message] } };
  }

  return {
    meta: { year, week, range: week ? isoWeekRange_(year, week) : '',
            filtered: !!(filter.subcity||filter.woreda),
            historical: !hasSheetData,
            scope, notifiedPct, cn30,
            scopeSub: scopeSubName, scopeWor: scopeWorName },
    logo, icons, options, geo, geoMap,
    kpi: {
      consult: { v: totalConsult, pct: prevConsult ? Math.round((totalConsult-prevConsult)/prevConsult*100) : 0 },
      alerts:  chg(mv('alerts'), mp('alerts')),
      cebs:    chg(sumK(cur,'cn_total'), sumK(prev,'cn_total')),
      outbreaks: { v: nOut, pct: 0 }
    },
    outbreaks,
    outbreakSignals,
    tc: { timeliness: E ? pct_(sumK(cur,'ontime')/E*100) : null,
          completeness: E ? pct_(sumK(cur,'reported')/E*100) : null,
          fac: tcFac, hosp: tcHosp },
    malaria: { pf, pv, mx, pos: fever ? Math.round((pf+pv+mx)/fever*100) : null,
               deaths: sumD(cur,'malaria') },
    maternal, perinatal,
    immediate: CFG.immediate.map(mk),
    weekly:    CFG.weekly.map(mk),
    cebs,
    evd: M.evd_confirmed ? [{
      country:   M.evd_country ? M.evd_country.v : 'DRC',
      suspected: mv('evd_suspected') || null,
      cases:     mv('evd_confirmed'),
      deaths:    mv('evd_deaths'),
      asOf:      mvs('evd_as_of')
    }] : [],
    narratives: { weekly_alert: mvs('weekly_alert'), outbreak_summary: mvs('outbreak_summary') },
    people: {
      contributors: mvs('contributors') || "Call centre team; Early warning and data communication; Addis Ababa City Data Mg't Center",
      sources:      mvs('sources') || 'Weekly IDSR report; CEBS report; MPDSR; Call center 6406; EIOS',
      feedbackUrl:  mvs('feedback_url') || '#',
      signupUrl:    mvs('signup_url') || '#',
      facebookUrl:  mvs('facebook_url') || '#'
    }
  };
}

/* ============================ DRIVE ASSETS ============================ */
function b64_(id) {
  try {
    const b = DriveApp.getFileById(id).getBlob();
    const b64 = Utilities.base64Encode(b.getBytes()).replace(/\s/g, '');
    return 'data:' + b.getContentType() + ';base64,' + b64;
  } catch (e) { return ''; }
}
let ICONS_ = null;
function icon_(key) {
  if (!ICONS_) {
    ICONS_ = {};
    const it = DriveApp.getFolderById(CFG.iconsFolderId).getFiles();
    while (it.hasNext()) { const f = it.next();
      ICONS_[f.getName().toLowerCase().replace(/\.[a-z0-9]+$/, '')] = f.getId(); }
  }
  const name = ICON_MAP[key] || key;
  return ICONS_[name] ? b64_(ICONS_[name]) : '';
}

/* ============================ AUTOMATION ============================ */
function prebuild() { loadYear_(CFG.currentYear); buildData_(CFG.currentYear, 0, {}, true); }
function installTriggers() {
  ScriptApp.newTrigger('prebuild').timeBased().everyHours(3).create();
  ScriptApp.newTrigger('emailLink_').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
}
function emailLink_() {
  prebuild();
  if (CFG.emailTo) MailApp.sendEmail(CFG.emailTo, 'Weekly Epi Bulletin ready',
    'Open: ' + ScriptApp.getService().getUrl());
}

/* ============================ DIAGNOSTICS ============================ */
function dumpDistinctNames() {
  const ss = SpreadsheetApp.openById(CFG.currentSheetId);
  const zones = new Set(), woredas = new Set();
  ss.getSheets().forEach(sh => {
    const v = sh.getDataRange().getValues();
    if (v.length < 2) return;
    const H = headerMap_(v[0]);
    if (H['zone'] === undefined || H['woreda'] === undefined) return;
    for (let i = 1; i < v.length; i++) {
      const z = String(v[i][H['zone']]   || '').trim();
      const w = String(v[i][H['woreda']] || '').trim();
      if (z) zones.add(z);
      if (w) woredas.add(w);
    }
  });
  console.log('DISTINCT ZONES:\n'   + JSON.stringify([...zones].sort(),   null, 2));
  console.log('DISTINCT WOREDAS:\n' + JSON.stringify([...woredas].sort(), null, 2));
}
function diagnoseHospitals() {
  const Y = loadYear_(CFG.currentYear);
  const hosp = Y.facs.filter(f => f.t === 'H');
  console.log('Public hospitals in ' + CFG.currentYear + ' (post-override):');
  hosp.forEach(f => console.log('  • ' + f.n + '  →  ' + (f.s || '??') + ' / ' + (f.w || '??')));
  const missing = CFG.hospitals.filter(h => {
    const n = normName_(h);
    return !hosp.some(f => normName_(f.n) === n);
  });
  if (missing.length) console.log('Hospitals in CFG.hospitals not present in the sheet:', missing);
}
