// =============================================================================
// Varias computadoras por persona, «Desconectar», y el panel del super admin (22/10/2026)
// =============================================================================
// Martín, textual: «el usuario debería poder abrir y ejecutar su Claude en varios dispositivos, por ejemplo, ahora abrí la
// cuenta de Mauricio e instalé MaKo desktop para conectarme a su claude, pero luego él va a querer hacerlo en su PC, se
// debería poder ver eso... Lo mismo en SuperAdmin. Y poder "Desconectar" dispositivos». Lo que fija este test (lib/ia-pc.ts
// REAL contra un PostgREST de mentira, tests/_ia-pc-varias-hijo.ts):
//   1. conectar otra no suelta la que había: la de Martín en la cuenta de Mauricio NO se pierde;
//   2. el turno va a una que conteste; con varias, a la que contestó el último turno (no salta cada 30 s), sin turnos a la
//      última conectada, y si una se apaga, a la que queda;
//   3. cada una dice su sistema (desde la 0.4.0) y cuándo se conectó; la tarjeta ofrece «Conectar otra computadora»;
//   4. el super admin ve las de UN negocio por vez, en la ficha de ese cliente (desde el 6/11/2026, la de la copia de Polar:
//      Admin › Customers › <negocio>, sólo con la guarda del Centro; «Desconectar» no está ahí, ver el 4b) (desde el 23/10/2026: Martín, al ver las de
//      todos en «Tus cuentas de IA»: «estas cruzando workspace»), sin secretos, con «Desconectar»; desconectar revoca al
//      instante (su token ya no sirve, y sale del turno y de las listas), y con el negocio equivocado no toca nada. Y ninguna
//      pantalla del super admin vuelve a listar las de todos.
//   Lo del 23/10, probado rompiéndolo (con la base en 0 fallos): la lectura sin `.eq('workspace_id', ws)`, la vista sin filtrar
//   por negocio, las computadoras de vuelta en el Uso del teléfono, la ruta sin el negocio y la ficha sin la sección → 1 fallo
//   cada una (el 4); la acción sin su puerta → 2 (el 4 y tests/operaciones.test.ts). Y lo de la revisión: la puerta del Ops
//   Center sin mirar el negocio de la pestaña (computadora y teléfono) y la ficha sin la guarda → 1 fallo cada una (el 4).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { detalleDeLaPc, elegirPc, sistemaDeLaVersion } from '../lib/ia-pc-reglas';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { computadorasDeLaFicha } from '../app/admin/_polar/datos/cliente';
import { CustomerDetailsSection } from '../app/admin/_polar/web/Customer/CustomerPage/CustomerDetailsSection';
import { ALTA_EJEMPLO, CABECERA_EJEMPLO, COMPUTADORAS_EJEMPLO, CONEXIONES_EJEMPLO } from '../app/admin/_polar/datos/ejemplo/cliente';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
let cache: Record<string, any> | null = null;
function correr(): Record<string, any> {
  if (cache) return cache;
  const r = spawnSync(process.execPath, ['--import', 'tsx', '--conditions=react-server', fileURLToPath(new URL('./_ia-pc-varias-hijo.ts', import.meta.url))], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, timeout: 120_000 });
  const linea = (r.stdout ?? '').split('\n').find((l) => l.startsWith('@@VARIAS@@'));
  assert.ok(linea, `el hijo no contestó (status ${r.status}): ${(r.stderr ?? '').slice(-1500)}`);
  cache = JSON.parse(linea.slice('@@VARIAS@@'.length));
  assert.equal(cache!.error, undefined, String(cache!.error));
  return cache!;
}

test('1. conectar otra no suelta la que había (la de Martín en la cuenta de Mauricio no se pierde)', () => {
  const r = correr();
  assert.deepEqual(r.listadas.map((p: { nombre: string }) => p.nombre).sort(), ['PC de Martín', 'PC de Mauricio']);
});

