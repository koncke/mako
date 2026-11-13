// =============================================================================
// Copywriting hacia otras funciones y el YouTube transcrito (13/11/2026, la llamada de Martín con Leila)
// =============================================================================
//   · después de replicar, «Hacerlo con tu avatar IA» (lo que se DICE va a AI Avatar) y «Hacerlo carrusel» (las LÁMINAS, a Image);
//   · un outlier de YouTube sin transcribir se transcribe antes de escribir, y si no se puede, se dice;
//   · una página recién creada no espera a leer un chat que no existe (la medición: 0,4 s de 2 antes de la pregunta).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dichoDelGuion, laminasDelGuion } from '../lib/copywriter/hacia-otras';
import { docDeEstructura } from '../lib/copywriter/doc';
import { aplicarTodo, sanearOperaciones } from '../lib/copywriter/operaciones';
import { reglasDeLaReplica, LARGO_MAXIMO_REPLICA } from '../lib/copywriter/outliers';
import { transcribirSiHaceFalta, TRANSCRITO, LINEA_TRANSCRIBIENDO, type Dependencias } from '../app/copywriter/transcribir-original';
import { esRecienCreada, marcarRecienCreada } from '../app/copywriter/pedido-guardado';
import type { JsonNodo } from '../lib/copywriter/tipos';
import type { OutlierCopy } from '../lib/copywriter/outliers';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');
const cat = { angulos: new Set<string>(), estructuras: new Set<string>() };

/** Un guion escrito por MaKo, con las herramientas de verdad. */
function guion(ops: unknown[], secciones: string[]): JsonNodo {
  const doc = docDeEstructura(secciones);
  return aplicarTodo(doc, sanearOperaciones(ops, doc, cat).ops).doc;
}

test('lo que se DICE del guion va al avatar: la locución de una tabla, sin lo que se ve ni el pie', () => {
  const reel = guion([
    { op: 'insertar_despues', bid: null, bloques: [{ tipo: 'destacado', texto: 'Para: negocios que venden por WhatsApp.' }] },
    { op: 'escribir_seccion', seccion: 'GANCHO', bloques: [{ tipo: 'texto', texto: 'Frase hablada: «Tres errores en tu WhatsApp que destruyen la venta.»' }, { tipo: 'texto', texto: 'Visual: persona tacha errores.' }] },
    { op: 'escribir_seccion', seccion: 'HISTORIA', bloques: [{ tipo: 'tabla', filas: [['Escena', 'Locución', 'Cámara'], ['1', '«Primero: respondes tarde.»', 'Plano medio'], ['2', '«Segundo: mandas el producto de una.»', 'Corte']] }] },
    { op: 'escribir_seccion', seccion: 'CAPTION', bloques: [{ tipo: 'texto', texto: 'Guarda estos 3 pasos. #ventas' }] },
  ], ['GANCHO', 'HISTORIA', 'CAPTION']);
  assert.equal(dichoDelGuion(reel), 'Tres errores en tu WhatsApp que destruyen la venta.\nPrimero: respondes tarde.\nSegundo: mandas el producto de una.');
});

