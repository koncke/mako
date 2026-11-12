// =============================================================================
// La caricatura por cola: alta → pendiente → el Runner la guarda → la tarjeta la usa (4/11/2026)
// =============================================================================
// Martín, 4/11 (por el Cerebro): «cada vez que se genere un nuevo competidor, hacer una especie de levantar un ticket
// para generar esa imagen y ya con eso se pone la imagen ahí». La genera el Runner con Canva; acá vive la cola.
//
// Corre la cadena REAL (lib/spy-caricatura-cola.ts, la que usan el servidor y los dos scripts) contra una base y un
// Storage en memoria: el registro de cada negocio con su versión (compare-and-set) y los archivos por ruta.
//   1. alta → pendiente, con SU foto de nuestro Storage; la lista sólo lleva ws, id y foto;
//   2. la misma persona en dos negocios se lista UNA vez, y al guardarla queda lista en los dos; el tamaño se LEE del
//      archivo (el conector de Canva entrega 200 × 200), cuadrada y de al menos 128;
//   3. la tarjeta usa la caricatura (y sin ella, la foto: sin cartel ni spinner);
//   4. un negocio nuevo que agrega a la misma persona la recibe en el acto, sin entrar a la cola;
//   5. un fallo no se reintenta en cadena (ni en el negocio del lado), y a los 3 queda rendida;
//   6. un referente o una foto que no es nuestra no entran; el registro del camino de antes no sobrevive;
//   7. el camino de antes (IA del negocio + Flow) no existe más, y la pantalla no pide nada;
//   8. una foto que no es una persona (un logo) sale de la cola con `--sin-persona`: no es un fallo, no se rinde, y
//      vuelve sólo si cambia la foto, aunque su URL siga igual.
//
// PROBADO ROMPIÉNDOLO (4/11/2026), una rotura por vez y restaurada, base en verde (qué tests caen):
//   · `estadoEnCola` sin exigir la foto en nuestro Storage                    → 1, 6
//   · `colaDeCaricaturas` que lista a cada competidor (sin agrupar por persona) → 2
//   · `guardarCaricatura` que marca sólo el competidor pedido                  → 2
//   · `guardarCaricatura` sin leer el tamaño (o `medidasDeImagen` del JPEG mal) → 2b
//   · `caraDeTarjeta` con la foto antes que la caricatura                      → 3
//   · `encolarCaricatura` sin buscar la ya hecha                               → 4
//   · `colaDeCaricaturas` sin esperar después de un fallo                      → 5
//   · `FALLOS_HASTA_RENDIRSE` en 99                                            → 5
//   · el primero de un grupo sin mirar quién ya falló                         → 5b
//   · `mirarCompetidor` sin encolar al leer                                    → 7
// Y la salida sin persona (12/11/2026), igual:
//   · `estadoEnCola` sin el estado `sin-persona`                              → 8
//   · `colaDeCaricaturas` que la manda a las rendidas                           → 8
//   · `marcarSinPersona` que conserva los fallos                                → 8
//   · `marcarSinPersona` que marca sólo el competidor pedido                    → 8
//   · `listarCola` sin comparar la huella (la foto cambió y la URL no)          → 8b
//   · `listarCola` que la devuelve a la cola si la foto no se pudo bajar       → 8b
//   · al Runner le llega la foto vieja, o se marca con ella                      → 8b
//   · el script sin la salida `--sin-persona`                                   → 8c
// Correr: node --import tsx --test tests/spy-caricatura-cola.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { anotarFallo, encolarCaricatura, guardarCaricatura, listarCola, marcarSinPersona, type DepsGuardar } from '../lib/spy-caricatura-cola';
import {
  CLAVE_CARICATURAS, ESPERA_TRAS_FALLO_MS, FALLOS_HASTA_RENDIRSE, caraDeTarjeta, caricaturaEnCamino, caricaturasListas, esperaMasVieja,
  leerRegistro, medidasDeImagen, refDeCuenta,
  type CompetidorCola,
} from '../lib/spy-caricatura-reglas';
import { rutaDeMiniatura } from '../lib/spy-miniaturas';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (r: string) => readFileSync(`${RAIZ}${r}`, 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const STORAGE = 'https://x.supabase.co/storage/v1/object/public/spy-miniaturas/';
const FOTO_DEN = `${STORAGE}spy/avatar/den_borgg.jpg`;
/** Una cabecera de PNG con su tamaño: lo único que miran `tipoDeImagen` y `medidasDeImagen`. */
const png = (ancho: number, alto: number) => {
  const b = new Uint8Array(33);
  b.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52]);
  new DataView(b.buffer).setUint32(16, ancho);
  new DataView(b.buffer).setUint32(20, alto);
  return b;
};
// Lo que entrega el conector de Canva por `get-assets`: una vista de 200 × 200 (el original mide 1264).
const PNG = png(200, 200);
const T0 = Date.parse('2026-11-04T12:00:00Z');

