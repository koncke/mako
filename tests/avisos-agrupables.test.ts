import { test } from 'node:test';
import assert from 'node:assert/strict';
import { puedeEsperar, textoResumen, lineaDeAviso, AVISOS_AGRUPABLES } from '../lib/avisos-agrupables';

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

// ---------------------------------------------------------------------------
// El renglón de cada aviso dice DE QUÉ habla
// ---------------------------------------------------------------------------
// ⚠️ PROBADO ROMPIÉNDOLO (3 tests): volviendo `lineaDeAviso` al título pelado (`return
// titulo`) → 1 pasa (el del título solo, que es justo el caso donde no hay detalle) y 2
// fallan, el de los tres del mismo tipo y el del link. Y cortando la línea ENTERA a 100
// —con la URL adentro— → 2 pasan, 1 falla (el del link a medias).

test('tres avisos del MISMO tipo no salen como tres renglones idénticos', () => {
  // `emitirDelCatalogo` pone siempre el título estático del catálogo, así que si el
  // resumen sólo imprimiera el título, estos tres serían el mismo renglón tres veces.
  const items = [
    { tipo: 'landing-cambio', titulo: 'Cambió tu landing', texto: 'Le sacaron el video a *midominio.com/vsl*.' },
    { tipo: 'landing-cambio', titulo: 'Cambió tu landing', texto: 'Apareció una agenda en *midominio.com/gracias*.' },
    { tipo: 'landing-cambio', titulo: 'Cambió tu landing', texto: 'Le sacaron los botones a *midominio.com/oferta*.' },
  ];
  const renglones = items.map(lineaDeAviso);
  assert.equal(new Set(renglones).size, 3, 'los tres renglones tienen que ser distintos');
  assert.match(renglones[0], /midominio\.com\/vsl/);
  assert.match(renglones[1], /midominio\.com\/gracias/);
});

test('el link viaja ENTERO aunque la prosa se recorte', () => {
  // Un link cortado a la mitad se ve clicable y no lleva a ningún lado.
  const url = 'https://app.midominio.com/crm/lead-0123456789abcdef';
  const a = {
    tipo: 'lead-fusionado', titulo: 'Fusioné un contacto',
    texto: `Entró un contacto por *Calendly* y lo sumé a *Juan Pérez*, que ya tenías (mismo teléfono, +52 55 1234 5678, y el mismo mail de siempre). Si no era la misma persona, avísame y lo separo 👉 ${url}`,
  };
  const linea = lineaDeAviso(a);
  assert.ok(linea.includes(url), `el link tiene que estar entero: ${linea}`);
  assert.match(linea, /…/, 'la prosa larga se recorta');
  assert.ok(!linea.includes('👉 https://app.midominio.com/crm/lead-0123456789ab…'), 'nunca un link a medias');
});

test('sin texto queda el título, y un detalle que repite el título no se duplica', () => {
  assert.equal(lineaDeAviso({ tipo: 'retro-lista', titulo: 'Tu retro está lista' }), 'Tu retro está lista');
  assert.equal(lineaDeAviso({ tipo: 'x', titulo: 'Tu retro está lista', texto: 'Tu retro está lista' }), 'Tu retro está lista');
  assert.equal(lineaDeAviso({ tipo: 'x', titulo: '' }), 'x', 'sin título queda el tipo');
});

test('la cola vacía NO produce mensaje, y una larga se corta en 12', () => {
  assert.equal(textoResumen([]), null);
  const items = Array.from({ length: 15 }, (_, i) => ({ tipo: 't', titulo: `Aviso ${i}` }));
  const m = textoResumen(items)!;
  assert.equal((m.texto.match(/^• /gm) ?? []).length, 13, '12 + la línea del resto');
  assert.match(m.texto, /y 3 más/);
  assert.match(m.titulo, /15 avisos de ayer/);
});
