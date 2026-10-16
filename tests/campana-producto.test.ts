// =============================================================================
// Campañas y conjuntos de Meta → producto (05/10/2026)
// =============================================================================
// La lógica pura se EJECUTA (lib/campana-config.ts no tiene `server-only` para eso);
// lo que cuelga de Supabase y de Meta se fija leyendo el bloque, no el archivo.
//
// PROBADO ROMPIÉNDOLO — los números están al lado de cada test que los tiene.
//
// ⚠️ DESDE EL 06/10/2026 TRAER LOS LEADS DE UNA CAMPAÑA LOS AGREGA, NO LOS MUEVE. Martín:
// «No se debe "Mover" se debe agregar al otro producto». La asignación de la CAMPAÑA sí
// se mueve (una campaña rutea a un solo producto); sus LEADS no salen de donde están: el
// destino gana una fila de `lead_funnel` (mig 0207, lib/lead-funnel.ts).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  parsearCampanas, conCampana, sinCampana, funnelIdDeCampana, asignadasDe, esIdMeta,
  type CampanaAsignada,
} from '../lib/campana-config';
import {
  mapaDeAnuncios, campanaDeLead, leadsATraer, conteoPorCampana, campanasDeMetricas, repartirPorItem,
  type LeadAtribuible,
} from '../lib/campana-atribucion';
import { casaParaEscribir } from '../lib/lead-funnel-reglas';

const C = (id: string, funnelId: number | null, nombre = `camp ${id}`): CampanaAsignada =>
  ({ tipo: 'campana', id, nombre, funnelId });
const S = (id: string, campanaId: string, funnelId: number | null): CampanaAsignada =>
  ({ tipo: 'conjunto', id, nombre: `conj ${id}`, campanaId, funnelId });

// ── El saneo ─────────────────────────────────────────────────────────────────

test('parsear tolera basura y nunca tira: sin config, el lead cae donde caía', () => {
  for (const crudo of [null, '', '   ', 'no es json', '{"a":1}', '42', 'null']) {
    assert.deepEqual(parsearCampanas(crudo), [], `«${crudo}» tiene que dar []`);
  }
});

test('parsear descarta ids que no son de Meta y no repite un id', () => {
  const r = parsearCampanas(JSON.stringify([
    { tipo: 'campana', id: '120251610405990661', nombre: 'A', funnelId: 7 },
    { tipo: 'campana', id: '120251610405990661', nombre: 'A otra vez', funnelId: 9 },
    { tipo: 'campana', id: 'Campaña de verano', nombre: 'un NOMBRE no es una clave', funnelId: 7 },
    { tipo: 'campana', id: '12', nombre: 'demasiado corto', funnelId: 7 },
  ]));
  assert.equal(r.length, 1);
  assert.equal(r[0].nombre, 'A', 'gana la primera: el mapa no puede tener la misma campaña dos veces');
});

test('el funnelId llega como STRING (bigint) y se sanea a número; basura → null', () => {
  const r = parsearCampanas(JSON.stringify([
    { id: '111111111111', funnelId: '13' },
    { id: '222222222222', funnelId: 'x' },
    { id: '333333333333', funnelId: -4 },
    { id: '444444444444' },
  ]));
  assert.deepEqual(r.map((x) => x.funnelId), [13, null, null, null]);
});

// ── La ASIGNACIÓN de una campaña se mueve (sus leads, no: ver más abajo) ─────

test('asignar una campaña que ya está en otro producto la MUEVE, conservando su lugar', () => {
  const antes = [C('111111111111', 1), C('222222222222', 2), C('333333333333', 3)];
  const despues = conCampana(antes, C('222222222222', 9));
  assert.ok(despues);
  assert.equal(despues.length, 3, 'no puede quedar en dos productos');
  assert.equal(despues[1].id, '222222222222', 'conserva la posición');
  assert.equal(despues[1].funnelId, 9);
  assert.deepEqual(sinCampana(despues, '222222222222').map((x) => x.id), ['111111111111', '333333333333']);
});

// ── La precedencia y los TRES estados ────────────────────────────────────────
// PROBADO ROMPIÉNDOLO: con la búsqueda por conjunto borrada de `funnelIdDeCampana`
// (quedando sólo la de campaña), fallan «el conjunto gana» y «un conjunto solo».

test('el CONJUNTO gana a la campaña: lo más específico es lo que alguien eligió', () => {
  const lista = [C('111111111111', 1), S('999999999999', '111111111111', 2)];
  const r = funnelIdDeCampana(lista, { campaignId: '111111111111', adsetId: '999999999999' });
  assert.ok(r.asignada);
  assert.equal(r.funnelId, 2);
  // Otro conjunto de la misma campaña, sin asignar: decide la campaña.
  const r2 = funnelIdDeCampana(lista, { campaignId: '111111111111', adsetId: '888888888888' });
  assert.ok(r2.asignada);
  assert.equal(r2.funnelId, 1);
});

