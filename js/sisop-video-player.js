/* Reproductor de video .mp4 en ventana Win98, con 3 modos extra que
 * comparten el mismo <video> y la misma barra de controles en vez de
 * duplicarlos: se reparenta el par (video + barra) al contenedor que
 * corresponda, así seguir viendo/escuchando el mismo video nunca se
 * interrumpe al cambiar de modo.
 *
 *  - "window":    adentro de la ventana Win98, como cualquier app.
 *  - "pip":       panel flotante abajo a la derecha, tamaño ajustable
 *                 (arrastrando su esquina superior izquierda).
 *  - "fullscreen": Fullscreen API sobre el propio par video+barra,
 *                 con object-fit:cover para no dejar franjas negras.
 *  - "wallpaper": reemplaza el fondo estrellado del escritorio
 *                 (js/sisop-desk-icons.js / sisop.html #stars) mientras
 *                 está activo, siempre en blanco y negro y silenciado.
 *
 * Usado desde openFile() en sisop-user-files.js para archivos con
 * mime video/*.
 */
(function () {
  var ICON_PLAY =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.3v11.4l10-5.7z" fill="currentColor"/></svg>';
  var ICON_PAUSE =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.3" width="3" height="11.4" fill="currentColor"/><rect x="9.5" y="2.3" width="3" height="11.4" fill="currentColor"/></svg>';
  var ICON_VOLUME =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h2.6L9 2.5v11L4.6 10H2z" fill="currentColor"/><path d="M11 5.5a4 4 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  var ICON_MUTED =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6h2.6L9 2.5v11L4.6 10H2z" fill="currentColor"/><path d="M10.7 6.2l3.6 3.6M14.3 6.2l-3.6 3.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>';
  var ICON_WINDOW =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="10" fill="none" stroke="currentColor" stroke-width="1.3"/><rect x="2" y="3" width="12" height="2.6" fill="currentColor"/></svg>';
  var ICON_PIP =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2" y="3" width="12" height="9" fill="none" stroke="currentColor" stroke-width="1.2"/><rect x="8.3" y="7.3" width="4.7" height="3.7" fill="currentColor"/></svg>';
  var ICON_FULLSCREEN =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 6V2h4M14 6V2h-4M2 10v4h4M14 10v4h-4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_WALLPAPER =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="8.5" rx="0.5" fill="none" stroke="currentColor" stroke-width="1.2"/><path d="M6 13.5h4M8 11v2.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>';
  var ICON_LOOP =
    '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.2 4.5h5.8a3 3 0 0 1 3 3v1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M6.2 2.4L4.2 4.5l2 2.1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/><path d="M11.8 11.5H6a3 3 0 0 1-3-3v-1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/><path d="M9.8 13.6l2-2.1-2-2.1" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  var MODES = ["window", "pip", "fullscreen", "wallpaper"];
  var MODE_LABEL = {
    window: "Ventana",
    pip: "Miniatura",
    fullscreen: "Pantalla completa",
    wallpaper: "Fondo de escritorio",
  };
  var MODE_ICON = {
    window: ICON_WINDOW,
    pip: ICON_PIP,
    fullscreen: ICON_FULLSCREEN,
    wallpaper: ICON_WALLPAPER,
  };
  var PARKED_MSG = {
    pip: "Reproduciéndose en miniatura, abajo a la derecha.",
    wallpaper: "Reproduciéndose de fondo, en blanco y negro.",
  };

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) s = 0;
    var m = Math.floor(s / 60);
    var sec = Math.floor(s % 60);
    return m + ":" + (sec < 10 ? "0" : "") + sec;
  }

  // -----------------------------------------------------------------------
  // YouTube: mismo reproductor (ventana/miniatura/pantalla completa/fondo,
  // barra de controles, loop) para un video embebido en vez de un archivo
  // propio. La idea es que el resto de createPlayer() ni se entere de la
  // diferencia: en vez de un <video> de verdad, "video" pasa a ser un
  // objeto que imita su misma superficie (currentTime/duration/volume/
  // muted/loop/play()/pause()/addEventListener()) pero por debajo maneja
  // un YT.Player. El nodo que realmente se cuelga en .vid-stage es
  // video.el (un <div> que la API de YouTube reemplaza por su iframe).
  // -----------------------------------------------------------------------
  function extractYouTubeId(url) {
    var u;
    try {
      u = new URL(url, window.location.href);
    } catch (_) {
      return null;
    }
    var host = u.hostname.replace(/^www\.|^m\./, "");
    if (host === "youtu.be") {
      return u.pathname.slice(1).split("/")[0] || null;
    }
    if (host === "youtube.com" || host === "music.youtube.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      var m = u.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/);
      if (m) return m[1];
    }
    return null;
  }

  var ytApiPromise = null;
  function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
    if (ytApiPromise) return ytApiPromise;
    ytApiPromise = new Promise(function (resolve) {
      var prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (prev) prev();
        resolve(window.YT);
      };
      var s = document.createElement("script");
      s.src = "https://www.youtube.com/iframe_api";
      document.head.appendChild(s);
    });
    return ytApiPromise;
  }

  function createYouTubeMedia(videoId) {
    var el = document.createElement("div");
    el.className = "vid-el vid-yt";
    var listeners = {};
    var player = null;
    var state = {
      paused: true,
      currentTime: 0,
      duration: 0,
      volume: 1,
      muted: false,
      loop: false,
      wantsPlay: false,
    };
    var pollTimer = null;

    function emit(type) {
      (listeners[type] || []).forEach(function (fn) {
        fn();
      });
    }
    function startPoll() {
      if (pollTimer) return;
      pollTimer = setInterval(function () {
        if (!player || !player.getCurrentTime) return;
        state.currentTime = player.getCurrentTime() || 0;
        emit("timeupdate");
      }, 250);
    }
    function stopPoll() {
      clearInterval(pollTimer);
      pollTimer = null;
    }

    loadYouTubeAPI()
      .then(function (YT) {
        player = new YT.Player(el, {
          videoId: videoId,
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
          },
          events: {
            onReady: function () {
              state.duration = player.getDuration() || 0;
              state.volume = (player.getVolume() || 100) / 100;
              state.muted = player.isMuted();
              emit("loadedmetadata");
              if (state.wantsPlay) player.playVideo();
            },
            onStateChange: function (e) {
              if (e.data === YT.PlayerState.PLAYING) {
                state.paused = false;
                startPoll();
                emit("play");
              } else if (e.data === YT.PlayerState.PAUSED) {
                state.paused = true;
                stopPoll();
                emit("pause");
              } else if (e.data === YT.PlayerState.ENDED) {
                if (state.loop) {
                  player.seekTo(0);
                  player.playVideo();
                } else {
                  state.paused = true;
                  stopPoll();
                  emit("pause");
                }
              }
            },
            onError: function () {
              emit("error");
            },
          },
        });
      })
      .catch(function () {
        emit("error");
      });

    var media = { el: el };
    Object.defineProperty(media, "paused", {
      get: function () {
        return state.paused;
      },
    });
    Object.defineProperty(media, "duration", {
      get: function () {
        return state.duration;
      },
    });
    Object.defineProperty(media, "currentTime", {
      get: function () {
        return state.currentTime;
      },
      set: function (v) {
        state.currentTime = v;
        if (player && player.seekTo) player.seekTo(v, true);
      },
    });
    Object.defineProperty(media, "volume", {
      get: function () {
        return state.volume;
      },
      set: function (v) {
        state.volume = v;
        if (player && player.setVolume) player.setVolume(Math.round(v * 100));
        emit("volumechange");
      },
    });
    Object.defineProperty(media, "muted", {
      get: function () {
        return state.muted;
      },
      set: function (v) {
        state.muted = v;
        if (player) {
          if (v) player.mute();
          else player.unMute();
        }
        emit("volumechange");
      },
    });
    Object.defineProperty(media, "loop", {
      get: function () {
        return state.loop;
      },
      set: function (v) {
        state.loop = v;
      },
    });
    media.play = function () {
      if (player && player.playVideo) player.playVideo();
      else state.wantsPlay = true;
      return Promise.resolve();
    };
    media.pause = function () {
      state.wantsPlay = false;
      if (player && player.pauseVideo) player.pauseVideo();
    };
    media.addEventListener = function (type, fn) {
      listeners[type] = listeners[type] || [];
      listeners[type].push(fn);
    };
    media.destroy = function () {
      stopPoll();
      if (player && player.destroy) player.destroy();
    };
    return media;
  }

  // -----------------------------------------------------------------------
  // Contenedores singleton: un solo panel de miniatura y una sola capa de
  // fondo para todo el sitio (si dos videos se ponen en el mismo modo, el
  // segundo le saca el lugar al primero, ver claimPip/claimWallpaper).
  // -----------------------------------------------------------------------
  var pipPanel = null;
  var pipOwner = null;
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
  function clampPipPosition() {
    var maxX = Math.max(0, window.innerWidth - pipPanel.offsetWidth);
    var maxY = Math.max(0, window.innerHeight - pipPanel.offsetHeight);
    pipPanel.style.left =
      Math.max(0, Math.min(pipPanel.offsetLeft, maxX)) + "px";
    pipPanel.style.top =
      Math.max(0, Math.min(pipPanel.offsetTop, maxY)) + "px";
  }
  function ensurePipPanel() {
    if (pipPanel) return pipPanel;
    pipPanel = document.createElement("div");
    pipPanel.className = "vid-pip";
    var grip = document.createElement("span");
    grip.className = "vid-pip-resize";
    grip.setAttribute("aria-hidden", "true");
    pipPanel.appendChild(grip);
    document.body.appendChild(pipPanel);

    // Posición inicial abajo a la derecha, igual que antes -pero ahora
    // en left/top a mano en vez de right/bottom fijo por CSS: el
    // arrastre de más abajo necesita poder moverlo a cualquier lado, y
    // con right/bottom anclado no se puede. Se usa el ancho/alto por
    // default de la CSS (260x165) en vez de offsetWidth/offsetHeight
    // porque acá el panel todavía está display:none -claimPip() recién
    // le agrega vid-pip-show después de esto- y offsetWidth/offsetHeight
    // de un elemento oculto miden 0.
    pipPanel.style.left = window.innerWidth - 260 - 12 + "px";
    pipPanel.style.top = window.innerHeight - taskbarH() - 165 - 12 + "px";

    // Arrastre del panel entero (clickeando el video, no los controles
    // ni el grip de resize) — mismo patrón que el resto del sitio: el
    // handle de arrastre ignora los elementos interactivos que tiene
    // adentro (ver makeDraggable() en sisop-sqlconsole.js).
    var dragMove = false,
      dmsx = 0,
      dmsy = 0,
      dox = 0,
      doy = 0;
    pipPanel.addEventListener("pointerdown", function (e) {
      if (e.target.closest(".vid-bar, .vid-pip-resize")) return;
      dragMove = true;
      dmsx = e.clientX;
      dmsy = e.clientY;
      dox = pipPanel.offsetLeft;
      doy = pipPanel.offsetTop;
      pipPanel.classList.add("dragging");
      try {
        pipPanel.setPointerCapture(e.pointerId);
      } catch (_) {}
      e.preventDefault();
    });
    pipPanel.addEventListener("pointermove", function (e) {
      if (!dragMove) return;
      var nx = dox + (e.clientX - dmsx);
      var ny = doy + (e.clientY - dmsy);
      var maxX = Math.max(0, window.innerWidth - pipPanel.offsetWidth);
      var maxY = Math.max(0, window.innerHeight - pipPanel.offsetHeight);
      pipPanel.style.left = Math.max(0, Math.min(nx, maxX)) + "px";
      pipPanel.style.top = Math.max(0, Math.min(ny, maxY)) + "px";
    });
    pipPanel.addEventListener("pointerup", function (e) {
      if (!dragMove) return;
      dragMove = false;
      pipPanel.classList.remove("dragging");
      try {
        pipPanel.releasePointerCapture(e.pointerId);
      } catch (_) {}
    });

    // Resize: agranda hacia arriba-izquierda mientras ancla la esquina
    // inferior-derecha -por eso corrige left/top también, ya no hay un
    // right/bottom fijo que lo haga solo (ver arriba)-.
    var resizing = false,
      rsx = 0,
      rsy = 0,
      sw = 0,
      sh = 0,
      sl = 0,
      st = 0;
    grip.addEventListener("pointerdown", function (e) {
      e.stopPropagation();
      resizing = true;
      rsx = e.clientX;
      rsy = e.clientY;
      sw = pipPanel.offsetWidth;
      sh = pipPanel.offsetHeight;
      sl = pipPanel.offsetLeft;
      st = pipPanel.offsetTop;
      grip.setPointerCapture(e.pointerId);
      e.preventDefault();
    });
    grip.addEventListener("pointermove", function (e) {
      if (!resizing) return;
      var dw = rsx - e.clientX; // arrastrar hacia arriba-izquierda agranda
      var dh = rsy - e.clientY;
      var maxW = window.innerWidth * 0.7;
      var maxH = window.innerHeight * 0.7;
      // El piso de ancho no puede ser menor a lo que ocupa la barra de
      // controles en modo compacto (play + seek + mute + 4 botones de
      // modo, sin wrap): si no, esos botones desbordan el panel.
      var newW = Math.max(220, Math.min(sw + dw, maxW));
      var newH = Math.max(100, Math.min(sh + dh, maxH));
      pipPanel.style.width = newW + "px";
      pipPanel.style.height = newH + "px";
      pipPanel.style.left = sl - (newW - sw) + "px";
      pipPanel.style.top = st - (newH - sh) + "px";
    });
    grip.addEventListener("pointerup", function (e) {
      resizing = false;
      try {
        grip.releasePointerCapture(e.pointerId);
      } catch (_) {}
    });

    window.addEventListener("resize", function () {
      if (pipPanel.classList.contains("vid-pip-show")) clampPipPosition();
    });

    return pipPanel;
  }

  var wallLayer = null;
  var wallOwner = null;
  function ensureWallLayer() {
    if (wallLayer) return wallLayer;
    wallLayer = document.createElement("div");
    wallLayer.className = "vid-wallpaper-layer";
    var bgRef = document.querySelector(".desk-bg-layer");
    if (bgRef && bgRef.parentNode)
      bgRef.parentNode.insertBefore(wallLayer, bgRef.nextSibling);
    else document.body.appendChild(wallLayer);
    return wallLayer;
  }

  // -----------------------------------------------------------------------
  function createPlayer(opts, slot) {
    var mode = "window";
    var savedAudio = null; // { muted, volume } antes de silenciar para el fondo

    // Youtube: "video" pasa a ser el objeto que imita un <video> nativo
    // -ver createYouTubeMedia() más arriba- en vez del elemento de
    // verdad. El resto de este archivo (modos, barra, loop) no necesita
    // saber la diferencia; sólo acá abajo, y en destroy(), hay un par de
    // detalles propios de cada caso.
    var youtubeId = extractYouTubeId(opts.url);
    var video;
    if (youtubeId) {
      video = createYouTubeMedia(youtubeId);
    } else {
      video = document.createElement("video");
      video.className = "vid-el";
      video.src = opts.url;
      video.preload = "metadata";
      video.playsInline = true;
    }
    var mediaEl = video.el || video;

    var stage = document.createElement("div");
    stage.className = "vid-stage";
    stage.appendChild(mediaEl);

    // No todos los formatos que se detectan como "video" (ver isVideoItem
    // en sisop-user-files.js, que ahora acepta cualquier extensión de
    // video aunque el navegador no le haya asignado mime) tienen un códec
    // que el navegador sepa decodificar (.avi/.wmv/.flv viejos, etc.), o
    // el video de YouTube puede no existir/estar privado. Si pasa, en vez
    // de dejar un reproductor roto se ofrece bajar el archivo original
    // -o abrirlo directo en YouTube, si era un link de ahí-.
    video.addEventListener("error", function () {
      mediaEl.style.display = "none";
      playBtn.disabled = true;
      seek.disabled = true;
      MODES.forEach(function (m) {
        if (m !== "window") modeBtns[m].disabled = true;
      });
      var overlay = document.createElement("div");
      overlay.className = "vid-error";
      var p = document.createElement("p");
      p.textContent = youtubeId
        ? "Este video de YouTube no se pudo cargar (privado, borrado o con embeds desactivados)."
        : "Este formato de video no se puede reproducir en el navegador.";
      var a = document.createElement("a");
      a.className = "btn primary";
      if (youtubeId) {
        a.href = opts.url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "Abrir en YouTube";
      } else {
        a.href = opts.url;
        a.download = opts.name || "";
        a.textContent = "Descargar archivo";
      }
      overlay.appendChild(p);
      overlay.appendChild(a);
      stage.appendChild(overlay);
    });

    var bar = document.createElement("div");
    bar.className = "vid-bar";
    var playBtn = mkBtn("vid-play", ICON_PLAY, "Reproducir");
    var timeCur = mkSpan("vid-time vid-time-cur", "0:00");
    var seek = mkRange("vid-seek", 0, 100, 0, 0.1);
    var timeDur = mkSpan("vid-time vid-time-dur", "0:00");
    var muteBtn = mkBtn("vid-mute", ICON_VOLUME, "Silenciar");
    var vol = mkRange("vid-vol", 0, 1, 1, 0.01);
    var loopBtn = mkBtn("vid-loop", ICON_LOOP, "Repetir");
    var sep = document.createElement("span");
    sep.className = "vid-sep";
    sep.setAttribute("aria-hidden", "true");
    bar.appendChild(playBtn);
    bar.appendChild(timeCur);
    bar.appendChild(seek);
    bar.appendChild(timeDur);
    bar.appendChild(muteBtn);
    bar.appendChild(vol);
    bar.appendChild(loopBtn);
    bar.appendChild(sep);
    var modeBtns = {};
    MODES.forEach(function (m) {
      var b = mkBtn("vid-mode", MODE_ICON[m], MODE_LABEL[m]);
      b.setAttribute("data-mode", m);
      b.addEventListener("click", function () {
        setMode(m);
      });
      modeBtns[m] = b;
      bar.appendChild(b);
    });

    var wrap = document.createElement("div");
    wrap.className = "vid-wrap";
    wrap.appendChild(stage);
    wrap.appendChild(bar);

    function mkBtn(cls, icon, label) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "vid-btn " + cls;
      b.innerHTML = icon;
      b.title = label;
      b.setAttribute("aria-label", label);
      return b;
    }
    function mkSpan(cls, txt) {
      var s = document.createElement("span");
      s.className = cls;
      s.textContent = txt;
      return s;
    }
    function mkRange(cls, min, max, val, step) {
      var r = document.createElement("input");
      r.type = "range";
      r.className = cls;
      r.min = min;
      r.max = max;
      r.value = val;
      r.step = step;
      return r;
    }

    // ---- controles ----
    var seeking = false;
    playBtn.addEventListener("click", function () {
      if (video.paused) video.play().catch(function () {});
      else video.pause();
    });
    video.addEventListener("play", function () {
      playBtn.innerHTML = ICON_PAUSE;
      playBtn.title = "Pausar";
    });
    video.addEventListener("pause", function () {
      playBtn.innerHTML = ICON_PLAY;
      playBtn.title = "Reproducir";
    });
    video.addEventListener("loadedmetadata", function () {
      timeDur.textContent = fmtTime(video.duration);
    });
    video.addEventListener("timeupdate", function () {
      if (seeking) return;
      var d = video.duration || 0;
      seek.value = d ? (video.currentTime / d) * 100 : 0;
      timeCur.textContent = fmtTime(video.currentTime);
    });
    seek.addEventListener("input", function () {
      seeking = true;
      var d = video.duration || 0;
      timeCur.textContent = fmtTime((seek.value / 100) * d);
    });
    seek.addEventListener("change", function () {
      var d = video.duration || 0;
      video.currentTime = (seek.value / 100) * d;
      seeking = false;
    });
    muteBtn.addEventListener("click", function () {
      video.muted = !video.muted;
    });
    video.addEventListener("volumechange", function () {
      muteBtn.innerHTML =
        video.muted || video.volume === 0 ? ICON_MUTED : ICON_VOLUME;
      vol.value = video.muted ? 0 : video.volume;
    });
    vol.addEventListener("input", function () {
      video.volume = parseFloat(vol.value);
      video.muted = video.volume === 0;
    });
    loopBtn.addEventListener("click", function () {
      video.loop = !video.loop;
      loopBtn.classList.toggle("active", video.loop);
    });

    // ---- modos ----
    function updateModeButtons() {
      MODES.forEach(function (m) {
        modeBtns[m].classList.toggle("active", m === mode);
      });
      bar.classList.toggle(
        "vid-bar-compact",
        mode === "pip" || mode === "wallpaper",
      );
    }

    function releasePip() {
      if (pipOwner !== self) return;
      pipOwner = null;
      if (pipPanel) pipPanel.classList.remove("vid-pip-show");
    }
    function claimPip() {
      if (pipOwner && pipOwner !== self) pipOwner.forceWindow();
      var p = ensurePipPanel();
      pipOwner = self;
      p.appendChild(wrap);
      p.classList.add("vid-pip-show");
    }
    function releaseWallpaper() {
      if (wallOwner !== self) return;
      wallOwner = null;
      document.documentElement.classList.remove("video-wallpaper-active");
      // Rearmar wrap (stage + barra) antes de que applyMode() lo reparente
      // a otro lado: mientras estaba de fondo, la barra vivía suelta en
      // <body> (ver claimWallpaper) para no quedar atrapada en el
      // contexto de apilamiento de la capa de fondo.
      bar.classList.remove("vid-bar-wallpaper");
      wrap.appendChild(stage);
      wrap.appendChild(bar);
      if (savedAudio) {
        video.muted = savedAudio.muted;
        video.volume = savedAudio.volume;
        savedAudio = null;
      }
    }
    function claimWallpaper() {
      if (wallOwner && wallOwner !== self) wallOwner.forceWindow();
      var w = ensureWallLayer();
      wallOwner = self;
      savedAudio = { muted: video.muted, volume: video.volume };
      video.muted = true;
      // La capa de fondo va a z-index:-1 (ver .vid-wallpaper-layer), lo
      // que crea su propio contexto de apilamiento: cualquier hijo suyo
      // queda atrapado ahí abajo sin importar su propio z-index, aunque
      // sea position:fixed. Por eso sólo el <video> (stage) entra a esa
      // capa; la barra de controles se cuelga directo de <body> con su
      // propio z-index alto, para poder flotar de verdad por encima de
      // los íconos del escritorio y recibir los clics.
      w.appendChild(stage);
      bar.classList.add("vid-bar-wallpaper");
      document.body.appendChild(bar);
      document.documentElement.classList.add("video-wallpaper-active");
      if (video.paused) video.play().catch(function () {});
    }

    function parkSlot(msg) {
      slot.innerHTML = "";
      if (msg) {
        slot.classList.add("vid-slot-parked");
        var p = document.createElement("p");
        p.className = "vid-parked";
        p.textContent = msg;
        slot.appendChild(p);
      } else {
        slot.classList.remove("vid-slot-parked");
        slot.appendChild(wrap);
      }
    }

    function requestFs() {
      if (!wrap.requestFullscreen) {
        mode = "window";
        applyMode();
        return;
      }
      wrap.requestFullscreen().catch(function () {
        mode = "window";
        applyMode();
        updateModeButtons();
      });
    }

    function applyMode() {
      if (mode !== "pip") releasePip();
      if (mode !== "wallpaper") releaseWallpaper();
      if (mode === "window") {
        parkSlot(null);
      } else if (mode === "fullscreen") {
        parkSlot(null);
        requestFs();
      } else if (mode === "pip") {
        claimPip();
        parkSlot(PARKED_MSG.pip);
      } else if (mode === "wallpaper") {
        claimWallpaper();
        parkSlot(PARKED_MSG.wallpaper);
      }
      updateModeButtons();
    }

    function setMode(next) {
      if (mode === next) return;
      var wasFullscreen = mode === "fullscreen";
      mode = next;
      if (wasFullscreen && document.fullscreenElement === wrap) {
        // Hay que esperar a que el navegador termine de salir antes de
        // reparentar wrap al nuevo modo (moverlo mientras sigue en
        // fullscreen no lo saca de la pantalla completa). No alcanza con
        // el listener de fullscreenchange de más abajo: para cuando
        // dispare, "mode" ya no vale "fullscreen" (lo acabamos de pisar
        // arriba), así que esa condición no correría applyMode().
        var p = document.exitFullscreen();
        if (p && p.then) p.then(applyMode, applyMode);
        else applyMode();
        return;
      }
      applyMode();
    }

    function onFullscreenChange() {
      if (mode === "fullscreen" && document.fullscreenElement !== wrap) {
        mode = "window";
        applyMode();
      } else if (document.fullscreenElement === wrap) {
        updateModeButtons();
      }
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);

    var self = {
      forceWindow: function () {
        if (mode === "window") return;
        mode = "window";
        applyMode();
      },
      destroy: function () {
        document.removeEventListener("fullscreenchange", onFullscreenChange);
        releasePip();
        releaseWallpaper();
        if (document.fullscreenElement === wrap) {
          try {
            document.exitFullscreen();
          } catch (_) {}
        }
        video.pause();
        if (video.destroy) video.destroy(); // YouTube: para el polling y el YT.Player
        // Si estaba en miniatura o de fondo, wrap vive en el panel/capa
        // singleton (fuera de esta ventana): sacarlo para no dejar un
        // <video> huérfano ahí adentro.
        wrap.remove();
      },
    };

    parkSlot(null);
    updateModeButtons();
    // Arranca solo al abrir la ventana, igual que el audio (ver openFile()
    // en sisop-user-files.js). Si el navegador bloquea el autoplay con
    // sonido en este contexto, el catch lo deja arrancado en pausa y se
    // usa el botón de play a mano, sin romper nada.
    video.play().catch(function () {});
    return self;
  }

  function mount(bd, opts) {
    var slot = document.createElement("div");
    slot.className = "vid-slot";
    bd.appendChild(slot);
    return createPlayer(opts, slot);
  }

  window.sisopVideoPlayer = { mount: mount };
})();
