// =============================================================================
// Undécima tanda de Automations, la lista: Configuraciones sin filetes, una sola barra con el menú antes del
// buscador, y «Renombrar» en el «⋯» (puntos 1, 5 y 9; docs/diseno-undecima-tanda.md §2)
// =============================================================================
// Pedido de Martín (11/10/2026), textual:
//   1. «En configuraciones elimina el divider de abajo del título y más abajo hay 2 divider sueltos, eliminalos
//      también.»
//   5. «Quiero que en los 3 puntos exista la opción de renombrar.»
//   9. «Te pido que en la sidebar elimines la separación con "MaKo en WhatsApp" que sea todo una misma sidebar para
//      todo, sin dividir, para eso ya tenemos filtros. Y arriba también elimina la palabra "Chatbot"... Y que los
//      botones de "Configuraciones" y "Tutorial" estén en otro botón desplegable al inicio de la barra de busqueda,
//      es decir, antes de la barra de busqueda.»
//
// Lo que se puede EJECUTAR se ejecuta: `nombreParaGuardar`, la lista dibujada (renderToStaticMarkup), `Tabs` con y
// sin `sinLinea`, `opcionesDeFila`. Lo que vive en un archivo que arrastra `server-only` (ConfiguracionesBoton.tsx,
// lib/setting-secuencias.ts, la ruta) o en handlers y estado se fija en el FUENTE sin comentarios, recortado.
//
// PROBADO ROMPIÉNDOLO (11/10/2026), una rotura por vez con el arnés del scratchpad
// (wf-undecima/w1-lista-ui/romper.mjs: guarda el original en memoria, lo reescribe, corre ESTE archivo y lo
// restaura comprobando el sha1; nunca `git checkout`). Base: 8 pass / 0 fail. Cada una tumbó lo suyo (pass / fail):
//   R1 `nombreParaGuardar` escribe lo igual (sin comparar con el de antes)            → 7 / 1 (a)
//   R2 la lista vuelve a partirse (las de evento abajo, con su rótulo)                → 6 / 2 (b) y (c)
//   R3 `opcionesDeFila` sin «Renombrar»                                               → 7 / 1 (d)
//   R4 SecuenciaPerfil sin el re-sembrado del título                                  → 7 / 1 (e)
//   R5 el modal sin `sinFiletes`                                                      → 7 / 1 (f)
//   R6 `Tabs` ignora `sinLinea` (el borde de siempre)                                  → 7 / 1 (f)
//   R7 el menú sin su `data-recorrido`                                                → 7 / 1 (g)
//   R8 la ruta de `nombre` sin el 404 (un id ajeno o archivado vuelve a dar 500)       → 7 / 1 (h)
//   C3 el menú DESPUÉS del buscador                                                   → 7 / 1 (b)
//   C4 cambiar de pestaña DESMONTA Límites                                            → 7 / 1 (f)
//   N1 «Nueva» sin preguntar por lo no publicado                                      → 7 / 1 (c)
//   T2 el cartel vacío sin el menú                                                    → 7 / 1 (g)
// Restaurado: 8 / 0.
//
// Correr: node --import tsx --test tests/automations-undecima-ui.test.ts

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as Lista from '../app/automations/SimuladorWhatsApp';
import { SimuladorWhatsApp, opcionesDeFila, TOPE_NOMBRE } from '../app/automations/SimuladorWhatsApp';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';
import { Tabs } from '../app/_ui/Tabs';
import { esIconoMenu } from '../app/_ui/iconos-menu';
import { OBJETIVO_AYUDA } from '../app/automations/recorrido-automations';
import { nombreParaGuardar, nombreDeSecuencia, TOPE_NOMBRE_SECUENCIA } from '../lib/setting-estrategia';
import { TRIGGER_AVISO_MAKO } from '../lib/disparadores';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
// Las líneas PRIMERO y los bloques después (AGENTS.md: un `/*` dentro de un `//` se come el código).
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));
/** El tramo de `desde` hasta `hasta` (su cierre real), con su largo acotado: si mide más, está mirando otra cosa. */
function tramo(src: string, desde: string, hasta: string, tope = 3000): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré «${desde}»`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré «${hasta}» después de «${desde}»`);
  const t = src.slice(i, j);
  assert.ok(t.length < tope, `el tramo de «${desde}» mide ${t.length}`);
  return t;
}

