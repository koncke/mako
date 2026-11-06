// =============================================================================
// Marketing CoPilot — la primera entrada y las reglas de qué funnel conviene (6/11/2026)
// =============================================================================
// Fija lib/media-buyer/copiloto.ts: qué funnel se recomienda según ticket, presupuesto y quién llama; cuándo el elegido NO le sirve
// al negocio (y cuál se propone); la charla de una pregunta por vez; y que la pantalla muestre «Campañas» sólo con anuncios.
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  FUNNELS, REFERENTES_COPILOTO, aplicarCambio, evaluarFunnel, leerRespuestaCopiloto, mensajesDeCopiloto, opcionesDeCopiloto,
  pasoDeCopiloto, planOrganico, propuestaDe, recomendarFunnel, sanearPerfil, seccionesDe, copilotoListo, avisoPendiente, conCampanas, medirDe, tareasDeLaSemana, RUTAS_COPILOTO,
  seccionesDelTelefono, desdeDelCopiloto, ORIGEN_COPILOTO,
  type PerfilCopiloto,
} from '../lib/media-buyer/copiloto';
import { ASESORES } from '../lib/asesores/catalogo';

/** Contesta paso por paso con el texto dado, como lo haría la pantalla. */
function charla(respuestas: string[], inicial: PerfilCopiloto = {}): PerfilCopiloto {
  let p = inicial;
  for (const t of respuestas) {
    const paso = pasoDeCopiloto(p);
    const c = leerRespuestaCopiloto(paso, t, p);
    assert.ok(c, `el paso «${paso}» no entendió «${t}»`);
    p = aplicarCambio(p, c);
  }
  return p;
}

test('recomendar: ticket, presupuesto y quién llama deciden el funnel', () => {
  assert.equal(recomendarFunnel({ ticket: 5000, presupuestoMes: 3000, llamadas: 'yo' }).funnel, 'vsl-llamada');
  assert.equal(recomendarFunnel({ ticket: 5000, presupuestoMes: 3000, llamadas: 'equipo' }).funnel, 'vsl-llamada');
  // Ticket alto con poca plata: no se llena un calendario; formulario ahora y VSL después.
  const poca = recomendarFunnel({ ticket: 5000, presupuestoMes: 600, llamadas: 'yo' });
  assert.equal(poca.funnel, 'formulario');
  assert.equal(poca.masAdelante, 'vsl-llamada');
  // Sin nadie que llame, a un ticket que se vende hablando: junta contactos y llama tú.
  assert.equal(recomendarFunnel({ ticket: 5000, presupuestoMes: 3000, llamadas: 'nadie' }).funnel, 'lead-magnet');
  // Ticket bajo: compra directa.
  assert.equal(recomendarFunnel({ ticket: 97, presupuestoMes: 600, llamadas: 'nadie' }).funnel, 'carrito');
  // Sin plata para anunciar: ticket alto = orgánico; ticket medio = lead magnet. Nunca un funnel de anuncios.
  assert.equal(recomendarFunnel({ ticket: 5000, presupuestoMes: 0, llamadas: 'yo' }).funnel, 'organico');
  assert.equal(recomendarFunnel({ ticket: 1000, presupuestoMes: 100, llamadas: 'yo' }).funnel, 'lead-magnet');
  // Webinar: equipo que llama, ticket medio y plata para llenarlo.
  assert.equal(recomendarFunnel({ ticket: 1500, presupuestoMes: 2000, llamadas: 'equipo' }).funnel, 'webinar');
  assert.equal(recomendarFunnel({ ticket: 1500, presupuestoMes: 2000, llamadas: 'yo' }).funnel, 'mensajes');
  for (const t of [0.5, 97, 1000, 3000, 20000]) for (const p of [0, 299, 300, 1500, 9000]) for (const l of ['yo', 'equipo', 'nadie'] as const) {
    const r = recomendarFunnel({ ticket: t, presupuestoMes: p, llamadas: l });
    assert.ok(FUNNELS.some((f) => f.id === r.funnel) && r.porque.length > 20, `${t}/${p}/${l}`);
  }
});

test('el límite es exacto: 3.000 de ticket y 1.500 de presupuesto ya alcanzan; un dólar menos, no', () => {
  assert.equal(recomendarFunnel({ ticket: 3000, presupuestoMes: 1500, llamadas: 'yo' }).funnel, 'vsl-llamada');
  assert.equal(recomendarFunnel({ ticket: 2999, presupuestoMes: 1500, llamadas: 'yo' }).funnel, 'mensajes');
  assert.equal(recomendarFunnel({ ticket: 3000, presupuestoMes: 1499, llamadas: 'yo' }).funnel, 'formulario');
  assert.equal(recomendarFunnel({ ticket: 500, presupuestoMes: 300, llamadas: 'yo' }).funnel, 'carrito');
  assert.equal(recomendarFunnel({ ticket: 501, presupuestoMes: 300, llamadas: 'yo' }).funnel, 'mensajes');
});

