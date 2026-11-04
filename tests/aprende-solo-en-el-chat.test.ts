// =============================================================================
// Ticket #45 (Leila, 3/11/2026): «Activa la función "Aprende solo" en el Second Brain» y MaKo contestó que no existe
// =============================================================================
// ⚠️ EL DIAGNÓSTICO OBVIO ERA EL EQUIVOCADO: 1efb12f08 corrigió `hace[]` en lib/funciones-mako.ts, y eso no le llega a ningún cliente
// (sólo a la capa de la plataforma y a /admin/docs; `listar_capacidades_mako` no lo devuelve). Lo que lee el modelo son las capacidades
// y las herramientas que viajan en el turno. Se mira en un negocio que NO es la plataforma, en la app y en WhatsApp.
//
// Probado rompiéndolo (3/11/2026), una rotura por vez, 1 fallo cada una: sacar la capacidad, la familia, la palabra del área en
// WhatsApp o la guarda de rol; `preparar` que escribe; un «no pude leer» que igual propone.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';
import { herramientasDelTurno } from '../lib/doer-herramientas';
import { veredictoDeClase } from '../lib/mako-intencion-ia';
import { porId, visible, type Vista } from '../lib/api-mako/registro';
import { CAPACIDADES, capacidad } from '../lib/mako-capacidades';
import { familiasDe } from '../lib/mako-intencion-app';

const RAIZ = join(__dirname, '..');
const LITERAL = 'Activa la función \'Aprende solo\' en el Second Brain.';

function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)))`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
// ws 11: un negocio cliente. `plataforma` sin marcar: es lo que el arreglo anterior no alcanzaba.
const VISTA_APP: Vista = { canal: 'app', alcance: 'proponer', ws: 11, rol: 'admin', tabs: null };
const VISTA_WA: Vista = { canal: 'whatsapp', alcance: 'ejecutar', ws: 11, rol: 'admin', tabs: null };

const enLaApp = (texto: string) => herramientasDelChat({
  veredicto: clasificarIntencion(texto, { canal: 'app' }), texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: VISTA_APP, hayPendientes: false, contextoDelSi: null,
}).tools.map((t) => t.name);
const enWhatsApp = (texto: string, veredicto = clasificarIntencion(texto, {})) => herramientasDelTurno({
  veredicto, texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: VISTA_WA, hayPendientes: false, contextoDelSi: null,
}).tools.map((t) => t.name);

test('la frase literal, en un negocio cliente, trae la herramienta en la app', () => {
  assert.ok(familiasDe(LITERAL)?.ids.includes('aprende-solo'));
  assert.equal(clasificarIntencion(LITERAL, { canal: 'app' }).intencion, 'actuar');
  assert.ok(enLaApp(LITERAL).includes('cambiar_aprende_solo'), `llegaron: ${enLaApp(LITERAL).join(', ')}`);
  assert.ok(enLaApp('apaga Aprende solo').includes('cambiar_aprende_solo'));
});

test('y en WhatsApp, por donde corre: la clase la decide la IA y las áreas salen del mensaje', () => {
  const frase = 'activa aprende solo en el second brain';
  const v = veredictoDeClase({ clase: 'ACCION', resumen: 'prender Aprende solo' } as never, clasificarIntencion(frase, {}), { esSuperAdmin: false, escribeElDueno: false, texto: frase });
  assert.equal(v.intencion, 'actuar');
  assert.ok(enWhatsApp(frase, v).includes('cambiar_aprende_solo'));
  assert.ok(enWhatsApp('mako activá aprende solo').includes('cambiar_aprende_solo'), 'sin la IA mandan las reglas');
  assert.ok(enWhatsApp('qué es aprende solo?').includes('listar_capacidades_mako'), 'en una pregunta dice qué es y dónde está');
});

test('la capacidad dice dónde está, con el nombre de pantalla y un link que existe', () => {
  const c = capacidad('aprende-solo');
  assert.ok(c, 'sin la capacidad, `listar_capacidades_mako` no la nombra');
  assert.equal(c.ruta, '/second-brain');
  assert.ok(c.funcion, 'no cae en ninguna función del catálogo');
  assert.match(c.que, /«Aprende solo»/);
  assert.ok(c.como.some((p) => /cabecera del Mapa/.test(p)));
  assert.equal(CAPACIDADES.filter((x) => x.id === 'aprende-solo').length, 1);
});

test('la operación: se confirma en el chat, sólo el admin (la puerta de la pantalla), y un closer no la ve', () => {
  const d = porId('cambiar_aprende_solo')!;
  assert.ok(d);
  assert.equal(d.tipo, 'accion');
  assert.equal((d as { confirmacion?: string }).confirmacion, 'chat');
  assert.equal(d.gating?.rolMinimo, 'admin');
  assert.ok(visible(d, VISTA_APP));
  assert.equal(visible(d, { ...VISTA_APP, rol: 'miembro' }), false);
});

type Hijo = {
  prende: { payload?: { prendido: boolean }; resumen?: string };
  yaPrendido: { error?: string; yaEstaba?: boolean };
  sinDecir: { error?: string; faltan?: string[] };
  ejecuta: { ok: boolean; resumen: string };
  cambios: boolean[];
  sinLeer: { error?: string; falla?: boolean };
};
const salida = execFileSync(process.execPath, ['--conditions=react-server', '--experimental-test-module-mocks', '--no-warnings', '--import', 'tsx', join(RAIZ, 'tests', '_aprende-solo-hijo.ts')], {
  // Sin NODE_TEST_CONTEXT: llamado desde un test, node toma al hijo por un test anidado.
  cwd: RAIZ, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 200_000, env: { ...process.env, NODE_TEST_CONTEXT: undefined },
});
const H = JSON.parse(salida.slice(salida.indexOf('@@JSON@@') + 8, salida.indexOf('@@FIN@@'))) as Hijo;

test('el runner real: propone sin tocar nada y con el «sí» prende el interruptor de la pantalla', () => {
  assert.deepEqual(H.prende.payload, { prendido: true });
  assert.match(H.prende.resumen ?? '', /Prender «Aprende solo»/);
  assert.match(H.prende.resumen ?? '', /sin mandar ningún mensaje/);
  assert.equal(H.ejecuta.ok, true);
  assert.match(H.ejecuta.resumen, /quedó prendido/);
  assert.match(H.ejecuta.resumen, /second-brain/);
  assert.deepEqual(H.cambios, [true], 'preparar no escribe: sólo el «sí»');
});

test('ya prendido lo dice; sin decir qué, lo pide; y un «no pude leer» no se vuelve una propuesta', () => {
  assert.equal(H.yaPrendido.yaEstaba, true);
  assert.match(H.yaPrendido.error ?? '', /ya está prendido/);
  assert.deepEqual(H.sinDecir.faltan, ['prendido']);
  assert.equal(H.sinLeer.falla, true);
});
