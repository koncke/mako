// =============================================================================
// Los Mensajes de MaKo (los flujos de «Notificaciones») viven en /automations — quinta tanda, punto 5
// (lib/chatbot-mensajes-mako.ts, app/automations/MensajeMakoLienzo.tsx, app/automations/SimuladorWhatsApp.tsx,
// app/automations/ChatAgentApp.tsx, app/agencia/PlantillasView.tsx, app/perfil/NotificacionesPanel.tsx,
// app/configuraciones/page.tsx)
// =============================================================================
// Pedido de Martín (09/10/2026), textual: «Y con la implementación de antes, quiero que elimines el
// lienzo en la tab de "Notificaciones", pero que dejes un enlace para editarlo aquí. Y claro, que
// traigas todos los flujos de "Notificaciones" a la tab de chatbot.»
//
// Lo que se puede DIBUJAR se dibuja (renderToStaticMarkup): las filas de la lista, el lienzo que se
// abre por el link, la tab de Notificaciones sin lienzo y con su link. Lo que vive en efectos y en
// el server (la lectura de los mensajes, el guard, la capa) se fija en el fuente sin comentarios.
//
// Desde la novena tanda (10/10/2026) cada fila de un mensaje lleva el MISMO «⋯» que una automatización
// («Las cosas de "MaKo en WhatsApp" deben ser EXACTAMENTE igual al resto»): Activar/Pausar y Eliminar, que
// oculta el mensaje (lo de ocultar y recuperar, en tests/plantillas-ocultas.test.ts).
//
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimuladorWhatsApp, ROTULO_MENSAJES_MAKO, opcionesDeFila, opcionesDeMensaje } from '../app/automations/SimuladorWhatsApp';
import { PlantillasView } from '../app/agencia/PlantillasView';
import type { SecuenciaDto } from '../app/automations/ChatAgentApp';
import type { PlantillaVista } from '../lib/plantillas';
import {
  ENDPOINT_MENSAJES_MAKO, PARAM_AVISO, enlaceAMensajeMako, emojiDeMensaje, mensajeActivo, mensajePedido,
} from '../lib/chatbot-mensajes-mako';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const fuente = (r: string) => sinComentarios(leer(r));

const SECUENCIA = {
  id: 7, clave: 'bienvenida', nombre: 'Bienvenida', etapa: 'nuevo', trigger_tipo: 'etapa',
  activa: true, pasos: [], inscriptos: 0, enviados: 0, estrategia: null, metricas: {},
} as unknown as SecuenciaDto;

const aviso = (id: string, titulo: string, extra: Partial<PlantillaVista> = {}): PlantillaVista => ({
  id, titulo, categoria: 'aviso', prioridad: 'media', semaforo: 'amarillo', requiereRespuesta: false, yaImplementado: 'si',
  disparador: 'Cuando pasa algo', ejemplo: `Texto de ${titulo}`,
  enabled: true, esCustom: false, fijo: false, canales: { wa: true, email: false }, frecuenciaMin: 0, posiciones: {}, borrador: null, asunto: '',
  ...extra,
} as PlantillaVista);

const AVISOS = [
  aviso('reporte-semanal', 'Reporte semanal', { categoria: 'reporte' }),
  aviso('cuota-vencida', 'Cuota vencida', { enabled: false }),
];

const dibujar = (extra: Record<string, unknown> = {}) => renderToStaticMarkup(createElement(SimuladorWhatsApp, {
  secuencias: [SECUENCIA], objetivos: [], etiquetaEtapa: (k: string) => k, negocio: 'Mi negocio',
  rolAdmin: true, audios: [], canalCaido: false, onAudioNuevo: () => {}, onNueva: () => {}, onReload: () => {},
  productos: [], disparadores: [], tz: null,
  ...extra,
} as Parameters<typeof SimuladorWhatsApp>[0]));

// ── El contrato de las dos puntas ───────────────────────────────────────────────

