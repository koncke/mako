// =============================================================================
// LA BARRA DE LA REVISIÓN: UN SOLO RESET, «AUTOCOMPLETAR» Y EL SALTO QUE REINICIA TODO (21/11/2026, Martín probando en el ws 3)
// =============================================================================
// Los pedidos 1, 2 y 5 de Martín (por el Cerebro), con «Ir a un paso» en el ws 3:
//   1. «prefiero quedarme simplemente con el botón de reset… el de reiniciar onboarding funciona mejor… que sea eso, pero que
//      simplemente diga reset». En la barra queda UN «RESET», que hace lo de «Reiniciar onboarding». El reset viejo (vacía 50+ tablas)
//      sale de la barra y va al menú «Acciones del negocio» de /admin/customers/<ws>, como «Borrar todos los datos», sólo en las
//      cuentas de prueba y con confirmación fuerte (escribir el nombre).
//   2. «Datos de Mauricio» sale. En los negocios de prueba va «Autocompletar»: la respuesta de ejemplo de la pregunta de ahora, desde la
//      barra. El chat queda IGUAL que el de un cliente (sin la fila «Revisión · respuesta de ejemplo»).
//   5. «Ir a un paso» reinicia el recorrido entero: borra lo visto de los tutoriales y de la llegada en la base y en el navegador de
//      quien mira, y cierra cualquier video flotante (en su captura quedó el «Hola de nuevo» en la esquina, en el día 1).
//
// ⚠️ PROBADO ROMPIÉNDOLO: ver al pie.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EJEMPLOS_DE_REVISION, respuestaDeEjemplo } from '../lib/onboarding-v2/saltar';

const fuente = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. la barra: UN «RESET», que reinicia el onboarding sin borrar lo suyo; el que vacía todo ya no está ahí', () => {
  const barra = sinComentarios(fuente('app/_components/ImpersonationBanner.tsx'));
  assert.match(barra, /<ReiniciarOnboarding cliente=\{cliente\} \/>/);
  const b = sinComentarios(fuente('app/_components/ReiniciarOnboarding.tsx'));
  assert.match(b, />\n\s*Reset\n\s*<\/button>/, 'el botón dice «Reset» (en mayúsculas por el estilo de la barra)');
  assert.match(b, /fetch\('\/api\/admin\/reiniciar-onboarding'/, 'y hace lo de «Reiniciar onboarding»');
  assert.equal((barra.match(/>\s*Reset\s*</gi) ?? []).length, 0, 'la barra no dibuja otro «Reset» propio');
  const panel = sinComentarios(fuente('app/_components/PanelAgencia.tsx'));
  assert.doesNotMatch(panel, /action: 'reset'/, 'el borrado total salió de la barra');
  assert.doesNotMatch(panel, />\s*Reset\s*</);
  assert.doesNotMatch(panel, /Datos de Mauricio/, '«Datos de Mauricio» salió de la barra');
});

