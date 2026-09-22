// Medidor de rendimiento: solo se carga si la URL trae ?perf=1 (ver el script del
// final de index.html). Arriba a la izquierda muestra, cada medio segundo:
//   fps        cuadros por segundo (promedio)
//   peor       el cuadro más lento de ese medio segundo (ms): lo que se siente como tirón
//   tareas     tareas largas (>50 ms) acumuladas: cantidad y ms totales
//   heap       memoria de JS (solo Chrome/Edge)
//   escena     el escenario en el que está la nave
// Para comparar antes/después de un cambio: mismo recorrido, mismo navegador.
(function () {
  const box = document.createElement("pre");
  box.style.cssText =
    "position:fixed;top:8px;left:8px;z-index:100000;margin:0;padding:6px 8px;" +
    "font:12px/1.4 monospace;color:#9f9;background:rgba(0,0,0,.7);" +
    "pointer-events:none;white-space:pre";
  document.body.appendChild(box);

  let frames = 0;
  let peor = 0;
  let ultimo = performance.now();
  let desde = ultimo;
  let largas = 0;
  let largasMs = 0;

  try {
    new PerformanceObserver((lista) => {
      for (const e of lista.getEntries()) {
        largas++;
        largasMs += e.duration;
      }
    }).observe({ entryTypes: ["longtask"] });
  } catch (e) {}

  function cuadroMedidor(ahora) {
    frames++;
    peor = Math.max(peor, ahora - ultimo);
    ultimo = ahora;
    if (ahora - desde >= 500) {
      const heap = performance.memory
        ? (performance.memory.usedJSHeapSize / 1048576).toFixed(1) + " MB"
        : "n/d";
      const escena = typeof currentSceneId === "string" ? currentSceneId : "?";
      box.textContent =
        "fps    " + ((frames * 1000) / (ahora - desde)).toFixed(0) +
        "\npeor   " + peor.toFixed(1) + " ms" +
        "\ntareas " + largas + " (" + Math.round(largasMs) + " ms)" +
        "\nheap   " + heap +
        "\nescena " + escena;
      frames = 0;
      peor = 0;
      desde = ahora;
    }
    requestAnimationFrame(cuadroMedidor);
  }
  requestAnimationFrame(cuadroMedidor);
})();
