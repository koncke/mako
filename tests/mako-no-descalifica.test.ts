// =============================================================================
// MaKo NUNCA descalifica lo que le piden (27/10/2026, la crítica de Leila)
// =============================================================================
// Leila preguntó «¿tenemos registro de cumpleaños de los clientes activos?» y MaKo contestó «eso es una distracción total».
// La frase no está en el código: sale de la persona (lib/mako-persona.ts: «honestidad radical», «el orden importa más que las
// tácticas»), que es editable y la guardada le gana al default. Lo que fija:
//   1. la regla (`REGLA_NO_DESCALIFICAR`, lib/no-existe.ts): nunca «distracción», «no importa», «no es prioridad»; primero
//      contesta, si no existe lo dice y propone cómo, y lo urgente va DESPUÉS;
//   2. va FIJA en `buildSystemPrompt` (lib/mako-context.ts), después de la persona y del núcleo editables, en el modo lean Y en
//      el completo: la app (lib/mako-turno-app.ts), WhatsApp (lib/mako-doer-in.ts, también su red lean) y /api/mako-doer;
//   3. con la pregunta de cumpleaños: la respuesta que recibió Leila se detecta (`descalificaElPedido`, el que usa
//      scripts/probar-no-existe.mts contra el modelo real) y una que contesta y propone, no.
//
// Probado rompiéndolo (27/10/2026): al pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGLA_NO_DESCALIFICAR, descalificaElPedido } from '../lib/no-existe';

const RAIZ = join(import.meta.dirname, '..');
const fuente = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');

const LA_DE_LEILA = '¿Tenemos registro de cumpleaños de los clientes activos?';

test('1. la regla: nunca descalificar; primero contestar, y lo urgente después', () => {
  assert.match(REGLA_NO_DESCALIFICAR, /Nunca lo llames distracción/);
  assert.match(REGLA_NO_DESCALIFICAR, /«no importa»/);
  assert.match(REGLA_NO_DESCALIFICAR, /Primero contesta lo que preguntó/);
  assert.match(REGLA_NO_DESCALIFICAR, /si todavía no existe en MaKo, dilo y propón cómo/);
  assert.match(REGLA_NO_DESCALIFICAR, /súmalo DESPUÉS, como sugerencia/);
  assert.doesNotMatch(REGLA_NO_DESCALIFICAR, /\b(?:vos|tenés|podés|decí|fijate)\b/, 'el system va en tuteo, como el resto');
});

test('2. va fija en buildSystemPrompt, después de lo editable, en el modo lean, en el completo y en el asesor de WhatsApp', () => {
  const ctx = fuente('lib/mako-context.ts');
  assert.match(ctx, /import \{ REGLA_NO_DESCALIFICAR \} from '\.\/no-existe';/);
  const lean = ctx.slice(ctx.indexOf('if (opts.lean) {'), ctx.indexOf('const [persona, perfil, faseNegocio'));
  assert.match(lean, /return `\$\{persona\}\\n\\n\$\{nucleo\}\\n\\n\$\{REGLA_NO_DESCALIFICAR\}`\.trim\(\);/, 'el modo lean (la red de WhatsApp) sin la regla');
  assert.match(ctx, /let base = `\$\{persona\}\\n\\n\$\{nucleo\}\\n\\n\$\{REGLA_NO_DESCALIFICAR\}`\.trim\(\);/, 'el system completo sin la regla');
  // Los chats que arman su system con buildSystemPrompt: la app, WhatsApp (y su red lean) y la ruta del doer.
  assert.match(fuente('lib/mako-turno-app.ts'), /const base = await buildSystemPrompt\(/);
  const doer = fuente('lib/mako-doer-in.ts');
  assert.match(doer, /const base = await runWithWorkspace\(wsData, \(\) => buildSystemPrompt\(/);
  assert.match(doer, /const baseRed = await runWithWorkspace\(wsData, \(\) => buildSystemPrompt\(\{[^}]*lean: true \}\)\);/);
  assert.match(fuente('app/api/mako-doer/route.ts'), /const base = await buildSystemPrompt\(/);
  // El asesor de WhatsApp (una caja de chat con el dueño) arma su system aparte, con la misma persona y el mismo núcleo.
  assert.match(fuente('lib/whatsapp-advisor.ts'), /let out = `\$\{persona\}\\n\\n\$\{nucleo\}\\n\\n\$\{REGLA_NO_DESCALIFICAR\}\\n\\n\$\{system\}`\.trim\(\);/,
    'el asesor de WhatsApp sin la regla');
});

test('3. la pregunta de cumpleaños: lo que recibió Leila descalifica; contestar y proponer, no', () => {
  assert.equal(descalificaElPedido('Eso es una distracción total. Enfócate en cerrar las ventas de este mes.'), true, LA_DE_LEILA);
  for (const mala of [
    'Mira, te voy a ser directo: eso es perder el tiempo ahora.',
    'Los cumpleaños no son prioridad: primero la oferta.',
    'Eso no importa todavía, lo que importa es convertir.',
    'Honestamente, es irrelevante para tu fase.',
  ]) assert.equal(descalificaElPedido(mala), true, `«${mala}» no se detecta`);
  const buena = [
    'Hoy MaKo no guarda la fecha de cumpleaños de tus clientes, así que no tenemos ese registro.',
    'Lo puedes empezar con un campo en el formulario de alta o preguntándolo por WhatsApp al cerrar la venta.',
    'Se lo pasé al equipo de MaKo como pedido (#412).',
  ].join('\n\n');
  assert.equal(descalificaElPedido(buena), false, 'una respuesta que contesta y propone no descalifica');
});

// ── Probado rompiéndolo (27/10/2026) ─────────────────────────────────────────────────────────────────────────────────
// Cada cambio a mano, corrido y restaurado:
//   1. la regla sin la línea de «distracción»                          → rojo el 1.
//   2. el modo lean sin la regla (la red de WhatsApp)                   → rojo el 2.
//   3. el system completo sin la regla                                  → rojo el 2.
//   4. el detector sin «distracción»                                    → rojo el 3.
//   5. el asesor de WhatsApp sin la regla                               → rojo el 2.
