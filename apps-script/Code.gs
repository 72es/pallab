/**
 * PalLab 資料庫 — Google Apps Script 網頁應用程式
 * 貼到「PalLab 資料庫」試算表的 擴充功能 → Apps Script，
 * 把下面的 PIN 改成店內密碼，再部署成網頁應用程式（執行身分：我／存取權：所有人）。
 */
const PIN = '請改成店內PIN';

const TAB_STD = '標準';      // A1：目前標準（JSON），B1：更新時間，C1：更新者
const TAB_LOG = '紀錄';      // 每次更新一列，可用來退回舊版
const TAB_SUM = '成本摘要';  // 每次更新後重寫，方便直接看

function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function tab_(name, header) {
  let sh = ss_().getSheetByName(name);
  if (!sh) {
    sh = ss_().insertSheet(name);
    if (header) { sh.appendRow(header); sh.setFrozenRows(1); }
  }
  return sh;
}
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
function readStd_() {
  const v = tab_(TAB_STD).getRange('A1').getValue();
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return null; }
}

/** 讀取目前標準 */
function doGet() {
  return out_({ ok: true, std: readStd_() });
}

/** 更新標準：body = {pin, base, std:{updated, by, def}, summary:[{name,total,price}]} */
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, code: 'bad_request' }); }

  // 密碼錯太多次就暫停 10 分鐘
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('fails') || 0);
  if (fails >= 10) return out_({ ok: false, code: 'locked' });
  if (String(body.pin) !== String(PIN)) {
    cache.put('fails', String(fails + 1), 600);
    return out_({ ok: false, code: 'bad_pin' });
  }

  const std = body.std;
  if (!std || !std.def || !std.def.ing || !std.def.prep || !std.def.drinks) return out_({ ok: false, code: 'bad_request' });

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) return out_({ ok: false, code: 'busy' });
  try {
    const cur = readStd_();
    if (cur && body.base && cur.updated !== body.base) return out_({ ok: false, code: 'conflict', std: cur });

    std.updated = new Date().toISOString();
    std.by = String(std.by || '').slice(0, 20);
    const json = JSON.stringify(std);
    tab_(TAB_STD).getRange('A1:C1').setValues([[json, new Date(), std.by]]);

    const sum = Array.isArray(body.summary) ? body.summary : [];
    tab_(TAB_LOG, ['時間', '更新者', '摘要', '標準 JSON（要退回就把這格貼到「標準」A1）'])
      .appendRow([new Date(), std.by, sum.map(s => `${s.name} $${Number(s.total).toFixed(1)}`).join('｜'), json]);

    const sh = tab_(TAB_SUM);
    sh.clear();
    sh.appendRow(['品項', '總成本', '售價', '成本率', '毛利', '更新時間', '更新者']);
    sum.forEach(s => {
      const t = Number(s.total) || 0, p = Number(s.price) || 0;
      sh.appendRow([s.name, Math.round(t * 10) / 10, p, p ? t / p : '', p ? Math.round((p - t) * 10) / 10 : '', new Date(), std.by]);
    });
    if (sum.length) sh.getRange(2, 4, sum.length, 1).setNumberFormat('0.0%');
    sh.setFrozenRows(1);

    return out_({ ok: true, std: std });
  } finally {
    lock.releaseLock();
  }
}
