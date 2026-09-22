const nav = document.getElementById("main-nav");
const navLinks = nav
  ? Array.from(nav.querySelectorAll("a")).filter((a) => !a.closest(".cv-menu"))
  : [];

// Registro de escenarios: cada uno es un nodo de un mapa. Sus 4 bordes
// (arriba/abajo/izq/der) pueden llevar a otro escenario
// (edges[borde] = {to, enter, requiresDesktop}); un borde sin entrada ahí
// simplemente clampea, como ya pasa hoy en cualquier borde sin escenario del
// otro lado. El resto de la config (parallaxZones, camera, speedMult,
// heightScale, shipClass, light, setVisible) es opcional -un escenario
// simple, sin cámara propia ni objetos interactuables, no necesita declarar
// nada de eso, el tick de vuelo usa valores por defecto razonables-. Ver el
// tick de vuelo (más abajo, junto a #starry-cohete-pair) para cómo se arma
// scenes.main/scenes.space, con un ejemplo de cómo sumar un escenario nuevo.
const scenes = {};
function registerScene(id, config) {
  scenes[id] = Object.assign(
    { edges: {}, parallaxZones: [], camera: null, speedMult: 1 },
    config,
    { id },
  );
  return scenes[id];
}
let currentSceneId = "main";

// Independencia del monitor: la física y los suavizados del sitio (la nave, el
// zoom de cámara, el parallax, las piedras, el texto BIOS) se afinaron en un
// monitor de 60 Hz con constantes "por cuadro", así que en uno de 120 o 144 Hz
// todo iba al doble de velocidad o más (y la nave del juego, más fácil de manejar
// contra unos polígonos que caen en tiempo real). Ahora esas constantes siguen
// valiendo "por cuadro de 60 Hz" pero se aplican según cuántos cuadros de 60 Hz
// pasaron de verdad (cuadrosDe): en 60 Hz es exactamente lo de siempre.
const SIM_PASO_MS = 1000 / 60;
// Tope (~50 ms): si un cuadro tarda más (pestaña en segundo plano, un tirón) la
// simulación se atrasa en vez de teletransportar la nave.
const SIM_MAX_CUADROS = 3;
const cuadrosDe = (ms) => Math.min(SIM_MAX_CUADROS, Math.max(0, ms) / SIM_PASO_MS);
// Un suavizado "k por cuadro" (x += (meta - x) * k) aplicado a c cuadros.
const suavizadoPor = (k, c) => 1 - Math.pow(1 - k, c);

// Zonas del parallax que la nave puede "tocar" en el escenario principal:
// cada una sabe cómo calcular su rectángulo actual y cómo reproducir su
// sonido (reusado por click de mouse y por el botón A/X del joystick / tecla
// E cuando la nave está encima). Misma referencia que scenes.main.parallaxZones,
// así los registros de guitarra/satélite/bajo (más abajo) no necesitan tocarse.
const parallaxZones = registerScene("main", {}).parallaxZones;
// Prende/apaga la luz de la nave; se asigna más abajo y la reusa el botón Y del joystick.
let toggleShipLight = null;

// Posición actual del centro de la nave, expuesta para que otros módulos
// (ej. el "planeta" que huye en parallax 7) sepan si se les está acercando,
// sin acoplarse al closure del movimiento de la nave.
let shipCenterX = null;
let shipCenterY = null;

// Test de "pixel opaco": muchas imágenes del parallax tienen mucho margen
// transparente dentro de su bounding box (ej. parallax 3, la guitarra, solo
// tiene contenido visible en ~23% de su caja). En vez de disparar el sonido
// con solo tocar el rectángulo, esto chequea el canal alfa real del PNG en
// el punto exacto (click de mouse o centro de la nave).
function createAlphaHitTester(imgEl, alphaThreshold = 20) {
  let canvas = null;
  let ctx = null;
  let ready = false;

  // Se arma recién la primera vez que alguien apunta adentro de la imagen, no al
  // cargar (dibujar y leer los píxeles de cada sprite en la carga costaba cientos
  // de ms de hilo principal). willReadFrequently: canvas por CPU, así el
  // getImageData de cada test no tiene que bajar la textura de la GPU.
  function prepare() {
    if (ready || !imgEl.naturalWidth) return;
    canvas = document.createElement("canvas");
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(imgEl, 0, 0);
    ready = true;
  }

  return function isOpaqueAt(clientX, clientY) {
    const rect = imgEl.getBoundingClientRect();
    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      return false;
    }
    if (!ready) prepare();
    if (!ready) return true; // sin datos todavía: no bloquear la interacción
    const px = Math.min(
      canvas.width - 1,
      Math.max(
        0,
        Math.floor(((clientX - rect.left) / rect.width) * canvas.width),
      ),
    );
    const py = Math.min(
      canvas.height - 1,
      Math.max(
        0,
        Math.floor(((clientY - rect.top) / rect.height) * canvas.height),
      ),
    );
    try {
      return ctx.getImageData(px, py, 1, 1).data[3] > alphaThreshold;
    } catch (err) {
      return true; // canvas "tainted" (ej. abierto con file://): no bloquear
    }
  };
}

// Calcula (una sola vez) el recuadro que realmente contiene el dibujo dentro
// del PNG, ignorando el margen transparente, y lo devuelve en coordenadas de
// pantalla agrandado por un margen. Sirve para detectar "se está acercando"
// en vez de "recién ahora me tocó" (ej. el planeta de parallax 7, que tiene
// que escaparse ANTES de que lo alcancen).
function createOpaqueBoundsTracker(imgEl, alphaThreshold = 20) {
  let bounds = null; // fracciones 0..1 relativas al tamaño natural de la imagen

  // El recuadro se saca de una miniatura (a lo sumo BOUNDS_MAX px de lado) y no
  // del PNG entero: recorrer todos los píxeles de un sprite de ~1000x700 al
  // cargar costaba unos 400 ms, y para un colchón de decenas de px alcanza y
  // sobra. Al promediar, un píxel suelto queda con poca opacidad: por eso el
  // umbral de la miniatura es más bajo (el recuadro sale igual o apenas más
  // grande que el real, que es el lado seguro para "se está acercando").
  const BOUNDS_MAX = 250;
  const umbral = Math.min(alphaThreshold, 8);
  function prepare() {
    if (bounds || !imgEl.naturalWidth) return;
    const escala = Math.min(
      1,
      BOUNDS_MAX / Math.max(imgEl.naturalWidth, imgEl.naturalHeight),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(imgEl.naturalWidth * escala));
    canvas.height = Math.max(1, Math.round(imgEl.naturalHeight * escala));
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    let data;
    try {
      data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    } catch (err) {
      return; // canvas "tainted": nos quedamos sin datos, ver fallback abajo
    }
    let minX = canvas.width,
      minY = canvas.height,
      maxX = -1,
      maxY = -1;
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        if (data[(y * canvas.width + x) * 4 + 3] > umbral) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX >= minX && maxY >= minY) {
      bounds = {
        l: minX / canvas.width,
        t: minY / canvas.height,
        r: (maxX + 1) / canvas.width,
        b: (maxY + 1) / canvas.height,
      };
    }
  }

  if (imgEl.complete) prepare();
  else imgEl.addEventListener("load", prepare, { once: true });

  return function getDangerRect(margin = 0) {
    const rect = imgEl.getBoundingClientRect();
    const box = bounds
      ? {
          left: rect.left + bounds.l * rect.width,
          right: rect.left + bounds.r * rect.width,
          top: rect.top + bounds.t * rect.height,
          bottom: rect.top + bounds.b * rect.height,
        }
      : rect; // todavía no calculado: usar la caja completa como fallback
    return {
      left: box.left - margin,
      right: box.right + margin,
      top: box.top - margin,
      bottom: box.bottom + margin,
    };
  };
}

function pointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

// --- Efectos de sonido (index y escenario 2) --------------------------------
// Antes cada sonido tardaba en salir la primera vez (unos 500 ms o más): los
// <audio> con preload="none" recién empezaban a bajarse al accionarlos, las luces
// de la nave creaban un <audio> nuevo en cada toque y el beep necesitaba un
// AudioContext, que se crea con el primer clic, bloquea la página unos 300 ms y,
// sin un gesto previo, el navegador lo deja suspendido y arrancarlo tarda otro
// tanto. Ahora los archivos (~200 KB en total) se bajan con el navegador
// desocupado y se le dan al <audio> como archivo en memoria (blob:): no
// se depende de que el navegador decida bajar un preload="auto", y al accionar
// un sonido ya está todo cargado (medido: pocos ms desde el clic).
// Para sumar un sonido: una línea acá y sfxPlay("nombre") donde corresponda.
//   vol: volumen; reiniciar: si suena de nuevo mientras suena, corta el anterior y
//   arranca de cero; si no, pueden solaparse (hasta `copias` a la vez).
const SFX = {
  beep: { url: "audio/beep.m4a", vol: 0.15, copias: 3 },
  guitarra: { url: "audio/Guitarra.m4a", vol: 0.12, reiniciar: true },
  bajo: { url: "audio/bass.m4a", vol: 0.6, reiniciar: true },
  satelite: { url: "audio/satelite.m4a", vol: 0.25, reiniciar: true },
  luzOn: { url: "audio/light_on.m4a", vol: 1, copias: 2 },
  luzOff: { url: "audio/light_off.m4a", vol: 1, copias: 2 },
  planeta: { url: "audio/Esc2/everyone.m4a", vol: 0.5, reiniciar: true },
};
const sfxPool = {}; // nombre -> { audios: [<audio>], i: siguiente a reusar } (cuando está listo)
const sfxPedido = {}; // nombre -> true si ya se pidió el archivo
const sfxRespaldo = {}; // nombre -> <audio> normal, por si se acciona antes de que esté listo

function sfxPreparar(nombre) {
  if (sfxPedido[nombre]) return;
  sfxPedido[nombre] = true;
  const def = SFX[nombre];
  fetch(def.url)
    .then((response) => response.blob())
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const audios = [];
      for (let k = 0; k < (def.reiniciar ? 1 : def.copias || 2); k++) {
        const audio = new Audio();
        audio.preload = "auto";
        audio.src = url;
        // Al terminar se rebobina solo, en segundo plano: rebobinar un audio ya
        // cargado obliga al navegador a hacer un "seek" (reinicia el decodificador)
        // y, hecho justo al accionarlo, atrasa el sonido.
        audio.addEventListener("ended", () => {
          audio.currentTime = 0;
        });
        audio.load();
        audios.push(audio);
      }
      sfxPool[nombre] = { audios, i: 0 };
    })
    .catch(() => {
      sfxPedido[nombre] = false; // que se pueda reintentar en la próxima
    });
}

function sfxPlay(nombre, volumen) {
  const def = SFX[nombre];
  if (!def) return;
  const vol = volumen === undefined ? def.vol : volumen;
  const pool = sfxPool[nombre];
  let audio;
  if (pool) {
    audio = def.reiniciar
      ? pool.audios[0]
      : pool.audios.find((a) => a.paused || a.ended) ||
        pool.audios[pool.i++ % pool.audios.length];
  } else {
    // Todavía no está listo (se accionó antes de tiempo): <audio> normal, como
    // antes, y se pide para la próxima.
    sfxPreparar(nombre);
    audio = def.reiniciar ? sfxRespaldo[nombre] : null;
    if (!audio) {
      audio = new Audio(def.url);
      if (def.reiniciar) sfxRespaldo[nombre] = audio;
    }
  }
  audio.volume = vol;
  // Solo se rebobina si hace falta (si ya sonó y quedó a mitad de camino, como al
  // volver a accionar un "reiniciar"): en 0 no hay nada que hacer, y pedirlo igual
  // hace un seek que atrasa el primer sonido.
  if (audio.currentTime > 0) {
    try {
      audio.currentTime = 0;
    } catch (err) {}
  }
  audio.play().catch(() => {});
}

function playBeep() {
  sfxPlay("beep");
}

// El beep se pide ya (7 KB, sin costo); el resto, apenas termina la carga de la
// página (son ~200 KB: no compite con nada de lo que se ve, y no se espera a un
// momento "desocupado" porque puede tardar y un clic rápido los encontraría sin
// listar).
sfxPreparar("beep");
window.addEventListener("load", () => {
  setTimeout(() => Object.keys(SFX).forEach(sfxPreparar), 200);
});

navLinks.forEach((link) => {
  link.addEventListener("pointerenter", () => {
    if (!link.matches(":hover")) return;
    playBeep();
  });
});

// Botón de encendido: sonido de arranque + parpadeo CRT antes de abrir la consola SQL
const powerBtn = document.querySelector(".power-btn");
// El <audio> del arranque se prepara antes (con el navegador desocupado) para que
// suene en el acto al apretar el botón, no cuando recién empieza a bajarse.
let encendidoPrecargado = null;
if (powerBtn) {
  window.addEventListener("load", () => {
    const preparar = () => {
      try {
        encendidoPrecargado = new Audio("audio/sisopon.m4a");
        encendidoPrecargado.preload = "auto";
      } catch (err) {}
    };
    if (window.requestIdleCallback)
      requestIdleCallback(preparar, { timeout: 4000 });
    else setTimeout(preparar, 2000);
  });
}
if (powerBtn) {
  powerBtn.addEventListener("click", (e) => {
    const href = powerBtn.getAttribute("href");
    if (
      !href ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.button === 1 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }
    e.preventDefault();
    if (powerBtn.dataset.booting) return;
    powerBtn.dataset.booting = "1";

    const scr = document.createElement("div");
    scr.className = "crt-screen flare";
    document.body.appendChild(scr);

    // Arranca el sonido de encendido; la consola lo retoma donde quedó
    // para que suene entero aunque la animación sea corta.
    const marcarInicio = (t0) => {
      try {
        sessionStorage.setItem("sisopon:desde", String(t0));
      } catch (err) {}
    };
    marcarInicio(Date.now());
    try {
      const encendido = encendidoPrecargado || new Audio("audio/sisopon.m4a");
      encendido.volume = 0.6;
      encendido.addEventListener("playing", () => {
        // t0 real del audio, descontando lo que ya avanzó
        marcarInicio(Date.now() - encendido.currentTime * 1000);
      });
      encendido.play().catch(() => {});
    } catch (err) {}

    setTimeout(() => {
      window.location.href = href;
    }, 1100);
  });
}

// Al volver con "atrás" (bfcache), limpiar el overlay de encendido que quedó
window.addEventListener("pageshow", () => {
  document.querySelectorAll(".crt-screen").forEach((el) => el.remove());
  if (powerBtn) delete powerBtn.dataset.booting;
});

window.addEventListener("scroll", () => {
  const t = window.scrollY > 60;
  (nav.classList.toggle("scrolled", t),
    t
      ? setTimeout(() => nav.classList.add("nav-compact"), 350)
      : nav.classList.remove("nav-compact"));
});
const burstCanvas = document.createElement("canvas");
((burstCanvas.style.cssText =
  "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;"),
  document.body.appendChild(burstCanvas));
