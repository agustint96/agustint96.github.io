/* Escritorio: clic derecho para crear carpetas, notas y subir archivos
 * propios (fotos, audio, lo que sea). Todo queda guardado en el navegador
 * (IndexedDB) — privado de quien lo crea, igual que las notas post-it, el
 * layout de iconos o los cambios en la consola SQL. No hay servidor: nada
 * de esto le llega a Agus ni a nadie más, y si se borran los datos del
 * sitio (o se entra desde otro dispositivo/navegador) se pierde.
 *
 * Reusa la mecánica de ventanas de sisop-sqlconsole.js a través de
 * window.sisopWin (registerApp/open/close con type:"custom") y la
 * cuadrícula de iconos de sisop-desk-icons.js a través de window.deskIcons
 * (add/remove) — este archivo sólo aporta el modelo de datos, el menú
 * contextual y cómo se ve cada tipo de ítem.
 */
(function () {
  var MAX_FILE_BYTES = 15 * 1024 * 1024; // 15 MB por archivo

  var DB_NAME = "sisop-user-files";
  var DB_VERSION = 1;
  var STORE = "items";

  // ---------------------------------------------------------------------
  // IndexedDB: una sola tabla "items", cada fila es una carpeta, una nota
  // o un archivo. `parent` = "root" (escritorio) o el id de otra carpeta.
  // ---------------------------------------------------------------------
  var dbPromise = null;
  function openDB() {
    if (!window.indexedDB) return Promise.reject(new Error("no indexeddb"));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          var os = db.createObjectStore(STORE, { keyPath: "id" });
          os.createIndex("parent", "parent");
        }
      };
      req.onsuccess = function () {
        resolve(req.result);
      };
      req.onerror = function () {
        reject(req.error);
      };
    });
    return dbPromise;
  }
  function dbGetAll() {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function () {
          resolve(req.result || []);
        };
        req.onerror = function () {
          reject(req.error);
        };
      });
    });
  }
  function dbPut(item) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(item);
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }
  function dbDelete(id) {
    return openDB().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () {
          resolve();
        };
        tx.onerror = function () {
          reject(tx.error);
        };
      });
    });
  }

  var itemsById = {};
  function allItems() {
    return Object.keys(itemsById).map(function (k) {
      return itemsById[k];
    });
  }
  function newId() {
    return (
      "uf" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
    );
  }
  function fmtSize(n) {
    if (n < 1024) return n + " B";
    if (n < 1024 * 1024) return Math.round(n / 1024) + " KB";
    return (n / 1024 / 1024).toFixed(1) + " MB";
  }

  // ---------------------------------------------------------------------
  // Glifos (mismo estilo que los del resto del sisop)
  // ---------------------------------------------------------------------
  var SVG = {
    folder:
      '<svg viewBox="0 0 32 32" aria-hidden="true">' +
      '<path d="M2.5 7.5h9l2.5 3H29a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 29 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#e0a53c" stroke="#6f5016" stroke-width="1.2"/>' +
      '<path d="M2.5 12.5h27a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 29.5 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#f6cf6e" stroke="#6f5016" stroke-width="1.2"/></svg>',
    note:
      '<svg viewBox="0 0 32 32" aria-hidden="true">' +
      '<path d="M5 4h16l6 6v18H5z" fill="#f6e06a" stroke="#9a8419" stroke-width="1.2"/>' +
      '<path d="M21 4l6 6h-6z" fill="#d9c24e" stroke="#9a8419" stroke-width="1.2"/>' +
      '<path d="M9 14h11M9 18h11M9 22h7" stroke="#6f5d13" stroke-width="1.6" stroke-linecap="round"/></svg>',
    file:
      '<svg viewBox="0 0 32 32" aria-hidden="true">' +
      '<path d="M8 3h11l5 5v21a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="#f0ece4" stroke="#2f4467" stroke-width="1.3"/>' +
      '<path d="M19 3v5h5" fill="none" stroke="#2f4467" stroke-width="1.3"/>' +
      '<path d="M11 15h10M11 18.5h10M11 22h6" stroke="#2f4467" stroke-width="1.6" stroke-linecap="round"/></svg>',
    audio:
      '<svg viewBox="0 0 32 32" aria-hidden="true">' +
      '<path d="M8 3h11l5 5v21a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="#f0ece4" stroke="#2f4467" stroke-width="1.3"/>' +
      '<path d="M19 3v5h5" fill="none" stroke="#2f4467" stroke-width="1.3"/>' +
      '<path d="M14 24v-8l6-1.5V22" fill="none" stroke="#2f4467" stroke-width="1.6" stroke-linecap="round"/>' +
      '<circle cx="12.4" cy="24.1" r="2" fill="#f19280"/><circle cx="18.4" cy="22.6" r="2" fill="#f19280"/></svg>',
    image:
      '<svg viewBox="0 0 32 32" aria-hidden="true">' +
      '<rect x="3" y="6" width="26" height="20" rx="1.5" fill="#f0ece4" stroke="#2f4467" stroke-width="1.3"/>' +
      '<circle cx="11" cy="13" r="2.6" fill="#f19280"/>' +
      '<path d="M5 24l7-8 5 5 4-3 6 6z" fill="#7eb8c9"/></svg>',
  };
  function glyphFor(item) {
    if (item.type === "folder") return SVG.folder;
    if (item.type === "note") return SVG.note;
    if (item.mime && item.mime.indexOf("image/") === 0) return SVG.image;
    if (item.mime && item.mime.indexOf("audio/") === 0) return SVG.audio;
    return SVG.file;
  }
  function isImageItem(item) {
    return item.type === "file" && item.mime && item.mime.indexOf("image/") === 0;
  }
  function isAudioItem(item) {
    return item.type === "file" && item.mime && item.mime.indexOf("audio/") === 0;
  }
  function setThumbnail(el, item) {
    try {
      var url = URL.createObjectURL(item.blob);
      var img = document.createElement("img");
      img.className = "ufi-thumb";
      img.alt = "";
      img.src = url;
      var old = el.querySelector("svg");
      if (old) old.replaceWith(img);
    } catch (_) {
      /* si falla, se queda con el glifo genérico */
    }
  }

  // ---------------------------------------------------------------------
  // Menú contextual genérico
  // ---------------------------------------------------------------------
  var menuEl = null;
  function closeMenu() {
    if (!menuEl) return;
    menuEl.remove();
    menuEl = null;
    document.removeEventListener("pointerdown", onOutside, true);
  }
  function onOutside(e) {
    if (menuEl && !menuEl.contains(e.target)) closeMenu();
  }
  function showMenu(x, y, entries) {
    closeMenu();
    var m = document.createElement("div");
    m.className = "ctxmenu";
    entries.forEach(function (en) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "ctxmenu-item";
      b.textContent = en.label;
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        closeMenu();
        en.onClick();
      });
      m.appendChild(b);
    });
    document.body.appendChild(m);
    var mw = m.offsetWidth,
      mh = m.offsetHeight;
    m.style.left = Math.max(4, Math.min(x, window.innerWidth - mw - 4)) + "px";
    m.style.top = Math.max(4, Math.min(y, window.innerHeight - mh - 4)) + "px";
    menuEl = m;
    setTimeout(function () {
      document.addEventListener("pointerdown", onOutside, true);
    }, 0);
  }
  function showCreateMenu(x, y, parentId, onChange) {
    showMenu(x, y, [
      {
        label: "Nueva carpeta",
        onClick: function () {
          createFolder(parentId, onChange);
        },
      },
      {
        label: "Nota",
        onClick: function () {
          createNote(parentId, onChange);
        },
      },
      {
        label: "Cargar archivo…",
        onClick: function () {
          pickFiles(parentId, onChange);
        },
      },
    ]);
  }
  function showItemMenu(x, y, item, onChange) {
    showMenu(x, y, [
      {
        label: "Renombrar",
        onClick: function () {
          renameItem(item, onChange);
        },
      },
      {
        label: "Eliminar",
        onClick: function () {
          deleteItem(item, onChange);
        },
      },
    ]);
  }

  // ---------------------------------------------------------------------
  // Crear / renombrar / eliminar
  // ---------------------------------------------------------------------
  function createFolder(parentId, onChange) {
    var item = {
      id: newId(),
      parent: parentId,
      type: "folder",
      name: "Nueva carpeta",
      createdAt: Date.now(),
    };
    itemsById[item.id] = item;
    dbPut(item).then(function () {
      if (parentId === "root") addDeskIconFor(item);
      if (onChange) onChange();
    });
  }
  function createNote(parentId, onChange) {
    var item = {
      id: newId(),
      parent: parentId,
      type: "note",
      name: "Nota",
      text: "",
      createdAt: Date.now(),
    };
    itemsById[item.id] = item;
    dbPut(item).then(function () {
      if (parentId === "root") addDeskIconFor(item);
      if (onChange) onChange();
    });
  }
  function pickFiles(parentId, onChange) {
    var input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.style.display = "none";
    document.body.appendChild(input);
    input.addEventListener("change", function () {
      var files = [].slice.call(input.files || []);
      input.remove();
      files.forEach(function (f) {
        if (f.size > MAX_FILE_BYTES) {
          alert(
            '"' +
              f.name +
              '" pesa ' +
              fmtSize(f.size) +
              ", más del máximo (" +
              fmtSize(MAX_FILE_BYTES) +
              "). No se subió.",
          );
          return;
        }
        var item = {
          id: newId(),
          parent: parentId,
          type: "file",
          name: f.name || "archivo",
          mime: f.type || "",
          size: f.size,
          blob: f,
          createdAt: Date.now(),
        };
        itemsById[item.id] = item;
        dbPut(item).then(function () {
          if (parentId === "root") addDeskIconFor(item);
          if (onChange) onChange();
        });
      });
    });
    input.click();
  }
  function renameItem(item, onDone) {
    var name = prompt("Nuevo nombre:", item.name);
    if (name === null) return;
    name = name.trim();
    if (!name) return;
    item.name = name;
    dbPut(item).then(function () {
      var winEl = document.querySelector(
        '.w98win[data-app="uf:' + item.id + '"] .tb-text',
      );
      if (winEl) winEl.textContent = name;
      if (onDone) onDone();
    });
  }
  function collectWithDescendants(id) {
    var result = [id];
    allItems().forEach(function (it) {
      if (it.parent === id) result = result.concat(collectWithDescendants(it.id));
    });
    return result;
  }
  function deleteItem(item, onDone) {
    var msg =
      item.type === "folder"
        ? 'Eliminar "' + item.name + '" y todo lo que tiene adentro?'
        : 'Eliminar "' + item.name + '"?';
    if (!confirm(msg)) return;
    var ids = collectWithDescendants(item.id);
    Promise.all(
      ids.map(function (id) {
        return dbDelete(id);
      }),
    ).then(function () {
      ids.forEach(function (id) {
        if (window.sisopWin && window.sisopWin.isOpen("uf:" + id))
          window.sisopWin.close("uf:" + id);
        delete itemsById[id];
      });
      if (item.parent === "root") {
        var el = document.querySelector(
          '.desk-icon[data-user-item="' + item.id + '"]',
        );
        if (el) {
          if (window.deskIcons) window.deskIcons.remove(el);
          el.remove();
        }
      }
      if (onDone) onDone();
    });
  }

  // ---------------------------------------------------------------------
  // Íconos: uno para el escritorio (.desk-icon) y otro para adentro de una
  // carpeta (.folder-icon, mismo look que Juegos/Pags Web/etc).
  // ---------------------------------------------------------------------
  function wireItemIcon(el, item, refreshParent) {
    el.addEventListener("click", function (e) {
      e.stopPropagation();
      document
        .querySelectorAll(".desk-icon.selected, .folder-icon.selected")
        .forEach(function (x) {
          if (x !== el) x.classList.remove("selected");
        });
      el.classList.toggle("selected");
    });
    el.addEventListener("dblclick", function () {
      openItem(item);
    });
    el.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openItem(item);
      }
    });
    el.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      e.stopPropagation();
      showItemMenu(e.clientX, e.clientY, item, function () {
        var label = el.querySelector(".fi-label, span:last-child");
        if (label) label.textContent = item.name;
        if (refreshParent) refreshParent();
      });
    });
  }
  function buildDeskIcon(item) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "desk-icon";
    b.setAttribute("data-user-item", item.id);
    b.title = "Doble clic para abrir";
    b.setAttribute("aria-label", item.name + " (doble clic para abrir)");
    b.innerHTML = glyphFor(item) + "<span></span>";
    b.querySelector("span").textContent = item.name;
    wireItemIcon(b, item, null);
    if (isImageItem(item)) setThumbnail(b, item);
    return b;
  }
  function buildFolderIcon(item, refreshParent) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "folder-icon";
    b.innerHTML =
      '<span class="fi-glyph">' +
      glyphFor(item) +
      '</span><span class="fi-label"></span>';
    b.querySelector(".fi-label").textContent = item.name;
    wireItemIcon(b, item, refreshParent);
    if (isImageItem(item)) setThumbnail(b, item);
    return b;
  }
  function addDeskIconFor(item) {
    var desk = document.getElementById("desk");
    if (!desk) return;
    var el = buildDeskIcon(item);
    desk.appendChild(el);
    if (window.deskIcons) window.deskIcons.add(el);
  }

  // ---------------------------------------------------------------------
  // Abrir cada tipo de ítem (ventanas w98 reales, vía window.sisopWin)
  // ---------------------------------------------------------------------
  function openItem(item) {
    if (!window.sisopWin) return;
    if (item.type === "folder") return openFolder(item);
    if (item.type === "note") return openNote(item);
    return openFile(item);
  }
  function renderFolderBody(bd, folderId) {
    var grid = document.createElement("div");
    grid.className = "w98-folder";
    bd.appendChild(grid);

    function refresh() {
      grid.innerHTML = "";
      var children = allItems().filter(function (it) {
        return it.parent === folderId;
      });
      if (!children.length) {
        var empty = document.createElement("div");
        empty.className = "w98-empty";
        empty.textContent = "Carpeta vacía. Clic derecho para agregar algo.";
        grid.appendChild(empty);
        return;
      }
      children.forEach(function (it) {
        grid.appendChild(buildFolderIcon(it, refresh));
      });
    }
    refresh();

    grid.addEventListener("contextmenu", function (e) {
      if (e.target.closest(".folder-icon")) return;
      e.preventDefault();
      showCreateMenu(e.clientX, e.clientY, folderId, refresh);
    });
  }
  function openFolder(item) {
    var appId = "uf:" + item.id;
    window.sisopWin.registerApp(appId, {
      title: item.name,
      iconHtml: SVG.folder,
      type: "custom",
      w: 460,
      h: 340,
      transient: true,
      render: function (bd) {
        renderFolderBody(bd, item.id);
      },
    });
    window.sisopWin.open(appId);
  }
  function openNote(item) {
    var appId = "uf:" + item.id;
    window.sisopWin.registerApp(appId, {
      title: item.name,
      iconHtml: SVG.note,
      type: "custom",
      w: 280,
      h: 260,
      transient: true,
      render: function (bd) {
        var wrap = document.createElement("div");
        wrap.className = "notes-app";
        var ta = document.createElement("textarea");
        ta.spellcheck = false;
        ta.setAttribute("autocomplete", "off");
        ta.placeholder = "Escribí algo…";
        ta.value = item.text || "";
        wrap.appendChild(ta);
        bd.appendChild(wrap);
        var saveTimer = null;
        ta.addEventListener("input", function () {
          clearTimeout(saveTimer);
          saveTimer = setTimeout(function () {
            item.text = ta.value;
            dbPut(item);
          }, 400);
        });
        setTimeout(function () {
          ta.focus();
        }, 30);
      },
    });
    window.sisopWin.open(appId);
  }
  function openFile(item) {
    var appId = "uf:" + item.id;
    var img = isImageItem(item);
    var audio = isAudioItem(item);
    window.sisopWin.registerApp(appId, {
      title: item.name,
      iconHtml: img ? SVG.image : audio ? SVG.audio : SVG.file,
      type: "custom",
      w: img ? 640 : 420,
      h: img ? 500 : 190,
      transient: true,
      render: function (bd) {
        var url = URL.createObjectURL(item.blob);
        if (img) {
          var v = document.createElement("div");
          v.className = "w98-imgview";
          var im = document.createElement("img");
          im.src = url;
          im.alt = item.name;
          v.appendChild(im);
          bd.appendChild(v);
        } else if (audio) {
          var wrap = document.createElement("div");
          wrap.className = "uf-audio";
          var name = document.createElement("p");
          name.className = "uf-audio-name";
          name.textContent = item.name;
          var player = document.createElement("audio");
          player.controls = true;
          player.src = url;
          wrap.appendChild(name);
          wrap.appendChild(player);
          bd.appendChild(wrap);
        } else {
          var g = document.createElement("div");
          g.className = "uf-generic";
          var n2 = document.createElement("p");
          n2.className = "uf-generic-name";
          n2.textContent = item.name;
          var meta = document.createElement("p");
          meta.className = "uf-generic-meta";
          meta.textContent = fmtSize(item.size) + (item.mime ? " · " + item.mime : "");
          var a = document.createElement("a");
          a.className = "btn primary";
          a.href = url;
          a.download = item.name;
          a.textContent = "Descargar";
          g.appendChild(n2);
          g.appendChild(meta);
          g.appendChild(a);
          bd.appendChild(g);
        }
      },
    });
    window.sisopWin.open(appId);
  }

  // ---------------------------------------------------------------------
  // Arranque: cargar lo guardado y colgar el menú contextual del escritorio
  // ---------------------------------------------------------------------
  function boot() {
    var desk = document.getElementById("desk");
    if (desk) {
      desk.addEventListener("contextmenu", function (e) {
        if (e.target.closest(".desk-icon")) return;
        e.preventDefault();
        showCreateMenu(e.clientX, e.clientY, "root", null);
      });
    }
    dbGetAll()
      .then(function (items) {
        items.forEach(function (it) {
          itemsById[it.id] = it;
        });
        items
          .filter(function (it) {
            return it.parent === "root";
          })
          .forEach(addDeskIconFor);
      })
      .catch(function () {
        /* IndexedDB no disponible: el menú de crear sigue funcionando en la
           sesión actual, sólo que nada queda guardado al recargar. */
      });
  }
  boot();
})();
