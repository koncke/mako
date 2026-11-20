// =============================================================================
// Replicar el guion de otro, SÓLO en MaKo Pro: LAS PUERTAS QUE QUEDABAN (14/11/2026)
// =============================================================================
// El 14/11 se cerró «Replicar» en las pantallas obvias (lib/copywriter/replica-candado.ts, y su molde de landings en
// tests/replicar-solo-pro.test.ts). Una verificación adversarial encontró que la función tenía OTRAS puertas abiertas, y que
// el candado además había dejado un botón muerto. Este archivo las ata, una por una:
//   1. /api/copywriter/ia — la puerta PRINCIPAL. Una página con `props.outlier` ES una réplica: el original entero va al
//      prompt y vuelve el guion adaptado (lib/copywriter/ia.ts, `conElOriginal`), en «Editar» y en «Discutir». El Essential se
//      llevaba la réplica completa sin tocar ninguna de las cinco puertas cerradas.
//   2. /api/competitor-spy/copiar — «Hacer uno así», el botón que la columna de Pro vende con esas palabras.
//   3. La API de MaKo (lib/api-mako/areas/copywriter.run.ts) — el candado estaba sólo en `ejecutar`: por WhatsApp MaKo
//      PROPONÍA la réplica a un Essential, quemaba la pendiente con el «sí» y recién ahí decía que no. Va al PROPONER.
//   4. La pantalla — dentro del original abierto, el cartel se dibujaba detrás del modal: el candado va ADENTRO.
// Y lo que NO se cierra, que es la otra forma de fallar: Pro, el Accelerator, el super admin, el ws1 y los acuerdos a mano
// pasan (`esEsencialPorPasarela`), y escribir un guion desde cero sigue en los dos planes.
//
// Probado rompiéndolo (14/11/2026): al pie del archivo.
// Correr: node --import tsx --test tests/copywriter-replicar-solo-pro.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { FUNCIONES_SOLO_PRO, textoSoloPro } from '../lib/topes-plan';
import { esEsencialPorPasarela, WS_SIN_PLAN_DE_PASARELA } from '../lib/plan-esencial-reglas';
import { sanearProps } from '../lib/copywriter/tipos';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** `a` aparece antes que `b` (las dos tienen que estar). */
function antes(src: string, a: string, b: string, que: string): void {
  const i = src.indexOf(a);
  const j = src.indexOf(b);
  assert.ok(i >= 0, `${que}: falta ${a}`);
  assert.ok(j >= 0, `${que}: falta ${b}`);
  assert.ok(i < j, `${que}: ${a} tiene que ir antes que ${b}`);
}
/** El cuerpo de una operación de un `.run.ts` (de su clave a la siguiente). */
function operacion(rel: string, nombre: string, siguiente: string): string {
  const src = fuente(rel);
  const i = src.indexOf(`  ${nombre}: {`);
  assert.ok(i >= 0, `no encontré ${nombre} en ${rel}`);
  const j = src.indexOf(`  ${siguiente}: {`, i);
  return src.slice(i, j > 0 ? j : undefined);
}

