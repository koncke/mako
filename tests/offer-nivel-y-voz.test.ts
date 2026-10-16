// =============================================================================
// Offer distingue una ENTRADA de un alto ticket, sabe quién hace el trabajo y habla como el cliente (16/10/2026)
// =============================================================================
// El resto del feedback de la llamada con Leila (12/10/2026), con la conversación real de su negocio (ws 11) como
// prueba de cada cosa:
//   · 00:34:26 — cargó su oferta de entrada (800 MXN al mes) y MaKo preguntó «¿qué le vendes antes?». En una entrada,
//     la pregunta es «¿qué le vendes después?» («debería detectar los funnels low to high»).
//   · 00:38:54 — «la oferta tiene que saber distinguir qué es un low ticket y qué es un high ticket»: la reescribió como
//     un programa de 1.000 USD (unas 25 veces el precio). No era el modelo: el marco daba por hecho el alto ticket.
//   · 00:38:39 / 00:39:11 — prometió «implementamos la estructura» para un curso grupal: «yo no le puedo prometer
//     implementar una estructura cuando lo tiene que hacer él»; hay que distinguir hecho por vos, con vos o para vos.
//   · 00:35:43 — con todo listo, MaKo ofreció «¿Quieres que avancemos con el diagnóstico de tu negocio?», un paso que no
//     existe, y el turno siguiente sólo dijo «toca el botón».
//   · 00:41:03 / 00:44:48 — «demasiado corporativo, un poco marquetinero» (SOPs, LTV:CAC, descentralización) para dueños
//     de negocio con «baja familiaridad técnica».
// Lo puro se prueba EJECUTÁNDOLO; los prompts, leyéndolos.
//
// PROBADO ROMPIÉNDOLO (16/10/2026, arnés romper-nivel.mjs): base 7/0; las 15 roturas caen. Con 3 fallos: lo mensual
// medido como pago único · los cortes en pesos como si fueran dólares. Con 1: la escalera de una entrada vuelve a
// preguntar «antes» · la guía sin IA ignora el nivel · el nivel no llega al prompt · a una entrada se le aplican las
// reglas de alto ticket · el salto en otra moneda no se ve · sin el aviso de quién hace el trabajo · una agencia también
// recibe el aviso (cayó recién con el caso de «agencia» sola: el de antes también decía «lo hacemos por ti») · la jerga
// del dueño también se avisa · los números del dueño cuentan como copy · el turno vuelve a ofrecer el diagnóstico
// aparte · la opción «ver diagnóstico» queda · el prompt de la propuesta vuelve a ser de alto ticket · sin la regla de
// quién hace el trabajo.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  OPCION_ARMAR, TEXTO_LISTA_PARA_ARMAR, bloqueNivel, jergaAjena, mensajeDeMako, nivelDeOferta, parsePropuesta, piezasParaPrompt,
  preguntaEscalera, prometeHacerloPorElCliente, siguientePregunta,
} from '../lib/offer-reglas';
import { PIEZAS, PREGUNTAS_GUIA, type PiezaKey, type PiezasSabidas, type PropuestaOferta } from '../lib/offer-marco';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// lib/offer-ia.ts lleva `server-only`: los prompts se leen del fuente, como en tests/offer-ia-cableado.test.ts.
const IA = readFileSync(join(import.meta.dirname, '..', 'lib/offer-ia.ts'), 'utf8').replace(/\r\n/g, '\n');
const plantilla = (nombre: string): string => {
  const i = IA.indexOf(`export const ${nombre} = \``);
  assert.ok(i >= 0, `no está ${nombre}`);
  return IA.slice(i, IA.indexOf('`;', i));
};
const OFFER_TURNO_SYSTEM_TEMPLATE = plantilla('OFFER_TURNO_SYSTEM_TEMPLATE');
const OFFER_DIAGNOSTICO_SYSTEM_TEMPLATE = plantilla('OFFER_DIAGNOSTICO_SYSTEM_TEMPLATE');
const OFFER_PROPUESTA_SYSTEM_TEMPLATE = plantilla('OFFER_PROPUESTA_SYSTEM_TEMPLATE');

const AT = '2026-10-16T12:00:00.000Z';
const pieza = (valor: string) => ({ valor, fuente: 'chat' as const, at: AT });
const conPrecio = (precio: string, extra: Partial<Record<PiezaKey, string>> = {}): PiezasSabidas =>
  Object.fromEntries([['precio', pieza(precio)], ...Object.entries(extra).map(([k, v]) => [k, pieza(v as string)])]) as PiezasSabidas;

