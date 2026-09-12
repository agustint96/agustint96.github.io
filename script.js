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
  document
    .querySelectorAll(".crt-screen")
    .forEach((el) => el.remove());
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
  guitarraAudio.preload = "auto";
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
    shipCenterX === null || !pointInRect(shipCenterX, shipCenterY, homeSafeRect);
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
      alpha: e ?? 0.9,
      vy: -(0.3 * Math.random() + 0.008),
    });
}
function drawStars() {
  (ctx.clearRect(0, 0, starCanvas.width, starCanvas.height),
    (stars = stars.filter((t) => t.alpha > 0.01)));
  for (const t of stars)
    ((ctx.globalAlpha = t.alpha),
      (ctx.fillStyle = "#f19280"),
      ctx.beginPath(),
      ctx.arc(Math.round(t.x), Math.round(t.y), starRadius, 0, 2 * Math.PI),
      ctx.fill(),
      (t.y += t.vy),
      (t.alpha -= 0.006));
  ((ctx.globalAlpha = 1), requestAnimationFrame(drawStars));
}
(resizeCanvas(),
  new ResizeObserver(resizeCanvas).observe(starryBg),
  window.addEventListener("resize", resizeCanvas),
  starryBg.addEventListener("mousemove", () =>
    addStars(Math.floor(4 * Math.random()) + 1),
  ),
  starryBg.addEventListener("touchmove", () => {
    if (window.innerWidth <= 600) addStars(1);
    else addStars(Math.floor(4 * Math.random()) + 1);
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
    const t = document.getElementById("starry-cohete-pair");
    if (!t) return;
    const FLIGHT_MARGIN = 100; // cuánto puede salirse la nave del viewport, en px
    const FLIGHT_MARGIN_TOP = 160; // arriba necesita más margen: al rotar, la nave (130px) sobresale de su caja
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
    const isPressed = (gp, idx) => !!(gp.buttons[idx] && gp.buttons[idx].pressed);
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
      requestAnimationFrame(function d() {
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

        if (gamepadActive) {
          const thrust = boosting ? GAMEPAD_THRUST_BOOST : GAMEPAD_THRUST_BASE;
          n += gx * thrust;
          r += gy * thrust;
        } else {
          const followThreshold = l ? (isMobileTouch() ? 120 : 220) : 0;
          if (v > followThreshold + 1) {
            const t = l ? (v - followThreshold) / v : 1;
            ((n += m * t * 0.022), (r += h * t * 0.022));
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

        const f = Math.max(0, Math.min(1, (e + FLIGHT_MARGIN) / 80));
        ((t.style.opacity = f),
          (t.style.transform = `translate(${e}px, ${a}px) rotate(${s}deg)`),
          requestAnimationFrame(d));
      }));
    const d = t.querySelector(".starry-cohete-fondo");
    const cohetteTop = t.querySelector(".starry-cohete-top");
    if (d) {
      d.style.transition =
        "transform 0.18s cubic-bezier(0.4,0,0.2,1), filter 0.18s ease";
      let lightOn = false;
      const toggleLight = () => {
        lightOn = !lightOn;
        if (lightOn) {
          d.style.transform = "translate(1px, 0px)";
          d.style.filter = "drop-shadow(0 2px 10px rgba(255, 159, 154, 0.59))";
          if (cohetteTop) cohetteTop.src = "parallax/cohete_on.png";
          const snd = new Audio("audio/light_on.mp3");
          snd.volume = 1;
          snd.play().catch(() => {});
        } else {
          d.style.transform = "translate(0, 0)";
          d.style.filter = "none";
          if (cohetteTop) cohetteTop.src = "parallax/cohete.png";
          const snd = new Audio("audio/light_off.mp3");
          snd.volume = 1;
          snd.play().catch(() => {});
        }
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
      e.preload = "auto";
      e.volume = 0.25;
      const triggerSatelite = () => {
        if (window.innerWidth <= 600) return;
        t.classList.remove("spinning");
        t.offsetWidth;
        t.classList.add("spinning");
        t.addEventListener("animationend", () => t.classList.remove("spinning"), {
          once: !0,
        });
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

// Bass audio + notas musicales
(function () {
  const bassGroup = document.getElementById("group-256");
  if (!bassGroup) return;
  const bassTarget =
    bassGroup.querySelector('.gl img[src="parallax/parallax 2.png"]') ||
    bassGroup.querySelectorAll(".gl img")[0];
  if (!bassTarget) return;

  const bassAudio = new Audio("audio/bass.mp3");
  bassAudio.preload = "auto";
  bassAudio.volume = 0.6;

  const NOTE_CHARS = ["♩", "♪", "♫", "♬"];

  function spawnNotes(x, y) {
    const count = 4;
    const spacing = 22;
    for (let i = 0; i < count; i++) {
      const el = document.createElement("span");
      el.textContent =
        NOTE_CHARS[Math.floor(Math.random() * NOTE_CHARS.length)];
      const size = 16 + Math.floor(Math.random() * 10);
      // Notas en fila horizontal hacia la derecha, con pequeño offset vertical alternado
      const startX = x + i * spacing;
      const startY = y + (i % 2 === 0 ? 0 : -8);
      const noteColor = "#f19280";
      el.style.cssText = `
        position: fixed;
        left: ${startX}px;
        top: ${startY}px;
        font-size: ${size}px;
        color: ${noteColor};
        pointer-events: none;
        z-index: 99999;
        user-select: none;
        line-height: 1;
        transform-origin: center;
        opacity: 1;
      `;
      document.body.appendChild(el);

      // Velocidad horizontal suave hacia la derecha, sin caída vertical
      const vx = 0.6 + Math.random() * 0.4;
      const vy = -0.3 - Math.random() * 0.3;
      let cx = startX;
      let cy = startY;
      let alpha = 1;
      const holdMs = 3600; // tiempo opaco
      const fadeDuration = 60; // frames para desvanecer (~1s)
      let fadeFrame = 0;
      const startTime = performance.now();

      function animate(now) {
        cx += vx;
        cy += vy;
        el.style.left = cx + "px";
        el.style.top = cy + "px";

        const elapsed = now - startTime;
        if (elapsed < holdMs) {
          // mantenerse visible
          el.style.opacity = 1;
          requestAnimationFrame(animate);
        } else {
          // desvanecer suavemente
          fadeFrame++;
          alpha = Math.max(0, 1 - fadeFrame / fadeDuration);
          el.style.opacity = alpha;
          if (alpha > 0) {
            requestAnimationFrame(animate);
          } else {
            el.remove();
          }
        }
      }
      requestAnimationFrame(animate);
    }
  }

  const triggerBass = (x, y) => {
    bassAudio.currentTime = 0;
    bassAudio.play().catch(() => {});
    spawnNotes(x, y);
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
