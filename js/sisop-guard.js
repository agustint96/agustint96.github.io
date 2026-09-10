/* El "sistema operativo" no existe en celulares: si se entra desde un
   teléfono (o la ventana es muy angosta), se vuelve al portfolio. */
(function () {
  var esCelular =
    window.matchMedia("(max-width: 600px)").matches ||
    (window.matchMedia("(pointer: coarse)").matches &&
      window.matchMedia("(max-width: 820px)").matches);
  if (esCelular) {
    window.location.replace("index.html");
  }
})();