test('evaluar: el funnel elegido que no le sirve se dice, con el motivo y cuál se propone', () => {
  const ok = evaluarFunnel('vsl-llamada', { ticket: 5000, presupuestoMes: 3000, llamadas: 'yo' });
  assert.deepEqual([ok.sirve, ok.motivo, ok.mejor], [true, null, null]);
  const barato = evaluarFunnel('vsl-llamada', { ticket: 200, presupuestoMes: 3000, llamadas: 'yo' });
  assert.equal(barato.sirve, false);
  assert.match(barato.motivo!, /3,000/);
  assert.equal(barato.mejor?.funnel, 'carrito');
  assert.equal(evaluarFunnel('vsl-llamada', { ticket: 5000, presupuestoMes: 3000, llamadas: 'nadie' }).sirve, false);
  assert.equal(evaluarFunnel('carrito', { ticket: 5000, presupuestoMes: 3000, llamadas: 'yo' }).sirve, false, 'comprar sin llamar a ese precio casi no funciona');
  assert.equal(evaluarFunnel('webinar', { ticket: 1500, presupuestoMes: 400, llamadas: 'equipo' }).sirve, false);
  assert.equal(evaluarFunnel('formulario', { ticket: 1500, presupuestoMes: 100, llamadas: 'yo' }).sirve, false, 'con US$100 al mes un anuncio no aprende');
  // Orgánico y YouTube no dependen de la plata ni de las llamadas.
  for (const f of ['organico', 'youtube'] as const) assert.equal(evaluarFunnel(f, { ticket: 5000, presupuestoMes: 0, llamadas: 'nadie' }).sirve, true);
  // Si el elegido ES el recomendado, no hay "mejor" que proponer.
  assert.equal(evaluarFunnel('lead-magnet', { ticket: 1000, presupuestoMes: 100, llamadas: 'yo' }).mejor, null);
});

test('la charla: una pregunta por vez, en orden, y termina en la propuesta', () => {
  let p: PerfilCopiloto = {};
  assert.equal(pasoDeCopiloto(p), 'entrada');
  const vistos: string[] = [];
  const guion = ['Elegir un tipo de funnel', 'Anuncios a un VSL con llamada', '$5,000', '$3,000 al mes', 'Yo', 'Sí, investígala', 'Me sirve, empecemos'];
  for (const t of guion) {
    const paso = pasoDeCopiloto(p);
    vistos.push(paso);
    const m = mensajesDeCopiloto(p);
    const ult = m[m.length - 1];
    assert.equal(ult.de, 'mako', 'siempre termina con una pregunta de MaKo');
    assert.ok((ult.opciones ?? []).length > 0, `«${paso}» ofrece pastillas`);
    p = aplicarCambio(p, leerRespuestaCopiloto(paso, t, p)!);
  }
  assert.deepEqual(vistos, ['entrada', 'funnel', 'ticket', 'presupuesto', 'llamadas', 'competencia', 'propuesta']);
  assert.equal(pasoDeCopiloto(p), 'listo');
  assert.ok(copilotoListo(p));
});

test('cada pastilla que ofrece un paso la entiende ese mismo paso (ninguna queda muerta)', () => {
  const casos: PerfilCopiloto[] = [
    {}, { entrada: 'referente' }, { entrada: 'funnel' },
    { entrada: 'funnel', funnel: 'vsl-llamada' }, { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 5000 },
    { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 5000, presupuestoMes: 3000 },
    { entrada: 'funnel', funnel: 'vsl-llamada', ticket: 200, presupuestoMes: 3000, llamadas: 'yo' },
    { entrada: 'funnel', funnel: 'organico', ticket: 1000 }, { entrada: 'funnel', funnel: 'organico', ticket: 1000, objetivo: 'ventas' },
    { entrada: 'funnel', funnel: 'organico', ticket: 1000, objetivo: 'ventas', ritmo: 3 },
    { entrada: 'funnel', funnel: 'youtube', ticket: 1000 }, { entrada: 'funnel', funnel: 'youtube', ticket: 1000, ritmo: 1 },
    { entrada: 'funnel', funnel: 'youtube', ticket: 1000, ritmo: 1, formato: 'largos' },
    { entrada: 'funnel', funnel: 'lead-magnet', ticket: 1000, presupuestoMes: 600, competencia: 'luego' },
  ];
  for (const p of casos) {
    const paso = pasoDeCopiloto(p);
    const ops = opcionesDeCopiloto(paso, p);
    assert.ok(ops.length > 0, `«${paso}» sin pastillas`);
    for (const o of ops) assert.ok(leerRespuestaCopiloto(paso, o, p), `«${paso}» no entiende su propia pastilla «${o}»`);
  }
});