/** Una base en memoria: el registro de cada negocio (con su versión) y los archivos del Storage. */
function baseDeMentira(competidores: CompetidorCola[]) {
  const settings = new Map<number, { valor: string; version: number }>();
  const archivos = new Map<string, string>();
  const escrituras: number[] = [];
  const deps: DepsGuardar & { hecha: (refs: string[]) => Promise<string | null> } = {
    todos: async () => competidores.map((c) => ({ ...c })),
    leer: async (ws) => {
      const s = settings.get(ws);
      return { crudo: s?.valor ?? null, version: s ? String(s.version) : null };
    },
    cambiarSi: async (ws, version, nuevo) => {
      const s = settings.get(ws);
      if ((s ? String(s.version) : null) !== version) return false;
      settings.set(ws, { valor: nuevo, version: (s?.version ?? 0) + 1 });
      escrituras.push(ws);
      return true;
    },
    subir: async (ruta) => { const url = `${STORAGE}${ruta}`; archivos.set(ruta, url); return url; },
    // Lo mismo que `caricaturaGuardada` (lib/spy-miniaturas.ts): el archivo por su cuenta, con cualquier extensión.
    hecha: async (refs) => {
      for (const ref of refs) {
        const nombre = rutaDeMiniatura('caricatura', ref, 'x').replace(/x$/, '');
        const f = [...archivos.keys()].find((k) => k.startsWith(nombre));
        if (f) return `${archivos.get(f)}?v=1`;
      }
      return null;
    },
  };
  return { deps, settings, archivos, escrituras, registro: (ws: number) => leerRegistro(settings.get(ws)?.valor ?? null) };
}

const den = (ws: number, id: number, o: Partial<CompetidorCola> = {}): CompetidorCola =>
  ({ ws, id, instagram: 'den.borgg', youtube_id: null, tiktok: null, avatar: FOTO_DEN, referente: false, ...o });

test('1. alta → pendiente, con su foto de NUESTRO Storage; la lista lleva sólo ws, id y foto', async () => {
  const b = baseDeMentira([den(3, 17)]);
  assert.equal(await encolarCaricatura(b.deps, den(3, 17), T0), 'pendiente');
  assert.deepEqual(b.registro(3)['17'], { foto: FOTO_DEN, desde: new Date(T0).toISOString() });
  // Idempotente: leerlo otra vez no reescribe.
  assert.equal(await encolarCaricatura(b.deps, den(3, 17), T0 + 60_000), 'sin-cambio');
  assert.equal(b.escrituras.length, 1);
  const cola = await listarCola(b.deps, T0);
  assert.deepEqual(cola, { pendientes: [{ ws: 3, id: 17, foto: FOTO_DEN }], rendidas: [], sinPersona: [], masVieja: new Date(T0).toISOString() });
  assert.deepEqual(Object.keys(cola.pendientes[0]).sort(), ['foto', 'id', 'ws'], 'ni nombre, ni bio, ni nada de afuera');
});

