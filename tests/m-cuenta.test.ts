// =============================================================================
// /m/cuenta — «Tu cuenta» v3 en el teléfono (15/10/2026): las secciones como filas, como Google
// =============================================================================
// Decisión de Martín del 15/10 («Ajustes: dos lugares, como Google»): «Tu cuenta» (todos los roles)
// con Información personal · Seguridad · Notificaciones · Instalar la app, y «Configuración del negocio»
// sólo para quien administra. El teléfono DESTILA: las mismas secciones, en el mismo orden y con los
// mismos rótulos (lib/ajustes-secciones.ts); lo que no se usa en el teléfono, «En la computadora».
//
// Lo que fija:
//   · la fila «Instalar la app» nunca es una fila muerta (Android sin el aviso de Chrome → los pasos);
//   · la fila «Notificaciones» dice cómo está ESTE teléfono, y nada mientras se revisa;
//   · los pasos de instalar son los del sistema del teléfono, con íconos que EXISTEN;
//   · las filas van en el orden de la computadora, cada una gateada por `seccionesCuenta`;
//   · mirando a un cliente se esconde lo tuyo SÓLO junto con la salida (se decide con `salidaDeVista`);
//   · «Configuración del negocio» con la regla del menú de la foto, y como «En la computadora»;
//   · refrescar trae las preferencias nuevas y vuelve a leer el teléfono;
//   · copy sin voseo, clases con el nombre entero de la carpeta y sólo tokens que existen.
//
// Correr: node --import tsx --test tests/m-cuenta.test.ts
//
// Verificado ROMPIENDO (15/10/2026), de a una y restaurando, base 9 pasan / 0 fallan:
//   · `filaInstalar` devolviendo null para Android sin aviso (como `ofertaInstalar`)        → 8 / 1
//   · `rielNotificaciones` diciendo «Apagados» mientras se revisa el teléfono               → 8 / 1
//   · el paso 2 de Android con el ícono inventado «menu»                                     → 8 / 1
//   · Seguridad arriba de Información personal en CuentaM                                    → 8 / 1
//   · page.tsx con `seccionesCuenta(perfil?.vista.deOtro ?? false)` en vez de la salida      → 8 / 1
//   · el negocio sin `puedeVerKey('configuraciones'`                                         → 8 / 1
//   · sin el `if (pushVisto !== push)` (refrescar no trae las preferencias)                  → 8 / 1
//   · «Tocá» en un paso de instalar                                                          → 8 / 1
//   · una clase `.cuenta-hoja` sin el prefijo de la carpeta en cuenta.css                    → 8 / 1
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { filaInstalar, pasosInstalar, rielNotificaciones } from '../app/m/cuenta/cuenta-ui';
import { SECCIONES_CUENTA } from '../lib/ajustes-secciones';

const RAIZ = path.join(__dirname, '..');
const leer = (rel: string) => readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('«Instalar la app» siempre lleva a algo: Android sin el aviso de Chrome va a los pasos', () => {
  assert.equal(filaInstalar(null), 'revisando', 'antes de leer el teléfono, la fila quieta');
  assert.equal(filaInstalar({ ios: true, instalada: true, puedePedir: false }), 'instalada');
  assert.equal(filaInstalar({ ios: false, instalada: true, puedePedir: true }), 'instalada', 'instalada gana al aviso');
  assert.equal(filaInstalar({ ios: true, instalada: false, puedePedir: false }), 'pasos-ios');
  assert.equal(filaInstalar({ ios: false, instalada: false, puedePedir: true }), 'boton');
  // Lo que antes era null (la fila no se dibujaba): ahora es una sección de «Tu cuenta», y no puede faltar.
  assert.equal(filaInstalar({ ios: false, instalada: false, puedePedir: false }), 'pasos');
});

