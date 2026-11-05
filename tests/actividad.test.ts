// Admin › Activity (5/11/2026): la medición de uso (mig 0398) y lo que dice la pantalla. Ejecuta las piezas puras: el lote del
// navegador (app/_components/medidor-lote.ts), qué cuenta como acción (app/_components/contador-acciones.ts), el saneo del
// server y las cuentas (lib/actividad-reglas.ts). Y fija, leyendo el fuente, las tres puertas que no se pueden ejecutar acá:
// que la ruta saque a la persona de la SESIÓN, que la API de MaKo anote sin los parámetros, y que el super admin no se mida.
//
// Probado rompiéndolo (5/11/2026), cada rotura contra una base en verde (14 de 14):
//   · el lote anotando las acciones a la pantalla NUEVA (cosechar después de cambiar `actual`)      → 1 fallo (el 1);
//   · contar un GET como acción                                                                       → 1 fallo (el 2);
//   · no excluir /api/actividad (la medición se contaría a sí misma)                                  → 1 fallo (el 2);
//   · guardar la ruta en vez de la tab en el saneo                                                    → 1 fallo (el 3);
//   · sin el tope por entrada                                                                         → 1 fallo (el 3);
//   · «nuevo» por el primer día medido en vez del alta                                                → 1 fallo (el 4);
//   · «sin uso» por key (dos «Ops Center»)                                                            → 1 fallo (el 5);
//   · dejar en «dejaron de entrar» a un suspendido                                                    → 1 fallo (el 6);
//   · «en 30 días» sobre una medición de 3                                                            → 1 fallo (el 7);
//   · la retención a 300 días                                                                         → 1 fallo (el 8);
//   · pasarle el input de la operación al registro de MaKo                                            → 1 fallo (el 9);
//   · leer el usuario del cuerpo del pedido en la ruta                                                → 1 fallo (el 10);
//   · medir al negocio de la plataforma                                                               → 1 fallo (el 10);
//   · sacar el medidor del teléfono                                                                   → 1 fallo (el 11).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crearLote } from '../app/_components/medidor-lote';
import { esAccion } from '../app/_components/contador-acciones';
import {
  DIAS_DEJO_DE_ENTRAR, RETENCION_ACCIONES_DIAS, RETENCION_USO_DIAS, TOPE_ENTRADAS_LOTE, TOPE_POR_ENTRADA, activos, cicloDeVida,
  corteDeRetencion, dejaronDeEntrar, sanearLote, tabDeRuta, tabsDeNegocios, tabsSinUso, usoPorNegocio, usoPorTab, ventanaDeUso,
  type FilaUso, type Persona,
} from '../lib/actividad-reglas';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const persona = (id: number, creado: string, extra: Partial<Persona> = {}): Persona => ({
  id, nombre: `Persona ${id}`, email: `p${id}@ejemplo.com`, ws: 50, negocio: 'Negocio de Ejemplo', creado, ultimoLogin: null,
  rol: 'cliente', estado: 'activo', ...extra,
});
const fila = (dia: string, usuario: number, tab = 'crm', pantallas = 1, acciones = 0, ws: number | null = 50): FilaUso =>
  ({ dia, usuario, ws, tab, pantallas, acciones });

test('1. el lote anota cada acción a la pantalla donde se hizo, y vaciar lo deja en cero', () => {
  let pendientes = 0;
  const lote = crearLote(() => { const n = pendientes; pendientes = 0; return n; });
  lote.entrar('/crm');
  pendientes = 3; // tres acciones en el CRM
  lote.entrar('/plan'); // al cambiar de pantalla se cosechan primero
  pendientes = 1;
  lote.entrar('/crm');
  const primera = lote.vaciar();
  assert.deepEqual(
    primera.sort((a, b) => a.ruta.localeCompare(b.ruta)),
    [{ ruta: '/crm', pantallas: 2, acciones: 3 }, { ruta: '/plan', pantallas: 1, acciones: 1 }],
  );
  assert.deepEqual(lote.vaciar(), [], 'después de mandar no queda nada que mandar');
  pendientes = 2; // acciones después de mandar, en la misma pantalla
  assert.deepEqual(lote.vaciar(), [{ ruta: '/crm', pantallas: 0, acciones: 2 }]);
});

