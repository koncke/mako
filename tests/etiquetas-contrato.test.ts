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

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { TABLAS_DE_INQUILINO } from '../lib/tablas-de-inquilino';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';

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
  assert.match(editor, /p\.nombre === 'etiquetaId'[\s\S]{0,400}<SelectorEtiqueta/, 'un etiquetaId se elige de un desplegable, no se tipea');
  for (const f of ['app/crm/LeadSheet.tsx', 'app/crm/[id]/LeadDetailBody.tsx']) {
    assert.match(sinComentarios(leer(f)), /<EtiquetasDelLead leadId=\{lead\.id\} \/>/, `${f} no muestra las etiquetas del lead`);
  }
  const chips = sinComentarios(leer('app/crm/lead-view/EtiquetasDelLead.tsx'));
  assert.match(chips, /useRefrescarFicha\(\)/);
  assert.doesNotMatch(chips, /router\.refresh\(\)/);
  const ruta = sinComentarios(leer('app/api/crm/etiquetas/route.ts'));
  const crud = bloque(ruta, "if (action === 'crear' || action === 'editar' || action === 'archivar') {", "\n  }\n");
  assert.match(crud, /getRolWsEfectivo\(\)\) !== 'admin'\) return malo\(/, 'el CRUD es del admin, y lo decide el server');
});
