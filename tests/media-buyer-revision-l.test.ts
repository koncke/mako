// =============================================================================
// Media Buyer — las 10 fallas de la revisión adversarial de tren-l (26/10/2026)
// =============================================================================
// El detalle de cada una (escenario, por qué no se pudo refutar, arreglo) está en las notas del Cerebro:
// side-session-notes/…/revision-tren-l-2.md, hallazgos 0 a 9. Cada test dice cuál fija; los de plata primero.
// Correr: node --import tsx --test tests/media-buyer-revision-l.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { aplicablesEnLote, leerMonto } from '../app/ads-manager/mb-modelo';
import { ArbolDeHoy, TarjetaChica } from '../app/ads-manager/Arbol';
import { TarjetaAccion } from '../app/ads-manager/Autopilot';
import { presupuestoYaCambiado, seEstaCreando } from '../lib/media-buyer/topes';
import { montoDelTexto } from '../lib/media-buyer/monto';
import { mezclarTacticas } from '../lib/media-buyer/tacticas';
import { resumenParaAgente } from '../lib/media-buyer/agentes-propios';
import { leerRespuesta, opcionesDe, pasoDeArranque, type RespuestasArranque } from '../lib/media-buyer/arranque';
import { alertasProtect } from '../lib/media-buyer/protect';
import { recomendadasHoy } from '../lib/media-buyer/plan';
import type { Decision } from '../lib/media-buyer/tipos';
import type { NodoMB, SenalMB } from '../lib/media-buyer/motor';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const D = (x: Partial<Decision>): Decision => ({
  id: 'd1', ws: 9, clave: 'k', tipo: 'subir_presupuesto', tactica: 'surf', nivel: 'adset', entidadId: 's1', entidadNombre: 'Dueños de pymes',
  campanaNombre: '030 · Mentoría', titulo: 'Escalar', titular: 'Trajo 14 leads', porque: [], numeros: [],
  antes: { presupuesto: 30 }, despues: { presupuesto: 36 }, moneda: 'USD', estado: 'abierta', creada: '2026-10-25T10:00:00Z',
  origen: null, aplicadaPor: null, aplicadaAt: null, deshechaPor: null, deshechaAt: null, canal: null, error: null, nota: null,
  motivoDescarte: null, estrellas: null, creados: [], anuncioBase: null, ...x,
} as Decision);
const VARS = D({ id: 'v', tipo: 'variaciones_texto', tactica: 'ganador', nivel: 'ad', antes: {}, despues: {},
  variaciones: [1, 2, 3, 4].map((i) => ({ id: `t${i}`, textoPrincipal: `Texto ${i}`, elegida: true })) });
const botonesVisibles = (html: string) => (html.match(/<button/g) ?? []).length - (html.match(/aa-chica-abrir/g) ?? []).length;

// ── 0: los textos de la IA no salen sin que alguien los lea ──────────────────────────────────────────────────────────────

test('0 · la tarjeta de textos nuevos no los lanza: «Ver textos» abre su hoja; «Aplicar los N» no los cuenta', () => {
  const html = renderToStaticMarkup(createElement(TarjetaChica, { d: VARS, producto: 'Mentoría', ocupada: false, encendido: true, onAbrir: () => {}, onAplicar: () => {} }));
  assert.match(html, />Ver textos</);
  assert.doesNotMatch(html, />Aplicar</, 'la tarjeta de variaciones no tiene «Aplicar»');
  assert.equal(botonesVisibles(html), 1);
  assert.deepEqual(aplicablesEnLote([D({ id: 'a' }), VARS, D({ id: 'b', estado: 'aplicada' })]).map((d) => d.id), ['a']);
  const props = { productoDe: () => 'Mentoría', kpi: 'lead' as const, ocupada: null, encendido: true, avatar: null, onAbrir: () => {}, onAplicar: () => {}, onAplicarTodas: () => {} };
  const arbol = renderToStaticMarkup(createElement(ArbolDeHoy, { ...props, decisiones: [D({ id: 'a' }), D({ id: 'b', entidadId: 's2' }), VARS] }));
  assert.match(arbol, />Aplicar los 2</, 'el lote cuenta los dos cambios de presupuesto, no los textos');
});

