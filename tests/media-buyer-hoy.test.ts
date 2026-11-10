// =============================================================================
// Media Buyer — HOY como la captura 04 de AdAmigo (25/10/2026 noche)
// =============================================================================
// Martín rechazó dos veces la pantalla por la cantidad de botones y de texto. La meta, medible: cada tarjeta lleva UN botón
// a la vista («Aplicar») y ni el porqué ni el «Qué · Por qué · Impacto» (eso vive en el detalle que se abre al tocarla); las
// ramas son los productos del CRM; el mensaje del pie dice qué propone y que todo se deshace.
// Correr: node --import tsx --test tests/media-buyer-hoy.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { cambioCorto, columnasDeHoy, deHoy, mensajeDeCampanas, mensajeDeHoy, pildoraDeCampanas, pildoraDeHoy, ramasDeHoy, rotuloDe } from '../app/ads-manager/mb-modelo';
import { ArbolDeHoy, TarjetaChica } from '../app/ads-manager/Arbol';
import type { Decision } from '../lib/media-buyer/tipos';

const AHORA = Date.parse('2026-10-25T18:00:00Z');
const D = (x: Partial<Decision>): Decision => ({
  id: 'd1', ws: 9, clave: 'k', tipo: 'subir_presupuesto', tactica: 'surf', nivel: 'adset', entidadId: 's1', entidadNombre: 'Dueños de pymes',
  campanaNombre: '030 · Mentoría', titulo: 'Escalar', titular: 'Trajo 14 leads a US$ 6,40', porque: ['Gasta el 98%'], numeros: [],
  antes: { presupuesto: 30 }, despues: { presupuesto: 36 }, moneda: 'USD', estado: 'abierta', creada: '2026-10-25T10:00:00Z',
  origen: null, aplicadaPor: null, aplicadaAt: null, deshechaPor: null, deshechaAt: null, canal: null, error: null, nota: null,
  motivoDescarte: null, estrellas: null, creados: [], anuncioBase: null, ...x,
} as Decision);

const cuantos = (html: string, re: RegExp) => (html.match(re) ?? []).length;
const tarjeta = (d: Decision) => renderToStaticMarkup(createElement(TarjetaChica, { d, producto: 'Mentoría 1 a 1', ocupada: false, encendido: true, onAbrir: () => {}, onAplicar: () => {} }));

test('la tarjeta chica: UN botón a la vista, el cambio con sus números, y nada del porqué', () => {
  const html = tarjeta(D({}));
  // El botón que cubre la tarjeta (abre el detalle) no se ve: a la vista queda sólo «Aplicar».
  assert.equal(cuantos(html, /<button/g) - cuantos(html, /aa-chica-abrir/g), 1, 'un solo botón a la vista');
  assert.match(html, />Aplicar</);
  assert.match(html, /Mentoría 1 a 1/);
  assert.match(html, /Meta · 030 · Mentoría/);
  assert.match(html, /\$30[^]*→[^]*\$36 \/ día[^]*\+20%/);
  for (const fuera of ['Por qué', '>Qué<', 'Impacto', 'Preguntar', 'Editar', 'Trajo 14 leads', 'Gasta el 98%']) {
    assert.ok(!html.includes(fuera), `«${fuera}» no va en la tarjeta`);
  }
  const hecha = tarjeta(D({ estado: 'aplicada', aplicadaAt: '2026-10-25T12:00:00Z' }));
  assert.equal(cuantos(hecha, /<button/g) - cuantos(hecha, /aa-chica-abrir/g), 0, 'aplicada: sin botones, la marca');
  assert.match(hecha, /Aplicado/);
});

test('el rótulo chico dice qué es esa entidad para el cambio (el «BEST AD SET» de la 04)', () => {
  assert.equal(rotuloDe({ tactica: 'surf', nivel: 'adset', tipo: 'subir_presupuesto' }), 'Mejor conjunto');
  assert.equal(rotuloDe({ tactica: 'surf', nivel: 'campaign', tipo: 'subir_presupuesto' }), 'Mejor campaña');
  assert.equal(rotuloDe({ tactica: 'stop_loss', nivel: 'ad', tipo: 'pausar' }), 'Gasta sin resultados');
  assert.equal(rotuloDe({ tactica: 'ganador', nivel: 'ad', tipo: 'variaciones_hook' }), 'Video ganador');
  assert.equal(rotuloDe({ tactica: 'manual', nivel: 'adset', tipo: 'pausar' }), 'Tu regla');
});

test('el cambio corto: presupuesto con su %, prendido → pausado, o cuántos textos nuevos', () => {
  assert.deepEqual(cambioCorto(D({})), { antes: '$30', despues: '$36 / día', pct: '+20%', sube: true });
  assert.equal(cambioCorto(D({ tipo: 'bajar_presupuesto', despues: { presupuesto: 24 } })).pct, '-20%');
  assert.deepEqual(cambioCorto(D({ tipo: 'pausar', antes: { estado: 'ACTIVE' }, despues: { estado: 'PAUSED' } })), { antes: 'Prendido', despues: 'Pausado', pct: null, sube: false });
  const v = D({ tipo: 'variaciones_texto', antes: {}, despues: {}, variaciones: [{ id: 'a', textoPrincipal: 'x', elegida: true }, { id: 'b', textoPrincipal: 'y', elegida: false }] });
  assert.deepEqual(cambioCorto(v), { antes: null, despues: '2 textos nuevos', pct: null, sube: true });
});

