// =============================================================================
// Hijo de tests/gurus-ops-center.test.ts: el curso de CADA gurú, leído de verdad (3/11/2026)
// =============================================================================
// NO es un test (no termina en .test.ts). Corre el camino real —`cursoDe` → los archivos de public/cono-tx → `cursoParaElTurno`— y
// cuenta lo que llegó. Del CDN sólo se cambia la red: `fetch` lee el mismo archivo del disco, y lo que no existe es un 404 como allá.
// Necesita `--conditions=react-server` (lib/cerebro-referente-server.ts lleva `server-only`).
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const pedidos: string[] = [];
globalThis.fetch = (async (url: string | URL) => {
  const id = /\/cono-tx\/([^/]+)\.json$/.exec(String(url))?.[1];
  pedidos.push(String(url));
  // La red nunca contesta en el mismo tic: sin esto, el «plazo 0» de abajo perdía contra una lectura que no espera nada.
  await new Promise((r) => setImmediate(r));
  const p = id ? join(RAIZ, 'public', 'cono-tx', `${id}.json`) : '';
  return p && existsSync(p) ? new Response(readFileSync(p)) : new Response('', { status: 404 });
}) as typeof fetch;

void (async () => {
  const [{ ASESORES }, { cursoDe, cursoParaElTurnoDe, paqueteParaElTurno, cursoDelReferente }, { cursoParaElTurno }] = await Promise.all([
    import('../lib/asesores/catalogo'), import('../lib/cerebro-para-chat'), import('../lib/cerebro-referente'),
  ]);
  // Un curso que no llega a tiempo no frena el turno: el más largo, sin leer todavía y sin plazo, vuelve vacío en el acto y sin tirar.
  const t1 = performance.now();
  const tarde = await cursoParaElTurnoDe('marc-verdu', 'una pregunta', 0).catch(() => 'tiró');
  const tardeMs = Math.round(performance.now() - t1);
  const gurus = [];
  for (const a of ASESORES) {
    const c = await cursoDe(a.id);
    const clases = c ? c.capa.nodos.length - 1 : 0;
    // La pregunta sale del título de una clase de SU curso: si el bloque no trae un tramo con esto, no contesta con su curso.
    const titulo = c?.capa.nodos.find((n) => n.tipo !== 'raiz' && (n.cuerpo?.length ?? 0) > 200)?.etiqueta ?? '';
    const t0 = performance.now();
    const bloque = c ? cursoParaElTurno(c.capa, c.a, `¿Qué enseñas sobre ${titulo}?`) : '';
    gurus.push({ id: a.id, clases, ms: Math.round(performance.now() - t0), largo: bloque.length, conTramos: bloque.includes('LO QUE DICE SOBRE ESTA PREGUNTA:'), conAtribucion: bloque.includes(a.curso) });
  }
  const antes = pedidos.length;
  await cursoDe('hormozi');
  const releidas = pedidos.length - antes;

  // La cuenta de un CLIENTE: un miembro sin plata (`sinPlata`), sin negocio que responda (sin base en el hijo: el grafo cae a vacío).
  const delCliente = await paqueteParaElTurno('¿Cómo armo una oferta con un modelo de monetización que me deje caja?', { sinPlata: true, referente: 'hormozi' });
  const sinReferente = await paqueteParaElTurno('¿Cómo armo una oferta con un modelo de monetización que me deje caja?', { sinPlata: true });
  const deOffer = await cursoDelReferente('hormozi', '¿Cómo armo una oferta con un modelo de monetización que me deje caja?', 12_000);
  // Su Second Brain, como lo arma la ruta (`?cerebroDe=`): el curso más largo, con sus módulos de secciones (lib/cerebro-referente-vista.ts),
  // acomodado y sin el texto de las clases.
  const [{ layoutCerebro }, { vistaDeReferente }] = await Promise.all([import('../lib/cerebro-layout'), import('../lib/cerebro-referente-vista')]);
  const largo = await cursoDe('marc-verdu');
  const vista = largo ? vistaDeReferente(largo.a, largo.capa) : null;
  const nodos = vista?.nodos ?? [];
  const t2 = performance.now();
  const { posiciones } = layoutCerebro(nodos, vista?.aristas ?? []);
  const grafo = { nodos: nodos.length, modulos: nodos.filter((n) => n.id.startsWith('n1:')).length, posiciones: Object.keys(posiciones).length, ms: Math.round(performance.now() - t2), kb: Math.round(JSON.stringify({ ...vista, posiciones }).length / 1024) };
  process.stdout.write(`${JSON.stringify({ gurus, releidas, delCliente: { conCurso: delCliente.includes('EL CURSO DE ALEX HORMOZI'), conTramos: delCliente.includes('LO QUE DICE SOBRE ESTA PREGUNTA:'), largo: delCliente.length }, sinReferente: sinReferente.includes('EL CURSO DE'), deOffer: { conCurso: deOffer.includes('EL CURSO DE ALEX HORMOZI'), largo: deOffer.length }, tarde: { ms: tardeMs, vacio: tarde === '' }, grafo })}\n`);
  process.exit(0);
})().catch((e) => { process.stderr.write(String(e?.stack ?? e)); process.exit(1); });
