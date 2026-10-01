// This script generates the PWA icons (192x192 and 512x512) using Canvas API
// Genera dos variantes por tamaño:
//   icon-<size>.png           → purpose "any": esquinas redondeadas y transparentes
//   icon-maskable-<size>.png  → purpose "maskable": fondo a sangre, sin transparencias,
//                               para que Android pueda recortarlo con su propia máscara
// Run with: npm i --no-save canvas && node scripts/generate-icons.js
const fs = require('fs');
const path = require('path');

/**
 * Dibuja el icono en un contexto 2D (sirve igual para node-canvas y para el navegador).
 * El círculo y la nota ocupan un radio de 0,35·size: caben en la zona segura
 * de los iconos maskable (círculo de radio 0,4·size).
 */
function drawIcon(ctx, size, maskable) {
  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, size, size);
  grad.addColorStop(0, '#13131a');
  grad.addColorStop(1, '#0a0a0f');
  ctx.fillStyle = grad;
  if (maskable) {
    ctx.fillRect(0, 0, size, size);
  } else {
    ctx.roundRect(0, 0, size, size, size * 0.22);
    ctx.fill();
  }

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
}

function main() {
  // `canvas` no es dependencia del proyecto: solo hace falta para regenerar los PNG.
  const { createCanvas } = require('canvas');
  const publicDir = path.join(__dirname, '..', 'public', 'icons');
  if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

  for (const size of [192, 512]) {
    for (const maskable of [false, true]) {
      const canvas = createCanvas(size, size);
      drawIcon(canvas.getContext('2d'), size, maskable);
      const name = maskable ? `icon-maskable-${size}.png` : `icon-${size}.png`;
      fs.writeFileSync(path.join(publicDir, name), canvas.toBuffer('image/png'));
      console.log(`Generated ${name}`);
    }
  }
}

if (require.main === module) main();

module.exports = { drawIcon };
