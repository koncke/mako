// =============================================================================
// La tarjeta «Pagos › Leer comprobante» de Automations (5/11/2026): las reglas que deciden qué es un comprobante, la
// condición «Su comprobante», la tarjeta del lienzo, el disparador y la plantilla
// =============================================================================
// Pedido de Martín: «un lector de comprobantes de pago [...] para leer comprobantes que vienen». El diseño:
// docs/relevo/pagos-automations-encargo.md («Nunca marca algo como pagado con dudas [...] Un pago parcial no salda el total.
// Un número de operación repetido no cuenta dos veces»).
//
// ⚠️ PROBADO ROMPIÉNDOLO (5/11/2026): ver el final del archivo.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  coberturaDe, estadoDeLectura, lecturaDe, operacionNormal, resultadoDe, monedaDelComprobante, resumenDeLectura, type LecturaComprobante,
} from '../lib/comprobante-reglas';
import { condicionPorId, fuentesDeFilas } from '../lib/condiciones-catalogo';
import { nodoNuevo, tituloDeTarjeta, esLeerComprobante, OP_LEER_COMPROBANTE, MENU_MAS } from '../lib/flujo-conversacion';
import { disparaPorEvento, EVENTOS_PAGO, TRIGGER_PAGO } from '../lib/disparadores';
import { plantillaPorId } from '../lib/plantillas-automatizaciones';
import { filaDePlantilla } from '../lib/plantilla-crear';
import { porId } from '../lib/api-mako/registro';
import { esAccion } from '../lib/api-mako/tipos';
import type { HechosLead } from '../lib/flujo-grafo';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const BUENA: LecturaComprobante = {
  esComprobante: true, monto: 146, moneda: 'USDT', fecha: '2026-10-21', hora: '15:04', medio: 'Binance', destinatario: 'MaKo', operacion: '461213098188603392', dudas: null,
};

// ── Lo que dijo el modelo, saneado ─────────────────────────────────────────────────────────────────────────────────

test('la lectura se sanea: un monto en texto ambiguo NO se adivina, y la moneda acepta USDT', () => {
  assert.equal(lecturaDe({ monto: 146, moneda: 'usdt' }).moneda, 'USDT');
  assert.equal(lecturaDe({ monto: '146.50' }).monto, 146.5);
  assert.equal(lecturaDe({ monto: '1.234,56' }).monto, null, '«1.234,56» no se convierte en 1,23');
  assert.equal(lecturaDe({ monto: '1,234.56' }).monto, null, '«1,234.56» tampoco: va a revisión');
  assert.equal(lecturaDe({ monto: -5 }).monto, null);
  assert.equal(lecturaDe({ fecha: '21/10/2026' }).fecha, null, 'una fecha que no es aaaa-mm-dd no se usa');
  assert.equal(lecturaDe({ hora: '9:05' }).hora, '09:05');
  assert.equal(lecturaDe({ es_comprobante: false }).esComprobante, false);
  assert.equal(lecturaDe(null).esComprobante, true, 'sin respuesta no se afirma que no es un comprobante');
  assert.equal(monedaDelComprobante('US$'), 'USD');
  assert.equal(monedaDelComprobante('$'), null, '«$» no es dólares');
});

test('sólo es «leído» con monto, moneda, fecha y N.º de operación, y sin dudas del modelo', () => {
  assert.equal(estadoDeLectura(BUENA), 'leido');
  assert.equal(estadoDeLectura({ ...BUENA, dudas: 'la fecha está cortada' }), 'dudoso');
  assert.equal(estadoDeLectura({ ...BUENA, operacion: null }), 'dudoso');
  assert.equal(estadoDeLectura({ ...BUENA, moneda: null }), 'dudoso');
  assert.equal(estadoDeLectura({ ...BUENA, fecha: null }), 'dudoso');
  assert.equal(estadoDeLectura({ ...BUENA, monto: null }), 'ilegible');
  assert.equal(estadoDeLectura({ ...BUENA, esComprobante: false }), 'ilegible');
});

test('cubre sólo en la MISMA moneda y por lo que tocaba: un pago parcial no salda el total', () => {
  const esperado = { monto: 146, moneda: 'usdt', pagoId: 7 };
  assert.equal(coberturaDe(BUENA, esperado), 'total');
  assert.equal(coberturaDe({ ...BUENA, monto: 145.995 }, esperado), 'total', 'un centavo de redondeo no lo vuelve parcial');
  assert.equal(coberturaDe({ ...BUENA, monto: 100 }, esperado), 'parcial');
  assert.equal(coberturaDe({ ...BUENA, monto: 200 }, esperado), 'de_mas');
  assert.equal(coberturaDe({ ...BUENA, moneda: 'USD' }, esperado), 'otra_moneda', 'otra moneda no se convierte');
  assert.equal(coberturaDe(BUENA, null), 'sin_cuota');
  assert.equal(coberturaDe({ ...BUENA, monto: null }, esperado), null);
});

