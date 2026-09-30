# Bitácora — scraper-fotos

## 2026-09-30 — Auditoría + fixes (totono)

**Contexto:** el repo se usará para extraer fotos de productos (catálogo de
PreciosAlDía Pro, 2 sedes, 5000+ productos). Se auditó el código completo.

**Qué es:** app de escritorio Electron (no el CLI que describía el README).
Busca en TuZonaMarket/CocoMercado/InstaMarket (modo supermercado) y en
Farmatodo/Locatel/DuckDuckGo imágenes (modo farmacia) con Puppeteer, rankea
con TF-IDF + Levenshtein + sinónimos de marcas VE, y descarga en lote desde
un CSV/MD/TXT.

**Fixes aplicados:**

1. `electron/main.js` — bug en `download-image`: cuando la URL redirigía, el
   código llamaba `ipcMain.handle('download-image', {url...})` como si fuera
   una invocación → TypeError y la descarga colgaba 15s hasta el timeout.
   Nuevo helper `downloadBuffer(url)` que sigue redirects (máx 5, resuelve
   relativos) y se usa tanto en descarga individual como en batch (antes el
   batch solo seguía 1 nivel con lógica duplicada).
2. `electron/main.js` — el batch nombraba archivos desde el nombre
   normalizado del producto: dos productos iguales se sobrescribían en
   silencio. Nuevo helper `uniqueFilePath()` que agrega sufijo `-2`, `-3`...
   También aplicado a la descarga individual.
3. `README.md` — reescrito: describía un CLI inexistente
   (`node src/index.js --name`); ahora documenta la app Electron real
   (`npm start`, `npm run build`, flujo batch, caché, watermark).
4. `src/icon.png` — no existía pero `package.json`/`main.js` lo referencian
   (rompía `npm run build`); agregado icono generado.
5. `LICENSE` — el `package.json` declaraba MIT pero no había archivo;
   agregada licencia MIT.

**Hallazgos sin corregir (higiene, no bloquean):**

- 14/196 productos del catálogo de farmacia quedaron sin foto; 11 imágenes
  huérfanas en `catalogo_farmacia/imagenes/` no referenciadas en
  `productos_data.json`.
- El corpus TF-IDF vive en memoria y se acumula por sesión → scores no 100%
  reproducibles; umbral 0.08 permisivo (revisar visualmente el batch).
- Keywords `mg`/`mcg` en CATEGORIES de farmacia nunca matchean (la
  normalización las elimina antes) — cosmético.
- Un solo commit previo en git; autor vacío en `package.json`.
- Escala: batch secuencial, mín 3 páginas por producto → corrida de 5000
  productos toma muchas horas; partir el CSV en tandas y apoyarse en la caché.