test('HOY: lo abierto, lo frenado y lo aplicado HOY; no lo de ayer ni lo descartado', () => {
  const ds = [
    D({ id: 'a' }), D({ id: 'b', estado: 'bloqueada' }),
    D({ id: 'c', estado: 'aplicada', aplicadaAt: new Date(AHORA - 3600_000).toISOString() }),
    D({ id: 'd', estado: 'aplicada', aplicadaAt: new Date(AHORA - 3 * 86400_000).toISOString() }),
    D({ id: 'e', estado: 'descartada' }),
  ];
  assert.deepEqual(deHoy(ds, AHORA).map((d) => d.id), ['a', 'b', 'c']);
});

test('las ramas son los productos (lo sin producto al final); con UN producto, cada cambio es su propia rama', () => {
  const de: Record<string, string | null> = { a: 'Curso', b: null, c: 'Mentoría', d: 'Curso' };
  const ramas = ramasDeHoy([D({ id: 'a' }), D({ id: 'b' }), D({ id: 'c' }), D({ id: 'd' })], (d) => de[d.id]);
  assert.deepEqual(ramas.map((r) => [r.producto, r.decisiones.map((d) => d.id)]), [['Curso', ['a', 'd']], ['Mentoría', ['c']], [null, ['b']]]);
  const una = columnasDeHoy(ramasDeHoy([D({ id: 'a' }), D({ id: 'b' }), D({ id: 'c' }), D({ id: 'd' })], () => 'Curso'));
  assert.deepEqual(una.map((c) => c.decisiones.map((d) => d.id)), [['a', 'd'], ['b'], ['c']]);
});

test('la pastilla y el mensaje del pie: qué propone (o qué hizo) y que se deshace', () => {
  const ds = [D({ id: 'a' }), D({ id: 'b', tactica: 'stop_loss', tipo: 'pausar' })];
  assert.equal(pildoraDeHoy(ds, 2), '2 cambios para hoy en 2 productos');
  assert.equal(pildoraDeHoy(ds, 1), '2 cambios para hoy');
  assert.equal(mensajeDeHoy(ds, 'lead'), 'Hoy te propongo subir lo que trae leads más baratos y pausar lo que gasta sin traer leads. Cada cambio queda en Actividad: puedes deshacer cualquiera.');
  const hechas = ds.map((d) => ({ ...d, estado: 'aplicada' as const }));
  assert.equal(pildoraDeHoy(hechas, 2), '2 cambios aplicados en 2 productos');
  assert.match(mensajeDeHoy(hechas, 'agenda'), /^Listo: subir lo que trae agendas más baratos/);
});

test('el árbol: una tarjeta por cambio, la pastilla arriba y «Aplicar los N» al pie sólo con más de uno abierto', () => {
  const ds = [D({ id: 'a' }), D({ id: 'b', entidadNombre: 'Retargeting' }), D({ id: 'c', estado: 'aplicada', aplicadaAt: '2026-10-25T12:00:00Z' })];
  const props = { productoDe: () => 'Mentoría 1 a 1', kpi: 'lead' as const, ocupada: null, encendido: true, avatar: null, onAbrir: () => {}, onAplicar: () => {}, onAplicarTodas: () => {} };
  const html = renderToStaticMarkup(createElement(ArbolDeHoy, { ...props, decisiones: ds }));
  assert.equal(cuantos(html, /class="aa-chica"/g), 3);
  assert.match(html, /<b>MaKo<\/b> · 2 cambios para hoy/);
  assert.match(html, />Aplicar los 2</);
  const uno = renderToStaticMarkup(createElement(ArbolDeHoy, { ...props, decisiones: [ds[0]] }));
  assert.doesNotMatch(uno, /Aplicar los/);
});

test('Campañas: la pastilla, y al pie el producto más barato y el más caro, o qué hacer con lo que no tiene producto', () => {
  const f = (n: number) => `$${n}`;
  assert.equal(pildoraDeCampanas(6, 3), '6 campañas en 3 productos');
  assert.equal(pildoraDeCampanas(1, 1), '1 campaña');
  // Producción, 10/11/2026: la cuenta vacía decía «0 campañas en 3 productos». El lienzo cuenta sólo los productos con campañas.
  assert.equal(pildoraDeCampanas(0, 0), '0 campañas');
  assert.match(readFileSync(join(import.meta.dirname, '..', 'app/ads-manager/Lienzo.tsx'), 'utf8'), /pildoraDeCampanas\(todas\.length, l\.productos\.filter\(\(p\) => p\.campanas\.length\)\.length\)/);
  const ps = [{ nombre: 'Curso', costo: 14 }, { nombre: 'Mentoría', costo: 8 }, { nombre: 'Comunidad', costo: null }];
  assert.equal(mensajeDeCampanas(ps, 0, 'lead', f), '«Mentoría» trae los leads más baratos ($8) y «Curso», los más caros ($14). Toca una campaña para ver sus números o cambiarla de producto.');
  assert.equal(mensajeDeCampanas([{ nombre: 'Curso', costo: 14 }], 2, 'agenda', f), '«Curso»: $14 por agenda este mes. 2 campañas no tienen producto: tócalas para asignarles uno.');
});

test('la caja lleva a la izquierda la foto de quien pide, como la 04 (la de su perfil: MiFoto; sin foto, su inicial)', () => {
  const leer = (f: string) => readFileSync(join(import.meta.dirname, '..', f), 'utf8').replace(/\r\n/g, '\n');
  assert.match(leer('app/ads-manager/Hoy.tsx'), /<div className="aa-orden">\s*<MiFoto\b/, 'computadora: la foto, antes de la caja');
  assert.match(leer('app/m/ads/MediaBuyerM.tsx'), /className="aa-orden-m".*?\}><MiFoto\b/, 'teléfono: la foto, antes del texto');
});
