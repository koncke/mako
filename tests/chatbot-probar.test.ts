// =============================================================================
// /chatbot: la página y «Probar» (pedido de Martín del 08/10/2026, puntos 1, 2, 3 y 10)
// =============================================================================
// Lo que vive en componentes y en archivos `server-only` y no se puede ejecutar acá se fija
// leyendo el fuente SIN comentarios (la convención de la casa es explicar en el comentario lo
// que se sacó, y un guard de «esto NO está» se acusaría a sí mismo):
//
//   · se fueron el formulario de hand-offs y el renglón del recordatorio (puntos 1 y 2), y los
//     avisos de línea caída y envío apagado siguen;
//   · la lista muestra SÓLO el nombre, en dos renglones, y busca por nombre (punto 3);
//   · el recordatorio es un ítem de la lista que lee y escribe EXACTAMENTE el mismo setting;
//   · «Probar» es un panel acoplado a la derecha que NO reemplaza al lienzo, con ✕ y ↻, que
//     prueba lo LOCAL, anima los mensajes y manda de verdad sin guardar el destino (punto 10).
//
// La lógica del recorrido la EJECUTA tests/simulador-grafo.test.ts.
//
// PROBADO ROMPIÉNDOLO (08/10/2026): ver `ROTURAS` al pie, con lo que cazó cada una.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(import.meta.dirname, '..');
const leer = (p: string): string => readFileSync(join(RAIZ, p), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\s*\}/g, '{}');

const APP = () => sinComentarios(leer('app/chatbot/ChatAgentApp.tsx'));
const LISTA = () => sinComentarios(leer('app/chatbot/SimuladorWhatsApp.tsx'));
const PANEL = () => sinComentarios(leer('app/chatbot/PanelProbar.tsx'));
const RECORDATORIO = () => sinComentarios(leer('app/chatbot/RecordatorioFlujo.tsx'));
const RUTA = () => sinComentarios(leer('app/api/chat-agent/simulador/route.ts'));
const PRUEBA = () => sinComentarios(leer('lib/prueba-paso.ts'));

