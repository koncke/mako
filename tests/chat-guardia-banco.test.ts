// =============================================================================
// El guardia de «hecho» del chat de la app, medido con un BANCO de frases reales (21/10/2026, la tercera revisión)
// =============================================================================
// Las frases son las de la revisión de ola1-guardia (revision-ola1-guardia-21-10.md, 77 frases y 8 mixtas; clases del
// revisor) más algunas propias. Cada una corre en 4 variantes (con y sin respaldo, con y sin herramientas). La meta, que
// decidió el Cerebro (precisión antes que cobertura):
//   1. 0 oraciones borradas, en ninguna variante;
//   2. 0 notas en una respuesta que no afirma nada (clase N) o que da un dato (clase D);
//   3. 0 respuestas con dos notas.
// Lo que se escapa (una afirmación de hecho sin nota) es un NÚMERO, no un defecto: está en `MEDIDO`, y el test sólo pide
// que no baje.
//
// Probado rompiéndolo (21/10/2026, con la base en 0 fallos):
//   · (la séptima revisión) el «:» entre paréntesis no presenta, como en la sexta → 1 fallo (2); el «:» pegado a una letra
//     o a «)» no presenta, como en la sexta → 1 fallo (2); el pegado a un dígito o a «/» presenta (10:30, https:) → 1 fallo
//     (4, la cobertura bajó);
//   · (la sexta revisión) el «:» presenta sólo con espacio, salto o cita, como antes → 2 fallos (2 y 3b); sin
//     `bloquesDebajo` → 1 fallo (3b); el turno sin pasarlo → 1 fallo (3b);
//   · (la quinta revisión) la promesa juzgada sin lo citado, como antes → 1 fallo (2); sin el «:» en la promesa → 1 fallo
//     (2); lo que exime mirado sin la cita → 1 fallo (2); cualquier «:» presenta, como antes → 2 fallos (3 y 4); el «:»
//     entre paréntesis presenta → 1 fallo (4); el «:» que cierra el mensaje presenta → 2 fallos (3 y 4); sólo el «:» con
//     salto de línea o cita, sin «: » + contenido → 1 fallo (2: «Hice la cuenta: con 14 leads…» llevaría nota);
//   · (la cuarta revisión) sin sacar lo citado → 1 fallo (2); sin mirar la condición → 1 fallo (2); sin el «:» → 1 fallo (2);
//     la promesa en cualquier oración, como antes → 1 fallo (2); la nota de promesa con respaldo → 1 fallo (3); la
//     grosería con el mínimo de 15 letras → 1 fallo (3);
//   · el camino de promesas borrando otra vez en la app → 3 fallos (1, 3 y 4);
//   · un pretérito sin tilde en la lista («cargue», que también es subjuntivo) → 1 fallo (2);
//   · sin mirar la negación → 1 fallo (2);
//   · las dos notas a la vez → 2 fallos (3 y 4);
//   · sin `ACABO_DE` → 1 fallo (4, la cobertura bajó).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { NOTA_SIN_HACER, NOTA_SIN_RESPALDO, sanearSalida } from '../lib/doer-salida';

