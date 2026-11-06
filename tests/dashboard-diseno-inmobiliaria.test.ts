// =============================================================================
// La hoja «Inmobiliaria» con su DISEÑO PROPIO (la copia de Torque): de dónde sale cada número (lib/inmobiliaria-diseno.ts)
// =============================================================================
// Martín, 4/11/2026: «que sea primero la copia… y después la adaptación con Maco». La hoja la dibuja
// app/dashboard/disenos/HojaInmobiliaria.tsx con lo que arma `vistaInmobiliaria` de las piezas de la hoja (los interesados del CRM).
// Estos tests EJECUTAN esas funciones con datos armados aquí (ficticios) y miran lo que sale; sólo el último lee el fuente (el
// cableado).
//
// Probado rompiéndolo (6/11/2026), cada rotura sola y la base en verde antes y después (17 de 17):
//   · un cambio de cero puntos pintado bueno o malo: 1 fallo, 10 pases;
//   · el chip al revés (sube = malo): 1 fallo, 10 pases;
//   · los días que no llegaron como 0: 2 fallos, 9 pases;
//   · un proyecto vacío ocupando una bahía: 1 fallo, 10 pases;
//   · la compra sin tope y sin visitas como 0: 1 fallo, 10 pases;
//   · el total de proyectos sin los que el límite dejó afuera: 1 fallo, 10 pases;
//   · «(sin dato)» como asesor de una tarjeta: 2 fallos, 9 pases;
//   · las tarjetas sin las que compraron primero: 1 fallo, 10 pases;
//   · una etapa vacía ocupando una columna: 1 fallo, 10 pases (con la primera versión del test daba 0: se sumó el caso);
//   · la parte de lo que tiene dato, no del total de la pieza: 1 fallo, 10 pases;
//   · las semanas al revés: 1 fallo, 10 pases;
//   · las barras de los asesores sin relativizar: 1 fallo, 10 pases;
//   · el medidor sin interesados: 1 fallo, 10 pases;
//   · la hoja vacía sin saber cuántos entraron: 1 fallo, 10 pases;
//   · «Los que avanzan» con el que no hizo nada: 2 fallos, 9 pases;
//   · «Los que avanzan» sin los que compraron primero: 1 fallo, 10 pases;
//   · el tablero sin el asesor en la plantilla: 1 fallo, 10 pases.
