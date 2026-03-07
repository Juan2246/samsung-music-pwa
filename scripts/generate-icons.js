// This script generates the PWA icons (192x192 and 512x512) using Canvas API
// Run with: node scripts/generate-icons.js
const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');

function createIcon(size) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#13131a');
  grad.addColorStop(1, '#0a0a0f');
  ctx.fillStyle = grad;
  ctx.roundRect(0, 0, size, size, size * 0.22);
  ctx.fill();

  // Accent circle
  const accentGrad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size * 0.38);
  accentGrad.addColorStop(0, '#6b9fff');
  accentGrad.addColorStop(1, '#1a5cff');
  ctx.fillStyle = accentGrad;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Music note
  const s = size / 48;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  // Note head
  ctx.ellipse(size * 0.44, size * 0.58, s * 5, s * 4, -0.3, 0, Math.PI * 2);
  ctx.fill();
  // Stem
  ctx.fillRect(size * 0.44 + s * 4, size * 0.27, s * 2.5, s * 13);
  // Flag
  ctx.beginPath();
  ctx.moveTo(size * 0.44 + s * 6.5, size * 0.27);
  ctx.quadraticCurveTo(size * 0.44 + s * 16, size * 0.33, size * 0.44 + s * 12, size * 0.43);
  ctx.fill();

  return canvas.toBuffer('image/png');
}

const publicDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

[192, 512].forEach((size) => {
  const buffer = createIcon(size);
  fs.writeFileSync(path.join(publicDir, `icon-${size}.png`), buffer);
  console.log(`Generated icon-${size}.png`);
});
