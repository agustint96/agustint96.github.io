# Grabadora — Worker de Cloudflare

La app **Grabadora** del SISOP deja que cualquier visitante te grabe un mensaje
de voz (hasta 2 minutos). El sitio es estático (GitHub Pages), así que el audio
se manda a este Worker, que lo guarda en un **KV namespace** de Cloudflare. Vos
los escuchás desde la **Bandeja** de la app, que se abre con un **PIN**.

- **Costo:** gratis. KV incluye 1 GB, 100.000 lecturas/día y 1.000 escrituras/día
  en el plan free. No pide tarjeta. Cada mensaje pesa ~100–300 KB y se **borra
  solo a los 45 días** (`RETENCION_DIAS` en `worker.js`).
- **Privacidad:** los audios sólo se pueden listar/escuchar con el PIN. El PIN
  vive como variable secreta en el Worker (no en el sitio).

Archivos:
- `worker.js` — el código del Worker.
- `wrangler.toml` — sólo si usás la CLI (Método B).

---

## Método A — Dashboard de Cloudflare (sin instalar nada) ✅ recomendado

### 1. Cuenta

Si ya tenés la del Atendedor.ia, usá esa. Si no:
https://dash.cloudflare.com/sign-up — gratis, sólo email.

### 2. Crear el KV namespace

- Panel: **Storage & Databases → KV → Create a namespace**.
- Nombre: `grabadora-mensajes` (o el que quieras) → **Add**.

### 3. Crear el Worker

- **Compute (Workers) → Create → Start with Hello World → Create**.
- Nombre: `grabadora` → **Deploy**.
- **Edit code**: borrá todo y pegá el contenido completo de
  [`worker.js`](./worker.js). → **Deploy**.

### 4. Bindings y variables

En el Worker → **Settings**:

1. **Bindings → Add → KV namespace**
   - Variable name: `MENSAJES` (exactamente así).
   - KV namespace: el que creaste en el paso 2. → **Deploy**.

2. **Variables and Secrets → Add**
   - Type: **Secret**
   - Name: `INBOX_PIN`
   - Value: el PIN que quieras (ej. `4917`). Es el que vas a tipear en la
     Bandeja. → **Deploy**.

3. *(Opcional)* **Bindings → Add → Rate limiting**
   - Variable name: `RATE_LIMITER`, límite `6` cada `60` segundos. → **Deploy**.
   - Sin esto igual anda (el Worker ya limita tamaño y tipo de archivo).

### 5. Pegar la URL en el sitio

Arriba del editor del Worker está la URL:

```
https://grabadora.TU-SUBDOMINIO.workers.dev
```

Abrí `../js/sisop-grabadora.js`, arriba de todo, y pegala:

```js
var GRABADORA_API = "https://grabadora.TU-SUBDOMINIO.workers.dev";
```

Si tu sitio no es `https://agustint96.github.io`, agregá tu dominio a
`ALLOWED_ORIGINS` en `worker.js`.

`git push` y listo.

---

## Método B — CLI wrangler (si tenés Node.js)

```bash
npm install -g wrangler
wrangler login
cd grabadora-worker
wrangler kv namespace create MENSAJES   # copiá el id que imprime a wrangler.toml
wrangler secret put INBOX_PIN           # te pide el PIN
wrangler deploy
```

Si se queja de `[[unsafe.bindings]]`, borrá ese bloque de `wrangler.toml`
(el rate-limit es opcional).

---

## Cómo se usa

- **Visitante:** abre **Grabadora** en el escritorio, toca el micrófono, graba,
  escucha, opcionalmente pone su nombre y **Enviar mensaje**.
- **Vos:** abrís **Grabadora → «Soy Agus · ver bandeja»**, tipeás el PIN (queda
  guardado en ese navegador). Ves la lista, le das play a cada uno; se marca como
  escuchado. La ✕ borra el mensaje. «Salir» olvida el PIN en esa compu.

## Rutas del Worker

| Método | Ruta | Para qué |
|---|---|---|
| `POST` | `/` | dejar un mensaje (form-data: `audio`, `nombre`, `dur`, `mime`) |
| `GET`  | `/list?key=PIN` | listar mensajes |
| `GET`  | `/audio?id=ID&key=PIN` | bajar/escuchar un audio |
| `POST` | `/heard?id=ID&key=PIN` | marcar como escuchado |
| `POST` | `/borrar?id=ID&key=PIN` | borrar un mensaje |

## Ajustes rápidos (`worker.js`)

- `MAX_BYTES` — tope de tamaño por mensaje (default 1,5 MB).
- `RETENCION_DIAS` — a los cuántos días se autoborran (default 45).
- `ALLOWED_ORIGINS` — desde qué dominios se puede publicar.
