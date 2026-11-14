// =============================================================================
// Replicar lo que TRAE la persona: un link o un texto pegado, o un archivo (lib/copywriter/pegado.ts, 14/11/2026)
// =============================================================================
// El Cerebro, de la llamada con Julio (13/11): Copywriting replica «guion de reels, de historias, secuencias de historias, de
// YouTube, VSL… de tu competencia», y sólo se replicaba desde los outliers. Fija:
//   · qué es lo pegado (un YouTube, Instagram, una página o un texto) y cómo se guarda y se lee (saneado);
//   · lo traído es un original más (`pegado:<n>`): la página lo guarda, MaKo lo lee con qué es y lo que no se pudo traer, y el
//     VSL sin lo que se dice tiene su regla de largo;
//   · su video de YouTube se transcribe antes de escribir (como el de Spy); un VSL en Panda lo dice y no se transcribe;
//   · la pantalla: el botón de la portada, la ventana, la ruta con su puerta, la API de MaKo y el original sin link.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INFO_PEGADO, TIPOS_PEGADO, claveDePegado, claveGuionDePegado, leerOriginalPegado, numeroDePegado, outlierDePegado, queEsLoPegado, type OriginalPegado } from '../lib/copywriter/pegado';
import { esIdOutlierCopy, reglasDeLaReplica, rotuloDeFormato, textoParaMaKo, tipoDeOutlier } from '../lib/copywriter/outliers';
import { sanearProps } from '../lib/copywriter/tipos';
import { transcribirSiHaceFalta, TRANSCRITO, type Dependencias } from '../app/copywriter/transcribir-original';
import type { OutlierCopy } from '../lib/copywriter/outliers';

const raiz = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(raiz, r), 'utf8').replace(/\r\n/g, '\n');

const ORIGINAL: OriginalPegado = {
  tipo: 'story', de: 'lo que pegaste', titulo: 'Historia 1: ¿Te pasa que vendes y no cobras?',
  texto: 'Historia 1: ¿Te pasa que vendes y no cobras?\nHistoria 2: A mí me pasaba.\nHistoria 3: Escríbeme «COBRAR».',
  deDonde: 'guion', url: '', video: null, duracion: null, nota: null, creado: '2026-11-14T12:00:00.000Z',
};

test('qué es lo pegado: un link SOLO es un link (YouTube, Instagram o una página); con otro texto, es el texto', () => {
  assert.deepEqual(queEsLoPegado('https://youtu.be/t7-__IAeEu8'), { clase: 'youtube', url: 'https://youtu.be/t7-__IAeEu8', video: 'https://www.youtube.com/watch?v=t7-__IAeEu8' });
  assert.equal(queEsLoPegado('https://www.youtube.com/shorts/t7-__IAeEu8').clase, 'youtube');
  assert.equal(queEsLoPegado('https://www.instagram.com/reel/DePMTk0jCjk/').clase, 'instagram');
  assert.deepEqual(queEsLoPegado('miweb.com/clase-gratis'), { clase: 'pagina', url: 'https://miweb.com/clase-gratis' });
  assert.equal(queEsLoPegado('  ').clase, 'vacio');
  // Un guion con un link adentro es un texto (se replica el texto, no se baja la página).
  assert.equal(queEsLoPegado('Mira este video https://youtu.be/t7-__IAeEu8 y haz uno igual').clase, 'texto');
  assert.equal(queEsLoPegado('javascript:alert(1)').clase, 'texto', 'sólo http y https son links');
  assert.equal(queEsLoPegado('Hola').clase, 'texto');
});

test('lo traído se guarda y se lee saneado; lo que no se entiende no se replica', () => {
  assert.deepEqual(leerOriginalPegado(JSON.stringify(ORIGINAL)), ORIGINAL);
  assert.equal(leerOriginalPegado(JSON.stringify({ ...ORIGINAL, tipo: 'email' })), null, 'un tipo que no se puede traer');
  assert.equal(leerOriginalPegado(JSON.stringify({ ...ORIGINAL, texto: '   ' })), null, 'sin texto no hay qué replicar');
  assert.equal(leerOriginalPegado('{roto'), null);
  const raro = leerOriginalPegado(JSON.stringify({ ...ORIGINAL, url: 'javascript:alert(1)', video: 'https://evil.tld/x', deDonde: 'otra' }))!;
  assert.equal(raro.url, '');
  assert.equal(raro.video, null);
  assert.equal(raro.deDonde, 'guion');
  assert.equal(claveDePegado(123), 'mako.copywriter.original.123');
  assert.equal(claveGuionDePegado(123), 'mako.copywriter.original.123.guion');
  assert.equal(numeroDePegado('pegado:123'), 123);
  assert.equal(numeroDePegado('spy:123'), null);
});

