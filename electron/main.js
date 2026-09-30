const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const sharp = require('sharp');
const crypto = require('crypto');
const cache = require('./cache');
const watermark = require('./watermark');
const background = require('./background');
const { normalizeQuery, scoreResult, detectCategory, detectProblematicCategory, generateQueryVariations } = require('./search');

const DOWNLOAD_DIR = path.join(__dirname, '..', 'downloads');

let mainWindow;
let persistentBrowser = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Buscador de Fotos - Supermercados VE',
    icon: path.join(__dirname, '..', 'src', 'icon.png'),
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#0f172a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  mainWindow.setMenuBarVisibility(false);
}

async function getPersistentBrowser() {
  if (persistentBrowser && persistentBrowser.isConnected()) {
    return persistentBrowser;
  }
  const puppeteer = require('puppeteer');
  persistentBrowser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  return persistentBrowser;
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (persistentBrowser) {
    persistentBrowser.close().catch(() => {});
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// Window controls
ipcMain.on('window-minimize', () => mainWindow.minimize());
ipcMain.on('window-maximize', () => {
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.on('window-close', () => mainWindow.close());

// --- Scraper Logic ---
const SUPERMARKET_PROVIDERS = [
  {
    name: 'TuZonaMarket',
    url: (q) => `https://tuzonamarket.com/carabobo/buscar?q=${encodeURIComponent(q)}`,
    selector: '.item-img img',
    color: '#3b82f6',
    type: 'dom'
  },
  {
    name: 'CocoMercado',
    url: (q) => `https://www.cocomercado.com/search?q=${encodeURIComponent(q)}`,
    selector: '.card__img img',
    color: '#10b981',
    type: 'dom'
  },
  {
    name: 'InstaMarket',
    url: (q) => `https://instamarketca.com/?s=${encodeURIComponent(q)}&post_type=product`,
    selector: '.box-image img',
    color: '#f59e0b',
    type: 'dom'
  }
];

const PHARMACY_PROVIDERS = [
  {
    name: 'Farmatodo',
    url: (q) => `https://www.farmatodo.com.ve/buscar?product=${encodeURIComponent(q)}`,
    color: '#0284c7',
    type: 'farmatodo'
  },
  {
    name: 'Locatel',
    url: (q) => `https://www.locatel.com.ve/${encodeURIComponent(q)}?_q=${encodeURIComponent(q)}&map=ft`,
    color: '#16a34a',
    type: 'locatel'
  },
  {
    name: 'Catálogo Médico',
    url: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q + ' farmacia producto')}&iax=images&ia=images`,
    color: '#9333ea',
    type: 'medical'
  }
];

function getProviders(mode = 'supermarket') {
  return mode === 'pharmacy' ? PHARMACY_PROVIDERS : SUPERMARKET_PROVIDERS;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const EXTRACT_SCRIPT = (selector) => `
  (async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 15; i++) {
      const images = Array.from(document.querySelectorAll('${selector}'));
      const valid = images.filter(img => img.src && img.src.startsWith('http') && img.offsetWidth > 0);
      if (valid.length > 0) {
        return valid.map(img => {
          let title = img.alt || img.title || '';
          if (!title || title.length < 5 || title.toLowerCase().includes('imagen')) {
            let current = img;
            for (let k = 0; k < 5; k++) {
              if (!current.parentElement) break;
              current = current.parentElement;
              if (current.innerText && current.innerText.length > 10) {
                const lines = current.innerText.split('\\n')
                  .map(l => l.trim())
                  .filter(l => l.length > 5 && !l.includes('$') && !l.includes('Bs') && !l.includes('%') && !l.toLowerCase().includes('agregar'));
                if (lines.length > 0) { title = lines[0]; break; }
              }
            }
          }
          title = (title || '').replace(/[\\n\\t]/g, ' ').trim();
          return { src: img.src, title };
        }).slice(0, 20);
      }
      await sleep(400);
    }
    return [];
  })()
`;

const EXTRACT_FARMATODO = `
  (async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 15; i++) {
      const images = Array.from(document.querySelectorAll('img'))
        .filter(img => img.src && (img.src.includes('googleusercontent') || img.src.includes('farmatodo')) && !img.src.includes('logo') && !img.src.includes('icon') && !img.src.includes('banner') && img.offsetWidth > 25);
      
      if (images.length > 0) {
        return images.map(img => {
          let title = img.alt || img.title || '';
          if (!title || title.length < 5) {
            let cur = img;
            for (let k = 0; k < 6; k++) {
              if (!cur.parentElement) break;
              cur = cur.parentElement;
              const textEls = cur.querySelectorAll('h2, h3, h4, p, a, span');
              for (const el of textEls) {
                const t = (el.innerText || '').trim();
                if (t.length > 8 && !t.includes('$') && !t.includes('Bs') && !t.includes('%') && !t.toLowerCase().includes('agregar')) {
                  title = t;
                  break;
                }
              }
              if (title && title.length > 5) break;
            }
          }
          return {
            src: img.src,
            title: (title || '').replace(/[\\n\\t]/g, ' ').trim()
          };
        }).slice(0, 20);
      }
      await sleep(350);
    }
    return [];
  })()
