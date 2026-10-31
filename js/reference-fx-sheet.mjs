// Original six-cell art shared by the preview and item-fx.mjs's cell indices.
export function createReferenceFxSheet(createCanvas = () => document.createElement('canvas')) {
  const sheet = createCanvas(); sheet.width = 192; sheet.height = 32;
  const g = sheet.getContext('2d'); g.fillStyle = 'white'; g.strokeStyle = 'white'; g.lineWidth = 2;
  g.fillRect(14, 3, 4, 26); g.fillRect(3, 14, 26, 4);
  g.beginPath(); g.arc(48, 16, 10, 0, Math.PI * 2); g.stroke(); g.fillRect(43, 9, 3, 3);
  g.beginPath(); g.moveTo(80, 26); g.bezierCurveTo(53, 9, 76, 0, 80, 11);
  g.bezierCurveTo(84, 0, 107, 9, 80, 26); g.fill();
  g.fillRect(102, 13, 20, 6); g.fillRect(128, 13, 32, 6);
  g.fillRect(169, 9, 14, 14); g.fillRect(173, 5, 6, 22);
  return sheet;
}
