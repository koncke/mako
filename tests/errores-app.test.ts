// =============================================================================
// Los errores de la app llegan SOLOS a la Ticketera (17/10/2026)
// =============================================================================
// Martín: «lo mismo que corrés en MaKo en WhatsApp detectando errores, córrelo en toda la app: MaKo en los chats de la
// app, errores al navegar o lo que sea. Y todo lo solucionas automáticamente». Lo que fija este archivo:
//   1. SIN DATOS DE CLIENTES: emails, teléfonos y lo citado no se guardan; la pantalla va sin los valores de su query;
//   2. EL RUIDO NO ES UN BUG: una extensión, la red, un deploy nuevo, el control de flujo de Next y el proveedor de IA caído;
//   3. LA HUELLA agrupa el MISMO error (otros números, otro lead, otro deploy) y separa dos distintos;
//   4. el ticket que abre es un bug evidente para el triage (salvo zona delicada), con el hilo del chat si vino de MaKo;
//   5. LAS TRES PUERTAS: el navegador (sólo con sesión y del mismo origen; el boundary no importa nada de la app), el
//      servidor (onRequestError) y el chat de MaKo; y la tabla nace con RLS, el revoke y el `canal = 'sistema'`.
//
// Probado rompiéndolo (17/10/2026, arnés del scratchpad `romper-errores.mjs`: una rotura por vez, restaurada de memoria y
// comprobada con sha256; base 7 / 0). Cada una dio 6 / 1 con el rojo en su test: `sinDatos` sin borrar emails · sin la
// lista de ruido · la huella con el stack · la huella con los números · /api/errores sin rechazar otro origen (pasó la
// primera vez: el test miraba el cálculo y no el 403) · el boundary importando algo de la app · el reportador sin sesión
// y en lo público · registrar sin descartar el ruido · el ticket de MaKo sin el hilo · la tabla sin el revoke. Y en
// tests/tickets.test.ts, el chat diciendo «le avisé» aunque no haya entrado → 13 / 1. Y el aviso al grupo sin mirar que el
// build traiga el hito (sin la prueba del deploy) → 7 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  TOPE_AFECTADOS, conAfectado, esHidratacion, esRuido, huellaDe, pistasDeHidratacion, rutaPatron, rutaSinDatos, sanearReporte, sinDatos, ticketDeError,
  type ReporteError,
} from '../lib/errores-app-reglas';
import { CANALES, clasificar, pruebaDeProduccion, textoArregloAlGrupo } from '../lib/tickets-reglas';
import { textoDelAviso as validarAvisoDeArreglo } from '../lib/aviso-arreglo-reglas';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const STACK = 'TypeError: x\n    at Bloque (https://hola-mako.com/_next/static/chunks/app/general/page-abc123.js:1:2345)\n    at r (https://hola-mako.com/_next/static/chunks/main-9f8e.js:1:99)';
const base = (x: Partial<ReporteError> = {}) => sanearReporte({
  origen: 'navegador', nombre: 'TypeError', mensaje: "Cannot read properties of undefined (reading 'etapa')", stack: STACK, ruta: '/crm?lead=12', ...x,
})!;

test('sin datos de clientes: emails, teléfonos y lo citado no se guardan; la query va sin valores', () => {
  // Rota: sin el reemplazo de los emails en `sinDatos` → este test falla.
  const s = sinDatos('No pude mandar a ana@negocio.com ni al +54 9 11 2345-6789 el mensaje "Hola Juan" del lead 12');
  assert.doesNotMatch(s, /ana@negocio|2345|Hola Juan/);
  assert.match(s, /«email»/);
  assert.match(s, /«número»/);
  assert.match(s, /lead 12/, 'un número corto (un id) queda: sirve para arreglarlo');
  assert.equal(rutaSinDatos('/crm?lead=12&q=juan%20perez&funnel=3'), '/crm?lead=12&q=…&funnel=3');
  assert.equal(rutaSinDatos('https://otro.com/x'), '');
  assert.equal(rutaSinDatos('//otro.com/x'), '');
  const r = base({ mensaje: 'falló para ana@negocio.com', stack: `${STACK}\nError: datos de ana@negocio.com` });
  assert.doesNotMatch(JSON.stringify(r), /ana@negocio/, 'ni en el mensaje ni en el stack');
});

