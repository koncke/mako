// =============================================================================
// La galería de Automations por la API de MaKo: `listar_plantillas_automatizaciones` y
// `crear_automatizacion_desde_plantilla` (lib/api-mako/areas/chatbot.{def,run}.ts)
// =============================================================================
// Undécima tanda (11/10/2026, docs/diseno-undecima-tanda.md §7): una plantilla por categoría, también por el grupo de
// WhatsApp de MaKo. La MISMA función que «＋ Nueva» (`crearDesdePlantilla`, lib/plantilla-crear.ts), con las puertas de
// verdad, y la etapa dicha en palabras resuelta contra las MISMAS opciones que la galería (`eleccionEnPalabras`).
//
// ⚠️ EL TURNO SE ARMA CON LO QUE CORRE (molde: tests/agenda-whatsapp.test.ts y tests/automatizacion-whatsapp.test.ts):
// `clasificarIntencion` + `herramientasDelTurno`, con los nombres reales de las herramientas de siempre.
//
// Lo que fija:
//   1. un pedido que nombra una plantilla llega como acción, con el área chatbot y la herramienta nueva;
//   2. las dos operaciones: SIN http, crear la ve un admin (no un miembro), y el enum de plantillas es la galería;
//   3. el runner: rechaza correr desde un flujo, un id de antes nombra el nuevo, la etapa se resuelve con la MISMA
//      función que la galería, y ejecutar enchufa las puertas reales y escribe el link con `linkApp`.
//
// PROBADO ROMPIÉNDOLO: ver las roturas al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { porId, visible, type Vista } from '../lib/api-mako/registro';
import { PLANTILLAS } from '../lib/plantillas-automatizaciones';

const RAIZ = join(__dirname, '..');
const LEER = 'listar_plantillas_automatizaciones';
const CREAR = 'crear_automatizacion_desde_plantilla';
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Los NOMBRES de las herramientas de siempre (viven con `server-only`: se piden a un node con la condición del server). */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const vista: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 13, rol: 'admin', tabs: null };

function turno(mensaje: string) {
  const veredicto = clasificarIntencion(mensaje, {});
  const t = herramientasDelTurno({ veredicto, texto: mensaje, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista, hayPendientes: false, contextoDelSi: null });
  return { veredicto, nombres: t.tools.map((x) => x.name), areas: t.areas };
}

// ── 1. El turno ──────────────────────────────────────────────────────────────────

const PEDIDOS = [
  'Mako, créame la automatización de la plantilla «Un Lead Agendó Llamada» en la etapa Agendado',
  'creame una automatizacion desde la plantilla de un lead no asistio',
  'Armame la automatización de la galería para los que entran, la plantilla Un Lead Entró',
];

test('un pedido que nombra una plantilla llega como acción, con el área chatbot y la herramienta de la galería', () => {
  for (const m of PEDIDOS) {
    const r = turno(m);
    assert.equal(r.veredicto.intencion, 'actuar', `«${m}» no es una acción: ${r.veredicto.porque}`);
    assert.ok(r.areas.includes('chatbot'), `«${m}» no trae el área chatbot (llegaron: ${r.areas.join(', ')})`);
    assert.ok(r.nombres.includes(CREAR), `«${m}» no trae ${CREAR} (llegaron ${r.nombres.length}: ${r.nombres.slice(0, 14).join(', ')}…)`);
  }
});

// ── 2. Las operaciones ───────────────────────────────────────────────────────────

test('las dos operaciones: sin HTTP, crear la ve un admin (no un miembro) y el enum de plantillas es la galería', () => {
  const leerDef = porId(LEER);
  const crear = porId(CREAR);
  assert.ok(leerDef && crear, 'no están en el registro');
  for (const d of [leerDef!, crear!]) {
    assert.ok(!d.canales.includes('http'), `${d.id} sale por HTTP (ninguna operación nueva de la tanda)`);
    assert.ok(visible(d, vista), `${d.id}: un admin del grupo no la ve`);
  }
  assert.ok(!visible(crear!, { ...vista, rol: 'miembro' }), 'la ve un miembro: crear es de un admin');
  assert.equal(crear!.tipo, 'accion');
  assert.equal(crear!.confirmacion, 'chat');
  assert.equal(crear!.reversible, true);
  const p = crear!.parametros.find((x) => x.nombre === 'plantilla');
  assert.deepEqual(p?.enum, PLANTILLAS.map((x) => x.id), 'el enum no es la galería');
  assert.equal(p?.obligatorio, true);
  assert.ok(crear!.parametros.some((x) => x.nombre === 'etapa' && !x.obligatorio));
});

// ── 3. El runner ─────────────────────────────────────────────────────────────────

test('el runner: no corre desde un flujo, un id de antes nombra el nuevo, la etapa con la MISMA función y las puertas reales', () => {
  const run = sinComentarios(leer('lib/api-mako/areas/chatbot.run.ts'));
  const i = run.indexOf(`  ${CREAR}: {`);
  assert.ok(i > 0, 'no está el runner');
  const b = run.slice(i, run.indexOf('\n  },\n', i));
  assert.ok(b.length > 500 && b.length < 5000, `el runner mide ${b.length}`);
  // preparar
  assert.match(b, /if \(desdeUnFlujo\(ctx\)\) return \{ error:/, 'un flujo crearía automatizaciones');
  assert.match(b, /motivoDePlantillaVieja\(id\)/, 'un id de antes no nombra el nuevo');
  assert.match(b, /eleccionEnPalabras\(p\.cron\.pide,/, 'la etapa no se resuelve con la función de la galería');
  assert.match(b, /productosConEtapas\(\)/);
  assert.ok(b.indexOf('preparar:') < b.indexOf('crearDesdePlantilla('), 'preparar escribe');
  // ejecutar
  assert.match(b, /crearDesdePlantilla\(payload\.plantilla, \{\s*db: \(await getTenantDb\(\)\) as unknown as DbPlantilla,\s*setPasos: setSecuenciaPasos,\s*setDisparadores: guardarDisparadores,/);
  assert.match(b, /e instanceof TriggerInvalidoError \? e\.message : null/);
  assert.match(b, /linkApp\(`\/automations\?sec=\$\{r\.id\}`, ctx\.ws\)/, 'el link no lo escribe el código');
  assert.match(b, /datos: \{ secuenciaId: r\.id \}/);
  assert.match(b, /PlantillaInvalidaError \|\| e instanceof PasosInvalidosError\) return \{ ok: false/);
});

// ROTURAS (11/10/2026, arnés wf-undecima/w3-plantillas/roturas.cjs, una por vez y restaurada de memoria con sha1 igual;
// base 3 / 0, restaurado 3 / 0):
//   R17 el runner sin `desdeUnFlujo`                                              → 2 / 1 (el runner)
//   R18 `crear_automatizacion_desde_plantilla` con 'http' en sus canales          → 2 / 1 (las operaciones)
