// =============================================================================
// /automations: la página y «Probar» (pedido de Martín del 08/10/2026, puntos 1, 2, 3 y 10)
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
//     prueba lo LOCAL, anima los mensajes y manda de verdad sin guardar el destino (punto 10);
//   · lo de la revisión adversarial del 08/10/2026: la prueba real no repite una tarjeta y el
//     server topea por destino (datos-4), el archivo con su nombre (costuras-8), el destino de
//     quien prueba (lienzo-3), el clic en la misma automatización (lienzo-5) y `?sec=` al lienzo
//     (costuras-5).
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

const APP = () => sinComentarios(leer('app/automations/ChatAgentApp.tsx'));
const LISTA = () => sinComentarios(leer('app/automations/SimuladorWhatsApp.tsx'));
const PANEL = () => sinComentarios(leer('app/automations/PanelProbar.tsx'));
const RECORDATORIO = () => sinComentarios(leer('app/automations/RecordatorioFlujo.tsx'));
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
  assert.equal(existsSync(join(RAIZ, 'app/automations/HandoffsPanel.tsx')), false, 'el formulario volvió');
  assert.equal(existsSync(join(RAIZ, 'app/automations/RecordatorioReunion.tsx')), false, 'el renglón volvió');
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
  // Tercera tanda (decisión 6): el emoji (con su giro mientras se crea y el punto de estado
  // encima), el nombre y la columna del «⋯». El único TEXTO sigue siendo el nombre.
  assert.equal((item.match(/<span /g) ?? []).length, 5, 'el emoji, el giro, el punto, el nombre y el «⋯»: nada más');
  assert.deepEqual([...item.matchAll(/>\{([a-zA-Z.]+)\}</g)].map((m) => m[1]).sort(), ['menu', 'nombre'], 'un texto más que el nombre en la fila');
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
  // Sólo «Publicar» manda los textos (y desde el 10/10/2026 el número de cada toque), uno por cada
  // toque del emisor.
  const publicar = r.slice(r.indexOf('const publicar = async'), r.indexOf('const grafo = useMemo'));
  assert.match(publicar, /const ok = await guardar\(\{\n\s+textos: Object\.fromEntries\(TOQUES\.map\(\(m\) => \[m, edicion\.textos\[m\] \?\? ''\]\)\),\n\s+lineas: /);
  assert.equal((r.match(/textos: Object\.fromEntries\(TOQUES/g) ?? []).length, 1, 'los textos se guardan en un solo lugar: Publicar');
  assert.match(r, /import \{ TOQUES, type Toque \} from '@\/lib\/recordatorio-lead';/);
  // La ruta escribe la MISMA clave, en el workspace del request (lo fija también recordatorio-lead).
  const api = sinComentarios(leer('app/api/chat-agent/recordatorio-reunion/route.ts'));
  assert.match(api, /setSetting\(KEY_RECORDATORIO, serializarConfig\(\{ activo, textos, lineas \}\)\)/);
  assert.match(api, /const v = entrantes\[String\(min\)\];/);
  assert.match(sinComentarios(leer('lib/recordatorio-lead.ts')), /export const KEY_RECORDATORIO = 'chatbot\.recordatorio_reunion';/);
});

test('el recordatorio ofrece sólo lo que el emisor permite: textos, sin quitar ni agregar, sin audio ni archivos', () => {
  const r = RECORDATORIO();
  assert.doesNotMatch(r, /onAgregarTras|opcionesAgregar|onMover/, 'un toque no se quita ni se agrega: el emisor manda los tres');
  assert.match(r, /permiteIA=\{false\} permiteAudio=\{false\} permiteAdjuntos=\{false\}/);
  // Las esperas no se abren: sus minutos son fijos en el emisor.
  assert.match(r, /onSeleccion=\{\(id\) => setSel\(esTarjetaDeToque\(id\) \? id : null\)\}/);
  // El disparador se llama CRON (punto 4) y la cadena es la del emisor: 24 h, 1 h, 15 min. Desde el
  // 10/10/2026 las tarjetas las arma el MISMO constructor que una automatización (`grafoDeSecuencia`,
  // vía `grafoRecordatorio`): lo EJECUTA tests/recordatorio-lienzo.test.ts.
  assert.match(r, /grafoRecordatorio\(edicion\.textos\)/);
  const lib = sinComentarios(leer('lib/recordatorio-grafo.ts'));
  assert.match(lib, /export const DISPARADOR_RECORDATORIO = 'Agendó una reunión';/);
  assert.match(lib, /export const ANTES: Record<Toque, string> = \{ 1440: '24 h antes', 60: '1 h antes', 15: '15 min antes' \};/);
  assert.match(lib, /const base = grafoDeSecuencia\(pasosDelRecordatorio\(textos\), \{/);
});

// ── Punto 10: «Probar» ─────────────────────────────────────────────────────────

test('«Probar» NO reemplaza al lienzo: el editor queda montado y el panel se acopla a la derecha', () => {
  const lista = LISTA();
  assert.doesNotMatch(lista, /modo === 'chat'|setModo\(|<ChatHilo/, 'volvió el modo que reemplaza al lienzo');
  // El editor se monta SIEMPRE que hay una secuencia elegida, abra o no el panel.
  assert.match(lista, /\) : !sel \? \(\n[\s\S]*?\) : \(\n\s*\n?\s*<SecuenciaPerfil key=\{sel\.id\}/);
  // Tercera tanda (decisión 14): «Probar» es de UN canal, y lo elige el desplegable de SecuenciaPerfil.
  // (Integración: con `onProbar: (canal: CanalProbar) => void` en SecuenciaPerfil, el canal llega
  // siempre; ya no hay un «sin canal» que caiga a WhatsApp.)
  assert.match(lista, /onProbar=\{\(canal: CanalProbar\) => setProbando\(canal\)\}/);
  assert.match(lista, /onCambioLocal=\{recibirEdicion\}/);
  // Segunda tanda (decisión 11): dónde va «Probar» lo decide UNA función pura (`muelles`,
  // lib/lienzo-grafo.ts, con test en tests/lienzo-muelles.test.ts). La lista sólo mide su caja,
  // reparte los insets y monta el panel en SU rectángulo; el panel lo llena (100 %).
  assert.match(lista, /const m = calcularMuelles\(caja, \{ listaAbierta: true, probarAbierto: probarVisible, editorAbierto: true \}\);/);
  assert.match(lista, /insetDer=\{m\.insets\.der \|\| undefined\}\n\s+muelles=\{m\}/);
  assert.match(lista, /\{probarVisible && sel && m\.probar && \(\n\s+<div data-muelle="probar" style=\{\{ position: 'absolute', left: m\.probar\.left, top: m\.probar\.top, width: m\.probar\.width, height: m\.probar\.height, zIndex: 3, display: 'flex' \}\}>\n\s+<PanelProbar\n/);
  assert.match(lista, /style=\{\{ width: '100%', height: '100%' \}\}/);
  assert.doesNotMatch(lista, /PANEL_PROBAR_ANCHO/, 'el ancho de «Probar» volvió a decidirse en la lista y no en `muelles`');
});

test('el panel tiene ↻ «Reiniciar» y ningún «Editar»; el «Cerrar» es el botón del chrome', () => {
  const panel = PANEL();
  // Cuarta tanda, punto 3: «el botón de "Cerrar" debería estar donde hoy está el botón de "probar"».
  assert.doesNotMatch(panel, /✕ Cerrar/, 'volvió el «Cerrar» adentro del panel');
  assert.match(leer('app/automations/SecuenciaPerfil.tsx'), /\{probarAbierto \? \(\s*<button onClick=\{\(\) => onCerrarProbar\?\.\(\)\} title="Cerrar la prueba" style=\{estiloProbar\}>✕ Cerrar<\/button>/);
  assert.match(panel, /aria-label="Reiniciar"/);
  assert.doesNotMatch(panel, />Editar<|'Editar'|readOnly/);
  // ↻ vacía la prueba (el hilo Y la bandeja) y arranca de nuevo con el flujo de AHORA.
  const reiniciar = panel.slice(panel.indexOf('const reiniciar = (deVerdad = false) => {'), panel.indexOf('const probarDeVerdad'));
  assert.match(reiniciar, /cortar\(\);\n\s+setMensajes\(\[\]\); setTyping\(null\); setOpciones\(null\);\n\s+setCorreos\(\[\]\); setAbierto\(null\); setRecibiendo\(false\); setTerminado\(false\); setAviso\(null\);\n\s+realRef\.current = deVerdad; setReal\(deVerdad\);\n\s+setFirmaProbada\(firmaViva\);\n\s+arrancarRefs\(\);/);
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

// (Quinta tanda, punto 1: los destinos de QUIEN PRUEBA sí se guardan, en SU fila de `usuarios`; lo
// fija tests/probar-lead-nuevo.test.ts. Lo del NEGOCIO sigue sin tocarse, que es lo de abajo.)
test('la prueba real: sólo el admin, por la línea de la secuencia, y nada del NEGOCIO se guarda', () => {
  const ruta = RUTA();
  const enviar = ruta.slice(ruta.indexOf("if (body.action === 'enviar-real')"), ruta.indexOf('const id = Number(body.secuenciaId);\n    if (!Number.isFinite(id)) return json({ ok: false, error: \'secuenciaId inválido\' }, 400);\n    const historial = historialDe(body.historial);\n    const t = await'));
  assert.ok(enviar.indexOf("if (a.rol !== 'admin')") >= 0 && enviar.indexOf("if (a.rol !== 'admin')") < enviar.indexOf('enviarPasoDePrueba('), 'el guard de admin va ANTES de mandar');
  assert.match(enviar, /const destino = sanearDestinoPrueba\(body\.destino\);/);
  // El GET del destino precargado también es sólo del admin.
  const get = bloque(ruta, 'export async function GET(');
  assert.match(get, /if \(a\.rol !== 'admin'\) return json/);
  // NADIE escribe el contacto de reportes ni toca inscripciones o envíos del motor.
  for (const [nombre, src] of [['la ruta', ruta], ['prueba-paso', PRUEBA()], ['el panel', PANEL()]] as const) {
    assert.doesNotMatch(src, /setContactoReportes|setSetting|user_telefono|user_email|nutricion_envios|nutricion_inscripciones/, `${nombre} guarda o toca algo que no es suyo`);
  }
  const prueba = PRUEBA();
  assert.match(prueba, /\.from\('nutricion_secuencias'\)\.select\('id, instance_name'\)\.eq\('id', p\.secuenciaId\)\.maybeSingle\(\)/);
  assert.match(prueba, /for \(const envio of planDePrueba\(mensaje, primero\)\)/);
  assert.match(prueba, /enviarYEspejar\(\{ telefono, texto: envio\.texto, linea \}\)/);
  assert.match(prueba, /enviarAudioYEspejar\(\{ telefono, base64: b64, mimetype: audio\.media_mime, linea \}\)/);
  assert.match(prueba, /const adj = await getAdjunto\(envio\.mediaId\);/);
  assert.match(prueba, /^import 'server-only';$/m);
});

// ── La revisión adversarial del 08/10/2026 (parte P) ───────────────────────────
// La lógica la EJECUTA tests/simulador-grafo.test.ts (`debeSalirDeVerdad`, `reclamarCupoPrueba`,
// `burbujaDeArchivo`, `destinoDelQueMira`). Acá se fija que esté ENCHUFADA donde corre.

test('datos-4: el panel no reenvía una tarjeta que ya salió, y el server topea por destino', () => {
  const panel = PANEL();
  // (Cuarta tanda, punto 15: después de `mandarReal` viene `mostrarParte`, una parte de un mensaje.)
  const mandar = panel.slice(panel.indexOf('const mandarReal = ('), panel.indexOf('const mostrarParte = ('));
  assert.ok(mandar.length > 0 && mandar.length < 1500, `el recorte de mandarReal mide ${mandar.length}`);
  // El interruptor se mira PRIMERO y la tarjeta repetida corta ANTES del POST.
  const iSwitch = mandar.indexOf('if (!vaWa && !vaEmail) return;');
  const iCorte = mandar.indexOf('if (!debeSalirDeVerdad(enviadosReal.current, nodo, enRespuesta, turnoLead.current)) {');
  const iPost = mandar.indexOf("postar({ action: 'enviar-real'");
  assert.ok(iSwitch >= 0 && iCorte > iSwitch && iPost > iCorte, 'interruptor → no repetir → mandar, en ese orden');
  // Cada mensaje que se dibuja pasa su TARJETA, y ↻ arranca con el registro vacío.
  assert.equal((panel.match(/mostrarPaso\(paso, evento\.nodo,/g) ?? []).length, 3, 'las tres llamadas de avanzar() (el email, «MaKo contesta» y el resto) pasan la tarjeta');
  // (El del email lleva el HTML con un spread `...(correo.html ? { html } : {})`: el patrón tolera un
  // nivel de llaves adentro.)
  // Cuarta tanda, punto 15: el audio, el archivo y el texto de UNA PARTE pasan su `clave` (la tarjeta,
  // o `${nodo}#${k}` en un mensaje de varias partes); el email y «MaKo contesta», la tarjeta.
  assert.equal((panel.match(/mandarReal\(\{(?:[^{}]|\{[^{}]*\})*\}, nodo, enRespuesta\)/g) ?? []).length, 2, 'email y «MaKo contesta»');
  assert.equal((panel.match(/mandarReal\(\{(?:[^{}]|\{[^{}]*\})*\}, clave, enRespuesta\)/g) ?? []).length, 3, 'audio, archivo y texto de una parte');
  const arrancar = panel.slice(panel.indexOf('const arrancarRefs = () => {'), panel.indexOf('const reiniciar = (deVerdad = false) => {'));
  assert.ok(arrancar.length > 0 && arrancar.length < 800, `el recorte de arrancarRefs mide ${arrancar.length}`);
  assert.match(arrancar, /enviadosReal\.current = new Set\(\);\n\s+turnoLead\.current = 0;/);
  const responder = panel.slice(panel.indexOf('const alResponder = async'), panel.indexOf('async function enviarTexto'));
  assert.match(responder, /^[^\n]*\n\s+cortar\(\);\n\s+turnoLead\.current \+= 1;/, 'el turno del lead sube al escribir');
  // El server: el tope se reclama DESPUÉS de los chequeos que cortan y ANTES de mandar.
  const prueba = PRUEBA();
  const iSandbox = prueba.indexOf('await remitenteEsSandbox()');
  const iCupo = prueba.indexOf("hayLugar = await reclamarCupoPrueba((i) => reclamarEspaciado(p.ws, `prueba-real:${i}`, VENTANA_PRUEBA_MIN, clave));");
  const iLoop = prueba.indexOf('for (const envio of planDePrueba(mensaje, primero))');
  assert.ok(iSandbox >= 0 && iCupo > iSandbox && iLoop > iCupo, 'chequeos → tope → mandar');
  assert.match(prueba, /if \(!hayLugar\) return \{ ok: false, error: /);
  assert.match(prueba, /return \{ ok: false, error: 'No pude comprobar el tope' \};/, 'sin poder contar, no se manda');
  // El aviso: el primero a ese destino en la ventana lo lleva, diga lo que diga el navegador.
  assert.match(prueba, /const primero = p\.primero \|\| primeroEnVentana;/);
  assert.match(RUTA(), /enviarPasoDePrueba\(\{ ws: a\.ws, secuenciaId: id,/);
});

test('costuras-8: «Probar» dibuja el documento con el nombre del archivo y el caption aparte', () => {
  const panel = PANEL();
  assert.match(panel, /poner\(\{ id: nuevoId\('md'\), fromMe: false, autor: firma\(\), \.\.\.burbujaDeArchivo\(adj, caption\), fecha: ahora \}\);/);
  assert.doesNotMatch(panel, /texto: caption \|\| adj\?\.nombre/, 'volvió el caption como nombre del documento');
});

test('lienzo-3: «A mi WhatsApp» se precarga con lo de QUIEN PRUEBA, nunca con el contacto del negocio', () => {
  const get = bloque(RUTA(), 'export async function GET(');
  assert.match(get, /const sesion = await getUsuarioActual\(\);/);
  assert.match(get, /const propia = sesion\?\.email \? await buscarUsuarioPorEmail\(sesion\.email\) : null;/);
  assert.match(get, /const d = destinoDelQueMira\(propia\);/);
  // Ni el contacto de reportes ni el perfil «viendo como cliente» (que es el del cliente).
  assert.doesNotMatch(RUTA(), /getContactoReportes|getPerfil\(/);
});

test('lienzo-5: tocar la automatización ya elegida no suelta lo que se está probando', () => {
  const lista = LISTA();
  const elegirFn = lista.slice(lista.indexOf('const elegir = (id: number | typeof ID_RECORDATORIO) => {'), lista.indexOf('const recibirEdicion'));
  // Segunda tanda (decisión 15): con cambios sin publicar, PRIMERO se pregunta; el cambio de
  // verdad (`cambiarA`) es el de siempre.
  assert.match(elegirFn, /=> \{\n\s+if \(id === selId\) return;\n\s+if \(sinPublicar\) \{ setPendiente\(\{ ir: id \}\); return; \}\n\s+cambiarA\(id\);/);
  assert.match(lista, /const cambiarA = \(id: number \| typeof ID_RECORDATORIO\) => \{\n\s+setSelId\(id\); setProbando\(null\); setEdicion\(null\);/);
});

test('costuras-5: el link `?sec=` abre el LIENZO de esa automatización, no el wizard', () => {
  const app = APP();
  const ancla = app.slice(app.indexOf("const sec = params.get('sec');"), app.indexOf('const etiquetaEtapa = useCallback('));
  assert.match(ancla, /if \(hallada\) setAbrirSec\(\{ id: hallada\.id \}\);/);
  assert.doesNotMatch(ancla, /setWizard\(/, 'el link volvió a abrir el wizard');
  assert.match(app, /abrir=\{abrirSec\}/);
  // La lista lo aplica eligiendo esa automatización (el lienzo se monta con su key).
  const lista = LISTA();
  assert.match(lista, /if \(abrir && abrir !== abrirVisto && secuencias\.some\(\(j\) => j\.id === abrir\.id\)\) \{\n\s+setAbrirVisto\(abrir\);\n\s+elegir\(abrir\.id\);/);
  // El CONTRATO con quien arma el link (el aviso del hand-off): el parámetro es el que lee la página.
  const aviso = sinComentarios(leer('lib/chat-agent-handoff.ts'));
  const param = aviso.match(/linkApp\(`\/automations\?(\w+)=/)?.[1];
  assert.ok(param, 'el aviso ya no arma un link a /automations');
  assert.ok(app.includes(`params.get('${param}')`), `el aviso manda ?${param}= y la página no lo lee`);
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
//
// ROTURAS de la revisión adversarial (08/10/2026, parte P), con un arnés que rompe, corre y
// restaura DE MEMORIA verificando md5. Sin romper: 14 pass / 0 fail. Las 17 cayeron, cada una
// con 13 pass / 1 fail en el test que la persigue:
//   · datos-4, el panel: `mandarReal` sin el corte de lo ya mandado; ↻ sin vaciar el registro;
//     escribir como el lead sin subir el turno; «MaKo contesta» con otra tarjeta que la del
//     evento; el audio con una tarjeta fija; el server: sin el tope; mandando igual cuando no
//     pudo contar; el aviso decidido sólo por el navegador; el tope contado en otro workspace.
//   · costuras-8: el archivo dibujado como antes (el caption como nombre del documento).
//   · lienzo-3: el destino con el contacto de reportes del negocio; con `getPerfil()` (el
//     perfil «viendo como cliente», que es el del cliente).
//   · lienzo-5: tocar la misma automatización vaciando la edición.
//   · costuras-5: `?sec=` abriendo el wizard; la lista sin el pedido del link; el pedido sin
//     elegir la automatización; la página leyendo otro parámetro que el que arma el aviso.
//
// ROTURAS de la segunda tanda (08/10/2026, parte L: «Probar» en el muelle de `muelles` y la
// pregunta antes de perder lo no publicado). Sin romper: 15 pass / 0 fail:
//   · «Probar» con un ancho propio (560 fijo) en vez del de `muelles`         -> 14 / 1
//   · `elegir` cambiando de automatización sin preguntar con cambios sin publicar -> 14 / 1

// RESTOS, GRUPO RECORDATORIO (10/10/2026): el recordatorio pasó al constructor de una automatización
// y manda el número de cada toque. Base en verde 15 pass / 0 fail; con el mismo arnés:
//   · Publicar sin los números                                                 -> 14 / 1
//   · las esperas abriéndose (`setSel(id)`)                                    -> 14 / 1
//   · la ruta guardando sin los números (`serializarConfig({ activo, textos })`) -> 14 / 1
// El grafo lo ejecuta tests/recordatorio-lienzo.test.ts.

// TERCERA TANDA (09/10/2026, parte E): «Probar» de un canal, la fila con su «⋯». Se mudaron las
// aserciones de este archivo sobre PanelProbar y SimuladorWhatsApp (`onProbar(canal)`, ↻ que vacía
// también la bandeja, `setProbando(null)`, la fila con cinco <span>, las ramas en `ramas`). Las
// roturas de lo nuevo están en tests/panel-probar-ancho.test.ts y tests/chatbot-lista-nueva.test.ts.

// ⚠️ Visto en producción el 08/10/2026: las ramas para elegir iban DEBAJO de la barra para
// escribir, afuera del chat, y en una ventana baja quedaban fuera de la vista (medido: los
// botones a y=557 con la ventana de 566). Van adentro del chat, arriba de la barra, como las
// respuestas rápidas. Probado rompiéndolo: devolver el bloque `{opciones && (` afuera de
// ChatHilo pone rojo este test (1 de 1).
// ⚠️ QUINTA TANDA, PUNTO 1 (09/10/2026): «sigue sola por el «Sí»» CAMBIÓ. La Bienvenida entraba por el
// «Sí» de «Agendó» y no salía ningún mensaje; ahora decide el motor con un lead RECIÉN LLEGADO. Lo
// ejecuta tests/probar-lead-nuevo.test.ts; acá queda que no hay botones y que no se frena.
test('una condición NO frena la prueba y no tiene botones de rama: la decide sola (cuarta tanda 3 y 17; quinta 1)', () => {
  const panel = PANEL();
  // «elimina los botones de "Tiene WhatsApp" y "Si no"... Y lo peor es que esos botones salen en la
  // prueba del Email también». Con una condición primera, la prueba quedaba parada y no salía nada.
  assert.doesNotMatch(panel, /const ramas = |encimaDelComposer=\{ramas\}|Elige la rama/);
  const caso = panel.slice(panel.indexOf("case 'condicion': {"), panel.indexOf("case 'fin':"));
  assert.match(caso, /simRef\.current = r\.estado;/);
  assert.match(caso, /luego\(0, avanzar\);/);
  assert.doesNotMatch(caso, /setOpciones\(|sistema\('◇/, 'volvió la pregunta de la rama');
  // Y «Probar en WhatsApp / Email» está ARRIBA, en la cabecera (antes del cuerpo).
  assert.ok(panel.indexOf("'Probar en WhatsApp'") > 0 && panel.indexOf("'Probar en WhatsApp'") < panel.indexOf('<BandejaGmail'), 'el botón de probar de verdad no está arriba');
});
