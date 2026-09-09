# Carpeta FOTOS

Las imágenes de esta carpeta se muestran en la ventana **FOTOS** del
escritorio de `sql.html`.

## Cómo agregar fotos

1. Copiá los archivos de imagen dentro de esta carpeta (`fotos/`).
   Formatos: `.jpg`, `.jpeg`, `.png`, `.webp`, `.gif`.
2. Agregá el nombre de cada archivo a `manifest.json`.

El visor no puede "ver" la carpeta solo (GitHub Pages no lista
directorios), por eso hace falta el `manifest.json`.

## Formato de `manifest.json`

Un array JSON. Cada entrada puede ser:

- El nombre del archivo (string):

```json
["cordoba.jpg", "estudio.png", "recital.webp"]
```

- O un objeto con título propio:

```json
[
  { "src": "cordoba.jpg", "titulo": "Córdoba de noche" },
  { "src": "estudio.png", "titulo": "Mi setup" },
  "recital.webp"
]
```

También se admite una URL completa (`https://…`) en `src`.

Si el array está vacío, la ventana muestra "Carpeta vacía".
