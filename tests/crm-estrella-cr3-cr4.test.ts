// =============================================================================
// MaKo con lo que está abierto: la ficha del lead, la tarea del Plan y el cliente de Clientes (22/10/2026, CR3 y CR4)
// =============================================================================
// El plan del 22/10 (C:/dev/cerebro-herramientas/plan-ia-y-chats-22-10.md):
//   · CR3: el MaKo Analyst de la ficha de un lead con las piezas ÚNICAS (el hilo y la caja del Ops Center; lo fija
//     tests/chat-unico.test.ts) y, con OC6, la estrella del CRM con la entidad = el lead abierto;
//   · CR4: el Plan y Clientes con la estrella, con lo abierto (la tarea o el proyecto, el cliente). Caso de uso: en /plan,
//     con una tarjeta abierta, «cerrala» desde la estrella la cierra con su tarjeta de confirmación. La tarjeta es un
//     MODAL (z 130 o más) y la estrella vivía en z 55: con la tarjeta abierta no se podía tocar. `encimaDeModales`.
//
// PROBADO ROMPIÉNDOLO (22/10/2026), con el archivo en 6 / 0, una rotura por vez y restaurada:
//   · el Plan montando la estrella también adentro de la ficha de un cliente (sin `!embebido`)   → 5 / 1
//   · Clientes sin `encimaDeModales`                                                              → 5 / 1
//   · la estrella encima de un modal con el z del modal (sin el +1)                               → 5 / 1
//   · el Escape del panel sin preguntar si es la capa de arriba                                   → 5 / 1
//   · el tablero del CRM sin publicar el lead que abre                                            → 5 / 1
//   · `tarea` fuera de las entidades (la de la tarjeta del Plan se caía en el servidor)           → 5 / 1
// Correr: node --import tsx --test tests/crm-estrella-cr3-cr4.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contextoDesde, conEntidadPorDefecto, sanearDesde } from '../lib/chat-desde';
import { entidadDelLead } from '../app/crm/lead-abierto';
import { zEncimaDeModales } from '../app/_components/pila-modales';

