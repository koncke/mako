// =============================================================================
// Las etiquetas del CRM (mig 0224): el contrato con el resto del producto
// =============================================================================
// Lo que el motor de las etiquetas (tests/etiquetas-motor.test.ts) no puede ver porque vive en
// otros archivos: que las dos tablas estén acotadas por cliente y se vacíen con él, que el
// catálogo se clone y lo de cada lead no, que un segmento de email desconocido NO caiga a
// «activos» (le escribía a todos), que las siete operaciones existan con los nombres que pidió
// la sesión de la API de MaKo, que los ganchos de etapa estén enchufados en los tres lugares que
// mueven a un lead, y que la sincronización con WhatsApp vaya por la línea de la etiqueta y lea
// la respuesta.
//
// Se lee el FUENTE de los módulos con `server-only` (no se pueden importar bajo tsx), sin
// comentarios y recortando cada función hasta su cierre real (AGENTS.md: un guard que lee el
// archivo entero encuentra lo que el archivo dice de sí).
//
// Correr: node --import tsx --test tests/etiquetas-contrato.test.ts
//
// ⚠️ PROBADO ROMPIÉNDOLO (08/10/2026), una rotura por vez, restaurando de memoria (E-romper.py).
// Con todo puesto: 9 pass / 0 fail. Diez roturas, las diez cazadas (1 fallo cada una):
//   1. sacar 'crm_lead_etiquetas' de TENANT_TABLES (lib/workspace.ts);
//   2. sacar 'crm_etiquetas' de TABLAS_DE_INQUILINO;
//   3. devolver el `default:` de `filtroSegmento` a «activos»;
//   4. `crearBroadcast` con el fallback viejo `esSegmentoValido(x) ? x : 'activos'`;
//   5. `poner_etiqueta_lead` sin el canal http;
//   6. el CRUD sin `rolMinimo: 'admin'` (crear_etiqueta con TAB);
//   7. sacar el gancho de `setPipelineStage`;
//   8. volver a `void actualizarEtiquetaLead(id).catch(() => {})`;
//   9. `etiquetarChatWhatsApp` aceptando `r.ok` sin mirar `add`/`remove`;
//  10. clonar también `crm_lead_etiquetas`.
//
// ⚠️ Y LA REVISIÓN ADVERSARIAL DEL 08/10/2026 (parte E). Con todo puesto: 17 pass / 0 fail.
// Veinticinco roturas más (arnés romper-E.mjs en el scratchpad, restaura de memoria), las
// veinticinco cazadas (16 pass / 1 fail cada una):
//   etiquetas-3/datos-2 · updateLead sin el espejo de la etapa derivada · Calendly sin espejo (el
//     lead que nace agendado, y aparte el que ya estaba) · «volver a la derivación» sin espejo ·
//     el cron del CRM automático sin el barrido · el barrido sincronizando adentro de la vuelta ·
//     la foto fechada antes de aplicar · el barrido deshaciendo lo que tocó una persona;
//   etiquetas-4/datos-3 · el espejo ignorando el contexto de lote · el lote corriendo sin contexto
//     · el lote sin sincronizar al final · un lote cortado sin sincronizar lo que ya movió;
//   etiquetas-5 · los chips sin escuchar la versión · la ficha sin pasarla;
//   etiquetas-6/datos-5 · el selector sin nombrar la archivada · MaKo con su propia frase;
//   datos-7 · HTTP mandando el email de quien la puso;
//   datos-6 · clonar-config copiando las secuencias tal cual · dejando los adjuntos del dueño ·
//     datos-mau sin traducir etiquetas · su dedup de etiquetas sin normalizar;
//   etiquetas-2 · /email guardando «etiqueta_puesta» sin etiqueta · la ruta con 500 en vez de 400 ·
//     el alta de /email sin selector · MaKo creando por etiqueta sin validar.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import { controlDe } from '../lib/editor-acciones';

