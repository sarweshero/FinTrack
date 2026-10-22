import client from './client';

/**
 * billAPI — wraps the POST /scan-bill/ endpoint.
 *
 * The image is compressed *further* on the client side (canvas 800px, JPEG 0.65)
 * before being sent, so even large phone photos become ~100–200 KB on the wire.
 * The backend then compresses again with Pillow to ≤ 800px / JPEG-50.
 *
 * This double-compression approach keeps Gemini Vision token usage minimal and
 * stays well within the free tier quota.
 */

/**
 * Client-side canvas compression.
 * Resizes image to max 800 px and encodes as JPEG at quality 0.65.
 * Returns a Blob (or the original File if canvas is unsupported).
 */
export async function compressImageClient(file) {
  return new Promise((resolve) => {
    const MAX_PX = 800;
    const QUALITY = 0.65;

    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);

      const { naturalWidth: w, naturalHeight: h } = img;
      const scale = Math.min(1, MAX_PX / Math.max(w, h));
      const nw = Math.round(w * scale);
      const nh = Math.round(h * scale);

      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, nw, nh);

      canvas.toBlob(
        (blob) => resolve(blob || file),
        'image/jpeg',
        QUALITY,
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file); // fallback: send original
    };

    img.src = url;
  });
}

export const billAPI = {
  /**
   * Compress the image client-side, then POST to /api/scan-bill/.
   * @param {File} imageFile
   * @returns {Promise<object>} Parsed bill data from Gemini
   */
  scan: async (imageFile) => {
    const compressed = await compressImageClient(imageFile);

    const formData = new FormData();
    // Use the original filename but override content-type via Blob
    formData.append('image', compressed, imageFile.name.replace(/\.[^.]+$/, '.jpg'));

    return client.post('/scan-bill/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000, // Vision calls can take up to ~20s on free tier
    });
  },
};

