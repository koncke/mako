// =============================================================================
// ver_funnel lee las etapas de CUALQUIER CRM del negocio (#898): el parámetro `embudoId`
// =============================================================================
// Hasta el 17/10/2026 `ver_funnel` sólo devolvía las etapas del funnel PRINCIPAL: MaKo no podía leer las keys de
// un CRM nuevo (crear_crm) para filtrar o mover leads en él. Ahora toma `embudoId` (el mismo de productos_del_lead
// y de ver_ficha_funnel), opcional: sin él, lo de siempre. La salida suma `crm: { id, nombre, principal }`.
//
// Correr: node --import tsx --test tests/ver-funnel-embudo.test.ts
//
// ⚠️ LA LECTURA SE EJECUTA, NO SÓLO SE MIRA. `etapasDelCrm` vive en un archivo `server-only` (crm.run.ts) que no se
// puede importar acá: se saca del fuente real, se le borran los tipos con el propio TypeScript y se la llama con
// lectores de mentira (el molde es `traer` de tests/lead-funnel-ficha.test.ts). Lo que se audita es el código que
// corre; los lectores falsos sólo dicen qué CRM tiene el negocio. Si alguien cambia el lector de CRM por otro, el
// test no encuentra el nombre y falla fuerte (ReferenceError) en vez de quedarse verde mirando una copia.
//
// ⚠️ `bandasDeEtapas` (CRM que no es el principal) y la herramienta del chat (`ver_funnel` en lib/mako-tools.ts,
// que lee el principal) arman la MISMA salida con dos copias del mapeo por banda: el test ejecuta las dos sobre el
// mismo funnel y exige lo mismo, para que no se separen.
//
// ⚠️ PROBADO ROMPIÉNDOLO (17/10/2026): base 10/0 (aprobados/fallos), cada rotura restaurada antes de la siguiente:
//   · la def sin el parámetro `embudoId`                                              → 9 / 1
//   · la descripción vuelve a decir «No pide parámetros»                              → 9 / 1
//   · la descripción de ver_funnel +120 caracteres (pasa de 600)                      → 9 / 1
//   · el runner directo a `runMakoTool` (la herramienta del chat no lee el embudoId)  → 9 / 1
//   · sin validar el `embudoId` contra los CRM del negocio (`if (false)`)             → 9 / 1
//   · el error sin la lista de CRM disponibles                                        → 9 / 1
//   · se lee el funnel pedido (`getFunnelDe`) ANTES de validarlo                      → 6 / 4
//   · sin mirar el `origen: 'error'` de getFunnelDe                                   → 9 / 1
//   · el principal sin el `crm` en la salida                                          → 8 / 2
//   · el CRM principal marcado `principal: false`                                     → 8 / 2
//   · el principal pedido por su id va por getFunnelDe y no por la herramienta        → 7 / 3
//   · las bandas sin ordenar por columna                                              → 8 / 2
//   · el pipeline de otro CRM sin el `tipo` de cada etapa                             → 8 / 2
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import ts from 'typescript';
import { aToolDef, porId } from '../lib/api-mako/registro';

