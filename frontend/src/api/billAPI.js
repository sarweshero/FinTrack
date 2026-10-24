import client from './client';

/**
 * billAPI — Quota-safe, Async Background Bill Scanner API.
 *
 * 1. Image is compressed on client side via HTML5 Canvas (max 800px, JPEG 0.65)
 *    reducing file size by ~90% before uploading.
 * 2. Upload endpoint POST /api/scan-bill/ returns HTTP 202 in <300ms with a task_id.
 * 3. Gemini Vision runs in the background on the server and auto-creates the Transaction
 *    in the DB to immediately update balance and ledger.
 * 4. getStatus(taskId) polls the task status and retrieves the parsed result.
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
   * Compress image client-side, then upload to start background parsing task.
   * @param {File} imageFile
   * @returns {Promise<{task_id: string, status: string, message: string}>}
   */
  scan: async (imageFile) => {
    const compressed = await compressImageClient(imageFile);

    const formData = new FormData();
    formData.append('image', compressed, imageFile.name.replace(/\.[^.]+$/, '.jpg'));

    return client.post('/scan-bill/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 15000,
    });
  },

  /**
   * Get the processing status and results of a bill scan task.
   * @param {string} taskId
   * @returns {Promise<{task_id: string, status: string, extracted_data: object, transaction: object, error_message: string}>}
   */
  getStatus: async (taskId) => {
    return client.get(`/scan-bill/${taskId}/`);
  },

  /**
   * Poll task until completion or failure.
   * @param {string} taskId
   * @param {object} options
   * @returns {Promise<object>} Final task object
   */
  pollUntilDone: async (taskId, { intervalMs = 1500, maxAttempts = 30, onProgress } = {}) => {
    let attempts = 0;
    while (attempts < maxAttempts) {
      const data = await billAPI.getStatus(taskId);
      if (onProgress) {
        onProgress(data, attempts);
      }
      if (data.status === 'COMPLETED') {
        return data;
      }
      if (data.status === 'FAILED') {
        throw new Error(data.error_message || 'Bill processing failed on the server.');
      }
      attempts += 1;
      await new Promise((res) => setTimeout(res, intervalMs));
    }
    throw new Error('Processing took too long. Please check your ledger or try again.');
  },
};

export default billAPI;