test('un referente trae su funnel y se ve «Inspirado en»', () => {
  // Doglio enseña dos (medido: historias de Instagram y webinars), así que pregunta cuál, y SÓLO ofrece esos dos.
  const doglio0 = charla(['Seguir la estrategia de un referente', 'Francisco Doglio']);
  assert.equal(doglio0.referente, 'francisco-doglio');
  assert.equal(pasoDeCopiloto(doglio0), 'funnel');
  assert.deepEqual(opcionesDeCopiloto('funnel', doglio0), ['Orgánico en Instagram', 'Webinar']);
  const doglio = charla(['Webinar'], doglio0);
  assert.equal(pasoDeCopiloto(doglio), 'ticket');
  // Uno que enseña uno solo lo trae, sin preguntar.
  assert.equal(pasoDeCopiloto(charla(['Seguir la estrategia de un referente', 'Julián Otálora'])), 'ticket');
  const listo = charla(['$3,000', '$2,000 al mes', 'Un equipo', 'Más adelante'], doglio);
  assert.equal(propuestaDe(listo)!.titulo, 'Webinar');
  assert.equal(propuestaDe(listo)!.inspirado, 'Inspirado en Francisco Doglio');
  // Los referentes que se ofrecen existen en lib/asesores.
  for (const r of REFERENTES_COPILOTO) assert.ok(ASESORES.some((a) => a.id === r.id), r.id);
  const sofia = charla(['Seguir la estrategia de un referente', 'Sofía Contreras']);
  assert.equal(sofia.referente, 'sofia-contreras');
  // Si cambia al funnel que MaKo propone, la propuesta ya no dice «Inspirado en» alguien que no hace ese funnel.
  const cambiado = aplicarCambio(doglio, { funnel: 'carrito', referente: undefined });
  assert.equal(propuestaDe({ ...cambiado, ticket: 97, presupuestoMes: 600, llamadas: 'yo' })!.inspirado, null);
});

test('el aviso de que no le sirve: acepta el cambio o sigue con el suyo, y la propuesta lo recuerda', () => {
  const base = charla(['Elegir un tipo de funnel', 'Anuncios a un VSL con llamada', '$200', '$3,000 al mes', 'Yo']);
  assert.equal(pasoDeCopiloto(base), 'ajuste');
  assert.match(mensajesDeCopiloto(base).at(-1)!.texto, /3,000/);
  assert.deepEqual(opcionesDeCopiloto('ajuste', base), ['Sí, anuncios a compra directa', 'Sigo con el mío']);
  const cambio = charla(['Sí, anuncios a compra directa'], base);
  assert.equal(cambio.funnel, 'carrito');
  assert.equal(pasoDeCopiloto(cambio), 'competencia');
  const sigo = charla(['Sigo con el mío'], base);
  assert.equal(sigo.funnel, 'vsl-llamada');
  assert.equal(avisoPendiente(sigo), null, 'no se vuelve a avisar');
  assert.match(propuestaDe(charla(['Más adelante'], sigo))!.puntos.join(' '), /Ojo:/);
  // «sigo» no se confunde con «sí»: empieza igual.
  assert.deepEqual(leerRespuestaCopiloto('ajuste', 'sigo con el mío', base), { ajuste: 'sigo' });
});

test('orgánico: estrategia, ritmo y formato antes de la propuesta, sin plata ni llamadas', () => {
  const p = charla(['Elegir un tipo de funnel', 'Orgánico en Instagram', '$3,000']);
  assert.equal(pasoDeCopiloto(p), 'objetivo', 'no pregunta presupuesto ni quién llama');
  const q = charla(['Viralidad', '5 piezas por semana', 'Reels', 'Más adelante'], p);
  assert.equal(pasoDeCopiloto(q), 'propuesta');
  const prop = propuestaDe(q)!;
  assert.match(prop.puntos[0], /5 piezas por semana: 5 reels y 0 carruseles/);
  assert.ok(prop.pasos.some((s) => s.href === '/calendario') && prop.pasos.some((s) => s.href?.includes('carruseles')));
  assert.ok(!/US\$|\$\d/.test(prop.puntos.join(' ')), 'sin presupuesto no se habla de plata');
});