type Clase = 'H' | 'N' | 'D';
// clase: 'H' = afirma que MaKo lo hizo; 'N' = no afirma nada hecho por MaKo; 'D' = dato de estado (no de MaKo).
const FRASES: Array<[string, Clase]> = [
  ['Listo, ya moví a Juan a Ganado.', 'H'],
  ['Ya está programado para el martes a las 10.', 'H'],
  ['Listo, ya te agendé la reunión con Ana para el jueves a las 15.', 'H'],
  ['Le mandé el WhatsApp a Juan con el link de la reunión.', 'H'],
  ['Moví a Juan a Ganado y le mandé el mensaje de bienvenida.', 'H'],
  ['Ya lo hice antes, quedó así.', 'H'],
  ['Cancelé la reunión con Pedro.', 'H'],
  ['Listo, la cancelé.', 'H'],
  ['Ya la cancelé.', 'H'],
  ['Te creé la automatización de seguimiento.', 'H'],
  ['Acabo de cargar las 3 tareas en el plan.', 'H'],
  ['Hecho, quedó cargado el pago de USD 300.', 'H'],
  ['Listo: pausé la campaña de Meta.', 'H'],
  ['Ya pausé la campaña.', 'H'],
  ['Ya está hecho.', 'H'],
  ['Ya quedó.', 'H'],
  ['Quedó todo listo para el lanzamiento.', 'H'],
  ['Le envié el presupuesto a María por mail.', 'H'],
  ['Agendé la llamada con Carlos para mañana a las 11.', 'H'],
  ['Ya le escribí a Juan.', 'H'],
  ['Te lo dejé listo para que lo confirmes.', 'H'],
  ['Te dejé la tarjeta para que la confirmes.', 'H'],
  ['Ya lo agendamos para el viernes.', 'H'],
  ['Reprogramé la reunión para el lunes a las 9.', 'H'],
  ['Sí, ya te la agendé.', 'H'],
  ['Ya se lo mandé a Juan.', 'H'],
  ['¡Listo! Le mandé el WhatsApp a Juan.', 'H'],
  ['Marqué la tarea como hecha.', 'H'],
  ['Ya respondí al lead.', 'H'],
  ['Ya confirmé la reunión con Ana.', 'H'],
  ['Eliminé el lead duplicado.', 'H'],
  ['Listo, actualicé el teléfono de Juan.', 'H'],
  ['Ya te armé el informe semanal: lo tenés en el Dashboard.', 'H'],
  ['Listo, Juan ya está en Ganado.', 'H'],
  ['Ya quedó agendada la reunión con Ana.', 'H'],
  ['Ya te dejé agendada la reunión con Ana.', 'H'],
  // (la quinta revisión) El «:» de una hora, un link, un emoticón o un paréntesis no presenta nada.
  ['Ya te agendé la reunión con Pedro el viernes a las 11:00.', 'H'],
  ['Le mandé el WhatsApp a Juan a las 10:30.', 'H'],
  ['Le mandé el link https://meet.google.com/abc a Juan.', 'H'],
  ['Listo, ya te agendé la reunión :)', 'H'],
  ['Moví a Juan a Ganado (estado: cerrado).', 'H'],
  ['Listo, ya moví a Juan a Ganado:', 'H'],
  // No afirman nada hecho por MaKo
  ['¿Querés que te mande el resumen por WhatsApp?', 'N'],
  ['¿Querés que te agende la reunión con Ana el jueves a las 15?', 'N'],
  ['Si querés que te cambie el horario, decime cuál te queda mejor.', 'N'],
  ['Para que te cree la automatización necesito saber qué día querés que salga.', 'N'],
  ['Todavía no te mandé nada: falta que confirmes la tarjeta de abajo.', 'N'],
  ['No te agendé la reunión porque Ana no tiene email cargado.', 'N'],
  ['No pude cancelarla: esa acción ya estaba resuelta.', 'N'],
  ['Para mover un lead, entrá al CRM y arrastralo a la columna que quieras.', 'N'],
  ['Tenés 12 leads en Seguimiento y 3 en Ganado esta semana.', 'N'],
  ['Juan está en Seguimiento desde el lunes; su último mensaje fue ayer.', 'N'],
  ['La reunión con Ana está agendada para el martes a las 10.', 'N'],
  ['¿Te la agendo para el martes a las 10?', 'N'],
  ['Cuando quieras que te programe un envío, avisame el día y la hora.', 'N'],
  ['Hola Martín, ¿en qué te ayudo hoy?', 'N'],
  ['Para que te cargue los leads, pasame el CSV.', 'N'],
  ['Si querés que te arme el informe semanal, decime de qué fechas.', 'N'],
  ['Esa automatización la armó tu equipo el lunes; está activa.', 'N'],
  ['Te explico: una automatización manda un mensaje cuando un lead entra a una etapa.', 'N'],
  ['¿Querés que te envíe el link de la landing?', 'N'],
  ['Necesito que me confirmes el horario antes de que te agende nada.', 'N'],
  ['Perfecto, cualquier cosa te aviso.', 'N'],
  ['Si querés, te armo un borrador del mensaje.', 'N'],
  ['Para pausar una campaña tenés que ir a Ads Manager y tocar el interruptor.', 'N'],
  ['¿Te mando el link?', 'N'],
  ['Te paso el resumen: 5 leads nuevos, 2 reuniones agendadas y 1 venta.', 'N'],
  ['Ok, no hago nada entonces. Avisame si cambiás de idea.', 'N'],
  ['Para que la tarea te quede, confirmá la tarjeta. Así no te cargue nada que no quieras.', 'N'],
  ['¿Prefieres que te deje la reunión a las 10 o a las 11? Decime y la armo.', 'N'],
  ['Antes de que te borre algo, confirmame cuál de los dos Juan es.', 'N'],
  ['Si te parece bien, te dejo la tarjeta para confirmar.', 'N'],
  ['Te dejé la tarjeta en el mensaje anterior: confirmala cuando puedas.', 'N'],
  ['¿Quieres que te arme la automatización de bienvenida?', 'N'],
  ['Te armé la propuesta: confírmala abajo cuando quieras.', 'N'],
  // (la cuarta revisión) Lo que NO es de MaKo: citas, borradores, copys; y lo condicional.
  ['Juan te respondió: «Ya te mandé el comprobante, fíjate.»', 'N'],
  ['María escribió en el grupo: «Confirmé la reunión del jueves».', 'N'],
  ['Pedro dijo: «Cancelé la llamada del viernes porque viajo.»', 'N'],
  ['Cuando el lead escribe «ya te envié el comprobante», la automatización lo pasa a Pagado.', 'N'],
  ['Si ya te mandé el link, ignora este mensaje.', 'N'],
  ['Mensaje de seguimiento: «Hola Ana, ya te agendé la llamada para el jueves.»', 'N'],
  ['Te propongo este mensaje para Juan: «Hola Juan, te mandé el link de la reunión. Nos vemos el jueves.»', 'N'],
  ['Juan escribió ayer: “Ya hice la transferencia, avísame si llegó.”', 'N'],
  ['Te dejo este copy para el anuncio: "Hace 6 meses armé mi primer funnel y vendí 3 lugares."', 'N'],
  ['Esto escribió Ana:\n> Envié el formulario el lunes.\n> ¿Lo recibiste?', 'N'],
  // (la quinta revisión) Lo que exime se mira con la cita: el copy está a la vista.
  ['Te escribí un mensaje para Juan «Hola Juan, ¿cómo va todo?» que puedes copiar.', 'N'],
  ['Te armé el copy «¿Cansado de perder leads?» para el anuncio.', 'N'],
  ['Te armé el asunto del mail «No pierdas más leads».', 'N'],
  ['Te dejé armado el mensaje «Hola Ana, confirmame si te sirve el jueves».', 'N'],
  ['Te armé el guion «Hola, ¿tienes 2 minutos?» para que tu closer lo use.', 'N'],
  // (la cuarta revisión) Lo que se cumple en el mismo mensaje, o es una oferta: no es una promesa pendiente.
  ['Déjame ver... Juan está en Seguimiento desde el lunes y no respondió el último mensaje.', 'N'],
  ['Dame un segundo… Sí: tienes 3 reuniones esta semana.', 'N'],
  ['Voy a armar un ejemplo rápido:\n1. Hola Ana, ¿cómo va todo?\n2. ¿Pudiste ver lo que te mandé?', 'N'],
  ['En cuanto me pases el CSV, voy a cargar los leads.', 'N'],
  ['Si me dices que sí, voy a crear la automatización de bienvenida.', 'N'],
  ['Si quieres, voy a armarte un borrador del mensaje.', 'N'],
  // (la quinta revisión) Lo citado, o lo que va después del «:», cumple la promesa. La primera es la de la v2, tal cual.
  ['Voy a armar un ejemplo rápido:\n«Hola Ana, ¿te viene bien el jueves a las 15?»', 'N'],
  ['Voy a armarte un borrador para Juan:\n\n«Hola Juan, te escribo por la propuesta. Cualquier duda, acá estoy.»', 'N'],
  ['Voy a crear un ejemplo de mensaje:\n"Hola Ana, te escribo por la reunión del jueves."', 'N'],
  ['Déjame armar un ejemplo:\n\n> Hola Ana, te escribo por la reunión del jueves.', 'N'],
  ['Déjame armar un ejemplo para Ana.\n\n> Hola Ana, te escribo por la reunión del jueves.', 'N'],
  ['Déjame preparar el mensaje para Juan: «Hola Juan, te escribo por la propuesta.»', 'N'],
  ['Déjame ver: tienes 3 reuniones esta semana.', 'N'],
  ['A ver, déjame revisar: Juan está en Seguimiento desde el lunes.', 'N'],
  // (la cuarta revisión) Lo que presenta, en el mismo mensaje, lo que hizo: está a la vista.
  ['Te armé un resumen de la semana:\n- 5 leads nuevos\n- 2 reuniones agendadas', 'N'],
  ['Te escribí tres versiones del copy:\n1. Versión corta\n2. Versión larga\n3. Versión con pregunta', 'N'],
  ['Hice la cuenta: con 14 leads y 3 ventas, tu conversión es del 21 %.', 'N'],
  ['Como te mandé arriba, el link de la reunión es el mismo.', 'N'],
  // (la sexta revisión) Lo mismo con el formato del Ops Center, que pide negritas: el «:» sigue presentando.
  ['**Hice la cuenta:** con 14 leads y 3 ventas, tu conversión es del 21 %.', 'N'],
  ['**Te armé un resumen de la semana:**\n- 5 leads nuevos\n- 2 reuniones agendadas', 'N'],
  ['Te escribí **tres versiones del copy:**\n1. Versión corta\n2. Versión larga\n3. Versión con pregunta', 'N'],
  ['*Te armé este resumen:*\n- 5 leads nuevos\n- 2 reuniones agendadas', 'N'],
  ['Te armé un resumen:👇\n- 5 leads nuevos\n- 2 reuniones agendadas', 'N'],
  ['Uf, perdón la demora :( Te armé el resumen igual:\n- 5 leads nuevos', 'N'],
  ['Perdón la demora :( Te armé el resumen igual: 5 leads nuevos y 2 reuniones :)', 'N'],
  ['**Déjame ver:** tienes 3 reuniones esta semana.', 'N'],
  // (la séptima revisión) El «:» entre paréntesis, el de un emoticón y el pegado a una palabra también presentan.
  ['Hice la cuenta (conversión: 21 %).', 'N'],
  ['Te armé el resumen de la semana (leads: 5, reuniones: 2).', 'N'],
  ['**Te armé el resumen** (leads: 5, reuniones: 2)', 'N'],
  ['Te armé el resumen :)\n- 5 leads nuevos\n- 2 reuniones', 'N'],
  ['Hice la cuenta :D tu conversión es del 21 %.', 'N'],
  ['Te escribí el filtro `etapa:ganado` para que lo pegues en el buscador.', 'N'],
  ['Hice la cuenta:con 14 leads y 3 ventas, tu conversión es del 21 %.', 'N'],
  // Datos de estado (lo que hay en el CRM)
  ['Juan quedó agendado ayer por tu closer.', 'D'],
  ['Esta semana quedaron cargados 8 leads nuevos desde Meta.', 'D'],
  ['Tu landing del webinar está publicada desde el lunes.', 'D'],
];