`;

const EXTRACT_LOCATEL = `
  (async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 15; i++) {
      const images = Array.from(document.querySelectorAll('img'))
        .filter(img => img.src && (img.src.includes('vtexassets') || img.src.includes('vteximg') || img.src.includes('arquivos')) && !img.src.includes('logo') && !img.src.includes('icon') && !img.src.includes('footer') && img.offsetWidth > 25);
      
      if (images.length > 0) {
        return images.map(img => {
          let title = img.alt || img.title || '';
          if (!title || title.length < 5) {
            let cur = img;
            for (let k = 0; k < 6; k++) {
              if (!cur.parentElement) break;
              cur = cur.parentElement;
              const nameEl = cur.querySelector('.vtex-product-summary-2-x-nameContainer, .vtex-product-summary-2-x-productBrand, [class*="productBrand"], [class*="productName"]');
              if (nameEl && nameEl.innerText) {
                title = nameEl.innerText.trim();
                break;
              }
            }
          }
          let src = img.src;
          src = src.replace(/-\\d+-\\d+/g, '-800-800').replace(/width=\\d+/g, 'width=800').replace(/height=\\d+/g, 'height=800');
          return {
            src,
            title: (title || '').replace(/[\\n\\t]/g, ' ').trim()
          };
        }).slice(0, 20);
      }
      await sleep(350);
    }
    return [];
  })()
`;

const EXTRACT_MEDICAL = `
  (async () => {
    const sleep = (ms) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 15; i++) {
      const tiles = Array.from(document.querySelectorAll('.tile--img, .tile--img__img, img[src*="duckduckgo.com/iu/?u="]'));
      if (tiles.length > 0) {
        const results = [];
        for (const tile of tiles) {
          const img = tile.tagName === 'IMG' ? tile : tile.querySelector('img');
          if (!img || !img.src) continue;
          let rawSrc = img.src;
          const match = rawSrc.match(/u=(http[^&]+)/);
          const realSrc = match ? decodeURIComponent(match[1]) : rawSrc;
          let title = img.alt || tile.getAttribute('data-title') || '';
          if (!title && tile.innerText) title = tile.innerText.trim();
          if (realSrc && realSrc.startsWith('http') && !results.some(r => r.src === realSrc)) {
            results.push({
              src: realSrc,
              title: (title || '').replace(/[\\n\\t]/g, ' ').trim()
            });
          }
        }
        if (results.length > 0) return results.slice(0, 20);
      }
      await sleep(350);
    }
    return [];
  })()