const fila = (id: number, nombre: string, trigger_tipo: string) => ({
  id, clave: `c-${id}`, nombre, etapa: 'manual', trigger_tipo, activa: true, pasos: [], inscriptos: 0, enviados: 0,
  estrategia: null, metricas: {},
}) as unknown as SecuenciaDto;

const dibujar = (secuencias: SecuenciaDto[], extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(SimuladorWhatsApp, {
  secuencias, objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
  rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {},
  productos: [], disparadores: [], tz: null, ...extra,
} as Parameters<typeof SimuladorWhatsApp>[0]));

// ── (a) Lo que se guarda al renombrar ─────────────────────────────────────────────────────

test('(a) `nombreParaGuardar`: vacío o igual no escribe; junta espacios y recorta al tope', () => {
  assert.equal(nombreParaGuardar('Bienvenida', ''), null, 'vacío');
  assert.equal(nombreParaGuardar('Bienvenida', '   '), null, 'sólo espacios');
  assert.equal(nombreParaGuardar('Bienvenida', 'Bienvenida'), null, 'igual: sin cambio no escribe');
  assert.equal(nombreParaGuardar('Bienvenida', '  Bienvenida  '), null, 'igual con espacios alrededor');
  assert.equal(nombreParaGuardar('Agendó una reunión', 'Un Lead  Agendó   Llamada '), 'Un Lead Agendó Llamada');
  // El tope es el de la lib, y es el MISMO en la lista (un solo número).
  assert.equal(TOPE_NOMBRE_SECUENCIA, 40);
  assert.equal(TOPE_NOMBRE, TOPE_NOMBRE_SECUENCIA);
  const largo = 'x'.repeat(45);
  assert.equal(nombreParaGuardar('Corto', largo), 'x'.repeat(40));
  // Un nombre viejo de más de 40 no se reescribe porque alguien abrió el campo y apretó Enter sin tocarlo.
  assert.equal(nombreParaGuardar(largo, largo), null);
  assert.equal(nombreDeSecuencia('  a   b '), 'a b');
  // lib/setting-secuencias.ts lo re-exporta (lo importan la ruta y lib/flujo-ia-crear.ts).
  assert.match(fuente('lib/setting-secuencias.ts'), /^export \{ nombreDeSecuencia \};$/m);
});

// ── (b) y (c) Una sola lista, con el menú antes del buscador ───────────────────────────────

