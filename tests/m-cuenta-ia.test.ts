// =============================================================================
// /m/cuenta/ia — «Tus cuentas de IA» en el teléfono (21/10/2026)
// =============================================================================
// Las computadoras de una persona que piensan su Ops Center con SU Claude. En la computadora son /perfil/ia
// (app/integraciones/TusCuentasIA.tsx); el teléfono DESTILA: el estado de cada computadora, sus cuentas con las dos barras
// y «Desconectar». Conectar una se hace en la computadora (instalar un programa y pegar un código).
//
// Lo que fija:
//   · la fila de «Tu cuenta» existe, con el rótulo y el ícono de la sección (lib/ajustes-secciones.ts), gateada por
//     `seccionesCuenta`, y lleva a /m/cuenta/ia;
//   · la ruta mapea en los dos sentidos (/perfil/ia ↔ /m/cuenta/ia) y la cabecera vuelve a «Tu cuenta»;
//   · una computadora «En línea» sin ninguna cuenta dice «Sin sesión de Claude», no «En línea» (`estadoDeLaPc` de
//     lib/ia-pc-reglas.ts, la de la computadora: el teléfono no escribe la suya);
//   · una hora de reinicio que YA PASÓ no se muestra (`yaPaso` de lib/ia-pc-reglas.ts, la de la computadora; ia-ui.ts);
//   · «Desconectar» confirma en una hoja y hace POST /api/ia-pc/desconectar con { id }; el teléfono no conecta ni elige modelo;
//   · tirar para refrescar vuelve a pedir el estado (el componente lee por su cuenta: sin esto el gesto no trae nada);
//   · copy sin voseo, clases con el nombre entero de la carpeta, sólo tokens que existen y ningún color escrito a mano.
//
// Correr: npx tsx --test tests/m-cuenta-ia.test.ts
//
// Verificado ROMPIENDO (21/10/2026), de a una cosa y restaurando byte por byte, base 8 pasan / 0 fallan — 25 roturas, 25 detectadas:
//   · fila: sin `ve('ia')` · href a otra pantalla · rótulo escrito a mano                          → 7 / 1 cada una
//   · ruta: sin `/perfil/ia` en rutaMovil · sin `/m/cuenta/ia` en rutaEscritorio                     → 7 / 1 cada una
//   · «Sin sesión de Claude»: una copia de la regla que se salta el caso (ia-ui) · «En línea» a mano
//     en IaM · punto verde para una PC sin cuentas                                                   → 7 / 1 cada una
//   · hora vencida: sin `!yaPaso(repone, ahora)` · la semana con la hora de la sesión · la sesión
//     sin su hora                                                                                    → 7 / 1 cada una
//   · desconectar: POST sin `{ id }` · la fila desconecta sin hoja · otra pregunta · la hoja se
//     vacía al cerrar · el teléfono pide /api/ia-pc/modelo                                           → 7 / 1 cada una
//   · refresco: el efecto sin `refresco` en sus deps · la página con `refresco={0}` · 60 s en vez de 20 → 7 / 1 · 6 / 2 · 7 / 1
//   · higiene: `requireMovil({ navKey })` · voseo · clase sin prefijo · token inexistente · hex a mano ·
//     clase usada que el CSS no define                                                               → 7 / 1 (el voseo, 6 / 2)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { SECCIONES_CUENTA, seccionesCuenta } from '../lib/ajustes-secciones';
import { rutaEscritorio, rutaInterna, rutaMovil } from '../lib/movil-rutas';
import { conWs } from '../lib/ws-tab';
import { TITULO_CUENTA, cabeceraPorRuta, nivel } from '../app/m/_ui/cabecera';
import { horaCorta } from '../app/m/_ui/formato';
import {
  REFRESCO_MS, barraDeUso, estadoDePc, nombreDeCuenta, preguntaDesconectar, tonoDeBarra,
} from '../app/m/cuenta/ia/ia-ui';

