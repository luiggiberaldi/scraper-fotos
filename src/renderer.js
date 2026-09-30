const searchInput = document.getElementById('searchInput');
const btnSearch = document.getElementById('btnSearch');
const loadingState = document.getElementById('loadingState');
const resultsSection = document.getElementById('resultsSection');
const resultsGrid = document.getElementById('resultsGrid');
const resultsTitle = document.getElementById('resultsTitle');
const emptyState = document.getElementById('emptyState');
const noResultsState = document.getElementById('noResultsState');
const btnOpenDownloads = document.getElementById('btnOpenDownloads');
const cacheInfo = document.getElementById('cacheInfo');

// Mode Switcher Elements
const btnModeSuper = document.getElementById('btnModeSuper');
const btnModePharma = document.getElementById('btnModePharma');
const providersContainer = document.getElementById('providersContainer');
const searchMainTitle = document.getElementById('searchMainTitle');
const searchSubTitle = document.getElementById('searchSubTitle');

let currentMode = localStorage.getItem('selectedMode') || 'pharmacy';

const MODE_CONFIG = {
  supermarket: {
    title: 'Buscar Producto',
    subtitle: 'Ingresa el nombre del producto para buscar en supermercados',
    searchPlaceholder: 'Ej: Harina Pan 1kg, Aceite Vegetal, Arroz...',
    batchPlaceholder: 'Harina Pan 1kg\nAceite Vegetal 1L\nArroz Mary 900gr\nLeche Completa 1L\nAzucar Montalban 1kg',
    providers: [
      { name: 'TuZonaMarket', color: '#3b82f6' },
      { name: 'CocoMercado', color: '#10b981' },
      { name: 'InstaMarket', color: '#f59e0b' }
    ]
  },
  pharmacy: {
    title: 'Buscar Medicamento o Insumo',
    subtitle: 'Busca en Farmatodo, Locatel y Catálogo Quirúrgico Especializado',
    searchPlaceholder: 'Ej: Atamel Forte Calox, Apiret, Clexane 40mg, Sutura Vicryl 2-0...',
    batchPlaceholder: 'Atamel Forte Calox 650mg\nApiret 180mg/5ml\nClexane Sanofi 40mg\nSutura Vicryl 2-0 Ethicon\nCalcibon D 30 tabletas',
    providers: [
      { name: 'Farmatodo', color: '#0284c7' },
      { name: 'Locatel', color: '#16a34a' },
      { name: 'Catálogo Quirúrgico', color: '#9333ea' }
    ]
  }
};

function applyMode(mode) {
  currentMode = mode;
  localStorage.setItem('selectedMode', mode);
  
  if (btnModeSuper && btnModePharma) {
    btnModeSuper.classList.toggle('active', mode === 'supermarket');
    btnModePharma.classList.toggle('active', mode === 'pharmacy');
  }

  const config = MODE_CONFIG[mode] || MODE_CONFIG.supermarket;
  if (searchMainTitle) searchMainTitle.textContent = config.title;
  if (searchSubTitle) searchSubTitle.textContent = config.subtitle;
  if (searchInput) searchInput.placeholder = config.searchPlaceholder;
  if (batchInput && !batchInput.value.trim()) batchInput.placeholder = config.batchPlaceholder;

  if (providersContainer) {
    providersContainer.innerHTML = config.providers.map(p => `
      <span class="provider-badge" style="--color: ${p.color}">${p.name}</span>
    `).join('');
  }
}

if (btnModeSuper) btnModeSuper.addEventListener('click', () => applyMode('supermarket'));
if (btnModePharma) btnModePharma.addEventListener('click', () => applyMode('pharmacy'));

