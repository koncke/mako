// =============================================================================
// Ante una falla, MaKo en el grupo ofrece el ticket y dice la causa si la sabe (27/10/2026, P3; lib/doer-falla.ts)
// =============================================================================
// Leila (26/10): cuatro intentos de «analizar la llamada de fathom» → MaKo: «puede deberse a un problema con la grabación».
// La causa era su Claude sin crédito (MaKo lo había avisado a las 15:31). Ella: «y tú eres el servicio técnico».
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { bloqueDeLaFalla, causaDelCartel, clavesQueFallan, conLaLineaDelTicket, corrigeUnMonto, HERRAMIENTAS_CORRECCION, laCorreccion, pideVerAgenda, reportaFalla, TICKET_DE_LA_FALLA } from '../lib/doer-falla';
import { sacarNoPude } from '../lib/no-pude';
import type { EstadoSuClave } from '../lib/su-clave-reglas';
import { RELEVANCIA_AGENDA, type VeredictoIntencion } from '../lib/mako-intencion';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const AHORA = Date.parse('2026-10-26T19:00:00Z');

test('1. las frases de Leila son un reporte de falla; un pedido o una pregunta, no', () => {
  for (const f of [
    'no puede analizar la llamada de fathom', 'ya van 4 veces, tras 4 intentos sigue igual', 'y tú eres el servicio técnico',
    'no me deja agendar', 'sigue sin funcionar', 'dejó de andar el CRM', 'me da error al publicar', 'se colgó la app',
    // De vos también: por esto los detectores viven en lib/doer-falla-frases.ts, fuera de la guarda de voseo.
    'vos sos el soporte, ¿no?',
  ]) assert.ok(reportaFalla(f), `«${f}» no se ve como falla`);
  for (const f of ['¿cuántos leads entraron esta semana?', 'pasale la segunda para mañana', 'gracias MaKo', 'publicá la del webinar'])
    assert.ok(!reportaFalla(f), `«${f}» se ve como falla`);
});

test('2. la causa: su IA que viene fallando se dice primero; la que falló y después anduvo, no', () => {
  const claude: EstadoSuClave = { proveedor: 'anthropic', anduvo: '2026-10-26T14:00:00Z', fallo: { at: '2026-10-26T15:31:00Z', motivo: 'credit balance is too low' }, gastado: 3.2 };
  const gpt: EstadoSuClave = { proveedor: 'openai', anduvo: '2026-10-26T18:00:00Z', fallo: { at: '2026-10-25T10:00:00Z', motivo: '429' }, gastado: 0 };
  assert.deepEqual(clavesQueFallan([claude, gpt]).map((e) => e.proveedor), ['anthropic']);
  const b = bloqueDeLaFalla([claude, gpt], AHORA);
  assert.match(b, /^LA PERSONA TE CUENTA QUE ALGO NO ANDA\./);
  // Desde el 27/10/2026 el ticket se abre solo (`TICKET_DE_LA_FALLA`): la nota pide la marca, no proponerlo (test 7).
  assert.match(b, /termina tu respuesta con una línea aparte, exactamente así: \[\[no-pude: lo que no anda, en una frase\]\]/);
  assert.match(b, /LO QUE YA SABES: tu Claude viene fallando \(hace 3 h: «credit balance is too low»\)\. Si lo que no anda depende de su IA, ÉSA es la causa/);
  assert.doesNotMatch(b, /tu GPT/);
  // Sin nada que falle, o sin poder leerlo, no se afirma ninguna causa.
  for (const e of [[gpt], null]) assert.doesNotMatch(bloqueDeLaFalla(e, AHORA), /LO QUE YA SABES/);
});