test('2. cuenta como acción sólo un pedido que escribe, a nuestro origen, y no la medición', () => {
  const o = 'https://hola-mako.com';
  assert.equal(esAccion('/api/crm/leads', 'POST', o), true);
  assert.equal(esAccion('', 'POST', o), true, 'una server action va a la página misma');
  assert.equal(esAccion('/api/crm/leads', 'GET', o), false);
  assert.equal(esAccion('/api/crm/leads', undefined, o), false, 'sin método es GET');
  assert.equal(esAccion('/api/actividad', 'POST', o), false, 'la medición no se cuenta a sí misma');
  assert.equal(esAccion('/api/errores', 'POST', o), false);
  assert.equal(esAccion('https://otro.com/api/x', 'POST', o), false);
  assert.equal(esAccion('https://hola-mako.com/api/x', 'patch', o), true);
});

test('3. el server guarda la TAB, nunca la ruta, con los números enteros y con tope', () => {
  const lote = sanearLote({ entradas: [
    { ruta: '/crm/123/resumen?lead=9', pantallas: 2, acciones: 1 },
    { ruta: '/crm', pantallas: 1.7, acciones: -4 },
    { ruta: '/zzz-no-existe', pantallas: 1, acciones: 0 },
    { ruta: '/plan', pantallas: 0, acciones: 0 },
    { ruta: 42, pantallas: 1 },
    { ruta: '/m/crm', pantallas: 9999, acciones: 9999 },
  ] });
  const crm = lote.find((e) => e.tab === 'crm');
  assert.ok(crm, 'el CRM está');
  assert.equal(crm.pantallas, TOPE_POR_ENTRADA, 'con tope, aunque se sumen');
  assert.equal(crm.acciones, TOPE_POR_ENTRADA);
  assert.ok(lote.some((e) => e.tab === 'otra'), 'lo que no es una tab va a «otra»');
  assert.ok(!lote.some((e) => e.tab === 'todo'), 'lo que no suma nada no entra');
  assert.ok(lote.every((e) => !e.tab.includes('/') && Object.keys(e).sort().join() === 'acciones,pantallas,tab'), 'ni rutas ni campos de más');
  const muchas = sanearLote({ entradas: Array.from({ length: 100 }, (_, i) => ({ ruta: `/x${i}`, pantallas: 1 })) });
  assert.equal(muchas.reduce((n, e) => n + e.pantallas, 0), TOPE_ENTRADAS_LOTE, 'no más de 30 entradas por lote');
  assert.deepEqual(sanearLote(null), []);
  assert.deepEqual(sanearLote({ entradas: 'no' }), []);
  assert.equal(tabDeRuta('/m/crm'), 'crm', 'una ruta del teléfono cuenta como su tab');
});

test('4. el ciclo de vida: «nuevo» es por el alta de la persona, no por su primer día medido', () => {
  const hoy = '2026-11-05'; // jueves; la semana arranca el lunes 2/11
  const personas = [persona(1, '2026-11-02T10:00:00Z'), persona(2, '2026-01-01T00:00:00Z'), persona(3, '2026-01-01T00:00:00Z'), persona(4, '2026-01-01T00:00:00Z')];
  const filas = [
    fila('2026-11-03', 1), // nuevo: alta esta semana
    fila('2026-10-28', 2), fila('2026-11-04', 2), // sigue: la semana pasada y ésta
    fila('2026-11-05', 3), // volvió: no la semana pasada, alta vieja
    fila('2026-10-27', 4), // dejó: la semana pasada sí, ésta no
  ];
  const ciclo = cicloDeVida(filas, personas, hoy, 2);
  const esta = ciclo[ciclo.length - 1];
  assert.equal(esta.semana, '2026-11-02');
  assert.deepEqual({ nuevos: esta.nuevos, siguen: esta.siguen, volvieron: esta.volvieron, dejaron: esta.dejaron, enCurso: esta.enCurso },
    { nuevos: 1, siguen: 1, volvieron: 1, dejaron: 1, enCurso: true });
  // La semana en que arranca la medición, la gente de siempre NO es nueva.
  const anterior = ciclo[0];
  assert.equal(anterior.nuevos, 0, 'la semana pasada nadie se dio de alta');
  assert.equal(anterior.volvieron, 2);
  assert.deepEqual(activos(filas, hoy), { hoy: 1, semana: 3, mes: 4 });
});

