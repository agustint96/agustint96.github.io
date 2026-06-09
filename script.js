const nav = document.getElementById("main-nav");
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
  targetX = 2 * (t.clientX / window.innerWidth - 0.5);
}),
  window.addEventListener("deviceorientation", (t) => {
    null !== t.gamma && (targetX = Math.max(-1, Math.min(1, t.gamma / 30)));
  }),
  tick());
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
    addStars(Math.floor(4 * Math.random()) + 1);
  }),
  starryBg.addEventListener("touchstart", () => addStars(2), { passive: !0 }),
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
    (document.addEventListener("mousemove", (t) => {
      ((i = t.clientX), (o = t.clientY), (l = !0));
    }),
      document.addEventListener("mouseleave", () => {
        l = !1;
      }),
      requestAnimationFrame(function d() {
        let c, u;
        l && null !== i ? ((c = i), (u = o)) : ((c = e), (u = a));
        const m = c - e,
          h = u - a,
          v = Math.sqrt(m * m + h * h);
        if (v > (l ? 220 : 0) + 1) {
          const t = l ? (v - 220) / v : 1;
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
                "drop-shadow(0 2px 10px rgba(255, 159, 154, 0.59))"))
            : ((d.style.transform = "translate(0, 0)"),
              (d.style.filter = "none")));
      });
    }
    (!(function () {
      const t = document.querySelector(".starry-p9");
      if (!t) return;
      const e = new Audio("audio/satelite.mp3");
      ((e.preload = "auto"),
        (e.volume = 0.3),
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
          (e.volume = 0.3),
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
      })());
  })());
