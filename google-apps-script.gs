/**
 * College Admissions study — Google Sheets storage (Apps Script web app).
 *
 * SETUP (one-time):
 *   1. Make a Google Sheet. Open it → Extensions → Apps Script.
 *   2. Paste this whole file in (replace everything in the editor).
 *   3. Deploy → Manage deployments → edit the existing Web app deployment → Deploy a new version
 *      (this KEEPS the same /exec URL, so no app change is needed). For a first deploy: New
 *      deployment → type "Web app" → Execute as: Me, Who has access: Anyone → copy the /exec URL
 *      into SHEET_ENDPOINT in src/lib/logger.ts (v4 and v6 share the same URL).
 *
 * FOUR tabs — two per version, so v4 and v6 data never mix:
 *   • "v4 Responses" / "v4 Events" — the v4 pre/post rubric study.
 *   • "v6 Responses" / "v6 Events" — the v6 shifting-demographics study.
 * Routing is by the `study` field the app sends in `wide` (e.g. "ca-v6"): anything containing "v6"
 * goes to the v6 tabs; everything else (including v4, which sends no study code) goes to the v4 tabs.
 * The WIDE row is UPSERTED (merged) by a key column so per-page saves keep building the same
 * participant's row instead of duplicating it — the app names that column in `data.keyCol`
 * (v6 = `id`; v4 sends none → defaults to `name`).
 *
 * This script is fully GENERIC: it writes whatever columns the app sends, upserts by whatever key
 * the app names (`keyCol`), and tags each event with whatever the app sends (`tag`). So once this
 * version is deployed you should NEVER need to edit or redeploy it again — all schema/column
 * changes are made in the app alone.
 *
 * (Upgrading from the old 2-tab script? Your existing "Responses"/"Events" tabs hold older v4 data.
 * Rename them to "v4 Responses"/"v4 Events" to keep that data flowing into the same tabs; otherwise
 * new v4 tabs are created and the old ones are left untouched.)
 *
 * Headers are managed automatically and grow as new fields appear.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // Route by study code (sent in `wide.study`, e.g. "ca-v6"). v4 sends none → defaults to v4.
    var study = (data.wide && data.wide.study) || data.study || '';
    var isV6 = String(study).indexOf('v6') !== -1;
    var respTab = isV6 ? 'v6 Responses' : 'v4 Responses';
    var eventTab = isV6 ? 'v6 Events' : 'v4 Events';

    // The APP declares how to store its data, so a column rename never needs a script redeploy:
    //   • data.keyCol — the WIDE column to UPSERT the participant's single row by.
    //   • data.tag    — an object prepended to every Event row (its keys become the leading columns).
    // Defaults keep the older v4 payload (which sends neither) working: key by `name`, tag by `name`.
    var keyCol = data.keyCol || 'name';
    var tag = data.tag || { name: data.name || '' };

    if (data.wide) {
      upsertRow(getSheet(ss, respTab), data.wide, keyCol);
    }
    (data.events || []).forEach(function (ev) {
      // Fresh copy of the tag per row so Object.assign doesn't accumulate across events.
      appendRow(getSheet(ss, eventTab), Object.assign({}, tag, ev));
    });

    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

/**
 * MERGE an object into the single row whose `keyCol` matches obj[keyCol] (e.g. one row per
 * participant): update just the provided cells, leave the rest, and append a new row if no match
 * exists. Headers grow to cover any new keys. Used for the WIDE Responses tabs so saving once per
 * page keeps building the same participant's row instead of adding duplicates.
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

// Optional: visiting the /exec URL in a browser confirms the app is live.
function doGet() {
  return json({ ok: true, service: 'college-admissions-study' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