test('2. el turno: a una que conteste; con varias, la del último turno; sin turnos, la última conectada; apagada, la otra', () => {
  const r = correr();
  assert.equal(r.sinTurnos, 'PC de Mauricio', 'sin turnos, la última conectada');
  assert.equal(r.conTurno, 'PC de Martín', 'la que contestó el último turno');
  assert.equal(r.apagada, 'PC de Mauricio', 'con la del último turno apagada, la que está en línea');
  // Revisión adversarial: la que falló su último turno, o tiene la cuenta agotada, va al final (no queda pegado a ella).
  assert.equal(r.fallo, 'PC de Mauricio', 'el turno quedó pegado a la que falló el último');
  assert.equal(r.agotada, 'PC de Martín', 'el turno fue a la que tiene la cuenta agotada');
  // Por IA (la ola 3): la que tiene sólo su ChatGPT no recibe un turno de Claude, y al revés.
  assert.deepEqual(r.porIA, { chatgptConTextoDeClaude: false, claude: 'PC de Martín', chatgpt: 'PC de Mauricio', anaParaChatgpt: false }, 'el turno fue a una PC sin esa IA');
  // La guarda del 23/10: una PC contesta sólo con la IA del texto que aceptó quien la conectó. Lo que la activa para D6b
  // (su latido) tampoco guarda otra: la de Leo, conectada con el texto de Claude, no queda activa por reportar ChatGPT.
  assert.deepEqual(r.porTexto, {
    leo: { cuentas: [], activa: false, negocio: false },
    lia: { cuentas: ['chatgpt'], activa: true, negocio: true },
    liaParaClaude: false, liaParaChatgpt: true,
  }, 'una PC contestó (o se activó) con una IA cuyo texto nadie aceptó');
  // El turno vence cuando el chat deja de esperarlo, nunca después de TURNO_MS; y uno vencido no se toma.
  assert.ok(Math.abs(r.vence.conEspera - 30) <= 2, `venció a los ${r.vence.conEspera} s y no a los 30`);
  assert.ok(Math.abs(r.vence.sinEspera - r.vence.tope) <= 2);
  assert.ok(Math.abs(r.vence.larga - r.vence.tope) <= 2, 'un turno quedó tomable más de TURNO_MS');
  assert.equal(r.huerfanoTomado, false, 'la PC tomó un turno que ya nadie esperaba');
  // La puerta mira la sesión del pedido (la segunda ronda de la refutación, 23/10): llamada directo, sin la de quien conectó
  // la PC, no encola. La prueba sin sesión, sólo en el ws3.
  assert.deepEqual(r.puerta, { sinSesion: 'frenado', otraPersona: 'frenado', suSesion: 'encolado', pruebaFueraDelWs3: 'frenado' },
    'la puerta de la PC encoló sin la persona adentro');
  // Puro: sin ninguna que conteste, la que latió último (el turno dice apagada o sin sesión).
  const pc = (id: number, enLinea: boolean, cuentas: number, latido: string | null, conectadaAt: string | null = null) => ({ id, enLinea, cuentas: Array(cuentas).fill({}), ultimoLatido: latido, conectadaAt });
  assert.equal(elegirPc([pc(1, false, 1, '2026-10-22T10:00:00Z'), pc(2, false, 1, '2026-10-22T11:00:00Z')], new Map())?.id, 2);
  assert.equal(elegirPc([pc(1, true, 0, '2026-10-22T12:00:00Z'), pc(2, true, 1, '2026-10-22T11:00:00Z')], new Map())?.id, 2, 'en línea sin sesión no contesta');
  assert.equal(elegirPc([], new Map()), null);
  // Las dos fallaron: primero la que falló hace más (se turnan).
  const fallaron = new Map([[1, { at: '2026-10-22T12:00:00Z', ok: false }], [2, { at: '2026-10-22T11:00:00Z', ok: false }]]);
  assert.equal(elegirPc([pc(1, true, 1, null), pc(2, true, 1, null)], fallaron)?.id, 2);
});

