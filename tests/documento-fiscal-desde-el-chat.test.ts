// =============================================================================
// Leila (ws11, 26/10/2026), lead Fabi Pedraza:
//   · «Me dice que no tengo los datos fiscales pero cuando los quiero cargar solamente me salen setter y closer.»
//   · Le pasó la constancia al chat del lead y MaKo contestó «Desde este chat no puedo adjuntar ni guardar el documento
//     en su ficha».
//
// La pantalla: el funnel de Leila usa la plantilla «Evento» (canal presencial), que no tiene el bloque «Datos fiscales»
// en Pagos y apaga sus avisos. «Solucionar» el dato no encontraba dónde (`tabDelDato` → null) y caía al asistente SIN
// decir qué dato: `loQueSePide` lo sacaba (no avisa) y el documento fiscal no se pregunta nunca ahí. Ahora el asistente
// recibe el dato tocado (`datoPedido`) y lo pregunta, también el documento.
//
// El chat: «este es el doc fiscal» con el PDF era «pensar» (adjunto para interpretar), sin herramientas que escriban, y
// no existía una que guardara el archivo del mensaje en la ficha. Ahora: la familia `documento-fiscal` lo hace «actuar»
// en cobros/crm, y `guardar_documento_fiscal` lo propone con el adjunto de ESE mensaje (sólo la app, que lo guarda).
//
// ── Probado rompiéndolo (29/10/2026), de a una y restaurando. Ver el pie. ──
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loQueSePide } from '../lib/datos-aviso';
import { dondeSeCompleta, fichaEfectiva } from '../lib/ficha/config';
import { elegirPlantilla } from '../lib/ficha/plantillas';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { porId, type Vista } from '../lib/api-mako/registro';
import { aCompletarAhora, propuestaDocumentoFiscal, SIN_ARCHIVO } from '../lib/deal-fiscal-doc-reglas';
import type { Step } from '../lib/stage-requirements';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ── La pantalla ───────────────────────────────────────────────────────────────

test('el funnel de Leila (una reunión, canal presencial) usa «Evento», y esa ficha no dibuja los datos fiscales', () => {
  const etapas = [{ key: 'lead', kind: 'entrada' }, { key: 'agenda', kind: 'reunion' }, { key: 'ganado', kind: 'cierre' }];
  const e = elegirPlantilla({ etapas: etapas as never, canalDelFunnel: null, canalDelNegocio: 'presencial', entradas: [] });
  assert.equal(e.id, 'evento');
  const ficha = fichaEfectiva('evento', null, { resumen: {}, apagados: [] });
  assert.equal(dondeSeCompleta(ficha, 'dealFiscal'), null, 'si la dibujara, «Solucionar» iría al bloque y no al asistente');
  assert.equal(dondeSeCompleta(ficha, 'dealFiscalDoc'), null);
  // Control: «Una llamada» sí la tiene, y ahí «Solucionar» lleva al bloque.
  assert.equal(dondeSeCompleta(fichaEfectiva('una-llamada', null, { resumen: {}, apagados: [] }), 'dealFiscal'), 'pagos');
});

test('«Completar datos» de UN dato pedido lo pregunta aunque el funnel no avise de él', () => {
  const faltan: Step[] = [
    { id: 'dealFiscal', label: 'Datos fiscales del cliente' },
    { id: 'dealFiscalDoc', label: 'Documento fiscal del cliente' },
    { id: 'setter', label: 'Setter asignado' },
    { id: 'closer', label: 'Closer asignado' },
  ];
  const avisan = [{ id: 'setter' }, { id: 'closer' }] as const;
  // Lo de siempre (23/10/2026, «me obligas a hacer obligatorio un dato que no quería»): sin pedido, sólo lo que avisa.
  assert.deepEqual(loQueSePide(faltan, [...avisan]).map((f) => f.id), ['setter', 'closer']);
  // El caso de Leila: tocó «Datos fiscales» y el asistente le mostraba setter y closer.
  assert.deepEqual(loQueSePide(faltan, [...avisan], 'dealFiscal').map((f) => f.id), ['dealFiscal']);
  assert.deepEqual(loQueSePide(faltan, [...avisan], 'dealFiscalDoc').map((f) => f.id), ['dealFiscalDoc']);
  // Ya resuelto entre el clic y la apertura: no se inventa un paso; vuelve a lo de siempre.
  assert.deepEqual(loQueSePide(faltan.slice(2), [...avisan], 'dealFiscal').map((f) => f.id), ['setter', 'closer']);
  assert.deepEqual(loQueSePide(faltan, [...avisan], null).map((f) => f.id), ['setter', 'closer']);
});

