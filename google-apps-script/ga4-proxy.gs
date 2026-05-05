/**
 * ERIC Freelance Week — GA4 Data API Proxy
 * ─────────────────────────────────────────
 * Deploy as a Google Apps Script Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Prerequisites:
 *   1. Enable the "Google Analytics Data API" in Services
 *      (left sidebar → + Add a service → Analytics Data API)
 *   2. The account running this script must have at least
 *      Viewer access to the GA4 property.
 *
 * Returns JSON consumed by the GitHub Pages dashboard.
 */

// ── CONFIG ────────────────────────────────────────────────────────────────────
var GA4_PROPERTY_ID = 'YOUR_GA4_PROPERTY_ID'; // e.g. '123456789' (numbers only)

// Date range — adjust once the event has started / ended
var DATE_START = '2026-06-08';
var DATE_END   = '2026-06-12';

// ── doGet ─────────────────────────────────────────────────────────────────────
function doGet(e) {
  try {
    var data = getGA4Data();
    return ContentService
      .createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    var errPayload = { error: err.message, stack: err.stack };
    return ContentService
      .createTextOutput(JSON.stringify(errPayload))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// ── Core GA4 fetch ────────────────────────────────────────────────────────────
function getGA4Data() {
  var propertyName = 'properties/' + GA4_PROPERTY_ID;

  // ── 1. Summary metrics (single row) ────────────────────────────────────────
  var summaryRequest = {
    dateRanges: [{ startDate: DATE_START, endDate: DATE_END }],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'averageSessionDuration' },
      { name: 'bounceRate' },
      { name: 'sessions' },
    ],
  };

  var summaryReport = AnalyticsData.Properties.runReport(summaryRequest, propertyName);
  var summaryRow    = (summaryReport.rows && summaryReport.rows[0])
    ? summaryReport.rows[0].metricValues
    : [{ value:'0' },{ value:'0' },{ value:'0' },{ value:'0' },{ value:'0' }];

  var avgDurationSecs = parseFloat(summaryRow[2].value) || 0;
  var bounceRateRaw   = parseFloat(summaryRow[3].value) || 0;

  // ── 2. Sessions per day ─────────────────────────────────────────────────────
  var byDayRequest = {
    dateRanges: [{ startDate: DATE_START, endDate: DATE_END }],
    dimensions: [{ name: 'date' }],
    metrics:    [{ name: 'sessions' }],
    orderBys:   [{ dimension: { dimensionName: 'date' }, desc: false }],
  };

  var byDayReport = AnalyticsData.Properties.runReport(byDayRequest, propertyName);

  // Day-label map
  var dayLabels = {
    '20260608': 'Mon 8',
    '20260609': 'Tue 9',
    '20260610': 'Wed 10',
    '20260611': 'Thu 11',
    '20260612': 'Fri 12',
  };

  var sessionsPerDay = [];
  if (byDayReport.rows) {
    byDayReport.rows.forEach(function(row) {
      var rawDate = row.dimensionValues[0].value; // 'YYYYMMDD'
      sessionsPerDay.push({
        date:     dayLabels[rawDate] || rawDate,
        sessions: parseInt(row.metricValues[0].value, 10) || 0,
      });
    });
  }

  // ── 3. Video events ─────────────────────────────────────────────────────────
  var videoRequest = {
    dateRanges: [{ startDate: DATE_START, endDate: DATE_END }],
    dimensions: [{ name: 'eventName' }, { name: 'customEvent:video_title' }],
    metrics:    [{ name: 'eventCount' }],
    dimensionFilter: {
      orGroup: {
        expressions: [
          { filter: { fieldName: 'eventName', stringFilter: { value: 'video_start',    matchType: 'EXACT' } } },
          { filter: { fieldName: 'eventName', stringFilter: { value: 'video_progress', matchType: 'EXACT' } } },
          { filter: { fieldName: 'eventName', stringFilter: { value: 'video_complete', matchType: 'EXACT' } } },
        ]
      }
    },
    orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
    limit: 10,
  };

  var videoReport  = AnalyticsData.Properties.runReport(videoRequest, propertyName);
  var videoEvents  = [];
  if (videoReport.rows) {
    videoReport.rows.forEach(function(row) {
      var evtName   = row.dimensionValues[0].value;
      var vidTitle  = row.dimensionValues[1].value || evtName;
      var label     = vidTitle + ' (' + evtName.replace('_', ' ') + ')';
      videoEvents.push({
        label: label,
        count: parseInt(row.metricValues[0].value, 10) || 0,
      });
    });
  }

  // ── Format helpers ──────────────────────────────────────────────────────────
  function formatDuration(secs) {
    var m = Math.floor(secs / 60);
    var s = Math.round(secs % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function formatPercent(ratio) {
    return Math.round(ratio * 100) + '%';
  }

  // ── Return payload ──────────────────────────────────────────────────────────
  return {
    pageViews:      parseInt(summaryRow[0].value, 10) || 0,
    users:          parseInt(summaryRow[1].value, 10) || 0,
    avgDuration:    formatDuration(avgDurationSecs),
    bounceRate:     formatPercent(bounceRateRaw),
    totalSessions:  parseInt(summaryRow[4].value, 10) || 0,
    sessionsPerDay: sessionsPerDay,
    videoEvents:    videoEvents,
    meta: {
      propertyId: GA4_PROPERTY_ID,
      dateStart:  DATE_START,
      dateEnd:    DATE_END,
      fetchedAt:  new Date().toISOString(),
    }
  };
}