test('1b. el borrado total, en «Acciones del negocio» de /admin/customers/<ws>: sólo en las de prueba y escribiendo el nombre', () => {
  const h = sinComentarios(fuente('app/admin/_polar/web/Customer/CustomerPage/CustomerHeader.tsx'));
  assert.match(h, /const dePrueba = esClienteDePrueba\(negocio\.ws\)/);
  assert.match(h, /\{dePrueba && \(\n\s*<DropdownMenuItem destructive onClick=\{showBorrarDatosModal\}>\n\s*Borrar todos los datos\n\s*<\/DropdownMenuItem>/, 'sólo en las cuentas de prueba');
  assert.match(h, /<ConfirmModal\n\s*isShown=\{isBorrarDatosModalShown\}[\s\S]{0,900}confirmPrompt=\{negocio\.nombre\}[\s\S]{0,200}destructive\n/, 'confirmación fuerte: escribir el nombre');
  assert.match(h, /fetch\(conWs\('\/api\/admin\/negocio-de-prueba', negocio\.ws\), \{[\s\S]{0,200}JSON\.stringify\(\{ action: 'borrar' \}\)/, 'contra ESE negocio');
  // Quién puede, lo sigue diciendo el server: super admin y sólo un negocio de prueba (la lista blanca, nunca «distinto del dueño»).
  // Desde el 21/11, por su ruta: «Datos de Mauricio» se borró (tests/sin-datos-de-mauricio.test.ts).
  const api = sinComentarios(fuente('app/api/admin/negocio-de-prueba/route.ts'));
  assert.match(api, /if \(ws == null \|\| !esClienteDePrueba\(ws\)\) return null;/);
});

test('2. «Autocompletar»: la respuesta de ejemplo de la pregunta de ahora, para cada pregunta que la tiene', () => {
  const E = EJEMPLOS_DE_REVISION;
  assert.deepEqual(respuestaDeEjemplo({ etapa: 'nombre', opciones: null, varias: 0 }), { cuerpo: { texto: E.nombre }, mostrar: E.nombre });
  assert.deepEqual(respuestaDeEjemplo({ etapa: 'negocio', opciones: null, varias: 0 }), { cuerpo: { texto: E.negocio }, mostrar: E.negocio });
  const origenes = ['Un anuncio', E.origen, 'Google'];
  assert.deepEqual(respuestaDeEjemplo({ etapa: 'origen', opciones: origenes, varias: 0 }), { cuerpo: { opcion: 1, opcionTexto: E.origen }, mostrar: E.origen }, 'la opción, como el toque');
  const intereses = ['Armar mi landing', 'Ordenar mis ventas en un CRM', 'Que WhatsApp e Instagram respondan solos'];
  assert.deepEqual(respuestaDeEjemplo({ etapa: 'interes', opciones: intereses, varias: 3 }), { cuerpo: { opciones: [...E.intereses] }, mostrar: E.intereses.join(' · ') });
  assert.deepEqual(respuestaDeEjemplo({ etapa: 'agendado', opciones: ['Sí', 'No'], varias: 0 }), { cuerpo: { opcion: 0, opcionTexto: 'Sí' }, mostrar: 'Sí' });
  assert.equal(respuestaDeEjemplo({ etapa: 'telefono', opciones: null, varias: 0 }), null, 'el WhatsApp no se inventa: tiene su propio camino');
  assert.equal(respuestaDeEjemplo({ etapa: 'codigo', opciones: null, varias: 0 }), null);
  assert.equal(respuestaDeEjemplo({ etapa: 'listo', opciones: null, varias: 0 }), null);
});

test('2b. «Autocompletar» va en la barra, sólo si el chat lo ofrece; el chat lo ofrece sólo con la puerta de la revisión, y queda como el de un cliente', () => {
  const barra = sinComentarios(fuente('app/_components/ImpersonationBanner.tsx'));
  assert.match(barra, /<Autocompletar \/>/);
  const a = sinComentarios(fuente('app/_components/Autocompletar.tsx'));
  assert.match(a, /const hacer = useAutocompletar\(\);\n\s*if \(!hacer\) return null;/, 'sin el chat de la revisión, no se dibuja');
  const c = sinComentarios(fuente('app/onboarding/ChatArranqueV2.tsx'));
  assert.match(c, /if \(!ejemplos\) return;\n[\s\S]{0,400}ponerAutocompletar\(/, 'sólo con `ejemplos` (la puerta, la decide la página)');
  assert.match(c, /return \(\) => ponerAutocompletar\(null\);/, 'al irse, se apaga');
  assert.doesNotMatch(c, /arr-v2__ejemplos|Revisión · respuesta de ejemplo/, 'el chat, igual que el de un cliente');
  const p = sinComentarios(fuente('app/onboarding/page.tsx'));
  assert.match(p, /<ChatArranqueV2 [^>]*ejemplos=\{puedeVerLaRevision\(\{ ws, admin: adminDeMaKo \}\)\} \/>/, 'la puerta, en el server');
});

test('5. «Ir a un paso» reinicia el recorrido entero: la base, el navegador de quien mira y el video que flotaba', () => {
  const srv = sinComentarios(fuente('lib/onboarding-v2/saltar-server.ts'));
  assert.match(srv, /export async function saltarAlPaso\([^)]*\): Promise<Salto> \{\n\s*const \{ resultado \} = await reiniciarOnboarding\(ws, \{ aplicar: true \}\);/, 'primero, lo de «Reiniciar onboarding» en la base');
  const reglas = fuente('lib/reiniciar-onboarding.ts');
  assert.match(reglas, /export const PREFIJO_TUTORIAL = 'tutorial-';/, 'lo visto de los tutoriales (la llegada es el del Ops Center)');
  assert.match(fuente('lib/onboarding-v2/llegada.ts'), /export const ID_RECORRIDO = 'tutorial-ops-center';/);
  const nav = fuente('lib/reinicio-en-el-navegador.ts');
  for (const p of ['tutorial-', 'mk-llegada-mostrada', 'mk-entrada', 'mk-dale-play', 'mako\\.reto\\.']) assert.ok(nav.includes(p), `el navegador olvida «${p}»`);
  const s = sinComentarios(fuente('app/_components/SaltarAPaso.tsx'));
  const iCierra = s.indexOf('cerrarTutorial();');
  const iLimpia = s.indexOf('limpiarClavesDelOnboarding([window.localStorage, window.sessionStorage]);');
  const iVa = s.indexOf('window.location.assign(conWs(j.destino, ws));');
  assert.ok(iCierra > 0 && iCierra < iVa, 'cierra el tutorial y el video flotante antes de ir');
  assert.ok(iLimpia > 0 && iLimpia < iVa, 'limpia el navegador de quien mira antes de ir');
  assert.match(s, /import \{ cerrarTutorial[^}]*\} from '@\/app\/_ui\/tutorial\/store';/);
  assert.match(s, /if \(j\.avisos\?\.length\)/, 'lo que no pudo dejar listo (el recorrido sin ver) se dice, no se traga');
});

// ─────────────────────────────────────────────────────────────────────────────
// PROBADO ROMPIÉNDOLO (21/11/2026), de a una rotura, y cada una cae:
//   · el botón de la barra con «Reiniciar onboarding»                          → 1
//   · el reset viejo de vuelta en la barra (PanelAgencia con action 'reset')    → 1
//   · «Borrar todos los datos» sin `dePrueba`                                    → 1b
//   · sin escribir el nombre (sin confirmPrompt)                                 → 1b
//   · el origen como texto en vez de la opción                                   → 2
//   · el chat ofrece «Autocompletar» sin la puerta                               → 2b
//   · la fila de ejemplos de vuelta en el chat                                    → 2b
//   · el salto sin cerrar el video flotante                                      → 5
// ─────────────────────────────────────────────────────────────────────────────
