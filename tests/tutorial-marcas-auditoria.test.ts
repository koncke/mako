// =============================================================================
// LAS MARCAS QUE FALTABAN EN LA PÁGINA (20/11/2026, la auditoría de las pausas del Cerebro)
// =============================================================================
// Cada una era un lugar donde la voz del tutorial dice «toca aquí» y la página no tenía la marca: con el motor viejo el video se
// congelaba 4 s; con el nuevo (app/_ui/tutorial/pausas.ts) se saltea, pero la marca tiene que estar donde la voz la nombra.
//   · recorrido-6: la flecha de volver del Second Brain no existía en la computadora (el Grafo la dibuja sólo con `alCerrar`, y el
//     mapa de escritorio lo arma el servidor, que no pasa funciones);
//   · plan-4: las prioridades del Plan del teléfono no llevaban `data-prioridad`;
//   · classroom-clients-5: «Cargar un cliente» sólo estaba marcado en la checklist (sin clientes, o con clientes, no está);
//   · ticketera-5: el «?» de la Ticketera abría el video del Ops Center (la ruta del tutorial elegía sin la consulta).
// Y dos de la auditoría del onboarding (OD): el recorrido dice «Haz clic en Second Brain» y «Haz clic en la flecha» (OD-10), y el
// recorrido viejo de tarjetas no se abre solo donde el motor ya corre el video de la pestaña (OD-F4).
// Probado rompiéndolo (20/11/2026, una rotura por vez y restaurada): seis roturas, y cada una tumba su test (1 a 6).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tutorialDeRuta } from '../lib/tutoriales';
import { MARCA } from '../lib/tutoriales/marcas';

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

test('1. recorrido-6: la flecha de volver del Second Brain también en la computadora (el volver del contexto)', () => {
  const v = sinComentarios(leer('app/second-brain/VistaCerebro.tsx'));
  assert.match(v, /const atras = alCerrar \?\? volver \?\? undefined;/);
  assert.match(v, /<Grafo[\s\S]*?alCerrar=\{atras\}/);
  assert.doesNotMatch(v, /sb-cab__volver/, 'una sola flecha: la del grafo');
  assert.match(leer('app/second-brain/Grafo.tsx'), /\{alCerrar && \(\n\s*<button type="button" className="cbg-ico cbg-atras" onClick=\{alCerrar\}[^>]*data-recorrido="sb-brain-volver">/);
});

test('2. plan-4: cada prioridad del Plan del teléfono lleva `data-prioridad`, como la de la computadora', () => {
  assert.match(sinComentarios(leer('app/m/plan/ListaPlan.tsx')), /<div className="m-plan-item" data-estado=\{estado\} data-prioridad=\{item\.id\}>/);
  assert.match(leer('app/plan/board/BoardShell.tsx'), /data-prioridad=\{t\.id\}/);
});

test('3. classroom-clients-5: «Cargar un cliente» marcado también en el vacío y en la tabla', () => {
  const e = sinComentarios(leer('app/_ui/Estados.tsx'));
  assert.match(e, /type Accion = \{ label: string; onClick\?: \(\) => void; href\?: string; marca\?: string \};/);
  assert.match(e, /<Button size="sm" variant=\{variant\} onClick=\{a\.onClick\} data-recorrido=\{a\.marca\}>/);
  assert.match(leer('app/customer-success/ClientesApp.tsx'), /accion=\{\{ label: 'Cargar un cliente', onClick: \(\) => setCreando\(''\), marca: MARCA\.classroomClientsCargar \}\}/);
  assert.match(leer('app/customer-success/TablaClientes.tsx'), /className="tc-nuevo" onClick=\{onNuevo\} data-recorrido=\{MARCA\.classroomClientsCargar\}>/);
  assert.equal(MARCA.classroomClientsCargar, 'tour-classroom-clients-cargar');
});

test('4. ticketera-5: el tutorial de la pestaña se elige con la consulta (la Ticketera vive en /second-brain?ticketera=tickets)', () => {
  assert.equal(tutorialDeRuta('/second-brain?ticketera=tickets')?.pestana, 'ticketera');
  assert.equal(tutorialDeRuta('/second-brain')?.pestana, 'ops-center');
  assert.equal(tutorialDeRuta('/second-brain?chat=3')?.pestana, 'ops-center', 'otra consulta: la pestaña de siempre');
  const m = sinComentarios(leer('app/_ui/tutorial/MotorTutorial.tsx'));
  assert.match(m, /const consulta = useSearchParams\(\)\?\.toString\(\) \?\? '';\n\s*const ruta = \(usePathname\(\) \?\? '\/'\) \+ \(consulta \? `\?\$\{consulta\}` : ''\);/);
  // useSearchParams en el layout: con su Suspense (si no, el build no prerenderiza las páginas estáticas).
  assert.match(m, /<Suspense fallback=\{null\}><TutorialDeLaRuta \/><\/Suspense>/);
});

test('5. OD-10: el recorrido dice «Haz clic en Second Brain» y «Haz clic en la flecha» (no «Haz clic en lo marcado»)', async () => {
  const { TUTORIAL_RECORRIDO } = await import('../lib/onboarding-v2/recorrido');
  const haz = (sel: string) => TUTORIAL_RECORRIDO.pasos.find((p) => p.sel === sel)?.haz;
  assert.equal(haz('[data-recorrido="sb-second-brain"]'), 'Haz clic en Second Brain');
  assert.equal(haz('[data-recorrido="sb-brain-volver"], button.cbg-atras'), 'Haz clic en la flecha');
});

test('6. OD-F4: un solo recorrido por pestaña: el viejo de tarjetas no se abre solo donde el motor ya corre el video', () => {
  const r = sinComentarios(leer('app/_ui/Recorrido.tsx'));
  assert.match(r, /import \{ motorSeOcupa \} from '\.\/tutorial\/store';/);
  assert.match(r, /const abierto = modo === 'abierto' \|\| \(modo === 'auto' && autoabrir && visto === false && \(delMotor \|\| typeof window === 'undefined' \|\| !motorSeOcupa\(window\.location\.pathname\)\)\);/);
  assert.match(r, /const delMotor = id\.startsWith\('tutorial-'\);/, 'el del motor (PrimeraVez) sí se abre');
});