// Watermark elements
const watermarkToggle = document.getElementById('watermarkToggle');
const watermarkEnabled = document.getElementById('watermarkEnabled');
const watermarkBody = document.getElementById('watermarkBody');
const watermarkUpload = document.getElementById('watermarkUpload');
const uploadArea = document.getElementById('uploadArea');
const watermarkPreview = document.getElementById('watermarkPreview');
const watermarkPreviewImg = document.getElementById('watermarkPreviewImg');
const btnRemoveWatermark = document.getElementById('btnRemoveWatermark');
const watermarkSize = document.getElementById('watermarkSize');
const watermarkSizeValue = document.getElementById('watermarkSizeValue');
const watermarkOpacity = document.getElementById('watermarkOpacity');
const watermarkOpacityValue = document.getElementById('watermarkOpacityValue');
const watermarkPadding = document.getElementById('watermarkPadding');
const watermarkPaddingValue = document.getElementById('watermarkPaddingValue');
const wmPositionGrid = document.getElementById('wmPositionGrid');

// Background elements
const backgroundToggle = document.getElementById('backgroundToggle');
const backgroundEnabled = document.getElementById('backgroundEnabled');
const backgroundBody = document.getElementById('backgroundBody');
const backgroundColor = document.getElementById('backgroundColor');
const backgroundColorValue = document.getElementById('backgroundColorValue');
const backgroundPadding = document.getElementById('backgroundPadding');
const backgroundPaddingValue = document.getElementById('backgroundPaddingValue');

// Title bar controls
document.getElementById('btn-minimize').addEventListener('click', () => window.api.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => window.api.maximize());
document.getElementById('btn-close').addEventListener('click', () => window.api.close());

// Tab Navigation
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    const tabId = `tab-${btn.dataset.tab}`;
    document.getElementById(tabId).classList.add('active');
  });
});

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// Virtual Scroll State
let allItems = [];
let renderedCount = 0;
const BATCH_SIZE = 12;
let isLoadingMore = false;

// Cache stats
async function updateCacheInfo() {
  try {
    const stats = await window.api.getCacheStats();
    cacheInfo.textContent = `Cache: ${stats.count} búsquedas (${stats.sizeKB}KB)`;
  } catch {
    cacheInfo.textContent = '';
  }
}

// Watermark functions
let watermarkEnabledState = false;
let watermarkPosition = 'top-left';

async function loadWatermarkSettings() {
  try {
    const settings = await window.api.getWatermark();
    watermarkEnabledState = settings.enabled;

    if (settings.enabled) {
      watermarkEnabled.classList.add('watermark-enabled');
    }

    if (settings.imagePath) {
      watermarkPreviewImg.src = settings.imagePath;
      watermarkPreview.classList.remove('hidden');
      uploadArea.classList.add('hidden');
    }

    watermarkSize.value = settings.sizePercent;
    watermarkSizeValue.textContent = `${settings.sizePercent}%`;

    watermarkOpacity.value = settings.opacity;
    watermarkOpacityValue.textContent = `${settings.opacity}%`;

    watermarkPadding.value = settings.padding;
    watermarkPaddingValue.textContent = `${settings.padding}px`;

    // Load position
    if (settings.position) {
      watermarkPosition = settings.position;
      wmPositionGrid.querySelectorAll('.wm-pos-cell').forEach(cell => {
        cell.classList.toggle('active', cell.dataset.pos === watermarkPosition);
      });
    }
  } catch {}
}

async function saveWatermarkSettings() {
  const settings = {
    enabled: watermarkEnabledState,
    sizePercent: parseInt(watermarkSize.value),
    opacity: parseInt(watermarkOpacity.value),
    padding: parseInt(watermarkPadding.value),
    position: watermarkPosition
  };
  await window.api.updateWatermark(settings);
}

// Background functions
let backgroundEnabledState = false;

async function loadBackgroundSettings() {
  try {
    const settings = await window.api.getBackground();
    backgroundEnabledState = settings.enabled;

    if (settings.enabled) {
      backgroundEnabled.classList.add('background-enabled');
    }

    backgroundColor.value = settings.color;
    backgroundColorValue.textContent = settings.color;

    backgroundPadding.value = settings.padding;
    backgroundPaddingValue.textContent = `${settings.padding}px`;
  } catch {}
}

