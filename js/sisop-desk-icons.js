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
        p = defaultPosition(i, grid);
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

  window.deskIcons = { add: addIcon, remove: removeIcon };
})();