/** Las mixtas de la revisión: una verdad respaldada con una oferta, y un hecho con una tarjeta. */
const MIXTAS: Array<{ texto: string; corrio: boolean; respaldado: boolean; nota: string | null }> = [
  { texto: 'Sí, ya te la agendé. Cualquier cosa te aviso.', corrio: false, respaldado: true, nota: null },
  { texto: 'Sí, ya te la agendé y te aviso si Ana la mueve.', corrio: false, respaldado: true, nota: null },
  { texto: 'Sí, ya te cargué las 3 tareas. Si querés, te armo el resumen de la semana.', corrio: false, respaldado: true, nota: null },
  { texto: 'Listo, te dejé la reunión con Ana para confirmar. También te mandé el resumen por mail.', corrio: true, respaldado: false, nota: NOTA_SIN_RESPALDO },
  { texto: 'Ya te creé la automatización. Déjame ver si hay algo más.', corrio: false, respaldado: false, nota: NOTA_SIN_RESPALDO },
  { texto: 'Listo, ya moví a Juan a Ganado. Cualquier cosa te aviso.', corrio: false, respaldado: false, nota: NOTA_SIN_RESPALDO },
  { texto: 'Déjame ver el plan y te cuento cómo viene la semana.', corrio: false, respaldado: false, nota: NOTA_SIN_HACER },
  { texto: 'Déjame ver el plan y te cuento cómo viene la semana.', corrio: true, respaldado: false, nota: null },
  // (la cuarta revisión) Con respaldo, ninguna nota de promesa al lado de la verdad.
  { texto: 'Sí, ya te la agendé. Dame un segundo y te paso el link de Meet.', corrio: false, respaldado: true, nota: null },
  { texto: 'Perfecto, ya pausé la campaña de Meta. Déjame ver si hay otra activa.', corrio: false, respaldado: true, nota: null },
  // (la quinta revisión) La promesa que NO presenta nada sigue llevando su nota.
  { texto: 'Voy a revisar tu plan:', corrio: false, respaldado: false, nota: NOTA_SIN_HACER },
  { texto: 'Voy a revisar el plan «Lanzamiento».', corrio: false, respaldado: false, nota: NOTA_SIN_HACER },
];

