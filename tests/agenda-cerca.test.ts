// =============================================================================
// «SI AGENDA MÁS CERCA»: LA ESPERA «ANTES DE LA REUNIÓN» QUE NO LLEGA A SALIR (16/10/2026)
// =============================================================================
// Feedback de Martín del 16/10 (por Cerebro, punto 4), textual: «si MaKo sabe por la API que el evento permite agendar
// con poca anticipación (por ejemplo 3 h), el delay "1 día antes" lo advierte. Y lo ideal: "si está configurado "1 día
// antes" y se agendó dentro de 3 horas, que simplemente no salga"».
//
// Lo que se fija:
//   · la regla (`llegaTarde`): falta menos de la MITAD de la espera → lo que sigue no sale, hasta la próxima espera; con
//     la mitad y no «ya pasó», unos minutos de atraso del cron no saltean un «1 día antes»;
//   · NO es una regla escondida: la tarjeta la dice y se cambia («Si agenda más cerca, sale enseguida»), y se guarda;
//   · el motor (`resolverControl`) y «Probar» (el simulador) hacen lo mismo;
//   · el aviso: con huecos en Calendly más cerca que esa mitad, la píldora lleva su ⚠ con la frase;
//   · la lectura (`anticipacion_agenda`): en la API de MaKo y en el lienzo, y «no pude leer» no es «no está».
//
// ⚠️ PROBADO ROMPIENDO (16/10/2026, scratchpad romper-cerca.mjs; base 6 pass / 0 fail, 7 roturas, todas atajadas). El
// resultado MEDIDO de cada rotura, al lado de su test.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { PasoGrafo, Espera } from '../lib/flujo-grafo';
import { llegaTarde, minutosDeCerca, textoSiAgendaCerca } from '../lib/flujo-grafo';
import { resolverControl, camposDelFlujo, MOTIVO_AGENDO_CERCA } from '../lib/nutricion-grafo-motor';
import { iniciar, siguiente, type EventoSim, type EstadoSim } from '../lib/simulador-grafo';
import { avisoAgendaCerca, grafoDeSecuencia } from '../lib/flujo-conversacion';
import { porId } from '../lib/api-mako/registro';

const leer = (f: string) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');

const DIA: Espera = { modo: 'antes_reunion', minutos: 1440 };
const DIA_SALE: Espera = { modo: 'antes_reunion', minutos: 1440, siAgendaCerca: 'sale' };
const base = { canal: 'whatsapp', proveedor: 'no_oficial', delay_horas: 0, asunto: null, template_wa: null } as const;
const msg = (id: string, cuerpo: string, siguiente: string | null) => ({ ...base, id, cuerpo, siguiente }) as PasoGrafo;
const espera = (id: string, e: Espera, siguiente: string | null) => ({ ...base, id, nodo: 'esperar', cuerpo: '', espera: e, siguiente }) as PasoGrafo;
/** «1 día antes» → A → «1 h antes» → B: el recordatorio de siempre. */
const flujo = (e: Espera = DIA): PasoGrafo[] => [
  espera('w1', e, 'a'), msg('a', 'Mañana es tu reunión', 'w2'),
  espera('w2', { modo: 'antes_reunion', minutos: 60 }, 'b'), msg('b', 'En una hora', null),
];
const AHORA = Date.UTC(2026, 9, 16, 12, 0);
const enMin = (m: number) => AHORA + m * 60_000;

