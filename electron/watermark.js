const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '..', '.cache', 'watermark.json');

const DEFAULTS = {
  enabled: false,
  imagePath: '',
  sizePercent: 15,
  opacity: 100,
  padding: 10,
  position: 'top-left'
};

function ensureDir() {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function load() {
  try {
    ensureDir();
    if (fs.existsSync(SETTINGS_PATH)) {
      const data = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'));
      return { ...DEFAULTS, ...data };
    }
  } catch {}
  return { ...DEFAULTS };
}

function save(settings) {
  try {
    ensureDir();
    // Write settings directly without overwriting with defaults
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
    return true;
  } catch {
    return false;
  }
}

function get() {
  return load();
}

function update(partial) {
  const current = load();
  const updated = { ...current, ...partial };
  return save(updated);
}

function setImage(filePath) {
  // Copy image to cache folder for persistence
  const cacheDir = path.join(__dirname, '..', '.cache');
  const ext = path.extname(filePath);
  const dest = path.join(cacheDir, `watermark${ext}`);

  try {
    ensureDir();
    fs.copyFileSync(filePath, dest);
    update({ imagePath: dest, enabled: true });
    return dest;
  } catch {
    return null;
  }
}

function removeImage() {
  const settings = load();
  if (settings.imagePath && fs.existsSync(settings.imagePath)) {
    try { fs.unlinkSync(settings.imagePath); } catch {}
  }
  update({ imagePath: '', enabled: false });
}

module.exports = { get, update, setImage, removeImage };