test('lo traído es un original más: la página lo guarda, se replica en su tipo y MaKo sabe qué es y qué no se pudo traer', () => {
  const o = outlierDePegado(123, ORIGINAL);
  assert.equal(o.id, 'pegado:123');
  assert.ok(esIdOutlierCopy(o.id));
  assert.equal(sanearProps({ tipo: 'story', outlier: o.id }, 'story').outlier, 'pegado:123', 'la página no lo pierde al guardar');
  assert.equal(tipoDeOutlier(o), 'story', 'una secuencia de historias se replica en una página de historias, no en un reel');
  assert.equal(o.formato, 'reel');
  assert.equal(rotuloDeFormato(o), 'Secuencia de historias');
  assert.equal(o.url, '');
  const para = textoParaMaKo(o, null);
  assert.match(para, /^EL ORIGINAL QUE REPLICAS: secuencia de historias que trajo la persona \(lo que pegaste\)\.\n/);
  assert.doesNotMatch(para, /Instagram|LO QUE NO SE PUDO TRAER/);
  assert.match(para, /SU GUION:\nHistoria 1/);
  // Cada tipo, en su página.
  for (const t of TIPOS_PEGADO) assert.equal(tipoDeOutlier(outlierDePegado(1, { ...ORIGINAL, tipo: t })), t);
  assert.equal(INFO_PEGADO.vsl.formato, 'youtube');
});

test('el VSL de una landing: sin lo que se dice, su nota y la regla de un VSL entero; transcrito, lo que se dice', () => {
  const landing: OriginalPegado = {
    ...ORIGINAL, tipo: 'vsl', de: 'competidor.com', titulo: 'La clase gratis', texto: 'La clase gratis\n\nAprende a vender sin anuncios.', deDonde: 'copy',
    url: 'https://competidor.com/clase', nota: 'Su video está en Panda: no lo puedo transcribir desde la página. Replico con el texto de la página; si tienes lo que dice, pégalo.',
  };
  const sin = outlierDePegado(7, landing);
  assert.equal(tipoDeOutlier(sin), 'vsl');
  const para = textoParaMaKo(sin, null);
  assert.match(para, /^EL ORIGINAL QUE REPLICAS: vsl que trajo la persona \(de competidor\.com: https:\/\/competidor\.com\/clase\)\.\nLO QUE NO SE PUDO TRAER: Su video está en Panda/);
  assert.match(reglasDeLaReplica(sin)[0], /^EL LARGO: lo de arriba es el TEXTO de su página, no lo que se dice en su VSL\..*escribe un VSL entero/);
  const transcrito = outlierDePegado(7, { ...landing, video: 'https://www.youtube.com/watch?v=t7-__IAeEu8' }, 'Hola, hoy te cuento cómo vendí sin anuncios.');
  assert.equal(transcrito.deDonde, 'guion');
  assert.equal(transcrito.texto, 'Hola, hoy te cuento cómo vendí sin anuncios.');
  assert.equal(transcrito.nota, undefined, 'con lo que se dice, la nota ya no corre');
  assert.match(reglasDeLaReplica(transcrito)[0], /^EL LARGO: el original tiene unas \d+ palabras/);
});

const vista = (estado: string) => (estado === 'listo'
  ? { ok: true as const, guion: { estado: 'listo' as const, texto: 'Hola', motivo: null } }
  : estado === 'no-aplica' ? { ok: true as const, guion: { estado: 'no-aplica' as const } }
    : { ok: true as const, guion: { estado: 'transcribiendo' as const, texto: null, motivo: null } });
