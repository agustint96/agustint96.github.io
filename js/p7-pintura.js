// Parallax 7 (la navecita del fondo del index): en realidad esas navecitas son
// los villanos del nivel 4, los que arrojan polígonos. Al pasarles el mouse por
// encima se les sale la pintura: se ponen en blanco y negro (el mismo dibujo con
// sombra interna que usa el final del escenario 4, ver armarSpriteP7BN en
// esc4-game.js) por parches que arrancan donde pasó el mouse, y de cada parche
// que se levanta se desprende un poligonito negro con borde blanco (como los
// que caen en el juego), que cae girando. Un rato después de sacar el mouse
// recupera el color, y se puede repetir.
//
// La nave no recibe eventos del mouse (pointer-events: none en styles.css, como
// las demás capas): se detecta el hover con el canal alfa real del PNG. Mientras
// dura el efecto un canvas (hijo de #p7, así acompaña su parallax y su huida de
// la nave, ver updateP7Flee en script.js) reemplaza al <img>.
//
// Con el sitio abierto desde file:// el canvas queda "tainted" y no se pueden
// leer los píxeles: ahí el efecto no se activa (en un servidor anda normal).
(function () {
  const p7 = document.getElementById("p7");
  const img = p7 && p7.querySelector("img");
  if (!img) return;

  const R = { x: 58, y: 11, w: 111, h: 83 }; // dónde está la nave dentro del PNG (px del PNG; igual que P7_RECORTE en esc4-game.js)
  const MARGEN = 8; // px del PNG alrededor de la nave, para que la sombra interna cierre en los bordes
  const RES = 2; // resolución del canvas respecto del PNG
  const SOMBRA = { difusion: 7, dx: 1.5, dy: 3, pasadas: 3 }; // sombra interna, en px del PNG (igual que P7_SOMBRA)
  const LADO = 70; // px del PNG que sobran a cada lado del canvas, para los poligonitos
  const CAIDA = 340; // px del PNG que sobran abajo: lo que pueden caer los poligonitos

  const PELA_MS = 1500; // lo que tarda en salirse toda la pintura
  const BORDE = 0.05; // ancho (en fracción del tiempo) del borde levantado de cada parche, un poco más claro
  const ESPERA_MS = 2500; // cuánto queda en blanco y negro después de sacar el mouse
  const VUELTA_MS = 900; // lo que tarda en volver el color
  const POLIGONO_PROB = 0.0005; // probabilidad de que cada punto que se levanta suelte un poligonito
  const POLIGONOS_MAX = 14;
  const POLIGONO_RADIO = [4.5, 8.5]; // px del PNG
  const POLIGONO_BORDE = 1.2; // px del PNG
  const GRAVEDAD = 420; // px del PNG por s²

  const reducido = window.matchMedia("(prefers-reduced-motion: reduce)")
    .matches;
  const suave = (t) => t * t * (3 - 2 * t);
  const nuevoCanvas = (w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  };
  // Los canvas del sprite (color y gris) se leen con getImageData: por CPU
  // (willReadFrequently) esa lectura no tiene que bajar la textura de la GPU, que
  // era casi todo el costo de armar().
  const ctxLectura = (c) => c.getContext("2d", { willReadFrequently: true });

  let listo = false;
  let inutil = false; // no se pueden leer los píxeles
  let sw, sh; // tamaño del sprite (px del canvas)
  let colorC, grisC; // el sprite a color y en blanco y negro
  let colorD, grisD; // sus píxeles
  let opacos; // índices de los píxeles que son nave
  let cv, ctx; // el canvas que se ve
  let frame; // ImageData del sprite mientras se pela
  const offX = LADO * RES; // dónde queda el sprite dentro del canvas (el alto arranca en 0)

  function armar() {
    if (listo || inutil || !img.naturalWidth) return;
    sw = (R.w + MARGEN * 2) * RES;
    sh = (R.h + MARGEN * 2) * RES;
    const recorte = (c) =>
      c.drawImage(
        img,
        R.x - MARGEN,
        R.y - MARGEN,
        sw / RES,
        sh / RES,
        0,
        0,
        sw,
        sh,
      );
    colorC = nuevoCanvas(sw, sh);
    const cc = ctxLectura(colorC);
    recorte(cc);
    // Gris: se desatura con un relleno gris en modo "saturation" y se vuelve a
    // recortar con la silueta (el relleno también pinta lo transparente).
    grisC = nuevoCanvas(sw, sh);
    const g = ctxLectura(grisC);
    recorte(g);
    g.globalCompositeOperation = "saturation";
    g.fillStyle = "#808080";
    g.fillRect(0, 0, sw, sh);
    g.globalCompositeOperation = "destination-in";
    recorte(g);
    // Sombra interna: todo lo que NO es nave, difuminado y corrido, dibujado
    // solo encima de la nave.
    const fuera = nuevoCanvas(sw, sh);
    const f = fuera.getContext("2d");
    f.fillStyle = "#000";
    f.fillRect(0, 0, sw, sh);
    f.globalCompositeOperation = "destination-out";
    recorte(f);
    g.globalCompositeOperation = "source-atop";
    g.shadowColor = "#000";
    g.shadowBlur = SOMBRA.difusion * RES;
    g.shadowOffsetX = sw * 2 + SOMBRA.dx * RES;
    g.shadowOffsetY = SOMBRA.dy * RES;
    for (let i = 0; i < SOMBRA.pasadas; i++) g.drawImage(fuera, -sw * 2, 0);
    g.shadowColor = "transparent";
    g.globalCompositeOperation = "source-over";
    try {
      colorD = cc.getImageData(0, 0, sw, sh).data;
      grisD = g.getImageData(0, 0, sw, sh).data;
    } catch (err) {
      inutil = true;
      return;
    }
    const lista = [];
    for (let i = 0; i < sw * sh; i++) if (colorD[i * 4 + 3] > 0) lista.push(i);
    opacos = Uint32Array.from(lista);
    frame = new ImageData(sw, sh);

    // El canvas que reemplaza al <img> mientras dura el efecto: cubre la nave
    // con su margen, más lugar a los costados y abajo para los poligonitos. Va
    // en porcentajes del PNG, así escala con la capa.
    const nw = img.naturalWidth;
    const nh = img.naturalHeight;
    cv = nuevoCanvas(
      (R.w + MARGEN * 2 + LADO * 2) * RES,
      (R.h + MARGEN * 2 + CAIDA) * RES,
    );
    cv.style.cssText =
      "position:absolute;pointer-events:none;display:none;" +
      `left:${((R.x - MARGEN - LADO) / nw) * 100}%;` +
      `top:${((R.y - MARGEN) / nh) * 100}%;` +
      `width:${(cv.width / RES / nw) * 100}%;` +
      `height:${(cv.height / RES / nh) * 100}%;`;
    ctx = cv.getContext("2d");
    p7.appendChild(cv);
    listo = true;
  }
  // Armar el efecto (varios canvas, sombra, lectura de píxeles) es lo más pesado
  // de este archivo, así que no va en la carga: se hace con el navegador
  // desocupado, ya con la página andando. Si el mouse llega antes a la nave, se
  // arma en ese momento (ver el mousemove de abajo).
  function armarCuandoPuedas() {
    if (listo || inutil) return;
    if (img.complete) armar();
    else img.addEventListener("load", armar, { once: true });
  }
  window.addEventListener("load", () => {
    if (window.requestIdleCallback)
      requestIdleCallback(armarCuandoPuedas, { timeout: 5000 });
    else setTimeout(armarCuandoPuedas, 2000);
  });

  // ¿El mouse está sobre la nave (píxel opaco, con un par de px de tolerancia)?
  // Devuelve el punto en px del sprite, o null.
  function tocaNave(cx, cy) {
    const r = img.getBoundingClientRect();
    if (!r.width || cx < r.left || cx > r.right || cy < r.top || cy > r.bottom)
      return null;
    const sx = ((cx - r.left) / r.width) * img.naturalWidth - (R.x - MARGEN);
    const sy = ((cy - r.top) / r.height) * img.naturalHeight - (R.y - MARGEN);
    const px = sx * RES;
    const py = sy * RES;
    const tol = 2 * RES;
    for (let dy = -tol; dy <= tol; dy += tol) {
      for (let dx = -tol; dx <= tol; dx += tol) {
        const x = Math.round(px + dx);
        const y = Math.round(py + dy);
        if (
          x >= 0 &&
          y >= 0 &&
          x < sw &&
          y < sh &&
          colorD[(y * sw + x) * 4 + 3] > 20
        )
          return { x: px, y: py };
      }
    }
    return null;
  }

  // Ruido de valor (manchas suaves entre 0 y 1) de w x h, con celdas de "celda" px.
  function ruido(w, h, celda) {
    const gw = Math.ceil(w / celda) + 2;
    const gh = Math.ceil(h / celda) + 2;
    const g = new Float32Array(gw * gh);
    for (let i = 0; i < g.length; i++) g[i] = Math.random();
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      const fy = y / celda;
      const y0 = Math.floor(fy);
      const ty = suave(fy - y0);
      for (let x = 0; x < w; x++) {
        const fx = x / celda;
        const x0 = Math.floor(fx);
        const tx = suave(fx - x0);
        const a = g[y0 * gw + x0];
        const b = g[y0 * gw + x0 + 1];
        const c = g[(y0 + 1) * gw + x0];
        const d = g[(y0 + 1) * gw + x0 + 1];
        const arriba = a + (b - a) * tx;
        out[y * w + x] = arriba + (c + (d - c) * tx - arriba) * ty;
      }
    }
    return out;
  }

  // Cuándo se levanta la pintura de cada punto (0 a 1): por parches (ruido), y
  // los parches más cercanos al mouse y los de arriba se levantan antes.
  let tpx = null;
  let orden = null; // los píxeles de la nave, del que se levanta primero al último
  function armarTiempos(hx, hy) {
    if (!tpx) tpx = new Float32Array(sw * sh);
    const gruesa = ruido(sw, sh, 9 * RES);
    const fina = ruido(sw, sh, 3.5 * RES);
    const maxD = Math.hypot(Math.max(hx, sw - hx), Math.max(hy, sh - hy));
    let min = Infinity;
    let max = -Infinity;
    for (let k = 0; k < opacos.length; k++) {
      const i = opacos[k];
      const x = i % sw;
      const y = (i / sw) | 0;
      const t =
        (0.38 * Math.hypot(x - hx, y - hy)) / maxD +
        0.42 * (0.65 * gruesa[i] + 0.35 * fina[i]) +
        (0.2 * y) / sh;
      tpx[i] = t;
      if (t < min) min = t;
      if (t > max) max = t;
    }
    for (let k = 0; k < opacos.length; k++) {
      const i = opacos[k];
      tpx[i] = (tpx[i] - min) / (max - min);
    }
    orden = Uint32Array.from(opacos).sort((a, b) => tpx[a] - tpx[b]);
  }

  // --- Poligonitos que se desprenden ----------------------------------------
  const poligonitos = [];
  // Igual que los del juego (crearPoligono en esc4-game.js): irregulares, de 4 a
  // 6 vértices ordenados por ángulo alrededor del centro, así nunca se cruzan.
  function nuevoPoligonito(i) {
    const radio =
      POLIGONO_RADIO[0] +
      Math.random() * (POLIGONO_RADIO[1] - POLIGONO_RADIO[0]);
    const n = 4 + Math.floor(Math.random() * 3);
    const paso = (Math.PI * 2) / n;
    const pts = [];
    for (let k = 0; k < n; k++) {
      const ang = k * paso + (Math.random() - 0.5) * paso * 0.6;
      const r = radio * (0.6 + Math.random() * 0.6);
      pts.push([Math.cos(ang) * r, Math.sin(ang) * r]);
    }
    return {
      x: LADO + (i % sw) / RES,
      y: ((i / sw) | 0) / RES,
      vx: (Math.random() - 0.5) * 50,
      vy: -30 + Math.random() * 20,
      rot: Math.random() * 6.28,
      vr: (Math.random() - 0.5) * 9,
      fase: Math.random() * 6.28,
      edad: 0,
      vida: 1.1 + Math.random() * 0.9,
      pts,
    };
  }

  function moverYDibujarPoligonitos(dt) {
    ctx.setTransform(RES, 0, 0, RES, 0, 0);
    ctx.fillStyle = "#000";
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = POLIGONO_BORDE;
    ctx.lineJoin = "round";
    const alto = cv.height / RES;
    for (let k = poligonitos.length - 1; k >= 0; k--) {
      const e = poligonitos[k];
      e.edad += dt;
      e.vy += GRAVEDAD * dt;
      e.x += (e.vx + Math.sin(e.edad * 7 + e.fase) * 22) * dt;
      e.y += e.vy * dt;
      e.rot += e.vr * dt;
      if (e.edad > e.vida || e.y > alto) {
        poligonitos.splice(k, 1);
        continue;
      }
      const fade = e.vida * 0.6;
      ctx.globalAlpha =
        e.edad > fade ? 1 - (e.edad - fade) / (e.vida - fade) : 1;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.rotate(e.rot);
      ctx.beginPath();
      ctx.moveTo(e.pts[0][0], e.pts[0][1]);
      for (let p = 1; p < e.pts.length; p++)
        ctx.lineTo(e.pts[p][0], e.pts[p][1]);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // --- Estados: quieto -> pela -> gris -> vuelve -> quieto ------------------
  let estado = "quieto";
  let t0 = 0; // cuándo empezó a pelarse / a volver
  let sigo = 0; // cuántos puntos de "orden" ya se levantaron
  let ultimoHover = 0;
  let ultimoCuadro = 0;
  let raf = 0;
  let timerEspera = 0;

  function pintarPela(p) {
    const d = frame.data;
    for (let k = 0; k < opacos.length; k++) {
      const i = opacos[k];
      const j = i * 4;
      const t = tpx[i];
      const src = p >= t ? grisD : colorD;
      d[j] = src[j];
      d[j + 1] = src[j + 1];
      d[j + 2] = src[j + 2];
      d[j + 3] = src[j + 3];
      // El borde del parche que está por levantarse, un poco más claro.
      if (p < t && t - p < BORDE) {
        const l = (1 - (t - p) / BORDE) * 80;
        d[j] = Math.min(255, d[j] + l);
        d[j + 1] = Math.min(255, d[j + 1] + l);
        d[j + 2] = Math.min(255, d[j + 2] + l);
      }
    }
    ctx.putImageData(frame, offX, 0);
  }

  function cuadro(ahora) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0, (ahora - ultimoCuadro) / 1000));
    ultimoCuadro = ahora;
    ctx.clearRect(0, 0, cv.width, cv.height);
    if (estado === "pela") {
      const u = Math.min(1, (ahora - t0) / PELA_MS);
      const p = suave(u);
      while (sigo < orden.length && tpx[orden[sigo]] <= p) {
        const i = orden[sigo++];
        if (
          !reducido &&
          poligonitos.length < POLIGONOS_MAX &&
          Math.random() < POLIGONO_PROB
        )
          poligonitos.push(nuevoPoligonito(i));
      }
      pintarPela(p);
      if (u >= 1) {
        estado = "gris";
        esperarVuelta();
      }
    } else if (estado === "gris") {
      ctx.drawImage(grisC, offX, 0);
    } else if (estado === "vuelve") {
      const u = Math.min(1, (ahora - t0) / VUELTA_MS);
      ctx.drawImage(grisC, offX, 0);
      ctx.globalAlpha = suave(u);
      ctx.drawImage(colorC, offX, 0);
      ctx.globalAlpha = 1;
      if (u >= 1) return terminar();
    }
    moverYDibujarPoligonitos(dt);
    if (estado === "pela" || estado === "vuelve" || poligonitos.length)
      correr();
  }

  function correr() {
    if (raf) return;
    ultimoCuadro = performance.now();
    raf = requestAnimationFrame(cuadro);
  }

  // Un rato después del último hover (se vuelve a mirar si el mouse siguió
  // encima) empieza a volver el color.
  function esperarVuelta() {
    clearTimeout(timerEspera);
    timerEspera = setTimeout(function revisar() {
      if (estado !== "gris") return;
      const resto = ESPERA_MS - (performance.now() - ultimoHover);
      if (resto > 50) {
        timerEspera = setTimeout(revisar, resto);
        return;
      }
      estado = "vuelve";
      t0 = performance.now();
      correr();
    }, ESPERA_MS);
  }

  function terminar() {
    estado = "quieto";
    poligonitos.length = 0;
    cv.style.display = "none";
    img.style.visibility = "";
  }

  function iniciar(punto) {
    armarTiempos(punto.x, punto.y);
    estado = "pela";
    t0 = performance.now();
    sigo = 0;
    poligonitos.length = 0;
    cv.style.display = "";
    img.style.visibility = "hidden"; // lo reemplaza el canvas
    correr();
  }

  document.addEventListener("mousemove", (ev) => {
    // Solo en la escena principal: en los demás la capa queda tapada.
    if (typeof currentSceneId !== "undefined" && currentSceneId !== "main")
      return;
    if (!listo) {
      // Todavía no se armó (ver armarCuandoPuedas): si el mouse ya está sobre el
      // sprite, se arma ahora; si no, nada.
      if (inutil || !img.complete) return;
      const r = img.getBoundingClientRect();
      if (
        ev.clientX < r.left ||
        ev.clientX > r.right ||
        ev.clientY < r.top ||
        ev.clientY > r.bottom
      )
        return;
      armar();
      if (!listo) return;
    }
    const punto = tocaNave(ev.clientX, ev.clientY);
    if (!punto) return;
    ultimoHover = performance.now();
    if (estado === "quieto") iniciar(punto);
    else if (estado === "vuelve") {
      // Volvió el mouse mientras recuperaba el color: se queda gris otra vez.
      estado = "gris";
      esperarVuelta();
      correr();
    }
  });
})();
