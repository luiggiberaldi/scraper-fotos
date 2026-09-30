# Buscador de Fotos — Supermercados y Farmacia VE

App de escritorio (Electron) que busca y descarga fotos de productos de
supermercados y farmacias venezolanas. Sirve para armar catálogos con imagen
(p. ej. los productos de PreciosAlDía Pro).

Fuentes por modo:

- **Supermercado:** TuZonaMarket, CocoMercado, InstaMarket
- **Farmacia:** Farmatodo, Locatel, DuckDuckGo (imágenes)

## Instalación

```bash
npm install
```

## Uso

```bash
npm start          # abre la app
npm run build      # genera el instalador de Windows (dist/)
```

En la app:

1. Elige el modo (supermercado o farmacia).
2. Busca un producto para ver resultados rankeados, o usa **Importar**
   para cargar un CSV/Markdown/TXT con la lista de productos y descargar
   en lote (una o varias fotos por producto).
3. Las imágenes caen en la carpeta `downloads/`.

El CSV de farmacia usa las columnas `generico, comercial, laboratorio,
concentracion` (ver `productos_farmacia.csv` como ejemplo).

## Cómo rankea

`electron/search.js`: normaliza la búsqueda (acentos, unidades, stopwords),
expande sinónimos de marcas venezolanas, y puntúa con TF-IDF + Levenshtein
difuso. Genera variaciones de la búsqueda si la primera no da resultados.

## Opcionales

- **Marca de agua** y **fondo** (blanco u otro color): vienen **apagados**
  por defecto. Se configuran en la app y se aplican al descargar o en lote
  sobre imágenes locales.
- **Caché** (`.cache/`): resultados 24h, "no encontrados" 1h. Se puede
  limpiar desde la app.

## Notas

- Las descargas siguen redirects (máx 5) y nunca sobrescriben: si el nombre
  ya existe se agrega sufijo `-2`, `-3`...
- El scraping depende de la estructura de cada tienda; si una fuente cambia
  su web, hay que actualizar su selector en `electron/main.js`.
