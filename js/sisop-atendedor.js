/* Atendedor.ia: aplicación de escritorio + chat con IA (Cloudflare
   Workers AI, vía el Worker de atendedor-worker/). Se abre desde su icono,
   tiene botón en la barra de tareas, se arrastra, y recuerda su posición,
   si estaba abierto y la conversación. */
(function () {
  /* ═══════════════════════════════════════════════════════════════════
     URL del Worker de Cloudflare. Pegala acá después del deploy
     (ver atendedor-worker/README.md). Si queda vacía, el chat avisa
     que falta configurarlo.
     ═══════════════════════════════════════════════════════════════════ */
  var ATENDEDOR_API = "https://atendedor-ia.agustintardella7.workers.dev";

  function init() {
    var el = document.getElementById("assistant");
    var icon = document.getElementById("deskAtendedor");
    var tasks = document.getElementById("tasks");
    if (!el || !icon || !tasks) return;

    var capas = el.querySelectorAll(".assistant-img");
    var cerrar = el.querySelector(".assistant-close");
    var chat = document.getElementById("atendedorChat");
    var chatForm = document.getElementById("atendedorForm");
    var chatInput = document.getElementById("atendedorInput");
    var globoBot = document.getElementById("atGloboBot");
    var globoUser = document.getElementById("atGloboUser");
    var chatX = chat.querySelector(".atendedor-chat-x");
    var chatAudioBtn = chat.querySelector(".atendedor-chat-audio");
    /* Frases con las que el Atendedor te recibe: siempre arranca cortante. */
    var RECIBE = [
      "¿Quién te conoce?",
      "¿Quién te conoce, papá?",
      "Atiendo boludos…",
      "Sos boludo y no tenés huevo",
      "Me importa un carajo, tomatela te dije…",
      "¡Preguntale a otro!",
      "No te doy bola",
      "¿No te das cuenta que atiendo boludos?",
    ];
    function fraseRecibe() {
      return RECIBE[Math.floor(Math.random() * RECIBE.length)];
    }
    var REST = "bot/atendedor1.png";
    var POKED = "bot/atendedor2.png";
    var LS = "sisop:atendedor";
    var LS_CHAT = "sisop:atendedor:chat";
    var volver = 0;
    var estado = "cerrado"; // "cerrado" | "abierto" | "min"
    var taskBtn = null;
    var historial = [];
    var enviando = false;

    var pre = new Image();
    pre.src = POKED; // precarga para que el cambio sea instantáneo

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
    function setSrc(src) {
      for (var i = 0; i < capas.length; i++) capas[i].src = src;
    }

    /* ---------- posición (arrastrable, se guarda) ---------- */
    function colocar(x, y) {
      var maxX = Math.max(2, window.innerWidth - el.offsetWidth - 2);
      var maxY = Math.max(
        2,
        window.innerHeight - taskbarH() - el.offsetHeight - 2,
      );
      x = Math.max(2, Math.min(x, maxX));
      y = Math.max(2, Math.min(y, maxY));
      el.style.left = x + "px";
      el.style.top = y + "px";
      el.style.right = "auto";
      el.style.bottom = "auto";
    }
    function guardar() {
      try {
        localStorage.setItem(
          LS,
          JSON.stringify({
            open: estado !== "cerrado",
            x: parseFloat(el.style.left),
            y: parseFloat(el.style.top),
          }),
        );
      } catch (e) {}
    }

    /* ---------- barra de tareas ---------- */
    function taskActiva(v) {
      if (!taskBtn) return;
      taskBtn.classList.toggle("active", !!v);
      taskBtn.setAttribute("aria-pressed", v ? "true" : "false");
    }
    function ponerTask() {
      if (taskBtn) return;
      taskBtn = document.createElement("button");
      taskBtn.type = "button";
      taskBtn.className = "task-btn active";
      taskBtn.title = "Atendedor.ia";
      taskBtn.innerHTML =
        '<img class="tb-icon" src="bot/atendedor1.png" alt="" />' +
        "<span>Atendedor.ia</span>";
      taskBtn.addEventListener("click", function () {
        if (estado === "min") restaurar();
        else minimizar();
      });
      tasks.appendChild(taskBtn);
    }
    function sacarTask() {
      if (taskBtn) {
        taskBtn.remove();
        taskBtn = null;
      }
    }

    /* ---------- abrir / cerrar / minimizar ---------- */
    function abrir() {
      var primera = estado === "cerrado";
      estado = "abierto";
      el.hidden = false;
      ponerTask();
      taskActiva(true);
      if (primera && !el.style.left) {
        requestAnimationFrame(function () {
          colocar(
            window.innerWidth - el.offsetWidth - 8,
            window.innerHeight - taskbarH() - el.offsetHeight - 8,
          );
        });
      }
      guardar();
    }
    function restaurar() {
      estado = "abierto";
      el.hidden = false;
      taskActiva(true);
    }
    function minimizar() {
      estado = "min";
      el.hidden = true;
      cerrarChat();
      taskActiva(false);
    }
    function cerrarApp() {
      estado = "cerrado";
      el.hidden = true;
      cerrarChat();
      olvidarChat();
      sacarTask();
      guardar();
    }
    function activarDesdeIcono() {
      if (estado === "cerrado") abrir();
      else if (estado === "min") restaurar();
      /* Al abrir el atendedor te recibe hablándote, chat a la vista. */
      abrirChat();
    }

    /* ---------- cara: reposo / hablando ---------- */
    function rebote() {
      el.classList.remove("poke");
      void el.offsetWidth;
      el.classList.add("poke");
    }
    function caraHabla(v) {
      clearTimeout(volver);
      if (v) {
        setSrc(POKED);
      } else {
        volver = setTimeout(function () {
          setSrc(REST);
        }, 600);
      }
    }
    el.addEventListener("animationend", function (e) {
      if (
        e.animationName &&
        e.animationName.indexOf("assistant-poke") === 0
      )
        el.classList.remove("poke");
    });

    /* ═══════════════ AUDIOTECA — mini radioteatro ═══════════════
     Los .m4a de bot/audio/ son un guión fijo (1..18); cada uno es
     del BOT o mío ("yo"). Suenan EN ORDEN a medida que la charla
     real avanza: en cada mensaje nuevo miramos de quién es el
     próximo audio del guión. Si coincide con quién acaba de
     hablar, suena y el puntero avanza; si no, se queda esperando.
     Por eso mi primer mensaje es mudo (el próximo audio es del
     bot) y el ruido recién vuelve cuando el bot habla otra vez. */
    var AUDIO_GUION = [
      ["bot", "1_Quien_te_conoce.m4a"],
      ["bot", "2_y_vos_sos_un_boludo.m4a"],
      ["yo", "3_yo_le_pregunto_usted_contesta_insolentemente.m4a"],
      ["yo", "4_75_centavos_el_minimo.m4a"],
      ["bot", "5_me_importa_un_carajo_tomatelas_te_dije.m4a"],
      ["yo", "6_ah_si_porque_tomatela.m4a"],
      ["bot", "7_no_te_doy_bola.m4a"],
      ["bot", "8_Quien_te_conoce_papa.m4a"],
      ["yo", "9_Yo_simplemente_vengo_a_hacer_una_pregunta.m4a"],
      ["bot", "10_Preguntale_a_otro.m4a"],
      ["yo", "11_Asi_atiende_a_la_gente_por_ser_inspector.m4a"],
      ["bot", "12_Atiendo_boludos.m4a"],
      ["bot", "13_No_te_das_cuenta_que_atiendo_boludos.m4a"],
      [
        "yo",
        "14_Me_parece_que_es_inspector_de_una_linea_de_colectivos.m4a",
      ],
      ["bot", "15_Tas_equivocado.m4a"],
      ["yo", "16_Gente_como_usted_no_tiene_derecho.m4a"],
      ["bot", "17_So_boludo_y_no_tenes_huevo.m4a"],
      ["yo", "18_No_atienda_a_la_gente_asi_le_hace_mal.m4a"],
    ];
    var audioIdx = 0;
    var audioActual = null;
    var LS_AUDIO = "sisop:atendedor:audio";
    var audioOn = true;
    try {
      audioOn = localStorage.getItem(LS_AUDIO) !== "0";
    } catch (e) {}
    var SVG_AUDIO_ON =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M4 9v6h4l5 4V5L8 9H4z"/>' +
      '<path d="M15 8.8a4 4 0 0 1 0 6.4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      "</svg>";
    var SVG_AUDIO_OFF =
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path d="M4 9v6h4l5 4V5L8 9H4z"/>' +
      '<path d="M15 9l6 6M21 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>' +
      "</svg>";
    function pintarAudioBtn() {
      if (!chatAudioBtn) return;
      chatAudioBtn.innerHTML = audioOn ? SVG_AUDIO_ON : SVG_AUDIO_OFF;
      var t = audioOn ? "Silenciar audios" : "Activar audios";
      chatAudioBtn.title = t;
      chatAudioBtn.setAttribute("aria-label", t);
    }
    function audioReset() {
      audioIdx = 0;
      if (audioActual) {
        try {
          audioActual.pause();
        } catch (e) {}
        audioActual = null;
      }
    }
    function audioTurno(quien) {
      if (audioIdx >= AUDIO_GUION.length) return;
      var paso = AUDIO_GUION[audioIdx];
      if (paso[0] !== quien) return; // todavía no le toca: mudo
      audioIdx++;
      if (!audioOn) return; // audios silenciados: avanza igual, pero mudo
      try {
        if (audioActual) audioActual.pause();
        audioActual = new Audio("bot/audio/" + paso[1]);
        audioActual.play().catch(function () {});
      } catch (e) {}
    }

    /* ═══════════════ CHAT ═══════════════ */
    /* El historial vive sólo en memoria: no se persiste y se borra al
     cerrar el atendedor. Nada sobrevive a un reload ni a un cierre. */
    function guardarChat() {}
    function olvidarChat() {
      historial = [];
      audioReset();
      try {
        localStorage.removeItem(LS_CHAT);
      } catch (e) {}
      decirBot(fraseRecibe());
      decirUser("");
    }
    function decirBot(texto, clase) {
      globoBot.textContent = texto;
      globoBot.className =
        "at-globo at-globo-bot" + (clase ? " " + clase : "");
    }
    function decirUser(texto) {
      if (texto) {
        globoUser.textContent = texto;
        globoUser.hidden = false;
      } else {
        globoUser.hidden = true;
      }
    }
    function toggleChat() {
      if (chat.hidden) abrirChat();
      else cerrarChat();
    }
    function abrirChat() {
      chat.hidden = false;
      rebote();
      /* si no entra arriba, los globos van hacia abajo */
      var r = el.getBoundingClientRect();
      el.classList.toggle("chat-abajo", r.top < 360);

      /* Siempre te recibe hablándote y cortante, sin importar lo que se
       haya charlado antes. */
      decirUser("");
      decirBot(fraseRecibe());
      audioTurno("bot"); // el saludo también es el bot hablando
      caraHabla(true);
      caraHabla(false);

      setTimeout(function () {
        try {
          chatInput.focus();
        } catch (e) {}
      }, 40);
    }
    function cerrarChat() {
      chat.hidden = true;
    }

    function enviar(texto) {
      texto = (texto || "").trim();
      if (!texto || enviando) return;

      decirUser(texto);
      chatInput.value = "";

      if (!ATENDEDOR_API) {
        decirBot(
          "Todavía no estoy enchufado: falta pegar la URL del Worker (ATENDEDOR_API) en sisop.html. Ver atendedor-worker/README.md.",
          "at-error",
        );
        return;
      }

      historial.push({ role: "user", content: texto });
      audioTurno("yo"); // yo acabo de escribir
      guardarChat();

      enviando = true;
      chat.classList.add("cargando");
      caraHabla(true);
      decirBot("…", "pensando");

      fetch(ATENDEDOR_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historial.slice(-8) }),
      })
        .then(function (r) {
          return r
            .json()
            .catch(function () {
              return {};
            })
            .then(function (data) {
              return { ok: r.ok, data: data };
            });
        })
        .then(function (res) {
          var reply =
            (res.data && res.data.reply) ||
            (res.ok
              ? "Me quedé sin palabras. Probá de nuevo."
              : "No pude responder ahora. Probá en un rato.");
          if (res.ok) {
            decirBot(reply);
            audioTurno("bot"); // el bot me contestó
            historial.push({ role: "assistant", content: reply });
            guardarChat();
          } else {
            decirBot(reply, "at-error");
          }
        })
        .catch(function () {
          decirBot(
            "No me pude conectar. ¿Hay internet? Probá de nuevo.",
            "at-error",
          );
        })
        .then(function () {
          enviando = false;
          chat.classList.remove("cargando");
          caraHabla(false);
          try {
            chatInput.focus();
          } catch (e) {}
        });
    }

    chatForm.addEventListener("submit", function (e) {
      e.preventDefault();
      enviar(chatInput.value);
    });
    chatX.addEventListener("click", function (e) {
      e.stopPropagation();
      cerrarChat();
      olvidarChat();
    });
    if (chatAudioBtn) {
      pintarAudioBtn();
      chatAudioBtn.addEventListener("click", function (e) {
        e.stopPropagation();
        audioOn = !audioOn;
        try {
          localStorage.setItem(LS_AUDIO, audioOn ? "1" : "0");
        } catch (e) {}
        if (!audioOn && audioActual) {
          try {
            audioActual.pause();
          } catch (e) {}
        }
        pintarAudioBtn();
      });
    }
    chat.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
    });
    chat.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    /* ---------- arrastre ---------- */
    var drag = false,
      movido = false,
      sx = 0,
      sy = 0,
      ox = 0,
      oy = 0;
    el.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".assistant-close")) return;
      if (e.target.closest(".atendedor-chat")) return;
      drag = true;
      movido = false;
      var r = el.getBoundingClientRect();
      ox = r.left;
      oy = r.top;
      sx = e.clientX;
      sy = e.clientY;
      el.classList.add("dragging");
      try {
        el.setPointerCapture(e.pointerId);
      } catch (_) {}
    });
    el.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dx = e.clientX - sx,
        dy = e.clientY - sy;
      if (Math.abs(dx) + Math.abs(dy) > 3) movido = true;
      colocar(ox + dx, oy + dy);
    });
    function soltar(e) {
      if (!drag) return;
      drag = false;
      el.classList.remove("dragging");
      try {
        el.releasePointerCapture(e.pointerId);
      } catch (_) {}
      if (movido) guardar();
    }
    el.addEventListener("pointerup", soltar);
    el.addEventListener("pointercancel", soltar);
    el.addEventListener("click", function (e) {
      if (e.target.closest(".assistant-close")) return;
      if (e.target.closest(".atendedor-chat")) return;
      if (movido) {
        movido = false;
        return;
      }
      toggleChat();
    });

    cerrar.addEventListener("click", function (e) {
      e.stopPropagation();
      cerrarApp();
    });

    /* ---------- icono de escritorio ---------- */
    window.sisopTouch.bindActivate(icon, activarDesdeIcono);
    icon.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        activarDesdeIcono();
      }
    });

    window.addEventListener("resize", function () {
      if (estado === "abierto" && el.style.left) {
        colocar(
          parseFloat(el.style.left) || 0,
          parseFloat(el.style.top) || 0,
        );
      }
    });

    /* ---------- estado inicial ---------- */
    /* El chat nunca se restaura: el historial arranca vacío en cada carga
     y se descarta cualquier resto guardado por versiones anteriores. */
    historial = [];
    audioReset();
    try {
      localStorage.removeItem(LS_CHAT);
    } catch (e) {}

    /* El atendedor NUNCA arranca abierto: siempre cerrado, se abre sólo
     desde su icono del escritorio. Sólo restauramos su última posición. */
    try {
      var s = JSON.parse(localStorage.getItem(LS) || "{}") || {};
      if (typeof s.x === "number" && !isNaN(s.x)) {
        el.hidden = false; /* necesita layout para medir en colocar() */
        colocar(s.x, s.y);
        el.hidden = true;
      }
    } catch (e) {}
  }

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
