/*
 * Grabadora — Cloudflare Worker
 * -----------------------------
 * Recibe mensajes de voz que dejan los visitantes del SISOP y los guarda en
 * un namespace KV. Agus los escucha después desde la bandeja de la app
 * «Grabadora» (sisop.html), que se desbloquea con un PIN.
 *
 * No usa ninguna API key. Bindings necesarios (ver grabadora-worker/README.md):
 *   - KV namespace  -> binding  MENSAJES
 *   - Variable       -> INBOX_PIN   (el PIN de la bandeja, sólo lo sabés vos)
 *   - (opcional) Rate limiting -> RATE_LIMITER
 *
 * Rutas:
 *   POST /            deja un mensaje   (multipart form: audio, nombre, dur, mime)
 *   GET  /list?key=   lista los mensajes (PIN)               -> { ok, mensajes:[...] }
 *   GET  /audio?id=&key=   devuelve el audio de un mensaje (PIN)
 *   POST /heard?id=&key=   marca un mensaje como escuchado (PIN)
 *   POST /borrar?id=&key=  borra un mensaje (PIN)
 */

const ALLOWED_ORIGINS = [
  "https://agustint96.github.io",
  "http://localhost:8801",
  "http://127.0.0.1:8801",
];

const MAX_BYTES = 1_500_000; // ~1,5 MB: 2 min de voz en opus entran de sobra
const MAX_NOMBRE = 40;
const RETENCION_DIAS = 45; // los mensajes se autoborran a los 45 días
const TTL = RETENCION_DIAS * 24 * 60 * 60;

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    const cors = corsHeaders(origin);
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, "") || "/";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    // El <audio> del navegador pide el audio con un GET simple (sin Origin):
    // sólo esa ruta se permite sin chequear origen.
    if (!(path === "/audio" && request.method === "GET")) {
      if (origin && !ALLOWED_ORIGINS.includes(origin)) {
        return json({ error: "forbidden_origin" }, 403, cors);
      }
    }

    if (!env.MENSAJES) {
      return json({ error: "sin_kv", detail: "Falta el binding MENSAJES (KV)." }, 503, cors);
    }

    try {
      if (path === "/" && request.method === "POST") return dejar(request, env, cors);
      if (path === "/list" && request.method === "GET") return listar(request, env, cors, url);
      if (path === "/audio" && request.method === "GET") return servirAudio(request, env, cors, url);
      if (path === "/heard" && request.method === "POST") return marcar(request, env, cors, url);
      if (path === "/borrar" && request.method === "POST") return borrar(request, env, cors, url);
    } catch (err) {
      return json({ error: "server_error", detail: String((err && err.message) || err) }, 500, cors);
    }

    return json({ error: "not_found" }, 404, cors);
  },
};

/* ─────────────────────────── dejar un mensaje ─────────────────────────── */

async function dejar(request, env, cors) {
  if (env.RATE_LIMITER) {
    const ip = request.headers.get("CF-Connecting-IP") || "anon";
    try {
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) return json({ error: "rate_limited" }, 429, cors);
    } catch (_) {
      /* si el binding falla, seguimos */
    }
  }

  let form;
  try {
    form = await request.formData();
  } catch (_) {
    return json({ error: "bad_form" }, 400, cors);
  }

  const audio = form.get("audio");
  if (!audio || typeof audio === "string") {
    return json({ error: "sin_audio" }, 400, cors);
  }

  const mime = String(form.get("mime") || audio.type || "audio/webm").slice(0, 60);
  if (!/^audio\//.test(mime)) {
    return json({ error: "no_es_audio" }, 415, cors);
  }

  const buf = await audio.arrayBuffer();
  if (!buf.byteLength) return json({ error: "audio_vacio" }, 400, cors);
  if (buf.byteLength > MAX_BYTES) return json({ error: "muy_grande" }, 413, cors);

  let nombre = String(form.get("nombre") || "").replace(/\s+/g, " ").trim().slice(0, MAX_NOMBRE);
  const dur = Math.max(0, Math.min(3600, parseInt(form.get("dur"), 10) || 0));

  const ts = Date.now();
  const id = `${ts}-${Math.random().toString(36).slice(2, 8)}`;
  const meta = {
    nombre: nombre || "",
    ts,
    dur,
    mime,
    size: buf.byteLength,
    ua: (request.headers.get("User-Agent") || "").slice(0, 120),
    ip: (request.headers.get("CF-Connecting-IP") || "").slice(0, 45),
  };

  await env.MENSAJES.put(`msg:${id}`, buf, { metadata: meta, expirationTtl: TTL });

  return json({ ok: true, id }, 200, cors);
}

