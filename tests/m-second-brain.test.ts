// =============================================================================
// MaKo Mobile — el Second Brain del teléfono (app/m/second-brain) y lo que comparte con escritorio
// =============================================================================
// Fija lo que se rompe sin un solo error:
//   · los rótulos son los de escritorio (cada uno, buscado en SU archivo): uno escrito dos veces se desvía;
//   · el conteo de un área es el de la columna «Tu negocio» del mapa (sin la estructura ni lo pendiente),
//     y las reglas mudadas a lib/cerebro-areas.ts y lib/archivero-subida.ts son las que USA escritorio
//     (Grafo.tsx y Archivero.tsx las importan: una copia allá se desviaría sin error);
//   · la búsqueda: «Solo el nombre» y «Todo», sin la raíz ni las carpetas, del más conectado al menos; lo de
//     MaKo en SU orden y sin ids inventados;
//   · el mapa chico entra entero en su caja, con lo pendiente apagado;
//   · subir al Archivero son los tres pasos de escritorio, con `finalizar` donde va;
//   · la pantalla: sin `?ws=`, clases con el nombre entero de la carpeta, tokens e íconos que existen, sin voseo.
//
// Verificado ROMPIÉNDOLO (15/10/2026), cada rotura contra la base en verde (11 / 0) y restaurando después:
//   · `contarPorArea` contando lo pendiente (sin `|| n.autoria === 'pendiente'`): 10 / 1.
//   · ROTULOS_ESCRITORIO.buscar = 'Buscar algo': 10 / 1.
//   · `buscarNodos` sin el `.sort` por grado: 10 / 1 (antes de sumar el caso «oferta» en Todo pasaba: el
//     orden de la lista ya coincidía con el del grado).
//   · `miniMapa` con el margen restado una sola vez (k = (ancho - margen) / bw): 10 / 1 (con sólo «adentro
//     de la caja» pasaba: hace falta mirar el margen).
//   · `subirAlArchivero` con `finalizar: true` fijo en el cuerpo: 10 / 1.
//   · una clase `.sb-punto` sin prefijo en second-brain.css: 10 / 1.
//   · `<Icon name="buscar" …>` (inventado) en SecondBrainM.tsx: 10 / 1.
// Y al pasar escritorio a las reglas de lib (16/10/2026, la integración de la tanda 2; base 11 / 0):
//   · Grafo.tsx con su `porArea` escrito a mano otra vez: 10 / 1.
//   · Grafo.tsx con la ruta de la vista previa escrita otra vez (sin rutaVistaDocumento): 10 / 1.
//   · Archivero.tsx con un fetch propio a /upload-url en `analizar`: 10 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { AristaCerebro, Cerebro, NodoCerebro } from '../lib/cerebro-modelo';
import { contarPorArea, gradosDe, rellenoNodo, rutaVistaDocumento, sePuedeVerDocumento } from '../lib/cerebro-areas';
import {
  ACEPTA_ARCHIVERO, leerWebEnArchivero, leido, normalizarUrlArchivero, rotuloAnalizar, subirAlArchivero,
} from '../lib/archivero-subida';
import {
  ROTULOS_ESCRITORIO, areaDeParam, buscarNodos, carpetaDeArea, carpetas, conexionesDe, datosConValor, datosDelArea,
  deDondeSalio, elegidosPorMako, esCorto, miniMapa, pesoArchivo, primeraLinea, totalBuscable,
} from '../app/m/second-brain/modelo';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const CARPETA = 'app/m/second-brain';
/** Sin comentarios: un «var(--token)» de ejemplo en la cabecera no es un uso. */
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const ARCHIVOS = readdirSync(join(RAIZ, CARPETA)).filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => `${CARPETA}/${f}`);