test('3. el doer: con un reporte, el ticket viaja aunque el turno no sea «actuar», y la nota va al system', () => {
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /const reporta = reportaFalla\(sinPrefijoDeLote\(texto\)\);\n/);
  // El ticket viaja mientras `TICKET_DE_LA_FALLA` sea «propone» (con «abre», lo abre el código).
  assert.match(doer, /const conTicket = reporta && TICKET_DE_LA_FALLA === 'propone' && !delTurno\.some\(\(t\) => t\.name === LEVANTAR_TICKET\) \? \[\.\.\.delTurno, \.\.\.TICKET_TOOLS\] : delTurno;/);
  assert.match(doer, /const tools = pideVerAgenda\(sinPrefijoDeLote\(texto\)\) && !conTicket\.some\(\(t\) => t\.name === AGENDA_DEL_DIA\) \? \[\.\.\.conTicket, \.\.\.AGENDA_TOOLS\] : conTicket;/);
  assert.match(doer, /const ctxFalla = reporta \? `\\n\\n\$\{bloqueDeLaFalla\(await estadoDeSusClaves\(wsData\)\.catch\(\(\) => null\), Date\.now\(\)\)\}` : '';/);
  assert.match(doer, /\$\{ctxFalla\}\$\{conMemoria\}`;/);
});

test('4. pedir VER la agenda trae agenda_del_dia (P6: mandaba a calendar.google.com); pedir agendar, no es esto', () => {
  for (const f of ['abrime la agenda de google', 'mostrame el calendario de esta semana', 'tengo algo a las 15?', '¿qué tengo hoy?', 'pasame mi agenda'])
    assert.ok(pideVerAgenda(f), `«${f}»`);
  for (const f of ['agendame una reunión con Juan mañana', 'reagendá la de las 15', '¿cuántos leads entraron?'])
    assert.ok(!pideVerAgenda(f), `«${f}»`);
});

// La revisión del Cerebro (Leila, hallazgo 6): «no me deja editar que son 423, no 4235», con la foto de la cuota. Con la foto
// el pedido era «pensar» y el seguimiento «capturar» dudosa: `editar_venta_lead` y `editar_cuota` no viajaban nunca.
test('5. una corrección de monto se ve; una hora, una fecha, un teléfono, un año o una cantidad, no', () => {
  for (const f of [
    'no me deja editar que son 423, no 4235', 'la cuota es 423 y no 4235', 'no es 4235, es 423 la mensualidad', 'son US$ 4.235,29 no 423,53',
    '(envió una imagen) — son 423 no 4235', 'el pago es de $423 no de $4235',
    'corregí la cuota de Nadia', 'hay que cambiar el monto de la mensualidad', 'el monto está mal', 'las cuotas quedaron mal',
  ]) assert.ok(corrigeUnMonto(f), `«${f}» no se ve como corrección`);
  // La revisión adversarial de 82ab77cd8: dos cifras con un «no» no son un monto.
  for (const f of [
    'son 3, no 4', 'la reunión de las 15, no la de las 16', 'cambiá la etapa de Juan a Ganado', '¿cuánto llevo gastado en meta?', 'gracias',
    'movela al viernes a las 15 no 16', 'cambiala para el jueves a las 11 no 12', 'pasala al 20/10 no 21/10', 'agendá a Juan el jueves a las 15 no 16',
    'a las 15:30 no 16:30', 'el 15/10 no 16/10', 'su número es 3764673479, no 3764673480', 'el año es 2026, no 2025', 'son 10 no 12 reuniones',
    'el código postal es 3300 no 3301', 'el CPL es 2,5 no 3,5', 'el precio de la landing está mal', 'cambiá el precio del producto a 500',
    'anotá: llamar a Pedro, su número es 3764673479 no 3764673480',
    // Con plata en el mensaje, una hora o un día siguen sin ser el monto.
    'el pago es a las 15 no 16', 'la llamada de cobranza es el 15 no 16',
  ]) assert.ok(!corrigeUnMonto(f), `«${f}» se ve como corrección`);
});

test('6. la corrección decide la intención Y las herramientas juntas: actuar en cobros con la foto; capturar, la duda, la agenda y el «sí» se respetan', () => {
  const herr = [...HERRAMIENTAS_CORRECCION];
  assert.deepEqual(herr, ['buscar_leads', 'cobranza_lead', 'editar_venta_lead', 'editar_cuota']);
  // Con la foto: actuar en cobros y CRM, y las cuatro.
  const conFoto: VeredictoIntencion = { intencion: 'pensar', dudosa: false, porque: 'adjunto para interpretar' };
  const c = laCorreccion(conFoto, '(envió una imagen) — no me deja editar que son 423, no 4235');
  assert.equal(c.veredicto.intencion, 'actuar');
  assert.ok(c.veredicto.areas?.includes('cobros') && c.veredicto.areas.includes('crm'));
  assert.match(c.veredicto.relevancia ?? '', /editar venta cuota monto/);
  assert.match(c.veredicto.porque, /^corrige un monto \(antes: adjunto para interpretar\)$/);
  assert.deepEqual([...c.herramientas], herr);
  // Un «capturar» EXPLÍCITO queda como está (su contrato): sólo se suman las cuatro.
  const anotar: VeredictoIntencion = { intencion: 'capturar', dudosa: false, porque: 'pidió anotarlo explícitamente' };
  assert.equal(laCorreccion(anotar, 'no me deja editar que son 423, no 4235').veredicto, anotar);
  assert.deepEqual([...laCorreccion(anotar, 'no me deja editar que son 423, no 4235').herramientas], herr);
  // La DUDA no (la verificación de 4d1d0a010): con plata a la vista, el seguimiento de Leila iba al camino barato sin herramientas.
  for (const v of [
    { intencion: 'capturar', dudosa: true, porque: 'sin señal clara' },
    { intencion: 'pensar', dudosa: true, porque: 'dudosa' },
  ] as VeredictoIntencion[]) {
    const r = laCorreccion(v, 'no me deja editar que son 423, no 4235');
    assert.deepEqual([r.veredicto.intencion, r.veredicto.dudosa], ['actuar', false], `${v.intencion} (dudosa) quedó con la duda`);
    assert.deepEqual([...r.herramientas], herr);
  }
  // El seguimiento SIN foto: la plata está en lo de antes (la foto y lo que contestó MaKo), no en «son 423, no 4235».
  const antes = '(envió una imagen) — mirá\nVeo la cuota de Nadia en USD 4235,29.';
  const seguimiento: VeredictoIntencion = { intencion: 'capturar', dudosa: true, porque: 'sin señal clara' };
  for (const f of ['son 423, no 4235', 'pero son 423, no 4235']) {
    const r = laCorreccion(seguimiento, f, antes);
    assert.equal(r.veredicto.intencion, 'actuar', `«${f}» con la foto antes no se ve como corrección`);
    assert.deepEqual([...r.herramientas], herr);
    assert.deepEqual(laCorreccion(seguimiento, f).herramientas, [], `«${f}» sin nada antes se ve como corrección`);
  }
  // Con la plata sólo en lo de antes, más exigente: ni «10 no 12», ni un año.
  for (const f of ['son 10 no 12 reuniones', 'el año es 2026, no 2025']) assert.ok(!corrigeUnMonto(f, antes), `«${f}» con plata antes`);
  // La foto dentro de un lote, y un monto de 2000 con la plata en el mensaje (no es un año).
  assert.ok(corrigeUnMonto('(en este mensaje mandé una imagen, pero llegó junto a otros mensajes…)\nson 423, no 4235'));
  for (const f of ['la cuota es 2000 no 1500', 'la cuota es 1500 no 2000', 'cobrale 1990 no 1900 pesos']) assert.ok(corrigeUnMonto(f), `«${f}»`);
  // Un pedido de agenda o de mover: sin el área ni la relevancia de cobros (el presupuesto es de la agenda).
  const agenda: VeredictoIntencion = { intencion: 'actuar', dudosa: false, porque: 'agenda', relevancia: RELEVANCIA_AGENDA, areas: ['crm'] };
  assert.equal(laCorreccion(agenda, 'la cuota es 423 no 4235').veredicto, agenda);
  // Un «sí» a algo pendiente: nada (otra editar_cuota dejaría dos pendientes con montos opuestos), y sin corrección, nada.
  const si: VeredictoIntencion = { intencion: 'confirmar', dudosa: false, porque: 'sí a lo pendiente' };
  assert.deepEqual(laCorreccion(si, 'sí, la cuota es 423 no 4235'), { veredicto: si, herramientas: [] });
  assert.deepEqual(laCorreccion(conFoto, '(envió una imagen) — ¿qué te parece?'), { veredicto: conFoto, herramientas: [] });
  const doer = leer('lib/mako-doer-in.ts');
  assert.match(doer, /const loDeAntes = historial\.slice\(-2\)\.map\([^\n]*\n\s*const correccion = laCorreccion\(conHilo\.veredicto, sinPrefijoDeLote\(texto\), loDeAntes\);\n\s*const intencion = correccion\.veredicto;/);
  assert.match(doer, /const delTurno = correccion\.herramientas\.length\n\s*\? \[\.\.\.turno\.tools, \.\.\.CORRECCION_TOOLS\.filter\(\(c\) => correccion\.herramientas\.includes\(c\.name\) && !turno\.tools\.some\(\(t\) => t\.name === c\.name\)\)\]\n\s*: turno\.tools;/);
});

test('7. el ticket de la falla se ABRE solo (Martín, 27/10): la nota pide la marca, y nunca proponerlo ni un «sí»', () => {
  assert.equal(TICKET_DE_LA_FALLA, 'abre');
  const abre = bloqueDeLaFalla(null, AHORA);
  assert.match(abre, /^LA PERSONA TE CUENTA QUE ALGO NO ANDA\./);
  assert.match(abre, /\[\[no-pude: lo que no anda, en una frase\]\]/);
  // La marca de la nota es la que saca la base (lib/no-pude.ts): si cambia una, la otra deja de abrir el ticket.
  assert.equal(sacarNoPude('No anda el análisis de Fathom.\n[[no-pude: lo que no anda, en una frase]]').noPudo, 'lo que no anda, en una frase');
  assert.match(abre, /no propongas un ticket, no pidas un «sí» y no digas que lo reportaste/);
  assert.doesNotMatch(abre, /levantar_ticket|queda propuesto/);
  // El otro modo sigue escrito, por si hay que volver.
  assert.match(bloqueDeLaFalla(null, AHORA, 'propone'), /propón levantar un ticket con levantar_ticket/);
});

test('8. los carteles del grupo dejan su ticket por su `cartel`: del negocio pegado al aviso, el nuestro en su párrafo', () => {
  for (const c of ['sin_keys', 'sin_cuota', 'sin_red_por_datos']) assert.equal(causaDelCartel(c), 'configuracion', c);
  for (const c of ['proveedor_caido', 'ia_lenta', 'sin_respaldo']) assert.equal(causaDelCartel(c), 'proveedor', c);
  for (const c of ['fallo_nuestro', 'mensaje_muy_largo']) assert.equal(causaDelCartel(c), 'nuestro', c);
  assert.equal(causaDelCartel('otra_cosa'), null);
  assert.equal(conLaLineaDelTicket('Tu IA no tiene crédito.', '(ticket #31)', 'configuracion'), 'Tu IA no tiene crédito. (ticket #31)');
  assert.equal(conLaLineaDelTicket('No pude contestarte.', 'Quedó el ticket #32 para el equipo de MaKo.', 'nuestro'), 'No pude contestarte.\n\nQuedó el ticket #32 para el equipo de MaKo.');
  assert.equal(conLaLineaDelTicket('No pude contestarte.', null, 'nuestro'), 'No pude contestarte.');
});

test('9. el doer engancha la base: las marcas después del saneo, los cuatro carteles, el cierre solo y la regla en el system', () => {
  const doer = leer('lib/mako-doer-in.ts');
  const iSaneo = doer.indexOf('const saneo = sanearSalida(');
  // Con un error de herramienta ya registrado (la huella), sólo se sacan las marcas: un ticket, una línea (la revisión del 28/10).
  const iMarcas = doer.indexOf('const np = await conTicketsDeMaKo(respuesta, { yaRegistrado: erroresDelTurno.length > 0 }, dondeDelGrupo(texto), {});');
  assert.ok(iSaneo > 0 && iMarcas > iSaneo, 'las marcas se sacan antes del saneo, o no se sacan');
  assert.match(doer.slice(iMarcas - 200, iMarcas), /if \(respuesta && !avisoDeSistema && !linkBorrador && !linkLead\) \{/);
  assert.match(doer.slice(iMarcas, iMarcas + 200), /respuesta = \[np\.texto, np\.linea\]\.filter\(Boolean\)\.join\('\\n\\n'\);/);
  // Los cuatro carteles: el audio, la IA, «ningún proveedor» y la respuesta bloqueada.
  assert.match(doer, /const lineaAudio = await lineaDelCartel\(causaAudio, dondeDelGrupo\('\(nota de voz\)'\)/);
  assert.match(doer, /respuesta = conLaLineaDelTicket\(respuesta, await lineaDelCartel\(cartel, dondeDelGrupo\(texto\), errsIA\.join\(' · '\), 'responder'\), causaDelCartel\(cartel\)\);/);
  assert.equal((doer.match(/await lineaDelCartel\('fallo_nuestro', dondeDelGrupo\(texto\)/g) ?? []).length, 2, 'falta el ticket de «ningún proveedor» o de la bloqueada');
  // La configuración se cierra sola sólo si faltaba la IA o el cupo de «auto» (el doer no elige cuenta), como en la app.
  assert.match(doer, /if \(respuesta && !avisoDeSistema\) await Promise\.all\(\[cerrarSiVolvio\(wsData, 'proveedor'\), cerrarSiVolvio\(wsData, 'configuracion', IA_DEL_DOER\)\]\);/);
  assert.match(doer, /const IA_DEL_DOER = 'ia:auto';/);
  assert.match(doer, /\.\.\.\(causa === 'configuracion' \? \{ herramienta: cartel === 'sin_cuota' \? IA_DEL_DOER : 'ia:ninguna' \} : \{\}\),/);
  assert.match(doer, /const reglaDeLasMarcas = tools\.length \? `\\n\\n\$\{REGLA_NO_EXISTE\}` : '';/);
  // `levantar_ticket` es para cuando la persona lo pide: lo que falla sale solo.
  assert.match(leer('lib/api-mako/areas/tickets.def.ts'), /Úsala SÓLO cuando la persona lo pide/);
});
