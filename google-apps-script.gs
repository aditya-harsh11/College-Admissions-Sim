/**
 * College Admissions study — Google Sheets storage (Apps Script web app).
 *
 * SETUP (one-time):
 *   1. Make a Google Sheet. Open it → Extensions → Apps Script.
 *   2. Paste this whole file in (replace everything in the editor).
 *   3. Deploy → New deployment → type "Web app".
 *        - Execute as: Me
 *        - Who has access: Anyone
 *      Copy the Web app URL (ends in /exec) into SHEET_ENDPOINT in src/lib/logger.ts.
 *
 * This script is GENERIC: it writes whatever columns the app sends, so you never need to edit or
 * redeploy it again when the saved columns change — adjust them in the app (StudyFlow `wide`).
 *
 *   • "Responses" tab — WIDE form: ONE row per participant, MERGED (upserted) by `name`. The app
 *                       saves after each page, so the row fills in as the participant progresses and
 *                       partial/abandoned runs are still captured.
 *   • "Events" tab    — LONG form: one row per logged interaction, each tagged with the name. The
 *                       app sends only NEW events per save, so events are simply appended.
 *
 * Headers are managed automatically and grow as new fields appear.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.wide) {
      upsertRow(getSheet(ss, 'Responses'), data.wide, 'name');
    }
    (data.events || []).forEach(function (ev) {
      appendRow(getSheet(ss, 'Events'), Object.assign({ name: data.name || '' }, ev));
    });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * MERGE an object into the single row whose `keyCol` matches obj[keyCol] (e.g. one row per name):
 * update just the provided cells, leave the rest, and append a new row if no match exists. Headers
 * grow to cover any new keys, exactly like appendRow. Used for the WIDE Responses tab so saving
 * once per page keeps building the same participant's row instead of adding duplicates.
 */
function upsertRow(sheet, obj, keyCol) {
  var headers = ensureHeaders(sheet, obj);
  var keyVal = obj[keyCol];

  // No usable key, or no data rows yet → just append.
  if (keyVal === undefined || keyVal === null || keyVal === '' || sheet.getLastRow() < 2) {
    writeRow(sheet, headers, sheet.getLastRow() + 1, obj, null);
    return;
  }

  var keyIdx = headers.indexOf(keyCol);
  var numRows = sheet.getLastRow() - 1;
  var keyValues = sheet.getRange(2, keyIdx + 1, numRows, 1).getValues();
  var targetRow = -1;
  for (var i = 0; i < keyValues.length; i++) {
    if (String(keyValues[i][0]) === String(keyVal)) { targetRow = i + 2; break; }
  }

  if (targetRow === -1) {
    writeRow(sheet, headers, sheet.getLastRow() + 1, obj, null);
  } else {
    var existing = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
    writeRow(sheet, headers, targetRow, obj, existing);
  }
}

/** Grow the header row to include every key in obj; return the current header list. */
function ensureHeaders(sheet, obj) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getLastRow() > 0 && lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];
  var changed = false;
  Object.keys(obj).forEach(function (k) {
    if (headers.indexOf(k) === -1) { headers.push(k); changed = true; }
  });
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  return headers;
}

/**
 * Write `obj` into `rowNum`, starting from `existing` row values (or blanks). Only keys present in
 * obj are overwritten, so a partial payload never blanks columns already filled by an earlier save.
 */
function writeRow(sheet, headers, rowNum, obj, existing) {
  var values = headers.map(function (h, i) {
    if (Object.prototype.hasOwnProperty.call(obj, h)) {
      var v = obj[h];
      if (v === undefined || v === null) return '';
      return typeof v === 'object' ? JSON.stringify(v) : v;
    }
    return existing ? existing[i] : '';
  });
  sheet.getRange(rowNum, 1, 1, values.length).setValues([values]);
}

// Optional: visiting the /exec URL in a browser confirms the app is live.
function doGet() {
  return json({ ok: true, service: 'college-admissions-study' });
}

/** Append an object as a row, growing the header row to cover any new keys. */
function appendRow(sheet, obj) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getLastRow() > 0 && lastCol > 0
    ? sheet.getRange(1, 1, 1, lastCol).getValues()[0]
    : [];

  var changed = false;
  Object.keys(obj).forEach(function (k) {
    if (headers.indexOf(k) === -1) { headers.push(k); changed = true; }
  });

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else if (changed) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  var values = headers.map(function (h) {
    var v = obj[h];
    if (v === undefined || v === null) return '';
    return typeof v === 'object' ? JSON.stringify(v) : v;
  });
  sheet.appendRow(values);
}

function getSheet(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
