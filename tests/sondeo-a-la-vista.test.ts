// EL CONTADOR DE WHATSAPP DE LA BARRA NO PIDE CON LA PESTAÑA OCULTA (12/11/2026).
//
// El chat «Probar Image» vio 1.300 pedidos a `/api/whatsapp/evolution/mensajes?resumen=1` en producción: el
// NotificationsProvider (montado en el layout, en CADA pantalla) pedía cada 12 s con un setInterval pelado, también con
// la pestaña oculta y sin esperar al pedido anterior. Cada pedido es una función de Vercel paga. Ahora pide cada 30 s
// sólo a la vista, por lib/sondeo-a-la-vista.ts. El detalle, en docs/hallazgos-ui.md → «El contador de WhatsApp de
// la barra pedía cada 12 s».
//
// PROBADO ROMPIÉNDOLO (12/11/2026), cada rotura por separado y vuelta atrás:
//   S1 el NotificationsProvider de antes (setInterval de 12 s)        → falla el cableado
//   S2 sin mirar `visibilityState` en `intentar`                       → fallan «oculta» y «al volver»
//   S3 sin la guarda `enVuelo`                                         → falla «nunca dos a la vez»
//   S4 la limpieza sin `removeEventListener`                           → falla «lo apaga todo»
//   S5 `alVolverMs` en 0 (cada vuelta a la pestaña pide)               → falla «ir y venir rápido»
//   S6 RESUMEN_WA_CADA_MS en 12_000                                    → fallan el intervalo, «10 minutos a la vista» y «al volver»
//
// Y EL DE LAS PLANTILLAS DE META (12/11/2026, el mismo día): `/api/whatsapp/templates/status` cada 30 s, con un reloj de 6 s
// que seguía con la pestaña oculta. No podía avisar nunca (leía la cuenta de Chatwoot, borrado el 09/10/2026), así que se
// fue entero: el pedido, la ruta, el aviso y su interruptor en Ajustes. Probado rompiéndolo:
//   P1 el NotificationsProvider de antes                               → fallan «ningún setInterval» y «no vuelve»
//   P2 la ruta de vuelta                                               → falla «no vuelve»
//   P3 `wa-plantilla` de vuelta en el catálogo                         → falla «no vuelve»
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { RESUMEN_WA_CADA_MS, sondearALaVista, type DocConVisibilidad, type Reloj } from '../lib/sondeo-a-la-vista';
import { NOTIF_IN_APP } from '../lib/notif-catalogo';
import { fuenteSinComentarios } from './_fuente-sin-comentarios';

class PestanaFalsa implements DocConVisibilidad {
  visibilityState: 'visible' | 'hidden';
  private oyentes = new Set<() => void>();
  constructor(v: 'visible' | 'hidden' = 'visible') { this.visibilityState = v; }
  addEventListener(_t: 'visibilitychange', f: () => void) { this.oyentes.add(f); }
  removeEventListener(_t: 'visibilitychange', f: () => void) { this.oyentes.delete(f); }
  get cuantosOyen() { return this.oyentes.size; }
  poner(v: 'visible' | 'hidden') { this.visibilityState = v; for (const f of [...this.oyentes]) f(); }
}

const vaciarCola = () => new Promise<void>((r) => setImmediate(r));

function relojFalso() {
  let t = 0;
  let n = 0;
  const relojes = new Map<number, { f: () => void; ms: number; prox: number }>();
  const reloj: Reloj = {
    ahora: () => t,
    cada: (f, ms) => { relojes.set(++n, { f, ms, prox: t + ms }); return n; },
    parar: (id) => { relojes.delete(id as number); },
  };
  return {
    reloj,
    get activos() { return relojes.size; },
    async avanzar(ms: number) {
      // Lo que ya volvió vuelve antes de que corra el tiempo: sin esto el pedido del arranque seguía «en vuelo» a los 30 s.
      await vaciarCola();
      const fin = t + ms;
      for (;;) {
        let sig: { f: () => void; ms: number; prox: number } | null = null;
        for (const r of relojes.values()) if (r.prox <= fin && (!sig || r.prox < sig.prox)) sig = r;
        if (!sig) break;
        t = sig.prox;
        sig.prox += sig.ms;
        sig.f();
        await vaciarCola();
      }
      t = fin;
      await vaciarCola();
    },
  };
}

function armar(v: 'visible' | 'hidden' = 'visible', pedir?: () => unknown) {
  const pestana = new PestanaFalsa(v);
  const r = relojFalso();
  const pedidos: number[] = [];
  const apagar = sondearALaVista(() => { pedidos.push(r.reloj.ahora()); return pedir?.(); }, { cadaMs: RESUMEN_WA_CADA_MS, doc: pestana, reloj: r.reloj });
  return { pestana, r, pedidos, apagar };
}

test('el contador pide entre cada 30 s y cada 60 s, no cada 12', () => {
  assert.ok(RESUMEN_WA_CADA_MS >= 30_000 && RESUMEN_WA_CADA_MS <= 60_000, `cada ${RESUMEN_WA_CADA_MS} ms`);
});

