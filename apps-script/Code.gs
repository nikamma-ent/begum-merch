/**
 * Begum merch: receives paid orders from the site and writes them to this Sheet.
 * One "All orders" tab plus one tab per city, each with a "Picked up" checkbox.
 *
 * Setup: see README, section "Google Sheet pickup lists".
 */

// Must match SHEET_TOKEN in Cloudflare.
const TOKEN = "CHANGE-ME-to-the-same-value-as-SHEET_TOKEN";

const HEADERS = ["Order code", "Name", "Phone", "Items", "Qty", "Amount (₹)", "Email", "Paid at", "Payment ID", "Picked up"];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.token !== TOKEN) return out({ ok: false, error: "bad token" });

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const all = tab(ss, "All orders", ["City"].concat(HEADERS));

    // Skip duplicates (the site and the webhook can both report the same order).
    const last = all.getLastRow();
    if (last > 1) {
      const codes = all.getRange(2, 2, last - 1, 1).getValues().flat();
      if (codes.indexOf(d.code) !== -1) return out({ ok: true, duplicate: true });
    }

    const row = [
      d.code,
      safe(d.name),
      "'" + d.phone,
      safe(d.items),
      d.quantity,
      d.amount,
      safe(d.email),
      new Date(d.paidAt),
      d.paymentId,
      false,
    ];
    append(all, [d.city].concat(row));
    append(tab(ss, d.city, HEADERS), row);
    return out({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

function tab(ss, name, headers) {
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight("bold");
  }
  return sh;
}

function append(sh, row) {
  sh.appendRow(row);
  sh.getRange(sh.getLastRow(), row.length).insertCheckboxes();
}

// Stop names like "=HYPERLINK(...)" being run as formulas.
function safe(v) {
  const s = String(v == null ? "" : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function out(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