async function saveBackgroundSettings() {
  const settings = {
    enabled: backgroundEnabledState,
    color: backgroundColor.value,
    padding: parseInt(backgroundPadding.value)
  };
  await window.api.updateBackground(settings);
}

// Watermark toggle
watermarkToggle.addEventListener('click', async () => {
  watermarkEnabledState = !watermarkEnabledState;
  watermarkEnabled.classList.toggle('watermark-enabled');
  watermarkBody.classList.toggle('hidden');
  await saveWatermarkSettings();
});

// Background toggle
backgroundToggle.addEventListener('click', async () => {
  backgroundEnabledState = !backgroundEnabledState;
  backgroundEnabled.classList.toggle('background-enabled');
  backgroundBody.classList.toggle('hidden');
  await saveBackgroundSettings();
});

// Background settings
backgroundColor.addEventListener('input', (e) => {
  backgroundColorValue.textContent = e.target.value;
  saveBackgroundSettings();
});

backgroundPadding.addEventListener('input', (e) => {
  backgroundPaddingValue.textContent = `${e.target.value}px`;
  saveBackgroundSettings();
});

// Upload area click - use Electron dialog directly
uploadArea.addEventListener('click', async () => {
  try {
    const imagePath = await window.api.selectWatermarkImage();
    if (imagePath) {
      watermarkPreviewImg.src = imagePath;
      watermarkPreview.classList.remove('hidden');
      uploadArea.classList.add('hidden');
      watermarkEnabledState = true;
      watermarkEnabled.classList.add('watermark-enabled');
      await saveWatermarkSettings();
      showToast('Marca de agua configurada', 'success');
    }
  } catch (err) {
    showToast('Error al seleccionar imagen', 'error');
  }
});

// Remove watermark
btnRemoveWatermark.addEventListener('click', async (e) => {
  e.stopPropagation();
  await window.api.removeWatermark();
  watermarkPreview.classList.add('hidden');
  uploadArea.classList.remove('hidden');
  watermarkPreviewImg.src = '';
  watermarkEnabledState = false;
  watermarkEnabled.classList.remove('watermark-enabled');
  showToast('Marca de agua eliminada', 'info');
});

// Range inputs
watermarkSize.addEventListener('input', (e) => {
  watermarkSizeValue.textContent = `${e.target.value}%`;
  saveWatermarkSettings();
});

watermarkOpacity.addEventListener('input', (e) => {
  watermarkOpacityValue.textContent = `${e.target.value}%`;
  saveWatermarkSettings();
});

watermarkPadding.addEventListener('input', (e) => {
  watermarkPaddingValue.textContent = `${e.target.value}px`;
  saveWatermarkSettings();
});

// Position grid
wmPositionGrid.querySelectorAll('.wm-pos-cell').forEach(cell => {
  cell.addEventListener('click', () => {
    wmPositionGrid.querySelectorAll('.wm-pos-cell').forEach(c => c.classList.remove('active'));
    cell.classList.add('active');
    watermarkPosition = cell.dataset.pos;
    saveWatermarkSettings();
  });
});

// Search
async function doSearch() {
  const query = searchInput.value.trim();
  if (!query) {
    searchInput.focus();
    return;
  }

  loadingState.classList.remove('hidden');
  resultsSection.classList.add('hidden');
  emptyState.classList.add('hidden');
  noResultsState.classList.add('hidden');
  btnSearch.disabled = true;

  try {
    const { results, fromCache } = await window.api.searchImages({ query, mode: currentMode });

    loadingState.classList.add('hidden');

    if (fromCache) {
      showToast('Resultados cargados desde cache', 'info');
    }

    if (results.length === 0) {
      noResultsState.classList.remove('hidden');
      return;
    }

    resultsTitle.textContent = `${results.length} resultados para "${query}"`;
    allItems = results;
    renderedCount = 0;
    resultsGrid.innerHTML = '';

    // Initial batch
    renderBatch();

    resultsSection.classList.remove('hidden');
    updateCacheInfo();
  } catch (error) {
    loadingState.classList.add('hidden');
    showToast('Error al buscar: ' + error.message, 'error');
  } finally {
    btnSearch.disabled = false;
  }
}

