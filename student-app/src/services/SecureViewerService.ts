import * as FileSystem from 'expo-file-system';

const VIEWER_DIR = `${FileSystem.documentDirectory}secure-viewer/`;
const PDF_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js';
const WORKER_JS_URL = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const viewerHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <title>Secure PDF Viewer</title>
  <script src="./pdf.min.js"></script>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #1e293b;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      user-select: none;
      -webkit-user-select: none;
      overflow-x: hidden;
      overflow-y: auto;
    }

    #viewer-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 0;
      gap: 16px;
      box-sizing: border-box;
      width: 100vw;
    }

    .page-wrapper {
      position: relative;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
      background-color: #ffffff;
      max-width: 95%;
      display: inline-block;
    }

    canvas {
      display: block;
      max-width: 100%;
      height: auto !important;
    }

    .watermark-overlay {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      overflow: hidden;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      grid-template-rows: repeat(4, 1fr);
      opacity: 0.15;
      z-index: 10;
    }

    .watermark-text {
      display: flex;
      justify-content: center;
      align-items: center;
      font-size: 11px;
      color: #000000;
      font-weight: 700;
      transform: rotate(-30deg);
      white-space: nowrap;
      text-align: center;
      line-height: 1.4;
    }

    #loading-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: #0f172a;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      z-index: 100;
      color: #ffffff;
    }

    .spinner {
      border: 4px solid rgba(255, 255, 255, 0.1);
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border-left-color: #3b82f6;
      animation: spin 1s linear infinite;
      margin-bottom: 16px;
    }

    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }

    #status-text {
      font-size: 14px;
      font-weight: 500;
      color: #94a3b8;
    }

    * {
      -webkit-touch-callout: none;
    }
  </style>
