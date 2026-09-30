const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const SETTINGS_PATH = path.join(__dirname, '..', '.cache', 'background.json');

const DEFAULTS = {
  enabled: false,
  color: '#ffffff',
  padding: 0,
  applyToBatch: true,
  applyToSingle: true
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

async function applyBackground(imageBuffer, options = {}) {
  const settings = load();
  
  if (!settings.enabled) {
    return imageBuffer;
  }

  const {
    color = settings.color,
    padding = settings.padding
  } = options;

  try {
    const metadata = await sharp(imageBuffer).metadata();
    
    const newWidth = metadata.width + (padding * 2);
    const newHeight = metadata.height + (padding * 2);

    const result = await sharp(imageBuffer)
      .resize({
        width: metadata.width,
        height: metadata.height,
        fit: 'contain',
        background: color
      })
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: color
      })
      .toBuffer();

    console.log(`[Background] Applied: ${metadata.width}x${metadata.height} -> ${newWidth}x${newHeight}, color: ${color}, padding: ${padding}`);
    return result;
  } catch (err) {
    console.error('[Background] Error:', err);
    return imageBuffer;
  }
}

module.exports = { get, update, applyBackground };