test('2. la misma persona en dos negocios se lista UNA vez, y al guardarla queda lista en los dos', async () => {
  // El del ws 5 se agregó antes de la cola: sin entrada, cuenta como pendiente igual.
  const b = baseDeMentira([den(3, 17), den(5, 40, { instagram: '@Den.Borgg' }), den(5, 41, { instagram: 'otra.persona', avatar: `${STORAGE}spy/avatar/otra.jpg` })]);
  await encolarCaricatura(b.deps, den(3, 17), T0);
  const cola = await listarCola(b.deps, T0);
  assert.deepEqual(cola.pendientes.map((p) => `${p.ws}#${p.id}`), ['3#17', '5#41'], 'Den Borg una sola vez (el que entró primero)');

  const g = await guardarCaricatura(b.deps, 3, 17, PNG, T0);
  assert.ok(g.ok);
  if (!g.ok) return;
  assert.equal(g.url, `${STORAGE}${rutaDeMiniatura('caricatura', refDeCuenta('instagram:den.borgg'), 'png')}?v=${T0}`, 'por su cuenta, no por negocio');
  assert.deepEqual(g.marcadas.map((m) => `${m.ws}#${m.id}`).sort(), ['3#17', '5#40']);
  assert.deepEqual(b.registro(3)['17'], { url: g.url, lado: 200 }, 'lista, con su tamaño leído del archivo: sin foto ni fallos de la cola');
  assert.equal(b.registro(5)['40'].url, g.url);
  assert.equal(b.registro(5)['41'], undefined, 'otra persona no se toca');
  assert.deepEqual((await listarCola(b.deps, T0)).pendientes.map((p) => `${p.ws}#${p.id}`), ['5#41']);
  assert.deepEqual(await guardarCaricatura(b.deps, 3, 17, new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])), { ok: false, error: 'No es una imagen: tiene que ser JPG, PNG o WebP.' });
});

test('2b. el tamaño se LEE del archivo (Canva entrega 200 × 200, no 1264): cuadrada y no muy chica', async () => {
  const b = baseDeMentira([den(3, 17)]);
  assert.deepEqual(await guardarCaricatura(b.deps, 3, 17, png(1264, 900)), { ok: false, error: 'No es cuadrada (1264 × 900): la tarjeta es cuadrada.' });
  assert.deepEqual(await guardarCaricatura(b.deps, 3, 17, png(64, 64)), { ok: false, error: 'Es muy chica (64 × 64): hace falta al menos 128 × 128.' });
  assert.equal(b.archivos.size, 0, 'lo que no sirve no se sube');
  const g = await guardarCaricatura(b.deps, 3, 17, png(1264, 1264), T0);
  assert.ok(g.ok && g.lado === 1264);
  // Las tres cabeceras que se aceptan.
  assert.deepEqual(medidasDeImagen(png(200, 200)), { ancho: 200, alto: 200 });
  const jpg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0, 0xff, 0xc0, 0, 11, 8, 0, 200, 0, 201, 3, 0, 0, 0]);
  assert.deepEqual(medidasDeImagen(jpg), { ancho: 201, alto: 200 }, 'JPEG: alto y ancho del SOF, después de saltear el APP0');
  const webp = new Uint8Array(30);
  webp.set([...'RIFF'].map((c) => c.charCodeAt(0)), 0);
  webp.set([...'WEBPVP8X'].map((c) => c.charCodeAt(0)), 8);
  webp.set([199, 0, 0, 199, 0, 0], 24);
  assert.deepEqual(medidasDeImagen(webp), { ancho: 200, alto: 200 });
  assert.equal(medidasDeImagen(new Uint8Array([1, 2, 3])), null);
});

test('3. la tarjeta usa la caricatura que hizo el Runner; sin ella, su foto (sin cartel ni spinner)', async () => {
  const b = baseDeMentira([den(3, 17)]);
  await encolarCaricatura(b.deps, den(3, 17), T0);
  // Lo que hace `listarCompetidores` (lib/spy.ts) con el registro, y lo que dibuja la tarjeta (SpyApp).
  const antes = caricaturasListas(leerRegistro(b.settings.get(3)?.valor));
  assert.equal(caraDeTarjeta({ caricatura: antes.get(17) ?? null, avatar: FOTO_DEN }, null), FOTO_DEN);
  const g = await guardarCaricatura(b.deps, 3, 17, PNG, T0);
  assert.ok(g.ok);
  const despues = caricaturasListas(leerRegistro(b.settings.get(3)?.valor));
  assert.equal(caraDeTarjeta({ caricatura: despues.get(17) ?? null, avatar: FOTO_DEN }, null), g.ok ? g.url : '');
  assert.equal(caraDeTarjeta({ caricatura: null, avatar: null }, '/asesores/x.png'), '/asesores/x.png', 'un referente, su dibujo');
});