// Render batch of items (virtual scroll)
function renderBatch() {
  const end = Math.min(renderedCount + BATCH_SIZE, allItems.length);
  const fragment = document.createDocumentFragment();

  for (let i = renderedCount; i < end; i++) {
    const card = createResultCard(allItems[i]);
    fragment.appendChild(card);
  }

  resultsGrid.appendChild(fragment);
  renderedCount = end;
}

// Intersection Observer for infinite scroll
const scrollObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting && renderedCount < allItems.length && !isLoadingMore) {
      isLoadingMore = true;
      setTimeout(() => {
        renderBatch();
        isLoadingMore = false;
      }, 100);
    }
  });
}, { threshold: 0.1 });

// Create sentinel element for scroll observation
const scrollSentinel = document.createElement('div');
scrollSentinel.className = 'scroll-sentinel';
resultsGrid.parentElement.appendChild(scrollSentinel);
scrollObserver.observe(scrollSentinel);

function createResultCard(item) {
  const card = document.createElement('div');
  card.className = 'result-card';

  // Generate blur placeholder color
  const hue = hashString(item.src) % 360;
  const placeholderColor = `hsl(${hue}, 30%, 20%)`;

  card.innerHTML = `
    <div class="card-image" style="background:${placeholderColor}">
      <div class="blur-placeholder"></div>
      <img data-src="${item.src}" alt="" class="lazy-img">
      <span class="card-score">${item.score.toFixed(1)}</span>
      <span class="card-provider" style="color:${item.color}">${item.provider}</span>
    </div>
    <div class="card-body">
      <div class="card-title">${item.title || 'Sin titulo'}</div>
      <div class="card-actions">
        <button class="btn-download" data-url="${item.src}" data-title="${item.title || ''}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Descargar
        </button>
        <button class="btn-open" data-url="${item.src}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
            <polyline points="15 3 21 3 21 9"/>
            <line x1="10" y1="14" x2="21" y2="3"/>
          </svg>
        </button>
      </div>
    </div>
  `;

  // Lazy load image with blur-up effect
  const img = card.querySelector('.lazy-img');
  const blurPlaceholder = card.querySelector('.blur-placeholder');

  const imageObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const imgEl = entry.target;
        const src = imgEl.dataset.src;

        const tempImg = new Image();
        tempImg.onload = () => {
          imgEl.src = src;
          imgEl.classList.add('loaded');
          blurPlaceholder.classList.add('loaded');
        };
        tempImg.onerror = () => {
          blurPlaceholder.innerHTML = '<span>Error</span>';
        };
        tempImg.src = src;

        imageObserver.unobserve(imgEl);
      }
    });
  }, { rootMargin: '100px' });

  imageObserver.observe(img);

  // Download button
  const btnDownload = card.querySelector('.btn-download');
  btnDownload.addEventListener('click', async (e) => {
    e.stopPropagation();
    const url = btnDownload.dataset.url;
    const title = btnDownload.dataset.title;

    btnDownload.disabled = true;
    btnDownload.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
        <circle cx="12" cy="12" r="10"/>
      </svg>
      Descargando...
    `;

    try {
      const filepath = await window.api.downloadImage(url, title);
      btnDownload.classList.add('downloaded');
      btnDownload.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
        Guardado
      `;
      showToast('Imagen descargada correctamente', 'success');

      // Reset button after 2 seconds to allow re-download
      setTimeout(() => {
        btnDownload.disabled = false;
        btnDownload.classList.remove('downloaded');
        btnDownload.innerHTML = `
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Descargar
        `;
      }, 2000);
    } catch (error) {
      btnDownload.disabled = false;
      btnDownload.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
          <polyline points="7 10 12 15 17 10"/>
          <line x1="12" y1="15" x2="12" y2="3"/>
        </svg>
        Descargar
      `;
      showToast('Error al descargar: ' + error.message, 'error');
    }
  });

  // Open folder button
  const btnOpen = card.querySelector('.btn-open');
  btnOpen.addEventListener('click', (e) => {
    e.stopPropagation();
    window.api.openDownloads();
  });

  return card;
}

// Simple string hash for placeholder colors
function hashString(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return Math.abs(hash);
}

// Event listeners
btnSearch.addEventListener('click', doSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});

btnOpenDownloads.addEventListener('click', () => window.api.openDownloads());

// Clear cache button
document.getElementById('btnClearCache')?.addEventListener('click', async () => {
  await window.api.clearCache();
  showToast('Cache limpiada', 'success');
  updateCacheInfo();
});

// === BATCH DOWNLOAD ===
const batchInput = document.getElementById('batchInput');
const batchCount = document.getElementById('batchCount');
const btnBatchDownload = document.getElementById('btnBatchDownload');
const btnBatchClear = document.getElementById('btnBatchClear');
const batchProgress = document.getElementById('batchProgress');
const batchProgressText = document.getElementById('batchProgressText');
const batchProgressPercent = document.getElementById('batchProgressPercent');
const batchProgressBar = document.getElementById('batchProgressBar');
const batchLog = document.getElementById('batchLog');

// Update product count
batchInput.addEventListener('input', () => {
  const lines = batchInput.value.split('\n').filter(l => l.trim());
  batchCount.textContent = `${lines.length} producto${lines.length !== 1 ? 's' : ''}`;
});

// Clear batch input
btnBatchClear.addEventListener('click', () => {
  batchInput.value = '';
  batchCount.textContent = '0 productos';
  batchLog.innerHTML = '';
  batchProgress.classList.add('hidden');
});

// Import markdown / CSV file
const btnBatchImportMd = document.getElementById('btnBatchImportMd');
btnBatchImportMd.addEventListener('click', async () => {
  try {
    const result = await window.api.importMd();
    if (result && result.products && result.products.length > 0) {
      // Append to existing products
      const existing = batchInput.value.split('\n').filter(l => l.trim());
      const newProducts = [...existing, ...result.products];
      batchInput.value = newProducts.join('\n');
      batchCount.textContent = `${newProducts.length} producto${newProducts.length !== 1 ? 's' : ''}`;
      
      const lowerFile = (result.filename || '').toLowerCase();
      if (lowerFile.endsWith('.csv') || lowerFile.includes('farmacia') || lowerFile.includes('medic')) {
        applyMode('pharmacy');
      }

      showToast(`${result.products.length} productos importados desde ${result.filename}`, 'success');
    } else if (result) {
      showToast('No se encontraron productos en el archivo', 'error');
    }
  } catch (err) {
    showToast('Error al importar archivo: ' + err.message, 'error');
  }
});

// Batch watermark toggle
const batchWatermarkToggle = document.getElementById('batchWatermarkToggle');
let batchWatermarkEnabled = watermarkEnabledState;

// Sync with main watermark state
function syncBatchWatermarkState() {
  batchWatermarkEnabled = watermarkEnabledState;
  if (batchWatermarkEnabled) {
    batchWatermarkToggle.classList.add('batch-wm-active');
  } else {
    batchWatermarkToggle.classList.remove('batch-wm-active');
  }
}

batchWatermarkToggle.addEventListener('click', async () => {
  batchWatermarkEnabled = !batchWatermarkEnabled;
  // Also update main watermark state
  watermarkEnabledState = batchWatermarkEnabled;
  if (batchWatermarkEnabled) {
    batchWatermarkToggle.classList.add('batch-wm-active');
    watermarkEnabled.classList.add('watermark-enabled');
    watermarkBody.classList.remove('hidden');
  } else {
    batchWatermarkToggle.classList.remove('batch-wm-active');
    watermarkEnabled.classList.remove('watermark-enabled');
    watermarkBody.classList.add('hidden');
  }
  await saveWatermarkSettings();
});

// Images per product control
const btnImagesMinus = document.getElementById('btnImagesMinus');
const btnImagesPlus = document.getElementById('btnImagesPlus');
const batchImagesValue = document.getElementById('batchImagesValue');
let imagesPerProduct = 1;

btnImagesMinus.addEventListener('click', () => {
  if (imagesPerProduct > 1) {
    imagesPerProduct--;
    batchImagesValue.textContent = imagesPerProduct;
  }
});

btnImagesPlus.addEventListener('click', () => {
  if (imagesPerProduct < 10) {
    imagesPerProduct++;
    batchImagesValue.textContent = imagesPerProduct;
  }
});

// Initial sync
syncBatchWatermarkState();

// Batch download
let isBatchRunning = false;
let batchProgressCleanup = null;

btnBatchDownload.addEventListener('click', async () => {
  if (isBatchRunning) return;

  const lines = batchInput.value.split('\n').filter(l => l.trim());
  if (lines.length === 0) {
    showToast('Escribe al menos un producto', 'error');
    return;
  }

  isBatchRunning = true;
  btnBatchDownload.disabled = true;
  btnBatchDownload.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
      <circle cx="12" cy="12" r="10"/>
    </svg>
    Procesando...
  `;

  batchProgress.classList.remove('hidden');
  batchLog.innerHTML = '';
  batchProgressBar.style.width = '0%';

  // Clean up previous listener if exists
  if (batchProgressCleanup) {
    batchProgressCleanup();
  }

  // Listen for progress updates
  const cleanupProgress = window.api.onBatchProgress((data) => {
    const percent = Math.round((data.current / data.total) * 100);
    batchProgressText.textContent = `Procesando ${data.current}/${data.total}: ${data.product}`;
    batchProgressPercent.textContent = `${percent}%`;
    batchProgressBar.style.width = `${percent}%`;

    // Add log entry
    const logEntry = document.createElement('div');
    logEntry.className = `batch-log-entry batch-log-${data.status}`;

    let icon = '';
    let message = '';

    switch (data.status) {
      case 'searching':
        icon = '🔍';
        message = `Buscando "${data.product}"...`;
        break;
      case 'downloading':
        icon = '⬇️';
        const variationText = data.variation && data.variation !== 'original' ? ` (${data.variation})` : '';
        const duplicateText = data.isDuplicate ? ' ⚠️ Posible duplicado' : '';
        const imageIndexText = data.totalImages > 1 ? ` [${data.imageIndex}/${data.totalImages}]` : '';
        message = `Descargando${variationText}${imageIndexText}: "${data.product}"${duplicateText}`;
        break;
      case 'completed':
        icon = data.isDuplicate ? '⚠️' : '✅';
        const dupWarning = data.isDuplicate ? ' [DUPLICADO]' : '';
        const imgNum = data.totalImages > 1 ? ` (${data.imageIndex}/${data.totalImages})` : '';
        message = `Guardado: ${data.filename}${imgNum}${dupWarning}`;
        break;
      case 'no_results':
        icon = '❌';
        const cachedText = data.cached ? ' [cache]' : '';
        message = `Sin resultados para "${data.product}"${cachedText}`;
        break;
      case 'error':
        icon = '⚠️';
        message = `Error: ${data.error}`;
        break;
    }

    logEntry.innerHTML = `
      <span class="log-icon">${icon}</span>
      <span class="log-message">${message}</span>
    `;
    batchLog.appendChild(logEntry);
    batchLog.scrollTop = batchLog.scrollHeight;
  });

  // Store cleanup function
  batchProgressCleanup = cleanupProgress;

  try {
    const results = await window.api.batchDownload(lines, imagesPerProduct, currentMode);

    // Summary
    const downloaded = results.filter(r => r.downloaded).length;
    const errors = results.filter(r => r.status === 'error').length;
    const noResults = results.filter(r => r.status === 'no_results' || r.status === 'no_results_cached').length;
    const duplicates = results.filter(r => r.isDuplicate).length;
    const variations = results.filter(r => r.variation && r.variation !== 'original').length;

    let summary = `Descarga completada: ${downloaded} exitosas`;
    if (noResults > 0) summary += `, ${noResults} sin resultados`;
    if (errors > 0) summary += `, ${errors} errores`;
    if (duplicates > 0) summary += `, ${duplicates} duplicados`;
    if (variations > 0) summary += ` (${variations} con variación)`;

    showToast(summary, downloaded > 0 ? 'success' : 'info');
    updateCacheInfo();
  } catch (error) {
    showToast('Error en descarga masiva: ' + error.message, 'error');
  } finally {
    isBatchRunning = false;
    btnBatchDownload.disabled = false;
    btnBatchDownload.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Descargar Todo
    `;
  }
});

// === BATCH WATERMARK (Local Images) ===
const wmBatchDropZone = document.getElementById('wmBatchDropZone');
const wmBatchFileList = document.getElementById('wmBatchFileList');
const btnWmSelectOutput = document.getElementById('btnWmSelectOutput');
const wmOutputFolder = document.getElementById('wmOutputFolder');
const btnWmBatchApply = document.getElementById('btnWmBatchApply');
const btnWmBatchClear = document.getElementById('btnWmBatchClear');
const wmBatchProgress = document.getElementById('wmBatchProgress');
const wmBatchProgressText = document.getElementById('wmBatchProgressText');
const wmBatchProgressPercent = document.getElementById('wmBatchProgressPercent');
const wmBatchProgressBar = document.getElementById('wmBatchProgressBar');
const wmBatchLog = document.getElementById('wmBatchLog');

let wmBatchFiles = [];
let wmBatchOutputPath = '';
let isWmBatchRunning = false;

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function renderWmFileList() {
  if (wmBatchFiles.length === 0) {
    wmBatchFileList.classList.add('hidden');
    wmBatchDropZone.classList.remove('hidden');
    btnWmBatchApply.disabled = true;
    return;
  }

  wmBatchDropZone.classList.add('hidden');
  wmBatchFileList.classList.remove('hidden');
  wmBatchFileList.innerHTML = '';

  wmBatchFiles.forEach((file, index) => {
    const item = document.createElement('div');
    item.className = 'wm-file-item';
    const name = file.name || file.path.split(/[\\/]/).pop();
    const size = file.size ? formatFileSize(file.size) : '';
    item.innerHTML = `
      <svg class="wm-file-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
      <span class="wm-file-name" title="${file.path}">${name}</span>
      <span class="wm-file-size">${size}</span>
      <button class="wm-file-remove" data-index="${index}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `;
    wmBatchFileList.appendChild(item);
  });

  wmBatchFileList.querySelectorAll('.wm-file-remove').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index);
      wmBatchFiles.splice(idx, 1);
      renderWmFileList();
    });
  });

  btnWmBatchApply.disabled = !(wmBatchFiles.length > 0 && wmBatchOutputPath);
}

