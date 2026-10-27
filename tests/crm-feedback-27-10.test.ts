// =============================================================================
// El feedback de Martín y de Mauricio del 27/10/2026, CRM y Chats (docs/hallazgos-crm.md, «El feedback del 27/10»)
// =============================================================================
// Martín, textual:
//   1. «Los pagos funcionan mal, no tiene LIBERTAD... No se cargan tampoco el $ en el total de la columna cuando es
//      suscripción.» → el total suma la mensualidad (tests/crm-tablero-alta-12-10.test.ts) y una cuota se edita sin trámites.
//   2. «Me sigue exigiendo CONTRATO, eso hay que eliminarlo... Lo mismo que mover a alguien a R1, solo funciona con llamada de
//      Calendly o Cal, pero no si la agendé a mano, por defecto la busca.»
//   3/6. «no se agrega con el NOMBRE que lo tenía agendado» · «en NOMBRE se pone el teléfono».
//   4. «se duplica en CHATS hasta que doy refresh».
//   5. «Los 3 puntitos del chat, no debería decir nada de "Cerrar" o posponer... entre esas, la de agregar al CRM.»
//   7. «Las fotos de perfil dentro del CRM no cargan y en CHATS sí».
// Mauricio (ws1): 8. el filtro de Chats sólo con el funnel principal; 9. fechas de Google un día corridas y el filtro de
// Calendly que no bloquea. (El 10, «ganado» con la tarjeta en «Perdido», está en tests/estado-contra-columna.test.ts.)
//
// Probado rompiéndolo (27/10/2026): lo que dice cada `assert` es lo que falló al deshacer su arreglo; el detalle, en
// docs/hallazgos-crm.md.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esNombreDeTelefono, nombreParaAlta, nombreUsable, fotoDeTarjeta } from '../lib/contacto-lead';
import { cambiarClaveEnLista, fusionarRecientes } from '../app/chats/lista-reglas';
import { claveEtapaEnFunnel, contarBandejas, enFunnelYEtapa, filtrarChats, FILTRO_INICIAL } from '../lib/chats-reglas';
import { pideWizardAlElegir, reunionYaCargada } from '../app/crm/mover-etapa';
import { diaDeReunion, esEventoDelCrm, esR2 } from '../lib/auto-reuniones-reglas';
import type { ChatResumen, IdentidadCanal } from '../lib/chats-tipos';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
const fuente = (p: string) => sinComentarios(readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n'));

// ── 3 y 6 · el nombre con que entra al CRM ────────────────────────────────────

test('un «nombre» hecho de dígitos ES el teléfono; uno con letras nunca', () => {
  assert.equal(esNombreDeTelefono('5491123456789'), true);
  assert.equal(esNombreDeTelefono('+52 1 55 1234-5678'), true);
  assert.equal(esNombreDeTelefono('1234 5678', '+52 55 1234 5678'), true);
  assert.equal(esNombreDeTelefono('Juan 2'), false);
  assert.equal(esNombreDeTelefono('Clínica 24 h'), false);
  assert.equal(esNombreDeTelefono('911'), false, 'tres dígitos no son un teléfono');
  assert.equal(nombreUsable('Você'), null);
  assert.equal(nombreUsable('  '), null);
});

test('el lead que viene de un chat nace con el nombre de la AGENDA; sin nombre, vacío; nunca el teléfono', () => {
  const tel = '5215512345678';
  assert.equal(nombreParaAlta({ agenda: 'Juan Pérez (cliente)', pantalla: 'Juancho', telefono: tel }), 'Juan Pérez (cliente)');
  assert.equal(nombreParaAlta({ agenda: null, pantalla: 'Juancho', telefono: tel }), 'Juancho');
  assert.equal(nombreParaAlta({ agenda: tel, pantalla: '+52 1 55 1234 5678', whatsapp: null, telefono: tel }), '', 'el teléfono no es un nombre');
  assert.equal(nombreParaAlta({ agenda: '', pantalla: '', whatsapp: 'Juanchi', telefono: tel }), 'Juanchi');
});

test('el alta desde Chats busca la agenda en el server y puede nacer sin nombre; la pantalla no manda el teléfono', () => {
  const a = fuente('app/crm/actions.ts');
  const alta = a.slice(a.indexOf('export async function crearLeadDesdeWhatsappAction('), a.indexOf('export async function', a.indexOf('export async function crearLeadDesdeWhatsappAction(') + 10));
  assert.match(alta, /const agenda = await getNombreContacto\(t\)\.catch\(\(\) => null\);/, 'no mira la agenda');
  assert.match(alta, /const n = nombreParaAlta\(\{ agenda, pantalla: nombre, telefono: t \}\);/);
  assert.match(alta, /nombreOpcional: true \}\)/, 'sin nombre de agenda ni de pantalla, el alta rebota');
  assert.doesNotMatch(alta, /Falta el nombre del contacto/);
  const l = fuente('lib/leads.ts');
  assert.match(l, /const sinNombrePermitido = input\.nombreOpcional === true && !!\(input\.telefono\?\.trim\(\) \|\| input\.email\?\.trim\(\)\);/);
  const cli = fuente('app/chats/agregar-al-crm.ts');
  assert.match(cli, /crearLeadDesdeWhatsappAction\(nombrePropuesto\(chat, wa\.telefono\), wa\.telefono, funnelId\)/, 'la pantalla volvió a mandar `nombre || telefono`');
  assert.doesNotMatch(fuente('app/chats/VentanaChat.tsx'), /chat\.nombre \|\| waIdent\.telefono/);
  // MaKo por WhatsApp: el pedido de la persona, si no la agenda.
  assert.match(fuente('lib/api-mako/areas/chats.run.ts'), /pedido \?\? nombreParaAlta\(\{ agenda: await getNombreContacto\(telefono\)/);
});

test('la agenda le gana al nombre que el contacto se puso, y el de findChats no pisa el de la agenda', () => {
  const m = fuente('lib/evolution-mensajes.ts');
  assert.match(m, /const n = nombresContacto\.get\(\(c\.telefono \|\| ''\)\.replace\(\/\\D\/g, ''\)\.slice\(-10\)\);\n\s+if \(n\) c\.nombre = n;/, 'la agenda sólo llena los que quedaron con el número');
  assert.match(m, /upsertContacto\(chatJid, ch\.pushName \?\? null, ch\.profilePicUrl \?\? null, \{ nombreSiFalta: true \}\)/);
  const c = fuente('lib/evolution-contactos.ts');
  assert.match(c, /let nom = nombreUsable\(nombre, tel\);/, 'un número se guarda como nombre');
  assert.match(fuente('lib/chats.ts'), /nombre: lead\?\.nombre\?\.trim\(\) \|\| x\.agenda \|\| x\.nombreWa \|\|/, 'el hilo no muestra el de la agenda');
  assert.match(fuente('app/crm/crm-map.ts'), /name: l\.nombre\?\.trim\(\) \|\| 'Sin nombre',/);
});

// ── 4 · el duplicado hasta el refresh ─────────────────────────────────────────

const wa = (ref: string): IdentidadCanal => ({
  canal: 'whatsapp', cuenta: 'ventas', rotulo: 'WhatsApp', destino: null, ref, telefono: '5215512345678', ultimaFecha: null,
  puedeEscribir: true, motivoNoEscribir: null, bloqueado: false,
});
const chat = (clave: string, extra: Partial<ChatResumen> = {}): ChatResumen => ({
  clave, leadId: null, nombre: 'Juan', empresa: null, avatarTel: null, canales: [wa('5215512345678@s.whatsapp.net')], canalUltimo: 'whatsapp',
  ultimoTexto: null, ultimoTipo: null, ultimaFecha: null, ultimoEntrante: true, etapaKey: null, etapaLabel: null, asignado: null,
  closer: null, estado: 'abierta', pospuestaHasta: null, sinLeer: false, borrador: false, bloqueado: false, ...extra,
});

test('agregar al CRM renombra la fila en el acto: nunca dos filas de la misma persona', () => {
  const lista = [chat('wa:ventas:5512345678'), chat('wa:ventas:1111111111', { canales: [wa('otro@s.whatsapp.net')] })];
  const r = cambiarClaveEnLista(lista, 'wa:ventas:5512345678', 'lead:77', 77);
  assert.deepEqual(r.map((c) => c.clave), ['lead:77', 'wa:ventas:1111111111']);
  assert.equal(r[0].leadId, 77);
  // Si la fila del lead ya estaba (la lectura llegó antes), la vieja se va.
  const ya = cambiarClaveEnLista([...lista, chat('lead:77', { leadId: 77 })], 'wa:ventas:5512345678', 'lead:77', 77);
  assert.deepEqual(ya.map((c) => c.clave), ['wa:ventas:1111111111', 'lead:77']);
});

test('la lectura rápida se lleva la fila sin lead cuya identidad ya vino adentro de un lead', () => {
  const enPantalla = [chat('wa:ventas:5512345678'), chat('wa:ventas:1111111111', { canales: [wa('otro@s.whatsapp.net')] })];
  const recientes = [chat('lead:77', { leadId: 77 })];
  const r = fusionarRecientes(enPantalla, recientes);
  assert.deepEqual(r.map((c) => c.clave), ['lead:77', 'wa:ventas:1111111111'], 'la fila vieja quedó al lado de la nueva');
  // Lo que la rápida no trajo y no se volvió lead, se queda (lo rápido no borra).
  assert.equal(fusionarRecientes(enPantalla, []).length, 2);
});

test('ChatsApp y la ventana avisan la clave vieja al cambiarla', () => {
  const app = fuente('app/chats/ChatsApp.tsx');
  assert.match(app, /setDatos\(\(d\) => \(d && vieja \? \{ \.\.\.d, chats: cambiarClaveEnLista\(d\.chats, vieja, nueva, leadId\) \} : d\)\);/);
  const v = fuente('app/chats/VentanaChat.tsx');
  assert.match(v, /onClaveCambio\(`lead:\$\{id\}`, clave\);/);
  assert.match(v, /claveCambioRef\.current\(leido\.chat\.clave, clave\);/);
});

// ── 7 · la foto en el CRM ─────────────────────────────────────────────────────

test('la tarjeta del CRM pide la misma foto de WhatsApp que Chats cuando no hay copia guardada', () => {
  assert.equal(fotoDeTarjeta('https://x/y.jpg', '5215512345678', 3), 'https://x/y.jpg', 'lo guardado gana');
  assert.equal(fotoDeTarjeta(null, '+52 1 55 1234 5678', 3), '/api/whatsapp/evolution/mensajes?avatarimg=5215512345678&ws=3');
  assert.equal(fotoDeTarjeta(null, '12345678', 3), null, 'un número corto choca con otro contacto');
  assert.equal(fotoDeTarjeta(null, null, 3), null);
  const b = fuente('app/crm/CrmBoard.tsx');
  assert.equal((b.match(/foto=\{fotoDeTarjeta\(l\.foto, l\.phone, wsTab\)\}/g) ?? []).length, 2, 'la tarjeta o la ficha rápida sin la foto en vivo');
});

// ── 8 · el filtro de Chats por funnel ─────────────────────────────────────────

test('el filtro elige el funnel y la etapa EN ese funnel: la misma clave es otra etapa en otro', () => {
  const enSprint = chat('lead:1', { leadId: 1, etapaKey: 'st0', funnels: [{ funnelId: 10, etapaKey: 'st0' }, { funnelId: 20, etapaKey: 'st2' }] });
  const soloPrincipal = chat('lead:2', { leadId: 2, etapaKey: 'st2', funnels: [{ funnelId: 10, etapaKey: 'st2' }] });
  const sinLead = chat('wa:ventas:3333333333');
  // El Sprint (20): sólo el que está ahí, y en SU etapa.
  assert.equal(enFunnelYEtapa(enSprint, 20, null, 10), true);
  assert.equal(enFunnelYEtapa(soloPrincipal, 20, null, 10), false);
  assert.equal(enFunnelYEtapa(sinLead, 20, null, 10), false);
  assert.equal(enFunnelYEtapa(enSprint, 20, 'st2', 10), true);
  assert.equal(enFunnelYEtapa(soloPrincipal, null, 'st2', 10), true, 'sin elegir, la etapa es la del principal');
  assert.equal(enFunnelYEtapa(enSprint, null, 'st2', 10), false, 'la st2 del Sprint no es la st2 del principal');
  // Sin funnel ni etapa elegidos, todos.
  const todos = filtrarChats([enSprint, soloPrincipal, sinLead], { ...FILTRO_INICIAL, mostrar: 'todas' }, { nombre: '' }, 10);
  assert.equal(todos.length, 3);
  const sprint = filtrarChats([enSprint, soloPrincipal, sinLead], { ...FILTRO_INICIAL, mostrar: 'todas', funnel: 20 }, { nombre: '' }, 10);
  assert.deepEqual(sprint.map((c) => c.clave), ['lead:1']);
  // Los números: por funnel y por etapa de cada funnel.
  const n = contarBandejas([enSprint, soloPrincipal, sinLead], { nombre: '' });
  assert.equal(n.porFunnel[20]?.abiertas, 1);
  assert.equal(n.porFunnel[10]?.abiertas, 2);
  assert.equal(n.porEtapaEnFunnel[claveEtapaEnFunnel(20, 'st2')]?.abiertas, 1);
  assert.equal(n.porEtapaEnFunnel[claveEtapaEnFunnel(10, 'st2')]?.abiertas, 1);
});

test('la lista trae los funnels con sus etapas y, por lead, su casa y sus agregados', () => {
  const c = fuente('lib/chats.ts');
  assert.match(c, /db\.from\('lead_funnel'\)\.select\('lead_id, funnel_id, etapa'\)\.in\('lead_id', tanda\)/);
  assert.match(c, /funnels: delNegocio\?\.funnels \?\? \[\], funnelPrincipal: principal,/);
  assert.match(fuente('app/api/chats/route.ts'), /funnels: r\.funnels \?\? \[\],/);
  const f = fuente('app/chats/FiltrosChats.tsx');
  assert.match(f, /conteos\.porEtapaEnFunnel\[claveEtapaEnFunnel\(funnelVisto\.id, key\)\]/, 'las etapas sin sus números');
});

// ── 5 · los «⋯» ───────────────────────────────────────────────────────────────

test('el «⋯» de la fila: lo del CRM, sin cerrar ni posponer', () => {
  const l = fuente('app/chats/ListaChats.tsx');
  const menu = l.slice(l.indexOf('function MasAcciones('), l.indexOf('return (', l.indexOf('function MasAcciones(')));
  assert.match(menu, /label: 'Agregar al CRM'/);
  assert.match(menu, /title: 'Agregar al CRM en'/, 'con varios funnels no pregunta en cuál');
  assert.match(menu, /label: 'Abrir ficha'/);
  assert.doesNotMatch(menu, /'cerrar'|'posponer'|'reabrir'|'reanudar'/);
});

// ── 2 · el contrato y la R1 cargada a mano ────────────────────────────────────

const ETAPAS = [{ key: 'lead' }, { key: 'agenda', kind: 'reunion' }, { key: 'agendaj2', kind: 'reunion' }, { key: 'ganado', kind: 'cierre' }];

test('mover a R1 con la reunión ya cargada (a mano) no pregunta nada: se mueve directo', () => {
  assert.equal(reunionYaCargada(ETAPAS, 'agenda', { fechaJ1: '2026-10-28', asistioJ1: null }), true);
  assert.equal(reunionYaCargada(ETAPAS, 'agenda', { fechaJ1: null }), false, 'sin fecha, se pregunta');
  assert.equal(reunionYaCargada(ETAPAS, 'agenda', { fechaJ1: '2026-10-20', asistioJ1: true }), false, 'ya se tuvo: moverla es reagendarla');
  assert.equal(reunionYaCargada(ETAPAS, 'agendaj2', { fechaJ1: '2026-10-20', fechaJ2: '2026-10-30', asistioJ2: null }), true);
  assert.equal(pideWizardAlElegir(ETAPAS, 'agenda', { fechaJ1: '2026-10-28' }), false);
  assert.equal(pideWizardAlElegir(ETAPAS, 'agenda', { fechaJ1: null }), true);
  assert.equal(pideWizardAlElegir(ETAPAS, 'agenda'), true, 'sin datos de la reunión, como siempre');
  // Una etapa de reunión de un funnel propio (clave st3) también.
  assert.equal(reunionYaCargada([{ key: 'st3', kind: 'reunion' }], 'st3', { fechaJ1: '2026-10-28' }), true);
  assert.match(fuente('app/crm/CrmBoard.tsx'), /if \(esEtapaCalendly\(stageKey\) && !reunionYaCargada\(stages, stageKey, lead\)\) \{ scheduleViaCalendly/);
});

test('el asistente: sin el contrato al mover, y la fecha de la reunión no se busca sola', () => {
  const d = fuente('app/crm/StageMoveDialog.tsx');
  assert.match(d, /if \(completarDatos && necesitaDeal\) p\.push\('dealAuto'\);/, 'el contrato volvió a pedirse al mover');
  assert.doesNotMatch(d, /esCierre && !dealCompleto/);
  assert.match(d, /const buscaSola = p\.some\(\(id\) => \(AUTO_RESOLUBLES as string\[\]\)\.includes\(id\) && id !== 'fechaJ1' && id !== 'fechaJ2'\);/);
  assert.match(d, /if \(autoOferta && buscaSola && /, 'la búsqueda vuelve a arrancar sola por la fecha');
  assert.match(d, /\{buscarFechaLink\('R1'\)\}/, 'sin el link para buscarla');
});

test('la búsqueda de reuniones respeta la fecha cargada a mano', () => {
  const a = fuente('lib/auto-reuniones.ts');
  assert.match(a, /const fechaJ1 = lead\.fecha_junta_1 \?\? extJ1 \?\? null;/, 'una reserva vieja de Calendly pisa la fecha cargada a mano');
  assert.match(a, /const fechaJ2 = lead\.fecha_junta_2 \?\? extJ2 \?\? null;/);
});

// ── 9 · el día de la reunión y el filtro de Calendly ──────────────────────────

test('el día de una reunión es el del CRM (Tijuana), no el de UTC; un día completo de Google se queda como está', () => {
  // 19:30 en Tijuana del 27 = 02:30 UTC del 28: el `.slice(0, 10)` decía el 28.
  assert.equal(diaDeReunion('2026-10-28T02:30:00Z'), '2026-10-27');
  assert.equal(diaDeReunion('2026-10-28T02:30:00.000000Z'), '2026-10-27');
  // Con su desfase (Google): el mismo instante.
  assert.equal(diaDeReunion('2026-10-27T20:30:00-06:00'), '2026-10-27');
  // Un evento de día completo: ES ese día (pasado por un Date era la medianoche UTC: el 27 en México).
  assert.equal(diaDeReunion('2026-10-28'), '2026-10-28');
  assert.equal(diaDeReunion(''), null);
  assert.equal(diaDeReunion('cualquier cosa'), null);
  const a = fuente('lib/auto-reuniones.ts');
  assert.doesNotMatch(a, /start_time\?\.slice\(0, 10\)|started_at\?\.slice\(0, 10\)|start\?\.slice\(0, 10\)/, 'volvió el día de UTC');
});

test('la búsqueda sólo toma los eventos de Calendly del CRM, como el webhook', () => {
  const f = { j1: 'Llamada de diagnóstico', j2: 'Reunión 2 - Propuesta', vinculados: ['https://api.calendly.com/event_types/VINC'] };
  assert.equal(esEventoDelCrm({ name: 'Llamada de diagnóstico', event_type: 'https://api.calendly.com/event_types/AAA' }, f), true);
  assert.equal(esEventoDelCrm({ name: 'Reunión 2 - Propuesta' }, f), true);
  assert.equal(esEventoDelCrm({ name: 'Webinar', event_type: 'https://api.calendly.com/event_types/VINC' }, f), true, 'el vinculado a una etapa');
  assert.equal(esEventoDelCrm({ name: 'Onboarding de clientes', event_type: 'https://api.calendly.com/event_types/ZZZ' }, f), false, 'un evento que no es del CRM pasaba por la R1');
  // Sin nada configurado no se filtra (un negocio que no eligió tipos ve todo, como antes).
  assert.equal(esEventoDelCrm({ name: 'Onboarding' }, { j1: null, j2: null, vinculados: [] }), true);
  // La R2: por el tipo configurado; sin él, por el nombre.
  assert.equal(esR2({ name: 'Reunión 2 - Propuesta' }, f), true);
  assert.equal(esR2({ name: 'Seguimiento' }, f), false, 'con la R2 configurada, el nombre no decide');
  assert.equal(esR2({ name: 'Seguimiento' }, { j1: null, j2: null, vinculados: [] }), true);
  const a = fuente('lib/auto-reuniones.ts');
  assert.match(a, /e\.status !== 'canceled' && esEventoDelCrm\(e, filtro\)/, 'la búsqueda volvió a traer todo');
  assert.match(a, /if \(!filtro\) return \[\];/, 'sin poder leer el filtro, adivina');
});

// ── 1 · los pagos, sin trámites ───────────────────────────────────────────────

test('una cuota se edita sin trámites: cobrada a mano, con recordatorio o con link', () => {
  const p = fuente('lib/pagos.ts');
  const ed = p.slice(p.indexOf('export async function editarCuota('), p.indexOf('export async function cortarRecordatoriosDeCuota('));
  assert.doesNotMatch(ed, /desmárcala primero|córtalo para editarla|anúlalo para cambiar el monto/, 'volvió un trámite');
  assert.match(ed, /if \(q\.pagado\) return editarCuotaCobrada\(leadId, pagoId, q, cambio\);/);
  assert.match(ed, /await cerrarCorridasDeCuota\(ws, pagoId\);/, 'el recordatorio viejo no se corta');
  assert.match(ed, /prot\.includes\('link'\) && cambiaMonto\) \{/);
  assert.match(ed, /await anularLinksDeCuota\(ws, pagoId, /, 'el link con el monto viejo sigue vivo');
  assert.match(ed, /if \(q\.proveedor \|\| q\.cobro_id != null\) throw/, 'lo que cobró la pasarela no se edita');
  assert.match(ed, /await sincronizarTotalCobrado\(leadId\);/, 'lo cobrado del lead no se recalcula');
  // Guardar no se adelanta a lo que lo protegía: primero se escribe, después se corta.
  assert.ok(ed.indexOf(".update({ monto_usd: despues.monto_usd, fecha_esperada") < ed.indexOf('cerrarCorridasDeCuota('), 'corta antes de guardar');
  const ui = fuente('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx');
  assert.match(ui, /\{lead\.venta_tipo !== 'suscripcion' && \(\s*<Button variant="secondary" size="sm" onClick=\{\(\) => setArmando\(true\)\}>/, '«Armar el plan» volvió a esconderse');
});

// ── #13 · el plan quincenal de Leila (ws11) ───────────────────────────────────

test('el plan libre: cada quincena en los días 1 y 15, más de 6 cuotas, y un 31 que cae en el último día', async () => {
  const { fechasDelPlan } = await import('../lib/pagos-campo');
  assert.deepEqual(fechasDelPlan({ desde: '2026-11-01', cantidad: 4, cada: 'quincena', dias: [1, 15] }), ['2026-11-01', '2026-11-15', '2026-12-01', '2026-12-15']);
  assert.deepEqual(fechasDelPlan({ desde: '2026-11-02', cantidad: 2, cada: 'quincena' }), ['2026-11-15', '2026-12-01'], 'la primera no cae antes de «desde»');
  assert.equal(fechasDelPlan({ desde: '2026-11-01', cantidad: 24, cada: 'quincena', dias: [1, 15] }).length, 24, 'más de 6 cuotas');
  assert.deepEqual(fechasDelPlan({ desde: '2026-01-31', cantidad: 3, cada: 'mes', dias: [31] }), ['2026-01-31', '2026-02-28', '2026-03-31']);
  assert.deepEqual(fechasDelPlan({ desde: '2026-11-03', cantidad: 3, cada: 'semana' }), ['2026-11-03', '2026-11-10', '2026-11-17']);
  assert.deepEqual(fechasDelPlan({ desde: '2026-11-01', cantidad: 61, cada: 'mes', dias: [1] }), [], 'el tope de 60');
  assert.deepEqual(fechasDelPlan({ desde: '2026-11-01', cantidad: 2, cada: 'quincena', dias: [1] }), [], 'una quincena son dos días');
  const ui = fuente('app/crm/lead-view/ficha/pagos/bloques-cobro.tsx');
  assert.match(ui, /const libre = cada !== 'mes' \|\| cantidad > 6 \|\| \(dia != null && dia > 28\);/, 'el plan sigue atado a 1-6 cuotas y un día del 1 al 28');
  assert.match(ui, /await guardarCuotasAction\(l\.id, cuotas, \{/, 'el plan libre no se guarda por lista');
  assert.match(ui, /<option value="quincena">Quincena<\/option>/);
});
