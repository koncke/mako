// =============================================================================
// Marketing CoPilot — volver atrás y empezar de nuevo, escrito o con el botón, SIN IA (6/11/2026)
// =============================================================================
// Martín, 6/11/2026: «le dije "Volvamos a empezar" porque seleccioné por error a un influencer y quería la otra opción y no funcionó
// cuando le dije eso». Fija `interpretarEscrito` / `comandoDeCopiloto` / `volverUnPaso` (lib/media-buyer/copiloto.ts): las frases con
// que la gente pide volver o empezar se reconocen antes de gastar IA, y lo que es charla sigue yendo a MaKo.
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { acuseDeVolver, comandoDeCopiloto, enFrase, interpretarEscrito, pasoDeCopiloto, preguntaDeCopiloto, volverUnPaso, type PerfilCopiloto } from '../lib/media-buyer/copiloto';

/** Un negocio que eligió a un referente por error: está en la pregunta del ticket. */
const CON_REFERENTE: PerfilCopiloto = { entrada: 'referente', referente: 'julian-otalora' };

test('«volvamos a empezar» y sus formas empiezan de nuevo', () => {
  for (const t of ['Volvamos a empezar', 'volvamos a empezar!', 'empecemos de nuevo', 'quiero empezar de cero', 'arranquemos de nuevo', 'desde el principio', 'reiniciar', 'Volver a empezar']) {
    const r = interpretarEscrito(CON_REFERENTE, t);
    assert.equal(r.tipo, 'empezar', `«${t}»`);
    assert.deepEqual('perfil' in r ? r.perfil : null, {}, `«${t}» deja la charla vacía`);
  }
});

test('«me equivoqué», «la otra opción», «no era eso», «volver»: un paso atrás', () => {
  assert.equal(pasoDeCopiloto(CON_REFERENTE), 'ticket');
  for (const t of ['me equivoqué', 'Me equivoque', 'elegí mal', 'lo toqué sin querer', 'quiero la otra opción', 'no era eso', 'volver', 'volvamos atrás', 'atrás', 'corregir']) {
    const r = interpretarEscrito(CON_REFERENTE, t);
    assert.equal(r.tipo, 'volver', `«${t}»`);
    assert.equal(pasoDeCopiloto('perfil' in r ? r.perfil : {}), 'referente', `«${t}» vuelve a elegir referente`);
  }
});

test('«la otra opción» en un paso de dos elige la otra: el caso de Martín (eligió un referente y quería el funnel)', () => {
  const r = interpretarEscrito({ entrada: 'referente' }, 'quiero la otra opción');
  assert.equal(r.tipo, 'volver');
  assert.equal('perfil' in r && r.perfil.entrada, 'funnel');
  assert.equal(pasoDeCopiloto('perfil' in r ? r.perfil : {}), 'funnel');
});

test('lo que viene con el pedido se lee en el paso al que se volvió: «me equivoqué, son 3000»', () => {
  const p: PerfilCopiloto = { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 5000 };
  assert.equal(pasoDeCopiloto(p), 'presupuesto');
  const r = interpretarEscrito(p, 'me equivoqué, son 3000');
  assert.equal(r.tipo, 'volver');
  assert.equal('perfil' in r && r.perfil.ticket, 3000);
  assert.equal(pasoDeCopiloto('perfil' in r ? r.perfil : {}), 'presupuesto');
});

test('«cambiar» suelto vuelve; pero en el aviso y en la propuesta «cambiar» es la respuesta', () => {
  assert.equal(interpretarEscrito(CON_REFERENTE, 'cambiar').tipo, 'volver');
  assert.equal(interpretarEscrito(CON_REFERENTE, 'quiero cambiar').tipo, 'volver');
  const aviso: PerfilCopiloto = { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 200, presupuestoMes: 3000, llamadas: 'yo' };
  assert.equal(pasoDeCopiloto(aviso), 'ajuste');
  const r = interpretarEscrito(aviso, 'cambiar');
  assert.equal(r.tipo, 'respuesta');
  assert.equal('perfil' in r && r.perfil.ajuste, 'cambio');
  const prop: PerfilCopiloto = { entrada: 'funnel', funnel: 'lead-magnet', ticket: 1000, presupuestoMes: 600, competencia: 'luego' };
  assert.equal(pasoDeCopiloto(prop), 'propuesta');
  assert.equal(interpretarEscrito(prop, 'Cambiar los números').tipo, 'respuesta');
});

