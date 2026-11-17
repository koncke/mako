// =============================================================================
// La mensualidad de una cuenta SUELTA con ciclo propio (Leila Fittipaldi, ws 11) — EJECUTADA, de punta a punta
// =============================================================================
// Martín (17/11/2026): «implementa el mismo proceso que tenemos con Código Inmobiliario que le cobramos por Binance, pero para Leila […]
// con ella no vamos a cobrarle del 1 al 5, sino que como no tiene clientes, es la fecha que pagó, la misma fecha pero al siguiente mes».
// Pagó el 26/10/2026 (US$97, su Pro): su ciclo arranca cada 26. Es la mensualidad de lib/agencia-mes*.ts con `cicloPropio` en su config:
// UN solo ítem, sin clientes, el aviso al grupo el día que arranca (con el PDF), plazo de 5 días, pausa al sexto si no entró, recibo con
// el período y «Tu cuenta sigue activa» a la par. Las reglas puras se prueban solas; lo de abajo EJECUTA `avisarMensualidades`,
// `aplicarPagoDeAgencia` y `cerrarElPagoDeAgencia` con la base y los envíos de mentira (lo de Código no se toca: lo cubre
// tests/agencia-mes.test.ts, que sigue en verde).
// Probado ROMPIÉNDOLO (17/11/2026): ver el pie.
// Correr: node --import tsx --test tests/mensualidad-ciclo-propio.test.ts

