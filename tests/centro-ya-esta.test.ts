// =============================================================================
// Los «Ya está» de cada chat, como hechos de Review (Ops Center, 17/10/2026)
// =============================================================================
// La regla de Martín (AGENTS.md): cada chat cierra lo que llegó a producción con «Ya está» en SU chat, con la ruta donde
// se prueba. Llegaban sólo como texto de la conversación; ahora Review los lista como algo hecho, con «Revisar» en su ruta.
// Lo que se fija acá es lo que, roto, NO da error: un «Ya está» que no entra (o uno que no lo es y entra), la ruta de un
// ARCHIVO tomada como página de MaKo, lo que escribió Martín contado como cierre del chat, y Review sin ellos.
//
// ⚠️ Probado ROMPIÉNDOLO (17/10/2026), una rotura por vez contra la base en verde de 5 pases:
//   · esYaEsta sin el ancla del principio (cualquier «ya está» en el medio) → 1 fallo;
//   · rutaDeYaEsta sin descartar archivos → 1 fallo;
//   · yaEstaDelChat aceptando lo que escribió Martín (rol «yo») → 1 fallo;
//   · Review (SubTabs) sin los «Ya está» → 1 fallo.
//   Restaurado de memoria (no con git checkout): 5 pases.
// Lo que el test NO ve: la fila pintada (no hay navegador en estos tests).

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { avanceDelChat, destinoDeReview, esYaEsta, porRevisar, rutaDeYaEsta, yaEstaDelChat, type LineaChat } from '../lib/centro-chats';
import type { TurnoChat } from '../lib/operaciones-reglas';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const LOCAL = 'local_0b1c2d3e-4f50-4a61-8b72-9c83d4e5f601';

test('un «Ya está» es el primer renglón que empieza así, con o sin negrita, tilde o un ✅', () => {
  for (const t of ['Ya está: el filtro del CRM.', '**Ya está.** Pruébalo en /crm', '✅ Ya está', 'ya esta, subió', '  Ya está\nSegundo renglón', '— Ya está']) {
    assert.equal(esYaEsta(t), true, `«${t}»`);
  }
  for (const t of ['Voy a trabajar en el filtro', 'Todavía no: ya está casi', 'Ya estamos cerca', 'Listo.\nYa está en producción', '']) {
    assert.equal(esYaEsta(t), false, `«${t}»`);
  }
});

test('la ruta de un «Ya está» es una página de MaKo, nunca un archivo ni otro sitio', () => {
  assert.equal(rutaDeYaEsta('Ya está. Pruébalo en /crm?lead=12.'), '/crm?lead=12');
  assert.equal(rutaDeYaEsta('Ya está: https://hola-mako.com/admin/operaciones (tocá «Second Brain»)'), '/admin/operaciones');
  assert.equal(rutaDeYaEsta('Ya está, entrá [aquí](/offer).'), '/offer');
  assert.equal(rutaDeYaEsta('Ya está en «/m/operaciones»'), '/m/operaciones');
  assert.equal(rutaDeYaEsta('Ya está. Cambié app/admin/x.tsx y /c/dev/wt-centro-chat/lib/a.ts'), null, 'un archivo no es una página');
  assert.equal(rutaDeYaEsta('Ya está: corre node /scripts/operaciones/cartero.mjs instalar'), null);
  assert.equal(rutaDeYaEsta('Ya está, el log en /tmp/salida'), null);
  assert.equal(rutaDeYaEsta('Ya está: https://evil.com/crm y //evil.com'), null, 'otro sitio no');
  assert.equal(rutaDeYaEsta('Ya está, sin ruta.'), null);
});

const turno = (rol: TurnoChat['rol'], texto: string, uuid: string, at = '2026-10-17T12:00:00Z'): LineaChat =>
  ({ tipo: 'turno', instante: Date.parse(at), turno: { local: LOCAL, uuid, rol, de: null, texto, at, trabajo: null } });

test('cada «Ya está» del chat es un HECHO de Review, con su ruta y la sesión que lo dijo; el Plan no cambia', () => {
  const lineas = [
    turno('yo', 'Ya está bien, ahora hacé el otro', 'u-martin-01'),
    turno('el', 'Voy a trabajar en el filtro del CRM', 'u-chat-0001', '2026-10-17T12:01:00Z'),
    turno('el', '**Ya está**: el filtro del CRM.\nPruébalo en /crm?lead=12', 'u-chat-0002', '2026-10-17T13:00:00Z'),
    turno('el', 'Ya está.', 'u-chat-0003', '2026-10-17T14:00:00Z'),
  ];
  const hechos = yaEstaDelChat(lineas);
  assert.deepEqual(hechos.map((n) => n.id), ['y:u-chat-0002', 'y:u-chat-0003'], 'sólo lo que dijo el chat, y sólo sus «Ya está»');
  const [filtro, solo] = hechos;
  assert.equal(filtro.estado, 'hecho');
  assert.equal(filtro.titulo, 'el filtro del CRM.');
  assert.deepEqual(filtro.revisar, { pagina: '/crm?lead=12', sesion: LOCAL });
  assert.equal(solo.titulo, 'Ya está');
  assert.equal(solo.revisar, null);
  assert.deepEqual(avanceDelChat(lineas), [], 'un «Ya está» no es un pedido: el «8/13» del Plan no lo cuenta');
  // Con su ruta, «Revisar» lleva a ella; ordenados, el más nuevo arriba.
  assert.deepEqual(porRevisar(hechos).map((n) => n.id), ['y:u-chat-0003', 'y:u-chat-0002']);
  assert.deepEqual(destinoDeReview(filtro, { clave: 'nombre:crm', sesion: LOCAL, titulo: 'CRM' }, []), { href: '/crm?lead=12', via: 'pagina' });
});

test('Review junta lo terminado del Plan con los «Ya está», en la computadora y en el teléfono', () => {
  const avance = sinComentarios(leer('app/admin/operaciones/Avance.tsx'));
  assert.match(avance, /const revisar = porRevisar\(\[\.\.\.nodos, \.\.\.yaEsta\]\);/);
  assert.match(sinComentarios(leer('app/admin/operaciones/Conversacion.tsx')), /<RielAvance nodos=\{nodos\} yaEsta=\{yaEstaDelChat\(lineas\)\}/);
  assert.match(sinComentarios(leer('app/m/operaciones/ChatsMovil.tsx')), /<BarraAvanceMovil nodos=\{avanceDelChat\(lineas\)\} yaEsta=\{yaEstaDelChat\(lineas\)\}/);
});

test('la ruta de un «Ya está» pasa por la misma regla que Review (sólo interna)', () => {
  const [n] = yaEstaDelChat([turno('el', 'Ya está en /\\evil.com y en /crm', 'u-chat-0009')]);
  assert.equal(n.revisar?.pagina, '/crm', 'lo que no es interno se saltea');
});