test('la ficha le dice al asistente QUÉ dato no encontró, en los dos caminos (sin bloque, y bloque sin el campo en pantalla)', () => {
  const f = sinComentarios(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'));
  assert.match(f, /onNoEsta: \(paso: StepId\) => void;/);
  assert.match(f, /if \(!t\) \{ onNoEsta\(paso\); return; \}/);
  assert.match(f, /<Senalar objetivo=\{marcaDato\(senal\.id\)\}[^\n]*\n[^\n]*onNoEsta=\{\(\) => onNoEsta\(senal\.id\)\} \/>/);
});

test('el pop-up y la ruta abren el asistente con ese dato, y lo sueltan al cerrar', () => {
  const sheet = sinComentarios(leer('app/crm/LeadSheet.tsx'));
  assert.match(sheet, /const solucionar = \(paso: StepId\) => \{ setDatoPedido\(paso\); setMoveTo\(stageKey\); \};/);
  assert.match(sheet, /faltantes=\{completandoDatos \? loQueSePide\(faltantes, datos\?\.avisar, datoPedido\) : undefined\}/);
  assert.match(sheet, /datoPedido=\{completandoDatos \? datoPedido : null\}/);
  assert.match(sheet, /onClose=\{\(\) => \{ setMoveTo\(null\); setDatoPedido\(null\); \}\}/);
  const ruta = sinComentarios(leer('app/crm/[id]/LeadDetailBody.tsx'));
  assert.match(ruta, /onNoEsta=\{\(paso\) => \{ setDatoPedido\(paso\); setMoveTo\(currentStage\); \}\}/);
  assert.match(ruta, /faltantes=\{moveTo === currentStage \? loQueSePide\(faltantes, datos\?\.avisar, datoPedido\) : undefined\}/);
  assert.match(ruta, /datoPedido=\{moveTo === currentStage \? datoPedido : null\}/);
});

test('el asistente pregunta el documento fiscal y el comprobante SÓLO si son el dato pedido (al mover, nunca)', () => {
  const d = sinComentarios(leer('app/crm/StageMoveDialog.tsx'));
  assert.match(d, /if \(datoPedido === 'dealFiscalDoc' && requeridos\.has\('dealFiscalDoc'\)\) p\.push\('dealFiscalDoc'\);/);
  assert.match(d, /if \(datoPedido === 'comprobante' && requeridos\.has\('comprobante'\)\) p\.push\('comprobante'\);/);
  assert.equal((d.match(/p\.push\('dealFiscalDoc'\)/g) ?? []).length, 1, 'ningún otro camino lo pregunta');
  assert.match(d, /completarDatos, productos, datoPedido\]\);/, 'los pasos se recalculan con el dato pedido');
});

// ── El chat ───────────────────────────────────────────────────────────────────

const CTX_APP = { canal: 'app' as const, hayMedia: true, hayPendientes: false, hayPendienteDeAgenda: false, hayAgendaAbierta: false, makoPregunto: false, preguntoReunionOTarea: false };
const LEILA = '(envió un PDF: Constancia agosto 2026 Fabiola Pedraza Escalera.pdf) — este es el doc fiscal';
const vista = (canal: 'app' | 'whatsapp'): Vista => ({ canal, alcance: canal === 'app' ? 'proponer' : 'ejecutar', ws: 11, rol: 'admin', tabs: null });

test('con la constancia adjunta, el mensaje ACTÚA en cobros y crm (era «pensar»: adjunto para interpretar)', () => {
  for (const t of [LEILA, '(envió un PDF: constancia.pdf) — te paso su constancia fiscal', '(envió una foto: csf.jpg) — su constancia de situación fiscal']) {
    const v = clasificarIntencion(t, CTX_APP);
    assert.equal(v.intencion, 'actuar', t);
    assert.ok(v.areas?.includes('cobros'), t);
  }
  // Preguntar por los datos sigue siendo una pregunta.
  assert.equal(clasificarIntencion('¿qué datos fiscales tiene Fabi?', { ...CTX_APP, hayMedia: false }).intencion, 'consultar');
});

