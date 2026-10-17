// =============================================================================
// #854: «Calificado» se pinta al tocarlo y el aviso a Meta va de fondo (17/10/2026)
// =============================================================================
// En la llamada del 16/10, marcar «Calificado» dejaba el botón gris uno o dos segundos: la ficha pintaba desde lo
// que volvía del server, y el server (`updateLead`) esperaba los DOS envíos a Meta en serie antes de contestar.
// Lo que se fija:
//   1. el envío a Meta sale en `after()`, con el workspace capturado (sin él, el píxel y el historial serían de
//      otro), y fuera de un request corre en línea;
//   2. lo que Meta rechaza sigue yendo al historial del lead, ahora desde el fondo;
//   3. los dos controles de sí / no (el chip y los tres botones del Resumen) dibujan lo elegido EN EL ACTO;
//   4. si el guardado falla, vuelven a lo de antes; cuando la ficha relee, manda el server.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · `updateLead` esperando a Meta otra vez (`await avisarAMeta()` en vez de `after`)   → 3 / 1
//   · el envío de fondo sin `runWithWorkspace`                                             → 3 / 1
//   · los tres botones pintando desde la prop (`valor === o.v`)                            → 3 / 1
//   · el guardado que falla sin volver atrás (sin `alFallar?.()`)                          → 3 / 1
// Correr: node --import tsx --test tests/calificado-al-instante.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
function bloque(src: string, abre: string, cierra: string): string {
  const i = src.indexOf(abre);
  assert.notEqual(i, -1, `no aparece: ${abre}`);
  const j = src.indexOf(cierra, i + abre.length);
  assert.notEqual(j, -1, `no aparece: ${cierra}`);
  return src.slice(i, j);
}

test('el aviso a Meta de «calificado» sale de fondo, en el workspace del lead', () => {
  const calif = bloque(leer('lib/leads.ts'), 'if (fireCalificado) {', '// Auto-etiqueta de WhatsApp');
  const cierre = /\n {4}if \(ws == null\) await avisarAMeta\(\);\n {4}else try \{ after\(\(\) => runWithWorkspace\(ws, avisarAMeta\)\); \} catch \{ await runWithWorkspace\(ws, avisarAMeta\); \}\n {2}\}\n\s*$/;
  assert.match(calif, cierre, 'el guardado vuelve a esperar a Meta, o el fondo corre sin su workspace');
  // Todo envío vive ADENTRO del trabajo de fondo: ninguno queda en el camino del guardado.
  const trabajo = bloque(calif, 'const avisarAMeta = async () => {', '\n    };\n');
  assert.equal((calif.match(/sendMetaCAPIEvent\(/g) ?? []).length, 1);
  assert.match(trabajo, /await sendMetaCAPIEvent\(/);
  assert.match(trabajo, /await logLeadEvent\(id, 'Meta'/, 'lo que Meta rechaza tiene que seguir llegando al historial');
  assert.match(calif, /const ws = await getWorkspaceActual\(\);/);
});

test('los dos controles de sí / no pintan lo elegido en el acto', () => {
  const src = leer('app/crm/lead-view/CampoEditable.tsx');
  const hook = bloque(src, 'function useTriAlInstante(', '\n}\n');
  assert.match(hook, /const visto = pintado \? pintado\.v : valor;/);
  assert.match(hook, /setPintado\(\{ v \}\);\n {4}guardar\(v, visto, \(\) => setPintado\(null\)\);/, 'se pinta DESPUÉS de guardar, o no vuelve atrás');
  assert.match(hook, /useEffect\(\(\) => \{ setPintado\(null\); \}, \[valor\]\);/, 'cuando la ficha relee, manda el server');
  const botones = bloque(src, 'export function TriBotones(', '\n}\n');
  assert.match(botones, /useTriAlInstante\(leadId, campo, valor\)/);
  assert.match(botones, /aria-pressed=\{visto === o\.v\}/, 'los tres botones pintan desde la prop: esperan al server');
  const chip = bloque(src, 'export function TriEditable(', '\n}\n');
  assert.match(chip, /useTriAlInstante\(leadId, campo, valor\)/);
  assert.match(chip, /<ChipTri valor=\{visto\} si=\{si\} no=\{no\} \/>\n {8}<\/button>/);
});

test('si el guardado falla, vuelve a lo de antes y lo dice', () => {
  const guardar = bloque(leer('app/crm/lead-view/CampoEditable.tsx'), 'export function useGuardarCampo(', '\n}\n');
  assert.match(guardar, /\} catch \(e\) \{\n {8}alFallar\?\.\(\);\n {8}show\(e instanceof Error \? e\.message : 'No se pudo guardar', undefined, 'bad'\);/);
});

test('el bloqueado sigue sin pintar nada: lo que el server descartaría no se ofrece', () => {
  const chip = bloque(leer('app/crm/lead-view/CampoEditable.tsx'), 'export function TriEditable(', '\n}\n');
  assert.match(chip, /if \(bloqueado\) return <ChipTri valor=\{valor\} si=\{si\} no=\{no\} \/>;/);
});