const bctx = burstCanvas.getContext("2d");
function resizeBurst() {
  ((burstCanvas.width = window.innerWidth),
    (burstCanvas.height = window.innerHeight));
}
(resizeBurst(), window.addEventListener("resize", resizeBurst));
let burstParticles = [];
let burstDirty = false; // quedó algo dibujado que hay que borrar
function drawBurst() {
  // Sin partículas y con el canvas ya limpio no hay nada que hacer: limpiar un
  // canvas a pantalla completa en cada cuadro tiene su costo (y el juego se
  // nota).
  if (!burstParticles.length && !burstDirty) {
    requestAnimationFrame(drawBurst);
    return;
  }
  (bctx.clearRect(0, 0, burstCanvas.width, burstCanvas.height),
    (burstParticles = burstParticles.filter((t) => t.alpha > 0.01)));
  burstDirty = burstParticles.length > 0;
  for (const t of burstParticles)
    ((bctx.globalAlpha = t.alpha),
      (bctx.fillStyle = "#f19280"),
      bctx.beginPath(),
      bctx.arc(Math.round(t.x), Math.round(t.y), t.radius, 0, 2 * Math.PI),
      bctx.fill(),
      (t.x += t.vx),
      (t.y += t.vy),
      (t.vy += 0.06),
      (t.alpha -= 0.018));
  ((bctx.globalAlpha = 1), requestAnimationFrame(drawBurst));
}
drawBurst();
const group256 = document.getElementById("group-256"),
  p3el = document.getElementById("p3"),
  p7el = document.getElementById("p7"),
  p8el = document.getElementById("p8"),
  DEPTH_256 = 5e-4,
  DEPTH_P3 = 5e-4,
  DEPTH_P7 = 0.003,
  DEPTH_P8 = 8e-4,
  MAX_PX = 80;
let targetX = 0,
  currentX = 0;
// Lo último que tick() escribió en los transforms (NaN: todavía nada).
let drawnX = NaN,
  drawnFleeX = NaN,
  drawnFleeScale = NaN;
const lerp = (t, e, a) => t + (e - t) * a;

if (p3el) {
  const playGuitarra = () => sfxPlay("guitarra");
  const guitarraImg = p3el.querySelector("img");
  const hitGuitarra = guitarraImg
    ? createAlphaHitTester(guitarraImg)
    : () => true;
  p3el.addEventListener("click", (ev) => {
    if (!hitGuitarra(ev.clientX, ev.clientY)) return;
    playGuitarra();
  });
  parallaxZones.push({
    hitTest: hitGuitarra,
    trigger: playGuitarra,
  });
}

// Parpadeo de "luz" en parallax 4: al pasar el mouse por encima (pixel
// opaco real, no todo el rectángulo transparente) hace un parpadeo cortito
// -como un cartel de luz que titila al prenderse- del sprite de la luz sola
// ("parallax 4 luz sola.png", superpuesto en CSS sobre el dibujo base) y la
// deja fija prendida. Después de un rato prendida se apaga sola, sin
// parpadeo, y vuelve a estar disponible para prenderse de nuevo con otro
// hover.
const p4el = document.getElementById("p4");
if (p4el) {
  const p4Img = p4el.querySelector("img");
  const p4LuzImg = p4el.querySelector("img.p4-luz");
  const p4Glow = p4el.querySelector(".p4-glow");
  if (p4Img && p4LuzImg && p4Glow) {
    const hitP4 = createAlphaHitTester(p4Img);
    // Cuántos ms esperar entre cada cambio del parpadeo inicial (prendida,
    // apagada, prendida...); termina siempre prendida.
    const P4_FLICKER_STEPS = [60, 40, 90, 50, 120];
    const P4_LIT_MS = 5000; // cuánto tiempo se queda prendida antes de apagarse sola
    let p4Lit = false; // prendida (parpadeando o ya fija): ignora nuevos hovers
    const setP4LuzOn = (on) => {
      p4LuzImg.style.opacity = on ? "1" : "0";
      p4Glow.style.opacity = on ? "1" : "0";
    };
    const runP4Flicker = () => {
      if (p4Lit) return;
      p4Lit = true;
      let i = 0;
      const step = () => {
        setP4LuzOn(i % 2 === 0);
        if (i >= P4_FLICKER_STEPS.length) {
          setP4LuzOn(true);
          setTimeout(() => {
            setP4LuzOn(false);
            p4Lit = false;
          }, P4_LIT_MS);
          return;
        }
        setTimeout(step, P4_FLICKER_STEPS[i]);
        i++;
      };
      step();
    };
    document.addEventListener("mousemove", (ev) => {
      // Solo en la principal: en los demás escenarios parallax 4 está oculto.
      if (currentSceneId !== "main") return;
      if (p4Lit) return;
      if (hitP4(ev.clientX, ev.clientY)) runP4Flicker();
    });
  }
}

// El "planeta" de parallax 7 le tiene miedo SOLO a la nave (no al mouse/touch
// en sí, solo cuando mueve a la nave): apenas se acerca a su dibujo real (no
// al margen transparente), sale corriendo hacia la izquierda mientras se
// achica hasta desaparecer. Mientras la nave siga cerca se queda escondido;
// recién cuando la nave está lejos de su posición de origen empieza a volver
// de a poco, y si la nave vuelve a acercarse mientras está volviendo, se
// vuelve a esconder.
const p7Img = p7el ? p7el.querySelector("img") : null;
const getP7DangerRect = p7Img ? createOpaqueBoundsTracker(p7Img) : null;
const P7_DANGER_MARGIN = 70; // px de colchón: si la nave entra acá, huye
const P7_SAFE_MARGIN = 90; // px: recién si la nave sale de acá, puede volver
const P7_FLEE_SPEED = 18; // px por frame que se corre hacia la izquierda al huir
const P7_SHRINK_RATE = 0.018; // cuánto se achica por frame al huir
const P7_RETURN_SPEED = 3; // px por frame que recupera al volver (de a poco)
const P7_RETURN_GROW_RATE = 0.003; // cuánto crece por frame al volver
let p7Fleeing = false;
let p7FleeOffsetX = 0;
let p7FleeScale = 1;

function updateP7Flee(cuadros) {
  if (!getP7DangerRect) return;
  // Sin nave todavía y con el planeta en su lugar no hay nada que calcular (y
  // getDangerRect mide el layout, que no es gratis a cada cuadro).
  if (shipCenterX === null && !p7Fleeing && p7FleeOffsetX >= 0) return;

  const dangerRect = getP7DangerRect(P7_DANGER_MARGIN);
  const shipNear =
    shipCenterX !== null && pointInRect(shipCenterX, shipCenterY, dangerRect);

  if (shipNear) p7Fleeing = true;

  if (p7Fleeing) {
    p7FleeOffsetX -= P7_FLEE_SPEED * cuadros;
    p7FleeScale = Math.max(0, p7FleeScale - P7_SHRINK_RATE * cuadros);
    if (p7FleeScale <= 0) p7Fleeing = false; // ya está escondido, ahora espera
    return;
  }

  if (p7FleeOffsetX >= 0) return; // ya está en su posición, nada que hacer

  // Sigue escondido/a mitad de camino: solo vuelve si la nave está lejos de
  // donde reaparecería (posición de origen), para no reaparecer en su cara.
  const safeRect = getP7DangerRect(P7_SAFE_MARGIN);
  const homeSafeRect = {
    left: safeRect.left - p7FleeOffsetX,
    right: safeRect.right - p7FleeOffsetX,
    top: safeRect.top,
    bottom: safeRect.bottom,
  };
  const shipFar =
    shipCenterX === null ||
    !pointInRect(shipCenterX, shipCenterY, homeSafeRect);
  if (shipFar) {
    p7FleeOffsetX = Math.min(0, p7FleeOffsetX + P7_RETURN_SPEED * cuadros);
    p7FleeScale = Math.min(1, p7FleeScale + P7_RETURN_GROW_RATE * cuadros);
  }
}

let parallaxPrevT = 0;
function tick() {
  const ahora = performance.now();
  const cuadros = parallaxPrevT ? cuadrosDe(ahora - parallaxPrevT) : 1;
  parallaxPrevT = ahora;
  // El parallax solo se mueve cuando la escena principal es la que se ve; en el
  // resto de los escenarios (la principal queda oculta) no tiene sentido tocar
  // los estilos de todas esas capas cuadro a cuadro.
  if (currentSceneId === "main") {
    updateP7Flee(cuadros);
    // Con el mouse quieto el lerp se acerca a targetX sin llegar nunca, y se
    // reescribían 4 transforms por cuadro para mover capas fracciones de
    // milésima de píxel. A menos de 5e-4 (~0,01 px en la capa que más se
    // mueve) se clava en el valor final, y los estilos sólo se escriben si algo
    // cambió respecto de lo último que se escribió.
    currentX =
      Math.abs(targetX - currentX) < 5e-4
        ? targetX
        : lerp(currentX, targetX, suavizadoPor(0.04, cuadros));
    if (
      currentX !== drawnX ||
      p7FleeOffsetX !== drawnFleeX ||
      p7FleeScale !== drawnFleeScale
    ) {
      ((drawnX = currentX),
        (drawnFleeX = p7FleeOffsetX),
        (drawnFleeScale = p7FleeScale),
        group256 &&
          (group256.style.transform = `translateX(${MAX_PX * currentX * DEPTH_256 * 100}px)`),
        p3el &&
          (p3el.style.transform = `translateX(${MAX_PX * -currentX * DEPTH_P3 * 100}px)`),
        p7el &&
          (p7el.style.transform = `translateX(${MAX_PX * currentX * DEPTH_P7 * 100 + p7FleeOffsetX}px) scale(${p7FleeScale})`),
        p8el &&
          (p8el.style.transform = `translateX(${MAX_PX * -currentX * DEPTH_P8 * 100}px)`));
    }
  }
  requestAnimationFrame(tick);
}
(document.addEventListener("mousemove", (t) => {
  if (window.innerWidth <= 600) return;
  targetX = 2 * (t.clientX / window.innerWidth - 0.5);
}),
  window.addEventListener("deviceorientation", (t) => {
    if (window.innerWidth <= 600) return;
    null !== t.gamma && (targetX = Math.max(-1, Math.min(1, t.gamma / 30)));
  }),
  window.innerWidth > 600 && tick());
const starCanvas = document.getElementById("star-canvas"),
  ctx = starCanvas.getContext("2d"),
  starryBg = starCanvas.parentElement;