// rotura 1 («ya pasó» en vez de la mitad): 3 pass / 3 fail, caen éste, el del motor y el del aviso.
test('la regla: falta menos de la MITAD → no sale; la tarjeta lo dice, y «sale» es lo de antes', () => {
  assert.equal(llegaTarde(DIA, 180), true, 'agendó a 3 h de un «1 día antes»');
  assert.equal(llegaTarde(DIA, 1430), false, 'agendó 23 h 50 antes: unos minutos tarde no lo saltean');
  assert.equal(llegaTarde(DIA, 719), true);
  assert.equal(llegaTarde(DIA, 720), false);
  assert.equal(llegaTarde(DIA_SALE, 10), false);
  assert.equal(llegaTarde({ modo: 'tiempo', minutos: 1440 }, 0), false, 'una espera por tiempo no depende de la reunión');
  assert.equal(minutosDeCerca({ modo: 'antes_reunion', minutos: 15 }), 8);
  assert.equal(textoSiAgendaCerca(DIA), 'Si agenda con menos de 12 h, no sale');
  assert.equal(textoSiAgendaCerca({ modo: 'antes_reunion', minutos: 60 }), 'Si agenda con menos de 30 min, no sale');
  assert.equal(textoSiAgendaCerca(DIA_SALE), 'Si agenda más cerca, sale enseguida');
  assert.equal(textoSiAgendaCerca({ modo: 'tiempo', minutos: 60 }), null);
});

// rotura 2 (el saneo pierde la opción): 5 pass / 1 fail, cae éste.
test('se guarda: el saneo conserva «sale» y no escribe lo de fábrica', () => {
  assert.deepEqual(camposDelFlujo({ id: 'w', nodo: 'esperar', espera: DIA_SALE }).espera, DIA_SALE);
  assert.deepEqual(camposDelFlujo({ id: 'w', nodo: 'esperar', espera: { ...DIA, siAgendaCerca: 'no_sale' } }).espera, DIA);
  assert.deepEqual(camposDelFlujo({ id: 'w', nodo: 'esperar', espera: { modo: 'tiempo', minutos: 5, siAgendaCerca: 'sale' } }).espera, { modo: 'tiempo', minutos: 5 });
});

// rotura 3 (el motor no saltea): 5 pass / 1 fail, cae éste.
test('el motor: agendó a 3 h → lo del «1 día antes» no sale y sigue en la próxima espera; con «sale», sale', () => {
  const ctx = (reunionMin: number) => ({ hechos: null, ahoraMs: AHORA, reunionMs: enMin(reunionMin) });
  const tarde = resolverControl(flujo(), 0, ctx(180));
  assert.equal(tarde.tipo, 'esperar');
  assert.ok(tarde.tipo === 'esperar');
  assert.equal(tarde.idx, 3, 'queda esperando a «En una hora»');
  assert.equal(tarde.proximoMs, enMin(120));
  assert.deepEqual(tarde.via, ['w1', 'a', 'w2']);
  // A tiempo (falta más de la mitad): ya pasó el momento, sale enseguida como siempre.
  const aTiempo = resolverControl(flujo(), 0, ctx(800));
  assert.ok(aTiempo.tipo === 'nodo');
  assert.equal(aTiempo.idx, 1);
  // Con «sale»: lo de antes.
  const sale = resolverControl(flujo(DIA_SALE), 0, ctx(180));
  assert.ok(sale.tipo === 'nodo');
  assert.equal(sale.idx, 1);
  // Sin otra espera después: el camino termina sin mandar, con su motivo.
  const solo = resolverControl(flujo().slice(0, 2).map((p) => (p.id === 'a' ? { ...p, siguiente: null } : p)), 0, ctx(180));
  assert.ok(solo.tipo === 'fin');
  assert.equal(solo.motivo, MOTIVO_AGENDO_CERCA);
});

/** Todo lo que se ve en «Probar», hasta el final. */
function correr(pasos: PasoGrafo[], st: EstadoSim): string[] {
  const out: string[] = [];
  let e = st;
  for (let k = 0; k < 100; k++) {
    const r = siguiente(pasos, e);
    e = r.estado;
    if (!r.evento) { if (e.terminado || !e.hilos.length) break; continue; }
    const ev: EventoSim = r.evento;
    out.push(ev.t === 'mensaje' ? `💬${ev.paso.cuerpo}` : ev.t === 'fin' ? '■' : ev.t === 'condicion' ? '◇' : ev.texto);
    if (ev.t === 'fin' || ev.t === 'condicion') break;
  }
  return out;
}

