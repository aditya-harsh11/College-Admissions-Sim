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
 *   • "Responses" tab — WIDE form: one row per participant, from the payload's `wide` object.
 *   • "Events" tab    — LONG form: one row per logged interaction, each tagged with the name.
 *
 * Headers are managed automatically and grow as new fields appear.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.wide) {
      appendRow(getSheet(ss, 'Responses'), data.wide);
    }
    (data.events || []).forEach(function (ev) {
      appendRow(getSheet(ss, 'Events'), Object.assign({ name: data.name || '' }, ev));
    });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
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
