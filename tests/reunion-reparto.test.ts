// =============================================================================
// «Ni siquiera existe la tab de Mau»: clasificar y poder mandar son dos preguntas
// =============================================================================
// 12/8/2026. El dueño, sobre la reunión «Mau <> Martin: CUSTOMER SUCCESS»: «como la
// funcionalidad de extraer las tareas falló completamente… me está poniendo tareas a mí
// que deberían ser de Mau, ni siquiera existe la tab de Mau».
//
// LA EXTRACCIÓN NO FALLÓ, y ese es el punto de este archivo. El cache de esa misma
// corrida (`mako.fathom.cache.172397528`, escrito 13 segundos antes del borrador) tiene
// las 26 tareas de Mauricio con `esDeOtro: true` Y con su email real. El modelo acertó,
// `resolverDueño` acertó, y después un gate río abajo borró el resultado:
//
//     esDeOtro: t.esDeOtro && repartible(t.dueñoEmail) ? true : undefined
//
// `repartible` preguntaba «¿este email está en MI workspace?». Mauricio ES usuario de la
// app —vive en el workspace 1 y el borrador se armó en el 9—, así que dio false y se
// fueron los dos campos: el que dice a dónde escribirle Y el que dice de quién es.
//
// El comentario que estaba justo arriba decía lo correcto: «el nombre se conserva SIEMPRE
// (es información de la reunión); lo que se corta es el reparto». La línea de abajo
// cortaba las dos cosas.
//
// Estos tests existen porque `lib/reunion-auto.ts` no tiene NI UNO: la lógica vivía
// inline adentro de una función de 200 líneas marcada `server-only`, y por eso el bug no
// lo cazó nadie. Es la misma lección de julio (extraer `tarea-dueno.ts` para poder
// probarlo) sin aplicar al eslabón siguiente.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emailsConCuenta, repartoDeTarea, cuantasSonMias, resumenDelReparto, tipoDeResponsable } from '../lib/reunion-reparto';

/** Los usuarios reales, tal cual están hoy en la base. */
const USUARIOS = [
  { email: 'martinkoncke@gmail.com', workspace_id: '9', rol: 'admin' },
  { email: 'mbustos@elevate.com.mx', workspace_id: '1', rol: 'usuario' },
  { email: 'hola@leilafittipaldi.com', workspace_id: '11', rol: 'usuario' },
];
const CON_CUENTA = emailsConCuenta(USUARIOS);

const DE_MAU = { dueño: 'Mauricio Bustos Eguia', dueñoEmail: 'mbustos@elevate.com.mx', esDeOtro: true };
const MIA = { dueño: 'Martin Koncke', dueñoEmail: '', esDeOtro: false };

test('EL CASO REAL: las 26 de Mau siguen siendo de Mau aunque su tablero viva en otro workspace', () => {
  // El gate viejo pedía `workspace_id === ws || rol === 'admin'` con ws = 9. Mauricio es
  // ws 1 y usuario: quedaba afuera y perdía la clasificación Y el email.
  const r = repartoDeTarea(DE_MAU, CON_CUENTA);
  assert.equal(r.esDeOtro, true, 'sin esto no se crea la tab de Mau');
  assert.equal(r.duenoEmail, 'mbustos@elevate.com.mx');
  assert.equal(r.repartible, true);
  assert.equal(r.dueno, 'Mauricio Bustos Eguia');
});

test('SIN CUENTA se pierde el botón de mandársela, nunca el «es de otro»', () => {
  // La regla entera, en una línea. Alguien de afuera de la app —un cliente en una junta,
  // un proveedor— igual asumió un compromiso: va a su tab, con su nombre, y el dueño lo
  // ve y decide. Lo único que falta es a dónde escribirle.
  const deAfuera = { dueño: 'Yolanda Pérez', dueñoEmail: 'yolanda@otraempresa.com', esDeOtro: true };
  const r = repartoDeTarea(deAfuera, CON_CUENTA);
  assert.equal(r.esDeOtro, true, 'la clasificación NO depende de si le podemos escribir');
  assert.equal(r.dueno, 'Yolanda Pérez', 'el nombre es información de la reunión: va siempre');
  assert.equal(r.duenoEmail, undefined);
  assert.equal(r.repartible, undefined);
});

test('sin NINGÚN email tampoco se pierde: una tarea de otro sin mail sigue siendo de otro', () => {
  const r = repartoDeTarea({ dueño: 'Alguien de la junta', esDeOtro: true }, CON_CUENTA);
  assert.equal(r.esDeOtro, true);
  assert.equal(r.repartible, undefined);
});

test('una tarea mía no se vuelve repartible por tener email al lado', () => {
  assert.equal(repartoDeTarea(MIA, CON_CUENTA).esDeOtro, undefined);
  assert.equal(repartoDeTarea(MIA, CON_CUENTA).repartible, undefined);
  assert.equal(repartoDeTarea({ ...MIA, dueñoEmail: 'martinkoncke@gmail.com' }, CON_CUENTA).repartible, undefined);
});