test('el link de Notificaciones y lo que /automations lee son el MISMO parámetro, y sólo abre un mensaje que esta persona ve', () => {
  // Un id con lo que parte una query (`&`, `#`): sin encodear, el parámetro llega cortado.
  const href = enlaceAMensajeMako('mio&otro#x');
  const u = new URL(href, 'https://app.local');
  // La ruta de la tab desde el 09/10/2026 (ex /chatbot, que redirige con la query entera).
  // Roto devolviendo `/chatbot?` a `enlaceAMensajeMako`: 11 / 1 (base 12 / 0).
  assert.equal(u.pathname, '/automations');
  assert.equal(u.searchParams.get(PARAM_AVISO), 'mio&otro#x', 'el id no sobrevive al link (falta encodear)');
  // `mensajePedido`: sólo si está entre los que se leyeron (quien no es admin no tiene ninguno).
  assert.equal(mensajePedido(AVISOS, 'cuota-vencida'), 'cuota-vencida');
  assert.equal(mensajePedido(AVISOS, 'otro'), null);
  assert.equal(mensajePedido(null, 'cuota-vencida'), null, 'sin mensajes leídos, el link no abre nada');
  assert.equal(mensajePedido(AVISOS, null), null);
  // Las dos puntas usan ESTE módulo: Notificaciones arma el link con él y /automations lo lee con él.
  assert.match(fuente('app/perfil/NotificacionesPanel.tsx'), /enlaceEditar=\{editarEnChatbot \? \(p\) => enlaceAMensajeMako\(p\.id\) : undefined\}/);
  assert.match(fuente('app/automations/ChatAgentApp.tsx'), /const id = mensajePedido\(avisos, params\.get\(PARAM_AVISO\)\);/);
});