test('volver del «Sí, cambiemos» devuelve el funnel que había elegido (no deja el que propuso MaKo)', () => {
  const aviso: PerfilCopiloto = { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 200, presupuestoMes: 3000, llamadas: 'yo' };
  const r = interpretarEscrito(aviso, 'Sí, cambiemos');
  const cambiado = 'perfil' in r ? r.perfil : {};
  assert.equal(cambiado.funnel, 'carrito');
  const v = volverUnPaso(cambiado)!;
  assert.equal(v.paso, 'ajuste');
  assert.equal(v.perfil.funnel, 'vsl-llamada');
  assert.equal(pasoDeCopiloto(v.perfil), 'ajuste', 'vuelve a preguntar si cambia');
});

test('en la primera pregunta no hay nada antes; y la charla sigue yendo a MaKo', () => {
  assert.equal(interpretarEscrito({}, 'volver').tipo, 'nada');
  for (const t of ['¿cuánto cuesta un anuncio?', 'tengo una agencia de marketing', 'vendo cursos de cocina', 'quiero volver a vender como antes', '¿qué es un webinar?']) {
    assert.equal(interpretarEscrito({ entrada: 'referente', referente: 'francisco-doglio' }, t).tipo, 'libre', `«${t}»`);
  }
});

test('el botón y lo escrito son lo mismo: volver un paso cada vez hasta el principio', () => {
  let p: PerfilCopiloto = { entrada: 'funnel', funnel: 'organico', ticket: 1000, objetivo: 'ventas', ritmo: 3, formato: 'reels' };
  const pasos: string[] = [];
  for (let v = volverUnPaso(p); v; v = volverUnPaso(p)) { pasos.push(v.paso); p = v.perfil; }
  assert.deepEqual(pasos, ['formato', 'ritmo', 'objetivo', 'ticket', 'funnel', 'entrada']);
  assert.deepEqual(p, {});
});

test('las frases sueltas: fuerte antes de leer la respuesta, débil después', () => {
  assert.equal(comandoDeCopiloto('no era eso', 'fuerte'), 'volver', '«no» de «no era eso» no es «más adelante»');
  assert.equal(comandoDeCopiloto('cambiar', 'fuerte'), null);
  assert.equal(comandoDeCopiloto('cambiar', 'debil'), 'volver');
  assert.equal(comandoDeCopiloto('Más adelante', 'fuerte'), null);
});

test('MaKo acusa lo que escribió al volver: un paso atrás, o lo que quedó cambiado', () => {
  // Doglio, ya en el ticket con «Orgánico en Instagram»: «quiero la otra opción» vuelve al funnel y elige el webinar.
  const doglio: PerfilCopiloto = { entrada: 'referente', referente: 'francisco-doglio', funnel: 'organico' };
  assert.equal(pasoDeCopiloto(doglio), 'ticket');
  const otra = interpretarEscrito(doglio, 'me equivoqué, quiero la otra opción');
  assert.equal(otra.tipo, 'volver');
  const despues = 'perfil' in otra ? otra.perfil : {};
  assert.equal(despues.funnel, 'webinar');
  assert.equal(acuseDeVolver(doglio, despues), 'Listo, cambiado: Webinar.');
  // Sin nada más que el pedido: vuelve a elegir referente, y lo dice.
  const atras = interpretarEscrito(CON_REFERENTE, 'me equivoqué');
  assert.equal(acuseDeVolver(CON_REFERENTE, 'perfil' in atras ? atras.perfil : {}), 'Volvemos un paso.');
});

test('el nombre de un funnel en una frase conserva las marcas y las siglas', () => {
  assert.equal(enFrase('Orgánico en Instagram'), 'orgánico en Instagram');
  assert.equal(enFrase('Instagram orgánico'), 'Instagram orgánico');
  assert.equal(enFrase('Anuncios a un VSL con llamada'), 'anuncios a un VSL con llamada');
  assert.equal(enFrase('YouTube'), 'YouTube');
  assert.equal(enFrase('Webinar'), 'webinar');
  assert.equal(preguntaDeCopiloto('ticket', { entrada: 'funnel', funnel: 'organico' }, 'Martín'), 'Para orgánico en Instagram: ¿cuánto te deja una venta, en dólares?');
});

