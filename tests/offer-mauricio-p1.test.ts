// =============================================================================
// Offer: lo que salió de la llamada con Mauricio del 22/10/2026 (P1, Fathom 195129619), con su conversación real
// =============================================================================
// Medido en la conversación del Sprint (ws1, offer_sesiones id 18, sólo lectura) y en el Saldo de IA de esa hora:
//   O5 (43:11) saluda en cada mensaje: las 25 respuestas empezaban con «Hola estimado Mauricio ! espero que estes muy bien !».
//   O4 (01:10:49) «¿es pago único?» dos veces: el precio («Pago único de $270 USD vía Stripe») y después el % al firmar.
//   O6 (44:45) tarda: mediana 6 s, pero 6 de 25 respuestas tardaron 66 a 124 s (la red de plataforma reintentaba
//      `gemini-flash-latest`, que salía cortado en 1.996 tokens, y un intento con las keys del negocio esperaba 60 s).
//   O7 (31:44) la landing con un antibots: 403 desde el servidor, y abre en el navegador.
//   O11 (01:49:30) el PDF «muy raro»: un aviso de «garantía incondicional en high ticket» en una entrada SIN garantía,
//      y «Lo que me gustó» repetía las notas de la misma página.
//   O12 (29:00) el selector abría adentro del funnel abierto: para ver «Sprint» había que volver dos niveles.
//   O13 (01:49:58) «¿cuál es el propósito?»: el mensaje del PDF no decía para qué sirve.
//
// ⚠️ PROBADO ROMPIENDO LO QUE PERSIGUE (22/10/2026, arnés romper-p1.mjs en el scratchpad de la sesión: rompe UNA cosa,
// corre este archivo y restaura). La base en verde (12 de 12); 24 roturas, las 24 cazadas; los números, al lado de cada test.
//   O8 (33:06) el .zip de la landing: «porque es una carpeta, creo que no se puede»; sólo entraba el index.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PiezasSabidas } from '../lib/offer-marco';
import { loQueMeGusto, type ConclusionOferta } from '../lib/offer-marco';
import {
  PARA_QUE_SIRVE, avisosAntesDelDiagnostico, conCobroDelPrecio, esPagoUnico, mensajePdf, parseTurno, respuestaSinIA, sinSaludo,
  textoDelLectorExterno,
} from '../lib/offer-reglas';

const AT = '2026-10-22T04:20:50.378Z';
const chat = (valor: string) => ({ valor, fuente: 'chat' as const, at: AT });
const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');
/** El cuerpo de una función de un fuente (hasta la primera llave que cierra en la columna 0; el repo es CRLF). */
const funcion = (src: string, nombre: string) => {
  const t = src.replace(/\r\n/g, '\n');
  const i = t.search(new RegExp(`(?:async )?function ${nombre}\\b`));
  return i < 0 ? '' : t.slice(i, t.indexOf('\n}\n', i) + 2);
};

// ── O5 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// rotura (parseTurno sin sinSaludo): 1 fallo. rotura (sin el «espero que estés bien»): 1 fallo. rotura (sin la despedida): 1 fallo.
test('O5 · el turno no saluda ni se despide (los textos reales de la conversación de Mauricio)', () => {
  const t = parseTurno(JSON.stringify({
    respuesta: 'Hola estimado Mauricio ! espero que estes muy bien !\n\nTomé nota de los más de 30 clientes que han logrado establecer su sistema de ejecución, estimado. ¿Cuánto dinero en promedio gana o ahorra en un año una empresa de 1 a 3 millones?',
    opciones: [], piezas: {}, listo: false, diagnostico: null, diagnostico_respuesta: null,
  }));
  assert.match(t?.respuesta ?? '', /^Tomé nota de los más de 30 clientes/);
  assert.equal(sinSaludo('Hola estimado Mauricio !  Espléndido, estimado, hemos consolidado todas las piezas. Cuando estés listo, toca «Armar mi oferta». Bendiciones.'),
    'Espléndido, estimado, hemos consolidado todas las piezas. Cuando estés listo, toca «Armar mi oferta».');
  assert.equal(sinSaludo('Hola Mauricio, ¿cuánto cobras?'), '¿cuánto cobras?');
  // Lo que no es un saludo, queda.
  assert.equal(sinSaludo('¿Holanda o México? ¿Dónde venden?'), '¿Holanda o México? ¿Dónde venden?');
  assert.equal(sinSaludo('Me dijiste «hola, soy Ana» en tu guion. ¿Lo usas en el anuncio?'), 'Me dijiste «hola, soy Ana» en tu guion. ¿Lo usas en el anuncio?');
});