// Drop zone click
wmBatchDropZone.addEventListener('click', async () => {
  const files = await window.api.selectWatermarkImages();
  if (files && files.length > 0) {
    const fileObjects = files.map(f => ({
      path: f,
      name: f.split(/[\\/]/).pop(),
      size: 0
    }));
    wmBatchFiles = wmBatchFiles.concat(fileObjects);
    renderWmFileList();
  }
});

// Drag and drop
wmBatchDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  wmBatchDropZone.classList.add('drag-over');
});

wmBatchDropZone.addEventListener('dragleave', () => {
  wmBatchDropZone.classList.remove('drag-over');
});

wmBatchDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  wmBatchDropZone.classList.remove('drag-over');

  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
    const validExts = ['.jpg', '.jpeg', '.png', '.webp'];
    const newFiles = [];

    for (const file of e.dataTransfer.files) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      if (validExts.includes(ext)) {
        newFiles.push({
          path: file.path,
          name: file.name,
          size: file.size
        });
      }
    }

    if (newFiles.length > 0) {
      wmBatchFiles = wmBatchFiles.concat(newFiles);
      renderWmFileList();
    } else {
      showToast('Solo se permiten archivos JPG, PNG y WebP', 'error');
    }
  }
});

// Select output folder
btnWmSelectOutput.addEventListener('click', async () => {
  const folder = await window.api.selectWatermarkOutput();
  if (folder) {
    wmBatchOutputPath = folder;
    wmOutputFolder.textContent = folder;
    wmOutputFolder.title = folder;
    btnWmBatchApply.disabled = !(wmBatchFiles.length > 0);
  }
});

