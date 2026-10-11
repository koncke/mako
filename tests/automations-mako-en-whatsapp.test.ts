// =============================================================================
// «MaKo en WhatsApp» = automatizaciones, IGUALES a las demás — la lista, el lienzo, la galería y lo que se depreca
// (parte B de docs/diseno-mako-en-whatsapp-unificado.md, 11/10/2026)
// =============================================================================
// Martín, textual: «Te pedí que la parte de WhatsApp de MaKo sea exactamente igual y siguen muchas cosas
// diferentes... Esto pasa porque "MaKo en WhatsApp" lo comenzamos a hacer hace tiempo en la tab de notificaciones
// y quedaron cosas muy viejas que quiero que las depreques. Todo ahora es lo mismo... 1. Los 3 puntos de "MaKo en
// WhatsApp" no tienen los botones de duplicar o copiar. 2. Las tarjetas cambian, cambia el CRON, cambia la tarjeta
// de "MaKo en WhatsApp" cambia todo, y NO debería... debe ser IDENTICO.»
//
// Lo que fija este archivo (el emisor y el motor, la parte A, los fija tests/aviso-evento.test.ts):
//   1. La lista: «MaKo en WhatsApp» son las filas con el CRON «Evento de MaKo» (`partirLista`), con la MISMA fila y el
//      MISMO «⋯» (cuatro opciones, Duplicar y Copiar flujo incluidos). `opcionesDeMensaje` ya no existe.
//   2. Nada en app/automations importa la lista vieja (MensajeMakoLienzo, TemplateDetalleModal, chatbot-mensajes-mako).
//   3. «＋ Nuevo mensaje» abre la galería con el filtro «MaKo en WhatsApp»; las plantillas de MaKo (cuatro desde la décima
//      tanda) van mezcladas con las del Chatbot, con la misma tarjeta.
//   4. Las tres plantillas se pueden publicar (`validarGrafo`, `frenoDelFlujo`, `frenoDelEvento`), la cobranza trae
//      los textos de antes LITERALES, y de un evento se crean varias (el recordatorio sigue siendo uno).
//   5. Lo que se depreca: `{{mensaje_mako}}` sólo con `conMensaje`, la lista vieja fuera de `listarPlantillas`, MaKo no
//      los prende, Notificaciones sin la lista de mensajes, el reporte semanal del super admin.
//   6. Con un CRON del emisor no hay «＋ Nuevo CRON» ni «←» (dibujado).
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Lista from '../app/automations/SimuladorWhatsApp';
import { SimuladorWhatsApp, partirLista, opcionesDeFila, ROTULO_CHATBOT, ROTULO_MENSAJES_MAKO } from '../app/automations/SimuladorWhatsApp';
import { GaleriaPlantillas, yaLaTiene, BLANCO } from '../app/automations/GaleriaPlantillas';
import { EditorDisparadores } from '../app/automations/EditorDisparadores';
import { ejemplosDelEvento } from '../app/automations/PanelProbar';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';
import { PLANTILLAS, plantillaPorId, pasosDePlantilla, esPlantillaMako } from '../lib/plantillas-automatizaciones';
import { crearDesdePlantilla, PlantillaInvalidaError, type DbPlantilla } from '../lib/plantilla-crear';
import { validarGrafo, normalizar } from '../lib/flujo-grafo';
import { frenoDelFlujo } from '../lib/flujo-conversacion';
import { frenoDelEvento, datosDelEvento, AVISOS_POR_EVENTO } from '../lib/aviso-evento';
import { TRIGGER_AVISO_MAKO, EVENTOS_MAKO, type Disparador } from '../lib/disparadores';
import { TRIGGER_RECORDATORIO } from '../lib/recordatorio-automatizacion';
import { variablesPara, CLAVE_MENSAJE_MAKO } from '../lib/variables-aviso';
import { AVISOS_DEL_CLIENTE, AVISOS_SOLO_SUPERADMIN, CATALOGO_AVISOS } from '../lib/avisos-catalogo';
import { porId } from '../lib/api-mako/registro';
import { faltanEnPaso } from '../lib/api-mako/flujo-params';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md: un `/*` dentro de un `//` se come el código).
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));
/** El bloque de `desde` hasta `hasta` (su cierre real, no un número de caracteres), con su largo acotado. */
function bloque(src: string, desde: string, hasta: string, tope = 4000): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre «${hasta}» de «${desde}»`);
  const b = src.slice(i, j);
  assert.ok(b.length < tope, `el recorte de «${desde}» mide ${b.length}: está mirando otra cosa`);
  return b;
}

const fila = (id: number, nombre: string, trigger_tipo: string, extra: Record<string, unknown> = {}) => ({
  id, clave: `c-${id}`, nombre, etapa: 'manual', trigger_tipo, activa: true, pasos: [], inscriptos: 0, enviados: 0,
  estrategia: null, metricas: {}, ...extra,
}) as unknown as SecuenciaDto;

const BIENVENIDA = fila(7, 'Bienvenida', 'etapa_actual');
const COBRANZA = fila(8, 'Cobranza de cuotas vencidas', TRIGGER_AVISO_MAKO, { disparadores: [{ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'cuota_vencida' }] });
const RECORDATORIO = fila(9, 'Recordatorio de la reunión', TRIGGER_RECORDATORIO);

const dibujarLista = (secuencias: SecuenciaDto[], extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(SimuladorWhatsApp, {
  secuencias, objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
  rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {},
  productos: [], disparadores: [], tz: null, ...extra,
} as Parameters<typeof SimuladorWhatsApp>[0]));

// ── 1. La lista ──────────────────────────────────────────────────────────────────

test('1. `partirLista`: «MaKo en WhatsApp» son las filas del CRON «Evento de MaKo», y el resto (el recordatorio incluido) es «Chatbot», en orden', () => {
  const { chatbot, mako } = partirLista([BIENVENIDA, COBRANZA, RECORDATORIO]);
  assert.deepEqual(chatbot.map((j) => j.id), [7, 9]);
  assert.deepEqual(mako.map((j) => j.id), [8]);
  assert.deepEqual(partirLista([]), { chatbot: [], mako: [] });
});

test('1. dibujada: «Chatbot» con sus filas, después «MaKo en WhatsApp» con «＋ Nuevo mensaje» y SUS filas, con el MISMO «⋯»', () => {
  const html = dibujarLista([BIENVENIDA, COBRANZA, RECORDATORIO]);
  const iChatbot = html.indexOf(`>${ROTULO_CHATBOT}</div>`);
  const iBienvenida = html.indexOf('>Bienvenida</span>');
  const iRecordatorio = html.indexOf('>Recordatorio de la reunión</span>');
  const iMako = html.indexOf(`>${ROTULO_MENSAJES_MAKO}</div>`);
  const iNuevo = html.indexOf('data-nuevo-mensaje');
  const iCobranza = html.indexOf('>Cobranza de cuotas vencidas</span>');
  assert.ok(iChatbot >= 0 && iChatbot < iBienvenida && iBienvenida < iMako && iRecordatorio < iMako, 'una automatización del Chatbot quedó bajo «MaKo en WhatsApp»');
  assert.ok(iMako < iNuevo && iNuevo < iCobranza, 'la fila del evento no va bajo «MaKo en WhatsApp», después de «＋ Nuevo mensaje»');
  // El MISMO «⋯» que una automatización: el botón de la casa, en las tres filas.
  for (const n of ['Bienvenida', 'Recordatorio de la reunión', 'Cobranza de cuotas vencidas']) {
    assert.ok(html.includes(`aria-label="Opciones de ${n}"`), `«${n}» sin su «⋯»`);
  }
  // Un setter las ve como cualquier automatización (sin «⋯» ni «＋», como en el Chatbot).
  const setter = dibujarLista([BIENVENIDA, COBRANZA], { rolAdmin: false });
  assert.ok(setter.includes('>Cobranza de cuotas vencidas</span>'), 'un setter no ve la fila del evento');
  assert.doesNotMatch(setter, /data-nuevo-mensaje|aria-label="Opciones de /);
});

test('1. el «⋯» de una fila de «MaKo en WhatsApp» es `opcionesDeFila`: los cuatro, y `opcionesDeMensaje` ya no existe', () => {
  assert.deepEqual(opcionesDeFila(true).map((o) => o.value), ['activa', 'duplicar', 'copiar', 'eliminar']);
  assert.equal('opcionesDeMensaje' in Lista, false, 'volvió el «⋯» recortado de los mensajes de antes');
  // Una sola fila para las dos divisiones: la misma función dibuja las dos.
  const src = fuente('app/automations/SimuladorWhatsApp.tsx');
  assert.match(src, /\{divisiones\.chatbot\.map\(filaDeLista\)\}/);
  assert.match(src, /\{divisiones\.mako\.map\(filaDeLista\)\}/);
  // Con «Descartar cambios» cuando tiene algo sin publicar (décima tanda, general 5): el mismo punto ámbar del nombre.
  assert.match(bloque(src, 'const filaDeLista = (j: SecuenciaDto) => {', '\n  };\n'), /options=\{opcionesDeFila\(j\.activa, sinPublicarDe\(j, j\.id === selId && sinPublicar\)\)\}\n\s+onChange=\{\(v\) => void accionFila\(j, v\)\}/);
});

// ── 2. La lista vieja, fuera ─────────────────────────────────────────────────────

test('2. nada en app/automations importa la lista vieja, y sus dos archivos se borraron', () => {
  assert.equal(existsSync(new URL('../app/automations/MensajeMakoLienzo.tsx', import.meta.url)), false, 'volvió MensajeMakoLienzo');
  assert.equal(existsSync(new URL('../lib/chatbot-mensajes-mako.ts', import.meta.url)), false, 'volvió lib/chatbot-mensajes-mako.ts');
  const archivos = execFileSync('git', ['ls-files', 'app/automations'], { cwd: new URL('..', import.meta.url), encoding: 'utf8' })
    .split(/\r?\n/).filter((f) => /\.(ts|tsx)$/.test(f) && existsSync(new URL(`../${f}`, import.meta.url)));
  assert.ok(archivos.length > 10, `se leyeron ${archivos.length} archivos: el barrido quedó viejo`);
  for (const f of archivos) {
    const src = fuente(f);
    assert.doesNotMatch(src, /from '[^']*MensajeMakoLienzo'|from '[^']*TemplateDetalleModal'|from '[^']*chatbot-mensajes-mako'/, `${f} importa la lista vieja`);
  }
  // Y /automations ya no lee el endpoint de Notificaciones ni el link `?aviso=`.
  const app = fuente('app/automations/ChatAgentApp.tsx');
  assert.doesNotMatch(app, /\/api\/perfil\/plantillas|PARAM_AVISO|cargarAvisos|cargarOcultos|restaurarMensaje/);
});

// ── 3. «＋ Nuevo mensaje» y la galería ────────────────────────────────────────────

const galeria = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(GaleriaPlantillas, {
  productos: [], onCerrar: () => {}, onBlanco: () => {}, onCreada: () => {}, ...extra,
} as Parameters<typeof GaleriaPlantillas>[0]));
/** Las plantillas dibujadas, en el orden de la grilla. */
const dibujadas = (html: string) => [...html.matchAll(/data-plantilla="([^"]+)"/g)].map((m) => m[1]);

test('3. «＋ Nuevo mensaje» abre la galería en la sección «MaKo en WhatsApp», por la MISMA puerta que «＋ Nueva»', () => {
  const lista = fuente('app/automations/SimuladorWhatsApp.tsx');
  assert.match(lista, /onClick=\{\(\) => nueva\('mako'\)\} className="chb-nueva" data-nuevo-mensaje/);
  // La puerta pregunta por lo no publicado y lleva la sección hasta quien monta.
  const nueva = bloque(lista, 'const nueva = (seccion?: SeccionGaleria) => {', '\n  };\n');
  assert.match(nueva, /if \(sinPublicar\) \{ setPendiente\(\{ ir: 'nueva', seccion \}\); return; \}\n\s+onNueva\(seccion\);/);
  assert.match(lista, /if \(p\.ir === 'nueva'\) onNueva\(p\.seccion\);/);
  const app = fuente('app/automations/ChatAgentApp.tsx');
  assert.match(app, /const abrirGaleria = \(seccion\?: SeccionGaleria\) => \{ setErrCrear\(null\); setGaleria\(\{ seccion \}\); \};/);
  assert.match(app, /onNueva=\{abrirGaleria\}/);
  assert.match(app, /<GaleriaPlantillas productos=\{productos\} onCerrar=\{\(\) => setGaleria\(false\)\} seccion=\{galeria\.seccion\}/);
  // ⚠️ DESDE LA DÉCIMA TANDA (11/10/2026, docs/diseno-automations-galeria-v2.md §1) YA NO LLEVA CON SCROLL a una sección:
  // abre con el FILTRO Canal = «MaKo en WhatsApp» puesto. Lo que se ve: «Lienzo en blanco» y sólo las de MaKo.
  const gal = fuente('app/automations/GaleriaPlantillas.tsx');
  assert.match(gal, /useState<string\[\]>\(\(\) => filtroDeSeccion\(p\.seccion\)\)/);
  assert.doesNotMatch(gal, /scrollIntoView|CADA_MS|INTENTOS_MAX/, 'volvió el scroll a la sección');
  const html = galeria({ seccion: 'mako' });
  assert.deepEqual(dibujadas(html).sort(), PLANTILLAS.filter(esPlantillaMako).map((p) => p.id).sort(), 'con «＋ Nuevo mensaje» no se ven sólo las de MaKo');
  assert.ok(html.indexOf('data-empezar="blanco"') > 0 && html.indexOf('data-empezar="blanco"') < html.indexOf('data-plantilla='), '«Lienzo en blanco» no va primera');
});

// Décima tanda: sin rótulos de sección, las de «MaKo en WhatsApp» van MEZCLADAS con las del Chatbot, con la MISMA tarjeta.
test('3. las cuatro de «MaKo en WhatsApp» van mezcladas con las del Chatbot, con la misma tarjeta y sin rótulos', () => {
  const html = galeria();
  const mako = PLANTILLAS.filter(esPlantillaMako);
  assert.deepEqual(mako.map((p) => p.id).sort(), ['mako-agendado', 'mako-charla', 'mako-cobranza', 'mako-reunion']);
  assert.deepEqual(dibujadas(html), PLANTILLAS.map((p) => p.id), 'no se dibujan todas, en el orden del catálogo');
  for (const p of PLANTILLAS) assert.match(html, new RegExp(`<button type="button" class="gal-tarjeta" data-plantilla="${p.id}"`), `«${p.id}» con otra tarjeta`);
  // Ni la sección aparte, ni los rótulos de antes, ni la sección de los «eliminados».
  assert.doesNotMatch(html, /data-galeria-mako|Desde una plantilla|O empieza así|¿Qué la dispara\?/);
  assert.doesNotMatch(html, new RegExp(`>${ROTULO_MENSAJES_MAKO}</div>`));
  assert.doesNotMatch(html, /data-galeria-ocultos|data-oculto=/);
  assert.ok(html.includes(BLANCO.nombre));
});

// ── 4. Las plantillas ────────────────────────────────────────────────────────────

const faltanEnAccion = (op: string, params: Record<string, unknown>): string[] => {
  const d = porId(op);
  return d ? faltanEnPaso(d.parametros, params, { leadId: 1 }) : [`«${op}» no está en el registro`];
};

test('4. las tres se pueden publicar: `validarGrafo`, `frenoDelFlujo` y lo que su emisor sabe correr (`frenoDelEvento`)', () => {
  for (const p of PLANTILLAS.filter(esPlantillaMako)) {
    assert.equal(p.cron.fijo, TRIGGER_AVISO_MAKO);
    const evento = p.cron.fijo === TRIGGER_AVISO_MAKO ? p.cron.evento : null;
    assert.ok(EVENTOS_MAKO.some((e) => e.subtipo === evento), `${p.id}: evento «${evento}»`);
    const pasos = normalizar(pasosDePlantilla(p));
    assert.deepEqual(validarGrafo(pasos), [], `${p.id}: no se publica`);
    assert.equal(frenoDelFlujo(pasos, faltanEnAccion), null, `${p.id}: el lienzo frena Publicar`);
    assert.equal(frenoDelEvento(pasos, evento), null, `${p.id}: el emisor de «${evento}» no la sabe correr`);
  }
  // Las dos cuyo texto arma el código dicen «Lo que arma MaKo» y nada más: sale EXACTAMENTE el texto de antes.
  // El nuevo agendado (décima tanda) también: el texto lo arman los webhooks de la agenda.
  for (const id of ['mako-reunion', 'mako-charla', 'mako-agendado']) {
    const p = plantillaPorId(id)!;
    assert.deepEqual(p.pasos.map((x) => x.accion?.params.mensaje), [`{{${CLAVE_MENSAJE_MAKO}}}`], `${id}: no es «Lo que arma MaKo»`);
  }
});

test('4. la cobranza trae la cadencia de antes con los textos LITERALES: entrada, 48 h, recordatorio, 72 h, último', () => {
  // Copiados a mano, a propósito: deducidos del catálogo darían verde sobre un texto que cambió en los dos lados.
  const ENTRADA = '💸 *Cobranza*: la cuota {{cuota_numero}} de {{lead_nombre}} venció hace {{cuota_dias}} — *{{cuota_monto}} sin cobrar*. Si ya se cobró, márcalo en su ficha. — MaKo';
  const A_LAS_48 = '💸 Sigue sin cobrarse la cuota {{cuota_numero}} de {{lead_nombre}} — {{cuota_monto}}, vencía el {{cuota_vence}}.\n\n👉 {{link_lead}} — MaKo';
  const A_LAS_72 = '💸 Último recordatorio por la cuota {{cuota_numero}} de {{lead_nombre}} ({{cuota_monto}}): si ya se cobró, márcalo en su ficha y dejo de insistir.\n\n👉 {{link_lead}} — MaKo';
  const p = plantillaPorId('mako-cobranza')!;
  assert.deepEqual(p.pasos.map((x) => [x.id, x.nodo ?? 'accion', x.espera?.minutos ?? null, x.accion?.params.mensaje ?? null, x.siguiente]), [
    ['mk_entrada', 'accion', null, ENTRADA, 'mk_e48'],
    ['mk_e48', 'esperar', 48 * 60, null, 'mk_48'],
    ['mk_48', 'accion', null, A_LAS_48, 'mk_e72'],
    ['mk_e72', 'esperar', 72 * 60, null, 'mk_72'],
    ['mk_72', 'accion', null, A_LAS_72, null],
  ]);
  // La entrada es lo que salía hasta el 11/10/2026: el `ejemplo` del aviso.
  assert.equal(CATALOGO_AVISOS.find((c) => c.id === 'cuota-vencida')?.ejemplo, ENTRADA);
});

type Llamada = { op: string; args: unknown[] };
function baseDeMentira(vivas: Array<{ nombre: string; trigger_tipo: string }> = []) {
  const llamadas: Llamada[] = [];
  const db: DbPlantilla = {
    from: () => ({
      select: () => ({ is: async () => { llamadas.push({ op: 'select', args: [] }); return { data: vivas, error: null }; } }),
      insert: (f) => ({ select: () => ({ single: async () => { llamadas.push({ op: 'insert', args: [f] }); return { data: { id: 700 + llamadas.length }, error: null }; } }) }),
      delete: () => ({ eq: async () => { llamadas.push({ op: 'delete', args: [] }); return { data: null, error: null }; } }),
    }),
  };
  return { db, llamadas };
}

test('4. crear una de evento: nace APAGADA con su CRON en la fila (evento incluido), antes de los pasos y sin la lista de CRON', async () => {
  const { db, llamadas } = baseDeMentira();
  const crones: unknown[] = [];
  const r = await crearDesdePlantilla('mako-cobranza', { db, clave: () => 'plantilla-k', setPasos: async () => {}, setDisparadores: async (_, l) => { crones.push(l); } });
  assert.equal(r.pide, null);
  const insertada = llamadas.find((l) => l.op === 'insert')!.args[0] as Record<string, unknown>;
  assert.equal(insertada.trigger_tipo, TRIGGER_AVISO_MAKO);
  assert.equal(insertada.activa, false);
  assert.deepEqual(insertada.disparadores, [{ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'cuota_vencida' }] satisfies Disparador[]);
  assert.equal(crones.length, 0, 'el CRON del evento no va por la lista de CRON (no se cambia)');
});

test('4. de un evento se crean VARIAS (salen todas); el recordatorio sigue siendo UNO por negocio', async () => {
  // Ya hay una de cobranza: se crea otra, con un número en el nombre.
  const yaHay = baseDeMentira([{ nombre: 'Cobranza de cuotas vencidas', trigger_tipo: TRIGGER_AVISO_MAKO }]);
  const otra = await crearDesdePlantilla('mako-cobranza', { db: yaHay.db, setPasos: async () => {}, setDisparadores: async () => {} });
  assert.equal(otra.nombre, 'Cobranza de cuotas vencidas 2');
  assert.ok(yaHay.llamadas.some((l) => l.op === 'insert'), 'no se creó la segunda del mismo evento');
  // Y la galería no la apaga.
  assert.equal(yaLaTiene(plantillaPorId('mako-cobranza')!, [TRIGGER_AVISO_MAKO]), false);
  const html = galeria({ triggersVivos: [TRIGGER_AVISO_MAKO, TRIGGER_RECORDATORIO] });
  const tarjeta = (id: string) => html.match(new RegExp(`<button[^>]*data-plantilla="${id}"[^>]*>`))?.[0] ?? '';
  for (const p of PLANTILLAS.filter(esPlantillaMako)) assert.doesNotMatch(tarjeta(p.id), /disabled/, `«${p.id}» se apagó con «Ya la tienes»`);
  assert.match(tarjeta('recordatorio-reunion'), /disabled/, 'el recordatorio que ya tiene se puede elegir otra vez');
  // El recordatorio, uno.
  const conRecordatorio = baseDeMentira([{ nombre: 'Mi recordatorio', trigger_tipo: TRIGGER_RECORDATORIO }]);
  await assert.rejects(
    crearDesdePlantilla('recordatorio-reunion', { db: conRecordatorio.db, setPasos: async () => {}, setDisparadores: async () => {} }),
    (e: unknown) => e instanceof PlantillaInvalidaError && /Ya la tienes/.test(e.message),
  );
});

// ── 5. Lo que se depreca ─────────────────────────────────────────────────────────

test('5. «Lo que arma MaKo» (`{{mensaje_mako}}`) se ofrece SÓLO con `conMensaje`: las dos que arma el código, no la cobranza', () => {
  const con = (ctx: Parameters<typeof variablesPara>[0]) => variablesPara(ctx).some((v) => v.key === CLAVE_MENSAJE_MAKO);
  assert.equal(con({ conLead: true, destino: 'equipo' }), false, 'se ofrece en una automatización de las de siempre');
  assert.equal(con({ conLead: true, conCuota: true, destino: 'equipo' }), false);
  assert.equal(con({ conLead: true, conMensaje: true, destino: 'equipo' }), true);
  assert.equal(con(datosDelEvento('reunion_pronto')), true);
  assert.equal(con(datosDelEvento('lead_contesta')), true);
  assert.equal(con(datosDelEvento('cuota_vencida')), false, 'la cobranza manda la plantilla, no un texto armado');
  // «Probar» lo dibuja con el ejemplo del aviso, y la cobranza con los datos de la cuota.
  assert.equal(ejemplosDelEvento('reunion_pronto')[CLAVE_MENSAJE_MAKO], CATALOGO_AVISOS.find((c) => c.id === 'reunion-recordatorio')!.ejemplo);
  assert.equal(ejemplosDelEvento('cuota_vencida').cuota_monto, 'US$ 1.700');
  assert.equal(CLAVE_MENSAJE_MAKO in ejemplosDelEvento('cuota_vencida'), false);
  assert.deepEqual(ejemplosDelEvento('no_existe'), {});
});

test('5. `listarPlantillas` deja afuera los tres eventos en las dos vistas, y la lista del cliente está vacía', () => {
  const listar = bloque(fuente('lib/plantillas.ts'), 'export async function listarPlantillas(', 'export async function getPlantilla(');
  assert.match(listar, /const base = \(agencia \? CATALOGO_AVISOS : CATALOGO_AVISOS\.filter\(\(c\) => esAvisoDelCliente\(c\.id\)\)\)\n\s+\.filter\(\(c\) => !AVISOS_POR_EVENTO\.has\(c\.id\)\);/,
    'los eventos de MaKo volvieron a listarse (en /mensajes serían un interruptor que no hace nada)');
  // El nuevo agendado es un evento desde la décima tanda: tampoco se lista en /mensajes.
  assert.deepEqual([...AVISOS_POR_EVENTO].sort(), ['cuota-vencida', 'reunion-nuevo-agendado', 'reunion-recordatorio', 'wa-mensaje-entrante']);
  assert.deepEqual(AVISOS_DEL_CLIENTE, [], '«Todos arrancan vacíos»: un mensaje de MaKo del cliente es una automatización');
  // El reporte de los lunes no se mudó: es del super admin y sale como siempre (sólo email).
  assert.ok(AVISOS_SOLO_SUPERADMIN.includes('reporte-semanal'));
  // Y la cobranza ya no corre una cadencia de fábrica al lado de la fila del negocio.
  const cat = CATALOGO_AVISOS.find((c) => c.id === 'cuota-vencida')!;
  assert.equal(cat.flujoPorDefecto, undefined);
  assert.equal(cat.correSuFlujo, undefined);
});

test('5. la ruta del NEGOCIO ya no oculta, recupera ni borra mensajes (y no lee `?ocultos=1`)', () => {
  const ruta = fuente('app/api/perfil/plantillas/route.ts');
  assert.doesNotMatch(ruta, /case 'ocultar'|case 'restaurar'|case 'borrar'|ocultarPlantilla|restaurarPlantilla|borrarPlantilla|PARAM_OCULTOS/);
});

test('5. MaKo no prende ni apaga los tres eventos (`configurar_aviso_whatsapp`), ni al proponer ni al confirmar', () => {
  const src = fuente('lib/api-mako/areas/equipo.run.ts');
  const op = bloque(src, 'configurar_aviso_whatsapp: {', 'quitar_destinatario_notificaciones: {');
  const preparar = bloque(op, 'preparar:', 'ejecutar:');
  const ejecutar = op.slice(op.indexOf('ejecutar:'));
  for (const [nombre, cuerpo, escritura] of [['proponer', preparar, 'getNotifPrefs()'], ['confirmar', ejecutar, 'setNotifPrefs(']] as const) {
    const g = cuerpo.indexOf('if (AVISOS_POR_EVENTO.has(aviso))');
    assert.ok(g > 0 && g < cuerpo.indexOf('avisoSilenciable(aviso)') && g < cuerpo.indexOf(escritura), `al ${nombre} no frena los eventos de MaKo antes de escribir`);
  }
  assert.match(src, /const MENSAJE_ES_AUTOMATIZACION = 'Ese mensaje es una automatización: se prende en Automations\.';/);
});

test('5. Configuraciones › Notificaciones ya no monta la lista de mensajes (ni el link a /automations)', () => {
  const panel = fuente('app/perfil/NotificacionesPanel.tsx');
  assert.doesNotMatch(panel, /PlantillasView|enlaceAMensajeMako|editarEnChatbot|\/api\/perfil\/plantillas/);
  assert.match(panel, /export function NotificacionesPanel\(\) \{/);
  assert.doesNotMatch(fuente('app/configuraciones/ConfigInnerTabs.tsx'), /mensajesEnChatbot/);
  assert.doesNotMatch(fuente('app/configuraciones/page.tsx'), /mensajesEnChatbot/);
});

// Mudado de tests/chatbot-mensajes-mako.test.ts (borrado el 11/10/2026): /mensajes sigue editando en el lugar.
test('5. sin `enlaceEditar` (el catálogo de la agencia en /mensajes) se sigue editando en el lugar', () => {
  const pv = fuente('app/agencia/PlantillasView.tsx');
  // La rama de siempre sigue: el «Editar» abre el detalle acá mismo.
  assert.match(pv, /onClick=\{\(\) => setVista\('editar'\)\} title="Editar plantilla"/);
  // /mensajes no lo pasa: es el catálogo entero de la agencia.
  assert.doesNotMatch(fuente('app/mensajes/MensajesMaKo.tsx'), /enlaceEditar/);
  assert.match(fuente('app/mensajes/MensajesMaKo.tsx'), /<PlantillasView iniciales=\{iniciales\} \/>/);
});

// ── 6. El CRON del emisor, dibujado ──────────────────────────────────────────────

const dibujarCron = (lista: Disparador[], extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(EditorDisparadores, {
  lista, editando: null, onEditar: () => {}, onGuardar: () => {},
  productos: [], etiquetas: [], disparadores: [{ value: TRIGGER_RECORDATORIO, label: 'Agendó una reunión' }],
  etiquetaEtapa: (k: string) => k, tz: 'America/Mexico_City', rolAdmin: true, ...extra,
}));

test('6. con un CRON del emisor no hay «＋ Nuevo CRON» ni «←»: dice lo que lo dispara y nada más', () => {
  const evento = dibujarCron([{ id: 'd1', trigger_tipo: TRIGGER_AVISO_MAKO, subtipo: 'cuota_vencida' }]);
  assert.match(evento, /data-cron-fijo[^>]*>Una cuota vence sin cobrarse</);
  const recordatorio = dibujarCron([{ id: 'd1', trigger_tipo: TRIGGER_RECORDATORIO }]);
  assert.match(recordatorio, /data-cron-fijo[^>]*>Agendó una reunión</);
  for (const [nombre, html] of [['evento', evento], ['recordatorio', recordatorio]] as const) {
    assert.doesNotMatch(html, /Nuevo CRON/, `${nombre}: ofrece «＋ Nuevo CRON»`);
    assert.doesNotMatch(html, /Elegir otro tipo/, `${nombre}: ofrece la «←»`);
    assert.doesNotMatch(html, /data-clase-cron=/, `${nombre}: abre la primera pantalla de clases`);
  }
  // Control: uno de Producto SÍ los tiene (el test mira algo que existe).
  const producto = dibujarCron([{ id: 'd1', trigger_tipo: 'etapa_actual', etapa: 'nuevo', funnel_id: 5 }], {
    productos: [{ funnelId: 5, productoId: 9, nombre: 'Curso', esDefault: true, origenEntrega: 'declarado', etapas: [{ value: 'nuevo', label: 'Nuevo' }], etapasEntrega: [] }],
  });
  assert.match(producto, /Nuevo CRON/);
  assert.match(producto, /Elegir otro tipo/);
  // Y la tarjeta CRON del lienzo tampoco ofrece «＋ Nuevo CRON» con uno del emisor.
  assert.match(fuente('app/automations/SecuenciaPerfil.tsx'), /onNuevoDisparador=\{rolAdmin && !esDelEmisor\(crons\.primero\) \? \(\) => setCronAbierto\('nuevo'\) : undefined\}/);
});

// ROTURAS (11/10/2026), una por vez, con un arnés (scratchpad `b-roturas.mjs`) que rompe, corre ESTE archivo y
// restaura DE MEMORIA (nunca con git checkout), comprobando con md5 el archivo byte a byte igual.
// Base: 17 pass / 0 fail; al final, igual. Las de este archivo (pass / fail):
//   · R1 las filas de evento en «Chatbot» (`partirLista` no las separa)       → 15 / 2 (las dos de la lista)
//   · R2 una coma menos en «Sigue sin cobrarse»                                → 16 / 1 (los textos literales)
//   · R3 `yaLaTiene` también para un evento                                    → 16 / 1 (se crean varias)
//   · R4 el panel del CRON ofrece «＋ Nuevo CRON» con uno del emisor           → 16 / 1 (el CRON del emisor)
//   · R5 `listarPlantillas` vuelve a listar los tres eventos                   → 16 / 1 (lo que se depreca)
//   · R6 la fila de un evento nace sin su CRON (sin `disparadores`)            → 16 / 1 (crear una de evento)
