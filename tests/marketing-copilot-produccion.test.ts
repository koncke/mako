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
//   8. «← Media Buyer», «Ir al Media Buyer» y el cargando decían el nombre viejo de la tab;
//   9. «desde Marketing CoPilot» + «Marketing CoPilot: Volvamos a empezar»: el nombre iba dos veces;
//  10. al aceptar el funnel que propuso MaKo, su aviso pasaba a «¿Seguimos?» y la respuesta a «Sí, cambiemos»;
//  11. la propuesta de mensajes contaba agendas «por llamada calificada»; 12. «Llamada de venta contigo» antes de preguntar quién llama;
//  13. sin Meta conectada, «¿En qué te ayudo hoy?» tapaba la barra (Plan, Ajustes) de un negocio que ya tenía su estrategia;
//  14. una tienda no tenía su ticket ($50, $100) entre las opciones; 15. Nueva campaña sin Meta: «ni su Zernio» y ningún botón;
//  16. tras «Empezar de nuevo» quedaba sólo «Deshacer», sin cómo empezar (y sin la app no se puede escribir).
//
// Correr: node --import tsx --test tests/marketing-copilot-produccion.test.ts
// PROBADO ROMPIÉNDOLO, ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FUNNELS, interpretarEscrito, opcionesDeCopiloto, mensajesDeCopiloto, propuestaDe, recorridoDe, compararFunnels, datosDeDecision, datosDichos, faltaParaComparar, funnelsDelReferente, pasosDeLaSemana, type PerfilCopiloto } from '../lib/media-buyer/copiloto';
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

test('9. lo que se pide desde la tab no lleva «Marketing CoPilot:» delante: el chip «desde» ya lo dice', () => {
  for (const r of ['app/ads-manager/MediaBuyer.tsx', 'app/ads-manager/PlanDelCopiloto.tsx']) assert.doesNotMatch(leer(r), /texto: `Marketing CoPilot: \$\{texto\}`/, r);
});

test('10. aceptar el funnel que propone MaKo no borra de la charla por qué se cambió', () => {
  const base: PerfilCopiloto = { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 1000, presupuestoMes: 600, llamadas: 'yo' };
  const r = interpretarEscrito(base, 'Sí, anuncios a mensajes');
  assert.ok('perfil' in r, 'el botón se entiende');
  const despues = 'perfil' in r ? r.perfil : base;
  assert.equal(despues.funnel, 'mensajes');
  const textos = mensajesDeCopiloto(despues, 'Martín').map((m) => m.texto).join(' | ');
  assert.match(textos, /El VSL con llamada pide una venta de unos \$3,000/, 'el aviso sigue en la charla');
  assert.match(textos, /Sí, anuncios a mensajes/, 'y lo que tocó, como lo tocó');
  assert.doesNotMatch(textos, /¿Seguimos\?|Sí, cambiemos/);
});

test('11. la propuesta de mensajes no cuenta agendas ni «llamadas calificadas»', () => {
  const mensajes = propuestaDe({ entrada: 'funnel', funnel: 'mensajes', ticket: 1000, presupuestoMes: 600, llamadas: 'yo' })!;
  const t = mensajes.puntos.join(' ');
  assert.doesNotMatch(t, /agenda|llamada calificada/);
  assert.match(t, /conversación calificada/);
  assert.match(propuestaDe({ entrada: 'funnel', funnel: 'vsl-llamada', ticket: 3000, presupuestoMes: 2000, llamadas: 'yo' })!.puntos.join(' '), /agendas al mes/, 'el VSL sí');
});

test('12. el recorrido no dice con quién es la llamada antes de preguntarlo', () => {
  const sin = recorridoDe({ entrada: 'funnel', funnel: 'vsl-llamada' });
  assert.match(sin.find((e) => e.id === 'cerrar')!.que, /^Llamada de venta\.$/);
  assert.match(recorridoDe({ entrada: 'funnel', funnel: 'vsl-llamada', llamadas: 'equipo' }).find((e) => e.id === 'cerrar')!.que, /con tu equipo/);
});

test('13. sin Meta conectada y con su estrategia, la tab no se tapa con la bienvenida: Plan y Ajustes siguen a mano', () => {
  const mb = leer('app/ads-manager/MediaBuyer.tsx');
  assert.match(mb, /const bienvenida = nueva && !perfil;/);
  assert.match(mb, /if \(bienvenida\) \{\s*return \(/, 'la pantalla entera de bienvenida, sólo sin estrategia');
});

test('14. una tienda o un curso chico tiene su ticket entre las opciones (sin la app no se puede escribir)', () => {
  const op = opcionesDeCopiloto('ticket', { entrada: 'funnel', funnel: 'carrito' });
  assert.ok(op.includes('$50') && op.includes('$100'), op.join(' '));
  const r = interpretarEscrito({ entrada: 'funnel', funnel: 'carrito' }, '$50');
  assert.equal('perfil' in r ? r.perfil.ticket : null, 50);
});

test('15. Nueva campaña sin Meta ofrece conectar, en palabras de producto (no «ni su Zernio» y un callejón)', () => {
  assert.doesNotMatch(leer('lib/media-buyer/datos.ts'), /ni su Zernio/);
  const ruta = leer('app/api/media-buyer/route.ts');
  assert.equal((ruta.match(/SinCuentaParaOperar\) return J\(\{ ok: false, error: e\.message, sinCuenta: true \}, 409\)/g) ?? []).length, 2);
  const nc = leer('app/ads-manager/NuevaCampana.tsx');
  assert.match(nc, /if \(sinCuenta\) return <div className="mb"><div className="mba-ajustes">\{cab\}\{conectar\}<\/div><\/div>;/);
});

test('16. tras «Empezar de nuevo» están los botones para empezar, no sólo «Deshacer»', () => {
  assert.match(leer('app/ads-manager/PrimeraEntrada.tsx'), /const conOpcionesDeNota = !!ultimaNota\?\.opciones && ultimoItem\?\.id === ultimaNota\.id && !ultimaNota\.opciones\.every\(\(o\) => o\.deshacer\);/);
});

// PROBADO ROMPIÉNDOLO (10/11/2026):
//   · `compararFunnels` con `datosDeDecision` como antes        → rojo 1 (cada funnel con anuncios «no sirve» por $0).
//   · sin la rama del email sin lista                           → rojo 1b.
//   · `.cp` con `calc(100dvh - 28px)`                            → rojo 4.
