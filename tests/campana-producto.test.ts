// =============================================================================
// Campañas y conjuntos de Meta → producto (05/10/2026)
// =============================================================================
// La lógica pura se EJECUTA (lib/campana-config.ts no tiene `server-only` para eso);
// lo que cuelga de Supabase y de Meta se fija leyendo el bloque, no el archivo.
//
// PROBADO ROMPIÉNDOLO — los números están al lado de cada test que los tiene.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  parsearCampanas, conCampana, sinCampana, funnelIdDeCampana, asignadasDe, esIdMeta,
  type CampanaAsignada,
} from '../lib/campana-config';

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

// ── Asignar es MOVER ─────────────────────────────────────────────────────────

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

const leer = (p: string) => readFileSync(p, 'utf8');
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
  const src = leer('app/crm/EtapasModal.tsx');
  assert.match(src, /<CampanasDelProducto funnelId=\{emb\.esDefault \? null : emb\.id\}/);
  // Y el server se defiende igual: traduce el id del principal a null antes de validar.
  const acc = sinComentarios(leer('app/crm/campanas-actions.ts'));
  assert.match(acc, /return \{ ok: true, id: f\.esDefault \? null : f\.id \}/);
});

test('las acciones que ESCRIBEN leen el setting en modo estricto', () => {
  // Leer-modificar-escribir con una lectura tolerante: una lectura caída da [] y el
  // guardado BORRA todas las demás asignaciones del workspace.
  const acc = sinComentarios(leer('app/crm/campanas-actions.ts'));
  assert.doesNotMatch(acc, /leerCampanasAsignadas\(\)/, 'la lectura tolerante no puede alimentar una escritura');
  for (const f of ['asignarCampanaAction', 'quitarCampanaAction']) {
    const i = acc.indexOf(`export async function ${f}(`);
    const b = acc.slice(i, acc.indexOf('\nexport ', i + 1));
    assert.match(b, /await leerCampanasAsignadasEstricto\(\)/, `${f} no lee estricto`);
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
