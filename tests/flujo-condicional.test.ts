// =============================================================================
// El Delay y el Condicional: que el motor los EJECUTE, y que el lienzo no dibuje
// una rama que el motor no sepa resolver
// =============================================================================
// ⚠️ PROBADOS ROMPIENDO LA PIEZA, 04/10/2026. Las cinco roturas se cazan: hacer que
// `esperar` no mire `desde` (vuelve a dormirse para siempre) → 2 fallos · que el
// condicional salte +1 siempre → 2 · sacar `condicional` de `decidir` → 3 · sacar
// una condición de `CONDICIONES_FLUJO` dejando el rótulo → 1 · dibujar un tipo de
// paso que `decidir` no resuelve → 1. Sin eso serían cinco afirmaciones.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONDICIONES_FLUJO, ROTULO_CONDICION, decidir, cumple, sanearHoras, DELAY_MAX_HORAS } from '../lib/flujo-pasos';
import { pasosDibujados } from '../lib/flujo-aviso';
import type { Paso } from '../lib/flujos-tipos';

const T0 = new Date('2026-10-04T12:00:00Z');
const en = (min: number) => new Date(T0.getTime() + min * 60_000);
const est = (paso: number, o: Partial<{ desde: Date; respondioAt: Date | null; ahora: Date }> = {}) =>
  ({ paso, desde: o.desde ?? T0, respondioAt: o.respondioAt ?? null, ahora: o.ahora ?? T0 });

const MSG: Paso = { tipo: 'mensaje', canal: 'aviso_dueno', texto: 'hola' };
const ACC: Paso = { tipo: 'accion', accion: 'crear_tarea' };

// ── EL DELAY ────────────────────────────────────────────────────────────────

test('un `esperar` que NO vencio duerme la corrida hasta su hora', () => {
  const pasos: Paso[] = [{ tipo: 'esperar', horas: 2 }, MSG];
  const d = decidir(pasos, est(0));
  assert.equal(d.que, 'esperar');
  if (d.que !== 'esperar') return;
  assert.equal(d.hasta.getTime(), en(120).getTime(), 'la espera se cuenta desde que se durmio');
});

test('⚠️ un `esperar` YA VENCIDO se SALTEA, no se vuelve a dormir', () => {
  // Es el bug que convierte el delay en un bucle: el drenador despierta la corrida y
  // vuelve a llamar con el MISMO indice de paso. Si `decidir` no mirara `desde`,
  // contestaria «esperar» otra vez y la corrida se dormiria y despertaria para
  // siempre sin avanzar nunca — sin error, sin log, y con el mensaje sin salir.
  const pasos: Paso[] = [{ tipo: 'esperar', horas: 2 }, MSG];
  const d = decidir(pasos, est(0, { ahora: en(121) }));
  assert.equal(d.que, 'saltar');
  if (d.que !== 'saltar') return;
  assert.equal(d.siguiente, 1, 'despues de esperar sigue el paso de al lado');
});

test('el delay tiene techo, y no es configurable', () => {
  // Misma razon que el techo de la insistencia: una espera de meses deja una corrida
  // viva que nadie recuerda haber configurado, y el drenador la despierta sobre un
  // mundo que ya cambio. Un numero que el cliente puede subir no protege nada.
  assert.equal(sanearHoras(99_999), DELAY_MAX_HORAS);
  assert.equal(sanearHoras(-5) > 0, true, 'una espera negativa no puede mandar al pasado');
  assert.equal(sanearHoras('ocho' as unknown), 1, 'lo que no es numero cae al default');
});

// ── EL CONDICIONAL ──────────────────────────────────────────────────────────