// rotura 4 («Probar» no saltea): 5 pass / 1 fail, cae éste.
test('«Probar» hace lo mismo que el motor, y lo dice en la pastilla', () => {
  assert.deepEqual(correr(flujo(), iniciar(flujo(), { reunionMin: 180 })), [
    '⏳ 1 día antes de la reunión · agendó más cerca: no sale', '⏳ 1 h antes de la reunión', '💬En una hora', '■',
  ]);
  assert.deepEqual(correr(flujo(), iniciar(flujo(), { reunionMin: 1440 })), [
    '⏳ 1 día antes de la reunión', '💬Mañana es tu reunión', '⏳ 1 h antes de la reunión', '💬En una hora', '■',
  ]);
  assert.deepEqual(correr(flujo(DIA_SALE), iniciar(flujo(DIA_SALE), { reunionMin: 180 }))[1], '💬Mañana es tu reunión');
});

// rotura 5 (sin el aviso en la píldora): 5 pass / 1 fail, cae éste.
test('el aviso: con huecos en Calendly más cerca que la mitad, la píldora lleva su ⚠ con la frase', () => {
  assert.equal(avisoAgendaCerca(DIA, 180), 'Calendly tiene huecos a 3 h: quien agende con menos de 12 h no recibe esto');
  assert.equal(avisoAgendaCerca(DIA, 800), null);
  assert.equal(avisoAgendaCerca(DIA_SALE, 180), null, 'si sale enseguida, no hay nada que avisar');
  assert.equal(avisoAgendaCerca(DIA, null), null, 'sin saber la anticipación, nada');
  const g = grafoDeSecuencia(flujo() as never, { disparador: 'Agendó', anticipacionMin: 180 });
  assert.match(String(g.nodos.find((n) => n.id === 'w1')?.advertencia), /^Calendly tiene huecos a 3 h/);
  // Una espera entre dos tarjetas es una PASTILLA de la flecha: el aviso viaja con ella, y Lienzo dibuja la ⚠.
  const pastilla = g.aristas.flatMap((a) => a.esperas ?? []).find((e) => e.id === 'w1');
  assert.match(String(pastilla?.aviso), /^Calendly tiene huecos a 3 h/);
  assert.match(leer('app/_components/Lienzo.tsx'), /\{e\.aviso && <span data-aviso-pildora style=\{\{ fontSize: 10\.5, color: 'var\(--warn\)' \}\}>⚠<\/span>\}/);
  assert.equal(g.nodos.find((n) => n.id === 'w2')?.advertencia, undefined, 'a «1 h antes» se llega con 3 h');
  assert.equal(grafoDeSecuencia(flujo() as never, { disparador: 'Agendó' }).nodos.find((n) => n.id === 'w1')?.advertencia, undefined);
});

// rotura 6 (la lectura toma «no pude leer» como «no está»): 5 pass / 1 fail, cae éste.
// rotura 7 (el editor pierde «sale» al cambiar el número): 5 pass / 1 fail, cae éste.
test('la lectura en la API de MaKo y en el lienzo, y la opción en el editor de la espera', () => {
  const op = porId('anticipacion_agenda');
  assert.ok(op && op.tipo === 'lectura' && op.area === 'calendario');
  assert.match(leer('lib/api-mako/rest.ts'), /\['GET', '\/calendario\/anticipacion', 'anticipacion_agenda'\]/);
  const lectura = leer('lib/agenda-anticipacion.ts');
  assert.match(lectura, /try \{ token = await credWsEstricta\('CALENDLY_API_TOKEN', ws\); \} catch \(e\) \{ return \{ ok: false,/);
  assert.match(leer('app/api/flujos/anticipacion/route.ts'), /if \(rol !== 'admin'\)/);
  const lienzo = leer('app/automations/FlujoLienzo.tsx');
  assert.match(lienzo, /fetch\('\/api\/flujos\/anticipacion'/);
  assert.match(lienzo, /anticipacionMin: anticipacion \?\? null,/);
  assert.match(lienzo, /ariaLabel="Si agenda más cerca"/);
  assert.match(lienzo, /minutos: minutosDeSegundos\(Math\.max\(1, Math\.round\(cuanto\)\) \* SEGUNDOS_DE\[u\]\), \.\.\.\(modo === 'antes_reunion' \? cerca : \{\}\) \}/);
});