test('la RUTA que manda /api/errores va sin los tokens del camino ni los números largos', () => {
  // ⚠️ El agujero hasta el 6/11/2026: `rutaSinDatos` sólo tapaba la QUERY, y hay rutas cuya ruta ES la credencial. El
  // reporte de un error las guardaba enteras. El botón «Reportar a Soporte» ya las tapaba (`rutaSoporte`); esto no.
  //
  // ⚠️ Probado ROMPIÉNDOLO, tres veces. Al mudar la regla a `rutaSinDatos`, `rutaSoporte` quedó delegando en ella, así que
  // las guardas que ya tenía el botón ahora también cubren este camino — una rotura da rojo en los tres archivos:
  //   (a) el camino sin tapar (lo de antes): errores-app 12/1, reportar-a-soporte 10/1, curso-soporte-alumno 5/1;
  //   (b) la query con `\d{1,12}` y sin CLAVES_SENSIBLES (lo de antes): 12/1, 10/1 y 6/0;
  //   (c) el punto fuera del juego de caracteres del token (el del portal del alumno): 12/1, 11/0 y 5/1.
  assert.equal(rutaSinDatos('/pagar/AbCdEf1234567890xyz'), '/pagar/:token');
  assert.equal(rutaSinDatos('/compartido/curso/c1.15.8842.3.9f2ab77c1de4'), '/compartido/curso/:token');
  assert.equal(rutaSinDatos('/l/vista/ana@cliente.com'), '/l/vista/:token');
  assert.equal(rutaSinDatos('/automations/campana-de-prueba'), '/automations/campana-de-prueba', 'un slug de palabras no es un token');
  assert.equal(rutaSinDatos('/crm/123'), '/crm/123', 'un id corto sigue siendo la pantalla');
  // Un teléfono entra cómodo en 10-12 cifras, que era lo que la query conservaba.
  assert.equal(rutaSinDatos('/crm/123?tel=5491155551234&code=123456&ws=3&etapa=nueva'), '/crm/123?tel=…&code=…&ws=3&etapa=…');
  assert.equal(rutaSinDatos('/crm?lead=1234567890'), '/crm?lead=…', 'diez cifras ya no son un id');

  // Y el reporte que se guarda, que es lo que de verdad viaja a la base.
  const r = base({ ruta: '/compartido/curso/c1.15.8842.3.9f2ab77c1de4?tel=5491155551234' });
  assert.equal(r.ruta, '/compartido/curso/:token?tel=…');
  assert.doesNotMatch(JSON.stringify(r), /9f2ab77c1de4|5491155551234/, 'ni el token ni el teléfono quedan guardados');
});

test('el ruido no es un bug: extensiones, la red, un deploy nuevo, Next y el proveedor de IA', () => {
  // Rota: vaciar la lista RUIDO → este test falla (cada pestaña vieja después de un deploy abriría un ticket).
  const ruido: Array<Partial<ReporteError>> = [
    { mensaje: 'ResizeObserver loop completed with undelivered notifications.' },
    { mensaje: 'Script error.' },
    { nombre: 'ChunkLoadError', mensaje: 'Loading chunk 412 failed.' },
    { mensaje: 'Failed to fetch dynamically imported module: https://hola-mako.com/_next/static/x.js' },
    { nombre: 'TypeError', mensaje: 'Failed to fetch' },
    { nombre: 'AbortError', mensaje: 'The user aborted a request.' },
    { origen: 'servidor', nombre: 'Error', mensaje: 'NEXT_REDIRECT', stack: '' },
    { origen: 'mako', nombre: 'responder', mensaje: 'HTTP 503: high demand', stack: '' },
    { mensaje: 'x is not defined', stack: 'at f (chrome-extension://abc/content.js:1:1)' },
  ];
  for (const x of ruido) {
    const r = base(x);
    assert.ok(esRuido(r), `debería ser ruido: ${r.nombre}: ${r.mensaje}`);
  }
  assert.equal(esRuido(base()), false, 'un TypeError en nuestro código es un bug');
  assert.equal(esRuido(base({ stack: 'at f (https://otro-sitio.com/widget.js:1:1)' })), true, 'un stack que no pasa por nuestro código es de afuera');
});

