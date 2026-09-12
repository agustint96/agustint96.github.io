/* Escritorio: dejar arrastrar los iconos a donde quiera el usuario, pero
 * siempre pegados a una cuadrícula (como el escritorio de Windows real).
 * La posición de cada ícono se guarda en el navegador (localStorage), así
 * que cada visitante puede reacomodarlos a su gusto y le quedan la próxima
 * vez que entre. No toca cómo se abren los programas (eso sigue en
 * sisop-sqlconsole.js / sisop-atendedor.js): esto sólo los posiciona.
 */
(function () {
  var desk = document.getElementById("desk");
  if (!desk) return;
  var icons = [].slice.call(desk.querySelectorAll(".desk-icon"));
  if (!icons.length) return;

  var STORAGE_KEY = "sisop.desk.layout.v1";

  function iconId(el) {
    return (
      el.getAttribute("data-open") ||
      el.getAttribute("data-user-item") ||
      el.id
    );
  }

  function loadLayout() {
    try {
      var raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return raw && typeof raw === "object" ? raw : {};
    } catch (_) {
      return {};
    }
  }
  function saveLayout() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
    } catch (_) {
      /* localStorage bloqueado: los iconos igual se ven, sólo no se recuerdan */
    }
  }

  var layout = loadLayout();

  // Tamaño de celda: ancho fijo (columna del CSS) + el ícono más alto que
  // haya (por las etiquetas de dos líneas, ej. "Atendedor.ia"). Los gaps son
  // los mismos que tenía el layout en flex antes de poder arrastrarse.
  var COL_GAP = 6;
  var ROW_GAP = 10;
  function cellSize() {
    var colGap = COL_GAP;
    var rowGap = ROW_GAP;
    var colW =
      parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--desk-col",
        ),
      ) || 82;
    var maxH = 0;
    icons.forEach(function (ic) {
      maxH = Math.max(maxH, ic.offsetHeight || 0);
    });
    if (!maxH) maxH = 78;
    return { w: colW + colGap, h: maxH + rowGap };
  }

  function gridSize(cell) {
    var r = desk.getBoundingClientRect();
    return {
      cols: Math.max(1, Math.floor(r.width / cell.w)),
      rows: Math.max(1, Math.floor(r.height / cell.h)),
    };
  }

  // Orden por defecto (sin nada guardado todavía): de arriba a abajo y
  // después a la derecha, el mismo que tenía el escritorio antes de poder
  // arrastrarse.
  function defaultPosition(index, grid) {
    var col = Math.floor(index / grid.rows);
    var row = index % grid.rows;
    return { col: col, row: row };
  }

  function occupiedCells(exceptId) {
    var set = {};
    icons.forEach(function (ic) {
      var id = iconId(ic);
      if (id === exceptId) return;
      var p = layout[id];
      if (p) set[p.col + "," + p.row] = true;
    });
    return set;
  }

  // Celda libre más cercana a (col,row), dentro de la grilla visible.
  function nearestFreeCell(col, row, grid, exceptId) {
    col = Math.min(Math.max(0, col), grid.cols - 1);
    row = Math.min(Math.max(0, row), grid.rows - 1);
    var occ = occupiedCells(exceptId);
    if (!occ[col + "," + row]) return { col: col, row: row };
    var maxRadius = grid.cols + grid.rows;
    for (var d = 1; d <= maxRadius; d++) {
      for (var dc = -d; dc <= d; dc++) {
        var dr = d - Math.abs(dc);
        var rows = dr === 0 ? [0] : [dr, -dr];
        for (var k = 0; k < rows.length; k++) {
          var c = col + dc;
          var r = row + rows[k];
          if (c < 0 || r < 0 || c >= grid.cols || r >= grid.rows) continue;
          if (!occ[c + "," + r]) return { col: c, row: r };
        }
      }
    }
    return { col: col, row: row }; // no queda ninguna libre: se superponen
  }

  function place(ic, pos, cell) {
    ic.style.left = pos.col * cell.w + "px";
    ic.style.top = pos.row * cell.h + "px";
  }

  function applyLayout() {
    var cell = cellSize();
    var grid = gridSize(cell);
    var changed = false;
    icons.forEach(function (ic, i) {
      var id = iconId(ic);
      var p = layout[id];
      if (!p) {
        // Puede coincidir con la posición ya asignada/guardada de otro
        // ícono (ej. uno nuevo que no tenía celda guardada todavía): si
        // está ocupada, buscamos la libre más cercana en vez de superponer.
        var def = defaultPosition(i, grid);
        p = nearestFreeCell(def.col, def.row, grid, id);
        changed = true;
      } else if (p.col >= grid.cols || p.row >= grid.rows) {
        // La ventana se achicó y esta posición ya no entra: la reacomodamos.
        p = nearestFreeCell(
          Math.min(p.col, grid.cols - 1),
          Math.min(p.row, grid.rows - 1),
          grid,
          id,
        );
        changed = true;
      }
      layout[id] = p;
      place(ic, p, cell);
    });
    if (changed) saveLayout();
  }

  applyLayout();

  var resizeTimer = null;
  window.addEventListener("resize", function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyLayout, 150);
  });

  // ---- Arrastrar y soltar (pegado a la cuadrícula) ----
  var dragEl = null,
    moved = false,
    sx = 0,
    sy = 0,
    ox = 0,
    oy = 0;

  function bindDrag(ic) {
    ic.addEventListener("pointerdown", function (e) {
      if (e.button != null && e.button !== 0) return;
      dragEl = ic;
      moved = false;
      sx = e.clientX;
      sy = e.clientY;
      ox = parseFloat(ic.style.left) || 0;
      oy = parseFloat(ic.style.top) || 0;
      try {
        ic.setPointerCapture(e.pointerId);
      } catch (_) {}
    });

    ic.addEventListener("pointermove", function (e) {
      if (dragEl !== ic) return;
      var dx = e.clientX - sx;
      var dy = e.clientY - sy;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 3) {
        moved = true;
        ic.classList.add("dragging");
      }
      if (!moved) return;
      ic.style.left = ox + dx + "px";
      ic.style.top = oy + dy + "px";
    });

    ic.addEventListener("pointerup", function (e) {
      if (dragEl !== ic) return;
      dragEl = null;
      try {
        ic.releasePointerCapture(e.pointerId);
      } catch (_) {}
      ic.classList.remove("dragging");
      if (!moved) return;
      moved = false;
      // Recién arrastraste el ícono: el "click" que el navegador dispara
      // al soltar no debe además abrirlo (ver sisopTouch.bindActivate).
      window.sisopTouch.suppressNextClick(ic);
      // Si al soltarlo cae sobre una carpeta propia (sisop-user-files.js lo
      // decide), ese archivo cambia de dueño: no lo reubicamos en la grilla.
      if (typeof ic.__deskDropCheck === "function") {
        var handled = false;
        try {
          handled = ic.__deskDropCheck(e.clientX, e.clientY);
        } catch (_) {}
        if (handled) return;
      }
      var cell = cellSize();
      var grid = gridSize(cell);
      var col = Math.round((parseFloat(ic.style.left) || 0) / cell.w);
      var row = Math.round((parseFloat(ic.style.top) || 0) / cell.h);
      var p = nearestFreeCell(col, row, grid, iconId(ic));
      layout[iconId(ic)] = p;
      place(ic, p, cell);
      saveLayout();
    });
  }

  icons.forEach(bindDrag);

  // ---- Navegar entre iconos con las flechitas ----
  // Reusa las coordenadas (col,row) de `layout`, así que respeta el
  // acomodo real de la cuadrícula (incluso arrastrado a mano) en vez de
  // adivinar por posición en píxeles. Busca, entre los demás iconos, el más
  // cercano en la dirección pedida: primero el que está más alineado
  // (mismo row para izq/der, misma col para arriba/abajo) y, entre esos, el
  // más próximo.
  var ARROW_KEYS = {
    ArrowUp: 1,
    ArrowDown: 1,
    ArrowLeft: 1,
    ArrowRight: 1,
  };
  function findInDirection(fromId, key) {
    var p = layout[fromId];
    if (!p) return null;
    var dx = key === "ArrowRight" ? 1 : key === "ArrowLeft" ? -1 : 0;
    var dy = key === "ArrowDown" ? 1 : key === "ArrowUp" ? -1 : 0;
    var bestId = null;
    var bestScore = Infinity;
    icons.forEach(function (ic) {
      var id = iconId(ic);
      if (id === fromId) return;
      var q = layout[id];
      if (!q) return;
      var ddx = q.col - p.col;
      var ddy = q.row - p.row;
      var primary = dx ? ddx * dx : ddy * dy;
      if (primary <= 0) return; // no está del lado pedido
      var perp = dx ? ddy : ddx;
      var score = Math.abs(perp) * 1000 + primary;
      if (score < bestScore) {
        bestScore = score;
        bestId = id;
      }
    });
    return bestId;
  }
  desk.addEventListener("keydown", function (e) {
    if (!ARROW_KEYS[e.key]) return;
    var active = document.activeElement;
    if (!active || !active.classList || !active.classList.contains("desk-icon"))
      return;
    e.preventDefault();
    var targetId = findInDirection(iconId(active), e.key);
    if (!targetId) return;
    var targetEl = icons.filter(function (ic) {
      return iconId(ic) === targetId;
    })[0];
    if (!targetEl) return;
    document
      .querySelectorAll(".desk-icon.selected, .folder-icon.selected")
      .forEach(function (x) {
        x.classList.remove("selected");
      });
    targetEl.classList.add("selected");
    targetEl.focus();
  });

  // ---- Selección múltiple por lazo (forma libre, no un cuadrado) ----
  // Arrancás el arrastre en el fondo del escritorio (no sobre un ícono: eso
  // ya lo maneja bindDrag) y vas dibujando el contorno a mano; al soltar, se
  // cierra el trazo y quedan seleccionados los íconos cuyo centro cayó
  // adentro. La selección se actualiza en vivo mientras arrastrás, como el
  // rectángulo de selección de Windows pero con la forma que quieras.
  var lassoSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  lassoSvg.setAttribute("class", "desk-lasso");
  var lassoPath = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path",
  );
  lassoSvg.appendChild(lassoPath);
  desk.appendChild(lassoSvg);

  var LASSO_MIN_DRAG = 4; // px: por debajo de esto es un click normal, no un lazo
  var lassoPts = null;
  var lassoStartX = 0,
    lassoStartY = 0;

  // Abierto a propósito: mientras se arrastra se ve sólo el trazo libre
  // siguiendo el mouse, no una forma cerrada (si no, cualquier arrastre en
  // "L" se ve como un cuadrilátero). El cierre contra el primer punto es
  // sólo para el cálculo de qué íconos quedaron adentro (ver
  // iconsInsideLasso), nunca se dibuja.
  function svgPathFromPoints(pts) {
    var d = "M" + pts[0][0] + "," + pts[0][1];
    for (var i = 1; i < pts.length; i++) d += "L" + pts[i][0] + "," + pts[i][1];
    return d;
  }
  // Ray casting clásico: ¿(x,y) cae adentro del polígono cerrado `pts`?
  function pointInPolygon(x, y, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var xi = pts[i][0],
        yi = pts[i][1];
      var xj = pts[j][0],
        yj = pts[j][1];
      var intersect =
        yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
      if (intersect) inside = !inside;
    }
    return inside;
  }
  function iconsInsideLasso(pts) {
    var rDesk = desk.getBoundingClientRect();
    return icons.filter(function (ic) {
      var r = ic.getBoundingClientRect();
      var cx = r.left + r.width / 2 - rDesk.left;
      var cy = r.top + r.height / 2 - rDesk.top;
      return pointInPolygon(cx, cy, pts);
    });
  }

  desk.addEventListener("pointerdown", function (e) {
    if (e.button !== 0) return;
    if (e.target.closest(".desk-icon")) return;
    var r = desk.getBoundingClientRect();
    lassoPts = [[e.clientX - r.left, e.clientY - r.top]];
    lassoStartX = e.clientX;
    lassoStartY = e.clientY;
    try {
      desk.setPointerCapture(e.pointerId);
    } catch (_) {}
  });
  desk.addEventListener("pointermove", function (e) {
    if (!lassoPts) return;
    var r = desk.getBoundingClientRect();
    var x = e.clientX - r.left,
      y = e.clientY - r.top;
    var last = lassoPts[lassoPts.length - 1];
    if (Math.abs(x - last[0]) + Math.abs(y - last[1]) < 2) return;
    lassoPts.push([x, y]);
    var dragged =
      Math.abs(e.clientX - lassoStartX) + Math.abs(e.clientY - lassoStartY) >
      LASSO_MIN_DRAG;
    if (!dragged) return;
    lassoSvg.classList.add("active");
    lassoPath.setAttribute("d", svgPathFromPoints(lassoPts));
    var inside = iconsInsideLasso(lassoPts.concat([lassoPts[0]]));
    icons.forEach(function (ic) {
      ic.classList.toggle("selected", inside.indexOf(ic) !== -1);
    });
  });
  function endLasso(e) {
    if (!lassoPts) return;
    try {
      desk.releasePointerCapture(e.pointerId);
    } catch (_) {}
    var dragged =
      Math.abs(e.clientX - lassoStartX) + Math.abs(e.clientY - lassoStartY) >
      LASSO_MIN_DRAG;
    lassoPts = null;
    lassoSvg.classList.remove("active");
    lassoPath.setAttribute("d", "");
    // Sin arrastre real: fue un click normal, lo maneja el listener de
    // siempre (limpia la selección al clickear el fondo). Con arrastre real,
    // la selección ya quedó puesta en vivo: sólo evitamos que el "click"
    // sintético que sigue al soltar la borre de nuevo.
    if (dragged) window.sisopTouch.suppressNextClick(desk);
  }
  desk.addEventListener("pointerup", endLasso);
  desk.addEventListener("pointercancel", endLasso);

  /* API para otros scripts (ej. sisop-user-files.js): sumar/sacar iconos
     del escritorio después de la carga inicial (carpetas/notas/archivos que
     crea el usuario), reusando la misma cuadrícula y el mismo arrastre.
     `onDrop(x, y)` es opcional: se consulta ANTES de reubicar en la grilla
     al soltar; si devuelve true (ej. se soltó sobre una carpeta propia y ya
     se movió para adentro), no se lo posiciona acá. */
  function addIcon(ic, pos, onDrop) {
    if (icons.indexOf(ic) !== -1) return;
    if (typeof onDrop === "function") ic.__deskDropCheck = onDrop;
    icons.push(ic);
    ic.style.position = "absolute";
    var id = iconId(ic);
    var cell = cellSize();
    var grid = gridSize(cell);
    var p = layout[id];
    if (!p) {
      p =
        pos && typeof pos.col === "number" && typeof pos.row === "number"
          ? nearestFreeCell(pos.col, pos.row, grid, id)
          : nearestFreeCell(0, 0, grid, id);
      layout[id] = p;
      saveLayout();
    } else if (p.col >= grid.cols || p.row >= grid.rows) {
      p = nearestFreeCell(
        Math.min(p.col, grid.cols - 1),
        Math.min(p.row, grid.rows - 1),
        grid,
        id,
      );
      layout[id] = p;
      saveLayout();
    }
    place(ic, p, cell);
    bindDrag(ic);
  }

  function removeIcon(ic) {
    var i = icons.indexOf(ic);
    if (i !== -1) icons.splice(i, 1);
    delete layout[iconId(ic)];
    saveLayout();
  }

  // "Actualizar" del menú contextual: descarta el acomodo a mano y vuelve a
  // ordenar todo como al principio (mismo orden en que aparecen los iconos
  // en el escritorio: primero los del HTML, después los que se hayan ido
  // sumando).
  function resetLayout() {
    layout = {};
    applyLayout();
  }

  window.deskIcons = { add: addIcon, remove: removeIcon, reset: resetLayout };
})();