test('el resultado: un N.º repetido gana, y sólo una lectura sin dudas y por el total «cubre»', () => {
  assert.equal(resultadoDe({ estado: 'leido', cobertura: 'total', repetido: false }), 'cubre');
  assert.equal(resultadoDe({ estado: 'leido', cobertura: 'total', repetido: true }), 'repetido', 'el mismo N.º no cuenta dos veces');
  assert.equal(resultadoDe({ estado: 'dudoso', cobertura: 'total', repetido: false }), 'dudoso', 'con dudas nunca cubre');
  assert.equal(resultadoDe({ estado: 'leido', cobertura: 'parcial', repetido: false }), 'parcial');
  for (const c of ['de_mas', 'otra_moneda', 'sin_cuota'] as const) assert.equal(resultadoDe({ estado: 'leido', cobertura: c, repetido: false }), 'dudoso', c);
  assert.equal(resultadoDe({ estado: 'ilegible', cobertura: null, repetido: false, esComprobante: false }), 'no_es');
  assert.equal(resultadoDe(null), 'no_llego');
});

test('el N.º de operación se compara sin espacios ni guiones, y uno muy corto no cuenta', () => {
  assert.equal(operacionNormal('4612 1309-8188.603392'), '461213098188603392');
  assert.equal(operacionNormal('ab-12'), 'AB12');
  assert.equal(operacionNormal('123'), null);
  assert.equal(operacionNormal(461213098188603392), '461213098188603400', 'un número de JS pierde dígitos: por eso el prompt lo pide como texto');
});

test('el resumen para quien lo revisa dice qué se leyó y cuánto debía', () => {
  const r = resumenDeLectura({ ...BUENA, monto: 100 }, 'parcial', { monto: 146, moneda: 'USDT', pagoId: 1 });
  assert.match(r, /^Pagó menos de lo que debía: 100 USDT, Binance, 2026-10-21 15:04, N\.º 461213098188603392 \(debía 146 USDT\)\.$/);
});

// ── La condición «Su comprobante» ──────────────────────────────────────────────────────────────────────────────

test('la condición «Su comprobante» compara con lo guardado, y sin lectura dice «no sé»', () => {
  const c = condicionPorId('comprobante');
  assert.ok(c?.evaluar && c.negable && c.fuentes.includes('comprobante'));
  const h = (r?: string) => ({ catalogo: r == null ? {} : { comprobante: r } }) as unknown as HechosLead;
  assert.equal(c!.evaluar!({ campo: 'comprobante', valor: 'cubre' }, h('cubre')), true);
  assert.equal(c!.evaluar!({ campo: 'comprobante', valor: 'cubre' }, h('parcial')), false);
  assert.equal(c!.evaluar!({ campo: 'comprobante', valor: 'cubre' }, h()), null, 'sin leer, «no sé»: no decide una rama');
  assert.equal(c!.evaluar!({ campo: 'comprobante', valor: 'otra-cosa' }, h('cubre')), null);
  assert.ok(fuentesDeFilas([{ campo: 'comprobante', valor: 'cubre' }]).has('comprobante'), 'la fila pide su lectura al motor');
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(motor, /if \(comprobante\) c\.comprobante = comprobante\.get\(f\.id\) \?\? 'no_llego';/, 'el motor carga la lectura');
});

// ── La tarjeta del lienzo ──────────────────────────────────────────────────────────────────────────────────────

test('la tarjeta es la ⚡ Acción `leer_comprobante` sobre el lead del evento, se llama PAYMENT PROOF y no va debajo de «Si responde»', () => {
  const p = nodoNuevo('comprobante', [], () => 0.5);
  assert.equal(p.accion?.operacion, OP_LEER_COMPROBANTE);
  assert.equal((p.accion?.params as { leadId?: unknown }).leadId, 'evento');
  assert.ok(esLeerComprobante(p));
  assert.equal(tituloDeTarjeta(p), 'PAYMENT PROOF');
  const fila = MENU_MAS.find((o) => o.value === 'comprobante');
  assert.ok(fila?.fueraDeRespuesta, 'una foto no abre la rama de «Si responde»');
});

