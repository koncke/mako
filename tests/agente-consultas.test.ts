// =============================================================================
// Lo que un agente EXTERNO puede leer de MaKo, y por qué se enumera a mano
// =============================================================================
// `/api/agente/consultar` corre las MISMAS herramientas que MaKo adentro de la
// app. Eso es correcto —una cosa, un lugar— y trae dos riesgos que no dan error:
//
//   1. Que la lista blanca se derive de MAKO_TOOLS. Ese módulo declara en su
//      cabecera que los «proponer» (escrituras) llegan en la próxima fase: el día
//      que llegue el primero, una lista derivada lo expone solo. Por eso está
//      escrita en positivo, y por eso este test falla cuando MAKO_TOOLS crece —
//      obliga a DECIDIR si la nueva entra, en vez de que entre sola.
//   2. Que un nombre de parámetro no coincida. Eso no rompe: la lib lee una clave
//      que no llegó y contesta «pasa un texto para buscar», como si el agente no
//      hubiera mandado nada. Tres de los nueve no se llaman como uno esperaría.
// Correr: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  CONSULTAS_AGENTE, PARAMS_CONSULTA, consultaPermitida, inputDeConsulta,
} from '../lib/agente-consultas';

// `lib/mako-tools.ts` lleva `server-only`, así que no se puede importar desde un
// test. Se leen los esquemas del fuente, que es lo que hace `catalogo-fuera-del-
// bundle.test.ts` por el mismo motivo.
const FUENTE = readFileSync(new URL('../lib/mako-tools.ts', import.meta.url), 'utf8');

/** Los `name:` declarados en MAKO_TOOLS. */
function nombresDeTools(): string[] {
  return [...FUENTE.matchAll(/^\s{4}name: '([a-z_]+)',$/gm)].map((m) => m[1]);
}

/** El bloque de texto de una tool, desde su `name:` hasta el próximo. */
function bloqueDe(nombre: string): string {
  const i = FUENTE.indexOf(`name: '${nombre}'`);
  assert.notEqual(i, -1, `MAKO_TOOLS no declara ninguna tool llamada «${nombre}»`);
  const sig = FUENTE.slice(i + 1).search(/\n\s{4}name: '/);
  return sig === -1 ? FUENTE.slice(i) : FUENTE.slice(i, i + 1 + sig);
}

test('cada consulta habilitada EXISTE en MAKO_TOOLS con ese nombre exacto', () => {
  const reales = new Set(nombresDeTools());
  assert.ok(reales.size >= 9, `se esperaban al menos 9 tools y se leyeron ${reales.size}: cambió el formato del archivo`);
  for (const c of CONSULTAS_AGENTE) {
    assert.ok(reales.has(c), `«${c}» está habilitada para el agente y no existe en MAKO_TOOLS`);
  }
});

test('LA GUARDA: si MAKO_TOOLS crece, alguien tiene que DECIDIR si la nueva se expone', () => {
  // No se compara contra un número: se compara contra la lista de las que hoy
  // existen y se sabe que son de lectura. Una tool nueva hace fallar este test, y
  // ese es el punto — la alternativa es que entre sola por una lista derivada.
  // `ver_plan` y `metricas_negocio` NO se exponen por acá y no es un olvido: las
  // dos ya tienen su propia puerta (`GET /api/agente/plan` y `/api/agente/metricas`),
  // con el formato que la skill enseña a usar. Dos caminos al mismo dato son dos
  // formatos que divergen.
  const CONOCIDAS = new Set([...CONSULTAS_AGENTE, 'ver_plan', 'metricas_negocio']);
  const nuevas = nombresDeTools().filter((n) => !CONOCIDAS.has(n));
  assert.deepEqual(
    nuevas, [],
    `MAKO_TOOLS tiene tools que este módulo no conoce: ${nuevas.join(', ')}. ` +
    'Si son de LECTURA y el agente externo las tiene que ver, sumalas a CONSULTAS_AGENTE. ' +
    'Si ESCRIBEN o proponen, sumalas acá a CONOCIDAS y NO a CONSULTAS_AGENTE.',
  );
});

test('`ver_plan` NO se expone por acá: ya tiene su propia puerta', () => {
  // Dos caminos al mismo dato son dos formatos que divergen, y la skill enseña el
  // de /api/agente/plan.
  assert.equal(consultaPermitida('ver_plan'), false);
});

test('nada que no esté en la lista pasa — fail-closed', () => {
  assert.equal(consultaPermitida('proponer_lead'), false);
  assert.equal(consultaPermitida('proponer_cambio_etapa'), false);
  assert.equal(consultaPermitida(''), false);
  assert.equal(consultaPermitida('buscar_leads '), true, 'se recorta el espacio, no se rechaza por eso');
});

test('cada parámetro declarado EXISTE en el input_schema de su tool', () => {
  // El bug silencioso: `buscar_tutorial` pide `tema` y no `texto`. Con el nombre
  // equivocado la lib no encuentra la clave y contesta como si no hubiera llegado
  // nada — sin error, sin 400, sin nada que apunte acá.
  for (const que of CONSULTAS_AGENTE) {
    const bloque = bloqueDe(que);
    for (const p of PARAMS_CONSULTA[que]) {
      assert.match(
        bloque, new RegExp(`\\b${p.nombre}:\\s*\\{`),
        `«${que}» declara el parámetro «${p.nombre}» y el input_schema de esa tool no lo tiene`,
      );
    }
  }
});

test('los obligatorios coinciden con el `required` de la tool', () => {
  for (const que of CONSULTAS_AGENTE) {
    const bloque = bloqueDe(que);
    const m = /required:\s*\[([^\]]*)\]/.exec(bloque);
    const exigidos = new Set(m ? [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : []);
    const nuestros = new Set(PARAMS_CONSULTA[que].filter((p) => p.obligatorio).map((p) => p.nombre));
    assert.deepEqual(
      [...nuestros].sort(), [...exigidos].sort(),
      `«${que}»: la tool exige [${[...exigidos]}] y acá se marcan obligatorios [${[...nuestros]}]`,
    );
  }
});

test('falta un obligatorio → el error DICE cuál, para que el agente se corrija', () => {
  const r = inputDeConsulta('buscar_leads', () => null);
  assert.ok('error' in r);
  assert.match(r.error, /texto/);
});

test('un número que no es número se rechaza en vez de llegar como NaN', () => {
  const r = inputDeConsulta('ficha_lead', () => 'el de ana');
  assert.ok('error' in r);
  assert.match(r.error, /número/);
});

test('los opcionales que no vienen NO se mandan como vacíos', () => {
  // Mandar `limite: ''` o `limite: 0` pisaría el default de la lib con algo que
  // el agente nunca pidió.
  const r = inputDeConsulta('historial_whatsapp', (k) => (k === 'leadId' ? '42' : null));
  assert.ok('input' in r);
  assert.deepEqual(r.input, { leadId: 42 });
});

test('solo pasa lo DECLARADO: una clave inventada no llega al runner', () => {
  // Un `Object.fromEntries(searchParams)` le entregaría al runner cualquier cosa
  // que alguien ponga en la URL, y esas claves terminan adentro del `input` que
  // las libs leen por nombre.
  const r = inputDeConsulta('ver_funnel', () => 'lo que sea');
  assert.ok('input' in r);
  assert.deepEqual(r.input, {}, 'ver_funnel no toma parámetros: no puede llegarle ninguno');
});
