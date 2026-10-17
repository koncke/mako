// =============================================================================
// El «⋯» de la ficha y «Editar» con MaKo (17/10/2026, punto 10 del feedback del CRM del 16/10)
// =============================================================================
// Martín: «"Editar" en azul + "⋯" como el Dashboard... exportar la hoja del lead, compartir, el tutorial de cómo editar
// y "AI Analyst"... Al momento de EDITAR, también debería salir automáticamente este modal, pero ahora ya no para
// analizar al lead, sino para editar la vista». Lo que se fija:
//   1. EDITAR ABRE EL CHAT EN MODO EDICIÓN, y el turno trae las herramientas de la ficha. Se EJECUTA el selector de
//      herramientas del chat de la app (`herramientasDelChat`, el mismo del turno) con pedidos de edición: SOLOS no
//      traen `cambiar_ficha_funnel` (medido el 17/10: «capturar», o afuera del presupuesto); con la pista que antepone
//      la pantalla, todos la traen;
//   2. lo que llega de la pantalla se sanea (sólo una tab o una hoja propia; un nombre corto), el CRM sale del lead
//      (server), y el contexto dice qué se edita;
//   3. el «⋯» tiene «Exportar (PDF)» y, para quien edita, «Guía de edición»; cada paso de la guía tiene dónde apuntar.
//
// PROBADO ROMPIÉNDOLO (17/10/2026), con el archivo en 5 / 0, una rotura por vez y restaurada:
//   · la pista como sufijo en vez de prefijo («hazla épica» vuelve a «capturar»)                 → 4 / 1
//   · el turno del lead sin pasar la pista                                                        → 4 / 1
//   · `edicionDe` aceptando cualquier clave de tab                                                → 4 / 1
//   · el CRM del contexto tomado de la pantalla (`edicion.embudoId`) en vez del lead              → 4 / 1
//   · «Editar» sin abrir el panel de edición                                                      → 4 / 1
//   · un paso de la guía sin su `data-recorrido` en la pantalla (sin «fb-templates»)              → 4 / 1
// Correr: node --import tsx --test tests/ficha-editar-con-mako.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { clasificarIntencion } from '../lib/mako-intencion';
import { herramientasDelChat } from '../lib/mako-turno-app-reglas';
import { contextoDeEdicion, edicionDe, PISTA_EDICION_FICHA } from '../lib/mako-analyst-lead-reglas';
import { PASOS_FICHA_EDICION } from '../app/crm/lead-view/ficha/recorrido-ficha';
import type { Vista } from '../lib/api-mako/tipos';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/^[ \t]*\/\/.*$/gm, '').replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, '');

/** Los nombres de las herramientas de siempre: viven en módulos `server-only` (el molde de tests/mako-turno-app.test.ts). */
function nombresDeSiempre(): string[] {
  const url = (rel: string) => JSON.stringify(pathToFileURL(join(RAIZ, rel)).href);
  const codigo = `import { MAKO_TOOLS } from ${url('lib/mako-tools.ts')}; import { MAKO_ACCION_TOOLS } from ${url('lib/mako-doer-acciones.ts')}; process.stdout.write(JSON.stringify([...MAKO_TOOLS, ...MAKO_ACCION_TOOLS].map((t) => t.name)));`;
  return JSON.parse(execFileSync(process.execPath, ['--conditions=react-server', '--import', 'tsx', '--input-type=module', '-e', codigo], {
    cwd: RAIZ, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
  })) as string[];
}
const DE_SIEMPRE = nombresDeSiempre().map((name) => ({ name }));
const VISTA: Vista = { canal: 'app', alcance: 'proponer', ws: 9, rol: 'admin', tabs: null };
const herramientas = (texto: string) => {
  const veredicto = clasificarIntencion(texto, {});
  return herramientasDelChat({ veredicto, texto, agendaAbierta: false, deSiempre: DE_SIEMPRE, vista: VISTA, hayPendientes: false }).tools.map((t) => t.name);
};
// Los pedidos medidos el 17/10/2026.
const PEDIDOS = ['pon las cuotas arriba de todo', 'hazla épica', 'saca el bloque de notas', 'agrega el bloque de visitas', '¿qué bloques puedo sumar?', 'cambia el nombre de esta hoja a Cierre'];

test('editando, el turno trae cambiar_ficha_funnel: la pista va ADELANTE del texto que se clasifica', () => {
  const solos = PEDIDOS.filter((m) => herramientas(m).includes('cambiar_ficha_funnel'));
  assert.ok(solos.length < PEDIDOS.length, 'sin la pista ya alcanzaba: este test no está midiendo nada');
  for (const m of PEDIDOS) assert.ok(herramientas(`${PISTA_EDICION_FICHA}${m}`).includes('cambiar_ficha_funnel'), `«${m}» editando no trae cambiar_ficha_funnel`);
  // El turno antepone la pista SÓLO al texto que se clasifica (no al que lee el modelo ni al que se guarda).
  const turno = sinComentarios(leer('lib/mako-turno-app.ts'));
  assert.match(turno, /const textoClasificar = `\$\{\(entrada\.pista \?\? ''\)\.slice\(0, 120\)\}\$\{adjuntos\.length \? textoMemoria : textoPersona\}`;/);
  const lead = sinComentarios(leer('lib/mako-analyst-lead.ts'));
  assert.match(lead, /pista: PISTA_EDICION_FICHA,/, 'el turno del lead no pasa la pista al editar');
});

