// =============================================================================
// Las miniaturas VERTICALES de Image (13/11/2026): la portada de un Reel o un Short, en 9:16
// =============================================================================
// Martín, 13/11/2026 (por el Cerebro): «miniaturas verticales en Image, para shorts y reels, además de las horizontales de
// YouTube. Con plantillas y réplica de outliers verticales, y que el piloto de YouTube de CoPilot las pueda pedir». Lo que fija:
//   1. de dónde salen: los reels CON portada que Spy ya trajo, sin repetir, los que más superaron a su cuenta primero;
//   2. la búsqueda (palabras o @cuenta) y el id que viaja a «Editar» (nunca cualquier texto);
//   3. «Horizontales · Verticales» va en la URL (`tformato`), «Quitar filtros» no lo cambia y el link no se queda pegado;
//   4. la réplica arma UNA lámina de 1080 × 1920 (el prompt, la lectura y la guía sin IA), y la persona NO se pega;
//   5. las dos plantillas verticales viven en la zona que no tapa la app (entre y 288 e y 1440);
//   6. todo enchufado: la ruta de «Editar», la pantalla, la API de MaKo y la tarea de YouTube del CoPilot.
// Correr: node --import tsx --test tests/thumbnails-verticales.test.ts
// PROBADO ROMPIÉNDOLO: ver el pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { RUTA_VERTICALES, coincideVertical, esIdDeVertical, verticalesDe, notasDeVertical } from '../lib/thumbnails/verticales';
import { FILTROS_THUMBNAIL, filtrosThumbnailDeQuery, queryDeThumbnails, sinFiltrosThumbnail } from '../lib/thumbnails/explorar';
import { documentoGuiaMiniatura, leerReplica, medidasDe, promptDeReplica } from '../lib/carruseles/replica';
import { PLANTILLAS_IMAGEN } from '../lib/image-editor/plantillas-reales';
import { tareasDelCoPilot, type ResumenParaTareas } from '../lib/copiloto/tareas';
import type { OutlierVideo } from '../lib/video-outliers';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');

const reel = (id: string, o: Partial<OutlierVideo> = {}): OutlierVideo => ({
  id, fuente: 'spy', red: 'instagram', formato: 'reel', creador: { nombre: 'Cuenta', usuario: 'cuenta', foto: null },
  url: `https://www.instagram.com/reel/${id.replace(':', '')}/`, miniatura: `https://x.supabase.co/storage/v1/object/public/spy/${id}.jpg`,
  titulo: 'Cómo cerrar sin llamadas', porque: '', duracionS: null, multiplo: null, plantilla: null, vistas: 1000, publicada: null, ...o,
});
const veces = (n: number) => ({ veces: n, motivo: null, formato: 'corto', canal: 'instagram', comparadas: 12 }) as unknown as OutlierVideo['multiplo'];

