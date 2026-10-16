// =============================================================================
// La red de plataforma del Dashboard (lib/graficos-ia-red.ts) sigue el orden de `chatCheapCascade`
// =============================================================================
// Regla del 16/10/2026 (AGENTS.md, la sección de la red de plataforma): los datos de los clientes de un cliente
// nunca van a un proveedor que entrena con lo que recibe. Esta red NO pasa por `chatCheapCascade`, así que el
// corte de la cascada no la cubre: la aplica ella. El orden: el crédito de Claude de la plataforma (no entrena),
// después el corte si el pedido lleva datos de clientes, y recién ahí las keys gratis (el plan gratis de Gemini
// entrena). «Conclusiones de MaKo» lleva la marca `pii`: una caja de un pop-up lee el transcript de una llamada.
//
// Y caja por caja (lib/graficos-ia-elemento.ts, `cajaLlevaDatosDeClientes`): la marca de la feature entera dejaba
// sin IA a las cajas que sólo leen números. Van sin la marca, en POSITIVO, las que leen gráficos y un anuncio.
//
// PROBADO ROMPIÉNDOLO, cada rotura restaurada de memoria (base 8/0):
//   · el corte por datos de clientes que no corta (sin el `return null`)            -> 7 / 1
//   · el corte sin mirar la marca del catálogo (`pii ?? false`)                      -> 7 / 1
//   · sin el crédito de Claude primero                                               -> 7 / 1
//   · «dashboard-conclusiones» sin la marca `pii` en el catálogo                      -> 7 / 1
//   · la llamada en la lista de las cajas sin marca                                  -> 7 / 1
//   · la marca en negativo (sólo la llamada: un lead quedaba sin ella)               -> 7 / 1
//   · la caja de gráficos manda la entrada sin pasar por `paraModelo`                -> 7 / 1
//   · un campo nuevo en el anuncio (sin revisar)                                     -> 7 / 1
//   · la caja no le pasa su marca a `pedirIAGratis`                                  -> 7 / 1
//   · la caja pasa siempre `pii: false`                                              -> 7 / 1
//   · `pedirIAGratis` no se la pasa a la red                                         -> 7 / 1
//
// Correr: npx tsx --test tests/graficos-ia-red.test.ts

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CATALOGO_MODELOS } from '../lib/model-catalogo';
import { CAJAS_SIN_DATOS_DE_CLIENTES, cajaLlevaDatosDeClientes, entradaDeAnuncio } from '../lib/graficos-ia-elemento';
import type { ScriptView } from '../lib/ads-analyst';

const RAIZ = join(__dirname, '..');
// Líneas `//` primero y bloques después (docs/hallazgos-ia.md, 16/10/2026).
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (...ruta: string[]) => sinComentarios(readFileSync(join(RAIZ, ...ruta), 'utf8'));
const RED = leer('lib', 'graficos-ia-red.ts');
const cuerpo = RED.slice(RED.indexOf('export async function porLaRedDePlataforma('));
/** Del `desde` hasta el primer `cierre` después: la llamada entera, sin lo que viene más abajo. */
const tramo = (s: string, desde: string, cierre: string) => {
  const i = s.indexOf(desde);
  assert.ok(i >= 0, `no está «${desde}»`);
  return s.slice(i, s.indexOf(cierre, i) + cierre.length);
};

test('la red del Dashboard: primero el crédito de Claude, después el corte por datos de clientes, después las keys gratis', () => {
  assert.ok(cuerpo.length > 500, `el cuerpo mide ${cuerpo.length}: ¿se movió la función?`);
  const credito = cuerpo.indexOf('conCreditoDeLaPlataforma(');
  const corte = cuerpo.indexOf('if (llevaDatosDeClientes(p.feature, p.pii)) {');
  const gratis = cuerpo.indexOf('provsGratisDePlataforma(');
  assert.ok(credito > 0, 'falta el crédito de Claude de la plataforma');
  assert.ok(corte > credito, 'el corte por datos de clientes va DESPUÉS del crédito de Claude');
  assert.ok(gratis > corte, 'las keys gratis van DESPUÉS del corte');
});