test('lo que llega de la pantalla se sanea, y el CRM sale del lead, no de la pantalla', () => {
  assert.deepEqual(edicionDe({ tab: 'pagos', nombre: 'Cobranza' }), { tab: 'pagos', nombre: 'Cobranza' });
  assert.deepEqual(edicionDe({ tab: 'h-abc123', nombre: 'x'.repeat(80) })?.nombre.length, 40);
  for (const malo of [{ tab: 'cobranza' }, { tab: 'actividad' }, { tab: 'resumen; DROP' }, null, 'resumen', { tab: 3 }]) {
    assert.equal(edicionDe(malo), null, `pasó ${JSON.stringify(malo)}`);
  }
  const c = contextoDeEdicion({ tab: 'h-abc123', nombre: 'Cierre', embudoId: 30 });
  assert.match(c, /EDITANDO LA VISTA/);
  assert.match(c, /embudoId 30/);
  assert.match(c, /tab «h-abc123»/);
  assert.match(contextoDeEdicion({ tab: 'resumen', nombre: '', embudoId: null }), /CRM principal/);
  const lead = sinComentarios(leer('lib/mako-analyst-lead.ts'));
  assert.match(lead, /contextoDeEdicion\(\{ \.\.\.edicion, embudoId: a\.lead\.funnelId \}\)/, 'el CRM tiene que salir del lead');
  assert.match(lead, /funnelId: lead\.funnel_id \?\? null/);
  const ruta = sinComentarios(leer('app/api/crm/analyst/route.ts'));
  assert.match(ruta, /edicion: edicionDe\(edicion\)/, 'la ruta tiene que sanear lo que manda la pantalla');
});

test('«Editar» abre el chat de MaKo en modo edición, con la hoja abierta; salir lo cierra', () => {
  const ficha = sinComentarios(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'));
  assert.match(ficha, /setPanel\(\(p\) => \(entrar \? 'editar' : p === 'editar' \? null : p\)\);/);
  assert.match(ficha, /onClick=\{\(\) => alternarEdicion\(!editando\)\}/);
  assert.match(ficha, /<MakoAnalystLead leadId=\{lead\.id\} nombre=\{lead\.nombre \?\? ''\} edicion=\{edicion\} \/>/);
  assert.match(ficha, /onActiva=\{setActiva\}/, 'el chat necesita saber en qué hoja se está');
  const chat = sinComentarios(leer('app/crm/lead-view/MakoAnalystLead.tsx'));
  assert.match(chat, /\.\.\.\(edicion \? \{ edicion \} : \{\}\)/, 'el mensaje sin la hoja que se edita');
  assert.match(chat, /if \(edicion\) fd\.append\('edicion', JSON\.stringify\(edicion\)\);/, 'con un archivo, también');
});

test('el «⋯»: «Exportar (PDF)» imprime la ficha como se ve, y la guía de edición tiene dónde apuntar', () => {
  const ficha = sinComentarios(leer('app/crm/lead-view/ficha/FichaPorBloques.tsx'));
  assert.match(ficha, /\{ value: 'pdf', label: 'Exportar \(PDF\)', icono: 'descargar' \}/);
  assert.match(ficha, /\.\.\.\(puede \? \[\{ value: 'guia', label: 'Guía de edición'/, 'la guía es de quien edita');
  assert.match(ficha, /closest<HTMLElement>\('\[data-ficha-ruta\], \[role="dialog"\]'\)/, 'se imprime la ficha, no la página de atrás');
  const imp = leer('app/crm/lead-view/ficha/imprimir-ficha.ts');
  assert.match(imp, /querySelectorAll\('link\[rel="stylesheet"\], style'\)/, 'la copia lleva las hojas de estilo de la página');
  assert.match(imp, /\.fb-personalizar, \.lt-hojas, \[aria-label="Más opciones de la ficha"\]/, 'los botones no salen en el papel');
  // Cada paso de la guía apunta a algo que la pantalla marca.
  const pantalla = ['app/crm/lead-view/ficha/FichaPorBloques.tsx', 'app/crm/lead-view/LeadTabs.tsx', 'app/crm/lead-view/ficha/Armador.tsx'].map(leer).join('\n');
  for (const p of PASOS_FICHA_EDICION) assert.ok(pantalla.includes(`data-recorrido="${p.objetivo}"`) || pantalla.includes(`'${p.objetivo}'`), `el paso «${p.titulo}» no tiene a qué apuntar (${p.objetivo})`);
  for (const p of PASOS_FICHA_EDICION) assert.doesNotMatch(`${p.titulo} ${p.texto}`, /\b(acá|vos|tenés|podés|elegí|arrastrá)\b/i, 'tuteo, nunca voseo');
});

test('la caja de edición dice qué se edita: sugerencias y placeholder propios', () => {
  const chat = sinComentarios(leer('app/crm/lead-view/MakoAnalystLead.tsx'));
  assert.match(chat, /\(edicion \? SUGERENCIAS_EDICION : SUGERENCIAS\)\.map/);
  assert.match(chat, /placeholder=\{edicion \? `Qué cambiar de \$\{edicion\.nombre \|\| 'esta hoja'\}` :/);
});
