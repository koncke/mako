// =============================================================================
// Un chat «de antes» se ABRE con su hilo en el Ops Center del cliente, no vacío (22/10/2026)
// =============================================================================
// Medido en producción (cb7b45568), en el ws3: la fila «Dashboard › Editar con MaKo · Página 1» aparecía en la lista y al
// abrirla decía «¿En qué te ayudo?», sin un mensaje. El motor (app/second-brain/useChatCliente.ts) pide el hilo con
// `?sessionId=N&antes=1` desde 0ab523fc1, y el GET de /api/mako/chat entraba antes a la rama de la LISTA
// (`if (sp.get('antes') || …)`), que con `antes` devolvía `{ ok, antes: […] }`. Pasaba con todos: el CRM, los gráficos, Editar
// con MaKo y el Web Generator. `?antesId=294` sí traía los dos mensajes: el dato estaba, la puerta lo tapaba.
//
// El test toma la condición REAL de esa rama y la evalúa con los pedidos que hace la pantalla.
//
// ⚠️ PROBADO ROMPIÉNDOLO (22/10/2026): con la condición de antes (`sp.get('antes') || sp.has('antesId')`) → 1 fallo; el
// motor pidiendo el hilo con `?antesId=` en vez de `?sessionId=…&antes=1` → 1 fallo.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const sinComentarios = (s: string) => s.replace(/\r\n/g, '\n').replace(/^[ \t]*\/\/.*$/gm, '');
const leer = (...p: string[]) => sinComentarios(readFileSync(join(RAIZ, ...p), 'utf8'));

test('el GET: `?sessionId=N&antes=1` llega al hilo; `?antes=1` sigue siendo la lista y `?antesId=N`, el hilo de sólo lectura', () => {
  const ruta = leer('app', 'api', 'mako', 'chat', 'route.ts');
  const get = ruta.slice(ruta.indexOf('export async function GET'), ruta.indexOf('export async function POST'));
  const m = /if \((.+)\) \{\n\s*const q = await quienChateaDelRequest\(\);/.exec(get);
  assert.ok(m, 'no encontré la rama de «antes» del GET');
  const ramaAntes = new Function('sp', `return !!(${m![1]});`) as (sp: URLSearchParams) => boolean;
  const entra = (q: string) => ramaAntes(new URLSearchParams(q));
  assert.equal(entra('antes=1'), true, 'la lista de los chats de antes');
  assert.equal(entra('antesId=294'), true, 'un chat de antes, de sólo lectura');
  assert.equal(entra('sessionId=294&antes=1&ws=3'), false, 'el hilo de un chat de antes cae en la lista: se abre vacío');
  // Y lo que se escapa de esa rama llega a la del hilo, que mira de quién es (`personaDelChat` con `antes`).
  const hilo = get.indexOf("if (sp.has('sessionId')) {");
  assert.ok(hilo > m!.index, 'la rama del hilo va después');
  assert.match(get.slice(hilo), /personaDelChat\(persona, id, sp\.get\('antes'\)\)/);
});

test('el motor pide el hilo de un chat de antes con `sessionId` y `antes` (lo que la ruta tiene que atender)', () => {
  const motor = leer('app', 'second-brain', 'useChatCliente.ts');
  assert.match(motor, /`\$\{RUTA\}\?sessionId=\$\{id\}\$\{deAntes \? '&antes=1' : ''\}`/);
});
