// =============================================================================
// La portada de Copywriting por tandas (13/11/2026)
// =============================================================================
// El Cerebro, con la medición de producción: la portada mandaba los 924 outliers de una (1,19 MB de página, 185 KB comprimidos) y
// abrir Copywriting tardaba. Ahora la página lleva la primera tanda de «Todos» con el total y la cuenta de cada formato
// (`primeraTandaCopy`), y el resto llega al bajar o con «Ver más» desde /api/copywriter (`accion: 'outliers'`), filtrado y ordenado
// en el server con la MISMA función que usa la pantalla. Sin el total (el banco, la API de MaKo), la portada entera, como antes.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FORMATOS_COPY, TANDA_COPY, claveDeConsulta, consultaDeTanda, filtrarOutliersCopy, primeraTandaCopy, sumarTanda, tandaDeOutliersCopy,
  type FormatoCopy, type OutlierCopy, type PortadaCopy,
} from '../lib/copywriter/outliers';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

function outlier(i: number, formato: FormatoCopy): OutlierCopy {
  return {
    id: `spy:${i}`, fuente: 'spy', formato,
    creador: { nombre: `Cuenta ${i % 7}`, usuario: `cuenta${i % 7}`, foto: null, competidorId: null },
    url: `https://www.instagram.com/p/x${i}/`, miniatura: `https://ejemplo.com/${i}.jpg`,
    gancho: i % 50 === 0 ? `Precio alto ${i}` : `Gancho ${i}`, texto: `Texto del outlier ${i}. ${'palabra '.repeat(30)}`,
    deDonde: 'pie', multiplo: null, vistas: 1000 + i, megusta: 10, comentarios: 1, publicada: new Date(Date.UTC(2026, 9, 1) + i * 3_600_000).toISOString(),
  } as OutlierCopy;
}

/** Una portada como la de producción del 13/11: 924 outliers, intercalados por formato. */
function portadaGrande(): PortadaCopy {
  const cuantos: Record<FormatoCopy, number> = { anuncio: 24, reel: 300, carrusel: 300, youtube: 300 };
  const outliers: OutlierCopy[] = [];
  let i = 0;
  for (const f of FORMATOS_COPY) for (let k = 0; k < cuantos[f]; k++) outliers.push(outlier(i++, f));
  return { outliers, caidas: [] };
}

test('la página lleva la primera tanda de «Todos» con el total y la cuenta de cada formato', () => {
  const entera = portadaGrande();
  const p = primeraTandaCopy(entera);
  assert.equal(p.outliers.length, TANDA_COPY);
  assert.deepEqual(p.outliers.map((o) => o.id), filtrarOutliersCopy(entera.outliers, { formato: null, q: '' }, 'outlier').slice(0, TANDA_COPY).map((o) => o.id),
    'los mismos y en el mismo orden que «Todos» por outlier');
  assert.equal(p.total, 924);
  assert.deepEqual(p.porFormato, { anuncio: 24, reel: 300, carrusel: 300, youtube: 300 });
  assert.equal(primeraTandaCopy(p), p, 'recortar dos veces no vuelve a contar sobre la tanda');
  // Lo que viaja: menos de una décima parte (en producción, 1,19 MB → ~60 KB).
  assert.ok(JSON.stringify(p).length < JSON.stringify(entera).length / 10);
});

test('cada tanda sale filtrada y ordenada en el server con la misma función que la pantalla', () => {
  const xs = portadaGrande().outliers;
  const reels = tandaDeOutliersCopy(xs, { filtros: { formato: 'reel', q: '' }, orden: 'recientes', desde: TANDA_COPY });
  const esperado = filtrarOutliersCopy(xs, { formato: 'reel', q: '' }, 'recientes');
  assert.equal(reels.total, 300);
  assert.deepEqual(reels.outliers.map((o) => o.id), esperado.slice(TANDA_COPY, TANDA_COPY * 2).map((o) => o.id), 'la segunda tanda, sin saltear ni repetir');
  const buscado = tandaDeOutliersCopy(xs, { filtros: { formato: null, q: 'precio alto' }, orden: 'outlier', desde: 0 });
  assert.ok(buscado.total > 0 && buscado.outliers.every((o) => /Precio alto/.test(o.gancho)), 'la búsqueda corre sobre TODA la portada, no sobre la tanda');
  const ultima = tandaDeOutliersCopy(xs, { filtros: { formato: 'anuncio', q: '' }, orden: 'outlier', desde: 0 });
  assert.equal(ultima.outliers.length, 24, 'un formato con menos que una tanda viene entero');
});

test('el pedido de una tanda se sanea: lo manda el navegador', () => {
  assert.deepEqual(consultaDeTanda({ formato: 'reel', q: 'hola', orden: 'recientes', desde: 96 }), { filtros: { formato: 'reel', q: 'hola' }, orden: 'recientes', desde: 96 });
  assert.deepEqual(consultaDeTanda({ formato: 'tiktok', q: 7, orden: 'cualquiera', desde: -5 }), { filtros: { formato: null, q: '' }, orden: 'outlier', desde: 0 });
  assert.equal(consultaDeTanda({ desde: 1e12 }).desde, 100_000);
  assert.equal(consultaDeTanda({ q: 'x'.repeat(500) }).filtros.q.length, 120);
  assert.notEqual(claveDeConsulta({ formato: null, q: 'a' }, 'outlier'), claveDeConsulta({ formato: null, q: 'a' }, 'recientes'));
  assert.equal(claveDeConsulta({ formato: 'reel', q: ' Hola ' }, 'outlier'), claveDeConsulta({ formato: 'reel', q: 'hola' }, 'outlier'));
});

