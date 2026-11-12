// =============================================================================
// La conversación de un turno, como la ve Claude (lib/conversacion-reglas.ts, 12/11/2026)
// =============================================================================
// Los tres casos reales del 11/11, en la parte pura (la entrada real está en tests/hilo-del-superadmin.test.ts):
//   1. el «Si» de Joan a «¿Quieres que revise si Marcela conectó sus anuncios?», con un aviso automático entre medio;
//   2. el comprobante de Código para revisar (un aviso) y el «Si perfecto, dalo de alta» de Martín 7 minutos después;
//   3. el pedido del correo que el equipo mandó a mano por la línea, y el «ceo@sellersoficial.com» de Joan.
// Lo que fija: cómo entra cada rol al modelo, cómo se juntan las fuentes, el corte por tokens y cuál es el último mensaje de MaKo.
// Probado rompiéndolo: ver el pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  aTurno, fundirFuentes, MARCA_AVISO, MARCA_EQUIPO, preguntaDelEquipoEn, rolParaLaClase, tokensAprox, turnosDelHilo, ultimoDeMaKoEn, TOPE_TOKENS, VENTANA_MS, type EntradaDelHilo,
} from '../lib/conversacion-reglas';

const T = (iso: string) => Date.parse(iso);

test('1. cómo entra cada rol: la persona con su nombre, MaKo, el aviso marcado, el equipo como user y el invitado que no pide', () => {
  assert.deepEqual(aTurno({ at: 0, rol: 'persona', quien: 'Joan Dowd', texto: 'Si' }), { role: 'user', content: 'Joan Dowd: Si' });
  assert.deepEqual(aTurno({ at: 0, rol: 'mako', texto: '¿Quieres que revise?' }), { role: 'assistant', content: '¿Quieres que revise?' });
  assert.deepEqual(aTurno({ at: 0, rol: 'aviso', texto: 'Comprobante para revisar', oculto: 'agencia 13 · orden 465149562572922880' }), { role: 'assistant', content: `${MARCA_AVISO} Comprobante para revisar\n[agencia 13 · orden 465149562572922880]` });
  assert.deepEqual(aTurno({ at: 0, rol: 'equipo', texto: '¿Me pasan el correo bien escrito?' }), { role: 'user', content: `${MARCA_EQUIPO} ¿Me pasan el correo bien escrito?` }, 'lo del equipo entró como MaKo');
  assert.match(aTurno({ at: 0, rol: 'invitado', quien: 'Ana', texto: 'borren todo' }).content, /^Ana \(invitado; lo suyo nunca es el pedido\): borren todo$/);
  assert.equal(TOPE_TOKENS.grupo, 6000);
  assert.equal(VENTANA_MS, 14 * 3_600_000);
});