test('5. «sin uso» son las tabs de los negocios que nadie abrió, juntas por su nombre', () => {
  const todas = tabsDeNegocios();
  const nombres = todas.map((t) => t.label);
  assert.equal(new Set(nombres).size, nombres.length, 'una tab que se dibuja igual va una sola vez');
  const ops = todas.find((t) => t.keys.length > 1);
  assert.ok(ops, 'hay una tab con dos keys (Ops Center)');
  const hoy = '2026-11-05';
  // Se usó la SEGUNDA key de esa tab: no puede salir como «sin uso».
  const uso = usoPorTab([fila(hoy, 1, ops.keys[1]), fila(hoy, 1, 'crm', 2, 3), fila(hoy, 2, 'crm', 1, 0, 51)], hoy);
  const sin = tabsSinUso(uso).map((t) => t.label);
  assert.ok(!sin.includes(ops.label), `${ops.label} se usó por su otra key`);
  assert.ok(!sin.includes('CRM'));
  assert.ok(sin.length === todas.length - 2, 'el resto sí');
  const crm = uso.find((u) => u.tab === 'crm');
  assert.deepEqual(crm && { personas: crm.personas, negocios: crm.negocios, pantallas: crm.pantallas, acciones: crm.acciones },
    { personas: 2, negocios: 2, pantallas: 3, acciones: 3 });
  const neg = usoPorNegocio([fila(hoy, 1, 'crm', 5, 2), fila('2026-10-20', 2, 'todo', 1, 0)], hoy);
  assert.deepEqual(neg.map((n) => [n.ws, n.personas7, n.personas30, n.pantallas30, n.acciones30, n.tabs]), [[50, 1, 2, 6, 2, ['crm', 'todo']]]);
});

test('6. dejaron de entrar: de 14 a 120 días sin entrar, sin el super admin ni los suspendidos', () => {
  const ahora = Date.parse('2026-11-05T12:00:00Z');
  const hace = (d: number) => new Date(ahora - d * 86_400_000).toISOString();
  const ps = [
    persona(1, '2026-01-01', { ultimoLogin: hace(20) }),
    persona(2, '2026-01-01', { ultimoLogin: hace(DIAS_DEJO_DE_ENTRAR - 1) }),
    persona(3, '2026-01-01', { ultimoLogin: hace(200) }),
    persona(4, '2026-01-01', { ultimoLogin: hace(30), estado: 'suspendido' }),
    persona(5, '2026-01-01', { ultimoLogin: hace(30), rol: 'admin' }),
    persona(6, '2026-01-01', { ultimoLogin: null }),
    persona(7, '2026-01-01', { ultimoLogin: hace(15) }),
  ];
  assert.deepEqual(dejaronDeEntrar(ps, ahora).map((p) => [p.id, p.dias]), [[7, 15], [1, 20]]);
});

test('7. la pantalla mira 30 días, o los que lleva la medición', () => {
  assert.equal(ventanaDeUso('2026-11-03', '2026-11-05'), 3);
  assert.equal(ventanaDeUso('2026-11-05', '2026-11-05'), 1);
  assert.equal(ventanaDeUso('2026-01-01', '2026-11-05'), 30);
  assert.equal(ventanaDeUso(null, '2026-11-05'), 0);
});