test('`guardar_documento_fiscal` llega al turno de la app con ese mensaje, sin ninguna que borre; por WhatsApp no viaja', () => {
  const veredicto = clasificarIntencion(LEILA, CTX_APP);
  const app = herramientasDelChat({ veredicto, texto: LEILA, agendaAbierta: false, deSiempre: [], vista: vista('app'), hayPendientes: false });
  const nombres = app.tools.map((x) => x.name);
  assert.ok(nombres.includes('guardar_documento_fiscal'), nombres.join(','));
  assert.deepEqual(nombres.filter((n) => /reembols|anular|cancelar|borrar|eliminar/.test(n)), []);
  const def = porId('guardar_documento_fiscal');
  assert.equal(def?.tipo, 'accion');
  assert.equal(def && 'confirmacion' in def ? def.confirmacion : null, 'chat', 'se confirma con la tarjeta del chat');
  assert.deepEqual(def?.canales, ['app'], 'sólo la app guarda el archivo del mensaje (`ctx.adjuntos`)');
  const wa = herramientasDelTurno({ veredicto: clasificarIntencion(LEILA, { hayMedia: true }), texto: LEILA, agendaAbierta: false, deSiempre: [], vista: vista('whatsapp'), hayPendientes: false });
  assert.ok(!wa.tools.some((x) => x.name === 'guardar_documento_fiscal'));
});

const FABI = { id: 2606, nombre: 'Fabiola Pedraza', deal_fiscal: { razon: 'Fabiola Pedraza Escalera', id_fiscal: null, domicilio: null, correo: null } };
const PDF = { ref: '7781:0', nombre: 'Constancia agosto 2026 Fabiola Pedraza Escalera.pdf', tipo: 'document' as const };

test('la propuesta: el archivo de ESTE mensaje y sólo los datos VACÍOS', () => {
  const p = propuestaDocumentoFiscal(FABI, [PDF], {
    razon: 'FABIOLA PEDRAZA ESCALERA', id_fiscal: 'PEEF770916DG6',
    domicilio: 'Av. Cancún Mz 19 Lt 21, col. Andalucía II, C.P. 77535, Benito Juárez, Quintana Roo',
  });
  assert.ok('payload' in p, JSON.stringify(p));
  assert.equal(p.payload.ref, '7781:0', 'el ref del adjunto viaja en la pendiente: al confirmar ya no hay turno');
  assert.equal(p.payload.leadId, 2606);
  assert.deepEqual(Object.keys(p.payload.completar).sort(), ['domicilio', 'id_fiscal'], 'la razón ya estaba: no se pisa');
  assert.match(p.resumen, /^Guardar «Constancia agosto 2026 Fabiola Pedraza Escalera\.pdf» como documento fiscal de Fabiola Pedraza y completar /);
  assert.match(p.resumen, /PEEF770916DG6/);
  assert.doesNotMatch(p.resumen, /reemplaza/);
  const conDoc = propuestaDocumentoFiscal({ ...FABI, deal_fiscal: { ...FABI.deal_fiscal, doc_path: '11/2606/fiscal/x.pdf' } }, [PDF], {});
  assert.ok('resumen' in conDoc && /reemplaza el que tenía/.test(conDoc.resumen));
});

test('sin archivo, o con varios sin decir cuál, no propone nada y dice qué falta', () => {
  assert.deepEqual(propuestaDocumentoFiscal(FABI, [], {}), { error: SIN_ARCHIVO });
  assert.deepEqual(propuestaDocumentoFiscal(FABI, undefined, {}), { error: SIN_ARCHIVO });
  const otro = { ref: '7781:1', nombre: 'foto.jpg', tipo: 'image' as const };
  const varios = propuestaDocumentoFiscal(FABI, [PDF, otro], {});
  assert.ok('error' in varios && varios.faltan?.includes('archivo'));
  assert.deepEqual('error' in varios ? varios.disponibles : null, [PDF.nombre, 'foto.jpg']);
  const elegido = propuestaDocumentoFiscal(FABI, [PDF, otro], { archivo: 'foto.jpg' });
  assert.ok('payload' in elegido && elegido.payload.ref === '7781:1');
  const noVino = propuestaDocumentoFiscal(FABI, [PDF], { archivo: 'otra.pdf' });
  assert.ok('error' in noVino && /no vino «otra\.pdf»/.test(noVino.error));
});