let stars = [];
const starRadius = 1.5;
function resizeCanvas() {
  const t = starryBg.offsetWidth || window.innerWidth,
    e = starryBg.offsetHeight || 300;
  (starCanvas.width === t && starCanvas.height === e) ||
    ((starCanvas.width = t), (starCanvas.height = e));
}
function addStars(t, e) {
  // Solo en la principal: drawStars es lo único que las apaga y no corre en los
  // demás escenarios, así que si se siguieran agregando (el setInterval de
  // abajo no para) se acumulaban y al volver aparecían todas juntas, con lag.
  if (currentSceneId !== "main") return;
  const a = starCanvas.width || window.innerWidth,
    n = starCanvas.height || 300;
  for (let r = 0; r < t; r++)
    stars.push({
      x: Math.random() * a,
      y: Math.random() * n,
      rot: Math.random() * Math.PI * 0.5,
      alpha: e ?? 0.9,
      vy: -(0.3 * Math.random() + 0.008),
    });
}
// Estrella de 4 puntas (destello), no un círculo -mismo dibujo que las
// estrellas de la escena de espacio profundo (ver drawSparkle ahí)-.
function drawStarSparkle(x, y, r, rot) {
  ctx.save();
  ctx.translate(x, y);
  if (rot) ctx.rotate(rot);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
  ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
  ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
  ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function drawStars() {
  // Solo en la principal (en los demás escenarios este canvas está oculto).
  if (currentSceneId !== "main") {
    requestAnimationFrame(drawStars);
    return;
  }
  (ctx.clearRect(0, 0, starCanvas.width, starCanvas.height),
    (stars = stars.filter((t) => t.alpha > 0.01)));
  for (const t of stars)
    ((ctx.globalAlpha = t.alpha),
      (ctx.fillStyle = "#f19280"),
      drawStarSparkle(Math.round(t.x), Math.round(t.y), starRadius, t.rot),
      (t.y += t.vy),
      (t.alpha -= 0.006));
  ((ctx.globalAlpha = 1), requestAnimationFrame(drawStars));
}
(resizeCanvas(),
  new ResizeObserver(resizeCanvas).observe(starryBg),
  window.addEventListener("resize", resizeCanvas),
  starryBg.addEventListener("mousemove", () =>
    addStars(Math.floor(2 * Math.random()) + 1),
  ),
  starryBg.addEventListener("touchmove", () => {
    if (window.innerWidth <= 600) addStars(1);
    else addStars(Math.floor(2 * Math.random()) + 1);
  }),
  starryBg.addEventListener(
    "touchstart",
    () => {
      if (window.innerWidth <= 600) addStars(1);
      else addStars(2);
    },
    { passive: !0 },
  ),
  setInterval(() => addStars(Math.floor(3 * Math.random()) + 2, 0.75), 300),
  drawStars(),
  (function () {
    // Cielo estrellado real: las estrellas quedan fijas en su lugar -no
    // nacen ni derivan ni mueren como las partículas de .starry-bg-, y
    // solo un ~4% titila (se apaga y vuelve a prender) en cualquier
    // momento dado, sin depender del mouse. El mouse/touch no las toca:
    // en cambio hace aparecer destellos salmón nuevos, en otros lugares al
    // azar, que se prenden y apagan solos (ver spaceSparkles más abajo).
    const canvas = document.getElementById("space-scene-canvas");
    if (!canvas) return;
    const spaceScene = document.getElementById("space-scene");
    const ctx2 = canvas.getContext("2d");
    let spaceStars = [];
    let spaceSparkles = [];
    const SPACE_BLINK_RATIO = 0.04;
    function isSpaceVisible() {
      return !!spaceScene && spaceScene.classList.contains("space-visible");
    }
    // La mayoría chiquitas (polvo de estrellas) y de vez en cuando alguna
    // más grande que se destaque.
    function randomSpaceStarRadius() {
      return Math.random() < 0.12
        ? Math.random() * 0.5 + 0.9
        : Math.random() * 0.5 + 0.25;
    }
    function initSpaceStars() {
      const w = canvas.width,
        h = canvas.height;
      const count = Math.floor((w * h) / 7000);
      spaceStars = [];
      for (let k = 0; k < count; k++)
        spaceStars.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: randomSpaceStarRadius(),
          rot: Math.random() * Math.PI * 0.5,
          baseAlpha: Math.random() * 0.6 + 0.3,
          blinking: false,
          blinkT: 0,
          blinkSpeed: 0,
        });
    }
    function resizeSpaceCanvas() {
      const w = window.innerWidth,
        h = window.innerHeight;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        initSpaceStars();
      }
    }
    function startBlink(s) {
      if (s.blinking) return;
      s.blinking = true;
      s.blinkT = 0;
      s.blinkSpeed = 1 / (40 + Math.random() * 55); // ~0.7-1.6s a 60fps
    }
    // Prende el parpadeo ambiental en N estrellas fijas al azar que no
    // estén titilando ya.
    function triggerBlinks(count) {
      const candidates = spaceStars.filter((s) => !s.blinking);
      for (let k = 0; k < count && candidates.length; k++) {
        const idx = Math.floor(Math.random() * candidates.length);
        startBlink(candidates[idx]);
        candidates.splice(idx, 1);
      }
    }
    // Destellos salmón efímeros: nacen en un punto al azar (no en las
    // estrellas fijas), pulsan una vez (aparecen y se apagan) y
    // desaparecen del todo -las dispara el mouse/touch-.
    function spawnSparkles(count) {
      const w = canvas.width || window.innerWidth,
        h = canvas.height || window.innerHeight;
      for (let k = 0; k < count; k++)
        spaceSparkles.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: randomSpaceStarRadius(),
          rot: Math.random() * Math.PI * 0.5,
          t: 0,
          speed: 1 / (30 + Math.random() * 35), // ~0.5-1.1s a 60fps
        });
    }
    // Estrella de 4 puntas (destello), no un círculo: un rombo con lados
    // cóncavos que termina en punta arriba/abajo/izq/der. A tamaños
    // chiquitos se ve casi como un punto igual -como cualquier estrella
    // lejana-, pero las más grandes sí se notan como destello.
    function drawSparkle(ctx, x, y, r, rot) {
      ctx.save();
      ctx.translate(x, y);
      if (rot) ctx.rotate(rot);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(r * 0.18, -r * 0.18, r, 0);
      ctx.quadraticCurveTo(r * 0.18, r * 0.18, 0, r);
      ctx.quadraticCurveTo(-r * 0.18, r * 0.18, -r, 0);
      ctx.quadraticCurveTo(-r * 0.18, -r * 0.18, 0, -r);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    function drawSpaceStars() {
      // Son ~185 destellos (con save/rotate/curvas cada uno) más un clear a
      // pantalla completa: solo se dibujan cuando el escenario de espacio se ve.
      if (!isSpaceVisible()) {
        requestAnimationFrame(drawSpaceStars);
        return;
      }
      ctx2.clearRect(0, 0, canvas.width, canvas.height);
      for (const s of spaceStars) {
        let alpha = s.baseAlpha;
        if (s.blinking) {
          alpha = s.baseAlpha * Math.max(0, 1 - Math.sin(s.blinkT * Math.PI));
          s.blinkT += s.blinkSpeed;
          if (s.blinkT >= 1) {
            s.blinking = false;
            s.blinkT = 0;
          }
        }
        ((ctx2.globalAlpha = alpha),
          (ctx2.fillStyle = "#f0ece4"),
          drawSparkle(
            ctx2,
            Math.round(s.x),
            Math.round(s.y),
            s.r * 1.8,
            s.rot,
          ));
      }
      if (spaceSparkles.length) {
        spaceSparkles = spaceSparkles.filter((s) => s.t < 1);
        for (const s of spaceSparkles) {
          const pulse = Math.sin(Math.min(1, s.t) * Math.PI);
          const x = Math.round(s.x),
            y = Math.round(s.y);
          ctx2.globalAlpha = pulse;
          // Halo difuso salmón detrás...
          ctx2.fillStyle = "#f19280";
          ctx2.shadowColor = "#f19280";
          ctx2.shadowBlur = 14 + s.r * 8;
          drawSparkle(ctx2, x, y, s.r * 2.8, s.rot);
          // ...y un núcleo casi blanco encima, sin blur: es lo que se lee
          // como "muy brillante" en vez de solo una mancha salmón difusa.
          ctx2.shadowBlur = 0;
          ctx2.fillStyle = "#fff3ee";
          drawSparkle(ctx2, x, y, s.r * 1.3, s.rot);
          s.t += s.speed;
        }
      }
      ((ctx2.globalAlpha = 1), requestAnimationFrame(drawSpaceStars));
    }
    resizeSpaceCanvas();
    drawSpaceStars();
    window.addEventListener("resize", resizeSpaceCanvas);
    document.addEventListener("mousemove", () => {
      if (isSpaceVisible()) spawnSparkles(Math.floor(3 * Math.random()) + 1);
    });
    document.addEventListener(
      "touchmove",
      () => {
        if (isSpaceVisible()) spawnSparkles(Math.floor(3 * Math.random()) + 1);
      },
      { passive: true },
    );
    document.addEventListener(
      "touchstart",
      () => {
        if (isSpaceVisible()) spawnSparkles(2);
      },
      { passive: true },
    );
    // Mantiene ~SPACE_BLINK_RATIO de las estrellas titilando en todo
    // momento -el "cielo estrellado" ambiental, sin depender del mouse-.
    setInterval(() => {
      if (!isSpaceVisible() || !spaceStars.length) return;
      const target = Math.round(spaceStars.length * SPACE_BLINK_RATIO);
      const current = spaceStars.reduce((n, s) => n + (s.blinking ? 1 : 0), 0);
      if (current < target) triggerBlinks(target - current);
    }, 400);
  })(),
  (function () {
    const t = document.getElementById("starry-cohete-pair");
    if (!t) return;
    const siteContent = document.getElementById("site-content");
    const spaceScene = document.getElementById("space-scene");
    // Capa hermana con el mismo "mapa" pero z-index por encima de la nave
    // (astronauta + planeta, ver comentario largo en .space-scene-front en
    // styles.css): recibe el mismo transform de cámara que spaceScene cuadro
    // a cuadro para que ambas se muevan/escalen como una sola cosa.
    const spaceSceneFront = document.getElementById("space-scene-front");
    // Escenario 3: se entra por el borde inferior del principal (ver
    // edges.bottom de scenes.main más abajo). Mismo split que
    // space-scene/space-scene-front: salmonScene (el fondo, detrás de la
    // nave) y salmonSceneFront (delante de la nave, por ahora vacío, ver
    // .salmon-scene-front en styles.css).
    const salmonScene = document.getElementById("salmon-scene");
    const salmonSceneFront = document.getElementById("salmon-scene-front");
    // Escenario 4 (juego de esquivar polígonos, ver js/esc4-game.js): se
    // entra por el borde izquierdo del principal (edges.left de scenes.main).
    const gameScene = document.getElementById("game-scene");
    const spaceRock = document.getElementById("space-rock");
    // "Debris" espacial reutilizable: un elemento flotando en el vacío que,
    // al chocar con la nave, recibe un impulso (más fuerte cuanto más rápido
    // venía la nave) y sigue de largo en esa dirección -no vuelve a su lugar
    // de reposo, sólo va perdiendo velocidad muy despacio (roce altísimo)
    // hasta quedarse flotando en otro punto. Usa --hit-x/--hit-y (sumadas al
    // flotado propio del elemento en sus @keyframes, ver .space-rock en
    // styles.css) para no pisar la animación existente. visibleRatio ajusta
    // el radio de colisión al dibujo real del sprite, sin el margen
    // transparente de su caja (distinto para cada PNG/WEBP).
    //
    // Para sumar un elemento nuevo: agregarle "--hit-x"/"--hit-y" a su
    // transform en @keyframes (ver ejemplo en floatRock) y una línea acá:
    //   spaceDrifters.push(makeSpaceDrifter(elemento, visibleRatio));
    // onSpeed (opcional) se llama cada frame con la velocidad actual -lo usa
    // la piedra naranja para saber cuándo mostrarse "en movimiento".
    const SHIP_VISIBLE_RATIO = 0.4; // margen transparente alrededor del sprite de la nave
    function makeSpaceDrifter(el, visibleRatio, onSpeed) {
      let x = 0,
        y = 0,
        vx = 0,
        vy = 0,
        hadHit = false;
      const DRIFT_DAMPING = 0.985;
      // elRectPre (opcional): la caja ya medida. El tick mide todas las piedras
      // juntas antes de escribirle a ninguna (ver "driftRects" más abajo): si se
      // intercalan lecturas y escrituras, cada lectura recalcula estilos.
      // cuadros: cuántos cuadros de 60 Hz pasaron (ver cuadrosDe): las velocidades
      // están en px por cuadro de 60 Hz.
      const update = function update(shipRect, shipVX, shipVY, elRectPre, cuadros = 1) {
        // Quieta y sin nave cerca: no hay nada que calcular ni que escribir.
        if (!shipRect && vx === 0 && vy === 0) return;
        if (el && shipRect) {
          const elRect = elRectPre || el.getBoundingClientRect();
          const dx =
            elRect.left +
            elRect.width / 2 -
            (shipRect.left + shipRect.width / 2);
          const dy =
            elRect.top +
            elRect.height / 2 -
            (shipRect.top + shipRect.height / 2);
          const dist = Math.sqrt(dx * dx + dy * dy);
          const shipRadius = (shipRect.width * SHIP_VISIBLE_RATIO) / 2;
          const elRadius = (elRect.width * visibleRatio) / 2;
          const hitRadius = shipRadius + elRadius;
          if (dist < hitRadius) {
            if (!hadHit) {
              hadHit = true;
              const nx = dist > 0.01 ? dx / dist : 1;
              const ny = dist > 0.01 ? dy / dist : 0;
              const shipSpeed = Math.sqrt(shipVX * shipVX + shipVY * shipVY);
              const impulse = 0.6 + shipSpeed * 0.4;
              vx += nx * impulse;
              vy += ny * impulse;
            }
          } else {
            hadHit = false;
          }
        }
        const freno = Math.pow(DRIFT_DAMPING, cuadros);
        vx *= freno;
        vy *= freno;
        // Por debajo de esto queda a lo sumo ~0,07 px más de recorrido: se la da
        // por detenida (así "quieta" es exacto y el early return de arriba vale).
        if (Math.abs(vx) < 0.001) vx = 0;
        if (Math.abs(vy) < 0.001) vy = 0;
        x += vx * cuadros;
        y += vy * cuadros;
        if (el) {
          el.style.setProperty("--hit-x", `${x.toFixed(2)}px`);
          el.style.setProperty("--hit-y", `${y.toFixed(2)}px`);
        }
        if (onSpeed) onSpeed(Math.sqrt(vx * vx + vy * vy));
      };
      update.measure = () => (el ? el.getBoundingClientRect() : null);
      return update;
    }
    const spaceDrifters = [];
    if (spaceRock) spaceDrifters.push(makeSpaceDrifter(spaceRock, 0.35));
    const spaceRock2 = document.getElementById("space-rock-2");
    if (spaceRock2) spaceDrifters.push(makeSpaceDrifter(spaceRock2, 0.35));
    const spaceRockOrange = document.getElementById("space-rock-orange");
    if (spaceRockOrange) {
      // Umbral chico para que el cruce de sprites se sienta enseguida al
      // golpearla, pero no parpadee por ruido cuando ya casi se detuvo.
      const MOVING_SPEED_THRESHOLD = 0.05;
      const FRAME_MS = 1000; // cada cuadro (piedra_naranja_2/3) dura 2s mientras se mueve
      let wasMoving = false;
      let frameToggleInterval = null;
      spaceDrifters.push(
        makeSpaceDrifter(spaceRockOrange, 0.35, (speed) => {
          const isMoving = speed > MOVING_SPEED_THRESHOLD;
          spaceRockOrange.classList.toggle("is-moving", isMoving);
          if (isMoving && !wasMoving) {
            // Recién empieza a moverse: arranca el flip entre los dos
            // cuadros "en movimiento", 2s cada uno, hasta que pare.
            spaceRockOrange.classList.remove("frame-alt");
            frameToggleInterval = setInterval(() => {
              spaceRockOrange.classList.toggle("frame-alt");
            }, FRAME_MS);
          } else if (!isMoving && wasMoving) {
            // Se frenó: corta el intervalo y vuelve al cuadro quieto.
            clearInterval(frameToggleInterval);
            frameToggleInterval = null;
            spaceRockOrange.classList.remove("frame-alt");
          }
          wasMoving = isMoving;
        }),
      );
    }
    // Texto BIOS (ver .space-bios en index.html/styles.css): cada letra
    // tiene un mini resorte propio (posición x/y + velocidad, igual
    // espíritu que makeSpaceDrifter) que la empuja lejos de la nave cuando
    // está cerca -"campo de repulsión"- y, a diferencia de las piedras, una
    // fuerza de vuelta a (0,0) que la trae sola de nuevo a su lugar en
    // cuanto la nave se aleja. Envuelve cada carácter en su propio <span>
    // una sola vez acá: después sólo se le toca el transform en cada
    // cuadro, nunca el texto/DOM de nuevo.
    const spaceBios = document.getElementById("space-bios");
    let updateBiosRepel = null;
    if (spaceBios) {
      const bioLetters = [];
      spaceBios.querySelectorAll("p").forEach((p) => {
        Array.from(p.childNodes).forEach((node) => {
          if (node.nodeType !== Node.TEXT_NODE) return;
          // Colapsa saltos de línea/indentación del HTML (no el   de
          // los &nbsp; de indentación real del texto, que no matchea esta
          // clase) igual que haría el navegador al renderizar texto normal
          // -si no, cada espacio/salto de línea del source se volvería un
          // <span> propio y separaría las palabras de más.
          const text = node.textContent.replace(/[ \t\r\n]+/g, " ");
          if (!text) {
            node.remove();
            return;
          }
          const frag = document.createDocumentFragment();
          for (const ch of text) {
            const span = document.createElement("span");
            span.className = "bios-letter";
            span.textContent = ch;
            frag.appendChild(span);
            bioLetters.push({ el: span, x: 0, y: 0, vx: 0, vy: 0 });
          }
          node.replaceWith(frag);
        });
      });
      const BIOS_REPEL_RADIUS_RATIO = 1.4; // radio de empuje relativo al ancho de la nave
      const BIOS_REPEL_STRENGTH = 3.2;
      const BIOS_SPRING_K = 0.02; // qué tan fuerte "tira" cada letra de vuelta a su lugar
      const BIOS_DAMPING = 0.82; // alto roce: nada de rebote, se asienta rápido
      // Cuando ninguna letra se está moviendo y la nave no está cerca, no hay nada
      // que calcular ni que escribirle al DOM (esto corría cuadro a cuadro en
      // todos los escenarios).
      let biosEnReposo = false;
      const biosRects = new Array(bioLetters.length);
      updateBiosRepel = (shipRect, cuadros = 1) => {
        if (!shipRect && biosEnReposo) return;
        let shipCx = null,
          shipCy = null,
          radius = 0;
        if (shipRect) {
          shipCx = shipRect.left + shipRect.width / 2;
          shipCy = shipRect.top + shipRect.height / 2;
          radius = shipRect.width * BIOS_REPEL_RADIUS_RATIO;
          // Letras quietas y la nave lejos del bloque de texto (con el radio de
          // empuje de colchón): ninguna se va a mover, no hace falta ni medirlas.
          if (biosEnReposo) {
            const b = spaceBios.getBoundingClientRect();
            if (
              shipCx < b.left - radius ||
              shipCx > b.right + radius ||
              shipCy < b.top - radius ||
              shipCy > b.bottom + radius
            )
              return;
          }
          // Todas las lecturas juntas y después todas las escrituras: si se
          // intercalan (leer una letra, escribirle el transform, leer la
          // siguiente...) el navegador recalcula estilos en cada lectura, ~300
          // veces por cuadro.
          for (let i = 0; i < bioLetters.length; i++)
            biosRects[i] = bioLetters[i].el.getBoundingClientRect();
        }
        // Empuje, resorte y freno son "por cuadro de 60 Hz" (ver cuadrosDe).
        const frenoBios = Math.pow(BIOS_DAMPING, cuadros);
        let hayMovimiento = false;
        for (let i = 0; i < bioLetters.length; i++) {
          const l = bioLetters[i];
          if (shipCx !== null) {
            const rect = biosRects[i];
            const cx = rect.left + rect.width / 2;
            const cy = rect.top + rect.height / 2;
            const dx = cx - shipCx;
            const dy = cy - shipCy;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < radius) {
              const force = (1 - dist / radius) * BIOS_REPEL_STRENGTH;
              const nx = dist > 0.01 ? dx / dist : 1;
              const ny = dist > 0.01 ? dy / dist : 0;
              l.vx += nx * force * cuadros;
              l.vy += ny * force * cuadros;
            }
          }
          l.vx += -l.x * BIOS_SPRING_K * cuadros;
          l.vy += -l.y * BIOS_SPRING_K * cuadros;
          l.vx *= frenoBios;
          l.vy *= frenoBios;
          l.x += l.vx * cuadros;
          l.y += l.vy * cuadros;
          if (
            Math.abs(l.x) > 0.01 ||
            Math.abs(l.y) > 0.01 ||
            Math.abs(l.vx) > 0.01 ||
            Math.abs(l.vy) > 0.01
          )
            hayMovimiento = true;
        }
        // Si ya se asentaron todas, se clavan en su lugar (de a <0,01 px no se
        // ve) y de ahí en más no se toca nada hasta que la nave se acerque.
        if (!hayMovimiento)
          for (const l of bioLetters) l.x = l.y = l.vx = l.vy = 0;
        for (const l of bioLetters) {
          const tr = `translate(${l.x.toFixed(2)}px, ${l.y.toFixed(2)}px)`;
          if (tr !== l.tr) {
            l.tr = tr;
            l.el.style.transform = tr;
          }
        }
        biosEnReposo = !hayMovimiento;
      };
    }
    const FLIGHT_MARGIN = 100; // cuánto puede salirse la nave del viewport, en px
    const FLIGHT_MARGIN_TOP = 160; // arriba necesita más margen: al rotar, la nave (130px) sobresale de su caja
    // Para cruzar a otro escenario la nave se tiene que salir bastante de la
    // pantalla (irse es una decisión, no un roce): este margen vale para todos
    // los bordes que llevan a otro escenario, en todos los escenarios, salvo que
    // el borde pida el suyo (edges.<borde>.margin). En pantallas chicas no puede
    // pasar de esa fracción del ancho (o alto) de la pantalla.
    const EDGE_EXIT_MARGIN = 450; // px
    const EDGE_EXIT_MAX_FRACTION = 0.4;
    // Solo en desktop: al llegar la nave al borde superior, se corta a la
    // segunda pantalla (mismo fondo starry azul, a pantalla completa, sin
    // parallax) que tapa nav/footer/parallax, y la nave reaparece del mismo
    // tamaño por abajo — siempre mobile, sigue al mouse/gamepad igual que en
    // la escena normal. Desde ahí, se vuelve a la escena normal yendo hacia
    // abajo (borde inferior).
    // Tamaño de la nave en la escena de espacio profundo según lo arriba
    // que esté volando: "NEAR" es recién entrando (abajo del todo, mismo
    // tamaño que ya tenía) y "FAR" es en lo más alto que puede llegar a
    // volar -el cambio es gradual cuadro a cuadro en base a su posición
    // vertical, con su propio suavizado (shipScale) para que no se sienta
    // como un salto.
    const SHIP_SPACE_SCALE_NEAR = 0.55;
    const SHIP_SPACE_SCALE_FAR = 0.49;
    // Zoom de cámara: escala el fondo completo de la escena (y la nave, para
    // que quede a la misma escala, ver shipScale más abajo -la nave "vive"
    // en este mismo espacio, aunque técnicamente no sea hija del contenedor)
    // anclado en la posición actual de la nave -no en el centro fijo- así
    // se siente que la cámara se acercó al objeto en vez de simplemente
    // agrandar el sprite. El fondo se re-ancla cuadro a cuadro (ver
    // spaceScene.style.transformOrigin en el tick) para que al navegar el
    // fondo "pase" por debajo, como recorriendo el mapa de antes pero de
    // cerca.
    // El escenario 4 usa este mismo zoom (GAME_CAMERA_ZOOM): si se cambia acá,
    // cambian los dos.
    const CAMERA_ZOOM = 1.5;
    // En pantallas chicas el mundo del escenario 4 ya es angosto, así que se
    // acerca menos. (El escenario 2 solo se entra en escritorio.)
    const GAME_CAMERA_ZOOM = CAMERA_ZOOM;
    const GAME_CAMERA_ZOOM_MOBILE = 1.25;
    // Velocidad de la nave en el escenario 4 (multiplica el empuje del teclado,
    // el joystick y el seguimiento del mouse). Antes compensaba el zoom
    // (1 / zoom = 0,67, más lenta que en el resto) y con los polígonos cayendo
    // cada vez más rápido no alcanzaba para esquivar: se subió a 2,5, pero
    // quedó demasiado rápida; ahora va a 1,5 (más del doble que al principio).
    const GAME_SHIP_SPEED = 1.2;
    // El astronauta y la nave-bora ya no tienen su propio zoom separado: al
    // ser hijos de #space-scene/#space-scene-front heredan cameraZoom del
    // contenedor automáticamente, igual que el planeta -antes se les
    // aplicaba además un ENV_CAMERA_ZOOM propio (más chico) para que no
    // quedaran gigantes, pero compensarlo aparte hacía que se vieran
    // "achicarse" en relación al resto del mapa mientras la cámara hacía
    // zoom, porque crecían mucho menos que todo lo demás alrededor.
    // Mantener M (o LT del joystick) apretado muestra el mapa completo sin
    // zoom (para ubicarse), como el mapa de un juego: mientras está activo,
    // el multiplicador de cámara baja a 1 cuadro a cuadro y se restaura solo
    // al soltar. LT se lee cada frame junto al resto del gamepad (más abajo,
    // en el tick), por eso son dos flags separadas combinadas con ||.
    let keyMapView = false;
    // WASD mueve la nave como el stick/D-pad del joystick, Shift cumple el
    // rol de RB (boost) y Espacio el de LT (mapa completo) -ver más abajo,
    // se combinan con el resto del teclado/joystick en el tick.
    let keyUp = false,
      keyDown = false,
      keyLeft = false,
      keyRight = false,
      keyBoost = false;
    // Las flechitas hacen lo mismo que WASD; van en flags aparte para que
    // soltar una de las dos no corte a la otra si se aprietan juntas.
    let arrowUp = false,
      arrowDown = false,
      arrowLeft = false,
      arrowRight = false;
    // Valor analógico del gatillo (0..1), no un booleano: LT es un botón
    // analógico y el navegador decide su ".pressed" digital con un umbral
    // interno -si no se lo presiona a fondo, ese booleano puede parpadear
    // entre true/false por ruido cerca del umbral, haciendo que el target
    // del zoom salte cada frame y nunca converja (se ve como un temblor
    // "atascado" en vez de llegar al mapa completo). Usando el valor
    // continuo en vez de is­Pressed() se evita ese cruce de umbral.
    let gamepadMapViewT = 0;
    // Ruedita del mouse: hacia abajo aleja la cámara (zoom out), hacia arriba
    // la vuelve a acercar. Es un valor continuo 0..1 que se acumula con cada
    // notch, y se combina con M/LT como un tercer origen de mapViewT. Sólo
    // aplica en escenarios con cámara (ver scene.camera); en el resto la
    // ruedita se comporta como siempre.
    let wheelMapViewT = 0;
    let wheelExpireAt = 0;
    const WHEEL_ZOOM_RANGE = 600; // px de rueda para ir de zoom normal a mapa completo
    const WHEEL_ZOOM_HOLD_MS = 3000; // el zoom out dura esto tras el último movimiento de la rueda
    document.addEventListener(
      "wheel",
      (ev) => {
        if (!scenes[currentSceneId].camera) return;
        ev.preventDefault();
        const delta = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
        wheelMapViewT = Math.max(
          0,
          Math.min(1, wheelMapViewT + delta / WHEEL_ZOOM_RANGE),
        );
        wheelExpireAt = performance.now() + WHEEL_ZOOM_HOLD_MS;
      },
      { passive: false },
    );
    document.addEventListener("keydown", (ev) => {
      if (ev.key === "m" || ev.key === "M" || ev.code === "Space")
        keyMapView = true;
      // Las flechitas también scrollean la página: mientras se pilotea no
      // (salvo que se esté escribiendo en un campo de texto).
      if (
        (ev.code || "").startsWith("Arrow") &&
        !ev.target.closest?.("input, textarea, select, [contenteditable]")
      )
        ev.preventDefault();
      switch (ev.code) {
        case "ArrowUp":
          arrowUp = true;
          break;
        case "ArrowDown":
          arrowDown = true;
          break;
        case "ArrowLeft":
          arrowLeft = true;
          break;
        case "ArrowRight":
          arrowRight = true;
          break;
        case "KeyW":
          keyUp = true;
          break;
        case "KeyS":
          keyDown = true;
          break;
        case "KeyA":
          keyLeft = true;
          break;
        case "KeyD":
          keyRight = true;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keyBoost = true;
          break;
      }
    });
    document.addEventListener("keyup", (ev) => {
      if (ev.key === "m" || ev.key === "M" || ev.code === "Space")
        keyMapView = false;
      switch (ev.code) {
        case "ArrowUp":
          arrowUp = false;
          break;
        case "ArrowDown":
          arrowDown = false;
          break;
        case "ArrowLeft":
          arrowLeft = false;
          break;
        case "ArrowRight":
          arrowRight = false;
          break;
        case "KeyW":
          keyUp = false;
          break;
        case "KeyS":
          keyDown = false;
          break;
        case "KeyA":
          keyLeft = false;
          break;
        case "KeyD":
          keyRight = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          keyBoost = false;
          break;
      }
    });
    let shipScale = 1;
    // Posición actual de la nave (la misma que se escribe en su transform, pero en
    // números): la lee js/esc4-game.js cada cuadro. Antes parseaba el texto del
    // transform con un DOMMatrix nuevo en cada cuadro, y esa basura provocaba
    // pausas de 35-50 ms cada tanto. Es un solo objeto, se pisa en el lugar.
    const shipPose = (window.shipPose = {
      x: 0,
      y: 0,
      rot: 0,
      escala: 1,
      listo: false,
    });
    // Factor de cámara (CAMERA_ZOOM, u 1 con M apretada) y factor de altura
    // (achique por volar alto, ver SHIP_SPACE_SCALE_*) se suavizan por
    // separado y en el mismo ritmo que el fondo, para que subir o bajar el
    // zoom se sienta como una cámara alejándose/acercándose de toda la
    // escena junta -nave incluida, la nave "vive" en ese mismo espacio- y
    // no como si la nave sola se achicara en el lugar mientras el fondo
    // alrededor crece o encoge distinto. El tamaño "real" de la nave
    // (shipHeightScale solo, sin cameraZoom) es el que se ve con M/Espacio
    // apretado, cuando cameraZoom baja a 1.
    let cameraZoom = 1;
    let shipHeightScale = 1;
    const spaceAstronaut = document.getElementById("space-astronaut");
    const spaceBoraNave = document.getElementById("space-bora-nave");
    // Se define más abajo, junto con la luz de la nave: la referencia queda
    // acá para que el loop de vuelo (tick) pueda llamarla al cruzar el
    // borde de la escena de espacio, y así la luz -si ya estaba prendida-
    // se ajuste sin esperar a que el usuario la vuelva a tocar.
    let applyLightFilter = null;
    // Igual que applyLightFilter, se asigna junto con la luz de la nave: fuerza
    // prendida/apagada (sin sonido, salvo que se pida) y devuelve el estado
    // anterior. La usa el escenario 4.
    let forceShipLight = null;

    // --- Registro de escenarios ------------------------------------
    // scenes.main ya existe (registrado al inicio del archivo, arranca
    // visible) y sólo necesita declarar a dónde lleva su borde de arriba.
    // Para sumar un escenario nuevo más adelante: armar sus capas en
    // index.html/styles.css (mismo patrón que space-scene/space-scene-front,
    // toggleadas por una clase tipo "visible"), llamar acá a
    // registerScene("id", {...}) con sólo la config que necesite -todo lo
    // demás tiene default razonable, ver el registro global al inicio del
    // archivo- y agregar un edges.<borde> en el escenario desde el que se
    // entra, apuntando al id nuevo.
    Object.assign(scenes.main, {
      // Mientras la nave hace su entrada (viene de afuera de la pantalla) no
      // hay barras de aviso.
      edgeWarning: () => !shipEntry,
      setVisible: (visible) =>
        siteContent && siteContent.classList.toggle("space-hidden", !visible),
      edges: {
        top: {
          to: "space",
          requiresDesktop: true,
          enter: (w, h) => ({ x: w * 0.38 - 65, y: h - 150 }),
        },
        bottom: {
          to: "salmon",
          enter: (w) => ({ x: w * 0.6 - 65, y: -FLIGHT_MARGIN_TOP + 50 }),
        },
        left: {
          to: "game",
          enter: (w, h) => ({ x: w - 150, y: h * 0.75 - 65 }),
        },
      },
    });
    registerScene("space", {
      setVisible: (visible) => {
        [spaceScene, spaceSceneFront, spaceAstronaut, spaceBoraNave].forEach(
          (el) => el && el.classList.toggle("space-visible", visible),
        );
      },
      shipClass: "in-space",
      // El fondo de esta escena vive detrás de una cámara con zoom
      // (CAMERA_ZOOM más abajo): a igual velocidad "cruda" en píxeles, la
      // nave recorre ese fondo ampliado más rápido que en escenario 1. Se
      // compensa con el inverso del zoom para que la velocidad percibida
      // contra el fondo sea la misma en las dos escenas.
      speedMult: 1 / CAMERA_ZOOM,
      heightScale: { near: SHIP_SPACE_SCALE_NEAR, far: SHIP_SPACE_SCALE_FAR },
      camera: { zoom: CAMERA_ZOOM, elements: [spaceScene, spaceSceneFront] },
      light: { volume: 0.2 },
      edges: {
        bottom: {
          to: "main",
          enter: () => ({ x: 40, y: -FLIGHT_MARGIN_TOP + 50 }),
        },
      },
    });
    registerScene("salmon", {
      setVisible: (visible) => {
        [salmonScene, salmonSceneFront].forEach(
          (el) => el && el.classList.toggle("salmon-visible", visible),
        );
      },
      shipClass: "in-salmon",
      edges: {
        top: {
          to: "main",
          enter: (w, h) => ({ x: w * 0.6 - 65, y: h - 150 }),
        },
      },
    });
    // Escenario 4: juego de esquivar polígonos (js/esc4-game.js). El juego
    // solo corre mientras la escena está visible: setActive arranca/frena su
    // requestAnimationFrame.
    //
    // Misma cámara con zoom que el escenario 2 (nave chica en el mapa
    // completo, zoom encima de ella; M/Espacio/LT/rueda alejan). La diferencia
    // es que acá no hay elementos que escalar por CSS: el juego dibuja en un
    // canvas y aplicar scale() al canvas lo pixelaría, así que recibe el zoom
    // y el origen por camera.onFrame (ver el tick) y se dibuja ya ampliado.
    const gameZoom =
      window.innerWidth <= 600 ? GAME_CAMERA_ZOOM_MOBILE : GAME_CAMERA_ZOOM;
    let gameLightBefore = null;
    registerScene("game", {
      setVisible: (visible) => {
        if (gameScene) gameScene.classList.toggle("game-visible", visible);
        if (window.esc4Game) window.esc4Game.setActive(visible);
        // La nave entra con la luz apagada (la intro es a color; la prende
        // esc4-game.js cuando se van las navecitas, ver shipLightSet) y al
        // salir vuelve a como estaba.
        if (forceShipLight) {
          if (visible) gameLightBefore = forceShipLight(false);
          else if (gameLightBefore !== null) {
            forceShipLight(gameLightBefore);
            gameLightBefore = null;
          }
        }
      },
      shipClass: "in-game",
      // Velocidad de la nave, ver GAME_SHIP_SPEED (no se compensa el zoom como en
      // el escenario 2: acá el juego necesita una nave ágil).
      speedMult: GAME_SHIP_SPEED,
      heightScale: { near: SHIP_SPACE_SCALE_NEAR, far: SHIP_SPACE_SCALE_NEAR },
      camera: {
        zoom: gameZoom,
        elements: [],
        onFrame: (zoom, x, y) => {
          if (window.esc4Game) window.esc4Game.setCamera(zoom, x, y);
        },
      },
      // La nave es blanco y negro acá (grayscale en el sprite de atrás, apagada
      // o prendida) pero su luz es la de siempre: los mismos halos salmón
      // (--nave-luz-halo) y, para iluminar el fondo, el mismo degradado grande,
      // que acá dibuja el juego en su canvas (setLight) para que las rocas
      // queden por encima como siluetas. El gris va con --nave-gris (1 = blanco
      // y negro, 0 = a color) en la nave, que esc4-game.js baja a medida que se
      // colorea.
      light: {
        off: "grayscale(var(--nave-gris, 1))",
        filter: "grayscale(var(--nave-gris, 1)) var(--nave-luz-halo)",
        // Más fuerte que en los otros escenarios: el sonido de luz on marca el
        // momento en que empieza el juego y tiene que oírse bien.
        volume: 0.9,
        // Prender/apagar la luz a mano no hace ruido en este escenario.
        silentToggle: true,
      },
      edges: {
        right: {
          to: "main",
          enter: (w, h) => ({ x: 40, y: h / 2 - 65 }),
        },
      },
      // Con el juego esquivando, irse tiene que ser una decisión. La barra de
      // aviso no va durante la intro (la nave entra desde afuera) ni en el final.
      edgeWarning: () => !window.esc4Game || window.esc4Game.avisoSalida(),
      // Ni en la intro ni en el final se puede alejar la cámara (M/Espacio/LT/rueda).
      zoomBloqueado: () => !!window.esc4Game && window.esc4Game.sinZoom(),
    });

    // Planeta de la escena de espacio: arranca "apagado" (más oscuro que su
    // brillo normal de antes, ver base de .space-planet en styles.css) y al
    // interactuar -click, o E/botón A del joystick igual que las zonas de la
    // escena principal, ver triggerAction() más abajo- prende como un
    // foquito, parpadea un par de veces como si se fuera a fundir y vuelve
    // sola al apagado (no se queda prendida). Cada interacción repite la
    // animación desde cero -la animación completa vive en
    // .space-planet.bulb-blow, styles.css-.
    const spacePlanet = document.getElementById("space-planet");
    if (spacePlanet) {
      // A diferencia de otros objetos (guitarra, satélite, nave), acá no
      // conviene el test de pixel opaco: el PNG tiene mucho margen
      // transparente alrededor del dibujo y hacía muy difícil acertarle.
      // Todo el rectángulo de la imagen cuenta como zona interactuable.
      const hitPlanet = (x, y) =>
        pointInRect(x, y, spacePlanet.getBoundingClientRect());
      const triggerPlanetGlow = () => {
        spacePlanet.classList.remove("bulb-blow");
        spacePlanet.offsetWidth; // reinicia la animación si ya estaba corriendo
        spacePlanet.classList.add("bulb-blow");
        sfxPlay("planeta");
      };
      spacePlanet.addEventListener("animationend", (ev) => {
        if (ev.animationName === "planetBulbBlow")
          spacePlanet.classList.remove("bulb-blow");
      });
      // Click de mouse, igual que el resto de los objetos interactuables:
      // el planeta tiene pointer-events:none (como toda la escena de
      // espacio, para no interferir con el vuelo con mouse), así que el
      // click se escucha en document y se valida a mano contra su
      // rectángulo/pixel real -sólo cuenta mientras esta escena está
      // visible, si no cualquier click en esas coordenadas en la escena
      // principal lo dispararía igual, aunque esté oculto-.
      document.addEventListener("click", (ev) => {
        if (currentSceneId !== "space") return;
        if (hitPlanet(ev.clientX, ev.clientY)) triggerPlanetGlow();
      });
      scenes.space.parallaxZones.push({
        hitTest: hitPlanet,
        trigger: triggerPlanetGlow,
      });
    }

    // Entrada de la nave al abrir el index: viene volando sola desde la esquina de
    // arriba a la izquierda (mirando hacia donde va), frena y se acomoda cerca
    // de esa esquina. Si el jugador toma el control (mouse apretado, teclado o
    // joystick) antes de que termine, se corta ahí.
    const SHIP_ENTRY_FROM = { x: -140, y: -160 }; // esquina de la caja (px), afuera de la pantalla
    const SHIP_ENTRY_DELAY_MS = 400; // que la página se pinte antes
    const SHIP_ENTRY_MS = 2400;
    const shipEntryTo = () => ({
      x: window.innerWidth * 0.17 - 65,
      y: window.innerHeight * 0.27 - 65,
    });
    // Rotación con la que mira hacia donde va (0° = nariz arriba, igual que el
    // seguimiento del mouse más abajo).
    const shipEntryHeading = (to) =>
      (Math.atan2(to.y - SHIP_ENTRY_FROM.y, to.x - SHIP_ENTRY_FROM.x) * 180) /
        Math.PI +
      90;
    // Al terminar la entrada la nave queda mirando al nombre (AGUSTIN TARDELLA)
    // desde donde se acomoda: rotación que apunta al centro de ese texto (si no
    // se encuentra, 90° = mirando a la derecha).
    const shipEntryAim = (to) => {
      const el = document.querySelector(".footer-col-left .name");
      const r = el && el.getBoundingClientRect();
      if (!r || !r.width) return 90;
      const dx = r.left + r.width / 2 - (to.x + 65);
      const dy = r.top + r.height / 2 - (to.y + 65);
      return (Math.atan2(dy, dx) * 180) / Math.PI + 90;
    };
    let shipEntry = { t0: performance.now() + SHIP_ENTRY_DELAY_MS, to: null };
    // Fundido de entrada: la nave arranca fuera de pantalla y aparece de a poco
    // al acercarse al borde izquierdo (e). Una vez que llegó a opacidad 1 la
    // primera vez queda fija ahí -si no, como la opacidad se recalculaba en cada
    // frame en base a la posición actual, la nave se transparentaba de nuevo
    // cada vez que el usuario la llevaba de vuelta cerca del borde izquierdo
    // durante el uso normal.
    let introOpacity = 0;
    // La nave se mantiene 100% opaca en cualquier escenario -antes se ponía
    // semitransparente en el de espacio profundo ("nebulosa"), pero eso se
    // veía mal al pasar delante de otros objetos (astronauta, planeta).
    let shipAlpha = 1;
    let e = SHIP_ENTRY_FROM.x,
      a = SHIP_ENTRY_FROM.y,
      n = 0,
      r = 0,
      s = shipEntryHeading(shipEntryTo()),
      i = null,
      o = null,
      l = !1,
      gamepadActive = false,
      wasGamepadActive = false,
      // Click izquierdo mantenido: mismo rol que RB en el joystick, para el
      // seguimiento por mouse (no aplica a touch, que no dispara mousedown).
      mouseBoost = false;
    // Escenario 4: la piedra que choca a la nave la golpea y la nave cae.
    // js/esc4-game.js llama a shipMove(dx, dy, giro) cada cuadro mientras dura
    // el choque: mueve la nave esa distancia y la gira esos grados y, durante
    // un instante, el tick ignora mouse/teclado/joystick (si no, la nave
    // volvería al mouse en pleno golpe). shipPlace(x, y)
    // pone el centro de la nave en ese punto de la pantalla y la deja quieta
    // mientras se lo siga llamando, mirando para arriba (rotación 0, salvo que
    // se pida conservarGiro): así arranca cada partida abajo, al medio. Mientras está sostenida tampoco
    // gira hacia el mouse.
    // shipFace(grados) hace girar la nave (suave) hacia esa rotación mientras se
    // lo siga llamando, sin que el mouse la gire: la intro la usa para que mire
    // a las navecitas.
    let shipCarriedUntil = 0;
    let shipFaceUntil = 0;
    // Cuadros de 60 Hz que pasaron en el último cuadro (ver cuadrosDe): los usa el
    // tick de vuelo y también shipFace, que se llama desde el juego.
    let shipPrevT = 0;
    let shipCuadros = 1;
    const lockShip = () => {
      n = 0;
      r = 0;
      shipCarriedUntil = performance.now() + 100;
    };
    window.shipMove = (dx, dy, giro = 0) => {
      e += dx;
      a += dy;
      s += giro;
      lockShip();
    };
    // shipLeave(borde) hace cruzar a la nave por ese borde ("left", "right", "top"
    // o "bottom") como si lo hubiera tocado: lo usa el escenario 4 cuando termina
    // el nivel (la nave completó su color) para volver al escenario principal.
    let forcedEdge = null;
    window.shipLeave = (side) => {
      forcedEdge = side;
    };
    window.shipFace = (deg) => {
      let d = deg - s;
      for (; d > 180; ) d -= 360;
      for (; d < -180; ) d += 360;
      s += suavizadoPor(0.15, shipCuadros) * d;
      shipFaceUntil = performance.now() + 100;
    };
    window.shipPlace = (x, y, conservarGiro) => {
      e = x - 65;
      a = y - 65;
      if (!conservarGiro) s = 0;
      lockShip();
    };
    const isMobileTouch = () => window.innerWidth <= 600;

    // Cuánto tiene que salirse la nave del viewport para cruzar por ese borde:
    // el del escenario si lo pide, EDGE_EXIT_MARGIN si el borde lleva a otro
    // escenario, y dflt si no lleva a ninguno (ahí la nave solo se frena).
    const edgeMargin = (scene, side, dflt) => {
      const edge = scene.edges[side];
      if (!edge) return dflt;
      if (edge.margin) return edge.margin;
      const dim =
        side === "left" || side === "right"
          ? window.innerWidth
          : window.innerHeight;
      return Math.min(EDGE_EXIT_MARGIN, dim * EDGE_EXIT_MAX_FRACTION);
    };

    // Aviso de que la nave se está yendo del escenario: una franja transparente
    // pegada al borde por el que se va (totalmente transparente: solo se ven las
    // estrellas que viajan adentro, sin deformar ni oscurecer lo que hay detrás;
    // ver .edge-warn en styles.css), que crece y se hace más marcada a medida que
    // se acerca el cambio de escenario. Una por borde, en cualquier escenario; se calcula cada cuadro
    // en updateEdgeWarnings.
    // La franja tiene forma de una sola onda (una campana) corta, con su pico a la
    // altura por donde se fue la nave (su posición a lo largo del borde; el eje de
    // la onda es la nave). Cuanto más se aleja la nave, más alta y más ancha es la
    // onda, pero siempre corta: lejos de la nave no hay nada. Se recorta con un
    // clip-path (la franja ocupa solo esa forma).
    // Para que pese poco, cada franja es una caja chica (EDGE_WARN_VENTANA desvíos
    // de la onda a cada lado) que se mueve con la nave con un transform, y no un
    // elemento del largo de todo el borde: la forma solo se recalcula cuando cambia
    // el progreso, y no hay filtros que deformen lo que hay detrás.
    const EDGE_WARN_BOX = 96; // px: grosor de la caja donde cabe la franja (más que el pico)
    const EDGE_WARN_PICO = [6, 76]; // px: grosor en el pico, con progreso 0 y con progreso 1
    const EDGE_WARN_ANCHO = [0.022, 0.05]; // qué tan ancha es la onda (fracción del largo del borde; es el desvío de la campana), con progreso 0 y con 1
    const EDGE_WARN_VENTANA = 3; // desvíos de la onda que cubre la caja a cada lado de la nave
    const EDGE_WARN_PASO = 4; // px: cada cuánto se calcula un punto de la forma
    // Irregularidad de la onda: la campana se multiplica por un ruido suave de dos
    // escalas (manchas grandes + rugosidad fina) y cada lado del pico tiene su
    // propio ancho, así no sale una campana prolija y simétrica. La forma se sortea
    // de nuevo cada vez que aparece la franja (ver edgeNuevaForma).
    const EDGE_WARN_RUIDO = {
      celdas: [40, 13], // px: tamaño de las manchas grandes y de la rugosidad fina
      peso: 0.6, // cuánto pesa el ruido grande frente al fino (0 a 1)
      altura: [0.4, 1.2], // multiplicador del grosor: mínimo y máximo que puede dar el ruido
      lados: [0.7, 1.4], // rango del ancho de cada lado del pico, como multiplicador del desvío
    };
    const EDGE_WARN_SALMON = "#f19280"; // el --accent del sitio
    // Adentro de la franja hay estrellas que viajan, como en velocidad de crucero:
    // rayitas blancas y salmón que corren hacia el borde por el que se va la nave (solo se
    // ven adentro de la forma de la onda, que recorta todo). Con más progreso hay
    // más, van más rápido y las rayas son más largas.
    const EDGE_WARN_ESTRELLAS = {
      n: 90, // cuántas hay en cada borde (con progreso 1)
      vel: [120, 560], // px/s: velocidad mínima y máxima de cada estrella
      rapidez: [0.6, 1.4], // multiplicador de la velocidad con progreso 0 y con progreso 1
      estela: [0.03, 0.065], // s: largo de la raya (velocidad por este tiempo), con progreso 0 y con progreso 1
      concentracion: 0.9, // qué tan repartidas están a lo largo del borde, como fracción del ancho de la onda (menos = más juntas en la altura de la nave)
      alfa: [0.3, 0.45], // multiplicador de la opacidad de las estrellas con progreso 0 y con progreso 1 (bien transparentes)
      salmon: 0.4, // fracción de estrellas salmón (el resto son blancas)
    };
    // Número al azar con distribución normal (media 0, desvío 1).
    const edgeRandn = () => {
      const u = 1 - Math.random();
      const v = Math.random();
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    };
    // Ruido de valor 1D suave (0 a 1) sobre una tabla circular de valores al azar.
    const edgeRuido = (tabla, x) => {
      const n = tabla.length;
      const i = Math.floor(x);
      const f = x - i;
      const t = f * f * (3 - 2 * f);
      const a = tabla[((i % n) + n) % n];
      const b = tabla[(((i + 1) % n) + n) % n];
      return a + (b - a) * t;
    };
    // Una forma al azar para la onda: dos tablas de ruido (grueso y fino) y el
    // ancho de cada lado del pico.
    const edgeNuevaForma = () => {
      const R = EDGE_WARN_RUIDO;
      const tabla = (n) => Array.from({ length: n }, Math.random);
      return {
        grueso: tabla(32),
        fino: tabla(96),
        offGrueso: Math.random() * 32,
        offFino: Math.random() * 96,
        izq: R.lados[0] + Math.random() * (R.lados[1] - R.lados[0]),
        der: R.lados[0] + Math.random() * (R.lados[1] - R.lados[0]),
      };
    };
    const edgeWarns = {};
    for (const side of ["left", "right", "top", "bottom"]) {
      const el = document.createElement("div");
      el.className = "edge-warn edge-warn--" + side;
      el.style.display = "none";
      if (side === "left" || side === "right")
        el.style.width = EDGE_WARN_BOX + "px";
      else el.style.height = EDGE_WARN_BOX + "px";
      // El canvas de las estrellas (ocupa toda la caja de la franja; el recorte
      // de la onda lo limita).
      const cv = document.createElement("canvas");
      cv.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;";
      el.appendChild(cv);
      document.body.appendChild(el);
      const estrellas = Array.from({ length: EDGE_WARN_ESTRELLAS.n }, () => ({
        z: edgeRandn(), // a lo largo del borde: desvío respecto de la nave, en desvíos de la campana (se concentran donde está la nave)
        a: Math.random() * EDGE_WARN_BOX, // distancia al borde de la pantalla
        v: Math.random(), // qué tan rápida es (0 a 1)
        alfa: 0.35 + Math.random() * 0.65,
        grosor: 0.7 + Math.random() * 1,
        salmon: Math.random() < EDGE_WARN_ESTRELLAS.salmon, // blanca o salmón
      }));
      edgeWarns[side] = {
        el,
        cv,
        ctx: cv.getContext("2d"),
        estrellas,
        forma: edgeNuevaForma(),
        ultimo: 0,
        win: 0, // largo de la caja a lo largo del borde, en px
        desp: null, // dónde está la caja a lo largo del borde
        shown: "",
      };
    }
    // Mueve y dibuja las estrellas de una franja. p: progreso; sigma: desvío de la
    // onda en px; win: largo de la caja. Las estrellas se juntan en el centro de la
    // caja, que es donde está la nave.
    const drawEdgeStars = (side, warn, p, sigma, win) => {
      const horizontal = side === "left" || side === "right";
      const desdeBorde = side === "left" || side === "top";
      const box = EDGE_WARN_BOX;
      const cw = horizontal ? box : win;
      const ch = horizontal ? win : box;
      const dpr = window.devicePixelRatio || 1;
      if (warn.cv.width !== Math.round(cw * dpr)) {
        warn.cv.width = Math.round(cw * dpr);
        warn.cv.style.width = cw + "px";
      }
      if (warn.cv.height !== Math.round(ch * dpr)) {
        warn.cv.height = Math.round(ch * dpr);
        warn.cv.style.height = ch + "px";
      }
      const ahora = performance.now();
      const dt = warn.ultimo ? Math.min(0.05, (ahora - warn.ultimo) / 1000) : 0;
      warn.ultimo = ahora;
      const c = warn.ctx;
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, cw, ch);
      c.lineCap = "round";
      const E = EDGE_WARN_ESTRELLAS;
      const lerp = (a, b, t) => a + (b - a) * t;
      const rapidez = lerp(E.rapidez[0], E.rapidez[1], p);
      const estela = lerp(E.estela[0], E.estela[1], p);
      const alfa = lerp(E.alfa[0], E.alfa[1], p);
      const visibles = Math.floor(E.n * (0.3 + 0.7 * p));
      const dispersion = sigma * E.concentracion;
      for (let i = 0; i < visibles; i++) {
        const e = warn.estrellas[i];
        const vel = lerp(E.vel[0], E.vel[1], e.v) * rapidez;
        const largoRaya = vel * estela;
        e.a -= vel * dt;
        // Sale por el borde de la pantalla y vuelve a entrar desde adentro.
        if (e.a + largoRaya < 0) {
          e.a = box + Math.random() * 30;
          e.z = edgeRandn();
          e.salmon = Math.random() < E.salmon;
        }
        const pos = win / 2 + e.z * dispersion;
        if (pos < 0 || pos > win) continue; // fuera de la caja
        // Cabeza de la estrella y su estela (que queda atrás, del lado de adentro).
        const cabeza = desdeBorde ? e.a : box - e.a;
        const cola = desdeBorde ? e.a + largoRaya : box - e.a - largoRaya;
        c.globalAlpha = e.alfa * alfa;
        c.strokeStyle = e.salmon ? EDGE_WARN_SALMON : "#fff";
        c.lineWidth = e.grosor;
        c.beginPath();
        if (horizontal) {
          c.moveTo(cabeza, pos);
          c.lineTo(cola, pos);
        } else {
          c.moveTo(pos, cabeza);
          c.lineTo(pos, cola);
        }
        c.stroke();
      }
    };
    // La forma de la franja (clip-path) dentro de su caja, que está centrada en la
    // nave: de un lado el borde de la pantalla, del otro la campana.
    const edgeWarnShape = (side, p, sigma, win, forma) => {
      const lerp = (a, b, t) => a + (b - a) * t;
      const R = EDGE_WARN_RUIDO;
      const pico = lerp(EDGE_WARN_PICO[0], EDGE_WARN_PICO[1], p);
      const box = EDGE_WARN_BOX;
      const alLado = side === "left" || side === "right";
      const desdeBorde = side === "left" || side === "top";
      const pts = [];
      for (let u = 0; u <= win + EDGE_WARN_PASO; u += EDGE_WARN_PASO) {
        const pos = Math.min(u, win);
        const d = pos - win / 2;
        // Cada lado del pico tiene su ancho (la onda no es simétrica).
        const sg = sigma * (d < 0 ? forma.izq : forma.der);
        const campana = Math.exp(-(d * d) / (2 * sg * sg));
        const ruido =
          R.peso * edgeRuido(forma.grueso, forma.offGrueso + pos / R.celdas[0]) +
          (1 - R.peso) * edgeRuido(forma.fino, forma.offFino + pos / R.celdas[1]);
        const t = Math.max(
          0,
          Math.min(box, pico * campana * lerp(R.altura[0], R.altura[1], ruido)),
        );
        const x = alLado ? (desdeBorde ? t : box - t) : pos;
        const y = alLado ? pos : desdeBorde ? t : box - t;
        pts.push(x.toFixed(1) + "px " + y.toFixed(1) + "px");
      }
      // Se cierra por el borde de la pantalla.
      const borde = desdeBorde ? 0 : box;
      if (alLado) pts.push(borde + "px " + win + "px", borde + "px 0px");
      else pts.push(win + "px " + borde + "px", "0px " + borde + "px");
      return "polygon(" + pts.join(",") + ")";
    };
    // cx/cy: centro de la nave (caja + 65). Progreso 0 = todavía lejos (el aviso
    // empieza 30 px antes del borde), 1 = ya cruza.
    const updateEdgeWarnings = (scene, cx, cy) => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const enabled = !scene.edgeWarning || scene.edgeWarning();
      for (const side in edgeWarns) {
        const edge = scene.edges[side];
        let p = 0;
        if (enabled && edge && !(edge.requiresDesktop && isMobileTouch())) {
          const m = edgeMargin(scene, side);
          const desde =
            side === "left" || side === "top"
              ? 30
              : (side === "right" ? w : h) - 30;
          const c = side === "left" || side === "right" ? cx : cy;
          const hasta =
            side === "left" || side === "top"
              ? -m + 65
              : (side === "right" ? w : h) + m + 65;
          p = Math.max(0, Math.min(1, (c - desde) / (hasta - desde)));
        }
        const warn = edgeWarns[side];
        if (p <= 0) {
          if (warn.shown !== "") {
            warn.shown = "";
            warn.desp = null;
            warn.ultimo = 0;
            warn.el.style.display = "none";
          }
          continue;
        }
        const alLado = side === "left" || side === "right";
        const largo = alLado ? h : w;
        const along = alLado ? cy : cx;
        // La caja: de este largo (a lo largo del borde), centrada en la nave.
        const sigma = (EDGE_WARN_ANCHO[0] + (EDGE_WARN_ANCHO[1] - EDGE_WARN_ANCHO[0]) * p) * largo;
        const win = Math.max(
          120,
          Math.round(2 * EDGE_WARN_VENTANA * EDGE_WARN_ANCHO[1] * largo),
        );
        // La forma solo se recalcula cuando cambia (de a centésimas de progreso).
        const value = Math.round(p * 100) + "x" + w + "x" + h;
        if (value !== warn.shown) {
          // Recién aparece la franja: forma nueva.
          if (warn.shown === "") warn.forma = edgeNuevaForma();
          warn.shown = value;
          warn.el.style.display = "";
          if (win !== warn.win) {
            warn.win = win;
            if (alLado) warn.el.style.height = win + "px";
            else warn.el.style.width = win + "px";
          }
          warn.el.style.clipPath = edgeWarnShape(
            side,
            Math.round(p * 100) / 100,
            sigma,
            win,
            warn.forma,
          );
          warn.el.style.opacity = String(0.3 + 0.7 * p);
        }
        // La caja acompaña a la nave a lo largo del borde (solo un transform).
        const desp = Math.round(along - win / 2);
        if (desp !== warn.desp) {
          warn.desp = desp;
          warn.el.style.transform = alLado
            ? "translateY(" + desp + "px)"
            : "translateX(" + desp + "px)";
        }
        // Las estrellas viajan todos los cuadros mientras la franja se ve.
        drawEdgeStars(side, warn, p, sigma, win);
      }
    };
    const GAMEPAD_DEADZONE = 0.2;
    const GAMEPAD_THRUST_BASE = 0.3; // velocidad normal del stick/flechitas
    const GAMEPAD_THRUST_BOOST = 0.6; // velocidad con RB apretado
    const GAMEPAD_DAMPING = 0.9;
    // Mapeo estándar del Gamepad API
    const BTN_RB = 5;
    const BTN_LT = 6;
    const BTN_DPAD_UP = 12;
    const BTN_DPAD_DOWN = 13;
    const BTN_DPAD_LEFT = 14;
    const BTN_DPAD_RIGHT = 15;
    const isPressed = (gp, idx) =>
      !!(gp.buttons[idx] && gp.buttons[idx].pressed);
    function getFirstGamepad() {
      const pads = navigator.getGamepads ? navigator.getGamepads() : [];
      for (let k = 0; k < pads.length; k++) if (pads[k]) return pads[k];
      return null;
    }
    function applyDeadzone(v) {
      if (Math.abs(v) < GAMEPAD_DEADZONE) return 0;
      const sign = v < 0 ? -1 : 1;
      return sign * ((Math.abs(v) - GAMEPAD_DEADZONE) / (1 - GAMEPAD_DEADZONE));
    }

    (document.addEventListener("mousemove", (t) => {
      ((i = t.clientX), (o = t.clientY), (l = !0));
    }),
      document.addEventListener("mousedown", (t) => {
        if (t.button === 0) mouseBoost = true;
      }),
      document.addEventListener("mouseup", () => {
        mouseBoost = false;
      }),
      document.addEventListener(
        "touchstart",
        (t) => {
          if (!t.touches || t.touches.length === 0) return;
          const touch = t.touches[0];
          ((i = touch.clientX), (o = touch.clientY), (l = !0));
        },
        { passive: true },
      ),
      document.addEventListener(
        "touchmove",
        (t) => {
          if (!t.touches || t.touches.length === 0) return;
          const touch = t.touches[0];
          ((i = touch.clientX), (o = touch.clientY), (l = !0));
        },
        { passive: true },
      ),
      document.addEventListener(
        "touchend",
        () => {
          l = !1;
        },
        { passive: true },
      ),
      document.addEventListener(
        "touchcancel",
        () => {
          l = !1;
        },
        { passive: true },
      ),
      document.addEventListener("mouseleave", () => {
        l = !1;
        mouseBoost = false;
      }),
      requestAnimationFrame(function tick() {
        const gp = getFirstGamepad();
        let gx = 0,
          gy = 0,
          boosting = false;
        gamepadActive = false;
        gamepadMapViewT = 0;
        if (gp) {
          gx = applyDeadzone(gp.axes[0] || 0);
          gy = applyDeadzone(gp.axes[1] || 0);

          if (isPressed(gp, BTN_DPAD_LEFT)) gx = -1;
          else if (isPressed(gp, BTN_DPAD_RIGHT)) gx = 1;
          if (isPressed(gp, BTN_DPAD_UP)) gy = -1;
          else if (isPressed(gp, BTN_DPAD_DOWN)) gy = 1;

          boosting = isPressed(gp, BTN_RB);
          gamepadMapViewT =
            gp.buttons[BTN_LT] && typeof gp.buttons[BTN_LT].value === "number"
              ? gp.buttons[BTN_LT].value
              : isPressed(gp, BTN_LT)
                ? 1
                : 0;

          if (gx !== 0 || gy !== 0) {
            gamepadActive = true;
            i = e + gx * 1000;
            o = a + gy * 1000;
            l = true;
          }
        }

        // WASD/flechitas/Shift/Espacio: mismo camino que el D-pad/RB/LT del joystick
        // de arriba -pisan los ejes analógicos sólo si están apretados, así
        // no interfieren con el mouse/gamepad cuando no se usa el teclado.
        if (keyLeft || arrowLeft) gx = -1;
        else if (keyRight || arrowRight) gx = 1;
        if (keyUp || arrowUp) gy = -1;
        else if (keyDown || arrowDown) gy = 1;
        if (keyBoost) boosting = true;
        if (gx !== 0 || gy !== 0) {
          gamepadActive = true;
          i = e + gx * 1000;
          o = a + gy * 1000;
          l = true;
        }

        // Cada escenario puede pisar su propia velocidad (ver speedMult en
        // el registro de escenarios); por default todos usan la misma.
        let scene = scenes[currentSceneId];
        const speedMult = scene.speedMult;

        // Los cuadros de 60 Hz que pasaron desde el cuadro anterior (ver
        // SIM_PASO_MS). Se parten en subpasos de ~1 cuadro (en 60 Hz es 1, en 30 Hz
        // son 2 de tamaño 1; en 120 Hz es 1 de tamaño 0,5): la velocidad, el freno y
        // la posición se avanzan de a un paso, como se afinó, y no de un saque.
        const ahoraNave = performance.now();
        const cuadros = shipPrevT ? cuadrosDe(ahoraNave - shipPrevT) : 1;
        shipPrevT = ahoraNave;
        shipCuadros = cuadros;
        const subpasos = Math.max(1, Math.round(cuadros));
        const paso = cuadros / subpasos;

        // Con el click izquierdo mantenido, la nave se acerca más rápido y
        // más cerca del cursor -mismo boost que RB en el joystick (2x),
        // más un umbral de seguimiento menor para que llegue más cerca-.
        const boostMult = mouseBoost
          ? GAMEPAD_THRUST_BOOST / GAMEPAD_THRUST_BASE
          : 1;
        const followThreshold = l
          ? mouseBoost
            ? 40
            : isMobileTouch()
              ? 120
              : 220
          : 0;
        const thrust =
          (boosting ? GAMEPAD_THRUST_BOOST : GAMEPAD_THRUST_BASE) * speedMult;
        const p = gamepadActive ? GAMEPAD_DAMPING : l ? 0.15 : 0.995;
        const frenoPaso = Math.pow(p, paso);
        const sostenida = ahoraNave < shipCarriedUntil;
        for (let sub = 0; sub < subpasos; sub++) {
          if (gamepadActive) {
            n += gx * thrust * paso;
            r += gy * thrust * paso;
          } else {
            // Hacia dónde tira el mouse/dedo (o nada, si no hay).
            const m = (l && null !== i ? i : e) - e;
            const h = (l && null !== i ? o : a) - a;
            const v = Math.sqrt(m * m + h * h);
            if (v > followThreshold + 1) {
              const t = l ? (v - followThreshold) / v : 1;
              const k = 0.022 * speedMult * boostMult * paso;
              n += m * t * k;
              r += h * t * k;
            }
          }
          n *= frenoPaso;
          r *= frenoPaso;
          if (sostenida) {
            n = 0;
            r = 0;
          }
          e += n * paso;
          a += r * paso;
        }

        // Entrada de la nave (ver SHIP_ENTRY_*): el vuelo pisa la posición hasta
        // que termina o el jugador toma el control.
        if (shipEntry) {
          if (l || gamepadActive) {
            shipEntry = null;
          } else {
            const now = performance.now();
            if (!shipEntry.to) shipEntry.to = shipEntryTo();
            const to = shipEntry.to;
            const u = Math.max(
              0,
              Math.min(1, (now - shipEntry.t0) / SHIP_ENTRY_MS),
            );
            const ease = 1 - Math.pow(1 - u, 3); // llega rápido y frena suave
            e = SHIP_ENTRY_FROM.x + (to.x - SHIP_ENTRY_FROM.x) * ease;
            a = SHIP_ENTRY_FROM.y + (to.y - SHIP_ENTRY_FROM.y) * ease;
            n = 0;
            r = 0;
            // Mira hacia donde va y en el último tramo gira hacia el nombre.
            const settle = Math.max(0, Math.min(1, (u - 0.55) / 0.45));
            const heading = shipEntryHeading(to);
            if (settle > 0 && shipEntry.aim == null)
              shipEntry.aim = shipEntryAim(to);
            let giro = settle > 0 ? shipEntry.aim - heading : 0;
            giro = ((((giro + 180) % 360) + 360) % 360) - 180; // por el camino corto
            s = heading + giro * settle * settle * (3 - 2 * settle);
            if (u >= 1) shipEntry = null;
          }
        }

        // Cada borde de un escenario puede pedir su propio margen (edges.<borde>.margin):
        // cuánto tiene que salirse la nave del viewport para cruzar al escenario del
        // otro lado. Un margen grande hace que irse sea una decisión, no un roce.
        const minX = -edgeMargin(scene, "left", FLIGHT_MARGIN),
          maxX = window.innerWidth + edgeMargin(scene, "right", FLIGHT_MARGIN),
          minY = -edgeMargin(scene, "top", FLIGHT_MARGIN_TOP),
          maxY =
            window.innerHeight + edgeMargin(scene, "bottom", FLIGHT_MARGIN);
        let touchedEdge = null;
        if (e < minX) {
          e = minX;
          n = 0;
          touchedEdge = "left";
        } else if (e > maxX) {
          e = maxX;
          n = 0;
          touchedEdge = "right";
        }
        if (a < minY) {
          a = minY;
          r = 0;
          touchedEdge = "top";
        } else if (a > maxY) {
          a = maxY;
          r = 0;
          touchedEdge = "bottom";
        }

        // Escenarios como un mapa: si el borde tocado tiene una entrada
        // definida en scenes[currentSceneId].edges (ver registro de
        // escenarios), cruza a ese escenario; si no, el clamp de arriba ya
        // alcanza -es un borde sin escenario del otro lado, como hoy son
        // left/right en la principal y en la de espacio-.
        if (forcedEdge) {
          touchedEdge = forcedEdge;
          forcedEdge = null;
        }
        const edge = touchedEdge && scene.edges[touchedEdge];
        if (edge && !(edge.requiresDesktop && isMobileTouch())) {
          const prevScene = scene;
          currentSceneId = edge.to;
          scene = scenes[currentSceneId];
          const pos = edge.enter(window.innerWidth, window.innerHeight);
          e = pos.x;
          a = pos.y;
          n = 0;
          r = 0;
          wheelMapViewT = 0;
          if (prevScene.setVisible) prevScene.setVisible(false);
          if (scene.setVisible) scene.setVisible(true);
          if (prevScene.shipClass) t.classList.remove(prevScene.shipClass);
          if (scene.shipClass) t.classList.add(scene.shipClass);
          if (applyLightFilter) applyLightFilter();
        }

        if (
          l &&
          null !== i &&
          performance.now() >= shipCarriedUntil &&
          performance.now() >= shipFaceUntil
        ) {
          const toX = i - e,
            toY = o - a;
          let angle = Math.atan2(toY, toX) * (180 / Math.PI) + 90 - s;
          for (; angle > 180; ) angle -= 360;
          for (; angle < -180; ) angle += 360;
          s += suavizadoPor(0.25, cuadros) * angle;
        }

        if (!gamepadActive && wasGamepadActive) l = false;
        wasGamepadActive = gamepadActive;

        shipCenterX = e + 65;
        shipCenterY = a + 65;
        updateEdgeWarnings(scene, shipCenterX, shipCenterY);

        if (introOpacity < 1) {
          introOpacity = Math.max(
            introOpacity,
            Math.max(0, Math.min(1, (e + FLIGHT_MARGIN) / 80)),
          );
        }
        shipAlpha += (1 - shipAlpha) * suavizadoPor(0.05, cuadros);
        const f = introOpacity * shipAlpha;
        // 1 recién entrando por abajo (maxY) -> 0 arriba del todo (minY):
        // cuanto más arriba vuela la nave en esta escena, más chica se
        // pone, en vez de un tamaño fijo. Sólo aplica si el escenario
        // declaró heightScale (ver registro de escenarios); si no, se queda
        // en el tamaño normal siempre.
        // (Con el rango de vuelo de siempre, sin el margen extra de salida.)
        const spaceT = scene.heightScale
          ? Math.max(
              0,
              Math.min(
                1,
                (a + FLIGHT_MARGIN_TOP) /
                  (window.innerHeight + FLIGHT_MARGIN + FLIGHT_MARGIN_TOP),
              ),
            )
          : 1;
        // Con M (teclado) o LT (joystick) apretado se ve el mapa completo
        // sin zoom (multiplicador 1); se restaura solo al soltar ambos.
        // mapViewT es continuo (0..1, no un booleano) para mezclar de forma
        // proporcional al valor analógico del gatillo -de ahí no queda
        // ningún cruce de umbral que pueda parpadear entre dos targets cada
        // frame-. targetCameraZoom además se suaviza (mismo ritmo 0.05 que
        // shipScale antes) para que el fondo, la nave y la decoración se
        // achiquen/agranden todos juntos, como si una cámara se alejara, en
        // vez de la nave sola encogiéndose. Sólo aplica si el escenario
        // declaró camera (ver registro de escenarios); si no, no tiene zoom.
        // Si el escenario bloquea el zoom out (zoomBloqueado, ver el escenario 4)
        // no se aleja aunque se apriete M/Espacio/LT o se use la rueda; la rueda
        // además no acumula, para que al terminar no salte de golpe.
        const zoomBloqueado = !!scene.zoomBloqueado && scene.zoomBloqueado();
        if (zoomBloqueado) wheelMapViewT = 0;
        if (wheelMapViewT > 0 && performance.now() > wheelExpireAt)
          wheelMapViewT = 0;
        const mapViewT = zoomBloqueado
          ? 0
          : Math.max(keyMapView ? 1 : 0, gamepadMapViewT, wheelMapViewT);
        const targetCameraZoom = scene.camera
          ? scene.camera.zoom + (1 - scene.camera.zoom) * mapViewT
          : 1;
        cameraZoom +=
          (targetCameraZoom - cameraZoom) * suavizadoPor(0.05, cuadros);
        const targetHeightScale = scene.heightScale
          ? scene.heightScale.far +
            (scene.heightScale.near - scene.heightScale.far) * spaceT
          : 1;
        shipHeightScale +=
          (targetHeightScale - shipHeightScale) * suavizadoPor(0.05, cuadros);
        // La nave "vive" en el mismo espacio que el fondo: se multiplica
        // por cameraZoom igual que rocas/planeta (que sí son hijos de
        // #space-scene y lo heredan solos) para escalar junto con todo lo
        // demás en vez de quedar de un tamaño fijo mientras el resto crece
        // o encoge alrededor -si no, en la vista normal (cameraZoom alto)
        // el fondo se agranda pero la nave se queda del mismo porte y
        // termina viéndose chiquita en comparación. El tamaño "real" de la
        // nave (shipHeightScale solo) es el que se ve en la vista de mapa
        // completo (M/Espacio apretado), donde cameraZoom baja a 1.
        shipScale = shipHeightScale * cameraZoom;
        if (scene.camera) {
          // La nave puede volar hasta FLIGHT_MARGIN/FLIGHT_MARGIN_TOP afuera
          // del viewport (para poder "perderse" contra el negro), pero el
          // fondo con zoom nunca debe anclarse ahí: si el transform-origin
          // queda afuera de la pantalla, el lado opuesto del fondo escalado
          // se despega del borde y deja ver el starry normal del sitio por
          // detrás. Se clampea a los límites del viewport para que el fondo
          // siga cubriendo toda la pantalla siempre. Usa shipCenterX/Y (el
          // centro real del sprite, +65 sobre e/a) y no e/a directo -e/a es
          // la esquina superior-izquierda de la caja de 130x130, ancorar
          // ahí en vez del centro corría el fondo ~65px de la nave en cada
          // zoom, así el mapa completo (M/Espacio) no quedaba centrado en
          // su posición real.
          const camX = Math.max(0, Math.min(window.innerWidth, shipCenterX));
          const camY = Math.max(0, Math.min(window.innerHeight, shipCenterY));
          const camOrigin = `${camX}px ${camY}px`;
          const camTransform = `scale(${cameraZoom})`;
          // Mismo transform para todos los elementos que declaró la escena
          // (fondo + capa "delante de la nave" en el caso del espacio
          // profundo), así se mueven/escalan como una sola cámara aunque
          // sean elementos distintos (ver comentario largo en
          // .space-scene-front en styles.css para el porqué de ese split).
          scene.camera.elements.forEach((el) => {
            if (!el) return;
            el.style.transformOrigin = camOrigin;
            el.style.transform = camTransform;
          });
          if (scene.camera.onFrame)
            scene.camera.onFrame(cameraZoom, camX, camY);
        }
        // getBoundingClientRect ya devuelve la caja en pantalla
        // post-transform (incluye el zoom/paneo de cámara), así que cada
        // drifter compara peras con peras sin rehacer a mano la cuenta del
        // zoom. Se llama siempre (no sólo dentro de la escena, pasando null
        // como shipRect) para que cualquiera que haya quedado a mitad de
        // camino termine de asentarse aunque el usuario haya salido.
        const driftShipRect =
          currentSceneId === "space" ? t.getBoundingClientRect() : null;
        // Se miden todas las piedras juntas y recién después se les escribe.
        const driftRects = driftShipRect
          ? spaceDrifters.map((update) => update.measure())
          : null;
        spaceDrifters.forEach((update, i) =>
          update(driftShipRect, n, r, driftRects && driftRects[i], cuadros),
        );
        if (updateBiosRepel) updateBiosRepel(driftShipRect, cuadros);
        updateShipFire(e, a, boosting || mouseBoost);
        // window.shipZoom (1 por defecto) agranda la nave sobre su propio centro:
        // el final del escenario 4 lo usa para el zoom a la nave.
        const escalaNave = shipScale * (window.shipZoom || 1);
        shipPose.x = e;
        shipPose.y = a;
        shipPose.rot = s;
        shipPose.escala = escalaNave;
        shipPose.listo = true;
        ((t.style.opacity = f),
          (t.style.transform = `translate(${e}px, ${a}px) rotate(${s}deg) scale(${escalaNave})`),
          requestAnimationFrame(tick));
      }));
    // Fuego de la nave (parallax/cohete_fuego.webp, mismo lienzo de 203x300 que el
    // sprite): se ve siempre. Quieta, arde bajito (más corto y con una
    // animación mínima, lenta); al moverse se alarga y se agita del todo, y al
    // frenar vuelve a ese ardor bajito de a poco. Se guía por la velocidad real
    // (lo que se desplazó entre un cuadro y el siguiente, así vale para el
    // mouse, el teclado, el joystick y el vuelo de entrada). Se deforma: cada
    // franja horizontal del dibujo se corre de costado (más cuanto más cerca de
    // la punta), el largo parpadea y el ancho respira. Con el boost (Shift, RB o
    // click mantenido) se agita todavía más rápido y se alarga un poco más.
    const updateShipFire = (function () {
      const canvas = t.querySelector(".starry-cohete-fuego");
      if (!canvas) return function () {};
      const ctx = canvas.getContext("2d");
      const img = new Image();
      img.src = "parallax/cohete_fuego.webp";
      const still = window.matchMedia("(prefers-reduced-motion: reduce)");
      // Zona del dibujo que tiene fuego (px del lienzo de 203x300): arranca
      // pegado a los motores (FIRE_TOP) y las franjas son de SLICE px.
      const FIRE_TOP = 196;
      const FIRE_BOTTOM = 270;
      const FIRE_X = 60;
      const FIRE_W = 90;
      const FIRE_CX = 102;
      const SLICE = 2;
      const MOVING_MIN = 15; // px/s: por debajo, está quieta
      const MOVING_FULL = 75; // px/s: desde acá el fuego arde a pleno
      const FADE_IN = 0.08; // s: quieta -> en movimiento
      const FADE_OUT = 0.6; // s: en movimiento -> quieta
      const IDLE_AMP = 0.15; // fuerza de la deformación quieta (1 = en movimiento)
      const IDLE_SPEED = 0.35; // velocidad de la animación quieta (1 = en movimiento)
      const BOOST_SPEED = 1.9; // velocidad de la animación con boost (1 = en movimiento)
      const BOOST_AMP = 1.25; // fuerza de la deformación con boost
      const BOOST_LARGO = 1.2; // largo del fuego con boost
      const BOOST_IN = 0.12; // s
      const BOOST_OUT = 0.35; // s
      const IDLE_FRAME_MS = 50; // quieta redibuja a ~20 cuadros/s: no hace falta más y gasta menos
      let lastX = null;
      let lastY = null;
      let lastT = 0;
      let lastDraw = 0;
      let level = 0; // 0 quieta .. 1 en movimiento
      let boostLevel = 0; // 0 sin boost .. 1 con boost (sólo cuenta si se mueve)
      let fase = 0; // reloj de la animación (segundos "propios": va lento quieta)
      let shown = false;
      return function (x, y, boost) {
        const now = performance.now();
        const dt = Math.min(0.1, (now - lastT) / 1000);
        let speed = 0;
        // Un salto grande en un solo cuadro es un cambio de escenario (la nave
        // reaparece en otro lado), no velocidad.
        if (lastX !== null && dt > 0) {
          const dist = Math.hypot(x - lastX, y - lastY);
          if (dist < 250) speed = dist / dt;
        }
        lastX = x;
        lastY = y;
        lastT = now;
        if (dt <= 0) return;
        const target = Math.max(
          0,
          Math.min(1, (speed - MOVING_MIN) / (MOVING_FULL - MOVING_MIN)),
        );
        const tau = target > level ? FADE_IN : FADE_OUT;
        level += (target - level) * (1 - Math.exp(-dt / tau));
        if (level < 0.004 && target === 0) level = 0;
        boostLevel +=
          ((boost ? 1 : 0) - boostLevel) *
          (1 - Math.exp(-dt / (boost ? BOOST_IN : BOOST_OUT)));
        // Sólo cuenta si la nave se mueve de verdad (apretar boost quieta no hace nada).
        const boostF = boostLevel * level;
        fase +=
          dt *
          (IDLE_SPEED + (1 - IDLE_SPEED) * level) *
          (1 + (BOOST_SPEED - 1) * boostF);
        if (!img.complete || !img.naturalWidth) return;
        if (level < 0.02 && now - lastDraw < IDLE_FRAME_MS) return;
        lastDraw = now;
        const s = fase;
        // Fuerza de la deformación: mínima quieta, completa en movimiento.
        const amp = still.matches
          ? 0
          : (IDLE_AMP + (1 - IDLE_AMP) * level) * (1 + (BOOST_AMP - 1) * boostF);
        // Largo: crece con la velocidad (y más con el boost) y parpadea.
        const largo =
          (0.55 + 0.45 * level) *
          (1 + (BOOST_LARGO - 1) * boostF) *
          (1 +
            amp *
              (0.1 * Math.sin(s * 23) +
                0.06 * Math.sin(s * 37 + 1) +
                0.04 * Math.sin(s * 11 + 2)));
        // Ancho: respira alrededor del centro del fuego.
        const ancho = 1 + amp * 0.06 * Math.sin(s * 29 + 0.5);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let sy = FIRE_TOP; sy < FIRE_BOTTOM; sy += SLICE) {
          const p = (sy - FIRE_TOP) / (FIRE_BOTTOM - FIRE_TOP); // 0 motores .. 1 punta
          const sh = Math.min(SLICE, FIRE_BOTTOM - sy);
          const dy = FIRE_TOP + (sy - FIRE_TOP) * largo;
          const dh = sh * largo + 0.6; // 0.6 de más para que no queden rendijas entre franjas
          // Ondula de costado, más fuerte hacia la punta.
          const sway =
            amp *
            8 *
            p *
            p *
            (Math.sin(s * 14 - p * 7) * 0.7 + Math.sin(s * 23 - p * 11 + 1) * 0.3);
          const dx = FIRE_CX + (FIRE_X - FIRE_CX) * ancho + sway;
          ctx.drawImage(img, FIRE_X, sy, FIRE_W, sh, dx, dy, FIRE_W * ancho, dh);
        }
        if (!shown) {
          canvas.style.opacity = "1";
          shown = true;
        }
      };
    })();
    const d = t.querySelector(".starry-cohete-fondo");
    const cohetteTop = t.querySelector(".starry-cohete-top");
    if (d) {
      d.style.transition =
        "transform 0.18s cubic-bezier(0.4,0,0.2,1), filter 0.18s ease";
      let lightOn = false;
      // Cada escenario puede declarar su propio alcance de luz (filtro CSS
      // más ancho/difuso y volumen del sonido más bajo, ver scene.light en
      // el registro de escenarios) -si no declara nada, usa el alcance
      // "cerca" de la escena principal de siempre. Ya no hay
      // overflow/clip-path en la caja de la nave (ver .starry-cohete-pair en
      // CSS), así que un brillo grande puede difuminarse libre sin cortarse
      // en un contorno cuadrado.
      // La luz de la nave es la misma en todos los escenarios: dos halos sobre
      // el sprite (--nave-luz-halo en styles.css) y, aparte, la luz grande y
      // suave sobre el fondo (el ::before de .starry-cohete-pair, también en
      // styles.css; en el escenario 4 la dibuja el canvas).
      const NEAR_LIGHT_FILTER = "var(--nave-luz-halo)";
      applyLightFilter = () => {
        // El escenario 4 dibuja además la luz sobre su fondo (canvas).
        if (window.esc4Game) window.esc4Game.setLight(lightOn);
        const light = scenes[currentSceneId].light;
        if (!lightOn) {
          d.style.filter = (light && light.off) || "none";
          return;
        }
        d.style.filter = (light && light.filter) || NEAR_LIGHT_FILTER;
      };
      const setLight = (on, silent) => {
        lightOn = on;
        t.classList.toggle("luz-on", lightOn); // el escenario 4 ajusta la sombra de la nave según la luz
        d.style.transform = lightOn ? "translate(1px, 0px)" : "translate(0, 0)";
        applyLightFilter();
        if (cohetteTop)
          cohetteTop.src = lightOn
            ? "parallax/cohete_on.webp"
            : "parallax/cohete.webp";
        if (silent) return;
        const light = scenes[currentSceneId].light;
        sfxPlay(lightOn ? "luzOn" : "luzOff", light ? light.volume : 1);
      };
      // Al prender/apagar a mano (click, Q, gamepad) el escenario 4 no suena
      // (light.silentToggle); el sonido de luz on de la intro sí, va por shipLightSet.
      const toggleLight = () => {
        const light = scenes[currentSceneId].light;
        setLight(!lightOn, !!(light && light.silentToggle));
      };
      toggleShipLight = toggleLight;
      forceShipLight = (on, silent = true) => {
        const before = lightOn;
        if (before !== on) setLight(on, silent);
        return before;
      };
      // Prende/apaga la luz con su sonido (la usa el escenario 4).
      window.shipLightSet = (on) => forceShipLight(on, false);
      // La caja de la nave (130x130) es casi toda transparente y sigue al
      // mouse: si aceptara clicks en todo su rectángulo (pointer-events:auto
      // en CSS), terminaba tapando los clicks a la guitarra/bajo/satélite de
      // abajo apenas se paraba encima. Por eso la caja tiene pointer-events:
      // none y acá se chequea a mano, contra el sprite real, si el click cae
      // sobre un pixel opaco de la nave.
      if (cohetteTop) {
        const hitCohete = createAlphaHitTester(cohetteTop);
        document.addEventListener(
          "click",
          (ev) => {
            if (hitCohete(ev.clientX, ev.clientY)) toggleLight();
          },
          true,
        );
      }
    }
    (function () {
      const t = document.querySelector(".starry-p9");
      if (!t) return;
      const triggerSatelite = () => {
        if (window.innerWidth <= 600) return;
        t.classList.remove("spinning");
        t.offsetWidth;
        t.classList.add("spinning");
        t.addEventListener(
          "animationend",
          () => t.classList.remove("spinning"),
          {
            once: !0,
          },
        );
        sfxPlay("satelite");
      };
      const hitSatelite = createAlphaHitTester(t);
      t.addEventListener("click", (ev) => {
        if (!hitSatelite(ev.clientX, ev.clientY)) return;
        triggerSatelite();
      });
      parallaxZones.push({
        hitTest: hitSatelite,
        trigger: triggerSatelite,
      });
    })();
  })());

