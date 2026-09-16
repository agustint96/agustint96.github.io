/* Brunomunari.js: la "cara con ojos que siguen" de enderiva (comando
 * /brunomunari de commands.js), portada como mini-app suelta del SISOP.
 * Es un ítem real dentro de la carpeta "tmp" (type:"app" en
 * sisop-user-files.js, ver data/published-desktop.json) y, al abrirlo,
 * flota sobre el escritorio -sin ventana w98, del mismo tamaño (120x120)
 * que tenía en enderiva y arrastrable con el mismo patrón que el Atendedor
 * (ver .assistant en sisop-atendedor.js). Dura abierta hasta que se cierra
 * con su «✕»: no se cierra sola.
 */
(function () {
  "use strict";

  var S = 120;

  // Coordenadas originales del dibujo (grilla 500x500 + techos + boca).
  var GRID_LINES = [
    [50, 50, 50, 450],
    [150, 50, 150, 450],
    [250, 50, 250, 450],
    [350, 50, 350, 450],
    [450, 50, 450, 450],
    [50, 50, 450, 50],
    [50, 150, 450, 150],
    [50, 250, 450, 250],
    [50, 350, 450, 350],
    [50, 450, 450, 450],
    [50, 150, 150, 50],
    [150, 50, 250, 150],
    [250, 150, 350, 50],
    [350, 50, 450, 150],
    [150, 250, 250, 350],
    [250, 350, 350, 250],
    [150, 400, 350, 400],
  ];

  var ICON_SCALE = 32 / 500;
  function n(v) {
    return (v * ICON_SCALE).toFixed(2);
  }
  var FACE_ICON =
    '<svg viewBox="0 0 32 32" aria-hidden="true">' +
    '<rect x="' +
    n(50) +
    '" y="' +
    n(50) +
    '" width="' +
    n(400) +
    '" height="' +
    n(400) +
    '" fill="#dcdcdc" stroke="#1b1b18" stroke-width="1"/>' +
    '<g fill="none" stroke="#1b1b18" stroke-width="1" stroke-linecap="round">' +
    GRID_LINES.map(function (l) {
      return (
        '<line x1="' +
        n(l[0]) +
        '" y1="' +
        n(l[1]) +
        '" x2="' +
        n(l[2]) +
        '" y2="' +
        n(l[3]) +
        '"/>'
      );
    }).join("") +
    "</g>" +
    '<circle cx="' +
    n(150) +
    '" cy="' +
    n(160) +
    '" r="' +
    n(15) +
    '" fill="#1b1b18"/>' +
    '<circle cx="' +
    n(350) +
    '" cy="' +
    n(160) +
    '" r="' +
    n(15) +
    '" fill="#1b1b18"/>' +
    "</svg>";

  // ---- Grafo de la grilla, para el "giro con gravedad" del segundo clic
  // (ver startSpin() más abajo) ----
  // Nodos = intersecciones de la lattice 5x5 (50..450 cada 100) + las 6
  // diagonales de techo/mentón, que ya caen justo sobre nodos de la
  // lattice. La "boca" ([150,400]-[350,400]) queda afuera: no se cruza con
  // nada más, así que las bolitas nunca la pisan.
  var LATTICE = [50, 150, 250, 350, 450];
  var nodes = [];
  var nodeIndex = {};
  function nid(x, y) {
    return x + "," + y;
  }
  function addNode(x, y) {
    var key = nid(x, y);
    if (nodeIndex[key] != null) return nodeIndex[key];
    nodeIndex[key] = nodes.length;
    nodes.push({ x: x, y: y });
    return nodeIndex[key];
  }
  LATTICE.forEach(function (y) {
    LATTICE.forEach(function (x) {
      addNode(x, y);
    });
  });
  var edges = [];
  function addEdge(x1, y1, x2, y2) {
    edges.push({ a: nodeIndex[nid(x1, y1)], b: nodeIndex[nid(x2, y2)] });
  }
  LATTICE.forEach(function (y) {
    for (var i = 0; i < LATTICE.length - 1; i++)
      addEdge(LATTICE[i], y, LATTICE[i + 1], y);
  });
  LATTICE.forEach(function (x) {
    for (var j = 0; j < LATTICE.length - 1; j++)
      addEdge(x, LATTICE[j], x, LATTICE[j + 1]);
  });
  [
    [50, 150, 150, 50],
    [150, 50, 250, 150],
    [250, 150, 350, 50],
    [350, 50, 450, 150],
    [150, 250, 250, 350],
    [250, 350, 350, 250],
  ].forEach(function (l) {
    addEdge(l[0], l[1], l[2], l[3]);
  });
  var adjacency = nodes.map(function () {
    return [];
  });
  edges.forEach(function (e) {
    var A = nodes[e.a],
      B = nodes[e.b];
    var dx = B.x - A.x,
      dy = B.y - A.y,
      len = Math.hypot(dx, dy);
    adjacency[e.a].push({ to: e.b, ux: dx / len, uy: dy / len, len: len });
    adjacency[e.b].push({ to: e.a, ux: -dx / len, uy: -dy / len, len: len });
  });
  var homeNodeLeft = nodeIndex[nid(150, 150)];
  var homeNodeRight = nodeIndex[nid(350, 150)];

  // Dijkstra: el camino más corto de vuelta a casa "por las líneas".
  function shortestPath(fromNode, toNode) {
    var dist = nodes.map(function () {
      return Infinity;
    });
    var prev = nodes.map(function () {
      return -1;
    });
    var visited = nodes.map(function () {
      return false;
    });
    dist[fromNode] = 0;
    for (var iter = 0; iter < nodes.length; iter++) {
      var u = -1,
        best = Infinity;
      for (var i = 0; i < nodes.length; i++) {
        if (!visited[i] && dist[i] < best) {
          best = dist[i];
          u = i;
        }
      }
      if (u === -1 || u === toNode) break;
      visited[u] = true;
      adjacency[u].forEach(function (adj) {
        var alt = dist[u] + adj.len;
        if (alt < dist[adj.to]) {
          dist[adj.to] = alt;
          prev[adj.to] = u;
        }
      });
    }
    var path = [];
    var cur = toNode;
    while (cur !== -1) {
      path.unshift(cur);
      if (cur === fromNode) break;
      cur = prev[cur];
    }
    return path;
  }

  var leftBall = { node: homeNodeLeft, edge: null, t: 0, x: 150, y: 150 };
  var rightBall = { node: homeNodeRight, edge: null, t: 0, x: 350, y: 150 };

  // "idle" (sigue al mouse/touch) | "spin" (segundo clic: gira y las bolitas
  // caen por gravedad) | "return" (vuelven a casa por las líneas)
  var mode = "idle";
  var nextClickSpins = false;
  var spinT0 = 0;
  var SPIN_DURATION = 1800;
  var ROLL_SPEED = 340; // unidades lógicas (de 500) por segundo

  function rollStep(ball, gx, gy, dt) {
    if (ball.edge) {
      var A = nodes[ball.edge.a],
        B = nodes[ball.edge.b];
      var dx = B.x - A.x,
        dy = B.y - A.y;
      var len = Math.hypot(dx, dy);
      var downhill = (dx / len) * gx + (dy / len) * gy;
      ball.t += (downhill * ROLL_SPEED * dt) / len;
      if (ball.t >= 1) {
        ball.node = ball.edge.b;
        ball.edge = null;
        ball.t = 0;
      } else if (ball.t <= 0) {
        ball.node = ball.edge.a;
        ball.edge = null;
        ball.t = 0;
      } else {
        ball.x = A.x + dx * ball.t;
        ball.y = A.y + dy * ball.t;
        return;
      }
    }
    // Parada en un nodo (recién llegó, o ya estaba): sigue de largo si hay
    // una arista cuesta abajo con la gravedad actual.
    var node = nodes[ball.node];
    ball.x = node.x;
    ball.y = node.y;
    var adj = adjacency[ball.node];
    var chosen = null,
      bestDot = 0.05; // umbral chico para que no tiemble en el filo
    for (var i = 0; i < adj.length; i++) {
      var dot = adj[i].ux * gx + adj[i].uy * gy;
      if (dot > bestDot) {
        bestDot = dot;
        chosen = adj[i];
      }
    }
    if (chosen) {
      ball.edge = { a: ball.node, b: chosen.to };
      ball.t = 0;
      ball.node = null;
    }
  }
  function snapBallToNode(ball) {
    if (!ball.edge) return;
    var chosen = ball.t < 0.5 ? ball.edge.a : ball.edge.b;
    ball.node = chosen;
    ball.edge = null;
    ball.t = 0;
    ball.x = nodes[chosen].x;
    ball.y = nodes[chosen].y;
  }

  var RETURN_SPEED = 340;
  var DROP_DURATION = 150; // el último tramito: de la línea (y=150) al lugar de reposo (y=160)
  function startDrop(ball) {
    ball.dropping = true;
    ball.dropT0 = performance.now();
    ball.dropFromY = ball.y;
    ball.finished = false;
  }
  function setupReturnPath(ball, targetNode) {
    ball.path = shortestPath(ball.node, targetNode);
    ball.pathIdx = 0;
    ball.segT0 = performance.now();
    ball.dropping = false;
    ball.finished = false;
    if (ball.path.length < 2) startDrop(ball);
  }
  function beginReturn() {
    mode = "return";
    snapBallToNode(leftBall);
    snapBallToNode(rightBall);
    setupReturnPath(leftBall, homeNodeLeft);
    setupReturnPath(rightBall, homeNodeRight);
  }
  function updateReturnBall(ball) {
    if (ball.finished) return;
    if (ball.dropping) {
      var t = Math.min((performance.now() - ball.dropT0) / DROP_DURATION, 1);
      ball.y = ball.dropFromY + (160 - ball.dropFromY) * t;
      if (t >= 1) ball.finished = true;
      return;
    }
    var A = nodes[ball.path[ball.pathIdx]],
      B = nodes[ball.path[ball.pathIdx + 1]];
    var dx = B.x - A.x,
      dy = B.y - A.y;
    var len = Math.hypot(dx, dy);
    var dur = (len / RETURN_SPEED) * 1000;
    var t2 = Math.min((performance.now() - ball.segT0) / dur, 1);
    ball.x = A.x + dx * t2;
    ball.y = A.y + dy * t2;
    if (t2 >= 1) {
      ball.pathIdx++;
      if (ball.pathIdx >= ball.path.length - 1) startDrop(ball);
      else ball.segT0 = performance.now();
    }
  }
  function updateReturn() {
    updateReturnBall(leftBall);
    updateReturnBall(rightBall);
    if (leftBall.finished && rightBall.finished) mode = "idle";
  }
  function startSpin() {
    hideBubbleNow();
    mode = "spin";
    spinT0 = performance.now();
    [
      [leftBall, homeNodeLeft],
      [rightBall, homeNodeRight],
    ].forEach(function (pair) {
      var ball = pair[0],
        home = pair[1];
      ball.node = home;
      ball.edge = null;
      ball.t = 0;
      ball.x = nodes[home].x;
      ball.y = nodes[home].y;
    });
  }

  var el = null,
    spinWrap = null,
    canvas = null,
    ctx = null,
    closeBtn = null,
    bubble = null,
    bubbleTail = null;
  var bubbleFadeTimer = null;

  // En pantallas chicas (o si el widget está arrastrado cerca del borde de
  // arriba) no siempre entra el globo por encima: si no hay lugar, se
  // muestra debajo en su lugar, con la colita mirando para el otro lado.
  function positionBubble() {
    var rect = el.getBoundingClientRect();
    var flip = rect.top < 100;
    if (flip) {
      bubble.style.top = "calc(100% + 12px)";
      bubble.style.bottom = "auto";
      bubbleTail.style.top = "-9px";
      bubbleTail.style.bottom = "auto";
      bubbleTail.style.borderRight = "none";
      bubbleTail.style.borderBottom = "none";
      bubbleTail.style.borderLeft = "2px solid #000";
      bubbleTail.style.borderTop = "2px solid #000";
    } else {
      bubble.style.bottom = "calc(100% + 12px)";
      bubble.style.top = "auto";
      bubbleTail.style.bottom = "-9px";
      bubbleTail.style.top = "auto";
      bubbleTail.style.borderLeft = "none";
      bubbleTail.style.borderTop = "none";
      bubbleTail.style.borderRight = "2px solid #000";
      bubbleTail.style.borderBottom = "2px solid #000";
    }

    // No se deja recortar por el borde de la pantalla en celulares chicos:
    // si el globo (más ancho que el widget) se pasaría de largo, se corrige
    // con un empujoncito horizontal en vez de dejarlo tapado.
    bubble.style.transform = "translateX(-50%)";
    var br = bubble.getBoundingClientRect();
    var margin = 8;
    var shift = 0;
    if (br.right > window.innerWidth - margin)
      shift = window.innerWidth - margin - br.right;
    else if (br.left < margin) shift = margin - br.left;
    if (shift) bubble.style.transform = "translateX(calc(-50% + " + shift + "px))";
  }
  function showBubble() {
    if (!bubble) return;
    positionBubble();
    if (bubbleFadeTimer) clearTimeout(bubbleFadeTimer);
    bubble.style.pointerEvents = "auto";
    bubble.style.opacity = "1";
    bubbleFadeTimer = setTimeout(function () {
      bubble.style.opacity = "0";
      bubble.style.pointerEvents = "none";
      bubbleFadeTimer = null;
    }, 2600);
  }
  function hideBubbleNow() {
    if (bubbleFadeTimer) {
      clearTimeout(bubbleFadeTimer);
      bubbleFadeTimer = null;
    }
    if (bubble) {
      bubble.style.opacity = "0";
      bubble.style.pointerEvents = "none";
    }
  }
  var running = false;
  var cleanupTracking = null;
  var isMobileDevice = "ontouchstart" in window || window.innerWidth < 768;
  var mouseRelY = S / 2;
  var mouseAbsX = window.innerWidth / 2;

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
      "-webkit-user-select:none;user-select:none;-webkit-tap-highlight-color:transparent;";

    // Todo lo que gira en el segundo clic (canvas + botón de cerrar +
    // sombra) vive en este wrapper: así rota como una sola pieza rígida
    // alrededor del centro del widget, sombra incluida, en vez de sólo el
    // dibujo de adentro. El globo de diálogo (bubble, más abajo) queda
    // afuera a propósito -no gira-.
    spinWrap = document.createElement("div");
    spinWrap.style.cssText =
      "position:absolute;inset:0;box-shadow:0 6px 18px rgba(0,0,0,.45);";
    el.appendChild(spinWrap);

    canvas = document.createElement("canvas");
    canvas.width = S;
    canvas.height = S;
    canvas.style.cssText = "display:block;width:100%;height:100%;";
    spinWrap.appendChild(canvas);
    ctx = canvas.getContext("2d");

    closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Cerrar");
    closeBtn.textContent = "✕";
    closeBtn.style.cssText =
      "position:absolute;top:2px;right:4px;z-index:2;width:20px;height:20px;padding:0;" +
      "display:grid;place-items:center;font:700 13px/1 'DM Mono',monospace;color:#fff;" +
      "background:none;border:0;cursor:pointer;opacity:0;transition:opacity .12s ease;" +
      "text-shadow:0 1px 2px rgba(0,0,0,.85),0 0 3px rgba(0,0,0,.7);";
    spinWrap.appendChild(closeBtn);

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

    // ---- globo de diálogo geométrico (firma): un clic lo muestra, se
    // queda un ratito y se apaga solo con un fade ----
    bubble = document.createElement("div");
    bubble.style.cssText =
      "position:absolute;left:50%;transform:translateX(-50%);" +
      "min-width:132px;max-width:calc(100vw - 24px);padding:10px 14px 12px;" +
      "background:#dcdcdc;border:2px solid #000;" +
      "box-shadow:0 6px 18px rgba(0,0,0,.45);text-align:center;" +
      "font-family:Geometrica,sans-serif;color:#000;cursor:default;" +
      "z-index:3;-webkit-user-select:none;user-select:none;" +
      "opacity:0;pointer-events:none;transition:opacity .6s ease;";

    var lineTitle = document.createElement("div");
    lineTitle.textContent = "BRUNO MUNARI";
    lineTitle.style.cssText =
      "font-size:15px;font-weight:400;letter-spacing:.04em;line-height:1.3;white-space:nowrap;";
    var lineSub = document.createElement("div");
    lineSub.textContent = "Creado con p5.js.";
    lineSub.style.cssText =
      "font-family:'Proggy Square',monospace;font-size:14px;letter-spacing:.01em;" +
      "margin-top:5px;white-space:nowrap;";
    var lineYear = document.createElement("div");
    lineYear.textContent = "2024";
    lineYear.style.cssText =
      "font-family:'Proggy Square',monospace;font-size:14px;letter-spacing:.01em;margin-top:2px;";
    bubbleTail = document.createElement("div");
    bubbleTail.style.cssText =
      "position:absolute;left:50%;bottom:-9px;width:14px;height:14px;" +
      "transform:translateX(-50%) rotate(45deg);background:#dcdcdc;" +
      "border-right:2px solid #000;border-bottom:2px solid #000;";

    bubble.appendChild(lineTitle);
    bubble.appendChild(lineSub);
    bubble.appendChild(lineYear);
    bubble.appendChild(bubbleTail);
    el.appendChild(bubble);

    // ---- arrastre (mismo patrón que .assistant en sisop-atendedor.js) ----
    var drag = false,
      movido = false,
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

    // El click también se escucha en `el` (no en `canvas`): el
    // setPointerCapture de arriba redirige el click posterior al elemento
    // que lo capturó (ver el mismo comentario en sisop-penales.js).
    el.addEventListener("click", function (e) {
      if (e.target === closeBtn) return;
      if (movido) {
        movido = false;
        return;
      }
      // Primer clic: el globo de firma. Segundo clic: el giro con las
      // bolitas cayendo por gravedad (ver startSpin()). Se turnan, y no
      // hacen caso mientras ya está girando o volviendo a su lugar.
      if (mode !== "idle") return;
      if (nextClickSpins) startSpin();
      else showBubble();
      nextClickSpins = !nextClickSpins;
    });

    document.body.appendChild(el);
  }

  function startTracking() {
    if (cleanupTracking) return;
    if (!isMobileDevice) {
      var onMove = function (e) {
        var rect = canvas.getBoundingClientRect();
        var relY = e.clientY - rect.top;
        mouseRelY = Math.max(0, Math.min(S, relY));
        mouseAbsX = e.clientX;
      };
      document.addEventListener("mousemove", onMove);
      cleanupTracking = function () {
        document.removeEventListener("mousemove", onMove);
      };
    } else {
      var initialScrollY = window.scrollY;
      var maxScrollRange = 300;
      var onScroll = function () {
        var delta = window.scrollY - initialScrollY;
        var clamped = Math.max(
          -maxScrollRange,
          Math.min(maxScrollRange, delta),
        );
        mouseRelY = ((clamped + maxScrollRange) / (2 * maxScrollRange)) * S;
        mouseAbsX = window.innerWidth / 2;
      };
      window.addEventListener("scroll", onScroll);
      cleanupTracking = function () {
        window.removeEventListener("scroll", onScroll);
      };
    }
  }
  function stopTracking() {
    if (cleanupTracking) {
      cleanupTracking();
      cleanupTracking = null;
    }
  }

  function line(x1, y1, x2, y2, sc) {
    ctx.beginPath();
    ctx.moveTo(x1 * sc, y1 * sc);
    ctx.lineTo(x2 * sc, y2 * sc);
    ctx.stroke();
  }

  var DEAD_ZONE = 0.15;
  function eyePos(colX, clampedY, clampedX) {
    if (clampedY < 150) return { x: colX, y: clampedY };
    if (Math.abs(clampedX) < DEAD_ZONE) return { x: colX, y: clampedY };
    var tX = Math.min(1, (Math.abs(clampedX) - DEAD_ZONE) / (1 - DEAD_ZONE));
    var goingLeft = clampedX < 0;
    var xMin = colX === 150 ? 70 : 260;
    var xMax = colX === 150 ? 240 : 430;
    var ex = colX + tX * ((goingLeft ? xMin : xMax) - colX);
    return { x: ex, y: 150 };
  }

  function draw() {
    if (!running) return;
    var sc = S / 500;
    var theta = 0;
    var leftX, leftY, rightX, rightY;

    if (mode === "spin") {
      var p = Math.min((performance.now() - spinT0) / SPIN_DURATION, 1);
      var eased = p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
      theta = eased * Math.PI * 2;
      // Gravedad del mundo (0,1, "para abajo") vista desde el espacio local
      // de la cara, que va girando: rota con -theta.
      var gx = Math.sin(theta),
        gy = Math.cos(theta);
      rollStep(leftBall, gx, gy, 1 / 60);
      rollStep(rightBall, gx, gy, 1 / 60);
      if (p >= 1) beginReturn();
      leftX = leftBall.x;
      leftY = leftBall.y;
      rightX = rightBall.x;
      rightY = rightBall.y;
    } else if (mode === "return") {
      updateReturn();
      leftX = leftBall.x;
      leftY = leftBall.y;
      rightX = rightBall.x;
      rightY = rightBall.y;
    } else {
      var t = mouseRelY / S;
      var clampedY = 70 + t * (250 - 70);
      var rect = canvas.getBoundingClientRect();
      var panelCenterX = rect.left + rect.width / 2;
      var rawX = rect.width
        ? (mouseAbsX - panelCenterX) / (rect.width * 4)
        : 0;
      var clampedX = Math.max(-1, Math.min(1, rawX));
      var leftEye = eyePos(150, clampedY, clampedX);
      var rightEye = eyePos(350, clampedY, clampedX);
      leftX = leftEye.x;
      leftY = leftEye.y;
      rightX = rightEye.x;
      rightY = rightEye.y;
    }

    // El giro es del widget entero (canvas + botón de cerrar), no sólo del
    // dibujo de adentro: se hace con un transform CSS en spinWrap, así se
    // ve como una sola tarjeta rígida girando. El canvas se dibuja siempre
    // "derecho"; lo único que cambia acá adentro es dónde están las
    // bolitas (la física ya está calculada en el espacio sin rotar).
    spinWrap.style.transform = theta ? "rotate(" + theta + "rad)" : "";

    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = "#dcdcdc";
    ctx.fillRect(0, 0, S, S);
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 5 * sc;
    ctx.lineCap = "round";
    GRID_LINES.forEach(function (l) {
      line(l[0], l[1], l[2], l[3], sc);
    });

    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(leftX * sc, leftY * sc, 15 * sc, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightX * sc, rightY * sc, 15 * sc, 0, Math.PI * 2);
    ctx.fill();

    requestAnimationFrame(draw);
  }

  function openWidget() {
    ensureEl();
    if (!el.style.left) colocar(60, 90);
    el.hidden = false;
    if (!running) {
      running = true;
      startTracking();
      requestAnimationFrame(draw);
    }
  }
  function closeWidget() {
    running = false;
    stopTracking();
    if (el) el.hidden = true;
    hideBubbleNow();
    mode = "idle";
    nextClickSpins = false;
  }

  window.sisopApps = window.sisopApps || {};
  window.sisopApps.brunomunari = {
    title: "Brunomunari.js",
    iconHtml: FACE_ICON,
    open: openWidget,
    close: closeWidget,
  };
})();