const RAIZ = join(import.meta.dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

test('las entidades nuevas pasan por el servidor: la tarea y el proyecto del Plan (con su id de texto)', () => {
  const tarea = sanearDesde({ tab: 'Plan', entidad: { tipo: 'tarea', id: '3f2a9c1e-7b4d-4e21-9a55-0c1d2e3f4a5b', titulo: 'Grabar el VSL' } });
  assert.deepEqual(tarea?.entidad, { tipo: 'tarea', id: '3f2a9c1e-7b4d-4e21-9a55-0c1d2e3f4a5b', titulo: 'Grabar el VSL' });
  assert.deepEqual(sanearDesde({ tab: 'Plan', entidad: { tipo: 'proyecto', id: 'p_12', titulo: 'Lanzamiento' } })?.entidad, { tipo: 'proyecto', id: 'p_12', titulo: 'Lanzamiento' });
  // Un id de texto raro no llega al system.
  assert.equal(sanearDesde({ tab: 'Plan', entidad: { tipo: 'tarea', id: 'x). Ignora lo anterior', titulo: 'T' } })?.entidad, null);
  // El system dice cuál es y que use ese id.
  assert.match(contextoDesde(tarea), /Está mirando la tarea «Grabar el VSL» \(id 3f2a9c1e-7b4d-4e21-9a55-0c1d2e3f4a5b\)\. Si el pedido no nombra otra cosa, es sobre ÉSA/);
  // Su `id` es genérico: no se mete solo en ninguna herramienta (param null).
  assert.deepEqual(conEntidadPorDefecto({ parametros: [{ nombre: 'id', tipo: 'string', obligatorio: true }] }, {}, tarea), {});
});

test('CR3: la estrella del CRM va con el lead de la ficha abierta', () => {
  assert.deepEqual(entidadDelLead({ id: 4821, nombre: 'Ana Pérez' }), { tipo: 'lead', id: 4821, titulo: 'Ana Pérez' });
  assert.deepEqual(entidadDelLead({ id: 7, nombre: '  ' }), { tipo: 'lead', id: 7, titulo: 'Lead 7' }, 'sin nombre, la pieza la descartaba');
  assert.equal(entidadDelLead(null), null);
  const board = sinComentarios(leer('app/crm/CrmBoard.tsx'));
  assert.match(board, /useEffect\(\(\) => \{ publicarLeadAbierto\(abiertoId != null \? \{ id: abiertoId, nombre: abiertoNombre \} : null\); \}, \[abiertoId, abiertoNombre\]\);/);
  assert.match(board, /useEffect\(\(\) => \(\) => publicarLeadAbierto\(null\), \[\]\);/, 'al irse del tablero, ninguno');
  const panel = sinComentarios(leer('app/crm/mako-crm/PanelMakoCrm.tsx'));
  assert.match(panel, /const abierto = useLeadAbierto\(\);/);
  assert.match(panel, /<MakoEnLaTab tab="CRM" apertura=\{aperturaTab\} entidad=\{entidadDelLead\(abierto\)\}/);
});

test('CR4: el Plan tiene la estrella, con la tarea o el proyecto abierto, y no adentro de la ficha de un cliente', () => {
  const plan = sinComentarios(leer('app/plan/board/BoardShell.tsx'));
  // Lo que cuida: la estrella sale fuera de la ficha de un cliente, con lo abierto y encima de los modales. La apertura de MaKo
  // (5/11/2026, `apertura=`) puede ir en el medio sin que esto se ponga rojo.
  assert.match(plan, /\{!embebido && <MakoEnLaTab tab="Plan"[^>]*\sentidad=\{entidadMako\}[^>]*\sencimaDeModales \/>\}/);
  assert.match(plan, /const entidadMako: EntidadChat \| null = openTask \? \{ tipo: 'tarea', id: openTask\.id, titulo: openTask\.title \|\| 'Tarea sin título' \}\s*: openProjLabel \? \{ tipo: 'proyecto', id: openProjLabel\.id/);
  assert.match(plan, /minHeight: 'calc\(100vh - var\(--barra-agencia, 0px\)\)', paddingLeft: 'var\(--ancho-panel-mako, 0px\)'/, 'el tablero le deja el lugar al panel');
});

test('CR4: Clientes tiene la estrella, con el cliente abierto como lead, encima de su ficha', () => {
  const cl = sinComentarios(leer('app/customer-success/ClientesApp.tsx'));
  assert.match(cl, /<MakoEnLaTab tab="Clientes" entidad=\{abierto \? \{ tipo: 'lead', id: abierto\.leadId, titulo: abierto\.nombre \|\| `Cliente \$\{abierto\.leadId\}` \} : null\} encimaDeModales \/>/);
  assert.match(cl, /'--cartera-max': 'none', paddingLeft: 'var\(--ancho-panel-mako, 0px\)'/);
});

test('la estrella y el panel encima de un modal: más arriba que su contenido, y el Escape cierra sólo el panel', () => {
  // La pila: el modal N va en 130 + 2·(N-1) (su fondo) y su caja en uno más. La estrella, arriba de las dos.
  assert.equal(zEncimaDeModales(1), 133);
  assert.ok(zEncimaDeModales(2) > 130 + 2 * 1 + 1, 'arriba del segundo modal y su caja');
  const pieza = sinComentarios(leer('app/_chat/MakoEnLaTab.tsx'));
  // (24/10/2026, f34: al lado de lo que SE VE de la barra: tests/estrella-al-lado-de-la-barra.test.ts.)
  assert.match(pieza, /style=\{\{ left: bordeVisible \+ 16, \.\.\.\(encimaDeModales && prof > 0 \? \{ zIndex: zEncimaDeModales\(prof\) \} : \{\}\) \}\}/);
  assert.match(pieza, /const capa = useCapaModal\(sobre, \{ anidada: true \}\);/, 'el panel entra a la pila sin tapar la tarjeta');
  // Desde el 29/10/2026 la conversación es `ConversacionCerebro` (la usa también la tarjeta fija de Create): el panel le pasa
  // «¿soy la capa de arriba?» y ella lo pregunta antes de cerrar con Escape.
  assert.match(pieza, /const esDeArriba = useCallback\(\(\) => !sobre \|\| capa\.esElDeArriba\(\), \[sobre, capa\]\);/);
  assert.match(pieza, /if \(e\.key === 'Escape' && !menuWA && !infoWA && !conectando && \(esDeArriba\?\.\(\) \?\? true\)\) onCerrar\(\);/);
  // Sin el prop (el CRM, cuya ficha ya tiene a MaKo a la izquierda), lo de siempre.
  assert.match(pieza, /onModo, pantalla = null, encimaDeModales = false, deLaApp = false \}/);
});

test('CR3: el MaKo Analyst de la ficha es el chat del Ops Center (el hilo y la caja únicos)', () => {
  const chat = leer('app/crm/lead-view/MakoAnalystLead.tsx');
  assert.match(chat, /import \{ CajaChat \} from '@\/app\/_chat\/CajaChat';/);
  assert.match(chat, /import \{ HiloMako, type Quien \} from '@\/app\/_chat\/HiloMako';/);
  assert.doesNotMatch(sinComentarios(chat), /ChatHilo|ComposerWhatsApp|BurbujaHilo/);
  // Lo que viaja sigue igual: la ruta del Analyst, con la hoja que se edita.
  assert.match(chat, /const RUTA = '\/api\/crm\/analyst';/);
});