const RUTA_IA = 'app/api/copywriter/ia/route.ts';
const RUTA_SPY = 'app/api/competitor-spy/copiar/route.ts';
const API = 'lib/api-mako/areas/copywriter.run.ts';
const CANDADO = 'lib/copywriter/replica-candado.ts';
const EN_PANTALLA = /const pro = await candadoDeReplicarGuionEnPantalla\(\);\n\s*if \(pro\) return Response\.json\(\{ ok: false, \.\.\.pro \}, \{ status: 403/;

test('la regla no cambió: replicar el guion de otro es de Pro, y el candado dice qué es y cómo tenerlo', () => {
  assert.ok((FUNCIONES_SOLO_PRO as readonly string[]).includes('replicar-guion'));
  assert.equal(textoSoloPro('replicar-guion'), 'Replicar el guion de otro es de MaKo Pro. Pasa a Pro para usarlo.');
});

test('EL QUE PAGA PASA: sólo el Essential de la pasarela lleva candado (Pro, Accelerator, super admin y los de a mano, no)', () => {
  // La capa que se le VENDIÓ y la que tiene hoy, las dos `completo` (lib/plan-esencial-reglas.ts). Es la única combinación
  // con candado: cerrarle la puerta a quien paga es tan grave como dejarla abierta.
  const caso = (e: { ws: number; capa: string | null; capaVendida: string | null }) =>
    esEsencialPorPasarela({ wsPlataforma: 9, ...e });
  assert.equal(caso({ ws: 3, capa: 'completo', capaVendida: 'completo' }), true, 'Essential por la pasarela: candado');
  assert.equal(caso({ ws: 3, capa: 'agencia', capaVendida: 'agencia' }), false, 'MaKo Pro pasa');
  assert.equal(caso({ ws: 3, capa: 'agencia', capaVendida: 'completo' }), false, 'el que subió a Pro pasa desde el cambio');
  assert.equal(caso({ ws: 3, capa: 'completo', capaVendida: null }), false, 'sin suscripción de la pasarela (acuerdo a mano) pasa');
  assert.equal(caso({ ws: 9, capa: 'completo', capaVendida: 'completo' }), false, 'la plataforma (el super admin) pasa');
  assert.ok(WS_SIN_PLAN_DE_PASARELA.has(1));
  assert.equal(caso({ ws: 1, capa: 'completo', capaVendida: 'completo' }), false, 'el ws1 pasa');
  // Y ANTE LA DUDA, PASA: si no se puede leer el plan, el candado es null (nunca tira).
  const src = fuente(CANDADO);
  assert.match(src, /\} catch \{\n\s*return null;\n\s*\}/, 'si no se puede leer el plan, no hay candado');
  // 20/11: la prueba del reto lo abre UNA vez (lib/reto/pro-del-reto.ts, R57-03); después, el candado de siempre.
  assert.ok(src.includes("return w != null && (await esEsencialDe(w)) && !(await abreElReto('replicar-guion', { ws: w, usar: true })) ? textoSoloPro('replicar-guion') : null;"));
});

test('1. LA PUERTA PRINCIPAL: /api/copywriter/ia frena una página que replica, antes de leer los archivos', () => {
  const src = fuente(RUTA_IA);
  assert.match(src, /if \(sanearProps\(guion\.props\)\.outlier\) \{\n\s*const pro = await candadoDeReplicarGuionEnPantalla\(\);/);
  assert.match(src, EN_PANTALLA, 'el 403 lleva `pasarAPro`, que es lo que la pantalla reconoce');
  // Después de la puerta de siempre (quien no ve la tab no llega) y antes de lo que cuesta: los archivos y la IA.
  antes(src, "soloAdminDeTab('copywriter')", 'candadoDeReplicarGuionEnPantalla()', RUTA_IA);
  antes(src, 'candadoDeReplicarGuionEnPantalla()', 'await leerLosArchivos(', RUTA_IA);
  antes(src, 'candadoDeReplicarGuionEnPantalla()', 'await discutir(', RUTA_IA);
  antes(src, 'candadoDeReplicarGuionEnPantalla()', 'await editar(', RUTA_IA);
  // QUÉ es una réplica: `props.outlier` con su forma (lo mismo que mira el server al armar el prompt).
  assert.equal(sanearProps({ outlier: 'spy:12' }).outlier, 'spy:12');
  assert.equal(sanearProps({ outlier: 'pegado:-3' }).outlier, 'pegado:-3');
  assert.equal(sanearProps({ outlier: 'biblioteca:7' }).outlier, 'biblioteca:7');
  // Y lo que NO es una réplica y sigue en los dos planes: escribir desde cero, una plantilla y «Adaptar a mi negocio».
  assert.equal(sanearProps({}).outlier, undefined, 'una página sin original no lleva candado');
  assert.equal(sanearProps({ plantilla: 'vsl' }).outlier, undefined, 'una plantilla no es replicar a otro');
  // El original que entra al prompt sale de `props.outlier`: si eso no frena, nada frena.
  assert.match(fuente('lib/copywriter/ia.ts'), /return props\.outlier \? \[\{ tipo: 'outlier', id: props\.outlier, nombre: NOMBRE_DEL_ORIGINAL \}, \.\.\.refs\] : refs;/);
});

test('1b. NADIE MÁS llama a la escritura con IA del Copywriter sin su candado (una entrada nueva se mira acá)', () => {
  // `editar`/`discutir` de lib/copywriter/ia.ts son las que meten el original en el prompt. Hoy las llaman dos: la ruta de la
  // pantalla y la API de MaKo, y las dos tienen el candado. Una tercera entrada tiene que pasar por este test.
  const quienes: string[] = [];
  const recorrer = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n.startsWith('.')) continue;
      const p = join(dir, n);
      if (statSync(p).isDirectory()) { recorrer(p); continue; }
      if (!/\.(ts|tsx)$/.test(n)) continue;
      const rel = relative(RAIZ, p).replace(/\\/g, '/');
      const src = readFileSync(p, 'utf8');
      // El `./ia` relativo vale sólo DENTRO de lib/copywriter: el editor de landings tiene su propio `./ia` con un `editar`
      // (lib/editor-landing/diagnostico-aplicar.ts), que es otra cosa y la cuida `replicar-candado` de landings.
      const de = rel.startsWith('lib/copywriter/') ? /(?:@\/lib\/copywriter|\.)\/ia/ : /@\/lib\/copywriter\/ia/;
      const imp = src.match(new RegExp(`import \\{([^}]*)\\} from '${de.source}'`));
      // `FEATURE_COPY` sola no escribe nada (la usa el lector de archivos): sólo `editar` y `discutir`.
      if (imp && /\b(editar|discutir)\b/.test(imp[1])) quienes.push(rel);
    }
  };
  recorrer(join(RAIZ, 'app'));
  recorrer(join(RAIZ, 'lib'));
  assert.deepEqual(quienes.sort(), [API, RUTA_IA].sort(),
    'una entrada nueva a «Editar»/«Discutir» del Copywriter: que lleve el candado de replicar cuando la página tenga props.outlier');
});

