// ─── Nav scroll (sin cohete-logo) ───
const nav = document.getElementById("main-nav");

window.addEventListener("scroll", () => {
  const scrolled = window.scrollY > 60;
  nav.classList.toggle("scrolled", scrolled);

  if (scrolled) {
    setTimeout(() => nav.classList.add("nav-compact"), 350);
  } else {
    nav.classList.remove("nav-compact");
  }
});

// ─── Partículas burst (canvas global, útil para futuros elementos) ───
const burstCanvas = document.createElement("canvas");
burstCanvas.style.cssText =
  "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;";
document.body.appendChild(burstCanvas);
const bctx = burstCanvas.getContext("2d");

function resizeBurst() {
  burstCanvas.width = window.innerWidth;
  burstCanvas.height = window.innerHeight;
}
resizeBurst();
window.addEventListener("resize", resizeBurst);

let burstParticles = [];

function drawBurst() {
  bctx.clearRect(0, 0, burstCanvas.width, burstCanvas.height);
  burstParticles = burstParticles.filter((p) => p.alpha > 0.01);
  for (const p of burstParticles) {
    bctx.globalAlpha = p.alpha;
    bctx.fillStyle = "#f19280";
    bctx.beginPath();
    bctx.arc(Math.round(p.x), Math.round(p.y), p.radius, 0, Math.PI * 2);
    bctx.fill();
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.06;
    p.alpha -= 0.018;
  }
  bctx.globalAlpha = 1;
  requestAnimationFrame(drawBurst);
}
drawBurst();

// ─── Parallax ───
const group256 = document.getElementById("group-256");
const p3el = document.getElementById("p3");
const p7el = document.getElementById("p7");
const p8el = document.getElementById("p8");
const DEPTH_256 = 0.0005,
  DEPTH_P3 = 0.0005,
  DEPTH_P7 = 0.003,
  DEPTH_P8 = 0.0008,
  MAX_PX = 80;
let targetX = 0,
  currentX = 0;
const lerp = (a, b, t) => a + (b - a) * t;
document.addEventListener("mousemove", (e) => {
  targetX = (e.clientX / window.innerWidth - 0.5) * 2;
});
window.addEventListener("deviceorientation", (e) => {
  if (e.gamma !== null) targetX = Math.max(-1, Math.min(1, e.gamma / 30));
});
function tick() {
  currentX = lerp(currentX, targetX, 0.04);
  if (group256)
    group256.style.transform = `translateX(${currentX * MAX_PX * DEPTH_256 * 100}px)`;
  if (p3el)
    p3el.style.transform = `translateX(${-currentX * MAX_PX * DEPTH_P3 * 100}px)`;
  if (p7el)
    p7el.style.transform = `translateX(${currentX * MAX_PX * DEPTH_P7 * 100}px)`;
  if (p8el)
    p8el.style.transform = `translateX(${-currentX * MAX_PX * DEPTH_P8 * 100}px)`;
  requestAnimationFrame(tick);
}
tick();

// ─── Estrellas ───
const starCanvas = document.getElementById("star-canvas");
const ctx = starCanvas.getContext("2d");
const starryBg = starCanvas.parentElement;
let stars = [];
const starRadius = 1.5;

function resizeCanvas() {
  const w = starryBg.offsetWidth || window.innerWidth;
  const h = starryBg.offsetHeight || 300;
  if (starCanvas.width !== w || starCanvas.height !== h) {
    starCanvas.width = w;
    starCanvas.height = h;
  }
}
resizeCanvas();
new ResizeObserver(resizeCanvas).observe(starryBg);
window.addEventListener("resize", resizeCanvas);

function addStars(count, alpha) {
  const w = starCanvas.width || window.innerWidth;
  const h = starCanvas.height || 300;
  for (let i = 0; i < count; i++) {
    stars.push({
      x: Math.random() * w,
      y: Math.random() * h,
      alpha: alpha ?? 0.9,
      vy: -(Math.random() * 0.3 + 0.008),
    });
  }
}

starryBg.addEventListener("mousemove", () =>
  addStars(Math.floor(Math.random() * 4) + 1),
);
starryBg.addEventListener("touchmove", () => {
  addStars(Math.floor(Math.random() * 4) + 1);
});
starryBg.addEventListener("touchstart", () => addStars(2), { passive: true });
setInterval(() => addStars(Math.floor(Math.random() * 3) + 2, 0.75), 300);

