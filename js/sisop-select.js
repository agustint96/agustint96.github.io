/* Selección múltiple de íconos con teclado, como en el explorador de
 * Windows: clic solo = selecciona sólo ése; Ctrl/Cmd+clic = suma o saca ese
 * ítem de la selección sin tocar el resto; Shift+clic = selecciona todo el
 * rango entre el último clickeado ("ancla") y éste. Un único punto de verdad
 * para el escritorio (sisop-desk-icons.js) y las carpetas, tanto las del
 * usuario (sisop-user-files.js) como las fijas del sistema
 * (sisop-sqlconsole.js).
 */
window.sisopSelect = {
  /* `container` es la grilla donde viven los ítems entre los que tiene
     sentido hacer un rango (el escritorio entero, o una carpeta abierta en
     particular) — cada carpeta tiene la suya, así el rango nunca cruza de
     una a otra. `selector` filtra qué hijos cuentan como ítems. */
  handleClick: function (e, el, container, selector) {
    var items = [].slice.call(container.querySelectorAll(selector));

    // Sólo hay una selección activa por vez en toda la página (nunca a la
    // vez en el escritorio y adentro de una carpeta, ni en dos carpetas
    // distintas): lo que quede seleccionado fuera de este `container` se
    // limpia siempre, haya o no Ctrl/Shift.
    document
      .querySelectorAll(".desk-icon.selected, .folder-icon.selected")
      .forEach(function (x) {
        if (items.indexOf(x) === -1) x.classList.remove("selected");
      });

    if (
      e.shiftKey &&
      container.__selectAnchor &&
      items.indexOf(container.__selectAnchor) !== -1
    ) {
      // Rango por posición visual (el rectángulo entre el ancla y el
      // clickeado), no por orden en el HTML: acá los íconos se arrastran a
      // cualquier celda libre, así que el orden del DOM no tiene nada que
      // ver con lo que se ve en pantalla. Es el mismo criterio que ya usa
      // el lazo de selección (sisop-desk-icons.js): centro del ícono
      // adentro del área.
      var ra = container.__selectAnchor.getBoundingClientRect();
      var rb = el.getBoundingClientRect();
      var left = Math.min(ra.left, rb.left);
      var right = Math.max(ra.right, rb.right);
      var top = Math.min(ra.top, rb.top);
      var bottom = Math.max(ra.bottom, rb.bottom);
      items.forEach(function (it) {
        var r = it.getBoundingClientRect();
        var cx = r.left + r.width / 2;
        var cy = r.top + r.height / 2;
        it.classList.toggle(
          "selected",
          cx >= left && cx <= right && cy >= top && cy <= bottom,
        );
      });
      return; // el ancla no se mueve con Shift, como en Windows
    }

    if (e.ctrlKey || e.metaKey) {
      el.classList.toggle("selected");
      container.__selectAnchor = el;
      return;
    }

    items.forEach(function (it) {
      if (it !== el) it.classList.remove("selected");
    });
    el.classList.toggle("selected");
    container.__selectAnchor = el;
  },
};