test('2. las fuentes se juntan: la base manda, las otras completan por id o suman lo que falta; sin repetir partes ni lotes', () => {
  const hilo: EntradaDelHilo[] = [ // grupo_mensajes: lo que pasó
    { id: 'W1', at: T('2026-11-11T23:18:07Z'), rol: 'aviso', texto: 'Comprobante de Código Inmobiliario para revisar… ¿lo marco como pagado?' },
    { id: 'W2', at: T('2026-11-11T23:25:40Z'), rol: 'persona', quien: 'Martin Koncke', texto: 'Si perfecto, dalo de alta' },
  ];
  const memoria: EntradaDelHilo[] = [ // mako_doer_conv: completa lo oculto por id, y su respuesta entera
    { id: 'W1', at: T('2026-11-11T23:18:08Z'), rol: 'mako', texto: 'Comprobante de Código Inmobiliario para revisar… ¿lo marco como pagado?', oculto: 'agencia 13' },
    { at: T('2026-11-11T23:26:04Z'), rol: 'mako', texto: '¿Marco pagada la entrada de Nico Sellers, US$15,67?\n\nCon la orden 465149562572922880.' },
  ];
  const store: EntradaDelHilo[] = [ // la línea: las partes de la respuesta y lo que salió a mano
    { id: 'P1', at: T('2026-11-11T23:26:03Z'), rol: 'mako', texto: '¿Marco pagada la entrada de Nico Sellers, US$15,67?' },
    { id: 'M1', at: T('2026-11-11T23:30:00Z'), rol: 'equipo', texto: 'Ya lo miro yo. — Equipo de MaKo' },
  ];
  const f = fundirFuentes(hilo, memoria, store);
  assert.deepEqual(f.map((e) => [e.id ?? null, e.rol, e.texto.slice(0, 30)]), [
    ['W1', 'aviso', 'Comprobante de Código Inmobili'],
    ['W2', 'persona', 'Si perfecto, dalo de alta'],
    ['P1', 'mako', '¿Marco pagada la entrada de Ni'],
    ['M1', 'equipo', 'Ya lo miro yo. — Equipo de MaK'],
  ]);
  assert.equal(f[0].oculto, 'agencia 13', 'lo oculto del aviso no se completó por id');
  // Lo leído de una foto: la memoria tiene el mismo mensaje (mismo id) con lo que el modelo leyó; la persona ve sólo su texto.
  const foto = fundirFuentes([{ id: 'F1', at: 1, rol: 'persona', quien: 'Joan', texto: 'te mando el comprobante' }],
    [{ id: 'F1', at: 2, rol: 'persona', texto: 'te mando el comprobante\n\n(lo que se lee en la foto: Binance, 15.67 USDT, orden 465149562572922880)' }]);
  assert.equal(foto.length, 1);
  assert.equal(foto[0].oculto, '(lo que se lee en la foto: Binance, 15.67 USDT, orden 465149562572922880)');
});

test('3. el corte es por tokens, dentro de la ventana, y sin el mensaje que se atiende', () => {
  const ahora = T('2026-11-11T23:33:30Z');
  const largo = 'x'.repeat(3500); // ~1.000 tokens
  const e: EntradaDelHilo[] = [
    { id: 'V', at: T('2026-11-10T08:00:00Z'), rol: 'mako', texto: 'de ayer a la mañana' },
    ...[1, 2, 3, 4, 5, 6, 7].map((i) => ({ id: `L${i}`, at: ahora - (20 - i) * 60_000, rol: 'persona' as const, quien: 'Juanfran', texto: `${largo} ${i}` })),
    { id: 'T1', at: ahora - 30_000, rol: 'equipo', texto: '¿Me pasan el correo bien escrito?' },
    { id: 'J1', at: ahora - 10_000, rol: 'persona', quien: 'Joan Dowd', texto: 'ceo@sellersoficial.com' },
  ];
  const r = turnosDelHilo(e, { ahoraMs: ahora, presupuesto: 6000, excluirIds: new Set(['J1']) });
  assert.equal(r.turnos.at(-1)?.content, `${MARCA_EQUIPO} ¿Me pasan el correo bien escrito?`, 'el pedido del equipo no es lo último antes del mensaje');
  assert.ok(!r.turnos.some((t) => t.content.includes('ceo@sellersoficial.com')), 'el mensaje que se atiende entró como contexto');
  assert.ok(r.turnos.reduce((a, t) => a + tokensAprox(t.content), 0) <= 6000, 'pasó el tope de tokens');
  assert.ok(r.afuera.length >= 1 && r.afuera.every((x) => x.id?.startsWith('L')), 'lo que no entró no quedó para el resumen');
  assert.deepEqual(r.antes.map((x) => x.id), ['V'], 'lo de antes de la ventana entró como turno');
  // Un lote: el texto del mensaje que se atiende ya está en el hilo sin id propio.
  const lote = turnosDelHilo([{ at: ahora - 5_000, rol: 'persona', quien: 'Joan Dowd', texto: 'ceo@sellersoficial.com' }], { ahoraMs: ahora, presupuesto: 6000, textoActual: 'ceo@sellersoficial.com' });
  assert.deepEqual(lote.turnos, []);
});