test('la huella agrupa el MISMO error (otros números, otro lead, otro deploy) y separa dos distintos', () => {
  // Rota: meter el stack en la huella → este test falla (cada deploy cambia los nombres de los archivos).
  const a = base({ mensaje: "Cannot read properties of undefined (reading 'etapa') en lead 12", ruta: '/crm/12?tab=pagos' });
  const b = base({ mensaje: "Cannot read properties of undefined (reading 'etapa') en lead 977", ruta: '/crm/977?tab=notas', stack: STACK.replace(/abc123/g, 'zz9999') });
  assert.equal(huellaDe(a), huellaDe(b));
  assert.match(huellaDe(a), /^[0-9a-f]{16}$/);
  assert.notEqual(huellaDe(a), huellaDe(base({ ruta: '/general' })), 'otra pantalla es otro error');
  assert.notEqual(huellaDe(a), huellaDe(base({ nombre: 'RangeError' })), 'otro tipo es otro error');
  assert.notEqual(huellaDe(a), huellaDe({ ...a, origen: 'servidor' }), 'del servidor es otro error que del navegador');
  assert.equal(rutaPatron('/crm/12/ficha'), '/crm/:id/ficha');
  assert.equal(rutaPatron('/x/3f2a1b4c-0000-4000-8000-000000000001'), '/x/:id');
});

test('el ticket que abre es un bug evidente para el triage, con el hilo del chat si vino de MaKo', () => {
  const t = ticketDeError(base(), 3);
  assert.equal(t.titulo, 'La pantalla «CRM» se rompió', 'en palabras del cliente: el nombre de la tab, no la ruta');
  assert.match(String(t.contexto.error), /TypeError: .*· 3 veces/);
  const v = clasificar({ tipoDeclarado: 'bug', declaradoPor: 'sistema', titulo: t.titulo, descripcion: t.descripcion, contexto: t.contexto as never });
  assert.equal(v.tipo, 'bug');
  assert.equal(v.autoArreglo, true, v.porque.join(' | '));
  // En una zona delicada, decide Martín igual.
  const p = ticketDeError(base({ ruta: '/pagos?lead=3' }));
  assert.equal(clasificar({ tipoDeclarado: 'bug', declaradoPor: 'sistema', titulo: p.titulo, descripcion: p.descripcion, contexto: p.contexto as never }).autoArreglo, false);
  // De MaKo: la herramienta y el hilo, para avisarle en ESE chat.
  const m = sanearReporte({ origen: 'mako', nombre: 'mover_lead', mensaje: 'Algo falló de nuestro lado', hilo: '4521' })!;
  const tm = ticketDeError(m);
  assert.equal(tm.titulo, 'MaKo no pudo «mover_lead»');
  assert.equal(ticketDeError(sanearReporte({ origen: 'mako', nombre: 'mover_lead', mensaje: 'x', etiqueta: 'Mover un lead de etapa' })!).titulo, 'MaKo no pudo «Mover un lead de etapa»');
  assert.deepEqual(tm.contexto.chat, { donde: 'error-mako', hilo: '4521' });
  assert.equal(sanearReporte({ origen: 'navegador', nombre: 'E', mensaje: 'x', hilo: '4521' })!.hilo, undefined, 'el navegador no elige un hilo');
  assert.equal(sanearReporte({ origen: 'otro', nombre: 'E', mensaje: 'x' }), null);
});

test('los afectados: sin repetir y con tope', () => {
  let xs = conAfectado([], { ws: 3, email: 'a@x.com' });
  xs = conAfectado(xs, { ws: 3, email: 'a@x.com' });
  assert.equal(xs.length, 1);
  for (let i = 0; i < 40; i++) xs = conAfectado(xs, { ws: i + 10, email: `p${i}@x.com` });
  assert.equal(xs.length, TOPE_AFECTADOS);
  assert.deepEqual(conAfectado('basura', { ws: 1, email: 'b@x.com' }), [{ ws: 1, email: 'b@x.com' }]);
});