test('«Notificaciones» dice cómo está ESTE teléfono, en una o dos palabras', () => {
  assert.equal(rielNotificaciones('cargando', 'Todos'), null, 'mientras se revisa, nada (no cambia de opinión al segundo)');
  assert.equal(rielNotificaciones('activo', '12 de 20'), '12 de 20', 'prendido: qué llega');
  assert.equal(rielNotificaciones('activo', null), 'Activados', 'sin preferencias guardables');
  assert.equal(rielNotificaciones('activar', 'Todos'), 'Apagados');
  assert.equal(rielNotificaciones('instalar-ios', 'Todos'), 'Apagados');
  assert.equal(rielNotificaciones('bloqueado', 'Todos'), 'Bloqueados');
  assert.equal(rielNotificaciones('no-soportado', 'Todos'), 'No disponibles');
  for (const v of ['activar', 'instalar-ios', 'bloqueado', 'no-soportado'] as const) {
    const r = rielNotificaciones(v, 'Todos') ?? '';
    assert.ok(r.split(' ').length <= 2, `«${r}»: el riel es corto`);
  }
});

test('los pasos de instalar son los del sistema del teléfono, con íconos que existen', () => {
  const ios = pasosInstalar(true);
  const android = pasosInstalar(false);
  assert.match(ios[0].frase, /Compartir/);
  assert.match(ios[1].frase, /Agregar a inicio/);
  assert.match(android[0].frase, /menú del navegador/);
  assert.doesNotMatch(android.map((p) => p.frase).join(' '), /Safari|Compartir/, 'un Android no tiene Safari');
  // Un nombre que no está en el set dibuja un punto (app/_components/icons.tsx, `PATHS[name] ?? PATHS.dot`).
  const iconos = leer('app/_components/icons.tsx');
  const bloque = iconos.slice(iconos.indexOf('const PATHS'), iconos.indexOf('\n};', iconos.indexOf('const PATHS')));
  const nombres = new Set([...bloque.matchAll(/^\s+'?([a-z][\w-]*)'?\s*:/gm)].map((m) => m[1]));
  assert.ok(nombres.size > 40, `leí ${nombres.size} íconos: el recorte se rompió`);
  for (const p of [...ios, ...android]) assert.ok(nombres.has(p.icono), `«${p.icono}» no existe en icons.tsx`);
  for (const p of [...ios, ...android]) assert.ok(p.frase.length <= 40, `«${p.frase}»: un paso es una frase corta`);
});

test('las filas de «Tu cuenta» van en el orden de la computadora, cada una con su regla', () => {
  const cuenta = sinComentarios(leer('app/m/cuenta/CuentaM.tsx'));
  // La pantalla, desde que arranca CuentaM hasta el Modo oscuro (después vienen las hojas).
  const lista = cuenta.slice(cuenta.indexOf('export function CuentaM('), cuenta.indexOf('<ModoOscuro />'));
  assert.ok(lista.length > 200, `recorte: ${lista.length}`);
  const posiciones = SECCIONES_CUENTA.map((s) => lista.indexOf(`titulo={ROTULO.${s.key}}`));
  for (const [i, s] of SECCIONES_CUENTA.entries()) {
    assert.ok(posiciones[i] >= 0, `«${s.label}» no es una fila de la pantalla`);
    assert.ok(lista.includes(`ve('${s.key}')`), `«${s.label}» sin la regla de seccionesCuenta`);
  }
  assert.deepEqual([...posiciones].sort((a, b) => a - b), posiciones, 'las secciones no van en el orden de la computadora');
  // Seguridad es su pantalla; Información personal y Notificaciones, una hoja.
  assert.match(lista, /titulo=\{ROTULO\.seguridad\} href="\/m\/cuenta\/seguridad"/);
  assert.match(cuenta, /<SheetM abierto=\{hoja === 'info'\}/);
  assert.match(cuenta, /<SheetM abierto=\{hoja === 'notificaciones'\}/);
});

