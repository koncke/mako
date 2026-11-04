// =============================================================================
// El grupo de WhatsApp en el Ops Center: de la fila de sólo lectura (22/10/2026, OC3) al grupo de la app (3/11/2026)
// =============================================================================
// El 22/10 el grupo de WhatsApp se volvió una fila más de la lista, de sólo lectura y sólo del admin. El 3/11 WhatsApp baneó la línea y Martín pidió el grupo
// adentro de la app: esa fila se fue, porque saldría doble, y lo que leía queda en «Ver lo anterior de WhatsApp», con el mismo corte (app/api/grupos/[ws]/whatsapp/route.ts).
//   1. la fila vieja no está, ni en la lista ni en el motor;
//   2. lo que leía no sale de /api/mako/chat, y no va a ningún modelo;
//   3. el grupo se escribe, con la caja única.
//
// Correr: node --import tsx --test tests/ops-center-grupo-mako.test.ts
// PROBADO ROMPIÉNDOLO (base 3/0), ver el pie.
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { listaDelCliente } from '../lib/chat-mako-reglas';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('1. la fila vieja del grupo de WhatsApp ya no está: la reemplazó el grupo de la app', () => {
  // Desde el 3/11/2026 (Martín: «grupos de WhatsApp dentro del Ops Center») el grupo tiene su fila fijada y su motor (tests/grupos-ops-pantalla.test.ts). Con las dos, saldría doble.
  const base = { sesiones: [], offer: [{ id: 7, titulo: 'Sprint', updatedAt: '2026-10-22T10:00:00Z' }], antes: [], busca: '' };
  assert.deepEqual(listaDelCliente(base).map((f) => f.clave), ['jefe', 'o7'], 'la lista del cliente no sabe de grupos');
  const motor = sinComentarios(leer('app/second-brain/useChatCliente.ts'));
  assert.doesNotMatch(motor, /esGrupo|delGrupo|grupoHilo|\?grupo=1|verAnteriores/, 'el motor del cliente, sin la fila vieja');
  const piezas = sinComentarios(leer('app/second-brain/PiezasCliente.tsx'));
  assert.doesNotMatch(piezas, /esGrupo|AVISO_GRUPO|verAnteriores/);
  assert.doesNotMatch(sinComentarios(leer('lib/chat-mako-reglas.ts')), /TITULO_GRUPO|AVISO_GRUPO|\{ grupo: true \}|antesValido/);
});

test('2. lo que leía el grupo de WhatsApp sólo para el admin sale de /api/mako/chat: lo lee la ruta del grupo, con el mismo corte', () => {
  const ruta = sinComentarios(leer('app/api/mako/chat/route.ts'));
  assert.doesNotMatch(ruta, /grupoDeMaKo|hiloDelGrupoMaKo|grupoHilo/);
  assert.doesNotMatch(sinComentarios(leer('lib/chat-mako-indice.ts')), /grupoDeMaKo|hiloDelGrupoMaKo|getGrupoJidMaKo/);
  const wa = sinComentarios(leer('app/api/grupos/[ws]/whatsapp/route.ts'));
  assert.match(wa, /if \(ws == null \|\| !quien \|\| quien\.invitado\) return NextResponse\.json\(\{ ok: false, error: 'No existe\.' \}, \{ status: 404 \}\);/, 'a un invitado no: ve desde que entró');
  assert.doesNotMatch(wa, /grupo_jid|\bjid\b/, 'el jid no sale de acá');
  // Ni la lista ni el hilo de los chats que lee MaKo (decisión 11): lo que se dijo en el grupo de WhatsApp no se le da al modelo por acá.
  const run = sinComentarios(leer('lib/api-mako/areas/mako.run.ts'));
  assert.doesNotMatch(run, /grupoDeMaKo|hiloDelGrupoMaKo|hiloDelGrupo\(/, 'listar_chats_mako / hilo_chat_mako no leen el grupo');
});

test('3. el grupo se escribe: su caja es la única, y no pasa por el motor del cliente', () => {
  const caja = sinComentarios(leer('app/_chat/grupo/CajaDelGrupo.tsx'));
  assert.match(caja, /import \{ CajaChat \} from '@\/app\/_chat\/CajaChat';/);
  assert.match(caja, /<CajaChat texto=\{texto\}/);
  for (const f of ['app/second-brain/ChatSecondBrain.tsx', 'app/m/second-brain/ChatClienteM.tsx']) {
    assert.match(sinComentarios(leer(f)), /<CajaDelCliente k=\{k\}/, f);
  }
});

// PROBADO ROMPIÉNDOLO (3/11/2026, base 3/0, reescrito al sacar la fila vieja):
//   · la fila del grupo otra vez en `listaDelCliente`                                  → 2/1 (1)
//   · `?grupoHilo` otra vez en la ruta                                                 → 2/1 (2)
//   · lo de WhatsApp abierto a un invitado                                             → 2/1 (2)
