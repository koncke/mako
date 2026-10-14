// =============================================================================
// El cobro del «Botón de pago» de una landing: el candado, el techo y la propuesta (revisión de la tanda 4)
// =============================================================================
// Dos hallazgos MEDIA de la revisión adversarial del 14/10/2026, los dos sobre el POST público
// (app/api/landing-generator/pagar → `ejecutarPago`, lib/editor-landing/pago-pedido.ts):
//   · dos pedidos A LA VEZ (un doble clic en un formulario sin JavaScript) dejaban dos fichas de la misma
//     persona y dos checkouts: «buscar y, si no está, crear» sin candado;
//   · un POST sin sesión creaba fichas en el CRM del cliente aunque el producto NO se pudiera cobrar, con
//     topes que viven en la memoria de cada instancia.
// Acá todo corre sin base: un candado de mentira con la semántica del índice único parcial de la mig 0276
// (UNA fila en curso por clave) y un CRM de mentira cuya lectura y escritura NO son atómicas, que es
// exactamente lo que hace falta para que la carrera exista. La rotura de cada guard, al final.
// =============================================================================

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://proyecto.supabase.co';

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CANDADO_ESPERA_MS, CANDADO_VENCE_MS, TECHO_PAGOS_HORA, conCandado, creadoPorLanding, ejecutarPago,
  type CobroPendiente, type DepCandado, type DepPago,
} from '../lib/editor-landing/pago-pedido';
import { responderPagoPost, type DepPagoPost, type LandingDelPaso } from '../lib/editor-landing/pago-pagina';
import type { EstadoCobroLanding } from '../lib/editor-landing/pago-landing';

const tick = () => new Promise<void>((r) => setImmediate(r));
const ESTADO: EstadoCobroLanding = { conectadas: ['stripe'], productos: [{ id: 12, nombre: 'Programa', tipo: 'unico', montoUsd: 990 }] };
const PEDIDO = { productoId: 12, email: 'ana@x.com', slug: 'mi-landing' };

/** El candado de mentira: una fila en curso como mucho (el índice único parcial), y un reloj propio. */
function candadoFalso(op: { sinTabla?: boolean; colgadoDesde?: number } = {}) {
  let reloj = 0;
  let n = 100;
  let enCurso: { id: number; desde: number } | null = op.colgadoDesde === undefined ? null : { id: 1, desde: op.colgadoDesde };
  const soltados: Array<[number, string]> = [];
  const vencidos: number[] = [];
  const log: string[] = [];
  const dep: DepCandado = {
    tomar: async () => {
      await tick();
      if (op.sinTabla) return { tipo: 'sin-tabla' };
      if (enCurso) return { tipo: 'ocupado', id: enCurso.id, desde: enCurso.desde };
      enCurso = { id: ++n, desde: reloj };
      return { tipo: 'tomado', id: enCurso.id };
    },
    soltar: async (id, resultado) => { soltados.push([id, resultado]); if (enCurso?.id === id) enCurso = null; },
    vencer: async (id) => { vencidos.push(id); if (enCurso?.id === id) enCurso = null; },
    esperar: async (ms) => {
      reloj += ms;
      // Red del arnés: un candado que no se rinde nunca no puede colgar la corrida entera.
      if (reloj > 10 * CANDADO_ESPERA_MS) throw new Error('el candado no se rindió');
      await tick();
    },
    ahora: () => reloj,
    log: (_nivel, texto) => { log.push(texto); },
  };
  return { dep, soltados, vencidos, log, tomado: () => enCurso };
}