test('(b) la lista dibujada: una sola, en el orden del server, sin «Chatbot» ni «MaKo en WhatsApp», con el menú antes del buscador', () => {
  const secs = [fila(7, 'Bienvenida', 'etapa_actual'), fila(8, 'Cobranza de cuotas vencidas', TRIGGER_AVISO_MAKO), fila(9, 'Un Lead Agendó Llamada', 'etapa_actual')];
  const html = dibujar(secs, { menu: createElement('span', { 'data-prueba-menu': '' }, 'M') });
  assert.doesNotMatch(html, />Chatbot</, 'volvió la palabra «Chatbot»');
  assert.doesNotMatch(html, /data-grupo-mensajes-mako|data-grupo-chatbot|data-cabecera-chatbot|data-nuevo-mensaje/, 'volvió la división');
  assert.doesNotMatch(html, />MaKo en WhatsApp</);
  // Las tres en el orden de la lista (el del server), cada una con su «⋯».
  const pos = secs.map((j) => html.indexOf(`>${j.nombre}</span>`));
  assert.ok(pos.every((p) => p > 0), 'falta una fila');
  assert.deepEqual([...pos].sort((a, b) => a - b), pos, 'la lista no va en el orden del server: la de evento se movió');
  for (const j of secs) assert.ok(html.includes(`aria-label="Opciones de ${j.nombre}"`), `«${j.nombre}» sin su «⋯»`);
  // El menú, ANTES del buscador; el filtro, después.
  const iMenu = html.indexOf('data-prueba-menu');
  const iBuscar = html.indexOf('aria-label="Buscar por nombre"');
  const iFiltro = html.indexOf('aria-label="Filtrar"');
  assert.ok(iMenu > 0 && iMenu < iBuscar && iBuscar < iFiltro, 'el menú no va antes del buscador');
  // Una sola «Nueva automatización».
  assert.equal(html.split('>Nueva automatización</span>').length - 1, 1);
  // Un setter ve las tres, y el menú (Configuraciones se ve sin editar), sin «⋯» ni «Nueva».
  const setter = dibujar(secs, { rolAdmin: false, menu: createElement('span', { 'data-prueba-menu': '' }, 'M') });
  for (const j of secs) assert.ok(setter.includes(`>${j.nombre}</span>`));
  assert.ok(setter.includes('data-prueba-menu'));
  assert.doesNotMatch(setter, /aria-label="Opciones de |Nueva automatización/);
});

test('(c) las divisiones se fueron del módulo: ni `partirLista` ni los rótulos', () => {
  for (const k of ['partirLista', 'ROTULO_CHATBOT', 'ROTULO_MENSAJES_MAKO']) assert.equal(k in Lista, false, `volvió «${k}»`);
  const src = fuente('app/automations/SimuladorWhatsApp.tsx');
  assert.match(src, /\{lista\.map\(filaDeLista\)\}/);
  assert.doesNotMatch(src, /partirLista|divisiones|nueva\('mako'\)|TRIGGER_AVISO_MAKO/);
  // La puerta de «Nueva» ya no lleva sección.
  assert.match(src, /const nueva = \(\) => \{\n {4}if \(sinPublicar\) \{ setPendiente\(\{ ir: 'nueva' \}\); return; \}\n {4}onNueva\(\);\n {2}\};/);
});

// ── (d) «Renombrar» en el «⋯» ─────────────────────────────────────────────────────────────

test('(d) «Renombrar» va segundo en el «⋯» de toda fila, con su ícono del set, y elegirlo no pide nada', () => {
  for (const [activa, cambios] of [[true, false], [false, false], [true, true]] as const) {
    const ops = opcionesDeFila(activa, cambios);
    assert.equal(ops[1].value, 'renombrar', 'no va segundo, después de Activar/Pausar');
    assert.equal(ops[1].label, 'Renombrar');
    assert.equal(ops[1].icono, 'renombrar');
    assert.ok(ops.every((o) => esIconoMenu(o.icono)), 'una opción sin ícono del set');
  }
  const src = fuente('app/automations/SimuladorWhatsApp.tsx');
  const accion = tramo(src, 'const accionFila = async (j: SecuenciaDto, accion: string) => {', '\n  };\n', 2500);
  const iRen = accion.indexOf("if (accion === 'renombrar') { setErrFila(null); setRenombrando(j.id); return; }");
  assert.ok(iRen > 0 && iRen < accion.indexOf('pedir('), '«Renombrar» pide algo al elegirlo');
  // Guardar: lo que dice `nombreParaGuardar` (contra el que se VE), optimista, por la puerta de siempre, y vuelve atrás.
  const guardar = tramo(src, 'const guardarNombre = async (j: SecuenciaDto, escrito: string) => {', '\n  };\n', 1500);
  assert.match(guardar, /const n = nombreParaGuardar\(previo, escrito\);\n\s+if \(n == null\) return;/);
  assert.match(guardar, /setNombresOptimistas\(\(m\) => new Map\(m\)\.set\(j\.id, n\)\);/);
  assert.match(guardar, /pedir\(API_SECUENCIAS, 'POST', \{ action: 'nombre', secuenciaId: j\.id, nombre: n \}\)/);
  assert.match(guardar, /if \(!r\.ok\) \{ volver\(\); setErrFila\(\{ id: j\.id, texto: r\.error \|\| 'No se pudo renombrar' \}\); return; \}\n\s+onReload\(\);/);
  // El campo: Enter o salir guardan, Escape cancela sin llegarle al lienzo, uno solo de los tres.
  const campo = tramo(src, 'function CampoNombre(', '\n}\n', 2000);
  assert.match(campo, /maxLength=\{TOPE_NOMBRE_SECUENCIA\}/);
  assert.match(campo, /onBlur=\{\(e\) => \{ const t = e\.currentTarget\.value; una\(\(\) => onGuardar\(t\)\); \}\}/);
  assert.match(campo, /e\.key === 'Escape'\) \{ e\.preventDefault\(\); e\.stopPropagation\(\); una\(onCancelar\); \}/);
});