// Bass audio + notas del lick real, animadas en el orden de la frase
(function () {
  const bassGroup = document.getElementById("group-256");
  if (!bassGroup) return;
  const bassTarget =
    bassGroup.querySelector('.gl img[src="parallax/parallax 2.webp"]') ||
    bassGroup.querySelectorAll(".gl img")[0];
  if (!bassTarget) return;


  // Notas y ritmo reales del lick, confirmados: corchea (con silencio de
  // corchea detrás) - negra, negra, negra - dos corcheas juntas - negra,
  // negra, negra, negra. Van sobre La, Si, Reb, Re, Solb - Si, Re, Reb, Do,
  // Si. Las notas aparecen SUELTAS (sin pentagrama dibujado): cada una es un
  // glifo de duración real (♩ negra / ♪ corchea) con su bemol si corresponde.
  // "step" es la altura relativa dentro de la frase (a partir de esas notas
  // reales, medio tono por paso, tomando siempre el salto más cercano para
  // que la melodía no pegue octavas raras) y sólo sirve para que cada nota
  // flote más arriba o más abajo según el contorno. "gap" es la pausa hasta
  // que sale la nota siguiente (incluye el silencio de corchea después de
  // la anacrusa).
  const LICK_NOTES = [
    { text: "♪", step: 4, gap: 420 }, // La — anacrusa + silencio de corchea
    { text: "♩", step: 5, gap: 420 }, // Si
    { text: "♭♩", step: 6, gap: 420 }, // Reb
    { text: "♩", step: 6.5, gap: 420 }, // Re
    { text: "♭♫", step: 9.75, gap: 420 }, // Solb-Si — las dos corcheas juntas, un solo glifo
    { text: "♩", step: 12.5, gap: 420 }, // Re
    { text: "♭♩", step: 12, gap: 420 }, // Reb
    { text: "♩", step: 11.5, gap: 420 }, // Do
    { text: "♩", step: 11, gap: 0 }, // Si — nota final
  ];

  function spawnNote(note, x, y, index, sceneId) {
    const el = document.createElement("span");
    el.textContent = note.text;
    const size = note.text.length > 1 ? 21 : 25; // con alteración: achica un poco para que entre
    // Cada nota arranca un poco más a la derecha que la anterior (además de
    // ir derivando ella sola), para que la fila quede prolija y no se pisen.
    const startX = x + index * 34;
    const startY = y - (note.step - 4) * 8; // más aguda = flota más arriba
    el.style.cssText = `
      position: fixed;
      left: ${startX}px;
      top: ${startY}px;
      font-size: ${size}px;
      color: #f19280;
      text-shadow: 1px 2px 3px rgba(0, 0, 0, 0.5);
      pointer-events: none;
      z-index: 99999;
      user-select: none;
      line-height: 1;
      opacity: 1;
    `;
    document.body.appendChild(el);

    // Deriva suave y tranquila hacia la derecha, sin caída vertical: se
    // mantiene opaca un rato y se desvanece.
    const vx = 0.35 + Math.random() * 0.25;
    const vy = -0.18 - Math.random() * 0.18;
    let cx = startX;
    let cy = startY;
    let alpha = 1;
    const holdMs = 4400; // deja tiempo a que salgan todas antes de que se apague la primera
    const fadeDuration = 60;
    let fadeFrame = 0;
    const startTime = performance.now();

    function animate(now) {
      if (currentSceneId !== sceneId) {
        el.remove();
        return;
      }
      cx += vx;
      cy += vy;
      el.style.left = cx + "px";
      el.style.top = cy + "px";

      const elapsed = now - startTime;
      if (elapsed < holdMs) {
        el.style.opacity = 1;
        requestAnimationFrame(animate);
      } else {
        fadeFrame++;
        alpha = Math.max(0, 1 - fadeFrame / fadeDuration);
        el.style.opacity = alpha;
        if (alpha > 0) requestAnimationFrame(animate);
        else el.remove();
      }
    }
    requestAnimationFrame(animate);
  }

  function spawnLick(x, y) {
    let delay = 0;
    const sceneId = currentSceneId;
    LICK_NOTES.forEach(function (note, index) {
      setTimeout(function () {
        if (currentSceneId !== sceneId) return;
        spawnNote(note, x, y, index, sceneId);
      }, delay);
      delay += note.gap;
    });
  }

  const triggerBass = (x, y) => {
    sfxPlay("bajo");
    spawnLick(x, y);
  };
  const hitBass = createAlphaHitTester(bassTarget);

  document.addEventListener(
    "click",
    function (ev) {
      // Solo en la principal: parallax 2 sigue en el DOM (oculto) en los demás
      // escenarios y su rectángulo seguía "ahí", así que un click en ese lugar
      // hacía sonar el bajo aunque no se viera.
      if (currentSceneId !== "main") return;
      if (!hitBass(ev.clientX, ev.clientY)) return;
      triggerBass(ev.clientX, ev.clientY);
    },
    true,
  );

  parallaxZones.push({
    hitTest: hitBass,
    trigger: triggerBass,
  });
})();

