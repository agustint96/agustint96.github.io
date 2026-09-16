(function () {
  "use strict";

  var LS_DB = "sqlconsole:v1:db";
  var LS_SEED = "sqlconsole:v1:seed";

  /* ============================================================
   *  BASE «Agus» — esquema semilla
   *  Subí SEED_VERSION cada vez que cambie SEED_SQL para que la
   *  base se regenere en los navegadores que ya la tienen.
   *  (Todavía vacío: esperando las tablas.)
   * ============================================================ */
  var SEED_VERSION = "2026-09-09.2";
  var SEED_SQL = [
    "-- ===== info : datos personales (clave / valor) =====",
    "CREATE TABLE info (",
    "  campo  TEXT PRIMARY KEY,",
    "  valor  TEXT",
    ");",
    "INSERT INTO info (campo, valor) VALUES",
    "  ('nombre',    'Agustín Tardella'),",
    "  ('rol',       'Analista Universitario de Sistemas Informáticos | Data Scientist'),",
    "  ('ubicacion', 'Córdoba, Argentina'),",
    "  ('email',     'agustintardella7@gmail.com'),",
    "  ('telefono',  '(+54) 351 3148931'),",
    "  ('github',    'https://github.com/agustint96'),",
    "  ('portfolio', 'https://agustint96.github.io'),",
    "  ('resumen',   'Analista de Soporte IT, Data Scientist y Desarrollador Web con experiencia en resolución de problemas técnicos, mantenimiento de sistemas y análisis de datos.');",
    "",
    "-- ===== estudios =====",
    "CREATE TABLE estudios (",
    "  id           INTEGER PRIMARY KEY,",
    "  institucion  TEXT NOT NULL,",
    "  titulo       TEXT NOT NULL,",
    "  tipo         TEXT,",
    "  tecnologias  TEXT,",
    "  periodo      TEXT,",
    "  estado       TEXT",
    ");",
    "INSERT INTO estudios (id, institucion, titulo, tipo, tecnologias, periodo, estado) VALUES",
    "  (1, 'Universidad Nacional de Córdoba', 'Analista Universitario de Sistemas Informáticos', 'Carrera', 'Programación, Bases de datos, Redes', '2023 - Actualidad', 'En curso'),",
    "  (2, 'Mundos E - FCEFyN, UNC', 'Diplomatura en Data Science', 'Diplomatura', 'Python, R, Pandas, NumPy, Estadística', '2024 - 2025', 'Finalizado'),",
    "  (3, 'CUDI - UTN', 'Diplomatura en IA con Python', 'Diplomatura', 'Python, Machine Learning', '2024', 'Finalizado'),",
    "  (4, 'UTN - FRC', 'Desarrollo Frontend con React', 'Curso', 'React, JavaScript', '2023', 'Finalizado'),",
    "  (5, 'Instituto Educativo Económico Nacional (Resistencia, Chaco)', 'Programación y Diseño Web', 'Curso', 'HTML, CSS, JavaScript', '2022', 'Finalizado'),",
    "  (6, 'Campus Virtual - UNC', 'Excel Intermedio', 'Curso', 'Excel', '2023', 'Finalizado'),",
    "  (7, 'Departamento Cultural - Facultad de Lenguas, UNC', 'Inglés A2', 'Curso', NULL, '2024', 'Finalizado');",
    "",
    "-- ===== experiencia =====",
    "CREATE TABLE experiencia (",
    "  id           INTEGER PRIMARY KEY,",
    "  puesto       TEXT NOT NULL,",
    "  empresa      TEXT NOT NULL,",
    "  periodo      TEXT,",
    "  inicio       INTEGER,",
    "  fin          INTEGER,",
    "  tecnologias  TEXT,",
    "  descripcion  TEXT",
    ");",
    "INSERT INTO experiencia (id, puesto, empresa, periodo, inicio, fin, tecnologias, descripcion) VALUES",
    "  (1, 'Analista de Soporte IT', 'Descar Argentina SRL', '2025 - 2026', 2025, 2026, 'Teamcenter, NX, Solid Edge, Odoo, Polarion, C#, SQL, Python (Pandas, NumPy, Seaborn)', 'Soporte técnico a clientes y equipos de ingeniería con software PLM. Gestión de incidencias en ERP Odoo. Documentación en Polarion bajo ISO 9001. Desarrollo de sistemas internos con C# y SQL. Análisis de datos con Python.'),",
    "  (2, 'Soporte Técnico', 'Konecta', '2023', 2023, 2023, 'CRM, Redes FTTH, HFC, IP, Firewalls', 'Atención y soporte a clientes con CRM. Resolución de problemas de conectividad FTTH. Diagnóstico de redes y firewalls. Consultas técnicas y de facturación.'),",
    "  (3, 'Soporte Administrativo e IT', 'Ministerio de Cooperativas y Mutuales', '2020 - 2022', 2020, 2022, 'Testing funcional, Bases de datos, Ciudadano Digital', 'Gestión de documentación y balances en Fiscalización. Soporte en implementación de sistema institucional, carga y validación de datos. Testing funcional y reporte de requerimientos. Colaboración en diseño y gestión de bases de datos.'),",
    "  (4, 'Auxiliar Administrativo', 'Estudio Jurídico HTP', '2017 - 2019', 2017, 2019, 'Desarrollo web', 'Elaboración de documentos legales y gestión de trámites. Desarrollo web de CoopLegal.');",
    "",
    "-- ===== proyectos =====",
    "CREATE TABLE proyectos (",
    "  id           INTEGER PRIMARY KEY,",
    "  nombre       TEXT NOT NULL,",
    "  descripcion  TEXT,",
    "  tecnologias  TEXT,",
    "  url          TEXT,",
    "  fecha        TEXT",
    ");",
    "INSERT INTO proyectos (id, nombre, descripcion, tecnologias, url, fecha) VALUES",
    "  (1, 'Portfolio personal', 'Sitio personal con fondo parallax animado y cielo estrellado en canvas.', 'HTML, CSS, JavaScript, Canvas', 'https://agustint96.github.io', '2025'),",
    "  (2, 'Consola SQL Agus', 'Playground SQL con estética Windows 98 sobre SQLite compilado a WebAssembly.', 'JavaScript, sql.js, SQLite', 'https://agustint96.github.io/sisop.html', '2026'),",
    "  (3, 'CoopLegal', 'Sitio web para estudio jurídico.', 'Desarrollo web', NULL, '2017 - 2019');",
    "",
    "-- ===== idiomas =====",
    "CREATE TABLE idiomas (",
    "  id             INTEGER PRIMARY KEY,",
    "  idioma         TEXT NOT NULL,",
    "  nivel          TEXT,",
    "  certificacion  TEXT,",
    "  notas          TEXT",
    ");",
    "INSERT INTO idiomas (id, idioma, nivel, certificacion, notas) VALUES",
    "  (1, 'Español', 'Nativo', NULL, NULL),",
    "  (2, 'Inglés', 'A2', 'Inglés A2 - Facultad de Lenguas, UNC (2024)', 'Uso profesional en contextos técnicos y equipos internacionales.');",
    "",
    "-- ===== tecnologias =====",
    "CREATE TABLE tecnologias (",
    "  id         INTEGER PRIMARY KEY,",
    "  nombre     TEXT NOT NULL,",
    "  categoria  TEXT,",
    "  nivel      TEXT",
    ");",
    "INSERT INTO tecnologias (id, nombre, categoria, nivel) VALUES",
    "  (1,  'Python',      'Lenguaje / Data', 'Avanzado'),",
    "  (2,  'R',           'Lenguaje / Data', 'Intermedio'),",
    "  (3,  'C#',          'Lenguaje',        'Intermedio'),",
    "  (4,  'JavaScript',  'Lenguaje / Web',  'Intermedio'),",
    "  (5,  'SQL',         'Base de datos',   'Avanzado'),",
    "  (6,  'SQL Server',  'Base de datos',   'Intermedio'),",
    "  (7,  'Pandas',      'Data',            'Avanzado'),",
    "  (8,  'NumPy',       'Data',            'Intermedio'),",
    "  (9,  'Seaborn',     'Data',            'Intermedio'),",
    "  (10, 'React',       'Web',             'Intermedio'),",
    "  (11, 'HTML / CSS',  'Web',             'Avanzado'),",
    "  (12, 'Excel',       'Herramienta',     'Intermedio'),",
    "  (13, 'Odoo (ERP)',  'ERP / CRM',       'Intermedio'),",
    "  (14, 'CRM',         'ERP / CRM',       'Intermedio'),",
    "  (15, 'Teamcenter',  'PLM',             'Intermedio'),",
    "  (16, 'NX',          'PLM',             'Básico'),",
    "  (17, 'Solid Edge',  'PLM',             'Básico'),",
    "  (18, 'Polarion',    'ALM / Calidad',   'Intermedio'),",
    "  (19, 'Linux',       'Sistemas',        'Intermedio'),",
    "  (20, 'Redes (FTTH, HFC, IP, Firewalls)', 'Sistemas / Redes', 'Intermedio'),",
    "  (21, 'Git / GitHub','Herramienta',     'Intermedio');",
    "",
    "-- ===== musica (a completar con tracks / sets reales) =====",
    "CREATE TABLE musica (",
    "  id          INTEGER PRIMARY KEY,",
    "  titulo      TEXT NOT NULL,",
    "  tipo        TEXT,",
    "  plataforma  TEXT,",
    "  url         TEXT,",
    "  fecha       TEXT",
    ");",
    "INSERT INTO musica (id, titulo, tipo, plataforma, url, fecha) VALUES",
    "  (1, 'Perfil SoundCloud', 'Perfil', 'SoundCloud', 'https://soundcloud.com/agust1', NULL);",
  ].join("\n");

  var $ = function (id) {
    return document.getElementById(id);
  };
  var editor = $("editor");
  var results = $("results");
  var schemaEl = $("schema");
  var stMode = $("stMode");
  var stRows = $("stRows");
  var stTime = $("stTime");
  var runBtn = $("runBtn");
  var win = $("win");

  /* Consulta con la que arranca siempre el editor (la del HTML).
     Al cerrar el programa se descarta lo que haya y se vuelve a esta. */
  var DEFAULT_QUERY = editor.value;

  var SQL = null;
  var db = null;
  var ready = false;

  /* ---------- Estrellas de fondo (mismo comportamiento que el portfolio) ---------- */
  (function stars() {
    var c = $("stars");
    var ctx = c.getContext("2d");
    var stars = [];
    var STAR_R = 1.5;

    function resize() {
      c.width = window.innerWidth;
      c.height = window.innerHeight;
    }
    resize();
    window.addEventListener("resize", resize);

    function addStars(n, alpha) {
      for (var i = 0; i < n; i++) {
        stars.push({
          x: Math.random() * c.width,
          y: Math.random() * c.height,
          alpha: alpha == null ? 0.9 : alpha,
          vy: -(0.3 * Math.random() + 0.008),
        });
      }
    }

    function draw() {
      ctx.clearRect(0, 0, c.width, c.height);
      stars = stars.filter(function (s) {
        return s.alpha > 0.01;
      });
      var color = document.documentElement.classList.contains("bg-negro")
        ? "#ffffff"
        : "#f19280";
      for (var i = 0; i < stars.length; i++) {
        var s = stars[i];
        ctx.globalAlpha = s.alpha;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(Math.round(s.x), Math.round(s.y), STAR_R, 0, Math.PI * 2);
        ctx.fill();
        s.y += s.vy;
        s.alpha -= 0.006;
      }
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }

    // Sincroniza el botón "cambiar fondo" con la clase que ya haya puesto
    // sisop-boot.js (localStorage) al arrancar, antes de este script.
    (function syncBgToggle() {
      var btn = $("bgToggleBtn");
      if (!btn) return;
      var negro = document.documentElement.classList.contains("bg-negro");
      btn.classList.toggle("on", negro);
      btn.setAttribute("aria-pressed", negro ? "true" : "false");
      btn.title = negro ? "Cambiar a fondo azul" : "Cambiar a fondo negro";
    })();

    // Si el visitante nunca eligió el fondo a mano (sin "sisop.bg.v1"
    // guardado), lo sigue la hora local de SU dispositivo mientras tenga la
    // pestaña abierta — para no quedarse en modo día toda la noche sólo
    // porque no recargó. Apenas toca el botón (ver "toggle-bg" más abajo,
    // que sí guarda su elección), esto deja de tocar nada.
    function fondoPorHora() {
      var h = new Date().getHours();
      return h >= 20 || h < 6;
    }
    function reaplicarFondoAuto() {
      var guardado;
      try {
        guardado = localStorage.getItem("sisop.bg.v1");
      } catch (e) {
        guardado = null;
      }
      if (guardado) return; // ya eligió a mano: no se auto-cambia más
      var htmlEl = document.documentElement;
      var quiereNegro = fondoPorHora();
      if (htmlEl.classList.contains("bg-negro") === quiereNegro) return;
      htmlEl.classList.toggle("bg-negro", quiereNegro);
      var btn = $("bgToggleBtn");
      if (btn) {
        btn.classList.toggle("on", quiereNegro);
        btn.setAttribute("aria-pressed", quiereNegro ? "true" : "false");
        btn.title = quiereNegro ? "Cambiar a fondo azul" : "Cambiar a fondo negro";
      }
    }
    setInterval(reaplicarFondoAuto, 5 * 60 * 1000);

    addStars(40, 0.5); // siembra inicial tenue
    // Al mover el mouse (hover sobre el fondo) brotan más estrellas
    window.addEventListener("mousemove", function () {
      addStars(Math.floor(Math.random() * 4) + 1);
    });
    window.addEventListener(
      "touchmove",
      function () {
        addStars(1);
      },
      { passive: true },
    );
    // Goteo ambiente, como en el portfolio
    setInterval(function () {
      addStars(Math.floor(Math.random() * 3) + 2, 0.75);
    }, 300);
    draw();
  })();

  /* ---------- Infotip: texto completo de un campo al hacer hover ---------- */
  (function infotip() {
    var tip = document.createElement("div");
    tip.className = "infotip";
    tip.hidden = true;
    document.body.appendChild(tip);
    var current = null;

    function place(x, y) {
      var pad = 8;
      tip.style.left = "0px";
      tip.style.top = "0px";
      var r = tip.getBoundingClientRect();
      var nx = x + 14;
      var ny = y + 18;
      if (nx + r.width > window.innerWidth - pad)
        nx = Math.max(pad, x - r.width - 10);
      if (ny + r.height > window.innerHeight - pad)
        ny = Math.max(pad, y - r.height - 12);
      tip.style.left = nx + "px";
      tip.style.top = ny + "px";
    }

    function hide() {
      tip.hidden = true;
      current = null;
    }

    function mostrar(el, x, y) {
      var full = el.getAttribute("data-tip");
      if (!full) return false;
      // Mostrar sólo si el contenido está recortado o es realmente largo
      var clipped = el.scrollWidth > el.clientWidth + 1;
      if (!clipped && full.length < 45) return false;
      current = el;
      tip.textContent = full;
      tip.hidden = false;
      place(x, y);
      return true;
    }

    document.addEventListener("mouseover", function (e) {
      var el = e.target.closest("[data-tip]");
      if (!el || el === current) return;
      mostrar(el, e.clientX, e.clientY);
    });

    document.addEventListener("mousemove", function (e) {
      if (tip.hidden) return;
      if (
        current &&
        !current.contains(e.target) &&
        e.target !== current
      ) {
        hide();
        return;
      }
      place(e.clientX, e.clientY);
    });

    document.addEventListener("mouseout", function (e) {
      if (current && !current.contains(e.relatedTarget)) hide();
    });

    // En touch no hay hover: un tap sobre la celda muestra/oculta el
    // infotip (mousemove no dispara, así que no sigue al dedo — se cierra
    // solo con otro tap, con scroll o al perder el foco).
    document.addEventListener("click", function (e) {
      if (!window.sisopTouch.isMobileMode()) return;
      var el = e.target.closest("[data-tip]");
      if (!el) {
        hide();
        return;
      }
      if (el === current) {
        hide();
        return;
      }
      mostrar(el, e.clientX, e.clientY);
    });

    window.addEventListener("scroll", hide, true);
    window.addEventListener("blur", hide);
  })();

  /* ---------- Resaltado del editor (comentarios, palabras reservadas, «;») ---------- */
  var editorHl = document.createElement("pre");
  editorHl.className = "editor-hl";
  editorHl.setAttribute("aria-hidden", "true");
  editor.parentNode.insertBefore(editorHl, editor);

  function escHl(s) {
    return s.replace(/[&<>]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch];
    });
  }

  // Palabras reservadas SQL (el \b a ambos lados evita coincidencias
  // parciales, así que el orden de la lista no importa).
  var SQL_KEYWORDS =
    "SELECT|FROM|WHERE|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|" +
    "TABLE|VIEW|INDEX|TRIGGER|DROP|ALTER|RENAME|ADD|COLUMN|PRIMARY|KEY|" +
    "FOREIGN|REFERENCES|UNIQUE|NOT|NULL|DEFAULT|AUTOINCREMENT|CHECK|" +
    "CONSTRAINT|JOIN|INNER|LEFT|RIGHT|OUTER|CROSS|FULL|NATURAL|ON|USING|" +
    "GROUP|BY|ORDER|HAVING|LIMIT|OFFSET|DISTINCT|AS|AND|OR|IN|IS|LIKE|" +
    "GLOB|BETWEEN|EXISTS|CASE|WHEN|THEN|ELSE|END|UNION|ALL|EXCEPT|" +
    "INTERSECT|PRAGMA|BEGIN|COMMIT|ROLLBACK|TRANSACTION|REPLACE|IF|" +
    "COLLATE|CAST|WITH|RECURSIVE|ASC|DESC|INTEGER|INT|TEXT|REAL|BLOB|" +
    "NUMERIC|BOOLEAN|DATE|DATETIME|TIMESTAMP|VARCHAR|CHAR";

  var HL_TOKEN = new RegExp(
    "(--[^\\n]*|/\\*[\\s\\S]*?\\*/)" + // 1: comentarios
      "|('(?:[^']|'')*'|\"(?:[^\"]|\"\")*\")" + // 2: cadenas / identificadores
      "|(\\b(?:" +
      SQL_KEYWORDS +
      ")\\b)" + // 3: palabras reservadas
      "|(;)", // 4: punto y coma
    "gi",
  );

  function paintHighlight() {
    var src = editor.value;
    var out = "";
    var last = 0;
    var m;
    HL_TOKEN.lastIndex = 0;
    while ((m = HL_TOKEN.exec(src))) {
      out += escHl(src.slice(last, m.index));
      if (m[1] != null) {
        out += '<span class="sql-comment">' + escHl(m[1]) + "</span>";
      } else if (m[2] != null) {
        out += escHl(m[2]); // cadenas: sin color
      } else if (m[3] != null) {
        out += '<span class="sql-kw">' + escHl(m[3]) + "</span>";
      } else {
        out += '<span class="sql-semi">' + escHl(m[4]) + "</span>";
      }
      last = m.index + m[0].length;
    }
    out += escHl(src.slice(last));
    editorHl.innerHTML = out + "\n";
    editorHl.style.transform = "translateY(" + -editor.scrollTop + "px)";
  }

  editor.addEventListener("input", paintHighlight);
  editor.addEventListener("scroll", function () {
    editorHl.style.transform = "translateY(" + -editor.scrollTop + "px)";
  });
  paintHighlight();

  /* ---------- Persistencia de la base ---------- */
  function u8ToB64(u8) {
    var s = "";
    var chunk = 0x8000;
    for (var i = 0; i < u8.length; i += chunk) {
      s += String.fromCharCode.apply(null, u8.subarray(i, i + chunk));
    }
    return btoa(s);
  }
  function b64ToU8(b64) {
    var s = atob(b64);
    var u8 = new Uint8Array(s.length);
    for (var i = 0; i < s.length; i++) u8[i] = s.charCodeAt(i);
    return u8;
  }
  function saveDb() {
    try {
      localStorage.setItem(LS_DB, u8ToB64(db.export()));
    } catch (e) {
      /* almacenamiento lleno o bloqueado: seguimos sólo en memoria */
    }
  }
  function loadDb() {
    try {
      var raw = localStorage.getItem(LS_DB);
      if (raw) return new SQL.Database(b64ToU8(raw));
    } catch (e) {}
    return new SQL.Database();
  }
  function freshDb() {
    try {
      db.close();
    } catch (e) {}
    db = new SQL.Database();
    try {
      localStorage.removeItem(LS_DB);
    } catch (e) {}
  }
  function applySeed() {
    if (SEED_SQL.trim()) db.exec(SEED_SQL);
  }
  function storedSeedVersion() {
    try {
      return localStorage.getItem(LS_SEED);
    } catch (e) {
      return null;
    }
  }
  function saveSeedVersion() {
    try {
      localStorage.setItem(LS_SEED, SEED_VERSION);
    } catch (e) {}
  }
  function hasUserTables() {
    try {
      var r = db.exec(
        "SELECT count(*) FROM sqlite_master " +
          "WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%'",
      );
      return r.length && r[0].values[0][0] > 0;
    } catch (e) {
      return false;
    }
  }
  function resetCounters() {
    stRows.textContent = "0 filas";
    stTime.textContent = "0 ms";
    setMode("Listo");
  }

  /* ---------- Estado de la barra inferior ---------- */
  function setMode(text) {
    stMode.textContent = text;
  }

  /* ---------- Panel de esquema ---------- */
  function refreshSchema() {
    schemaEl.innerHTML = "";
    var objs;
    try {
      objs = db.exec(
        "SELECT name, type FROM sqlite_master " +
          "WHERE type IN ('table','view') AND name NOT LIKE 'sqlite_%' " +
          "ORDER BY type, name",
      );
    } catch (e) {
      objs = [];
    }
    if (!objs.length || !objs[0].values.length) {
      var d = document.createElement("div");
      d.className = "empty";
      d.textContent = "(no hay tablas · creá una)";
      schemaEl.appendChild(d);
      return;
    }
    objs[0].values.forEach(function (row) {
      var name = row[0];
      var wrap = document.createElement("div");
      wrap.className = "tbl";
      var head = document.createElement("div");
      head.className = "tname";
      head.textContent = name;
      head.title = "Insertar SELECT * FROM " + name;
      head.addEventListener("click", function () {
        insertAtCursor("SELECT * FROM " + quoteId(name) + ";\n");
        editor.focus();
      });
      wrap.appendChild(head);
      try {
        var info = db.exec("PRAGMA table_info(" + quoteId(name) + ")");
        if (info.length) {
          info[0].values.forEach(function (col) {
            var c = document.createElement("div");
            c.className = "col";
            c.innerHTML =
              esc(col[1]) +
              ' <span class="type">' +
              esc(col[2] || "") +
              "</span>";
            c.setAttribute("data-tip", col[1] + " " + (col[2] || ""));
            wrap.appendChild(c);
          });
        }
      } catch (e) {}
      schemaEl.appendChild(wrap);
    });
  }

  function quoteId(id) {
    return '"' + String(id).replace(/"/g, '""') + '"';
  }

  /* Vuelca el texto de una celda convirtiendo URLs y emails en enlaces
     accent que abren en una pestaña nueva. Devuelve true si generó alguno. */
  function fillCell(td, str) {
    var re =
      /(https?:\/\/[^\s]+)|([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/g;
    var last = 0;
    var made = false;
    var m;
    while ((m = re.exec(str))) {
      if (m.index > last) {
        td.appendChild(document.createTextNode(str.slice(last, m.index)));
      }
      var token = m[0];
      var trail = "";
      if (m[1]) {
        var t = token.match(/[)\].,;:!?"']+$/);
        if (t) {
          trail = t[0];
          token = token.slice(0, -trail.length);
        }
      }
      var a = document.createElement("a");
      a.href = m[1] ? token : "mailto:" + token;
      a.textContent = token;
      a.title = token;
      if (m[1]) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      td.appendChild(a);
      if (trail) td.appendChild(document.createTextNode(trail));
      last = m.index + m[0].length;
      made = true;
    }
    if (last < str.length) {
      td.appendChild(document.createTextNode(str.slice(last)));
    }
    return made;
  }
  function esc(v) {
    return String(v).replace(/[&<>"]/g, function (ch) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[
        ch
      ];
    });
  }

  /* ---------- Ejecutar ---------- */
  function run() {
    if (!ready) return;
    paintHighlight();
    var sql = editor.value.trim();
    if (!sql) {
      renderMessage("Escribí una consulta primero.", "ok");
      return;
    }
    setMode("Ejecutando…");
    var t0 = performance.now();
    var res;
    try {
      res = db.exec(sql);
    } catch (err) {
      var ms = (performance.now() - t0).toFixed(1);
      stTime.textContent = ms + " ms";
      stRows.textContent = "—";
      setMode("Error");
      renderError(err.message || String(err));
      return;
    }
    var ms2 = (performance.now() - t0).toFixed(1);
    stTime.textContent = ms2 + " ms";
    saveDb();
    refreshSchema();

    if (!res.length) {
      var affected = db.getRowsModified();
      stRows.textContent = affected + " filas";
      setMode("Listo");
      renderMessage(
        "Sentencia ejecutada. Filas afectadas: " + affected + ".",
        "ok",
      );
      return;
    }

    var total = res.reduce(function (n, r) {
      return n + r.values.length;
    }, 0);
    stRows.textContent =
      total +
      (total === 1 ? " fila" : " filas") +
      (res.length > 1 ? " · " + res.length + " resultados" : "");
    setMode("Listo");
    renderResults(res);
  }

  function renderResults(res) {
    results.innerHTML = "";
    res.forEach(function (rs, i) {
      var block = document.createElement("div");
      block.className = "rs-block";
      if (res.length > 1) {
        var cap = document.createElement("div");
        cap.className = "rs-caption";
        cap.textContent = "Resultado " + (i + 1);
        block.appendChild(cap);
      }
      var table = document.createElement("table");
      table.className = "grid";
      var thead = document.createElement("thead");
      var htr = document.createElement("tr");
      rs.columns.forEach(function (col) {
        var th = document.createElement("th");
        th.textContent = col;
        th.setAttribute("data-tip", col);
        htr.appendChild(th);
      });
      thead.appendChild(htr);
      table.appendChild(thead);
      var tbody = document.createElement("tbody");
      rs.values.forEach(function (rowVals) {
        var tr = document.createElement("tr");
        rowVals.forEach(function (val) {
          var td = document.createElement("td");
          if (val === null) {
            td.textContent = "NULL";
            td.className = "null";
          } else if (val instanceof Uint8Array) {
            td.textContent = "[blob " + val.length + " b]";
            td.className = "null";
          } else {
            var s = String(val);
            if (fillCell(td, s)) td.classList.add("has-link");
            // Tooltip con el valor completo cuando la celda se recorta
            td.setAttribute("data-tip", s);
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      block.appendChild(table);
      if (!rs.values.length) {
        var em = document.createElement("div");
        em.className = "msg ok";
        em.textContent = "0 filas.";
        block.appendChild(em);
      }
      results.appendChild(block);
    });
  }

  function renderMessage(text, kind) {
    results.innerHTML = "";
    var m = document.createElement("div");
    m.className = "msg " + (kind || "ok");
    m.textContent = text;
    results.appendChild(m);
  }

  function renderError(text) {
    results.innerHTML = "";
    var m = document.createElement("div");
    m.className = "msg err";
    var x = document.createElement("span");
    x.className = "x";
    x.textContent = "!";
    var t = document.createElement("span");
    t.textContent = text;
    m.appendChild(x);
    m.appendChild(t);
    results.appendChild(m);
  }

  /* ---------- Utilidades de editor ---------- */
  function insertAtCursor(text) {
    var s = editor.selectionStart;
    var e = editor.selectionEnd;
    editor.value =
      editor.value.slice(0, s) + text + editor.value.slice(e);
    var pos = s + text.length;
    editor.selectionStart = editor.selectionEnd = pos;
    paintHighlight();
  }

  var TPL_CREATE =
    "CREATE TABLE ejemplo (\n" +
    "  id      INTEGER PRIMARY KEY,\n" +
    "  nombre  TEXT NOT NULL,\n" +
    "  valor   REAL,\n" +
    "  creado  TEXT DEFAULT CURRENT_TIMESTAMP\n" +
    ");\n";

  var EX_DEMO =
    "-- Tecnologías por categoría\n" +
    "SELECT categoria, count(*) AS cantidad,\n" +
    "       group_concat(nombre, ', ') AS lista\n" +
    "FROM tecnologias\n" +
    "GROUP BY categoria\n" +
    "ORDER BY cantidad DESC;";

  var EX_JOIN =
    "-- Experiencia laboral, de la más reciente a la más antigua\n" +
    "SELECT puesto, empresa, periodo\n" +
    "FROM experiencia\n" +
    "ORDER BY inicio DESC;";

  var EX_CV =
    "-- Una foto del CV en una sola consulta\n" +
    "SELECT 'estudios'    AS tabla, count(*) AS filas FROM estudios\n" +
    "UNION ALL SELECT 'experiencia',  count(*) FROM experiencia\n" +
    "UNION ALL SELECT 'proyectos',    count(*) FROM proyectos\n" +
    "UNION ALL SELECT 'tecnologias',  count(*) FROM tecnologias\n" +
    "UNION ALL SELECT 'idiomas',      count(*) FROM idiomas\n" +
    "UNION ALL SELECT 'musica',       count(*) FROM musica;";

  /* ---------- Acciones ---------- */
  var actions = {
    run: run,
    "clear-editor": function () {
      editor.value = "";
      paintHighlight();
      editor.focus();
    },
    "select-all": function () {
      editor.focus();
      editor.select();
    },
    "tpl-create": function () {
      insertAtCursor(TPL_CREATE);
      editor.focus();
    },
    "ex-master": function () {
      editor.value =
        "SELECT name, type, sql FROM sqlite_master ORDER BY type, name;";
      run();
    },
    "ex-demo": function () {
      editor.value = EX_DEMO;
      run();
    },
    "ex-join": function () {
      editor.value = EX_JOIN;
      run();
    },
    "ex-cv": function () {
      editor.value = EX_CV;
      run();
    },
    "seed-agus": function () {
      if (!ready) {
        renderMessage("Todavía se está cargando el motor SQL…", "ok");
        return;
      }
      if (!SEED_SQL.trim()) {
        renderMessage(
          "La base «Agus» todavía no tiene esquema semilla definido.",
          "ok",
        );
        return;
      }
      window.sisopDialog
        .confirm({
          title: "Restaurar base Agus",
          message:
            "¿Restaurar la base «Agus»? Se reemplaza todo por el esquema original.",
          okLabel: "Restaurar",
          danger: true,
        })
        .then(function (ok) {
          if (!ok) return;
          freshDb();
          applySeed();
          saveDb();
          saveSeedVersion();
          refreshSchema();
          renderMessage("Base «Agus» restaurada desde el esquema.", "ok");
          resetCounters();
        });
    },
    "reset-db": function () {
      if (!ready) {
        renderMessage("Todavía se está cargando el motor SQL…", "ok");
        return;
      }
      window.sisopDialog
        .confirm({
          title: "Vaciar base",
          message: "¿Vaciar la base? Se borran todas las tablas y filas.",
          okLabel: "Vaciar",
          danger: true,
        })
        .then(function (ok) {
          if (!ok) return;
          freshDb();
          saveSeedVersion();
          refreshSchema();
          renderMessage("Base vacía. Lienzo en blanco.", "ok");
          resetCounters();
        });
    },
    restart: function () {
      var htmlEl = document.documentElement;
      if (htmlEl.dataset.apagando) return;
      htmlEl.dataset.apagando = "1";

      // Recarga forzando traer todo de nuevo del servidor (equivalente a
      // un Ctrl+F5): la query de cache-busting evita que el navegador
      // sirva el HTML desde su caché.
      var recargar = function () {
        window.location.replace(
          window.location.pathname + "?_r=" + Date.now() + window.location.hash,
        );
      };

      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        recargar();
        return;
      }

      htmlEl.classList.add("crt-shutdown");
      // Animación de apagado (~620ms) + una pausita a pantalla negra,
      // como el POST de una BIOS antes de que el equipo vuelva a arrancar.
      setTimeout(recargar, 620 + 850);
    },
    home: function () {
      var htmlEl = document.documentElement;
      if (htmlEl.dataset.apagando) return;
      htmlEl.dataset.apagando = "1";

      var navegado = false;
      var salir = function () {
        if (navegado) return;
        navegado = true;
        window.location.href = "index.html";
      };

      if (
        !window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ) {
        htmlEl.classList.add("crt-shutdown");
      }

      // Espera a que el sonido de apagado termine de sonar completo
      var tope = setTimeout(salir, 6000);
      var salirCorto = function () {
        clearTimeout(tope);
        setTimeout(salir, 640);
      };
      try {
        // Sonido propio de apagado del sistema operativo
        var snd = new Audio("audio/sisopoff.m4a");
        snd.volume = 1;
        snd.addEventListener("loadedmetadata", function () {
          if (isFinite(snd.duration) && snd.duration > 0) {
            clearTimeout(tope);
            tope = setTimeout(salir, snd.duration * 1000 + 400);
          }
        });
        snd.addEventListener("ended", function () {
          clearTimeout(tope);
          salir();
        });
        snd.addEventListener("error", salirCorto);
        snd.play().catch(salirCorto);
      } catch (e) {
        salirCorto();
      }
    },
    "toggle-bg": function () {
      var htmlEl = document.documentElement;
      var negro = htmlEl.classList.toggle("bg-negro");
      try {
        localStorage.setItem("sisop.bg.v1", negro ? "negro" : "azul");
      } catch (e) {}
      var btn = $("bgToggleBtn");
      if (btn) {
        btn.classList.toggle("on", negro);
        btn.setAttribute("aria-pressed", negro ? "true" : "false");
        btn.title = negro ? "Cambiar a fondo azul" : "Cambiar a fondo negro";
      }
    },
    about: function () {
      $("about").hidden = false;
    },
    "about-close": function () {
      $("about").hidden = true;
    },
  };

  document.addEventListener("click", function (ev) {
    var el = ev.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act");
    if (actions[act]) {
      ev.preventDefault();
      actions[act]();
      closeMenus();
    }
  });

  /* ---------- Menús desplegables ---------- */
  var menuBar = $("menuBar");
  function closeMenus() {
    menuBar.querySelectorAll(".dropdown").forEach(function (d) {
      d.hidden = true;
    });
    menuBar.querySelectorAll("button[data-menu]").forEach(function (b) {
      b.classList.remove("open");
    });
  }
  menuBar.querySelectorAll("button[data-menu]").forEach(function (btn) {
    btn.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var name = btn.getAttribute("data-menu");
      var dd = menuBar.querySelector(
        '.dropdown[data-for="' + name + '"]',
      );
      var isOpen = !dd.hidden;
      closeMenus();
      if (!isOpen) {
        dd.hidden = false;
        dd.style.left = btn.offsetLeft + "px";
        btn.classList.add("open");
      }
    });
    btn.addEventListener("mouseenter", function () {
      if (menuBar.querySelector(".dropdown:not([hidden])")) {
        btn.click();
      }
    });
  });
  document.addEventListener("click", closeMenus);

  /* ---------- Programa: abrir / cerrar ---------- */
  var taskWin = $("taskWin");
  var deskIcon = $("deskIcon");

  function programRunning() {
    return !win.classList.contains("closed");
  }
  function syncTaskbar() {
    var running = programRunning();
    var open = running && !win.classList.contains("minimized");
    taskWin.hidden = !running; // cerrado => el programa no está en ejecución
    taskWin.classList.toggle("active", open);
    taskWin.setAttribute("aria-pressed", open ? "true" : "false");
  }
  function openProgram() {
    var wasClosed = win.classList.contains("closed");
    win.classList.remove("closed", "minimized");
    deskIcon.classList.remove("selected");
    syncTaskbar();
    // Arranque limpio: la consulta previa se perdió al cerrar,
    // se vuelve a mostrar (y ejecutar) la consulta de «info».
    if (wasClosed) {
      editor.value = DEFAULT_QUERY;
      paintHighlight();
      if (ready) run();
      else ensureEngine(); // primera vez que se abre: recién ahí se pide el motor SQL
    }
    try {
      editor.focus();
    } catch (e) {}
  }
  function closeProgram() {
    win.classList.remove("minimized", "maximized");
    win.classList.add("closed");
    win.style.cssText = ""; // descartar posición/tamaño de la sesión
    // Descartar la consulta en curso y volver a la de «info».
    editor.value = DEFAULT_QUERY;
    paintHighlight();
    syncTaskbar();
  }

  /* Icono de escritorio de Agus.db: doble clic abre.
     (La selección con un clic la maneja «desktop98», en
     sisop-winmanager.js, que centraliza el comportamiento de
     todos los iconos.) */
  window.sisopTouch.bindActivate(deskIcon, openProgram);
  deskIcon.addEventListener("keydown", function (e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      openProgram();
    }
  });

  taskWin.addEventListener("click", function () {
    if (win.classList.contains("minimized")) {
      win.classList.remove("minimized");
    } else {
      win.classList.add("minimized");
      win.classList.remove("maximized");
    }
    syncTaskbar();
  });

  (function taskClock() {
    var el = $("trayClock");
    function pad(n) {
      return (n < 10 ? "0" : "") + n;
    }
    function tick() {
      var d = new Date();
      el.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes());
      el.title = d.toLocaleDateString();
    }
    tick();
    setInterval(tick, 15000);
  })();

  /* ---------- Botones de la barra de título ---------- */
  document.querySelectorAll("[data-win]").forEach(function (b) {
    b.addEventListener("click", function () {
      var a = b.getAttribute("data-win");
      if (a === "min") {
        win.classList.toggle("minimized");
        win.classList.remove("maximized");
      } else if (a === "max") {
        toggleMax();
      } else if (a === "close") {
        closeProgram();
      }
      syncTaskbar();
    });
  });
  syncTaskbar();

  var maxState = null;
  function toggleMax() {
    win.classList.remove("minimized");
    if (win.classList.contains("maximized")) {
      win.classList.remove("maximized");
      win.style.cssText = maxState || "";
      maxState = null;
    } else {
      maxState = win.style.cssText;
      win.classList.add("maximized");
      win.style.cssText =
        "position:fixed;top:8px;left:8px;right:8px;bottom:calc(var(--taskbar-h) + 8px);width:auto;height:auto;";
    }
  }

  /* ---------- Arrastrar la ventana por la barra de título ---------- */
  (function drag() {
    var bar = $("titleBar");
    var dragging = false;
    var sx, sy, ox, oy;
    bar.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".tb-btn")) return;
      if (win.classList.contains("maximized")) return;
      if (window.sisopTouch.isMobileMode()) return;
      dragging = true;
      var r = win.getBoundingClientRect();
      ox = r.left;
      oy = r.top;
      sx = e.clientX;
      sy = e.clientY;
      win.style.position = "fixed";
      win.style.margin = "0";
      win.style.left = ox + "px";
      win.style.top = oy + "px";
      bar.setPointerCapture(e.pointerId);
    });
    bar.addEventListener("pointermove", function (e) {
      if (!dragging) return;
      win.style.left = ox + (e.clientX - sx) + "px";
      win.style.top = Math.max(0, oy + (e.clientY - sy)) + "px";
    });
    bar.addEventListener("pointerup", function (e) {
      dragging = false;
      try {
        bar.releasePointerCapture(e.pointerId);
      } catch (er) {}
    });

    // Al cambiar el tamaño de la ventana del navegador (o rotar el
    // teléfono), mantener la ventana arrastrada dentro de la vista.
    window.addEventListener("resize", function () {
      if (win.classList.contains("maximized")) return;
      if (!win.style.left && !win.style.top) return;
      var r = win.getBoundingClientRect();
      var maxLeft = Math.max(0, window.innerWidth - r.width);
      var maxTop = Math.max(0, window.innerHeight - 40);
      win.style.left =
        Math.min(Math.max(0, parseFloat(win.style.left) || 0), maxLeft) +
        "px";
      win.style.top =
        Math.min(Math.max(0, parseFloat(win.style.top) || 0), maxTop) +
        "px";
    });
  })();

  /* ---------- Atajos de teclado en el editor ---------- */
  editor.addEventListener("keydown", function (e) {
    if (
      e.key === "F5" ||
      ((e.ctrlKey || e.metaKey) && e.key === "Enter")
    ) {
      e.preventDefault();
      run();
    } else if (e.key === "Tab") {
      e.preventDefault();
      insertAtCursor("  ");
    }
  });

  /* ---------- Arranque del motor SQL ---------- */
  /* El editor arranca siempre con el ejemplo del HTML (no se guarda
     la última consulta). Lo que sí persiste es la base «Agus».

     El motor (sql.js + su binario .wasm, ~1.5MB entre los dos) NO se pide
     al cargar la página: se pide recién la primera vez que se abre el
     programa (ver ensureEngine() más abajo, llamado desde openProgram()).
     Así los visitantes que nunca abren la consola SQL no pagan esa
     descarga — la mayoría del peso de sisop.html está acá. */
  var engineLoading = null;

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("No se pudo cargar " + src));
      };
      document.head.appendChild(s);
    });
  }

  function ensureEngine() {
    if (ready || engineLoading) return engineLoading;
    setMode("Cargando motor SQL…");
    schemaEl.innerHTML = '<div class="empty">Cargando…</div>';
    var libReady =
      typeof initSqlJs === "function"
        ? Promise.resolve()
        : loadScript(
            "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/sql-wasm.min.js",
          );

    engineLoading = libReady
      .then(function () {
        if (typeof initSqlJs !== "function") {
          throw new Error("sql.js no disponible");
        }
        return initSqlJs({
          locateFile: function (f) {
            return "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" + f;
          },
        });
      })
      .then(function (lib) {
        SQL = lib;
        db = loadDb();

        /* Sembrar la base «Agus» si hay esquema y todavía no está
           aplicado (primera visita o SEED_VERSION nueva). */
        if (
          SEED_SQL.trim() &&
          (storedSeedVersion() !== SEED_VERSION || !hasUserTables())
        ) {
          try {
            if (storedSeedVersion() !== SEED_VERSION) freshDb();
            applySeed();
            saveDb();
            saveSeedVersion();
          } catch (e) {
            renderError(
              "Error al sembrar la base «Agus»: " + (e.message || e),
            );
          }
        } else if (!storedSeedVersion()) {
          saveSeedVersion();
        }

        ready = true;
        setMode("Listo");
        refreshSchema();
        if (!win.classList.contains("closed")) {
          run();
          editor.focus();
        }
      })
      .catch(function (err) {
        engineLoading = null; // permite reintentar en el próximo open
        setMode("Error de carga");
        schemaEl.innerHTML =
          '<div class="empty">No se pudo cargar el motor SQL (¿sin internet?).</div>';
        renderError(
          "No se pudo iniciar SQLite (sql.js): " + (err.message || err),
        );
      });
    return engineLoading;
  }
})();
