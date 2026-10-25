// =============================================================================
// El alcance por sección (Pixel v26): qué porcentaje de los visitantes VIO cada sección (25/10/2026)
// =============================================================================
// docs/diseno-pruebas-ab.md, L1 (el primer paso del Landing AI). Lo que fija, y por qué:
//   1. se mide DESDE el primer evento `secciones`: con la ventana de 30 días sola, los visitantes de antes de la v26
//      entraban al denominador sin haber podido mandar nada, y el alcance salía bajo sin serlo;
//   2. por PÁGINA: una sección de «precios» se divide por quien entró a «precios», no a la landing entera;
//   3. sin ningún evento, null («No medido»), nunca 0; una página sin visitantes, pct null;
//   4. ningún alcance pasa del 100 % (quien mandó `secciones` cuenta en el denominador aunque falte su visita);
//   5. las secciones salen del HTML de la FOTO publicada (lo que se sirve), con su título; un id raro del `detalle` no cuenta.
// Correr: node --import tsx --test tests/alcance-secciones.test.ts
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { alcanceDeSecciones, idsDeSecciones, seccionesDeLaFoto, type FilaSecciones, type FilaVisita } from '../lib/editor-landing/alcance-secciones';

const INICIO = 'https://hola-mako.site/mi-landing';
const PRECIOS = 'https://hola-mako.site/mi-landing/precios';
const paginas = [
  { claves: new Set([INICIO]), secciones: [{ id: 'tHero', titulo: 'Hero' }, { id: 'tCaso', titulo: 'Caso' }, { id: 'tFaq', titulo: 'Preguntas' }] },
  { claves: new Set([PRECIOS]), secciones: [{ id: 'tPlanes', titulo: 'Planes' }] },
];
const v = (quien: string, url: string, cuando: string): FilaVisita => ({ visitor_id: quien, landing_url: url, created_at: cuando });
const s = (quien: string, url: string, cuando: string, detalle: string): FilaSecciones => ({ ...v(quien, url, cuando), detalle });

test('los ids del evento: separados por espacios, sin repetir, y lo que no tiene forma de id no cuenta', () => {
  assert.deepEqual(idsDeSecciones('tHero tCaso tHero'), ['tHero', 'tCaso']);
  assert.deepEqual(idsDeSecciones('  tHero\ttCaso  '), ['tHero', 'tCaso']);
  assert.deepEqual(idsDeSecciones('tHero <b> a%20b ' + 'x'.repeat(41)), ['tHero']);
  assert.deepEqual(idsDeSecciones(null), []);
});

test('sin ningún evento `secciones`: null (No medido), nunca 0', () => {
  assert.equal(alcanceDeSecciones(paginas, [v('a', INICIO, '2026-10-20T10:00:00Z')], []), null);
  // Un evento de OTRA landing tampoco es medir esta.
  assert.equal(alcanceDeSecciones(paginas, [], [s('a', 'https://hola-mako.site/otra', '2026-10-26T10:00:00Z', 'tHero')]), null);
});

test('desde el primer evento y por página: el denominador es quien entró a ESA página desde que se mide', () => {
  const visitas = [
    v('viejo', INICIO, '2026-10-20T10:00:00Z'), // antes de la v26: NO cuenta
    v('a', INICIO, '2026-10-26T10:00:00Z'),
    v('b', INICIO + '?utm_source=fb', '2026-10-26T11:00:00Z'), // la misma página, con utm
    v('c', INICIO, '2026-10-26T12:00:00Z'),
    v('d', INICIO, '2026-10-26T13:00:00Z'),
    v('p', PRECIOS, '2026-10-26T14:00:00Z'),
  ];
  const eventos = [
    s('a', INICIO, '2026-10-26T10:00:05Z', 'tHero'),
    s('a', INICIO, '2026-10-26T10:01:00Z', 'tHero tCaso'), // acumulado: el mismo visitante, más ids
    s('b', INICIO + '?utm_source=fb', '2026-10-26T11:00:05Z', 'tHero tCaso tFaq'),
    s('c', INICIO, '2026-10-26T12:00:05Z', 'tHero'),
    s('p', PRECIOS, '2026-10-26T14:00:05Z', 'tPlanes'),
  ];
  const r = alcanceDeSecciones(paginas, visitas, eventos);
  assert.ok(r);
  assert.equal(r.desde, '2026-10-26T10:00:05.000Z');
  assert.equal(r.visitantes, 5, 'a, b, c, d y p (el viejo no)');
  const pct = Object.fromEntries(r.porSeccion.map((x) => [x.tarjetaId, x.pct]));
  // Inicio: a, b, c, d = 4 (d entró y no mandó nada: no vio ninguna durante 1 s).
  assert.equal(pct.tHero, 75);
  assert.equal(pct.tCaso, 50);
  assert.equal(pct.tFaq, 25);
  assert.equal(pct.tPlanes, 100, 'precios se divide por quien entró a precios');
  assert.deepEqual(r.porSeccion.map((x) => x.titulo), ['Hero', 'Caso', 'Preguntas', 'Planes']);
});

