/* Penales.js: el mini-juego arcade de enderiva.github.io (comando /penales
 * de commands.js: cancha CRT en pixel, scanlines, arquero que se tira al
 * azar, 5 tiros y 3 goles para ganar), portado como mini-app suelta del
 * SISOP. Es un ítem real dentro de la carpeta "tmp" (type:"app" en
 * sisop-user-files.js, ver data/published-desktop.json) y, al abrirlo,
 * flota sobre el escritorio -sin ventana w98, del mismo tamaño (120x120)
 * que tenía en enderiva y arrastrable con el mismo patrón que el Atendedor
 * (ver .assistant en sisop-atendedor.js). A diferencia de Brunomunari, se
 * cierra solo al terminar la tanda (ganes o pierdas).
 */
(function () {
  "use strict";

  var S = 120;

  var PENALES_ICON =
    '<svg viewBox="0 0 100 100" aria-hidden="true">' +
    '<path d="M10 6 H78 L94 22 V90 a4 4 0 0 1 -4 4 H10 a4 4 0 0 1 -4 -4 V10 a4 4 0 0 1 4 -4 Z" fill="#f7f5ef" stroke="#1b1b18" stroke-width="3.2" stroke-linejoin="round"/>' +
    '<path d="M78 6 L94 22 H82 a4 4 0 0 1 -4 -4 Z" fill="#c9c5bb" stroke="#1b1b18" stroke-width="2.4" stroke-linejoin="round"/>' +
    '<circle cx="44" cy="50" r="19" fill="#ffffff" stroke="#1b1b18" stroke-width="3"/>' +
    '<circle cx="44" cy="50" r="6" fill="#1b1b18"/>' +
    '<circle cx="44" cy="39" r="4" fill="#1b1b18"/>' +
    '<circle cx="54.5" cy="46.6" r="4" fill="#1b1b18"/>' +
    '<circle cx="50.5" cy="58.9" r="4" fill="#1b1b18"/>' +
    '<circle cx="37.5" cy="58.9" r="4" fill="#1b1b18"/>' +
    '<circle cx="33.5" cy="46.6" r="4" fill="#1b1b18"/>' +
    '<text x="50" y="82" font-family="\'DM Mono\', monospace" font-weight="700" font-size="18" fill="#1b1b18" text-anchor="middle">EXE</text>' +
    "</svg>";

  var el = null,
    canvas = null,
    cx = null,
    closeBtn = null;
  var gameStarted = false;
  var teardown = null;

  function colocar(x, y) {
    var maxX = Math.max(2, window.innerWidth - S - 2);
    var maxY = Math.max(2, window.innerHeight - S - 2);
    x = Math.max(2, Math.min(x, maxX));
    y = Math.max(2, Math.min(y, maxY));
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.style.right = "auto";
    el.style.bottom = "auto";
  }

  function ensureEl() {
    if (el) return;

    el = document.createElement("div");
    el.className = "sisop-mini";
    el.style.cssText =
      "position:fixed;width:" +
      S +
      "px;height:" +
      S +
      "px;z-index:44;cursor:grab;touch-action:none;" +
      "-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;" +
      "box-shadow:0 6px 18px rgba(0,0,0,.45);";

    canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    canvas.style.cssText =
      "display:block;width:100%;height:100%;background:#1a1a3e;cursor:pointer;";
    el.appendChild(canvas);
    cx = canvas.getContext("2d");

    closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Cerrar");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText =
      "position:absolute;top:2px;right:4px;z-index:2;width:20px;height:20px;padding:0;" +
      "display:grid;place-items:center;font:700 13px/1 'DM Mono',monospace;color:#fff;" +
      "background:none;border:0;cursor:pointer;opacity:0;transition:opacity .12s ease;" +
      "text-shadow:0 1px 2px rgba(0,0,0,.85),0 0 3px rgba(0,0,0,.7);";
    el.appendChild(closeBtn);

    el.addEventListener("mouseenter", function () {
      closeBtn.style.opacity = "1";
    });
    el.addEventListener("mouseleave", function () {
      closeBtn.style.opacity = "0";
    });
    closeBtn.addEventListener("focus", function () {
      closeBtn.style.opacity = "1";
    });
    closeBtn.addEventListener("blur", function () {
      closeBtn.style.opacity = "0";
    });
    closeBtn.addEventListener("click", function (e) {
      e.stopPropagation();
      closeWidget();
    });

    // ---- arrastre (mismo patrón que .assistant en sisop-atendedor.js) ----
    // `movido` también sirve para que un arrastre no dispare un tiro: el
    // handler de clic del juego lo chequea antes de patear.
    var drag = false,
      sx = 0,
      sy = 0,
      ox = 0,
      oy = 0;
    el.addEventListener("pointerdown", function (e) {
      if (e.target === closeBtn) return;
      drag = true;
      movido = false;
      var r = el.getBoundingClientRect();
      ox = r.left;
      oy = r.top;
      sx = e.clientX;
      sy = e.clientY;
      el.style.cursor = "grabbing";
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    el.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - sx,
        dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) movido = true;
      colocar(ox + dx, oy + dy);
    });
    function soltar(e) {
      if (!drag) return;
      drag = false;
      el.style.cursor = "grab";
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (_) {}
    }
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);

    document.body.appendChild(el);
  }

  // true mientras el puntero se movió más de la tolerancia desde el
  // pointerdown: así un arrastre no se confunde con un tiro al arco.
  var movido = false;

  function startGame() {
    var W = S,
      H = S;

    var SKY = "#1a1a3e";
    var GRASS = "#2d8a3e";
    var GRASS_DARK = "#256e32";
    var GOAL_WHITE = "#ffffff";
    var GOAL_SHADOW = "#cfcfcf";
    var NET = "rgba(255,255,255,0.35)";
    var BALL_WHITE = "#ffffff";
    var BALL_BLACK = "#222222";
    var KEEPER_SHIRT = "#ff2e63";
    var KEEPER_SKIN = "#f2c29a";
    var KEEPER_SHORTS = "#1a1330";
    var SCANLINE = "rgba(0,0,0,0.12)";

    var score = 0;
    var shotNum = 1;
    var MAX_SHOTS = 5;
    var canShoot = true;
    var results = [];
    var gameOver = false;
    var animId = null;
    var alive = true;

    var goal = { x: W * 0.09, y: H * 0.18, w: W * 0.82, h: H * 0.3 };
    var ballStart = { x: W / 2, y: H * 0.87 };
    var ball = { x: ballStart.x, y: ballStart.y, r: W * 0.04 };

    var KEEPER_HOME_X = W / 2;
    var KEEPER_HOME_Y = goal.y + goal.h - H * 0.06;
    var KW = W * 0.14,
      KH = H * 0.18;
    var keeper = {
      x: KEEPER_HOME_X,
      y: KEEPER_HOME_Y,
      w: KW,
      h: KH,
      diving: false,
      diveProgress: 0,
      startX: KEEPER_HOME_X,
      startY: KEEPER_HOME_Y,
      endX: KEEPER_HOME_X,
      endY: KEEPER_HOME_Y,
      diveDir: 0,
      reaching: false,
    };

    function getZones() {
      var cols = 3,
        rows = 2;
      var zw = goal.w / cols,
        zh = goal.h / rows;
      return Array.from({ length: rows * cols }, function (_, i) {
        var r = Math.floor(i / cols),
          c = i % cols;
        return {
          x: goal.x + c * zw,
          y: goal.y + r * zh,
          w: zw,
          h: zh,
          col: c,
          row: r,
        };
      });
    }
    var ZONES = getZones();

    function zoneAt(px, py) {
      return (
        ZONES.find(
          (z) => px >= z.x && px < z.x + z.w && py >= z.y && py < z.y + z.h,
        ) || null
      );
    }

    function rect(x, y, w, h, color) {
      cx.fillStyle = color;
      cx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
    }

    function drawField() {
      rect(0, 0, W, goal.y + goal.h + H * 0.07, SKY);
      cx.fillStyle = "#ffe93b";
      for (var i = 0; i < 10; i++) {
        var sx2 = (i * 47) % W,
          sy2 = (i * 23) % (goal.y - 2);
        cx.fillRect(sx2, sy2, 1, 1);
      }
      rect(
        0,
        goal.y + goal.h + H * 0.07,
        W,
        H - (goal.y + goal.h + H * 0.07),
        GRASS,
      );
      for (var j = 0; j < 8; j++) {
        if (j % 2 === 0)
          rect(
            j * (W / 8),
            goal.y + goal.h + H * 0.07,
            W / 8,
            H - (goal.y + goal.h + H * 0.07),
            GRASS_DARK,
          );
      }
      rect(W / 2 - 1, ballStart.y + 3, 2, 2, "#ffffff");
    }

    function drawGoal() {
      var postW = Math.max(2, W * 0.02);
      cx.strokeStyle = NET;
      cx.lineWidth = 0.5;
      for (var i = -goal.h; i < goal.w; i += 6) {
        cx.beginPath();
        cx.moveTo(goal.x + i, goal.y);
        cx.lineTo(goal.x + i + goal.h, goal.y + goal.h);
        cx.stroke();
      }
      for (var k = 0; k < goal.w + goal.h; k += 6) {
        cx.beginPath();
        cx.moveTo(goal.x + k, goal.y);
        cx.lineTo(goal.x + k - goal.h, goal.y + goal.h);
        cx.stroke();
      }
      rect(goal.x - postW, goal.y - postW, postW, goal.h + postW, GOAL_SHADOW);
      rect(goal.x, goal.y - postW, goal.w, postW, GOAL_SHADOW);
      rect(goal.x + goal.w, goal.y - postW, postW, goal.h + postW, GOAL_SHADOW);
      rect(
        goal.x - postW,
        goal.y - postW * 1.5,
        postW + goal.w + postW,
        postW,
        GOAL_WHITE,
      );
      rect(
        goal.x - postW,
        goal.y - postW * 1.5,
        postW,
        goal.h + postW * 1.5,
        GOAL_WHITE,
      );
      rect(
        goal.x + goal.w,
        goal.y - postW * 1.5,
        postW,
        goal.h + postW * 1.5,
        GOAL_WHITE,
      );
    }

    function drawKeeper() {
      var w = keeper.w,
        h = keeper.h;
      var kx = keeper.startX,
        ky = keeper.startY,
        rotate = 0;
      if (keeper.diving) {
        var p = keeper.diveProgress;
        kx = keeper.startX + (keeper.endX - keeper.startX) * p;
        ky = keeper.startY + (keeper.endY - keeper.startY) * p;
        rotate = keeper.diveDir * p * 0.9;
      }
      cx.save();
      cx.translate(kx, ky);
      cx.rotate(rotate);
      rect(-w / 2, h * 0.18, w, h * 0.47, KEEPER_SHORTS);
      rect(-w / 2, -h / 2, w, h / 2 + h * 0.18, KEEPER_SHIRT);
      var p2 = keeper.diving ? keeper.diveProgress : 0;
      if (keeper.reaching) {
        var armH = h * 0.24 + p2 * h * 0.35;
        rect(
          -w / 2 - w * 0.08,
          -h / 2 - armH,
          w * 0.23,
          armH + h * 0.12,
          KEEPER_SHIRT,
        );
        rect(
          w / 2 - w * 0.15,
          -h / 2 - armH,
          w * 0.23,
          armH + h * 0.12,
          KEEPER_SHIRT,
        );
      } else if (keeper.diving) {
        rect(
          -w / 2 - w * 0.38,
          -h / 2 - h * 0.12,
          w * 0.38,
          h * 0.24,
          KEEPER_SHIRT,
        );
        rect(w / 2, -h / 2 - h * 0.12, w * 0.38, h * 0.24, KEEPER_SHIRT);
      } else {
        rect(
          -w / 2 - w * 0.23,
          -h / 2 + h * 0.06,
          w * 0.23,
          h * 0.41,
          KEEPER_SHIRT,
        );
        rect(w / 2, -h / 2 + h * 0.06, w * 0.23, h * 0.41, KEEPER_SHIRT);
      }
      rect(-w * 0.27, -h / 2 - h * 0.35, w * 0.54, h * 0.35, KEEPER_SKIN);
      rect(-w * 0.27, -h / 2 - h * 0.41, w * 0.54, h * 0.12, "#222222");
      rect(-w / 2 + w * 0.08, h / 2 - h * 0.24, w * 0.3, h * 0.35, KEEPER_SKIN);
      rect(w / 2 - w * 0.38, h / 2 - h * 0.24, w * 0.3, h * 0.35, KEEPER_SKIN);
      cx.restore();
    }

    function drawBall() {
      cx.save();
      cx.translate(ball.x, ball.y);
      cx.fillStyle = "rgba(0,0,0,0.25)";
      cx.beginPath();
      cx.ellipse(0, ball.r + 1, ball.r * 1.1, ball.r * 0.4, 0, 0, Math.PI * 2);
      cx.fill();
      cx.fillStyle = BALL_WHITE;
      cx.beginPath();
      cx.arc(0, 0, ball.r, 0, Math.PI * 2);
      cx.fill();
      cx.fillStyle = BALL_BLACK;
      cx.beginPath();
      cx.arc(-ball.r * 0.17, -ball.r * 0.17, ball.r * 0.27, 0, Math.PI * 2);
      cx.fill();
      cx.beginPath();
      cx.arc(ball.r * 0.33, ball.r * 0.33, ball.r * 0.2, 0, Math.PI * 2);
      cx.fill();
      cx.restore();
    }

    function drawScanlines() {
      cx.fillStyle = SCANLINE;
      for (var y = 0; y < H; y += 3) cx.fillRect(0, y, W, 1);
    }

    function drawScore() {
      var pxs = Math.round(W * 0.09);
      var gap = Math.round(W * 0.03);
      var totalW = MAX_SHOTS * pxs + (MAX_SHOTS - 1) * gap;
      var startX = Math.round((W - totalW) / 2);
      var startY = Math.round(H * 0.02);
      for (var i = 0; i < MAX_SHOTS; i++) {
        var x = startX + i * (pxs + gap);
        cx.fillStyle =
          i < results.length
            ? results[i] === "gol"
              ? "#39ff14"
              : "#ff2e63"
            : "#2a2040";
        cx.fillRect(x, startY, pxs, pxs);
        cx.fillStyle =
          i < results.length
            ? results[i] === "gol"
              ? "#1a7a00"
              : "#8a0020"
            : "#4ecdc4";
        cx.fillRect(x, startY, pxs, 1);
        cx.fillRect(x, startY, 1, pxs);
        cx.fillRect(x + pxs - 1, startY, 1, pxs);
        cx.fillRect(x, startY + pxs - 1, pxs, 1);
      }
    }

    function render() {
      drawField();
      drawGoal();
      drawKeeper();
      drawBall();
      drawScanlines();
      drawScore();
    }

    var currentTargetZone = null;
    function animateShot(targetZone) {
      currentTargetZone = targetZone;
      canShoot = false;
      var ballTarget = {
        x: targetZone.x + targetZone.w / 2,
        y: targetZone.y + targetZone.h / 2,
      };
      var startX = ball.x,
        startY = ball.y;
      var duration = 500;
      var startTime = performance.now();

      var diveCol = Math.floor(Math.random() * 3);
      var diveZone = ZONES.find(
        (z) =>
          z.col === diveCol &&
          (diveCol === 1 ? z.row === targetZone.row : z.row === 1),
      );
      keeper.startX = KEEPER_HOME_X;
      keeper.startY = KEEPER_HOME_Y;

      if (diveZone.col === 1) {
        keeper.endX = KEEPER_HOME_X;
        if (targetZone.row === 0) {
          keeper.endY = Math.max(goal.y + diveZone.h / 2, goal.y + H * 0.05);
          keeper.reaching = true;
        } else {
          keeper.endY = KEEPER_HOME_Y;
          keeper.reaching = false;
        }
      } else {
        keeper.endX = diveZone.x + diveZone.w / 2;
        keeper.endY = KEEPER_HOME_Y;
        keeper.reaching = false;
      }

      keeper.diving = true;
      keeper.diveDir = diveZone.col < 1 ? -1 : diveZone.col > 1 ? 1 : 0;
      keeper.diveProgress = 0;

      function step(now) {
        if (!alive) return;
        var t = Math.min((now - startTime) / duration, 1);
        var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        ball.x = startX + (ballTarget.x - startX) * ease;
        ball.y = startY + (ballTarget.y - startY) * ease;
        keeper.diveProgress = Math.min(t * 1.25, 1);
        render();
        if (t < 1) {
          animId = requestAnimationFrame(step);
        } else {
          resolveShot(diveZone);
        }
      }
      animId = requestAnimationFrame(step);
    }

    function resolveShot(diveZone) {
      var tz = currentTargetZone;
      var saved;
      if (diveZone.col === 1) {
        saved = tz.col === 1 && diveZone.row === tz.row;
      } else {
        saved = diveZone.col === tz.col;
      }

      results.push(saved ? "atajada" : "gol");
      if (!saved) score++;
      render();
      setTimeout(function () {
        if (!alive) return;
        nextShot();
      }, 1000);
    }

    function nextShot() {
      shotNum++;
      if (shotNum > MAX_SHOTS) {
        endGame();
        return;
      }
      resetBallAndKeeper();
    }

    function resetBallAndKeeper() {
      ball.x = ballStart.x;
      ball.y = ballStart.y;
      Object.assign(keeper, {
        startX: KEEPER_HOME_X,
        startY: KEEPER_HOME_Y,
        endX: KEEPER_HOME_X,
        endY: KEEPER_HOME_Y,
        diving: false,
        diveProgress: 0,
        diveDir: 0,
        reaching: false,
      });
      canShoot = true;
      render();
    }

    function endGame() {
      gameOver = true;
      var won = score >= 3;
      setTimeout(function () {
        if (!alive) return;
        render();
        cx.fillStyle = "rgba(15,10,30,0.72)";
        cx.fillRect(0, H * 0.3, W, H * 0.38);
        cx.fillStyle = won ? "#39ff14" : "#ff2e63";
        cx.font = "bold " + Math.round(W * 0.13) + 'px "Courier New", monospace';
        cx.textAlign = "center";
        cx.textBaseline = "middle";
        cx.fillText(won ? "Ganaste!" : "Perdiste!", W / 2, H * 0.44);
        cx.fillStyle = "#ffe93b";
        cx.font = Math.round(W * 0.09) + 'px "Courier New", monospace';
        cx.fillText(score + "/" + MAX_SHOTS, W / 2, H * 0.58);
      }, 100);

      // A diferencia de Brunomunari, Penales no dura hasta que lo cierres:
      // termina la tanda y se cierra solo.
      setTimeout(function () {
        closeWidget();
      }, 2500);
    }

    function getCoordsFromEvent(e) {
      var r = canvas.getBoundingClientRect();
      var scaleX = S / r.width,
        scaleY = S / r.height;
      if (e.touches || e.changedTouches) {
        var t = e.touches[0] || e.changedTouches[0];
        return {
          x: (t.clientX - r.left) * scaleX,
          y: (t.clientY - r.top) * scaleY,
        };
      }
      return {
        x: (e.clientX - r.left) * scaleX,
        y: (e.clientY - r.top) * scaleY,
      };
    }

    function handleClick(e) {
      if (movido) {
        // fue un arrastre del widget, no un tiro
        movido = false;
        return;
      }
      if (!canShoot || gameOver) return;
      e.stopPropagation();
      var c = getCoordsFromEvent(e);
      var zone = zoneAt(c.x, c.y);
      if (zone) animateShot(zone);
    }

    function handleTouch(e) {
      if (movido) {
        movido = false;
        return;
      }
      if (!canShoot || gameOver) return;
      e.preventDefault();
      e.stopPropagation();
      var c = getCoordsFromEvent(e);
      var zone = zoneAt(c.x, c.y);
      if (zone) animateShot(zone);
    }

    // Se escucha en `el` (el contenedor arrastrable) y no en `canvas`: el
    // setPointerCapture del arrastre redirige el click/touchend posterior
    // al elemento que lo capturó, así que en `canvas` nunca llegaría.
    // `getCoordsFromEvent` igual calcula bien porque usa clientX/clientY,
    // no el target del evento.
    el.addEventListener("click", handleClick);
    el.addEventListener("touchend", handleTouch, { passive: false });

    render();

    teardown = function () {
      alive = false;
      if (animId) cancelAnimationFrame(animId);
      el.removeEventListener("click", handleClick);
      el.removeEventListener("touchend", handleTouch);
    };
  }

  function openWidget() {
    ensureEl();
    if (!el.style.left) colocar(190, 90);
    el.hidden = false;
    if (!gameStarted) {
      gameStarted = true;
      startGame();
    }
  }
  function closeWidget() {
    if (teardown) {
      teardown();
      teardown = null;
    }
    gameStarted = false;
    if (el) el.hidden = true;
  }

  window.sisopApps = window.sisopApps || {};
  window.sisopApps.penales = {
    title: "Penales.js",
    iconHtml: PENALES_ICON,
    previewImg: "ico/penales-preview.webp",
    open: openWidget,
    close: closeWidget,
  };
})();