test('4. un negocio nuevo que agrega a la misma persona la recibe en el acto, sin entrar a la cola', async () => {
  const b = baseDeMentira([den(3, 17), den(7, 3, { instagram: 'DEN.BORGG' })]);
  await encolarCaricatura(b.deps, den(3, 17), T0);
  const g = await guardarCaricatura(b.deps, 3, 17, PNG, T0);
  assert.ok(g.ok);
  // El ws 7 no estaba cuando se guardó (su fila es nueva): al leerlo, se encuentra la ya hecha.
  b.settings.delete(7);
  assert.equal(await encolarCaricatura(b.deps, den(7, 3, { instagram: 'DEN.BORGG' }), T0 + 1), 'lista');
  assert.match(b.registro(7)['3'].url ?? '', /spy\/caricatura\/instagram-den_borgg\.png\?v=/);
  assert.deepEqual((await listarCola(b.deps, T0 + 1)).pendientes, []);
});

test('5. un fallo no se reintenta en cadena (tampoco por el negocio del lado), y a los 3 queda rendida', async () => {
  const b = baseDeMentira([den(3, 17), den(5, 40)]);
  await encolarCaricatura(b.deps, den(3, 17), T0);
  const f1 = await anotarFallo(b.deps, 3, 17, 'Canva no\ncontestó', T0);
  assert.deepEqual(f1, { ok: true, fallos: 1, rendida: false });
  assert.equal(b.registro(3)['17'].motivo, 'Canva no contestó');
  assert.deepEqual((await listarCola(b.deps, T0 + 60_000)).pendientes, [], 'ni el mismo, ni la misma persona en el ws 5');
  assert.deepEqual((await listarCola(b.deps, T0 + ESPERA_TRAS_FALLO_MS)).pendientes.map((p) => `${p.ws}#${p.id}`), ['3#17'], 'al otro día vuelve');
  await anotarFallo(b.deps, 3, 17, 'otra vez', T0 + ESPERA_TRAS_FALLO_MS);
  const f3 = await anotarFallo(b.deps, 3, 17, 'y otra', T0 + 2 * ESPERA_TRAS_FALLO_MS);
  assert.deepEqual(f3, { ok: true, fallos: FALLOS_HASTA_RENDIRSE, rendida: true });
  const cola = await listarCola(b.deps, T0 + 10 * ESPERA_TRAS_FALLO_MS);
  assert.deepEqual(cola.pendientes, [], 'rendida: ya no se intenta');
  assert.deepEqual(cola.rendidas, [{ ws: 3, id: 17, foto: FOTO_DEN, fallos: 3, motivo: 'y otra' }], 'a la vista del super admin');
  // Una caricatura que llega igual (el Runner la hizo a mano) la saca de las rendidas.
  assert.ok((await guardarCaricatura(b.deps, 3, 17, PNG, T0)).ok);
  assert.deepEqual(await listarCola(b.deps, T0 + 10 * ESPERA_TRAS_FALLO_MS), { pendientes: [], rendidas: [], sinPersona: [], masVieja: null });
});

test('5b. los fallos se juntan en UNO: la próxima vez se le pide al que ya falló, no al del negocio del lado', async () => {
  // El ws 5 entró a la cola después que el ws 3, pero el fallo quedó anotado en el ws 5: con «el que entró primero»
  // se le pediría al ws 3, que arranca en cero, y la misma persona tendría tres intentos por negocio.
  const b = baseDeMentira([den(3, 17), den(5, 40)]);
  await encolarCaricatura(b.deps, den(3, 17), T0);
  await encolarCaricatura(b.deps, den(5, 40), T0 + 1000);
  await anotarFallo(b.deps, 5, 40, 'Canva no contestó', T0);
  assert.deepEqual((await listarCola(b.deps, T0 + ESPERA_TRAS_FALLO_MS)).pendientes.map((p) => `${p.ws}#${p.id}`), ['5#40']);
});