test('YouTube: ritmo y formato propios, y se avisa que tarda', () => {
  const p = charla(['Elegir un tipo de funnel', 'YouTube', '$3,000', '1 por semana', 'Videos largos', 'Más adelante']);
  assert.equal(pasoDeCopiloto(p), 'propuesta');
  assert.match(propuestaDe(p)!.puntos.join(' '), /meses/);
  assert.equal(leerRespuestaCopiloto('formato', 'Los dos', { funnel: 'youtube' })?.formato, 'mezcla');
});

test('planOrganico: viralidad pesa en reels, ventas en carruseles; el ritmo manda el total', () => {
  for (const n of [1, 3, 5, 7, 14]) for (const objetivo of ['viralidad', 'ventas', 'mixto'] as const) {
    const { reparto } = planOrganico({ objetivo, ritmo: n });
    assert.equal(reparto.reels + reparto.carruseles, n, `${n}/${objetivo}`);
  }
  assert.ok(planOrganico({ objetivo: 'viralidad', ritmo: 5 }).reparto.reels > planOrganico({ objetivo: 'ventas', ritmo: 5 }).reparto.reels);
  assert.equal(planOrganico({ objetivo: 'viralidad', ritmo: 4 }).reparto.stories, 0, 'viralidad: stories no son lo primero');
  assert.equal(planOrganico({ objetivo: 'ventas', ritmo: 4 }).reparto.stories, 5);
});

test('cambiar de idea: «Cambiar el funnel» vuelve al principio y «Cambiar los números» sólo borra los números', () => {
  const listo = charla(['Elegir un tipo de funnel', 'Anuncios a un VSL con llamada', '$5,000', '$3,000 al mes', 'Yo', 'Más adelante']);
  assert.equal(pasoDeCopiloto(listo), 'propuesta');
  const otro = aplicarCambio(listo, leerRespuestaCopiloto('propuesta', 'Cambiar el funnel', listo)!);
  assert.equal(pasoDeCopiloto(otro), 'entrada');
  const nums = aplicarCambio(listo, leerRespuestaCopiloto('propuesta', 'Cambiar los números', listo)!);
  assert.equal(nums.funnel, 'vsl-llamada');
  assert.equal(pasoDeCopiloto(nums), 'ticket');
});

test('la pantalla según el funnel: «Campañas» sólo con anuncios', () => {
  for (const id of ['vsl-llamada', 'mensajes', 'formulario', 'carrito'] as const) {
    assert.deepEqual(seccionesDe(id, 0), ['hoy', 'plan', 'campanas', 'biblioteca'], id);
    assert.ok(conCampanas(id, 0), `${id}: es un funnel de anuncios aunque aún no haya puesto plata`);
  }
  for (const id of ['organico', 'youtube'] as const) {
    for (const plata of [0, 5000]) {
      assert.deepEqual(seccionesDe(id, plata), ['semana', 'plan', 'medir'], `${id} con ${plata}: nunca Campañas`);
      assert.equal(conCampanas(id, plata), false);
    }
  }
  // Webinar y lead magnets: Campañas sólo si pusieron plata (se pueden difundir sin pagar).
  for (const id of ['webinar', 'lead-magnet'] as const) {
    assert.deepEqual(seccionesDe(id, 0), ['semana', 'plan', 'medir'], id);
    assert.deepEqual(seccionesDe(id, 600), ['hoy', 'plan', 'campanas', 'biblioteca'], id);
  }
  assert.deepEqual(seccionesDe(null), ['hoy', 'campanas', 'biblioteca'], 'quien no eligió funnel (negocio de antes) ve lo de siempre');
  for (const f of FUNNELS) assert.ok(seccionesDe(f.id, 100).includes('plan'), `${f.id}: todos tienen su Plan`);
});

test('qué medir: cada funnel tiene su número que manda y sus medidas, sin metas inventadas', () => {
  for (const f of FUNNELS) {
    const m = medirDe(f.id);
    assert.ok(m.manda.length > 10 && m.medidas.length >= 4, f.id);
  }
  assert.match(medirDe('vsl-llamada').manda, /costo por llamada calificada/);
  assert.match(medirDe('organico', { objetivo: 'ventas' }).manda, /Conversaciones calificadas/);
  assert.match(medirDe('organico', { objetivo: 'viralidad' }).manda, /Gente nueva/);
  // Las cifras del webinar dicen que son de referencia y de otros.
  for (const x of medirDe('webinar').medidas) assert.match(x.contexto ?? '', /referencia/, x.nombre);
});

