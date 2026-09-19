// Escenario 4: caen polígonos irregulares desde arriba y hay que esquivarlos
// con la nave. Si uno la toca, la nave cae golpeada y el juego vuelve a empezar;
// el segundero cuenta cuánto tiempo se resiste sin chocar.
//
// Al entrar al escenario hay una intro: el parallax 7 (la nave chica del
// escenario principal) está ahí, se le juntan otras y se van juntas hacia
// arriba a la izquierda. Recién cuando ya se fueron aparece el segundero,
// empieza a correr, suena la música y (un momento después) caen los polígonos.
//
// Música (audio/nivel4.m4a): suena en bucle mientras dura la partida, se
// frena al chocar (queda en silencio lo que dura la caída de la nave) y
// arranca de nuevo desde el principio cuando empieza la partida siguiente.
// Al perder suena audio/stopgame.mp3 (una vez, sin cortarlo al reiniciar: se
// oye un rato más, aunque ya haya vuelto la música).
// Se reproduce con Web Audio (el archivo se decodifica una vez y se loopea el
// buffer): con un <audio loop> el bucle tenía un hueco al volver a empezar y
// al reiniciar con currentTime había demora. Si Web Audio no está disponible
// o falla la carga, cae a un <audio> común.
//
// script.js registra el escenario (scenes.game) y llama a
// window.esc4Game.setActive(true/false) al entrar y salir. Fuera del
// escenario no hay ningún requestAnimationFrame corriendo. La nave la mueve
// script.js como siempre; acá solo se lee su transform para saber dónde está.
//
// Cámara: igual que el escenario 2, el mundo se ve con zoom anclado sobre la
// nave (script.js llama a setCamera con el zoom y el origen cada cuadro). Como
// el juego dibuja en un canvas -escalarlo por CSS lo pixelaría-, el zoom se
// aplica al dibujar. Todo el mundo (polígonos, velocidades, hitbox de la nave)
// va a la escala de la nave chica -ESCALA_MUNDO-, así con zoom se ve igual de
// jugable y en el mapa completo (M/Espacio) la nave queda chiquita.
(function () {
  // --- Dificultad (todo en px y segundos) ----------------------------------
  const GRACIA = 1.2; // segundos sin polígonos al empezar
  const SPAWN_INICIAL = 1.1; // segundos entre polígonos al empezar...
  const SPAWN_MIN = 0.35; // ...y lo mínimo a lo que baja
  const SPAWN_RAMPA = 0.012; // cuánto baja por cada segundo sobrevivido
  const VEL_INICIAL = 150; // velocidad de caída (px/s)...
  const VEL_MAX = 850; // ...y lo máximo a lo que sube
  const VEL_RAMPA = 11; // cuánto sube por cada segundo sobrevivido
  // Intro (segundos): llegan las otras naves, esperan juntas, y se van.
  const INTRO_LLEGADA = 2.2;
  const INTRO_ESPERA = 0.7;
  const INTRO_SALIDA = 2.0; // lo que tardan en irse (ya fuera de la vista al final)
  const INTRO_ESCALONADO = 0.12; // cada nave sale un poco después de la anterior
  const INTRO_ACELERACION = 380; // px/s² del mundo al irse
  const INTRO_DIR = { x: -0.75, y: -0.66 }; // arriba a la izquierda
  const INTRO_MIRADA_MAX = 55; // grados: la nave mira en diagonal hacia arriba, sin pasar de esto
  const MUSICA_URL = "audio/nivel4.m4a";
  const MUSICA_VOLUMEN = 0.5;
  const PERDER_URL = "audio/stopgame.mp3";
  const PERDER_VOLUMEN = 0.8;
  const P7_ANCHO = 40; // px del mundo: ancho de la nave (chica, como la de la escena; ver ESCALA_MUNDO)
  // Posición de la nave que ya está ahí, relativa al ancho del mundo, y a
  // qué distancia del piso está: la misma altura a la que aparece el
  // parallax 7 en el escenario 1 (296 px sobre el borde de abajo).
  const P7_X = 0.72;
  const P7_ALTURA = 296;
  // Dónde arranca cada nave (siempre afuera de la vista: de la izquierda, de
  // la derecha y de abajo; la primera ya está en su lugar) y dónde se
  // acomoda, relativo al punto de encuentro (px del mundo).
  const INTRO_NAVES = [
    { desde: (m) => ({ x: m.x, y: m.y }), a: { x: 0, y: 0 } },
    { desde: (m) => ({ x: -100, y: m.y + 150 }), a: { x: -50, y: 20 } },
    { desde: (m, w) => ({ x: w + 100, y: m.y - 220 }), a: { x: 46, y: -24 } },
    { desde: (m, w, h) => ({ x: m.x + 280, y: h + 100 }), a: { x: 10, y: 42 } },
  ];

  const POSICION_Y_INICIAL = 0.85; // dónde reaparece la nave: centrada en x, a esta fracción del alto (0 = arriba)
  const DURACION_CHOQUE = 1.5; // segundos que la nave cae, golpeada, antes de reiniciar
  const GRAVEDAD = 500; // px/s² del mundo con los que cae la nave golpeada
  const GOLPE_LATERAL = 120; // px/s del mundo: empujón de costado que le da la piedra
  const GOLPE_GIRO = 240; // grados/s de giro base que le da (según de qué lado la pegan)
  // Si la nave se queda quieta, las piedras empiezan a ir hacia ella (sino
  // alcanza con quedarse parado en un lugar sin piedras).
  const QUIETA_SEG = 3; // segundos sin moverse antes de que la busquen
  const QUIETA_MOV = 8; // px/s del mundo: por debajo de esto cuenta como quieta
  const BUSQUEDA_RAMPA = 2; // segundos hasta llegar a la fuerza completa
  const BUSQUEDA_MAX = 0.5; // desvío horizontal máximo, como fracción de su velocidad de caída
  const BUSQUEDA_AGIL = 1.5; // 1/s: qué tan rápido corrigen el rumbo

  // --- Mundo y luz ----------------------------------------------------------
  const ESCALA_MUNDO = 0.55; // tamaño/velocidad del mundo respecto del juego "sin zoom"
  const MARGEN_SPAWN = 60; // px del mundo: los polígonos nacen un poco más allá de lo visible
  const LUZ_RADIO = 520; // px del mundo: alcance de la luz de la nave
  const LUZ_INTENSIDAD = 0.32; // opacidad del blanco en el centro de la luz

  const scene = document.getElementById("game-scene");
  const canvas = document.getElementById("game-canvas");
  const timerEl = document.getElementById("game-timer");
  const ship = document.getElementById("starry-cohete-pair");
  if (!scene || !canvas || !timerEl || !ship) return;
  const ctx = canvas.getContext("2d");

  // Hitbox de la nave: tres círculos sobre el sprite (cohete.webp, 203x300),
  // en px de la caja de 130x130 donde vive (el sprite queda pegado a la
  // izquierda: mide ~88px de ancho, de ahí el x = 44). Un poco más chicos
  // que el dibujo para que los roces no cuenten.
  const CAJA_NAVE = 130;
  const NAVE_CIRCULOS = [
    { x: 44, y: 30, r: 11 }, // punta
    { x: 44, y: 52, r: 15 }, // cuerpo
    { x: 44, y: 76, r: 20 }, // alas
  ];

  let activo = false;
  let raf = 0;
  let ultimo = 0;
  let poligonos = [];
  let tiempo = 0;
  let acumSpawn = 0;
  let choque = false;
  let tChoque = 0;
  let ultimoTexto = "";
  let dpr = 1;
  let introT = -1; // segundos de intro (-1: sin intro)
  let gracia = GRACIA; // segundos sin polígonos desde que empieza a correr el tiempo
  let timerOculto = false;
  let musicaIniciada = false; // ya se pidió cargar la música
  let audioCtx = null; // Web Audio
  let musicaBuffer = null; // audio/nivel4.m4a decodificado
  let musicaGain = null;
  let perderGain = null;
  let perderBuffer = null; // audio/stopgame.mp3 decodificado
  let perderFuente = null; // fuente sonando ahora (o null)
  let perder = null; // <audio> de respaldo
  let musicaFuente = null; // fuente sonando ahora (o null)
  let musica = null; // <audio> de respaldo si falla Web Audio
  let spriteP7 = null; // imagen del parallax 7, se carga al entrar por primera vez
  let spriteP7Listo = null; // la nave ya en blanco y negro con sombra (canvas)
  let enCentro = false; // la partida arrancó recolocando la nave: se la sostiene en el medio durante la gracia
  let golpeadora = null; // la piedra que chocó a la nave: sigue de largo
  let naveCae = { x: 0, y: 0, giro: 0 }; // velocidad de la nave golpeada (px/s y grados/s)
  let tQuieta = 0; // segundos seguidos sin que la nave se mueva
  let navePrev = null; // centro de la nave en el cuadro anterior (mundo)
  // Cámara (ver arriba): zoom y punto de la pantalla que queda fijo (la nave).
  const cam = { z: 1, ox: window.innerWidth / 2, oy: window.innerHeight / 2 };
  let luz = false; // luz de la nave prendida (la maneja script.js)
  let luzNivel = 0; // 0..1, sigue a luz suavizado

  // Rectángulo del mundo que se ve en pantalla. La pantalla lleva un punto
  // del mundo a ox + (p - ox) * z, así que la esquina (0, 0) es ox * (1 - 1/z).
  function vista() {
    const k = 1 - 1 / cam.z;
    return {
      x: cam.ox * k,
      y: cam.oy * k,
      w: window.innerWidth / cam.z,
      h: window.innerHeight / cam.z,
    };
  }

  // Polígono irregular "estrellado": los vértices van ordenados por ángulo
  // alrededor del centro, así nunca se cruza consigo mismo.
  function crearPoligono() {
    const d = (50 + Math.random() * 70) * ESCALA_MUNDO;
    const n = 4 + Math.floor(Math.random() * 3);
    const paso = (Math.PI * 2) / n;
    const verts = [];
    for (let i = 0; i < n; i++) {
      const ang = i * paso + (Math.random() - 0.5) * paso * 0.6;
      const r = (d / 2) * (0.6 + Math.random() * 0.6);
      verts.push({ x: Math.cos(ang) * r, y: Math.sin(ang) * r });
    }
    const vel =
      Math.min(VEL_MAX, VEL_INICIAL + tiempo * VEL_RAMPA) * ESCALA_MUNDO;
    // Nacen justo arriba de lo que se ve ahora (no del mundo entero): con
    // zoom la vista es una fracción del mundo y el resto quedaría vacío.
    const v = vista();
    return {
      x: v.x - MARGEN_SPAWN + Math.random() * (v.w + MARGEN_SPAWN * 2),
      y: v.y - d,
      vx: 0, // solo se mueve de costado cuando busca a la nave
      ang: Math.random() * Math.PI * 2,
      giro: (Math.random() - 0.5) * 3,
      vy: vel * (0.75 + Math.random() * 0.55),
      radio: d * 0.6,
      verts,
      pts: [], // vértices en el mundo, se recalculan en cada cuadro
    };
  }

  function actualizarPuntos(p) {
    const cos = Math.cos(p.ang);
    const sin = Math.sin(p.ang);
    p.pts = p.verts.map((v) => ({
      x: p.x + v.x * cos - v.y * sin,
      y: p.y + v.x * sin + v.y * cos,
    }));
  }

  // Centros de los círculos de la nave, en coordenadas del mundo. Sale del
  // transform que script.js le escribe cada cuadro (translate + rotate + scale
  // respecto del centro de su caja), así sigue bien la nave aunque esté
  // rotada; ese transform está en pantalla, se pasa al mundo deshaciendo el
  // zoom de la cámara.
  function circulosNave() {
    if (!ship.style.transform) return [];
    let m;
    try {
      m = new DOMMatrix(ship.style.transform);
    } catch (e) {
      return [];
    }
    const caja = ship.offsetWidth || CAJA_NAVE; // en mobile la caja es más chica
    const k = Math.hypot(m.a, m.b) / cam.z;
    const factor = caja / CAJA_NAVE;
    const mitad = caja / 2;
    return NAVE_CIRCULOS.map((c) => {
      const px = c.x * factor - mitad;
      const py = c.y * factor - mitad;
      const sx = m.a * px + m.c * py + m.e + mitad;
      const sy = m.b * px + m.d * py + m.f + mitad;
      return {
        x: cam.ox + (sx - cam.ox) / cam.z,
        y: cam.oy + (sy - cam.oy) / cam.z,
        r: c.r * factor * k,
      };
    });
  }

  // ¿El círculo toca el polígono? Sí si su centro está adentro o si algún
  // borde pasa a menos de r del centro.
  function circuloTocaPoligono(cx, cy, r, pts) {
    let dentro = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const a = pts[i];
      const b = pts[j];
      if (
        a.y > cy !== b.y > cy &&
        cx < ((b.x - a.x) * (cy - a.y)) / (b.y - a.y) + a.x
      )
        dentro = !dentro;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const t = Math.max(
        0,
        Math.min(1, ((cx - a.x) * dx + (cy - a.y) * dy) / (dx * dx + dy * dy || 1)),
      );
      const ex = a.x + t * dx - cx;
      const ey = a.y + t * dy - cy;
      if (ex * ex + ey * ey <= r * r) return true;
    }
    return dentro;
  }

  // Después de un choque (recolocar = true) la nave vuelve al medio (en x) y abajo de la
  // pantalla y se queda ahí quieta hasta que termina la gracia y
  // empieza de nuevo. Al entrar al escenario (conIntro = true) no se la
  // mueve: llega desde el borde y arranca donde está, con la intro.
  function reiniciar(recolocar, conIntro) {
    (window.__log2 = window.__log2 || []).push(["reiniciar", recolocar, conIntro, Math.round(performance.now()), new Error().stack.split(String.fromCharCode(10)).join(" | ")]);
    poligonos = [];
    tiempo = 0;
    // Con intro el segundero queda oculto y parado hasta que se van las naves.
    introT = conIntro ? 0 : -1;
    gracia = GRACIA;
    timerOculto = !!conIntro;
    timerEl.style.visibility = timerOculto ? "hidden" : "";
    acumSpawn = 0;
    choque = false;
    tChoque = 0;
    tQuieta = 0;
    navePrev = null;
    golpeadora = null;
    enCentro = !!recolocar;
    if (enCentro) {
      centrarNave();
      iniciarMusica(); // la caída terminó: empieza otra partida
    }
    mostrarTiempo();
  }

  // Carga y decodifica la música y el sonido de perder una sola vez (al
  // entrar al escenario por primera vez, así están listos cuando termina la
  // intro).
  async function cargarMusica() {
    const AC = window.AudioContext || window.webkitAudioContext;
    try {
      audioCtx = new AC();
    } catch (e) {
      audioCtx = null;
    }
    const decodificar = async (url) =>
      audioCtx.decodeAudioData(await (await fetch(url)).arrayBuffer());
    const conGain = (volumen) => {
      const g = audioCtx.createGain();
      g.gain.value = volumen;
      g.connect(audioCtx.destination);
      return g;
    };
    if (audioCtx) {
      musicaGain = conGain(MUSICA_VOLUMEN);
      perderGain = conGain(PERDER_VOLUMEN);
      try {
        musicaBuffer = await decodificar(MUSICA_URL);
      } catch (e) {
        musicaBuffer = null;
      }
      try {
        perderBuffer = await decodificar(PERDER_URL);
      } catch (e) {
        perderBuffer = null;
      }
    }
    if (!musicaBuffer) {
      musica = new Audio(MUSICA_URL);
      musica.loop = true;
      musica.volume = MUSICA_VOLUMEN;
    }
    if (!perderBuffer) {
      perder = new Audio(PERDER_URL);
      perder.volume = PERDER_VOLUMEN;
    }
  }

  // El sonido de perder: suena una vez desde el principio.
  function sonarPerder() {
    if (perderBuffer) {
      audioCtx.resume().catch(() => {});
      perderFuente = audioCtx.createBufferSource();
      perderFuente.buffer = perderBuffer;
      perderFuente.connect(perderGain);
      perderFuente.start();
    } else if (perder) {
      perder.currentTime = 0;
      perder.play().catch(() => {});
    }
  }

  function iniciarMusica() {
    frenarMusica();
    if (musicaBuffer) {
      // El navegador puede tenerla suspendida hasta la primera interacción.
      audioCtx.resume().catch(() => {});
      musicaFuente = audioCtx.createBufferSource();
      musicaFuente.buffer = musicaBuffer;
      musicaFuente.loop = true;
      musicaFuente.connect(musicaGain);
      musicaFuente.start();
    } else if (musica) {
      musica.currentTime = 0;
      musica.play().catch(() => {}); // puede bloquearla si aún no hubo interacción
    }
  }

  function frenarMusica() {
    if (musicaFuente) {
      try {
        musicaFuente.stop();
      } catch (e) {}
      musicaFuente.disconnect();
      musicaFuente = null;
    }
    if (musica) musica.pause();
  }

  // Al salir del escenario se corta todo, también el sonido de perder.
  function frenarSonidos() {
    frenarMusica();
    if (perderFuente) {
      try {
        perderFuente.stop();
      } catch (e) {}
      perderFuente.disconnect();
      perderFuente = null;
    }
    if (perder) perder.pause();
  }

  function centrarNave() {
    if (window.shipPlace)
      window.shipPlace(
        window.innerWidth / 2,
        window.innerHeight * POSICION_Y_INICIAL,
      );
  }

  // Cuándo empiezan a irse las naves, y cuándo empieza el juego: recién cuando
  // ya se fue la última (aparece el segundero, empieza a correr y suena la música).
  const INTRO_INICIO = INTRO_LLEGADA + INTRO_ESPERA;
  const INTRO_JUEGO =
    INTRO_INICIO + INTRO_SALIDA + INTRO_ESCALONADO * (INTRO_NAVES.length - 1);

  // Punto de encuentro de las naves de la intro (mundo).
  function puntoEncuentro() {
    const h = window.innerHeight;
    return {
      x: window.innerWidth * P7_X,
      y: Math.max(h * 0.3, h - P7_ALTURA),
    };
  }

  // Durante la intro la nave mira hacia donde se juntan las navecitas, pero en
  // diagonal hacia arriba (0° es mirar derecho arriba; negativo, a la izquierda).
  function mirarNaves(centro) {
    if (!centro || !window.shipFace) return;
    const m = puntoEncuentro();
    const grados = (Math.atan2(m.y - centro.y, m.x - centro.x) * 180) / Math.PI + 90;
    const norm = ((grados + 540) % 360) - 180;
    window.shipFace(Math.max(-INTRO_MIRADA_MAX, Math.min(INTRO_MIRADA_MAX, norm)));
  }

  // Naves de la intro en el mundo, según el segundo de intro. Fuera de la
  // intro (o cuando ya se fueron) devuelve una lista vacía.
  function navesIntro(t) {
    if (t < 0 || t > INTRO_JUEGO) return [];
    const w = window.innerWidth;
    const h = window.innerHeight;
    const { x: mx, y: my } = puntoEncuentro();
    const u = Math.min(1, t / INTRO_LLEGADA);
    const suave = 1 - Math.pow(1 - u, 3);
    return INTRO_NAVES.map((n, i) => {
      const d0 = n.desde({ x: mx, y: my }, w, h);
      let x = d0.x + (mx + n.a.x - d0.x) * suave;
      let y = d0.y + (my + n.a.y - d0.y) * suave;
      y += Math.sin(t * 3 + i * 1.7) * 3; // flotan un poco
      let esc = 1;
      const ts = t - INTRO_INICIO - i * INTRO_ESCALONADO;
      if (ts > 0) {
        const d = 0.5 * INTRO_ACELERACION * ts * ts;
        x += INTRO_DIR.x * d;
        y += INTRO_DIR.y * d;
        esc = 1 - 0.5 * Math.min(1, ts / INTRO_SALIDA);
      }
      return { x, y, esc };
    });
  }

  // Las naves de la intro se ven igual que la nuestra en este escenario:
  // blanco y negro con sombra interna. Se arma una sola vez en un canvas
  // aparte (no se puede usar el filtro SVG de la nave dentro del canvas en
  // todos los navegadores). El sprite ocupa solo un rincón del PNG (992x700);
  // se recorta con un margen para que la sombra también cierre en los bordes.
  const P7_RECORTE = { x: 58, y: 11, w: 111, h: 83, margen: 8 };
  const P7_RESOLUCION = 2;
  const P7_SOMBRA = { difusion: 7, dx: 1.5, dy: 3, pasadas: 3 }; // en px del PNG

  function armarSpriteP7(img) {
    const r = P7_RECORTE;
    const k = P7_RESOLUCION;
    const w = (r.w + r.margen * 2) * k;
    const h = (r.h + r.margen * 2) * k;
    const recorte = (c) =>
      c.drawImage(img, r.x - r.margen, r.y - r.margen, w / k, h / k, 0, 0, w, h);
    const nave = document.createElement("canvas");
    nave.width = w;
    nave.height = h;
    const c = nave.getContext("2d");
    // Gris: se desatura con un relleno gris en modo "saturation" y se vuelve a
    // recortar con la silueta (el relleno también pinta lo transparente).
    recorte(c);
    c.globalCompositeOperation = "saturation";
    c.fillStyle = "#808080";
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = "destination-in";
    recorte(c);
    // Sombra interna: todo lo que NO es nave, difuminado y corrido, dibujado
    // solo encima de la nave. La imagen en sí se tira lejos de la vista y
    // queda solo su sombra.
    const fuera = document.createElement("canvas");
    fuera.width = w;
    fuera.height = h;
    const f = fuera.getContext("2d");
    f.fillStyle = "#000";
    f.fillRect(0, 0, w, h);
    f.globalCompositeOperation = "destination-out";
    recorte(f);
    c.globalCompositeOperation = "source-atop";
    c.shadowColor = "#000";
    c.shadowBlur = P7_SOMBRA.difusion * k;
    c.shadowOffsetX = w * 2 + P7_SOMBRA.dx * k;
    c.shadowOffsetY = P7_SOMBRA.dy * k;
    for (let i = 0; i < P7_SOMBRA.pasadas; i++) c.drawImage(fuera, -w * 2, 0);
    return nave;
  }

  function dibujarIntro() {
    if (!spriteP7Listo) return;
    const r = P7_RECORTE;
    const ancho = (P7_ANCHO * (r.w + r.margen * 2)) / r.w;
    const alto = (ancho * spriteP7Listo.height) / spriteP7Listo.width;
    for (const n of navesIntro(introT)) {
      ctx.drawImage(
        spriteP7Listo,
        n.x - (ancho * n.esc) / 2,
        n.y - (alto * n.esc) / 2,
        ancho * n.esc,
        alto * n.esc,
      );
    }
  }

  function mostrarTiempo() {
    const texto = tiempo.toFixed(1);
    if (texto === ultimoTexto) return;
    ultimoTexto = texto;
    timerEl.textContent = texto;
  }

  function actualizar(dt, circulos) {
    tiempo += dt;

    if (tiempo > gracia) {
      acumSpawn += dt;
      const intervalo = Math.max(SPAWN_MIN, SPAWN_INICIAL - tiempo * SPAWN_RAMPA);
      if (acumSpawn >= intervalo) {
        acumSpawn = 0;
        poligonos.push(crearPoligono());
      }
    }

    const v = vista();
    const abajo = v.y + v.h;
    // De 0 a 1 a partir de los QUIETA_SEG segundos sin movimiento.
    const busqueda = Math.max(
      0,
      Math.min(1, (tQuieta - QUIETA_SEG) / BUSQUEDA_RAMPA),
    );
    const centro = circulos[1];
    for (const p of poligonos) {
      // Solo la buscan las que todavía están arriba de la nave; las que ya
      // pasaron siguen derecho. Al volver a moverse, el objetivo vuelve a 0 y
      // el desvío se apaga solo.
      let objetivo = 0;
      if (busqueda > 0 && centro && p.y < centro.y) {
        const max = p.vy * BUSQUEDA_MAX * busqueda;
        objetivo = Math.max(-max, Math.min(max, (centro.x - p.x) * 2));
      }
      p.vx += (objetivo - p.vx) * Math.min(1, dt * BUSQUEDA_AGIL);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.ang += p.giro * dt;
      actualizarPuntos(p);
    }
    poligonos = poligonos.filter((p) => p.y - p.radio < abajo);

    for (const p of poligonos) {
      const tocado = circulos.find((c) =>
        circuloTocaPoligono(c.x, c.y, c.r, p.pts),
      );
      if (tocado) {
        choque = true;
        tChoque = 0;
        golpeadora = p;
        frenarMusica();
        sonarPerder();
        // El golpe: la nave sale despedida hacia abajo (con parte de lo que
        // traía la piedra) y para el lado opuesto al que le pegaron, girando.
        const lado = tocado.x >= p.x ? 1 : -1;
        const fuerza = Math.min(1, Math.abs(tocado.x - p.x) / p.radio);
        naveCae = {
          x: lado * GOLPE_LATERAL * (0.4 + 0.6 * fuerza),
          y: p.vy * 0.7,
          giro: lado * GOLPE_GIRO * (0.7 + Math.random() * 0.6),
        };
        break;
      }
    }
    mostrarTiempo();
  }

  function dibujar(centro) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    // De acá en más se dibuja en coordenadas del mundo, con el zoom aplicado.
    ctx.setTransform(
      dpr * cam.z,
      0,
      0,
      dpr * cam.z,
      dpr * cam.ox * (1 - cam.z),
      dpr * cam.oy * (1 - cam.z),
    );

    // La luz de la nave sobre el fondo, debajo de los polígonos: como son
    // negros y opacos, contra ese resplandor se ven como siluetas.
    if (luzNivel > 0.01 && centro) {
      const g = ctx.createRadialGradient(
        centro.x,
        centro.y,
        0,
        centro.x,
        centro.y,
        LUZ_RADIO,
      );
      const a = LUZ_INTENSIDAD * luzNivel;
      g.addColorStop(0, `rgba(255,255,255,${a})`);
      g.addColorStop(0.2, `rgba(255,255,255,${a * 0.65})`);
      g.addColorStop(0.5, `rgba(255,255,255,${a * 0.25})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(
        centro.x - LUZ_RADIO,
        centro.y - LUZ_RADIO,
        LUZ_RADIO * 2,
        LUZ_RADIO * 2,
      );
    }

    dibujarIntro();

    ctx.lineWidth = 1.6; // ~3.5px en pantalla con el zoom normal
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#fff";
    ctx.fillStyle = "#000";
    for (const p of poligonos) {
      ctx.beginPath();
      p.pts.forEach((v, i) => (i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }

  function cuadro(ahora) {
    if (!window.__c) { window.__c = 1; (window.__log2 = window.__log2 || []).push(["cuadro1", introT, INTRO_JUEGO, choque, Math.round(performance.now())]); }
    raf = requestAnimationFrame(cuadro);
    // Tope al dt: al volver de otra pestaña no debe caer todo de golpe.
    const dt = Math.min((ahora - ultimo) / 1000, 0.05);
    ultimo = ahora;

    const circulos = circulosNave();
    if (choque) {
      tChoque += dt;
      // El resto del campo queda quieto. La piedra que chocó sigue de largo
      // y la nave, golpeada, cae acelerando y girando (el desplazamiento va
      // en px del mundo: la cámara está anclada a la nave).
      if (golpeadora) {
        golpeadora.y += golpeadora.vy * dt;
        golpeadora.ang += golpeadora.giro * dt;
        actualizarPuntos(golpeadora);
      }
      naveCae.y += GRAVEDAD * dt;
      if (window.shipMove)
        window.shipMove(naveCae.x * dt, naveCae.y * dt, naveCae.giro * dt);
      if (tChoque >= DURACION_CHOQUE) reiniciar(true);
    } else if (introT >= 0 && introT < INTRO_JUEGO) {
      // Intro: todavía no corre el tiempo ni caen polígonos, y la nave no se
      // puede mover (solo mira a las navecitas) hasta que arranca el
      // segundero.
      introT += dt;
      tQuieta = 0;
      navePrev = null;
      if (window.shipMove) window.shipMove(0, 0, 0); // la deja quieta y sin control
      mirarNaves(circulos[1]);
    } else {
      if (timerOculto) {
        introT = -1; // termina la intro
        timerOculto = false;
        timerEl.style.visibility = "";
        iniciarMusica(); // ya se fueron las naves: empieza el juego
      }
      const centro = circulos[1];
      if (centro && navePrev && dt > 0) {
        const vel = Math.hypot(centro.x - navePrev.x, centro.y - navePrev.y) / dt;
        tQuieta = vel < QUIETA_MOV ? tQuieta + dt : 0;
      }
      navePrev = centro ? { x: centro.x, y: centro.y } : null;
      if (tiempo < gracia) {
        // Quieta por la gracia: no cuenta para las piedras que buscan a la nave.
        tQuieta = 0;
        if (enCentro) centrarNave();
      }
      actualizar(dt, circulos);
    }
    luzNivel += ((luz ? 1 : 0) - luzNivel) * Math.min(1, dt * 6);
    dibujar(circulos[1]); // la luz sale del cuerpo de la nave
  }

  function ajustarCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(window.innerWidth * dpr);
    canvas.height = Math.round(window.innerHeight * dpr);
  }

  window.addEventListener("resize", () => {
    if (activo) ajustarCanvas();
  });

  window.esc4Game = {
    // script.js: zoom de la cámara y punto de la pantalla que queda fijo.
    setCamera(z, x, y) {
      cam.z = z;
      cam.ox = x;
      cam.oy = y;
    },
    // script.js: luz de la nave prendida/apagada.
    setLight(valor) {
      luz = valor;
    },
    setActive(valor) {
      if (valor === activo) return;
      activo = valor;
      if (valor) {
        ajustarCanvas();
        if (!musicaIniciada) {
          musicaIniciada = true;
          cargarMusica(); // que esté lista cuando termina la intro
        }
        if (!spriteP7) {
          spriteP7 = new Image();
          spriteP7.onload = () => (spriteP7Listo = armarSpriteP7(spriteP7));
          spriteP7.src = "parallax/parallax 7.webp";
        }
        reiniciar(false, true);
        ultimo = performance.now();
        raf = requestAnimationFrame(cuadro);
      } else {
        cancelAnimationFrame(raf);
        frenarSonidos();
      }
    },
  };
})();