const RAIZ = join(__dirname, '..');
const leer = (p: string) => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const sinComentariosSql = (src: string) => src.replace(/--.*$/gm, '');
/** De `abre` hasta `cierra` (el cierre REAL del bloque, no un número de caracteres). */
const bloque = (src: string, abre: string, cierra: string): string => {
  const i = src.indexOf(abre);
  assert.ok(i >= 0, `no encontré «${abre}»`);
  const f = src.indexOf(cierra, i + abre.length);
  assert.ok(f > i, `no encontré el cierre «${cierra}» después de «${abre}»`);
  return src.slice(i, f);
};

test('las dos tablas: acotadas por cliente (TENANT_TABLES) y vaciadas con él (TABLAS_DE_INQUILINO)', () => {
  const ws = sinComentarios(leer('lib/workspace.ts'));
  const set = bloque(ws, 'const TENANT_TABLES = new Set<string>([', ']);');
  for (const t of ['crm_etiquetas', 'crm_lead_etiquetas']) {
    assert.ok(set.includes(`'${t}'`), `${t} no está en TENANT_TABLES: getTenantDb() sería PASSTHROUGH y mostraría las de todos`);
    assert.ok((TABLAS_DE_INQUILINO as readonly string[]).includes(t), `${t} no está en TABLAS_DE_INQUILINO: el reset y el borrado de un cliente la dejarían`);
  }
});

test('la migración 0224: RLS + revoke en las dos, nombre único entre las vivas, una fila por (lead, etiqueta)', () => {
  const sql = sinComentariosSql(leer('supabase/migrations/0224_crm_etiquetas.sql'));
  for (const t of ['crm_etiquetas', 'crm_lead_etiquetas']) {
    assert.match(sql, new RegExp(`alter table ${t} enable row level security`), `${t} sin RLS`);
    assert.match(sql, new RegExp(`revoke all on ${t} from anon, authenticated`), `${t} sin revoke`);
  }
  assert.match(sql, /on crm_etiquetas \(workspace_id, lower\(btrim\(nombre\)\)\) where archivada_at is null/);
  assert.match(sql, /unique \(lead_id, etiqueta_id\)/);
  // Una fila de un lead sólo puede nombrar una etiqueta de SU negocio.
  assert.match(sql, /foreign key \(workspace_id, etiqueta_id\)\s*references crm_etiquetas \(workspace_id, id\)/);
  // El vínculo es el PAR: un funnel sin etapa no significa nada.
  assert.match(sql, /check \(funnel_id is null or etapa_key is not null\)/);
});

test('se clona el CATÁLOGO, nunca qué lead tiene cuál', () => {
  const src = sinComentarios(leer('lib/clonar-config.ts'));
  const tablas = bloque(src, 'const TABLAS: TablaClon[] = [', '\n];');
  assert.match(tablas, /tabla: 'crm_etiquetas'/);
  assert.doesNotMatch(src, /crm_lead_etiquetas/, 'qué lead tiene cuál es un dato operativo: no se copia a un workspace de prueba');
});