test('sumar una tanda no repite: si la portada se volvió a leer entre dos tandas, el orden pudo correrse', () => {
  const [a, b, c] = [outlier(1, 'reel'), outlier(2, 'reel'), outlier(3, 'reel')];
  assert.deepEqual(sumarTanda([a, b], [b, c]).map((o) => o.id), ['spy:1', 'spy:2', 'spy:3']);
});

test('las páginas mandan la primera tanda; la ruta da las demás; la pantalla las pide', () => {
  assert.match(leer('app/copywriter/page.tsx'), /leerOutliersCopy\(\)\.then\(primeraTandaCopy\)/);
  assert.match(leer('app/m/copywriter/page.tsx'), /portada=\{primeraTandaCopy\(await leerOutliersCopy\(\)\)\}/);
  const ruta = leer('app/api/copywriter/route.ts');
  assert.match(ruta, /case 'outliers': \{\n\s+const portada = await leerOutliersCopy\(\);\n\s+return responder\(\{ ok: true as const, \.\.\.tandaDeOutliersCopy\(portada\.outliers, consultaDeTanda\(b\)\) \}\);/);
  assert.ok(ruta.indexOf("soloAdminDeTab('copywriter')") < ruta.indexOf("case 'outliers'"), 'detrás de la misma puerta');
  assert.match(leer('app/copywriter/cliente.ts'), /accion: 'outliers'/);
  const p = leer('app/copywriter/OutliersCopy.tsx');
  assert.match(p, /const remota = portada\.total != null;/);
  assert.match(p, /const r = await pedirOutliers\(\{ \.\.\.consulta, desde \}\);/);
  assert.match(p, /if \(portada\.porFormato\) for \(const f of FORMATOS_COPY\) n\.set\(f, portada\.porFormato\[f\] \?\? 0\);/, 'la cuenta de cada formato es la de toda la portada');
  assert.match(p, /const qPedida = useDiferido\(q, 300\);/, 'lo que se escribe se pide al terminar de escribir, no por letra');
  assert.match(p, /if \(!el \|\| faltan <= 0 \|\| pidiendo \|\| fallo \|\|/, 'una tanda que falló no se vuelve a pedir sola en cada movimiento');
  assert.doesNotMatch(p, /portada\.outliers\.length === 0 \?/, 'el vacío mira el total, no la tanda');
});

test('«De tu tema»: la primera tanda de la página es la del tema, y la que sigue la continúa sin repetir (13/11/2026, el flujo nuevo)', () => {
  // El chat de los outliers: si el segmento abre en «De tu tema» y la página trae la de «Todos», la grilla arranca pidiendo de nuevo.
  const entera = portadaGrande();
  const outliers = entera.outliers.map((o, i) => ({ ...o, deTuTema: i % 3 === 0 }));
  const delTema = outliers.filter((o) => o.deTuTema);
  const porFormatoTema: Partial<Record<FormatoCopy, number>> = {};
  for (const o of delTema) porFormatoTema[o.formato] = (porFormatoTema[o.formato] ?? 0) + 1;
  const p: PortadaCopy = { outliers, caidas: [], tema: { negocio: { id: 'negocios', nombre: 'negocios' }, total: delTema.length, porFormato: porFormatoTema, abre: true } };
  const t = primeraTandaCopy(p);
  assert.equal(t.outliers.length, TANDA_COPY);
  assert.ok(t.outliers.every((o) => o.deTuTema), 'la primera tanda es la del tema');
  assert.equal(t.total, outliers.length, 'el total es el de TODA la portada («Todo»)');
  assert.equal(t.tema?.total, delTema.length, 'y el del tema viaja aparte');
  assert.deepEqual(t.tema?.porFormato, porFormatoTema);
  // La segunda tanda, pedida como la pide la pantalla (`tema: true` en los filtros), sigue donde terminó la primera.
  const segunda = tandaDeOutliersCopy(outliers, consultaDeTanda({ tema: true, desde: TANDA_COPY }));
  assert.equal(segunda.total, delTema.length);
  assert.equal(sumarTanda(t.outliers, segunda.outliers).length, TANDA_COPY * 2, 'sin repetidos');
  // La clave cambia con el tema: cambiar de segmento vuelve a pedir desde la primera.
  assert.notEqual(claveDeConsulta({ formato: null, q: '', tema: true }, 'outlier'), claveDeConsulta({ formato: null, q: '' }, 'outlier'));
  // La pantalla arranca con la clave del tema si la portada abre ahí (si no, pediría de nuevo la primera tanda).
  const pantalla = leer('app/copywriter/OutliersCopy.tsx');
  assert.ok(pantalla.includes("clave: claveDeConsulta({ formato: null, q: '', tema: !!portada.tema?.abre }, 'outlier'), items: portada.outliers,"));
  assert.ok(pantalla.includes('const [tema, setTema] = useState(!!portada.tema?.abre);'));
  // Sin `tema` (una portada que no lo calculó), la primera tanda es la de «Todos», como antes.
  assert.ok(!('tema' in primeraTandaCopy(entera)));
});
