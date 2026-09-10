# Dataset de transporte urbano de Córdoba capital

Extraído del Anexo de Wikipedia "Transporte urbano de la ciudad de Córdoba (Argentina)"
que subiste. Ahora incluye **todo** lo que cubre esa página: colectivos diésel,
trolebuses e interurbano del Gran Córdoba.

Archivos:
- `cordoba_lineas.json` — 65 líneas diésel (corredores 1 a 8 + anulares 600/601).
- `cordoba_trolebuses.json` — 7 líneas de trolebús (A, A1, B, B1, C, C1, C2).
- `cordoba_interurbano.json` — servicios que conectan la Capital con localidades
  del Gran Córdoba (Sarmiento, Intercórdoba, ERSA, Buses Lep, Fonobus). Ojo: esto
  ya no es "urbano" estrictamente, son líneas que salen de la ciudad — te lo dejo
  igual porque me lo pediste, pero si tu agente es específicamente para moverse
  *dentro* de la capital, probablemente no lo necesites.
- `cordoba_transporte_completo.json` — los tres anteriores juntos, bajo las claves
  `urbano_diesel`, `trolebuses` e `interurbano_gran_cordoba`.

## Estructura de cada registro — colectivos diésel y trolebuses

```json
{
  "linea": "10",
  "corredor": "1",
  "empresa_actual": "Coniferal",
  "recorrido_texto": "texto completo con inicio, ida y vuelta",
  "barrio_inicio": "Ituzaingó Anexo",
  "barrio_fin": "Lasalle",
  "recorrido_ida": "calle por calle, sentido ida",
  "recorrido_vuelta": "calle por calle, sentido vuelta"
}
```

- `barrio_inicio` / `barrio_fin` y `recorrido_ida` / `recorrido_vuelta` no están
  presentes en el 100% de las líneas: dependen de cómo estaba redactado el texto
  original en Wikipedia. Si faltan, siempre está el campo `recorrido_texto` completo
  como respaldo.
- `empresa_actual` la calculé a partir de la última tabla de "Distribución de
  corredores" del artículo (Abril 2026 a presente) para las líneas diésel.
  Para trolebuses puse "Tamse" porque son el servicio eléctrico municipal, no
  aparecen en esas tablas de distribución. Ojo: esto cambia seguido en Córdoba
  (como viste, hubo Tamse → Ersa → Coniferal/SiBus/SolBus en pocos años), así que
  convendría revalidar este dato cada tanto contra fuentes oficiales
  (Municipalidad de Córdoba / app TuBondi).

## Estructura de cada registro — interurbano (`cordoba_interurbano.json`)

```json
{
  "empresa": "Sarmiento",
  "categoria": "Transporte Interurbano Gran Córdoba (conecta Córdoba capital con localidades del área metropolitana)",
  "destinos": ["Córdoba - Unquillo (Regular)", "Córdoba - Alta Gracia x Ruta 5", "..."]
}
```

Acá no hay recorrido calle por calle (Wikipedia solo lista los destinos por
empresa), por eso el campo relevante es `destinos`. El registro de ERSA además
trae `servicios_locales_regionales_texto`, que son combinaciones entre
localidades del interior que no pasan por la Capital (ej. Cruz del Eje - Deán
Funes) — puede que no te sirvan para tu caso de uso, quedan documentados por si
acaso.

## Cómo lo importante importar esto a tu agente

**No lo pegues entero en el system prompt.** Son ~65 recorridos con calles
detalladas — es mucha data y el modelo no "razona" bien sobre un bloque de texto
gigante. Mejor:

1. Subí este JSON a donde tu agente pueda leerlo (una tabla en tu base de datos,
   un archivo que cargues en un vector store, o un simple diccionario en memoria
   si es liviano).
2. Dale a Claude una **tool/function**, por ejemplo:
   - `buscar_linea(numero)` → devuelve el registro completo de esa línea.
   - `lineas_por_corredor(corredor)` → devuelve todas las líneas de ese corredor.
   - `buscar_por_calle(nombre_calle)` → busca coincidencias de texto dentro de
     `recorrido_ida` / `recorrido_vuelta` (búsqueda simple de substring alcanza
     para arrancar; si querés algo más piola, hacé embeddings de cada
     `recorrido_texto` y usá búsqueda semántica).
3. Claude llama a esa tool cuando el usuario pregunta "¿qué línea pasa por tal
   calle?" o "¿cómo es el recorrido de la 21?", y arma la respuesta en lenguaje
   natural con el dato real, en vez de inventarlo.

Esto evita que tu IA "alucine" un recorrido — algo bastante probable si sólo le
tirás las calles como texto libre en el prompt, sobre todo con 65 líneas
compitiendo por atención.

## Limitaciones a tener en cuenta

- Esto es un snapshot de Wikipedia a la fecha en que se generó la página que
  subiste — los recorridos y las empresas cambian con frecuencia en Córdoba
  (viste las noticias: cambios de corredor 7 en agosto 2026, SiBus arrancando en
  abril 2026, etc.). Conviene poner una fecha de "última actualización" visible
  para el usuario final y revisar el dataset cada tanto.
- No incluye horarios ni frecuencias, sólo el trazado del recorrido.
- No incluye coordenadas geográficas — si más adelante querés mostrar esto en un
  mapa o calcular "qué línea me deja más cerca", vas a necesitar geocodificar las
  calles o conseguir el GTFS oficial (que si tiene coordenadas y paradas).