test('lo que se dice del negocio no borra la charla ni vuelve atrás (la revisión del 6/11)', () => {
  const ticket: PerfilCopiloto = { entrada: 'funnel', funnel: 'vsl-llamada' };
  assert.equal(pasoDeCopiloto(ticket), 'ticket');
  // Contar que el negocio arranca de cero no es pedir empezar de nuevo; y con el número adentro, se lee el ticket.
  assert.equal(interpretarEscrito(ticket, 'Estoy empezando de cero en esto, vendo mentorías').tipo, 'libre');
  const conNumero = interpretarEscrito(ticket, '3000 y arranco de cero');
  assert.equal(conNumero.tipo, 'respuesta');
  assert.equal('perfil' in conNumero && conNumero.perfil.ticket, 3000);
  // Una pregunta con «otra opción» va a MaKo; «¿volvemos atrás?» sí vuelve.
  assert.equal(interpretarEscrito(ticket, '¿Hay otra opción para el ticket?').tipo, 'libre');
  assert.equal(interpretarEscrito(ticket, '¿volvemos atrás?').tipo, 'volver');
  // «Otra opción» suelta en una frase larga es charla.
  assert.equal(comandoDeCopiloto('me gusta tener otra opción de pago para mis clientes', 'fuerte'), null);
});

test('aceptar la propuesta pide un sí claro: «No sé si me sirve» va a MaKo', () => {
  const lista: PerfilCopiloto = { entrada: 'funnel', funnel: 'organico', ticket: 1000, objetivo: 'ventas', ritmo: 3, formato: 'reels', competencia: 'luego' };
  assert.equal(pasoDeCopiloto(lista), 'propuesta');
  assert.equal(interpretarEscrito(lista, 'No sé si me sirve').tipo, 'libre');
  assert.equal(interpretarEscrito(lista, 'me gusta este funnel pero tengo dudas').tipo, 'libre', 'nombrar el funnel no lo borra');
  for (const t of ['Me sirve, empecemos', 'sí', 'dale', 'perfecto, vamos']) {
    const r = interpretarEscrito(lista, t);
    assert.equal(r.tipo, 'respuesta', `«${t}»`);
    assert.equal('perfil' in r && r.perfil.aceptado, true, `«${t}»`);
  }
});

test('«no lo enseña» sale cuando se PIDE otro funnel, no cuando se lo nombra charlando', () => {
  const derek: PerfilCopiloto = { entrada: 'referente', referente: 'derek-chamizo' };
  assert.equal(interpretarEscrito(derek, 'tengo muchos seguidores en instagram, que hago').tipo, 'libre');
  assert.equal(interpretarEscrito(derek, 'quiero instagram orgánico').tipo, 'fuera');
});

// ── Probado rompiéndolo (6/11/2026) ───────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado:
//   1. sacar la regla de «empezar» de comandoDeCopiloto                     → 1 rojo («volvamos a empezar»).
//   2. sacar el «volver» fuerte (sólo queda leer la respuesta y el débil)    → 4 rojos («no era eso» lo toma la competencia por «luego»).
//   3. volverUnPaso sin restaurar `antesDelAjuste`                            → 1 rojo («volver del Sí, cambiemos»).
//   4. «la otra opción» sin elegir la otra en un paso de dos                 → 1 rojo («el caso de Martín»).
//   5. acuseDeVolver que dice siempre «Volvemos un paso.»                     → 1 rojo («MaKo acusa…»).
//   6. enFrase con toLowerCase() entero («Para orgánico en instagram»)        → 1 rojo («el nombre de un funnel en una frase…»).
//   7. devolver `\bde cero\b` suelto como «empezar»                          → 1 rojo («lo que se dice del negocio…»).
//   8. aceptar la propuesta con /sirve|empec|ok|dale/ sin anclar              → 1 rojo («aceptar la propuesta pide un sí claro»).
//   9. fueraDe sin mirar si lo pide                                            → 1 rojo («"no lo enseña" sale cuando se PIDE…»).