import { test, mock, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import Module from 'node:module';
import {
  cicloPropioDe, cuentaDelMes, diaLimite, inicioDelCiclo, leerConfigMensualidad, mesQueSeAvisa, periodoDelCiclo, preciosDelCatalogo, quienVaEnPausa,
  tablaDelMes, textoDeComprobante, textoDeCuentasActivas, textoDeMesImpago, textoDePausaDelMes, textoDelAvisoDelMes, type CicloPropio,
} from '../lib/agencia-mes-reglas';
import { PLANES_MAKO_DEFAULT } from '../lib/planes-mako';
import { pagosDelLibro } from '../lib/admin-ingresos-libro';

const PRECIOS = preciosDelCatalogo(PLANES_MAKO_DEFAULT)!;
const LEILA: CicloPropio = { dia: 26, plan: 'pro' };

// ── Lo puro ──────────────────────────────────────────────────────────────────────────────────────────────────────

test('el ciclo arranca el día en que pagó; si el mes no tiene ese día, el último', () => {
  assert.equal(inicioDelCiclo('2026-11', LEILA), '2026-11-26');
  assert.equal(inicioDelCiclo('2027-02', { dia: 31, plan: 'pro' }), '2027-02-28');
  assert.equal(inicioDelCiclo('2028-02', { dia: 31, plan: 'pro' }), '2028-02-29');
  assert.equal(inicioDelCiclo('2026-11'), '2026-11-05', 'sin ciclo propio sigue siendo el 5 de las agencias');
  assert.equal(periodoDelCiclo('2026-11', LEILA), 'del 26 de noviembre al 25 de diciembre');
  assert.equal(periodoDelCiclo('2026-12', LEILA), 'del 26 de diciembre al 25 de enero');
});

test('el ciclo en el que cae un día es el mes en que ARRANCÓ', () => {
  assert.equal(cicloPropioDe('2026-11-25', LEILA), '2026-10');
  assert.equal(cicloPropioDe('2026-11-26', LEILA), '2026-11');
  assert.equal(cicloPropioDe('2026-12-03', LEILA), '2026-11', 'el 3/12 todavía es el ciclo que arrancó el 26/11');
  assert.equal(cicloPropioDe('2027-01-26', LEILA), '2027-01');
});

test('diaLimite: el 5 de siempre sin ciclo propio; con él, el mismo día que arranca (sin días de gracia)', () => {
  assert.equal(diaLimite('2026-12'), '2026-12-05');
  assert.equal(diaLimite('2026-11', LEILA), '2026-11-26');
  assert.equal(diaLimite('2026-12', LEILA), '2026-12-26');
  assert.equal(diaLimite('2027-02', { dia: 31, plan: 'pro' }), '2027-02-28', 'un 31 en febrero: el último día del mes');
});

test('mesQueSeAvisa con ciclo propio: SÓLO el día que arranca, y no antes del primer mes que se factura así', () => {
  assert.equal(mesQueSeAvisa('2026-11-25', '2026-11', LEILA), null);
  assert.equal(mesQueSeAvisa('2026-11-26', '2026-11', LEILA), '2026-11');
  assert.equal(mesQueSeAvisa('2026-11-27', '2026-11', LEILA), null, 'al día siguiente ya no se avisa: se pausa');
  assert.equal(mesQueSeAvisa('2026-12-01', '2026-11', LEILA), null);
  assert.equal(mesQueSeAvisa('2026-12-26', '2026-11', LEILA), '2026-12');
  assert.equal(mesQueSeAvisa('2026-10-26', '2026-11', LEILA), null, 'el de octubre lo pagó en el acto: no se avisa');
  assert.equal(mesQueSeAvisa('2026-11-29', '2026-11', { dia: 29, plan: 'pro' }), '2026-11');
  assert.equal(mesQueSeAvisa('2027-02-28', '2027-02', { dia: 31, plan: 'pro' }), '2027-02', 'un 31 en febrero se avisa el 28');
  // Las agencias: del 1 al 5, como siempre.
  assert.equal(mesQueSeAvisa('2026-12-03', '2026-12'), '2026-12');
  assert.equal(mesQueSeAvisa('2026-12-26', '2026-12'), null);
});

test('la cuenta del mes de una cuenta suelta es UN renglón, su plan, sin clientes', () => {
  const c = cuentaDelMes({ mes: '2026-11', primerMes: '2026-11', planAgencia: 'esencial', clientes: [], precios: PRECIOS, hoy: '2026-11-26', entradasDesde: '2026-11-17', ciclo: LEILA })!;
  assert.equal(c.totalUsd, PRECIOS.pro);
  assert.equal(c.totalUsd, 97);
  assert.equal(c.lineas.length, 1);
  assert.equal(c.lineas[0].plan, 'pro', 'el plan sale de su config, no de la capa de la cuenta');
  assert.equal(c.limite, '2026-11-26');
  assert.equal(cuentaDelMes({ mes: '2026-10', primerMes: '2026-11', planAgencia: 'esencial', clientes: [], precios: PRECIOS, hoy: '2026-11-26', entradasDesde: '2026-11-17', ciclo: LEILA }), null);
});

test('el PDF y el texto del aviso hablan de SU ciclo: sin «1 al 5», sin agencia, con el período, Binance y el recibo', () => {
  const cuenta = cuentaDelMes({ mes: '2026-11', primerMes: '2026-11', planAgencia: 'esencial', clientes: [], precios: PRECIOS, hoy: '2026-11-26', entradasDesde: '2026-11-17', ciclo: LEILA })!;
  const tabla = tablaDelMes({ agencia: 'Leila Fittipaldi', cuenta, medio: 'Binance', ciclo: LEILA });
  assert.equal(tabla.titulo, 'Mensualidad de noviembre');
  assert.deepEqual(tabla.filas, [['Tu plan MaKo Pro', 'del 26 de noviembre al 25 de diciembre', 'US$ 97']]);
  assert.equal(tabla.limite, '2026-11-26');
  const todo = [tabla.subtitulo, ...tabla.notas].join(' ');
  assert.doesNotMatch(todo, /del 1 al 5|clientes|agencia/i);
  assert.match(todo, /hasta el 26 de noviembre/);
  assert.match(todo, /se pausa tu cuenta/);
  const texto = textoDelAvisoDelMes({ agencia: 'Leila Fittipaldi', tabla, medio: 'Binance', ciclo: LEILA, mes: '2026-11' });
  assert.match(texto, /Tu mensualidad de MaKo, del 26 de noviembre al 25 de diciembre, es de US\$ 97/);
  assert.match(texto, /Págala por Binance hasta el 26 de noviembre y manda aquí la captura del comprobante: la registro y te mando el recibo\./);
  assert.doesNotMatch(texto, /agencia|clientes/i);
});

test('la pausa de una cuenta suelta usa SU límite (el 26/11, el día que arranca), no el 5', () => {
  const mes = (extra: object = {}) => [{ mes: '2026-11', totalUsd: 97, pagadoUsd: 0, avisadoUsd: 97, limite: '2026-11-26', ...extra }];
  const quien = (hoy: string, meses = mes()) => quienVaEnPausa({ agenciaWs: 11, hoy, meses, clientes: [] });
  assert.equal(quien('2026-11-26').size, 0, 'el día que vence todavía no se pausa');
  assert.deepEqual([...quien('2026-11-27')], [[11, ['mes:2026-11']]], 'al día siguiente, sí');
  assert.equal(quien('2026-11-27', mes({ pagadoUsd: 97 })).size, 0, 'pagado, no se pausa');
  assert.equal(quien('2026-11-27', mes({ avisadoUsd: null })).size, 0, 'sin aviso no se pausa: no se le pudo pedir');
  // Una agencia (sin `limite`): el 5, como siempre.
  assert.equal(quienVaEnPausa({ agenciaWs: 13, hoy: '2026-12-05', meses: [{ mes: '2026-12', totalUsd: 426, pagadoUsd: 0, avisadoUsd: 426 }], clientes: [] }).size, 0);
  assert.equal(quienVaEnPausa({ agenciaWs: 13, hoy: '2026-12-06', meses: [{ mes: '2026-12', totalUsd: 426, pagadoUsd: 0, avisadoUsd: 426 }], clientes: [] }).size, 1);
});

test('los textos de la pausa, del impago y del pago dicen «tu cuenta», sin clientes', () => {
  const p = textoDePausaDelMes({ mes: '2026-11', faltaUsd: 97, ciclo: LEILA, medio: 'Binance' });
  assert.match(p, /^Tu cuenta quedó en pausa porque falta el pago de tu mensualidad de MaKo \(del 26 de noviembre al 25 de diciembre\): son US\$ 97\. Págala por Binance y manda aquí la captura del comprobante: vuelves a entrar en el acto\./);
  assert.match(p, /El detalle va en el PDF\./);
  assert.doesNotMatch(p, /clientes|agencia/);
  assert.match(textoDeMesImpago({ agencia: 'Leila Fittipaldi', mes: '2026-11', debeUsd: 97, diasDeAtraso: 1, ciclo: LEILA }), /Su cuenta queda en pausa hasta que entre el pago\./);
  assert.equal(textoDeCuentasActivas({ clientes: [], agencia: true, propia: true }), 'Tu cuenta sigue activa.');
  assert.equal(textoDeCuentasActivas({ clientes: [], agencia: true }), 'La cuenta de la agencia sigue activa.');
  const r = textoDeComprobante({ tipo: 'cubre', montoUsd: 97, conceptos: ['la mensualidad de noviembre'], activas: { clientes: [], agencia: true, propia: true } });
  assert.match(r, /Quedó pagado: la mensualidad de noviembre\. Te mando el recibo\.\nTu cuenta sigue activa\./);
});

test('la config guarda el ciclo propio y una agencia sigue sin él', () => {
  const c = leerConfigMensualidad({ desde: '2026-11', entradasDesde: '2026-11-17', medio: 'Binance', cicloPropio: { dia: 26, plan: 'pro' } });
  assert.deepEqual(c?.cicloPropio, { dia: 26, plan: 'pro' });
  for (const malo of [{ dia: 0, plan: 'pro' }, { dia: 32, plan: 'pro' }, { dia: 26.5, plan: 'pro' }, { dia: 26, plan: 'oro' }, { dia: 26 }, 'x', null]) {
    assert.equal(leerConfigMensualidad({ desde: '2026-11', cicloPropio: malo })?.cicloPropio, undefined, JSON.stringify(malo));
  }
  assert.equal('cicloPropio' in (leerConfigMensualidad({ desde: '2026-12', medio: 'Binance' }) ?? {}), false);
});

test('Admin › Revenue: «lo próximo» de una cuenta con ciclo propio es el día de su ciclo, no el 5', () => {
  const orden = { orden: '465000000000000009', monto: 97, moneda: 'USDT', montoUsd: 97, fecha: '2026-11-26T12:00:00', comprobante: null, aplicado: [{ clave: 'mes:2026-11', montoUsd: 97 }] };
  const pago = { mes: '2026-11', pagadoEl: '2026-11-26', totalUsd: 97, pagadoUsd: 97, ordenes: [orden.orden] };
  const filas = (config: object) => [
    { key: 'agencia.mensualidad.11.config', value: JSON.stringify(config) },
    { key: `agencia.mensualidad.11.orden.${orden.orden}`, value: JSON.stringify(orden) },
    { key: 'agencia.mensualidad.11.pago.2026-11', value: JSON.stringify(pago) },
  ];
  const lectura = (config: object) => pagosDelLibro(filas(config), { atadas: new Set(), nombreWs: new Map(), hoy: '2026-12-10' }).proximos.get('agencia:11')!;
  const propio = lectura({ desde: '2026-11', entradasDesde: '2026-11-17', medio: 'Binance', cicloPropio: { dia: 26, plan: 'pro' } });
  assert.deepEqual(propio.siguiente, { fecha: '2026-12-26', usd: 97 }, 'el límite de diciembre: el 26');
  assert.equal(propio.atrasado, null);
  // Una agencia con el mismo libro: el 5 de siempre (ya pasó el 5/12 → atrasada).
  const agencia = lectura({ desde: '2026-11', entradasDesde: '2026-11-17', medio: 'Binance' });
  assert.deepEqual(agencia.atrasado, { fecha: '2026-12-05', usd: 97 });
});

// ── Lo ejecutado: la corrida del día, el pago y el recibo, con la base y los envíos de mentira ───────────────────────

type Fila = Record<string, unknown>;
let appSettings: Fila[] = [];
let workspaces: Fila[] = [];
const grupo: Array<{ ws: number; texto: string; pdf?: { nombre: string; base64: string } }> = [];
const aMartin: string[] = [];
const recibos: Array<{ destinoWs: number; aNombre: string; lineas: Array<{ concepto: string; mes: string | null; monto: number }>; clave: string; pagos: unknown[] }> = [];
let esAgenciaWs = new Set<number>();

const PLATAFORMA = 9;
function consulta(nombre: 'workspaces' | 'app_settings') {
  const filas = () => (nombre === 'workspaces' ? workspaces : appSettings);
  let op: 'select' | 'update' | 'upsert' = 'select';
  let patch: Fila = {};
  const filtros: Array<(f: Fila) => boolean> = [];
  const q = {
    select: () => q,
    like: (c: string, patron: string) => { const re = new RegExp(`^${patron.replace(/[.]/g, '\\.').replace(/%/g, '.*')}$`); filtros.push((f) => re.test(String(f[c]))); return q; },
    limit: () => q,
    eq: (c: string, v: unknown) => { filtros.push((f) => f[c] === v); return q; },
    in: (c: string, v: unknown[]) => { filtros.push((f) => v.includes(f[c])); return q; },
    update: (p: Fila) => { op = 'update'; patch = p; return q; },
    upsert: (p: Fila) => { op = 'upsert'; patch = p; return q; },
    then: (ok: (r: { data: Fila[]; error: null }) => unknown, mal?: (e: unknown) => unknown) => {
      try {
        if (op === 'upsert') {
          const ya = filas().find((f) => f.workspace_id === patch.workspace_id && f.key === patch.key);
          if (ya) Object.assign(ya, patch); else filas().push({ ...patch });
          return Promise.resolve({ data: [], error: null }).then(ok, mal);
        }
        const hit = filas().filter((f) => filtros.every((p) => p(f)));
        if (op === 'update') for (const f of hit) Object.assign(f, patch);
        return Promise.resolve({ data: hit.map((f) => ({ ...f })), error: null }).then(ok, mal);
      } catch (e) { return Promise.reject(e).then(ok, mal); }
    },
  };
  return q;
}
const ajuste = {
  getSettingsConPrefijo: async (prefijo: string) => new Map(appSettings.filter((f) => f.workspace_id === PLATAFORMA && String(f.key).startsWith(prefijo)).map((f) => [String(f.key), String(f.value)] as const)),
  cambiarSettingSi: async (key: string, esperado: string | null, nuevo: string) => {
    const f = appSettings.find((x) => x.workspace_id === PLATAFORMA && x.key === key);
    if ((f ? String(f.value) : null) !== esperado) return false;
    if (f) f.value = nuevo; else appSettings.push({ workspace_id: PLATAFORMA, key, value: nuevo });
    return true;
  },
  setSetting: async (key: string, value: string) => {
    const f = appSettings.find((x) => x.workspace_id === PLATAFORMA && x.key === key);
    if (f) f.value = value; else appSettings.push({ workspace_id: PLATAFORMA, key, value });
  },
  borrarSetting: async (key: string) => { appSettings = appSettings.filter((f) => !(f.workspace_id === PLATAFORMA && f.key === key)); },
  borrarSettingSi: async (key: string, esperado: string) => {
    const f = appSettings.find((x) => x.workspace_id === PLATAFORMA && x.key === key);
    if (!f || String(f.value) !== esperado) return false;
    appSettings = appSettings.filter((x) => x !== f);
    return true;
  },
};
const reales = new Set(['./agencia-cobro-reglas', './agencia-cartera', './plan-acceso-reglas', './agencia-mes-pdf', './agencia-mes-pausas', './agencia-mes-avisos', './agencia-mes-reglas', './date-utils']);
const falsos: Record<string, unknown> = {
  './supabase': { getSupabaseServer: () => ({ from: (t: 'workspaces' | 'app_settings') => consulta(t) }) },
  './workspace': { runWithWorkspace: async (_ws: number, f: () => Promise<unknown>) => f(), wsSuperAdmin: async () => PLATAFORMA },
  './settings': ajuste,
  './timezone': { zonaDelNegocioEstricta: async () => 'America/Cancun' },
  './compra-plan': { planesMako: async () => PLANES_MAKO_DEFAULT },
  './agencia': { esAgencia: async (ws: number) => esAgenciaWs.has(ws) },
  './notificaciones': { crearNotificacion: async () => undefined },
  './mako-grupo': {
    anotarLoDelEquipo: async () => undefined,
    enviarAlGrupoMaKo: async (ws: number, texto: string) => { grupo.push({ ws, texto }); return { ok: true }; },
    enviarAlGrupoSuperAdmin: async (texto: string) => { aMartin.push(texto); return { ok: true }; },
    enviarPartesAlGrupoMaKo: async (ws: number, partes: Array<{ base64: string; media: { fileName: string }; caption: string }>) => {
      grupo.push({ ws, texto: partes[0].caption, pdf: { nombre: partes[0].media.fileName, base64: partes[0].base64 } });
      return { ok: true, ids: ['wa-1'] };
    },
  },
  './grupo-app': { copiarAlGrupo: async () => ({ ids: ['g-1'] }), atarIdDeWhatsApp: async () => undefined },
  './recibos': {
    reciboDePago: async () => null,
    emitirReciboManual: async (m: (typeof recibos)[number]) => { recibos.push(m); return { ok: true, numero: 6 }; },
  },
};
const sinDefinir = new Proxy({}, { get: (_t, k) => (k === '__esModule' ? true : typeof k === 'string' ? (() => { throw new Error(`mock sin definir: ${k}`); }) : undefined) });
type Cargador = (pedido: string, padre: { filename?: string } | null, esMain: boolean) => unknown;
const M = Module as unknown as { _load: Cargador };
const original = M._load;
M._load = ((pedido: string, padre: { filename?: string } | null, esMain: boolean) => {
  if (pedido === 'server-only') return {};
  if (/[\\/]lib[\\/]agencia-mes\.ts$/.test(padre?.filename ?? '') && pedido.startsWith('./') && !reales.has(pedido)) return falsos[pedido] ?? sinDefinir;
  return Reflect.apply(original, Module, [pedido, padre, esMain]);
}) as Cargador;
// `await import('./recibos')` (lo del recibo, adentro de agencia-mes.ts) no pasa por `_load` con su padre: se le deja el falso en la caché.
const rutaRecibos = require.resolve('../lib/recibos');
const antesRecibos = require.cache[rutaRecibos];
require.cache[rutaRecibos] = { id: rutaRecibos, filename: rutaRecibos, loaded: true, exports: falsos['./recibos'], children: [], paths: [], path: '', parent: null } as unknown as NodeModule;
after(() => { M._load = original; mock.timers.reset(); if (antesRecibos) require.cache[rutaRecibos] = antesRecibos; else delete require.cache[rutaRecibos]; });

const CONFIG = { desde: '2026-11', entradasDesde: '2026-11-17', medio: 'Binance', prendidaPor: 'test', prendidaAt: '2026-11-17T12:00:00.000Z', cicloPropio: { dia: 26, plan: 'pro' } };
beforeEach(() => {
  appSettings = [{ workspace_id: PLATAFORMA, key: 'agencia.mensualidad.11.config', value: JSON.stringify(CONFIG) }];
  workspaces = [{ id: 11, nombre: 'Leila Fittipaldi', capa: 'completo', estado: 'activo' }];
  grupo.length = 0; aMartin.length = 0; recibos.length = 0; esAgenciaWs = new Set([13]);
  console.log = () => undefined; console.warn = () => undefined; console.error = () => undefined;
  mock.timers.reset();
});
const lib = () => import('../lib/agencia-mes');
const corrida = async (iso: string) => (await lib()).avisarMensualidades(new Date(`${iso}T14:07:00Z`));
const del11 = () => workspaces.find((w) => w.id === 11)!;
const claves = () => appSettings.map((f) => String(f.key));

test('antes de su primer ciclo (20/11) la corrida no manda nada ni pausa', async () => {
  const r = await corrida('2026-11-20');
  assert.deepEqual(r.map((x) => [x.agenciaWs, x.ok, x.mes ?? null]), [[11, true, null]]);
  assert.equal(grupo.length, 0);
  assert.equal(aMartin.length, 0);
  assert.equal(del11().estado, 'activo');
});

test('el 26/11 sale UN aviso al grupo con el PDF del sistema, y repetir la corrida no lo manda otra vez', async () => {
  const r = await corrida('2026-11-26');
  assert.equal(r[0].ok, true);
  assert.equal(r[0].mes, 'avisado');
  assert.equal(grupo.length, 1);
  const g = grupo[0];
  assert.equal(g.ws, 11, 'va a SU grupo de MaKo');
  assert.ok(g.pdf, 'con el PDF: nunca sólo el texto del monto (regla del 16/11)');
  assert.equal(g.pdf!.nombre, 'MaKo - Mensualidad de noviembre.pdf');
  assert.equal(Buffer.from(g.pdf!.base64, 'base64').subarray(0, 4).toString(), '%PDF');
  assert.match(g.texto, /Tu mensualidad de MaKo, del 26 de noviembre al 25 de diciembre, es de US\$ 97\./);
  assert.match(g.texto, /Págala por Binance hasta el 26 de noviembre/);
  assert.ok(claves().includes('agencia.mensualidad.11.aviso.2026-11'));
  assert.equal((await corrida('2026-11-26'))[0].mes, 'ya-estaba');
  assert.equal(grupo.length, 1);
  assert.equal(del11().estado, 'activo', 'el día que vence todavía no se pausa');
});

test('en seco no manda nada: dice lo que saldría', async () => {
  const r = await (await lib()).avisarMensualidades(new Date('2026-11-26T14:07:00Z'), { dry: true });
  assert.equal(r[0].mes, 'saldria');
  assert.match(r[0].saldrian![0], /Mensualidad de noviembre: US\$ 97/);
  assert.equal(grupo.length, 0);
  assert.equal(claves().some((k) => k.includes('.aviso.')), false);
});

test('sin pagar, el 26/11 sigue activa y el 27/11 se pausa UNA vez: lo dice al grupo (con el PDF, el monto y cómo pagar) y se lo avisa a Martín', async () => {
  await corrida('2026-11-26');
  grupo.length = 0;
  await corrida('2026-11-26');
  assert.equal(del11().estado, 'activo', 'el día que vence no se pausa');
  assert.equal(aMartin.length, 0);
  const r = await corrida('2026-11-27');
  assert.equal(del11().estado, 'pausado');
  assert.equal(r[0].pausas?.length, 1);
  const corte = JSON.parse(String(appSettings.find((f) => f.workspace_id === 11 && f.key === 'plan.corte_por_pago')!.value));
  assert.equal(corte.motivo, 'paga-para-entrar');
  assert.equal(corte.vigente, true);
  assert.deepEqual(corte.mensualidad, { agenciaWs: 11, rol: 'agencia', causas: ['mes:2026-11'], perdonadas: [] });
  assert.equal(grupo.length, 1, 'el aviso de la pausa va a su grupo');
  assert.equal(grupo[0].ws, 11);
  assert.match(grupo[0].texto, /^Tu cuenta quedó en pausa porque falta el pago de tu mensualidad de MaKo \(del 26 de noviembre al 25 de diciembre\): son US\$ 97\. Págala por Binance/);
  assert.ok(grupo[0].pdf, 'con el PDF: todo pedido de pago lleva el PDF (regla del 16/11), también el de la pausa');
  assert.equal(grupo[0].pdf!.nombre, 'MaKo - Mensualidad de noviembre.pdf');
  assert.equal(Buffer.from(grupo[0].pdf!.base64, 'base64').subarray(0, 4).toString(), '%PDF');
  assert.equal(aMartin.length, 1);
  assert.match(aMartin[0], /Leila Fittipaldi: su mensualidad de MaKo .* no entró y lleva 1 día de atraso\. Falta US\$ 97\./);
  await corrida('2026-11-28');
  assert.equal(grupo.length, 1, 'el aviso de la pausa sale una vez');
  assert.equal(aMartin.length, 1, 'y el de Martín, también');
});

test('pagó: el pago se anota, sale el recibo con el período y «Tu cuenta sigue activa» a la par, y la cuenta vuelve a entrar', async () => {
  await corrida('2026-11-26');
  await corrida('2026-11-27');
  assert.equal(del11().estado, 'pausado');
  grupo.length = 0;
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-28T15:00:00Z') });
  const { mensualidadDeAgencia, aplicarPagoDeAgencia, cerrarElPagoDeAgencia } = await lib();
  const ahora = new Date('2026-11-28T15:00:00Z');
  const m = await mensualidadDeAgencia(11, ahora);
  assert.equal(m.ok, true);
  if (!m.ok) return;
  assert.deepEqual(m.pendientes.map((p) => [p.tipo, (p as { mes?: string }).mes, p.debeUsd, p.limite]), [['mes', '2026-11', 97, '2026-11-26']]);
  const r = await aplicarPagoDeAgencia(m, { orden: '465000000000000001', monto: 97, moneda: 'USDT', montoUsd: 97, fecha: '2026-11-28T12:00:00' }, [{ clave: 'mes:2026-11', montoUsd: 97 }], 'test');
  assert.deepEqual(r, { ok: true, completas: ['mes:2026-11'] });
  const cierre = await cerrarElPagoDeAgencia(m, r.ok ? r.completas : [], 'test', { ahora });
  assert.equal(cierre.recibo?.ok, true, JSON.stringify(cierre.recibo));
  assert.equal(recibos.length, 1);
  assert.equal(recibos[0].destinoWs, 11);
  assert.equal(recibos[0].aNombre, 'Leila Fittipaldi');
  assert.equal(recibos[0].clave, 'mensualidad:11:2026-11');
  assert.deepEqual(recibos[0].lineas.map((l) => [l.concepto, l.mes, l.monto]), [['Tu plan MaKo Pro · del 26 de noviembre al 25 de diciembre', 'noviembre 2026', 97]]);
  assert.equal(del11().estado, 'activo', 'pagado, entra solo');
  assert.equal(cierre.texto, 'Tu cuenta sigue activa.');
  assert.deepEqual(grupo.map((g) => g.texto), ['Tu cuenta sigue activa.'], 'a la par del recibo, el aviso de que su cuenta sigue activa');
  // Y con el mes pagado, el día siguiente no la vuelve a pausar.
  mock.timers.setTime(Date.parse('2026-11-29T15:00:00Z'));
  const otra = await corrida('2026-11-29');
  assert.equal(otra[0].pausas?.length ?? 0, 0);
  assert.equal(del11().estado, 'activo');
});

test('el 26/12 arranca su siguiente ciclo y se le avisa el mes nuevo, otra vez con el PDF', async () => {
  await corrida('2026-11-26');
  grupo.length = 0;
  appSettings.push({ workspace_id: PLATAFORMA, key: 'agencia.mensualidad.11.pago.2026-11', value: JSON.stringify({ mes: '2026-11', pagadoEl: '2026-11-26', totalUsd: 97, pagadoUsd: 97, ordenes: ['465000000000000009'] }) });
  const r = await corrida('2026-12-26');
  assert.equal(r[0].mes, 'avisado');
  assert.equal(grupo.length, 1);
  assert.equal(grupo[0].pdf?.nombre, 'MaKo - Mensualidad de diciembre.pdf');
  assert.match(grupo[0].texto, /del 26 de diciembre al 25 de enero/);
});

test('paga ADELANTADO (el 25 para el ciclo del 26): el pago cuenta, y el 26 ya no se le avisa ni el 27 se le pausa', async () => {
  mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-11-25T15:00:00Z') });
  const { mensualidadDeAgencia, aplicarPagoDeAgencia } = await lib();
  const ahora = new Date('2026-11-25T15:00:00Z');
  const m = await mensualidadDeAgencia(11, ahora);
  assert.equal(m.ok, true);
  if (!m.ok) return;
  assert.deepEqual(m.pendientes.map((p) => [p.tipo, (p as { mes?: string }).mes, p.debeUsd]), [['mes', '2026-11', 97]], 'cinco días antes ya se debe el ciclo que arranca');
  const r = await aplicarPagoDeAgencia(m, { orden: '465000000000000003', monto: 97, moneda: 'USDT', montoUsd: 97, fecha: '2026-11-25T12:00:00' }, [{ clave: 'mes:2026-11', montoUsd: 97 }], 'test');
  assert.deepEqual(r, { ok: true, completas: ['mes:2026-11'] });
  mock.timers.setTime(Date.parse('2026-11-26T15:00:00Z'));
  const dia26 = await corrida('2026-11-26');
  assert.equal(dia26[0].mes, 'pagado');
  assert.equal(grupo.length, 0, 'pagado de antemano: no se le manda el aviso de cobro');
  await corrida('2026-11-27');
  assert.equal(del11().estado, 'activo');
  // Seis días antes todavía no se debe nada.
  mock.timers.setTime(Date.parse('2026-11-20T15:00:00Z'));
  appSettings = appSettings.filter((f) => !String(f.key).includes('.pago.') && !String(f.key).includes('.orden.'));
  const lejos = await mensualidadDeAgencia(11, new Date('2026-11-20T15:00:00Z'));
  assert.equal(lejos.ok && lejos.pendientes.length, 0);
});

test('una cuenta que no es agencia y no tiene ciclo propio sigue sin poder tener mensualidad', async () => {
  const { mensualidadDeAgencia, prenderMensualidad } = await lib();
  const sin = await mensualidadDeAgencia(5);
  assert.deepEqual(sin, { ok: false, error: 'Este negocio no es Agency.' });
  const noEs = await prenderMensualidad({ agenciaWs: 5, desde: '2026-11', autor: 'test' });
  assert.deepEqual(noEs, { ok: false, error: 'Ese negocio no es Agency.' });
  const esAg = await prenderMensualidad({ agenciaWs: 13, desde: '2026-11', autor: 'test', cicloPropio: LEILA });
  assert.equal(esAg.ok, false);
  assert.match((esAg as { error: string }).error, /es una agencia/);
  const mala = await prenderMensualidad({ agenciaWs: 5, desde: '2026-11', autor: 'test', cicloPropio: { dia: 40, plan: 'pro' } });
  assert.equal(mala.ok, false);
});

test('prenderla con ciclo propio guarda el día y el plan, y repetirla no cambia nada', async () => {
  appSettings = [];
  const { prenderMensualidad } = await lib();
  const r = await prenderMensualidad({ agenciaWs: 11, desde: '2026-11', medio: 'Binance', autor: 'test', cicloPropio: LEILA }, new Date('2026-11-17T15:00:00Z'));
  assert.equal(r.ok, true);
  assert.match((r as { resumen: string }).resumen, /ciclo propio: avisa el día 26 de cada mes desde noviembre 2026 \(MaKo Pro\), por Binance/);
  const guardada = JSON.parse(String(appSettings.find((f) => f.key === 'agencia.mensualidad.11.config')!.value));
  assert.deepEqual(guardada.cicloPropio, { dia: 26, plan: 'pro' });
  assert.equal(guardada.desde, '2026-11');
  const otra = await prenderMensualidad({ agenciaWs: 11, desde: '2026-11', medio: 'Binance', autor: 'test', cicloPropio: LEILA }, new Date('2026-11-17T15:00:00Z'));
  assert.deepEqual(otra, { ok: true, resumen: 'La mensualidad ya estaba prendida así.', yaEstaba: true });
});

// Probado ROMPIENDO (17/11/2026), una rotura por vez y restaurando de memoria. Con el código como está: 19 pases, 0 fallos.
// Rota (pases / fallos):
//   · diaLimite con ciclo propio devuelve el 5                                           → 8 / 11
//   · mesQueSeAvisa con ciclo propio sin mirar el plazo                                   → 17 / 2
//   · quienVaEnPausa con el 5 en vez de `limite`                                          → 16 / 3
//   · cuentaDelMes sin la rama del ciclo propio                                           → 12 / 7
//   · mensualidadDeAgencia pidiendo `esAgencia` con ciclo propio                          → 12 / 7
//   · el aviso del mes sin `ciclo` (sale el texto de las agencias)                        → 17 / 2
//   · quiénes quedaron activos sin `propia` («la cuenta de la agencia»)                   → 18 / 1
//   · el recibo sin el período                                                            → 18 / 1
//   · la lectura de pausas sin el límite del mes                                          → 17 / 2
//   · el límite de los pendientes sin el ciclo                                            → 17 / 2
//   · Admin › Revenue: «lo próximo» sin el ciclo                                          → 18 / 1
//   · prender dejando pasar un ciclo propio a una agencia                                 → 18 / 1
//   · la gracia de 4 días (la regla vieja, antes de lo que dijo Martín)                   → 11 / 8
//   · el aviso de la pausa SIN el PDF                                                     → 18 / 1
//   · el pago adelantado sin los 5 días                                                   → 18 / 1
//   · la config sin leer el ciclo propio                                                  → 9 / 10