test('las LÁMINAS del guion van a Image: la tabla de un carrusel, o una por sección', () => {
  const carrusel = guion([
    { op: 'escribir_seccion', seccion: 'LAMINAS', bloques: [{ tipo: 'tabla', filas: [['Lámina', 'Texto en la imagen', 'Visual'], ['1', 'Tu WhatsApp pierde ventas. Y no es el anuncio.', 'Foto'], ['2', 'Respondes tarde.', 'Reloj'], ['3', 'Comenta FUNNEL.', 'Logo']] }] },
    { op: 'escribir_seccion', seccion: 'PIE', bloques: [{ tipo: 'texto', texto: 'El pie de la publicación.' }] },
  ], ['LAMINAS', 'PIE']);
  assert.deepEqual(laminasDelGuion(carrusel), [
    { titulo: 'Tu WhatsApp pierde ventas.', cuerpo: 'Y no es el anuncio.' },
    { titulo: 'Respondes tarde.', cuerpo: '' },
    { titulo: 'Comenta FUNNEL.', cuerpo: '' },
  ]);
  const anuncio = guion([
    { op: 'escribir_seccion', seccion: 'GANCHO', bloques: [{ tipo: 'texto', texto: '¿Por qué tus leads no contestan? Nadie les avisa qué esperar.' }] },
    { op: 'escribir_seccion', seccion: 'CTA', bloques: [{ tipo: 'texto', texto: 'Agenda una charla.' }] },
  ], ['GANCHO', 'CTA']);
  assert.deepEqual(laminasDelGuion(anuncio), [
    { titulo: '¿Por qué tus leads no contestan?', cuerpo: 'Nadie les avisa qué esperar.' },
    { titulo: 'Agenda una charla.', cuerpo: '' },
  ]);
});

test('los botones de la réplica terminada y sus dos puertas (AI Avatar, Image)', () => {
  const panel = leer('app/copywriter/PanelMaKo.tsx');
  assert.match(panel, /onClick=\{hacerConAvatar\}>Hacerlo con tu avatar IA<\/button>/);
  assert.match(panel, /'Armando el carrusel…' : 'Hacerlo carrusel'/);
  assert.ok(panel.includes("pasarGuion('avatar', ws, dicho);"));
  assert.ok(panel.includes('router.push(`/image-editor/${encodeURIComponent(r.id)}`);'));
  // AI Avatar toma el guion en el proyecto (escritorio y teléfono) y lo suelta al animar; con uno esperando abre el último avatar.
  for (const archivo of ['app/ai-avatar/Estudio.tsx', 'app/m/ai-avatar/EstudioM.tsx']) {
    const e = leer(archivo);
    assert.match(e, /const g = verGuionPasado\('avatar', ws\); if \(g\) setGuion\(\(x\) => x \|\| g\);/, archivo);
    assert.ok(e.includes("soltarGuionPasado('avatar', ws);"), archivo);
    assert.ok(e.includes("const listo = inicio.looks.find((l) => l.estado === 'listo');"), archivo);
  }
  const image = leer('app/image-editor/actions.ts');
  assert.ok(image.includes('export async function crearCarruselDesdeGuionAction('));
  assert.ok(image.includes("rol: i === 0 ? 'portada' : i === ultima ? 'cierre' : 'punto',"));
});

const youtube = (deDonde: OutlierCopy['deDonde']) => ({ ok: true as const, outlier: { formato: 'youtube', deDonde } as OutlierCopy });
function deps(estados: string[], extra: Partial<Dependencias> = {}): { d: Dependencias; pedidos: number[] } {
  const pedidos: number[] = [];
  let t = 0;
  const d: Dependencias = {
    original: async () => youtube('descripcion'),
    transcribir: async (id) => {
      pedidos.push(id);
      const e = estados.shift() ?? 'transcribiendo';
      if (e === 'error') return { ok: false, error: 'No autorizado.' };
      if (e === 'listo') return { ok: true, guion: { estado: 'listo', texto: 'Hola, hoy te enseño…', motivo: null } };
      if (e === 'sin-gemini') return { ok: true, guion: { estado: 'sin-gemini' } };
      return { ok: true, guion: { estado: 'transcribiendo', texto: null, motivo: null } };
    },
    espera: async (ms) => { t += ms; },
    ahora: () => t,
    ...extra,
  };
  return { d, pedidos };
}

