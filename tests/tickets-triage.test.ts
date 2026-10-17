// =============================================================================
// La Ticketera de los usuarios — el TRIAGE (lib/tickets-reglas.ts)
// =============================================================================
// Pedido de Martín (17/10/2026): «un bug evidente que debería funcionar bien debe solucionarse automáticamente, pero
// si alguien pide implementar algo nuevo, eso sí depende de mi decisión». Lo que fijan estos tests no se ve leyendo
// la pantalla:
//   · un error que el SISTEMA registró manda más que lo que dice la persona;
//   · un pedido de algo nuevo NUNCA sale al arreglo automático, aunque la persona lo marque «no anda»;
//   · en la duda (señales cruzadas, o sólo la palabra de alguien) decide Martín;
//   · el interruptor y el tope del día frenan el arreglo automático, y lo dicen en el porqué;
//   · cada veredicto trae su porqué.
//
// Probado rompiéndolo (17/10/2026, arnés del scratchpad `romper-tickets.mjs`; base 15 / 0):
//   · `autoArreglo = tipo === 'bug'` (sin mirar la confianza)  → 12 / 3 (el pedido disfrazado, el «no anda» sin error y
//     las señales cruzadas salían al arreglo automático);
//   · sin el corte de las zonas delicadas                    → 14 / 1;
//   · el interruptor que no apaga                            → 14 / 1.
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { clasificar, estadoInicial, leerTriage, sanearAlta, sanearContexto, estadoParaElCliente, motivoDecisionInvalida, tituloDe, TOPE_ARREGLOS_POR_DIA, type EntradaTriage } from '../lib/tickets-reglas';

const base = (x: Partial<EntradaTriage>): EntradaTriage => ({ tipoDeclarado: null, declaradoPor: null, titulo: '', descripcion: '', contexto: {}, ...x });

test('un error que registró el sistema es un bug evidente: va solo al arreglo', () => {
  const t = clasificar(base({ titulo: 'Mover el lead a Agendado', contexto: { error: 'TypeError: cannot read properties of null (reading "etapa")', herramienta: 'mover_lead' } }));
  assert.equal(t.tipo, 'bug');
  assert.equal(t.confianza, 'alta');
  assert.equal(t.autoArreglo, true);
  assert.equal(estadoInicial(t), 'en_curso');
  assert.ok(t.porque.some((p) => p.includes('registró un error')), t.porque.join(' | '));
});

test('algo que dejó de andar es un bug evidente aunque no haya error registrado', () => {
  const t = clasificar(base({ tipoDeclarado: 'bug', declaradoPor: 'persona', titulo: 'Los WhatsApp dejaron de llegar', descripcion: 'Desde ayer ya no llegan los mensajes al CRM, antes andaba perfecto' }));
  assert.equal(t.tipo, 'bug');
  assert.equal(t.autoArreglo, true);
});

test('un pedido de algo nuevo NUNCA se arregla solo, aunque lo marquen como «algo no anda»', () => {
  // Rota: con `autoArreglo = tipo === 'bug'` (sin mirar la confianza) → este test falla: sale al arreglo.
  const t = clasificar(base({ tipoDeclarado: 'bug', declaradoPor: 'persona', titulo: 'No funciona la integración con Hubspot', descripcion: 'Me gustaría que se pueda integrar con Hubspot' }));
  assert.equal(t.autoArreglo, false);
  assert.equal(estadoInicial(t), 'esperando_decision');
});

test('lo que MaKo vio que la app no tiene es un pedido: espera a Martín', () => {
  const t = clasificar(base({ tipoDeclarado: 'pedido', declaradoPor: 'mako', titulo: 'Exportar los leads a Excel', contexto: { noExiste: true, pedido: 'exportame los leads a un excel' } }));
  assert.equal(t.tipo, 'pedido');
  assert.equal(t.autoArreglo, false);
  assert.ok(t.porque.some((p) => p.includes('lo decide Martín')));
});

test('un «no anda» sin error ni regresión es un bug de confianza media: lo decide Martín', () => {
  const t = clasificar(base({ tipoDeclarado: 'bug', declaradoPor: 'persona', titulo: 'El botón de guardar no hace nada' }));
  assert.equal(t.tipo, 'bug');
  assert.notEqual(t.confianza, 'alta');
  assert.equal(t.autoArreglo, false);
});

test('señales cruzadas (un error y un pedido) bajan la confianza y van a Martín', () => {
  const t = clasificar(base({ titulo: 'Quiero que el informe tenga gráficos', contexto: { error: 'HTTP 500 en /api/informe' } }));
  assert.equal(t.confianza, 'baja');
  assert.equal(t.autoArreglo, false);
});

test('una pregunta es una pregunta', () => {
  const t = clasificar(base({ titulo: '¿Cómo cambio el horario de los recordatorios?' }));
  assert.equal(t.tipo, 'pregunta');
  assert.equal(t.autoArreglo, false);
  assert.equal(t.prioridad, 'baja');
});

