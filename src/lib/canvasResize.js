/**
 * canvasResize.js
 * Uses the Canvas API to resize album art to 600x600 JPEG (as required for Samsung Music APIC tag)
 */

/**
 * Fetches an image from a URL (via our proxy) and resizes it to 600x600 JPEG.
 * Returns an ArrayBuffer with the JPEG binary data.
 * @param {string} imageUrl - The proxied image URL
 * @param {number} size - Target size (default 600)
 * @param {number} quality - JPEG quality 0-1 (default 0.92)
 * @returns {Promise<ArrayBuffer>}
 */
export async function resizeCoverArt(imageUrl, size = 600, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext('2d');
      // Fill with black first (for images with transparency)
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, size, size);

      // Center-crop to square
      const sourceSize = Math.min(img.width, img.height);
      const offsetX = (img.width - sourceSize) / 2;
      const offsetY = (img.height - sourceSize) / 2;

      ctx.drawImage(img, offsetX, offsetY, sourceSize, sourceSize, 0, 0, size, size);

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'));
            return;
          }
          blob.arrayBuffer().then(resolve).catch(reject);
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error(`Failed to load image: ${imageUrl}`));
    img.src = imageUrl;
  });
}