test('esta semana: cada tarea manda a una pantalla que existe, y el orgánico suma el ritmo que eligió', () => {
  const rutas = new Set<string>(Object.values(RUTAS_COPILOTO));
  for (const f of FUNNELS) {
    const t = tareasDeLaSemana({ funnel: f.id, ritmo: 3, objetivo: 'mixto', formato: 'mezcla' });
    if (f.anuncios === 'si') { assert.deepEqual(t, [], `${f.id}: los de anuncios trabajan en Hoy y Campañas`); continue; }
    assert.ok(t.length >= 3, f.id);
    for (const x of t) assert.ok(rutas.has(x.href), `${f.id}: ${x.href} no es una pantalla de MaKo`);
  }
  const n = (r: number) => tareasDeLaSemana({ funnel: 'organico', ritmo: r, objetivo: 'ventas', formato: 'mezcla' }).filter((x) => /reel|carrusel/.test(x.titulo)).map((x) => Number(x.titulo.split(' ')[0])).reduce((a, b) => a + b, 0);
  for (const r of [1, 3, 5, 7]) assert.equal(n(r), r, `ritmo ${r}`);
});

test('sanear: sólo lo conocido y con su forma; el cero del presupuesto vale', () => {
  const s = sanearPerfil({ entrada: 'x', funnel: 'organico', presupuestoMes: 0, ticket: -5, llamadas: 'yo', ritmo: 99, formato: 'reels', referente: 'nadie', aceptado: 'si', extra: 1 });
  assert.deepEqual(s, { funnel: 'organico', presupuestoMes: 0, llamadas: 'yo', formato: 'reels' });
  assert.deepEqual(sanearPerfil(null), {});
  assert.deepEqual(sanearPerfil([1]), {});
});

test('lo que se escribe a mano también se entiende', () => {
  assert.deepEqual(leerRespuestaCopiloto('presupuesto', 'nada', {}), { presupuestoMes: 0 });
  assert.deepEqual(leerRespuestaCopiloto('presupuesto', '1.500 dólares', {}), { presupuestoMes: 1500 });
  assert.equal(leerRespuestaCopiloto('ticket', 'no sé', {}), null);
  assert.deepEqual(leerRespuestaCopiloto('llamadas', 'mi equipo de closers', {}), { llamadas: 'equipo' });
  assert.deepEqual(leerRespuestaCopiloto('referente', 'quiero a Sofía Contreras', {}), { referente: 'sofia-contreras' });
  assert.equal(leerRespuestaCopiloto('ritmo', '40', {}), null);
});

test('el teléfono con anuncios: Hoy y, con la charla terminada, su Plan (Campañas y Biblioteca quedan en la computadora)', () => {
  const vsl = charla(['Elegir un tipo de funnel', 'Anuncios a un VSL con llamada', '$5,000', '$3,000 al mes', 'Yo', 'Sí, investígala', 'Me sirve, empecemos']);
  assert.ok(copilotoListo(vsl));
  assert.deepEqual(seccionesDelTelefono(vsl), ['hoy', 'plan']);
  assert.deepEqual(seccionesDelTelefono(null), ['hoy'], 'un negocio de antes, sin charla: sólo Hoy');
  assert.deepEqual(seccionesDelTelefono({}), ['hoy']);
  const aMedias = charla(['Elegir un tipo de funnel', 'Anuncios a un VSL con llamada', '$5,000']);
  assert.equal(copilotoListo(aMedias), false);
  assert.deepEqual(seccionesDelTelefono(aMedias), ['hoy'], 'sin terminar no hay plan que mostrar');
  // Sin anuncios el teléfono dibuja SinAnuncios (app/m/ads/page.tsx): si igual se preguntara, no ofrece «Hoy | Plan» de anuncios.
  const organico = charla(['Elegir un tipo de funnel', 'Orgánico en Instagram', '$3,000', 'Viralidad', '5 piezas por semana', 'Reels', 'Más adelante', 'Me sirve, empecemos']);
  assert.ok(copilotoListo(organico));
  assert.deepEqual(seccionesDelTelefono(organico), ['hoy']);
});

test('el chat del teléfono escribe con el MISMO desde que la estrella de la computadora', () => {
  assert.deepEqual(desdeDelCopiloto(), { tab: ORIGEN_COPILOTO, entidad: null, modo: null });
  assert.deepEqual(desdeDelCopiloto('Hoy (3 cambios)'), { tab: 'Marketing CoPilot', entidad: null, modo: null, pantalla: 'Hoy (3 cambios)' });
});

// ── Probado rompiéndolo (6/11/2026) ───────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado: ver docs/relevo/nube-marketing-copilot.md → «Probado rompiéndolo».