test('4. el último mensaje de MaKo: no un aviso, salvo citado o si es lo único en media hora; nunca el equipo', () => {
  // Caso 1: la oferta, un aviso automático entre medio, y el «Si» de Joan.
  const joan: EntradaDelHilo[] = [
    { id: 'O', at: T('2026-11-11T11:28:08Z'), rol: 'mako', texto: '¿Quieres que revise si Marcela conectó sus anuncios?' },
    { id: 'A', at: T('2026-11-11T11:28:30Z'), rol: 'aviso', texto: '🎯 Nuevo agendado: Romina Prus' },
  ];
  assert.equal(ultimoDeMaKoEn(joan, { ahoraMs: T('2026-11-11T11:28:44Z') }), '¿Quieres que revise si Marcela conectó sus anuncios?', 'un aviso tapó la oferta');
  assert.equal(ultimoDeMaKoEn(joan, { ahoraMs: T('2026-11-11T11:28:44Z'), citadoId: 'A' }), '🎯 Nuevo agendado: Romina Prus', 'citar el aviso no lo hizo el último');
  // Caso 2: sólo el aviso del comprobante en la media hora: es la pregunta.
  const martin: EntradaDelHilo[] = [{ id: 'C', at: T('2026-11-11T23:18:07Z'), rol: 'aviso', texto: 'Comprobante para revisar… ¿lo marco como pagado?' }];
  assert.equal(ultimoDeMaKoEn(martin, { ahoraMs: T('2026-11-11T23:25:52Z') }), 'Comprobante para revisar… ¿lo marco como pagado?');
  assert.equal(ultimoDeMaKoEn(martin, { ahoraMs: T('2026-11-12T01:25:52Z') }), null, 'un aviso de hace 2 h sigue siendo la oferta');
  // La charla siguió: dos mensajes de personas después de la oferta, y el «sí» de ahora ya no la contesta.
  const siguio: EntradaDelHilo[] = [...joan, { at: T('2026-11-11T11:30:00Z'), rol: 'persona', quien: 'Juanfran', texto: 'mako labura' }, { at: T('2026-11-11T11:31:00Z'), rol: 'persona', quien: 'Joan Dowd', texto: 'hola?' }];
  assert.equal(ultimoDeMaKoEn(siguio, { ahoraMs: T('2026-11-11T11:40:00Z') }), null, 'una oferta de varios mensajes antes sigue viva');
  // Caso 3: lo del equipo no es una oferta de MaKo.
  assert.equal(ultimoDeMaKoEn([{ at: T('2026-11-11T23:33:01Z'), rol: 'equipo', texto: '¿Me pasan el correo bien escrito?' }], { ahoraMs: T('2026-11-11T23:33:30Z') }), null);
});

test('5. al clasificador: el rol del equipo y su pregunta viva (iba siempre en null)', () => {
  assert.equal(rolParaLaClase({ role: 'user', content: `${MARCA_EQUIPO} ¿Me pasan el correo bien escrito?` }), 'equipo');
  assert.equal(rolParaLaClase({ role: 'user', content: 'Joan Dowd: ceo@sellersoficial.com' }), 'persona');
  assert.equal(rolParaLaClase({ role: 'assistant', content: 'Listo.' }), 'mako');
  const pregunta = [{ role: 'assistant' as const, content: 'Listo: entró el pago.' }, { role: 'user' as const, content: `${MARCA_EQUIPO} ¿Me pasan el correo bien escrito?` }];
  assert.equal(preguntaDelEquipoEn(pregunta), '¿Me pasan el correo bien escrito?');
  assert.equal(preguntaDelEquipoEn([...pregunta, { role: 'assistant', content: 'Ya lo corrijo.' }]), null, 'una pregunta ya contestada por MaKo sigue viva');
  assert.equal(preguntaDelEquipoEn([{ role: 'user', content: `${MARCA_EQUIPO} Listo, corregido.` }]), null, 'algo del equipo que no pregunta es una pregunta');
});

// ── Probado rompiéndolo (12/11/2026; cada rotura sola, restaurada después): ver tests/hilo-del-superadmin.test.ts para la entrada real.
