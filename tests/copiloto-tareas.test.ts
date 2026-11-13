// =============================================================================
// Marketing CoPilot — «Lo que te toca» vive en el Plan (13/11/2026): lo que decide el código, sin base
// =============================================================================
// Fija lo que pidió Martín en la vuelta 20 y lo que no se puede romper al escribir en el Plan:
//   · las tareas salen de lo que falta DE VERDAD en cada tarjeta, y lo resuelto se dice (para cerrarlo también en el Plan);
//   · cada tarea tiene una clave estable que viaja en el link de su fuente, y sólo eso la hace del CoPilot;
//   · sincronizar crea lo que falta y cierra lo resuelto, pero NUNCA reabre lo que la persona cerró ni toca una tarea ajena;
//   · ningún título lleva el renglón gris (Martín: «no pongas subtítulos abajo en ningún lugar»): lo que hay que saber va en él.
// Probado rompiéndolo: al pie.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  claveDeFuente, claveDeTitulo, esClaveCoPilot, planDeSincronizacion, tareasDelCoPilot, urlDeTarea, type ResumenParaTareas,
} from '../lib/copiloto/tareas';

const base = (): ResumenParaTareas => ({
  oferta: { sesion: 18, notaOferta: true, notaAngulos: false, notaVoz: true, faltan: { oferta: 0, angulos: 3, voz: 1 } },
  anuncios: { conectada: true, funnel: 'VSL y llamada', semana: [{ titulo: 'Graba 3 anuncios, uno por razón', href: '/copywriter' }] },
  web: ['https://cascara.studio/founders'],
  redes: { instagram: { conectada: true }, youtube: { conectada: false } },
  seguidos: 0,
});

test('las tareas salen de lo que falta de verdad, y lo resuelto se dice', () => {
  const { tareas, resueltas } = tareasDelCoPilot(base());
  const claves = tareas.map((t) => t.clave);
  assert.ok(claves.includes('oferta:leer-angulos'), 'no leí los ángulos');
  assert.ok(claves.includes('oferta:completar-angulos'));
  assert.ok(claves.includes('oferta:completar-voz'));
  assert.ok(claves.includes('youtube:conectar'));
  assert.ok(claves.includes('instagram:competidores'), 'sin seguidos, la tarea de elegirlos');
  for (const k of ['oferta:armar', 'oferta:analizar', 'oferta:leer-voz', 'oferta:completar-oferta', 'anuncios:conectar', 'anuncios:funnel', 'web:analizar', 'instagram:conectar']) {
    assert.ok(resueltas.includes(k), `${k} ya está resuelta`);
    assert.ok(!claves.includes(k), `${k} no es una tarea de hoy`);
  }
  assert.equal(tareas.find((t) => t.clave === 'oferta:completar-angulos')?.titulo, 'Completa tus ángulos: te faltan 3');
  assert.equal(tareas.find((t) => t.clave === 'oferta:completar-voz')?.titulo, 'Completa tu voz: te falta 1');
});

test('con seguidos, «Selecciona a tus competidores» queda resuelta; sin saberlo todavía, se pide', () => {
  assert.ok(tareasDelCoPilot({ ...base(), seguidos: 4 }).resueltas.includes('instagram:competidores'));
  assert.ok(tareasDelCoPilot({ ...base(), seguidos: null }).tareas.some((t) => t.clave === 'instagram:competidores'));
});

test('Audience Network es una tarea de una vez con la cuenta conectada (no un interruptor del piloto)', () => {
  assert.ok(tareasDelCoPilot(base()).tareas.some((t) => t.clave === 'anuncios:audience-network'));
  assert.ok(!tareasDelCoPilot({ ...base(), anuncios: { conectada: false, funnel: null, semana: [] } }).tareas.some((t) => t.clave === 'anuncios:audience-network'));
});

test('todas las claves son válidas y únicas, y los links de «Hacerlo» son de adentro de MaKo', () => {
  const { tareas } = tareasDelCoPilot({ ...base(), web: ['https://a.com', 'https://b.com/landing'], seguidos: null });
  assert.equal(new Set(tareas.map((t) => t.clave)).size, tareas.length);
  for (const t of tareas) {
    assert.ok(esClaveCoPilot(t.clave), t.clave);
    if (t.href) assert.match(t.href, /^\/(?!\/)/, t.clave);
    assert.ok(t.titulo.length <= 160 && !t.titulo.includes('\n'), t.clave);
  }
  assert.equal(claveDeTitulo('Grabá 3 anuncios, uno por razón!'), 'graba-3-anuncios-uno-por-razon');
});

test('la clave viaja en el link de la fuente, y sólo eso hace a una tarea del CoPilot', () => {
  const url = urlDeTarea({ clave: 'oferta:completar-angulos', tarjeta: 'oferta' });
  assert.equal(url, '/ads-manager/copiloto?tarjeta=oferta#copiloto:oferta:completar-angulos');
  assert.equal(claveDeFuente({ tipo: 'mako', url }), 'oferta:completar-angulos');
  assert.equal(claveDeFuente({ tipo: 'fathom', url: 'https://fathom.video/x?timestamp=754' }), null, 'una tarea de una reunión no es del CoPilot');
  assert.equal(claveDeFuente(null), null);
  assert.equal(claveDeFuente({ tipo: 'mako', url: '/ads-manager/copiloto#copiloto:../../borrar' }), null, 'una clave rara no se acepta');
});

test('sincronizar: crea lo que falta, cierra lo resuelto abierto, y nunca reabre lo que la persona cerró', () => {
  const hoy = tareasDelCoPilot(base()).tareas;
  const enElPlan = [
    { clave: 'oferta:leer-angulos', hecha: false },   // sigue pendiente: no se toca
    { clave: 'oferta:completar-voz', hecha: true },   // la cerró la persona en el Plan: no se reabre ni se recrea
    { clave: 'web:analizar', hecha: false },          // ya está resuelta en el CoPilot: se cierra
    { clave: 'anuncios:conectar', hecha: true },      // resuelta y ya cerrada: nada
  ];
  const { crear, cerrar } = planDeSincronizacion(hoy, tareasDelCoPilot(base()).resueltas, enElPlan);
  const crea = crear.map((t) => t.clave);
  assert.ok(!crea.includes('oferta:leer-angulos'));
  assert.ok(!crea.includes('oferta:completar-voz'), 'una cerrada en el Plan no vuelve a nacer');
  assert.ok(crea.includes('oferta:completar-angulos'));
  assert.deepEqual(cerrar, ['web:analizar']);
});

// Probado rompiéndolo (13/11/2026):
//   · `planDeSincronizacion` creando por «no está abierta» en vez de «no está» → «oferta:completar-voz» volvía a nacer: rojo.
//   · `claveDeFuente` sin validar la clave → «../../borrar» pasaba: rojo.
