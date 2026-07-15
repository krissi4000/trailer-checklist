const SHEET_NAME = 'Runs';
const HEADERS = ['timestamp', 'user', 'checklist', 'notes', 'items_json', 'run_id'];
const DEDUP_WINDOW = 200;
const FOLDER_NAME = 'TrailerChecklist';
const CONTENT_FILE_NAME = 'content.json';

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
    switch (payload.action) {
      case undefined: // old clients send no action: treat as a run submission
        return handleRun_(payload);
      case 'content-pull':
        return handleContentPull_();
      case 'content-push':
        return handleContentPush_(payload);
      case 'media-list':
        return handleMediaList_();
      case 'media-upload':
        return handleMediaUpload_(payload);
      case 'media-get':
        return handleMediaGet_(payload);
      default:
        return json_({ ok: false, error: 'unknown action: ' + payload.action });
    }
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function handleRun_(payload) {
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
}

function getFolder_() {
  const it = DriveApp.getFoldersByName(FOLDER_NAME);
  return it.hasNext() ? it.next() : DriveApp.createFolder(FOLDER_NAME);
}

function getMediaFolder_() {
  const parent = getFolder_();
  const it = parent.getFoldersByName('media');
  return it.hasNext() ? it.next() : parent.createFolder('media');
}

function getContentFile_() {
  const it = getFolder_().getFilesByName(CONTENT_FILE_NAME);
  return it.hasNext() ? it.next() : null;
}

function getRev_() {
  return Number(PropertiesService.getScriptProperties().getProperty('CONTENT_REV') || '0');
}

function handleContentPull_() {
  const rev = getRev_();
  const file = getContentFile_();
  if (rev === 0 || !file) {
    return json_({ ok: true, rev: 0, bundle: null });
  }
  return json_({ ok: true, rev: rev, bundle: JSON.parse(file.getBlob().getDataAsString()) });
}

function handleContentPush_(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const rev = getRev_();
    if (Number(payload.baseRev) !== rev) {
      const file = getContentFile_();
      const bundle = file ? JSON.parse(file.getBlob().getDataAsString()) : null;
      return json_({ ok: false, error: 'conflict', rev: rev, bundle: bundle });
    }
    const content = JSON.stringify(payload.bundle);
    const file = getContentFile_();
    if (file) {
      file.setContent(content);
    } else {
      getFolder_().createFile(CONTENT_FILE_NAME, content, 'application/json');
    }
    PropertiesService.getScriptProperties().setProperty('CONTENT_REV', String(rev + 1));
    return json_({ ok: true, rev: rev + 1 });
  } finally {
    lock.releaseLock();
  }
}

function handleMediaList_() {
  const files = getMediaFolder_().getFiles();
  const ids = [];
  while (files.hasNext()) ids.push(files.next().getName());
  return json_({ ok: true, ids: ids });
}

function handleMediaUpload_(payload) {
  if (!payload.id || !payload.mime || !payload.data) {
    return json_({ ok: false, error: 'invalid media payload' });
  }
  const folder = getMediaFolder_();
  if (folder.getFilesByName(payload.id).hasNext()) {
    return json_({ ok: true, dedup: true });
  }
  const bytes = Utilities.base64Decode(payload.data);
  folder.createFile(Utilities.newBlob(bytes, payload.mime, payload.id));
  return json_({ ok: true });
}

function handleMediaGet_(payload) {
  const it = getMediaFolder_().getFilesByName(payload.id || '');
  if (!it.hasNext()) {
    return json_({ ok: false, error: 'not-found' });
  }
  const blob = it.next().getBlob();
  return json_({ ok: true, mime: blob.getContentType(), data: Utilities.base64Encode(blob.getBytes()) });
}

function doGet() {
  return json_({ ok: true, hint: 'POST runs here' });
}

// Run this once from the editor after adding new Google-API usage: it touches
// Drive so the consent screen appears and the scope gets granted. (Functions
// ending in _ are private in Apps Script and cannot be run from the editor.)
function authorizeDrive() {
  const folder = getMediaFolder_();
  Logger.log('Drive OK, media folder id: ' + folder.getId());
}