test('la operación: lee con la IA del negocio, se ofrece en los flujos, y no sale por HTTP', () => {
  const d = porId('leer_comprobante');
  assert.ok(d && esAccion(d));
  assert.equal(d.costo, 'ia');
  assert.ok(!d.canales.includes('http'));
  const flujo = leer('lib/api-mako/flujo.ts');
  const bloque = flujo.slice(flujo.indexOf('export const NO_EN_FLUJOS'), flujo.indexOf(']);', flujo.indexOf('export const NO_EN_FLUJOS')));
  assert.ok(!bloque.includes("'leer_comprobante'"), 'es la tarjeta de un flujo: no puede estar en la lista de lo prohibido');
  const lib = sinComentarios(leer('lib/comprobantes.ts'));
  assert.match(lib, /conSuIADelNegocio\(ws, \(\) => leerDocumentoIA\(\{/, 'la IA es la del negocio, con D6b');
  assert.doesNotMatch(lib, /redDePlataforma/, 'nunca la red de la plataforma: la IA la paga el negocio');
  assert.doesNotMatch(lib, /from\('pagos'\)\.(update|insert|upsert)/, 'nunca marca nada cobrado');
  assert.match(lib, /operacion_unica: repetido \? null : operacion/, 'el N.º cuenta una vez: lo decide el índice único');
});

test('el disparador: «Pagos › Llega un comprobante» sale con una foto o un PDF de un lead, nunca de un grupo ni nuestro', () => {
  assert.ok(EVENTOS_PAGO.some((e) => e.subtipo === 'comprobante'));
  assert.equal(disparaPorEvento({ trigger_tipo: TRIGGER_PAGO, subtipo: 'comprobante' }, 'pago', { subtipo: 'comprobante' }), true);
  assert.equal(disparaPorEvento({ trigger_tipo: TRIGGER_PAGO, subtipo: 'aprobado' }, 'pago', { subtipo: 'comprobante' }), false);
  const src = sinComentarios(leer('lib/evolution-mensajes.ts'));
  assert.match(src, /if \(!esGrupo && !fromMe && leadId && \(tipo === 'image' \|\| tipo === 'document'\) && mediaPath\) \{/);
  assert.match(src, /await enrolarPorPago\(lid, 'comprobante'\);/);
});

test('la plantilla «Le Llegó un Comprobante»: lee, pregunta, y nunca marca nada cobrado; nace con «Cada vez»', () => {
  const p = plantillaPorId('comprobante-llego');
  assert.ok(p);
  assert.equal(p.reentrada, 'siempre', 'el mismo lead manda un comprobante todos los meses');
  assert.deepEqual(p.cron, { fijo: TRIGGER_PAGO, eventos: ['comprobante'] });
  assert.equal(p.pasos[0].accion?.operacion, OP_LEER_COMPROBANTE);
  assert.ok(p.pasos.every((x) => !['marcar_pago_cobrado', 'registrar_pago_suelto'].includes(String(x.accion?.operacion ?? ''))));
  assert.equal(filaDePlantilla(p, 'k', 'n').reentrada, 'siempre');
  assert.equal(filaDePlantilla(plantillaPorId('lead-entro')!, 'k', 'n').reentrada, undefined, 'las demás nacen como siempre');
});

test('la migración: una lectura por mensaje y un N.º de operación por negocio', () => {
  const sql = leer('supabase/migrations/0398_comprobantes_leidos.sql');
  assert.match(sql, /create unique index if not exists comprobantes_leidos_mensaje_uk on comprobantes_leidos \(workspace_id, wa_mensaje_id\);/);
  assert.match(sql, /create unique index if not exists comprobantes_leidos_operacion_uk on comprobantes_leidos \(workspace_id, operacion_unica\) where operacion_unica is not null;/);
  assert.match(sql, /revoke all on comprobantes_leidos from anon, authenticated;/);
  // getTenantDb la scopea (TENANT_TABLES, lib/workspace.ts: sin ella el insert sale sin workspace_id), y vaciar el negocio la borra.
  const tenant = leer('lib/workspace.ts');
  const set = tenant.slice(tenant.indexOf('const TENANT_TABLES = new Set<string>(['), tenant.indexOf(']);', tenant.indexOf('const TENANT_TABLES = new Set<string>([')));
  assert.match(set, /'comprobantes_leidos'/, 'getTenantDb la scopea');
  assert.match(leer('lib/tablas-de-inquilino.ts'), /'comprobantes_leidos'/, 'el reset del negocio la vacía');
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (5/11/2026, base: 12 pases y 0 fallos; cada rotura restaurada de memoria y comprobada con md5). Cada una dio
// UN rojo, el del test que la nombra:
//   · un monto en texto con coma que se adivina · «leído» sin N.º de operación · el parcial que cuenta como total · otra moneda
//     que se acepta · el repetido que no gana · el dudoso o el de más que «cubre» · la condición que decide «no» sin lectura ·
//     el motor que no carga la lectura · la tarjeta ofrecida debajo de «Si responde» · la lectura con la red de la plataforma ·
//     el disparo desde un grupo · la plantilla sin «Cada vez» · la fila que no la guarda · el N.º sin `operacion_unica`.
// ─────────────────────────────────────────────────────────────────────────────