// ── (e) El título del lienzo se re-siembra ────────────────────────────────────────────────

test('(e) el título del lienzo se re-siembra al dibujar cuando cambia el nombre (si no, un blur escribe el viejo)', () => {
  const src = fuente('app/automations/SecuenciaPerfil.tsx');
  assert.match(src, /const \[nombreVisto, setNombreVisto\] = useState\(secuencia\.nombre\);\n\s+if \(!editandoNombre && nombreVisto !== secuencia\.nombre\) \{ setNombreVisto\(secuencia\.nombre\); setNombre\(secuencia\.nombre\); \}/);
  const guardar = tramo(src, 'const guardarNombre = async () => {', '\n  };\n', 900);
  assert.match(guardar, /const t = nombreParaGuardar\(secuencia\.nombre, nombre\);/);
  assert.match(src, /const NOMBRE_MAX = TOPE_NOMBRE_SECUENCIA;/);
});

// ── (f) Configuraciones sin filetes ───────────────────────────────────────────────────────

test('(f) el modal: `sinFiletes`, Tabs con `sinLinea` y UN SOLO hijo con los dos paneles montados', () => {
  const src = fuente('app/automations/ConfiguracionesBoton.tsx');
  const modal = tramo(src, '<Modal titulo="Configuraciones" onCerrar={cerrar} ancho={600} alto="min(85vh, 640px)" sinFiletes>', '</Modal>', 900);
  const cuerpo = modal.slice(modal.indexOf('>') + 1).replace(/\{\}/g, '').trim();
  assert.match(cuerpo, /^<div>\s*<Tabs tabs=\{\[\.\.\.PESTANAS_CONFIGURACIONES\]\} activa=\{pestana\} onCambio=\{\(id\) => setPestana\(id as Pestana\)\} sinLinea \/>\s*<div hidden=\{pestana !== 'horario'\}><HorarioEnvioPanel onSucio=\{alSucioHorario\} \/><\/div>\s*<div hidden=\{pestana !== 'limites'\}><LimitesEnvioPanel onSucio=\{alSucioLimites\} \/><\/div>\s*<\/div>$/,
    'el cuerpo no es UN hijo con Tabs sin línea y los dos paneles montados (el segundo hijo lleva un filete arriba)');
  assert.match(src, /const cerrar = useCerrarEstable\(onCerrar, ocupado\);/, 'el Modal recibe una flecha nueva por render, o cierra con el guardado en vuelo');
  assert.match(src, /return createPortal\(\s*<Modal /);
  // Tabs, ejecutado: con `sinLinea` no hay borde abajo; sin la prop, el de siempre.
  const tabs = (extra: Record<string, unknown>) => renderToStaticMarkup(createElement(Tabs, { tabs: [{ id: 'a', label: 'A' }], activa: 'a', onCambio: () => {}, ...extra }));
  const fila = (html: string) => html.slice(0, html.indexOf('>'));
  assert.match(fila(tabs({ sinLinea: true })), /border-bottom:none/);
  assert.match(fila(tabs({})), /border-bottom:1px solid var\(--border\)/, 'sin la prop cambió el de siempre');
  // El subrayado azul de la activa (el indicador) se queda.
  assert.match(tabs({ sinLinea: true }), /border-bottom:2px solid var\(--primary\)/);
});

// ── (g) El menú: Configuraciones y Tutorial ───────────────────────────────────────────────

test('(g) el menú: las dos opciones con su ícono, el `data-recorrido` del último paso, y la lista no lo importa', () => {
  const src = fuente('app/automations/ConfiguracionesBoton.tsx');
  assert.match(src, /\{ value: 'configuraciones', label: 'Configuraciones', icono: 'configurar' \},\n\s+\{ value: 'tutorial', label: 'Tutorial', icono: 'pregunta' \},/);
  for (const n of ['configurar', 'pregunta']) assert.ok(esIconoMenu(n), `«${n}» no es del set`);
  const menu = tramo(src, 'export function MenuAutomations(', '\n}\n', 2000);
  assert.match(menu, /<span data-recorrido=\{OBJETIVO_AYUDA\} style=\{\{ display: 'inline-flex', flex: 'none' \}\}>/, 'el último paso del recorrido no tiene qué señalar');
  assert.match(menu, /<Dropdown value="" resetAfterSelect sinFlecha search=\{false\} align="left" ariaLabel="Configuraciones y tutorial"/);
  assert.match(menu, /width: LADO_FILTRO, height: LADO_FILTRO/, 'el botón no es cuadrado del alto del buscador');
  assert.match(menu, /if \(v === 'configuraciones'\) setAbierto\(true\); else if \(v === 'tutorial'\) onTutorial\(\);/);
  assert.match(menu, /\{abierto && <ConfiguracionesModal onCerrar=\{cerrar\} \/>\}/);
  assert.equal(OBJETIVO_AYUDA, 'au-ayuda');
  // El botón de antes y su CSS se fueron.
  assert.doesNotMatch(src, /data-configuraciones|chb-config|CSS_CONFIG/);
  // La tab lo monta en los dos lugares (antes del buscador y antes de «＋ Nueva» del cartel vacío), con el recorrido.
  const app = fuente('app/automations/ChatAgentApp.tsx');
  assert.equal(app.split('<MenuAutomations onTutorial={recorrido.reabrir} />').length - 1, 2);
  assert.match(app, /menu=\{<MenuAutomations onTutorial=\{recorrido\.reabrir\} \/>\}/);
  assert.match(tramo(app, 'Todavía no hay automatizaciones.', '<SimuladorWhatsApp', 2500), /<MenuAutomations onTutorial=\{recorrido\.reabrir\} \/>\s*<button onClick=\{\(\) => abrirGaleria\(\)\} style=\{btnDark\}>＋ Nueva<\/button>/);
  // ⚠️ La lista no lo importa: arrastraría `server-only` y los tests que la dibujan caerían AL IMPORTAR.
  assert.doesNotMatch(fuente('app/automations/SimuladorWhatsApp.tsx'), /ConfiguracionesBoton|MenuAutomations|ConfiguracionesModal/);
});

// ── (h) La puerta del nombre ──────────────────────────────────────────────────────────────

test('(h) renombrar contesta 404 si no tocó ninguna fila (ajena o archivada), y 400 si queda vacío', () => {
  const lib = fuente('lib/setting-secuencias.ts');
  const ren = tramo(lib, 'export async function renombrarSecuencia(', '\n}\n', 1200);
  assert.match(ren, /if \(!n\) throw new TriggerInvalidoError\('El nombre no puede quedar vacío\.'\);/);
  assert.match(ren, /\.eq\('id', secuenciaId\)\n\s+\.is\('archivada_at', null\)\n\s+\.select\('id'\);/);
  assert.match(ren, /if \(!data\?\.length\) throw new SecuenciaNoExisteError\('No existe'\);/);
  const ruta = fuente('app/api/chat-agent/secuencias/route.ts');
  const nombre = tramo(ruta, "if (body.action === 'nombre') {", "if (body.action === 'emoji')", 1200);
  assert.match(nombre, /if \(e instanceof SecuenciaNoExisteError\) return Response\.json\(\{ ok: false, error: 'No existe' \}, \{ status: 404 \}\);/);
  assert.match(nombre, /if \(e instanceof TriggerInvalidoError\) return Response\.json\(\{ ok: false, error: e\.message \}, \{ status: 400 \}\);/);
});