test('el endpoint es el de Notificaciones (sin abrir uno nuevo), con su guard de admin, y /automations lo pide sólo para el admin', () => {
  assert.equal(ENDPOINT_MENSAJES_MAKO, '/api/perfil/plantillas');
  assert.match(fuente('app/perfil/NotificacionesPanel.tsx'), /const ENDPOINT = '\/api\/perfil\/plantillas';/);
  const ruta = fuente('app/api/perfil/plantillas/route.ts');
  assert.match(ruta, /if \(ws == null \|\| rol !== 'admin'\) \{\n\s+return NextResponse\.json\(\{ ok: false, error: '[^']+' \}, \{ status: 403 \}\);/);
  // GET y POST pasan por el guard antes de hacer nada.
  assert.match(ruta, /export async function GET\(req: NextRequest\) \{\n\s+const no = await denegado\(\);\n\s+if \(no\) return no;/);
  assert.match(ruta, /export async function POST\(req: NextRequest\) \{\n\s+const no = await denegado\(\);\n\s+if \(no\) return no;/);
  const app = fuente('app/automations/ChatAgentApp.tsx');
  assert.match(app, /useEffect\(\(\) => \{ if \(rolAdmin\) void cargarAvisos\(\); \}, \[rolAdmin, cargarAvisos\]\);/);
  assert.match(app, /const r = await fetch\(ENDPOINT_MENSAJES_MAKO, \{ cache: 'no-store' \}\);/);
  // Y la lista no los dibuja sin admin aunque le lleguen.
  assert.match(fuente('app/automations/SimuladorWhatsApp.tsx'), /const avisosLista = useMemo\(\(\) => \(rolAdmin \? avisos \?\? \[\] : \[\]\), \[rolAdmin, avisos\]\);/);
});

// ── La lista de /automations ────────────────────────────────────────────────────────

/**
 * La fila ENTERA que dice `titulo`: de su `chb-fila` a la siguiente. ⚠️ Hasta la novena tanda el recorte
 * terminaba en el NOMBRE, y el «⋯» se dibuja DESPUÉS del nombre (su propia columna): el `doesNotMatch(fila,
 * /Opciones de/)` de entonces daba verde con o sin menú, o sea que no fijaba nada. Lo delató dar vuelta el test.
 */
const filaDe = (html: string, titulo: string): string =>
  html.split('class="chb-fila').slice(1).find((f) => f.includes(`>${titulo}</span>`)) ?? '';

test('cada mensaje es una fila de la lista, bajo su rótulo, con su emoji, su nombre, su punto de prendido y su «⋯»', () => {
  const html = dibujar({ avisos: AVISOS });
  const iRotulo = html.indexOf(`>${ROTULO_MENSAJES_MAKO}</div>`);
  const iBienvenida = html.indexOf('>Bienvenida</span>');
  assert.ok(iRotulo > iBienvenida && iBienvenida > 0, 'el grupo no va debajo de las automatizaciones');
  for (const a of AVISOS) {
    const i = html.indexOf(`>${a.titulo}</span>`);
    assert.ok(i > iRotulo, `«${a.titulo}» no está en la lista, bajo el rótulo`);
    // La fila: el emoji de su categoría y el punto de estado encima (el de las automatizaciones).
    const fila = filaDe(html, a.titulo);
    assert.ok(fila.includes(emojiDeMensaje(a)), `«${a.titulo}» sin el emoji de su categoría`);
    assert.match(fila, new RegExp(`title="${mensajeActivo(a) ? 'Activa' : 'Pausada'}"`), `«${a.titulo}» con el punto equivocado`);
    // ⚠️ CON «⋯» desde la novena tanda (10/10/2026: «Las cosas de "MaKo en WhatsApp" deben ser EXACTAMENTE
    // igual al resto»), en su columna propia después del botón de la fila, como el de una automatización.
    assert.match(fila, new RegExp(`aria-label="Opciones de ${a.titulo}"`), `«${a.titulo}» sin sus tres puntos`);
    assert.match(fila, /<\/button><span class="chb-menu"/, `el «⋯» de «${a.titulo}» no está en su columna, después del botón de la fila`);
  }
  // Un fijo sale siempre aunque su interruptor diga otra cosa.
  assert.equal(mensajeActivo({ enabled: false, fijo: true }), true);
  assert.equal(mensajeActivo({ enabled: false, fijo: false }), false);
});

test('el «⋯» de un mensaje: Activar/Pausar y Eliminar (sin Duplicar ni Copiar flujo), y nada para un fijo', () => {
  // Sale de `opcionesDeFila`: los mismos rótulos y los mismos íconos que el de una automatización.
  assert.deepEqual(opcionesDeMensaje({ activo: true, fijo: false }).map((o) => o.label), ['Pausar', 'Eliminar']);
  assert.deepEqual(opcionesDeMensaje({ activo: false, fijo: false }).map((o) => o.label), ['Activar', 'Eliminar']);
  for (const activo of [true, false]) {
    const deFila = new Map(opcionesDeFila(activo).map((o) => [o.value, o]));
    for (const o of opcionesDeMensaje({ activo, fijo: false })) assert.deepEqual(o, deFila.get(o.value), `«${o.label}» no es la de una automatización`);
  }
  // Un fijo no se apaga ni se esconde: no hay nada que ofrecerle, y la fila va sin «⋯».
  assert.deepEqual(opcionesDeMensaje({ activo: true, fijo: true }), []);
  const html = dibujar({ avisos: [...AVISOS, aviso('meta-sin-datos', 'Dejé de recibir datos', { fijo: true })] });
  assert.ok(filaDe(html, 'Dejé de recibir datos').length > 0, 'no se dibujó la fila del fijo');
  assert.doesNotMatch(filaDe(html, 'Dejé de recibir datos'), /Opciones de/, 'un fijo con «⋯»');
  // El menú es el MISMO Dropdown que el de una automatización (mismos atributos, mismo botón).
  const lista = fuente('app/automations/SimuladorWhatsApp.tsx');
  const menus = lista.split('<Dropdown value="" placeholder="⋯"').slice(1).map((m) => m.slice(0, m.indexOf('/>')));
  assert.equal(menus.length, 2, `hay ${menus.length} «⋯» en la lista`);
  for (const m of menus) {
    assert.match(m, /^ align="afuera" resetAfterSelect sinFlecha search=\{false\}/);
    assert.match(m, /buttonStyle=\{ESTILO_BOTON_MENU\}/);
  }
  assert.match(menus[1], /ariaLabel=\{`Opciones de \$\{a\.titulo\}`\} disabled=\{ocupada === a\.id\}/);
  assert.match(menus[1], /options=\{opciones\}\n\s+onChange=\{\(v\) => void accionMensaje\(a, v\)\}/);
  assert.match(lista, /const opciones = opcionesDeMensaje\(\{ activo: mensajeActivo\(a\), fijo: a\.fijo \}\);/);
  assert.match(lista, /menu=\{rolAdmin && opciones\.length > 0 \? \(/);
});

test('las acciones de un mensaje: Activar/Pausar por su puerta de siempre, Eliminar pregunta IGUAL que una automatización y OCULTA', () => {
  const lista = fuente('app/automations/SimuladorWhatsApp.tsx');
  const accion = lista.slice(lista.indexOf('const accionMensaje = async'), lista.indexOf('const eliminarMensaje = async'));
  assert.ok(accion.length > 200 && accion.length < 1500, `el recorte de accionMensaje mide ${accion.length}`);
  assert.match(accion, /if \(accion === 'eliminar'\) \{ setErrFila\(null\); setMensajeAEliminar\(a\); return; \}/, 'Eliminar sin preguntar');
  assert.match(accion, /pedir\(ENDPOINT_MENSAJES_MAKO, 'POST', \{ action: 'enabled', id: a\.id, enabled: !mensajeActivo\(a\) \}\)/);
  assert.match(accion, /setErrFila\(\{ id: a\.id, texto: r\.error \|\| 'No se pudo cambiar' \}\)/);
  assert.match(accion, /onAvisosCambio\?\.\(\);/, 'la lista no se vuelve a leer');
  const eliminar = lista.slice(lista.indexOf('const eliminarMensaje = async'), lista.indexOf('const raiz = useRef'));
  assert.ok(eliminar.length > 200 && eliminar.length < 1500, `el recorte de eliminarMensaje mide ${eliminar.length}`);
  assert.match(eliminar, /pedir\(ENDPOINT_MENSAJES_MAKO, 'POST', \{ action: 'ocultar', id: a\.id \}\)/);
  // El que estaba abierto se cierra (queda la automatización de debajo), y se releen la lista y los ocultos.
  assert.match(eliminar, /if \(a\.id === avisoSel\) setAvisoSel\(null\);\n\s+onAvisosCambio\?\.\(\);\n\s+onOcultosCambio\?\.\(\);/);
  // La MISMA confirmación: la misma frase, el mismo «No eliminar», el mismo tono.
  const conf = (desde: string) => lista.slice(lista.indexOf(desde), lista.indexOf('/>', lista.indexOf(desde)));
  const deSec = conf('message={`«${aEliminar.nombre}»');
  const deMsj = conf('message={`«${mensajeAEliminar.titulo}»');
  assert.ok(deSec.length > 0 && deMsj.length > 0, 'falta una de las dos confirmaciones');
  const sinSujeto = (c: string) => c.replace(/\$\{\w+\.(nombre|titulo)\}/, '${X}').replace(/onConfirm=[\s\S]*$/, '').replace(/"Eliminar (automatización|mensaje)"/, '"Eliminar …"');
  assert.equal(sinSujeto(deMsj), sinSujeto(deSec), 'la confirmación de un mensaje no es la de una automatización');
  assert.match(deMsj, /onConfirm=\{\(\) => void eliminarMensaje\(\)\} onCancel=\{\(\) => setMensajeAEliminar\(null\)\}/);
  // Lo ocupado y el error de la fila llevan el id de cualquiera de las dos (número o texto).
  assert.match(lista, /const \[ocupada, setOcupada\] = useState<number \| string \| null>\(null\);/);
  assert.match(lista, /const \[errFila, setErrFila\] = useState<\{ id: number \| string; texto: string \} \| null>\(null\);/);
  assert.match(lista, /\{errFila\?\.id === a\.id && <div role="alert"/, 'el error de un mensaje no queda pegado a su fila');
  // Y el tacho del lienzo del mensaje es ESTE Eliminar (no el borrado de antes, sin preguntar).
  const montaje = lista.slice(lista.indexOf('<MensajeMakoLienzo key={aviso.id}'), lista.indexOf('/>', lista.indexOf('<MensajeMakoLienzo key={aviso.id}')));
  assert.match(montaje, /onEliminar=\{\(\) => \{ setErrFila\(null\); setMensajeAEliminar\(aviso\); \}\}/, 'el tacho del lienzo no es el Eliminar de la lista');
  assert.match(fuente('app/automations/MensajeMakoLienzo.tsx'), /onClose=\{onCerrar\}\n\s+onEliminar=\{onEliminar\}/);
  const modal = fuente('app/agencia/TemplateDetalleModal.tsx');
  const elim = modal.slice(modal.indexOf('const eliminar = async'), modal.indexOf('const probar = async'));
  assert.ok(elim.indexOf('if (onEliminar) { onEliminar(); return; }') > 0, 'el tacho no pasa por el Eliminar de la lista');
  assert.ok(elim.indexOf('if (onEliminar) { onEliminar(); return; }') < elim.indexOf("action: 'borrar'"), 'el tacho borra antes de preguntarle a la lista');
});

test('el lienzo del mensaje vuelve a leer el interruptor y el nombre de las props (el «⋯» los cambia sin remontarlo)', () => {
  // Sin DOM en los tests de esta casa: un render estático siembra siempre de la prop. Se fija el ajuste AL
  // DIBUJAR (el patrón de SecuenciaPerfil, `activaVista`), y que el nombre no pise lo que se está tipeando.
  const modal = fuente('app/agencia/TemplateDetalleModal.tsx');
  assert.match(modal, /if \(plantilla && plantilla\.enabled !== enabledVisto\) \{ setEnabledVisto\(plantilla\.enabled\); setEnabled\(plantilla\.enabled\); \}/);
  assert.match(modal, /if \(plantilla && plantilla\.titulo !== tituloVisto\) \{ setTituloVisto\(plantilla\.titulo\); if \(!editandoTitulo\) setTitulo\(plantilla\.titulo\); \}/);
  // Y el ajuste va antes del primer uso del interruptor (el `toggle`), no en un efecto.
  assert.ok(modal.indexOf('plantilla.enabled !== enabledVisto') < modal.indexOf('const toggle = async'));
  assert.doesNotMatch(modal, /useEffect\(\(\) => \{[^}]*setEnabled\(/, 'el interruptor se resiembra en un efecto (pinta primero el viejo)');
});

test('quien no es admin no ve ningún mensaje (el endpoint le contesta 403), y sin mensajes no hay rótulo', () => {
  const html = dibujar({ avisos: AVISOS, rolAdmin: false });
  assert.doesNotMatch(html, />Reporte semanal<|>Cuota vencida</);
  assert.doesNotMatch(html, new RegExp(`>${ROTULO_MENSAJES_MAKO}</div>`));
  assert.doesNotMatch(dibujar({ avisos: [], rolAdmin: false }), new RegExp(`>${ROTULO_MENSAJES_MAKO}</div>`));
  // Un admin sin mensajes SÍ ve el rótulo, con su «＋ Nuevo mensaje» (10/10/2026: «por el botón de "Nueva"
  // también abajo en la sección de MaKo en WhatsApp»): sin el rótulo no tendría dónde crear el primero.
  const vacio = dibujar({ avisos: [] });
  assert.match(vacio, new RegExp(`>${ROTULO_MENSAJES_MAKO}</div>`));
  assert.ok(vacio.indexOf('>Nuevo mensaje</span>') > vacio.indexOf(`>${ROTULO_MENSAJES_MAKO}</div>`), 'falta «＋ Nuevo mensaje» bajo su rótulo');
});

test('el link `?aviso=` abre el lienzo de ESE mensaje en /automations: el MISMO editor de Notificaciones, con el inset de la lista', () => {
  const html = dibujar({ avisos: AVISOS, abrirAviso: { id: 'cuota-vencida' } });
  assert.match(html, /data-mensaje-mako="cuota-vencida"/, 'el link no abrió el lienzo del mensaje');
  // Es el detalle de siempre (su «Publicar» y su «Activar»), y la automatización no está montada.
  assert.match(html, />Publicar</);
  assert.match(html, />Activar</);
  // La fila del mensaje queda elegida y la de la automatización no.
  const iAviso = html.indexOf('>Cuota vencida</span>');
  assert.match(html.slice(html.lastIndexOf('<div class="chb-fila', iAviso), iAviso), /is-on/);
  const iSec = html.indexOf('>Bienvenida</span>');
  assert.doesNotMatch(html.slice(html.lastIndexOf('<div class="chb-fila', iSec), iSec), /is-on/);
  // Un id que no está entre los que ve no abre nada.
  assert.doesNotMatch(dibujar({ avisos: AVISOS, abrirAviso: { id: 'otro' } }), /data-mensaje-mako=/);
  assert.doesNotMatch(dibujar({ avisos: AVISOS, rolAdmin: false, abrirAviso: { id: 'cuota-vencida' } }), /data-mensaje-mako=/);
});

test('el lienzo embebido: el detalle de Notificaciones con su endpoint, sin marco, del alto de la caja y con `insetIzq` hasta el lienzo', () => {
  const m = fuente('app/automations/MensajeMakoLienzo.tsx');
  assert.match(m, /<TemplateDetalleModal\n\s+plantilla=\{plantilla\}\n\s+endpoint=\{ENDPOINT_MENSAJES_MAKO\}\n\s+alto="100%" marco=\{false\} insetIzq=\{insetIzq\}/);
  // El alto sale de una caja ABSOLUTA (definido en todos los motores), no del 100 % contra un flex.
  assert.match(m, /<div style=\{\{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column' \}\}>/);
  // El inset viaja entero: lista → detalle → lienzo del aviso → Lienzo.
  assert.match(fuente('app/automations/SimuladorWhatsApp.tsx'), /<MensajeMakoLienzo key=\{aviso\.id\} plantilla=\{aviso\} insetIzq=\{m\.insets\.izq\}/);
  assert.match(fuente('app/agencia/TemplateDetalleModal.tsx'), /<FlujoAviso\n\s+id=\{id\}\n\s+insetIzq=\{insetIzq\}/);
  assert.match(fuente('app/agencia/FlujoAviso.tsx'), /sinMarco alto="100%" insetIzq=\{insetIzq\}/);
  // Sin `onVerChat`: la vista del chat se quedó en Notificaciones, y el detalle no dibuja su botón.
  assert.doesNotMatch(m, /onVerChat/);
});

test('con un mensaje abierto, tocar una automatización vuelve a ella (aunque sea la que quedó elegida debajo), y lo no publicado se pregunta', () => {
  const lista = fuente('app/automations/SimuladorWhatsApp.tsx');
  assert.match(lista, /const elegirDeLaLista = \(id: number\) => \{\n\s+if \(avisoSel != null\) \{ setAvisoSel\(null\); if \(id === selId\) return; \}\n\s+elegir\(id\);/);
  assert.match(lista, /onClick=\{\(\) => elegirDeLaLista\(j\.id\)\}/);
  // Abrir un mensaje con cambios sin publicar en la automatización pasa por el Confirm de siempre.
  assert.match(lista, /const elegirAviso = \(id: string\) => \{\n\s+if \(id === avisoSel\) return;\n\s+if \(sinPublicar\) \{ setPendiente\(\{ ir: 'aviso', aviso: id \}\); return; \}\n\s+abrirAvisoYa\(id\);/);
  assert.match(lista, /else if \(p\.ir === 'aviso'\) \{ if \(p\.aviso\) abrirAvisoYa\(p\.aviso\); \}/);
  // Elegir una automatización suelta el mensaje (`cambiarA`), y «＋ Nueva» o un `?sec=` también.
  assert.match(lista, /setSelId\(id\); setProbando\(null\); setEdicion\(null\); setAvisoSel\(null\);/);
  assert.match(lista, /elegir\(abrir\.id\);\n\s+setAvisoSel\(null\);/);
});

test('sin automatizaciones pero con mensajes, /automations dibuja la lista (el link tiene que aterrizar en su lienzo)', () => {
  const app = fuente('app/automations/ChatAgentApp.tsx');
  assert.match(app, /const hayAvisos = rolAdmin && \(avisos\?\.length \?\? 0\) > 0;/);
  assert.match(app, /avisos=\{avisos\} abrirAviso=\{abrirAviso\} onAvisosCambio=\{\(\) => void cargarAvisos\(\)\}/);
  // Y la lista se dibuja sin automatizaciones: la fila del mensaje está.
  const html = dibujar({ secuencias: [], avisos: AVISOS });
  assert.ok(html.includes('>Reporte semanal</span>'));
});

test('el link de Notificaciones no se queda en el QR de un negocio sin WhatsApp vinculado: ahí es el único lugar donde se edita', () => {
  const app = fuente('app/automations/ChatAgentApp.tsx');
  assert.match(app, /const vieneAUnMensaje = params\.get\(PARAM_AVISO\) != null;\n\s+if \(enOnboarding && !vieneAUnMensaje\) \{/);
  // Y la puerta del QR sigue igual para todo lo demás (lib/chatbot-puerta.ts).
  assert.ok(app.includes('const calculada = abreEnQR({ onboarding, canal: estadoCanal });'));
});

// ── La tab de Notificaciones ────────────────────────────────────────────────────
// PlantillasView elige su primer mensaje en un EFECTO, que un render estático no corre: lo que se
// dibuja se mira donde se puede (la lista, el alta) y la rama del lienzo se fija en el fuente.

// Sus props son opcionales con `= {}`, y con eso `createElement` no infiere el tipo: se le dice.
type PropsVista = { endpoint: string; iniciales: PlantillaVista[]; enlaceEditar?: (p: PlantillaVista) => string };
const Vista = PlantillasView as unknown as (p: PropsVista) => ReturnType<typeof PlantillasView>;
const dibujarPlantillas = (extra: Pick<PropsVista, 'enlaceEditar'> = {}) => renderToStaticMarkup(createElement(Vista, {
  endpoint: ENDPOINT_MENSAJES_MAKO, iniciales: AVISOS, ...extra,
}));

test('en Notificaciones el lienzo SE VA y queda «Editar en Automations», un link a ESE mensaje; lo demás se queda', () => {
  const pv = fuente('app/agencia/PlantillasView.tsx');
  // Con `enlaceEditar`, el detalle (el lienzo) se monta SÓLO para el alta, que es un formulario.
  assert.match(pv, /\{creando \|\| \(!enlaceEditar && vista === 'editar' && sel\) \? \(\n\s+<TemplateDetalleModal/, 'el lienzo sigue en Notificaciones');
  // Y el encabezado del chat lleva el link (el Link de la casa, con el `?ws=`) a ESE mensaje.
  const cabecera = pv.slice(pv.indexOf('header={enlaceEditar ? ('), pv.indexOf(') : (', pv.indexOf('header={enlaceEditar ? (')));
  assert.ok(cabecera.length > 0 && cabecera.length < 2500, `el recorte del encabezado mide ${cabecera.length}`);
  assert.match(cabecera, /<Link href=\{enlaceEditar\(sel\)\}/);
  // El nombre de la tab desde el 09/10/2026 (sexta tanda, General 1: «Chatbot» → «Automations»).
  // Roto devolviendo «Editar en Chatbot ↗» a PlantillasView: 11 / 1 (base 12 / 0).
  assert.match(cabecera, />Editar en Automations ↗<\/Link>/);
  assert.doesNotMatch(cabecera, /setVista\('editar'\)|toca para editar/, 'el encabezado promete un gesto que acá no existe');
  assert.match(pv, /^import Link from '@\/app\/_ui\/Link';$/m);
  // Lo que no es el lienzo se queda: la lista, el buscador y el alta.
  const html = dibujarPlantillas({ enlaceEditar: (p: PlantillaVista) => enlaceAMensajeMako(p.id) });
  assert.match(html, /placeholder="Buscar por título o texto…"/);
  assert.match(html, />Crear nueva plantilla</);
  assert.ok(html.includes('>Cuota vencida<'), 'se fue la lista');
});

test('sin `enlaceEditar` (el catálogo de la agencia en /mensajes, o un negocio sin /automations) se sigue editando en el lugar', () => {
  const pv = fuente('app/agencia/PlantillasView.tsx');
  // La rama de siempre sigue: el «Editar» abre el detalle acá mismo.
  assert.match(pv, /onClick=\{\(\) => setVista\('editar'\)\} title="Editar plantilla"/);
  // /mensajes no lo pasa: es el catálogo entero de la agencia, que /automations no lista.
  assert.doesNotMatch(fuente('app/mensajes/MensajesMaKo.tsx'), /enlaceEditar/);
  assert.match(fuente('app/mensajes/MensajesMaKo.tsx'), /<PlantillasView iniciales=\{iniciales\} \/>/);
});

test('el link aparece sólo si el negocio tiene /automations: lo decide el server con la MISMA regla que el guard de /automations', () => {
  const nav = /requireRolWs\(\[[^\]]*\], \{ nav: '(\w+)' \}\)/.exec(fuente('app/automations/page.tsx'))?.[1];
  assert.ok(nav, 'la página de /automations ya no se guarda con una capa');
  const page = fuente('app/configuraciones/page.tsx');
  assert.ok(page.includes(`const mensajesEnChatbot = tabEnCapa('${nav}', await getCapaActual());`), 'Configuraciones no pregunta por la misma tab que el guard de /automations');
  assert.match(page, /<ConfigInnerTabs equipoPanel=\{equipoPanel\} mensajesEnChatbot=\{mensajesEnChatbot\} \/>/);
  assert.match(fuente('app/configuraciones/ConfigInnerTabs.tsx'), /<NotificacionesPanel editarEnChatbot=\{mensajesEnChatbot\} \/>/);
});

// ROTURAS (09/10/2026), una por vez, con el arnés del pie de tests/chatbot-lista-filtro.test.ts (los
// tres archivos de la lista, 33 tests; restaura DE MEMORIA y verifica con md5). Sin romper: 33 / 0.
// Las de este archivo (pass / fail):
//   · M1 /automations pide los mensajes sin ser admin: 32 / 1 · M2 la lista los dibuja sin admin: 31 / 2
//   · M3 sin el rótulo del grupo: 32 / 1 · M4 el link `?aviso=` no abre nada: 32 / 1
//   · M5 el lienzo embebido sin `insetIzq`: 32 / 1 · M6 el lienzo del aviso no lo pasa al Lienzo: 32 / 1
//   · M7 Notificaciones sigue montando el lienzo: 32 / 1 · M8 Notificaciones sin el link: 32 / 1
//   · M9 Configuraciones pregunta por otra tab que la del guard de /automations: 32 / 1
//   · M10 el link con otro parámetro que el que lee /automations: 32 / 1 · M14 el id sin encodear: 32 / 1
//     (la primera versión daba VERDE: probaba con un espacio y una barra, que la URL tolera)
//   · M11 sin automatizaciones no hay lista: 32 / 1 · M12 con un mensaje abierto, tocar la automatización
//     de abajo no vuelve: 32 / 1 · M13 la automatización sigue elegida con un mensaje abierto: 32 / 1
//   · M15 (con el test del QR ya sumado: 34 tests) el link se queda en el QR: 33 / 1
//
// NOVENA TANDA (10/10/2026): la fila de un mensaje TIENE «⋯» (dio vuelta el «sin "⋯"» de la quinta). ⚠️ El
// test viejo daba VERDE con el menú ya dibujado (379 / 0 sobre las suites del área): su recorte de la fila
// terminaba en el nombre y el «⋯» va después, en su columna. Ahora se mira la fila entera (`filaDe`).
// Roturas con el arnés del pie de tests/plantillas-ocultas.test.ts (los dos archivos, 30 tests; base 30 / 0):
//   · R23 la fila sin «⋯» (lo de la quinta): 28 / 2 · R24 el «⋯» de un mensaje con Duplicar: 29 / 1
//   · R25 un fijo con «⋯»: 29 / 1 · R26 Eliminar sin preguntar: 29 / 1 · R27 el mensaje abierto no se
//     cierra al eliminarlo: 29 / 1 · R28 otra confirmación que la de una automatización: 29 / 1
//   · R29 el «⋯» de un mensaje con otro botón: 29 / 1 · R30 lo ocupado sólo para un id numérico: 29 / 1
//   · R31 el tacho del lienzo no llega a la lista: 29 / 1 · R32 el tacho borra sin preguntar: 29 / 1
//   · R33 el interruptor del lienzo no se resiembra: 29 / 1 · R34 el nombre pisa lo que se tipea: 29 / 1
