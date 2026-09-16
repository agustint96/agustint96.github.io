/* "Publicar mi escritorio": desde el propio navegador de Agus, sin pasar
 * por una terminal, sube el estado actual del escritorio (carpetas/notas/
 * archivos de sisop-user-files.js + el layout de sisop-desk-icons.js) al
 * repo de GitHub, para que sea el punto de partida que ve cualquier
 * visitante nuevo. Del otro lado lo consume syncPublished() en
 * sisop-user-files.js.
 *
 * El único control de acceso posible en un sitio 100% estático es "saber
 * el token": un fine-grained personal access token de GitHub, acotado a
 * este repo y sólo con permiso de Contents (read/write), pegado una vez
 * acá y guardado en el localStorage de ese navegador. Cualquiera puede ver
 * las entradas del menú (no hay forma real de ocultarlas en un sitio
 * estático), pero sin el token correcto sólo consiguen un error 401.
 */
(function () {
  var OWNER = "agustint96";
  var REPO = "agustint96.github.io";
  var API_BASE =
    "https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/";
  var MANIFEST_PATH = "data/published-desktop.json";
  var FILES_DIR = "data/published-desktop-files";
  var TOKEN_KEY = "sisop.publish.token.v1";

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || "";
    } catch (_) {
      return "";
    }
  }
  function setToken(t) {
    try {
      localStorage.setItem(TOKEN_KEY, t);
    } catch (_) {
      /* sin localStorage: el token no sobrevive a un reload, pero publicar
         dentro de esta misma sesión igual funciona */
    }
  }
  function clearToken() {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch (_) {}
  }

  // ---------------------------------------------------------------------
  // API de contenidos de GitHub — fetch + Authorization: Bearer. CORS no
  // es problema: api.github.com admite llamadas autenticadas desde
  // cualquier origen (así funciona, por ejemplo, github.dev).
  // ---------------------------------------------------------------------
  function ghHeaders(token, extra) {
    var h = {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    };
    for (var k in extra) h[k] = extra[k];
    return h;
  }
  function ghRequest(method, path, token, body) {
    return fetch(API_BASE + path, {
      method: method,
      headers: ghHeaders(token, body ? { "Content-Type": "application/json" } : {}),
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      if (r.status === 404) return { ok: true, status: 404, data: null };
      return r.json().then(
        function (data) {
          return { ok: r.ok, status: r.status, data: data };
        },
        function () {
          return { ok: r.ok, status: r.status, data: null };
        },
      );
    });
  }
  function apiError(resp) {
    var msg = (resp.data && resp.data.message) || "Error " + resp.status + " de GitHub";
    var err = new Error(msg);
    err.status = resp.status;
    return err;
  }
  // null si el archivo no existe (404), su info (con .sha) si existe.
  function ghGet(path, token) {
    return ghRequest("GET", path, token).then(function (resp) {
      if (resp.status === 404) return null;
      if (!resp.ok) throw apiError(resp);
      return resp.data;
    });
  }
  // [] si el directorio no existe todavía (ej. antes de la primera publicación).
  function ghListDir(path, token) {
    return ghRequest("GET", path, token).then(function (resp) {
      if (resp.status === 404) return [];
      if (!resp.ok) throw apiError(resp);
      return Array.isArray(resp.data) ? resp.data : [];
    });
  }
  function ghPut(path, base64Content, message, sha, token) {
    var body = { message: message, content: base64Content };
    if (sha) body.sha = sha;
    return ghRequest("PUT", path, token, body).then(function (resp) {
      if (!resp.ok) throw apiError(resp);
      return resp.data;
    });
  }
  function ghDelete(path, sha, message, token) {
    return fetch(API_BASE + path, {
      method: "DELETE",
      headers: ghHeaders(token, { "Content-Type": "application/json" }),
      body: JSON.stringify({ message: message, sha: sha }),
    }).then(function (r) {
      if (!r.ok && r.status !== 404) throw new Error("No se pudo borrar " + path);
    });
  }

  function utf8B64(str) {
    return btoa(unescape(encodeURIComponent(str)));
  }
  // Blob -> base64 en chunks, para no reventar la call stack con archivos
  // grandes (MAX_FILE_BYTES en sisop-user-files.js ya limita a 15MB).
  function blobToBase64(blob) {
    return blob.arrayBuffer().then(function (buf) {
      var bytes = new Uint8Array(buf);
      var chunk = 0x8000;
      var parts = [];
      for (var i = 0; i < bytes.length; i += chunk) {
        parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
      }
      return btoa(parts.join(""));
    });
  }
  function safeFileName(id, name) {
    var clean = String(name || "archivo").replace(/[^A-Za-z0-9._-]/g, "_");
    return id + "-" + clean;
  }

  // ---------------------------------------------------------------------
  // Armar y subir la publicación
  // ---------------------------------------------------------------------
  function buildExport() {
    return {
      items: window.sisopUserFiles.exportAll(),
      layout: window.deskIcons.getLayout(),
    };
  }
  function toManifestItem(it, filePath) {
    var out = {
      id: it.id,
      parent: it.parent,
      type: it.type,
      name: it.name,
      createdAt: it.createdAt,
    };
    if (it.type === "note") out.text = it.text || "";
    if (it.type === "file") {
      out.mime = it.mime || "";
      out.size = it.size || 0;
      out.file = filePath;
    }
    return out;
  }

  function publish() {
    var token = getToken();
    if (!token) {
      return promptForToken().then(function (t) {
        if (t) return publish();
      });
    }
    var built = buildExport();
    var fileItems = built.items.filter(function (it) {
      return it.type === "file";
    });

    return Promise.all([ghGet(MANIFEST_PATH, token), ghListDir(FILES_DIR, token)])
      .then(function (results) {
        var oldManifest = results[0];
        var existingFiles = results[1];
        var shaByPath = {};
        existingFiles.forEach(function (f) {
          shaByPath[f.path] = f.sha;
        });

        var pathById = {};
        // Uno a la vez (no en paralelo): así un fallo queda atribuible a un
        // solo archivo y no se golpea el rate-limit de la API.
        var chain = fileItems.reduce(function (p, it) {
          var path = FILES_DIR + "/" + safeFileName(it.id, it.name);
          pathById[it.id] = path;
          return p
            .then(function () {
              return blobToBase64(it.blob);
            })
            .then(function (b64) {
              return ghPut(path, b64, "Publicar: " + it.name, shaByPath[path], token);
            });
        }, Promise.resolve());

        return chain.then(function () {
          // El manifest se sube al final, cuando todos los archivos que
          // referencia ya están arriba: así un fallo a mitad de camino
          // nunca deja publicado un manifest que apunte a algo inexistente.
          var manifest = {
            version: Date.now(),
            layout: built.layout,
            items: built.items.map(function (it) {
              return toManifestItem(it, pathById[it.id]);
            }),
          };
          return ghPut(
            MANIFEST_PATH,
            utf8B64(JSON.stringify(manifest, null, 2)),
            "Publicar escritorio",
            oldManifest && oldManifest.sha,
            token,
          ).then(function () {
            // Limpieza best-effort, recién ahora: archivos que quedaron sin
            // referencia (algo que Agus sacó de su escritorio). Si falla no
            // pasa nada grave, queda un archivo huérfano invisible (el
            // manifest ya no lo nombra).
            var keep = {};
            Object.keys(pathById).forEach(function (id) {
              keep[pathById[id]] = true;
            });
            var stale = Object.keys(shaByPath).filter(function (p) {
              return !keep[p];
            });
            return Promise.all(
              stale.map(function (p) {
                return ghDelete(p, shaByPath[p], "Limpieza: archivo publicado eliminado", token).catch(
                  function () {},
                );
              }),
            );
          });
        });
      })
      .then(function () {
        return window.sisopDialog.confirm({
          title: "Publicar mi escritorio",
          message: "Listo, se publicó tu escritorio.",
          okLabel: "Cerrar",
          cancelLabel: "Cerrar",
        });
      })
      .catch(function (err) {
        if (err && (err.status === 401 || err.status === 403)) {
          clearToken();
          return window.sisopDialog
            .confirm({
              title: "Publicar mi escritorio",
              message:
                (err.status === 401
                  ? "El token no es válido o venció."
                  : "El token no tiene permiso (revisá que sea Contents: Read and write, sólo en este repo).") +
                "\nPegá uno nuevo para volver a intentar.",
              okLabel: "Pegar token",
              cancelLabel: "Cancelar",
            })
            .then(function (retry) {
              if (!retry) return;
              return promptForToken().then(function (t) {
                if (t) return publish();
              });
            });
        }
        return window.sisopDialog.confirm({
          title: "Publicar mi escritorio",
          message:
            "No se pudo publicar: " + (err && err.message ? err.message : "error desconocido"),
          okLabel: "Cerrar",
          cancelLabel: "Cerrar",
        });
      });
  }

  function promptForToken() {
    return window.sisopDialog
      .prompt({
        title: "Publicar mi escritorio",
        message:
          "Pegá tu token de GitHub (fine-grained, acotado a este repo, permiso Contents: Read and write).",
        value: getToken(),
        okLabel: "Guardar",
      })
      .then(function (t) {
        if (t) {
          setToken(t);
          return t;
        }
        return null;
      });
  }

  window.sisopPublish = {
    publish: publish,
    promptForToken: promptForToken,
    hasToken: function () {
      return !!getToken();
    },
  };

  // ---------------------------------------------------------------------
  // Disparador: Ctrl+Shift+P, no un ítem en el menú contextual del
  // escritorio — así un visitante cualquiera que hace clic derecho no se
  // encuentra con una opción de "Publicar" que no es para él. Reusa la
  // estética .ctxmenu ya definida en sisop.html (la misma que usa el menú
  // de clic derecho de sisop-user-files.js) para no inventar un look nuevo.
  // ---------------------------------------------------------------------
  function showPublishMenu() {
    var existing = document.querySelector(".ctxmenu.sisop-publish-menu");
    if (existing) existing.remove();

    var m = document.createElement("div");
    m.className = "ctxmenu sisop-publish-menu";
    [
      { label: "Publicar mi escritorio…", onClick: publish },
      { label: "Cambiar token de publicación…", onClick: promptForToken },
    ].forEach(function (en) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ctxmenu-item";
      b.textContent = en.label;
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        close();
        en.onClick();
      });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    var mw = m.offsetWidth,
      mh = m.offsetHeight;
    m.style.left = Math.max(4, (window.innerWidth - mw) / 2) + "px";
    m.style.top = Math.max(4, (window.innerHeight - mh) / 2) + "px";

    function close() {
      m.remove();
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onEsc, true);
    }
    function onOutside(e) {
      if (!m.contains(e.target)) close();
    }
    function onEsc(e) {
      if (e.key === "Escape") close();
    }
    setTimeout(function () {
      document.addEventListener("pointerdown", onOutside, true);
    }, 0);
    document.addEventListener("keydown", onEsc, true);
  }
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
      e.preventDefault();
      showPublishMenu();
    }
  });
})();
