# Atendedor.ia — Worker de Cloudflare

Este Worker es el "cerebro" del Atendedor.ia. El sitio (GitHub Pages) no puede
llamar a un modelo de IA directamente sin exponer credenciales, así que le pega
a este Worker, que corre en Cloudflare y usa **Workers AI** (modelos Llama que
corren en la infra de Cloudflare, **sin API key externa**).

- **Costo:** gratis hasta 10.000 "neuronas"/día (≈ 75–150 respuestas/día con el
  modelo por defecto). Más que eso: US$ 0,011 cada 1.000 neuronas. No pide tarjeta.
- La info de la que se nutre está en `../bot/atendedor-kb.md`. Editás ese archivo,
  `git push`, y el Worker lo toma solo (lo cachea ~1 hora).

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

---

## Ajustes (en `worker.js`, arriba de todo)

| Constante | Qué hace |
|---|---|
| `MODEL` | Modelo de Workers AI. Default `@cf/meta/llama-3.3-70b-instruct-fp8-fast`. Para el doble de respuestas/día (menos calidad): `@cf/meta/llama-3.1-8b-instruct-fp8`. |
| `ALLOWED_ORIGINS` | Desde qué dominios se puede llamar. Tocá si movés el sitio. |
| `KB_URL` | De dónde lee la ficha de Agus. |
| `MAX_TOKENS` | Largo máximo de cada respuesta. |
| `MAX_TURNS` | Cuántos mensajes de la charla se mandan como contexto. |
| `PERSONA` | Personalidad e instrucciones base. El tono fino editalo en `../bot/atendedor-kb.md`. |

Tras tocar `worker.js`: volver a pegarlo en el editor del dashboard y **Deploy**
(o `wrangler deploy`).

## Ver cuánto va gastando

Dashboard → **AI** → **Workers AI**: ahí ves las neuronas del día. Si querés cortar
el gasto, en el Worker podés ponerle un tope de requests o pausarlo.
