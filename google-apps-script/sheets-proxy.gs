/**
 * ERIC Freelance Week — Google Sheets Proxy
 * ─────────────────────────────────────────
 * Deploy as a Google Apps Script Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Returns JSON consumed by the GitHub Pages dashboard.
 *
 * Sheet tab name: "FW Registrations"
 * Expected columns (row 1 = headers):
 *   Date | Time | Name | Email | Type | Age | Career Stage |
 *   Industries | Postcode | Days Interested | Institution | Role |
 *   Inst Postcode | Inst Type | Student Count | Source | Timestamp
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
var SHEET_TAB   = 'FW Registrations';
var MAX_ROWS    = 500;   // safety cap — increase if needed
var ALLOWED_ORIGINS = '*'; // lock down to your GitHub Pages URL in production

// ── doGet ─────────────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    var data = getData();
    return buildResponse(data);
  } catch (err) {
    return buildResponse({ error: err.message }, 500);
  }
}

// ── Core data function ────────────────────────────────────────────────────────
function getData() {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_TAB);

  if (!sheet) {
    throw new Error('Sheet tab "' + SHEET_TAB + '" not found. Check the tab name.');
  }

  var lastRow = Math.min(sheet.getLastRow(), MAX_ROWS + 1);
  if (lastRow < 2) {
    // No data yet — return empty result
    return { registrations: [], industries: [], meta: { total: 0 } };
  }

  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var rows    = sheet.getRange(2, 1, lastRow - 1, headers.length).getValues();

  // Map header names → column indices (case-insensitive, trimmed)
  var colMap = {};
  headers.forEach(function(h, i) { colMap[h.toString().trim().toLowerCase()] = i; });

  function col(name) { return colMap[name.toLowerCase()]; }

  // ── Parse registrations ───────────────────────────────────────────────────
  var registrations = [];
  var industryCounter = {};

  rows.forEach(function(row) {
    // Skip completely empty rows
    if (!row.some(function(c) { return c !== ''; })) return;

    var dateVal = row[col('date')] || '';
    var dateStr = '';
    if (dateVal instanceof Date) {
      dateStr = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), 'yyyy-MM-dd');
    } else {
      dateStr = dateVal.toString().trim();
    }

    var reg = {
      date:          dateStr,
      name:          row[col('name')]          || '',
      type:          row[col('type')]          || 'Individual',
      age:           row[col('age')]           || '',
      careerStage:   row[col('career stage')]  || '',
      industries:    row[col('industries')]    || '',
      daysInterested:row[col('days interested')]|| '',
      institution:   row[col('institution')]   || '',
      role:          row[col('role')]          || '',
      instType:      row[col('inst type')]     || '',
      source:        row[col('source')]        || '',
    };

    // Normalise type field to 'Individual' | 'Institution'
    var typeLower = reg.type.toLowerCase();
    if (typeLower.indexOf('school')  !== -1 ||
        typeLower.indexOf('college') !== -1 ||
        typeLower.indexOf('uni')     !== -1 ||
        typeLower.indexOf('instit')  !== -1) {
      reg.type = 'Institution';
    } else {
      reg.type = 'Individual';
    }

    registrations.push(reg);

    // Count industries (comma-separated list in cell)
    if (reg.industries) {
      reg.industries.split(',').forEach(function(ind) {
        var trimmed = ind.trim();
        if (trimmed) {
          industryCounter[trimmed] = (industryCounter[trimmed] || 0) + 1;
        }
      });
    }
  });

  // ── Build industries list sorted by count desc ────────────────────────────
  var industries = Object.keys(industryCounter)
    .map(function(name) { return { name: name, count: industryCounter[name] }; })
    .sort(function(a, b) { return b.count - a.count; })
    .slice(0, 10);

  return {
    registrations: registrations,
    industries:    industries,
    meta: {
      total:       registrations.length,
      fetchedAt:   new Date().toISOString(),
    }
  };
}

// ── Response helper ───────────────────────────────────────────────────────────
function buildResponse(data, statusCode) {
  var json = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return json;
}
