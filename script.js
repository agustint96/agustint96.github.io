const nav = document.getElementById("main-nav");
const navLinks = nav ? nav.querySelectorAll("a") : [];
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
function tick() {
  ((currentX = lerp(currentX, targetX, 0.04)),
    group256 &&
      (group256.style.transform = `translateX(${80 * currentX * 5e-4 * 100}px)`),
    p3el &&
      (p3el.style.transform = `translateX(${80 * -currentX * 5e-4 * 100}px)`),
    p7el &&
      (p7el.style.transform = `translateX(${80 * currentX * 0.003 * 100}px)`),
    p8el &&
      (p8el.style.transform = `translateX(${80 * -currentX * 8e-4 * 100}px)`),
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
      ctx.arc(Math.round(t.x), Math.round(t.y), 1.5, 0, 2 * Math.PI),
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
    let e = -150,
      a = 180,
      n = 0,
      r = 0,
      s = 90,
      i = null,
      o = null,
      l = !1;
    const isMobileTouch = () => window.innerWidth <= 600;
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
        let c, u;
        l && null !== i ? ((c = i), (u = o)) : ((c = e), (u = a));
        const m = c - e,
          h = u - a,
          v = Math.sqrt(m * m + h * h);
        const followThreshold = l ? (isMobileTouch() ? 120 : 220) : 0;
        if (v > followThreshold + 1) {
          const t = l ? (v - followThreshold) / v : 1;
          ((n += m * t * 0.022), (r += h * t * 0.022));
        }
        const p = l ? 0.15 : 0.995;
        if (((n *= p), (r *= p), (e += n), (a += r), l && null !== i)) {
          const t = i - e,
            n = o - a;
          let r = Math.atan2(n, t) * (180 / Math.PI) + 90 - s;
          for (; r > 180; ) r -= 360;
          for (; r < -180; ) r += 360;
          s += 0.25 * r;
        }
        const f = Math.max(0, Math.min(1, (e + 150) / 80));
        ((t.style.opacity = f),
          (t.style.transform = `translate(${e}px, ${a}px) rotate(${s}deg)`),
          requestAnimationFrame(d));
      }));
    const d = t.querySelector(".starry-cohete-fondo");
    const cohetteTop = t.querySelector(".starry-cohete-top");
    if (d) {
      ((d.style.transition =
        "transform 0.18s cubic-bezier(0.4,0,0.2,1), filter 0.18s ease"),
        (t.style.pointerEvents = "auto"));
      let e = !1;
      t.addEventListener("click", () => {
        ((e = !e),
          e
            ? ((d.style.transform = "translate(1px, 0px)"),
              (d.style.filter =
                "drop-shadow(0 2px 10px rgba(255, 159, 154, 0.59))"),
              cohetteTop && (cohetteTop.src = "parallax/cohete_on.png"),
              (() => {
                const snd = new Audio("audio/light_on.mp3");
                snd.volume = 1;
                snd.play().catch(() => {});
              })())
            : ((d.style.transform = "translate(0, 0)"),
              (d.style.filter = "none"),
              cohetteTop && (cohetteTop.src = "parallax/cohete.png"),
              (() => {
                const snd = new Audio("audio/light_off.mp3");
                snd.volume = 1;
                snd.play().catch(() => {});
              })()));
      });
    }
    (!(function () {
      const t = document.querySelector(".starry-p9");
      if (!t) return;
      const e = new Audio("audio/satelite.mp3");
      ((e.preload = "auto"),
        (e.volume = 0.25),
        t.addEventListener("click", () => {
          window.innerWidth <= 600 ||
            ((e.currentTime = 0), e.play().catch(() => {}));
        }));
    })(),
      (function () {
        const t = document.querySelector(".starry-p9");
        if (!t) return;
        const e = new Audio("audio/satelite.mp3");
        ((e.preload = "auto"),
          (e.volume = 0.05),
          t.addEventListener("click", () => {
            window.innerWidth <= 600 ||
              (t.classList.remove("spinning"),
              t.offsetWidth,
              t.classList.add("spinning"),
              t.addEventListener(
                "animationend",
                () => t.classList.remove("spinning"),
                { once: !0 },
              ),
              (e.currentTime = 0),
              e.play().catch(() => {}));
          }));
        const bassGroup = document.getElementById("group-256");
        let bassTarget = bassGroup
          ? bassGroup.querySelector('.gl img[src="parallax/parallax 2.png"]') ||
            bassGroup.querySelector(".gl img")
          : null;
        if (bassTarget && bassGroup) {
          bassGroup.style.pointerEvents = "auto";
          bassTarget.parentElement.style.pointerEvents = "auto";
          bassTarget.style.pointerEvents = "auto";
          bassTarget.style.cursor = "default";
          const bassAudio = new Audio("audio/bass.mp3");
          bassAudio.preload = "auto";
          bassAudio.volume = 0.6;
          bassGroup.addEventListener("click", (ev) => {
            if (ev.target === bassTarget || bassTarget.contains(ev.target)) {
              bassAudio.currentTime = 0;
              bassAudio.play().catch(() => {});
            }
          });
        }
      })());
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
      const NOTE_COLORS = ["#1a2d4a8f", "#f19380"];
      const noteColor = NOTE_COLORS[i % 2];
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

  document.addEventListener(
    "click",
    function (ev) {
      const r = bassTarget.getBoundingClientRect();
      if (
        ev.clientX >= r.left &&
        ev.clientX <= r.right &&
        ev.clientY >= r.top &&
        ev.clientY <= r.bottom
      ) {
        bassAudio.currentTime = 0;
        bassAudio.play().catch(() => {});
        spawnNotes(ev.clientX, ev.clientY);
      }
    },
    true,
  );
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
