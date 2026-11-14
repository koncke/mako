// =============================================================================
// El piloto de Instagram y YouTube del Marketing CoPilot (14/11/2026): lib/copiloto/piloto-redes.ts
// =============================================================================
// Martín a Julio (13/11): «Instagram: reels por semana, historias, variaciones de hook… YouTube: videos por mes, shorts por video»,
// con «hacerlo solo / preguntarme». Fija:
//   · lo de fábrica sale del ritmo de la entrada; lo guardado que no vale cae a fábrica; se sabe qué red se guardó;
//   · el ritmo de la nevera: la red guardada pisa la del perfil; la que no, queda; los largos van del mes a la semana;
//   · las propuestas de la semana: una por cosa, sólo con el dato que las justifica y con el interruptor prendido;
//   · nada se propone en una red sin conectar.
// Correr: node --import tsx --test tests/copiloto-piloto-redes.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { pilotoDeFabrica, propuestasDelPiloto, ritmoConElPiloto, sanearPilotoRedes, type VistoParaProponer } from '../lib/copiloto/piloto-redes';

const fab = pilotoDeFabrica({ reel: 7, post: 2, story: 6, video: 1 });

test('lo de fábrica sale del ritmo; lo que no vale cae a fábrica', () => {
  assert.equal(fab.instagram.reelsSemana, 7);
  assert.equal(fab.youtube.largosMes, 4, '1 por semana son 4 por mes');
  assert.equal(pilotoDeFabrica(null).instagram.reelsSemana, 4, 'sin ritmo, lo de «3 a 5 horas por semana»');
  const s = sanearPilotoRedes({ instagram: { reelsSemana: 99, historiasSemana: 3, proponerHook: 'si' }, youtube: 'basura' }, fab);
  assert.equal(s.instagram.reelsSemana, 7, '99 no vale: fábrica');
  assert.equal(s.instagram.historiasSemana, 3);
  assert.equal(s.instagram.proponerHook, true, 'un texto no es un sí: fábrica');
  assert.deepEqual(s.guardado, { instagram: true, youtube: false });
  assert.deepEqual(sanearPilotoRedes(undefined, fab).guardado, { instagram: false, youtube: false });
});

test('el ritmo de la nevera: la red guardada pisa; la que no, queda', () => {
  const base = { reel: 4, post: 1, story: 4, video: 1 };
  const soloIg = sanearPilotoRedes({ instagram: { reelsSemana: 2, carruselesSemana: 0, historiasSemana: 5 } }, fab);
  assert.deepEqual(ritmoConElPiloto(base, soloIg), { reel: 2, story: 5, video: 1 }, 'carruseles en 0 no avisan; YouTube, el del perfil');
  const soloYt = sanearPilotoRedes({ youtube: { largosMes: 2 } }, fab);
  assert.deepEqual(ritmoConElPiloto(null, soloYt), { video: 1 }, '2 al mes avisan como 1 por semana');
  assert.equal(ritmoConElPiloto(null, sanearPilotoRedes({}, fab)), null, 'nada guardado y nada en el perfil: no se inventa');
});

test('las propuestas: una por cosa, con su dato y su interruptor', () => {
  const v: VistoParaProponer = { lunes: '2026-11-09', reelTop: { vistas: 15200, url: null }, numeroReel: 11209, largosPublicados: 2, instagram: true, youtube: true };
  const p = sanearPilotoRedes({ instagram: { variaciones: 4 } }, fab);
  const t = propuestasDelPiloto(p, v);
  assert.deepEqual(t.map((x) => x.clave), ['instagram:hook-20261109', 'instagram:a-carrusel-20261109', 'youtube:shorts-20261109']);
  assert.match(t[0].titulo, /^Graba 4 variaciones del hook de tu reel más visto \(15\.200 vistas\)$/);
  assert.match(t[2].titulo, /Saca 3 shorts/);
  // Sin el dato, no hay propuesta.
  assert.deepEqual(propuestasDelPiloto(p, { ...v, reelTop: { vistas: 900, url: null } }).map((x) => x.clave), ['instagram:hook-20261109', 'youtube:shorts-20261109'], '900 no supera 11.209: no va a carrusel');
  assert.deepEqual(propuestasDelPiloto(p, { ...v, reelTop: null, largosPublicados: 0 }), []);
  // Con el interruptor apagado, tampoco.
  const apagado = sanearPilotoRedes({ instagram: { proponerHook: false, proponerCarrusel: false }, youtube: { proponerShorts: false } }, fab);
  assert.deepEqual(propuestasDelPiloto(apagado, v), []);
  // Una red sin conectar no recibe propuestas.
  assert.deepEqual(propuestasDelPiloto(p, { ...v, instagram: false }).map((x) => x.tarjeta), ['youtube']);
});
