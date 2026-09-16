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
      var a = items.indexOf(container.__selectAnchor);
      var b = items.indexOf(el);
      var lo = Math.min(a, b),
        hi = Math.max(a, b);
      items.forEach(function (it, i) {
        it.classList.toggle("selected", i >= lo && i <= hi);
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