// ── Un cerebro chico, a mano ──────────────────────────────────────────────────
const nodo = (id: string, area: NodoCerebro['area'], etiqueta: string, extra: Partial<NodoCerebro> = {}): NodoCerebro => ({
  id, area, etiqueta, detalle: '', fuente: '', autoria: 'usuario', ...extra,
});
const NODOS: NodoCerebro[] = [
  nodo('raiz', 'norte', 'Estudio Prueba'),
  nodo('n1:oferta', 'oferta', 'Oferta', { autoria: 'mako' }),
  nodo('area:oferta', 'oferta', 'La oferta', { autoria: 'mako' }),
  nodo('of1', 'oferta', 'Programa Escala', { detalle: 'Mentoría de 12 semanas\nCon llamadas', datos: [{ k: 'Precio', v: '$1.500' }, { k: 'Garantía', v: '' }, { k: 'Para quién', v: 'Dueños de agencias chicas que todavía venden solos' }] }),
  nodo('of2', 'oferta', 'Garantía de 90 días', { autoria: 'mako', fuente: 'Brief.pdf' }),
  nodo('of3', 'oferta', 'Bono', { autoria: 'pendiente' }),
  nodo('pr1', 'productos', 'Curso grabado', { autoria: 'mako' }),
  nodo('falta:avatares', 'avatares', 'Avatares', { autoria: 'pendiente' }),
  nodo('doc:abc', 'documentos', 'Brief.pdf', { autoria: 'mako', mime: 'application/pdf', destacado: true }),
];
const ARISTAS: AristaCerebro[] = [
  { de: 'raiz', a: 'of1', motivo: 'Lo que vendes' },
  { de: 'of1', a: 'of2', motivo: 'Su garantía' },
  { de: 'of1', a: 'area:oferta', motivo: 'Esto es parte de La oferta' },
  { de: 'of2', a: 'area:oferta', motivo: 'Esto es parte de La oferta' },
  { de: 'of1', a: 'pr1', motivo: 'Se vende como' },
  { de: 'n1:oferta', a: 'area:oferta', motivo: '' },
  { de: 'of1', a: 'n1:oferta', motivo: '' },
];
const POS: Cerebro['posiciones'] = {
  raiz: { x: 0, y: 0 }, 'n1:oferta': { x: 300, y: -40 }, 'area:oferta': { x: 420, y: 10 }, of1: { x: 520, y: 90 },
  of2: { x: 610, y: -60 }, of3: { x: 700, y: 30 }, pr1: { x: 380, y: 260 }, 'falta:avatares': { x: -200, y: 140 },
  'doc:abc': { x: -120, y: -180 },
};
const CEREBRO: Cerebro = {
  negocio: 'Estudio Prueba', nodos: NODOS, aristas: ARISTAS, posiciones: POS, encuadre: { x: -300, y: -300, lado: 1100 },
  cuenta: { total: 6, mako: 4, usuario: 2, pendientes: 2 }, vacias: ['avatares'],
};

test('los rótulos son los de escritorio: cada uno está en su archivo', () => {
  const faltan: string[] = [];
  for (const [k, { t, en }] of Object.entries(ROTULOS_ESCRITORIO)) if (!leer(en).includes(t)) faltan.push(`${k}: «${t}» no está en ${en}`);
  assert.deepEqual(faltan, []);
});

test('el conteo de un área: sin la raíz, las carpetas, la caja del área ni lo pendiente (la regla del mapa)', () => {
  assert.deepEqual(contarPorArea(NODOS), { oferta: 2, productos: 1, documentos: 1 });
  // El mapa de escritorio cuenta con LAS MISMAS (Grafo.tsx las importa; hasta el 15/10 tenía su copia).
  const grafo = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  assert.match(grafo, /const porArea = useMemo\(\(\) => contarPorArea\(nodos\), \[nodos\]\);/, 'Grafo.tsx volvió a contar por su cuenta');
  assert.match(grafo, /const grados = useMemo\(\(\) => gradosDe\(nodos, aristas\), \[nodos, aristas\]\);/, 'Grafo.tsx volvió a contar los grados por su cuenta');
  assert.deepEqual(gradosDe(NODOS, ARISTAS).of1, 5);
});

