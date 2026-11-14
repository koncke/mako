// =============================================================================
// El lector de la cuenta PROPIA del Marketing CoPilot (14/11/2026): lib/copiloto/redes-propias-reglas.ts
// =============================================================================
// Martín a Julio (13/11): el CoPilot lee tu Instagram (link del perfil, bio, CTA del reel más visto) y tu YouTube. Fija:
//   · un pedido de acción se reconoce (escríbeme, comenta, link en bio, 👇…) y un texto sin pedido no;
//   · Instagram: la bio, el link a SU página, el ritmo de la semana y el reel más visto, cada uno «bien / a tocar»;
//   · lo que no se pudo leer no aparece (ni como falla);
//   · YouTube: la descripción y el link a su página;
//   · cada punto a tocar es una tarea de «Lo que te toca», y uno bien queda resuelto.
// Correr: node --import tsx --test tests/copiloto-redes-propias.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { puntosInstagram, puntosYoutube, tieneCta, type PublicacionPropia } from '../lib/copiloto/redes-propias-reglas';
import { tareasDelCoPilot, type ResumenParaTareas } from '../lib/copiloto/tareas';

const HOY = new Date('2026-11-14T12:00:00Z');
const pub = (tipo: PublicacionPropia['tipo'], dias: number, texto = '', vistas: number | null = null): PublicacionPropia => ({ tipo, fecha: new Date(HOY.getTime() - dias * 864e5).toISOString(), texto, vistas, url: `https://www.instagram.com/reel/x${dias}/` });

test('un pedido de acción se reconoce; un texto sin pedido no', () => {
  for (const t of ['Escríbeme «PLAN» por DM', 'Comenta GUÍA y te lo mando', 'Agenda tu llamada en el link de la bio', 'Te cuento cómo 👇']) assert.ok(tieneCta(t), t);
  for (const t of ['Mentora de ventas. Mamá de 2.', 'Así cerré 3 ventas en una semana', '', null]) assert.ok(!tieneCta(t), String(t));
});

test('Instagram: bio, link a su página, ritmo y reel más visto', () => {
  const pubs = [pub('reel', 2, 'Así cerré 3 ventas', 15200), pub('reel', 9, 'Comenta GUÍA', 900), pub('post', 3), pub('story', 1)];
  const p = puntosInstagram({ usuario: 'mentoria', bio: 'Mentora de ventas', web: 'https://linktr.ee/mentoria', publicaciones: pubs },
    { landings: ['https://mentoria-de-ejemplo.com/vsl'], porSemana: 3, hoy: HOY });
  const por = Object.fromEntries(p.map((x) => [x.clave, x]));
  assert.equal(por['instagram:bio-cta'].bien, false);
  assert.equal(por['instagram:link-perfil'].bien, false);
  assert.match(por['instagram:link-perfil'].texto, /linktr\.ee/);
  assert.equal(por['instagram:ritmo'].bien, false, 'las historias no cuentan: 2 de 3');
  assert.equal(por['instagram:ritmo'].texto, 'Esta semana publicaste 2 de 3.');
  assert.equal(por['instagram:reel-cta'].bien, false, 'el más visto es el de 15.200 y no pide nada');
  assert.match(por['instagram:reel-cta'].texto, /15\.200 vistas/);
  assert.ok(p.every((x) => x.bien || x.tarea), 'todo lo que está a tocar trae su tarea');
  const bien = puntosInstagram({ usuario: 'mentoria', bio: 'Escríbeme «PLAN» 👇', web: 'mentoria-de-ejemplo.com', publicaciones: [pub('reel', 1, 'Comenta GUÍA', 300)] },
    { landings: ['https://www.mentoria-de-ejemplo.com/'], porSemana: 1, hoy: HOY });
  assert.ok(bien.every((x) => x.bien), JSON.stringify(bien));
});

test('lo que no se pudo leer no aparece', () => {
  assert.deepEqual(puntosInstagram({ usuario: 'm', bio: null, web: null, publicaciones: null }, { landings: [], porSemana: 3, hoy: HOY }), []);
  const sinVistas = puntosInstagram({ usuario: 'm', bio: null, web: null, publicaciones: [pub('reel', 1, '', null)] }, { landings: [], porSemana: null, hoy: HOY });
  assert.deepEqual(sinVistas, [], 'sin ritmo y sin vistas, nada que decir');
  assert.deepEqual(puntosYoutube({ usuario: '@m', descripcion: null, suscriptores: null }, { landings: [] }), []);
});

test('YouTube: la descripción y el link a su página', () => {
  const mal = puntosYoutube({ usuario: '@m', descripcion: 'Videos de ventas.', suscriptores: 1200 }, { landings: ['https://mentoria-de-ejemplo.com'] });
  assert.deepEqual(mal.map((x) => [x.clave, x.bien]), [['youtube:descripcion', false], ['youtube:link', false]]);
  const bien = puntosYoutube({ usuario: '@m', descripcion: 'Agenda tu llamada: mentoria-de-ejemplo.com', suscriptores: 1200 }, { landings: ['https://mentoria-de-ejemplo.com'] });
  assert.ok(bien.every((x) => x.bien));
  assert.equal(puntosYoutube({ usuario: '@m', descripcion: '  ', suscriptores: 0 }, { landings: [] })[0].clave, 'youtube:descripcion');
});

test('cada punto a tocar es una tarea; uno bien queda resuelto', () => {
  const base: ResumenParaTareas = {
    oferta: { sesion: 1, notaOferta: true, notaAngulos: true, notaVoz: true, faltan: { oferta: 0, angulos: 0, voz: 0 } },
    anuncios: { conectada: true, funnel: 'mensajes', semana: [] }, web: ['https://x.com'],
    redes: { instagram: { conectada: true }, youtube: { conectada: true } }, seguidos: 2,
    propias: {
      instagram: [{ clave: 'instagram:bio-cta', bien: false, tarea: 'Suma a tu bio qué hacer', href: 'https://www.instagram.com/m/' }, { clave: 'instagram:ritmo', bien: true }],
    },
  };
  const { tareas, resueltas } = tareasDelCoPilot(base);
  const t = tareas.find((x) => x.clave === 'instagram:bio-cta');
  assert.ok(t);
  assert.equal(t.tarjeta, 'instagram');
  assert.equal(t.titulo, 'Suma a tu bio qué hacer');
  assert.ok(resueltas.includes('instagram:ritmo'));
});