// rotura (sin la regla del prompt): 1 fallo.
test('O5 · los prompts del turno y del arranque piden no saludar', () => {
  const ia = leer('lib/offer-ia.ts');
  assert.match(ia, /19\. No saludes ni te despidas: ya están conversando\./);
  assert.match(ia, /10\. No saludes ni te despidas en tus mensajes: ya están conversando\./);
});

// ── O4 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// rotura (conCobroDelPrecio no anota): 1 fallo. rotura (la ruta no lo llama): 1 fallo.
test('O4 · con «Pago único de $270 USD vía Stripe», el cobro al firmar ya se sabe y no se vuelve a preguntar', () => {
  const piezas: PiezasSabidas = { precio: chat('Pago único de $270 USD vía Stripe') };
  assert.equal(esPagoUnico(piezas.precio?.valor), true);
  assert.match(conCobroDelPrecio(piezas, AT).cobro?.valor ?? '', /^100% al inscribirse: es un pago único/);
  // Lo que ya tenía dato no se toca, y un precio en cuotas no deduce nada.
  const ya: PiezasSabidas = { ...piezas, cobro: chat('50% al firmar y 50% al mes') };
  assert.equal(conCobroDelPrecio(ya, AT), ya);
  assert.equal(conCobroDelPrecio({ precio: chat('2.000 USD en 3 cuotas') }, AT).cobro, undefined);
  // Desde la prueba de los chats (22/10/2026) las piezas del turno se funden con `fundirPiezasDelTurno` (cada una con su fuente).
  assert.match(funcion(leer('app/api/offer/route.ts'), 'responder'), /const fundidas = conCobroDelPrecio\(conLoQueDijoElDueno\(\s*turnoIA \? fundirPiezasDelTurno\(/);
});

// rotura (el aviso del % al firmar también con pago único): 1 fallo.
test('O4 · con un pago único, «te pagan el 100% al firmar… súbelo» no sale (no había cuotas que rechazar)', () => {
  const avisos = (precio: string) => avisosAntesDelDiagnostico({
    foco: { productosActivos: 0, ofertasActivas: 0, bandaFacturacion: null },
    piezas: { precio: chat(precio), cobro: chat('100% de pago único al inscribirse vía Stripe') },
  }).otras;
  assert.ok(!avisos('Pago único de $270 USD vía Stripe').some((a) => a.startsWith('Te pagan el 100%')));
  assert.ok(avisos('3.000 USD, o 3 cuotas de 1.100').some((a) => a.startsWith('Te pagan el 100%')), 'con cuotas, sigue');
});

// ── O6 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// rotura (la red sin el modelo del turno): 1 fallo. rotura (el turno vuelve a 60 s por intento): 1 fallo.
test('O6 · el turno: en la red de plataforma va directo a flash-lite, y cada intento corta a los 30 s', () => {
  const ia = leer('lib/offer-ia.ts');
  assert.match(ia, /export const MODELO_TURNO_RED = 'gemini-flash-lite-latest';/);
  assert.match(ia, /provider: r\.provider, clave: r\.clave, wsKey: superWs as number, model: p\.modelosRed\?\.\[r\.provider\],/);
  const turno = funcion(ia, 'turnoOffer');
  assert.match(turno, /maxTokens: 2_000, timeoutMs: 30_000, esfuerzo: 'low',/);
  assert.match(turno, /modelosRed: \{ gemini: MODELO_TURNO_RED \},/);
});

// ── O7 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

const JINA_SPRINT = `Title: Sprint de Diseño para la Ejecución Empresarial · Mauricio Bustos

URL Source: https://sprint.mauriciobustos.com/

Markdown Content:
**SPRINT EN VIVO**24, 25 Y 26 DE NOVIEMBRE · 7:00 P. M. CDMX**CUPOS LIMITADOS**

## Deja de perseguir empleados. Haz que tu equipo te reporte resultados.

Aprende a establecer objetivos claros, impulsar la ejecución y lograr que tu equipo rinda cuentas cada semana, sin estar detrás de todos.

[**RESERVA TU CUPO · $270 USD**Cupos limitados](https://buy.stripe.com/x)`;

// rotura (textoDelLectorExterno sin el tope de largo): 1 fallo. rotura (sin el filtro del desafío antibots): 1 fallo.
test('O7 · lo que trae el lector de afuera: título, URL y texto; un desafío de antibots o una página vacía no sirven', () => {
  const l = textoDelLectorExterno(JINA_SPRINT);
  assert.equal(l?.titulo, 'Sprint de Diseño para la Ejecución Empresarial · Mauricio Bustos');
  assert.equal(l?.url, 'https://sprint.mauriciobustos.com/');
  assert.match(l?.texto ?? '', /^\*\*SPRINT EN VIVO\*\*24, 25 Y 26 DE NOVIEMBRE/);
  assert.equal(textoDelLectorExterno('Title: x\n\nMarkdown Content:\nhola'), null);
  assert.equal(textoDelLectorExterno(`Title: Just a moment...\n\nMarkdown Content:\n${'Checking your browser before accessing. '.repeat(10)}`), null);
});

// rotura (leerLink sin el respaldo al bloquear): 1 fallo. rotura (sin el respaldo de la página sin texto): 1 fallo.
test('O7 · leerLink: después de landing-fetch, y sólo si bloquea o casi no hay texto, el lector de afuera; nunca un fetch en la ruta', () => {
  const ruta = leer('app/api/offer/route.ts');
  const link = funcion(ruta, 'leerLink');
  assert.match(link, /const otra = bloqueaLaLectura\(e\) \? await leerConLectorExterno\(link\.leida\) : null;/);
  // Con la guarda de OF2 primero: un link con un acceso no sale (tests/offer-lector-credenciales.test.ts).
  assert.match(link, /if \(pagina\.bloqueada \|\| !pagina\.texto\.trim\(\)\) \{\s*if \(credencialEnLaUrl\(link\.leida\)\) return no\(422, PIDE_ACCESO\);\s*const otra = await leerConLectorExterno\(link\.leida\);/);
  assert.ok(link.indexOf('extraerLanding(') < link.indexOf('leerConLectorExterno('), 'primero la descarga SSRF-segura');
  assert.doesNotMatch(ruta, /\bfetch\(/);
  assert.match(leer('lib/offer-lector-externo.ts'), /const LECTOR_EXTERNO = 'https:\/\/r\.jina\.ai\/';/);
});

// ── O11 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// rotura (loQueMeGusto vuelve a sumar las notas altas): 1 fallo.
test('O11 · «Lo que me gustó» no repite las notas que el PDF lista arriba', () => {
  const c = {
    diagnostico: {
      tesis: '', fuerte: '', fuertes: ['«Tres sesiones en vivo de dos horas cada una»'], cambios: [],
      dimensiones: [{ id: 'D5', nota: 7, porque: 'La ruta está muy clara en 3 fases.', mejora: '' }],
    },
    calculo: { controlFinal: [{ ok: true, punto: 'entregables', porque: 'Los entregables son concretos.' }] },
  } as unknown as Pick<ConclusionOferta, 'diagnostico' | 'calculo'>;
  assert.deepEqual(loQueMeGusto(c), ['«Tres sesiones en vivo de dos horas cada una»', 'Los entregables son concretos.']);
});

// rotura (la garantía negada cuenta como incondicional): 1 fallo. rotura (la regla también en una entrada): 1 fallo.
test('O11 · «ni garantía incondicional» no dispara el aviso de high ticket, y en una entrada la regla no aplica', () => {
  const pr = leer('lib/offer-reglas.ts');
  const i = pr.indexOf('// La garantía nunca incondicional en high ticket');
  const bloque = pr.slice(i, pr.indexOf('avisos.push(', i));
  assert.match(bloque, /\.replace\(\/\\b\(\?:ni\|no\|sin\|nunca\)\\b/);
  assert.match(bloque, /if \(nivelDeOferta\(piezas\)\?\.nivel !== 'bajo' && /);
});

// ── O13 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// rotura (el mensaje del PDF sin el para qué): 1 fallo. rotura (el de «Así está bien» sin el para qué): 1 fallo.
test('O13 · el PDF y «Así está bien» dicen para qué sirve: MaKo la usa para prospectar', () => {
  assert.match(PARA_QUE_SIRVE, /MaKo usa esta oferta como contexto para prospectar/);
  const m = mensajePdf({ version: 1, dimensiones: [], cuello: 'D1', lista: false, id: 'x', at: AT });
  assert.ok(m.texto.includes(PARA_QUE_SIRVE), m.texto);
  const r = respuestaSinIA([{ de: 'mako', pdf: { version: 1 } }], 'Así está bien', { id: 'y', at: AT });
  assert.ok(r?.texto.includes(PARA_QUE_SIRVE), r?.texto);
});

// ── O12 ─────────────────────────────────────────────────────────────────────────────────────────────────────────

// rotura (el selector sin abrirEnLaRaiz): 1 fallo. rotura (el Dropdown ignora la prop): 1 fallo.
test('O12 · el selector de Offer abre en la raíz (los funnels a la vista), y el Dropdown de la casa sigue igual por defecto', () => {
  assert.match(leer('app/offer/SelectorFunnel.tsx'), /variante="principal"\s+abrirEnLaRaiz/);
  const dd = leer('app/components/Dropdown.tsx');
  assert.match(dd, /abrirEnLaRaiz = false,/);
  assert.match(dd, /const camino = abrirEnLaRaiz \? null : caminoDe\(secciones, elegido\);/);
});

// ── O8 ──────────────────────────────────────────────────────────────────────────────────────────────────────────

// rotura (las páginas sin el extractor de copy: va el HTML crudo): 1 fallo. rotura (sin saltear la basura de macOS): 1 fallo.
// rotura (la ruta no abre el .zip): 1 fallo. rotura (la pantalla rechaza el .zip): 1 fallo.
test('O8 · el .zip de la landing: lee las páginas (el index primero) y los textos, saltea el resto, y dice qué leyó', async () => {
  const JSZip = (await import('jszip')).default;
  const z = new JSZip();
  const pagina = (t: string, cuerpo: string) => `<html><head><title>${t}</title><style>.x{color:red}</style><script>var a=1</script></head><body><h1>${cuerpo}</h1><p>${'Aprende a dirigir a tu equipo. '.repeat(5)}</p></body></html>`;
  z.file('sprint/gracias.html', pagina('Gracias', 'Gracias por inscribirte'));
  z.file('sprint/index.html', pagina('Sprint de Diseño para la Ejecución Empresarial', 'Deja de perseguir empleados'));
  z.file('sprint/estilos.css', 'body{margin:0}');
  z.file('sprint/favicon.ico', new Uint8Array([0, 0, 1, 0]));
  z.file('sprint/Guion VSL.pdf', new Uint8Array([37, 80, 68, 70]));
  z.file('__MACOSX/sprint/._index.html', 'basura');
  const bytes = await z.generateAsync({ type: 'uint8array' });
  const { textoDeZip } = await import('../lib/offer-zip');
  const l = await textoDeZip(bytes);
  assert.ok(l);
  assert.deepEqual(l.leidos, ['sprint/index.html', 'sprint/gracias.html']);
  assert.match(l.texto, /^=== sprint\/index\.html ===\n# Sprint de Diseño para la Ejecución Empresarial/);
  assert.match(l.texto, /Deja de perseguir empleados/);
  assert.doesNotMatch(l.texto, /<h1>|var a=1|color:red|basura/);
  assert.equal(l.aviso, 'Del .zip leí index.html y gracias.html; un documento (Guion VSL.pdf) no los abro desde un .zip: súbelos sueltos; salteé 2 archivos que no son texto (imágenes, estilos, código).');
  assert.equal(await textoDeZip(new Uint8Array([1, 2, 3])), null);
  const ruta = leer('app/api/offer/route.ts');
  assert.match(funcion(ruta, 'leer'), /const zip = esZip\(nombre, file\.type\) \? await textoDeZip\(contenido\) : null;/);
  assert.match(leer('app/offer/OfferApp.tsx'), /puedeLeerse\(f\.name, f\.type\) \|\| ZIP\.test\(f\.name\)/);
});