const VARIANTES = [
  { nombre: 'sin respaldo, sin herramientas', corrioHerramientas: false, hecho: { respaldado: false } },
  { nombre: 'con respaldo, sin herramientas', corrioHerramientas: false, hecho: { respaldado: true } },
  { nombre: 'sin respaldo, con herramientas', corrioHerramientas: true, hecho: { respaldado: false } },
  { nombre: 'con respaldo, con herramientas', corrioHerramientas: true, hecho: { respaldado: true } },
];
const NOTAS = [NOTA_SIN_RESPALDO, NOTA_SIN_HACER];
const sinNotas = (t: string) => NOTAS.reduce((x, n) => x.replace(`\n\n${n}`, ''), t);
const cuantasNotas = (t: string) => NOTAS.reduce((k, n) => k + (t.split(n).length - 1), 0);

/**
 * Lo medido el 21/10/2026: de las H, cuántas llevan nota sin respaldo. Sólo puede subir. 26 en 08dc4ce9f; 25 desde la cuarta
 * revisión, a propósito: «Ya te armé el informe semanal: lo tenés en el Dashboard.» presenta con «:» y ya no se marca. 31 de
 * 42 desde la quinta: las 6 del «:» que no presenta (hora, link, emoticón, paréntesis, el último) llevan nota. 30 de 42 desde
 * la séptima, a propósito (precisión antes que cobertura): el «:» entre paréntesis vuelve a presentar, como en producción,
 * y «Moví a Juan a Ganado (estado: cerrado).» ya no se marca.
 * Fuera del banco, la revisión midió que el «Hecho» de otra cosa respalda 25 de 30 pedidos NUEVOS que el clasificador no
 * ve como pedido: es cobertura, y queda como número.
 */