test('las tres puertas: el navegador con sesión y del mismo origen, el servidor y el chat de MaKo', () => {
  // Rota: sacar el chequeo de origen de /api/errores → este test falla.
  const ruta = sinComentarios(leer('app/api/errores/route.ts'));
  assert.match(ruta, /new URL\(origen\)\.host === req\.headers\.get\('host'\)/, 'el origen se compara entero');
  assert.match(ruta, /if \(!mismo\) return new Response\(null, \{ status: 403 \}\);/, 'y otro origen se rechaza');
  assert.match(ruta, /if \(!s\?\.email \|\| !ws\) return new Response\(null, \{ status: 401 \}\);/, 'sólo con sesión');
  assert.match(ruta, /origen: 'navegador' \}/, 'el origen lo pone el servidor, no el navegador');
  // El boundary no importa NADA de la app (si lo roto es la app, el boundary sigue andando).
  for (const f of ['app/error.tsx', 'app/global-error.tsx']) {
    const s = sinComentarios(leer(f));
    const imports = [...s.matchAll(/^import .* from '([^']+)';$/gm)].map((m) => m[1]);
    assert.deepEqual(imports.filter((i) => i !== 'react'), [], `${f} importa ${imports.join(', ')}`);
    assert.match(s, /fetch\('\/api\/errores'/);
    assert.match(s, /Server Components render\|omitted in production/, `${f}: el error del servidor lo reporta el servidor`);
  }
  assert.match(sinComentarios(leer('app/error.tsx')), /avisado \? 'Ya le avisamos al equipo de MaKo/, 'dice «ya le avisamos» SÓLO si entró');
  // Fuera de lo público, y también en el teléfono (21/10/2026: adentro de HideOnPublicLanding no corría nunca ahí).
  assert.match(sinComentarios(leer('app/layout.tsx')), /\{sesion && <FueraDeLoPublico><ReportadorDeErrores \/><\/FueraDeLoPublico>\}/);
  const inst = sinComentarios(leer('instrumentation.ts'));
  assert.match(inst, /export async function onRequestError\(/);
  assert.match(inst, /registrarError\(\{\s*origen: 'servidor'/);
  const er = sinComentarios(leer('lib/errores-app.ts'));
  assert.match(er, /if \(esRuido\(r\)\) return \{ ok: false, motivo: 'ruido' \};/);
  assert.match(er, /if \(\(count \?\? 0\) >= TOPE_ERRORES_NUEVOS_POR_DIA\) return \{ ok: false, motivo: 'tope' \};/);
  assert.match(er, /\} catch \(e\) \{\s*console\.error\('\[errores-app\] registrarError:'/, 'nunca tira');
});

test('el aviso al grupo: en palabras del cliente, aceptado por la función del Desarrollador, y SÓLO con la prueba del deploy', () => {
  // Rota: llamar a `avisarArregloAlGrupo` sin mirar que este build traiga el hito → este test falla (se le diría
  // «ya anda» a un cliente por un ticket que Martín sólo contestó).
  for (const titulo of ['La pantalla «CRM» se rompió', 'MaKo no pudo «Mover un lead de etapa»', 'Falló la pantalla «General»']) {
    const texto = textoArregloAlGrupo({ titulo });
    assert.match(texto, /^Arreglamos un error que viste en MaKo: [a-zé].*\. Ya anda\.$/);
    const v = validarAvisoDeArreglo(texto);
    assert.ok(v.ok, `la función del Desarrollador rechaza «${texto}»: ${v.ok ? '' : v.error}`);
  }
  const prueba = pruebaDeProduccion({ ticket: 12, hito: 'La etapa se guarda', area: 'crm', commit: '0949d7792abc', deploy: 'mako-abc.vercel.app' });
  assert.match(prueba, /ticket #12 .*https:\/\/mako-abc\.vercel\.app.*0949d7792.*«La etapa se guarda» del área crm/);
  const cierre = sinComentarios(leer('lib/tickets-cierre.ts'));
  assert.match(cierre, /const hito = f\.estado === 'resuelto' \? \(desplegados\.get\(f\.id\) \?\? \(f\.duplicado_de \? desplegados\.get\(f\.duplicado_de\) : undefined\)\) : undefined;\s*if \(hito\) \{/);
  assert.match(cierre, /avisarArregloAlGrupo\(\{ ws: n, clave: `ticket:\$\{f\.id\}`, texto: textoArregloAlGrupo\(f\), prueba, origen: 'ticketera', ws1Seguro: n === 1 \}\)/);
  assert.doesNotMatch(cierre, /ejecutarDesdeFlujo/, 'no es una operación del registro: nadie más puede firmar como el equipo');
});

test('la tabla nace con RLS y el revoke, y el canal `sistema` dice lo mismo en la base y en el código', () => {
  const sql = leer('supabase/migrations/0313_errores_app.sql');
  assert.match(sql, /alter table errores_app enable row level security;/);
  assert.match(sql, /revoke all on errores_app from anon, authenticated;/);
  assert.match(sql, /ORDEN DE DESPLIEGUE: ANTES del deploy/);
  assert.ok((CANALES as readonly string[]).includes('sistema'));
  assert.match(sql, /check \(canal in \('chat_app', 'chat_movil', 'whatsapp', 'formulario', 'api', 'sistema'\)\)/);
});

// ── El HTML que no coincidió (ticket #39, 1/11/2026) ───────────────────────────────────────

test('un error de hidratación no se anuncia como pantalla rota: React la vuelve a dibujar y se sigue trabajando', () => {
  const m = 'Minified React error #418; visit https://react.dev/errors/418?args[]=HTML&args[]= for the full message';
  const r = { origen: 'navegador', nombre: 'Error', mensaje: m, ruta: '/crm?funnel=17' } as const;
  assert.ok(esHidratacion(m));
  assert.ok(!esHidratacion('Minified React error #310'), 'otro error de React sí es una pantalla rota');
  const t = ticketDeError(r);
  assert.doesNotMatch(t.titulo, /rompió/);
  assert.doesNotMatch(t.descripcion, /rompió/);
  assert.match(t.descripcion, /Puedes seguir trabajando/);
  assert.match(ticketDeError({ ...r, mensaje: 'Minified React error #310' }).titulo, /rompió/);
});

test('las pistas dicen qué tocó la página, sin un solo texto de la página', () => {
  const nodo = (tagName: string) => ({ tagName });
  const doc = {
    documentElement: { className: 'translated-ltr', lang: 'es' },
    getElementsByTagName: (q: string) => (q === 'font' ? [nodo('FONT'), nodo('FONT')] : [nodo('DIV'), nodo('FONT'), nodo('GRAMMARLY-EXTENSION')]),
  } as unknown as Document;
  assert.equal(pistasDeHidratacion(doc, 'de-DE'), 'font=2; traducida=si; lang=es; navegador=de-DE; ajenas=grammarly-extension');
});

// Ticket #52: con esto, «font=0 y ninguna ajena» (el criterio de docs/hallazgos-ticketera.md para decir «es nuestro») se puede leer de verdad.
// ROMPIÉNDOLO (4/11/2026): sin el filtro → 1 fallo.
test('la etiqueta que pone Next en toda página no es ajena', () => {
  const doc = {
    documentElement: { className: '', lang: 'es' },
    getElementsByTagName: (q: string) => (q === 'font' ? [] : [{ tagName: 'DIV' }, { tagName: 'NEXT-ROUTE-ANNOUNCER' }]),
  } as unknown as Document;
  assert.equal(pistasDeHidratacion(doc, 'es-US'), 'font=0; traducida=no; lang=es; navegador=es-US; ajenas=');
});

test('las pistas pasan el saneo y llegan al ticket; lo que no parece una pista, no', () => {
  const base = { origen: 'navegador', nombre: 'Error', mensaje: 'Minified React error #418' };
  const pista = 'font=2; traducida=si; lang=es; navegador=de-DE; ajenas=';
  const r = sanearReporte({ ...base, pistas: pista })!;
  assert.equal(r.pistas, pista);
  assert.equal(ticketDeError(r).contexto.pistas, pista);
  assert.equal(sanearReporte({ ...base, pistas: 'Hola <b>Ana</b> ana@correo.com' })!.pistas, undefined);
});
