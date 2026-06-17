const SHEET_NAME = 'Runs';
const HEADERS = ['timestamp', 'user', 'checklist', 'notes', 'items_json', 'run_id'];
const DEDUP_WINDOW = 200;

function getSecret_() {
  return PropertiesService.getScriptProperties().getProperty('TRAILER_SECRET') || '';
}

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
  }
  return sheet;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    if (!payload.secret || payload.secret !== getSecret_()) {
      return json_({ ok: false, error: 'unauthorized' });
    }
    if (!payload.run_id || !payload.timestamp || !payload.checklist) {
      return json_({ ok: false, error: 'invalid payload' });
    }

    const sheet = getSheet_();
    const last = sheet.getLastRow();
    if (last > 1) {
      const start = Math.max(2, last - DEDUP_WINDOW + 1);
      const ids = sheet.getRange(start, 6, last - start + 1, 1).getValues().flat();
      if (ids.indexOf(payload.run_id) !== -1) {
        return json_({ ok: true, dedup: true });
      }
    }

    sheet.appendRow([
      payload.timestamp,
      payload.user || '',
      payload.checklist,
      payload.notes || '',
      payload.items_json || '[]',
      payload.run_id,
    ]);
    return json_({ ok: true, row: sheet.getLastRow() });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet() {
  return json_({ ok: true, hint: 'POST runs here' });
}
