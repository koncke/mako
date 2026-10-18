// =============================================================================
// El onboarding de un negocio NUNCA muestra las respuestas de otro
// =============================================================================
// Martín, feedback del 18/10/2026 (punto 15): al abrir otro negocio le aparecieron respuestas previas de otro
// («Consultesis»). Medido en la base ese día: «Consultesis» existía SÓLO en el estado del onboarding del ws 3
// (`onboarding.arranque`, 13:41) y en ningún otro workspace. El server no lo prestó: lo mostró la PANTALLA.
//
// La causa: ChatArranque guarda la conversación en su estado (`useState(inicial)`). Pasar de un `?ws=` a otro sin
// recargar deja montado el mismo componente, con la vista nueva en las props y las respuestas del negocio anterior en
// pantalla. La `key` con el workspace lo vuelve otro chat. Lo que este archivo fija son las tres capas: la key, y que
// lo que el server lee del arranque (su estado y la conversación de Offer) salga del workspace del request.
//
// ROTURAS (18/10/2026, arnés `romper-otro-ws.js` del scratchpad; base 3 / 0, restaurado de memoria): sin la key → 2 / 1
// · `leerFila` con el cliente crudo de Supabase (sin el workspace) → 2 / 1 · `getSetting` sin el filtro por workspace
// → 2 / 1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

test('otro workspace es otro chat: la página monta ChatArranque con la key del workspace', () => {
  const page = sinComentarios(leer('app/onboarding/page.tsx'));
  assert.match(page, /const ws = await getWorkspaceActual\(\);\s*return <ChatArranque inicial=\{vista\} key=\{`ws-\$\{ws \?\? 'ninguno'\}`\}/,
    'sin la key, cambiar de ?ws= sin recargar deja en pantalla las respuestas del negocio anterior');
  // Y la razón de la key: el chat arranca su estado de `inicial` una sola vez.
  const chat = sinComentarios(leer('app/onboarding/ChatArranque.tsx'));
  assert.match(chat, /useState<VistaArranque>\(inicial\)/);
});

test('la conversación de Offer del arranque se lee con el workspace del request', () => {
  const s = sinComentarios(leer('lib/offer-sesiones.ts'));
  const i = s.indexOf('export async function leerFila(');
  assert.ok(i >= 0);
  const cuerpo = s.slice(i, s.indexOf('\n}', i));
  assert.match(cuerpo, /const db = await getTenantDb\(\);/, 'leer la conversación sin el workspace puede traer la de otro negocio');
  assert.doesNotMatch(cuerpo, /getSupabaseServer\(\)/);
  const srv = sinComentarios(leer('lib/onboarding-arranque-server.ts'));
  assert.match(srv, /e\.sesionId \? leerSesion\(e\.sesionId\)/);
});

test('el estado del arranque (nombre, negocio, respuestas) es por workspace', () => {
  const s = sinComentarios(leer('lib/settings.ts'));
  const i = s.indexOf('export async function getSetting(');
  const cuerpo = s.slice(i, s.indexOf('\n}', i));
  assert.match(cuerpo, /\.eq\('workspace_id', await wsActual\(\)\)/, 'un setting sin workspace es el mismo para todos los negocios');
  assert.match(sinComentarios(leer('lib/onboarding-arranque-server.ts')), /const CLAVE = 'onboarding\.arranque';/);
});
