// =============================================================================
// Lo que se rompía en producción en la tab Marketing CoPilot (recorrido del 10/11/2026, ws 9, hola-mako.com)
// =============================================================================
// Martín: «muchísimas cosas que se están rompiendo… es fácil ver e identificar eso». Medido en el navegador:
//   1. con Julián Otálora (enseña sólo orgánico) y el ticket contestado, «Comparar funnels» decía «Con $0 al mes los anuncios no juntan
//      datos» en cada funnel con anuncios, «MaKo lo recomienda» en Lead magnets y «Te sirve» en Email sin saber si hay lista. Nadie había
//      preguntado el presupuesto: `datosDeDecision` completa «orgánico no lleva plata» para juzgar ESE funnel, y la comparación lo usaba
//      para los nueve. Ahora compara y recomienda `datosDichos` (sólo lo que dijo);
//   2. sin números, cada fila repetía «Faltan tus números»: lo que falta va UNA vez arriba de la lista;
//   3. la estrella de la barra (EstrellaDeLaApp) tapaba la caja del chat del CoPilot: las pantallas con el chat a la vista se anotan;
//   4. con la franja «Estás viendo el dashboard de…», la pantalla medía 100dvh y el pie quedaba 50 px debajo: descuenta `--barra-agencia`;
//   5. «Tu funnel está en marcha. ¿Qué miramos?» y sus botones seguían debajo de la respuesta: en el CoPilot se van al escribir;
//   6. «Lanzar el primer anuncio» era el único paso de «Esta semana» sin botón: va a Nueva campaña;
//   7. Ajustes juzgaba el funnel con `presupuestoMes ?? 0` y `llamadas ?? 'yo'`;
//   8. «← Media Buyer», «Ir al Media Buyer» y el cargando decían el nombre viejo de la tab.
//
// Correr: node --import tsx --test tests/marketing-copilot-produccion.test.ts
// PROBADO ROMPIÉNDOLO, ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FUNNELS, compararFunnels, datosDeDecision, datosDichos, faltaParaComparar, funnelsDelReferente, pasosDeLaSemana, type PerfilCopiloto } from '../lib/media-buyer/copiloto';
import { negocioDelCopiloto } from '../lib/media-buyer/copiloto-contexto';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8');

// El perfil del ws 9 a las 19:20 del 10/11, leído con `copiloto_leer`.
const JULIAN: PerfilCopiloto = { entrada: 'referente', referente: 'julian-otalora', ticket: 500 };

