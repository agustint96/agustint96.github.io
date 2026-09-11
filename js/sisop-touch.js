/* Punto único de verdad para el "modo mobile" de SISOP: apps a pantalla
 * completa, tap en vez de doble-clic. Se carga primero para que el resto de
 * los scripts (atendedor, escritorio, consola SQL, archivos de usuario)
 * puedan usarlo desde el arranque.
 */
window.sisopTouch = {
  isMobileMode: function () {
    return window.matchMedia("(max-width: 720px)").matches;
  },
  /* Mobile no tiene doble-clic natural: un tap alcanza para "abrir".
     Desktop conserva el doble-clic de siempre. `fn` recibe el evento tal
     cual, así los guards que ya tenga el llamador (ej. "si venía de un
     drag, no abrir") siguen funcionando sin cambios. */
  bindActivate: function (el, fn) {
    el.addEventListener("dblclick", fn);
    el.addEventListener("click", function (e) {
      if (window.sisopTouch.isMobileMode()) fn(e);
    });
  },
  /* En touch, arrastrar un ícono para reposicionarlo/moverlo también
     dispara un "click" nativo al soltar (no sólo en mouse). Sin esto, ese
     mismo tap terminaría abriendo el ítem que el usuario sólo quería mover.
     Los drags con su propio flag interno (ej. las notas, que ya chequean
     `justDragged` adentro de la función que abre) no lo necesitan; esto es
     para cuando el drag y el "abrir" viven en archivos/listeners distintos
     (íconos de escritorio, ítems dentro de una carpeta). */
  suppressNextClick: function (el) {
    function once(e) {
      e.stopImmediatePropagation();
      e.preventDefault();
      el.removeEventListener("click", once, true);
    }
    el.addEventListener("click", once, true);
  },
};
