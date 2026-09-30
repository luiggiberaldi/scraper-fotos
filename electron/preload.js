const { contextBridge, ipcRenderer } = require('electron');

// Store listeners for cleanup
const listeners = new Map();

contextBridge.exposeInMainWorld('api', {
  searchImages: (query, mode = 'supermarket') => {
    if (typeof query === 'object' && query !== null) {
      return ipcRenderer.invoke('search-images', query);
    }
    return ipcRenderer.invoke('search-images', { query, mode });
  },
  downloadImage: (url, name) => ipcRenderer.invoke('download-image', { url, name }),
  openDownloads: () => ipcRenderer.invoke('open-downloads'),

  // Batch
  batchDownload: (products, imagesPerProduct, mode = 'supermarket') => ipcRenderer.invoke('batch-download', { products, imagesPerProduct, mode }),
  onBatchProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('batch-progress', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('batch-progress', handler);
    };
  },
  importMd: () => ipcRenderer.invoke('import-md'),

  // Watermark
  getWatermark: () => ipcRenderer.invoke('watermark-get'),
  updateWatermark: (settings) => ipcRenderer.invoke('watermark-update', settings),
  selectWatermarkImage: () => ipcRenderer.invoke('watermark-select-image'),
  removeWatermark: () => ipcRenderer.invoke('watermark-remove'),

  // Background
  getBackground: () => ipcRenderer.invoke('background-get'),
  updateBackground: (settings) => ipcRenderer.invoke('background-update', settings),

  // Batch Watermark (local images)
  selectWatermarkImages: () => ipcRenderer.invoke('wm-batch-select-images'),
  selectWatermarkOutput: () => ipcRenderer.invoke('wm-batch-select-output'),
  batchWatermark: (opts) => ipcRenderer.invoke('wm-batch-apply', opts),
  onBatchWatermarkProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('wm-batch-progress', handler);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener('wm-batch-progress', handler);
    };
  },

  // Batch Background (local images)
  selectBackgroundImages: () => ipcRenderer.invoke('bg-batch-select-images'),
  selectBackgroundOutput: () => ipcRenderer.invoke('bg-batch-select-output'),
  batchBackground: (opts) => ipcRenderer.invoke('bg-batch-apply', opts),
  onBatchBackgroundProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('bg-batch-progress', handler);
    return () => {
      ipcRenderer.removeListener('bg-batch-progress', handler);
    };
  },

  // Cache
  getCacheStats: () => ipcRenderer.invoke('cache-stats'),
  clearCache: () => ipcRenderer.invoke('cache-clear'),

  // Window
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close')
});
