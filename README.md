# Buscador de Fotos de Supermercados

Busca y descarga fotos de productos de 3 supermercados venezolanos:
- TuZonaMarket
- CocoMercado
- InstaMarket

## Instalacion

```bash
cd buscador-fotos-super
npm install
```

## Uso

```bash
# Buscar un producto
node src/index.js --name "Harina Pan 1kg"

# Buscar y descargar automaticamente
node src/index.js --name "Aceite" --download

# Ver todos los resultados con umbral bajo
node src/index.js --name "Leche" --all --threshold 0.2
```

## Opciones

| Opcion | Descripcion | Default |
|--------|-------------|---------|
| `-n, --name` | Nombre del producto | (requerido) |
| `-d, --download` | Descargar la mejor imagen | false |
| `-a, --all` | Mostrar todos los resultados | false |
| `-t, --threshold` | Umbral minimo de similaridad | 0.3 |

## Descargas

Las imagenes se guardan en la carpeta `downloads/` con nombre basado en el producto.