test('el YouTube se transcribe ANTES de replicarlo, y si no se puede, se dice', async () => {
  const lineas: string[] = [];
  const bien = deps(['transcribiendo', 'transcribiendo', 'listo']);
  assert.deepEqual(await transcribirSiHaceFalta('spy:42', (l) => lineas.push(l), bien.d), { ok: true, texto: TRANSCRITO });
  assert.deepEqual(bien.pedidos, [42, 42, 42]);
  assert.deepEqual(lineas, [LINEA_TRANSCRIBIENDO]);
  assert.match((await transcribirSiHaceFalta('spy:42', () => {}, deps(['sin-gemini']).d))?.texto ?? '', /^No pude transcribir el video \(hace falta tu Gemini conectado\): lo escribo con su título y su descripción, y tomo sólo el gancho y la estructura\.$/);
  assert.match((await transcribirSiHaceFalta('spy:42', () => {}, deps(['error']).d))?.texto ?? '', /\(no autorizado\)/);
  assert.match((await transcribirSiHaceFalta('spy:42', () => {}, deps([]).d))?.texto ?? '', /tardó más de 4 minutos/);
  // Lo que no hace falta: la biblioteca, lo que no es YouTube, lo ya transcrito.
  assert.equal(await transcribirSiHaceFalta('biblioteca:7', () => {}, deps([]).d), null);
  assert.equal(await transcribirSiHaceFalta('spy:42', () => {}, deps([], { original: async () => youtube('guion') }).d), null);
  assert.equal(await transcribirSiHaceFalta('spy:42', () => {}, deps([], { original: async () => ({ ok: true as const, outlier: { formato: 'reel', deDonde: 'pie' } as OutlierCopy }) }).d), null);
});

test('la réplica de un tema que no tiene que ver: sin preguntar, sólo el gancho y la estructura, y lo dice', () => {
  const todas = reglasDeLaReplica({ formato: 'youtube', deDonde: 'guion', texto: 'hola', laminas: null }).join('\n');
  assert.match(todas, /SI SU TEMA NO TIENE QUE VER CON EL NEGOCIO[^:]*: no preguntes\. Toma sólo su tipo de gancho y su estructura/);
  // Un video transcrito más largo de lo que entra en un pedido pide el tope, y sin la línea que mide la segunda pasada.
  const largo = reglasDeLaReplica({ formato: 'youtube', deDonde: 'guion', texto: Array.from({ length: 5_000 }, (_, i) => `p${i}`).join(' '), laminas: null })[0];
  assert.match(largo, new RegExp(`el original es largo \\(unas 5000 palabras dichas\\); el tuyo, de unas ${LARGO_MAXIMO_REPLICA}`));
  assert.doesNotMatch(largo, /el original tiene unas/);
});

test('la portada se guarda ENTRE instancias (4,9 s en cada apertura, medido el 13/11), y una con una fuente caída no', () => {
  const s = leer('lib/copywriter/outliers-servidor.ts');
  assert.ok(s.includes("const portadaCompartida = cachedRead('copywriter-portada', async (): Promise<PortadaCopy> => {"));
  assert.ok(s.includes('if (portada.caidas.length) throw new PortadaConCaidas(portada);'));
  assert.ok(s.includes('portada = e instanceof PortadaConCaidas ? e.portada : await armarPortada(fuentes);'));
  // Las fuentes de un test no pasan por ninguna caché.
  assert.ok(s.includes('if (fuentes !== FUENTES_OUTLIERS_COPY) return armarPortada(fuentes);'));
});

test('una página recién creada no espera a leer su chat vacío (0,4 s de los 2 antes de la pregunta)', () => {
  marcarRecienCreada('gabc1234');
  assert.equal(esRecienCreada('gabc1234'), true);
  assert.equal(esRecienCreada('gabc1234'), false, 'se toma una vez');
  const cliente = leer('app/copywriter/cliente.ts');
  assert.equal((cliente.match(/if \(r\.ok\) marcarRecienCreada\(r\.pagina\.id\);/g) ?? []).length, 2, 'crear y replicar');
  assert.ok(leer('app/copywriter/PanelMaKo.tsx').includes('if (esRecienCreada(id)) { setHiloLeido(true); return; }'));
});