test('6. un referente o una foto que no es nuestra no entran; el registro del camino de antes no sobrevive', async () => {
  const b = baseDeMentira([]);
  assert.equal(await encolarCaricatura(b.deps, den(3, 1, { referente: true }), T0), 'fuera');
  assert.equal(await encolarCaricatura(b.deps, den(3, 2, { avatar: 'https://scontent.cdninstagram.com/v/x.jpg' }), T0), 'fuera', 'la URL de Instagram vence');
  assert.equal(await encolarCaricatura(b.deps, den(3, 3, { avatar: null }), T0), 'fuera');
  assert.equal(b.escrituras.length, 0);
  // Lo que dejaba el camino de Flow (rasgos, trabajo, fallos sin foto) vuelve a entrar a la cola desde cero.
  const viejo = leerRegistro(JSON.stringify({ '9': { rasgos: 'short hair', trabajo: 51, fallos: 2 }, '10': { url: 'https://x/c.png', rasgos: 'x' } }));
  assert.deepEqual(viejo, { '10': { url: 'https://x/c.png' } });
  b.settings.set(3, { valor: JSON.stringify({ '9': { rasgos: 'short hair', trabajo: 51, fallos: 2 } }), version: 1 });
  assert.equal(await encolarCaricatura(b.deps, den(3, 9), T0), 'pendiente');
});

test('7. el camino de antes (IA del negocio + Flow) no existe, la pantalla no pide nada, y se encola al leer', () => {
  for (const f of ['lib/spy-caricatura-auto.ts', 'lib/spy-caricatura-flow.ts', 'app/api/competitor-spy/caricatura/route.ts']) {
    assert.ok(!existsSync(`${RAIZ}${f}`), `${f} era el camino de Flow: no dos caminos vivos`);
  }
  const app = sinComentarios(leer('app/competitor-spy/SpyApp.tsx'));
  // La pantalla no PIDE caricaturas (el camino de antes era POST /api/competitor-spy/caricatura). Desde el 4/11/2026 sí LEE las que
  // están en camino, por /api/competitor-spy/caricaturas, que sólo tiene GET (tests/spy-caricatura-en-vivo.test.ts).
  assert.doesNotMatch(app, /competitor-spy\/caricatura(?!s)/, 'la pantalla no pide caricaturas');
  assert.doesNotMatch(app, /Google Flow/);
  assert.match(app, /const cara = caraDeTarjeta\(c, caricaturaDeCompetidor\(c\)\);/);
  const spy = sinComentarios(leer('lib/spy.ts'));
  const mirar = spy.slice(spy.indexOf('export async function mirarCompetidor'), spy.indexOf('export async function', spy.indexOf('export async function mirarCompetidor') + 10));
  assert.ok(mirar.length > 500);
  assert.ok(mirar.indexOf("await db.from('spy_competidores').update(") < mirar.indexOf('await encolarAlLeer(wsDeLaLectura, c, cara)'), 'se encola con la foto ya guardada');
  const cola = sinComentarios(leer('lib/spy-caricatura-cola.ts'));
  assert.doesNotMatch(cola, /leerDocumentoIA|pedirCaricatura|flow_trabajos|'server-only'/, 'sin IA del negocio, sin Flow, y la pueden usar los scripts');
  const pend = sinComentarios(leer('scripts/spy-caricaturas-pendientes.mjs'));
  assert.match(pend, /listarCola\(depsDeLaBase\(\)\)/);
  assert.doesNotMatch(pend, /nombre|bio/, 'no imprime nada traído de afuera');
  const guardar = sinComentarios(leer('scripts/spy-caricatura-guardar.mjs'));
  assert.match(guardar, /guardarCaricatura\(deps, ws, id, bytes\)/);
  assert.match(guardar, /anotarFallo\(deps, ws, id, /);
  assert.equal(CLAVE_CARICATURAS, 'spy.caricaturas');
});

// Una caricatura que no carga (vencida, un permiso del bucket) cae a su foto de perfil: antes la tarjeta quedaba sin cara.
// Verificado rompiéndolo: con el `remove()` de antes este test cae.
test('una cara que no carga cae a su foto, y recién sin foto se saca', () => {
  const app = readFileSync(new URL('../app/competitor-spy/SpyApp.tsx', import.meta.url), 'utf8');
  assert.match(app, /const cara = caraDeTarjeta\(c, caricaturaDeCompetidor\(c\)\);/);
  assert.match(app, /<img key=\{cara\} src=\{cara\} alt="" loading="lazy" onError=\{\(e\) => \{ caerAFoto\(e\.currentTarget, c\.avatar\); \}\} \/>/);
  const fn = app.slice(app.indexOf('function caerAFoto('), app.indexOf('function RejillaCompetidores('));
  assert.ok(fn.indexOf('img.src = foto') > 0 && fn.indexOf('img.src = foto') < fn.indexOf('img.remove()'), 'primero la foto, después sacarla');
});

// ── 8. Una foto que no es una persona (12/11/2026) ──────────────────────────────────────────────────────────────────
// El caso real: el competidor 41 del ws 9, «Agencia Generación de Leads», cuya foto es un logo (un cuadrado con una letra
// en 3D). No hay cara que caricaturizar, y la única salida era anotar tres fallos en tres días.

const FOTO_LOGO = `${STORAGE}spy/avatar/bastidafarina.jpg`;
const logo = (ws: number, id: number, o: Partial<CompetidorCola> = {}): CompetidorCola =>
  ({ ws, id, instagram: 'bastidafarina', youtube_id: null, tiktok: null, avatar: FOTO_LOGO, referente: false, ...o });
/** La base de mentira, con la huella de cada foto: lo que daría bajarla. */
function conHuellas(competidores: CompetidorCola[], huellas: Map<string, string | null>) {
  const b = baseDeMentira(competidores);
  const deps = { ...b.deps, huella: async (url: string) => huellas.get(url) ?? null };
  return { ...b, deps };
}
const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);

