/* Paint: clon del Paint de Windows 98 para el SISOP. Se registra como app
 * "custom" vía window.sisopWin (igual que las carpetas de sisop-user-files.js
 * o la app «Grabadora»), reusando toda la mecánica de ventanas ya hecha en
 * sisop-sqlconsole.js (arrastre, minimizar, maximizar, taskbar, z-order).
 * Todo el dibujo vive en un <canvas>; un segundo <canvas> superpuesto (sin
 * eventos propios) sirve de "vista previa" mientras arrastrás una forma o
 * una selección, y recién se planta en el canvas de verdad al soltar.
 */
(function () {
  "use strict";
  if (!window.sisopWin) return;

  function svg(inner) {
    return '<svg viewBox="0 0 20 20" aria-hidden="true">' + inner + "</svg>";
  }

  var APP_ICON =
    '<svg viewBox="0 0 32 32" aria-hidden="true">' +
    '<path d="M16 4c7.2 0 12 4.9 12 11 0 4-2.6 6-6 6h-2.3c-1 0-1.7.8-1.7 1.7 0 .6.3 1.1.6 1.5.4.5.6 1 .6 1.6 0 1.6-1.5 2.2-3.2 2.2C9 28 4 23 4 16 4 9.4 9.4 4 16 4z" fill="#e4e1d8" stroke="#3a3a34" stroke-width="1.2"/>' +
    '<circle cx="10.5" cy="13" r="1.8" fill="#e0463c"/>' +
    '<circle cx="16.5" cy="9.5" r="1.8" fill="#f0c419"/>' +
    '<circle cx="21.3" cy="13.2" r="1.8" fill="#3d7dca"/>' +
    '<circle cx="11.2" cy="19" r="1.8" fill="#4c9a53"/>' +
    '<path d="M19.5 22.5l5.5-5.5" stroke="#6f5d13" stroke-width="1.6" stroke-linecap="round"/></svg>';

  var TOOL_LIST = [
    {
      id: "select",
      label: "Seleccionar",
      icon: svg(
        '<rect x="3" y="3" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-dasharray="2.4 1.8"/>',
      ),
    },
    {
      id: "eraser",
      label: "Borrador",
      icon: svg(
        '<g transform="rotate(-20 10 10)"><rect x="4" y="7" width="12" height="7" rx="1" fill="#f2b9c0" stroke="currentColor" stroke-width="1.1"/><rect x="4" y="7" width="6" height="7" fill="#ffffff" stroke="currentColor" stroke-width="1.1"/></g>',
      ),
    },
    {
      id: "fill",
      label: "Relleno",
      icon: svg(
        '<path d="M5 9 12 2l6 6-7 7z" fill="#d8d5cb" stroke="currentColor" stroke-width="1.1"/><path d="M4 12c0 2.2 1.8 4 4 4s4-1.6 4-3.6c0-1.6-1.6-2.9-2.6-4.1L5 12z" fill="#3d7dca" stroke="currentColor" stroke-width="1"/>',
      ),
    },
    {
      id: "eyedropper",
      label: "Selector de color",
      icon: svg(
        '<path d="M13 3l4 4-2.2 2.2-4-4z" fill="#c9c5bb" stroke="currentColor" stroke-width="1.1"/><path d="M12.3 5.7l-8 8V17h3.3l8-8z" fill="none" stroke="currentColor" stroke-width="1.1"/>',
      ),
    },
    {
      id: "zoom",
      label: "Lupa",
      icon: svg(
        '<circle cx="8.3" cy="8.3" r="5" fill="none" stroke="currentColor" stroke-width="1.4"/><line x1="12.1" y1="12.1" x2="17" y2="17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
      ),
    },
    {
      id: "pencil",
      label: "Lápiz",
      icon: svg(
        '<path d="M4 16l1-4 9-9 3 3-9 9z" fill="#f6e06a" stroke="currentColor" stroke-width="1.1"/><path d="M14 3l3 3" stroke="currentColor" stroke-width="1.1"/><path d="M4 16l1-4 3 3z" fill="#8a7a4a"/>',
      ),
    },
    {
      id: "brush",
      label: "Pincel",
      icon: svg(
        '<path d="M14 3c1.6 0 3 1.4 3 3 0 1.2-2.7 3.3-5 4.8L9.6 8.4C11.1 6.2 12.6 3 14 3z" fill="#a94f3d" stroke="currentColor" stroke-width="1"/><path d="M9.4 8.6l2 2-4 5.4a2 2 0 0 1-2.8 0 2 2 0 0 1 0-2.8z" fill="#e6e2d6" stroke="currentColor" stroke-width="1"/>',
      ),
    },
    {
      id: "airbrush",
      label: "Aerógrafo",
      icon: svg(
        '<path d="M4 16l4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><rect x="7" y="7" width="7" height="5" rx="1.5" transform="rotate(-45 10.5 9.5)" fill="#c9c5bb" stroke="currentColor" stroke-width="1"/><circle cx="15" cy="4" r="0.8" fill="currentColor"/><circle cx="17.2" cy="6.4" r="0.6" fill="currentColor"/><circle cx="16" cy="2.4" r="0.5" fill="currentColor"/>',
      ),
    },
    {
      id: "text",
      label: "Texto",
      icon: svg(
        '<path d="M6 16l4-12 4 12M7.3 12h5.4" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>',
      ),
    },
    {
      id: "line",
      label: "Línea",
      icon: svg(
        '<line x1="3" y1="16" x2="17" y2="4" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
      ),
    },
    {
      id: "rect",
      label: "Rectángulo",
      icon: svg(
        '<rect x="3.5" y="5" width="13" height="10" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      ),
    },
    {
      id: "polygon",
      label: "Polígono",
      icon: svg(
        '<path d="M4 13l2-7 6-2 4 4-2 6-6 2z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>',
      ),
    },
    {
      id: "ellipse",
      label: "Elipse",
      icon: svg(
        '<ellipse cx="10" cy="10" rx="7" ry="5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      ),
    },
    {
      id: "roundrect",
      label: "Rectángulo redondeado",
      icon: svg(
        '<rect x="3.5" y="5" width="13" height="10" rx="3.5" fill="none" stroke="currentColor" stroke-width="1.5"/>',
      ),
    },
  ];

  var PALETTE = [
    [
      "#000000",
      "#404040",
      "#7f7f7f",
      "#800000",
      "#a0522d",
      "#808000",
      "#008000",
      "#008080",
      "#000080",
      "#4b0082",
      "#800080",
      "#b5651d",
      "#2f4467",
      "#585858",
    ],
    [
      "#ffffff",
      "#c0c0c0",
      "#d9d9d9",
      "#ff0000",
      "#ffa500",
      "#ffff00",
      "#00ff00",
      "#00ffff",
      "#0000ff",
      "#8a2be2",
      "#ff00ff",
      "#f4a460",
      "#87ceeb",
      "#f0ece4",
    ],
  ];

  var SHAPE_TOOLS = ["line", "rect", "polygon", "ellipse", "roundrect"];
  var FILL_SHAPE_TOOLS = ["rect", "polygon", "ellipse", "roundrect"];
  var WIDTHS = [1, 2, 3, 5, 8];

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function render(bd, win) {
    var root = document.createElement("div");
    root.className = "paint-root";
    root.tabIndex = -1;
    root.innerHTML =
      '<div class="menu-bar paint-menubar">' +
      '<button type="button" data-menu="archivo">Archivo</button>' +
      '<button type="button" data-menu="edicion">Edición</button>' +
      '<button type="button" data-menu="imagen">Imagen</button>' +
      '<button type="button" data-menu="colores">Colores</button>' +
      '<div class="dropdown" data-for="archivo" hidden>' +
      '<button type="button" data-act="new">Nuevo</button>' +
      '<button type="button" data-act="save">Guardar como imagen…</button>' +
      "<hr/>" +
      '<button type="button" data-act="close">Salir</button>' +
      "</div>" +
      '<div class="dropdown" data-for="edicion" hidden>' +
      '<button type="button" data-act="undo">Deshacer <span class="sh">Ctrl+Z</span></button>' +
      '<button type="button" data-act="redo">Rehacer <span class="sh">Ctrl+Y</span></button>' +
      "<hr/>" +
      '<button type="button" data-act="select-all">Seleccionar todo</button>' +
      '<button type="button" data-act="clear-selection">Borrar selección <span class="sh">Supr</span></button>' +
      "</div>" +
      '<div class="dropdown" data-for="imagen" hidden>' +
      '<button type="button" data-act="flip-h">Voltear horizontal</button>' +
      '<button type="button" data-act="flip-v">Voltear vertical</button>' +
      '<button type="button" data-act="rotate-l">Girar 90° izquierda</button>' +
      '<button type="button" data-act="rotate-r">Girar 90° derecha</button>' +
      "<hr/>" +
      '<button type="button" data-act="invert">Invertir colores</button>' +
      "<hr/>" +
      '<button type="button" data-act="attributes">Atributos…</button>' +
      '<button type="button" data-act="clear-image">Borrar imagen</button>' +
      "</div>" +
      '<div class="dropdown" data-for="colores" hidden>' +
      '<button type="button" data-act="edit-colors">Editar colores…</button>' +
      "</div>" +
      "</div>" +
      '<div class="paint-work">' +
      '<div class="paint-toolbox"></div>' +
      '<div class="paint-canvas-wrap">' +
      '<div class="paint-canvas-stage">' +
      '<canvas class="paint-canvas"></canvas>' +
      '<canvas class="paint-overlay"></canvas>' +
      '<div class="paint-resize-ghost"></div>' +
      '<div class="paint-resize-handle paint-resize-e" data-dir="e"></div>' +
      '<div class="paint-resize-handle paint-resize-s" data-dir="s"></div>' +
      '<div class="paint-resize-handle paint-resize-se" data-dir="se"></div>' +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="paint-palette">' +
      '<div class="paint-cur"><i class="bg"></i><i class="fg"></i></div>' +
      '<div class="paint-swatches"></div>' +
      "</div>" +
      '<div class="paint-status"><span class="paint-status-tool"></span><span class="paint-status-size"></span><span class="paint-status-pos"></span></div>';
    bd.appendChild(root);

    var menuBarEl = root.querySelector(".paint-menubar");
    var toolboxEl = root.querySelector(".paint-toolbox");
    var canvas = root.querySelector(".paint-canvas");
    var overlay = root.querySelector(".paint-overlay");
    var stage = root.querySelector(".paint-canvas-stage");
    var canvasWrap = root.querySelector(".paint-canvas-wrap");
    var resizeGhost = root.querySelector(".paint-resize-ghost");
    var swatchesEl = root.querySelector(".paint-swatches");
    var curEl = root.querySelector(".paint-cur");
    var statusTool = root.querySelector(".paint-status-tool");
    var statusSize = root.querySelector(".paint-status-size");
    var statusPos = root.querySelector(".paint-status-pos");
    var ctx = canvas.getContext("2d");
    var octx = overlay.getContext("2d");
    // Un <canvas> no es enfocable por defecto: sin esto, canvas.focus() en
    // onPointerDown no hace nada y los atajos de teclado (Ctrl+Z, Supr,
    // Escape) nunca llegan a dispararse.
    canvas.tabIndex = -1;
    canvas.style.outline = "none";

    var tool = "pencil";
    var primary = "#000000";
    var secondary = "#ffffff";
    var widthVal = 2;
    var fillMode = "stroke"; // stroke | strokefill | fill
    var zoom = 1;
    var history = [];
    var historyIndex = -1;
    var selection = null;
    var drawing = false;
    var movingSel = false;
    var selOffscreen = null;
    var selMoveOffset = null;
    var pendingSelPos = null;
    var polyPoints = null;
    var activeTextBox = null;
    var airbrushTimer = null;
    var activeColor = primary;
    var startPt = null;
    var lastPt = null;

    function setCanvasSize(w, h) {
      canvas.width = w;
      canvas.height = h;
      overlay.width = w;
      overlay.height = h;
      applyZoomStyle();
    }
    function applyZoomStyle() {
      var cw = canvas.width * zoom + "px";
      var ch = canvas.height * zoom + "px";
      canvas.style.width = cw;
      canvas.style.height = ch;
      overlay.style.width = cw;
      overlay.style.height = ch;
      canvas.classList.toggle("paint-zoomed", zoom > 1);
      overlay.classList.toggle("paint-zoomed", zoom > 1);
    }

    setCanvasSize(600, 400);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    function pushHistory() {
      history = history.slice(0, historyIndex + 1);
      history.push({
        w: canvas.width,
        h: canvas.height,
        data: ctx.getImageData(0, 0, canvas.width, canvas.height),
      });
      if (history.length > 20) history.shift();
      historyIndex = history.length - 1;
    }
    function restoreHistory(idx) {
      var snap = history[idx];
      if (!snap) return;
      canvas.width = snap.w;
      canvas.height = snap.h;
      overlay.width = snap.w;
      overlay.height = snap.h;
      applyZoomStyle();
      ctx.putImageData(snap.data, 0, 0);
      clearSelection();
    }
    function undo() {
      if (historyIndex > 0) {
        historyIndex--;
        restoreHistory(historyIndex);
      }
    }
    function redo() {
      if (historyIndex < history.length - 1) {
        historyIndex++;
        restoreHistory(historyIndex);
      }
    }
    pushHistory();

    function updateCurSwatch() {
      curEl.querySelector(".fg").style.background = primary;
      curEl.querySelector(".bg").style.background = secondary;
    }
    function setPrimary(c) {
      primary = c;
      updateCurSwatch();
    }
    function setSecondary(c) {
      secondary = c;
      updateCurSwatch();
    }
    updateCurSwatch();

    PALETTE.forEach(function (row) {
      row.forEach(function (c) {
        var b = document.createElement("button");
        b.type = "button";
        b.className = "paint-swatch";
        b.style.background = c;
        b.title = c;
        b.addEventListener("click", function () {
          setPrimary(c);
        });
        b.addEventListener("contextmenu", function (e) {
          e.preventDefault();
          setSecondary(c);
        });
        swatchesEl.appendChild(b);
      });
    });
    curEl.addEventListener("dblclick", openColorPicker);
    function openColorPicker() {
      var inp = document.createElement("input");
      inp.type = "color";
      inp.value = primary;
      inp.style.position = "fixed";
      inp.style.left = "-9999px";
      inp.addEventListener("input", function () {
        setPrimary(inp.value);
      });
      inp.addEventListener("change", function () {
        inp.remove();
      });
      document.body.appendChild(inp);
      inp.click();
    }

    var toolButtons = {};
    TOOL_LIST.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "paint-tool";
      b.title = t.label;
      b.innerHTML = t.icon;
      b.addEventListener("click", function () {
        selectTool(t.id);
      });
      toolboxEl.appendChild(b);
      toolButtons[t.id] = b;
    });
    var optionsEl = document.createElement("div");
    optionsEl.className = "paint-options";
    toolboxEl.appendChild(optionsEl);

    function selectTool(id) {
      commitTextBox();
      finishPolygon(false);
      clearSelection();
      tool = id;
      Object.keys(toolButtons).forEach(function (k) {
        toolButtons[k].classList.toggle("active", k === id);
      });
      var t = TOOL_LIST.filter(function (t) {
        return t.id === id;
      })[0];
      statusTool.textContent = t ? t.label : "";
      renderOptions();
      updateCursor();
    }

    function renderOptions() {
      optionsEl.innerHTML = "";
      var needsWidth =
        ["eraser", "brush", "airbrush"].indexOf(tool) !== -1 ||
        SHAPE_TOOLS.indexOf(tool) !== -1;
      var needsFillMode = FILL_SHAPE_TOOLS.indexOf(tool) !== -1;
      var needsZoom = tool === "zoom";
      if (needsWidth) {
        var sizes = tool === "eraser" ? [4, 6, 8, 12] : WIDTHS;
        sizes.forEach(function (s) {
          var b = document.createElement("button");
          b.type = "button";
          b.className = "paint-width-btn" + (s === widthVal ? " active" : "");
          var dotSize = clamp(s, 2, 10);
          b.innerHTML =
            '<span style="width:' +
            dotSize +
            "px;height:" +
            dotSize +
            'px"></span>';
          b.addEventListener("click", function () {
            widthVal = s;
            renderOptions();
          });
          optionsEl.appendChild(b);
        });
        statusSize.textContent = widthVal + "px";
      } else {
        statusSize.textContent = "";
      }
      if (needsFillMode) {
        [
          ["stroke", "○", "Solo contorno"],
          ["strokefill", "◐", "Contorno y relleno"],
          ["fill", "●", "Relleno sólido"],
        ].forEach(function (m) {
          var b = document.createElement("button");
          b.type = "button";
          b.className =
            "paint-fill-btn" + (m[0] === fillMode ? " active" : "");
          b.textContent = m[1];
          b.title = m[2];
          b.addEventListener("click", function () {
            fillMode = m[0];
            renderOptions();
          });
          optionsEl.appendChild(b);
        });
      }
      if (needsZoom) {
        [1, 2, 4].forEach(function (z) {
          var b = document.createElement("button");
          b.type = "button";
          b.className =
            "paint-width-btn paint-zoom-btn" + (z === zoom ? " active" : "");
          b.textContent = z * 100 + "%";
          b.addEventListener("click", function () {
            zoom = z;
            applyZoomStyle();
            renderOptions();
          });
          optionsEl.appendChild(b);
        });
      }
    }

    function updateCursor() {
      var map = {
        select: "crosshair",
        eyedropper: "crosshair",
        fill: "crosshair",
        zoom: "zoom-in",
        text: "text",
      };
      canvas.style.cursor = map[tool] || "crosshair";
    }

    function pointFromEvent(e) {
      var r = canvas.getBoundingClientRect();
      var sx = canvas.width / r.width;
      var sy = canvas.height / r.height;
      return {
        x: clamp(Math.round((e.clientX - r.left) * sx), 0, canvas.width),
        y: clamp(Math.round((e.clientY - r.top) * sy), 0, canvas.height),
      };
    }
    function pointInRect(p, r) {
      return (
        p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
      );
    }

    function drawSegment(a, b, color, width, cap) {
      if (a.x === b.x && a.y === b.y) {
        ctx.fillStyle = color;
        if (cap === "square") {
          ctx.fillRect(a.x - width / 2, a.y - width / 2, width, width);
        } else {
          ctx.beginPath();
          ctx.arc(a.x, a.y, width / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = cap || "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }

    function sprayAt(p, color) {
      ctx.fillStyle = color;
      var radius = Math.max(4, widthVal * 2);
      for (var i = 0; i < 10; i++) {
        var ang = Math.random() * Math.PI * 2;
        var rad = Math.random() * radius;
        ctx.fillRect(p.x + Math.cos(ang) * rad, p.y + Math.sin(ang) * rad, 1, 1);
      }
    }

    function hexToRgb(hex) {
      hex = hex.replace("#", "");
      if (hex.length === 3) {
        hex = hex
          .split("")
          .map(function (c) {
            return c + c;
          })
          .join("");
      }
      var n = parseInt(hex, 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    // Relleno con dos umbrales para no "atravesar" trazos finos:
    // - por debajo de FILL_HARD_TOLERANCE el píxel se considera parte del
    //   fondo de verdad: se reemplaza entero y el relleno sigue expandiéndose
    //   a través de él.
    // - entre el umbral duro y FILL_SOFT_TOLERANCE es zona de borde
    //   antialiaseado (mezcla de color de línea y fondo): se mezcla
    //   proporcionalmente hacia el color nuevo (más mezcla cuanto más cerca
    //   del fondo) pero NO se sigue expandiendo desde ahí. Si el relleno
    //   siguiera de largo en esta zona, en un trazo de lápiz de 1px con
    //   antialiasing débil el balde se "cuela" al otro lado de la línea y
    //   termina comiéndose pedazos enteros del trazo (quedaba punteado).
    // Un segundo click sobre el resto del halo (ya mezclado, más parecido al
    // color nuevo) sigue avanzando un poco más, como el balde de Photoshop.
    var FILL_HARD_TOLERANCE = 12;
    var FILL_SOFT_TOLERANCE = 120;
    function colorDist(d, i, r, g, b, a) {
      return Math.max(
        Math.abs(d[i] - r),
        Math.abs(d[i + 1] - g),
        Math.abs(d[i + 2] - b),
        Math.abs(d[i + 3] - a),
      );
    }
    function floodFill(x, y, hex) {
      var w = canvas.width,
        h = canvas.height;
      var img = ctx.getImageData(0, 0, w, h);
      var d = img.data;
      var i0 = (y * w + x) * 4;
      var tr = d[i0],
        tg = d[i0 + 1],
        tb = d[i0 + 2],
        ta = d[i0 + 3];
      var rgb = hexToRgb(hex);
      var fr = rgb[0],
        fg = rgb[1],
        fb = rgb[2];
      if (colorDist(d, i0, fr, fg, fb, 255) === 0) return;
      var visited = new Uint8Array(w * h);
      var stack = [x, y];
      while (stack.length) {
        var py = stack.pop();
        var px = stack.pop();
        if (px < 0 || py < 0 || px >= w || py >= h) continue;
        var vi = py * w + px;
        if (visited[vi]) continue;
        var i = vi * 4;
        var dist = colorDist(d, i, tr, tg, tb, ta);
        if (dist > FILL_SOFT_TOLERANCE) continue;
        visited[vi] = 1;
        if (dist <= FILL_HARD_TOLERANCE) {
          d[i] = fr;
          d[i + 1] = fg;
          d[i + 2] = fb;
          d[i + 3] = 255;
          stack.push(px + 1, py, px - 1, py, px, py + 1, px, py - 1);
        } else {
          var t =
            1 -
            (dist - FILL_HARD_TOLERANCE) /
              (FILL_SOFT_TOLERANCE - FILL_HARD_TOLERANCE);
          d[i] = Math.round(d[i] + (fr - d[i]) * t);
          d[i + 1] = Math.round(d[i + 1] + (fg - d[i + 1]) * t);
          d[i + 2] = Math.round(d[i + 2] + (fb - d[i + 2]) * t);
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    function clearSelection() {
      selection = null;
      movingSel = false;
      selOffscreen = null;
      octx.clearRect(0, 0, overlay.width, overlay.height);
    }
    function drawSelectionOutline(x, y, w, h) {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      octx.save();
      octx.strokeStyle = "#000";
      octx.lineWidth = 1;
      octx.setLineDash([4, 3]);
      octx.strokeRect(x + 0.5, y + 0.5, w, h);
      octx.restore();
    }

    function roundRectPath(c, x, y, w, h, r) {
      r = Math.max(0, Math.min(r, w / 2, h / 2));
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }
    function paintShape(targetCtx, a, b, kind) {
      var x = Math.min(a.x, b.x),
        y = Math.min(a.y, b.y);
      var w = Math.abs(b.x - a.x),
        h = Math.abs(b.y - a.y);
      targetCtx.lineWidth = widthVal;
      targetCtx.lineJoin = "round";
      targetCtx.strokeStyle = primary;
      targetCtx.fillStyle = fillMode === "fill" ? primary : secondary;
      targetCtx.beginPath();
      if (kind === "line") {
        targetCtx.moveTo(a.x, a.y);
        targetCtx.lineTo(b.x, b.y);
        targetCtx.stroke();
        return;
      }
      if (kind === "ellipse") {
        targetCtx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
      } else if (kind === "roundrect") {
        roundRectPath(targetCtx, x, y, w, h, Math.min(14, w / 4, h / 4));
      } else {
        targetCtx.rect(x, y, w, h);
      }
      if (fillMode !== "stroke") targetCtx.fill();
      if (fillMode !== "fill") targetCtx.stroke();
    }
    function constrainPoint(a, b, shift) {
      if (!shift) return b;
      if (tool === "line") {
        var dx = b.x - a.x,
          dy = b.y - a.y;
        var angle = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
        var dist = Math.sqrt(dx * dx + dy * dy);
        return { x: a.x + Math.cos(angle) * dist, y: a.y + Math.sin(angle) * dist };
      }
      var s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      return {
        x: a.x + s * (b.x < a.x ? -1 : 1),
        y: a.y + s * (b.y < a.y ? -1 : 1),
      };
    }

    function polygonPath(c, pts) {
      c.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
    }
    function previewPolygon(cursor) {
      octx.clearRect(0, 0, overlay.width, overlay.height);
      octx.lineWidth = widthVal;
      octx.lineJoin = "round";
      octx.strokeStyle = primary;
      octx.fillStyle = fillMode === "fill" ? primary : secondary;
      octx.beginPath();
      polygonPath(octx, polyPoints.concat([cursor]));
      octx.stroke();
    }
    function finishPolygon(commit) {
      if (!polyPoints || polyPoints.length < 2) {
        polyPoints = null;
        octx.clearRect(0, 0, overlay.width, overlay.height);
        return;
      }
      if (commit) {
        ctx.lineWidth = widthVal;
        ctx.lineJoin = "round";
        ctx.strokeStyle = primary;
        ctx.fillStyle = fillMode === "fill" ? primary : secondary;
        ctx.beginPath();
        polygonPath(ctx, polyPoints);
        ctx.closePath();
        if (fillMode !== "stroke") ctx.fill();
        if (fillMode !== "fill") ctx.stroke();
        pushHistory();
      }
      polyPoints = null;
      octx.clearRect(0, 0, overlay.width, overlay.height);
    }

    function commitTextBox() {
      if (!activeTextBox) return;
      var box = activeTextBox;
      activeTextBox = null;
      var text = box.el.innerText.replace(/\n+$/, "");
      box.el.remove();
      if (!text) return;
      ctx.fillStyle = primary;
      ctx.font = "16px Arial, sans-serif";
      ctx.textBaseline = "top";
      text.split("\n").forEach(function (line, i) {
        ctx.fillText(line, box.x, box.y + i * 19);
      });
      pushHistory();
    }

    function onPointerDown(e) {
      if (e.button !== 0 && e.button !== 2) return;
      canvas.focus();
      var p = pointFromEvent(e);
      var isRight = e.button === 2;

      if (tool === "text") {
        if (activeTextBox) commitTextBox();
        e.preventDefault();
        var box = document.createElement("div");
        box.className = "paint-text-box";
        box.contentEditable = "true";
        box.style.left = p.x * zoom + "px";
        box.style.top = p.y * zoom + "px";
        box.style.fontSize = 16 * zoom + "px";
        box.style.color = primary;
        stage.appendChild(box);
        activeTextBox = { el: box, x: p.x, y: p.y };
        setTimeout(function () {
          box.focus();
        }, 0);
        return;
      }
      if (tool === "eyedropper") {
        var d = ctx.getImageData(p.x, p.y, 1, 1).data;
        var hex =
          "#" +
          [d[0], d[1], d[2]]
            .map(function (v) {
              return ("0" + v.toString(16)).slice(-2);
            })
            .join("");
        if (isRight) setSecondary(hex);
        else setPrimary(hex);
        return;
      }
      if (tool === "fill") {
        floodFill(p.x, p.y, isRight ? secondary : primary);
        pushHistory();
        return;
      }
      if (tool === "zoom") {
        zoom = zoom >= 4 ? 1 : zoom * 2;
        applyZoomStyle();
        renderOptions();
        return;
      }
      if (tool === "polygon") {
        e.preventDefault();
        if (!polyPoints) polyPoints = [];
        polyPoints.push(p);
        previewPolygon(p);
        return;
      }
      if (tool === "select") {
        if (selection && pointInRect(p, selection) && !movingSel) {
          movingSel = true;
          selMoveOffset = { x: p.x - selection.x, y: p.y - selection.y };
          var off = document.createElement("canvas");
          off.width = selection.w;
          off.height = selection.h;
          off
            .getContext("2d")
            .putImageData(
              ctx.getImageData(selection.x, selection.y, selection.w, selection.h),
              0,
              0,
            );
          selOffscreen = off;
          ctx.fillStyle = secondary;
          ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
          octx.clearRect(0, 0, overlay.width, overlay.height);
          octx.drawImage(off, selection.x, selection.y);
        } else {
          clearSelection();
          drawing = true;
          startPt = p;
          lastPt = p;
        }
        canvas.setPointerCapture(e.pointerId);
        return;
      }

      e.preventDefault();
      drawing = true;
      startPt = p;
      lastPt = p;
      canvas.setPointerCapture(e.pointerId);
      activeColor = isRight ? secondary : primary;
      if (tool === "pencil") {
        drawSegment(p, p, activeColor, 1, "round");
      } else if (tool === "brush") {
        drawSegment(p, p, activeColor, widthVal, "round");
      } else if (tool === "eraser") {
        drawSegment(p, p, secondary, widthVal, "square");
      } else if (tool === "airbrush") {
        sprayAt(p, activeColor);
        airbrushTimer = setInterval(function () {
          if (!win.isConnected) {
            clearInterval(airbrushTimer);
            return;
          }
          sprayAt(lastPt, activeColor);
        }, 45);
      }
    }

    function onPointerMove(e) {
      var p = pointFromEvent(e);
      statusPos.textContent = p.x + ", " + p.y;

      if (tool === "polygon" && polyPoints && polyPoints.length) {
        previewPolygon(p);
        return;
      }
      if (movingSel) {
        var nx = p.x - selMoveOffset.x;
        var ny = p.y - selMoveOffset.y;
        octx.clearRect(0, 0, overlay.width, overlay.height);
        octx.drawImage(selOffscreen, nx, ny);
        pendingSelPos = { x: nx, y: ny };
        return;
      }
      if (!drawing) return;

      if (tool === "pencil" || tool === "brush" || tool === "eraser") {
        var w = tool === "pencil" ? 1 : widthVal;
        var cap = tool === "eraser" ? "square" : "round";
        var color = tool === "eraser" ? secondary : activeColor;
        drawSegment(lastPt, p, color, w, cap);
        lastPt = p;
        return;
      }
      if (tool === "airbrush") {
        lastPt = p;
        return;
      }
      if (tool === "select") {
        var x = Math.min(startPt.x, p.x),
          y = Math.min(startPt.y, p.y);
        var w2 = Math.abs(p.x - startPt.x),
          h2 = Math.abs(p.y - startPt.y);
        drawSelectionOutline(x, y, w2, h2);
        lastPt = p;
        return;
      }
      if (SHAPE_TOOLS.indexOf(tool) !== -1) {
        octx.clearRect(0, 0, overlay.width, overlay.height);
        paintShape(octx, startPt, constrainPoint(startPt, p, e.shiftKey), tool);
        lastPt = p;
      }
    }

    function onPointerUp(e) {
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch (_) {}
      if (movingSel) {
        var pos = pendingSelPos || { x: selection.x, y: selection.y };
        ctx.drawImage(selOffscreen, pos.x, pos.y);
        selection = {
          x: pos.x,
          y: pos.y,
          w: selOffscreen.width,
          h: selOffscreen.height,
        };
        drawSelectionOutline(selection.x, selection.y, selection.w, selection.h);
        movingSel = false;
        selOffscreen = null;
        pendingSelPos = null;
        pushHistory();
        return;
      }
      if (!drawing) return;
      drawing = false;

      if (tool === "airbrush") {
        clearInterval(airbrushTimer);
        airbrushTimer = null;
        pushHistory();
        return;
      }
      if (tool === "pencil" || tool === "brush" || tool === "eraser") {
        pushHistory();
        return;
      }
      if (tool === "select") {
        var p = lastPt || startPt;
        var x = Math.min(startPt.x, p.x),
          y = Math.min(startPt.y, p.y);
        var w = Math.abs(p.x - startPt.x),
          h = Math.abs(p.y - startPt.y);
        if (w > 1 && h > 1) {
          selection = { x: x, y: y, w: w, h: h };
          drawSelectionOutline(x, y, w, h);
        } else {
          octx.clearRect(0, 0, overlay.width, overlay.height);
        }
        return;
      }
      if (SHAPE_TOOLS.indexOf(tool) !== -1) {
        var p2 = constrainPoint(startPt, lastPt || startPt, e.shiftKey);
        octx.clearRect(0, 0, overlay.width, overlay.height);
        paintShape(ctx, startPt, p2, tool);
        pushHistory();
        return;
      }
    }

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
    });
    canvas.addEventListener("dblclick", function () {
      if (tool === "polygon") finishPolygon(true);
    });

    root.addEventListener("keydown", function (e) {
      if (activeTextBox) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if (e.key === "Delete" && selection) {
        handleMenuAction("clear-selection");
      } else if (e.key === "Escape") {
        clearSelection();
        finishPolygon(false);
      } else if (e.key === "Enter" && tool === "polygon") {
        finishPolygon(true);
      }
    });

    function closeDropdowns() {
      menuBarEl.querySelectorAll(".dropdown").forEach(function (d) {
        d.hidden = true;
      });
      menuBarEl.querySelectorAll("button[data-menu]").forEach(function (b) {
        b.classList.remove("open");
      });
    }
    menuBarEl.querySelectorAll("button[data-menu]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var name = btn.getAttribute("data-menu");
        var dd = menuBarEl.querySelector('.dropdown[data-for="' + name + '"]');
        var wasOpen = !dd.hidden;
        closeDropdowns();
        if (!wasOpen) {
          dd.hidden = false;
          btn.classList.add("open");
        }
      });
    });
    menuBarEl.querySelectorAll(".dropdown button[data-act]").forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        closeDropdowns();
        handleMenuAction(btn.getAttribute("data-act"));
      });
    });
    function onDocClick(e) {
      if (!win.isConnected) {
        document.removeEventListener("click", onDocClick);
        return;
      }
      if (!menuBarEl.contains(e.target)) closeDropdowns();
    }
    document.addEventListener("click", onDocClick);

    function flip(horizontal) {
      var tmp = document.createElement("canvas");
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      tmp.getContext("2d").drawImage(canvas, 0, 0);
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (horizontal) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      } else {
        ctx.translate(0, canvas.height);
        ctx.scale(1, -1);
      }
      ctx.drawImage(tmp, 0, 0);
      ctx.restore();
      pushHistory();
    }
    function rotate(deg) {
      var tmp = document.createElement("canvas");
      tmp.width = canvas.width;
      tmp.height = canvas.height;
      tmp.getContext("2d").drawImage(canvas, 0, 0);
      var newW = canvas.height,
        newH = canvas.width;
      setCanvasSize(newW, newH);
      ctx.save();
      ctx.translate(newW / 2, newH / 2);
      ctx.rotate((deg * Math.PI) / 180);
      ctx.drawImage(tmp, -tmp.width / 2, -tmp.height / 2);
      ctx.restore();
      pushHistory();
    }
    function invertColors() {
      var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      var d = img.data;
      for (var i = 0; i < d.length; i += 4) {
        d[i] = 255 - d[i];
        d[i + 1] = 255 - d[i + 1];
        d[i + 2] = 255 - d[i + 2];
      }
      ctx.putImageData(img, 0, 0);
      pushHistory();
    }
    function resizeCanvas(nw, nh) {
      var old = ctx.getImageData(0, 0, canvas.width, canvas.height);
      setCanvasSize(nw, nh);
      ctx.fillStyle = secondary;
      ctx.fillRect(0, 0, nw, nh);
      ctx.putImageData(old, 0, 0);
      pushHistory();
    }
    function maxCanvasSize() {
      return {
        w: Math.max(1, Math.floor((canvasWrap.clientWidth - 16) / zoom)),
        h: Math.max(1, Math.floor((canvasWrap.clientHeight - 16) / zoom)),
      };
    }
    function setupResizeHandles() {
      root.querySelectorAll(".paint-resize-handle").forEach(function (h) {
        h.addEventListener("pointerdown", function (e) {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          var dir = h.getAttribute("data-dir");
          var startX = e.clientX,
            startY = e.clientY;
          var startW = canvas.width,
            startH = canvas.height;
          var max = maxCanvasSize();
          var pendingW = startW,
            pendingH = startH;
          h.setPointerCapture(e.pointerId);
          resizeGhost.style.display = "block";
          function updateGhost() {
            resizeGhost.style.width = pendingW * zoom + "px";
            resizeGhost.style.height = pendingH * zoom + "px";
          }
          updateGhost();
          function onMove(ev) {
            var dx = (ev.clientX - startX) / zoom;
            var dy = (ev.clientY - startY) / zoom;
            if (dir.indexOf("e") !== -1) {
              pendingW = clamp(Math.round(startW + dx), 1, max.w);
            }
            if (dir.indexOf("s") !== -1) {
              pendingH = clamp(Math.round(startH + dy), 1, max.h);
            }
            updateGhost();
          }
          function onUp(ev) {
            onMove(ev);
            h.releasePointerCapture(e.pointerId);
            h.removeEventListener("pointermove", onMove);
            h.removeEventListener("pointerup", onUp);
            resizeGhost.style.display = "none";
            if (pendingW !== canvas.width || pendingH !== canvas.height) {
              resizeCanvas(pendingW, pendingH);
            }
          }
          h.addEventListener("pointermove", onMove);
          h.addEventListener("pointerup", onUp);
        });
      });
    }
    setupResizeHandles();
    function saveAsPng() {
      commitTextBox();
      var link = document.createElement("a");
      link.download = "pintura.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    }
    function openAttributesDialog() {
      var overlayEl = document.createElement("div");
      overlayEl.className = "sisop-dialog-overlay";
      var d = document.createElement("div");
      d.className = "dialog sisop-dialog";
      d.style.position = "fixed";
      d.innerHTML =
        '<div class="title-bar"><span class="tb-text">Atributos</span>' +
        '<span class="tb-btns"><button class="tb-btn" type="button" data-act="cancel">✕</button></span></div>' +
        '<div class="body">' +
        '<div class="paint-field"><label>Ancho (px)</label><input type="number" min="1" max="4000" class="paint-attr-w"></div>' +
        '<div class="paint-field" style="margin-top:8px"><label>Alto (px)</label><input type="number" min="1" max="4000" class="paint-attr-h"></div>' +
        "</div>" +
        '<div class="foot"></div>';
      var wInput = d.querySelector(".paint-attr-w");
      var hInput = d.querySelector(".paint-attr-h");
      wInput.value = canvas.width;
      hInput.value = canvas.height;
      var foot = d.querySelector(".foot");
      var okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.className = "btn primary";
      okBtn.textContent = "Aceptar";
      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn";
      cancelBtn.textContent = "Cancelar";
      foot.appendChild(okBtn);
      foot.appendChild(cancelBtn);
      function close() {
        overlayEl.remove();
        d.remove();
      }
      cancelBtn.addEventListener("click", close);
      d.querySelector('[data-act="cancel"]').addEventListener("click", close);
      overlayEl.addEventListener("click", close);
      okBtn.addEventListener("click", function () {
        var nw = clamp(parseInt(wInput.value, 10) || canvas.width, 1, 4000);
        var nh = clamp(parseInt(hInput.value, 10) || canvas.height, 1, 4000);
        close();
        resizeCanvas(nw, nh);
      });
      document.body.appendChild(overlayEl);
      document.body.appendChild(d);
      wInput.focus();
    }

    function handleMenuAction(act) {
      if (act === "new") {
        window.sisopDialog
          .confirm({
            title: "Nuevo",
            message: "¿Descartar los cambios y empezar un lienzo nuevo?",
            okLabel: "Nuevo",
          })
          .then(function (ok) {
            if (!ok) return;
            clearSelection();
            setCanvasSize(600, 400);
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            history = [];
            historyIndex = -1;
            pushHistory();
          });
      } else if (act === "save") {
        saveAsPng();
      } else if (act === "close") {
        window.sisopWin.close("paint");
      } else if (act === "undo") {
        undo();
      } else if (act === "redo") {
        redo();
      } else if (act === "select-all") {
        selectTool("select");
        selection = { x: 0, y: 0, w: canvas.width, h: canvas.height };
        drawSelectionOutline(0, 0, canvas.width, canvas.height);
      } else if (act === "clear-selection") {
        if (selection) {
          ctx.fillStyle = secondary;
          ctx.fillRect(selection.x, selection.y, selection.w, selection.h);
          pushHistory();
          clearSelection();
        }
      } else if (act === "flip-h") {
        flip(true);
      } else if (act === "flip-v") {
        flip(false);
      } else if (act === "rotate-l") {
        rotate(-90);
      } else if (act === "rotate-r") {
        rotate(90);
      } else if (act === "invert") {
        invertColors();
      } else if (act === "attributes") {
        openAttributesDialog();
      } else if (act === "clear-image") {
        ctx.fillStyle = secondary;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        pushHistory();
      } else if (act === "edit-colors") {
        openColorPicker();
      }
    }

    selectTool("pencil");
  }

  window.sisopWin.registerApp("paint", {
    title: "sin título - Paint",
    iconHtml: APP_ICON,
    type: "custom",
    w: 720,
    h: 540,
    render: render,
  });
})();
