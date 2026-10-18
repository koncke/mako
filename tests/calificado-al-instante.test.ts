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
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 4 / 0, una rotura por vez y restaurada (desde los dos
// tests de #856 el archivo da 6 / 0, y cada rotura de éstas 5 / 1):
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
  // ⚠️ CAMBIADO A PROPÓSITO el 17/10/2026 (#856): el trabajo recibe si ESPERA la ventana del «Deshacer» (de fondo
  // sí; en línea, sin toast, no). Lo demás que se fija es lo mismo.
  const cierre = /\n {4}if \(ws == null\) await avisarAMeta\(false\);\n {4}else try \{ after\(\(\) => runWithWorkspace\(ws, \(\) => avisarAMeta\(true\)\)\); \} catch \{ await runWithWorkspace\(ws, \(\) => avisarAMeta\(false\)\); \}\n {2}\}\n\s*$/;
  assert.match(calif, cierre, 'el guardado vuelve a esperar a Meta, o el fondo corre sin su workspace');
  // Todo envío vive ADENTRO del trabajo de fondo: ninguno queda en el camino del guardado.
  const trabajo = bloque(calif, 'const avisarAMeta = async (esperar: boolean) => {', '\n    };\n');
  assert.equal((calif.match(/sendMetaCAPIEvent\(/g) ?? []).length, 1);
  assert.match(trabajo, /await sendMetaCAPIEvent\(/);
  assert.match(trabajo, /await logLeadEvent\(id, 'Meta'/, 'lo que Meta rechaza tiene que seguir llegando al historial');
  assert.match(calif, /const ws = await getWorkspaceActual\(\);/);
});

// #856 (17/10/2026): lo que llega a Meta no se corrige, así que el aviso ESPERA la ventana del «Deshacer», relee el
// lead y sale sólo si sigue calificado y si nunca se mandó.
// PROBADO ROMPIÉNDOLO, con el archivo en 6 / 0: `avisaCalificadoAMeta` sin mirar `yaSeMando` → 5 / 1 (el de la
// regla); sin el `setTimeout` de la espera → 5 / 1 (el del cableado); mandando con `merged` en vez del lead
// releído → 5 / 1 (el del cableado); sin la línea `LINEA_CALIFICADO_EN_META` al entrar → 5 / 1 (el del cableado).
test('#856: el aviso sale sólo si el lead SIGUE calificado al salir y nunca se mandó', async () => {
  const { avisaCalificadoAMeta, ESPERA_AVISO_CALIFICADO_MS } = await import('../lib/meta-capi-payload');
  assert.equal(avisaCalificadoAMeta({ sigueCalificado: true, yaSeMando: false }), true);
  assert.equal(avisaCalificadoAMeta({ sigueCalificado: false, yaSeMando: false }), false, 'lo deshicieron en la ventana');
  assert.equal(avisaCalificadoAMeta({ sigueCalificado: true, yaSeMando: true }), false, 'ya contó: volver a marcar no suma otra');
  assert.equal(avisaCalificadoAMeta({ sigueCalificado: null, yaSeMando: false }), false, 'sin poder releerlo no se afirma');
  // La espera cubre el toast del «Deshacer» (5 s, app/_ui/Toast.tsx).
  const toast = leer('app/_ui/Toast.tsx');
  const ms = Number(/export function useToast\(ms = (\d+)\)/.exec(toast)?.[1]);
  assert.ok(ms > 0 && ESPERA_AVISO_CALIFICADO_MS > ms, `la espera (${ESPERA_AVISO_CALIFICADO_MS}) no cubre el toast (${ms})`);
});

test('#856 CABLEADO: espera, relee, manda con lo releído y deja la marca de «ya se mandó»', () => {
  const calif = bloque(leer('lib/leads.ts'), 'if (fireCalificado) {', '// Auto-etiqueta de WhatsApp');
  const trabajo = bloque(calif, 'const avisarAMeta = async (esperar: boolean) => {', '\n    };\n');
  assert.match(trabajo, /if \(esperar\) await new Promise\(\(r\) => setTimeout\(r, ESPERA_AVISO_CALIFICADO_MS\)\);/);
  const iRelee = trabajo.indexOf('const hoy = await getLead(id)');
  const iManda = trabajo.indexOf('sendMetaCAPIEvent(');
  assert.ok(iRelee > 0 && iRelee < iManda, 'se manda sin releer el lead');
  assert.match(trabajo, /avisaCalificadoAMeta\(\{ sigueCalificado: hoy \? hoy\.calificado === true : null, yaSeMando: await calificadoYaEnMeta\(id\) \}\)/);
  assert.match(trabajo, /email: hoy!\.email,/, 'manda con la foto del guardado, no con el lead de ahora');
  assert.match(trabajo, /if \(entro\) await logLeadEvent\(id, 'Meta', LINEA_CALIFICADO_EN_META, 'MaKo'\);/);
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