test('con datos de clientes la red termina antes de las keys gratis', () => {
  const desde = cuerpo.indexOf('if (llevaDatosDeClientes(p.feature, p.pii)) {');
  const rama = cuerpo.slice(desde, cuerpo.indexOf('\n  }', desde));
  assert.match(rama, /return null;/, 'el corte tiene que devolver null');
});

test('el corte lee la marca `pii` del catálogo cuando quien llama no la dice', () => {
  assert.match(RED, /export const llevaDatosDeClientes = \(feature: string, pii\?: boolean\): boolean =>\s*pii \?\? CATALOGO_MODELOS\.some\(\(f\) => f\.feature === feature && f\.pii === true\);/);
});

test('«Conclusiones de MaKo» lleva la marca `pii`; las otras dos IA del Dashboard, no', () => {
  const marca = (f: string) => CATALOGO_MODELOS.find((x) => x.feature === f)?.pii;
  assert.equal(marca('dashboard-conclusiones'), true);
  assert.equal(marca('dashboard-analista'), false);
  assert.equal(marca('dashboard-hoja-ia'), false);
});

// ── Caja por caja ─────────────────────────────────────────────────────────────────────────────
// La marca del catálogo es de la feature entera. Una regla que corta de más deja sin IA a cajas que no tienen
// nada sensible, así que cada caja dice lo suyo (`cajaLlevaDatosDeClientes`), en POSITIVO: lo que no está en
// la lista lleva la marca.

test('caja por caja: los gráficos y un anuncio van sin la marca; una llamada y un lead, con ella', () => {
  assert.deepEqual([...CAJAS_SIN_DATOS_DE_CLIENTES].sort(), ['anuncio', 'graficos']);
  assert.equal(cajaLlevaDatosDeClientes('graficos'), false);
  assert.equal(cajaLlevaDatosDeClientes('anuncio'), false);
  assert.equal(cajaLlevaDatosDeClientes('llamada'), true, 'el análisis y el transcript traen al lead');
  assert.equal(cajaLlevaDatosDeClientes('lead'), true, 'la ficha de un lead');
});

test('por qué los gráficos van sin la marca: la caja manda lo mismo que el AI Analyst, sin personas', () => {
  const server = leer('lib', 'graficos-ia-elemento-server.ts');
  // `paraModelo` es la salida de `serializarHoja`: las personas y los filtros sobre ellas como «Closer 1».
  assert.match(server, /user = userDeCaja\(c, \{ datos: paraModelo\(e\) \}\);/, 'la caja que lee gráficos manda paraModelo(e)');
  assert.equal(CATALOGO_MODELOS.find((x) => x.feature === 'dashboard-analista')?.pii, false, 'el AI Analyst manda lo mismo y va sin la marca');
});

test('por qué un anuncio va sin la marca: sus campos son números de Meta y lo que escribió quien armó la campaña', () => {
  // Un campo nuevo (los comentarios del anuncio, por ejemplo) hace fallar esto: se revisa antes de sumarlo.
  const datos = entradaDeAnuncio({ adId: '1', name: 'Anuncio' } as unknown as ScriptView).datos;
  assert.deepEqual(Object.keys(datos).sort(), [
    'agendas', 'alcance', 'angulo', 'campana', 'cierres', 'conjunto', 'ctr_pct', 'diagnostico', 'dias_con_gasto',
    'formato', 'frecuencia_veces', 'gancho_a_probar', 'gasto_usd', 'hook_rate_pct', 'impresiones', 'llegaron_al_final_pct',
  ]);
});

test('la marca de cada caja llega hasta la red de plataforma', () => {
  const server = leer('lib', 'graficos-ia-elemento-server.ts');
  const pedido = tramo(server, 'const r = await pedirIAGratis({', '});');
  assert.match(pedido, /pii: cajaLlevaDatosDeClientes\(p\.contexto \? p\.contexto\.tipo : 'graficos'\),/, 'la caja dice si lleva datos de clientes');
  const analisis = leer('lib', 'graficos-analisis-server.ts');
  const red = tramo(analisis.slice(analisis.indexOf('export async function pedirIAGratis(')), 'await porLaRedDePlataforma({', '});');
  assert.match(red, /pii: p\.pii,/, 'pedirIAGratis le pasa la marca a la red');
});