// La propuesta, con el mismo molde de tests/offer-a-definir.test.ts.
const propuesta = (over: Record<string, unknown> = {}) => ({
  nombre: 'Agenda Llena', frase: 'Ayudo a dueños de negocio a delegar en 90 días con 3 pasos.',
  mensajes: { corto: 'Delega en 90 días', largo: 'x', entrada: 'y' },
  paraQuien: { perfil: 'Dueños de negocio', minimo: 'Facturan', noEs: 'Recién empiezan' },
  problema: { hoy: 'Hace todo', despues: 'Delega', obstaculos: ['Nadie lo hace bien'], yaProbo: 'Cursos' },
  mecanismo: { nombres: ['Ruta del Dueño (propuesta)', 'Delegar en 3 Pasos (propuesta)'], pasos: ['Uno', 'Dos', 'Tres'], distinto: 'Práctico' },
  ruta: [{ fase: 'Arranque', objetivo: 'a', hito: 'b' }, { fase: 'Sistema', objetivo: 'a', hito: 'b' }, { fase: 'Escala', objetivo: 'a', hito: 'b' }],
  incluye: [{ nombre: 'Sesiones', beneficio: 'Acompañamiento' }],
  formato: 'Grupal, semanal', prueba: '[completar] casos',
  garantia: { nombre: 'Primera sesión sin cargo', condiciones: 'Asistir', plazo: '1 sesión', siNoCumple: 'No paga' },
  bonos: [{ nombre: 'Plantillas', objecion: 'No sé por dónde empezar', valor: '[completar]' }],
  inversion: { valorTotal: '[completar]', precio: '800 MXN', contado: '800 MXN', plan: '800 MXN al mes', comoDecirlo: 'Primero el valor.' },
  urgencia: '[completar]', escenarios: { mejor: 'Delega', peor: 'Aprende' },
  ecuacion: [{ variable: 'tiempo', antes: 'siempre', despues: 'menos' }],
  numeros: ['Margen 70%'], validar: ['3 ventas'], siguiente: 'Mentoría 1 a 1',
  ...over,
});
const LEILA = '800 MXN al mes (precio pionero/beta) con la primera sesión presencial sin cargo';

// ── El nivel ────────────────────────────────────────────────────────────────
test('el nivel lo decide el código con el precio: la membresía de Leila es una ENTRADA', () => {
  assert.deepEqual(nivelDeOferta(conPrecio(LEILA)), { nivel: 'bajo', recurrente: true, precio: { monto: 800, moneda: 'MXN', texto: '800' } });
  assert.equal(nivelDeOferta(conPrecio('2.500 USD o 2 pagos de 1.300'))?.nivel, 'alto');
  assert.equal(nivelDeOferta(conPrecio('700 USD'))?.nivel, 'medio');
  assert.equal(nivelDeOferta(conPrecio('$6,000 MXN el programa de 8 semanas'))?.nivel, 'bajo', 'unos 350 USD: una entrada');
  assert.equal(nivelDeOferta(conPrecio('20.000 MXN'))?.nivel, 'alto');
  assert.equal(nivelDeOferta(conPrecio('49 USD al mes'))?.nivel, 'bajo');
  assert.equal(nivelDeOferta(conPrecio('sin dato: todavía no lo sé')), null);
  assert.equal(nivelDeOferta({}), null);
});

test('la escalera, según el nivel: en una entrada se pregunta qué vende DESPUÉS (la de Leila preguntó «antes»)', () => {
  assert.match(preguntaEscalera('bajo'), /DESPUÉS/);
  assert.doesNotMatch(preguntaEscalera('bajo'), /antes/i);
  assert.match(preguntaEscalera('alto'), /antes/);
  assert.equal(preguntaEscalera(null), PREGUNTAS_GUIA.find((q) => q.pieza === 'escalera')?.pregunta);
  // La pregunta de la guía, sin IA: con todo anotado menos la escalera, sale la del nivel.
  const todo = Object.fromEntries(PIEZAS.filter((p) => p.key !== 'escalera').map((p) => [p.key, pieza('x')])) as PiezasSabidas;
  assert.equal(siguientePregunta({ ...todo, precio: pieza(LEILA) }), preguntaEscalera('bajo'));
  assert.equal(siguientePregunta({ ...todo, precio: pieza('3.000 USD') }), preguntaEscalera('alto'));
  // El modelo lo recibe pegado a las piezas: llega también a los prompts editados en /configuraciones.
  const { sabidas } = piezasParaPrompt(conPrecio(LEILA));
  assert.match(sabidas, /TICKET BAJO \(800 MXN al mes\)/);
  assert.match(sabidas, /No la conviertas en una de alto ticket/);
  assert.match(sabidas, /qué le vendes DESPUÉS/i);
  assert.equal(bloqueNivel(null), '');
  assert.doesNotMatch(piezasParaPrompt({}).sabidas, /EL NIVEL/);
});

