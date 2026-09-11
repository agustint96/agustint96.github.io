# Atendedor.ia — Worker de Cloudflare

Este Worker es el "cerebro" del Atendedor.ia. El sitio (GitHub Pages) no puede
llamar a un modelo de IA directamente sin exponer credenciales, así que le pega
a este Worker, que corre en Cloudflare y usa **Workers AI** (modelos Llama que
corren en la infra de Cloudflare, **sin API key externa**).

- **Costo:** gratis hasta 10.000 "neuronas"/día (con el modelo 8B por defecto,
  ~1000+ respuestas/día; con el 70B de respaldo, ~100). Más que eso: US$ 0,011
  cada 1.000 neuronas, o el plan Workers Paid (US$ 5/mes). No pide tarjeta.
  La cuota resetea a medianoche UTC (21 h de Córdoba).
- La info de la que se nutre está en `../bot/atendedor-kb.md`. Editás ese archivo,
  `git push`, y el Worker lo toma solo (lo cachea ~1 hora).
- Los recorridos de colectivos de Córdoba salen de
  `../bot/data/cordoba_transporte_completo.json`. En cada pregunta el Worker
  busca la(s) línea(s) que aplican (por número, corredor, calle o barrio) y le
  inyecta SÓLO esos recorridos al modelo, para que no invente calles. Para
  actualizar recorridos, editás ese JSON y `git push`. Ver
  `../bot/data/README_cordoba_lineas.md`.

Archivos:
- `worker.js` — el código del Worker (lo que importa).
- `wrangler.toml` — config, sólo si usás la CLI (Método B).

---

## Método A — Dashboard de Cloudflare (sin instalar nada) ✅ recomendado

### 1. Crear cuenta

https://dash.cloudflare.com/sign-up — gratis, sólo email. No hace falta dominio ni tarjeta.

### 2. Crear el Worker

- En el panel: **Compute (Workers)** → **Create** → **Start with Hello World** → **Create**.
- Ponele de nombre `atendedor-ia` (o el que quieras) → **Deploy**.
- Ahora **Edit code**: borrá todo el editor y pegá el contenido completo de
  [`worker.js`](./worker.js). → **Deploy**.

### 3. Darle el binding de IA

- En el Worker: **Settings** → **Bindings** → **Add** → **Workers AI**.
- Variable name: `AI` (exactamente así, en mayúsculas). → **Deploy**.

### 4. (Opcional) Límite anti-abuso por IP

- **Settings** → **Bindings** → **Add** → **Rate limiting**.
- Variable name: `RATE_LIMITER`, límite `12` requests cada `60` segundos. → **Deploy**.
- Si no lo agregás, el Worker funciona igual (el código ya limita el largo de los
  mensajes y de las respuestas).

### 5. Copiar la URL y pegarla en el sitio

Arriba del editor del Worker aparece la URL, tipo:

```
https://atendedor-ia.TU-SUBDOMINIO.workers.dev
```

Abrí `../sisop.html`, buscá `ATENDEDOR_API` (está en el `<script>` del atendedor,
buscá el texto "URL del Worker") y pegala:

```js
var ATENDEDOR_API = "https://atendedor-ia.TU-SUBDOMINIO.workers.dev";
```

`git push` y listo. El Atendedor.ia ya responde.

---

## Método B — CLI wrangler (si tenés Node.js)

```bash
npm install -g wrangler
wrangler login
cd atendedor-worker
wrangler deploy
```

Te imprime la URL. Si se queja de `[[ratelimits]]` en `wrangler.toml`, borrá esas
4 líneas y reintentá.

Después, pegá la URL en `ATENDEDOR_API` de `../sisop.html` (paso 5 de arriba).

---

## Probar el Worker suelto

```bash
curl -X POST https://atendedor-ia.TU-SUBDOMINIO.workers.dev \
  -H "Content-Type: application/json" \
  -H "Origin: https://agustint96.github.io" \
  -d '{"messages":[{"role":"user","content":"¿Qué hace Agus?"}]}'
```

Debería devolver `{"reply":"..."}`.

### ¿Se agotó la cuota del día? — `GET /status`

```bash
curl https://atendedor-ia.TU-SUBDOMINIO.workers.dev/status
```

Hace una inferencia mínima (1 token, gasto ~nulo) y devuelve:

```json
{ "ts": "2026-09-11T00:30:00.000Z", "ok": true,  "cuota": "disponible" }
{ "ts": "2026-09-11T00:06:00.000Z", "ok": false, "cuota": "agotada", "detail": "4006: ..." }
```

(La raíz `/` no toca la IA, sólo `GET /status` hace la sonda.)

Sirve para chequear "¿ya volvió?" sin gastar una conversación real. La cuota
gratis resetea a las 00:00 UTC (21 h Córdoba), pero la contabilidad de Cloudflare
tarda un rato en reflejarlo: si a las 21:05 sigue `agotada`, probá de nuevo en
15–45 min.

---

## Editar qué sabe y CÓMO habla el bot

**Todo eso vive en [`../bot/atendedor-kb.md`](../bot/atendedor-kb.md).** Ese archivo
tiene tres partes:

- **PARTE 1 — cómo habla**: personaje, idioma, largo, reglas de conversación, frases de ejemplo.
- **PARTE 2 — qué sabe del SISOP**: su tema principal (este escritorio y sus programas).
- **PARTE 3 — sobre Agus**: bio, formación, experiencia, proyectos. El bot **sólo** la usa si le preguntan explícitamente por él.

Editás lo que quieras, `git push`, y a los ~5 minutos el bot ya responde distinto.
**No hace falta volver a tocar Cloudflare para esto.**

## Ajustes del Worker (en `worker.js`, sólo si hace falta)

| Constante | Qué hace |
|---|---|
| `MODELS` | Lista de modelos de Workers AI, en orden. Se usa el primero; si falla por algo que no sea la cuota diaria, cae al siguiente. Default: `llama-3.1-8b` (barato, ~1000+ respuestas/día gratis) con `llama-3.3-70b` de respaldo. La cuota gratis (10.000 neuronas/día) es de la cuenta, no por modelo: cuando se agota, el bot avisa que vuelvan más tarde (resetea a medianoche UTC = 21 h Córdoba). |
| `ALLOWED_ORIGINS` | Desde qué dominios se puede llamar. Tocá si movés el sitio. |
| `KB_URL` | De dónde lee la ficha. |
| `MAX_TOKENS` | Largo máximo de cada respuesta. |
| `MAX_TURNS` | Cuántos mensajes de la charla se mandan como contexto. |
| `DATA_URL` | Dataset de colectivos de Córdoba. |
| `COLECTIVOS_MAX_LINEAS` | Cuántas líneas como mucho se le pasan al modelo por pregunta (default 5). Más = respuestas más completas pero menos respuestas/día. |
| `COLECTIVOS_MAX_CHARS_RECORRIDO` | Cuánto se recorta cada tramo de recorrido (default 700). |

Sólo si tocás `worker.js`: volver a pegarlo en el editor del dashboard y **Deploy**
(o `wrangler deploy`). El tono NO se toca acá — se toca en la ficha.

## Ver cuánto va gastando

Dashboard → **AI** → **Workers AI**: ahí ves las neuronas del día. Si querés cortar
el gasto, en el Worker podés ponerle un tope de requests o pausarlo.
