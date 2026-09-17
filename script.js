const nav = document.getElementById("main-nav");
const navLinks = nav ? nav.querySelectorAll("a") : [];

// Zonas del parallax que la nave puede "tocar": cada una sabe cómo calcular
// su rectángulo actual y cómo reproducir su sonido (reusado por click de mouse
// y por el botón A/X del joystick cuando la nave está encima).
const parallaxZones = [];
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

  function prepare() {
    if (ready || !imgEl.naturalWidth) return;
    canvas = document.createElement("canvas");
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    ctx = canvas.getContext("2d");
    ctx.drawImage(imgEl, 0, 0);
    ready = true;
  }

  if (imgEl.complete) prepare();
  else imgEl.addEventListener("load", prepare, { once: true });

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

  function prepare() {
    if (bounds || !imgEl.naturalWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(imgEl, 0, 0);
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
        if (data[(y * canvas.width + x) * 4 + 3] > alphaThreshold) {
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

const beepPath = "audio/beep.mp3";
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
let beepBuffer = null;
let beepLoaded = false;

fetch(beepPath)
  .then((response) => response.arrayBuffer())
  .then((arrayBuffer) => audioContext.decodeAudioData(arrayBuffer))
  .then((buffer) => {
    beepBuffer = buffer;
    beepLoaded = true;
  })
  .catch(() => {
    beepLoaded = false;
  });

function resumeAudioContext() {
  if (audioContext.state === "suspended") {
    audioContext.resume().catch(() => {});
  }
}

function playBeep() {
  if (!beepLoaded || !beepBuffer) return;
  const startBeep = () => {
    const source = audioContext.createBufferSource();
    source.buffer = beepBuffer;
    const gain = audioContext.createGain();
    gain.gain.value = 0.15;
    source.connect(gain).connect(audioContext.destination);
    source.start(0);
  };

  if (audioContext.state === "suspended") {
    audioContext.resume().then(startBeep).catch(startBeep);
  } else {
    startBeep();
  }
}

["click", "pointerdown", "keydown", "touchstart"].forEach((eventName) => {
  document.addEventListener(eventName, resumeAudioContext, {
    once: true,
    capture: true,
  });
});

navLinks.forEach((link) => {
  link.addEventListener("pointerenter", () => {
    if (!link.matches(":hover")) return;
    playBeep();
  });
});

// Botón de encendido: sonido de arranque + parpadeo CRT antes de abrir la consola SQL
const powerBtn = document.querySelector(".power-btn");
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
      const encendido = new Audio("audio/sisopon.m4a");
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
function drawBurst() {
  (bctx.clearRect(0, 0, burstCanvas.width, burstCanvas.height),
    (burstParticles = burstParticles.filter((t) => t.alpha > 0.01)));
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
const lerp = (t, e, a) => t + (e - t) * a;

if (p3el) {
  const guitarraAudio = new Audio("audio/Guitarra.mp3");
  guitarraAudio.preload = "none"; // sólo se baja si tocan la guitarra, no en cada carga
  guitarraAudio.volume = 0.12;
  const playGuitarra = () => {
    guitarraAudio.currentTime = 0;
    guitarraAudio.play().catch(() => {});
  };
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
const P7_SAFE_MARGIN = 550; // px: recién si la nave sale de acá, puede volver
const P7_FLEE_SPEED = 18; // px por frame que se corre hacia la izquierda al huir
const P7_SHRINK_RATE = 0.018; // cuánto se achica por frame al huir
const P7_RETURN_SPEED = 3; // px por frame que recupera al volver (de a poco)
const P7_RETURN_GROW_RATE = 0.003; // cuánto crece por frame al volver
let p7Fleeing = false;
let p7FleeOffsetX = 0;
let p7FleeScale = 1;

function updateP7Flee() {
  if (!getP7DangerRect) return;

  const dangerRect = getP7DangerRect(P7_DANGER_MARGIN);
  const shipNear =
    shipCenterX !== null && pointInRect(shipCenterX, shipCenterY, dangerRect);

  if (shipNear) p7Fleeing = true;

  if (p7Fleeing) {
    p7FleeOffsetX -= P7_FLEE_SPEED;
    p7FleeScale = Math.max(0, p7FleeScale - P7_SHRINK_RATE);
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
    p7FleeOffsetX = Math.min(0, p7FleeOffsetX + P7_RETURN_SPEED);
    p7FleeScale = Math.min(1, p7FleeScale + P7_RETURN_GROW_RATE);
  }
}

function tick() {
  (updateP7Flee(),
    (currentX = lerp(currentX, targetX, 0.04)),
    group256 &&
      (group256.style.transform = `translateX(${MAX_PX * currentX * DEPTH_256 * 100}px)`),
    p3el &&
      (p3el.style.transform = `translateX(${MAX_PX * -currentX * DEPTH_P3 * 100}px)`),
    p7el &&
      (p7el.style.transform = `translateX(${MAX_PX * currentX * DEPTH_P7 * 100 + p7FleeOffsetX}px) scale(${p7FleeScale})`),
    p8el &&
      (p8el.style.transform = `translateX(${MAX_PX * -currentX * DEPTH_P8 * 100}px)`),
    requestAnimationFrame(tick));
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
    const FLIGHT_MARGIN = 100; // cuánto puede salirse la nave del viewport, en px
    const FLIGHT_MARGIN_TOP = 160; // arriba necesita más margen: al rotar, la nave (130px) sobresale de su caja
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
    let shipScale = 1;
    const SHIP_SPACE_SPEED_MULT = 0.35; // velocidad muy reducida en la escena de espacio profundo
    const spaceAstronaut = document.getElementById("space-astronaut");
    const spaceBoraNave = document.getElementById("space-bora-nave");
    // Se define más abajo, junto con la luz de la nave: la referencia queda
    // acá para que el loop de vuelo (tick) pueda llamarla al cruzar el
    // borde de la escena de espacio, y así la luz -si ya estaba prendida-
    // se ajuste sin esperar a que el usuario la vuelva a tocar.
    let applyLightFilter = null;
    let inSpaceScene = false;
    // Fundido de entrada: la nave arranca fuera de pantalla (e = -FLIGHT_MARGIN)
    // y aparece de a poco al acercarse al borde izquierdo. Una vez que llegó a
    // opacidad 1 la primera vez queda fija ahí -si no, como la opacidad se
    // recalculaba en cada frame en base a la posición actual, la nave se
    // transparentaba de nuevo cada vez que el usuario la llevaba de vuelta
    // cerca del borde izquierdo durante el uso normal.
    let introOpacity = 0;
    // En la escena de espacio profundo la nave se ve casi transparente, como
    // si quedara detrás de una nebulosa: shipAlpha viaja suavemente hacia
    // SHIP_SPACE_ALPHA (o de vuelta a 1) en vez de saltar de golpe al cruzar
    // el borde.
    const SHIP_SPACE_ALPHA = 0.55; // transparente pero todavía bien visible
    let shipAlpha = 1;
    let e = -FLIGHT_MARGIN,
      a = 180,
      n = 0,
      r = 0,
      s = 90,
      i = null,
      o = null,
      l = !1,
      gamepadActive = false,
      wasGamepadActive = false;
    const isMobileTouch = () => window.innerWidth <= 600;
    const GAMEPAD_DEADZONE = 0.2;
    const GAMEPAD_THRUST_BASE = 0.3; // velocidad normal del stick/flechitas
    const GAMEPAD_THRUST_BOOST = 0.6; // velocidad con RB apretado
    const GAMEPAD_DAMPING = 0.9;
    // Mapeo estándar del Gamepad API
    const BTN_RB = 5;
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
      }),
      requestAnimationFrame(function tick() {
        const gp = getFirstGamepad();
        let gx = 0,
          gy = 0,
          boosting = false;
        gamepadActive = false;
        if (gp) {
          gx = applyDeadzone(gp.axes[0] || 0);
          gy = applyDeadzone(gp.axes[1] || 0);

          if (isPressed(gp, BTN_DPAD_LEFT)) gx = -1;
          else if (isPressed(gp, BTN_DPAD_RIGHT)) gx = 1;
          if (isPressed(gp, BTN_DPAD_UP)) gy = -1;
          else if (isPressed(gp, BTN_DPAD_DOWN)) gy = 1;

          boosting = isPressed(gp, BTN_RB);

          if (gx !== 0 || gy !== 0) {
            gamepadActive = true;
            i = e + gx * 1000;
            o = a + gy * 1000;
            l = true;
          }
        }

        let c, u;
        l && null !== i ? ((c = i), (u = o)) : ((c = e), (u = a));
        const m = c - e,
          h = u - a,
          v = Math.sqrt(m * m + h * h);

        // En la escena de espacio profundo la nave se maneja mucho más
        // lenta -sensación de ir a la deriva- en vez de a la velocidad
        // ágil de la escena principal.
        const speedMult = inSpaceScene ? SHIP_SPACE_SPEED_MULT : 1;
        if (gamepadActive) {
          const thrust =
            (boosting ? GAMEPAD_THRUST_BOOST : GAMEPAD_THRUST_BASE) * speedMult;
          n += gx * thrust;
          r += gy * thrust;
        } else {
          const followThreshold = l ? (isMobileTouch() ? 120 : 220) : 0;
          if (v > followThreshold + 1) {
            const t = l ? (v - followThreshold) / v : 1;
            ((n += m * t * 0.022 * speedMult),
              (r += h * t * 0.022 * speedMult));
          }
        }

        const p = gamepadActive ? GAMEPAD_DAMPING : l ? 0.15 : 0.995;
        n *= p;
        r *= p;
        e += n;
        a += r;

        const minX = -FLIGHT_MARGIN,
          maxX = window.innerWidth + FLIGHT_MARGIN,
          minY = -FLIGHT_MARGIN_TOP,
          maxY = window.innerHeight + FLIGHT_MARGIN;
        if (e < minX) {
          e = minX;
          n = 0;
        } else if (e > maxX) {
          e = maxX;
          n = 0;
        }
        if (a < minY) {
          a = minY;
          r = 0;
        } else if (a > maxY) {
          a = maxY;
          r = 0;
        }

        let enteringOrLeavingSpace = false;
        if (!inSpaceScene && !isMobileTouch() && a <= minY) {
          inSpaceScene = true;
          // Reaparece por abajo, al medio tirando a la izquierda -no en la
          // esquina- para que se sienta perdida en el espacio profundo.
          e = window.innerWidth * 0.38 - 65;
          a = window.innerHeight - 150;
          enteringOrLeavingSpace = true;
        } else if (inSpaceScene && a >= maxY) {
          // Desde la segunda pantalla se vuelve a la principal yendo hacia
          // abajo (borde inferior), no repitiendo el borde superior.
          inSpaceScene = false;
          e = 40;
          a = minY + 50;
          enteringOrLeavingSpace = true;
        }
        if (enteringOrLeavingSpace) {
          n = 0;
          r = 0;
          if (siteContent)
            siteContent.classList.toggle("space-hidden", inSpaceScene);
          if (spaceScene)
            spaceScene.classList.toggle("space-visible", inSpaceScene);
          if (spaceAstronaut)
            spaceAstronaut.classList.toggle("space-visible", inSpaceScene);
          if (spaceBoraNave)
            spaceBoraNave.classList.toggle("space-visible", inSpaceScene);
          t.classList.toggle("in-space", inSpaceScene);
          if (applyLightFilter) applyLightFilter();
        }

        if (l && null !== i) {
          const toX = i - e,
            toY = o - a;
          let angle = Math.atan2(toY, toX) * (180 / Math.PI) + 90 - s;
          for (; angle > 180; ) angle -= 360;
          for (; angle < -180; ) angle += 360;
          s += 0.25 * angle;
        }

        if (!gamepadActive && wasGamepadActive) l = false;
        wasGamepadActive = gamepadActive;

        shipCenterX = e + 65;
        shipCenterY = a + 65;

        if (introOpacity < 1) {
          introOpacity = Math.max(
            introOpacity,
            Math.max(0, Math.min(1, (e + FLIGHT_MARGIN) / 80)),
          );
        }
        shipAlpha += ((inSpaceScene ? SHIP_SPACE_ALPHA : 1) - shipAlpha) * 0.05;
        const f = introOpacity * shipAlpha;
        // 1 recién entrando por abajo (maxY) -> 0 arriba del todo (minY):
        // cuanto más arriba vuela la nave en esta escena, más chica se
        // pone, en vez de un tamaño fijo.
        const spaceT = inSpaceScene
          ? Math.max(0, Math.min(1, (a - minY) / (maxY - minY)))
          : 1;
        const targetScale = inSpaceScene
          ? SHIP_SPACE_SCALE_FAR +
            (SHIP_SPACE_SCALE_NEAR - SHIP_SPACE_SCALE_FAR) * spaceT
          : 1;
        shipScale += (targetScale - shipScale) * 0.05;
        ((t.style.opacity = f),
          (t.style.transform = `translate(${e}px, ${a}px) rotate(${s}deg) scale(${shipScale})`),
          requestAnimationFrame(tick));
      }));
    const d = t.querySelector(".starry-cohete-fondo");
    const cohetteTop = t.querySelector(".starry-cohete-top");
    if (d) {
      d.style.transition =
        "transform 0.18s cubic-bezier(0.4,0,0.2,1), filter 0.18s ease";
      let lightOn = false;
      // En la escena de espacio profundo la luz alumbra bastante más lejos
      // -segunda capa de drop-shadow, más ancha y difusa- que en la escena
      // principal. Ya no hay overflow/clip-path en la caja de la nave (ver
      // .starry-cohete-pair en CSS), así que ese brillo grande puede
      // difuminarse libre sin cortarse en un contorno cuadrado.
      applyLightFilter = () => {
        if (!lightOn) {
          d.style.filter = "none";
          return;
        }
        d.style.filter = inSpaceScene
          ? "drop-shadow(0 2px 14px rgba(255, 159, 154, 0.85)) drop-shadow(0 0 70px rgba(255, 159, 154, 0.7))"
          : "drop-shadow(0 2px 10px rgba(255, 159, 154, 0.59))";
      };
      const toggleLight = () => {
        lightOn = !lightOn;
        d.style.transform = lightOn ? "translate(1px, 0px)" : "translate(0, 0)";
        applyLightFilter();
        if (cohetteTop)
          cohetteTop.src = lightOn
            ? "parallax/cohete_on.webp"
            : "parallax/cohete.webp";
        const snd = new Audio(
          lightOn ? "audio/light_on.mp3" : "audio/light_off.mp3",
        );
        snd.volume = inSpaceScene ? 0.2 : 1;
        snd.play().catch(() => {});
      };
      toggleShipLight = toggleLight;
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
      const e = new Audio("audio/satelite.mp3");
      e.preload = "none"; // sólo se baja si tocan el satélite, no en cada carga
      e.volume = 0.25;
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
        e.currentTime = 0;
        e.play().catch(() => {});
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

  const bassAudio = new Audio("audio/bass.mp3");
  bassAudio.preload = "none"; // sólo se baja si tocan esa nota, no en cada carga
  bassAudio.volume = 0.6;

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

  function spawnNote(note, x, y, index) {
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
    LICK_NOTES.forEach(function (note, index) {
      setTimeout(function () {
        spawnNote(note, x, y, index);
      }, delay);
      delay += note.gap;
    });
  }

  const triggerBass = (x, y) => {
    bassAudio.currentTime = 0;
    bassAudio.play().catch(() => {});
    spawnLick(x, y);
  };
  const hitBass = createAlphaHitTester(bassTarget);

  document.addEventListener(
    "click",
    function (ev) {
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

// Typed.js for year animation
document.addEventListener("DOMContentLoaded", function () {
  new Typed("#typed-year", {
    strings: ["2026"],
    typeSpeed: 100,
    backSpeed: 0,
    loop: false,
    showCursor: false,
  });
});

// Joystick: A (Xbox) / X (PlayStation) — botón 0 — reproduce el sonido de la
// zona del parallax que la nave esté tocando, igual que un click de mouse.
// Y (Xbox) / Triángulo (PlayStation) — botón 3 — prende/apaga la luz de la nave.
(function () {
  const cohetePair = document.getElementById("starry-cohete-pair");
  if (!cohetePair || !navigator.getGamepads) return;

  const BTN_ACTION = 0;
  const BTN_LIGHT = 3;
  const prevActionPressed = [];
  const prevLightPressed = [];

  function pollButtons() {
    const pads = navigator.getGamepads();
    for (let idx = 0; idx < pads.length; idx++) {
      const gp = pads[idx];
      if (!gp) continue;

      const actionButton = gp.buttons[BTN_ACTION];
      const actionPressed = !!(actionButton && actionButton.pressed);
      if (actionPressed && !prevActionPressed[idx]) {
        const shipRect = cohetePair.getBoundingClientRect();
        const cx = shipRect.left + shipRect.width / 2;
        const cy = shipRect.top + shipRect.height / 2;
        for (const zone of parallaxZones) {
          if (zone.hitTest(cx, cy)) {
            zone.trigger(cx, cy);
          }
        }
      }
      prevActionPressed[idx] = actionPressed;

      const lightButton = gp.buttons[BTN_LIGHT];
      const lightPressed = !!(lightButton && lightButton.pressed);
      if (lightPressed && !prevLightPressed[idx] && toggleShipLight) {
        toggleShipLight();
      }
      prevLightPressed[idx] = lightPressed;
    }
    requestAnimationFrame(pollButtons);
  }
  requestAnimationFrame(pollButtons);
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

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
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
