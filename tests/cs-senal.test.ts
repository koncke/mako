// =============================================================================
// La señal de atención de Customer Success
// =============================================================================
// Decide QUÉ CLIENTE aparece primero en la pantalla y qué dice de él. Un error acá
// no se ve como un bug: se ve como un cliente al que nadie fue a buscar porque la
// tab decía que estaba al día.
//
// Los casos salen de MEDIR los tres workspaces con clientes ganados del producto el
// 26/09/2026 (ws1 14 · ws11 11 · ws13 2), no de imaginarlos:
//   · `fecha_cierre` está en los 27. Todo lo demás falta en alguno.
//   · ws11: WhatsApp de ayer en los 11, 301 entrantes, CERO sesiones, CERO proyectos
//     de cliente, 2 cuotas vencidas y 2 impagas SIN `fecha_esperada`.
//   · ws13: dos clientes cerrados el 24 y el 25/09 sin deal, sin cuotas, sin nada.
//   · ws1: 143 sesiones atadas, 3 cuotas vencidas, 9 proyectos con trabajo.
//
// LO QUE MÁS SE CUBRE ES EL «NO SE PUEDE SABER» (`nivel: null`), que es la falla más
// cara de este repo: un cliente sin datos pintado como un cliente sano.
//
// PROBADO ROMPIÉNDOLO (26/09/2026), que es lo único que distingue un test medido de
// una afirmación. Las cinco roturas, con el resultado EXACTO (base: 13 pases, 0 fallos):
//   1. `!c.tieneContrato → { nivel: null }` cambiado por `'bien'` →
//      **2 fallos, 11 pases** («sin contrato cargado no es estar bien» y el orden).
//   2. quitando el guard `c.contactoLeido` de la regla «nunca hablaron» →
//      **1 fallo, 12 pases**: una lectura caída de WhatsApp acusaba «cerró hace 40 días
//      y no hay una sola conversación» sobre un cliente que quizá habló ayer.
//   3. contando las impagas sin fecha como vencidas (`cuotasVencidas + sinFecha`) →
//      **1 fallo, 12 pases**: las 2 de ws11 no tienen `fecha_esperada` y no se pueden
//      declarar vencidas nunca.
//   4. en `conTrabajo`, un tablero ilegible resuelto a `{ abiertas: 0, atrasadas: 0 }`
//      en vez de `null` → **1 fallo, 12 pases**. Es la mentira tranquilizadora clásica:
//      «no pude leer el tablero» pintado como «no tiene nada atrasado».
//   5. el orden, poniendo «no lo sé» DESPUÉS de «al día» → **1 fallo, 12 pases**.
//
// ⚠️ Y UNA ROTURA QUE NO PROBÓ NADA, anotada para que nadie la repita: cambiar
// `c.tareasAtrasadas !== null && c.tareasAtrasadas > 0` por `(c.tareasAtrasadas ?? 0) > 0`
// dio **13 pases, 0 fallos**… porque las dos expresiones son equivalentes para
// `number | null`. No es que al test le faltara un caso: no había cambio de conducta que
// cazar. Una rotura que no cambia lo que el código hace no mide el test, mide nada — y
// leerla como «al test le falta cobertura» manda a escribir casos que no sirven.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { senalDe, conTrabajo, ordenCartera, UMBRALES, type HechosCliente, type Senal } from '../lib/cs-senal';

/** Un cliente del que se sabe TODO y no pasa nada: la línea de base. Cada caso
 *  cambia sólo lo suyo, así que lo que falle es lo que se tocó. */
const SANO: HechosCliente = {
  diasDesdeElCierre: 60,
  cobrosLeidos: true,
  cuotasVencidas: 0,
  cuotaVencidaDias: null,
  cuotasImpagasSinFecha: 0,
  contactoLeido: true,
  ultimoContactoHace: 3,
  ultimoContactoFue: 'whatsapp',
  esperaRespuestaHace: null,
  tieneContrato: true,
  contratoTerminado: false,
  tareasAbiertas: 4,
  tareasAtrasadas: 0,
};

const con = (x: Partial<HechosCliente>): HechosCliente => ({ ...SANO, ...x });

test('el que no tiene nada pendiente y se pudo mirar entero está BIEN', () => {
  const s = senalDe(SANO);
  assert.equal(s.nivel, 'bien');
  assert.equal(s.regla, 'al-dia');
});

test('la cuota vencida gana sobre todo lo demás, y dice los días', () => {
  // ws1: 3 vencidas. Es el único hecho duro y fechado que existe en los tres
  // workspaces, así que va primero aunque el cliente además esté callado.
  const s = senalDe(con({ cuotasVencidas: 1, cuotaVencidaDias: 9, ultimoContactoHace: 90 }));
  assert.equal(s.nivel, 'atencion');
  assert.equal(s.regla, 'cuota-vencida');
  assert.match(s.motivo, /9 días/);
});

test('una cuota impaga SIN fecha no es una cuota vencida: es «no lo sé»', () => {
  // ws11 tiene 2 así. Declararlas vencidas es inventarle una fecha al cobro; dejarlas
  // pasar como «al día» es decir que no debe nada. Ninguna de las dos es cierta.
  const s = senalDe(con({ cuotasImpagasSinFecha: 2 }));
  assert.equal(s.nivel, null);
  assert.equal(s.regla, 'sin-contrato');
  assert.match(s.motivo, /sin fecha/);
});

test('te escribió y nadie contestó: la señal viva fuera del ws1', () => {
  // ws11: 301 mensajes entrantes y el último de un ganado es de ayer. `from_me`
  // contesta quién habló último, y es lo más accionable de la pantalla.
  const s = senalDe(con({ esperaRespuestaHace: 3, ultimoContactoHace: 3 }));
  assert.equal(s.nivel, 'atencion');
  assert.equal(s.regla, 'sin-contestar');
});