test('8. la retención: el uso 400 días y lo que hizo MaKo 90, y el cron borra lo anterior', () => {
  assert.equal(RETENCION_USO_DIAS, 400);
  assert.equal(RETENCION_ACCIONES_DIAS, 90);
  assert.equal(corteDeRetencion('2026-11-05', 90), '2026-08-07');
  const cron = sinComentarios(leer('app/api/cron/actividad-purga/route.ts'));
  assert.match(cron, /const denied = checkCronAuth\(req\);\s*if \(denied\) return denied;/, 'el cron abre con su auth');
  assert.match(cron, /from\('actividad_uso'\)\.delete\(\{ count: 'exact' \}\)\.lt\('dia', corteUso\)/);
  assert.match(cron, /from\('actividad_acciones'\)\.delete\(\{ count: 'exact' \}\)\.lt\('creado', corteAcciones\)/);
  const vercel = JSON.parse(leer('vercel.json')) as { crons: Array<{ path: string }> };
  assert.ok(vercel.crons.some((c) => c.path === '/api/cron/actividad-purga'), 'el cron está agendado');
});

test('9. la API de MaKo anota QUÉ hizo, nunca con qué: ni el input ni la respuesta', () => {
  const ej = sinComentarios(leer('lib/api-mako/ejecutar.ts'));
  const ini = ej.indexOf('export async function ejecutarOperacion(');
  const fin = ej.indexOf('async function correrOperacion(', ini);
  assert.ok(ini >= 0 && fin > ini, 'ejecutarOperacion envuelve a correrOperacion');
  const envoltorio = ej.slice(ini, fin);
  assert.ok(envoltorio.length < 1500, `el recorte mide ${envoltorio.length}: está mirando otra cosa`);
  assert.match(envoltorio, /const r = await correrOperacion\(id, inputCrudo, ctx, origen, vistaPrevia\);/);
  const llamada = envoltorio.slice(envoltorio.indexOf('registrarAccionMako({'), envoltorio.indexOf('});', envoltorio.indexOf('registrarAccionMako({')));
  assert.ok(llamada.length > 0, 'anota lo que corre');
  assert.doesNotMatch(llamada, /inputCrudo|\binput\b|resultado|r\.error|\.\.\./, 'el registro no lleva lo que se pidió ni lo que se contestó');
  assert.match(llamada, /ok: r\.ok/);
  assert.match(envoltorio, /return r;\s*\}\s*$/, 'devuelve lo mismo que corrió');
});

test('10. la ruta saca a la persona de la SESIÓN, y ni el super admin ni la plataforma se miden', () => {
  const ruta = sinComentarios(leer('app/api/actividad/route.ts'));
  assert.match(ruta, /const sesion = await getUsuarioActual\(\);\s*if \(!sesion\) return new Response\(null, \{ status: 401 \}\);/);
  assert.match(ruta, /if \(sesion\.rol === 'admin' \|\| !\/\^\\d\+\$\/\.test\(sesion\.sub\)\) return nada\(\);/, 'el super admin no se mide');
  assert.match(ruta, /after\(\(\) => registrarActividad\(Number\(sesion\.sub\), ws, lote\)\)/);
  assert.doesNotMatch(ruta, /usuario_id|body\.usuario|\.ws\b(?!\))/, 'nada de quién o de qué negocio sale del cuerpo');
  const reg = sinComentarios(leer('lib/actividad-registro.ts'));
  assert.match(reg, /if \(ws != null && ws === \(await wsSuperAdmin\(\)\)\) return;/, 'el uso de la plataforma no se suma');
  assert.match(reg, /if \(a\.ws === \(await wsSuperAdmin\(\)\)\) return;/, 'lo que hace MaKo en la plataforma no se anota');
});

test('11. el medidor está en la computadora y en el teléfono, y manda por lotes sin frenar a nadie', () => {
  assert.match(sinComentarios(leer('app/_components/Sidebar.tsx')), /\{!!rol && <MedidorDeUso \/>\}/);
  assert.match(sinComentarios(leer('app/m/_ui/ShellM.tsx')), /<MedidorDeUso \/>/);
  const med = sinComentarios(leer('app/_components/MedidorDeUso.tsx'));
  assert.match(med, /export const CADA_MS = 60_000;/);
  assert.match(med, /keepalive: true/);
  assert.match(med, /\.catch\(\(\) => \{\}\)/, 'un lote que falla se pierde sin romper nada');
  const ws = sinComentarios(leer('app/_components/WsFetch.tsx'));
  assert.ok(ws.indexOf('sumarAccion()') < ws.indexOf('if (!ws) return original(entrada, init);'), 'cuenta antes de la salida sin cliente');
});