// Apply batch watermark
btnWmBatchApply.addEventListener('click', async () => {
  if (isWmBatchRunning) return;
  if (wmBatchFiles.length === 0) {
    showToast('Selecciona al menos una imagen', 'error');
    return;
  }
  if (!wmBatchOutputPath) {
    showToast('Selecciona una carpeta de destino', 'error');
    return;
  }

  isWmBatchRunning = true;
  btnWmBatchApply.disabled = true;
  btnWmBatchApply.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
      <circle cx="12" cy="12" r="10"/>
    </svg>
    Procesando...
  `;

  wmBatchProgress.classList.remove('hidden');
  wmBatchLog.innerHTML = '';
  wmBatchProgressBar.style.width = '0%';

  window.api.onBatchWatermarkProgress((data) => {
    const percent = Math.round((data.current / data.total) * 100);
    wmBatchProgressText.textContent = `Procesando ${data.current}/${data.total}: ${data.filename}`;
    wmBatchProgressPercent.textContent = `${percent}%`;
    wmBatchProgressBar.style.width = `${percent}%`;

    const logEntry = document.createElement('div');
    logEntry.className = `batch-log-entry batch-log-${data.status}`;

    let icon = '';
    let message = '';

    switch (data.status) {
      case 'processing':
        icon = '⏳';
        message = `Procesando "${data.filename}"...`;
        break;
      case 'completed':
        icon = '✅';
        message = `Guardado: ${data.filename}`;
        break;
      case 'error':
        icon = '⚠️';
        message = `Error en ${data.filename}: ${data.error}`;
        break;
    }

    logEntry.innerHTML = `
      <span class="log-icon">${icon}</span>
      <span class="log-message">${message}</span>
    `;
    wmBatchLog.appendChild(logEntry);
    wmBatchLog.scrollTop = wmBatchLog.scrollHeight;
  });

  try {
    const results = await window.api.batchWatermark({
      files: wmBatchFiles.map(f => f.path),
      outputFolder: wmBatchOutputPath
    });

    const completed = results.filter(r => r.status === 'completed').length;
    const errors = results.filter(r => r.status === 'error').length;
    showToast(`Marca de agua aplicada: ${completed} exitosas, ${errors} errores`, completed > 0 ? 'success' : 'info');
  } catch (error) {
    showToast('Error en marca de agua por lote: ' + error.message, 'error');
  } finally {
    isWmBatchRunning = false;
    btnWmBatchApply.disabled = false;
    btnWmBatchApply.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
      </svg>
      Aplicar Marca de Agua
    `;
  }
});

// Clear batch watermark
btnWmBatchClear.addEventListener('click', () => {
  wmBatchFiles = [];
  wmBatchOutputPath = '';
  wmOutputFolder.textContent = 'No seleccionada';
  wmOutputFolder.title = '';
  wmBatchLog.innerHTML = '';
  wmBatchProgress.classList.add('hidden');
  renderWmFileList();
});

// Init
applyMode(currentMode);
searchInput.focus();
updateCacheInfo();
loadWatermarkSettings();
loadBackgroundSettings();
