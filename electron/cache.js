const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeQuery } = require('./search');

const CACHE_DIR = path.join(__dirname, '..', '.cache');
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 horas
const NOT_FOUND_TTL = 60 * 60 * 1000; // 1 hora para productos no encontrados

function ensureCacheDir() {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

function getCacheKey(query) {
  const normalized = normalizeQuery(query);
  return crypto.createHash('md5').update(normalized).digest('hex');
}

function getCachePath(key) {
  return path.join(CACHE_DIR, `${key}.json`);
}

function getNotFoundPath(key) {
  return path.join(CACHE_DIR, `nf_${key}.json`);
}

function get(query) {
  try {
    ensureCacheDir();
    const key = getCacheKey(query);
    const cachePath = getCachePath(key);

    if (!fs.existsSync(cachePath)) return null;

    const data = JSON.parse(fs.readFileSync(cachePath, 'utf-8'));

    // Check TTL
    if (Date.now() - data.timestamp > CACHE_TTL) {
      fs.unlinkSync(cachePath);
      return null;
    }

    return data.results;
  } catch {
    return null;
  }
}

function set(query, results) {
  try {
    ensureCacheDir();
    const key = getCacheKey(query);
    const cachePath = getCachePath(key);

    const data = {
      query,
      timestamp: Date.now(),
      results
    };

    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

// Fase 5: Cache de productos no encontrados
function setNotFound(query) {
  try {
    ensureCacheDir();
    const key = getCacheKey(query);
    const notFoundPath = getNotFoundPath(key);

    const data = {
      query,
      timestamp: Date.now()
    };

    fs.writeFileSync(notFoundPath, JSON.stringify(data, null, 2));
    return true;
  } catch {
    return false;
  }
}

function isNotFound(query) {
  try {
    ensureCacheDir();
    const key = getCacheKey(query);
    const notFoundPath = getNotFoundPath(key);

    if (!fs.existsSync(notFoundPath)) return false;

    const data = JSON.parse(fs.readFileSync(notFoundPath, 'utf-8'));

    // Check TTL (1 hora)
    if (Date.now() - data.timestamp > NOT_FOUND_TTL) {
      fs.unlinkSync(notFoundPath);
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

function clear() {
  try {
    ensureCacheDir();
    const files = fs.readdirSync(CACHE_DIR);
    for (const file of files) {
      if (file.endsWith('.json')) {
        fs.unlinkSync(path.join(CACHE_DIR, file));
      }
    }
    return true;
  } catch {
    return false;
  }
}

function getStats() {
  try {
    ensureCacheDir();
    const files = fs.readdirSync(CACHE_DIR).filter(f => f.endsWith('.json'));
    let totalSize = 0;
    for (const file of files) {
      totalSize += fs.statSync(path.join(CACHE_DIR, file)).size;
    }
    return {
      count: files.length,
      sizeKB: Math.round(totalSize / 1024)
    };
  } catch {
    return { count: 0, sizeKB: 0 };
  }
}

module.exports = { get, set, setNotFound, isNotFound, clear, getStats };
