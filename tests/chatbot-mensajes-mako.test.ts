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
// PROBADO ROMPIÉNDOLO: ver `ROTURAS` al pie.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SimuladorWhatsApp, ROTULO_MENSAJES_MAKO } from '../app/automations/SimuladorWhatsApp';
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

test('cada mensaje es una fila de la lista, bajo su rótulo, con su emoji, su nombre y su punto de prendido', () => {
  const html = dibujar({ avisos: AVISOS });
  const iRotulo = html.indexOf(`>${ROTULO_MENSAJES_MAKO}</div>`);
  const iBienvenida = html.indexOf('>Bienvenida</span>');
  assert.ok(iRotulo > iBienvenida && iBienvenida > 0, 'el grupo no va debajo de las automatizaciones');
  for (const a of AVISOS) {
    const i = html.indexOf(`>${a.titulo}</span>`);
    assert.ok(i > iRotulo, `«${a.titulo}» no está en la lista, bajo el rótulo`);
    // La fila: el emoji de su categoría y el punto de estado encima (el de las automatizaciones).
    const fila = html.slice(html.lastIndexOf('<div class="chb-fila', i), i);
    assert.ok(fila.includes(emojiDeMensaje(a)), `«${a.titulo}» sin el emoji de su categoría`);
    assert.match(fila, new RegExp(`title="${mensajeActivo(a) ? 'Activa' : 'Pausada'}"`), `«${a.titulo}» con el punto equivocado`);
    // Sin «⋯»: no son filas de secuencias (no se duplican ni se archivan desde acá).
    assert.doesNotMatch(fila, /Opciones de/);
  }
  // Un fijo sale siempre aunque su interruptor diga otra cosa.
  assert.equal(mensajeActivo({ enabled: false, fijo: true }), true);
  assert.equal(mensajeActivo({ enabled: false, fijo: false }), false);
});

test('quien no es admin no ve ningún mensaje (el endpoint le contesta 403), y sin mensajes no hay rótulo', () => {
  const html = dibujar({ avisos: AVISOS, rolAdmin: false });
  assert.doesNotMatch(html, />Reporte semanal<|>Cuota vencida</);
  assert.doesNotMatch(html, new RegExp(`>${ROTULO_MENSAJES_MAKO}</div>`));
  assert.doesNotMatch(dibujar({ avisos: [] }), new RegExp(`>${ROTULO_MENSAJES_MAKO}</div>`));
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
  assert.match(lista, /const elegirDeLaLista = \(id: number \| typeof ID_RECORDATORIO\) => \{\n\s+if \(avisoSel != null\) \{ setAvisoSel\(null\); if \(id === selId\) return; \}\n\s+elegir\(id\);/);
  assert.match(lista, /onClick=\{\(\) => elegirDeLaLista\(j\.id\)\}/);
  assert.match(lista, /onClick=\{\(\) => elegirDeLaLista\(ID_RECORDATORIO\)\}/);
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