test('1. lo que el funnel elegido no pregunta no se usa para comparar los otros', () => {
  assert.deepEqual(funnelsDelReferente('julian-otalora'), ['organico'], 'el caso: un referente que enseña sólo orgánico');
  assert.ok(datosDeDecision(JULIAN), 'para juzgar el orgánico, sí se completa: no lleva plata');
  assert.equal(datosDichos(JULIAN), null, 'para comparar, no: el presupuesto no lo dijo');
  const c = compararFunnels(JULIAN);
  assert.ok(c.every((x) => x.sirve === null), 'ningún funnel «sirve» o «no sirve» con un $0 que nadie contestó');
  assert.ok(!c.some((x) => /\$0/.test(x.motivo ?? '')));
  const n = negocioDelCopiloto(JULIAN);
  assert.doesNotMatch(n, /LO QUE DICEN LAS REGLAS DE MAKO/, 'no recomienda otro funnel por un $0 supuesto');
  assert.doesNotMatch(n, /Con \$0 al mes/);
  assert.match(n, /El funnel elegido SÍ le sirve/, 'el orgánico elegido se sigue juzgando');
  assert.match(n, /todavía no se pueden comparar con sus números \(falta cuánto puede poner en anuncios, quién atiende; no lo preguntes para el funnel que eligió/);
});

test('1b. con lo que dijo, compara; un email sin saber la lista no «sirve»', () => {
  const p: PerfilCopiloto = { ...JULIAN, presupuestoMes: 0, llamadas: 'yo' };
  assert.ok(datosDichos(p));
  const c = compararFunnels(p);
  assert.equal(c.find((x) => x.funnel.id === 'mensajes')!.sirve, false, 'ahora sí: dijo que no tiene plata para anuncios');
  const email = c.find((x) => x.funnel.id === 'email')!;
  assert.equal(email.sirve, null);
  assert.equal(email.falta, 'cuántos contactos tienes en tu lista');
  assert.equal(compararFunnels({ ...p, lista: 3000 }).find((x) => x.funnel.id === 'email')!.sirve, true);
  assert.equal(compararFunnels({ ...p, lista: 100 }).find((x) => x.funnel.id === 'email')!.sirve, false);
  assert.deepEqual(faltaParaComparar(JULIAN), ['cuánto puedes poner en anuncios por mes', 'quién atiende a tus clientes']);
});

test('1c. el panel y la herramienta de lectura recomiendan con lo que dijo', () => {
  const panel = leer('app/ads-manager/PanelDelFunnel.tsx');
  assert.match(panel, /const d = datosDichos\(perfil\);\s*const recomendado = d \? recomendarFunnel\(d\) : null;/);
  assert.match(leer('lib/api-mako/areas/ads.run.ts'), /recomendado: dichos \? recomendarFunnel\(dichos\) : null/);
});

test('2. sin números, lo que falta va una vez y no en cada fila', () => {
  const panel = leer('app/ads-manager/PanelDelFunnel.tsx');
  assert.doesNotMatch(panel, /'Faltan tus números'/);
  assert.match(panel, /Para decirte cuál te sirve me falta saber \{faltaComparar/);
});

test('3. las pantallas con el chat de MaKo a la vista no llevan la estrella de la barra', () => {
  for (const r of ['app/ads-manager/PrimeraEntrada.tsx', 'app/ads-manager/PlanDelCopiloto.tsx']) {
    assert.match(leer(r), /useEffect\(\(\) => anotarEstrellaPropia\(\), \[\]\);/, r);
  }
});

test('4. el alto de la pantalla descuenta la franja de arriba', () => {
  const css = leer('app/ads-manager/aa.css');
  assert.match(css, /\.cp \{ height: calc\(100dvh - 28px - var\(--barra-agencia, 0px\)\);/);
  assert.doesNotMatch(css, /height: calc\(100dvh - \d+px\);/, 'ningún alto de la tab mira sólo la ventana');
});

test('5. en el CoPilot la apertura se va cuando la persona escribe (en las otras tabs, como siempre)', () => {
  const panel = leer('app/_chat/MakoEnLaTab.tsx');
  assert.match(panel, /const aperturaDeLaTab = aperturaHastaEscribir && alCargar\.current != null && mios > alCargar\.current \? null : aperturaPedida;/);
  assert.match(panel, /aperturaHastaEscribir = false/, 'opcional: las demás tabs no cambian');
  assert.match(leer('app/ads-manager/PlanDelCopiloto.tsx'), /<ConversacionCerebro tab="Marketing CoPilot" titulo="MaKo" apertura=\{apertura\} aperturaHastaEscribir/);
});

test('6. en «Esta semana» cada paso de un funnel con anuncios lleva su pantalla (lanzar, también)', () => {
  for (const f of FUNNELS.filter((x) => x.anuncios === 'si')) {
    const pasos = pasosDeLaSemana({ entrada: 'funnel', funnel: f.id, ticket: 3000, presupuestoMes: 2000, llamadas: 'yo', aceptado: true });
    assert.ok(pasos.length, f.id);
    for (const x of pasos) assert.ok(x.href && x.pantalla, `${f.id}: «${x.texto}» sin pantalla`);
  }
});

test('7. Ajustes tampoco juzga el funnel con un $0 o un «lo atiendo yo» que nadie dijo', () => {
  const a = leer('app/ads-manager/Ajustes.tsx');
  assert.doesNotMatch(a, /presupuestoMes \?\? 0/);
  assert.match(a, /const veredicto = funnel && decide \? evaluarFunnel\(funnel\.id, decide\) : null;/);
});

test('8. la tab se nombra Marketing CoPilot en lo que se ve y se lee (el agente «Media Buyer» sigue con su nombre)', () => {
  assert.match(leer('app/ads-manager/Automatizaciones.tsx'), /label: 'Marketing CoPilot'/);
  assert.doesNotMatch(leer('app/ads-manager/NuevaCampana.tsx'), /Ir al Media Buyer/);
  assert.match(leer('app/ads-manager/loading.tsx'), /que="Marketing CoPilot"/);
});

// PROBADO ROMPIÉNDOLO (10/11/2026):
//   · `compararFunnels` con `datosDeDecision` como antes        → rojo 1 (cada funnel con anuncios «no sirve» por $0).
//   · sin la rama del email sin lista                           → rojo 1b.
//   · `.cp` con `calc(100dvh - 28px)`                            → rojo 4.
