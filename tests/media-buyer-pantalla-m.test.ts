// =============================================================================
// Media Buyer — Ajustes, Automatizaciones, Protect y Campañas con la densidad de «Hoy» (27/10/2026)
// =============================================================================
// Martín rechazó una versión del Media Buyer por «una cantidad de botones y texto impresionante» y aprobó Hoy (la captura 04 de
// AdAmigo: la caja del chat, el árbol y una línea al pie). Lo que quedaba con la hoja de Madgicx (mb.css) pasó a esa densidad:
// Ajustes y Automatizaciones con el molde de Settings de la casa (las filas de Linear, app/_ui/Ajustes.tsx), Protect como la
// lista de Actividad, y Campañas y Biblioteca con la caja del chat arriba como Hoy (los números del mes, una línea del pie).
// Correr: node --import tsx --test tests/media-buyer-pantalla-m.test.ts
//
// Roturas (base 5/0, cada una restaurada antes de la siguiente; todas dan 4/1): volver a poner un «Guardar» en Ajustes; mandar
// un monto ilegible como NaN (viaja como null); un interruptor por táctica en Automatizaciones; la página sin pasar `?t=`; Protect
// con el ícono en caja de antes; los números del mes como tarjetas otra vez; un `import '../mb.css'` de vuelta.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Ajustes } from '../app/ads-manager/Ajustes';
import { Automatizaciones } from '../app/ads-manager/Automatizaciones';
import { AlertasProtect } from '../app/ads-manager/Autopilot';
import { lineaDelMes } from '../app/ads-manager/mb-modelo';
import type { CupoMediaBuyer } from '../lib/media-buyer/plan';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const texto = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
const CONFIG = {
  encendido: true, modo: 'propone' as const, kpi: 'lead' as const, objetivo: 25, subidaMaxPctDia: 20, presupuestoMaxDia: null, metaVentasMes: null,
  metaGastoMes: null, cuentaPublicitaria: null, tacticas: { surf: { estado: 'automatica' as const }, revive: { estado: 'apagada' as const } },
  ultimaCorrida: null, ultimaCorridaInfo: null, existeTabla: true,
};
const PRO = { piloto: true, recomendacionesDia: null } as unknown as CupoMediaBuyer;