test('un conjunto asignado enruta aunque su campaña no lo esté', () => {
  const r = funnelIdDeCampana([S('999999999999', '111111111111', 5)], { campaignId: '111111111111', adsetId: '999999999999' });
  assert.ok(r.asignada);
  assert.equal(r.funnelId, 5);
});

test('«nadie la asignó» y «la asignaron al del negocio» son DOS respuestas distintas', () => {
  // Con un solo `number | null`, las dos serían null y el opt-in no podría saber si la
  // campaña tiene que ganarle a la landing o dejarla decidir.
  const libre = funnelIdDeCampana([C('111111111111', 4)], { campaignId: '777777777777' });
  assert.equal(libre.asignada, false);
  const alNegocio = funnelIdDeCampana([C('777777777777', null)], { campaignId: '777777777777' });
  assert.ok(alNegocio.asignada);
  assert.equal(alNegocio.funnelId, null);
});

test('sin ids, nada está asignado', () => {
  assert.equal(funnelIdDeCampana([C('111111111111', 1)], {}).asignada, false);
  assert.equal(funnelIdDeCampana([C('111111111111', 1)], { campaignId: null, adsetId: '  ' }).asignada, false);
});

test('esIdMeta: un utm_campaign con NOMBRE no matchea nunca (cae a la landing, que es lo seguro)', () => {
  assert.equal(esIdMeta('120251610405990661'), true);
  for (const v of ['Campaña Agosto', '', null, undefined, 123, '12a45678901']) assert.equal(esIdMeta(v), false, String(v));
});

test('asignadasDe: cada campaña con sus conjuntos debajo, y los sueltos al final', () => {
  const lista = [
    S('900000000001', '100000000001', 1),
    C('100000000001', 1),
    S('900000000002', '100000000099', 1), // su campaña está en OTRO producto
    C('100000000099', 2),
    C('100000000002', 1),
  ];
  assert.deepEqual(asignadasDe(lista, 1).map((x) => x.id), ['100000000001', '900000000001', '100000000002', '900000000002']);
  assert.deepEqual(asignadasDe(lista, 2).map((x) => x.id), ['100000000099']);
});

// ── Las dos puertas de Meta piden los MISMOS ids ─────────────────────────────

const leer = (p: string) => readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
// Las líneas se vacían pero se CONSERVAN (los bloques dejan sus saltos): así el número
// de línea que reporta un guard es el del archivo de verdad.
const sinComentarios = (s: string) => s
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ''));

