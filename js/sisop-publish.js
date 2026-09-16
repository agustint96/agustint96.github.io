/* "Publicar mi escritorio": desde el propio navegador de Agus, sin pasar
 * por una terminal, sube el estado actual del escritorio (carpetas/notas/
 * archivos de sisop-user-files.js + el layout de sisop-desk-icons.js) al
 * repo de GitHub, para que sea el punto de partida que ve cualquier
 * visitante nuevo. Del otro lado lo consume syncPublished() en
 * sisop-user-files.js.
 *
 * El único control de acceso posible en un sitio 100% estático es "tener
 * el token": un fine-grained personal access token de GitHub, acotado a
 * este repo y sólo con permiso de Contents (read/write). Ese token es largo
 * y lo genera GitHub (no se puede reemplazar por una clave corta inventada:
 * es lo único que su API acepta) — pero sólo hace falta pegarlo una vez acá.
 * De ahí en más queda guardado CIFRADO en este navegador (AES-GCM vía
 * Web Crypto, PBKDF2 sobre el PIN), y lo que Agus escribe cada vez es un
 * PIN corto propio, nunca el token. El token descifrado sólo vive en
 * memoria de la pestaña (se pierde al recargar, hay que volver a poner el
 * PIN). Ctrl+Shift+P y el menú que abre (ver el final del archivo) tampoco
 * se pueden ocultar de un visitante cualquiera en un sitio estático, pero
 * sin el PIN correcto (que descifra un token que además tiene que ser
 * válido en GitHub) no consiguen nada.
 */
