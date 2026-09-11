/* Grabadora: app del SISOP para dejarle un mensaje de voz a Agus.
   Cualquier visitante graba (hasta 2 min) y lo manda; el audio queda en el
   Worker de Cloudflare (grabadora-worker/). Agus lo escucha desde la
   «Bandeja», que se desbloquea con un PIN.

   makeWin() (sisop-sqlconsole.js) llama a window.buildGrabadora(cfg, bd)
   cuando cfg.type === "recorder". */
(function () {
  /* ═══════════════════════════════════════════════════════════════════
     URL del Worker. Pegala acá después del deploy (ver
     grabadora-worker/README.md). Si queda vacía, la app lo avisa.
     ═══════════════════════════════════════════════════════════════════ */
  var GRABADORA_API = "https://grabadora.agustintardella7.workers.dev";

  var LS_PIN = "sisop:grabadora:pin";
  var MAX_MS = 120000; // 2 minutos
  var MAX_BYTES = 1500000;

  function fmt(ms) {
    var s = Math.floor(ms / 1000);
    return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2);
  }
  function hace(ts) {
    var d = Math.max(0, Date.now() - ts);
    var min = Math.floor(d / 60000);
    if (min < 1) return "recién";
    if (min < 60) return "hace " + min + " min";
    var hs = Math.floor(min / 60);
    if (hs < 24) return "hace " + hs + " h";
    var dias = Math.floor(hs / 24);
    if (dias < 7) return "hace " + dias + (dias === 1 ? " día" : " días");
    var f = new Date(ts);
    return f.toLocaleDateString("es-AR", {
      day: "numeric",
      month: "short",
    });
  }
  function kb(n) {
    return n < 1024
      ? n + " B"
      : n < 1024 * 1024
        ? Math.round(n / 1024) + " KB"
        : (n / 1024 / 1024).toFixed(1) + " MB";
  }

  function pickMime() {
    var opts = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
    ];
    if (!window.MediaRecorder) return "";
    for (var i = 0; i < opts.length; i++) {
      try {
        if (MediaRecorder.isTypeSupported(opts[i])) return opts[i];
      } catch (e) {}
    }
    return "";
  }

  window.buildGrabadora = function (cfg, bd) {
    var wrap = document.createElement("div");
    wrap.className = "rec-app";
    wrap.innerHTML = [
      '<div class="rec-view" data-view="dejar">',
      '  <p class="rec-lede">Dejale un mensaje de voz a Agus. Lo escucha cuando vuelve a la compu.</p>',
      '  <div class="rec-deck">',
      '    <div class="rec-deck-head">',
      '      <span class="rec-led" aria-hidden="true"></span>',
      '      <span class="rec-brand">Grabadora</span>',
      "    </div>",
      '    <div class="rec-cassette" aria-hidden="true">',
      '      <div class="rec-reel rec-reel-l"><i></i></div>',
      '      <div class="rec-tape"></div>',
      '      <div class="rec-reel rec-reel-r"><i></i></div>',
      "    </div>",
      '    <div class="rec-counter">',
      '      <span class="rec-time" aria-live="polite">0:00</span>',
      '      <span class="rec-counter-max">/ 2:00</span>',
      "    </div>",
      '    <div class="rec-transport">',
      '      <button type="button" class="rec-mic" aria-label="Grabar">',
      '        <span class="rec-mic-glyph"></span>',
      '        <span class="rec-mic-label">REC</span>',
      "      </button>",
      "    </div>",
      '    <div class="rec-grille" aria-hidden="true"></div>',
      "  </div>",
      '  <audio class="rec-player" controls hidden></audio>',
      '  <input class="rec-name" type="text" maxlength="40" autocomplete="off" placeholder="Tu nombre (opcional)" />',
      '  <div class="rec-actions" hidden>',
      '    <button type="button" class="btn" data-rec="redo">Regrabar</button>',
      '    <button type="button" class="btn primary" data-rec="send">Enviar mensaje</button>',
      "  </div>",
      '  <p class="rec-msg" role="status"></p>',
      '  <button type="button" class="rec-owner" data-rec="owner">Ver bandeja</button>',
      "</div>",

      '<div class="rec-view" data-view="pin" hidden>',
      '  <p class="rec-lede">Bandeja de mensajes. Ingresá el PIN.</p>',
      '  <form class="rec-pinform">',
      '    <input class="rec-pin" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN" />',
      '    <button type="submit" class="btn primary">Entrar</button>',
      "  </form>",
      '  <p class="rec-msg" role="status"></p>',
      '  <button type="button" class="rec-owner" data-rec="back">Volver</button>',
      "</div>",

      '<div class="rec-view" data-view="bandeja" hidden>',
      '  <div class="rec-inbox-head">',
      "    <b>Mensajes recibidos</b>",
      '    <span class="rec-inbox-tools">',
      '      <button type="button" class="btn" data-rec="reload">Actualizar</button>',
      '      <button type="button" class="btn" data-rec="lock">Salir</button>',
      "    </span>",
      "  </div>",
      '  <div class="rec-list"></div>',
      "</div>",
    ].join("");
    bd.appendChild(wrap);

    var vDejar = wrap.querySelector('[data-view="dejar"]');
    var vPin = wrap.querySelector('[data-view="pin"]');
    var vBandeja = wrap.querySelector('[data-view="bandeja"]');
    var micBtn = wrap.querySelector(".rec-mic");
    var micLabel = wrap.querySelector(".rec-mic-label");
    var deck = wrap.querySelector(".rec-deck");
    var cassette = wrap.querySelector(".rec-cassette");
    var timeEl = wrap.querySelector(".rec-time");
    var player = wrap.querySelector(".rec-player");
    var nameEl = wrap.querySelector(".rec-name");
    var actions = wrap.querySelector(".rec-actions");
    var msgDejar = vDejar.querySelector(".rec-msg");
    var pinForm = wrap.querySelector(".rec-pinform");
    var pinInput = wrap.querySelector(".rec-pin");
    var msgPin = vPin.querySelector(".rec-msg");
    var listEl = wrap.querySelector(".rec-list");

    function show(view) {
      [vDejar, vPin, vBandeja].forEach(function (v) {
        v.hidden = v !== view;
      });
    }
    function setMsg(el, txt, err) {
      el.textContent = txt || "";
      el.classList.toggle("err", !!err);
    }

    /* ─────────── grabación ─────────── */
    var stream = null,
      rec = null,
      chunks = [],
      startTs = 0,
      timer = 0,
      blob = null,
      url = "",
      mime = "",
      dur = 0,
      grabando = false,
      enviando = false;

    function setSpin(on) {
      cassette.classList.toggle("spin", !!on);
      deck.classList.toggle("recording", grabando);
    }

    function setMicUI(state) {
      // state: idle | rec | done | sent
      micBtn.dataset.state = state;
      deck.dataset.state = state;
      micBtn.disabled = state === "sent";
      if (state === "rec") {
        micBtn.setAttribute("aria-label", "Detener");
        micBtn.title = "Detener";
        if (micLabel) micLabel.textContent = "STOP";
      } else {
        micBtn.setAttribute("aria-label", "Grabar");
        micBtn.title = "Grabar";
        if (micLabel)
          micLabel.textContent = state === "done" ? "REGRABAR" : "REC";
      }
      var hasClip = state === "done";
      player.hidden = !hasClip;
      actions.hidden = !hasClip;
      if (state !== "rec") setSpin(false);
      if (state === "idle" || state === "sent") timeEl.textContent = "0:00";
    }

    function tick() {
      var ms = Date.now() - startTs;
      timeEl.textContent = fmt(ms);
      if (ms >= MAX_MS) stop();
    }

    async function start() {
      if (grabando || enviando) return;
      setMsg(msgDejar, "");
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        setMsg(msgDejar, "Este navegador no puede grabar audio.", true);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        setMsg(
          msgDejar,
          "No pude usar el micrófono. Revisá los permisos del navegador.",
          true,
        );
        return;
      }
      chunks = [];
      mime = pickMime();
      try {
        rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      } catch (e) {
        rec = new MediaRecorder(stream);
      }
      rec.ondataavailable = function (e) {
        if (e.data && e.data.size) chunks.push(e.data);
      };
      rec.onstop = onStop;
      rec.start();
      grabando = true;
      startTs = Date.now();
      setMicUI("rec");
      setSpin(true);
      timer = setInterval(tick, 200);
    }

    function stop() {
      if (!grabando) return;
      grabando = false;
      clearInterval(timer);
      try {
        if (rec && rec.state !== "inactive") rec.stop();
      } catch (e) {}
    }

    function onStop() {
      if (stream)
        stream.getTracks().forEach(function (t) {
          t.stop();
        });
      stream = null;
      dur = Math.round((Date.now() - startTs) / 1000);
      blob = new Blob(chunks, { type: mime || "audio/webm" });
      if (url) URL.revokeObjectURL(url);
      url = URL.createObjectURL(blob);
      player.src = url;
      setMicUI("done");
      if (blob.size > MAX_BYTES) {
        setMsg(
          msgDejar,
          "El mensaje quedó muy pesado (" +
            kb(blob.size) +
            "). Grabá uno más corto.",
          true,
        );
      } else {
        setMsg(msgDejar, "Escuchalo. Si te gusta, mandalo.");
      }
    }

    function redo() {
      blob = null;
      if (url) {
        URL.revokeObjectURL(url);
        url = "";
      }
      player.removeAttribute("src");
      setMicUI("idle");
      setMsg(msgDejar, "");
    }

    async function send() {
      if (!blob || enviando) return;
      if (blob.size > MAX_BYTES) {
        setMsg(msgDejar, "Muy pesado. Grabá uno más corto.", true);
        return;
      }
      if (!GRABADORA_API) {
        setMsg(
          msgDejar,
          "Todavía no está enchufada: falta pegar la URL del Worker (GRABADORA_API) en js/sisop-grabadora.js. Ver grabadora-worker/README.md.",
          true,
        );
        return;
      }
      enviando = true;
      setMsg(msgDejar, "Enviando…");
      actions.querySelectorAll("button").forEach(function (b) {
        b.disabled = true;
      });
      var ext =
        mime.indexOf("mp4") >= 0
          ? "m4a"
          : mime.indexOf("ogg") >= 0
            ? "ogg"
            : "webm";
      var fd = new FormData();
      fd.append("audio", blob, "mensaje." + ext);
      fd.append("nombre", (nameEl.value || "").trim().slice(0, 40));
      fd.append("dur", String(dur || 0));
      fd.append("mime", blob.type || mime || "audio/webm");
      try {
        var r = await fetch(GRABADORA_API, { method: "POST", body: fd });
        var d = {};
        try {
          d = await r.json();
        } catch (e) {}
        if (r.ok && d.ok) {
          setMicUI("sent");
          player.hidden = true;
          actions.hidden = true;
          nameEl.value = "";
          setMsg(
            msgDejar,
            "¡Listo! Tu mensaje quedó guardado. Agus lo va a escuchar. 🎙️",
          );
          setTimeout(function () {
            redo();
          }, 60);
        } else if (d.error === "rate_limited") {
          setMsg(msgDejar, "Muchos mensajes seguidos. Probá en un rato.", true);
        } else if (d.error === "muy_grande") {
          setMsg(
            msgDejar,
            "El mensaje es muy pesado. Grabá uno más corto.",
            true,
          );
        } else {
          setMsg(msgDejar, "No se pudo enviar. Probá de nuevo.", true);
        }
      } catch (e) {
        setMsg(msgDejar, "Sin conexión con el servidor. Probá de nuevo.", true);
      }
      enviando = false;
      actions.querySelectorAll("button").forEach(function (b) {
        b.disabled = false;
      });
    }

    /* ─────────── bandeja (PIN) ─────────── */
    function getPin() {
      try {
        return localStorage.getItem(LS_PIN) || "";
      } catch (e) {
        return "";
      }
    }
    function setPin(p) {
      try {
        if (p) localStorage.setItem(LS_PIN, p);
        else localStorage.removeItem(LS_PIN);
      } catch (e) {}
    }

    function abrirBandeja() {
      if (!GRABADORA_API) {
        show(vPin);
        setMsg(
          msgPin,
          "Falta configurar el Worker (GRABADORA_API) en js/sisop-grabadora.js.",
          true,
        );
        return;
      }
      if (getPin()) {
        cargarLista(true);
      } else {
        show(vPin);
        setMsg(msgPin, "");
        setTimeout(function () {
          pinInput.focus();
        }, 40);
      }
    }

    async function cargarLista(desdeOwner) {
      var pin = getPin();
      if (!pin) {
        show(vPin);
        return;
      }
      show(vBandeja);
      listEl.innerHTML = '<div class="rec-empty">Cargando…</div>';
      try {
        var r = await fetch(
          GRABADORA_API + "/list?key=" + encodeURIComponent(pin),
        );
        if (r.status === 401 || r.status === 403) {
          setPin("");
          show(vPin);
          setMsg(msgPin, "PIN incorrecto.", true);
          setTimeout(function () {
            pinInput.focus();
          }, 40);
          return;
        }
        var d = await r.json();
        renderLista((d && d.mensajes) || []);
      } catch (e) {
        listEl.innerHTML =
          '<div class="rec-empty">No se pudo conectar. Probá de nuevo.</div>';
      }
    }

    function renderLista(items) {
      if (!items.length) {
        listEl.innerHTML =
          '<div class="rec-empty">Todavía no hay mensajes.</div>';
        return;
      }
      listEl.innerHTML = "";
      var pin = getPin();
      items.forEach(function (m) {
        var row = document.createElement("div");
        row.className = "rec-item" + (m.heard ? " heard" : "");
        row.innerHTML = [
          '<div class="rec-item-top">',
          '  <span class="rec-item-who"></span>',
          '  <span class="rec-item-meta"></span>',
          '  <button type="button" class="rec-item-del" title="Borrar" aria-label="Borrar">✕</button>',
          "</div>",
          '<audio class="rec-item-audio" controls preload="none"></audio>',
        ].join("");
        row.querySelector(".rec-item-who").textContent = m.nombre || "Anónimo";
        row.querySelector(".rec-item-meta").textContent =
          hace(m.ts) +
          " · " +
          (m.dur ? fmt(m.dur * 1000) + " · " : "") +
          kb(m.size || 0);
        var au = row.querySelector(".rec-item-audio");
        au.src =
          GRABADORA_API +
          "/audio?id=" +
          encodeURIComponent(m.id) +
          "&key=" +
          encodeURIComponent(pin);
        au.addEventListener(
          "play",
          function () {
            if (row.classList.contains("heard")) return;
            row.classList.add("heard");
            fetch(
              GRABADORA_API +
                "/heard?id=" +
                encodeURIComponent(m.id) +
                "&key=" +
                encodeURIComponent(pin),
              { method: "POST" },
            ).catch(function () {});
          },
          { once: true },
        );
        row
          .querySelector(".rec-item-del")
          .addEventListener("click", function () {
            window.sisopDialog
              .confirm({
                title: "Borrar mensaje",
                message: "¿Borrar este mensaje?",
                okLabel: "Borrar",
                danger: true,
              })
              .then(function (ok) {
                if (!ok) return;
                fetch(
                  GRABADORA_API +
                    "/borrar?id=" +
                    encodeURIComponent(m.id) +
                    "&key=" +
                    encodeURIComponent(pin),
                  { method: "POST" },
                )
                  .then(function () {
                    row.remove();
                    if (!listEl.children.length)
                      listEl.innerHTML =
                        '<div class="rec-empty">Todavía no hay mensajes.</div>';
                  })
                  .catch(function () {});
              });
          });
        listEl.appendChild(row);
      });
    }

    /* ─────────── eventos ─────────── */
    micBtn.addEventListener("click", function () {
      if (grabando) stop();
      else if (micBtn.dataset.state === "done") return;
      else start();
    });
    wrap.addEventListener("click", function (e) {
      var act = e.target.closest("[data-rec]");
      if (!act) return;
      var a = act.getAttribute("data-rec");
      if (a === "redo") redo();
      else if (a === "send") send();
      else if (a === "owner") abrirBandeja();
      else if (a === "back") {
        show(vDejar);
      } else if (a === "reload") cargarLista();
      else if (a === "lock") {
        setPin("");
        show(vDejar);
      }
    });
    pinForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var p = (pinInput.value || "").trim();
      if (!p) return;
      setPin(p);
      pinInput.value = "";
      cargarLista(true);
    });

    // Los carretes también giran mientras se escucha la toma recién grabada.
    player.addEventListener("play", function () {
      if (!grabando) cassette.classList.add("spin");
    });
    player.addEventListener("pause", function () {
      if (!grabando) cassette.classList.remove("spin");
    });
    player.addEventListener("ended", function () {
      if (!grabando) cassette.classList.remove("spin");
    });

    setMicUI("idle");
  };
})();