test('el webhook Y el poll piden campaign_id y adset_id, y los pasan', () => {
  // Si una puerta los pidiera y la otra no, el mismo lead nacería en un producto u otro
  // según por dónde entró — sin error, y sin forma de saberlo después.
  const webhook = sinComentarios(leer('app/api/webhooks/meta-leads/route.ts'));
  const poll = sinComentarios(leer('lib/meta-leads.ts'));
  for (const [nombre, src] of [['webhook', webhook], ['poll', poll]] as const) {
    const pide = src.match(/fields[=',\s]+([a-z_,]*campaign[a-z_,]*)/)?.[1] ?? '';
    assert.match(pide, /campaign_id/, `${nombre}: no pide campaign_id`);
    assert.match(pide, /adset_id/, `${nombre}: no pide adset_id`);
    assert.match(src, /meta_campaign_id: \w+\.campaign_id \?\? null/, `${nombre}: no pasa el campaign_id`);
    assert.match(src, /meta_adset_id: \w+\.adset_id \?\? null/, `${nombre}: no pasa el adset_id`);
  }
});

// PROBADO ROMPIÉNDOLO: con el INSERT escribiendo `funnel_id: porCampana.funnelId` sin la
// guarda `!= null`, o con los ids escritos con `?? null`, falla este test.
test('upsertLeadFromMeta: enruta sólo al NACER, el default queda null, y los ids no borran', () => {
  const src = leer('lib/leads.ts');
  const i = src.indexOf('export async function upsertLeadFromMeta(');
  const bloque = sinComentarios(src.slice(i, src.indexOf('\nexport ', i + 1)));
  // Nace en el producto, pero sólo con un embudo CONCRETO: el del negocio es null, que
  // es lo que la fila ya tiene. Escribir su id lo sacaría del tablero por defecto.
  assert.match(bloque, /porCampana\.asignada && porCampana\.funnelId != null \? \{ funnel_id: porCampana\.funnelId \}/);
  // Los dos ids SÓLO si vienen: un `?? null` en un objeto que se escribe también en el
  // UPDATE le borraría la campaña al lead en una ingesta incompleta.
  assert.doesNotMatch(bloque, /meta_campaign_id: input\.meta_campaign_id \?\? null/);
  assert.match(bloque, /input\.meta_campaign_id\?\.trim\(\) \? \{ meta_campaign_id:/);
  assert.match(bloque, /input\.meta_adset_id\?\.trim\(\) \? \{ adset_id_origen:/);
  // Y el UPDATE no mueve: el único `funnel_id` que se escribe es el del INSERT.
  const update = bloque.slice(bloque.indexOf('if (existing) {'), bloque.indexOf('.insert('));
  assert.doesNotMatch(update, /funnel_id:/, 'un lead que ya existe NO se mueve de tablero por ver otro anuncio');
});

test('campana-funnel: valida contra los embudos vivos y escribe el del negocio como null', () => {
  const src = sinComentarios(leer('lib/campana-funnel.ts'));
  assert.match(src, /productosAsignables\(\)/);
  assert.match(src, /elegido\.esDefault \? null : elegido\.id/);
  assert.match(src, /if \(!elegido\) return \{ asignada: false \}/, 'un embudo que ya no existe no puede decidir nada');
});

// ── La lección del 05/10/2026, para todo el repo ─────────────────────────────
// `export const TOPE_LOTE = 200;` en app/crm/actions.ts tipó perfecto, pasó los trece
// chequeos del pre-push y TIRÓ EL BUILD con 125 errores. Esto lo caza antes.
//
// PROBADO ROMPIÉNDOLO: con `export const X = 1;` agregado a app/crm/campanas-actions.ts,
// falla nombrando el archivo y la línea.

function archivos(dir: string, out: string[] = []): string[] {
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) archivos(p, out);
    else if (/\.(ts|tsx)$/.test(n)) out.push(p);
  }
  return out;
}

test('ningún archivo `use server` exporta algo que no sea una función async', () => {
  const malos: string[] = [];
  for (const f of [...archivos('app'), ...archivos('lib')]) {
    const src = leer(f);
    const primera = sinComentarios(src).trimStart();
    if (!/^['"]use server['"]/.test(primera)) continue;
    sinComentarios(src).split('\n').forEach((l, i) => {
      // Lo prohibido: exportar un VALOR que no sea una función async. Los tipos se borran
      // al compilar y están permitidos; `export async function` es lo único que vale.
      if (/^export\s+(const|let|var|class|enum|default\s+(?!async))/.test(l) || /^export\s+function\s/.test(l)) {
        malos.push(`${f}:${i + 1} — ${l.trim().slice(0, 80)}`);
      }
    });
  }
  assert.deepEqual(malos, [], 'en un archivo use server sólo se exportan funciones async (y tipos)');
});

// ── Lo que encontró la revisión adversarial (05/10/2026) ─────────────────────
// PROBADO ROMPIÉNDOLO, de a uno: sin el filtro de vivas antes de la precedencia, con el
// modal pasando `emb.id` crudo, y con `quitar` leyendo en modo tolerante — cada rotura
// tumba exactamente su test (1 falla) y los demás siguen en verde.

test('un conjunto asignado a un producto ARCHIVADO no tapa a su campaña viva', () => {
  // Conjunto S → B (archivado), su campaña C → A (vivo). La primera versión validaba el
  // ganador DESPUÉS de elegirlo y devolvía «no asignada»: el lead caía al tablero del
  // negocio con C todavía asignada a A.
  const lista = [C('111111111111', 1), S('999999999999', '111111111111', 2)];
  const vivo = (id: number | null) => id !== 2;
  const r = funnelIdDeCampana(lista, { campaignId: '111111111111', adsetId: '999999999999' }, vivo);
  assert.ok(r.asignada);
  assert.equal(r.funnelId, 1, 'decide la campaña viva');
  // Y si los dos están muertos, nada decide.
  assert.equal(funnelIdDeCampana(lista, { campaignId: '111111111111', adsetId: '999999999999' }, () => false).asignada, false);
});

test('el pop-up monta el selector con el principal como null, no con su id', () => {
  // El selector del tablero abre el pop-up del principal con su id NUMÉRICO: con ese
  // número no se veían sus campañas y no se podía asignar ninguna.
  // Desde el 12/10/2026 las campañas se asignan en el paso 2 del tipo de funnel (`SeccionFunnel`),
  // con la MISMA tabla del «⋯» de la columna (`CampanasModal`, en línea).
  const src = leer('app/crm/EtapasModal.tsx');
  assert.match(src, /funnelIdCampanas=\{emb\.esDefault \|\| funnelId == null \? null : funnelId\}/);
  assert.match(src, /<CampanasModal enLinea funnelId=\{funnelIdCampanas\}/);
  // Y el server se defiende igual: traduce el id del principal a null antes de validar.
  const acc = sinComentarios(leer('app/crm/campanas-actions.ts'));
  assert.match(acc, /return \{ ok: true, id: f\.esDefault \? null : f\.id, real: f\.id,/);
});

test('las acciones que ESCRIBEN leen el setting en modo estricto', () => {
  // Leer-modificar-escribir con una lectura tolerante: una lectura caída da [] y el
  // guardado BORRA todas las demás asignaciones del workspace.
  const acc = sinComentarios(leer('app/crm/campanas-actions.ts'));
  assert.doesNotMatch(acc, /leerCampanasAsignadas\(\)/, 'la lectura tolerante no puede alimentar una escritura');
  // Las que escriben son las de LOTE; las de a una delegan en ellas (una sola
  // implementación: la tabla de Ads Manager usa las de a una).
  for (const f of ['asignarLoteAction', 'quitarLoteAction', 'deshacerLoteAction']) {
    const i = acc.indexOf(`export async function ${f}(`);
    const b = acc.slice(i, acc.indexOf('\nexport ', i + 1));
    assert.match(b, /await leerCampanasAsignadasEstricto\(\)/, `${f} no lee estricto`);
  }
  for (const [una, lote] of [['asignarCampanaAction', 'asignarLoteAction'], ['quitarCampanaAction', 'quitarLoteAction'], ['deshacerAsignacionAction', 'deshacerLoteAction'], ['previaCampanaAction', 'previaLoteAction']]) {
    const i = acc.indexOf(`export async function ${una}(`);
    assert.match(acc.slice(i, acc.indexOf('\nexport ', i + 1)), new RegExp(`(?:await|return) ${lote}\\(`), `${una} no delega en ${lote}`);
  }
  // Y la lista de Meta tiene tope: un Meta colgado no puede tumbar la acción entera.
  assert.match(acc, /Promise\.race\(\[\s*campanasYConjuntos\(\)/);
});

test('el conjunto se deriva del anuncio SÓLO si hay un conjunto asignado que pueda ser ése', () => {
  // Sin la condición, cada opt-in pagaría una consulta para no encontrar nada.
  const src = sinComentarios(leer('lib/campana-funnel.ts'));
  assert.match(src, /if \(!adsetId && adId && asignadas\.some\(\(c\) => c\.tipo === 'conjunto'/);
  // Y se deriva de la BASE, no de Meta: esta es una ruta pública.
  assert.match(src, /from\('marketing_metrics_daily'\)/);
  assert.doesNotMatch(src, /graph\.facebook\.com/);
});

// ── Traer los leads que YA existen (05/10/2026) ──────────────────────────────
// «Es importante que si selecciono una campaña, me traiga todos los leads. No solo los
// futuros» (Martín). La atribución de lo viejo es pura y se EJECUTA.

const CAMP = '120000000000000001';
const CAMP2 = '120000000000000002';
const ADSET = '230000000000000001';
const ADSET2 = '230000000000000002';
const AD = '340000000000000001';
const AD2 = '340000000000000002';
const anuncios = mapaDeAnuncios([
  { ad_id: AD, campaign_id: CAMP, adset_id: ADSET },
  { ad_id: AD, campaign_id: CAMP, adset_id: ADSET }, // otro día del mismo anuncio
  { ad_id: AD2, campaign_id: CAMP, adset_id: ADSET2 },
  { ad_id: null, campaign_id: CAMP2, adset_id: null }, // fila sin anuncio: no entra al mapa
]);
const L = (id: number, funnel_id: number | null, x: Partial<LeadAtribuible>): LeadAtribuible => ({ id, funnel_id, ...x });

test('campanaDeLead: el dato más directo gana, y un utm con NOMBRE no cuenta', () => {
  assert.deepEqual(campanaDeLead(L(1, null, { meta_campaign_id: CAMP2, meta_ad_id: AD }), anuncios),
    { campaignId: CAMP2, adsetId: ADSET }, 'lo que escribió Graph le gana al anuncio');
  assert.deepEqual(campanaDeLead(L(2, null, { utm_content: AD2 }), anuncios), { campaignId: CAMP, adsetId: ADSET2 },
    'el anuncio de la landing da la campaña Y el conjunto');
  assert.equal(campanaDeLead(L(3, null, { utm_campaign: 'Campaña de verano' }), anuncios).campaignId, null);
  assert.equal(campanaDeLead(L(4, null, { utm_campaign: CAMP2 }), anuncios).campaignId, CAMP2);
});

// PROBADO ROMPIÉNDOLO, de a uno y restaurando de memoria (05/10/2026). Cada rotura tumba
// EXACTAMENTE su test, 27 pass / 1 fail: `(l.funnel_id ?? null)` cambiado por `l.funnel_id`;
// sin el filtro de conjuntosDeOtro; la sección llamando a la acción lenta; la opción del ⋯
// fuera de su condición de entrada; `useState(true)` en vez de `useState(!declarado)`;
// guardar cerrando el panel otra vez; y el modal sin portal. (Las roturas de `moverEnLote`
// de esa tanda ya no aplican: se borró el 06/10, ver «traer AGREGA» más abajo.)
test('leadsATraer: los de la campaña que NO están ya en el destino — el principal es null', () => {
  const leads = [
    L(1, null, { meta_ad_id: AD }),            // en el principal → se trae
    L(2, 7, { utm_content: AD2 }),             // en otro producto → se trae
    L(3, 9, { meta_campaign_id: CAMP }),       // ya está en el destino → no
    L(4, null, { meta_campaign_id: CAMP2 }),   // otra campaña → no
    { id: 5, funnel_id: undefined as unknown as null, utm_campaign: CAMP }, // sin funnel_id leído
  ];
  assert.deepEqual(leadsATraer({ tipo: 'campana', id: CAMP }, 9, leads, anuncios).map((l) => l.id), [1, 2, 5]);
  // Destino = el principal (null): el lead 1 y el 5 ya están ahí.
  assert.deepEqual(leadsATraer({ tipo: 'campana', id: CAMP }, null, leads, anuncios).map((l) => l.id), [2, 3]);
});

// PROBADO ROMPIÉNDOLO (06/10/2026, restaurando de memoria): sin la línea
// `if (enDestino.has(l.id)) return false;` de leadsATraer → 33 pass / 1 fail, y cae sólo
// éste. (Todas las roturas del 06/10 se midieron salteando el barrido de `use server`, que
// tarda ~40 s y no mira nada de esto: la base da 34 / 0.)
test('leadsATraer: el que YA está en el destino por una FILA de lead_funnel no se vuelve a traer', () => {
  const leads = [
    L(1, null, { meta_ad_id: AD }),            // casa = el principal, sin fila en 9 → se trae
    L(2, 7, { utm_content: AD2 }),             // casa = 7, YA agregado a 9 → no
    L(3, null, { meta_campaign_id: CAMP }),    // casa = el principal, YA agregado a 9 → no
  ];
  const enDestino = new Set([2, 3]);
  assert.deepEqual(leadsATraer({ tipo: 'campana', id: CAMP }, 9, leads, anuncios, new Set(), enDestino).map((l) => l.id), [1]);
  // Y el lote pasa la misma lista: si no, la barra contaría de más lo que el alta no escribe.
  assert.deepEqual(repartirPorItem([{ tipo: 'campana', id: CAMP }], 9, leads, anuncios, new Set(), enDestino).get(CAMP)?.map((l) => l.id), [1]);
  // Sin la lista (las llamadas viejas), el comportamiento de antes: sólo cuenta la casa.
  assert.deepEqual(leadsATraer({ tipo: 'campana', id: CAMP }, 9, leads, anuncios).map((l) => l.id), [1, 2, 3]);
});

test('leadsATraer: los de un conjunto asignado a OTRO producto se quedan allá (conjunto > campaña)', () => {
  const leads = [L(1, null, { meta_ad_id: AD }), L(2, null, { meta_ad_id: AD2 })];
  // ADSET2 está asignado a otro producto: la campaña trae sólo los de ADSET.
  assert.deepEqual(leadsATraer({ tipo: 'campana', id: CAMP }, 9, leads, anuncios, new Set([ADSET2])).map((l) => l.id), [1]);
  // Y asignar el conjunto trae sólo los suyos.
  assert.deepEqual(leadsATraer({ tipo: 'conjunto', id: ADSET2 }, 9, leads, anuncios).map((l) => l.id), [2]);
});

test('conteoPorCampana cuenta campaña y conjunto en una pasada', () => {
  const n = conteoPorCampana([L(1, null, { meta_ad_id: AD }), L(2, 3, { utm_content: AD2 }), L(3, null, {})], anuncios);
  assert.equal(n.get(CAMP), 2);
  assert.equal(n.get(ADSET), 1);
  assert.equal(n.get(ADSET2), 1);
});

test('campanasDeMetricas: toda campaña con un día de datos, con el primer nombre que no esté vacío', () => {
  const r = campanasDeMetricas([
    { ad_id: AD, campaign_id: CAMP, campaign_name: '', adset_id: ADSET, adset_name: null },
    { ad_id: AD, campaign_id: CAMP, campaign_name: 'Verano', adset_id: ADSET, adset_name: 'Mujeres' },
    { ad_id: null, campaign_id: 'no es un id', campaign_name: 'X', adset_id: null, adset_name: null },
  ]);
  assert.deepEqual(r.campanas, [{ id: CAMP, nombre: 'Verano' }]);
  assert.deepEqual(r.conjuntos, [{ id: ADSET, nombre: 'Mujeres', campanaId: CAMP }]);
});

// ── Traer AGREGA, no mueve (06/10/2026) ──────────────────────────────────────
// «Le acabo de dar a un lead a "Mover a prueba" y se desapareció del producto principal de
// Mauricio. Eso JAMÁS debe pasar... No se debe "Mover" se debe agregar al otro producto»
// (Martín). Hasta ese día `moverEnLote` reescribía `leads.funnel_id`: traer una campaña
// SACABA a sus leads del principal. Ahora la casa no se toca y el destino gana una fila.
//
// PROBADO ROMPIÉNDOLO, de a uno y restaurando de memoria (base 34 / 0 sin el barrido de
// `use server`): los números de cada rotura están en el comentario de su test.

// PROBADO ROMPIÉNDOLO: con `moverEnLote` devuelto a lib/campana-traer.ts y llamado desde la
// acción (`.from('leads').update({ funnel_id: a })`) → 33 / 1; con `agregarLoteAProducto`
// recibiendo `d.id` (null para el principal) en vez de `d.real` → 33 / 1; con el deshacer
// sin el filtro de `m.a` → 33 / 1. En las tres cae sólo éste.
test('traer los leads de una campaña los AGREGA (lead_funnel): no toca la casa ni la etapa', () => {
  const acc = sinComentarios(leer('app/crm/campanas-actions.ts'));
  const traer = sinComentarios(leer('lib/campana-traer.ts'));
  for (const [quien, src] of [['la acción', acc], ['lib/campana-traer.ts', traer]] as const) {
    // Ni la etapa (la de la casa sigue siendo suya)...
    assert.doesNotMatch(src, /setPipelineStage|pipeline_stage|moverLeadsAFunnelAction/, `${quien} toca la etapa`);
    // ...ni la casa: nadie escribe `leads`.
    assert.doesNotMatch(src, /from\('leads'\)\s*\.update\(|update\(\{\s*funnel_id/, `${quien} vuelve a MOVER: reescribe leads.funnel_id`);
    assert.doesNotMatch(src, /moverEnLote/, `${quien}: volvió moverEnLote`);
  }
  const bloque = (nombre: string) => {
    const i = acc.indexOf(`export async function ${nombre}(`);
    assert.ok(i >= 0, `no está ${nombre}`);
    return acc.slice(i, acc.indexOf('\nexport ', i + 1));
  };
  const asignar = bloque('asignarLoteAction');
  // Se calcula con la configuración YA guardada (conjunto > campaña)...
  assert.match(asignar, /planDeTraidaLote\(d\.id, lote, nueva\)/, 'se calcula con la configuración YA guardada (conjunto > campaña)');
  // ...se agrega con el id REAL del destino: el principal va a lead_funnel con su id, nunca null...
  assert.match(asignar, /agregarLoteAProducto\(\s*grupo\.map\(\(l\) => l\.id\), d\.real,/, 'se agrega con el id REAL del destino');
  // ...el deshacer recibe SÓLO lo que la base confirmó haber agregado, con su producto...
  assert.match(asignar, /r\.agregados\.map\(\(id\) => \(\{ id, a: d\.real \}\)\)/);
  // ...y un ítem que tira no se lleva puesto el deshacer de los anteriores.
  assert.match(asignar, /\} catch \(e\) \{[^}]*fallaron \+= grupo\.length;/, 'un ítem que falla tiene que contarse, no tumbar el lote');

  const deshacer = bloque('deshacerLoteAction');
  assert.match(deshacer, /quitarLoteDeProducto\(ids, a,/, 'el deshacer borra las filas que agregó');
  // Un payload sin `a` (la forma vieja) no saca a nadie: adivinar el producto sería sacarlo de otro.
  assert.match(deshacer, /Number\.isInteger\(m\?\.a\) && m\.a > 0/, 'el deshacer acepta un agregado sin producto');
});

// PROBADO ROMPIÉNDOLO: con `repartirPorItem(...)` llamado sin `enDestino` → 33 / 1; sin el
// paso por `casaParaEscribir` → 33 / 1. En las dos cae sólo éste.
test('el plan sabe quién YA está en el destino por fila, y lee el principal como null', () => {
  const traer = sinComentarios(leer('lib/campana-traer.ts'));
  const i = traer.indexOf('export async function planDeTraidaLote(');
  const plan = traer.slice(i);
  assert.ok(i > 0 && plan.length < 2500, `el bloque de planDeTraidaLote mide ${plan.length}: está mirando otra cosa`);
  // Las filas se buscan con el id REAL (el principal también tiene id en lead_funnel)...
  assert.match(plan, /const destinoReal = destino \?\? defaultId;/);
  assert.match(plan, /await agregadosDe\(destinoReal\)/);
  // ...y la lista llega a la regla pura.
  assert.match(plan, /repartirPorItem\(items, destino, normalizados, anuncios, conjuntosDeOtro, enDestino\)/);
  // Un lead con el id del principal ESCRITO es del principal (el bug que casaParaEscribir cierra).
  assert.match(plan, /funnel_id: casaParaEscribir\(/);
  // Y la lectura de filas pagina: lead_funnel crece con el uso y el techo de 1000 no avisa.
  assert.match(traer, /leerTodo<\{ lead_id: number \| string \}>\(db, 'lead_funnel'/);
});

test('la sección del pop-up no espera a Meta: lee sólo lo asignado', () => {
  // «la sección siempre debe estar presente»: el giro va adentro de la tabla, no en lugar
  // de la sección. La lectura lenta (Meta + leads) es del modal.
  const sec = sinComentarios(leer('app/crm/CampanasDelProducto.tsx'));
  assert.doesNotMatch(sec, /campanasDelProductoAction|Spinner/);
  assert.match(sec, /campanasAsignadasAction\(\)/);
  const acc = sinComentarios(leer('app/crm/campanas-actions.ts'));
  const i = acc.indexOf('export async function campanasAsignadasAction(');
  assert.doesNotMatch(acc.slice(i, acc.indexOf('\nexport ', i + 1)), /campanasYConjuntos|leadsYMetricas/);
});

// PROBADO ROMPIÉNDOLO: con el toast de vuelta a `show(base, …)` sin los fallados → 33 / 1.
test('el toast del lote dice cuántos NO se pudieron traer', () => {
  const m = sinComentarios(leer('app/crm/CampanasModal.tsx'));
  assert.match(m, /show\(r\.fallaron \? `\$\{base\} · \$\{r\.fallaron\} sin traer` : base,/);
});

test('el modal va por PORTAL: abierto desde el pop-up no puede ser su descendiente', () => {
  const m = sinComentarios(leer('app/crm/CampanasModal.tsx'));
  assert.match(m, /createPortal\(cuerpo, document\.body\)/);
});

test('asignar PREGUNTA si va a mover leads o a sacarle la campaña a otro producto, y sólo entonces', () => {
  // Una campaña nueva (cero leads) se asigna con un clic; una de 896 leads no.
  const m = sinComentarios(leer('app/crm/CampanasModal.tsx'));
  // La regla vive en lib/campana-asignar.ts (la comparte la tabla de Ads Manager, y la
  // ejecuta tests/campana-asignar.test.ts); acá se fija que el LOTE pase por ella. La
  // celda de cada fila es `ProductoCelda`, que la usa por su cuenta.
  assert.match(m, /if \(!hayQuePreguntar\(previa\.aTraer, desde\)\) \{ await asignarLote\(fid, items\); return; \}/);
  assert.match(m, /\.\.\.preguntaAsignar\(\{ producto: nombreDe\(fid\), aTraer: previa\.aTraer, desde,/);
});

// PROBADO ROMPIÉNDOLO: con la fila asignando al clic otra vez (`onClick={() => void
// alternar(item)}`), sin la casilla de «todos», o con «Este» de vuelta en la columna, cae.
test('la casilla SELECCIONA (como en todo MaKo), hay casilla de «todos», y se asigna en lote', () => {
  // «El botón de checkbox no debería asignar, porque se entiende en todo MaKo que esa es
  // la selección multiple... Y falta el checkbox más arriba para seleccionar a todo. Y luego
  // una topbar aparece para poder asignar en lote» (Martín, 06/10/2026).
  const m = sinComentarios(leer('app/crm/CampanasModal.tsx'));
  assert.match(m, /onClick=\{\(\) => alternarSel\(f\.id\)\}/, 'el clic en la fila tilda');
  assert.match(m, /onChange=\{alternarTodos\} aria-label="Seleccionar todas las que se ven"/, 'falta la casilla de todos');
  assert.match(m, /el\.indeterminate = algunoTildado && !todosTildados/);
  assert.match(m, /\{elegidos\.length > 0 && \(/, 'la barra aparece con lo tildado');
  // Desde el 12/10/2026 el lote asigna al funnel que se está editando: un botón, no un desplegable.
  assert.match(m, /onClick=\{\(\) => void elegirProductoLote\(valorDeProducto\(funnelId\)\)\}/);
  // De a una se asigna desde la columna, con la MISMA pieza que Ads Manager, que dice el
  // nombre del producto: «El producto no debe decir "Este"».
  assert.match(m, /<ProductoCelda item=\{item\}/);
  assert.doesNotMatch(m, />Este</);
});

test('el lote no cuenta dos veces al mismo lead: campaña y conjunto juntos traen a cada uno UNA vez', () => {
  const leads = [L(1, null, { meta_ad_id: AD }), L(2, null, { meta_ad_id: AD2 })];
  // La campaña reclama a los dos; el conjunto ADSET2, elegido después, ya no reclama al 2.
  const r = repartirPorItem([{ tipo: 'campana', id: CAMP }, { tipo: 'conjunto', id: ADSET2 }], 9, leads, anuncios);
  assert.deepEqual(r.get(CAMP)?.map((l) => l.id), [1, 2]);
  assert.deepEqual(r.get(ADSET2)?.map((l) => l.id), []);
  // En el otro orden, el conjunto se queda con el suyo y la campaña con el resto.
  const r2 = repartirPorItem([{ tipo: 'conjunto', id: ADSET2 }, { tipo: 'campana', id: CAMP }], 9, leads, anuncios);
  assert.deepEqual(r2.get(ADSET2)?.map((l) => l.id), [2]);
  assert.deepEqual(r2.get(CAMP)?.map((l) => l.id), [1]);
});

test('el «⋯» de la columna de ENTRADA ofrece las campañas, y sólo esa columna', () => {
  const b = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  // Desde el 16/10/2026 dice «Asignar campañas» con el logo de Meta (Martín), como la sección del pop-up de etapas.
  // Probado (09/10/2026, parte «barrido»): base 35/0 con el ícono; sacando la condición de la entrada
  // (el renglón en todas las columnas) → 34/1.
  assert.match(b, /\.\.\.\(c\.kind === 'entrada' \? \[\{ value: 'campanas', label: 'Asignar campañas', icono: <LogoMeta size=\{\d+\} \/> \}\] : \[\]\)/);
  assert.match(b, /if \(v === 'campanas'\) \{ setCampanasAbierto\(true\); return; \}/);
  assert.match(b, /funnelActivo == null \|\| funnels\.find\(\(f\) => f\.id === funnelActivo\)\?\.esDefault \? null : funnelActivo/,
    'el principal va como null');
});

test('«cómo entra tu gente» ya declarado arranca PLEGADO, y guardar lo pliega', () => {
  const e = sinComentarios(leer('app/crm/EmbudoEntradas.tsx'));
  assert.match(e, /useState\(!declarado\)/);
  assert.match(e, /if \(r\.ok\) \{ setEditando\(false\); onGuardado\?\.\(\); \}/);
  // Y guardar ya no cierra el panel: abajo viven las campañas.
  const m = sinComentarios(leer('app/crm/EtapasModal.tsx'));
  assert.doesNotMatch(m, /onGuardado=\{\(\) => \{[^}]*setEntradasAbierto\(false\)/);
});

// ── Borrar un producto para siempre: su gente vuelve al negocio con NULL (06/10/2026) ──
// El tablero del negocio pide `.is('funnel_id', null)`: el rescate escribía el ID del
// default y los rescatados no aparecían en NINGÚN tablero. Y desde la mig 0207 un rescatado
// puede tener además una fila en el producto del negocio, que al volver es su casa — y
// nunca hay fila para la casa.
//
// PROBADO ROMPIÉNDOLO: con `const destino = idNegocio;` → 33 / 1; sin el borrado de la fila
// del negocio → 33 / 1; con la lectura de esas filas DESPUÉS del rescate (ya no encuentra a
// nadie: todos tienen funnel_id null) → 33 / 1. En las tres cae sólo éste.
test('eliminarFunnelDefinitivo: rescata con funnel_id NULL y borra la fila del negocio de los rescatados', () => {
  // La regla se EJECUTA: el default contra sí mismo se escribe null, haya default o no.
  assert.equal(casaParaEscribir(12, 12), null);
  assert.equal(casaParaEscribir(null, null), null);
  assert.equal(casaParaEscribir(7, 12), 7, 'otro producto se escribe con su id');

  const fn = sinComentarios(leer('lib/funnels.ts'));
  const i = fn.indexOf('export async function eliminarFunnelDefinitivo(');
  const def = fn.slice(i, fn.indexOf('\nexport ', i + 1));
  assert.ok(i > 0 && def.length > 500 && def.length < 6000, `el bloque mide ${def.length}: está mirando otra cosa`);
  assert.match(def, /const destino = casaParaEscribir\(idNegocio, idNegocio\);/, 'el rescate no pasa por casaParaEscribir');
  assert.doesNotMatch(def, /funnel_id: idNegocio/, 'el rescate escribe el ID del negocio: quedan fuera de todo tablero');
  const iLee = def.indexOf(".from('lead_funnel')\n        .select('lead_id, etapa')");
  const iRescate = def.indexOf('update({ funnel_id: destino })');
  const iBorraFila = def.indexOf(".from('lead_funnel')\n        .delete().eq('funnel_id', idNegocio)");
  const iBorraFunnel = def.indexOf(".from('funnels').delete()");
  assert.ok(iLee > 0 && iRescate > iLee, 'las filas del negocio se leen ANTES del rescate (después ya no se encuentra a nadie)');
  assert.ok(iBorraFila > iRescate, 'la fila del negocio de los rescatados no se borra (fila para la casa)');
  assert.ok(iBorraFunnel > iBorraFila, 'el producto se borra antes de terminar con su gente');
  // Y su etapa en el negocio pasa a ser la del lead, como al promover una fila a casa.
  assert.match(def, /update\(\{ pipeline_stage: etapa \}\)\.in\('id', ids\.slice\(i, i \+ 200\)\)\.is\('funnel_id', null\)/);
});