(function () {
  var OWNER = "agustint96";
  var REPO = "agustint96.github.io";
  var API_BASE =
    "https://api.github.com/repos/" + OWNER + "/" + REPO + "/contents/";
  var MANIFEST_PATH = "data/published-desktop.json";
  var FILES_DIR = "data/published-desktop-files";
  var TOKEN_ENC_KEY = "sisop.publish.token.enc.v1";
  var LEGACY_TOKEN_KEY = "sisop.publish.token.v1"; // versión anterior (texto plano, sin PIN), se migra y se borra

  var memToken = null; // token real ya descifrado, sólo en memoria de esta pestaña

  function hasStoredToken() {
    try {
      return !!localStorage.getItem(TOKEN_ENC_KEY);
    } catch (_) {
      return false;
    }
  }
  function forgetStoredToken() {
    memToken = null;
    try {
      localStorage.removeItem(TOKEN_ENC_KEY);
    } catch (_) {}
  }
  function legacyToken() {
    try {
      return localStorage.getItem(LEGACY_TOKEN_KEY) || "";
    } catch (_) {
      return "";
    }
  }
  function clearLegacyToken() {
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch (_) {}
  }

  // ---------------------------------------------------------------------
  // Cifrado del token con el PIN (Web Crypto: PBKDF2 -> AES-GCM). Un PIN
  // incorrecto simplemente hace fallar el decrypt (falla la verificación
  // del tag de GCM) — no hace falta guardar el PIN en ningún lado para
  // comparar, ni siquiera con hash.
  // ---------------------------------------------------------------------
  function bufToB64(bytes) {
    var bin = "";
    for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function b64ToBuf(b64) {
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  function deriveKey(pin, salt) {
    return crypto.subtle
      .importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"])
      .then(function (baseKey) {
        return crypto.subtle.deriveKey(
          { name: "PBKDF2", salt: salt, iterations: 150000, hash: "SHA-256" },
          baseKey,
          { name: "AES-GCM", length: 256 },
          false,
          ["encrypt", "decrypt"],
        );
      });
  }
  function encryptToken(token, pin) {
    var salt = crypto.getRandomValues(new Uint8Array(16));
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return deriveKey(pin, salt)
      .then(function (key) {
        return crypto.subtle.encrypt({ name: "AES-GCM", iv: iv }, key, new TextEncoder().encode(token));
      })
      .then(function (cipherBuf) {
        var blob = {
          salt: bufToB64(salt),
          iv: bufToB64(iv),
          data: bufToB64(new Uint8Array(cipherBuf)),
        };
        try {
          localStorage.setItem(TOKEN_ENC_KEY, JSON.stringify(blob));
        } catch (_) {
          /* sin localStorage: el token descifrado sigue en memoria para
             esta pestaña, pero no sobrevive a un reload */
        }
      });
  }
  function decryptToken(pin) {
    var raw = null;
    try {
      raw = localStorage.getItem(TOKEN_ENC_KEY);
    } catch (_) {}
    if (!raw) return Promise.reject(new Error("no hay token guardado"));
    var blob;
    try {
      blob = JSON.parse(raw);
    } catch (_) {
      return Promise.reject(new Error("token guardado corrupto"));
    }
    return deriveKey(pin, b64ToBuf(blob.salt))
      .then(function (key) {
        return crypto.subtle.decrypt({ name: "AES-GCM", iv: b64ToBuf(blob.iv) }, key, b64ToBuf(blob.data));
      })
      .then(function (plainBuf) {
        return new TextDecoder().decode(plainBuf);
      });
    // si el PIN es incorrecto, crypto.subtle.decrypt rechaza la promesa
    // (falla la verificación de integridad de AES-GCM) — no hace falta
    // detectarlo a mano.
  }

  // ---------------------------------------------------------------------
  // Flujo de alta/desbloqueo: la primera vez pide el token largo + un PIN
  // propio y los guarda cifrados; de ahí en más sólo pide el PIN. Si había
  // un token de la versión anterior (sin cifrar), lo migra pidiendo sólo
  // el PIN, sin obligar a pegar el token de nuevo.
  // ---------------------------------------------------------------------
  function setupToken() {
    return window.sisopDialog
      .prompt({
        title: "Publicar mi escritorio",
        message:
          "Pegá tu token de GitHub (fine-grained, acotado a este repo, permiso Contents: Read and write). Sólo hace falta esta vez.",
        okLabel: "Siguiente",
      })
      .then(function (token) {
        if (!token) return null;
        return choosePin(token);
      });
  }
  function choosePin(token) {
    return window.sisopDialog
      .prompt({
        title: "Publicar mi escritorio",
        message: "Elegí un PIN corto tuyo — lo vas a usar de acá en adelante en vez del token.",
        okLabel: "Guardar",
      })
      .then(function (pin) {
        if (!pin) return null;
        return encryptToken(token, pin).then(function () {
          clearLegacyToken();
          memToken = token;
          return token;
        });
      });
  }
  function unlockToken() {
    if (memToken) return Promise.resolve(memToken);
    if (!hasStoredToken()) {
      var legacy = legacyToken();
      if (legacy) {
        return window.sisopDialog
          .prompt({
            title: "Publicar mi escritorio",
            message: "Ya tenías un token guardado de antes. Elegí un PIN corto para no pegarlo de nuevo.",
            okLabel: "Guardar",
          })
          .then(function (pin) {
            if (!pin) return null;
            return encryptToken(legacy, pin).then(function () {
              clearLegacyToken();
              memToken = legacy;
              return legacy;
            });
          });
      }
      return setupToken();
    }
    return window.sisopDialog
      .prompt({ title: "Publicar mi escritorio", message: "PIN:", okLabel: "Desbloquear" })
      .then(function (pin) {
        if (!pin) return null;
        return decryptToken(pin)
          .then(function (token) {
            memToken = token;
            return token;
          })
          .catch(function () {
            return window.sisopDialog
              .confirm({
                title: "Publicar mi escritorio",
                message: "PIN incorrecto.\n¿Reintentar?",
                okLabel: "Reintentar",
                cancelLabel: "Cancelar",
              })
              .then(function (retry) {
                return retry ? unlockToken() : null;
              });
          });
      });
  }
  // "Cambiar token de publicación…": pisa lo guardado y arranca de cero
  // (token nuevo + PIN nuevo) — más simple que pedir el PIN viejo para
  // autorizar el cambio, y no hace falta: es tu propio navegador.
  function changeToken() {
    forgetStoredToken();
    return setupToken();
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
      // Video "por URL" (ver createRemoteVideo en sisop-user-files.js,
      // para películas que no tiene sentido subir al repo): no hay blob
      // que subir, el manifest apunta directo a esa URL externa.
      if (it.remoteUrl) out.remoteUrl = it.remoteUrl;
      else out.file = filePath;
    }
    if (it.type === "app") out.appId = it.appId;
    return out;
  }

  function publish() {
    return unlockToken().then(function (token) {
      if (!token) return; // canceló el PIN/token: no hace nada
      return doPublish(token);
    });
  }
  function doPublish(token) {
    var built = buildExport();
    // Los "video por URL" (remoteUrl) no tienen blob que subir -viven en
    // un storage externo, ver toManifestItem más abajo-, así que quedan
    // afuera de este loop de subida.
    var fileItems = built.items.filter(function (it) {
      return it.type === "file" && !it.remoteUrl;
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
              if (it.blob) return it.blob;
              // Ítem "seed" (sincronizado desde lo ya publicado, nunca
              // abierto en este navegador): sisop-user-files.js no le bajó
              // el contenido todavía (ver applyManifestItem, sólo lo hace
              // recién al abrirlo), así que se lo trae ahora para poder
              // republicarlo.
              return fetch(it.file).then(function (r) {
                return r.blob();
              });
            })
            .then(function (blob) {
              return blobToBase64(blob);
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
          hideCancel: true,
        });
      })
      .catch(function (err) {
        if (err && (err.status === 401 || err.status === 403)) {
          forgetStoredToken();
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
              return setupToken().then(function (t) {
                if (t) return doPublish(t);
              });
            });
        }
        return window.sisopDialog.confirm({
          title: "Publicar mi escritorio",
          message:
            "No se pudo publicar: " + (err && err.message ? err.message : "error desconocido"),
          okLabel: "Cerrar",
          hideCancel: true,
        });
      });
  }

  window.sisopPublish = {
    publish: publish,
    changeToken: changeToken,
    hasToken: function () {
      return !!memToken || hasStoredToken() || !!legacyToken();
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
    var buttons = [];
    [
      { label: "Publicar mi escritorio…", onClick: publish },
      { label: "Cambiar token de publicación…", onClick: changeToken },
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
      buttons.push(b);
      m.appendChild(b);
    });
    document.body.appendChild(m);
    var mw = m.offsetWidth,
      mh = m.offsetHeight;
    m.style.left = Math.max(4, (window.innerWidth - mw) / 2) + "px";
    m.style.top = Math.max(4, (window.innerHeight - mh) / 2) + "px";
    // "Publicar mi escritorio…" arranca enfocado: Enter la dispara directo
    // (es el <button> nativo), y las flechas mueven el foco entre las dos.
    buttons[0].focus();

    function close() {
      m.remove();
      document.removeEventListener("pointerdown", onOutside, true);
      document.removeEventListener("keydown", onKey, true);
    }
    function onOutside(e) {
      if (!m.contains(e.target)) close();
    }
    function onKey(e) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      e.preventDefault();
      var idx = buttons.indexOf(document.activeElement);
      if (idx === -1) idx = 0;
      var next =
        e.key === "ArrowDown"
          ? buttons[(idx + 1) % buttons.length]
          : buttons[(idx - 1 + buttons.length) % buttons.length];
      next.focus();
    }
    setTimeout(function () {
      document.addEventListener("pointerdown", onOutside, true);
    }, 0);
    document.addEventListener("keydown", onKey, true);
  }
  document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p")) {
      e.preventDefault();
      showPublishMenu();
    }
  });
})();
