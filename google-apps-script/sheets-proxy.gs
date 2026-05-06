/**
 * ERIC Freelance Week — Google Sheets Proxy
 * ─────────────────────────────────────────
 * Deploy as a Google Apps Script Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Reads from the FW registrations sheet and returns JSON for the dashboard.
 *
 * Counting logic:
 *   Each row = 1 visit/signup
 *   UNLESS the row has a Student Count value, in which case
 *   that number is used for the educator-reach total.
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
var SPREADSHEET_ID = '1GbEAUVze_iw4SIOkFJiGFsPHuA6befAjyKLGVbp-G9Y';
var SHEET_GID      = 2039356090;   // numeric gid from the URL
var MAX_ROWS       = 1000;

// ── doGet ─────────────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    var data = getData();
    return buildResponse(data);
  } catch (err) {
    return buildResponse({ error: err.message });
  }
}

// ── Core data function ────────────────────────────────────────────────────────
function getData() {
  var ss    = SpreadsheetApp.openById(SPREADSHEET_ID);

  // Find the sheet by GID
  var sheet = null;
  var allSheets = ss.getSheets();
  for (var i = 0; i < allSheets.length; i++) {
    if (allSheets[i].getSheetId() === SHEET_GID) {
      sheet = allSheets[i];
      break;
    }
  }
  // Fallback: just use the first sheet if GID not found
  if (!sheet) sheet = allSheets[0];
  if (!sheet) throw new Error('No sheets found in spreadsheet.');

  var lastRow = Math.min(sheet.getLastRow(), MAX_ROWS + 1);
  if (lastRow < 2) {
    return { registrations: [], summary: { total: 0, individuals: 0, studentCount: 0, reach: 0 }, meta: {} };
  }

  var lastCol  = sheet.getLastColumn();
  var headers  = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var rows     = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

  // Map header names → column indices (case-insensitive, trimmed)
  var colMap = {};
  headers.forEach(function(h, i) { colMap[h.toString().trim().toLowerCase()] = i; });

  function col(name) {
    var idx = colMap[name.toLowerCase()];
    return (idx !== undefined) ? idx : -1;
  }

  // ── Parse registrations ───────────────────────────────────────────────────
  var registrations = [];

  rows.forEach(function(row) {
    if (!row.some(function(c) { return c !== ''; })) return; // skip blank rows

    var dateVal = row[col('date')] || '';
    var dateStr = '';
    if (dateVal instanceof Date) {
      dateStr = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      dateStr = dateVal.toString().trim();
    }

    // Student Count — each row counts as 1 unless this has a value
    var studentCountRaw = col('student count') >= 0 ? row[col('student count')] : '';
    var studentCount    = parseInt(studentCountRaw, 10) || 0;

    var reg = {
      date:          dateStr,
      name:          col('name')           >= 0 ? (row[col('name')]           || '') : '',
      type:          col('type')           >= 0 ? (row[col('type')]           || '') : '',
      institution:   col('institution')    >= 0 ? (row[col('institution')]    || '') : '',
      role:          col('role')           >= 0 ? (row[col('role')]           || '') : '',
      studentCount:  studentCount,
      daysInterested:col('days interested')>= 0 ? (row[col('days interested')]|| '') : '',
    };

    // Normalise type → 'Individual' | 'Institution'
    var t = reg.type.toLowerCase();
    if (t.indexOf('school') !== -1 || t.indexOf('college') !== -1 ||
        t.indexOf('uni')    !== -1 || t.indexOf('instit')  !== -1) {
      reg.type = 'Institution';
    } else {
      reg.type = 'Individual';
    }

    registrations.push(reg);
  });

  // ── Summary counts ────────────────────────────────────────────────────────
  var totalSignups  = registrations.length;
  var individuals   = registrations.filter(function(r) { return r.type === 'Individual'; }).length;
  var studentCount  = registrations.reduce(function(sum, r) { return sum + r.studentCount; }, 0);
  // Reach = each individual counts as 1, each educator row counts as their student count (min 1)
  var reach = registrations.reduce(function(sum, r) {
    if (r.type === 'Institution') {
      return sum + (r.studentCount > 0 ? r.studentCount : 1);
    }
    return sum + 1;
  }, 0);

  return {
    registrations: registrations,
    summary: {
      total:        totalSignups,
      individuals:  individuals,
      studentCount: studentCount,
      reach:        reach,
    },
    meta: {
      fetchedAt: new Date().toISOString(),
      sheetName: sheet.getName(),
    }
  };
}

// ── Response helper ───────────────────────────────────────────────────────────
function buildResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