test('el condicional SALTEA el paso de al lado cuando no se cumple', () => {
  const pasos: Paso[] = [{ tipo: 'condicional', condicion: 'contestaron' }, MSG, ACC];
  const noContestaron = decidir(pasos, est(0));
  assert.equal(noContestaron.que, 'saltar');
  if (noContestaron.que !== 'saltar') return;
  assert.equal(noContestaron.siguiente, 2, 'sin respuesta se saltea el mensaje y sigue la accion');

  const contestaron = decidir(pasos, est(0, { respondioAt: en(5) }));
  assert.equal(contestaron.que, 'saltar');
  if (contestaron.que !== 'saltar') return;
  assert.equal(contestaron.siguiente, 1, 'con respuesta se hace el paso de al lado');
});

test('`no_contestaron` es el espejo exacto, no otra regla', () => {
  assert.equal(cumple('contestaron', { respondioAt: T0 }), true);
  assert.equal(cumple('contestaron', { respondioAt: null }), false);
  assert.equal(cumple('no_contestaron', { respondioAt: T0 }), false);
  assert.equal(cumple('no_contestaron', { respondioAt: null }), true);
});

test('un paso normal se ejecuta y avanza uno; sin pasos, termina', () => {
  const d = decidir([MSG], est(0));
  assert.equal(d.que, 'ejecutar');
  if (d.que !== 'ejecutar') return;
  assert.equal(d.siguiente, 1);
  assert.equal(decidir([MSG], est(1)).que, 'terminar');
  assert.equal(decidir([], est(0)).que, 'terminar');
});

// ── EL GUARD: lo que se DIBUJA es lo que el motor EJECUTA ───────────────────

test('⚠️ TODO tipo de paso que el lienzo DIBUJA lo ejecuta alguien', () => {
  // La regla de la casa: «un lienzo dibuja una afirmacion — solo se dibuja la rama
  // que el motor EJECUTA». Un tipo nuevo que entre a `pasosDibujados` sin que nadie
  // lo corra pinta una tarjeta que no ocurre, y nadie audita una flecha.
  //
  // ⚠️ LA PRIMERA VERSION DE ESTE GUARD ERA CIEGA, y se vio rompiendola: preguntaba
  // si `decidir` devolvia algo distinto de «terminar», y `decidir` tiene un
  // FALLTHROUGH que contesta «ejecutar» para CUALQUIER tipo. O sea que aceptaba
  // justo lo que venia a prohibir: con `pasosDibujados` devolviendo todo, daba 0
  // fallos. Un guard que no puede fallar por lo que persigue es una afirmacion.
  //
  // Lo que se mira ahora son las DOS listas de verdad, leidas del fuente: los tipos
  // que `decidir` resuelve por estructura (esperar, condicional) y los que
  // `ejecutarPaso` corre de verdad. Un tipo nuevo no esta en ninguna.
  // ⚠️ Y LA ROTURA QUE PARECE LA OBVIA NO SIRVE PARA PROBAR ESTE GUARD: hacer que
  // `pasosDibujados` devuelva TODO (incluido `insistir`) da 0 fallos, y esta bien —
  // `insistir` SI lo ejecuta `ejecutarPaso`, asi que dibujarlo no es «dibujar algo
  // que nadie corre». Esta afuera del dibujo por otra razon (es una propiedad del
  // mensaje anterior, no un paso del recorrido). La rotura que SI mide esto es
  // sacarle a `lib/flujos.ts` la rama de un tipo que se dibuja: medido, 1 fallo.
  const tipos = (src: string) => new Set(
    [...src.matchAll(/paso\.tipo === '([a-z]+)'/g)].map((m) => m[1]),
  );
  const resuelve = tipos(readFileSync(new URL('../lib/flujo-pasos.ts', import.meta.url), 'utf8'));
  const ejecuta = tipos(readFileSync(new URL('../lib/flujos.ts', import.meta.url), 'utf8'));
  const corre = new Set([...resuelve, ...ejecuta]);
  assert.ok(corre.size >= 4, `se leyeron ${corre.size} tipos del fuente: el patron dejo de calzar`);

  const todos: Paso[] = [
    MSG, ACC,
    { tipo: 'esperar', horas: 1 },
    { tipo: 'condicional', condicion: 'contestaron' },
    { tipo: 'insistir', texto: 'x', cadaMin: 30, veces: 2 },
  ];
  for (const p of pasosDibujados(todos)) {
    assert.ok(corre.has(p.tipo), `el lienzo dibuja un paso «${p.tipo}» que no corre nadie`);
  }
});