test('mirando a un cliente, lo tuyo se esconde SÓLO junto con la salida', () => {
  const pagina = sinComentarios(leer('app/m/cuenta/page.tsx'));
  assert.match(pagina, /const deOtro = salida != null;/);
  assert.match(pagina, /secciones: seccionesCuenta\(deOtro\)\.map\(\(s\) => s\.key\)/);
  const cuenta = sinComentarios(leer('app/m/cuenta/CuentaM.tsx'));
  // La salida es obligatoria: está con la vista, fuera de cualquier sección condicional.
  assert.match(cuenta, /\{datos\.vista && \(\s*<ListaM>\s*<FilaM navegacion titulo=\{`Viendo a \$\{datos\.vista\.cliente\}`\} \/>\s*<div className="m-cuenta-boton m-cuenta-boton--azul">\s*<SalirDeLaVista /);
  assert.match(cuenta, /<CerrarSesion /);
});

test('«Configuración del negocio»: la regla del menú de la foto, y «En la computadora»', () => {
  const pagina = sinComentarios(leer('app/m/cuenta/page.tsx'));
  assert.match(pagina, /negocio: puedeVerKey\('configuraciones', ctx\.rol, ctx\.capa\) \? TITULO_NEGOCIO : null/);
  const cuenta = sinComentarios(leer('app/m/cuenta/CuentaM.tsx'));
  assert.match(cuenta, /\{datos\.negocio && <ComputadoraM que=\{datos\.negocio\} \/>\}/);
});

test('refrescar trae las preferencias nuevas y vuelve a leer el teléfono', () => {
  const cuenta = sinComentarios(leer('app/m/cuenta/CuentaM.tsx'));
  // Copiar `push` a un estado sin esto hacía que tirar para refrescar animara y no trajera nada (AGENTS.md).
  assert.match(cuenta, /if \(pushVisto !== push\) \{ setPushVisto\(push\); setPrefs\(push\); \}/);
  assert.match(cuenta, /useEffect\(\(\) => \{ revisar\(\); \}, \[push, revisar\]\);/);
  assert.match(cuenta, /addEventListener\('visibilitychange', alVolver\)/);
  // El permiso se sigue pidiendo dentro del toque (tests/m-inbox-cuenta.test.ts fija la primera línea).
  assert.match(cuenta, /const activar = \(\) => \{\s*const pedido = activarAvisos\(\);/);
});

test('copy sin voseo, clases con el nombre entero de la carpeta y sólo tokens que existen', () => {
  const archivos = ['app/m/cuenta/CuentaM.tsx', 'app/m/cuenta/cuenta-ui.ts', 'app/m/cuenta/page.tsx', 'app/m/cuenta/instalar/PasosInstalar.tsx', 'app/m/cuenta/seguridad/page.tsx'];
  // Sin \b: en un regex sin `u`, la «á» final no es letra y el \b de después nunca se cumple.
  const VOSEO = /(?<!\p{L})(tocá|mirá|tenés|podés|elegí|abrí|activá|instalá|probá|querés|sos|volvé|entrá|andá)(?!\p{L})/iu;
  for (const f of archivos) {
    const textos = [...sinComentarios(leer(f)).matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]);
    for (const t of textos) assert.doesNotMatch(t, VOSEO, `${f}: «${t}»`);
  }
  const css = sinComentarios(leer('app/m/cuenta/cuenta.css'));
  // La clase que cada regla DEFINE es la primera después de [data-m]; las del shell van sólo más adentro.
  for (const m of css.matchAll(/\[data-m\]\s+\.([\w-]+)/g)) {
    assert.ok(m[1].startsWith('m-cuenta'), `.${m[1]}: una clase de /m/cuenta sin el nombre entero de la carpeta`);
  }
  const globals = leer('app/globals.css');
  for (const m of new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((x) => x[1]))) {
    assert.ok(globals.includes(`${m}:`), `${m} no existe en app/globals.css`);
  }
});

test('la página dibuja todo adentro de PantallaM y es para todos los roles', () => {
  const pagina = sinComentarios(leer('app/m/cuenta/page.tsx'));
  assert.match(pagina, /const ctx = await requireMovil\(\);/, '«Tu cuenta» es de todos los roles: sin navKey');
  assert.match(pagina, /return \(\s*<PantallaM>\s*<CuentaM datos=\{datos\} \/>\s*<\/PantallaM>\s*\);/);
});
