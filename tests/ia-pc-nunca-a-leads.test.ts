// =============================================================================
// La computadora del cliente NUNCA atiende leads sola (22/10/2026, Martín)
// =============================================================================
// Martín, al preguntarle por los términos de Anthropic sobre la suscripción en la PC del cliente (D6a): «No por ahora». La
// computadora del cliente se usa SÓLO para que cada dueño trabaje con SU Claude, desde la app. NUNCA para atender leads solos,
// las 24 horas: ni las respuestas automáticas de WhatsApp, ni los AI Steps de Automations, ni nada que corra solo hacia un
// lead. Ésos van por clave de API, o por el crédito donde está asignado (lib/credito-negocio.ts).
//
// Medido el 23/10/2026: un solo lugar crea turnos de PC (`encolarTurno`, lib/ia-pc.ts), lo llama un solo lugar (`turnoApp`,
// lib/mako-turno-app.ts), y a `turnoApp` lo llaman sólo cuatro entradas con la sesión de una persona adentro. Lo que fija:
//   1. a la PC (`encolarTurno`, `esperarALaPc`, un insert en `ia_pc_turnos`) llega sólo lib/mako-turno-app.ts;
//   2. `turnoApp` lo llaman sólo esas cuatro, cada una con la sesión de la persona;
//   3. ninguna de ellas es un cron, un webhook, WhatsApp ni Automations.
// Si necesitás otra entrada: que sea una PERSONA en la app, y sumala acá con su porqué. Si corre sola, NO va a la PC.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const sinComentarios = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
function archivos(dir: string): string[] {
  const out: string[] = [];
  for (const n of readdirSync(dir)) {
    if (n === 'node_modules' || n.startsWith('.')) continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) out.push(...archivos(p));
    else if (/\.(ts|tsx|mts|mjs|js)$/.test(n)) out.push(p);
  }
  return out;
}
let cache: Array<{ ruta: string; src: string }> | null = null;
const codigo = () => (cache ??= ['app', 'lib', 'scripts'].flatMap((d) => archivos(join(RAIZ, d)))
  .map((p) => ({ ruta: relative(RAIZ, p).replace(/\\/g, '/'), src: sinComentarios(readFileSync(p, 'utf8')) })));

const ENTRADAS_DE_PERSONA: Record<string, RegExp> = {
  // El chat de la app (Ops Center, Second Brain) y el del teléfono: la persona de la sesión.
  'app/api/mako/chat/route.ts': /personaDelRequest\(\)/,
  'app/api/m/mako/route.ts': /personaDelRequest\(\)/,
  // El chat de MaKo en el CRM y el de la ficha del lead: la sesión ADENTRO, con el permiso de ver el CRM.
  'app/crm/mako-crm/chat-server.ts': /getUsuarioActual\(\)/,
  'lib/mako-analyst-lead.ts': /getUsuarioActual\(\)/,
  // La prueba de punta a punta que se corre A MANO (nadie la programa) y sólo en el ws3, el cliente de prueba.
  'scripts/ia-pc/probar-punta-a-punta.mts': /if \(WS !== 3\) \{ console\.error\('⛔ sólo en el ws3/,
};

test('1. a la computadora del cliente llega sólo el turno del chat de la app', () => {
  const tocan = codigo()
    .filter((f) => f.ruta !== 'lib/ia-pc.ts')
    .filter((f) => /\bencolarTurno\b|\besperarALaPc\b|from\(['"]ia_pc_turnos['"]\)\s*\.\s*(insert|upsert)/.test(f.src))
    .map((f) => f.ruta);
  assert.deepEqual(tocan, ['lib/mako-turno-app.ts'], 'otra entrada manda turnos a la PC del cliente: si corre sola hacia un lead, no puede');
  // Y en lib/ia-pc.ts, el único insert de turnos es el de `encolarTurno`.
  const ia = codigo().find((f) => f.ruta === 'lib/ia-pc.ts')!.src;
  assert.equal((ia.match(/from\('ia_pc_turnos'\)\s*\.\s*insert/g) ?? []).length, 1);
});

test('2. `turnoApp` lo llaman sólo las entradas con la sesión de una persona', () => {
  const llaman = codigo()
    .filter((f) => f.ruta !== 'lib/mako-turno-app.ts' && /\bturnoApp\s*\(/.test(f.src))
    .map((f) => f.ruta).sort();
  assert.deepEqual(llaman, Object.keys(ENTRADAS_DE_PERSONA).sort(), 'una entrada nueva llama al turno que usa la PC');
  for (const [ruta, sesion] of Object.entries(ENTRADAS_DE_PERSONA)) {
    assert.match(codigo().find((f) => f.ruta === ruta)!.src, sesion, `${ruta} sin la sesión de la persona`);
  }
});

test('3. ninguna es un cron, un webhook, WhatsApp ni Automations', () => {
  for (const ruta of ['lib/mako-turno-app.ts', ...Object.keys(ENTRADAS_DE_PERSONA)]) {
    assert.doesNotMatch(ruta, /cron|webhook|whatsapp|evolution|automat|chatbot|nutricion|ai-step|flujo/i, ruta);
  }
});