test('el color y el documento: lo mismo que el mapa de escritorio', () => {
  assert.equal(rellenoNodo(NODOS[0]), 'var(--ink)');
  assert.equal(rellenoNodo({ ...NODOS[3], alerta: true }), 'var(--warn-fill)');
  assert.equal(rellenoNodo(NODOS[8]), 'var(--mako)');
  assert.equal(rellenoNodo(NODOS[6]), 'var(--grafo-productos)');
  // Escritorio pinta y abre con LAS MISMAS (Grafo.tsx las importa de lib/cerebro-areas.ts).
  const grafo = sinComentarios(leer('app/second-brain/Grafo.tsx'));
  assert.match(grafo, /import \{[^}]*\brellenoNodo\b[^}]*\brutaVistaDocumento\b[^}]*\bsePuedeVerDocumento\b[^}]*\} from '@\/lib\/cerebro-areas';/);
  assert.match(grafo, /const rellenoDe = \(n: NodoCerebro\): string => rellenoNodo\(n\);/, 'Grafo.tsx volvió a tener su regla de color');
  assert.match(grafo, /conWs\(rutaVistaDocumento\(idNodo\), wsDeBusqueda\(/, 'la vista previa de Grafo.tsx dejó de salir de rutaVistaDocumento con el ?ws= de la pestaña');
  // (La de BAJAR, sin `preview=1`, sigue escrita en el botón «Descargar»: es otra ruta y no se mira acá.)
  assert.doesNotMatch(grafo, /archivero\/download\?id=[^`'"\n]*preview=1/, 'Grafo.tsx volvió a escribir la ruta de la vista previa');
  assert.equal(rutaVistaDocumento('doc:a b'), '/api/onboarding/archivero/download?id=a%20b&preview=1');
  assert.equal(sePuedeVerDocumento('application/pdf'), true);
  assert.equal(sePuedeVerDocumento('image/png'), true);
  assert.equal(sePuedeVerDocumento('application/vnd.openxmlformats-officedocument.wordprocessingml.document'), false);
});

test('Tu negocio: las cinco carpetas de escritorio, en su orden, con sus áreas', () => {
  const cs = carpetas();
  assert.deepEqual(cs.map((c) => c.nombre), ['Negocio', 'Oferta', 'Mercado', 'Mensaje', 'Funnel']);
  assert.deepEqual(cs[1].areas.map((a) => a.nombre), ['La oferta', 'Productos', 'Lead Magnet']);
  assert.equal(carpetaDeArea('avatares'), 'Mercado');
  assert.equal(areaDeParam('oferta'), 'oferta');
  assert.equal(areaDeParam(['razones', 'x']), 'razones');
  assert.equal(areaDeParam('inventada'), null);
  assert.equal(areaDeParam(undefined), null);
});

test('un área abierta: sus datos del más conectado al menos, después lo que falta; nunca su caja ni su «falta:»', () => {
  const { reales, pendientes } = datosDelArea(CEREBRO, 'oferta');
  assert.deepEqual(reales.map((n) => n.id), ['of1', 'of2']);
  assert.deepEqual(pendientes.map((n) => n.id), ['of3']);
  const av = datosDelArea(CEREBRO, 'avatares');
  assert.deepEqual([av.reales.length, av.pendientes.length], [0, 0]);
});

test('la búsqueda: «Solo el nombre» y «Todo», sin la raíz ni las carpetas, del más conectado al menos', () => {
  assert.deepEqual(buscarNodos(CEREBRO, 'garantia', 'nombre').map((n) => n.id), ['of2']);
  assert.deepEqual(buscarNodos(CEREBRO, 'garantia', 'todo').map((n) => n.id), ['of1', 'of2']);
  assert.deepEqual(buscarNodos(CEREBRO, 'oferta', 'nombre').map((n) => n.id), ['area:oferta']);
  // En «Todo» el área cuenta («La oferta»): salen las cuatro, y el orden es el del grado, no el de la lista.
  assert.deepEqual(buscarNodos(CEREBRO, 'oferta', 'todo').map((n) => n.id), ['of1', 'area:oferta', 'of2', 'of3']);
  assert.deepEqual(buscarNodos(CEREBRO, 'estudio', 'todo'), []);
  assert.deepEqual(buscarNodos(CEREBRO, '   ', 'todo'), []);
  assert.equal(totalBuscable(CEREBRO), NODOS.length - 2);
  assert.deepEqual(elegidosPorMako(CEREBRO, ['pr1', 'inventado', 'of1', 'pr1', 'raiz']).map((n) => n.id), ['pr1', 'of1']);
});

test('el dato abierto: pares con valor, corto al lado y largo abajo, de dónde salió y sus conexiones', () => {
  const of1 = NODOS[3];
  assert.deepEqual(datosConValor(of1).map((d) => d.k), ['Precio', 'Para quién']);
  assert.equal(esCorto('$1.500'), true);
  assert.equal(esCorto('Dueños de agencias chicas que todavía venden solos'), false);
  assert.equal(esCorto('a\nb'), false);
  assert.equal(primeraLinea(of1.detalle), 'Mentoría de 12 semanas');
  assert.equal(deDondeSalio(NODOS[4]), 'Brief.pdf · lo dedujo MaKo');
  assert.equal(deDondeSalio(NODOS[3]), 'lo escribiste tú');
  // Sin la raíz ni la carpeta madre; la caja del área sí (abre su lista).
  assert.deepEqual(conexionesDe(CEREBRO, 'of1').map((c) => c.nodo.id), ['of2', 'area:oferta', 'pr1']);
  assert.equal(pesoArchivo(840 * 1024), '840 KB');
  assert.equal(pesoArchivo(2.5 * 1024 * 1024), '2,5 MB');
});

test('el mapa chico: las posiciones del server, enteras adentro de la caja, lo pendiente apagado', () => {
  const W = 340, H = 170;
  const { puntos, lineas } = miniMapa(CEREBRO, W, H);
  assert.equal(puntos.length, NODOS.length);
  assert.equal(lineas.length, ARISTAS.length);
  // Con su margen de 14 (± el redondeo a décimas), y tocándolo de algún lado: la foto llena la caja.
  const M = 14 - 0.25;
  for (const p of puntos) {
    assert.ok(p.x - p.r >= M && p.x + p.r <= W - M && p.y - p.r >= M && p.y + p.r <= H - M, `${p.id} se sale: ${JSON.stringify(p)}`);
  }
  const holgura = Math.min(...puntos.map((p) => Math.min(p.x - p.r, W - p.x - p.r, p.y - p.r, H - p.y - p.r)));
  assert.ok(holgura < 14 + 0.25, `la foto no llena la caja (holgura ${holgura})`);
  assert.equal(puntos.find((p) => p.id === 'of3')!.opacidad, 0.5);
  assert.equal(puntos.find((p) => p.id === 'of1')!.opacidad, 1);
  assert.deepEqual(miniMapa({ ...CEREBRO, posiciones: {} }, W, H), { puntos: [], lineas: [] });
});

test('el Archivero: lo mismo que acepta y dice escritorio', () => {
  // Escritorio acepta, sube y rotula con LO MISMO (Archivero.tsx lo importa de lib/archivero-subida.ts).
  const arch = sinComentarios(leer('app/onboarding/Archivero.tsx'));
  assert.match(arch, /import \{[^}]*\bACEPTA_ARCHIVERO\b[^}]*\} from '@\/lib\/archivero-subida';/);
  assert.ok(arch.includes('const ACCEPT = ACEPTA_ARCHIVERO;'), 'Archivero.tsx acepta otra cosa');
  assert.ok(arch.includes('const labelAnalizar = rotuloAnalizar(cola.length, links.length);'), 'el rótulo de Analizar se escribe aparte en Archivero.tsx');
  assert.ok(arch.includes('await subirAlArchivero(c.file, finalizar)') && arch.includes('await leerWebEnArchivero(links[i], finalizar)'), 'Archivero.tsx sube por otro camino');
  assert.doesNotMatch(arch, /archivero\/upload-url/, 'Archivero.tsx volvió a tener su copia de la subida');
  assert.deepEqual([rotuloAnalizar(1, 0), rotuloAnalizar(3, 0), rotuloAnalizar(0, 1), rotuloAnalizar(0, 2), rotuloAnalizar(2, 1)], ['1 documento', '3 documentos', '1 web', '2 webs', '3 cosas']);
  assert.equal(normalizarUrlArchivero('tunegocio.com'), 'https://tunegocio.com/');
  assert.equal(normalizarUrlArchivero('  http://a.co/x '), 'http://a.co/x');
  assert.equal(normalizarUrlArchivero('localhost'), null);
  assert.equal(normalizarUrlArchivero('ftp://a.co'), null);
  assert.equal(normalizarUrlArchivero(''), null);
});

test('subir al Archivero: URL firmada → el binario a storage → procesar, con `finalizar` donde va', async () => {
  const llamadas: Array<{ url: string; metodo: string; cuerpo: unknown }> = [];
  const respuesta = (status: number, j: unknown) => new Response(JSON.stringify(j), { status, headers: { 'Content-Type': 'application/json' } });
  const falso = (procesar: () => Response) => (async (url: string | URL | Request, init?: RequestInit) => {
    const u = String(url);
    llamadas.push({ url: u, metodo: init?.method ?? 'GET', cuerpo: typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body });
    if (u.endsWith('/upload-url')) return respuesta(200, { ok: true, fileId: 'f1', path: '9/f1', signedUrl: 'https://storage.test/firmada' });
    if (u.startsWith('https://storage.test')) return new Response(null, { status: 200 });
    return procesar();
  }) as typeof fetch;

  const archivo = new File(['hola'], 'Brief.pdf', { type: 'application/pdf' });
  const j = await subirAlArchivero(archivo, false, falso(() => respuesta(200, { ok: true, brief: [], warnings: ['ojo'] })));
  assert.equal(leido(j), true);
  assert.deepEqual(llamadas.map((l) => `${l.metodo} ${l.url}`), [
    'POST /api/onboarding/archivero/upload-url', 'PUT https://storage.test/firmada', 'POST /api/onboarding/archivero',
  ]);
  assert.deepEqual(llamadas[2].cuerpo, { action: 'procesar', fileId: 'f1', path: '9/f1', nombre: 'Brief.pdf', mime: 'application/pdf', tamano: 4, finalizar: false });
  assert.equal(llamadas[1].cuerpo, archivo);

  // Subido pero no leído (422): vuelve con su error, no lanza.
  llamadas.length = 0;
  const no = await subirAlArchivero(archivo, true, falso(() => respuesta(422, { ok: false, error: 'No pude sacar texto de "Brief.pdf".' })));
  assert.equal(leido(no), false);
  assert.equal((llamadas[2].cuerpo as { finalizar: boolean }).finalizar, true);

  // Sin URL firmada: lanza con el error del server.
  const sinUrl = (async () => respuesta(403, { ok: false, error: 'Solo el admin del workspace.' })) as typeof fetch;
  await assert.rejects(subirAlArchivero(archivo, true, sinUrl), /Solo el admin del workspace\./);

  llamadas.length = 0;
  const w = await leerWebEnArchivero('https://tunegocio.com/', true, falso(() => respuesta(200, { ok: true, brief: [] })));
  assert.equal(leido(w), true);
  assert.deepEqual(llamadas[0].cuerpo, { action: 'procesar-link', url: 'https://tunegocio.com/', finalizar: true });
});

test('la pantalla: guard de su key, sin ?ws=, clases con el nombre entero, tokens e íconos que existen, sin voseo', () => {
  const pagina = leer(`${CARPETA}/page.tsx`);
  assert.ok(pagina.includes("requireMovil({ navKey: 'second-brain' })"));
  assert.doesNotMatch(pagina, /\bws\??:|\.ws\b|get\('ws'\)/, 'el workspace sale del request, nunca de ?ws=');

  const css = leer(`${CARPETA}/second-brain.css`).replace(/\/\*[\s\S]*?\*\//g, '');
  const clases = [...css.matchAll(/\.(-?[a-z][\w-]*)/g)].map((m) => m[1]).filter((c) => !/^\d/.test(c));
  // Las de la casa que se TOCAN (no se definen): el shell las nombra, esta hoja las acomoda adentro de las suyas.
  const ajenas = clases.filter((c) => !c.startsWith('m-second-brain-'));
  assert.deepEqual([...new Set(ajenas)], [], 'una clase sin el nombre de la carpeta le cambia otra pantalla');

  const globals = leer('app/globals.css') + leer('app/m/m.css');
  const faltanTokens = new Set<string>();
  for (const f of ARCHIVOS) for (const m of sinComentarios(leer(f)).matchAll(/var\((--[\w-]+)/g)) if (!globals.includes(`${m[1]}:`)) faltanTokens.add(`${f}: ${m[1]}`);
  assert.deepEqual([...faltanTokens], []);

  const iconos = new Set([...leer('app/_components/icons.tsx').matchAll(/^ {2}'?([a-zA-Z0-9-]+)'?: *\(/gm)].map((m) => m[1]));
  const inventados: string[] = [];
  for (const f of ARCHIVOS.filter((x) => x.endsWith('.tsx'))) {
    for (const m of leer(f).matchAll(/(?:<Icon name|icono)=["']([\w-]+)["']/g)) if (!iconos.has(m[1])) inventados.push(`${f}: ${m[1]}`);
  }
  assert.deepEqual(inventados, []);

  const voseo = /\b(tocá|mirá|tenés|podés|elegí|subí|pegá|escribí|buscá|querés|sabés|revisalo)\b/i;
  for (const f of ARCHIVOS) {
    const strings = [...leer(f).matchAll(/'([^'\n]*)'|"([^"\n]*)"|`([^`]*)`|>([^<>{}\n]+)</g)].map((m) => m[1] ?? m[2] ?? m[3] ?? m[4]);
    for (const s of strings) assert.doesNotMatch(s, voseo, `${f}: «${s}»`);
  }
});
