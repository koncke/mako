// =============================================================================
// La entrada del Marketing CoPilot (14/11/2026): lib/copiloto/entrada.ts
// =============================================================================
// La maqueta que Martín le mostró a Julio el 13/11. Fija:
//   · las pantallas: las de anuncios sólo con anuncios elegidos; no se sigue sin responder;
//   · lo que se guarda: canales, campañas, presupuesto y tiempo; el `funnel` que había no se pisa; sin anuncios no se guarda lo de anuncios;
//   · lo que se ve al volver: quien respondió la charla vieja encuentra marcado lo que ya sabía;
//   · el ritmo: sale del tiempo (estrategia.md §4), sólo en las redes elegidas, y la nevera lo usa;
//   · el saneado del perfil acepta los campos nuevos y tira lo que no existe.
// Correr: node --import tsx --test tests/copiloto-entrada.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { faltaLaEntrada, pantallaLista, pantallasEntrada, perfilConLaEntrada, respuestasDesdeElPerfil, ritmoDeLaEntrada } from '../lib/copiloto/entrada';
import { sanearPerfil } from '../lib/media-buyer/copiloto';

test('las pantallas de anuncios sólo con anuncios; no se sigue sin responder', () => {
  assert.deepEqual(pantallasEntrada(['instagram']), ['canales', 'tiempo']);
  assert.deepEqual(pantallasEntrada(['anuncios', 'youtube']), ['canales', 'campanas', 'presupuesto', 'tiempo']);
  const vacio = { canales: [], campanas: [], presupuestoMes: null, tiempo: null };
  for (const p of ['canales', 'campanas', 'presupuesto', 'tiempo'] as const) assert.equal(pantallaLista(p, vacio), false, p);
  assert.equal(pantallaLista('presupuesto', { ...vacio, presupuestoMes: 0 }), true, '«Nada por ahora» también es una respuesta');
});

test('lo que se guarda, sin pisar el funnel que había', () => {
  const p = perfilConLaEntrada({ funnel: 'webinar', ticket: 900 }, { canales: ['youtube', 'anuncios'], campanas: ['formulario', 'mensajes'], presupuestoMes: 1000, tiempo: 'b' });
  assert.deepEqual(p.canales, ['anuncios', 'youtube'], 'en el orden de la pantalla');
  assert.deepEqual(p.campanas, ['mensajes', 'formulario']);
  assert.equal(p.presupuestoMes, 1000);
  assert.equal(p.tiempo, 'b');
  assert.equal(p.horas, 5);
  assert.equal(p.funnel, 'webinar', 'el funnel que eligió antes no se pisa');
  assert.equal(p.ticket, 900, 'lo demás del perfil sigue');
  assert.equal(perfilConLaEntrada({}, { canales: ['anuncios'], campanas: ['vsl-llamada'], presupuestoMes: 300, tiempo: 'a' }).funnel, 'vsl-llamada');
  assert.equal(perfilConLaEntrada({}, { canales: ['instagram'], campanas: [], presupuestoMes: null, tiempo: 'a' }).funnel, 'organico');
  assert.equal(perfilConLaEntrada({}, { canales: ['youtube'], campanas: [], presupuestoMes: null, tiempo: 'c' }).funnel, 'youtube');
  const sinAds = perfilConLaEntrada({}, { canales: ['instagram'], campanas: ['mensajes'], presupuestoMes: 3000, tiempo: 'a' });
  assert.equal(sinAds.campanas, undefined, 'sin anuncios, lo de anuncios no se guarda');
  assert.equal(sinAds.presupuestoMes, undefined);
  assert.equal(faltaLaEntrada(sinAds), false);
  assert.equal(faltaLaEntrada({ funnel: 'mensajes' }), true, 'la charla vieja no alcanza: falta por dónde vende');
});

test('al volver, marcado lo que ya sabía de la charla vieja', () => {
  assert.deepEqual(respuestasDesdeElPerfil({ funnel: 'mensajes', presupuestoMes: 300, horas: 4 }), { canales: ['anuncios'], campanas: ['mensajes'], presupuestoMes: 300, tiempo: 'b' });
  assert.deepEqual(respuestasDesdeElPerfil({ funnel: 'youtube' }).canales, ['youtube']);
  assert.deepEqual(respuestasDesdeElPerfil({}), { canales: [], campanas: [], presupuestoMes: null, tiempo: null });
});

test('el ritmo sale del tiempo, sólo en las redes elegidas', () => {
  assert.deepEqual(ritmoDeLaEntrada({ tiempo: 'b', canales: ['instagram'] }), { reel: 4, post: 1, story: 4 });
  assert.deepEqual(ritmoDeLaEntrada({ tiempo: 'c', canales: ['youtube'] }), { video: 1 });
  assert.deepEqual(ritmoDeLaEntrada({ tiempo: 'd', canales: ['instagram', 'youtube'] }), { reel: 14, post: 3, story: 6, video: 2 });
  assert.equal(ritmoDeLaEntrada({ tiempo: 'a', canales: ['anuncios'] }), null, 'sólo anuncios: no hay nevera orgánica');
  assert.equal(ritmoDeLaEntrada({ canales: ['instagram'] }), null, 'sin tiempo no se inventa');
});

test('el saneado del perfil acepta lo nuevo y tira lo que no existe', () => {
  const s = sanearPerfil({ canales: ['instagram', 'tiktok', 'instagram'], campanas: ['mensajes', 'inventado'], tiempo: 'z' });
  assert.deepEqual(s.canales, ['instagram']);
  assert.deepEqual(s.campanas, ['mensajes']);
  assert.equal(s.tiempo, undefined);
  assert.equal(sanearPerfil({ tiempo: 'c' }).tiempo, 'c');
});