/** El bloque de una función de primer nivel, hasta la próxima. */
function bloque(src: string, firma: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré «${firma}»`);
  const resto = src.slice(i + firma.length);
  const fin = resto.search(/\n(export |async function |function |const [A-Z_]+ =)/);
  return firma + (fin >= 0 ? resto.slice(0, fin) : resto);
}

// ── Puntos 1 y 2: lo que se fue de arriba del lienzo ───────────────────────────

test('se fueron el formulario de hand-offs y el renglón del recordatorio; los avisos de la línea siguen', () => {
  assert.equal(existsSync(join(RAIZ, 'app/chatbot/HandoffsPanel.tsx')), false, 'el formulario volvió');
  assert.equal(existsSync(join(RAIZ, 'app/chatbot/RecordatorioReunion.tsx')), false, 'el renglón volvió');
  const app = APP();
  assert.doesNotMatch(app, /HandoffsPanel|RecordatorioReunion|setHandoffs/);
  // Los dos avisos que SÍ se quedan (los fijan además flujo-acciones-bordes y chatbot-puerta).
  assert.match(app, /\{canalCaido && \(secuencias \?\? \[\]\)\.some\(\(s\) => s\.activa\) && \(/);
  assert.match(app, /!canalCaido && envioWa === false && /);
  // `resolverHandoff` y su acción se QUEDAN: los usa MaKo (`resolver_handoff`).
  assert.match(sinComentarios(leer('app/api/chat-agent/secuencias/route.ts')), /resolver-handoff/);
});

// ── Punto 3: la lista ─────────────────────────────────────────────────────────

test('la lista muestra SÓLO el nombre, entero en dos renglones, y busca por nombre', () => {
  const lista = LISTA();
  const item = bloque(lista, 'function ItemLista(');
  // Un solo texto: el nombre. Sin subtítulo (el gancho o el primer mensaje recortado).
  assert.match(item, /WebkitLineClamp: 2/);
  assert.match(item, /\}\}>\{nombre\}<\/span>/);
  assert.equal((item.match(/<span /g) ?? []).length, 3, 'el emoji, el nombre y el punto: nada más');
  assert.doesNotMatch(lista, /slice\(0, 42\)|estrategia\?\.gancho|pasosQueLlegan/);
  // El buscador busca por lo que se ve.
  assert.match(lista, /\(!q \|\| j\.nombre\.toLowerCase\(\)\.includes\(q\)\)/);
  assert.match(lista, /export const TOPE_NOMBRE = 40;/);
});

// ── El recordatorio, en la lista y con sus tarjetas ─────────────────────────────

test('el recordatorio lee y escribe EXACTAMENTE el mismo setting, por la misma ruta', () => {
  const r = RECORDATORIO();
  assert.match(r, /const URL_API = '\/api\/chat-agent\/recordatorio-reunion';/);
  // «Activar» = `activo`, en el acto.
  assert.match(r, /const ok = await guardar\(\{ activo: v \}\);/);
  // Sólo «Publicar» manda los textos, uno por cada toque del emisor.
  const publicar = r.slice(r.indexOf('const publicar = async'), r.indexOf('const grafo = useMemo'));
  assert.match(publicar, /guardar\(\{ textos: Object\.fromEntries\(TOQUES\.map\(\(m\) => \[m, borrador\[m\] \?\? ''\]\)\) \}\)/);
  assert.equal((r.match(/guardar\(\{ textos/g) ?? []).length, 1, 'los textos se guardan en un solo lugar: Publicar');
  assert.match(r, /import \{ TOQUES, type Toque \} from '@\/lib\/recordatorio-lead';/);
  // La ruta escribe la MISMA clave, en el workspace del request (lo fija también recordatorio-lead).
  const api = sinComentarios(leer('app/api/chat-agent/recordatorio-reunion/route.ts'));
  assert.match(api, /setSetting\(KEY_RECORDATORIO, serializarConfig\(\{ activo, textos \}\)\)/);
  assert.match(api, /const v = entrantes\[String\(min\)\];/);
  assert.match(sinComentarios(leer('lib/recordatorio-lead.ts')), /export const KEY_RECORDATORIO = 'chatbot\.recordatorio_reunion';/);
});

test('el recordatorio ofrece sólo lo que el emisor permite: textos, sin quitar ni agregar, sin audio ni archivos', () => {
  const r = RECORDATORIO();
  assert.doesNotMatch(r, /onAgregarTras|opcionesAgregar|onMover/, 'un toque no se quita ni se agrega: el emisor manda los tres');
  assert.match(r, /permiteIA=\{false\} permiteAudio=\{false\} permiteAdjuntos=\{false\}/);
  // Las esperas no se abren: sus minutos son fijos en el emisor.
  assert.match(r, /onSeleccion=\{\(id\) => setSel\(id && \/\^toque-\\d\+\$\/\.test\(id\) \? id : null\)\}/);
  // El disparador se llama CRON (punto 4) y la cadena es la del emisor: 24 h, 1 h, 15 min.
  assert.match(r, /titulo: 'CRON', icono: '⚡', detalle: 'Agendó una reunión'/);
  assert.match(r, /const ANTES: Record<Toque, string> = \{ 1440: '24 h antes de la reunión', 60: '1 h antes', 15: '15 min antes' \};/);
});

// ── Punto 10: «Probar» ─────────────────────────────────────────────────────────

test('«Probar» NO reemplaza al lienzo: el editor queda montado y el panel se acopla a la derecha', () => {
  const lista = LISTA();
  assert.doesNotMatch(lista, /modo === 'chat'|setModo\(|<ChatHilo/, 'volvió el modo que reemplaza al lienzo');
  // El editor se monta SIEMPRE que hay una secuencia elegida, abra o no el panel.
  assert.match(lista, /\) : !sel \? \(\n[\s\S]*?\) : \(\n\s*\n?\s*<SecuenciaPerfil key=\{sel\.id\}/);
  assert.match(lista, /onProbar=\{\(\) => setProbando\(true\)\}/);
  assert.match(lista, /onCambioLocal=\{recibirEdicion\}/);
  assert.match(lista, /insetDer=\{probando \? PANEL_PROBAR_ANCHO \+ LISTA_HUECO \* 2 : undefined\}/);
  assert.match(lista, /\{probando && sel && \(\n\s+<PanelProbar\n/);
  assert.match(lista, /style=\{\{ position: 'absolute', right: LISTA_HUECO, top: LISTA_HUECO, bottom: LISTA_HUECO, width: PANEL_PROBAR_ANCHO, zIndex: 3 \}\}/);
});

test('el panel tiene ✕ «Cerrar» y ↻ «Reiniciar», y ningún «Editar»', () => {
  const panel = PANEL();
  assert.match(panel, /aria-label="Cerrar"/);
  assert.match(panel, /aria-label="Reiniciar"/);
  assert.doesNotMatch(panel, />Editar<|'Editar'|readOnly/);
  // ↻ vacía la prueba y arranca de nuevo con el flujo de AHORA.
  const reiniciar = panel.slice(panel.indexOf('const reiniciar = () => {'), panel.indexOf('const elegirRama'));
  assert.match(reiniciar, /cortar\(\);\n\s+setMensajes\(\[\]\); setTyping\(null\); setOpciones\(null\);\n\s+setFirmaProbada\(firmaViva\);\n\s+arrancarRefs\(\);/);
});

test('el panel prueba lo LOCAL, anima los mensajes y dice si el flujo cambió', () => {
  const panel = PANEL();
  assert.match(panel, /const propia = edicion && edicion\.secuenciaId === secuencia\.id \? edicion : null;/);
  assert.match(panel, /const pasosVivos = propia\?\.pasos \?\? secuencia\.pasos;/);
  assert.match(panel, /flujoParaProbar\(pasosVivos, estVivo,/);
  assert.match(panel, /mensajes=\{mensajes\} typing=\{typing\} animarNuevos/);
  assert.match(panel, /const cambio = firmaViva !== firmaProbada;/);
  assert.match(panel, /\{cambio && \(/);
  // Las variables con el catálogo del motor, no con un reemplazo propio.
  assert.match(panel, /textoDeEjemplo\(p\.cuerpo, c\.negocio\)/);
  assert.doesNotMatch(panel, /conVars|'Juan'|Acme SRL/);
});

test('escribir como el lead PAUSA la salida y clasifica contra los casos LOCALES', () => {
  const panel = PANEL();
  const responder = panel.slice(panel.indexOf('const alResponder = async'), panel.indexOf('async function enviarTexto'));
  assert.match(responder, /const p = pausarPorRespuesta\(simRef\.current\);/);
  assert.match(responder, /if \(!raizRespuesta\(flujoRef\.current\)\) \{ sistema\('MaKo no contesta'\); return null; \}/);
  assert.match(responder, /postar\(\{ action: 'clasificar', pasos: flujoRef\.current, \.\.\.cuerpo \}\)/);
  assert.match(responder, /entrarEnRespuesta\(flujoRef\.current, simRef\.current,/);
  // El server: el MISMO clasificador y el MISMO redactor del motor, con lo local.
  const ruta = RUTA();
  assert.match(ruta, /const casos = escenariosDeRespuesta\(pasos\);/);
  assert.match(ruta, /const r = await clasificarEscenario\(mensaje, escenarios\);/);
  assert.match(ruta, /const r = await responderSimulador\(id, historial, \{ escenario \}\);/);
});

test('la prueba real: sólo el admin, por la línea de la secuencia, y el destino NO se guarda', () => {
  const ruta = RUTA();
  const enviar = ruta.slice(ruta.indexOf("if (body.action === 'enviar-real')"), ruta.indexOf('const id = Number(body.secuenciaId);\n    if (!Number.isFinite(id)) return json({ ok: false, error: \'secuenciaId inválido\' }, 400);\n    const historial = historialDe(body.historial);\n    const t = await'));
  assert.ok(enviar.indexOf("if (a.rol !== 'admin')") >= 0 && enviar.indexOf("if (a.rol !== 'admin')") < enviar.indexOf('enviarPasoDePrueba('), 'el guard de admin va ANTES de mandar');
  assert.match(enviar, /const destino = sanearDestinoPrueba\(body\.destino\);/);
  // El GET del destino precargado también es sólo del admin.
  const get = bloque(ruta, 'export async function GET(');
  assert.match(get, /if \(a\.rol !== 'admin'\) return json/);
  assert.match(get, /const c = await getContactoReportes\(\);/);
  // NADIE escribe el contacto de reportes ni toca inscripciones o envíos del motor.
  for (const [nombre, src] of [['la ruta', ruta], ['prueba-paso', PRUEBA()], ['el panel', PANEL()]] as const) {
    assert.doesNotMatch(src, /setContactoReportes|setSetting|user_telefono|user_email|nutricion_envios|nutricion_inscripciones/, `${nombre} guarda o toca algo que no es suyo`);
  }
  const prueba = PRUEBA();
  assert.match(prueba, /\.from\('nutricion_secuencias'\)\.select\('id, instance_name'\)\.eq\('id', p\.secuenciaId\)\.maybeSingle\(\)/);
  assert.match(prueba, /for \(const envio of planDePrueba\(mensaje, p\.primero\)\)/);
  assert.match(prueba, /enviarYEspejar\(\{ telefono, texto: envio\.texto, linea \}\)/);
  assert.match(prueba, /enviarAudioYEspejar\(\{ telefono, base64: b64, mimetype: audio\.media_mime, linea \}\)/);
  assert.match(prueba, /const adj = await getAdjunto\(envio\.mediaId\);/);
  assert.match(prueba, /^import 'server-only';$/m);
});

// ROTURAS (08/10/2026), una por vez, restaurando de memoria (nunca con git checkout) y verificando
// con md5 que cada archivo volviera idéntico. Sin romper: 9 pass / 0 fail. Las 32 cayeron, cada
// una en el test que la persigue (8 / 1 todas):
//   · ChatAgentApp con el formulario de hand-offs montado otra vez; sin el aviso de envío apagado.
//   · la lista con un subtítulo (el nombre recortado a 42); el buscador mirando el gancho; el
//     nombre en un renglón con elipsis.
//   · el recordatorio: «Activar» mandando también los textos; otra ruta; «Publicar» con un solo
//     toque; un ＋ en el lienzo; las esperas abriéndose; el audio permitido; «Se dispara».
//   · «Probar» volviendo a `setModo('chat')`; el editor desmontado mientras se prueba; sin
//     `insetDer`; sin `onCambioLocal`; el panel a la izquierda.
//   · el panel: «Cerrar» → «Editar»; ↻ sin vaciar; probando lo guardado; sin `animarNuevos`; sin
//     «Cambió»; responder sin pausar la salida; contestando aunque no haya «Si responde».
//   · la ruta: clasificando sin los casos locales; redactando sin el caso local; «enviar-real» y
//     el GET del destino sin el guard de admin; guardando el destino (`setContactoReportes`).
//   · prueba-paso: guardando el destino (`setSetting`); la línea de cualquier secuencia (sin el
//     `.eq('id', …)`); mandando el texto crudo sin `planDePrueba`.