test('⚠️ TODA condicion con rotulo esta en la lista que el motor evalua', () => {
  // Las dos mitades: un rotulo sin condicion es una opcion que el lienzo ofrece y el
  // motor ignora; una condicion sin rotulo sale en pantalla como su clave cruda.
  for (const c of CONDICIONES_FLUJO) {
    assert.ok(ROTULO_CONDICION[c], `la condicion «${c}» no tiene como decirse en pantalla`);
  }
  for (const k of Object.keys(ROTULO_CONDICION)) {
    assert.ok((CONDICIONES_FLUJO as readonly string[]).includes(k), `«${k}» tiene rotulo y el motor no la evalua`);
  }
});

test('⚠️ el drenador existe y la tabla esta en TENANT_TABLES', () => {
  // Sin el cron, una corrida dormida no despierta nunca: el delay se ve en el lienzo
  // y el mensaje no sale, que es peor que no tener el paso. Y sin la tabla en
  // TENANT_TABLES, `getTenantDb()` es PASSTHROUGH —no «sin scope»— y el drenador de
  // un cliente avanza las corridas de TODOS. Ninguna de las dos da error.
  const cron = readFileSync(new URL('../app/api/cron/flujo-corridas/route.ts', import.meta.url), 'utf8');
  assert.match(cron, /corridasVencidas/, 'el cron dejo de pedir las corridas vencidas');
  assert.match(cron, /retomarCorrida/, 'el cron dejo de retomarlas');
  const vercel = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
  assert.match(vercel, /cron\/flujo-corridas/, 'el cron no esta agendado en vercel.json');
  const ws = readFileSync(new URL('../lib/workspace.ts', import.meta.url), 'utf8');
  assert.match(ws, /'flujo_corridas'/, 'flujo_corridas salio de TENANT_TABLES');
});

test('⚠️ el avance de una corrida va con COMPARE-AND-SET', () => {
  // Es lo unico que evita mandar el mismo paso dos veces cuando dos ticks se pisan o
  // Vercel reintenta. Mismo reclamo atomico que lib/insistencias.ts y la mig 0183.
  const src = readFileSync(new URL('../lib/flujo-corridas.ts', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export async function avanzar'), src.indexOf('export async function cerrarCorrida'));
  assert.match(fn, /\.eq\('paso', pasoViejo\)/, 'avanzar dejo de reclamar la fila por su paso');
  assert.match(fn, /\.eq\('estado', 'pendiente'\)/, 'avanzar puede revivir una corrida cerrada');
});

test('⚠️ el acuse del grupo marca la corrida, y NO la despierta', () => {
  // Marcar y despertar son dos cosas: una corrida dormida tiene un `esperar` que el
  // dueno configuro, y adelantarlo porque alguien escribio «ok» manda el mensaje
  // antes de tiempo. El condicional se evalua cuando a la corrida le toca.
  const src = readFileSync(new URL('../lib/flujo-corridas.ts', import.meta.url), 'utf8');
  const fn = src.slice(src.indexOf('export async function marcarRespondieron'));
  assert.match(fn, /respondio_at/, 'dejo de estampar la senal');
  assert.ok(!/proxima_at/.test(fn), 'marcar la respuesta NO puede tocar cuando despierta');
  const hook = readFileSync(new URL('../app/api/webhooks/evolution/route.ts', import.meta.url), 'utf8');
  assert.match(hook, /marcarRespondieron\(ws\)/, 'el acuse del grupo dejo de marcar las corridas');
});