/** El CRM de mentira: la lectura del lead y su alta están separadas por dos vueltas del bucle (como la base). */
function crmFalso() {
  const leads: Array<{ id: number; email: string }> = [];
  const cobros: Array<CobroPendiente & { lead: number }> = [];
  const llamadas = { lead: 0, proponer: 0, crear: 0, estado: 0 };
  const dep = (candado: DepCandado, over: Partial<DepPago> = {}): DepPago => ({
    usosDeLaHora: async () => 0,
    estado: async () => { llamadas.estado++; return ESTADO; },
    candado,
    proponer: async () => { llamadas.proponer++; },
    lead: async () => {
      llamadas.lead++;
      const ya = leads.find((l) => l.email === PEDIDO.email);
      await tick();
      await tick();
      if (ya) return ya.id;
      const nuevo = { id: leads.length + 1, email: PEDIDO.email };
      leads.push(nuevo);
      return nuevo.id;
    },
    pendientes: async (leadId) => cobros.filter((c) => c.lead === leadId),
    crear: async (leadId, pasarela) => {
      llamadas.crear++;
      await tick();
      const token = `tok${cobros.length + 1}`;
      cobros.push({
        lead: leadId, token, estado: 'pendiente', producto_id: 12, proveedor: pasarela, monto: 990, moneda: 'USD', tipo: 'unico',
        email: PEDIDO.email, alta_capa: null, creado_por: creadoPorLanding('Mi landing', 'mi-landing'),
      });
      return { ok: true, link: `https://hola-mako.com/pagar/${token}` };
    },
    linkDe: (t) => `https://hola-mako.com/pagar/${t}`,
    historial: async () => {},
    ...over,
  });
  return { leads, cobros, llamadas, dep };
}

test('dos pedidos A LA VEZ del mismo email: UNA ficha, UN checkout, y los dos van al mismo link', async () => {
  const crm = crmFalso();
  const { dep: candado, tomado } = candadoFalso();
  const [a, b] = await Promise.all([ejecutarPago(PEDIDO, crm.dep(candado)), ejecutarPago(PEDIDO, crm.dep(candado))]);
  assert.equal(crm.leads.length, 1, 'una sola ficha de la misma persona');
  assert.equal(crm.cobros.length, 1, 'un solo checkout en el Stripe del cliente');
  assert.deepEqual([a, b], [
    { tipo: 'redirigir', url: 'https://hola-mako.com/pagar/tok1', reusado: false },
    { tipo: 'redirigir', url: 'https://hola-mako.com/pagar/tok1', reusado: true },
  ]);
  assert.equal(tomado(), null, 'el candado quedó suelto');
});

test('si hoy no se puede cobrar, queda una PROPUESTA y nunca una ficha (sin Stripe, sin precio, inactivo)', async () => {
  for (const [estado, motivo] of [
    [{ ...ESTADO, conectadas: [] }, 'sin-pasarela'],
    [{ ...ESTADO, conectadas: ['mercadopago'] }, 'solo-mercadopago'],
    [{ ...ESTADO, productos: [{ ...ESTADO.productos[0], montoUsd: null }] }, 'sin-precio'],
    [{ ...ESTADO, productos: [] }, 'sin-producto'],
  ] as Array<[EstadoCobroLanding, string]>) {
    const crm = crmFalso();
    const r = await ejecutarPago(PEDIDO, crm.dep(candadoFalso().dep, { estado: async () => estado }));
    assert.deepEqual(r, { tipo: 'no-disponible', motivo }, motivo);
    assert.equal(crm.llamadas.proponer, 1, `${motivo}: queda la propuesta`);
    assert.equal(crm.llamadas.lead, 0, `${motivo}: un POST público no escribe en el CRM si no hay cobro`);
    assert.equal(crm.llamadas.crear, 0);
  }
});

test('el techo de la hora se cuenta en la BASE: al llegar, no se escribe nada; sin la tabla no hay techo', async () => {
  {
    const crm = crmFalso();
    const r = await ejecutarPago(PEDIDO, crm.dep(candadoFalso().dep, { usosDeLaHora: async () => TECHO_PAGOS_HORA }));
    assert.deepEqual(r, { tipo: 'demasiados' });
    assert.deepEqual(crm.llamadas, { lead: 0, proponer: 0, crear: 0, estado: 0 }, 'ni se lee el catálogo');
  }
  {
    const crm = crmFalso();
    const r = await ejecutarPago(PEDIDO, crm.dep(candadoFalso().dep, { usosDeLaHora: async () => TECHO_PAGOS_HORA - 1 }));
    assert.equal(r.tipo, 'redirigir');
  }
  {
    const crm = crmFalso();
    const r = await ejecutarPago(PEDIDO, crm.dep(candadoFalso().dep, { usosDeLaHora: async () => null }));
    assert.equal(r.tipo, 'redirigir', 'sin la mig 0276 se cobra igual (como antes)');
  }
});