test('si la consulta de usuarios falla, se pierde el reparto y NO la propiedad', () => {
  // El default importa más que el camino feliz: la falla del 12/8 fue exactamente que un
  // problema de reparto se leyó como un problema de propiedad. Con la lista vacía nadie
  // es repartible, y aun así las 26 siguen siendo de Mau.
  const sinNadie = emailsConCuenta([]);
  const r = repartoDeTarea(DE_MAU, sinNadie);
  assert.equal(r.esDeOtro, true);
  assert.equal(r.repartible, undefined);
  assert.equal(r.duenoEmail, undefined);
});

test('el email se compara sin mayúsculas ni espacios: Fathom los manda como vengan', () => {
  const r = repartoDeTarea({ ...DE_MAU, dueñoEmail: '  MBustos@Elevate.com.MX ' }, CON_CUENTA);
  assert.equal(r.repartible, true);
  assert.equal(r.duenoEmail, 'mbustos@elevate.com.mx');
});

test('un usuario sin email en la base no habilita a repartirle a nadie', () => {
  // `emailsConCuenta` filtra vacíos: sin esto, un `duenoEmail` vacío matchearía con la
  // fila incompleta y se «repartiría» al aire.
  const conRoto = emailsConCuenta([{ email: null }, { email: '  ' }, { email: 'ok@x.com' }]);
  assert.equal(conRoto.size, 1);
  assert.equal(repartoDeTarea({ dueño: 'X', dueñoEmail: '', esDeOtro: true }, conRoto).repartible, undefined);
});

// ---------------------------------------------------------------------------
// El resumen, que confirmaba el bug en vez de delatarlo
// ---------------------------------------------------------------------------

test('EL AVISO YA NO MIENTE: 11 tuyos y 26 de otros, no 37 tuyos', () => {
  // Decía «sacó 37 compromisos tuyos» porque `mias` se contaba DESPUÉS de que el gate
  // borrara `esDeOtro`. El dueño leyó ese aviso y le confirmó lo que estaba mal.
  const reparto = [
    ...Array.from({ length: 26 }, () => repartoDeTarea(DE_MAU, CON_CUENTA)),
    ...Array.from({ length: 11 }, () => repartoDeTarea(MIA, CON_CUENTA)),
  ];
  assert.equal(cuantasSonMias(reparto), 11);
  assert.equal(resumenDelReparto(reparto), '11 compromisos tuyos y 26 de otras personas');
});

test('el resumen no dice «y 0 de otras personas», ni pluraliza mal con una sola', () => {
  const solaMia = [repartoDeTarea(MIA, CON_CUENTA)];
  assert.equal(resumenDelReparto(solaMia), '1 compromiso tuyo');
  const solaDeOtro = [repartoDeTarea(DE_MAU, CON_CUENTA)];
  assert.equal(resumenDelReparto(solaDeOtro), '1 compromiso de otras personas');
  assert.equal(resumenDelReparto([]), '0 compromisos tuyos');
});

// ── Tablero único (08-T45): de las que no son mías, ¿cliente o tercero? ──
// PROBADO ROMPIÉNDOLO (17/9): con `tipoDeResponsable` devolviendo siempre 'cliente' para
// lo ajeno → 2 de 4 en rojo (el de Martín con cuenta y el de la reunión sin cliente).

test('lo mío es «mío» aunque la reunión sea con un cliente', () => {
  assert.equal(tipoDeResponsable({ esDeOtro: false }, true), 'mio');
  assert.equal(tipoDeResponsable({}, false), 'mio');
});

test('alguien con cuenta en la app es equipo o proveedor: tercero, aunque la reunión sea con un cliente', () => {
  // Martín en la junta de entrega de Mauricio con su cliente: «me debe Martín», no «me debe el cliente».
  const t = repartoDeTarea({ dueño: 'Martin', dueñoEmail: 'martin@x.com', esDeOtro: true }, emailsConCuenta([{ email: 'martin@x.com' }]));
  assert.equal(tipoDeResponsable(t, true), 'tercero');
});

test('sin cuenta en una reunión CON cliente → del cliente', () => {
  const t = repartoDeTarea({ dueño: 'Laura (cliente)', dueñoEmail: 'laura@cliente.com', esDeOtro: true }, emailsConCuenta([{ email: 'martin@x.com' }]));
  assert.equal(tipoDeResponsable(t, true), 'cliente');
});

test('sin cuenta en una reunión SIN cliente → tercero: no se inventa un cliente que no había', () => {
  const t = repartoDeTarea({ dueño: 'El contador', esDeOtro: true }, emailsConCuenta([]));
  assert.equal(tipoDeResponsable(t, false), 'tercero');
});