test('0 · la hoja muestra TODOS los textos, y el servidor no lanza textos de una persona sin elegidas explícitas', () => {
  assert.doesNotMatch(sinComentarios(leer('app/ads-manager/Autopilot.tsx')), /variaciones \?\? \[\]\)\.slice\(0, mas/, 'se veían 2 y salían 4');
  const ej = sinComentarios(leer('lib/media-buyer/ejecutar.ts'));
  assert.match(ej, /if \(quien\.origen === 'persona' && !elegidas\) return \{ ok: false/);
  const mb = sinComentarios(leer('app/ads-manager/MediaBuyer.tsx'));
  assert.match(mb, /for \(const d of aplicablesEnLote\(hoy\)\)/, '«Aplicar los N» de la computadora');
  assert.match(sinComentarios(leer('app/m/ads/MediaBuyerM.tsx')), /for \(const d of aplicablesEnLote\(hoy\)\)/, 'y del teléfono');
  // La API de MaKo: la confirmación lista los textos que salen y los manda explícitos.
  const api = sinComentarios(leer('lib/api-mako/areas/ads.run.ts'));
  assert.match(api, /payload: \{ decisionId: id, presupuesto, variaciones: salen[,} ]/);
});

// ── 4: un monto con separador de miles ────────────────────────────────────────────────────────────────────────────────────

test('4 · «1,500» y «1.500» son mil quinientos, «1,5» es uno y medio; lo que no se entiende no sale', () => {
  assert.equal(leerMonto('1,500'), 1500);
  assert.equal(leerMonto('1.500'), 1500);
  assert.equal(leerMonto('US$ 1,500'), 1500);
  assert.equal(leerMonto('1,234.50'), 1234.5);
  assert.equal(leerMonto('1.234,50'), 1234.5);
  assert.equal(leerMonto('1,5'), 1.5);
  assert.equal(leerMonto('36'), 36);
  assert.equal(leerMonto('1,50,0'), null);
  assert.equal(leerMonto('0'), null);
  // Y el servidor no escribe una subida de cinco veces o más; una baja de 80% o más, sólo confirmada (verificación de tren-m:
  // lo prueba tests/media-buyer-verificacion-m.test.ts).
  const ej = sinComentarios(leer('lib/media-buyer/ejecutar.ts'));
  assert.match(ej, /if \(opts\.presupuesto != null\) \{\s*const rev = revisarMontoEditado\(opts\.presupuesto, actual\.presupuesto[^]*?if \(!rev\.ok\) return \{ ok: false/);
});

// ── 1: dos bajas abiertas sobre lo mismo no se componen ───────────────────────────────────────────────────────────────────

test('1 · si otra decisión ya cambió el presupuesto de la entidad después de proponerse ésta, no se aplica el porcentaje encima', () => {
  const martes = D({ id: 'mar', tipo: 'bajar_presupuesto', creada: '2026-10-26T08:00:00Z' });
  const lunesAplicada = D({ id: 'lun', tipo: 'bajar_presupuesto', estado: 'aplicada', aplicadaAt: '2026-10-26T09:00:00Z' });
  assert.equal(presupuestoYaCambiado(martes, [lunesAplicada]), true);
  assert.equal(presupuestoYaCambiado(martes, [{ ...lunesAplicada, aplicadaAt: '2026-10-25T09:00:00Z' }]), false, 'aplicada ANTES de proponerse ésta: ya la vio el motor');
  assert.equal(presupuestoYaCambiado(martes, [{ ...lunesAplicada, entidadId: 'otra' }]), false);
  assert.equal(presupuestoYaCambiado(martes, [{ ...lunesAplicada, estado: 'abierta' }]), false);
  assert.equal(presupuestoYaCambiado(martes, [{ ...lunesAplicada, despues: { estado: 'PAUSED' } }]), false, 'pausar no cambia el presupuesto');
  const ej = sinComentarios(leer('lib/media-buyer/ejecutar.ts'));
  assert.match(ej, /\} else if \(presupuestoYaCambiado\(d, \(await leerDecisiones\(ws, 7\)\)\.decisiones\)\) \{/);
  // Y el lote dice lo que se ajustó o se frenó, como el botón suelto.
  assert.match(sinComentarios(leer('app/ads-manager/MediaBuyer.tsx')), /if \(r\.ok && r\.ajuste\) avisos\.push/);
});

// ── 2: una pestaña vieja no reescribe las tácticas de otro agente ─────────────────────────────────────────────────────────

test('2 · las tácticas que llegan se mezclan con las guardadas, y cada pantalla manda sólo la que tocó', () => {
  const guardadas = { surf: { estado: 'apagada' as const }, stop_loss: { estado: 'propone' as const } };
  assert.deepEqual(mezclarTacticas(guardadas, { stop_loss: { estado: 'apagada' } }), { surf: { estado: 'apagada' }, stop_loss: { estado: 'apagada' } });
  assert.match(sinComentarios(leer('lib/media-buyer/store.ts')), /v\.fila\.tacticas = mezclarTacticas\(\(await leerConfig\(ws\)\)\.tacticas/);
  assert.match(sinComentarios(leer('app/ads-manager/Agentes.tsx')), /onTacticas\(cambioDeAgente\(a, estado\)\)/);
  assert.match(sinComentarios(leer('app/ads-manager/Automatizaciones.tsx')), /const tacticas: ConfigTacticas = \{ \[t\]: /);
});

// ── 3: los agentes propios no se borran por una lectura fallida ───────────────────────────────────────────────────────────

test('3 · guardar y borrar agentes propios leen ESTRICTO y escriben con compare-and-set por updated_at', () => {
  const ia = sinComentarios(leer('lib/media-buyer/agentes-ia.ts'));
  // Lo que escribe: de la lectura estricta hasta la corrida (que sí lee tolerante, a propósito: sólo muestra y propone).
  const escribe = ia.slice(ia.indexOf('async function leerFila'), ia.indexOf('export async function propuestasDeAgentesPropios'));
  assert.doesNotMatch(escribe, /leerAgentesPropios\(/, 'lo que escribe no usa la lectura tolerante');
  assert.doesNotMatch(ia, /setSetting\(/, 'nunca un upsert a ciegas');
  assert.match(escribe, /if \(error\) throw new Error\(`No pude leer tus agentes propios/);
  assert.match(escribe, /if \(!Array\.isArray\(j\)\) throw/, 'un JSON guardado que no se entiende no se pisa');
  assert.match(escribe, /\.eq\('updated_at', fila\.updated_at\)/);
  assert.match(escribe, /export async function borrarAgentePropio[^]*cambiarLista\(/);
});

// ── 5: el resumen para la IA no mezcla monedas ────────────────────────────────────────────────────────────────────────────

const N = (x: Partial<NodoMB> & Pick<NodoMB, 'id' | 'nivel'>): NodoMB => ({ nombre: x.id, parentId: null, configurado: 'ACTIVE', entrega: 'ACTIVE', presupuestoDia: null, nivelPresupuesto: 'adset', creada: null, ...x } as NodoMB);
const S = (adId: string, x: Partial<SenalMB>): SenalMB => ({ adId, gasto: 0, leadsMeta: 0, leadsCrm: 0, agendasMeta: 0, agendasCrm: 0, cierres: 0, caja: 0, impresiones: 0, frecuencia: null, diasCorriendo: 3, esVideo: false, miniatura: null, ...x });

test('5 · el presupuesto va en la moneda de la cuenta y con su equivalente en la unidad del gasto', () => {
  const arbol = [N({ id: 'c', nivel: 'campaign' }), N({ id: 's', nivel: 'adset', parentId: 'c', nombre: 'Pymes', presupuestoDia: 1000 }), N({ id: 'a', nivel: 'ad', parentId: 's' })];
  const r = resumenParaAgente(arbol, [S('a', { gasto: 385, leadsCrm: 5 })], 'lead', (u) => `US$${Math.round(u)}`, (m) => `MX$${m}`, (m) => m / 17.3);
  const linea = r.split('\n').find((l) => l.includes('«Pymes»'))!;
  assert.match(linea, /presupuesto MX\$1000\/día \(≈ US\$58\)/);
  assert.match(linea, /gasto US\$385/);
});

// ── 6: el arranque no ofrece el piloto a quien no lo tiene ─────────────────────────────────────────────────────────────────

test('6 · sin piloto en el plan, el arranque no lo ofrece, no lo toma, y un «piloto» guardado vuelve a preguntar el modo', () => {
  const r: RespuestasArranque = { kpi: 'lead', ticket: 600, costo: { valor: 5, supuesto: true }, inversionMes: 600, plan: true };
  const x = { conectada: true, r, productos: [], costoMedido: null, pilotoPermitido: false };
  assert.deepEqual(opcionesDe('modo', x), ['Te propongo y tú apruebas']);
  assert.equal(leerRespuesta('modo', 'Piloto automático', x), null);
  assert.equal(pasoDeArranque({ ...x, r: { ...r, modo: 'piloto' } }), 'modo', 'el trabado vuelve a la pregunta');
  assert.equal(pasoDeArranque({ ...x, pilotoPermitido: true, r: { ...r, modo: 'piloto' } }), 'listo');
  assert.equal(opcionesDe('modo', { ...x, pilotoPermitido: true }).length, 2);
  // Y un guardado que falla saca el modo: la charla no queda en «listo» con el Media Buyer apagado.
  assert.match(sinComentarios(leer('app/ads-manager/ArranqueMediaBuyer.tsx')), /if \(ok\) return;\s*const sinModo/);
});

// ── 7: Protect no convierte dos veces ──────────────────────────────────────────────────────────────────────────────────────

test('7 · una cuenta en pesos: el gasto ya llega en dólares y la alerta de gasto disparado salta igual', () => {
  const arbol = [N({ id: '1', nivel: 'campaign' }), N({ id: '11', nivel: 'adset', parentId: '1' }), N({ id: '111', nivel: 'ad', parentId: '11' })];
  // 300 dólares por día contra 100 de la semana. Con la tasa de antes (corrida pasaba MXN → USD otra vez) no saltaba.
  const x = { arbol, totalActivo: 20, presupuestoMaxDia: null, fmt: (u: number) => `$${Math.round(u)}`, aUsd: (u: number) => u / 17.3 };
  const a = alertasProtect({ ...x, corta: [S('111', { gasto: 900 })], larga: [S('111', { gasto: 700 })] } as never);
  assert.equal(a[0]?.tipo, 'gasto');
});

// ── 8: deshacer variaciones a mitad de su creación ────────────────────────────────────────────────────────────────────────

test('8 · no se deshace lo que se está creando, y lo creado tarde no queda prendido sobre una decisión deshecha', () => {
  const ej = sinComentarios(leer('lib/media-buyer/ejecutar.ts'));
  assert.match(ej, /if \(seEstaCreando\(d\)\) return \{ ok: false, error: 'Todavía se están creando los anuncios/);
  assert.match(ej, /const guardada = await reclamar\(ws, d\.id, \['aplicada'\], \{ creados/);
  assert.match(ej, /if \(!guardada\) \{\s*for \(const ad of creados\) await borrarAnuncioPorZernio/);
});

// ── 9: lo de los agentes propios cuenta en el cupo ───────────────────────────────────────────────────────────────────────

test('9 · lo de los agentes propios cuenta en el cupo del plan; las subidas a mano, no', () => {
  const hoy = '2026-10-26';
  const ds = [
    { clave: `surf:adset:1:${hoy}`, tactica: 'surf' as const },
    { clave: `propia:ag1:adset:2:${hoy}`, tactica: 'manual' as const },
    { clave: `subir:123:${hoy}`, tactica: 'manual' as const },
    { clave: `propia:ag1:adset:3:2026-10-25`, tactica: 'manual' as const },
  ];
  assert.equal(recomendadasHoy(ds, hoy), 2);
});

// ── La verificación de tren-m (26/10/2026): lo que quedó abierto de 0, 4 y 8 ──────────────────────────────────────────────

test('0 · el TÍTULO que escribe la IA también se ve: en la hoja y entero en la confirmación del chat', () => {
  const conTitulo = D({ ...VARS, variaciones: [{ id: 't1', textoPrincipal: 'Texto 1', titulo: 'Agenda tu llamada hoy', elegida: true }] });
  const html = renderToStaticMarkup(createElement(TarjetaAccion, {
    d: conTitulo, kpi: 'lead', producto: null, ocupada: false, encendido: true, ajustesHref: '#',
    onAplicar: async () => true, onBorrar: () => {}, onPreguntar: () => {}, onDeshacer: () => {}, onReabrir: () => {}, onCalificar: () => {}, onHooksAVideo: () => {},
  }));
  assert.match(html, /Título: <!-- -->Agenda tu llamada hoy|Título: Agenda tu llamada hoy/);
  const api = sinComentarios(leer('lib/api-mako/areas/ads.run.ts'));
  assert.match(api, /\[v\.gancho, v\.textoPrincipal, v\.titulo \? `Título: \$\{v\.titulo\}` : null\]/, 'la confirmación lleva gancho, texto y título, enteros');
  assert.doesNotMatch(api, /\(v\.gancho \?\? v\.textoPrincipal\)\.slice\(0, 120\)/);
});

test('4 · el arranque y los Ajustes leen «$1,000» como mil (las pastillas salen de fmtDinero)', () => {
  const x = { productos: [], r: { kpi: 'lead' as const }, costoMedido: null };
  assert.deepEqual(leerRespuesta('inversion', '$1,000 al mes', x), { inversionMes: 1000 });
  assert.deepEqual(leerRespuesta('ticket', 'US$ 1,500', x), { ticket: 1500 });
  assert.deepEqual(leerRespuesta('ticket', 'US$ 1.500', x), { ticket: 1500 });
  assert.deepEqual(leerRespuesta('costo', '7,50', x), { costo: { valor: 7.5, supuesto: false } });
  assert.equal(montoDelTexto('entre 500 y 1000'), 500, 'el primer monto, no los dígitos pegados');
  const aj = sinComentarios(leer('app/ads-manager/Ajustes.tsx'));
  // Desde el 27/10 (tests/media-buyer-pantalla-m.test.ts): un monto ilegible NO sale. El `Number.NaN` de antes viajaba como
  // null (JSON.stringify(NaN)) y borraba el valor guardado.
  assert.match(aj, /const n = leerMonto\(s\);/);
  assert.doesNotMatch(aj, /Number\.NaN/);
});

test('8 · «se está creando» vence a los 10 minutos, y lanzar no relanza una subida de creativos', () => {
  const ahora = Date.parse('2026-10-26T12:00:00Z');
  assert.equal(seEstaCreando({ creados: [], aplicadaAt: '2026-10-26T11:58:00Z' }, ahora), true);
  assert.equal(seEstaCreando({ creados: [], aplicadaAt: '2026-10-26T11:40:00Z' }, ahora), false, 'vieja y vacía: se cortó, se puede deshacer');
  assert.equal(seEstaCreando({ creados: ['ad1'], aplicadaAt: '2026-10-26T11:59:00Z' }, ahora), false);
  const ej = sinComentarios(leer('lib/media-buyer/ejecutar.ts'));
  assert.match(ej, /if \(seEstaCreando\(d\)\) return \{ ok: false/);
  assert.match(ej, /if \(d\.tipo === 'crear_anuncios'\) return \{ ok: false/);
});