test('3. cada una dice su sistema y cuándo se conectó; la tarjeta ofrece «Conectar otra computadora»', () => {
  const r = correr();
  assert.deepEqual(r.listadas.find((p: { nombre: string }) => p.nombre === 'PC de Mauricio'), { nombre: 'PC de Mauricio', sistema: 'Windows', conectada: true, enLinea: true });
  assert.equal(sistemaDeLaVersion('0.4.0+mac'), 'Mac');
  assert.equal(sistemaDeLaVersion('0.3.2'), null, 'las de antes no lo dicen: no se muestra');
  assert.equal(detalleDeLaPc({ sistema: 'Windows', conectadaAt: '2026-10-22T12:00:00Z' }, () => '22/10'), 'Windows · conectada el 22/10');
  assert.equal(detalleDeLaPc({ sistema: null, conectadaAt: null }, () => 'x'), null, 'sin dato, no se muestra');
  const ui = sinComentarios(leer('app/integraciones/TusCuentasIA.tsx'));
  // 23/10/2026: «Nuevo dispositivo», dentro de cada cuenta. Desde el 24/10 (Martín: «no el botón feo que está al final del modal
  // que no lo ve nadie»), una fila que abre el tutorial en la descarga (paso 2), no un recuadro con la descarga a la vista; y
  // con la IA de ESA cuenta (la ola 3: Claude o ChatGPT), para que el tutorial nombre el programa que corresponde.
  assert.match(ui, /nuevoDispositivo=\{\(c\) => <NuevoDispositivo onAbrir=\{\(\) => abrirTutorialEn\(2, c\.proveedor\)\} \/>\}/, 'otra computadora para ESA cuenta, con su IA');
  const dibujo = sinComentarios(leer('app/integraciones/CuentasYDispositivos.tsx'));
  assert.match(dibujo, /\{d\.conectadaAt && <p className="tci-nota">\{`Conectada el \$\{fechaCorta\(d\.conectadaAt\)\}`\}<\/p>\}/);
  assert.match(sinComentarios(leer('app/api/ia-pc/estado/route.ts')), /conectadaAt: d\.conectadaAt, sistema: d\.sistema,/);
});

