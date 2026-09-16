/* Gestor genérico de ventanas del escritorio: crea, arrastra, minimiza,
 * maximiza y da foco/z-order a cada "programa" (carpetas, Fotos, Música,
 * Notas, post-its, y cualquier ventana que otro módulo registre vía
 * window.sisopWin.registerApp). Separado de sisop-sqlconsole.js: ese
 * archivo es la app "Consola SQL" en sí; este es la infraestructura de
 * ventanas de la que dependen TODAS las apps (paint, explorador de
 * archivos, publish, reproductor de video), y por eso se carga antes que
 * ellas. La única pieza que sigue viviendo en sisop-sqlconsole.js es el
 * arrastre/min/max de la propia ventana de la consola (#win): eso es UI
 * propia de esa app, no del gestor genérico. */
(function () {
  "use strict";

  var $ = function (id) {
    return document.getElementById(id);
  };
  // Duplicado a propósito (igual que $ arriba): es la misma función de una
  // línea que ya tiene sisop-sqlconsole.js, la usa plainToRich() más abajo.
  function esc(v) {
    return String(v).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[
        ch
      ];
    });
  }
  // La ventana de la consola SQL (#win) también entra en el z-order y el
  // foco compartido de este gestor (ver normalizeZ/bringToFront más abajo),
  // aunque su arrastre/min/max lo maneje sisop-sqlconsole.js por su cuenta.
  var win = $("win");

  // Las define stickyNotes(); las usa la app «Notas».
  var agregarNota = null;
  var notasBienvenida = null;

  /* ---------- Texto enriquecido (negrita / subrayado / tachado) ----------
   *  Usan esto los post-its y la caja de la app «Notas»: Ctrl+B, Ctrl+U y
   *  Ctrl+Shift+X sobre el texto seleccionado en un <div contenteditable>.
   *  Lo que se persiste es HTML saneado a sólo <b>/<u>/<s>/<br> -nunca
   *  clases, estilos ni etiquetas pegadas desde afuera. */
  var RT_BLOCK_TAGS = { DIV: 1, P: 1 };
  function sanitizeRichText(html) {
    function stripAttrs(el) {
      while (el.attributes.length) el.removeAttribute(el.attributes[0].name);
    }
    function replaceTag(el, tagName) {
      var r = document.createElement(tagName);
      while (el.firstChild) r.appendChild(el.firstChild);
      el.parentNode.replaceChild(r, el);
    }
    function unwrap(el) {
      while (el.firstChild) el.parentNode.insertBefore(el.firstChild, el);
      el.parentNode.removeChild(el);
    }
    function walk(node) {
      var child = node.firstChild;
      while (child) {
        var next = child.nextSibling;
        if (child.nodeType === 1) {
          walk(child);
          var tag = child.tagName;
          if (tag === "B" || tag === "STRONG") replaceTag(child, "b");
          else if (tag === "U") replaceTag(child, "u");
          else if (tag === "S" || tag === "STRIKE") replaceTag(child, "s");
          else if (tag === "BR") stripAttrs(child);
          else {
            // Bloque (DIV/P) u otra etiqueta ajena: si era un bloque y no
            // es el primer nodo, se agrega un salto antes de desenvolverlo
            // para no perder el corte de línea al aplanar la estructura.
            if (RT_BLOCK_TAGS[tag] && child.previousSibling) {
              node.insertBefore(document.createElement("br"), child);
            }
            unwrap(child);
          }
        } else if (child.nodeType !== 3) {
          node.removeChild(child);
        }
        child = next;
      }
    }
    var root = document.createElement("div");
    root.innerHTML = html || "";
    walk(root);
    return root.innerHTML;
  }
  function richTextToPlain(html) {
    var root = document.createElement("div");
    root.innerHTML = html || "";
    root.querySelectorAll("br").forEach(function (br) {
      br.replaceWith("\n");
    });
    return root.textContent || "";
  }
  function plainToRich(text) {
    return esc(String(text || "")).replace(/\r\n|\r|\n/g, "<br>");
  }
  /* true si aplicó un atajo de formato (el llamador debe preventDefault) */
  function applyRichShortcut(e) {
    var mod = e.ctrlKey || e.metaKey;
    if (!mod || e.altKey) return false;
    var key = e.key.toLowerCase();
    if (!e.shiftKey && key === "b") {
      document.execCommand("bold");
      return true;
    }
    if (!e.shiftKey && key === "u") {
      document.execCommand("underline");
      return true;
    }
    if (e.shiftKey && key === "x") {
      document.execCommand("strikeThrough");
      return true;
    }
    return false;
  }
  /* Pegar siempre como texto plano: el formato sólo se agrega con los
     atajos de arriba, nunca copiando estilos de afuera. */
  function pasteAsPlainText(e) {
    e.preventDefault();
    var clip = e.clipboardData || window.clipboardData;
    var plain = clip ? clip.getData("text/plain") : "";
    document.execCommand("insertText", false, plain);
  }
  window.sisopRichText = {
    sanitize: sanitizeRichText,
    toPlain: richTextToPlain,
    fromPlain: plainToRich,
  };

  /* ============================================================
   *  Escritorio: carpetas «Juegos», «Pags Web», «FOTOS» y «Música»,
   *  cada una en su ventana estilo Windows 98.
   * ============================================================ */
  (function desktop98() {
    var tasksEl = $("tasks");
    var zTop = 20;

    var ICONS = {
      folder:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<path d="M2.5 7.5h9l2.5 3H29a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 29 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#e0a53c" stroke="#6f5016" stroke-width="1.2"/>' +
        '<path d="M2.5 12.5h27a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 29.5 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#f6cf6e" stroke="#6f5016" stroke-width="1.2"/></svg>',
      pagsweb:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<path d="M2.5 7.5h9l2.5 3H29a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 29 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#e0a53c" stroke="#6f5016" stroke-width="1.2"/>' +
        '<path d="M2.5 12.5h27a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 29.5 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#f6cf6e" stroke="#6f5016" stroke-width="1.2"/>' +
        '<path d="M9.5 24.4c3.4-3.2 9.6-3.2 13 0" fill="none" stroke="#7eb8c9" stroke-width="1.7" stroke-linecap="round"/>' +
        '<path d="M10.3 23.6c3-2.2 8.4-2.2 11.4 0" fill="none" stroke="#f19280" stroke-width="1.1" stroke-linecap="round"/>' +
        '<rect x="9.5" y="14" width="13" height="8.5" rx="1" fill="#f0ece4" stroke="#6f5016" stroke-width="1.1"/>' +
        '<path d="M9.5 16.6h13" stroke="#6f5016" stroke-width="1"/>' +
        '<circle cx="11.2" cy="15.3" r="0.65" fill="#f19280"/><circle cx="13" cy="15.3" r="0.65" fill="#7eb8c9"/></svg>',
      web:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<circle cx="16" cy="16" r="12" fill="#7eb8c9" stroke="#2f4467" stroke-width="1.3"/>' +
        '<path d="M4 16h24M16 4c4.5 3.8 4.5 20.2 0 24M16 4c-4.5 3.8-4.5 20.2 0 24M6.5 9.5c6 3.1 13 3.1 19 0M6.5 22.5c6-3.1 13-3.1 19 0" fill="none" stroke="#22384f" stroke-width="1"/></svg>',
      game:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<rect x="3" y="10" width="26" height="13" rx="6.5" fill="#5a6b8c" stroke="#232f47" stroke-width="1.3"/>' +
        '<path d="M8 13.6v5.8M5.1 16.5h5.8" stroke="#f0ece4" stroke-width="1.8" stroke-linecap="round"/>' +
        '<circle cx="21" cy="14.6" r="1.7" fill="#f19280"/><circle cx="24.4" cy="17.8" r="1.7" fill="#7eb8c9"/></svg>',
      photo:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<rect x="3" y="6" width="26" height="20" rx="1.5" fill="#f0ece4" stroke="#2f4467" stroke-width="1.3"/>' +
        '<circle cx="11" cy="13" r="2.6" fill="#f19280"/>' +
        '<path d="M5 24l7-8 5 5 4-3 6 6z" fill="#7eb8c9"/></svg>',
      music:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<path d="M2.5 7.5h9l2.5 3H29a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 29 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#5f8f9c" stroke="#2c4750" stroke-width="1.2"/>' +
        '<path d="M2.5 12.5h27a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 29.5 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#8fc0cc" stroke="#2c4750" stroke-width="1.2"/>' +
        '<path d="M15 23.5v-7l6-1.5v7" fill="none" stroke="#f19280" stroke-width="1.6" stroke-linecap="round"/>' +
        '<circle cx="13.4" cy="23.6" r="1.9" fill="#f19280"/><circle cx="19.4" cy="22.1" r="1.9" fill="#f19280"/></svg>',
      mp3:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<path d="M8 3h11l5 5v21a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="#f0ece4" stroke="#2f4467" stroke-width="1.3"/>' +
        '<path d="M19 3v5h5" fill="none" stroke="#2f4467" stroke-width="1.3"/>' +
        '<path d="M14 24v-8l6-1.5V22" fill="none" stroke="#f19280" stroke-width="1.6" stroke-linecap="round"/>' +
        '<circle cx="12.4" cy="24.1" r="2" fill="#f19280"/><circle cx="18.4" cy="22.6" r="2" fill="#f19280"/></svg>',
      note:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<path d="M5 4h16l6 6v18H5z" fill="#f6e06a" stroke="#9a8419" stroke-width="1.2"/>' +
        '<path d="M21 4l6 6h-6z" fill="#d9c24e" stroke="#9a8419" stroke-width="1.2"/>' +
        '<path d="M9 14h11M9 18h11M9 22h7" stroke="#6f5d13" stroke-width="1.6" stroke-linecap="round"/></svg>',
      pdf:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<path d="M8 3h11l5 5v21a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="#f0ece4" stroke="#9a3232" stroke-width="1.3"/>' +
        '<path d="M19 3v5h5" fill="none" stroke="#9a3232" stroke-width="1.3"/>' +
        '<path d="M11 15h10M11 18.5h10M11 22h6" stroke="#9a3232" stroke-width="1.6" stroke-linecap="round"/></svg>',
      /* Mismos dibujos que los íconos de escritorio de «Juegos» y «FOTOS»,
         para que la ventana y la taskbar repitan ese ícono en vez de uno
         genérico de carpeta. */
      juegos:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<path d="M2.5 7.5h9l2.5 3H29a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 29 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#7a6cae" stroke="#3b3363" stroke-width="1.2"/>' +
        '<path d="M2.5 12.5h27a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 29.5 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#a99ed6" stroke="#3b3363" stroke-width="1.2"/>' +
        '<rect x="8" y="15" width="16" height="9" rx="4.5" fill="#4a4270" stroke="#2a244a" stroke-width="1.1"/>' +
        '<path d="M12 18v3M10.5 19.5h3" stroke="#f0ece4" stroke-width="1.5" stroke-linecap="round"/>' +
        '<circle cx="19.2" cy="18.6" r="1.4" fill="#f19280"/><circle cx="21.6" cy="21" r="1.4" fill="#7eb8c9"/></svg>',
      fotos:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<path d="M2.5 7.5h9l2.5 3H29a1.5 1.5 0 0 1 1.5 1.5v13A1.5 1.5 0 0 1 29 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#c98a5b" stroke="#5c3b22" stroke-width="1.2"/>' +
        '<path d="M2.5 12.5h27a1.5 1.5 0 0 1 1.5 1.5v11A1.5 1.5 0 0 1 29.5 26.5H4A1.5 1.5 0 0 1 2.5 25z" fill="#e6b88b" stroke="#5c3b22" stroke-width="1.2"/>' +
        '<rect x="9" y="14.5" width="14" height="9.5" rx="1" fill="#f0ece4"/>' +
        '<circle cx="12.6" cy="17.6" r="1.5" fill="#f19280"/>' +
        '<path d="M9.5 24l4-4 3 2.5 2.5-2 3.5 3.5z" fill="#7eb8c9"/></svg>',
      /* Documento con flechas circulares (conversion) para Formator, ver
         APPS.formator mas abajo. */
      formator:
        '<svg viewBox="0 0 32 32" aria-hidden="true">' +
        '<path d="M8 3h11l5 5v21a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" fill="#f7f5ef" stroke="#1b1b18" stroke-width="1.3"/>' +
        '<path d="M19 3v5h5" fill="none" stroke="#1b1b18" stroke-width="1.3"/>' +
        '<path d="M11.5 18.5a5 5 0 0 1 8.3-3.7" fill="none" stroke="#2f5fa8" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M19.2 13.4l1-3.2 2.9 1.4" fill="none" stroke="#2f5fa8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>' +
        '<path d="M20.5 19.5a5 5 0 0 1-8.3 3.7" fill="none" stroke="#808076" stroke-width="1.8" stroke-linecap="round"/>' +
        '<path d="M12.8 24.6l-1-3.2-2.9 1.4" fill="none" stroke="#808076" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    };

    var SITE_W = 1000;
    var SITE_H = 660;

    var APPS = {
      notas: {
        title: "Notas",
        icon: "note",
        type: "notes",
        w: 260,
        h: 240,
      },
      grabadora: {
        title: "Grabadora",
        iconHtml:
          '<img src="ico/grabadora.webp" alt="" style="width:100%;height:100%;object-fit:contain;display:block;">',
        type: "recorder",
        w: 340,
        h: 508,
      },
      cv: {
        title: "CV_Agustin_Tardella.pdf",
        icon: "pdf",
        type: "iframe",
        url: "CV_Agustin_Tardella.pdf",
        w: SITE_W,
        h: SITE_H,
      },
      casus: {
        title: "Casus Liber",
        icon: "game",
        type: "iframe",
        url: "https://agustint96.github.io/Casusliber/",
        w: 760,
        h: 580,
        game: true,
      },
      juegos: {
        title: "Juegos",
        icon: "juegos",
        type: "folder",
        w: 360,
        h: 260,
        items: ["casus", "figuritas"],
      },
      pagsweb: {
        title: "Pags Web",
        icon: "pagsweb",
        type: "folder",
        w: 470,
        h: 340,
        items: [
          "negracafe",
          "ummep",
          "cooplegal",
          "tesisadn",
          "albumedia",
          "chispa",
        ],
      },
      fotos: {
        title: "FOTOS",
        icon: "fotos",
        type: "photos",
        w: 540,
        h: 410,
      },
      negracafe: {
        title: "NegraCafe",
        icon: "web",
        type: "iframe",
        url: "https://agustint96.github.io/NegraCafe/",
        w: SITE_W,
        h: SITE_H,
      },
      ummep: {
        title: "Fundación UMMEP",
        icon: "web",
        type: "iframe",
        url: "https://agustint96.github.io/FundacionUMMEP/",
        w: SITE_W,
        h: SITE_H,
      },
      cooplegal: {
        title: "CoopLegal",
        icon: "web",
        type: "iframe",
        url: "https://agustint96.github.io/CoopLegal/",
        w: SITE_W,
        h: SITE_H,
      },
      tesisadn: {
        title: "Tesis ADN",
        icon: "web",
        type: "iframe",
        url: "https://agustint96.github.io/tesisADN/",
        w: SITE_W,
        h: SITE_H,
      },
      albumedia: {
        title: "Albumedia",
        icon: "web",
        type: "iframe",
        url: "https://agustint96.github.io/albumedia/",
        w: SITE_W,
        h: SITE_H,
      },
      chispa: {
        title: "La Chispa Radio",
        icon: "web",
        type: "iframe",
        url: "https://agustint96.github.io/La_Chispa_Radio/",
        w: SITE_W,
        h: SITE_H,
      },
      figuritas: {
        title: "Figuritas",
        icon: "game",
        type: "iframe",
        url: "https://agustint96.github.io/figuritas/",
        w: 840,
        h: 640,
        game: true,
      },
      formator: {
        title: "Formator",
        icon: "formator",
        type: "iframe",
        url: "https://conversor-archivos-acjs.onrender.com/",
        w: SITE_W,
        h: SITE_H,
      },
    };

    /* Carpeta «Música»: cada archivo .mp3 abre el reproductor
       embebido (API del widget) de esa canción en soundcloud.com/agust1 */
    var TRACKS = [
      [
        2156319342,
        "Cover de Polyphonic Sprees",
        "cover-de-polyphonic-sprees",
      ],
      [1993346843, "Bj (1) 01", "bj-1-01"],
      [1788848782, "Eclipsis", "eclipsis"],
      [1716591981, "Reggae Mezcla", "reggae-mezcla"],
      [1716585813, "Intro", "intro"],
      [1716585792, "Reggae de manu", "reggae-de-manu"],
      [1716585690, "Bajon", "bajon"],
      [413677962, "in ut", "in-ut"],
      [404283990, "a", "aaa"],
      [404283942, "ɐ", "ufcyfxhgfkej"],
      [404278896, "s a u d a d e", "s-a-u-d-a-d-e"],
      [277748892, "*#$%", "vtnjccoe0etm"],
      [252209588, "Crisol", "crisol"],
      [245642502, "Maria va", "maria-va"],
    ];
    TRACKS.forEach(function (t) {
      APPS["tr" + t[0]] = {
        title: t[1] + ".mp3",
        icon: "mp3",
        type: "iframe",
        linkUrl: "https://soundcloud.com/agust1/" + t[2],
        url:
          "https://w.soundcloud.com/player/?url=https%3A%2F%2Fapi.soundcloud.com%2Ftracks%2F" +
          t[0] +
          "&color=%230d1b2e&auto_play=false&hide_related=true" +
          "&show_comments=false&show_user=true&show_reposts=false" +
          "&show_teaser=false&visual=false&buying=false&sharing=false&download=false",
        w: 520,
        h: 200,
      };
    });
    /* Sub-sección «Albumedia»: cada disco comentado de
       agustint96.github.io/albumedia abre su página en un iframe.
       [archivo, "Álbum — Artista"] */
    var ALBUMES = [
      ["UnhortodoxBehaviour.html", "Unhortodox Behaviour — Brand X"],
      ["Thefinalcut.html", "The Final Cut — Pink Floyd"],
      ["TheWhiteAlbum.html", "The White Album — The Beatles"],
      ["ArcoIris.html", "Arco Iris — Arco Iris"],
      ["PhysicalGraffiti.html", "Physical Graffiti — Led Zeppelin"],
      [
        "TheProsAndCons.html",
        "The Pros and Cons of Hitch Hiking — Roger Waters",
      ],
      ["Peperina.html", "Peperina — Serú Girán"],
      [
        "PequeñasAnecdotas.html",
        "Pequeñas anécdotas sobre las instituciones — Sui Generis",
      ],
      ["thewall.html", "The Wall — Pink Floyd"],
      [
        "pubisangelical.html",
        "Pubis angelical / Yendo de la cama al living — Charly García",
      ],
      ["agitorlucensv.html", "Agitor Lucens V — Arco Iris"],
      ["thequeenisdead.html", "The Queen Is Dead — The Smiths"],
      ["transa.html", "Transa — Caetano Veloso"],
      ["triofattoruso.html", "En Vivo En Medio Y Medio — Trío Fattoruso"],
    ];
    ALBUMES.forEach(function (a) {
      APPS["alb:" + a[0]] = {
        title: a[1],
        icon: "web",
        type: "iframe",
        linkUrl: "https://agustint96.github.io/albumedia/" + a[0],
        url: "https://agustint96.github.io/albumedia/" + a[0],
        w: SITE_W,
        h: SITE_H,
      };
    });
    APPS.albumediaDiscos = {
      title: "Albumedia — discos comentados",
      icon: "folder",
      type: "folder",
      w: 470,
      h: 360,
      items: ALBUMES.map(function (a) {
        return "alb:" + a[0];
      }),
    };

    APPS.musica = {
      title: "Música",
      icon: "music",
      type: "folder",
      w: 470,
      h: 420,
      items: TRACKS.map(function (t) {
        return "tr" + t[0];
      }).concat(["albumediaDiscos"]),
    };

    var open = {}; // id -> { win, taskBtn }

    function taskbarH() {
      return (
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--taskbar-h",
          ),
          10,
        ) || 30
      );
    }

    function normalizeZ() {
      var list = [].slice.call(document.querySelectorAll(".w98win"));
      list.push(win);
      list.sort(function (a, b) {
        return (
          (parseInt(a.style.zIndex, 10) || 0) -
          (parseInt(b.style.zIndex, 10) || 0)
        );
      });
      zTop = 20;
      list.forEach(function (el) {
        el.style.zIndex = ++zTop;
      });
    }
    function bringToFront(el) {
      if (zTop > 40) normalizeZ();
      el.style.zIndex = ++zTop;
    }
    win.addEventListener("pointerdown", function () {
      bringToFront(win);
    });

    function maximize(w) {
      var tbH = taskbarH();
      if (w.classList.contains("w98max")) {
        w.classList.remove("w98max");
        var r = w._restore || {};
        w.style.left = r.left || "40px";
        w.style.top = r.top || "40px";
        w.style.width = r.width || "640px";
        w.style.height = r.height || "480px";
      } else {
        w._restore = {
          left: w.style.left,
          top: w.style.top,
          width: w.style.width,
          height: w.style.height,
        };
        w.classList.add("w98max");
        w.style.left = "6px";
        w.style.top = "6px";
        w.style.width = window.innerWidth - 12 + "px";
        w.style.height = window.innerHeight - tbH - 12 + "px";
      }
    }

    function makeDraggable(w, handle) {
      var drag = false;
      var moved = false;
      var sx, sy, ox, oy;
      handle.addEventListener("pointerdown", function (e) {
        // El título es un link cuando hay linkUrl/url (ver makeWin, .tb-link
        // target="_blank"): si acá se arranca el arrastre igual, el
        // setPointerCapture() de abajo le pisa el click nativo al link (no
        // navega) aunque no te hayas movido nada — sólo pasaba en ventana
        // flotante porque maximizada/juego ya cortan por la condición de
        // abajo antes de llegar a este punto.
        if (e.target.closest(".tb-btn, .tb-link")) return;
        if (
          w.classList.contains("w98max") ||
          w.classList.contains("w98-game") ||
          window.sisopTouch.isMobileMode()
        )
          return;
        drag = true;
        moved = false;
        var r = w.getBoundingClientRect();
        ox = r.left;
        oy = r.top;
        sx = e.clientX;
        sy = e.clientY;
        handle.setPointerCapture(e.pointerId);
      });
      handle.addEventListener("pointermove", function (e) {
        if (!drag) return;
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) > 3)
          moved = true;
        w.style.left = ox + (e.clientX - sx) + "px";
        w.style.top = Math.max(0, oy + (e.clientY - sy)) + "px";
      });
      handle.addEventListener("pointerup", function (e) {
        drag = false;
        try {
          handle.releasePointerCapture(e.pointerId);
        } catch (_) {}
      });
      // Si venías arrastrando, no abras el link del título al soltar.
      handle.addEventListener(
        "click",
        function (e) {
          if (moved) {
            e.preventDefault();
            e.stopPropagation();
            moved = false;
          }
        },
        true,
      );
      // Doble clic en la barra (fuera del link y los botones) = maximizar.
      handle.addEventListener("dblclick", function (e) {
        if (e.target.closest(".tb-btn, a")) return;
        if (w.classList.contains("w98-game")) return;
        maximize(w);
      });
    }

    // Mismos paths que el ícono de las "o" de Formator (ver el desktop-icon
    // en sisop.html y el h1 de la propia app): acá se dibujan dos veces
    // porque el spinner necesita una copia en gris (de fondo, siempre
    // visible) y una a color (la que la barra de .fl-fill va revelando).
    var FORMATOR_O_PATHS =
      '<path d="M-7.5 2.3a8 8 0 0 1 13.2-5.9" fill="none" stroke="#2f5fa8" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M5 -7.6l1.6-5.1 4.6 2.3" fill="none" stroke="#2f5fa8" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M7.5 -2.3a8 8 0 0 1 -13.2 5.9" fill="none" stroke="#808076" stroke-width="3" stroke-linecap="round"/>' +
      '<path d="M-5 7.6l-1.6 5.1-4.6-2.3" fill="none" stroke="#808076" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>';
    function formatorLoadingHtml() {
      return (
        '<div class="formator-loader" role="status" aria-label="Cargando…">' +
        '<div class="fl-spin"><svg class="fl-icon fl-gray" viewBox="-14 -14 28 28" aria-hidden="true">' +
        FORMATOR_O_PATHS +
        "</svg></div>" +
        '<div class="fl-fill"><div class="fl-spin"><svg class="fl-icon fl-color" viewBox="-14 -14 28 28" aria-hidden="true">' +
        FORMATOR_O_PATHS +
        "</svg></div></div>" +
        "</div>" +
        "<span>Cargando…</span>"
      );
    }
    function buildIframe(cfg, bd) {
      var f = document.createElement("iframe");
      f.src = cfg.url;
      f.title = cfg.title;
      f.setAttribute("allow", "fullscreen; autoplay; clipboard-write");
      f.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      var load = document.createElement("div");
      load.className = "w98-loading";
      // Formator vive en Render: el primer arranque en frío puede tardar
      // bastante y de otro modo se ve una ventana vacía todo ese rato.
      if (cfg.icon === "formator") load.innerHTML = formatorLoadingHtml();
      else load.textContent = "Cargando…";
      if (cfg.icon === "formator") {
        // Formator vive en Render (free tier): si el servicio estaba
        // dormido, la primera respuesta del iframe no es la app sino la
        // pantalla negra de "despertando" de Render — igual dispara
        // "load" porque es un documento HTML completo. Cuando el
        // servicio termina de levantar, esa pantalla navega sola (reload
        // o redirect) a la app real, lo que dispara OTRO "load" acá. Por
        // eso no se saca el loader en el primer "load": se espera un
        // margen y, si hubo una navegación más en ese margen, se vuelve
        // a esperar. Recién cuando pasa quieto un rato sin nuevos
        // "load" se asume que es la app real y se saca el loader. El
        // timer de seguridad es sólo por si algo falla y "load" no
        // llega a dispararse nunca.
        var settleTimer = null;
        var safety = setTimeout(function () {
          load.remove();
        }, 90000);
        f.addEventListener("load", function () {
          clearTimeout(settleTimer);
          settleTimer = setTimeout(function () {
            clearTimeout(safety);
            load.remove();
          }, 1200);
        });
      } else {
        f.addEventListener("load", function () {
          load.remove();
          // Juegos como Casus Liber: que el teclado responda apenas carga,
          // sin que el visitante tenga que clickear adentro primero.
          if (cfg.game) focusIframe(f);
        });
      }
      bd.appendChild(f);
      bd.appendChild(load);
    }

    function focusIframe(f) {
      try {
        f.focus();
        if (f.contentWindow) f.contentWindow.focus();
      } catch (_) {}
    }

    function buildFolder(cfg, bd) {
      var grid = document.createElement("div");
      grid.className = "w98-folder";
      (cfg.items || []).forEach(function (itemId) {
        var it = APPS[itemId];
        if (!it) return;
        var b = document.createElement("button");
        b.type = "button";
        b.className = "folder-icon";
        b.innerHTML =
          '<span class="fi-glyph">' +
          (ICONS[it.icon] || "") +
          '</span><span class="fi-label"></span>';
        b.querySelector(".fi-label").textContent = it.title;
        b.addEventListener("click", function (e) {
          e.stopPropagation();
          window.sisopSelect.handleClick(e, b, grid, ".folder-icon");
        });
        window.sisopTouch.bindActivate(b, function () {
          openApp(itemId);
        });
        grid.appendChild(b);
      });
      bd.appendChild(grid);
    }

    function emptyFotos() {
      return (
        '<div class="w98-empty">Carpeta vacía.<br>' +
        "Copiá las imágenes en la carpeta <b>fotos/</b> del repositorio y " +
        "listá sus nombres en <b>fotos/manifest.json</b>.</div>"
      );
    }
    function buildPhotos(bd) {
      var wrap = document.createElement("div");
      wrap.className = "w98-photos";
      wrap.innerHTML = '<div class="w98-empty">Cargando…</div>';
      bd.appendChild(wrap);
      fetch("fotos/manifest.json", { cache: "no-store" })
        .then(function (r) {
          if (!r.ok) throw new Error("no manifest");
          return r.json();
        })
        .then(function (data) {
          var list = Array.isArray(data)
            ? data
            : (data && data.fotos) || [];
          if (!list.length) {
            wrap.innerHTML = emptyFotos();
            return;
          }
          wrap.innerHTML = "";
          list.forEach(function (item) {
            var src =
              typeof item === "string"
                ? item
                : item.src || item.file || item.archivo || "";
            if (!src) return;
            var cap =
              typeof item === "string"
                ? item.split("/").pop()
                : item.titulo ||
                  item.caption ||
                  item.nombre ||
                  src.split("/").pop();
            if (!/^https?:\/\//.test(src) && src.indexOf("fotos/") !== 0)
              src = "fotos/" + src;
            var t = document.createElement("button");
            t.type = "button";
            t.className = "photo-thumb";
            t.title = cap + " (doble clic para ampliar)";
            t.innerHTML = '<img loading="lazy" alt=""><span></span>';
            t.querySelector("img").src = src;
            t.querySelector("span").textContent = cap;
            window.sisopTouch.bindActivate(t, function () {
              openImage(src, cap);
            });
            wrap.appendChild(t);
          });
        })
        .catch(function () {
          wrap.innerHTML = emptyFotos();
        });
    }

    function buildImage(cfg, bd) {
      var v = document.createElement("div");
      v.className = "w98-imgview";
      var img = document.createElement("img");
      img.src = cfg.url;
      img.alt = cfg.title;
      v.appendChild(img);
      bd.appendChild(v);
    }

    function buildNotes(cfg, bd) {
      var wrap = document.createElement("div");
      wrap.className = "notes-app";
      wrap.innerHTML =
        '<div class="notes-input" contenteditable="true" spellcheck="false" ' +
        'data-placeholder="Escribí una nota… (Ctrl+B negrita, Ctrl+U subrayado, Ctrl+Shift+X tachado)"></div>' +
        '<div class="notes-foot">' +
        '<button class="btn" type="button" data-notes="guardar">Guardar nota</button>' +
        '<button class="btn" type="button" data-notes="pin">Pegar en el escritorio</button>' +
        "</div>";
      var ta = wrap.querySelector(".notes-input");
      ta.addEventListener("focus", function () {
        try {
          document.execCommand("defaultParagraphSeparator", false, "br");
        } catch (_) {}
      });
      ta.addEventListener("paste", pasteAsPlainText);
      ta.addEventListener("input", function () {
        // Al borrar todo, algunos navegadores dejan un <br> suelto que
        // impide que vuelva a matchear :empty (y por ende el placeholder).
        if (ta.innerHTML === "<br>") ta.innerHTML = "";
      });
      ta.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          if (e.shiftKey) guardar();
          else pin();
          return;
        }
        if (applyRichShortcut(e)) e.preventDefault();
      });
      function vacia() {
        return !richTextToPlain(ta.innerHTML).trim();
      }
      function pin() {
        if (vacia()) {
          ta.focus();
          return;
        }
        var html = sanitizeRichText(ta.innerHTML);
        if (typeof agregarNota === "function") agregarNota(html);
        ta.innerHTML = "";
        ta.focus();
      }
      // «Guardar nota»: a diferencia del papelito de arriba (que no tiene
      // ícono en ningún lado: si lo cerrás, se borró), esto la deja archivada
      // con su propio ícono en el escritorio — se puede volver a abrir
      // después de cerrarla con sólo hacerle doble clic.
      function guardar() {
        if (vacia()) {
          ta.focus();
          return;
        }
        var html = sanitizeRichText(ta.innerHTML);
        if (window.sisopUserFiles && typeof window.sisopUserFiles.saveNote === "function") {
          window.sisopUserFiles.saveNote(html);
        }
        ta.innerHTML = "";
        ta.focus();
      }
      wrap
        .querySelector('[data-notes="pin"]')
        .addEventListener("click", pin);
      wrap
        .querySelector('[data-notes="guardar"]')
        .addEventListener("click", guardar);
      bd.appendChild(wrap);
      setTimeout(function () {
        ta.focus();
      }, 30);
      if (typeof notasBienvenida === "function") notasBienvenida();
    }

    function openImage(src, cap) {
      var id = "img:" + src;
      APPS[id] = {
        title: cap || "Imagen",
        icon: "photo",
        type: "image",
        url: src,
        w: 680,
        h: 540,
        transient: true,
      };
      openApp(id);
    }

    function makeWin(id, cfg) {
      var w = document.createElement("div");
      w.className = "w98win";
      w.setAttribute("data-app", id);

      var tbH = taskbarH();
      var W = Math.min(cfg.w || 640, window.innerWidth - 16);
      var H = Math.min(cfg.h || 480, window.innerHeight - tbH - 16);
      w.style.width = W + "px";
      w.style.height = H + "px";

      var n = Object.keys(open).length;
      var left = Math.min(
        Math.max(8, (window.innerWidth - W) / 2 + n * 26 - 40),
        window.innerWidth - W - 8,
      );
      var top = Math.min(
        Math.max(8, 46 + n * 26),
        Math.max(8, window.innerHeight - tbH - H - 8),
      );
      w.style.left = left + "px";
      w.style.top = top + "px";

      var linkHref = cfg.linkUrl || cfg.url;
      var linkable =
        !!linkHref && (cfg.type === "iframe" || cfg.type === "image");
      var tb = document.createElement("div");
      tb.className = "title-bar";
      tb.innerHTML =
        '<span class="tb-icon tb-glyph">' +
        (cfg.iconHtml || ICONS[cfg.icon] || "") +
        "</span>" +
        (linkable
          ? '<a class="tb-text tb-link" target="_blank" rel="noopener noreferrer"></a>'
          : '<span class="tb-text"></span>') +
        '<span class="tb-btns">' +
        '<button class="tb-btn" data-w="min" title="Minimizar" type="button">_</button>' +
        '<button class="tb-btn" data-w="max" title="Maximizar" type="button">▢</button>' +
        '<button class="tb-btn" data-w="close" title="Cerrar" type="button">✕</button>' +
        "</span>";
      var tEl = tb.querySelector(".tb-text");
      tEl.textContent = cfg.title;
      if (linkable) {
        tEl.href = linkHref;
        tEl.title = "Abrir «" + cfg.title + "» en una pestaña nueva";
        // Evita que el navegador dispare un drag nativo del link (que
        // compite con el arrastre de la ventana implementado abajo).
        tEl.draggable = false;
      }
      w.appendChild(tb);

      if (cfg.game) {
        w.classList.add("w98-game");
        w.style.left = "";
        w.style.top = "";
        w.style.width = "";
        w.style.height = "";
      }

      var bd = document.createElement("div");
      bd.className = "w98-body";
      w.appendChild(bd);

      if (cfg.type === "iframe") buildIframe(cfg, bd);
      else if (cfg.type === "folder") buildFolder(cfg, bd);
      else if (cfg.type === "photos") buildPhotos(bd);
      else if (cfg.type === "image") buildImage(cfg, bd);
      else if (cfg.type === "notes") buildNotes(cfg, bd);
      else if (cfg.type === "recorder" && window.buildGrabadora)
        window.buildGrabadora(cfg, bd);
      else if (cfg.type === "custom" && typeof cfg.render === "function")
        cfg.render(bd, w);

      document.body.appendChild(w);
      makeDraggable(w, tb);
      w.addEventListener("pointerdown", function () {
        bringToFront(w);
      });
      /* Casus Liber corre en modo juego a pantalla completa (ver .w98-game);
         no usa el maximizado estándar de las ventanas w98. */
      tb.querySelector('[data-w="min"]').addEventListener(
        "click",
        function (e) {
          e.stopPropagation();
          w.classList.add("min");
          updateTask(id);
        },
      );
      tb.querySelector('[data-w="max"]').addEventListener(
        "click",
        function (e) {
          e.stopPropagation();
          if (cfg.game) {
            try {
              if (document.fullscreenElement) document.exitFullscreen();
              else if (w.requestFullscreen) w.requestFullscreen();
            } catch (_) {}
            return;
          }
          maximize(w);
        },
      );
      tb.querySelector('[data-w="close"]').addEventListener(
        "click",
        function (e) {
          e.stopPropagation();
          closeApp(id);
        },
      );
      return w;
    }

    function makeTaskBtn(id, cfg) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "task-btn active";
      b.title = cfg.title;
      b.innerHTML =
        '<span class="tb-icon tb-glyph">' +
        (cfg.iconHtml || ICONS[cfg.icon] || "") +
        '</span><span class="tb-label"></span><span class="tb-label-short"></span>';
      b.querySelector(".tb-label").textContent = cfg.title;
      b.querySelector(".tb-label-short").textContent = (cfg.title || "")
        .trim()
        .slice(0, 3);
      b.addEventListener("click", function () {
        var o = open[id];
        if (!o) return;
        if (o.win.classList.contains("min")) {
          o.win.classList.remove("min");
          bringToFront(o.win);
          if (cfg.game) {
            var f = o.win.querySelector("iframe");
            if (f) focusIframe(f);
          }
        } else {
          o.win.classList.add("min");
        }
        updateTask(id);
      });
      return b;
    }

    function updateTask(id) {
      var o = open[id];
      if (!o) return;
      var vis = !o.win.classList.contains("min");
      o.taskBtn.classList.toggle("active", vis);
      o.taskBtn.setAttribute("aria-pressed", vis ? "true" : "false");
    }

    function openApp(id) {
      var cfg = APPS[id];
      if (!cfg) return;
      if (open[id]) {
        open[id].win.classList.remove("min");
        bringToFront(open[id].win);
        updateTask(id);
        if (cfg.game) {
          var f = open[id].win.querySelector("iframe");
          if (f) focusIframe(f);
        }
        return;
      }
      var w = makeWin(id, cfg);
      var btn = makeTaskBtn(id, cfg);
      tasksEl.appendChild(btn);
      open[id] = { win: w, taskBtn: btn };
      bringToFront(w);
    }

    function closeApp(id) {
      var o = open[id];
      if (!o) return;
      o.win.remove();
      o.taskBtn.remove();
      delete open[id];
      if (APPS[id] && APPS[id].transient) delete APPS[id];
    }

    /* Selección / apertura de TODOS los iconos del escritorio */
    var deskIcons = [].slice.call(
      document.querySelectorAll(".desk-icon"),
    );
    // Ojo: no iterar `deskIcons` acá. Ese array es una foto fija tomada al
    // arrancar (sólo los iconos que ya estaban en el HTML): un ícono
    // creado después -una nota, una carpeta- no entraría, y entonces
    // seleccionar un ícono de los de siempre (ej. Papelera) no lo
    // deseleccionaría. Con querySelectorAll en vivo se limpia cualquiera,
    // viejo o nuevo.
    function clearDeskSel() {
      document.querySelectorAll(".desk-icon.selected").forEach(function (i) {
        i.classList.remove("selected");
      });
    }
    var desk = document.getElementById("desk");
    deskIcons.forEach(function (ic) {
      ic.addEventListener("click", function (e) {
        e.stopPropagation();
        window.sisopSelect.handleClick(e, ic, desk, ".desk-icon");
      });
    });
    document.addEventListener("click", clearDeskSel);
    document
      .querySelectorAll(".desk-icon[data-open]")
      .forEach(function (ic) {
        var target = ic.getAttribute("data-open");
        window.sisopTouch.bindActivate(ic, function () {
          clearDeskSel();
          openApp(target);
        });
        ic.addEventListener("keydown", function (e) {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openApp(target);
          }
        });
      });

    window.addEventListener("resize", function () {
      var tbH = taskbarH();
      Object.keys(open).forEach(function (id) {
        var w = open[id].win;
        if (w.classList.contains("w98-game")) return;
        if (w.classList.contains("w98max")) {
          w.style.width = window.innerWidth - 12 + "px";
          w.style.height = window.innerHeight - tbH - 12 + "px";
          return;
        }
        var r = w.getBoundingClientRect();
        if (r.width > window.innerWidth - 12) {
          w.style.width = window.innerWidth - 12 + "px";
        }
        if (r.height > window.innerHeight - tbH - 12) {
          w.style.height = window.innerHeight - tbH - 12 + "px";
        }
        var maxLeft = Math.max(0, window.innerWidth - w.offsetWidth - 4);
        var maxTop = Math.max(
          0,
          window.innerHeight - tbH - w.offsetHeight - 4,
        );
        w.style.left =
          Math.min(parseFloat(w.style.left) || 0, maxLeft) + "px";
        w.style.top =
          Math.min(parseFloat(w.style.top) || 0, maxTop) + "px";
      });
    });

    /* API para otros scripts (ej. sisop-user-files.js): registrar una app
       "custom" (cfg.type = "custom", cfg.render(bd, win) arma el contenido a
       mano) y abrirla/cerrarla reusando toda la mecánica de ventanas ya
       hecha (arrastre, minimizar, maximizar, taskbar, z-order). */
    window.sisopWin = {
      registerApp: function (id, cfg) {
        APPS[id] = cfg;
      },
      unregisterApp: function (id) {
        closeApp(id);
        delete APPS[id];
      },
      open: openApp,
      close: closeApp,
      isOpen: function (id) {
        return !!open[id];
      },
    };
  })();

  /* ============================================================
   *  Notas: papelitos post-it que se pegan al escritorio y se
   *  arrastran; al soltarlos con impulso salen "tirados" (inercia).
   * ============================================================ */
  (function stickyNotes() {
    var LS = "sqlconsole:v1:notas";
    var reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    var notas = [];
    // Postits "archivados" (notas guardadas, con ícono propio en el
    // escritorio): no viven en `notas` ni en LS -su dueño es
    // sisop-user-files.js-, pero comparten el mismo papelito y la misma
    // física de arrastre/tiro. Se indexan por key (el id del ítem) para
    // no abrir dos veces el mismo y para poder cerrarlos desde afuera.
    var archivedByKey = {};
    /* Rango 2-4: sólo por encima del escritorio (iconos = 1) y siempre
       por debajo de cualquier ventana (>= 20). */
    var zc = 2;

    function tbH() {
      return (
        parseInt(
          getComputedStyle(document.documentElement).getPropertyValue(
            "--taskbar-h",
          ),
          10,
        ) || 30
      );
    }
    function clamp(v, lo, hi) {
      return v < lo ? lo : v > hi ? hi : v;
    }
    function bounds(el) {
      return {
        minX: 2,
        minY: 2,
        maxX: Math.max(2, window.innerWidth - el.offsetWidth - 2),
        maxY: Math.max(
          2,
          window.innerHeight - tbH() - el.offsetHeight - 4,
        ),
      };
    }
    function raise(el) {
      zc = zc >= 4 ? 2 : zc + 1;
      el.style.zIndex = zc;
    }

    function persist() {
      try {
        localStorage.setItem(
          LS,
          JSON.stringify(
            notas.map(function (n) {
              var sized = n.el.classList.contains("pi-sized");
              return {
                id: n.id,
                text: sanitizeRichText(n.text.innerHTML),
                rt: true,
                x: parseFloat(n.el.style.left) || 0,
                y: parseFloat(n.el.style.top) || 0,
                rot: n.rot,
                w: sized ? n.el.offsetWidth : null,
                h: sized ? n.el.offsetHeight : null,
              };
            }),
          ),
        );
      } catch (e) {}
    }

    function quitar(n) {
      var i = notas.indexOf(n);
      if (i >= 0) notas.splice(i, 1);
      if (n.key) delete archivedByKey[n.key];
      n.el.classList.add("pi-gone");
      setTimeout(function () {
        if (n.el.parentNode) n.el.parentNode.removeChild(n.el);
      }, 200);
      persist();
    }

    function crear(data) {
      if (typeof data === "string") data = { text: data };
      data = data || {};
      // Postit "archivado" (nota guardada, ver window.sisopPostit más
      // abajo): mismo papelito, pero no se guarda en el balde de LS de acá
      // -eso lo maneja quien lo pidió, vía data.onUpdate- y cerrarlo no lo
      // borra -eso lo decide data.onClose-.
      var archived = !!data.archived;

      var el = document.createElement("div");
      el.className = "postit";
      var rot =
        typeof data.rot === "number" ? data.rot : Math.random() * 6 - 3;
      el.style.transform = "rotate(" + rot + "deg)";
      el.style.zIndex = 3;
      el.innerHTML =
        '<button class="pi-close" type="button" title="Quitar nota" aria-label="Quitar nota">✕</button>' +
        '<div class="pi-text" contenteditable="true" spellcheck="false"></div>' +
        '<span class="pi-resize" title="Cambiar tamaño" aria-hidden="true"></span>';
      var text = el.querySelector(".pi-text");
      var grip = el.querySelector(".pi-resize");
      text.innerHTML = data.rt
        ? sanitizeRichText(data.text || "")
        : plainToRich(data.text || "");
      document.body.appendChild(el);

      var n = {
        el: el,
        text: text,
        rot: rot,
        key: data.key || null,
        id:
          data.id ||
          "n" +
            Date.now().toString(36) +
            Math.random().toString(36).slice(2, 6),
      };
      if (archived) {
        if (data.key) archivedByKey[data.key] = n;
      } else {
        notas.push(n);
      }

      function autogrow() {
        if (el.classList.contains("pi-sized")) return;
        text.style.height = "auto";
        text.style.height = Math.min(text.scrollHeight, 320) + "px";
      }

      /* Tamaño fijado a mano (si venía guardado) */
      if (typeof data.w === "number" && typeof data.h === "number") {
        el.classList.add("pi-sized");
        text.style.height = "";
        el.style.width = data.w + "px";
        el.style.height = data.h + "px";
      }
      requestAnimationFrame(autogrow);

      var b = bounds(el);
      var x =
        typeof data.x === "number"
          ? data.x
          : b.minX + 16 + Math.random() * 90;
      var y =
        typeof data.y === "number"
          ? data.y
          : b.minY + 66 + Math.random() * 80;
      el.style.left = clamp(x, b.minX, b.maxX) + "px";
      el.style.top = clamp(y, b.minY, b.maxY) + "px";

      /* Dónde persiste cada cambio (texto, posición, tamaño): un papelito
         normal se guarda en el balde de LS de acá (persist()); uno
         archivado se lo avisa a quien lo abrió (data.onUpdate), que es
         quien realmente lo tiene guardado. */
      function snapshot() {
        var sized = el.classList.contains("pi-sized");
        return {
          text: sanitizeRichText(text.innerHTML),
          rt: true,
          x: parseFloat(el.style.left) || 0,
          y: parseFloat(el.style.top) || 0,
          rot: n.rot,
          w: sized ? el.offsetWidth : null,
          h: sized ? el.offsetHeight : null,
        };
      }
      function saveState() {
        if (archived) {
          if (data.onUpdate) data.onUpdate(snapshot());
        } else {
          persist();
        }
      }

      /* ---- editar en el lugar ---- */
      function editar() {
        el.classList.add("editing");
        text.focus();
        try {
          document.execCommand("defaultParagraphSeparator", false, "br");
        } catch (_) {}
        try {
          var range = document.createRange();
          range.selectNodeContents(text);
          range.collapse(false);
          var sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
        } catch (_) {}
      }
      window.sisopTouch.bindActivate(el, function (e) {
        if (e.target.closest(".pi-close")) return;
        if (e.target.closest(".pi-resize")) return;
        if (justDragged) return;
        editar();
      });
      text.addEventListener("input", autogrow);
      text.addEventListener("paste", pasteAsPlainText);
      text.addEventListener("blur", function () {
        el.classList.remove("editing");
        if (!richTextToPlain(text.innerHTML).trim()) {
          // Vacío al perder foco: se descarta, igual que un papelito común
          // (si es uno archivado, quien lo abrió se entera para borrar
          // también el ícono del escritorio).
          if (archived && data.onClose) data.onClose(true);
          quitar(n);
        } else {
          saveState();
        }
      });
      text.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
          e.preventDefault();
          text.blur();
          e.stopPropagation();
          return;
        }
        if (applyRichShortcut(e)) e.preventDefault();
        e.stopPropagation();
      });
      el.querySelector(".pi-close").addEventListener(
        "click",
        function (e) {
          e.stopPropagation();
          // Uno archivado no se borra al cerrarlo: sólo se saca de la
          // vista -el ícono del escritorio lo deja reabrirlo después.
          if (archived && data.onClose) data.onClose(false);
          quitar(n);
        },
      );

      /* ---- arrastrar + tirar (inercia al soltar) ---- */
      var drag = false,
        moved = false,
        justDragged = false,
        sx = 0,
        sy = 0,
        bx = 0,
        by = 0,
        raf = 0,
        samples = [];

      function stopInertia() {
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }

      el.addEventListener("pointerdown", function (e) {
        if (el.classList.contains("editing")) return;
        if (e.target.closest(".pi-close")) return;
        if (e.target.closest(".pi-resize")) return;
        stopInertia();
        drag = true;
        moved = false;
        raise(el);
        el.classList.add("live", "dragging");
        var r = el.getBoundingClientRect();
        bx = parseFloat(el.style.left) || r.left;
        by = parseFloat(el.style.top) || r.top;
        sx = e.clientX;
        sy = e.clientY;
        samples = [{ t: performance.now(), x: e.clientX, y: e.clientY }];
        try {
          el.setPointerCapture(e.pointerId);
        } catch (_) {}
      });

      el.addEventListener("pointermove", function (e) {
        if (!drag) return;
        var dx = e.clientX - sx,
          dy = e.clientY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 3) moved = true;
        el.style.left = bx + dx + "px";
        el.style.top = by + dy + "px";
        el.style.transform =
          "rotate(" + (n.rot + clamp(dx * 0.04, -12, 12)) + "deg)";
        samples.push({
          t: performance.now(),
          x: e.clientX,
          y: e.clientY,
        });
        if (samples.length > 5) samples.shift();
      });

      function soltar(e) {
        if (!drag) return;
        drag = false;
        el.classList.remove("dragging");
        if (moved) {
          justDragged = true;
          setTimeout(function () {
            justDragged = false;
          }, 320);
        }
        try {
          el.releasePointerCapture(e.pointerId);
        } catch (_) {}
        var vx = 0,
          vy = 0;
        if (samples.length >= 2) {
          var a = samples[0],
            z = samples[samples.length - 1];
          var dt = Math.max(1, z.t - a.t);
          vx = ((z.x - a.x) / dt) * 15;
          vy = ((z.y - a.y) / dt) * 15;
        }
        if (reduce || Math.hypot(vx, vy) < 0.8) asentar();
        else tirar(vx, vy);
      }
      el.addEventListener("pointerup", soltar);
      el.addEventListener("pointercancel", soltar);

      function asentar() {
        var b = bounds(el);
        el.classList.remove("live");
        el.style.left =
          clamp(parseFloat(el.style.left) || 0, b.minX, b.maxX) + "px";
        el.style.top =
          clamp(parseFloat(el.style.top) || 0, b.minY, b.maxY) + "px";
        el.style.transform = "rotate(" + n.rot + "deg)";
        saveState();
      }

      function tirar(vx, vy) {
        var x = parseFloat(el.style.left) || 0;
        var y = parseFloat(el.style.top) || 0;
        var fr = 0.93;
        function paso() {
          var b = bounds(el);
          vx *= fr;
          vy *= fr;
          x += vx;
          y += vy;
          if (x < b.minX) {
            x = b.minX;
            vx = -vx * 0.42;
          } else if (x > b.maxX) {
            x = b.maxX;
            vx = -vx * 0.42;
          }
          if (y < b.minY) {
            y = b.minY;
            vy = -vy * 0.42;
          } else if (y > b.maxY) {
            y = b.maxY;
            vy = -vy * 0.42;
          }
          el.style.left = x + "px";
          el.style.top = y + "px";
          el.style.transform =
            "rotate(" + (n.rot + clamp(vx * 1.1, -18, 18)) + "deg)";
          if (Math.hypot(vx, vy) > 0.18) {
            raf = requestAnimationFrame(paso);
          } else {
            raf = 0;
            el.classList.remove("live");
            el.style.transform = "rotate(" + n.rot + "deg)";
            saveState();
          }
        }
        raf = requestAnimationFrame(paso);
      }

      el.addEventListener(
        "click",
        function (e) {
          if (moved) {
            e.preventDefault();
            e.stopPropagation();
            moved = false;
          }
        },
        true,
      );

      /* ---- cambiar el tamaño desde la esquina ---- */
      var rz = false,
        rzx = 0,
        rzy = 0,
        rzw = 0,
        rzh = 0;

      grip.addEventListener("pointerdown", function (e) {
        if (el.classList.contains("editing")) return;
        e.stopPropagation();
        e.preventDefault();
        stopInertia();
        rz = true;
        rzx = e.clientX;
        rzy = e.clientY;
        rzw = el.offsetWidth;
        rzh = el.offsetHeight;
        el.classList.add("pi-sized", "resizing", "live");
        text.style.height = "";
        el.style.transform = "rotate(" + n.rot + "deg)";
        raise(el);
        try {
          grip.setPointerCapture(e.pointerId);
        } catch (_) {}
      });

      grip.addEventListener("pointermove", function (e) {
        if (!rz) return;
        var maxW = Math.max(160, window.innerWidth * 0.7);
        var maxH = Math.max(120, (window.innerHeight - tbH()) * 0.8);
        el.style.width = clamp(rzw + (e.clientX - rzx), 92, maxW) + "px";
        el.style.height = clamp(rzh + (e.clientY - rzy), 64, maxH) + "px";
      });

      function endResize(e) {
        if (!rz) return;
        rz = false;
        el.classList.remove("resizing", "live");
        try {
          grip.releasePointerCapture(e.pointerId);
        } catch (_) {}
        var b = bounds(el);
        el.style.left =
          clamp(parseFloat(el.style.left) || 0, b.minX, b.maxX) + "px";
        el.style.top =
          clamp(parseFloat(el.style.top) || 0, b.minY, b.maxY) + "px";
        saveState();
      }
      grip.addEventListener("pointerup", endResize);
      grip.addEventListener("pointercancel", endResize);

      saveState();
      return n;
    }

    /* API que usa la app «Notas» al pegar un papelito (ya llega como HTML
       saneado, ver buildNotes) */
    agregarNota = function (texto) {
      var n = crear({ text: texto, rt: true });
      raise(n.el);
      return n;
    };

    /* API para otros scripts (sisop-user-files.js): abrir una nota
       guardada como el mismo papelito post-it -misma estética y misma
       física de arrastre/tiro/resize que uno descartable-, con la única
       diferencia de que cerrarlo no lo borra (avisa por onClose en vez de
       desaparecer solo). `key` identifica la nota (el id del ítem guardado)
       para no abrirla dos veces: si ya está abierta, la trae al frente. */
    window.sisopPostit = {
      open: function (key, opts) {
        if (archivedByKey[key]) {
          raise(archivedByKey[key].el);
          return archivedByKey[key];
        }
        opts = opts || {};
        opts.archived = true;
        opts.key = key;
        var n = crear(opts);
        raise(n.el);
        return n;
      },
      isOpen: function (key) {
        return !!archivedByKey[key];
      },
      close: function (key) {
        var n = archivedByKey[key];
        if (n) quitar(n);
      },
    };

    /* La primera vez que se abre «Notas» en este equipo: nota de bienvenida
       pegada arriba a la derecha (después se guarda y no vuelve a aparecer). */
    var primeraVez = false;
    notasBienvenida = function () {
      if (!primeraVez) return;
      primeraVez = false;
      crear({
        id: "bienvenida",
        text: "Hola :)\n\nDejá tus notas y soltalas cuando ya no las necesites",
        x: window.innerWidth - 168 - 22,
        y: 40,
        rot: 3,
      });
    };

    window.addEventListener("resize", function () {
      notas.forEach(function (n) {
        var b = bounds(n.el);
        n.el.style.left =
          clamp(parseFloat(n.el.style.left) || 0, b.minX, b.maxX) + "px";
        n.el.style.top =
          clamp(parseFloat(n.el.style.top) || 0, b.minY, b.maxY) + "px";
      });
    });

    try {
      var raw = localStorage.getItem(LS);
      if (raw === null) {
        primeraVez = true;
      } else {
        var saved = JSON.parse(raw || "[]");
        if (Array.isArray(saved)) saved.forEach(crear);
      }
    } catch (e) {}
  })();
})();