const MEDIDO = { conNota: 30, de: 42 };

test('1. ninguna oración se borra, en ninguna variante', () => {
  const borradas: string[] = [];
  for (const [f] of FRASES) for (const v of VARIANTES) if (sinNotas(sanearSalida(f, v).texto) !== f) borradas.push(`${v.nombre}: ${f}`);
  for (const m of MIXTAS) if (sinNotas(sanearSalida(m.texto, { corrioHerramientas: m.corrio, hecho: { respaldado: m.respaldado } }).texto) !== m.texto) borradas.push(m.texto);
  assert.deepEqual(borradas, []);
});

test('2. ninguna nota en lo que no afirma nada ni en un dato', () => {
  const conNota: string[] = [];
  for (const [f, c] of FRASES) if (c !== 'H') for (const v of VARIANTES) if (cuantasNotas(sanearSalida(f, v).texto)) conNota.push(`${v.nombre}: ${f}`);
  assert.deepEqual(conNota, []);
});

test('3. nunca dos notas, y las mixtas llevan la que les toca', () => {
  // La grosería se saca y lo demás queda, aunque sea corto (la cuarta revisión).
  assert.equal(sanearSalida('Sí, ya te la agendé. ¡Qué cagada lo de Pedro!', { corrioHerramientas: false, hecho: { respaldado: true } }).texto, 'Sí, ya te la agendé.');
  for (const [f] of FRASES) for (const v of VARIANTES) assert.ok(cuantasNotas(sanearSalida(f, v).texto) <= 1, f);
  for (const m of MIXTAS) {
    const r = sanearSalida(m.texto, { corrioHerramientas: m.corrio, hecho: { respaldado: m.respaldado } }).texto;
    assert.equal(r, m.nota ? `${m.texto}\n\n${m.nota}` : m.texto, m.texto);
  }
});

test('3b. lo dibujado debajo del texto: el «:» final lo presenta (la sexta revisión)', () => {
  const sin = { corrioHerramientas: true, hecho: { respaldado: false } };
  for (const f of ['Te armé un gráfico con tus leads por etapa:', 'Armé la tabla de tus ventas del mes:']) {
    assert.equal(sanearSalida(f, { ...sin, bloquesDebajo: true }).texto, f, 'con la tabla debajo, sin nota');
    assert.equal(sanearSalida(f, sin).texto, `${f}\n\n${NOTA_SIN_RESPALDO}`, 'sin nada debajo, el «:» final no presenta');
  }
  // Y el turno se lo dice: lo que dibujó, la pregunta y las tarjetas van debajo del texto.
  const turno = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'lib/mako-turno-app.ts'), 'utf8');
  assert.match(turno, /bloquesDebajo: dibujos\.length > 0 \|\| !!pregunta \|\| propuestas\.length > 0 \|\| pantallas\.length > 0,/);
});

test('4. lo que se escapa es un número, y no baja', () => {
  const h = FRASES.filter(([, c]) => c === 'H');
  const conNota = h.filter(([f]) => sanearSalida(f, VARIANTES[0]).texto.endsWith(NOTA_SIN_RESPALDO));
  assert.equal(h.length, MEDIDO.de);
  assert.ok(conNota.length >= MEDIDO.conNota, `llevan nota ${conNota.length} de ${h.length} (medido: ${MEDIDO.conNota})`);
  // Con respaldo, ninguna afirmación lleva nota.
  assert.ok(h.every(([f]) => !sanearSalida(f, VARIANTES[1]).texto.includes(NOTA_SIN_RESPALDO)));
});