test('10 minutos a la vista: uno al arrancar y uno por vuelta, nada más', async () => {
  const { r, pedidos } = armar();
  assert.equal(pedidos.length, 1, 'al arrancar a la vista pide en el acto');
  await r.avanzar(10 * 60_000);
  // Con 12 s eran 51 en 10 minutos; con 30 s, 21. El tope va escrito a mano: calculado con la constante no la vigila.
  assert.ok(pedidos.length <= 21, `${pedidos.length} pedidos en 10 minutos`);
  assert.equal(pedidos.length, 1 + Math.floor(10 * 60_000 / RESUMEN_WA_CADA_MS));
  for (let i = 1; i < pedidos.length; i++) assert.ok(pedidos[i] - pedidos[i - 1] >= RESUMEN_WA_CADA_MS * 0.9, `dos pedidos a ${pedidos[i] - pedidos[i - 1]} ms`);
});

test('con la pestaña oculta no pide nada, ni al arrancar ni con el reloj', async () => {
  const { pestana, r, pedidos } = armar('hidden');
  await r.avanzar(60 * 60_000);
  assert.equal(pedidos.length, 0, 'una hora oculta pidió');
  pestana.poner('visible');
  assert.equal(pedidos.length, 1, 'al volver a la pestaña no pidió en el acto');
});

test('al volver a la pestaña pide en el acto; ir y venir rápido no dispara una ráfaga', async () => {
  const { pestana, r, pedidos } = armar();
  await r.avanzar(45_000);
  assert.equal(pedidos.length, 2);
  pestana.poner('hidden');
  await r.avanzar(20 * 60_000);
  assert.equal(pedidos.length, 2, 'oculta, siguió pidiendo');
  pestana.poner('visible');
  assert.equal(pedidos.length, 3, 'al volver no pidió');
  await r.avanzar(2_000);
  pestana.poner('hidden');
  await r.avanzar(1_000);
  pestana.poner('visible');
  assert.equal(pedidos.length, 3, 'volver a los 3 s del último pedido no tiene que pedir otra vez');
});

test('nunca dos a la vez: si el anterior no volvió, la vuelta se saltea', async () => {
  let soltar: () => void = () => {};
  const { r, pedidos } = armar('visible', () => new Promise<void>((res) => { soltar = res; }));
  assert.equal(pedidos.length, 1);
  await r.avanzar(3 * RESUMEN_WA_CADA_MS);
  assert.equal(pedidos.length, 1, 'con el pedido colgado salieron otros');
  soltar();
  await vaciarCola();
  await r.avanzar(RESUMEN_WA_CADA_MS);
  assert.equal(pedidos.length, 2, 'cuando volvió el colgado, la vuelta siguiente no pidió');
});

test('un pedido que falla no frena los siguientes', async () => {
  const { r, pedidos } = armar('visible', () => { throw new Error('se cayó la red'); });
  await r.avanzar(2 * RESUMEN_WA_CADA_MS);
  assert.equal(pedidos.length, 3);
});

test('lo que devuelve lo apaga todo: el reloj y el oyente de la pestaña', async () => {
  const { pestana, r, pedidos, apagar } = armar();
  assert.equal(pestana.cuantosOyen, 1);
  apagar();
  assert.equal(r.activos, 0, 'quedó el reloj andando');
  assert.equal(pestana.cuantosOyen, 0, 'quedó el oyente de la pestaña');
  await r.avanzar(5 * 60_000);
  pestana.poner('hidden');
  pestana.poner('visible');
  assert.equal(pedidos.length, 1, 'apagado, siguió pidiendo');
});

test('el NotificationsProvider no tiene relojes propios: ningún setInterval', () => {
  // Tenía dos: el del resumen (12 s) y el de las plantillas (6 s). Un sondeo nuevo en el layout va por sondearALaVista.
  assert.doesNotMatch(fuenteSinComentarios('app/_components/NotificationsProvider.tsx'), /setInterval\(/);
});

test('el sondeo de las plantillas de Meta no vuelve: nadie lo pide, la ruta no está y Ajustes no lo ofrece', () => {
  // Leía la cuenta de WhatsApp Business de Chatwoot (getWabaConfig, que tira desde el 09/10/2026): no podía avisar nunca.
  assert.doesNotMatch(fuenteSinComentarios('app/_components/NotificationsProvider.tsx'), /templates\/status/);
  assert.equal(existsSync(join(import.meta.dirname, '..', 'app/api/whatsapp/templates/status/route.ts')), false, 'volvió la ruta');
  assert.ok(!NOTIF_IN_APP.some((n) => n.id === 'wa-plantilla'), 'Ajustes ofrece un interruptor para un aviso que no sale');
});

test('el NotificationsProvider pide el resumen por sondearALaVista, y no con un setInterval propio', () => {
  const src = fuenteSinComentarios('app/_components/NotificationsProvider.tsx');
  const i = src.indexOf("'/api/whatsapp/evolution/mensajes?resumen=1'");
  assert.ok(i > 0, 'no encontré el pedido del resumen');
  const ini = src.lastIndexOf('useEffect(', i);
  const fin = src.indexOf('}, []);', i);
  assert.ok(ini > 0 && fin > i, 'no encontré el efecto del resumen');
  const efecto = src.slice(ini, fin);
  assert.match(efecto, /return sondearALaVista\(tick, \{ cadaMs: RESUMEN_WA_CADA_MS \}\);/, 'el resumen no pasa por sondearALaVista');
  assert.doesNotMatch(efecto, /setInterval|setTimeout|void tick\(\)/, 'el resumen volvió a tener su propio reloj');
});
