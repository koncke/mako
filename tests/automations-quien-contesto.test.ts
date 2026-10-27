// =============================================================================
// El chat de Automations dice QUÉ IA CONTESTÓ (27/10/2026, la llamada con Aaron, 876825880-04)
// =============================================================================
// El Cerebro: «primero la IA que eligió el admin del negocio; Gemini sólo como último respaldo, y el chat dice qué IA
// contestó». El orden ya era ése (`chatCheapCascade`, lib/ai-cheap.ts: su Claude, sus claves, el crédito de Claude y la red
// de MaKo al final); lo que faltaba era decirlo. Fija: (1) el texto de cada caso; (2) que TODA respuesta que la cascada
// acepta anota quién la escribió; (3) que eso llega de `generar` a la ruta y de la ruta al globo; (4) que el chat lo guarda.
// Correr: node --import tsx --test tests/automations-quien-contesto.test.ts
// =============================================================================
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { textoDeQuienContesto } from '../lib/quien-contesto';
import { sanearMensaje } from '../lib/automatizacion-chat';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const bloque = (src: string, firma: string): string => {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const f = src.indexOf('\n}', i);
  return src.slice(i, f < 0 ? src.length : f + 2);
};
const cuantas = (s: string, aguja: string) => s.split(aguja).length - 1;

test('el texto: la IA del negocio es «tu», la de MaKo dice que es el respaldo, y lo que no se sabe no se dice', () => {
  assert.equal(textoDeQuienContesto({ proveedor: 'anthropic', de: 'negocio' }), 'Con tu Claude');
  assert.equal(textoDeQuienContesto({ proveedor: 'openai', modelo: 'gpt-4o-mini', de: 'negocio' }), 'Con tu ChatGPT');
  assert.equal(textoDeQuienContesto({ proveedor: 'gemini', de: 'negocio' }), 'Con tu Gemini');
  assert.equal(textoDeQuienContesto({ proveedor: 'anthropic', de: 'credito' }), 'Con el crédito de Claude de MaKo');
  assert.equal(textoDeQuienContesto({ proveedor: 'gemini', de: 'plataforma' }), 'Con la Gemini de MaKo (respaldo)');
  assert.equal(textoDeQuienContesto({ proveedor: 'groq', de: 'plataforma' }), 'Con la IA de MaKo (respaldo)');
  assert.equal(textoDeQuienContesto(null), null);
  assert.equal(textoDeQuienContesto(undefined), null);
  assert.equal(textoDeQuienContesto({ proveedor: '', de: 'negocio' }), null);
});

