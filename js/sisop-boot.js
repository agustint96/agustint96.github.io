/* Monitor CRT encendiéndose: pantalla negra + línea que se abre con parpadeo */
(function () {
  /* Fondo negro (ver botón "cambiar fondo" en la barra de tareas): se
     aplica lo antes posible para que no haya un parpadeo azul→negro al
     cargar la página con la preferencia ya guardada. */
  try {
    if (localStorage.getItem("sisop.bg.v1") === "negro") {
      document.documentElement.classList.add("bg-negro");
    }
  } catch (e) {}

  /* El botón "Reiniciar" fuerza el reload agregando "?_r=..." para que el
     navegador no sirva el HTML desde caché (equivalente a un Ctrl+F5). Ya
     cumplido su propósito, se saca de la barra de direcciones. */
  try {
    if (/[?&]_r=\d+/.test(window.location.search)) {
      var limpia =
        window.location.pathname +
        window.location.search.replace(/[?&]_r=\d+/, "").replace(/^&/, "?") +
        window.location.hash;
      window.history.replaceState(null, "", limpia);
    }
  } catch (e) {}

  var reduce = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (!reduce) {
    var scr = document.createElement("div");
    scr.className = "crt-screen boot";
    document.body.appendChild(scr);
    setTimeout(function () {
      if (scr.parentNode) scr.parentNode.removeChild(scr);
    }, 900);
  }

  /* Retoma el sonido de encendido donde quedó al salir del portfolio,
     así se escucha entero aunque la animación haya sido corta. */
  try {
    var marca = sessionStorage.getItem("sisopon:desde");
    if (marca) {
      sessionStorage.removeItem("sisopon:desde");
      var pasado = (Date.now() - parseInt(marca, 10)) / 1000;
      if (isFinite(pasado) && pasado >= 0 && pasado < 15) {
        var snd = new Audio("audio/sisopon.m4a");
        snd.volume = 0.6;
        snd.addEventListener("loadedmetadata", function () {
          var arrancar = function () {
            var offset =
              Math.max(0, Date.now() - parseInt(marca, 10)) / 1000;
            if (isFinite(snd.duration) && offset >= snd.duration - 0.15)
              return;
            try {
              snd.currentTime = offset;
            } catch (e) {}
            snd.play().catch(function () {});
          };
          arrancar();
          /* Si el navegador bloquea el autoplay, se retoma al primer toque */
          ["pointerdown", "keydown"].forEach(function (ev) {
            document.addEventListener(
              ev,
              function reintento() {
                document.removeEventListener(ev, reintento, true);
                if (snd.paused) arrancar();
              },
              true,
            );
          });
        });
      }
    }
  } catch (e) {}

  /* Al volver con "atrás" desde la caché (bfcache): deshacer el estado de
     apagado que dejó la pantalla en negro */
  window.addEventListener("pageshow", function (ev) {
    if (!ev.persisted) return;
    var h = document.documentElement;
    h.classList.remove("crt-shutdown");
    delete h.dataset.apagando;
    var overlays = document.querySelectorAll(".crt-screen");
    for (var i = 0; i < overlays.length; i++) overlays[i].remove();
  });
})();
