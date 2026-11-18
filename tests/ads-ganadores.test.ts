// =============================================================================
// O22 (18/11/2026): lo que ya le funcionó a un negocio en sus anuncios entra al guion nuevo SÓLO con un piso de datos
// =============================================================================
// El escritor de guiones del Ads Writer (`generarGuion`, lib/razones.ts) y el Copywriter (lib/copywriter/ia.ts) leen los
// ganadores de Ads Analyst por lib/ads-ganadores.ts. La decisión de QUÉ entra es `ganadoresConPiso` (lib/ads-ganadores-reglas.ts):
// con una sola agenda, «este ángulo gana» es falso, así que sin piso no entra nada.
//
// Probado rompiéndolo (18/11/2026, una rotura por vez, restaurada; base en verde: 4 de 4):
//   · el piso de agendas en 1 → 2 en rojo (el 1, y el 4 porque el encabezado lo dice);
//   · sin el piso de impresiones → 1 en rojo (el 2);
//   · ordenando por gasto en vez de por agendas → 1 en rojo (el 3);
//   · el gancho del resumen aunque haya bloque «gancho» → 1 en rojo (el 4).
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PISO_GANADOR, encabezadoDeGanadores, ganadoresConPiso, lineasDeGanadores, type GuionConSenal } from '../lib/ads-ganadores-reglas';

const guion = (x: Partial<GuionConSenal> & { short: string }): GuionConSenal => ({
  angle: 'dolor', hookType: 'pregunta', agendas: 0, spend: 0, impressions: 0, beats: [], ...x,
});

test('1. sin piso no entra nada: una agenda (o dos) no hacen un ganador', () => {
  const una = [guion({ short: 'Una agenda', agendas: 1, spend: 40, impressions: 30_000 }), guion({ short: 'Dos', agendas: 2, spend: 90, impressions: 50_000 })];
  assert.deepEqual(ganadoresConPiso(una), [], 'con 1 o 2 agendas no se le dice a nadie que algo funcionó');
  assert.deepEqual(lineasDeGanadores(ganadoresConPiso(una)), [], 'y no queda ninguna línea que mandar');
  assert.deepEqual(ganadoresConPiso([]), [], 'sin guiones analizados, nada');
});

test('2. con piso entra: al menos 3 agendas y al menos 8.000 impresiones', () => {
  const ok = guion({ short: 'Gana', agendas: PISO_GANADOR.agendas, spend: 120, impressions: PISO_GANADOR.impresiones });
  const pocasVistas = guion({ short: 'Pocas vistas', agendas: 5, spend: 50, impressions: 2_000 });
  assert.deepEqual(ganadoresConPiso([ok, pocasVistas]).map((g) => g.short), ['Gana']);
});

test('3. los que más agendaron primero, a igual agendas el más barato, y sólo los tres mejores', () => {
  const lista = [
    guion({ short: 'C', agendas: 4, spend: 400, impressions: 20_000 }),
    guion({ short: 'A', agendas: 9, spend: 900, impressions: 90_000 }),
    guion({ short: 'B-cara', agendas: 4, spend: 800, impressions: 20_000 }),
    guion({ short: 'D', agendas: 3, spend: 5_000, impressions: 40_000 }),
  ];
  assert.deepEqual(ganadoresConPiso(lista).map((g) => g.short), ['A', 'C', 'B-cara']);
});

test('4. lo que se dice de cada uno: el gancho dicho, su ángulo por nombre y cuánto costó cada agenda', () => {
  const g = guion({
    short: 'resumen corto', angle: 'testimonio', hookType: 'resultado', agendas: 6, spend: 300, impressions: 40_000,
    beats: [{ kind: 'contexto', t0: 0, text: 'Contexto' }, { kind: 'gancho', t0: 0, text: 'En 30 días llené mi agenda sin llamar en frío' }],
  });
  const [linea] = lineasDeGanadores([g], (c) => (c === 'testimonio' ? 'Testimonio' : c));
  assert.equal(linea, '- «En 30 días llené mi agenda sin llamar en frío» · ángulo Testimonio · gancho de tipo resultado · 6 agendas, US$ 50 por agenda');
  assert.match(encabezadoDeGanadores(), /al menos 3 agendas/);
  assert.match(encabezadoDeGanadores(), /no lo copies/);
});