test('las reglas de alto ticket no se le aplican a una entrada; ahí se avisa si la IA la convirtió en otra', () => {
  // La de Leila: 800 MXN al mes → la IA la llevó a 18.000 MXN. Avisa el salto, NO «por debajo de 1.000 USD».
  const p = parsePropuesta(propuesta({ inversion: { valorTotal: '[completar]', precio: '18,000 MXN', contado: '16,000 MXN', plan: '2 pagos', comoDecirlo: 'x' }, formato: 'Grupal, 30 días' }), conPrecio(LEILA));
  assert.ok(p);
  assert.ok(p.avisos?.some((a) => /23 veces el de tu oferta de entrada \(800 MXN al mes\)/.test(a)), JSON.stringify(p.avisos));
  // El caso REAL, en otra moneda («1,000 USD» sobre 800 MXN al mes): sin convertir, el propuesto ya es de alto ticket.
  const real = parsePropuesta(propuesta({ inversion: { valorTotal: '[completar]', precio: '1,000 USD', contado: '900 USD', plan: '2 pagos', comoDecirlo: 'x' } }), conPrecio(LEILA));
  assert.ok(real?.avisos?.some((a) => /\(1,000 USD\) es de alto ticket, y tu oferta es de entrada \(800 MXN al mes\)/.test(a)), JSON.stringify(real?.avisos));
  assert.ok(!p.avisos?.some((a) => /piso del high ticket|90 a 180 días/.test(a)), 'le aplicó las reglas de alto ticket a una entrada');
  // En su nivel, sin aviso.
  const enSuNivel = parsePropuesta(propuesta(), conPrecio(LEILA));
  assert.ok(!enSuNivel?.avisos?.some((a) => /veces el de tu oferta/.test(a)));
  // En un alto ticket, las de siempre.
  const alto = parsePropuesta(propuesta({ inversion: { valorTotal: '[completar]', precio: '500 USD', contado: '450 USD', plan: '2 pagos', comoDecirlo: 'x' } }), conPrecio('3.000 USD'));
  assert.ok(alto?.avisos?.some((a) => /piso del high ticket/.test(a)));
});

// ── Quién hace el trabajo ───────────────────────────────────────────────────
test('un curso o un grupo no prometen «implementamos»: el aviso; si el negocio lo hace por el cliente, no', () => {
  const grupal = conPrecio(LEILA, { formato: 'Presencial grupal (cupo máximo 20), sesiones semanales de 2 horas', entregables: 'Membresía de entrenamiento grupal' });
  const promete = propuesta({ mensajes: { corto: 'x', largo: 'En 90 días implementamos la estructura, procesos e inteligencia artificial', entrada: 'y' } });
  const aviso = prometeHacerloPorElCliente(promete as PropuestaOferta, grupal);
  assert.match(aviso ?? '', /promete hacerlo POR tu cliente \(«implementamos»\)/);
  assert.ok(parsePropuesta(promete, grupal)?.avisos?.some((a) => a.startsWith('La oferta promete hacerlo POR tu cliente')));
  // Si lo hace el negocio (una agencia, «lo hacemos por ti»), prometerlo está bien.
  assert.equal(prometeHacerloPorElCliente(promete as PropuestaOferta, conPrecio('3.000 USD', { formato: 'Somos agencia: lo hacemos por ti, llave en mano' })), null);
  assert.equal(prometeHacerloPorElCliente(promete as PropuestaOferta, conPrecio('3.000 USD', { formato: 'Agencia de marketing con un taller de arranque' })), null, 'una agencia con un taller sigue siendo hecha por el negocio');
  // Sin formato ni entregables no se sabe: no se avisa.
  assert.equal(prometeHacerloPorElCliente(promete as PropuestaOferta, conPrecio(LEILA)), null);
  // Lo que el cliente LOGRA con su guía, sin aviso.
  assert.equal(prometeHacerloPorElCliente(propuesta() as PropuestaOferta, grupal), null);
});

