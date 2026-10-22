// =============================================================================
// El «atrás» de Android en un chat de Claude Code vuelve a la lista de chats (18/10/2026)
// =============================================================================
// Martín, en su Android: «en Mobile si le doy para atrás debería sacarme del chat para ir a ver todos los chats». En el
// teléfono, los chats de Claude Code están en la hoja «Tus chats» del chat de MaKo (app/m/second-brain/SecondBrainCentroM.tsx).
// Abrir uno REEMPLAZA esa hoja (SheetM: nunca hay dos, y el «atrás» cierra la de arriba), así que el «atrás» cerraba el chat
// y dejaba el chat de MaKo, no la lista. Ahora, al cerrarse un chat de Claude Code (por el «atrás», la ✕ o el arrastre),
// «Tus chats» vuelve a abrirse, con una demora para no pisar el `back()` de la ✕.
// Leído en el código (SheetM.tsx → registrarApertura), no medido en el teléfono.
//
// Probado rompiéndolo (18/10/2026, con la base en 0 fallos):
//   · SecondBrainCentroM sin pasarle `reabrirChats` a ChatMako → 1 fallo;
//   · ChatMako sin abrir la hoja cuando cambia → 1 fallo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const leer = (r: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', r), 'utf8').replace(/\r\n/g, '\n');

// Desde el 22/10/2026 la lista ES la pantalla (el Ops Center del cliente en el teléfono, ChatClienteM.tsx, como /m/operaciones):
// cerrar un chat de Claude Code con el «atrás» deja la lista a la vista, sin reabrir una hoja «Tus chats» que ya no existe.
test('cerrar un chat de Claude Code en el teléfono vuelve a la lista de chats', () => {
  const sb = leer('app/m/second-brain/SecondBrainCentroM.tsx');
  assert.match(sb, /<ChatClienteM \{\.\.\.chat\} masChats=\{\(\) => \(\s*<ChatsMDelCentro centro=\{k\} parte="lista"/, 'la lista de Claude Code va en la pantalla, debajo de los chats');
  assert.match(sb, /parte="hoja" abierto=\{abierto\} onAbierto=\{setAbierto\} \/>/);
  assert.doesNotMatch(sb, /reabrir/, 'no hay una hoja de la lista que volver a abrir');
});