test('ningún alcance pasa del 100 %, y una página sin visitantes queda en null', () => {
  // El evento llegó y la visita no (dos filas distintas): igual cuenta en el denominador.
  const r = alcanceDeSecciones(paginas, [], [s('a', INICIO, '2026-10-26T10:00:00Z', 'tHero tCaso')]);
  assert.ok(r);
  for (const x of r.porSeccion) if (x.pct !== null) assert.ok(x.pct <= 100);
  assert.equal(r.porSeccion.find((x) => x.tarjetaId === 'tHero')?.pct, 100);
  assert.equal(r.porSeccion.find((x) => x.tarjetaId === 'tPlanes')?.pct, null, 'nadie entró a precios: no medido, no 0');
});

test('de la foto publicada (su HTML dibujado): las secciones de bloques y de diseño, con su título y en orden', () => {
  // La foto guarda el HTML de cada página (publicar.ts), no el documento. Un `id="t-…"` o un `data-seccion` ADENTRO del
  // HTML de un diseño no es una sección: se exige la clase.
  const foto = {
    paginas: [
      {
        ruta: '',
        html: '<nav>Menú</nav><section class="gm-tarjeta gm-ancho" id="t-tHero" data-x="1"><h1 class="t">Vende <b>más</b></h1><p>Hola</p></section>'
          + '<div class="gm-libre-seccion" data-seccion="tCaso"><section class="mkv"><p class="badge">Solo 5 cupos</p><h2>El caso &amp; los números</h2>'
          + '<div id="t-falso" data-seccion="noEs"></div></section></div>'
          + '<div class="gm-libre-seccion" data-seccion="tSinTitulo"><section><p>Sólo un párrafo</p></section></div>',
      },
      { ruta: 'precios', html: '<section id="t-tPlanes" class="gm-tarjeta"><h2>Planes</h2></section>' },
    ],
  };
  assert.deepEqual(seccionesDeLaFoto(foto), [
    { ruta: '', secciones: [{ id: 'tHero', titulo: 'Vende más' }, { id: 'tCaso', titulo: 'El caso & los números' }, { id: 'tSinTitulo', titulo: 'Sólo un párrafo' }] },
    { ruta: 'precios', secciones: [{ id: 'tPlanes', titulo: 'Planes' }] },
  ]);
  assert.deepEqual(seccionesDeLaFoto(null), []);
  assert.deepEqual(seccionesDeLaFoto({ paginas: [{ ruta: '', doc: {} }] }), [], 'sin HTML no hay qué leer');
});

test('lo que se lee del alcance: la API, el Analyst y la pantalla dicen «no se mide», nunca 0', async () => {
  const { analiticaParaApi } = await import('../lib/api-mako/areas/landing-editor.helpers');
  const base = { publicada: true, urls: [INICIO], visitas30: 9, visitantes30: 5, leads30: 1, porDia: [], enAnalyst: false };
  const medida = analiticaParaApi(7, { ...base, alcancePorSeccion: [{ tarjetaId: 'tHero', titulo: 'Hero', pct: 80 }, { tarjetaId: 'tPlanes', titulo: 'Planes', pct: null }], alcanceMedido: { desde: '2026-10-26T10:00:00.000Z', visitantes: 5 } });
  assert.deepEqual(medida.alcance_por_seccion, [{ seccion: 'tHero', titulo: 'Hero', porcentaje: 80 }, { seccion: 'tPlanes', titulo: 'Planes', porcentaje: null }]);
  assert.equal(medida.alcance_medido_desde, '2026-10-26T10:00:00.000Z');
  assert.equal(medida.alcance_visitantes, 5);
  assert.match(medida.nota, /alcance_por_seccion/);
  const sin = analiticaParaApi(7, { ...base, alcancePorSeccion: null, alcanceMedido: null });
  assert.equal(sin.alcance_por_seccion, null);
  assert.equal(sin.alcance_visitantes, null);

  const { textoDeAlcanceSecciones } = await import('../lib/editor-landing/alcance-secciones');
  assert.deepEqual(textoDeAlcanceSecciones(null), [], 'una página de afuera no dice nada');
  const texto = textoDeAlcanceSecciones({ desde: '2026-10-26T10:00:00.000Z', visitantes: 5, secciones: [{ titulo: 'Hero', pct: 80 }, { titulo: 'Planes', pct: null }] }).join('\n');
  assert.match(texto, /1\. «Hero»: 80%/);
  assert.match(texto, /2\. «Planes»: sin visitantes en esa página/);
  assert.doesNotMatch(texto, /«Planes»: 0%/);

  const { textoDeMedicion } = await import('../app/web-generator/editor/dialogos/DialogoAnalitica');
  assert.equal(textoDeMedicion(null), null);
  assert.match(textoDeMedicion({ desde: '2026-10-26T10:00:00.000Z', visitantes: 1 }) ?? '', /^Desde el .+ · 1 visitante$/);
});
