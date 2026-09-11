/* Diálogo modal con la misma estética Windows 98 que el resto del sisop
 * (ver .dialog en sisop.html, ya usado por "Acerca de"), para reemplazar los
 * confirm() nativos del navegador — esos rompen la ilusión: aparecen con el
 * cromado del sistema operativo real, no con el del sisop.
 *
 * Se carga antes que sisop-grabadora.js / sisop-sqlconsole.js /
 * sisop-user-files.js (todos lo usan) pero sólo hace falta que exista para
 * cuando el usuario interactúa, así que el orden entre ellos no importa.
 */
(function () {
  var current = null; // { overlay, root, resolve }

  function closeCurrent(result) {
    if (!current) return;
    var c = current;
    current = null;
    document.removeEventListener("keydown", c.onKey, true);
    c.overlay.remove();
    c.root.remove();
    c.resolve(result);
  }

  // Confirmación estilo w98: título + mensaje + botones "Aceptar/Cancelar"
  // (o los labels que se pidan). Devuelve una Promise<boolean>.
  function confirmDialog(opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      if (current) closeCurrent(false); // sólo un diálogo a la vez

      var overlay = document.createElement("div");
      overlay.className = "sisop-dialog-overlay";

      var root = document.createElement("div");
      root.className = "dialog sisop-dialog";
      root.innerHTML =
        '<div class="title-bar">' +
        '<span class="tb-text"></span>' +
        '<span class="tb-btns"><button class="tb-btn" type="button" data-act="cancel">✕</button></span>' +
        "</div>" +
        '<div class="body"><p></p></div>' +
        '<div class="foot"></div>';
      root.querySelector(".tb-text").textContent = opts.title || "Confirmar";
      root.querySelector(".body p").textContent = opts.message || "";

      var foot = root.querySelector(".foot");
      var okBtn = document.createElement("button");
      okBtn.type = "button";
      okBtn.className = "btn" + (opts.danger ? " primary" : "");
      okBtn.textContent = opts.okLabel || "Aceptar";
      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn";
      cancelBtn.textContent = opts.cancelLabel || "Cancelar";
      foot.appendChild(okBtn);
      foot.appendChild(cancelBtn);

      function finish(result) {
        closeCurrent(result);
      }
      okBtn.addEventListener("click", function () {
        finish(true);
      });
      cancelBtn.addEventListener("click", function () {
        finish(false);
      });
      root.querySelector('[data-act="cancel"]').addEventListener(
        "click",
        function () {
          finish(false);
        },
      );
      overlay.addEventListener("click", function () {
        finish(false);
      });

      function onKey(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          finish(false);
        } else if (e.key === "Enter") {
          e.preventDefault();
          finish(true);
        }
      }
      document.addEventListener("keydown", onKey, true);

      document.body.appendChild(overlay);
      document.body.appendChild(root);
      okBtn.focus();

      current = { overlay: overlay, root: root, resolve: resolve, onKey: onKey };
    });
  }

  window.sisopDialog = { confirm: confirmDialog };
})();