/* ─────────────────────────── bandeja (PIN) ─────────────────────────── */

function pinOk(env, url) {
  const pin = url.searchParams.get("key") || "";
  const real = env.INBOX_PIN || "";
  if (!real) return null; // no configurado
  if (pin.length !== real.length) return false;
  let diff = 0;
  for (let i = 0; i < real.length; i++) diff |= pin.charCodeAt(i) ^ real.charCodeAt(i);
  return diff === 0;
}

async function listar(request, env, cors, url) {
  const ok = pinOk(env, url);
  if (ok === null) return json({ error: "sin_pin_config" }, 503, cors);
  if (!ok) return json({ error: "pin_invalido" }, 401, cors);

  const out = [];
  let cursor;
  do {
    const page = await env.MENSAJES.list({ prefix: "msg:", cursor, limit: 1000 });
    for (const k of page.keys) {
      const m = k.metadata || {};
      const id = k.name.slice(4);
      out.push({
        id,
        nombre: m.nombre || "",
        ts: m.ts || 0,
        dur: m.dur || 0,
        mime: m.mime || "audio/webm",
        size: m.size || 0,
      });
    }
    cursor = page.list_complete ? null : page.cursor;
  } while (cursor);

  // marca de escuchado
  const heard = new Set();
  {
    let c;
    do {
      const p = await env.MENSAJES.list({ prefix: "heard:", cursor: c, limit: 1000 });
      for (const k of p.keys) heard.add(k.name.slice(6));
      c = p.list_complete ? null : p.cursor;
    } while (c);
  }
  out.forEach((m) => (m.heard = heard.has(m.id)));
  out.sort((a, b) => b.ts - a.ts);

  return json({ ok: true, mensajes: out }, 200, cors);
}

async function servirAudio(request, env, cors, url) {
  const ok = pinOk(env, url);
  if (ok === null) return new Response("PIN no configurado", { status: 503, headers: cors });
  if (!ok) return new Response("PIN inválido", { status: 401, headers: cors });

  const id = (url.searchParams.get("id") || "").slice(0, 40);
  const { value, metadata } = await env.MENSAJES.getWithMetadata(`msg:${id}`, { type: "arrayBuffer" });
  if (!value) return new Response("No está", { status: 404, headers: cors });

  return new Response(value, {
    status: 200,
    headers: {
      ...cors,
      "Content-Type": (metadata && metadata.mime) || "audio/webm",
      "Content-Length": String(value.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}

async function marcar(request, env, cors, url) {
  const ok = pinOk(env, url);
  if (ok === null) return json({ error: "sin_pin_config" }, 503, cors);
  if (!ok) return json({ error: "pin_invalido" }, 401, cors);
  const id = (url.searchParams.get("id") || "").slice(0, 40);
  await env.MENSAJES.put(`heard:${id}`, "1", { expirationTtl: TTL });
  return json({ ok: true }, 200, cors);
}

async function borrar(request, env, cors, url) {
  const ok = pinOk(env, url);
  if (ok === null) return json({ error: "sin_pin_config" }, 503, cors);
  if (!ok) return json({ error: "pin_invalido" }, 401, cors);
  const id = (url.searchParams.get("id") || "").slice(0, 40);
  await env.MENSAJES.delete(`msg:${id}`);
  await env.MENSAJES.delete(`heard:${id}`);
  return json({ ok: true }, 200, cors);
}

/* ─────────────────────────── helpers ─────────────────────────── */

function corsHeaders(origin) {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function json(obj, status, cors) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...cors, "Content-Type": "application/json; charset=utf-8" },
  });
}