test('el candado: uno colgado se suelta; uno vivo que no termina hace esperar y rendirse (fallo, sin ficha)', async () => {
  {
    const c = candadoFalso({ colgadoDesde: -CANDADO_VENCE_MS });
    const crm = crmFalso();
    const r = await ejecutarPago(PEDIDO, crm.dep(c.dep));
    assert.equal(r.tipo, 'redirigir');
    assert.deepEqual(c.vencidos, [1], 'el colgado se soltó');
  }
  {
    const c = candadoFalso({ colgadoDesde: 0 });
    const crm = crmFalso();
    const r = await ejecutarPago(PEDIDO, crm.dep(c.dep));
    assert.deepEqual(r, { tipo: 'fallo' });
    assert.deepEqual(c.vencidos, [], 'uno vivo NO se le quita a nadie');
    assert.equal(crm.llamadas.lead, 0, 'sin candado no se toca el CRM');
    assert.ok(c.log.some((l) => /no terminó/.test(l)), c.log.join(' | '));
  }
});

test('el candado: sin la tabla corre igual (y lo dice); lo que tira el trabajo suelta el candado y vuelve a tirar', async () => {
  {
    const c = candadoFalso({ sinTabla: true });
    let corridas = 0;
    const r = await conCandado(c.dep, async () => { corridas++; return 'x'; }, (x) => x);
    assert.deepEqual(r, { tipo: 'hecho', valor: 'x' });
    assert.equal(corridas, 1);
    assert.ok(c.log.some((l) => /mig 0276/.test(l)));
  }
  {
    const c = candadoFalso();
    await assert.rejects(conCandado(c.dep, async () => { throw new Error('la base se cayó'); }, () => 'ok'), /la base se cayó/);
    assert.deepEqual(c.soltados, [[101, 'excepcion']]);
    assert.equal(c.tomado(), null, 'el siguiente pedido no espera 90 s por un candado que nadie tiene');
  }
});

test('el POST traduce el techo a un 429 sin cobrar', async () => {
  const LANDING: LandingDelPaso = { ws: 7, docId: 40, slug: 'mi-landing', titulo: 'Mi landing', sitio: 'Mi sitio', temaId: 'pewter', fuentes: [], productos: [12] };
  const dep: DepPagoPost = {
    appBaseUrl: 'https://hola-mako.com', ip: '1.1.1.1', limitar: () => true,
    landing: async () => LANDING, esDelDominio: async () => true,
    detalle: async () => ({ estado: ESTADO, estiloTema: null }),
    pagar: async () => ({ tipo: 'demasiados' }),
  };
  const req = new Request('https://hola-mako.com/api/landing-generator/pagar', {
    method: 'POST', headers: { origin: 'https://hola-mako.com', 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ slug: 'mi-landing', bloque: '12', nombre: 'Ana', email: 'ana@x.com' }).toString(),
  });
  const r = await responderPagoPost(req, dep);
  assert.equal(r.status, 429);
  assert.match(await r.text(), /Demasiados intentos/);
});

// =============================================================================
// PROBADO ROMPIÉNDOLO (14/10/2026), una rotura por vez, corriendo ESTE archivo con
// tests/editor-landing-pago.test.ts (base: 24 pass / 0 fail), con el arnés del scratchpad que guarda el
// archivo en memoria, lo rompe, corre y lo reescribe (md5 igual; nunca `git checkout`). «pass / fail»:
//   1. `ejecutarPago` corre el trabajo SIN `conCandado`              → 22 / 2 (dos fichas y dos checkouts)
//   2. sin cobro, igual busca o crea la ficha antes de proponer       → 23 / 1
//   3. sin el techo de la hora                                        → 23 / 1
//   4. un candado colgado no se vence nunca                           → 23 / 1
//   5. sin el plazo de espera (la red del arnés corta el bucle)       → 23 / 1
//   6. una excepción del trabajo no suelta el candado                 → 23 / 1
//   7. el POST no traduce `demasiados` a un 429                       → 23 / 1
// Restaurado: 24 / 0.
// =============================================================================