test('8. un logo sale de la cola en el acto, con su foto, y NO es un fallo de Canva', async () => {
  const huellas = new Map([[FOTO_LOGO, H1]]);
  const b = conHuellas([logo(9, 41), logo(11, 7, { instagram: 'BastidaFarina' })], huellas);
  await encolarCaricatura(b.deps, logo(9, 41), T0);
  // Antes de saber que era un logo, el Runner llegó a anotar dos fallos.
  await anotarFallo(b.deps, 9, 41, 'no hay cara', T0);
  await anotarFallo(b.deps, 9, 41, 'no hay cara', T0 + ESPERA_TRAS_FALLO_MS);

  const r = await marcarSinPersona(b.deps, 9, 41, 'es un logo:\nuna letra en 3D', T0 + 2 * ESPERA_TRAS_FALLO_MS);
  assert.ok(r.ok);
  assert.deepEqual(r.ok ? r.marcadas.map((m) => `${m.ws}#${m.id}`).sort() : [], ['11#7', '9#41'], 'la misma cuenta en otro negocio es el mismo logo');
  assert.deepEqual(b.registro(9)['41'], {
    foto: FOTO_LOGO, desde: new Date(T0).toISOString(), sinPersona: 'es un logo: una letra en 3D',
    sinPersonaEn: new Date(T0 + 2 * ESPERA_TRAS_FALLO_MS).toISOString(), huella: H1,
  }, 'sin fallos, sin último fallo y sin motivo de Canva');

  // Ni pendiente, ni esperando, ni rendida: aparte, y para siempre mientras la foto sea la misma.
  for (const dias of [0, 1, 30]) {
    const cola = await listarCola(b.deps, T0 + (2 + dias) * ESPERA_TRAS_FALLO_MS);
    assert.deepEqual(cola, { pendientes: [], rendidas: [], sinPersona: [{ ws: 9, id: 41, foto: FOTO_LOGO, motivo: 'es un logo: una letra en 3D' }], masVieja: null });
  }
  // La tarjeta se queda con su foto: no dice «Haciendo…», y la cola no cuenta como frenada.
  const reg = leerRegistro(b.settings.get(9)?.valor);
  assert.equal(caricaturaEnCamino(reg['41'], { avatar: FOTO_LOGO, referente: false }, T0), false);
  assert.equal(esperaMasVieja(reg, [{ id: 41, avatar: FOTO_LOGO, referente: false }], T0 + 99 * ESPERA_TRAS_FALLO_MS), null);
  assert.equal(caraDeTarjeta({ caricatura: caricaturasListas(reg).get(41) ?? null, avatar: FOTO_LOGO }, null), FOTO_LOGO);
  // Leerlo otra vez no lo vuelve a encolar.
  assert.equal(await encolarCaricatura(b.deps, logo(9, 41), T0 + 5 * ESPERA_TRAS_FALLO_MS), 'sin-cambio');
});