test('2. EL BOTÓN DE SPY: «Hacer uno así» frena arriba de todo, antes de leer el cuerpo y de tocar la base', () => {
  const src = fuente(RUTA_SPY);
  assert.match(src, EN_PANTALLA);
  antes(src, "if (!s || ws == null) return no(401, 'No autorizado');", 'candadoDeReplicarGuionEnPantalla()', RUTA_SPY);
  antes(src, 'candadoDeReplicarGuionEnPantalla()', 'await req.json()', RUTA_SPY);
  antes(src, 'candadoDeReplicarGuionEnPantalla()', 'await leerPieza(', RUTA_SPY);
  // Las DOS salidas: la página del Copywriter y el texto al portapapeles son el mismo brief de la réplica.
  antes(src, 'candadoDeReplicarGuionEnPantalla()', 'return Response.json({ ok: true, texto }', RUTA_SPY);
  antes(src, 'candadoDeReplicarGuionEnPantalla()', 'await crear(', RUTA_SPY);
});

test('3. LA API DE MaKo: los dos «replicar» frenan AL PROPONER, no después del «sí»', () => {
  const outlier = operacion(API, 'replicar_outlier_copywriter', 'replicar_link_o_texto_copywriter');
  const pegado = operacion(API, 'replicar_link_o_texto_copywriter', 'NO_HAY_OTRA_DESPUES');
  for (const [nombre, op] of [['replicar_outlier_copywriter', outlier], ['replicar_link_o_texto_copywriter', pegado]] as const) {
    const preparar = op.slice(0, op.indexOf('ejecutar:'));
    assert.ok(preparar.includes('preparar:'), `${nombre}: tiene que proponer antes de ejecutar`);
    assert.match(preparar, /const pro = await candadoDeReplicarGuion\(ctx\.ws\);\n\s*if \(pro\) return \{ error: pro \};/, nombre);
    // Con el negocio del pedido (`ctx.ws`): por WhatsApp no hay sesión.
    antes(preparar, 'candadoDeReplicarGuion(ctx.ws)', "str(input, '", `${nombre}: antes de mirar el pedido`);
  }
  // Al ejecutar lo frena la función del server, que tiene el candado de primera línea: entre proponer y confirmar el plan
  // puede cambiar. Si eso se mueve, este test cae.
  assert.match(fuente('lib/copywriter/outliers-servidor.ts'), /export async function replicarOutlier\(id: string\)[^\n]*\{\n(?:\s*\/\/[^\n]*\n)*\s*const pro = await candadoDeReplicarGuion\(\);\n\s*if \(pro\) return \{ ok: false, error: pro, status: 403 \};/);
  assert.ok(/const pro = await candadoDeReplicarGuion\(\);/.test(fuente('lib/copywriter/pegado-servidor.ts')), 'replicarPegado sigue con su candado');
  // Y ESCRIBIR en una página que replica es la misma puerta que la ruta de la pantalla (el otro llamador de `editarConIA`).
  const editar = operacion(API, 'editar_documento_copywriter', 'outliers_copywriter');
  assert.match(editar, /if \(r\.doc\.props\.outlier\) \{\n\s*const pro = await candadoDeReplicarGuion\(ctx\.ws\);\n\s*if \(pro\) return \{ error: pro \};\n\s*\}/);
  antes(editar, 'r.doc.props.outlier', 'await editarConIA(', 'editar_documento_copywriter: antes de llamar a la IA');
  assert.ok(editar.indexOf('props.outlier') > editar.indexOf('const r = await abrir(id);'), 'el plan se mira sobre el documento abierto');
});

test('4. LA PANTALLA: el candado EN EL LUGAR de «Replicar» dentro del original abierto (no detrás del modal)', () => {
  const modal = fuente('app/copywriter/OutlierAbierto.tsx');
  assert.match(modal, /import \{ CandadoSoloPro \} from '@\/app\/_components\/CandadoSoloPro';/);
  assert.match(modal, /soloPro\?: boolean;/);
  // En la computadora, donde iba el botón grande.
  assert.match(modal, /\{celular \? null : soloPro \? \(\n(?:\s*\/\*[\s\S]*?\*\/\n)?\s*<CandadoSoloPro funcion="replicar-guion" \/>\n\s*\) : \(\n\s*<button type="button" className=\{s\.editarGrande\}/);
  // Y en el celular, en el pie fijo (donde «Replicar» está siempre a la vista).
  assert.match(modal, /pie=\{celular \? \(soloPro\n\s*\? <CandadoSoloPro funcion="replicar-guion"[^\n]*\n\s*: <button type="button" className=\{s\.editarPie\}/);
  const portada = fuente('app/copywriter/OutliersCopy.tsx');
  assert.match(portada, /<OutlierAbierto o=\{abierto\} telefono=\{telefono\} replicando=\{replicando === abierto\.id\} soloPro=\{soloPro\}/);
  // El cartel de la portada (la tarjeta) se trae a la vista: arriba de la grilla, tocando «Replicar» abajo no se veía.
  assert.match(portada, /useEffect\(\(\) => \{ if \(candado\) refCandado\.current\?\.scrollIntoView\(\{ block: 'center', behavior: 'smooth' \}\); \}, \[candado\]\);/);
  assert.match(portada, /\{candado && <div ref=\{refCandado\}><CandadoSoloPro funcion="replicar-guion"/);
  // Y la pantalla sigue prendiendo el candado con el primer 403 del server (`pasarAPro`), que es lo que lo hace aparecer
  // también cuando el plan se sabe recién al pedir.
  assert.match(portada, /if \(esRespuestaSoloPro\(r\)\) \{ marcarSoloPro\('replicar-guion'\); setCandado\(true\); return; \}/);
});

// Probado rompiéndolo (14/11/2026), una rotura por vez sobre la base en verde (7 / 0), restaurando el texto exacto y nunca con
// git. Rota (pases / fallos):
//   · /api/copywriter/ia sin su candado                                        → 6 / 1
//   · el candado de la ruta de IA DESPUÉS de leer los archivos (lo que cuesta) → 6 / 1
//   · /api/competitor-spy/copiar sin candado                                   → 6 / 1
//   · `replicar_outlier_copywriter` con el candado sólo en `ejecutar`          → 6 / 1
//   · `replicar_link_o_texto_copywriter` con el candado sólo en `ejecutar`     → 6 / 1
//   · `editar_documento_copywriter` sin mirar `props.outlier`                  → 6 / 1
//   · el modal del original abierto con el botón de siempre                    → 6 / 1
//   · el mismo modal con el botón de siempre sólo en el pie del celular        → 6 / 1
//   · el cartel de la portada sin traerse a la vista                           → 6 / 1
// ⚠️ La guarda 1b se probó sola, de verdad: escrita sin acotar el `./ia` relativo, encontró un TERCER importador
//    (lib/editor-landing/diagnostico-aplicar.ts, el `editar` del editor de landings, que es otra cosa) y dio rojo. O sea que ve
//    un llamador nuevo; lo que se acotó fue a qué `./ia` mira, no la guarda.
// ⚠️ Lo que este archivo NO prueba: que el 403 salga de verdad contra la base (`esEsencialDe` lee `cobros`). Eso lo cubre
//    tests/plan-esencial.test.ts sobre la regla pura, que es la que decide quién lleva candado.