test('1. salen los reels CON portada, sin repetir, los que más superaron a su cuenta primero', () => {
  const lista = verticalesDe([
    reel('spy:1', { multiplo: veces(2), vistas: 5000 }),
    reel('spy:2', { multiplo: veces(7.5), vistas: 900 }),
    reel('spy:3', { miniatura: null }),                                   // sin portada: nada que replicar
    reel('spy:4', { miniatura: 'http://inseguro.com/a.jpg' }),           // sólo https
    reel('spy:5', { formato: 'anuncio' }),                               // un anuncio no es la portada de un reel
    reel('spy:2', { multiplo: veces(7.5) }),                             // repetido
    reel('spy:6', { multiplo: null, vistas: 80_000 }),                   // sin número: después de los que tienen
  ]);
  assert.deepEqual(lista.map((v) => v.id), ['spy:2', 'spy:1', 'spy:6']);
  assert.equal(lista[0].veces, 7.5);
  assert.match(notasDeVertical(lista[0]), /^Diseño tomado de la portada de un Reel de @cuenta \(https:\/\/www\.instagram\.com\/reel\//);
});

test('2. la búsqueda (palabras o @cuenta) y el id que viaja a «Editar»', () => {
  const [v] = verticalesDe([reel('spy:9', { titulo: 'Cómo cerré 15 clientes', creador: { nombre: 'Ana Ruiz', usuario: 'ana.ventas' } })]);
  assert.ok(coincideVertical(v, 'cerre clientes'), 'sin tildes ni mayúsculas');
  assert.ok(coincideVertical(v, '@ana.ventas') && coincideVertical(v, '@ana'));
  assert.ok(!coincideVertical(v, 'webinar'));
  assert.ok(coincideVertical(v, ''));
  for (const ok of ['spy:123', 'mako:reel-gancho', 'propio:17890_ab']) assert.ok(esIdDeVertical(ok), ok);
  for (const mal of ['123', 'spy:', '../spy:1', 'spy:1/../../x', 'SPY:1', 42, null, `spy:${'x'.repeat(90)}`]) assert.ok(!esIdDeVertical(mal), String(mal));
});

test('3. «Horizontales · Verticales» va en la URL, «Quitar filtros» no lo cambia y no se queda pegado', () => {
  const f = { ...FILTROS_THUMBNAIL, formato: 'vertical' as const };
  assert.equal(queryDeThumbnails(f), 'que=thumbnails&tformato=vertical');
  assert.equal(filtrosThumbnailDeQuery(new URLSearchParams('que=thumbnails&tformato=vertical')).formato, 'vertical');
  assert.equal(filtrosThumbnailDeQuery(new URLSearchParams('que=thumbnails&tformato=cualquiera')).formato, 'horizontal');
  assert.equal(queryDeThumbnails(FILTROS_THUMBNAIL), 'que=thumbnails', 'las horizontales no ensucian el link');
  assert.ok(sinFiltrosThumbnail(f), 'el formato no es un filtro: «Quitar filtros» no aparece por mirar las verticales');
  assert.equal(RUTA_VERTICALES, `/image-editor?${queryDeThumbnails(f)}`, 'el link del CoPilot es el de la pantalla');
  const explorador = leer('app/image-editor/carruseles/ExplorarCarruseles.tsx');
  const claves = explorador.slice(explorador.indexOf('const CLAVES_FILTRO = ['), explorador.indexOf('] as const;', explorador.indexOf('const CLAVES_FILTRO = [')));
  assert.ok(claves.includes("'tformato'"), 'falta tformato en CLAVES_FILTRO: volver a las horizontales deja «Verticales» pegado en el link');
  const panel = leer('app/image-editor/carruseles/Thumbnails.tsx');
  assert.match(panel, /cambiarYVolver\(\{ \.\.\.FILTROS_THUMBNAIL, vista: f\.vista, formato: f\.formato \}\)/, '«Quitar filtros» vuelve a las horizontales');
});

test('4. la réplica de una vertical: UNA lámina de 1080 × 1920, y la persona no se pega', () => {
  assert.deepEqual(medidasDe('9:16'), { ancho: 1080, alto: 1920 });
  const pedido = { laminas: 1, vistas: 1, negocio: '', voz: '', nombreNegocio: 'Mi Negocio', cta: null, conAvatar: true, miniatura: true, vertical: true };
  const prompt = promptDeReplica(pedido);
  assert.match(prompt, /la PORTADA de un Reel de Instagram/);
  assert.match(prompt, /VERTICAL \(9:16, 1080 × 1920\)/);
  assert.match(prompt, /"proporcion":"9:16"/);
  assert.doesNotMatch(promptDeReplica({ ...pedido, vertical: false }), /9:16/, 'la de YouTube sigue apaisada');
  const crudo = JSON.stringify({ proporcion: '16:9', titulo: 'Mi portada', laminas: [
    { fondo: '#111111', textos: [{ rol: 'titulo', texto: 'CERRÉ 15 SIN LLAMAR', x: 0.1, y: 0.4, ancho: 0.8, tamano: 0.1 }] },
    { fondo: '#222222', textos: [{ rol: 'titulo', texto: 'otra', x: 0.1, y: 0.4, ancho: 0.8, tamano: 0.1 }] },
  ] });
  const r = leerReplica(crudo, { laminas: 1, miniatura: true, vertical: true });
  assert.ok(!('error' in r));
  assert.equal(!('error' in r) && r.proporcion, '9:16', 'diga lo que diga el modelo');
  assert.equal(!('error' in r) && r.laminas.length, 1);
  const guia = documentoGuiaMiniatura({ marca: { nombre: 'Mi Negocio' } as never, nuevoId: () => 'x', vertical: true }) as { width: number; height: number; pages: Array<{ objects: Array<{ top: number }> }> };
  assert.deepEqual([guia.width, guia.height], [1080, 1920]);
  assert.ok(guia.pages[0].objects.every((o) => o.top >= 288 && o.top < 1440), 'sin IA, la guía también va en la zona que no tapa la app');
  const servidor = leer('lib/carruseles/replica-servidor.ts');
  assert.match(servidor, /else if \(ej\.que === 'vertical'\) \{ const \{ verticalPorId \} = await import\('\.\.\/thumbnails\/verticales-servidor'\); v = await verticalPorId\(ej\.id\); \}/);
  assert.match(servidor, /const proporcion = vertical \? '9:16' : miniatura \? '16:9' : '4:5';/);
  assert.match(servidor, /planchas = conMarcas && replica\.proporcion === proporcion/, 'la plancha (el original sin su texto) también en la vertical');
  // ⛔ Martín, 12 y 13/11/2026: la persona del original se GENERA con IA en el mismo estilo; la foto del negocio nunca se pega.
  assert.match(servidor, /\/\/ ⛔ La foto del negocio NO se pega en una réplica[\s\S]{0,600}Promise\.resolve\(null\),/);
});

test('5. las dos plantillas verticales, en la zona que no tapa la app', () => {
  const verticales = PLANTILLAS_IMAGEN.filter((p) => p.grupo === 'Miniaturas verticales');
  assert.deepEqual(verticales.map((p) => p.id), ['vertical-gancho-cara', 'vertical-numero']);
  for (const p of verticales) {
    for (const doc of [p.estructura(), p.ejemplo()]) {
      assert.deepEqual([doc.width, doc.height, doc.pages.length], [1080, 1920, 1], p.id);
      for (const o of doc.pages[0].objects as unknown as Array<Record<string, number | string | boolean>>) {
        if (o.isPlaceholder) continue; // la foto va a todo el cuadro: la persona ES la portada
        const top = Number(o.top);
        const bajo = top + Number(o.height);
        assert.ok(top >= 288 && bajo <= 1440, `${p.id} · «${o.name}» de ${top} a ${Math.round(bajo)}: la app tapa arriba de 288 y abajo de 1440`);
      }
    }
  }
});

test('6. enchufado: la ruta de «Editar», la pantalla, la API de MaKo y la tarea de YouTube del CoPilot', () => {
  const ruta = leer('app/api/image-editor/carruseles/replicar/route.ts');
  assert.match(ruta, /if \(vertical && !esIdDeVertical\(body\?\.id\)\) return fallo\('Falta la miniatura\.', 400\);/, 'un id cualquiera no llega a la réplica');
  assert.match(leer('app/api/image-editor/explorador/route.ts'), /if \(req\.nextUrl\.searchParams\.get\('que'\) === 'verticales'\)/);
  assert.match(leer('app/image-editor/carruseles/Thumbnails.tsx'), /if \(f\.formato === 'vertical'\) \{\s*return <PanelVerticales/);
  assert.match(leer('app/image-editor/carruseles/EditarCarrusel.tsx'), /que: 'vertical' as const, id: vertical\.id/);
  // La API: lo nuevo va en PARÁMETROS (no puntúan en el clasificador), y la descripción de cada operación no cambia.
  const def = leer('lib/api-mako/areas/imagen.def.ts');
  assert.match(def, /\{ nombre: 'formato', tipo: 'string', enum: \['horizontal', 'vertical'\]/);
  assert.match(def, /\{ nombre: 'verticalId', tipo: 'string', max: 120,/);
  const run = leer('lib/api-mako/areas/imagen.run.ts');
  assert.match(run, /if \(str\(input, 'formato'\) === 'vertical'\) \{/);
  assert.match(run, /const ejemplo = vertical \? \{ que: 'vertical' as const, id: vertical \}/);
  // El CoPilot: con YouTube conectado, la miniatura vertical del próximo Short; sin conectarlo, primero conectar.
  const base: ResumenParaTareas = {
    oferta: { sesion: 1, notaOferta: true, notaAngulos: true, notaVoz: true, faltan: { oferta: 0, angulos: 0, voz: 0 } },
    anuncios: { conectada: false, funnel: null, semana: [] }, web: [], redes: { instagram: { conectada: true }, youtube: { conectada: true } }, seguidos: 3,
  };
  const t = tareasDelCoPilot(base).tareas.find((x) => x.clave === 'youtube:miniatura-vertical');
  assert.deepEqual(t && { tarjeta: t.tarjeta, href: t.href }, { tarjeta: 'youtube', href: RUTA_VERTICALES });
  assert.ok(!tareasDelCoPilot({ ...base, redes: { ...base.redes, youtube: { conectada: false } } }).tareas.some((x) => x.clave === 'youtube:miniatura-vertical'));
});

// PROBADO ROMPIÉNDOLO (13/11/2026, base 6/0; de a una y restaurando): ver docs/hallazgos-carruseles.md → «Las miniaturas verticales».