const RAIZ = path.join(__dirname, '..');
const leer = (rel: string) => readFileSync(path.join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

const AHORA = Date.parse('2026-10-21T15:00:00.000Z');
const en = (ms: number) => new Date(AHORA + ms).toISOString();
const MIN = 60_000;

test('la fila de «Tu cuenta»: el rótulo y el ícono de la sección, la regla de seccionesCuenta y su pantalla', () => {
  const seccion = SECCIONES_CUENTA.find((s) => s.key === 'ia');
  assert.ok(seccion, 'la sección «ia» no está en SECCIONES_CUENTA');
  assert.equal(seccion.label, 'Tus cuentas de IA');
  assert.equal(seccion.href, '/perfil/ia');
  assert.equal(seccion.icono, 'computadora');
  // La fila se gatea con la regla de la computadora: mirando a un cliente, lo tuyo no se ofrece.
  assert.ok(seccionesCuenta(false).some((s) => s.key === 'ia'));
  assert.ok(!seccionesCuenta(true).some((s) => s.key === 'ia'), 'mirando a un cliente no se ofrecen TUS computadoras');

  const cuenta = sinComentarios(leer('app/m/cuenta/CuentaM.tsx'));
  assert.match(cuenta, /type ClaveCuenta = [^;]*'ia'/, 'ClaveCuenta sin «ia»: el rótulo y el ícono no salen de la sección');
  assert.match(
    cuenta,
    /\{ve\('ia'\) && \(\s*<FilaM navegacion leading=\{<IconoSeccion k="ia" \/>\} titulo=\{ROTULO\.ia\} href="\/m\/cuenta\/ia" \/>\s*\)\}/,
    'la fila de «Tus cuentas de IA»: con ve(\'ia\'), su ícono, el rótulo de la sección y href=/m/cuenta/ia',
  );
  assert.doesNotMatch(cuenta, /titulo="Tus cuentas de IA"/, 'el rótulo escrito a mano en el teléfono');
  // Va después de «Instalar la app», como en la computadora.
  assert.ok(cuenta.indexOf('titulo={ROTULO.ia}') > cuenta.indexOf('titulo={ROTULO.instalar}'), 'el orden de la computadora');

  assert.ok(existsSync(path.join(RAIZ, 'app/m/cuenta/ia/page.tsx')), 'la fila lleva a una pantalla que no existe');
  const componente = sinComentarios(leer('app/m/cuenta/ia/IaM.tsx'));
  assert.match(componente, /SECCIONES_CUENTA\.find\(\(s\) => s\.key === 'ia'\)/, 'el título de la pantalla sale de la sección');
  assert.doesNotMatch(componente, /<CabeceraM titulo="/, 'el título escrito a mano en la pantalla');
});

test('la ruta mapea en los dos sentidos: /perfil/ia ↔ /m/cuenta/ia, y la cabecera vuelve a «Tu cuenta»', () => {
  assert.equal(rutaMovil('/perfil/ia'), '/m/cuenta/ia');
  assert.equal(rutaMovil('/perfil/ia?ws=3'), '/m/cuenta/ia');
  assert.equal(rutaEscritorio('/m/cuenta/ia'), '/perfil/ia');
  assert.equal(rutaEscritorio('/m/cuenta/ia?ws=3'), '/perfil/ia?ws=3');
  assert.equal(conWs('/m/cuenta/ia', 3), '/perfil/ia?ws=3', 'un link de /m a esta pantalla tiene que mostrar la URL de la computadora');
  assert.equal(rutaInterna('/perfil/ia', ''), '/m/cuenta/ia', 'el teléfono que abre /perfil/ia ve la pantalla de /m');
  // Una subpantalla de «Tu cuenta»: vuelve a «Tu cuenta» (la raíz, en More) y es de nivel 2.
  assert.deepEqual(cabeceraPorRuta('/m/cuenta/ia'), { titulo: '', padre: { href: '/m/cuenta', label: TITULO_CUENTA }, trabajo: false, conBarra: true });
  assert.equal(nivel('/m/cuenta/ia'), 2);
});

test('una computadora «En línea» sin ninguna cuenta dice «Sin sesión de Claude», no «En línea»', () => {
  const cuenta = { proveedor: 'claude' as const, email: 'ana@correo.com' };
  assert.deepEqual(estadoDePc({ enLinea: true, ultimoLatido: en(-10_000), cuentas: [] }, AHORA), { texto: 'Sin sesión de Claude', tono: 'atencion' });
  assert.deepEqual(estadoDePc({ enLinea: true, ultimoLatido: en(-10_000), cuentas: [cuenta] }, AHORA), { texto: 'En línea', tono: 'linea' });
  // Apagada: el motivo es que no hay conexión, tenga o no cuentas.
  assert.deepEqual(estadoDePc({ enLinea: false, ultimoLatido: en(-5 * MIN), cuentas: [cuenta] }, AHORA), { texto: 'Sin conexión · hace 5 min', tono: 'apagada' });
  assert.deepEqual(estadoDePc({ enLinea: false, ultimoLatido: en(-5 * MIN), cuentas: [] }, AHORA), { texto: 'Sin conexión · hace 5 min', tono: 'apagada' });
  assert.deepEqual(estadoDePc({ enLinea: false, ultimoLatido: null, cuentas: [] }, AHORA), { texto: 'Esperando que se conecte', tono: 'apagada' });
  // El texto es el de la computadora (lib/ia-pc-reglas.ts): el teléfono no escribe su propia copia de la regla.
  const reglas = sinComentarios(leer('app/m/cuenta/ia/ia-ui.ts'));
  assert.match(reglas, /import \{ estadoDeLaPc, yaPaso, type CuentaPc, type CuentasIA \} from '@\/lib\/ia-pc-reglas';/);
  assert.match(reglas, /texto: estadoDeLaPc\(pc, ahora, hace\)/);
  assert.doesNotMatch(reglas, /Sin sesión de Claude|Esperando que se conecte|Sin conexión/, 'una segunda copia de la regla en el teléfono');
  // La pantalla escribe lo que decide la regla: ni un «En línea» ni un «Sin sesión» a mano que se salte el caso.
  const componente = sinComentarios(leer('app/m/cuenta/ia/IaM.tsx'));
  assert.match(componente, /segunda=\{\[estado\.texto, dondeEsta\(d\), d\.de \? `De \$\{d\.de\}` : null\]\.filter\(Boolean\)\.join\(' · '\)\}/);
  assert.doesNotMatch(componente, /'En línea'|"En línea"|Sin sesión de Claude/);
});

test('la hora de reinicio que ya pasó no se muestra', () => {
  const t = AHORA + 90 * MIN;
  // Vigente: el % y «Se reinicia a las HH:MM» (en el reloj de quien mira).
  const vigente = barraDeUso(42, en(90 * MIN), AHORA);
  assert.equal(vigente.pct, 42);
  assert.equal(vigente.tono, 'bien');
  assert.equal(vigente.reinicio, `Se reinicia a las ${horaCorta(t)}`);
  assert.match(vigente.reinicio ?? '', /^Se reinicia a las \d{2}:\d{2}$/);
  // Vencida: ni rastro de «Se reinicia…» (un «a las 15:30» pasadas las 15:30 es mentira). El % queda: es lo último que se midió.
  assert.deepEqual(barraDeUso(92, en(-MIN), AHORA), { pct: 92, tono: 'mal', reinicio: null });
  assert.deepEqual(barraDeUso(92, en(-4 * 60 * MIN), AHORA), { pct: 92, tono: 'mal', reinicio: null });
  // Justo en el instante del reinicio, ya se reinició; un instante antes, todavía no.
  assert.equal(barraDeUso(92, en(0), AHORA).reinicio, null);
  assert.match(barraDeUso(92, en(1000), AHORA).reinicio ?? '', /^Se reinicia a las /);
  // Sin hora (la barra de la semana) el % se muestra sin «Se reinicia»; sin % no hay hora que mostrar.
  assert.deepEqual(barraDeUso(30, undefined, AHORA), { pct: 30, tono: 'bien', reinicio: null });
  assert.deepEqual(barraDeUso(undefined, en(90 * MIN), AHORA), { pct: null, tono: 'apagado', reinicio: null });
  assert.deepEqual(barraDeUso(undefined, undefined, AHORA), { pct: null, tono: 'apagado', reinicio: null });
  // Una hora ilegible no inventa nada.
  assert.deepEqual(barraDeUso(30, 'ayer', AHORA), { pct: 30, tono: 'bien', reinicio: null });
  // Los cortes del color son los de la computadora (75 y 90), y el % se queda entre 0 y 100.
  assert.deepEqual([0, 74, 75, 89, 90, 100].map(tonoDeBarra), ['bien', 'bien', 'ojo', 'ojo', 'mal', 'mal']);
  assert.equal(tonoDeBarra(null), 'apagado');
  assert.equal(barraDeUso(140, undefined, AHORA).pct, 100);

  // La regla es la de la computadora (lib/ia-pc-reglas.ts), no una copia.
  const reglas = sinComentarios(leer('app/m/cuenta/ia/ia-ui.ts'));
  assert.match(reglas, /!yaPaso\(repone, ahora\)/);
  // La pantalla usa esa regla para las dos barras: la de 5 horas con su hora, la semana sin ella.
  const componente = sinComentarios(leer('app/m/cuenta/ia/IaM.tsx'));
  assert.match(componente, /barraDeUso\(cuenta\.usado5h, cuenta\.repone, ahora\)/);
  assert.match(componente, /barraDeUso\(cuenta\.usadoSemana, cuenta\.reponeSemana, ahora\)/);
  assert.match(componente, /\{b\.reinicio && <p className="m-cuenta-ia-nota">\{b\.reinicio\}<\/p>\}/, 'la hora sale de la regla, no de la cuenta');
});

test('«Desconectar» confirma en una hoja y hace POST /api/ia-pc/desconectar con { id }; el teléfono no conecta ni elige modelo', () => {
  assert.equal(preguntaDesconectar({ esMia: true }), '¿Desconectarla? Tu chat deja de usarla.');
  // El admin mirando la computadora de otra persona: el chat que la deja de usar es el de ELLA.
  assert.equal(preguntaDesconectar({ esMia: false, de: 'Ana' }), '¿Desconectarla? El chat de Ana deja de usarla.');
  assert.equal(preguntaDesconectar({ esMia: false }), '¿Desconectarla? Tu chat deja de usarla.');
  assert.equal(nombreDeCuenta({ proveedor: 'claude', email: 'ana@correo.com' }), 'ana@correo.com');
  assert.equal(nombreDeCuenta({ proveedor: 'claude' }), 'Tu cuenta de Claude');

  const c = sinComentarios(leer('app/m/cuenta/ia/IaM.tsx'));
  // El toque de la fila SÓLO abre la hoja: el POST está detrás del botón de la hoja.
  assert.match(c, /onDesconectar=\{\(d\) => \{ setPorDesconectar\(d\); setHojaAbierta\(true\); \}\}/);
  assert.match(c, /<FilaM navegacion titulo="Desconectar" etiqueta=\{`Desconectar \$\{d\.nombre\}`\} onClick=\{onDesconectar\} \/>/);
  assert.match(c, /<SheetM id="desconectar" abierto=\{hojaAbierta\} onCerrar=\{\(\) => setHojaAbierta\(false\)\}/);
  assert.match(c, /\{preguntaDesconectar\(porDesconectar\)\}/);
  assert.match(c, /<Button variant="danger" size="lg" full loading=\{ocupado\} onClick=\{\(\) => \{ void desconectar\(\); \}\}>Desconectar<\/Button>/);
  assert.match(
    c,
    /fetch\('\/api\/ia-pc\/desconectar', \{\s*method: 'POST', headers: \{ 'content-type': 'application\/json' \}, body: JSON\.stringify\(\{ id \}\),\s*\}\)/,
  );
  // Un POST que falla no cierra la hoja ni se calla: avisa (la computadora lo ignoraba).
  assert.match(c, /if \(!r\?\.ok\) \{ haptico\('error'\); toast\(r\?\.error \?\? 'No se pudo desconectar'\); return; \}/);
  // La hoja no se vacía a mitad de su salida: la computadora elegida no se suelta al cerrar.
  assert.doesNotMatch(c, /setPorDesconectar\(null\)/);
  // Sólo lectura + desconectar: conectar y el modelo se hacen en la computadora.
  assert.doesNotMatch(c, /\/api\/ia-pc\/(codigo|emparejar|modelo|instalar)/);
  // «Nueva cuenta» y «Nuevo dispositivo» (23/10/2026): se conectan en la computadora.
  assert.match(c, /<FilaEnComputadoraM icono="plus" titulo="Nueva cuenta" href="\/perfil\/ia"/);
  assert.match(c, /<FilaEnComputadoraM icono="plus" titulo="Nuevo dispositivo" href="\/perfil\/ia"/);
});

test('tirar para refrescar vuelve a pedir el estado, y se vuelve a leer cada 20 s', () => {
  assert.equal(REFRESCO_MS, 20_000, 'la computadora lo lee cada 20 s');
  const pagina = sinComentarios(leer('app/m/cuenta/ia/page.tsx'));
  assert.match(pagina, /<IaM refresco=\{Date\.now\(\)\} \/>/, 'sin un valor nuevo en cada pasada del server, el gesto anima y no trae nada');
  const c = sinComentarios(leer('app/m/cuenta/ia/IaM.tsx'));
  assert.match(c, /\}, \[recargar, refresco\]\);/);
  assert.match(c, /fetch\('\/api\/ia-pc\/estado', \{ cache: 'no-store' \}\)/);
  assert.match(c, /setInterval\(\(\) => \{ if \(document\.visibilityState !== 'hidden'\) void recargar\(\); \}, REFRESCO_MS\)/);
  assert.match(c, /addEventListener\('visibilitychange', alVolver\)/);
  assert.match(c, /removeEventListener\('visibilitychange', alVolver\)/);
  // Una lectura que falla con datos a la vista no los tapa con un error; sin datos, error con reintento.
  assert.match(c, /estado == null\s*\?\s*\(fallo\s*\?\s*<ErrorM [^>]*onReintentar=\{\(\) => void recargar\(\)\} \/>\s*:\s*<SkeletonFilas /);
  assert.match(c, /!\(estado\.grupos\?\.cuentas\.length \|\| estado\.grupos\?\.sinCuenta\.length\)\s*\?\s*<VacioM frase="Todavía no conectaste ninguna cuenta\." \/>/);
});

test('la página dibuja todo adentro de PantallaM y es para todos los roles', () => {
  const pagina = sinComentarios(leer('app/m/cuenta/ia/page.tsx'));
  assert.match(pagina, /await requireMovil\(\);/, 'es de la persona, de todos los roles: sin navKey');
  assert.doesNotMatch(pagina, /requireMovil\(\{/);
  assert.match(pagina, /return \(\s*<PantallaM>\s*<IaM refresco=\{Date\.now\(\)\} \/>\s*<\/PantallaM>\s*\);/);
  assert.match(pagina, /import '\.\/ia\.css';/);
});

test('copy sin voseo, clases con el nombre entero de la carpeta, sólo tokens que existen y ningún color a mano', () => {
  const archivos = ['app/m/cuenta/ia/IaM.tsx', 'app/m/cuenta/ia/ia-ui.ts', 'app/m/cuenta/ia/page.tsx'];
  // Sin \b: en un regex sin `u`, la «á» final no es letra y el \b de después nunca se cumple.
  const VOSEO = /(?<!\p{L})(tocá|mirá|tenés|podés|elegí|abrí|activá|instalá|probá|querés|sos|volvé|entrá|andá|conectá|desconectá|pegá)(?!\p{L})/iu;
  for (const f of archivos) {
    const textos = [...sinComentarios(leer(f)).matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`\n]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]);
    for (const t of textos) assert.doesNotMatch(t, VOSEO, `${f}: «${t}»`);
  }
  const css = sinComentarios(leer('app/m/cuenta/ia/ia.css'));
  // La clase que cada regla DEFINE es la primera después de [data-m].
  const clases = [...css.matchAll(/\[data-m\]\s+\.([\w-]+)/g)].map((m) => m[1]);
  assert.ok(clases.length >= 10, `recorte: ${clases.length} clases`);
  for (const k of clases) assert.ok(k.startsWith('m-cuenta-ia-'), `.${k}: una clase de /m/cuenta/ia sin el nombre entero de la carpeta`);
  // Toda clase que la pantalla usa existe en el CSS (una sin regla es un diseño que no se dibuja).
  const usadas = new Set([...sinComentarios(leer('app/m/cuenta/ia/IaM.tsx')).matchAll(/m-cuenta-ia-[\w]+(?:-[\w]+)*/g)].map((m) => m[0]));
  for (const k of usadas) assert.ok(clases.includes(k), `${k}: la pantalla la usa y ia.css no la define`);
  const globals = leer('app/globals.css');
  for (const m of new Set([...css.matchAll(/var\((--[\w-]+)\)/g)].map((x) => x[1]))) {
    assert.ok(globals.includes(`${m}:`), `${m} no existe en app/globals.css`);
  }
  // Claro y oscuro: los colores salen del tema. Ningún hexadecimal ni rgb() escrito en la hoja.
  assert.doesNotMatch(css, /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(/, 'un color escrito a mano en ia.css');
});
