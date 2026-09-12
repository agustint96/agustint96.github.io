(function () {
  "use strict";

  var LS_DB = "sqlconsole:v1:db";
  var LS_SEED = "sqlconsole:v1:seed";

  // Las define stickyNotes(); las usa la app «Notas».
  var agregarNota = null;
  var notasBienvenida = null;

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
     (La selección con un clic la maneja «desktop98», que
     centraliza el comportamiento de todos los iconos.) */
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
          '<img src="ico/grabadora.png" alt="" style="width:100%;height:100%;object-fit:contain;display:block;">',
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
        if (e.target.closest(".tb-btn")) return;
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

    function buildIframe(cfg, bd) {
      var f = document.createElement("iframe");
      f.src = cfg.url;
      f.title = cfg.title;
      f.setAttribute("allow", "fullscreen; autoplay; clipboard-write");
      f.setAttribute("referrerpolicy", "no-referrer-when-downgrade");
      var load = document.createElement("div");
      load.className = "w98-loading";
      load.textContent = "Cargando…";
      f.addEventListener("load", function () {
        load.remove();
        // Juegos como Casus Liber: que el teclado responda apenas carga,
        // sin que el visitante tenga que clickear adentro primero.
        if (cfg.game) focusIframe(f);
      });
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
          grid
            .querySelectorAll(".folder-icon.selected")
            .forEach(function (x) {
              x.classList.remove("selected");
            });
          b.classList.add("selected");
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
        '<textarea placeholder="Escribí una nota…" spellcheck="false" autocomplete="off"></textarea>' +
        '<div class="notes-foot">' +
        '<button class="btn" type="button" data-notes="guardar">Guardar nota</button>' +
        '<button class="btn" type="button" data-notes="pin">Pegar en el escritorio</button>' +
        "</div>";
      var ta = wrap.querySelector("textarea");
      function pin() {
        var text = ta.value.replace(/\s+$/, "");
        if (!text.trim()) {
          ta.focus();
          return;
        }
        if (typeof agregarNota === "function") agregarNota(text);
        ta.value = "";
        ta.focus();
      }
      // «Guardar nota»: a diferencia del papelito de arriba (que no tiene
      // ícono en ningún lado: si lo cerrás, se borró), esto la deja archivada
      // con su propio ícono en el escritorio — se puede volver a abrir
      // después de cerrarla con sólo hacerle doble clic.
      function guardar() {
        var text = ta.value.replace(/\s+$/, "");
        if (!text.trim()) {
          ta.focus();
          return;
        }
        if (window.sisopUserFiles && typeof window.sisopUserFiles.saveNote === "function") {
          window.sisopUserFiles.saveNote(text);
        }
        ta.value = "";
        ta.focus();
      }
      wrap
        .querySelector('[data-notes="pin"]')
        .addEventListener("click", pin);
      wrap
        .querySelector('[data-notes="guardar"]')
        .addEventListener("click", guardar);
      ta.addEventListener("keydown", function (e) {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
          e.preventDefault();
          pin();
        }
      });
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
    function clearDeskSel() {
      deskIcons.forEach(function (i) {
        i.classList.remove("selected");
      });
    }
    deskIcons.forEach(function (ic) {
      ic.addEventListener("click", function (e) {
        e.stopPropagation();
        clearDeskSel();
        ic.classList.add("selected");
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
                text: n.text.value,
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
        '<textarea class="pi-text" rows="1" spellcheck="false" wrap="soft"></textarea>' +
        '<span class="pi-resize" title="Cambiar tamaño" aria-hidden="true"></span>';
      var text = el.querySelector(".pi-text");
      var grip = el.querySelector(".pi-resize");
      text.value = data.text || "";
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
          text: text.value,
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
          text.setSelectionRange(text.value.length, text.value.length);
        } catch (_) {}
      }
      window.sisopTouch.bindActivate(el, function (e) {
        if (e.target.closest(".pi-close")) return;
        if (e.target.closest(".pi-resize")) return;
        if (justDragged) return;
        editar();
      });
      text.addEventListener("input", autogrow);
      text.addEventListener("blur", function () {
        el.classList.remove("editing");
        if (!text.value.trim()) {
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
        }
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

    /* API que usa la app «Notas» al pegar un papelito */
    agregarNota = function (texto) {
      var n = crear({ text: texto });
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

  /* ---------- Arranque ---------- */
  /* El editor arranca siempre con el ejemplo del HTML (no se guarda
     la última consulta). Lo que sí persiste es la base «Agus». */

  if (typeof initSqlJs !== "function") {
    setMode("Sin conexión");
    schemaEl.innerHTML =
      '<div class="empty">No se pudo cargar el motor SQL (sin internet).</div>';
    renderError(
      "No se pudo cargar SQLite (sql.js) desde la CDN. Revisá la conexión y recargá.",
    );
    return;
  }

  initSqlJs({
    locateFile: function (f) {
      return "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/" + f;
    },
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
      // El programa arranca cerrado (sólo el icono del escritorio);
      // la consulta se ejecuta recién al abrirlo con doble clic.
      if (!win.classList.contains("closed")) {
        run();
        editor.focus();
      }
    })
    .catch(function (err) {
      setMode("Error de carga");
      schemaEl.innerHTML =
        '<div class="empty">No se pudo iniciar el motor.</div>';
      renderError("No se pudo iniciar SQLite: " + (err.message || err));
    });
})();
