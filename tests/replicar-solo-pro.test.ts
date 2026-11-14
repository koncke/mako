// =============================================================================
// Copiar la landing de otro negocio («Replicar»), SÓLO en MaKo Pro (14/11/2026)
// =============================================================================
// Martín: «Copiar páginas de la competencia… Eso no lo puede hacer el de 47, sí lo puede hacer el de 97». Hasta hoy, cualquier
// plan replicaba: la pantalla, la API de MaKo y la ruta de IA del editor bajaban la página ajena y la copiaban. Lo que se cuida:
//   · la regla y el texto (lib/topes-plan.ts, `FUNCIONES_SOLO_PRO`, `textoSoloPro`);
//   · el candado del servidor, en un lugar (lib/editor-landing/replicar-candado.ts), y LO PRIMERO de `replicar()` y de
//     `leerParaReplicar()`: quien las llame queda con el candado. Nadie más las importa sin que este test lo sepa;
//   · las puertas: las dos rutas de la pantalla (403 con `pasarAPro`, antes de leer el cuerpo), el esquema «importar» de la
//     ruta de IA (la puerta vieja de Replicar) y la operación `replicar_landing` de la API (al proponer y al ejecutar);
//   · la pantalla: Replicar no arranca sin saber el plan y a un Esencial le muestra el candado; la caja de crear pone el
//     candado en el modo y no manda; «Copiar su sitio» de Competitor Spy lleva el candado en vez del link.
//
// Probado rompiéndolo (14/11/2026): al pie del archivo.
// Correr: node --import tsx --test tests/replicar-solo-pro.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FUNCIONES_SOLO_PRO, RUTA_CAMBIAR_PLAN, textoSoloPro } from '../lib/topes-plan';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** El cuerpo de una función de un archivo (hasta la función siguiente). */
function cuerpo(rel: string, nombre: string): string {
  const src = fuente(rel);
  const i = src.search(new RegExp(`\\n(?:export )?(?:async )?function ${nombre}\\(`));
  assert.ok(i >= 0, `no encontré ${nombre} en ${rel}`);
  const resto = src.slice(i + 1);
  const fin = resto.search(/\n(?:export )?(?:async )?function |\nexport const |\n\/\*\*/);
  return fin > 0 ? resto.slice(0, fin) : resto;
}
/** `a` aparece antes que `b` en `src` (las dos tienen que estar). */
function antes(src: string, a: string | RegExp, b: string | RegExp, que: string): void {
  const i = typeof a === 'string' ? src.indexOf(a) : src.search(a);
  const j = typeof b === 'string' ? src.indexOf(b) : src.search(b);
  assert.ok(i >= 0, `${que}: falta ${String(a)}`);
  assert.ok(j >= 0, `${que}: falta ${String(b)}`);
  assert.ok(i < j, `${que}: ${String(a)} tiene que ir antes que ${String(b)}`);
}

const RUTA_REPLICAR = 'app/api/landing-generator/replicar/route.ts';
const RUTA_LEER = 'app/api/landing-generator/replicar/leer/route.ts';
const RUTA_IA = 'app/api/landing-generator/ia/route.ts';
const CANDADO = 'lib/editor-landing/replicar-candado.ts';
const API = 'lib/api-mako/areas/landing.run.ts';
const CANDADO_EN_RUTA = /const pro = await candadoDeReplicarEnPantalla\(\);\n\s*if \(pro\) return falla\(403, pro\.error, \{ pasarAPro: pro\.pasarAPro \}\);/;

test('la regla: copiar landings es de Pro, y el candado dice qué es y cómo tenerlo', () => {
  assert.ok((FUNCIONES_SOLO_PRO as readonly string[]).includes('replicar-landing'));
  assert.equal(textoSoloPro('replicar-landing'), 'Copiar la landing de otro negocio es de MaKo Pro. Pasa a Pro para usarlo.');
  assert.equal(RUTA_CAMBIAR_PLAN, '/configuraciones/plan', '«Pasar a Pro» lleva a «Tu plan»');
});

test('el candado del servidor: Esencial por la pasarela, ante la duda pasa, y la forma del scraper para las rutas', () => {
  const api = cuerpo(CANDADO, 'candadoDeReplicar');
  assert.match(api, /return w != null && \(await esEsencialDe\(w\)\) \? textoSoloPro\('replicar-landing'\) : null;/);
  assert.match(api, /\} catch \{\n\s*return null;\n\s*\}/, 'si no se puede leer el plan, no hay candado');
  const pantalla = cuerpo(CANDADO, 'candadoDeReplicarEnPantalla');
  assert.match(pantalla, /if \(!\(await esEsencialDeLaSesion\(\)\)\) return null;/);
  assert.match(pantalla, /return \{ error: textoSoloPro\('replicar-landing'\), pasarAPro: await rutaConWs\(RUTA_CAMBIAR_PLAN\) \};/);
});