`;

async function searchProvider(provider, query) {
  const browser = await getPersistentBrowser();
  const page = await browser.newPage();

  await page.setUserAgent(USER_AGENT);
  await page.setRequestInterception(true);

  // Block heavy fonts and media
  page.on('request', (req) => {
    const type = req.resourceType();
    if (['font', 'media'].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  try {
    const url = provider.url(query);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });
    
    let extractScript = EXTRACT_SCRIPT(provider.selector);
    if (provider.type === 'farmatodo') extractScript = EXTRACT_FARMATODO;
    else if (provider.type === 'locatel') extractScript = EXTRACT_LOCATEL;
    else if (provider.type === 'medical') extractScript = EXTRACT_MEDICAL;

    const results = await page.evaluate(extractScript);
    return (results || []).map(r => ({ ...r, provider: provider.name, color: provider.color }));
  } catch (err) {
    return [];
  } finally {
    await page.close();
  }
}

// Cache IPC
ipcMain.handle('cache-stats', () => cache.getStats());
ipcMain.handle('cache-clear', () => cache.clear());

// Search IPC
ipcMain.handle('search-images', async (event, args) => {
  const query = typeof args === 'string' ? args : (args && args.query ? args.query : '');
  const mode = (typeof args === 'object' && args && args.mode) ? args.mode : 'supermarket';
  const cacheKey = `${mode}:${query}`;

  // Check cache first
  const cached = cache.get(cacheKey);
  if (cached) {
    return { results: cached, fromCache: true };
  }

  const providers = getProviders(mode);

  // Search all providers in parallel
  const searches = providers.map(p => searchProvider(p, query));
  const results = await Promise.all(searches);
  const all = results.flat();

  const ranked = all
    .map(item => ({ ...item, score: scoreResult(query, item.title) }))
    .filter(item => item.score > 0.08)
    .sort((a, b) => b.score - a.score);

  // Save to cache
  if (ranked.length > 0) {
    cache.set(cacheKey, ranked);
  }

  return { results: ranked, fromCache: false };
});

// Watermark IPC
ipcMain.handle('watermark-get', () => watermark.get());
ipcMain.handle('watermark-update', (event, settings) => watermark.update(settings));
ipcMain.handle('watermark-select-image', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar imagen de marca de agua',
    filters: [
      { name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  const dest = watermark.setImage(filePath);
  return dest;
});
ipcMain.handle('watermark-remove', () => {
  watermark.removeImage();
  return true;
});

// Background IPC
ipcMain.handle('background-get', () => background.get());
ipcMain.handle('background-update', (event, settings) => background.update(settings));

// --- Batch Watermark (local images) ---
ipcMain.handle('wm-batch-select-images', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar imagenes para marca de agua',
    filters: [
      { name: 'Imagenes', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
    ],
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled) return null;
  return result.filePaths;
});

ipcMain.handle('wm-batch-select-output', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar carpeta de destino',
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

ipcMain.handle('wm-batch-apply', async (event, { files, outputFolder }) => {
  const results = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const filePath = files[i];
    const filename = path.basename(filePath);

    mainWindow.webContents.send('wm-batch-progress', {
      current: i + 1,
      total,
      filename,
      status: 'processing'
    });

    try {
      const imageBuffer = fs.readFileSync(filePath);
      const finalBuffer = await applyWatermark(imageBuffer);
      const destPath = path.join(outputFolder, filename);
      fs.writeFileSync(destPath, finalBuffer);

      results.push({ filename, status: 'completed' });

      mainWindow.webContents.send('wm-batch-progress', {
        current: i + 1,
        total,
        filename,
        status: 'completed'
      });
    } catch (err) {
      results.push({ filename, status: 'error', error: err.message });

      mainWindow.webContents.send('wm-batch-progress', {
        current: i + 1,
        total,
        filename,
        status: 'error',
        error: err.message
      });
    }
  }

  return results;
});

// --- Batch Background (local images) ---
ipcMain.handle('bg-batch-apply', async (event, { files, outputFolder }) => {
  const results = [];
  const total = files.length;

  for (let i = 0; i < total; i++) {
    const filePath = files[i];
    const filename = path.basename(filePath);

    mainWindow.webContents.send('bg-batch-progress', {
      current: i + 1,
      total,
      filename,
      status: 'processing'
    });

    try {
      const imageBuffer = fs.readFileSync(filePath);
      let finalBuffer = await applyBackground(imageBuffer);
      finalBuffer = await applyWatermark(finalBuffer);
      const destPath = path.join(outputFolder, filename);
      fs.writeFileSync(destPath, finalBuffer);

      results.push({ filename, status: 'completed' });

      mainWindow.webContents.send('bg-batch-progress', {
        current: i + 1,
        total,
        filename,
        status: 'completed'
      });
    } catch (err) {
      results.push({ filename, status: 'error', error: err.message });

      mainWindow.webContents.send('bg-batch-progress', {
        current: i + 1,
        total,
        filename,
        status: 'error',
        error: err.message
      });
    }
  }

  return results;
});

// Batch Background IPC
ipcMain.handle('bg-batch-select-images', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar imagenes para fondo blanco',
    filters: [
      { name: 'Imagenes', extensions: ['jpg', 'jpeg', 'png', 'webp'] }
    ],
    properties: ['openFile', 'multiSelections']
  });
  if (result.canceled) return null;
  return result.filePaths;
});

ipcMain.handle('bg-batch-select-output', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar carpeta de destino',
    properties: ['openDirectory']
  });
  if (result.canceled) return null;
  return result.filePaths[0];
});

// Apply background to image buffer
async function applyBackground(imageBuffer) {
  const bgSettings = background.get();

  if (!bgSettings.enabled) {
    return imageBuffer;
  }

  try {
    return await background.applyBackground(imageBuffer, {
      color: bgSettings.color,
      padding: bgSettings.padding
    });
  } catch (err) {
    console.error('[Background] Error in main:', err);
    return imageBuffer;
  }
}

// Apply watermark to image buffer
async function applyWatermark(imageBuffer) {
  const settings = watermark.get();

  console.log('[Watermark] Settings:', JSON.stringify(settings, null, 2));

  if (!settings.enabled || !settings.imagePath || !fs.existsSync(settings.imagePath)) {
    console.log('[Watermark] Skipped - enabled:', settings.enabled, 'imagePath:', settings.imagePath, 'exists:', settings.imagePath ? fs.existsSync(settings.imagePath) : 'N/A');
    return imageBuffer;
  }

  try {
    console.log('[Watermark] Applying watermark from:', settings.imagePath);
    const metadata = await sharp(imageBuffer).metadata();

    // Calculate watermark size
    const watermarkSize = Math.round(metadata.width * (settings.sizePercent / 100));
    const opacity = settings.opacity / 100;

    console.log('[Watermark] Image size:', metadata.width, 'x', metadata.height, 'Watermark size:', watermarkSize, 'Opacity:', opacity);

    // Resize watermark and apply opacity in one step
    const processedWatermark = await sharp(settings.imagePath)
      .resize(watermarkSize)
      .ensureAlpha()
      .modulate({ alpha: opacity })
      .toBuffer();

    // Calculate position based on settings
    const position = settings.position || 'top-left';
    let left, top;

    switch (position) {
      case 'top-left':
        left = settings.padding;
        top = settings.padding;
        break;
      case 'top-center':
        left = Math.round((metadata.width - watermarkSize) / 2);
        top = settings.padding;
        break;
      case 'top-right':
        left = metadata.width - watermarkSize - settings.padding;
        top = settings.padding;
        break;
      case 'middle-left':
        left = settings.padding;
        top = Math.round((metadata.height - watermarkSize) / 2);
        break;
      case 'center':
        left = Math.round((metadata.width - watermarkSize) / 2);
        top = Math.round((metadata.height - watermarkSize) / 2);
        break;
      case 'middle-right':
        left = metadata.width - watermarkSize - settings.padding;
        top = Math.round((metadata.height - watermarkSize) / 2);
        break;
      case 'bottom-left':
        left = settings.padding;
        top = metadata.height - watermarkSize - settings.padding;
        break;
      case 'bottom-center':
        left = Math.round((metadata.width - watermarkSize) / 2);
        top = metadata.height - watermarkSize - settings.padding;
        break;
      case 'bottom-right':
        left = metadata.width - watermarkSize - settings.padding;
        top = metadata.height - watermarkSize - settings.padding;
        break;
      default:
        left = settings.padding;
        top = settings.padding;
    }

    // Composite onto original image
    const result = await sharp(imageBuffer)
      .composite([{
        input: processedWatermark,
        left,
        top
      }])
      .toBuffer();

    console.log('[Watermark] Applied successfully');
    return result;
  } catch (err) {
    console.error('[Watermark] Error:', err);
    return imageBuffer;
  }
}

// Download IPC
ipcMain.handle('download-image', async (event, { url, name }) => {
  if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

  const ext = path.extname(new URL(url).pathname) || '.jpg';
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
  const filename = `${safeName}${ext}`;
  const filepath = path.join(DOWNLOAD_DIR, filename);

  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    const request = client.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return ipcMain.handle('download-image', { url: res.headers.location, name }).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }

      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', async () => {
        try {
          let imageBuffer = Buffer.concat(chunks);

          // Apply background if enabled
          imageBuffer = await applyBackground(imageBuffer);

          // Apply watermark if enabled
          imageBuffer = await applyWatermark(imageBuffer);

          // Save to file
          fs.writeFileSync(filepath, imageBuffer);
          resolve(filepath);
        } catch (err) {
          reject(err);
        }
      });
      res.on('error', reject);
    });
    request.on('error', reject);
    request.setTimeout(15000, () => { request.destroy(); reject(new Error('Timeout')); });
  });
});

ipcMain.handle('open-downloads', () => {
  shell.openPath(DOWNLOAD_DIR);
});

// Import Markdown / CSV / TXT file
ipcMain.handle('import-md', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Seleccionar archivo (CSV, Markdown o Texto)',
    filters: [
      { name: 'Archivos compatibles (*.csv, *.md, *.txt)', extensions: ['csv', 'md', 'txt'] },
      { name: 'CSV (Valores separados por coma)', extensions: ['csv'] },
      { name: 'Markdown', extensions: ['md'] },
      { name: 'Texto plano', extensions: ['txt'] }
    ],
    properties: ['openFile']
  });

  if (result.canceled || result.filePaths.length === 0) return null;

  const filePath = result.filePaths[0];
  
  // Read file as buffer to detect encoding
  const buffer = fs.readFileSync(filePath);
  
  // Remove BOM if present
  let content = '';
  if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
    // UTF-8 with BOM
    content = buffer.slice(3).toString('utf-8');
  } else if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
    // UTF-16 LE
    content = buffer.toString('utf16le');
  } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
    // UTF-16 BE
    content = buffer.swap16().toString('utf16le');
  } else {
    // Try UTF-8 first, fallback to latin1 if it contains replacement characters
    content = buffer.toString('utf-8');
    if (content.includes('\uFFFD')) {
      content = buffer.toString('latin1');
    }
  }

  const products = [];
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  const isCsv = filePath.toLowerCase().endsWith('.csv') || (lines.length > 0 && lines[0].includes(','));

  if (isCsv && lines.length > 0) {
    // Parse CSV
    const headerLine = lines[0].toLowerCase();
    const headers = headerLine.split(',').map(h => h.trim().replace(/^["']|["']$/g, ''));
    
    const genIdx = headers.indexOf('generico');
    const comIdx = headers.indexOf('comercial');
    const labIdx = headers.indexOf('laboratorio');
    const concIdx = headers.indexOf('concentracion');

    if (genIdx !== -1 || comIdx !== -1) {
      for (let i = 1; i < lines.length; i++) {
        const row = lines[i];
        const cols = [];
        let inQuote = false;
        let current = '';
        for (let c = 0; c < row.length; c++) {
          const ch = row[c];
          if (ch === '"') { inQuote = !inQuote; }
          else if (ch === ',' && !inQuote) { cols.push(current.trim()); current = ''; }
          else { current += ch; }
        }
        cols.push(current.trim());
        if (cols.length <= 1 && !cols[0]) continue;

        const gen = (cols[genIdx] || '').replace(/^["']|["']$/g, '').trim();
        const com = (cols[comIdx] || '').replace(/^["']|["']$/g, '').trim();
        const lab = (cols[labIdx] || '').replace(/^["']|["']$/g, '').trim();
        const conc = (cols[concIdx] || '').replace(/^["']|["']$/g, '').trim();

        const parts = [];
        const isComValid = com && com.toLowerCase() !== 'generico' && com !== '-' && com !== '';

        if (isComValid) {
          parts.push(com);
          if (lab && lab !== '-' && !com.toLowerCase().includes(lab.toLowerCase())) {
            parts.push(lab);
          }
        } else {
          if (gen && gen !== '-') parts.push(gen);
          if (lab && lab !== '-' && lab.toLowerCase() !== 'generico') parts.push(lab);
        }

        if (conc && conc !== '-') parts.push(conc);

        const pName = parts.join(' ').replace(/\s+/g, ' ').trim();
        if (pName) products.push(pName);
      }
    }
  }

  // If no CSV parsed or empty, check markdown table or plain text
  if (products.length === 0) {
    for (const line of lines) {
      // Match table rows like: | 1 | Harina Pan 1kg |
      const match = line.match(/^\|\s*\d+\s*\|\s*(.+?)\s*\|$/);
      if (match) {
        const product = match[1].trim();
        if (product && product !== 'Producto') {
          products.push(product);
        }
      }
    }
  }

  // If still empty, try plain text (one product per line)
  if (products.length === 0) {
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('|') && !trimmed.startsWith('-')) {
        products.push(trimmed);
      }
    }
  }

  return { products, filename: path.basename(filePath) };
});

// Batch Download IPC
ipcMain.handle('batch-download', async (event, { products, imagesPerProduct = 1, mode = 'supermarket' }) => {
  const results = [];
  const total = products.length;
  const downloadedHashes = new Map(); // Deduplicación
  const providers = getProviders(mode);

  for (let i = 0; i < total; i++) {
    const query = products[i].trim();
    if (!query) continue;
    const cacheNotFoundKey = `${mode}:${query}`;

    // Send progress update
    mainWindow.webContents.send('batch-progress', {
      current: i + 1,
      total,
      product: query,
      status: 'searching'
    });

    // Verificar cache de no encontrados
    if (cache.isNotFound(cacheNotFoundKey)) {
      results.push({ product: query, status: 'no_results_cached', downloaded: false });
      mainWindow.webContents.send('batch-progress', {
        current: i + 1,
        total,
        product: query,
        status: 'no_results',
        cached: true
      });
      continue;
    }

    try {
      // Generar variaciones de búsqueda
      const variations = generateQueryVariations(query);
      let allRanked = [];
      let usedVariation = 'original';

      for (const variation of variations) {
        const searches = providers.map(p => searchProvider(p, variation.query));
        const searchResults = await Promise.all(searches);
        const allResults = searchResults.flat();

        const ranked = allResults
          .map(item => ({ ...item, score: scoreResult(query, item.title) }))
          .filter(item => item.score > 0.08)
          .sort((a, b) => b.score - a.score);

        if (ranked.length > 0) {
          allRanked = ranked;
          usedVariation = variation.label;
          break; // Encontró resultados, parar
        }
      }

      if (allRanked.length === 0) {
        // Guardar en cache de no encontrados
        cache.setNotFound(cacheNotFoundKey);
        results.push({ product: query, status: 'no_results', downloaded: false });
        mainWindow.webContents.send('batch-progress', {
          current: i + 1,
          total,
          product: query,
          status: 'no_results'
        });
        continue;
      }

      // Get top N results based on imagesPerProduct
      const topResults = allRanked.slice(0, imagesPerProduct);

      for (let j = 0; j < topResults.length; j++) {
        const bestResult = topResults[j];

        // Verificar duplicados
        const imageHash = crypto.createHash('md5').update(bestResult.src).digest('hex');
        const isDuplicate = downloadedHashes.has(imageHash);

        // Update progress - downloading
        mainWindow.webContents.send('batch-progress', {
          current: i + 1,
          total,
          product: query,
          status: 'downloading',
          variation: usedVariation,
          isDuplicate,
          imageIndex: j + 1,
          totalImages: topResults.length
        });

        // Download the image
        const ext = path.extname(new URL(bestResult.src).pathname) || '.jpg';
        const safeName = query.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50);
        
        // File naming: product-1.jpg, product-2.jpg, etc.
        const filename = topResults.length > 1 
          ? `${safeName}-${j + 1}${ext}`
          : `${safeName}${ext}`;
        const filepath = path.join(DOWNLOAD_DIR, filename);

        try {
          const imageBuffer = await new Promise((resolve, reject) => {
            const client = bestResult.src.startsWith('https') ? https : http;
            const request = client.get(bestResult.src, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
              if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                const redirectClient = res.headers.location.startsWith('https') ? https : http;
                redirectClient.get(res.headers.location, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res2) => {
                  const chunks = [];
                  res2.on('data', (chunk) => chunks.push(chunk));
                  res2.on('end', () => resolve(Buffer.concat(chunks)));
                  res2.on('error', reject);
                }).on('error', reject);
                return;
              }
              if (res.statusCode !== 200) {
                reject(new Error(`HTTP ${res.statusCode}`));
                return;
              }
              const chunks = [];
              res.on('data', (chunk) => chunks.push(chunk));
              res.on('end', () => resolve(Buffer.concat(chunks)));
              res.on('error', reject);
            });
            request.on('error', reject);
            request.setTimeout(15000, () => { request.destroy(); reject(new Error('Timeout')); });
          });

          // Apply background if enabled
          let finalBuffer = await applyBackground(imageBuffer);

          // Apply watermark if enabled
          finalBuffer = await applyWatermark(finalBuffer);

          // Save to file
          if (!fs.existsSync(DOWNLOAD_DIR)) fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
          fs.writeFileSync(filepath, finalBuffer);

          // Track hash for deduplication
          downloadedHashes.set(imageHash, query);

          results.push({
            product: query,
            status: 'downloaded',
            downloaded: true,
            filename,
            score: bestResult.score,
            variation: usedVariation,
            isDuplicate,
            imageIndex: j + 1
          });

          mainWindow.webContents.send('batch-progress', {
            current: i + 1,
            total,
            product: query,
            status: 'completed',
            filename,
            variation: usedVariation,
            isDuplicate,
            imageIndex: j + 1,
            totalImages: topResults.length
          });
        } catch (err) {
          results.push({ product: query, status: 'error', downloaded: false, error: err.message });
          mainWindow.webContents.send('batch-progress', {
            current: i + 1,
            total,
            product: query,
            status: 'error',
            error: err.message
          });
        }
      }

    } catch (err) {
      results.push({ product: query, status: 'error', downloaded: false, error: err.message });
      mainWindow.webContents.send('batch-progress', {
        current: i + 1,
        total,
        product: query,
        status: 'error',
        error: err.message
      });
    }
  }

  return results;
});