test('4. el super admin: las de UN negocio, en su ficha, sin secretos, con «Desconectar»; desconectar revoca al instante, y sólo en su negocio', () => {
  const r = correr();
  assert.deepEqual(r.todas.map((p: { ws: number; nombre: string }) => [p.ws, p.nombre]), [[1, 'PC de Mauricio'], [1, 'PC de Martín']], 'la ficha de un negocio trajo la de otro');
  assert.deepEqual(r.delOtro, [[13, 'MacBook de Ana']], 'el otro negocio trajo las de éste');
  assert.equal(r.todas[0].negocio, 'Mauricio Bustos');
  assert.equal(r.secretos, null, 'la lista del super admin lleva un token o un hash');
  assert.deepEqual(r.despues.listadas, ['PC de Martín'], 'la desconectada sigue en la lista');
  assert.equal(r.despues.turno, 'PC de Martín', 'el turno siguió yendo a la desconectada');
  assert.equal(r.despues.tokenSirve, false, 'el token de la desconectada sigue sirviendo');
  assert.deepEqual(r.despues.todas, ['PC de Martín']);
  assert.equal(r.otroWs, true, 'desconectar con el negocio equivocado tocó otra');
  // Revisión adversarial: desconectada en el medio, el turno no se le da (queda vencido) y sus herramientas no se piden.
  assert.equal(r.tomadaRevocada, null, 'una PC desconectada recibió el turno');
  assert.equal(r.turnoRevocado, 'vencido');
  assert.equal(r.llamadaRevocada, null, 'una PC desconectada pidió una herramienta');
  assert.deepEqual(r.herramientaRevocada, { corrio: false, salida: 'El turno se cortó: no se corrió.' }, 'corrió una herramienta de una PC desconectada');
  assert.match(sinComentarios(leer('lib/ia-pc.ts')), /if \(t\.error\) throw new Error\(`ia-pc: la desconecté, pero no pude cortar su turno/);
  // Las acciones son del super admin (tests/operaciones.test.ts mira la puerta de cada una).
  const acc = sinComentarios(leer('app/admin/operaciones/acciones.ts'));
  for (const n of ['computadorasDelNegocioAction', 'desconectarComputadoraAction']) {
    const i = acc.indexOf(`export async function ${n}(`);
    assert.ok(i > 0 && /if \(!puedeOperar\(admin, await wsSuperAdmin\(\)\)\) return \{ ok: false, error: NO_PUEDE \};/.test(acc.slice(i, i + 400)), `${n} sin la puerta del super admin`);
  }
  // La pantalla: desde el 6/11/2026 (la copia de Polar) las computadoras de un negocio se ven en SU ficha, Admin › Customers ›
  // <negocio> › Overview (CustomerDetailsSection, «Conexiones»), leídas por el server con `listarPcDelNegocio(ws)` (las de UN
  // negocio, el 1 de arriba) y sin secretos: viajan sólo el nombre, la persona, el sistema, si está en línea y cuándo se conectó.
  // Antes era app/admin/ComputadorasDelNegocio.tsx, adentro de la ficha de la grilla vieja (AdminView).
  const ficha = sinComentarios(leer('app/admin/_polar/datos/cliente-server.ts'));
  assert.match(ficha, /listarPcDelNegocio\(ws\)\.catch\(/, 'la ficha lee las computadoras de SU negocio');
  assert.match(ficha, /computadoras: computadorasDeLaFicha\(opera, computadoras\),/, 'a la pantalla viaja lo que recorta computadorasDeLaFicha');
  // Lo que viaja, EJECUTADO: con una PC con todo (token, cuentas, ubicación), sólo lo que se dibuja.
  const conTodo = { id: 7, ws: 1, negocio: 'X', persona: 'Ana Gómez', nombre: 'PC de Ana', sistema: 'Windows' as const, enLinea: true, conClaude: true,
    conectadaAt: '2026-11-01T10:00:00Z', ultimoLatido: null, cuentas: [], ubicacion: 'Rosario, Santa Fe, Argentina', version: '0.4.0', token: 'mkopc_secreto' };
  assert.deepEqual(computadorasDeLaFicha(true, [conTodo]), [{ id: 7, nombre: 'PC de Ana', persona: 'Ana Gómez', sistema: 'Windows', enLinea: true, conectadaAt: '2026-11-01T10:00:00Z' }], 'a la pantalla viaja más que lo que se dibuja (un token, sus cuentas)');
  const seccion = sinComentarios(leer('app/admin/_polar/web/Customer/CustomerPage/CustomerDetailsSection.tsx'));
  assert.match(seccion, /computadoras == null \? \(\s*<Row label="Computadoras" value=\{<Text as="span" color="muted">No se pudieron leer<\/Text>\} \/>/, '«no pude leer» no es «no tiene»');
  const pagina = sinComentarios(leer('app/admin/(polar)/customers/[id]/page.tsx'));
  const cuerpo = pagina.slice(pagina.indexOf('export default async function'));
  assert.ok(cuerpo.indexOf('await exigirSuperAdmin()') > 0 && cuerpo.indexOf('await exigirSuperAdmin()') < cuerpo.indexOf('leerResumen('), 'la ficha pregunta por el super admin antes de leer');
  for (const f of ['app/admin/operaciones/Uso.tsx', 'app/m/operaciones/RunnerMovil.tsx', 'app/m/operaciones/CentroAppMovil.tsx', 'app/admin/operaciones/PiezasCentro.tsx', 'app/admin/operaciones/useCentro.ts']) {
    assert.doesNotMatch(sinComentarios(leer(f)), /Computadoras|computadoras/, `${f}: las computadoras de los clientes volvieron a «Tus cuentas de IA»`);
  }
  assert.match(sinComentarios(leer('app/api/operaciones/lectura/route.ts')), /computadoras: \(req\) => computadorasDelNegocioAction\(Number\(req\.nextUrl\.searchParams\.get\('ws'\)\)\)/, 'la lectura pide el negocio');
  assert.match(sinComentarios(leer('lib/ia-pc.ts')), /export async function listarPcDelNegocio\(ws: number\)[\s\S]{0,200}\.eq\('workspace_id', ws\)/, 'la lectura es de UN negocio');
  assert.doesNotMatch(sinComentarios(leer('lib/ia-pc.ts')), /listarTodasLasPc/, 'volvió una lectura de las de todos los negocios');
  // La revisión del 23/10: el Ops Center de la plataforma no se dibuja mirando a un cliente (su «Tus cuentas de IA» lee el
  // negocio de la pestaña).
  const puerta = sinComentarios(leer('app/admin/operaciones/page.tsx'));
  const iGuarda = puerta.indexOf('puedeOperar(admin'), iMirando = puerta.indexOf('if (ws != null && ws !== (await wsSuperAdmin())) redirect(await rutaConWs(RUTA_OPS_CENTER_NEGOCIO));');
  const iLee = puerta.indexOf('datosDelCentroSiOpera()');
  assert.ok(iGuarda > 0 && iMirando > iGuarda && iLee > iMirando, 'mirando a un cliente, el Ops Center de la plataforma se dibuja igual');
  const puertaM = sinComentarios(leer('app/m/operaciones/page.tsx'));
  const iMirandoM = puertaM.indexOf("if (ctx?.impersonando) redirect(await rutaConWs('/m/second-brain'));");
  assert.ok(iMirandoM > 0 && iMirandoM < puertaM.indexOf('listarPedidos()'), 'en el teléfono, mirando a un cliente, el Centro se dibuja igual');
});

// La ficha de un negocio de la grilla vieja (app/admin/ComputadorasDelNegocio.tsx) mostraba las computadoras sólo a quien pasaba la
// guarda del Centro (`puedeOperar`: el super admin con su segundo factor). La copia de Polar (6/11/2026) las había dejado para todo
// super admin; desde el arreglo del mismo día, sin la guarda ni se leen ni se dibujan (`computadorasDeLaFicha` → 'oculto').
// «Desconectar» NO volvió: Polar no tiene esa acción en su ficha y se anotó para que decida Martín (`desconectarComputadoraAction`
// sigue en app/admin/operaciones/acciones.ts).
// Probado rompiéndolo el 6/11/2026 (base 5/0; cada rotura, sola, 4/1): `computadorasDeLaFicha` sin el `if (!opera)`; la ficha que
// lee `listarPcDelNegocio` sin el `opera ?`; CustomerDetailsSection que dibuja el renglón «Computadoras» con 'oculto'.
test('4b. la ficha nueva de un negocio: las computadoras sólo para quien pasa la guarda del Centro', () => {
  assert.equal(computadorasDeLaFicha(false, COMPUTADORAS_EJEMPLO), 'oculto', 'sin la guarda, nada viaja');
  assert.equal(computadorasDeLaFicha(true, null), null, 'con la guarda y sin poder leerlas: «no pude leer», no «no tiene»');
  const html = (computadoras: ReturnType<typeof computadorasDeLaFicha>) =>
    renderToStaticMarkup(createElement(CustomerDetailsSection, { negocio: CABECERA_EJEMPLO, alta: ALTA_EJEMPLO, conexiones: CONEXIONES_EJEMPLO, computadoras }));
  const conGuarda = html(computadorasDeLaFicha(true, COMPUTADORAS_EJEMPLO));
  assert.ok(conGuarda.includes(COMPUTADORAS_EJEMPLO[0].nombre), 'con la guarda, se dibujan');
  const sinGuarda = html(computadorasDeLaFicha(false, COMPUTADORAS_EJEMPLO));
  assert.ok(!sinGuarda.includes(COMPUTADORAS_EJEMPLO[0].nombre) && !sinGuarda.includes('Computadoras'), 'sin la guarda, la sección no las dibuja (ni su renglón)');
  assert.ok(html(computadorasDeLaFicha(true, null)).includes('No se pudieron leer'));
  // El server: la guarda es la del Centro, y la lectura cuelga de ella.
  const ficha = sinComentarios(leer('app/admin/_polar/datos/cliente-server.ts'));
  const iGuarda = ficha.indexOf('const opera = puedeOperar(await getSesionAdmin(), await wsSuperAdmin())');
  assert.ok(iGuarda > 0, 'la ficha pregunta la guarda del Centro');
  assert.match(ficha.slice(iGuarda), /opera \? listarPcDelNegocio\(ws\)\.catch\(/, 'las computadoras se leen sin la guarda del Centro');
  assert.equal((ficha.match(/listarPcDelNegocio\(/g) ?? []).length, 1, 'una sola lectura, la de la guarda');
});
