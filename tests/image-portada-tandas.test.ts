// =============================================================================
// La portada de Image por tandas (13/11/2026)
// =============================================================================
// Medido en producción el 13/11: /image-editor mandaba con la página los 1.301 carruseles y anuncios (2,1 MB) y las miniaturas de
// YouTube (1,1 MB): 3,4 MB. Ahora la página trae lo que se ve primero con los totales (`primeraTandaExplorador`,
// app/image-editor/carruseles/tanda.ts) y la pantalla pide el resto apenas se dibuja (GET /api/image-editor/explorador); las
// miniaturas, al abrir «Thumbnails». Los filtros de Image se siguen calculando en el navegador sobre TODOS.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FILTROS_INICIALES, filtrarCarruseles, type Carrusel } from '../lib/carruseles/explorar';
import { PRIMERA_TANDA_IMAGE, primeraTandaExplorador } from '../app/image-editor/carruseles/tanda';
import type { DatosExplorador } from '../app/image-editor/carruseles/ExplorarCarruseles';

const leer = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const carrusel = (i: number, o: Partial<Carrusel> = {}): Carrusel => ({
  id: i, competidorId: i % 9, origen: i % 3 === 0 ? 'cuentas' : 'biblioteca', creador: { nombre: `Cuenta ${i % 9}`, usuario: `c${i % 9}`, foto: null },
  url: `https://www.instagram.com/p/x${i}/`, miniatura: `https://ejemplo.com/${i}.jpg`, texto: `Texto ${i}`, gancho: `Gancho ${i}`, tipoGancho: null,
  cierre: null, formato: 'lista', medio: 'carrusel', laminas: 5, megusta: 100 + i, comentarios: 10, publicada: '2026-10-01T00:00:00Z',
  traida: '2026-10-02T00:00:00Z', outlier: (i % 40) / 4, ...o,
});

function datos(n: number): DatosExplorador {
  return {
    carruseles: Array.from({ length: n }, (_, i) => carrusel(i + 1, i % 10 === 0 ? { clase: 'anuncio' } : {})),
    guardados: [3, 7], busquedas: [], paso: 'listo', frase: '', accion: null, ejemplos: 800, avisoBiblioteca: null, anuncios: 130,
    thumbnails: { ok: true, lista: Array.from({ length: 300 }, (_, i) => ({ id: i }) as never), guardados: [5], sinTablas: false },
  };
}

test('la página trae lo que se ve primero, con los totales que la pantalla muestra antes de tener el resto', () => {
  const d = datos(1301);
  const p = primeraTandaExplorador(d, FILTROS_INICIALES, Date.UTC(2026, 10, 13));
  const vistos = filtrarCarruseles(d.carruseles, FILTROS_INICIALES, new Set(d.guardados), Date.UTC(2026, 10, 13));
  assert.equal(p.carruseles.length, PRIMERA_TANDA_IMAGE);
  assert.deepEqual(p.carruseles.map((c) => c.id), vistos.slice(0, PRIMERA_TANDA_IMAGE).map((c) => c.id), 'los mismos y en el orden de la grilla');
  assert.deepEqual(p.pendiente, {
    carruseles: 1301, vistos: vistos.length, thumbnails: 300,
    propios: d.carruseles.filter((c) => c.origen === 'cuentas' && c.clase !== 'anuncio').length,
  });
  assert.ok(p.thumbnails && p.thumbnails.ok && p.thumbnails.lista.length === 0 && p.thumbnails.guardados[0] === 5, 'las miniaturas, al abrir «Thumbnails»; lo guardado viaja');
  assert.deepEqual(p.guardados, [3, 7]);
  assert.equal(p.anuncios, 130);
  assert.equal(primeraTandaExplorador(p, FILTROS_INICIALES), p, 'recortar dos veces no cuenta sobre la tanda');
  assert.ok(JSON.stringify(p).length < JSON.stringify(d).length / 10);
});

test('con «Thumbnails» de entrada viaja todo: se mira la otra lista', () => {
  const d = datos(50);
  assert.equal(primeraTandaExplorador(d, { ...FILTROS_INICIALES, que: 'thumbnails' }), d);
});

test('las páginas mandan la primera tanda; la ruta da el resto detrás de la puerta del Image Editor; la pantalla lo pide', () => {
  assert.match(leer('app/image-editor/page.tsx'), /datos: primeraTandaExplorador\(\{[\s\S]*?\}, filtrosDeQuery\(q\)\),/);
  assert.match(leer('app/m/image-editor/page.tsx'), /datos=\{primeraTandaExplorador\(\{[\s\S]*?\}, filtrosDeQuery\(q\)\)\} \/>/);
  const ruta = leer('app/api/image-editor/explorador/route.ts');
  assert.match(ruta, /export async function GET\(req: NextRequest\) \{\n\s+const p = await puerta\(\);\n\s+if \(p instanceof Response\) return p;/, 'un GET: sólo lee');
  assert.match(ruta, /runWithWorkspace\(p\.ws, \(\) => leerExplorador\(\)\)/);
  assert.match(ruta, /runWithWorkspace\(p\.ws, \(\) => leerThumbnails\(\)\)/);
  const e = leer('app/image-editor/carruseles/ExplorarCarruseles.tsx');
  assert.match(e, /pedirResto<\{ carruseles: Carrusel\[\] \}>\('carruseles'\)/, 'el resto de los carruseles, apenas se dibuja');
  assert.match(e, /if \(!enThumbs \|\| !faltanMiniaturas\) return;/, 'las miniaturas, sólo al abrir «Thumbnails»');
  assert.match(e, /const hayAlgo = datos\.carruseles\.length > 0 \|\| !!pendiente\?\.carruseles;/, 'con la primera tanda no es «no hay nada»');
  assert.match(e, /\{listas\.length === 0 && pendiente && !falloResto \? \(/, 'mientras llega el resto, un filtro sin resultados todavía no dice «ninguno»');
});