</head>
<body oncontextmenu="return false;">

  <div id="loading-overlay">
    <div class="spinner"></div>
    <div id="status-text">Securing session...</div>
  </div>

  <div id="viewer-container"></div>

  <script>
    pdfjsLib.GlobalWorkerOptions.workerSrc = './pdf.worker.min.js';

    function base64ToArrayBuffer(base64) {
      const binaryString = atob(base64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      return bytes.buffer;
    }

    function formatDate(timestamp) {
      if (!timestamp) return new Date().toLocaleString();
      return new Date(timestamp).toLocaleString();
    }

    async function loadSecurePDF(encryptedBase64, keyBase64, watermarkInfo, startPage) {
      const statusText = document.getElementById('status-text');
      try {
        statusText.innerText = 'Decrypting file in RAM...';

        const keyBuffer = base64ToArrayBuffer(keyBase64);
        const combinedBuffer = base64ToArrayBuffer(encryptedBase64);

        const iv = combinedBuffer.slice(0, 12);
        const ciphertext = combinedBuffer.slice(12);

        const cryptoKey = await window.crypto.subtle.importKey(
          'raw',
          keyBuffer,
          { name: 'AES-GCM' },
          false,
          ['decrypt']
        );

        const decryptedBuffer = await window.crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: iv
          },
          cryptoKey,
          ciphertext
        );

        statusText.innerText = 'Rendering pages securely...';

        const pdf = await pdfjsLib.getDocument({ data: decryptedBuffer }).promise;
        const container = document.getElementById('viewer-container');
        container.innerHTML = '';

        const watermarkString = \`\${watermarkInfo.userName}\\nUID: \${watermarkInfo.userId}\\nDevice: \${watermarkInfo.deviceId}\\nDate: \${formatDate(watermarkInfo.timestamp)}\`;

        // Create Intersection Observer to track active visible page
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const pageNum = parseInt(entry.target.getAttribute('data-page-number'));
              if (window.ReactNativeWebView) {
                window.ReactNativeWebView.postMessage(JSON.stringify({
                  type: 'PAGE_CHANGED',
                  page: pageNum,
                  total: pdf.numPages
                }));
              }
            }
          });
        }, { threshold: 0.4 }); // 40% threshold

        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
          const page = await pdf.getPage(pageNum);
          
          const wrapper = document.createElement('div');
          wrapper.className = 'page-wrapper';
          wrapper.setAttribute('data-page-number', pageNum);
          container.appendChild(wrapper);

          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          wrapper.appendChild(canvas);

          // Observe this page wrapper
          observer.observe(wrapper);

          const viewportWidth = window.innerWidth * 0.95;
          const originalViewport = page.getViewport({ scale: 1.0 });
          const scale = viewportWidth / originalViewport.width;
          const viewport = page.getViewport({ scale: scale });

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          await page.render({
            canvasContext: context,
            viewport: viewport
          }).promise;

          bakeWatermarkOnCanvas(canvas, context, watermarkString);
          createCSSWatermarkOverlay(wrapper, watermarkString);
        }

        // Scroll to the target starting page if provided
        if (startPage && startPage > 1) {
          setTimeout(() => {
            const targetWrapper = document.querySelector(\`[data-page-number="\${startPage}"]\`);
            if (targetWrapper) {
              targetWrapper.scrollIntoView({ behavior: 'smooth' });
            }
          }, 400);
        }

        document.getElementById('loading-overlay').style.display = 'none';

      } catch (err) {
        console.error(err);
        statusText.innerHTML = \`<span style="color: #ef4444;">Decryption Error: \${err.message || 'Verification failed.'}</span>\`;
      }
    }

    function bakeWatermarkOnCanvas(canvas, ctx, watermarkText) {
      ctx.save();
      ctx.globalAlpha = 0.08;
      ctx.font = 'bold 12px sans-serif';
      ctx.fillStyle = '#000000';
      
      const lines = watermarkText.split('\\n');
      const stepX = canvas.width / 2;
      const stepY = canvas.height / 3;

      for (let x = 30; x < canvas.width; x += stepX) {
        for (let y = 50; y < canvas.height; y += stepY) {
          ctx.save();
          ctx.translate(x, y);
          ctx.rotate(-30 * Math.PI / 180);
          lines.forEach((line, index) => {
            ctx.fillText(line, 0, index * 15);
          });
          ctx.restore();
        }
      }
      ctx.restore();
    }

    function createCSSWatermarkOverlay(wrapper, watermarkText) {
      const overlay = document.createElement('div');
      overlay.className = 'watermark-overlay';

      const lines = watermarkText.split('\\n');
      const htmlContent = lines.map(line => \`<div>\${line}</div>\`).join('');

      for (let i = 0; i < 12; i++) {
        const item = document.createElement('div');
        item.className = 'watermark-text';
        item.innerHTML = htmlContent;
        overlay.appendChild(item);
      }

      wrapper.appendChild(overlay);
    }

    window.addEventListener('message', (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'LOAD_PDF') {
          loadSecurePDF(message.encryptedData, message.key, message.watermark, message.startPage);
        }
      } catch (err) {
        console.error('Invalid message received by webview:', err);
      }
    });

    if (window.ReactNativeWebView) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'VIEWER_READY' }));
    }
  </script>
</body>
</html>
`;

export const SecureViewerService = {
  /**
   * Returns the local file URI of the viewer.html file
   */
  getViewerUri(): string {
    return `${VIEWER_DIR}viewer.html`;
  },

  /**
   * Pre-fetch PDF.js scripts and create local HTML file in documents directory
   */
  async ensureViewerAssets(onProgress?: (msg: string) => void): Promise<boolean> {
    try {
      // 1. Create target folder if it doesn't exist
      const dirInfo = await FileSystem.getInfoAsync(VIEWER_DIR);
      if (!dirInfo.exists) {
        onProgress?.('Initializing secure sandbox...');
        await FileSystem.makeDirectoryAsync(VIEWER_DIR, { intermediates: true });
      }

      // 2. Cache PDF.js library file
      const pdfJsPath = `${VIEWER_DIR}pdf.min.js`;
      const pdfJsInfo = await FileSystem.getInfoAsync(pdfJsPath);
      if (!pdfJsInfo.exists) {
        onProgress?.('Caching secure components (Part 1/2)...');
        await FileSystem.downloadAsync(PDF_JS_URL, pdfJsPath);
      }

      // 3. Cache PDF.js worker file
      const workerJsPath = `${VIEWER_DIR}pdf.worker.min.js`;
      const workerJsInfo = await FileSystem.getInfoAsync(workerJsPath);
      if (!workerJsInfo.exists) {
        onProgress?.('Caching secure components (Part 2/2)...');
        await FileSystem.downloadAsync(WORKER_JS_URL, workerJsPath);
      }

      // 4. Write HTML viewer template
      const viewerPath = `${VIEWER_DIR}viewer.html`;
      await FileSystem.writeAsStringAsync(viewerPath, viewerHtml);

      onProgress?.('System ready.');
      return true;
    } catch (error) {
      console.error('Failed to prepare secure viewer assets:', error);
      onProgress?.('Setup failed. Check connection.');
      return false;
    }
  },

  /**
   * Delete viewer assets to free up space
   */
  async clearViewerAssets(): Promise<void> {
    try {
      await FileSystem.deleteAsync(VIEWER_DIR, { idempotent: true });
    } catch (e) {
      console.error(e);
    }
  }
};