const leer = (p: string) => readFileSync(resolve(import.meta.dirname, '..', p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const RUN = sinComentarios(leer('lib/api-mako/areas/crm.run.ts'));
const TOOLS = sinComentarios(leer('lib/mako-tools.ts'));

/** Una función top-level del fuente: desde su cabecera hasta su `}` de la columna 0. */
function funcion(src: string, cabecera: string): string {
  const ini = src.indexOf(cabecera);
  assert.ok(ini >= 0, `no encontré «${cabecera}»: el test quedó viejo`);
  const fin = src.indexOf('\n}\n', ini);
  assert.ok(fin > ini, `no pude delimitar «${cabecera}»`);
  return src.slice(ini, fin + 2);
}

/** Una línea top-level (`const json = …;`). */
function linea(src: string, re: RegExp): string {
  const m = src.match(re);
  assert.ok(m, `no encontré ${re}: el test quedó viejo`);
  return m![0];
}

const aJs = (fuente: string): string => ts.transpileModule(fuente, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;

// ── Los lectores de mentira: qué CRM tiene el negocio y qué dice cada uno ──────────────────────────────────────

type Etapa = { key: string; label: string; kind?: string; band?: string; col?: number };

// Desordenadas a propósito y con una sin `band` (cae al pipeline): la salida va por banda y por columna.
const ETAPAS_TIENDA: Etapa[] = [
  { key: 'pago', label: 'Pagó', kind: 'pago', band: 'pipeline', col: 2 },
  { key: 'carrito', label: 'Carrito', kind: 'entrada', col: 0 },
  { key: 'cierre', label: 'Cerrado', kind: 'cierre', band: 'pipeline', col: 3 },
  { key: 'abandono', label: 'Abandono', kind: 'paso', band: 'nutricion', col: 1 },
  { key: 'recupero', label: 'Recupero', band: 'nutricion', col: 0 },
  { key: 'devuelto', label: 'Devuelto', band: 'salidas', col: 0 },
  { key: 'consulta', label: 'Consulta', kind: 'reunion', band: 'pipeline', col: 1 },
];
const ETAPAS_PRINCIPAL: Etapa[] = [
  { key: 'lead', label: 'Lead entrante', kind: 'entrada', band: 'pipeline', col: 0 },
  { key: 'ganado', label: 'Ganado', kind: 'cierre', band: 'pipeline', col: 1 },
  { key: 'nutri', label: 'Nutrición', band: 'nutricion', col: 0 },
  { key: 'perdido', label: 'Perdido', band: 'salidas', col: 0 },
];
const CRMS = [
  { embudoId: 1, nombre: 'Negocio que Escala', esDefault: true, etapas: [] },
  { embudoId: 7, nombre: 'Tienda', esDefault: false, etapas: [] },
];

/** La salida del `ver_funnel` del chat para esas etapas: la forma que el runner tiene que respetar en el principal. */
const SALIDA_CHAT = (stages: Etapa[]) => {
  const banda = (b: string) => [...stages].filter((s) => (s.band ?? 'pipeline') === b).sort((a, c) => (a.col ?? 0) - (c.col ?? 0))
    .map((s) => (b === 'pipeline' && s.kind ? { key: s.key, label: s.label, tipo: s.kind } : { key: s.key, label: s.label }));
  return JSON.stringify({ activo: banda('pipeline'), nutricion: banda('nutricion'), descartado: banda('salidas') });
};

type Salida = string | { content: string; isError?: boolean };
type Contexto = {
  crms?: typeof CRMS | null;
  /** Lo que devuelve la herramienta del chat para el principal. */
  chat?: Salida;
  /** Lo que devuelve getFunnelDe(id). */
  funnel?: { origen: string; stages: Etapa[] };
};

/** `etapasDelCrm` del fuente real, con sus lectores reemplazados. Devuelve la función y lo que se leyó. */
function armar(c: Contexto = {}) {
  const lecturas = { chat: [] as unknown[], funnelDe: [] as number[], crms: 0 };
  const deps = {
    productosCrm: async () => { lecturas.crms++; if (c.crms === null) throw new Error('base caída'); return c.crms ?? CRMS; },
    runMakoTool: async (nombre: string, input: unknown) => { lecturas.chat.push([nombre, input]); return c.chat ?? SALIDA_CHAT(ETAPAS_PRINCIPAL); },
    getFunnelDe: async (id: number) => { lecturas.funnelDe.push(id); return c.funnel ?? { origen: 'declarado', stages: ETAPAS_TIENDA }; },
  };
  const fuente = [
    linea(RUN, /^const json = .*$/m), linea(RUN, /^const fallo = .*$/m), linea(RUN, /^const n = .*$/m),
    linea(RUN, /^const NO_LEI_PRODUCTOS = .*$/m),
    funcion(RUN, 'function bandasDeEtapas('), funcion(RUN, 'async function etapasDelCrm('),
  ].join('\n');
  // eslint-disable-next-line no-new-func
  const etapasDelCrm = new Function(...Object.keys(deps), `${aJs(fuente)}; return etapasDelCrm;`)(...Object.values(deps)) as (input: Record<string, unknown>) => Promise<Salida>;
  return { etapasDelCrm, lecturas };
}

const texto = (r: Salida): string => (typeof r === 'string' ? r : r.content);
const esFallo = (r: Salida): boolean => typeof r !== 'string' && r.isError === true;

// ── La def ─────────────────────────────────────────────────────────────────────────────────────────────────────

test('la def: `embudoId` opcional, el mismo de ver_ficha_funnel, y la descripción ya no dice que no pide nada', () => {
  const def = porId('ver_funnel')!;
  const ficha = porId('ver_ficha_funnel')!;
  assert.equal(def.parametros.length, 1);
  const p = def.parametros[0];
  assert.equal(p.nombre, 'embudoId');
  assert.equal(p.tipo, 'number');
  assert.equal(p.entero, true);
  assert.equal(p.minimo, 1);
  assert.ok(!p.obligatorio, 'sin embudoId tiene que seguir leyendo el CRM principal');
  assert.equal(p.descripcion, ficha.parametros.find((x) => x.nombre === 'embudoId')!.descripcion, 'es el mismo embudoId: la misma descripción');
  assert.ok(!/No pide parámetros/i.test(def.descripcion), 'la descripción mentiría');
  assert.match(def.descripcion, /embudoId/);
  const esquema = aToolDef(def).input_schema as { properties: Record<string, unknown>; required?: string[] };
  assert.ok('embudoId' in esquema.properties, 'MaKo no ve el parámetro');
  assert.ok(!esquema.required?.includes('embudoId'));
});

// ⚠️ NO CRECE MUCHO. Las herramientas del CRM viajan en el turno de WhatsApp con 12.000 caracteres de esquema para
// todas (PRESUPUESTO_REGISTRO_CHARS, lib/doer-herramientas.ts; tests/agenda-whatsapp.test.ts). Pesaba 421 sin
// parámetros y 583 con `embudoId`: el tope deja ese margen y no más. Si otra cosa lo necesita, que se pague achicando.
test('ver_funnel no crece: viaja en el presupuesto del turno de WhatsApp', () => {
  const largo = JSON.stringify(aToolDef(porId('ver_funnel')!)).length;
  assert.ok(largo <= 600, `ver_funnel pesa ${largo} caracteres (tope 600): le quita lugar a las demás del CRM en WhatsApp`);
});

test('el runner de ver_funnel va por etapasDelCrm, no directo a la herramienta del chat', () => {
  assert.match(RUN, /ver_funnel: \{ leer: \(input\) => etapasDelCrm\(input\) \}/);
  assert.doesNotMatch(RUN, /ver_funnel: \{ leer: \(input\) => runMakoTool/, 'el embudoId se perdería: la herramienta del chat no lo lee');
});

// ── Sin embudoId: lo de hoy ────────────────────────────────────────────────────────────────────────────────────

test('sin embudoId: la lectura de siempre, más de cuál CRM es', async () => {
  const { etapasDelCrm, lecturas } = armar();
  const r = await etapasDelCrm({});
  assert.ok(!esFallo(r));
  assert.deepEqual(lecturas.chat, [['ver_funnel', {}]], 'el principal sale de la herramienta del chat, la de hoy');
  assert.deepEqual(lecturas.funnelDe, [], 'no se lee ningún otro funnel');
  const o = JSON.parse(texto(r));
  assert.deepEqual(o.crm, { id: 1, nombre: 'Negocio que Escala', principal: true });
  const { crm, ...resto } = o;
  assert.deepEqual(resto, JSON.parse(SALIDA_CHAT(ETAPAS_PRINCIPAL)), 'el resto de la forma no cambia');
  assert.ok(crm);
});

test('sin embudoId y sin poder saber cuál es el principal, o sin funnel configurado: el texto de hoy, tal cual', async () => {
  const caida = armar({ crms: null });
  assert.equal(texto(await caida.etapasDelCrm({})), SALIDA_CHAT(ETAPAS_PRINCIPAL), 'la lectura de CRM cayó: la de siempre no se rompe');
  const vacio = armar({ chat: 'No hay un funnel configurado todavía.' });
  assert.equal(texto(await vacio.etapasDelCrm({})), 'No hay un funnel configurado todavía.');
  const conError = armar({ chat: { content: 'se rompió', isError: true } });
  assert.deepEqual(await conError.etapasDelCrm({}), { content: 'se rompió', isError: true });
});

test('embudoId del CRM principal: es el principal, por el camino de siempre', async () => {
  const { etapasDelCrm, lecturas } = armar();
  const o = JSON.parse(texto(await etapasDelCrm({ embudoId: 1 })));
  assert.deepEqual(o.crm, { id: 1, nombre: 'Negocio que Escala', principal: true });
  assert.equal(lecturas.chat.length, 1);
  assert.deepEqual(lecturas.funnelDe, []);
});

// ── Con embudoId de otro CRM ───────────────────────────────────────────────────────────────────────────────────

test('embudoId de otro CRM del negocio: sus etapas por banda y por columna, y de cuál son', async () => {
  const { etapasDelCrm, lecturas } = armar();
  const r = await etapasDelCrm({ embudoId: 7 });
  assert.ok(!esFallo(r));
  assert.deepEqual(lecturas.funnelDe, [7], 'se lee ESE funnel, una vez');
  assert.deepEqual(lecturas.chat, [], 'la herramienta del chat sólo sabe del principal');
  const o = JSON.parse(texto(r));
  assert.deepEqual(o.crm, { id: 7, nombre: 'Tienda', principal: false });
  assert.deepEqual(o.activo, [
    { key: 'carrito', label: 'Carrito', tipo: 'entrada' }, // sin `band` cae al pipeline
    { key: 'consulta', label: 'Consulta', tipo: 'reunion' },
    { key: 'pago', label: 'Pagó', tipo: 'pago' },
    { key: 'cierre', label: 'Cerrado', tipo: 'cierre' },
  ]);
  assert.deepEqual(o.nutricion, [{ key: 'recupero', label: 'Recupero' }, { key: 'abandono', label: 'Abandono' }], 'fuera del pipeline no hay `tipo`');
  assert.deepEqual(o.descartado, [{ key: 'devuelto', label: 'Devuelto' }]);
});

test('un embudoId que no es de este negocio, o que no existe, vuelve con los CRM que hay y NO lee nada', async () => {
  for (const embudoId of [999, 2]) {
    const { etapasDelCrm, lecturas } = armar();
    const r = await etapasDelCrm({ embudoId });
    assert.ok(esFallo(r), `el CRM #${embudoId} no es de este negocio y no dio error`);
    const o = JSON.parse(texto(r));
    assert.match(o.error, new RegExp(`#${embudoId}\\b`));
    assert.deepEqual(o.disponibles, [{ embudoId: 1, nombre: 'Negocio que Escala' }, { embudoId: 7, nombre: 'Tienda' }]);
    assert.deepEqual(lecturas.funnelDe, [], 'getFunnelDe con un id ajeno devuelve el pipeline genérico: no puede ni llamarse');
    assert.deepEqual(lecturas.chat, []);
  }
});

test('un CRM que no se pudo leer es un error, no las etapas genéricas de un embudo que no tiene', async () => {
  const sinLista = armar({ crms: null });
  const a = await sinLista.etapasDelCrm({ embudoId: 7 });
  assert.ok(esFallo(a));
  assert.match(texto(a), /No se pudieron leer los funnels/);
  assert.deepEqual(sinLista.lecturas.funnelDe, []);
  const caido = armar({ funnel: { origen: 'error', stages: ETAPAS_PRINCIPAL } });
  const b = await caido.etapasDelCrm({ embudoId: 7 });
  assert.ok(esFallo(b));
  assert.match(texto(b), /No pude leer ese CRM/);
  assert.doesNotMatch(texto(b), /Lead entrante|"activo"/, 'no tiene que colar las etapas del pipeline genérico');
});

// ── Las dos copias del mapeo por banda dicen lo mismo ──────────────────────────────────────────────────────────

test('bandasDeEtapas y la herramienta del chat arman la misma salida para el mismo funnel', async () => {
  // La herramienta real, sacada de lib/mako-tools.ts: `case 'ver_funnel': { … }` con getFunnelDefault de mentira.
  const ini = TOOLS.indexOf("case 'ver_funnel': {");
  assert.ok(ini >= 0, "el case 'ver_funnel' de lib/mako-tools.ts ya no está: el test quedó viejo");
  const fin = TOOLS.indexOf('\n    }\n', ini);
  assert.ok(fin > ini);
  const cuerpo = TOOLS.slice(ini + "case 'ver_funnel': {".length, fin);
  // eslint-disable-next-line no-new-func
  const herramienta = new Function('getFunnelDefault', `return (async () => {${aJs(cuerpo)}})();`) as (f: unknown) => Promise<string>;
  for (const stages of [ETAPAS_TIENDA, ETAPAS_PRINCIPAL]) {
    const delChat = await herramienta(async () => ({ stages }));
    const { etapasDelCrm } = armar({ funnel: { origen: 'declarado', stages } });
    const { crm, ...delRunner } = JSON.parse(texto(await etapasDelCrm({ embudoId: 7 })));
    assert.ok(crm);
    assert.deepEqual(delRunner, JSON.parse(delChat), 'el CRM que no es el principal se lee distinto que el principal');
  }
});