test('UN SOLO PUNTO: lo primero de replicar() y de leerParaReplicar() es el candado', () => {
  assert.match(cuerpo('lib/editor-landing/replicar.ts', 'replicar'),
    /^export async function replicar\([^\n]*\{\n(?:\s*\/\/[^\n]*\n)*\s*const pro = await candadoDeReplicar\(\);\n\s*if \(pro\) return falla\(pro, 403\);/);
  assert.match(cuerpo('lib/editor-landing/replicar-lectura.ts', 'leerParaReplicar'),
    /^export async function leerParaReplicar\([^\n]*\{\n(?:\s*\/\/[^\n]*\n)*\s*const pro = await candadoDeReplicar\(\);\n\s*if \(pro\) return \{ ok: false, error: pro, status: 403 \};/);
});

test('nadie más llama a replicar() ni a leerParaReplicar() sin pasar por este test (una puerta nueva se mira acá)', () => {
  const conocidos = new Set([RUTA_REPLICAR, RUTA_LEER, API]);
  const quienes: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { recorrer(p); continue; }
      if (!/\.(ts|tsx)$/.test(n)) continue;
      const src = readFileSync(p, 'utf8');
      // `replicar` del módulo replicar.ts (no replicar-reglas, -partes, …) o una llamada a `leerParaReplicar`.
      if (/import \{[^}]*\breplicar\b[^}]*\} from '(?:@\/lib\/editor-landing|\.)\/replicar'/.test(src) || /\bawait leerParaReplicar\(/.test(src)) {
        quienes.push(relative(RAIZ, p).replace(/\\/g, '/'));
      }
    }
  };
  recorrer(join(RAIZ, 'app'));
  recorrer(join(RAIZ, 'lib'));
  const nuevos = quienes.filter((q) => !conocidos.has(q));
  assert.deepEqual(nuevos, [], 'una puerta nueva a la réplica: el candado ya lo pone replicar(), pero que conteste como las rutas (403 con pasarAPro) o como la API');
  for (const c of [RUTA_REPLICAR, RUTA_LEER, API]) assert.ok(quienes.includes(c), `${c} sigue llamando a la réplica`);
});

test('LAS RUTAS de la pantalla: 403 con pasarAPro, después de la puerta de siempre y antes de leer el cuerpo', () => {
  for (const rel of [RUTA_REPLICAR, RUTA_LEER]) {
    const post = cuerpo(rel, 'POST');
    assert.match(post, CANDADO_EN_RUTA, rel);
    antes(post, "if (!tabEnCapa('landing-writer', await getCapaActual())) return falla(404, 'No existe');", 'candadoDeReplicarEnPantalla()', rel);
    antes(post, 'candadoDeReplicarEnPantalla()', 'await req.json()', rel);
  }
  antes(cuerpo(RUTA_REPLICAR, 'POST'), 'candadoDeReplicarEnPantalla()', 'await replicar(', RUTA_REPLICAR);
  antes(cuerpo(RUTA_LEER, 'POST'), 'candadoDeReplicarEnPantalla()', 'await leerParaReplicar(', RUTA_LEER);
  // La falla de la ruta de replicar tipa `pasarAPro` (RespuestaReplicar, lib/editor-landing/replicar-reglas.ts).
  assert.match(fuente('lib/editor-landing/replicar-reglas.ts'), /\{ ok: false; error: string; probar\?: FormatoReplicar; pasarAPro\?: string \}/);
});

test('LA RUTA DE IA: el esquema «importar» (baja una página de afuera) lleva el candado; generar y pegar no', () => {
  const post = cuerpo(RUTA_IA, 'POST');
  const caso = post.slice(post.indexOf("case 'esquema':"), post.indexOf("case 'secciones':"));
  assert.match(caso, /if \(body\.modo === 'importar'\) \{\n\s*const pro = await candadoDeReplicarEnPantalla\(\);\n\s*if \(pro\) return Response\.json\(\{ ok: false, error: pro\.error, pasarAPro: pro\.pasarAPro \}, \{ status: 403 \}\);\n\s*\}/);
  antes(caso, 'candadoDeReplicarEnPantalla()', 'await esquema(', RUTA_IA);
});

test('LA API DE MaKo: replicar_landing frena al proponer y al ejecutar, con el negocio del pedido', () => {
  const run = fuente(API);
  const op = run.slice(run.indexOf('  replicar_landing: {'), run.indexOf('  renombrar_landing: {'));
  assert.ok(op.length > 0, 'replicar_landing');
  const preparar = op.slice(0, op.indexOf('ejecutar:'));
  const ejecutar = op.slice(op.indexOf('ejecutar:'));
  assert.match(preparar, /const pro = await candadoDeReplicar\(ctx\.ws\);\n\s*if \(pro\) return \{ error: pro \};/);
  antes(preparar, 'candadoDeReplicar(ctx.ws)', "str(input, 'url')", 'preparar: antes de mirar el pedido');
  assert.match(ejecutar, /const pro = await candadoDeReplicar\(ctx\.ws\);\n\s*if \(pro\) return \{ ok: false, resumen: pro \};/);
  antes(ejecutar, 'candadoDeReplicar(ctx.ws)', 'replicarEnEditor(', 'ejecutar: antes de replicar');
});

test('LA PANTALLA: Replicar con el candado (y sin arrancar hasta saber el plan), la caja y «Copiar su sitio»', () => {
  const rep = fuente('app/web-generator/crear/Replicar.tsx');
  assert.match(rep, /export const TEXTO_CANDADO_REPLICAR = textoSoloPro\('replicar-landing'\);/);
  assert.match(cuerpo('app/web-generator/crear/Replicar.tsx', 'CandadoReplicar'), /<CandadoSoloPro funcion="replicar-landing" style=\{style\} \/>/);
  const una = cuerpo('app/web-generator/crear/Replicar.tsx', 'ReplicarUnaPagina');
  assert.match(una, /const plan = usePlanEsencial\(\);\n\s*const candado = useSoloPro\('replicar-landing'\);\n\s*if \(!candado && plan === false\) return <ReplicarAbierto \{\.\.\.props\} \/>;\n\s*return <ReplicarConCandado/,
    'abierto SÓLO sabiendo que no es Esencial: con `auto` leería sola (paga IA)');
  assert.match(cuerpo('app/web-generator/crear/Replicar.tsx', 'ReplicarConCandado'), /\{candado && <CandadoReplicar /);
  assert.match(cuerpo('app/web-generator/crear/Replicar.tsx', 'FallaReplicar'), /if \(error === TEXTO_CANDADO_REPLICAR\) return <CandadoReplicar /, 'la falla del Diagnóstico');
  // El candado de todas las funciones de Pro: el texto y «Pasar a Pro» a «Tu plan», dentro de CtaPasarAPro.
  const candado = fuente('app/_components/CandadoSoloPro.tsx');
  assert.match(candado, /textoSoloPro\(funcion\)/);
  assert.match(candado, /<CtaPasarAPro><Link href=\{RUTA_CAMBIAR_PLAN\}[^>]*>\{ROTULO_PASAR_A_PRO\}<\/Link><\/CtaPasarAPro>/);

  const caja = fuente('app/web-generator/CajaCrear.tsx');
  assert.match(caja, /const soloPro = useSoloPro\('replicar-landing'\);\n\s*const candado = soloPro && estado\.modo === 'replicar';/);
  assert.match(caja, /if \(appEscritorio\.bloqueada \|\| candado\) return;/, 'el ↑ no manda');
  assert.match(caja, /listo=\{!candado && listoParaEnviar\(estado, escritoLink\)\}/);
  assert.match(caja, /vista === 'link' \? \(candado \? <CandadoReplicar \/> : contenedorLink\) : null/);
  assert.match(caja, /bajoElCampo=\{candado && vista !== 'link' \? <CandadoReplicar \/> : bajo\}/);
  assert.match(caja, /const conCandado = soloPro && o\.id === 'replicar';/);
  assert.match(caja, /\{conCandado && <span className="gp-cc-modo-candado" aria-hidden="true"><Ico n="candado"/, 'el modo lleva el candado');

  const spy = fuente('app/competitor-spy/SusPaginas.tsx');
  assert.match(spy, /const soloPro = useSoloPro\('replicar-landing'\);/);
  assert.match(spy, /\{soloPro \? \([\s\S]{0,400}Copiar su sitio<IconoCandado \/>[\s\S]{0,80}\) : <a href=\{conWs\(hrefReplicar\(destino\), ws\)\} className="spy-boton">Copiar su sitio<\/a>\}/);
  assert.match(spy, /\{soloPro && verCandado && \(\n\s*<CandadoSoloPro funcion="replicar-landing"/);
});

// Probado rompiéndolo (14/11/2026), una rotura por vez sobre la base en verde, restaurando el texto a mano (nunca git). Rota
// (pases / fallos):
//   · `replicar()` sin su candado                                                → 7 / 1
//   · la ruta /replicar/leer sin candado                                         → 7 / 1
//   · `replicar_landing` sin candado al ejecutar                                 → 7 / 1
//   · «Copiar su sitio» siempre con el link                                     → 7 / 1