test('Ajustes: filas de nombre y control, sin «Guardar» (guarda al instante) y sin una ayuda por campo', () => {
  const html = renderToStaticMarkup(createElement(Ajustes, { config: CONFIG as never, cupo: PRO }));
  assert.match(html, /class="aj-fila"/, 'el molde de Settings de la casa');
  assert.doesNotMatch(texto(html), /\bGuardar\b/);
  assert.ok((html.match(/<button/g) ?? []).length <= 7, 'el interruptor, el modo, el resultado y conectar: nada más');
  assert.doesNotMatch(html, /mk-hint|mba-/, 'sin la ayuda debajo de cada campo de antes');
  const src = sinComentarios(leer('app/ads-manager/Ajustes.tsx'));
  // Un monto que no se entiende NO sale: `JSON.stringify(NaN)` es null, y el «NaN para que lo rechace el servidor» lo BORRABA.
  assert.doesNotMatch(src, /Number\.NaN/);
  assert.match(src, /const n = leerMonto\(s\);\s*if \(n == null\) \{ show\(/);
});

test('Automatizaciones: una fila por táctica con su estado y la flecha a su detalle; `?t=` lo abre', () => {
  const html = renderToStaticMarkup(createElement(Automatizaciones, { config: CONFIG as never, decisiones: [], cupo: PRO, abrir: null }));
  for (const n of ['Stop Loss', 'Surf', 'Revive', 'Ganador']) assert.match(texto(html), new RegExp(n));
  assert.match(texto(html), /Surf Toda la cuenta · todavía nada Automática/);
  assert.match(texto(html), /Revive Toda la cuenta · todavía nada Apagada/);
  assert.equal((html.match(/role="switch"/g) ?? []).length, 0, 'sin un interruptor por táctica: el estado se cambia en su detalle');
  assert.doesNotMatch(html, /mb-|mba-/);
  const pagina = sinComentarios(leer('app/ads-manager/automatizaciones/page.tsx'));
  assert.match(pagina, /abrir=\{abrir\}/, 'el link del lápiz y de la tuerca (`?t=surf`) abre la táctica');
  assert.match(pagina, /\(ORDEN_TACTICAS as string\[\]\)\.includes\(sp\.t\)/);
});

test('Protect: una fila por alerta, con su punto y UN botón', () => {
  const html = renderToStaticMarkup(createElement(AlertasProtect, { onPreguntar: () => {}, alertas: [
    { id: 'a', tipo: 'gasto', gravedad: 'alta', titulo: 'Se disparó el gasto', detalle: '3 días a $80, contra $30.' },
    { id: 'b', tipo: 'tope', gravedad: 'media', titulo: 'Cerca de tu tope', detalle: '$95 de $100.' },
  ] }));
  assert.equal((html.match(/<li/g) ?? []).length, 2);
  assert.equal((html.match(/<button/g) ?? []).length, 2);
  assert.doesNotMatch(html, /aa-alerta|<svg/, 'sin la tarjeta con el ícono en caja de antes');
  // Y el aviso de Hoy también lleva a las de cuidado (antes, sólo a las graves).
  assert.match(sinComentarios(leer('app/ads-manager/MediaBuyer.tsx')), /\{alertas\.length > 0 && \(\s*<button type="button" className="aa-aviso"/);
});

test('Campañas y Biblioteca: la caja del chat arriba como Hoy, y los números del mes en una línea del pie', () => {
  const m = { desde: '2026-10-01', hasta: '2026-10-27', diasQuedan: 4, gasto: 700, caja: 0, resultados: { leads: 35, agendas: 7, ventas: 1 }, moneda: 'USD', convierte: true };
  assert.deepEqual(lineaDelMes(m, 'lead', 25), { texto: 'Este mes: $700 gastados · 35 leads · $20 por lead (tu objetivo: $25)', tono: 'bien' });
  assert.deepEqual(lineaDelMes(m, 'venta', 500), { texto: 'Este mes: $700 gastados · 1 venta · $700 por venta (tu objetivo: $500)', tono: 'mal' });
  assert.deepEqual(lineaDelMes({ ...m, resultados: { leads: 0, agendas: 0, ventas: 0 } }, 'lead', null), { texto: 'Este mes: $700 gastados · 0 leads', tono: null });
  const mb = sinComentarios(leer('app/ads-manager/MediaBuyer.tsx'));
  assert.doesNotMatch(mb, /NumerosDelMes/, 'las tres tarjetas del mes arriba del árbol se fueron');
  assert.match(mb, /<CajaDeOrden placeholder="Pregúntale a MaKo por tus campañas" onPedir=\{pedir\} \/>\s*<LienzoCampanas[^>]*mes=\{metas \? lineaDelMes\(/);
  assert.match(mb, /<CajaDeOrden placeholder="Pídele variaciones de un anuncio" onPedir=\{pedir\} \/>\}\s*<Biblioteca/);
  assert.match(sinComentarios(leer('app/ads-manager/Lienzo.tsx')), /\{mes && <p className="aa-pie-mes"/);
});

test('mb.css (la hoja de Madgicx) no vuelve: nada la importa y ninguna pantalla usa sus clases', () => {
  assert.equal(existsSync(join(RAIZ, 'app/ads-manager/mb.css')), false);
  assert.equal(existsSync(join(RAIZ, 'app/ads-manager/mb-paleta.css')), false);
  for (const dir of ['app/ads-manager', 'app/ads-manager/ajustes', 'app/ads-manager/automatizaciones', 'app/m/ads']) {
    for (const f of readdirSync(join(RAIZ, dir)).filter((x) => /\.tsx?$/.test(x))) {
      const src = sinComentarios(leer(`${dir}/${f}`));
      assert.doesNotMatch(src, /mb\.css|mb-paleta/, `${dir}/${f} importa la hoja vieja`);
      assert.doesNotMatch(src, /className="mba?-/, `${dir}/${f} usa una clase de la hoja vieja`);
    }
  }
});