test('email: un segmento que no existe NO cae a «activos», y la etiqueta es un segmento', () => {
  const src = sinComentarios(leer('lib/email-marketing.ts'));
  const filtro = bloque(src, 'function filtroSegmento<', '\n}\n');
  assert.match(filtro, /default:\s*throw new Error/, 'el default de filtroSegmento tiene que tirar, no escribirle a todos los activos');
  assert.doesNotMatch(filtro, /case 'activos':\s*default:/);
  const crear = bloque(src, 'export async function crearBroadcast(', '\n}\n');
  assert.doesNotMatch(crear, /esSegmentoValido\([^)]*\)\s*\?\s*[^:]+:\s*'activos'/, 'un segmento inválido se guardaba como «activos»');
  assert.match(crear, /validarSegmento\(/);
  assert.match(bloque(src, 'export async function actualizarBroadcast(', '\n}\n'), /validarSegmento\(/);
  const leads = bloque(src, 'export async function leadsDeSegmento(', '\n}\n');
  assert.ok(leads.indexOf('etiquetaDeSegmento(') >= 0 && leads.indexOf('etiquetaDeSegmento(') < leads.indexOf('filtroSegmento('), 'la etiqueta se resuelve antes del filtro de leads');
  assert.match(bloque(src, 'export const TRIGGERS', '\n];'), /value: 'etiqueta_puesta'/);
});

test('las siete operaciones, con los nombres del contrato (leadId + etiquetaId) y por HTTP', () => {
  const lecturas = ['listar_etiquetas', 'etiquetas_lead'];
  const crud = ['crear_etiqueta', 'editar_etiqueta', 'archivar_etiqueta'];
  const lead = ['poner_etiqueta_lead', 'sacar_etiqueta_lead'];
  for (const id of [...lecturas, ...crud, ...lead]) {
    const d = porId(id);
    assert.ok(d, `falta la operación ${id}`);
    assert.equal(d!.area, 'crm');
    assert.ok(d!.canales.includes('http'), `${id} no sale por HTTP (la sesión de la API pidió su ruta REST)`);
  }
  for (const id of [...crud, ...lead]) {
    const d = porId(id)!;
    assert.ok(esAccion(d) && d.confirmacion === 'chat' && d.costo === 'gratis' && d.reversible === true, `${id}: acción gratis, reversible, por chat`);
  }
  for (const id of crud) assert.equal(porId(id)!.gating?.rolMinimo, 'admin', `${id}: el CRUD es del admin`);
  for (const id of lead) {
    assert.notEqual(porId(id)!.gating?.rolMinimo, 'admin', `${id}: poner y sacar son de cualquiera del CRM`);
    assert.deepEqual(porId(id)!.parametros.map((p) => p.nombre), ['leadId', 'etiquetaId']);
    assert.ok(porId(id)!.parametros.every((p) => p.obligatorio && p.tipo === 'number' && p.entero));
  }
});

test('los ganchos de etapa están enchufados donde se mueve a un lead (y se esperan)', () => {
  const leads = sinComentarios(leer('lib/leads.ts'));
  assert.match(bloque(leads, 'export async function setBoardStageOverride(', '\nexport async function saveLeadMeta('), /espejarEtiquetasDeEtapa\(/);
  assert.match(bloque(leads, 'export async function setPipelineStage(', '\nexport '), /await espejarEtiquetasDeEtapa\(/);
  assert.match(bloque(leads, 'async function espejarEtiquetasDeEtapa(', '\n}\n'), /await import\('\.\/etiquetas'\)/);
  const funnel = sinComentarios(leer('lib/lead-funnel.ts'));
  assert.match(bloque(funnel, 'export async function moverEtapaEnProducto(', '\nexport '), /await espejarEtapa\(leadId, funnelId, fila\.etapa, etapa/);
  // El patrón viejo (lanzado sin esperar y con el error tragado) no vuelve.
  assert.doesNotMatch(leads, /void actualizarEtiquetaLead\(/);
});

test('lib/etiquetas.ts: el disparo es el evento de la parte M, y ningún error se traga mudo', () => {
  const src = sinComentarios(leer('lib/etiquetas.ts'));
  assert.match(src, /await import\('\.\/nutricion'\)/);
  assert.match(src, /enrolarPorEvento\(leadId, 'etiqueta', \{ etiquetaId \}\)/);
  assert.doesNotMatch(src, /\.catch\(\(\) => \{\s*\}\)/, 'un .catch(() => {}) mudo es el patrón que dejó la sincronización vieja sin rastro');
  assert.doesNotMatch(src, /^\s*void /m, 'lo que sincroniza afuera se ESPERA');
});

test('WhatsApp: por la línea de la etiqueta, y «res.ok» no es «se puso»', () => {
  const src = sinComentarios(leer('lib/evolution.ts'));
  const f = bloque(src, 'export async function etiquetarChatWhatsApp(', '\n}\n');
  assert.match(f, /lineaEstricta\(linea\)/, 'la etiqueta existe en UNA línea: no se cae a la de por default');
  assert.match(f, /r\.data\?\.\[action\] !== true/, 'hay que exigir el add/remove que devuelve handleLabel');
});

test('las pantallas: el selector del paso «⚡ Acción», la ficha y la ruta', () => {
  const editor = sinComentarios(leer('app/_components/EditorAccionMako.tsx'));
  // Desde la tercera tanda (09/10/2026) el control de cada parámetro lo decide `controlDe`
  // (lib/editor-acciones.ts) y el editor dibuja por caso.
  assert.equal(controlDe({ nombre: 'etiquetaId', tipo: 'number' }), 'etiqueta', 'un etiquetaId se elige de un desplegable, no se tipea');
  assert.match(editor, /case 'etiqueta':[\s\S]{0,400}<SelectorEtiqueta/, 'un etiquetaId se elige de un desplegable, no se tipea');
  for (const f of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(sinComentarios(leer(f)), /<EtiquetasDelLead leadId=\{lead\.id\}[^>]*\/>/, `${f} no muestra las etiquetas del lead`);
  }
  const chips = sinComentarios(leer('app/crm/lead-view/EtiquetasDelLead.tsx'));
  assert.match(chips, /useRefrescarFicha\(\)/);
  assert.doesNotMatch(chips, /router\.refresh\(\)/);
  const ruta = sinComentarios(leer('app/api/crm/etiquetas/route.ts'));
  const crud = bloque(ruta, "if (action === 'crear' || action === 'editar' || action === 'archivar') {", "\n  }\n");
  assert.match(crud, /getRolWsEfectivo\(\)\) !== 'admin'\) return malo\(/, 'el CRUD es del admin, y lo decide el server');
});

// ── Revisión adversarial del 08/10/2026 (parte E) ────────────────────────────

test('etiquetas-3 / datos-2: el espejo sigue a la etapa DERIVADA (updateLead, Calendly y «volver a la derivación»)', () => {
  const leads = sinComentarios(leer('lib/leads.ts'));
  const update = bloque(leads, 'export async function updateLead(', '\nexport async function ');
  assert.match(update, /const antes = pipelineStageOf\(actual\);\s*const despues = pipelineStageOf\(data as Lead\);\s*if \(antes !== despues\) await espejarEtiquetasDeEtapa\(id, actual\.funnel_id \?\? null, antes, despues\);/,
    'updateLead tiene que espejar cuando cambia la etapa EFECTIVA (fechas, asistencia, desenlace)');
  const calendly = bloque(leads, 'export async function upsertLeadFromCalendly(', '\nexport ');
  // Calendly: el lead que ya estaba (contra su etapa de antes) y el que nace agendado (entra).
  assert.match(calendly, /if \(!soloVacios\) \{\s*const antes = pipelineStageOf\(existing\);\s*const despues = pipelineStageOf\(data as Lead\);\s*if \(antes !== despues\) await espejarEtiquetasDeEtapa\(existing\.id,/);
  assert.match(calendly, /if \(!soloVacios\) await espejarEtiquetasDeEtapa\(\(data as Lead\)\.id, \(data as Lead\)\.funnel_id \?\? null, null, pipelineStageOf\(data as Lead\)\)/);
  const override = bloque(leads, 'export async function setBoardStageOverride(', '\nexport async function saveLeadMeta(');
  assert.match(override, /const nueva = stageKey \?\? \(antes \? deriveStageKey\(\{ \.\.\.antes, pipeline_stage: null \}\) : null\);\s*if \(antes && nueva && pipelineStageOf\(antes\) !== nueva\) await espejarEtiquetasDeEtapa\(/,
    'volver a la derivación también cambia la etapa que se ve');
});

test('etiquetas-3 / datos-2: el barrido corre en el cron del CRM automático (no en el de nutrición) y compara contra la foto', () => {
  const cron = sinComentarios(leer('app/api/cron/crm-automatico/route.ts'));
  assert.match(cron, /await conciliarEspejoEtapasTodos\(\{ soloWs, hastaMs: Date\.now\(\) \+ ESPEJO_MS \}\)/);
  assert.doesNotMatch(sinComentarios(leer('app/api/cron/nutricion/route.ts')), /conciliarEspejo/, 'el cron de nutrición inscribe y manda: el espejo no va ahí');
  const et = sinComentarios(leer('lib/etiquetas.ts'));
  const barrido = bloque(et, 'export async function conciliarEspejoEtapas(', '\nexport async function conciliarEspejoEtapasTodos(');
  assert.match(barrido, /planEspejo\(foto, actuales, vivos, productos,/, 'compara contra la FOTO, no contra el estado');
  assert.match(barrido, /espejarEtapaCon\(p, t\.leadId, t\.productoId, t\.desde, t\.hacia, MAKO_SETTER, \{ sincronizar: false \}\)/, 'sin sincronizar adentro de la vuelta');
  assert.match(barrido, /sincronizarEtiquetasDiferidas\(porSincronizar\)/, 'y la sincronización al final, con tope');
  assert.match(barrido, /getSettingEstricto\(KEY_FOTO_ESPEJO\)/, '«no pude leer la foto» no es «no hay foto»');
  assert.ok(barrido.indexOf('plan.foto.at = new Date().toISOString()') > barrido.indexOf('sincronizarEtiquetasDiferidas('), 'la foto se fecha DESPUÉS de aplicar');
  assert.match(barrido, /suyas\?\.has\(claveNombre\(e\.nombre\)\)/, 'lo que una persona tocó desde la foto no se deshace');
});

test('etiquetas-4 / datos-3: mover en lote no sincroniza lead por lead; sincroniza al final con tope', () => {
  const acc = sinComentarios(leer('app/crm/actions.ts'));
  const lote = bloque(acc, 'export async function moverLeadsDeEtapaAction(', '\n}\n');
  // El MISMO camino de a uno, adentro del contexto de lote (el flag llega hasta el espejo).
  assert.match(lote, /const \{ sinSincronizar \} = await conLoteDeEtiquetas\(async \(\) => \{\s*for \(const id of ids\) \{\s*try \{\s*const r = await setLeadStageAction\(id, stageKey\);/);
  const et = sinComentarios(leer('lib/etiquetas.ts'));
  const espejo = bloque(et, 'export async function espejarEtapa(', '\n}\n');
  assert.match(espejo, /const lote = loteStore\.getStore\(\);\s*const r = await espejarEtapaCon\(puertos\(\), leadId, funnelId, desde, hacia, autor, \{ sincronizar: !lote \}\);\s*if \(lote\) lote\.cambios\.push\(\.\.\.r\.cambios\);/);
  const conLote = bloque(et, 'export async function conLoteDeEtiquetas<', '\n}\n');
  assert.ok(conLote.indexOf('sincronizarEtiquetasDiferidas(lote.cambios)') > conLote.indexOf('loteStore.run(lote, fn)'), 'la sincronización va DESPUÉS del lote');
  assert.equal((conLote.match(/sincronizarEtiquetasDiferidas\(lote\.cambios\)/g) ?? []).length, 2, 'también si el lote se corta: lo que ya se movió se pasa o deja rastro');
});

test('etiquetas-5: los chips de la ficha se releen cuando cambia la etapa (la ficha y la ruta les pasan la versión)', () => {
  const chips = sinComentarios(leer('app/crm/lead-view/EtiquetasDelLead.tsx'));
  assert.match(chips, /useEffect\(\(\) => \{ void leer\(\); \}, \[leer, version\]\)/);
  for (const f of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(sinComentarios(leer(f)), /<EtiquetasDelLead leadId=\{lead\.id\} version=\{versionDeEtiquetas\(lead\.updated_at, fichaProd\.productos\)\} \/>/, f);
  }
});

test('etiquetas-6 / datos-5: el selector NOMBRA la etiqueta archivada que ya está elegida', () => {
  const sel = sinComentarios(leer('app/_components/etiquetas-cliente.tsx'));
  const comp = bloque(sel, 'export function SelectorEtiqueta(', '\n}\n');
  assert.match(comp, /const fuera = !accion && value != null && etiquetas != null && !etiquetas\.some\(\(e\) => e\.id === value\);/);
  assert.match(comp, /label: deFuera \? nombreConEstado\(deFuera\) : 'Una etiqueta que ya no está'[^}]*disabled: true/);
  assert.match(sel, /fetch\('\/api\/crm\/etiquetas\?archivadas=1'/);
  // Y la frase de archivar es UNA para la pantalla y para MaKo.
  assert.match(sinComentarios(leer('app/crm/EditorEtiquetas.tsx')), /consecuenciaDeArchivar\(u\)/);
  assert.match(sinComentarios(leer('lib/api-mako/areas/crm.run.ts')), /consecuenciaDeArchivar\(u\)/);
});

test('datos-7: por HTTP, etiquetas_lead no expone el email de quien la puso', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
  const r = bloque(run, '  etiquetas_lead: {', '\n  },\n');
  assert.match(r, /puesta_por: ctx\.canal === 'http' \? autorPublico\(e\.puesta_por\) : e\.puesta_por/);
});

test('datos-6: los clonadores copian el catálogo de etiquetas ANTES y traducen los ids de las secuencias', () => {
  const cc = sinComentarios(leer('lib/clonar-config.ts'));
  const tablas = bloque(cc, 'const TABLAS: TablaClon[] = [', '\n];');
  assert.ok(tablas.indexOf("tabla: 'crm_etiquetas'") >= 0 && tablas.indexOf("tabla: 'crm_etiquetas'") < tablas.indexOf("tabla: 'nutricion_secuencias'"), 'el mapa de etiquetas sale de la copia del catálogo: va ANTES');
  assert.match(tablas, /cols: \[[^\]]*'etiqueta_id'[^\]]*\],\s*forzar: \{ activa: false \},\s*preparar: secuenciaParaElDestino/);
  const prep = bloque(cc, 'function secuenciaParaElDestino(', '\n}\n');
  assert.match(prep, /traducirEtiquetasEnSecuencia\(r\.pasos, r\.etiqueta_id,/);
  assert.match(prep, /for \(const k of \['audio_id', 'media_id'\]\) if \(o\[k\] != null\) \{ o\[k\] = null;/, 'los adjuntos del dueño no viajan');
  const dm = sinComentarios(leer('lib/datos-mau.ts'));
  const setting = bloque(dm, '  setting: {', "\n    nota: 'Los audios");
  assert.ok(setting.indexOf("tabla: 'crm_etiquetas'") >= 0 && setting.indexOf("tabla: 'crm_etiquetas'") < setting.indexOf("tabla: 'nutricion_secuencias'"));
  assert.match(setting, /normalizarDedup: claveNombre/);
  assert.match(setting, /remapEtiquetas: true/);
  assert.match(bloque(dm, 'async function copiarTabla(', '\n}\n'), /traducirEtiquetasEnSecuencia\(f\.pasos, f\.etiqueta_id,/);
});

test('etiquetas-2: «Se le puso una etiqueta» no se guarda sin la etiqueta (/email, su ruta y la API de MaKo)', () => {
  const em = sinComentarios(leer('lib/email-marketing.ts'));
  const act = bloque(em, 'export async function actualizarMetaEmailSecuencia(', '\n}\n');
  assert.match(act, /if \(porEtiqueta\) await fijarDisparadorEtiqueta\(id, patch\.etiqueta_id\)/);
  assert.match(bloque(em, 'export async function crearEmailSecuencia(', '\n}\n'), /await fijarDisparadorEtiqueta\(id, etiquetaId\)/);
  const fijar = bloque(em, 'async function fijarDisparadorEtiqueta(', '\n}\n');
  assert.match(fijar, /setTriggerSecuencia\(id, \{ trigger_tipo: TRIGGER_ETIQUETA, etiqueta_id: n \}\)/, 'la etiqueta la escribe la puerta de los disparadores');
  assert.match(sinComentarios(leer('app/api/email/secuencias/route.ts')), /if \(e instanceof DisparadorEmailError\) return Response\.json\(\{ ok: false, error: e\.message \}, \{ status: 400 \}\)/);
  const app = sinComentarios(leer('app/email/EmailApp.tsx'));
  assert.equal((app.match(/<SelectorEtiqueta /g) ?? []).length, 2, 'el editor y el alta muestran el selector');
  const run = sinComentarios(leer('lib/api-mako/areas/email.run.ts'));
  assert.equal((run.match(/await errorEtiquetaDelTrigger\(/g) ?? []).length, 2, 'crear y editar por MaKo validan la etiqueta antes del «sí»');
});
