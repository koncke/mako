// =============================================================================
// La galería de los 20 templates no puede mentir sobre qué está hecho (7/11/2026)
// =============================================================================
// ⚠️ POR QUÉ EXISTE. `docs/diseno/mockups-dashboard/index.html` decía **«6 de 21»** y mostraba quince hojas
// atenuadas, como si no existieran. En el disco había **dieciocho** construidas: cada una se fue haciendo en
// su carpeta (`<hoja>/mako.html`) y nadie volvió al índice a marcarla.
//
// Y esta galería es exactamente donde Martín las aprueba «**antes** de que nada vaya al código» (el README de
// esa carpeta lo dice así). O sea que doce hojas terminadas eran invisibles para la única persona que tiene
// que verlas — y el síntoma que llegaba arriba era «faltan quince dashboards», que es falso y además
// desalienta: parece que el trabajo no avanzó.
//
// Peor: las seis que SÍ se veían apuntaban a los archivos sueltos de la raíz, que son los del lote 1 y
// quedaron viejos (Landing: 12 KB contra los 46 KB de `landing-corbel/mako.html`). De las seis visibles se
// estaba mirando la versión anterior.
//
// LA REGLA: un índice escrito a mano se desincroniza EN SILENCIO, y su modo de falla es el peor que hay —
// decir que falta trabajo que está hecho. Es la misma familia que `docs/hallazgos.md` y su índice, que por eso
// se tocan en el mismo commit. Acá no alcanza con la costumbre: lo mira este test.
//
// Correr: node --import tsx --test tests/mockups-dashboard-indice.test.ts
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const DIR = join(import.meta.dirname, '..', 'docs/diseno/mockups-dashboard');
const INDICE = join(DIR, 'index.html');

type Fila = { adaptacion: string; nombre: string; referencia: string; hecha: boolean; copia: string };

/** Lee la tabla `HOJAS` del índice. Si cambia de forma, esto se rompe y hay que mirarlo: es la fuente. */
function filasDelIndice(): Fila[] {
  const src = readFileSync(INDICE, 'utf8');
  const filas = [...src.matchAll(/\[\s*'([^']*)',\s*'([^']+)',\s*'([^']+)',\s*([01]),\s*'([^']*)'\s*\]/g)];
  return filas.map((m) => ({ adaptacion: m[1], nombre: m[2], referencia: m[3], hecha: m[4] === '1', copia: m[5] }));
}

/** Las carpetas de hoja que hay EN EL DISCO (las de apoyo no cuentan). */
const APOYO = new Set(['demos', 'medidor', 'captura']);
function carpetasEnDisco(): string[] {
  return readdirSync(DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !APOYO.has(d.name))
    .map((d) => d.name);
}

/** La adaptación de una carpeta: `mako.html`, o el html propio que no sea la copia. */
function adaptacionDe(carpeta: string): string | null {
  const dentro = readdirSync(join(DIR, carpeta)).filter((f) => f.endsWith('.html') && f !== 'copia.html');
  return dentro[0] ?? null;
}

test('el índice tiene filas y se pudo leer', () => {
  // Si el formato de `HOJAS` cambia, los otros tests pasarían con cero filas sin notarlo: un verde vacío.
  assert.ok(filasDelIndice().length >= 20, 'el índice tiene menos de 20 hojas: ¿cambió el formato de la tabla?');
});

test('ninguna hoja marcada como hecha apunta a un archivo que no existe', () => {
  for (const f of filasDelIndice()) {
    if (!f.hecha) continue;
    assert.ok(f.adaptacion, `«${f.nombre}» está marcada como hecha y no tiene archivo`);
    assert.ok(existsSync(join(DIR, f.adaptacion)), `«${f.nombre}» apunta a ${f.adaptacion}, que no existe`);
  }
});

test('la copia de referencia de cada fila existe, si la fila la nombra', () => {
  // La copia es lo único que se puede mirar de una hoja pendiente: si la ruta está rota, el botón abre vacío.
  for (const f of filasDelIndice()) {
    if (!f.copia) continue;
    assert.ok(existsSync(join(DIR, f.copia)), `la copia de «${f.nombre}» apunta a ${f.copia}, que no existe`);
  }
});

test('⚠️ TODA hoja construida en el disco está marcada como hecha en el índice', () => {
  // ESTE es el test que caza el bug original. Una hoja se termina en su carpeta y el índice sigue diciendo
  // que falta: nadie se entera, porque nada falla — simplemente no se ve.
  const enElIndice = new Map(filasDelIndice().map((f) => [f.adaptacion, f]));
  const olvidadas: string[] = [];
  for (const carpeta of carpetasEnDisco()) {
    const adap = adaptacionDe(carpeta);
    if (!adap) continue;                               // sin adaptación todavía: pendiente de verdad
    const ruta = `${carpeta}/${adap}`;
    const fila = enElIndice.get(ruta);
    if (!fila || !fila.hecha) olvidadas.push(ruta);
  }
  assert.deepEqual(olvidadas, [],
    `hay hojas construidas que el índice no muestra como hechas: ${olvidadas.join(', ')}. ` +
    'Al terminar una hoja se marca en index.html, en el MISMO commit.');
});

test('toda carpeta del disco aparece en el índice, aunque esté a medias', () => {
  // Una carpeta que no está en ninguna fila es trabajo invisible: no se puede ni mirar la referencia copiada.
  const nombrados = new Set(filasDelIndice().flatMap((f) => [f.adaptacion, f.copia].filter(Boolean).map((r) => r.split('/')[0])));
  const sueltas = carpetasEnDisco().filter((c) => !nombrados.has(c));
  assert.deepEqual(sueltas, [], `carpetas que no aparecen en el índice y nadie puede ver: ${sueltas.join(', ')}`);
});

test('el índice no apunta a los archivos VIEJOS sueltos de la raíz', () => {
  // Los `general.html`, `comercial.html`, `landing.html`… de la raíz son el lote 1 y quedaron atrás. Apuntar
  // ahí es mostrar una versión anterior creyendo que es la actual, que es cómo empezó este bug.
  for (const f of filasDelIndice()) {
    if (!f.hecha) continue;
    assert.ok(f.adaptacion.includes('/'),
      `«${f.nombre}» apunta a ${f.adaptacion}, un archivo suelto de la raíz: ésa es la versión vieja`);
  }
});
