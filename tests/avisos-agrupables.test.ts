import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeEsperar, textoResumen, AVISOS_AGRUPABLES } from '../lib/avisos-agrupables';

// ---------------------------------------------------------------------------
// Qué aviso puede esperar al resumen de la mañana
// ---------------------------------------------------------------------------
// «Las notificaciones de WhatsApp son demasiadas» (22/09/2026). La cura no puede ser
// posponer TODO: un lead que entra, una reunión que se agenda o una cuenta de Meta
// frenada valen por la hora a la que llegan.
//
// ⚠️ PROBADO ROMPIÉNDOLO, con los números (5 tests):
//   · metiendo 'lead-formulario-meta' en la lista        → 4 pasan, 1 falla (el de lo urgente);
//   · sacando el guard de categoría 'accion'/'pregunta'  → 4 pasan, 1 falla (el del turno del doer);
//   · devolviendo {titulo:'',texto:''} en vez de null    → 4 pasan, 1 falla (el de la cola vacía).
// Cada rotura tira un test distinto: ninguno mide de prestado.

test('lo urgente NO espera: un lead, una reunión, la cuenta frenada', () => {
  for (const tipo of ['lead-formulario-meta', 'lead-de-landing', 'reunion-nuevo-agendado', 'reunion-cancelada', 'wa-mensaje-entrante', 'meta-cuenta-frenada', 'tracking-apagado', 'meta-anuncio-espera-aprobacion']) {
    assert.equal(puedeEsperar(tipo), false, `${tipo} no puede esperar a mañana`);
  }
});

test('lo informativo SÍ espera', () => {
  for (const tipo of ['objetivo-en-riesgo', 'meta-alcanzada', 'tareas-autocompletadas', 'plan-proyecto-vence', 'landing-cambio']) {
    assert.equal(puedeEsperar(tipo), true, `${tipo} puede salir en el resumen`);
  }
});

test('un aviso que PREGUNTA no se pospone aunque esté en la lista', () => {
  // Si se pospone, el «sí» del dueño de mañana se pega a otra conversación: `emitirAviso`
  // guarda el turno del doer sólo cuando el mensaje sale de verdad.
  assert.equal(puedeEsperar('meta-alcanzada', 'aviso'), true);
  assert.equal(puedeEsperar('meta-alcanzada', 'accion'), false);
  assert.equal(puedeEsperar('meta-alcanzada', 'pregunta'), false);
});

test('un tipo NUEVO sale en el momento hasta que alguien lo agregue a mano', () => {
  // La lista va en POSITIVO: con «todos menos éste», cada aviso que se cablee mañana
  // entraría a los pospuestos sin que nadie lo decida.
  assert.equal(puedeEsperar('un-aviso-que-no-existe-todavia'), false);
  assert.equal(AVISOS_AGRUPABLES.has('un-aviso-que-no-existe-todavia'), false);
});

test('la cola vacía NO produce mensaje, y una larga se corta en 12', () => {
  assert.equal(textoResumen([]), null);
  const items = Array.from({ length: 15 }, (_, i) => ({ tipo: 't', titulo: `Aviso ${i}` }));
  const m = textoResumen(items)!;
  assert.equal((m.texto.match(/^• /gm) ?? []).length, 13, '12 + la línea del resto');
  assert.match(m.texto, /y 3 más/);
  assert.match(m.titulo, /15 avisos de ayer/);
});