function drawStars() {
  ctx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  stars = stars.filter((s) => s.alpha > 0.01);
  for (const s of stars) {
    ctx.globalAlpha = s.alpha;
    ctx.fillStyle = "#f19280";
    ctx.beginPath();
    ctx.arc(Math.round(s.x), Math.round(s.y), starRadius, 0, Math.PI * 2);
    ctx.fill();
    s.y += s.vy;
    s.alpha -= 0.006;
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(drawStars);
}
drawStars();

// ─── Cohete starry: persigue el mouse, flota cuando se va ───
(function () {
  const pair = document.getElementById("starry-cohete-pair");
  if (!pair) return;

  const MIN_DIST = 220;
  const STRENGTH = 0.022;
  const FRICTION = 0.15;

  let cx = -150,
    cy = 180;
  let vx = 0,
    vy = 0;
  let angle = 90;
  let mouseX = null,
    mouseY = null;
  let mouseInside = false;

  // Usamos coordenadas de viewport (el cohete es fixed)
  document.addEventListener("mousemove", (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    mouseInside = true;
  });

  document.addEventListener("mouseleave", () => {
    mouseInside = false;
  });

  function animate() {
    let tx, ty;
    if (mouseInside && mouseX !== null) {
      tx = mouseX;
      ty = mouseY;
    } else {
      tx = cx;
      ty = cy;
    }

    const dx = tx - cx;
    const dy = ty - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const effectiveDist = mouseInside ? MIN_DIST : 0;

    if (dist > effectiveDist + 1) {
      const factor = mouseInside ? (dist - MIN_DIST) / dist : 1;
      vx += dx * factor * STRENGTH;
      vy += dy * factor * STRENGTH;
    }

    const currentFriction = mouseInside ? FRICTION : 0.995;
    vx *= currentFriction;
    vy *= currentFriction;
    cx += vx;
    cy += vy;

    if (mouseInside && mouseX !== null) {
      const ddx = mouseX - cx;
      const ddy = mouseY - cy;
      const target = Math.atan2(ddy, ddx) * (180 / Math.PI) + 90;
      let diff = target - angle;
      while (diff > 180) diff -= 360;
      while (diff < -180) diff += 360;
      angle += diff * 0.25;
    }

    const opacity = Math.max(0, Math.min(1, (cx + 150) / 80));
    pair.style.opacity = opacity;
    pair.style.transform = `translate(${cx}px, ${cy}px) rotate(${angle}deg)`;

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);

  // ─── Click: despegar cohete_fondo del cohete_top (toggle) ───
  const fondoImg = pair.querySelector(".starry-cohete-fondo");
  if (fondoImg) {
    fondoImg.style.transition =
      "transform 0.18s cubic-bezier(0.4,0,0.2,1), filter 0.18s ease";
    pair.style.pointerEvents = "auto";
    let separated = false;
    pair.addEventListener("click", () => {
      separated = !separated;
      if (separated) {
        fondoImg.style.transform = "translate(1px, 0px)";

        fondoImg.style.filter =
          "drop-shadow(0 2px 10px rgba(255, 159, 154, 0.59))";
      } else {
        fondoImg.style.transform = "translate(0, 0)";
        fondoImg.style.filter = "none";
      }
    });
  }

  // ─── Parallax 9: click reproduce audio en pantallas grandes ───
  (function () {
    const p9 = document.querySelector(".starry-p9");
    if (!p9) return;

    const audio = new Audio("audio/satelite.mp3");
    audio.preload = "auto";
    audio.volume = 0.3;

    p9.addEventListener("click", () => {
      if (window.innerWidth <= 600) return;

      // Si ya está sonando, reiniciarlo desde el principio
      audio.currentTime = 0;
      audio.play().catch(() => {});
    });
  })();

  // ─── Parallax 9: click reproduce audio en pantallas grandes ───
  (function () {
    const p9 = document.querySelector(".starry-p9");
    if (!p9) return;

    const audio = new Audio("audio/satelite.mp3");
    audio.preload = "auto";
    audio.volume = 0.3;

    p9.addEventListener("click", () => {
      if (window.innerWidth <= 600) return;

      // Spin
      p9.classList.remove("spinning");
      void p9.offsetWidth; // fuerza reflow para reiniciar la animación
      p9.classList.add("spinning");
      p9.addEventListener(
        "animationend",
        () => p9.classList.remove("spinning"),
        { once: true },
      );

      // Audio
      audio.currentTime = 0;
      audio.play().catch(() => {});
    });
  })();
})();