test('8b. vuelve a la cola sólo si cambia la foto, aunque la URL sea la misma (y no por no poder bajarla)', async () => {
  const huellas = new Map<string, string | null>([[FOTO_LOGO, H1]]);
  const b = conHuellas([logo(9, 41)], huellas);
  await encolarCaricatura(b.deps, logo(9, 41), T0);
  assert.ok((await marcarSinPersona(b.deps, 9, 41, 'es un logo', T0)).ok);
  const escrituras = b.escrituras.length;

  // La foto no se pudo bajar: no se sabe si cambió, y no se mueve nada.
  huellas.set(FOTO_LOGO, null);
  assert.deepEqual((await listarCola(b.deps, T0)).pendientes, []);
  // La misma URL, otra imagen (la ruta es por su cuenta y se pisa): vuelve, para que el Runner decida de nuevo.
  huellas.set(FOTO_LOGO, H2);
  const cola = await listarCola(b.deps, T0);
  assert.deepEqual(cola.pendientes, [{ ws: 9, id: 41, foto: FOTO_LOGO }]);
  assert.deepEqual(cola.sinPersona, []);
  assert.equal(b.escrituras.length, escrituras, 'listar no escribe');
  // Otra URL también: sin bajar nada.
  const otra = `${STORAGE}spy/avatar/bastidafarina.png`;
  const sinHuella = baseDeMentira([logo(9, 41, { avatar: otra })]);
  sinHuella.settings.set(9, b.settings.get(9) as { valor: string; version: number });
  assert.deepEqual((await listarCola(sinHuella.deps, T0)).pendientes, [{ ws: 9, id: 41, foto: otra }]);
  // Si la nueva también es un logo, la decisión queda sobre la de AHORA: con la de la entrada volvería en el acto.
  assert.ok((await marcarSinPersona(sinHuella.deps, 9, 41, 'el logo nuevo también', T0 + 2)).ok);
  assert.equal(sinHuella.registro(9)['41'].foto, otra);
  assert.deepEqual((await listarCola(sinHuella.deps, T0 + 2)).pendientes, []);
  // Y si es un logo otra vez, sale con la huella nueva.
  assert.ok((await marcarSinPersona(b.deps, 9, 41, 'sigue siendo un logo', T0 + 1)).ok);
  assert.equal(b.registro(9)['41'].huella, H2);
  assert.deepEqual((await listarCola(b.deps, T0 + 1)).pendientes, []);
});

test('8c. lo que no está en la cola no se marca, y el script tiene la salida', async () => {
  const b = conHuellas([logo(9, 41), logo(9, 42, { instagram: 'otra', avatar: null }), den(3, 17)], new Map([[FOTO_LOGO, H1]]));
  assert.deepEqual(await marcarSinPersona(b.deps, 9, 99, 'x', T0), { ok: false, error: 'No existe el competidor 99 en el negocio 9.' });
  assert.deepEqual(await marcarSinPersona(b.deps, 9, 42, 'x', T0), { ok: false, error: 'No tiene su foto en nuestro Storage: no está en la cola.' });
  assert.ok((await guardarCaricatura(b.deps, 3, 17, PNG, T0)).ok);
  assert.deepEqual(await marcarSinPersona(b.deps, 3, 17, 'x', T0), { ok: false, error: 'Ya tiene su caricatura: no está en la cola.' });
  // Sin motivo, igual sale: el motivo es para el super admin.
  assert.ok((await marcarSinPersona(b.deps, 9, 41, '   ', T0)).ok);
  assert.equal(b.registro(9)['41'].sinPersona, 'Su foto no es una persona');

  const guardar = sinComentarios(leer('scripts/spy-caricatura-guardar.mjs'));
  assert.match(guardar, /if \(tercero === '--sin-persona'\) \{\n\s+const r = await marcarSinPersona\(deps, ws, id, resto\.join\(' '\)\);/);
  const base = sinComentarios(leer('scripts/spy-caricatura-base.mjs'));
  assert.match(base, /async huella\(url\) \{/, 'sin huella, una foto nueva con la misma URL no vuelve nunca');
  assert.match(leer('docs/relevo/nube-spy.md'), /spy-caricatura-guardar\.mjs <ws> <id> --sin-persona "<motivo>"/, 'el contrato del Runner');
});