// Año tipeado de a una letra. Antes lo hacía typed.js (una librería de un CDN
// externo, cargada de forma bloqueante, para escribir cuatro caracteres).
(function () {
  const el = document.getElementById("typed-year");
  if (!el) return;
  const texto = "2026";
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    el.textContent = texto;
    return;
  }
  let n = 0;
  (function siguiente() {
    el.textContent = texto.slice(0, ++n);
    if (n < texto.length) setTimeout(siguiente, 100);
  })();
})();

// Joystick: A (Xbox) / X (PlayStation) — botón 0 — reproduce el sonido de la
// zona del parallax que la nave esté tocando, igual que un click de mouse.
// Y (Xbox) / Triángulo (PlayStation) — botón 3 — prende/apaga la luz de la
// nave. En teclado, E cumple el mismo rol que el botón de acción y Q el de
// la luz.
(function () {
  const cohetePair = document.getElementById("starry-cohete-pair");
  if (!cohetePair) return;

  function triggerAction() {
    // Cada escenario tiene su propio parallaxZones (ver registro de
    // escenarios al inicio del archivo): así la nave sólo dispara los
    // objetos interactuables del escenario en el que está parada, aunque el
    // rect de una zona de otro escenario siga "ahí" oculto en el DOM.
    const scene = scenes[currentSceneId];
    const shipRect = cohetePair.getBoundingClientRect();
    const cx = shipRect.left + shipRect.width / 2;
    const cy = shipRect.top + shipRect.height / 2;
    for (const zone of scene.parallaxZones) {
      if (zone.hitTest(cx, cy)) {
        zone.trigger(cx, cy);
      }
    }
  }

  if (navigator.getGamepads) {
    const BTN_ACTION = 0;
    const BTN_LIGHT = 3;
    const prevActionPressed = [];
    const prevLightPressed = [];

    // Se sondea sólo mientras haya un joystick conectado: antes corría un
    // requestAnimationFrame eterno preguntándole al navegador por joysticks que
    // casi nunca existen. gamepadconnected salta apenas se toca un botón del
    // joystick (también si ya estaba enchufado al cargar) y lo vuelve a
    // arrancar; si en un cuadro no queda ninguno, se frena solo.
    let sondeando = false;
    const arrancarSondeo = () => {
      if (sondeando) return;
      sondeando = true;
      pollButtons();
    };
    window.addEventListener("gamepadconnected", arrancarSondeo);

    function pollButtons() {
      const pads = navigator.getGamepads();
      let hayJoystick = false;
      for (let idx = 0; idx < pads.length; idx++) {
        const gp = pads[idx];
        if (!gp) continue;
        hayJoystick = true;

        const actionButton = gp.buttons[BTN_ACTION];
        const actionPressed = !!(actionButton && actionButton.pressed);
        if (actionPressed && !prevActionPressed[idx]) triggerAction();
        prevActionPressed[idx] = actionPressed;

        const lightButton = gp.buttons[BTN_LIGHT];
        const lightPressed = !!(lightButton && lightButton.pressed);
        if (lightPressed && !prevLightPressed[idx] && toggleShipLight) {
          toggleShipLight();
        }
        prevLightPressed[idx] = lightPressed;
      }
      if (hayJoystick) requestAnimationFrame(pollButtons);
      else sondeando = false;
    }
    // Un joystick que ya estaba conectado antes de que cargara el script.
    arrancarSondeo();
  }

  // ev.repeat descarta el auto-repeat del navegador al mantener la tecla
  // apretada -si no, dispararía la acción/luz muchas veces por segundo en
  // vez de una sola vez por tecla apretada, como sí hace el chequeo de
  // flanco (prevActionPressed/prevLightPressed) del lado del joystick.
  document.addEventListener("keydown", (ev) => {
    if (ev.repeat) return;
    if (ev.code === "KeyE") triggerAction();
    else if (ev.code === "KeyQ" && toggleShipLight) toggleShipLight();
  });
})();

// CV: elegir idioma — el ícono del nav ya no descarga directo, abre un
// menú chico con Español/English (ver .cv-picker en styles.css).
(function () {
  const picker = document.getElementById("cvPicker");
  if (!picker) return;
  const btn = picker.querySelector(".cv-btn");
  const menu = picker.querySelector(".cv-menu");

  function open() {
    menu.hidden = false;
    btn.setAttribute("aria-expanded", "true");
  }
  function close() {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  }

  btn.addEventListener("pointerenter", () => {
    if (!btn.matches(":hover")) return;
    playBeep();
  });

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    playBeep();
    if (menu.hidden) open();
    else close();
  });
  document.addEventListener("click", (e) => {
    if (!menu.hidden && !picker.contains(e.target)) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      close();
      btn.focus();
    }
  });
})();
