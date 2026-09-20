// Escenario 4: caen polígonos irregulares desde arriba y hay que esquivarlos
// con la nave. Si uno la toca, la nave cae golpeada y el juego vuelve a empezar;
// el segundero cuenta cuánto tiempo se resiste sin chocar.
//
// Al entrar al escenario hay una intro, toda a color y con el fondo starry
// azul del sitio: entra volando la nave, el parallax 7 (la nave chica del
// escenario principal) ya está ahí, se le juntan otras y se van juntas hacia
// arriba a la izquierda mientras nuestra nave las mira. Cuando desaparecen cae
// una pantalla negra por encima de todo (la nave incluida): todo se oscurece a
// la vez. Con la pantalla toda negra la nave pasa a blanco y negro sin que se
// vea; recién ahí prende la luz, se levanta la pantalla negra y aparece en
// blanco y negro: empieza el juego (aparece el segundero, suena la música y,
// un momento después, caen los polígonos).
//
// Estrellas: se ven algunas estrellas blancas sobre el fondo, también en la
// intro y en el final (solo decoración, no se chocan). En distintos puntos del mapa aparecen agujeros de
// gusano de a pares: un circulito de estrellas con brillo girando muy rápido,
// con el centro negro. Al entrar en uno la nave sale por el otro, y cada pasaje
// la va pintando de color (sube la saturación de su filtro, ver
// #nave-sat-off/#nave-sat-luz en index.html) hasta quedar con todos sus
// colores: los agujeros hacen el mismo recorrido, arrancan blancos y terminan
// naranja (el del parallax 7). Al perder todo vuelve a blanco y negro.
//
// Rendimiento: los brillos (que son lo caro) se arman UNA sola vez en sprites;
// en cada cuadro solo se dibujan esos sprites rotados y con más o menos
// transparencia (el pasaje de blanco a naranja es un fundido entre dos sprites).
// La luz de la nave también es un sprite. Y el canvas no pasa de 1,5x de
// resolución.
//
// Todo el escenario acompaña a la nave: a medida que se colorea, el fondo negro
// va pasando al azul starry (--fondo-color en styles.css).
//
// Cuando la nave cruza el último agujero (victoria) el final tiene dos partes:
// primero un zoom a la nave del jugador, ya toda de color (se van los polígonos,
// los cúmulos y el segundero), y después cae la pantalla negra y se repite la
// animación de la intro pero con los parallax 7 en blanco y negro (con sombra
// interna), juntándose en otro lugar, con un zoom hacia ellos mientras llegan y
// se escapan. Ahí queda solo el fondo starry con las naves (la nave del jugador
// no se ve). Cuando se van, se vuelve al escenario principal (el nivel está
// completo).
//
// Música (audio/nivel4.ogg): arranca 2 s después de que la nave prende la luz
// (así se oye el sonido de luz on) y suena en bucle mientras dura la partida,
// acelerando de a muy poquito. Se frena al chocar (queda en silencio lo que
// dura la caída de la nave) y arranca de nuevo desde el principio, a
// velocidad normal, cuando empieza la partida siguiente.
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
  const SPAWN_RAMPA = 0.025; // cuánto baja por cada segundo sobrevivido (llega al mínimo a los ~30 s)
  const VEL_INICIAL = 150; // velocidad de caída (px/s)...
  const VEL_MAX = 1000; // ...y lo máximo a lo que sube (lo alcanza a los ~34 s)
  const VEL_RAMPA = 25; // cuánto sube por cada segundo sobrevivido
  // Intro (segundos): llegan las otras naves, esperan juntas, y se van.
  const INTRO_LLEGADA = 2.2;
  const INTRO_ESPERA = 0.7;
  const INTRO_SALIDA = 2.0; // lo que tardan en irse (ya fuera de la vista al final)
  const INTRO_ESCALONADO = 0.12; // cada nave sale un poco después de la anterior
  const INTRO_FUNDIDO = 1; // lo que tarda en caer la pantalla negra (igual que la transición de .game-tapa.cae)
  const INTRO_OSCURO = 2.8; // desde que desaparecen hasta que la nave prende la luz: el fondo se funde a negro (1 s) y queda oscuridad total
  const INTRO_ENTRADA = 1.4; // lo que tarda la nave en entrar volando
  const NAVE_FLOTA = { x: 5, y: 7 }; // px del mundo: vaivén de la nave mientras espera
  const NAVE_BALANCEO = 3; // grados de balanceo al mirar a las navecitas
  const INTRO_ACELERACION = 380; // px/s² del mundo al irse
  const INTRO_DIR = { x: -0.75, y: -0.66 }; // arriba a la izquierda
  const INTRO_MIRADA_MAX = 75; // grados: lo máximo que gira la nave para mirar a las navecitas
  const MUSICA_URL = "audio/nivel4.ogg";
  const MUSICA_VOLUMEN = 0.1;
  const MUSICA_RETRASO = 2; // segundos entre que la nave prende la luz y arranca la música
  // La música acelera de a muy poquito mientras dura la partida (casi
  // imperceptible): sube MUSICA_ACEL por segundo hasta MUSICA_ACEL_MAX (0,0004
  // por segundo = +1,2 % a los 30 s), como fracción de la velocidad normal.
  const MUSICA_ACEL = 0.0004;
  const MUSICA_ACEL_MAX = 0.1;
  const PERDER_URL = "audio/stopgame.mp3";
  const PERDER_VOLUMEN = 0.2;
  // Al entrar al último agujero de gusano (el que completa el color de la nave)
  // suena esta nota, una sola vez.
  const NOTA_URL = "audio/mimayor.m4a";
  const NOTA_VOLUMEN = 0.1;
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
  // Los polígonos intentan caerle a la nave: nacen apuntados a ella y, mientras
  // caen, se desvían hacia donde está (sino alcanza con quedarse parado en un
  // lugar sin piedras). Si además se queda quieta, la buscan con más fuerza.
  const PUNTERIA = 0.85; // fracción de los polígonos que nacen apuntados a la nave (el resto, al azar)
  const PUNTERIA_ANCHO = 200; // px del mundo: cuánto se abre el apuntado alrededor de la nave
  const COMPROMISO = 110; // px del mundo: a esta altura sobre la nave ya no corrigen y siguen derecho (así se puede esquivar a último momento)
  const BUSQUEDA_BASE = 0.6; // fuerza con la que buscan siempre (0..1; con la nave quieta sube a 1)
  const QUIETA_SEG = 3; // segundos sin moverse antes de que la busquen
  const QUIETA_MOV = 8; // px/s del mundo: por debajo de esto cuenta como quieta
  const BUSQUEDA_RAMPA = 2; // segundos hasta llegar a la fuerza completa con la nave quieta
  const BUSQUEDA_MAX = 0.5; // desvío horizontal máximo, como fracción de su velocidad de caída
  const BUSQUEDA_AGIL = 1.5; // 1/s: qué tan rápido corrigen el rumbo

  // --- Mundo y luz ----------------------------------------------------------
  const ESCALA_MUNDO = 0.55; // tamaño/velocidad del mundo respecto del juego "sin zoom"
  const MARGEN_SPAWN = 60; // px del mundo: los polígonos nacen un poco más allá de lo visible
  const LUZ_RADIO = 280; // px del mundo: alcance de la luz de la nave
  const LUZ_RGB_INICIO = [255, 255, 255]; // color de la luz con la nave en blanco y negro...
  const LUZ_RGB_FIN = [255, 159, 154]; // ...y con todo su color (el salmón del sitio, el de siempre)
  const LUZ_INTENSIDAD = 0.12; // opacidad del salmón en el centro de la luz (la misma que el ::before de la nave en styles.css)

  // --- Estrellas y cúmulos ---------------------------------------------------
  const ESTRELLAS_FONDO = 90; // estrellas blancas del fondo (decoración)
  const ESTRELLA_SALMON = "#f19280"; // salmón del sitio (--accent en styles.css)
  const GRUPOS_SALMON = [1, 3]; // qué grupos de estrellas (ver GRUPOS_ESTRELLAS) son salmón en la intro y en el final
  // Los agujeros de gusano (cúmulos) arrancan blancos y terminan naranja (el
  // predominante del parallax 7) a medida que se colorea la nave.
  const CUMULO_COLOR_INICIO = "#ffffff";
  const CUMULO_COLOR_FIN = "#cb681a";
  const CUMULO_BRILLO = 6; // px del mundo: resplandor de cada estrella (se arma una sola vez en el sprite)
  const SPRITE_ESCALA = 4; // px de sprite por px del mundo (nítido con zoom y pantallas densas)
  const CUMULO_ANILLO = 16; // px del mundo: radio del circulito de estrellas (chico)
  const CUMULO_RADIO = 26; // px del mundo: zona de entrada (un poco más que el anillo)
  const CUMULO_ESTRELLAS = 28; // estrellas del anillo de afuera
  const CUMULO_INTERIOR = 14; // estrellas del anillo de adentro (giran para el otro lado)
  const CUMULO_ESTRELLA_R = 1.7; // px del mundo: radio de cada estrella. Todas iguales y casi pegadas: 28 x 3,4 px de diámetro ~ el perímetro del círculo (100 px)
  const CUMULO_GIRO = 9; // radianes por segundo: giran muy rápido (más de una vuelta por segundo)
  const CUMULO_VIDA = 14; // segundos que dura el par de agujeros si no entran
  const CUMULO_DISTANCIA_PAR = 260; // px del mundo: separación mínima entre los dos agujeros del par
  const CUMULO_PRIMERO = 2.5; // segundos hasta el primer par
  const CUMULO_INTERVALO = [3, 6]; // segundos entre un par y el siguiente (al azar)
  const CUMULO_DISTANCIA_MIN = 160; // px del mundo: no aparecen encima de la nave
  // Final (victoria): la intro otra vez, con los parallax 7 en blanco y negro,
  // sin la nave del jugador y con un zoom hacia ellos. Los tiempos son los de la
  // intro (INTRO_LLEGADA, INTRO_ESPERA, INTRO_SALIDA...).
  const FINAL_PUNTO = { x: 0.6, y: 0.45 }; // dónde se juntan, como fracción de lo que se ve (0 = arriba a la izquierda)
  const FINAL_NAVE_DUR = 2.6; // fase 1: segundos de zoom a la nave del jugador, ya a color (después cae la pantalla negra)
  const FINAL_ZOOM_NAVE = 1.25; // zoom de esa fase, encima del de la cámara del juego (que es el de la intro; 1 = igual que la intro)
  const FINAL_COLOR_SUAVIZADO = 3; // 1/s: en el final la nave termina de teñirse rápido (COLOR_SUAVIZADO es el del juego)
  const FINAL_ZOOM = 1.25; // fase 2: zoom que se acerca al punto donde se juntan las naves, encima del de la cámara del juego (1 = igual que la intro)
  const FINAL_ZOOM_FONDO = 0.5; // el fondo starry se acerca menos (fracción del zoom de las naves), así hay paralaje
  const FINAL_COLA = 0.3; // segundos entre que se va la última nave y se vuelve al escenario principal
  // Cada nave: desde dónde entra (siempre afuera de lo que se ve, p = punto de
  // encuentro, v = vista) y dónde se acomoda, relativo al punto (px del mundo).
  const FINAL_NAVES = [
    { desde: (p, v) => ({ x: p.x - 60, y: v.y - 100 }), a: { x: -6, y: -4 } },
    { desde: (p, v) => ({ x: v.x - 100, y: p.y + 120 }), a: { x: -56, y: 30 } },
    {
      desde: (p, v) => ({ x: v.x + v.w + 100, y: p.y - 200 }),
      a: { x: 50, y: -30 },
    },
    {
      desde: (p, v) => ({ x: p.x + 240, y: v.y + v.h + 100 }),
      a: { x: 14, y: -50 },
    },
  ];
  const COLOR_PASOS = 40; // escalones en que se actualiza el filtro de color de la nave (0 a 1)
  const COLOR_SUAVIZADO = 0.8; // 1/s: cuánto tarda la nave en alcanzar el color nuevo (más bajo = más lento)
  const CUMULOS_PARA_COLOR = 10; // cuántos pasajes hacen falta para que la nave quede con todo su color (cada uno la pinta 1/10)
  const TIMER_COLOR_FIN = "#f19280"; // salmón del sitio (--accent en styles.css): el segundero pasa del blanco a este a medida que se colorea la nave
  const POLIGONO_COLOR_FIN = "#0d1b2e"; // azul starry (--navy en styles.css): el relleno de los polígonos pasa del negro a este a medida que se colorea la nave

  const scene = document.getElementById("game-scene");
  const canvas = document.getElementById("game-canvas");
  const timerEl = document.getElementById("game-timer");
  const ship = document.getElementById("starry-cohete-pair");
  const tapa = document.getElementById("game-tapa"); // pantalla negra por encima de la nave
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

  let cajaNave = CAJA_NAVE; // ancho de la caja de la nave (ver medirNave)
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
  let musicaBuffer = null; // audio/nivel4.ogg decodificado
  let musicaGain = null;
  let perderGain = null;
  let perderBuffer = null; // audio/stopgame.mp3 decodificado
  let perderFuente = null; // fuente sonando ahora (o null)
  let notaGain = null;
  let notaBuffer = null; // audio/mimayor.m4a decodificado
  let notaFuente = null; // fuente sonando ahora (o null)
  let nota = null; // <audio> de respaldo
  let perder = null; // <audio> de respaldo
  let musicaFuente = null; // fuente sonando ahora (o null)
  let musicaEspera = null; // segundos que faltan para que arranque la música (o null)
  let musicaT = 0; // segundos que lleva sonando la música (para acelerarla)
  let musica = null; // <audio> de respaldo si falla Web Audio
  let spriteP7 = null; // imagen del parallax 7, se carga al entrar por primera vez
  let spriteP7BN = null; // el parallax 7 en blanco y negro con sombra interna (canvas)
  let final = null; // animación de la victoria ({ t }), o null
  let ganado = false; // ya se ganó esta partida (empezó el final)
  let oscuro = false; // ya empezó a caer la pantalla negra
  let negro = false; // la pantalla ya está toda negra (fondo y nave ya cambiaron a blanco y negro)
  let miradaGrados = 0; // hacia dónde mira la nave en la intro (queda fija cuando se van las navecitas)
  let reloj = 0; // segundos corridos (para el titilar de las estrellas)
  const estrellas = Array.from({ length: ESTRELLAS_FONDO }, (_, i) => ({
    // Posición como fracción de la pantalla (con margen: la cámara con zoom y
    // el mapa completo ven distinto), así se acomodan al cambiar el tamaño.
    fx: -0.12 + Math.random() * 1.24,
    fy: -0.15 + Math.random() * 1.3,
    r: 0.6 + Math.random() * 1.1,
    grupo: i % 4,
  }));
  // Titilan de a grupos (uno por grupo, un solo fill cada uno) en vez de una por
  // una: se ve igual y cuesta 4 fills en lugar de 90.
  const GRUPOS_ESTRELLAS = [
    { vel: 0.7, fase: 0 },
    { vel: 1.1, fase: 1.7 },
    { vel: 1.6, fase: 3.1 },
    { vel: 2.1, fase: 4.6 },
  ];
  const estrellasPorGrupo = GRUPOS_ESTRELLAS.map((_, g) =>
    estrellas.filter((e) => e.grupo === g),
  );
  let gusanoSprites = null; // anillos de los agujeros ya dibujados con brillo (ver armarSprites)
  let luzSprites = null; // la luz de la nave ya dibujada (degradado), en blanco y en salmón
  let cumulos = []; // cúmulos de estrellas azules en el mapa
  let particulas = []; // chispas de cuando se choca un cúmulo
  let acumCumulo = 0;
  let proxCumulo = CUMULO_PRIMERO;
  let cumulosTomados = 0; // choques de esta partida
  let colorNave = 0; // 0 = blanco y negro ... 1 = todos sus colores (lo que se ve)
  let colorObjetivo = 0; // hacia dónde va colorNave
  let colorEscalon = 0; // último escalón aplicado al filtro (ver aplicarColorNave)
  // Primitivas de saturación de los filtros de la nave (index.html).
  const satNave = ["nave-sat-off", "nave-sat-luz"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  // Levantado de brillo del filtro de la nave con la luz prendida (index.html):
  // a color completo tiene que quedar sin tocar (slope 1, intercept 0) para que
  // se vea como el sprite original, igual que en el index.
  const luzNave = ["nave-luz-r", "nave-luz-g", "nave-luz-b"]
    .map((id) => document.getElementById(id))
    .filter(Boolean);
  const LUZ_SLOPE_GRIS = 1.4;
  const LUZ_INTERCEPT_GRIS = 0.1;
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
  function crearPoligono(objetivo) {
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
    let x = v.x - MARGEN_SPAWN + Math.random() * (v.w + MARGEN_SPAWN * 2);
    // Casi todos nacen apuntados a la nave (con algo de dispersión).
    if (objetivo && Math.random() < PUNTERIA)
      x = objetivo.x + (Math.random() - 0.5) * PUNTERIA_ANCHO;
    return {
      x,
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

  // Los puntos se reescriben en el mismo array (sin crear objetos nuevos en cada
  // cuadro para cada polígono: menos basura para el recolector).
  function actualizarPuntos(p) {
    const cos = Math.cos(p.ang);
    const sin = Math.sin(p.ang);
    for (let i = 0; i < p.verts.length; i++) {
      const v = p.verts[i];
      const q = p.pts[i] || (p.pts[i] = { x: 0, y: 0 });
      q.x = p.x + v.x * cos - v.y * sin;
      q.y = p.y + v.x * sin + v.y * cos;
    }
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
    const caja = cajaNave; // en mobile la caja es más chica
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
        Math.min(
          1,
          ((cx - a.x) * dx + (cy - a.y) * dy) / (dx * dx + dy * dy || 1),
        ),
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
    poligonos = [];
    tiempo = 0;
    // Con intro el segundero queda oculto y parado hasta que se van las naves.
    introT = conIntro ? 0 : -1;
    gracia = GRACIA;
    timerOculto = !!conIntro;
    timerEl.style.visibility = timerOculto ? "hidden" : "";
    // La intro es a color y con el fondo starry (ver game-color en la nave y
    // game-intro en la escena, styles.css); sin intro (después de un choque)
    // ya es blanco y negro.
    musicaEspera = null;
    ship.classList.toggle("game-color", !!conIntro);
    scene.classList.toggle("game-intro", !!conIntro);
    levantarTapa(true);
    oscuro = !conIntro;
    negro = !conIntro;
    acumSpawn = 0;
    choque = false;
    tChoque = 0;
    tQuieta = 0;
    navePrev = null;
    golpeadora = null;
    // Nueva partida: sin cúmulos y la nave vuelve a blanco y negro.
    cumulos = [];
    particulas = [];
    acumCumulo = 0;
    proxCumulo = CUMULO_PRIMERO;
    cumulosTomados = 0;
    colorObjetivo = 0;
    colorNave = 0;
    limpiarFinal();
    colorEscalon = -1; // fuerza a aplicar el 0
    aplicarColorNave();
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
      notaGain = conGain(NOTA_VOLUMEN);
      try {
        musicaBuffer = await decodificar(MUSICA_URL);
      } catch (e) {
        musicaBuffer = null;
      }
      try {
        notaBuffer = await decodificar(NOTA_URL);
      } catch (e) {
        notaBuffer = null;
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
    if (!notaBuffer) {
      nota = new Audio(NOTA_URL);
      nota.volume = NOTA_VOLUMEN;
    }
  }

  // La nota del último agujero: suena una vez desde el principio.
  function sonarNota() {
    if (notaBuffer) {
      audioCtx.resume().catch(() => {});
      notaFuente = audioCtx.createBufferSource();
      notaFuente.buffer = notaBuffer;
      notaFuente.connect(notaGain);
      notaFuente.start();
    } else if (nota) {
      nota.currentTime = 0;
      nota.play().catch(() => {});
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
    musicaT = 0;
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

  // Velocidad de la música según cuánto lleva sonando. Con Web Audio cambia
  // también un poco el tono (es tan poco que no se nota); con el <audio> de
  // respaldo el navegador conserva el tono.
  function acelerarMusica() {
    const velocidad = 1 + Math.min(MUSICA_ACEL_MAX, musicaT * MUSICA_ACEL);
    if (musicaFuente) musicaFuente.playbackRate.value = velocidad;
    else if (musica && !musica.paused) musica.playbackRate = velocidad;
  }

  function frenarMusica() {
    musicaEspera = null; // si estaba por arrancar, se cancela
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
    if (notaFuente) {
      try {
        notaFuente.stop();
      } catch (e) {}
      notaFuente.disconnect();
      notaFuente = null;
    }
    if (nota) nota.pause();
  }

  // Sube o baja la pantalla negra; instantáneo = sin fundido (al salir del
  // escenario o al empezar una intro, para que no se vea sobre otra escena).
  function levantarTapa(instantaneo) {
    if (!tapa) return;
    if (instantaneo) tapa.style.transition = "none";
    tapa.classList.remove("cae");
    if (instantaneo) {
      void tapa.offsetWidth;
      tapa.style.transition = "";
    }
  }

  function centrarNave() {
    if (window.shipPlace)
      window.shipPlace(
        window.innerWidth / 2,
        window.innerHeight * POSICION_Y_INICIAL,
      );
  }

  // Línea de tiempo de la intro: empiezan a irse las naves (INTRO_INICIO), ya
  // se fue la última y se apaga todo (INTRO_FUERA) y, tras la oscuridad, la
  // nave prende la luz y empieza el juego (INTRO_JUEGO: aparece el segundero,
  // suena la música).
  const INTRO_INICIO = INTRO_LLEGADA + INTRO_ESPERA;
  const INTRO_FUERA =
    INTRO_INICIO + INTRO_SALIDA + INTRO_ESCALONADO * (INTRO_NAVES.length - 1);
  const INTRO_JUEGO = INTRO_FUERA + INTRO_OSCURO;

  // Punto de encuentro de las naves de la intro (mundo).
  function puntoEncuentro() {
    const h = window.innerHeight;
    return {
      x: window.innerWidth * P7_X,
      y: Math.max(h * 0.3, h - P7_ALTURA),
    };
  }

  // Dónde está la nave durante la intro: entra volando desde la derecha hasta
  // el lugar por donde entra al escenario y ahí flota con un vaivén suave (no
  // se queda clavada). Coordenadas de pantalla (centro de la nave).
  function posicionNaveIntro(t) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const u = Math.min(1, t / INTRO_ENTRADA);
    const suave = 1 - Math.pow(1 - u, 3);
    const desde = { x: w + 90, y: h * 0.9 };
    const destino = { x: w - 85, y: h * 0.75 };
    return {
      x:
        desde.x +
        (destino.x - desde.x) * suave +
        Math.sin(t * 1.7) * NAVE_FLOTA.x * suave,
      y:
        desde.y +
        (destino.y - desde.y) * suave +
        Math.sin(t * 2.3 + 1) * NAVE_FLOTA.y * suave,
    };
  }

  // Durante la intro la nave mira a las navecitas: hacia donde se juntan y,
  // cuando se van, siguiéndolas (0° es mirar derecho arriba; negativo, a la
  // izquierda).
  function mirarNaves(centro) {
    if (!centro || !window.shipFace) return;
    const naves = navesIntro(introT);
    // Cuando ya no hay navecitas se queda mirando hacia donde se fueron.
    if (naves.length) {
      const objetivo = {
        x: naves.reduce((a, n) => a + n.x, 0) / naves.length,
        y: naves.reduce((a, n) => a + n.y, 0) / naves.length,
      };
      const grados =
        (Math.atan2(objetivo.y - centro.y, objetivo.x - centro.x) * 180) /
          Math.PI +
        90;
      const norm = ((grados + 540) % 360) - 180;
      miradaGrados = Math.max(
        -INTRO_MIRADA_MAX,
        Math.min(INTRO_MIRADA_MAX, norm),
      );
    }
    window.shipFace(miradaGrados + Math.sin(introT * 1.3) * NAVE_BALANCEO);
  }

  // Naves de la intro en el mundo, según el segundo de intro. Fuera de la
  // intro (o cuando ya se fueron) devuelve una lista vacía.
  function navesIntro(t) {
    if (t < 0 || t > INTRO_FUERA) return [];
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

  // El sprite del parallax 7 ocupa solo un rincón del PNG (992x700): se recorta.
  const P7_RECORTE = { x: 58, y: 11, w: 111, h: 83 };
  const P7_MARGEN = 8; // px del PNG alrededor del sprite, para que la sombra interna cierre en los bordes
  const P7_RESOLUCION = 2;
  const P7_SOMBRA = { difusion: 7, dx: 1.5, dy: 3, pasadas: 3 }; // sombra interna, en px del PNG

  // El parallax 7 en blanco y negro con sombra interna, armado una sola vez en
  // un canvas (el filtro SVG de la nave no se puede usar dentro del canvas en
  // todos los navegadores).
  function armarSpriteP7BN(img) {
    const r = P7_RECORTE;
    const k = P7_RESOLUCION;
    const w = (r.w + P7_MARGEN * 2) * k;
    const h = (r.h + P7_MARGEN * 2) * k;
    const recorte = (c) =>
      c.drawImage(
        img,
        r.x - P7_MARGEN,
        r.y - P7_MARGEN,
        w / k,
        h / k,
        0,
        0,
        w,
        h,
      );
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

  // Final (victoria), en dos fases (final.fase):
  // 1. Zoom a la nave del jugador, que termina de teñirse y se ve toda de color
  //    (sobre su propio centro: la escala de la nave, window.shipZoom, y todo el
  //    resto acercándose a ella). Se van los cúmulos, los polígonos y el
  //    segundero. Después cae la pantalla negra, como en la intro.
  // 2. Con la pantalla negra: la nave del jugador ya no se ve (game-final, ver
  //    styles.css), queda solo el fondo starry con las naves parallax 7 en
  //    blanco y negro, que llegan con el zoom y se escapan.
  function iniciarFinal() {
    ganado = true;
    final = { t: 0, fase: 1, tapa: false };
    cumulos = [];
    particulas = [];
    poligonos = [];
    colorObjetivo = 1;
    timerEl.style.visibility = "hidden";
    ship.classList.add("game-luz-index"); // con la luz prendida, como en el index
  }

  // Pasa de la fase 1 a la 2 (con la pantalla ya toda negra, no se nota el corte).
  function pasarAFaseNaves() {
    final.fase = 2;
    final.t = 0;
    colorNave = 1;
    aplicarColorNave();
    window.shipZoom = 1;
    ship.classList.add("game-final");
    levantarTapa(false);
  }

  // Vuelve todo a como estaba antes del final (al empezar una partida y al salir
  // del escenario: la nave tiene que volver a verse en el resto de los escenarios).
  function limpiarFinal() {
    final = null;
    ganado = false;
    window.shipZoom = 1;
    ship.classList.remove("game-final", "game-luz-index");
    scene.style.removeProperty("--fondo-zoom");
    scene.style.removeProperty("--fondo-origen");
  }

  // Fase 1: zoom a la nave, suave, hasta FINAL_ZOOM_NAVE.
  function zoomNave() {
    const u = Math.min(1, final.t / FINAL_NAVE_DUR);
    return 1 + (FINAL_ZOOM_NAVE - 1) * u * u * (3 - 2 * u);
  }

  // Punto del mundo donde se juntan las naves del final: una posición fija de lo
  // que se ve (no depende de dónde terminó la nave del jugador).
  function puntoFinal() {
    const v = vista();
    return { x: v.x + v.w * FINAL_PUNTO.x, y: v.y + v.h * FINAL_PUNTO.y };
  }

  // Zoom (1 = ninguno): crece suave mientras llegan las naves y se queda cuando
  // empiezan a irse.
  function zoomFinal() {
    const u = Math.min(1, final.t / (INTRO_INICIO + 0.5));
    return 1 + (FINAL_ZOOM - 1) * u * u * (3 - 2 * u);
  }

  // Igual que navesIntro (mismos tiempos y la misma salida hacia arriba a la
  // izquierda), pero con otros orígenes y otro lugar de encuentro.
  function navesFinal(t) {
    if (t > INTRO_FUERA) return [];
    const v = vista();
    const p = puntoFinal();
    const u = Math.min(1, t / INTRO_LLEGADA);
    const suave = 1 - Math.pow(1 - u, 3);
    return FINAL_NAVES.map((n, i) => {
      const d0 = n.desde(p, v);
      let x = d0.x + (p.x + n.a.x - d0.x) * suave;
      let y = d0.y + (p.y + n.a.y - d0.y) * suave;
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

  function dibujarFinal() {
    if (!final || final.fase !== 2 || !spriteP7BN) return;
    const ancho = (P7_ANCHO * (P7_RECORTE.w + P7_MARGEN * 2)) / P7_RECORTE.w;
    const alto = (ancho * spriteP7BN.height) / spriteP7BN.width;
    for (const n of navesFinal(final.t)) {
      ctx.drawImage(
        spriteP7BN,
        n.x - (ancho * n.esc) / 2,
        n.y - (alto * n.esc) / 2,
        ancho * n.esc,
        alto * n.esc,
      );
    }
  }

  function dibujarIntro() {
    if (!spriteP7 || !spriteP7.naturalWidth) return;
    const r = P7_RECORTE;
    const ancho = P7_ANCHO;
    const alto = (P7_ANCHO * r.h) / r.w;
    for (const n of navesIntro(introT)) {
      ctx.drawImage(
        spriteP7,
        r.x,
        r.y,
        r.w,
        r.h,
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

  // Saturación de la nave (0 = gris, 1 = con todos sus colores). Cambiar el
  // filtro SVG de la nave obliga al navegador a repintarlo entero, y hacerlo en
  // cada cuadro mientras se tiñe (varios segundos por pasaje) tiraba los cuadros
  // por segundo: por eso solo se toca cuando el valor cambia de escalón
  // (COLOR_PASOS escalones en total, imperceptibles uno a uno).
  function aplicarColorNave() {
    const escalon = Math.round(colorNave * COLOR_PASOS);
    if (escalon === colorEscalon) return;
    colorEscalon = escalon;
    const valor = (escalon / COLOR_PASOS).toFixed(3);
    for (const el of satNave) el.setAttribute("values", valor);
    const gris = 1 - escalon / COLOR_PASOS;
    for (const el of luzNave) {
      el.setAttribute("slope", (1 + (LUZ_SLOPE_GRIS - 1) * gris).toFixed(3));
      el.setAttribute("intercept", (LUZ_INTERCEPT_GRIS * gris).toFixed(3));
    }
    // El sprite de atrás (el resplandor) también: su gris lo lee de esta variable
    // (ver scenes.game.light en script.js).
    ship.style.setProperty(
      "--nave-gris",
      (1 - escalon / COLOR_PASOS).toFixed(3),
    );
    // La luz también: empieza blanca y va pasando al salmón (los halos y el
    // degradado de la nave, ver --luz-rgb en styles.css; el del canvas lo mezcla
    // dibujar).
    ship.style.setProperty(
      "--luz-rgb",
      LUZ_RGB_INICIO.map((a, i) =>
        Math.round(a + (LUZ_RGB_FIN[i] - a) * (escalon / COLOR_PASOS)),
      ).join(","),
    );
    // El fondo starry sube con el color de la nave (la transición del CSS suaviza
    // el salto de un escalón al siguiente).
    scene.style.setProperty("--fondo-color", valor);
    // Y el segundero pasa del blanco al salmón del sitio.
    timerEl.style.color = mezclarColores(
      "#ffffff",
      TIMER_COLOR_FIN,
      escalon / COLOR_PASOS,
    );
  }

  // Un agujero de gusano nuevo en un punto al azar de lo que se ve, lejos de la
  // nave y (si se pasa) del otro agujero del par.
  function crearCumulo(objetivo, otro) {
    const v = vista();
    const margen = 90;
    for (let intento = 0; intento < 20; intento++) {
      const x = v.x + margen + Math.random() * Math.max(1, v.w - margen * 2);
      const y = v.y + margen + Math.random() * Math.max(1, v.h - margen * 2);
      if (
        objetivo &&
        Math.hypot(x - objetivo.x, y - objetivo.y) < CUMULO_DISTANCIA_MIN
      )
        continue;
      if (otro && Math.hypot(x - otro.x, y - otro.y) < CUMULO_DISTANCIA_PAR)
        continue;
      return {
        x,
        y,
        t: 0,
        ang: Math.random() * Math.PI * 2,
        par: null, // el otro agujero: por ahí sale la nave
      };
    }
    return null;
  }

  // Un par de agujeros de gusano, cada uno apuntando al otro.
  function crearPar(objetivo) {
    const a = crearCumulo(objetivo, null);
    if (!a) return;
    const b = crearCumulo(objetivo, a);
    if (!b) return;
    a.par = b;
    b.par = a;
    cumulos.push(a, b);
  }

  // Chispas en un punto (al entrar y al salir).
  function chispas(x, y) {
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const vel = 40 + Math.random() * 70;
      particulas.push({
        x,
        y,
        vx: Math.cos(ang) * vel,
        vy: Math.sin(ang) * vel,
        t: 0,
      });
    }
  }

  // Agujeros de gusano: aparecen de a pares cada tanto, giran rápido y se apagan
  // si no entran. Al entrar en uno la nave sale por el otro y gana color.
  function actualizarCumulos(dt, circulos) {
    acumCumulo += dt;
    if (cumulos.length === 0 && !ganado && acumCumulo >= proxCumulo) {
      acumCumulo = 0;
      proxCumulo =
        CUMULO_INTERVALO[0] +
        Math.random() * (CUMULO_INTERVALO[1] - CUMULO_INTERVALO[0]);
      crearPar(circulos[1]);
    }
    for (const c of cumulos) {
      c.t += dt;
      c.ang += CUMULO_GIRO * dt;
    }
    cumulos = cumulos.filter((c) => c.t < CUMULO_VIDA);
    const entrado = cumulos.find((c) =>
      circulos.some(
        (n) => Math.hypot(n.x - c.x, n.y - c.y) < n.r + CUMULO_RADIO,
      ),
    );
    if (entrado) {
      // La nave desaparece por este agujero y aparece por el otro (ambos se
      // cierran con chispas), y se pinta un poco más.
      const salida = entrado.par;
      chispas(entrado.x, entrado.y);
      chispas(salida.x, salida.y);
      if (window.shipPlace) window.shipPlace(salida.x, salida.y, true);
      cumulos = cumulos.filter((c) => c !== entrado && c !== salida);
      cumulosTomados++;
      colorObjetivo = Math.min(1, cumulosTomados / CUMULOS_PARA_COLOR);
      if (cumulosTomados >= CUMULOS_PARA_COLOR) {
        // El último: suena la nota y empieza el final enseguida (no hay que
        // esperar a que termine de teñirse ni cruzar otro; el color sigue subiendo
        // durante la animación). La música del juego se corta y queda solo la nota.
        frenarMusica();
        sonarNota();
        iniciarFinal();
      }
    }
    for (const p of particulas) {
      p.t += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 1 - 2 * dt;
      p.vy *= 1 - 2 * dt;
    }
    particulas = particulas.filter((p) => p.t < 0.7);
  }

  function actualizar(dt, circulos) {
    if (!ganado) tiempo += dt; // al ganar el segundero queda parado

    if (tiempo > gracia && !ganado) {
      acumSpawn += dt;
      const intervalo = Math.max(
        SPAWN_MIN,
        SPAWN_INICIAL - tiempo * SPAWN_RAMPA,
      );
      if (acumSpawn >= intervalo) {
        acumSpawn = 0;
        poligonos.push(crearPoligono(circulos[1]));
      }
    }

    actualizarCumulos(dt, circulos);

    const v = vista();
    const abajo = v.y + v.h;
    // Fuerza con la que buscan a la nave: siempre BUSQUEDA_BASE, y sube hasta 1
    // a partir de los QUIETA_SEG segundos sin movimiento.
    const quieta = Math.max(
      0,
      Math.min(1, (tQuieta - QUIETA_SEG) / BUSQUEDA_RAMPA),
    );
    const busqueda = BUSQUEDA_BASE + (1 - BUSQUEDA_BASE) * quieta;
    const centro = circulos[1];
    for (const p of poligonos) {
      // Se desvían hacia la nave mientras estén más arriba que COMPROMISO; más
      // cerca ya no corrigen (siguen con el rumbo que traen, se puede esquivar)
      // y las que ya pasaron siguen derecho.
      let objetivo = p.vx;
      if (centro && p.y < centro.y - COMPROMISO) {
        const max = p.vy * BUSQUEDA_MAX * busqueda;
        objetivo = Math.max(-max, Math.min(max, (centro.x - p.x) * 2));
      } else if (!centro || p.y >= centro.y) {
        objetivo = 0;
      }
      p.vx += (objetivo - p.vx) * Math.min(1, dt * BUSQUEDA_AGIL);
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.ang += p.giro * dt;
      actualizarPuntos(p);
    }
    // Se descartan los que ya salieron por abajo, compactando el mismo array.
    let quedan = 0;
    for (const p of poligonos)
      if (p.y - p.radio < abajo) poligonos[quedan++] = p;
    poligonos.length = quedan;

    // Durante el final (ya completó el color) no se choca: el nivel está ganado.
    for (const p of ganado ? [] : poligonos) {
      // Descarte rápido: si el círculo está más lejos que el radio del polígono
      // (todos sus vértices caen dentro de p.radio del centro) no hace falta
      // probar borde por borde.
      const tocado = circulos.find((c) => {
        const dx = c.x - p.x;
        const dy = c.y - p.y;
        const rr = p.radio + c.r;
        return (
          dx * dx + dy * dy <= rr * rr &&
          circuloTocaPoligono(c.x, c.y, c.r, p.pts)
        );
      });
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

  // Estrellas del fondo (decoración, no se chocan). Se ven siempre: en el juego,
  // en la intro y en el final, sobre el fondo negro o el starry. Son blancas, y
  // en la intro y en el final algunas (ciertos grupos) son salmón. 4 fills en
  // total (uno por grupo, cada grupo con su titilar).
  function dibujarEstrellas() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const conSalmon = !negro || ganado; // intro y final
    for (let g = 0; g < GRUPOS_ESTRELLAS.length; g++) {
      const grupo = GRUPOS_ESTRELLAS[g];
      ctx.fillStyle =
        conSalmon && GRUPOS_SALMON.includes(g) ? ESTRELLA_SALMON : "#fff";
      ctx.globalAlpha =
        0.3 + 0.6 * (0.5 + 0.5 * Math.sin(reloj * grupo.vel + grupo.fase));
      ctx.beginPath();
      for (const e of estrellasPorGrupo[g]) {
        const x = e.fx * w;
        const y = e.fy * h;
        ctx.moveTo(x + e.r, y);
        ctx.arc(x, y, e.r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Un anillo de estrellas con brillo, dibujado en un canvas aparte (una sola
  // vez): el resplandor (shadowBlur) es lo caro, así no se recalcula por cuadro.
  function armarAnillo(radio, cantidad, r, color) {
    const K = SPRITE_ESCALA;
    const lado = Math.ceil((radio + r + CUMULO_BRILLO * 2) * 2 * K);
    const lienzo = document.createElement("canvas");
    lienzo.width = lienzo.height = lado;
    const c = lienzo.getContext("2d");
    c.translate(lado / 2, lado / 2);
    c.fillStyle = color;
    c.shadowColor = color;
    c.shadowBlur = CUMULO_BRILLO * K;
    for (let i = 0; i < cantidad; i++) {
      const a = (i / cantidad) * Math.PI * 2;
      // Dos pasadas: el resplandor se refuerza y se nota más.
      for (let k = 0; k < 2; k++) {
        c.beginPath();
        c.arc(
          Math.cos(a) * radio * K,
          Math.sin(a) * radio * K,
          r * K,
          0,
          Math.PI * 2,
        );
        c.fill();
      }
    }
    return lienzo;
  }

  // Todo lo caro de dibujar se arma acá, una sola vez (al entrar al escenario).
  function armarSprites() {
    // Los dos anillos de los agujeros, cada uno en blanco y en naranja.
    gusanoSprites = {
      afuera: [CUMULO_COLOR_INICIO, CUMULO_COLOR_FIN].map((color) =>
        armarAnillo(CUMULO_ANILLO, CUMULO_ESTRELLAS, CUMULO_ESTRELLA_R, color),
      ),
      adentro: [CUMULO_COLOR_INICIO, CUMULO_COLOR_FIN].map((color) =>
        armarAnillo(
          CUMULO_ANILLO * 0.55,
          CUMULO_INTERIOR,
          CUMULO_ESTRELLA_R * 0.75,
          color,
        ),
      ),
    };
    // La luz de la nave: el mismo degradado que el resto de la página (el
    // ::before de .starry-cohete-pair en styles.css), dibujado una vez en blanco
    // y una en salmón; en cada cuadro solo se estiran a su tamaño y se mezclan
    // según el color de la nave, con la intensidad.
    const n = 256;
    luzSprites = [LUZ_RGB_INICIO, LUZ_RGB_FIN].map((rgb) => {
      const sprite = document.createElement("canvas");
      sprite.width = sprite.height = n;
      const c = sprite.getContext("2d");
      const g = c.createRadialGradient(n / 2, n / 2, 0, n / 2, n / 2, n / 2);
      g.addColorStop(0, `rgba(${rgb},1)`);
      g.addColorStop(0.2, `rgba(${rgb},0.65)`);
      g.addColorStop(0.5, `rgba(${rgb},0.25)`);
      g.addColorStop(1, `rgba(${rgb},0)`);
      c.fillStyle = g;
      c.fillRect(0, 0, n, n);
      return sprite;
    });
  }

  // Dibuja un sprite de anillo rotado. Como los anillos de estrellas son
  // parejos, rotar el sprite se ve igual que mover cada estrella.
  function dibujarAnilloSprite(sprite, x, y, giro, esc, alfa) {
    if (alfa <= 0.01) return;
    const lado = (sprite.width / SPRITE_ESCALA) * esc;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(giro);
    ctx.globalAlpha = alfa;
    ctx.drawImage(sprite, -lado / 2, -lado / 2, lado, lado);
    ctx.restore();
  }

  // Color intermedio entre el de inicio y el de fin de los agujeros (para las
  // chispas, que se dibujan directo).
  function mezclarColores(desde, hasta, k) {
    const a = parseInt(desde.slice(1), 16);
    const b = parseInt(hasta.slice(1), 16);
    const canal = (sh) =>
      Math.round(((a >> sh) & 255) * (1 - k) + ((b >> sh) & 255) * k);
    return "rgb(" + canal(16) + "," + canal(8) + "," + canal(0) + ")";
  }

  function mezclaAgujeros(k) {
    return mezclarColores(CUMULO_COLOR_INICIO, CUMULO_COLOR_FIN, k);
  }

  // Agujeros de gusano: un circulito de estrellas con brillo girando muy rápido,
  // con otro anillo más chico girando para el otro lado y el centro negro (el
  // "agujero"). Empiezan blancos y, a medida que se colorea la nave, pasan a
  // naranja: son dos sprites (blanco y naranja) que se funden con colorNave.
  // Y las chispas de cuando se entra o se sale.
  function dibujarCumulos() {
    const k = Math.max(0, Math.min(1, colorNave));
    for (const c of cumulos) {
      // Aparecen y se van achicándose (no con transparencia).
      const esc = Math.min(1, c.t / 0.5, (CUMULO_VIDA - c.t) / 1.5);
      // El agujero: un disco negro que tapa lo que hay detrás (la luz, las
      // estrellas del fondo).
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(c.x, c.y, CUMULO_ANILLO * esc, 0, Math.PI * 2);
      ctx.fill();
      for (let v = 0; v < 2; v++) {
        // v = 0: blanco (se apaga con k); v = 1: naranja (aparece con k).
        const alfa = v === 0 ? 1 - k : k;
        dibujarAnilloSprite(
          gusanoSprites.afuera[v],
          c.x,
          c.y,
          c.ang,
          esc,
          alfa,
        );
        dibujarAnilloSprite(
          gusanoSprites.adentro[v],
          c.x,
          c.y,
          -c.ang * 1.7,
          esc,
          alfa,
        );
      }
    }
    ctx.globalAlpha = 1;
    if (particulas.length) {
      ctx.fillStyle = mezclaAgujeros(k);
      ctx.beginPath();
      for (const p of particulas) {
        const r = 2 * (1 - p.t / 0.7);
        ctx.moveTo(p.x + r, p.y);
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  // Cuánto falta para que la nave cruce el borde derecho hacia el escenario
  // principal (0 = todavía lejos, 1 = ya cruza). El margen de ese borde lo define
  // scenes.game.edges.right.margin en script.js.
  function progresoSalida() {
    if (typeof shipCenterX === "undefined" || shipCenterX === null) return 0;
    if (typeof scenes === "undefined" || !scenes.game) return 0;
    const borde = scenes.game.edges && scenes.game.edges.right;
    if (!borde || !borde.margin) return 0;
    const w = window.innerWidth;
    const desde = w - 30; // el aviso empieza un poco antes del borde
    const hasta = w + borde.margin + 65; // centro de la nave cuando cruza (caja + 65)
    return Math.max(0, Math.min(1, (shipCenterX - desde) / (hasta - desde)));
  }

  // Aviso de que la nave se está yendo por la derecha: una barra plana blanca
  // pegada al borde que crece a medida que se acerca el cambio de escenario.
  function dibujarSalida() {
    const p = progresoSalida();
    if (p <= 0) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const ancho = 6 + 70 * p;
    ctx.globalAlpha = 0.2 + 0.6 * p;
    ctx.fillStyle = "#fff";
    ctx.fillRect(w - ancho, 0, ancho, h);
    ctx.globalAlpha = 1;
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
    if (final) {
      // Zoom del final (todo lo que sigue se acerca al punto): en la fase 1 a la
      // nave del jugador y en la 2 al punto donde se juntan las naves. El fondo
      // starry, que es CSS, acompaña con menos zoom.
      const p = final.fase === 1 ? { x: cam.ox, y: cam.oy } : puntoFinal();
      const z = final.fase === 1 ? zoomNave() : zoomFinal();
      ctx.translate(p.x, p.y);
      ctx.scale(z, z);
      ctx.translate(-p.x, -p.y);
      scene.style.setProperty(
        "--fondo-zoom",
        (1 + (z - 1) * FINAL_ZOOM_FONDO).toFixed(4),
      );
      scene.style.setProperty(
        "--fondo-origen",
        cam.ox +
          (p.x - cam.ox) * cam.z +
          "px " +
          (cam.oy + (p.y - cam.oy) * cam.z) +
          "px",
      );
    }

    dibujarEstrellas();

    // La luz de la nave sobre el fondo, debajo de los polígonos: como son
    // negros y opacos, contra ese resplandor se ven como siluetas. Solo en el
    // juego: en la intro y en el final la nave prendida se ve como en el index
    // (sin esta luz grande; ver game-color y game-luz-index en styles.css).
    if (luzNivel > 0.01 && centro && luzSprites && negro && !final) {
      // Empieza blanca y pasa al salmón con el color de la nave (un fundido
      // entre los dos sprites, como en los agujeros).
      const k = Math.max(0, Math.min(1, colorNave));
      for (let v = 0; v < 2; v++) {
        ctx.globalAlpha = LUZ_INTENSIDAD * luzNivel * (v === 0 ? 1 - k : k);
        ctx.drawImage(
          luzSprites[v],
          centro.x - LUZ_RADIO,
          centro.y - LUZ_RADIO,
          LUZ_RADIO * 2,
          LUZ_RADIO * 2,
        );
      }
      ctx.globalAlpha = 1;
    }

    dibujarCumulos();
    dibujarIntro();

    ctx.lineWidth = 1.6; // ~3.5px en pantalla con el zoom normal
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#fff";
    // Relleno: del negro al azul starry a medida que se colorea la nave (igual
    // que el fondo y los agujeros).
    ctx.fillStyle = mezclarColores(
      "#000000",
      POLIGONO_COLOR_FIN,
      Math.max(0, Math.min(1, colorNave)),
    );
    for (const p of poligonos) {
      ctx.beginPath();
      const pts = p.pts;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    dibujarFinal();
    // Lo que sigue va en pantalla, sin el zoom de la cámara.
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (negro && !ganado) dibujarSalida();
  }

  function cuadro(ahora) {
    raf = requestAnimationFrame(cuadro);
    // Tope al dt: al volver de otra pestaña no debe caer todo de golpe. Y
    // nunca negativo: el timestamp del primer cuadro puede ser anterior al
    // performance.now() de setActive, y un dt < 0 dejaba introT en negativo
    // (la intro se salteaba entera).
    const dt = Math.max(0, Math.min((ahora - ultimo) / 1000, 0.05));
    ultimo = ahora;

    const circulos = circulosNave();
    reloj += dt;
    // La nave va ganando color de a poco (no de golpe) hacia colorObjetivo, y
    // muy despacio: cada pasaje tarda varios segundos en terminar de teñirla.
    if (Math.abs(colorObjetivo - colorNave) > 0.0005) {
      const suavizado = final ? FINAL_COLOR_SUAVIZADO : COLOR_SUAVIZADO;
      colorNave += (colorObjetivo - colorNave) * Math.min(1, dt * suavizado);
      aplicarColorNave();
    }
    if (final) {
      final.t += dt;
      // Se deja quieta a la nave del jugador donde está (sin control, como en la
      // intro) para que no salga del escenario sin querer.
      if (window.shipMove) window.shipMove(0, 0);
      if (final.fase === 1) {
        // Zoom a la nave (ya a color); cuando termina cae la pantalla negra y,
        // ya toda negra, se pasa a la fase de las naves.
        window.shipZoom = zoomNave();
        if (!final.tapa && final.t >= FINAL_NAVE_DUR) {
          final.tapa = true;
          if (tapa) tapa.classList.add("cae");
        }
        if (final.t >= FINAL_NAVE_DUR + INTRO_FUNDIDO) pasarAFaseNaves();
      } else if (!final.salio && final.t > INTRO_FUERA + FINAL_COLA) {
        // Terminó la animación: el nivel está completo, se vuelve al escenario
        // principal (por el borde derecho, como al irse a mano). El zoom se
        // queda como está hasta que se cierra la escena.
        final.salio = true;
        if (window.shipLeave) window.shipLeave("right");
      }
    }
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
      // Intro: todavía no corre el tiempo ni caen polígonos, y el jugador no
      // controla la nave (hace su entrada, flota y mira a las navecitas) hasta
      // que arranca el segundero.
      introT += dt;
      if (!oscuro && introT >= INTRO_FUERA) {
        // Desaparecieron las navecitas: cae la pantalla negra por encima de
        // todo, la nave incluida (sigue a color mientras se oscurece).
        oscuro = true;
        if (tapa) tapa.classList.add("cae");
      }
      if (!negro && introT >= INTRO_FUERA + INTRO_FUNDIDO) {
        // Ya está toda negra: el fondo y la nave pasan a blanco y negro sin
        // que se vea.
        negro = true;
        scene.classList.remove("game-intro");
        ship.classList.remove("game-color");
      }
      tQuieta = 0;
      navePrev = null;
      if (window.shipPlace) {
        // Sin control del jugador: la nave hace su propia entrada y flota.
        const p = posicionNaveIntro(introT);
        window.shipPlace(p.x, p.y, true);
      }
      mirarNaves(circulos[1]);
    } else {
      if (timerOculto) {
        introT = -1; // termina la intro
        timerOculto = false;
        timerEl.style.visibility = "";
        // Pasada la oscuridad la nave prende la luz (con su sonido), se levanta
        // la pantalla negra y la nave aparece en blanco y negro; empieza el
        // juego.
        levantarTapa(false);
        if (window.shipLightSet) window.shipLightSet(true);
        musicaEspera = MUSICA_RETRASO; // la música arranca un rato después, para que se oiga el sonido de luz
      }
      // La música: arranca MUSICA_RETRASO segundos después de prender la luz y
      // de ahí acelera de a muy poquito.
      if (musicaEspera !== null) {
        musicaEspera -= dt;
        if (musicaEspera <= 0) iniciarMusica();
      } else if (musicaFuente || (musica && !musica.paused)) {
        musicaT += dt;
        acelerarMusica();
      }
      const centro = circulos[1];
      if (centro && navePrev && dt > 0) {
        const vel =
          Math.hypot(centro.x - navePrev.x, centro.y - navePrev.y) / dt;
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

  // Leer offsetWidth obliga al navegador a recalcular estilos y layout en el
  // momento (y la nave cambia de estilo en cada cuadro), así que se lee una vez
  // por cambio de tamaño de ventana y no en cada cuadro.
  function medirNave() {
    cajaNave = ship.offsetWidth || CAJA_NAVE;
  }

  function ajustarCanvas() {
    medirNave();
    // Tope de 1,5x: en pantallas muy densas (2x o más) el canvas de 2x tiene el
    // doble de píxeles que cuesta rellenar en cada cuadro y el juego, casi todo
    // negro con formas chicas, no gana nada.
    dpr = Math.min(window.devicePixelRatio || 1, 1.5);
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
        if (!gusanoSprites) armarSprites(); // brillos y luz: se arman una sola vez
        if (!musicaIniciada) {
          musicaIniciada = true;
          cargarMusica(); // que esté lista cuando termina la intro
        }
        if (!spriteP7) {
          spriteP7 = new Image();
          spriteP7.onload = () => (spriteP7BN = armarSpriteP7BN(spriteP7));
          spriteP7.src = "parallax/parallax 7.webp";
        }
        reiniciar(false, true);
        ultimo = performance.now();
        raf = requestAnimationFrame(cuadro);
      } else {
        cancelAnimationFrame(raf);
        frenarSonidos();
        limpiarFinal(); // la nave vuelve a verse en el resto de los escenarios
        ship.classList.remove("game-color");
        ship.style.removeProperty("--luz-rgb"); // en el resto de los escenarios la luz es la de siempre
        scene.classList.remove("game-intro");
        levantarTapa(true);
      }
    },
  };
})();