function deps(o: Partial<OutlierCopy>, estados: string[]): { d: Dependencias; pedidos: string[] } {
  const pedidos: string[] = [];
  let t = 0;
  return {
    pedidos,
    d: {
      original: async () => ({ ok: true as const, outlier: { formato: 'youtube', deDonde: 'descripcion', fuente: 'pegado', url: '', ...o } as OutlierCopy }),
      transcribir: async () => { throw new Error('lo traído no va a Spy'); },
      transcribirPegado: async (id) => { pedidos.push(id); return vista(estados.shift() ?? 'transcribiendo'); },
      espera: async (ms) => { t += ms; },
      ahora: () => t,
    },
  };
}

test('su video se transcribe antes de escribir (como el de Spy); el VSL en Panda lo dice; lo pegado no se transcribe', async () => {
  const yt = deps({}, ['transcribiendo', 'listo']);
  assert.deepEqual(await transcribirSiHaceFalta('pegado:9', () => {}, yt.d), { ok: true, texto: TRANSCRITO });
  assert.deepEqual(yt.pedidos, ['pegado:9', 'pegado:9'], 'a /api/copywriter/pegado, con su id');
  const panda = deps({ deDonde: 'copy', nota: 'Su video está en Panda: no lo puedo transcribir desde la página.' }, ['no-aplica']);
  assert.deepEqual(await transcribirSiHaceFalta('pegado:9', () => {}, panda.d), { ok: false, texto: 'Su video está en Panda: no lo puedo transcribir desde la página.' });
  const texto = deps({ deDonde: 'guion', formato: 'reel' }, []);
  assert.equal(await transcribirSiHaceFalta('pegado:9', () => {}, texto.d), null);
  assert.deepEqual(texto.pedidos, [], 'lo pegado ya es el texto: no se pide nada');
});

test('la pantalla: el botón en la portada, la ventana, la ruta con su puerta, la API y el original sin link', () => {
  const portada = leer('app/copywriter/OutliersCopy.tsx');
  assert.match(portada, /onClick=\{\(\) => setPegando\(true\)\}>Pegar link o texto<\/button>/);
  assert.match(portada, /\{pegando \? <ReplicarPegado onCerrar=\{\(\) => setPegando\(false\)\} onListo=\{\(id\) => router\.push\(rutaGuion\.replace\('\{id\}', id\)\)\} \/> : null\}/);
  const ventana = leer('app/copywriter/ReplicarPegado.tsx');
  assert.match(ventana, /const r = await pedirReplicarPegado\(tipo, texto, archivos\);/);
  assert.match(ventana, /TIPOS_PEGADO\.map/);
  const ruta = leer('app/api/copywriter/pegado/route.ts');
  assert.match(ruta, /const cerrada = await soloAdminDeTab\('copywriter'\);\n\s+if \(cerrada\) return cerrada;\n\s+if \(!\(await veCopywriter\(\)\)\) return falla\(404, 'No existe'\);/, 'la misma puerta que /api/copywriter');
  assert.match(ruta, /const r = await replicarPegado\(\{ tipo: b\.tipo, texto: b\.texto, lecturas: leidos\.lecturas \}\);/);
  assert.match(ruta, /try \{ after\(correr\); \} catch \{ void correr\(\); \}/);
  assert.match(leer('lib/copywriter/outliers-servidor.ts'), /if \(fuente === 'pegado'\) return originalPegadoPorId\(n\);/);
  assert.match(leer('lib/api-mako/areas/copywriter.def.ts'), /id: 'replicar_link_o_texto_copywriter', area: 'contenido', tipo: 'accion',/);
  assert.match(leer('lib/api-mako/areas/copywriter.run.ts'), /const r = await replicarPegado\(\{ tipo: str\(payload, 'tipo'\), texto: str\(payload, 'texto'\) \}\);/);
  const lado = leer('app/copywriter/OriginalAlLado.tsx');
  assert.match(lado, /\{o\.url \? <a className="nt-miga"/, 'lo pegado no tiene «Ver el original»');
  assert.match(lado, /traido && !idDeYouTube\(o\.url\) \? \{ transcrito: false, texto: 'Lo que trajiste' \}/);
  // La landing se baja con las barandas de siempre y su VSL se busca con el detector del Pixel.
  const servidor = leer('lib/copywriter/pegado-servidor.ts');
  assert.match(servidor, /pagina = await paginaConDireccion\(lo\.url, \{ talCual: true \}\);/);
  assert.match(servidor, /const videos = videosDeHtml\(pagina\.final, pagina\.html\);/);
});
