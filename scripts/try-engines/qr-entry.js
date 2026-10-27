const QR = require('qrcode/lib/core/qrcode');
// The QR matrix for a string, as rows of 0/1 (the page draws its own SVG).
globalThis.JsonFitQR = function (text) {
  const q = QR.create(text, { errorCorrectionLevel: 'M' });
  const n = q.modules.size, d = q.modules.data, rows = [];
  for (let y = 0; y < n; y++) { const r = []; for (let x = 0; x < n; x++) r.push(d[y * n + x] ? 1 : 0); rows.push(r); }
  return rows;
};