test('al confirmar, lo que alguien cargó entre la propuesta y el «sí» no se pisa', () => {
  const propuesto = { id_fiscal: 'PEEF770916DG6', domicilio: 'Av. Cancún', razon: 'X' };
  assert.deepEqual(aCompletarAhora({ razon: 'Fabiola', id_fiscal: '', domicilio: null }, propuesto), [['id_fiscal', 'PEEF770916DG6'], ['domicilio', 'Av. Cancún']]);
  assert.deepEqual(aCompletarAhora({ razon: 'Fabiola', id_fiscal: 'YA', domicilio: 'YA' }, propuesto), []);
  assert.deepEqual(aCompletarAhora(null, { doc_path: 'pisar.pdf', correo: 'a@b.co' }), [['correo', 'a@b.co']], 'sólo los cuatro datos fiscales');
  assert.deepEqual(aCompletarAhora({}, 'basura'), []);
});

test('el runner: propone con `ctx.adjuntos`, baja el archivo del `ref` y lo guarda por el MISMO camino que la pantalla', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/cobros.run.ts'));
  const b = run.slice(run.indexOf('guardar_documento_fiscal: {'), run.indexOf('editar_obligacion_deal: {'));
  assert.match(b, /return propuestaDocumentoFiscal\(lead, ctx\.adjuntos, input\);/);
  assert.match(b, /const archivo = await bajarAdjunto\(ctx\.ws, payload\.ref\);/);
  assert.match(b, /await guardarDocumentoFiscal\(\{ ws: ctx\.ws, leadId, bytes: archivo\.bytes/);
  assert.match(b, /for \(const \[campo, valor\] of aCompletarAhora\(lead\?\.deal_fiscal, payload\.completar\)\) \{\s*const r = await escribirCampoDeal\(leadId, \{ seccion: 'fiscal', campo, valor \}/);
  const ruta = sinComentarios(leer('app/api/extract-deal-fiscal/route.ts'));
  assert.match(ruta, /await guardarDocumentoFiscal\(\{ ws, leadId, bytes: buf, mime, nombre: file\.name \|\| '' \}\)/);
  assert.doesNotMatch(ruta, /storage\.from\('contratos'\)/, 'la ruta del archivo vive en un solo lugar: lib/deal-fiscal-doc.ts');
  // El adjunto se lee con el MISMO índice que el link del chat (`urlDeAdjunto`): el `<n>` cuenta los bloques saneados.
  const adj = sinComentarios(leer('lib/chat-mako-adjuntos.ts'));
  assert.match(adj, /const b = m \? sanearBloques\(ws, m\.bloques\)\[r\.i\] : undefined;/);
});

// ── Probado rompiéndolo (29/10/2026), de a una y restaurando. Base 11/0, final 11/0 ──
// Cada uno de los 10 archivos como estaba en main (7f36fa9c6)                                     → 10/1 (la familia: 9/2)
// R1  `loQueSePide` sin el pedido                                                                → 10/1
// R2  la ficha llama `onNoEsta` con otro dato (sin bloque) · R3 el señalador lo mismo              → 10/1 cada una
// R4  el pop-up no le pasa `datoPedido` a `loQueSePide` · R5 la ruta no lo guarda                  → 10/1 cada una
// R6  el asistente pregunta el documento fiscal siempre                                           → 10/1
// R7  la familia `documento-fiscal` sin `actua` → 9/2 · R8 `area-fiscal` con `actua`               → 10/1
// R9  la herramienta con canales TODOS                                                            → 10/1
// R10 pisa lo cargado al proponer · R11 al confirmar · R12 completa claves que no son fiscales     → 10/1 cada una
// R13 con varios archivos agarra el primero · R14 propone sin `ctx.adjuntos`                       → 10/1 cada una
// R15 `bajarAdjunto` con el índice de los bloques crudos (no el de `urlDeAdjunto`)                 → 10/1