test('la cascada: TODA respuesta aceptada anota quién la escribió, y de quién era la cuenta', () => {
  const b = sinComentarios(bloque(leer('lib/ai-cheap.ts'), 'export async function chatCheapCascade('));
  assert.match(b, /quienOut\?: Partial<QuienContesto>/, 'la cascada no ofrece decir quién contestó');
  assert.match(b, /const anotarQuien = \(q: QuienContesto\) => \{ if \(opts\.quienOut\) Object\.assign\(opts\.quienOut, q\); \};/);
  // Cada `return t;` (lo que se aceptó) lleva su `anotarQuien` antes, a pocos caracteres: uno que se devuelve sin decirlo
  // es una respuesta que el chat no puede atribuir.
  const vueltas = [...b.matchAll(/return t;/g)].map((m) => m.index ?? 0);
  assert.equal(vueltas.length, 5, `cambió cuántas veces se acepta una respuesta (${vueltas.length}): revisá que cada una anote`);
  for (const i of vueltas) assert.match(b.slice(Math.max(0, i - 140), i), /anotarQuien\(\{/, `una respuesta aceptada sin anotar quién: «${b.slice(Math.max(0, i - 80), i + 9).trim()}»`);
  assert.match(b, /anotarQuien\(\{ proveedor: 'anthropic', de: 'negocio' \}\)/, 'su Claude no se dice suyo');
  assert.match(b, /anotarQuien\(\{ proveedor: prov, modelo: model \?\? null, de: 'negocio' \}\)/, 'sus claves no se dicen suyas');
  assert.equal(cuantas(b, "anotarQuien({ proveedor: 'anthropic', de: 'credito' })"), 2, 'los dos créditos de Claude no se dicen crédito');
  assert.match(b, /anotarQuien\(\{ proveedor: r\.provider, modelo: model \?\? null, de: 'plataforma' \}\)/, 'la red de MaKo no se dice respaldo');
});

test('de `generar` a la ruta: crear, contestar una pregunta y editar dicen quién contestó', () => {
  const crear = sinComentarios(leer('lib/flujo-ia-crear.ts'));
  assert.match(crear, /quienOut: quien,/, '`pasada` no le pide a la cascada quién contestó');
  assert.match(crear, /if \(uno\.bueno\) return \{ r: uno\.bueno, quien: uno\.quien \};/);
  assert.match(crear, /if \(dos\.bueno\) return \{ r: dos\.bueno, quien: dos\.quien \};/);
  assert.match(crear, /quienOut: quienCopia/, 'la copia en limpio no dice quién la pasó');
  assert.match(sinComentarios(leer('lib/flujo-ia-crear-core.ts')), /quien: g\.quien \?\? null,/, 'lo creado no lleva quién lo escribió');
  const ruta = sinComentarios(leer('app/api/chat-agent/secuencias/ia/route.ts'));
  assert.match(ruta, /const ia = textoDeQuienContesto\(r\.quien\);/, 'crear no lo dice');
  assert.match(ruta, /await contestar\(g\.r\.respuesta, g\.r\.falta, textoDeQuienContesto\(g\.quien\)\);/, 'la respuesta a una pregunta no lo dice');
  assert.match(ruta, /const ia = textoDeQuienContesto\(g\.quien\);\n\s*if \(r\.respuesta\) \{ await contestar\(r\.respuesta, r\.falta, ia\); return; \}/, 'editar no lo dice');
  // En el mensaje guardado y en el `listo`, en los tres caminos (crear: 2, contestar: 2, editar: 2).
  assert.ok(cuantas(ruta, '...(ia ? { ia } : {})') >= 6, `el «ia» no viaja en todos lados (${cuantas(ruta, '...(ia ? { ia } : {})')})`);
});

test('el globo: el chat copia el «ia» del `listo` y lo dibuja al pie, chico y en gris', () => {
  const chat = leer('app/automations/ChatMako.tsx');
  assert.match(chat, /\.\.\.\(l\.ia \? \{ ia: l\.ia \} : \{\}\),/, 'el mensaje nuevo pierde quién contestó');
  assert.match(chat, /\{m\.ia && <span data-ia-mako="" style=\{S\.ia\}>\{m\.ia\}<\/span>\}/, 'el globo no lo dice');
  assert.match(chat, /ia: \{ fontSize: 11\.5, color: 'var\(--faint\)' \},/);
});

test('el chat guardado: sólo en los de MaKo, sin saltos y corto', () => {
  const base = { id: 'm1', texto: 'Listo', at: '2026-10-27T18:00:00.000Z', via: 'app' };
  assert.equal(sanearMensaje({ ...base, de: 'mako', ia: '  Con tu\n Claude ' })?.ia, 'Con tu Claude');
  assert.equal(sanearMensaje({ ...base, de: 'yo', ia: 'Con tu Claude' })?.ia, undefined, 'un mensaje de la persona no tiene IA');
  assert.equal(sanearMensaje({ ...base, de: 'mako', ia: 42 })?.ia, undefined);
  assert.equal(sanearMensaje({ ...base, de: 'mako', ia: 'x'.repeat(200) })?.ia?.length, 60);
  assert.equal(sanearMensaje({ ...base, de: 'mako' })?.ia, undefined, 'los mensajes de antes no inventan una IA');
});

// ROTURAS (27/10/2026, una por vez y restaurada; base 5 / 0):
//   · la red de MaKo devuelve sin `anotarQuien`                                  → 4 / 1
//   · `textoDeQuienContesto` dice «Con tu …» también para la plataforma           → 4 / 1
//   · la ruta de editar contesta sin `ia`                                         → 4 / 1
//   · `sanearMensaje` deja de guardar `ia`                                        → 4 / 1