// ── Las palabras ────────────────────────────────────────────────────────────
test('la jerga de consultor que el dueño no usó se avisa; la que usó, no; los números son del dueño', () => {
  const p = propuesta({
    incluye: [{ nombre: 'Banco de Plantillas y SOPs Operativos', beneficio: 'Delegar sin microgestión' }],
    numeros: ['LTV:CAC objetivo: mínimo 3 a 1'],
    problema: { hoy: 'Mide KPIs a mano', despues: 'x', obstaculos: [], yaProbo: 'y' },
  }) as PropuestaOferta;
  assert.deepEqual(jergaAjena(p, ['Quiero que mis clientes midan sus KPIs']), ['SOPs', 'microgestión']);
  assert.deepEqual(jergaAjena(propuesta() as PropuestaOferta, []), []);
  const conAviso = parsePropuesta({ ...p }, conPrecio(LEILA));
  assert.ok(conAviso?.avisos?.some((a) => /«SOPs»/.test(a) && /«microgestión»/.test(a) && /«KPIs»/.test(a)), JSON.stringify(conAviso?.avisos));
});

// ── El turno perdido ────────────────────────────────────────────────────────
test('un «diagnóstico» aparte no existe: con todo listo, MaKo dice que puede armarla y no ofrece ese paso', () => {
  const base = { plan: { modo: 'no' as const }, piezas: {}, id: 'm1', at: AT };
  const turno = { respuesta: 'Ya tengo todo lo necesario para armar tu oferta. ¿Quieres que avancemos con el diagnóstico de tu negocio?', opciones: ['Sí, ver diagnóstico', 'Revisar las piezas', 'Nada más por ahora'], piezas: {}, listo: true, diagnostico: null, diagnosticoRespuesta: null };
  const m = mensajeDeMako({ ...base, turno: turno as never, puedeConcluir: true });
  assert.equal(m.texto, TEXTO_LISTA_PARA_ARMAR);
  assert.deepEqual(m.opciones, [OPCION_ARMAR]);
  // Sin las mínimas, el texto queda pero la opción de «diagnóstico» se va.
  const sin = mensajeDeMako({ ...base, turno: turno as never, puedeConcluir: false });
  assert.equal(sin.texto, turno.respuesta);
  assert.deepEqual(sin.opciones, ['Revisar las piezas', 'Nada más por ahora']);
});

// ── Los prompts ─────────────────────────────────────────────────────────────
test('los prompts ya no dan por hecho el alto ticket, y dicen el nivel, quién hace el trabajo y las palabras del cliente', () => {
  for (const t of [OFFER_TURNO_SYSTEM_TEMPLATE, OFFER_DIAGNOSTICO_SYSTEM_TEMPLATE, OFFER_PROPUESTA_SYSTEM_TEMPLATE]) {
    assert.doesNotMatch(t, /de un negocio de alto ticket/, 'un prompt sigue arrancando con «negocio de alto ticket»');
    assert.match(t, /EL NIVEL DE ESTA OFERTA/);
  }
  assert.match(OFFER_TURNO_SYSTEM_TEMPLATE, /Nunca preguntes «¿quieres que avancemos con el diagnóstico\?»/);
  assert.match(OFFER_PROPUESTA_SYSTEM_TEMPLATE, /Una oferta de ENTRADA \(ticket bajo, ver «EL NIVEL DE ESTA OFERTA»\) se queda en su nivel/);
  assert.match(OFFER_PROPUESTA_SYSTEM_TEMPLATE, /\n17\. QUIÉN HACE EL TRABAJO/);
  assert.match(OFFER_PROPUESTA_SYSTEM_TEMPLATE, /\n18\. LAS PALABRAS DE SU CLIENTE/);
  // Las reglas nuevas van DESPUÉS de la 15, en orden.
  assert.ok(OFFER_PROPUESTA_SYSTEM_TEMPLATE.indexOf('\n15. LA VOZ') < OFFER_PROPUESTA_SYSTEM_TEMPLATE.indexOf('\n16. EL NIVEL'));
  // El formato pregunta quién hace el trabajo; la escalera de la guía es la neutra.
  assert.match(PIEZAS.find((p) => p.key === 'formato')?.que ?? '', /QUIÉN HACE EL TRABAJO/);
  assert.match(PREGUNTAS_GUIA.find((q) => q.pieza === 'formato')?.pregunta ?? '', /quién hace el trabajo/);
  assert.doesNotMatch(PIEZAS.find((p) => p.key === 'escalera')?.que ?? '', /una entrada más barata/);
});