test('el mensaje suyo de HOY no es un reclamo', () => {
  // Contestar el mismo día es lo normal. Marcar en rojo a quien escribió hace dos
  // horas es enseñarle a la persona a ignorar la pantalla.
  assert.equal(senalDe(con({ esperaRespuestaHace: 0, ultimoContactoHace: 0 })).nivel, 'bien');
  assert.equal(UMBRALES.DIAS_SIN_CONTESTAR, 2);
});

test('cerró hace meses y no hay una sola conversación', () => {
  const s = senalDe(con({ ultimoContactoHace: null, ultimoContactoFue: null, diasDesdeElCierre: 40 }));
  assert.equal(s.nivel, 'atencion');
  assert.equal(s.regla, 'nunca-hablaron');
});

test('si no se pudo LEER el contacto, no se afirma que no hablaron', () => {
  // ⚠️ Lo que caza la rotura 2. Una consulta caída devuelve la misma lista vacía que
  // un cliente con el que de verdad nadie habló.
  const s = senalDe(con({ contactoLeido: false, ultimoContactoHace: null, diasDesdeElCierre: 40 }));
  assert.equal(s.nivel, null);
  assert.equal(s.regla, 'sin-datos');
});

test('el cliente recién cerrado no está bien ni mal: es el día 1', () => {
  // Los dos de ws13 cerraron el 24 y el 25/09 sin deal, sin cuotas, sin sesiones y
  // sin WhatsApp. Ése es el estado normal de un cliente nuevo, no un problema.
  const s = senalDe(con({
    ultimoContactoHace: null, ultimoContactoFue: null, diasDesdeElCierre: 2,
    tieneContrato: false, tareasAbiertas: null, tareasAtrasadas: null,
  }));
  assert.equal(s.nivel, null);
  assert.equal(s.regla, 'recien-cerrado');
});

test('sin contrato cargado NO es estar bien', () => {
  // 6 de 14 en ws1, 1 de 11 en ws11, 2 de 2 en ws13 no tienen deal. Sin saber qué se
  // le vendió no hay con qué decir que la entrega va al día.
  const s = senalDe(con({ tieneContrato: false }));
  assert.equal(s.nivel, null);
  assert.equal(s.regla, 'sin-contrato');
});

test('el tablero ILEGIBLE no inventa atraso, y tampoco lo descarta', () => {
  // `null` = no se pudo leer o no hay cruce (ws11 y ws13 no tienen un solo proyecto
  // de cliente). No dispara la regla, y no tiene por qué. Lo que el `null` SÍ tiene que
  // impedir está en el test de `conTrabajo`: que un tablero ilegible se resuelva a 0.
  assert.equal(senalDe(con({ tareasAtrasadas: null, tareasAbiertas: null })).nivel, 'bien');
  const s = senalDe(con({ tareasAtrasadas: 3 }));
  assert.equal(s.nivel, 'atencion');
  assert.equal(s.regla, 'tareas-atrasadas');
});

test('la lista ordena por atención, después por «no lo sé», y al final lo que está bien', () => {
  // ES la pantalla: contesta «¿cuál necesita atención hoy?». El alfabeto no contesta
  // nada, y por eso el nombre sólo desempata.
  const hecho = (nombre: string, x: Partial<HechosCliente>) => {
    const h = con(x);
    return { ...h, leadId: nombre.length, nombre, senal: senalDe(h) };
  };
  const lista = [
    hecho('Al día', {}),
    hecho('Sin contrato', { tieneContrato: false }),
    hecho('Callado', { ultimoContactoHace: 45 }),
    hecho('Debe', { cuotasVencidas: 1, cuotaVencidaDias: 9 }),
  ].sort(ordenCartera);
  assert.deepEqual(lista.map((c) => c.nombre), ['Debe', 'Callado', 'Sin contrato', 'Al día']);
});

test('conTrabajo recalcula la señal y reordena; sin tablero deja «no lo sé»', () => {
  const base = (leadId: number, nombre: string) => {
    const h = con({ tareasAbiertas: null, tareasAtrasadas: null });
    return { ...h, leadId, nombre, senal: senalDe(h) };
  };
  const clientes = [base(1, 'Ana'), base(2, 'Beto')];

  // Con el tablero leído: Beto tiene dos tareas pasadas de fecha y sube.
  const conTablero = conTrabajo(clientes, { 2: { abiertas: 5, atrasadas: 2 } });
  assert.equal(conTablero[0].nombre, 'Beto');
  assert.equal(conTablero[0].senal.regla, 'tareas-atrasadas');
  // El que no está en el mapa tiene 0 (el tablero se leyó y no tiene nada), no null.
  assert.equal(conTablero[1].tareasAtrasadas, 0);
  assert.equal(conTablero[1].senal.nivel, 'bien');

  // Sin tablero (`null` = no se pudo leer): nadie sube y nadie afirma un 0.
  const sinTablero = conTrabajo(clientes, null);
  assert.equal(sinTablero.every((c) => c.tareasAtrasadas === null), true);
  assert.equal(sinTablero.every((c) => c.senal.regla !== 'tareas-atrasadas'), true);
});

test('un workspace SIN clientes no rompe nada', () => {
  // Es la pantalla que más se va a ver: la de alguien que todavía no ganó a nadie.
  const vacio: Array<HechosCliente & { leadId: number; nombre: string; senal: Senal }> = [];
  assert.deepEqual(conTrabajo(vacio, null), []);
  assert.deepEqual(conTrabajo(vacio, {}), []);
});
