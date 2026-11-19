/* Los datos del video que le pasa la pantalla de MaKo (app/ai-avatar/cubos) a esta plantilla.
 * La pantalla deja `window.__CUBOS[clave] = { tiempos, datos, personaje, voz }` y abre la plantilla con `#clave`: la plantilla
 * los lee de su página madre (es del mismo origen) ANTES de cargar el kit, que toma `window.TIEMPOS` al arrancar.
 * Sin datos (abierta sola) queda el ejemplo de la galería: `ejemplos/<id>.js` ya dejó su TIEMPOS.
 *   window.CUBOS = { datos, personaje, voz } — lo que cada plantilla lee con sus valores por defecto.
 */
(function () {
  var clave = decodeURIComponent((location.hash || '').slice(1));
  var d = null;
  try { if (clave && window.parent !== window && window.parent.__CUBOS) d = window.parent.__CUBOS[clave] || null; } catch (e) { d = null; }
  window.CUBOS = d || {};
  if (d && d.tiempos && d.tiempos.words && d.tiempos.anchors) window.TIEMPOS = d.tiempos;
})();