test('el interruptor apagado y el tope del día frenan el arreglo, y lo dicen', () => {
  const e = base({ contexto: { error: 'boom' }, titulo: 'Falla al guardar' });
  const apagado = clasificar(e, { apagado: true });
  assert.equal(apagado.autoArreglo, false);
  assert.ok(apagado.porque.some((p) => p.includes('apagado')));
  const tope = clasificar(e, { arreglosHoy: TOPE_ARREGLOS_POR_DIA });
  assert.equal(tope.autoArreglo, false);
  assert.ok(tope.porque.some((p) => p.includes('arreglos automáticos hoy')));
  assert.equal(clasificar(e, { arreglosHoy: TOPE_ARREGLOS_POR_DIA - 1 }).autoArreglo, true);
});

test('un bug evidente en cobros, accesos, borrados o envíos NO se arregla solo: lo decide Martín', () => {
  // Rota: sin el corte de `zonaSensible` en `clasificar` → los cuatro casos salen al arreglo automático.
  const casos: Array<Partial<EntradaTriage>> = [
    { titulo: 'Falla al guardar', contexto: { error: 'boom', ruta: '/pagos?lead=3' } },
    { titulo: 'Falla al guardar', contexto: { error: 'boom', herramienta: 'registrar_pago' } },
    { titulo: 'Se borraron mis leads', contexto: { error: 'boom' } },
    { titulo: 'No puedo entrar con el segundo factor', contexto: { error: '401' } },
  ];
  for (const c of casos) {
    const t = clasificar(base(c));
    assert.equal(t.tipo, 'bug', c.titulo);
    assert.equal(t.autoArreglo, false, `${c.titulo} ${JSON.stringify(c.contexto)}`);
    assert.ok(t.porque.some((p) => p.includes('zona delicada')), t.porque.join(' | '));
  }
  // Y el mismo error en una pantalla común sí sale.
  assert.equal(clasificar(base({ titulo: 'Falla al guardar', contexto: { error: 'boom', ruta: '/crm?lead=3' } })).autoArreglo, true);
});

test('«no puedo trabajar» es urgente', () => {
  assert.equal(clasificar(base({ titulo: 'No me deja entrar, no puedo trabajar', contexto: { error: '401' } })).prioridad, 'urgente');
});

test('todo veredicto trae su porqué, y se vuelve a leer igual de la base', () => {
  for (const e of [base({}), base({ titulo: 'hola' }), base({ contexto: { error: 'x' } }), base({ titulo: 'quiero que tenga modo oscuro' })]) {
    const t = clasificar(e);
    assert.ok(t.porque.length > 0);
    assert.deepEqual(leerTriage(JSON.parse(JSON.stringify(t))), t);
  }
  assert.equal(leerTriage({ v: 2 }), null);
  assert.equal(leerTriage('bug'), null);
});

test('el contexto sólo guarda lo de la lista, con topes, y una ruta interna', () => {
  const c = sanearContexto({ ruta: '/crm?lead=12', error: 'e'.repeat(5000), clave: 'secreto', chat: { donde: 'second-brain', hilo: 'h1' }, hora: '2026-10-17T10:00:00-03:00', noExiste: 'si' });
  assert.equal(c.ruta, '/crm?lead=12');
  assert.equal(c.error!.length, 1000);
  assert.equal('clave' in c, false);
  assert.deepEqual(c.chat, { donde: 'second-brain', hilo: 'h1' });
  assert.equal(c.hora, '2026-10-17T13:00:00.000Z');
  assert.equal(c.noExiste, undefined, 'sólo `true` cuenta');
  assert.equal(sanearContexto({ ruta: 'https://otro.com/x' }).ruta, undefined);
  assert.equal(sanearContexto({ ruta: '//otro.com/x' }).ruta, undefined);
  assert.deepEqual(sanearContexto(null), {});
});

test('lo que escribe la persona: largo se rechaza, sin título usa el comienzo del texto', () => {
  assert.equal(sanearAlta({ titulo: 'x'.repeat(141) }).ok, false);
  assert.equal(sanearAlta({ descripcion: 'x'.repeat(4001), titulo: 'a' }).ok, false);
  assert.equal(sanearAlta({ tipo: 'otro', titulo: 'a' }).ok, false);
  assert.equal(sanearAlta({}).ok, false);
  const r = sanearAlta({ descripcion: 'No me cargan los leads. Probé dos veces.' });
  assert.ok(r.ok && r.alta.titulo === 'No me cargan los leads');
  assert.ok(tituloDe('palabra '.repeat(30)).endsWith('…'));
});

test('el cliente ve cuatro estados y ninguno es interno', () => {
  assert.equal(estadoParaElCliente('esperando_decision'), 'recibido');
  assert.equal(estadoParaElCliente('arreglado'), 'en_curso');
  assert.equal(estadoParaElCliente('duplicado'), 'cerrado');
  assert.equal(estadoParaElCliente('resuelto'), 'resuelto');
});

test('rechazar o responder sin texto para el cliente no se puede', () => {
  assert.ok(motivoDecisionInvalida({ decision: 'rechazar', respuesta: '' }));
  assert.ok(motivoDecisionInvalida({ decision: 'responder' }));
  assert.ok(motivoDecisionInvalida({ decision: 'duplicado' }));
  assert.equal(motivoDecisionInvalida({ decision: 'duplicado', duplicadoDe: 4 }), null);
  assert.equal(motivoDecisionInvalida({ decision: 'arreglar' }), null);
  assert.ok(motivoDecisionInvalida({ decision: 'borrar' }));
});
