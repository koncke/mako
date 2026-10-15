// =============================================================================
// El editor de email tipo Gmail: una columna, el editor rico, el «De» elegible y el modo HTML
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 4): «crea el editor de Email, con la interfaz de
// Gmail, que se parezca». Tercera tanda (09/10/2026, punto 12 y decisión 12): «que no esté una cosa al
// costado y el editable en el otro costado... copies el editor de texto que tenemos en las descripciones
// de las clases de la tab de cursos, donde se puede poner de todo».
//
// ⚠️ LA CUARTA TANDA (09/10/2026, punto 16) CAMBIÓ LO QUE ESTE TEST FIJABA: «Debajo de ASUNTO, hay un
// editable de "Vista previa"… eliminalo. Y también elimina el botón del ojo de "Así llega"… si le quiero
// editar tipo HTML debería poder… Abajo del todo pusiste "MaKo…" eso no tiene sentido… los botones de
// abajo del todo de "{}" y emoji, deberían estar… donde están las negritas». Antes este test exigía la
// «Vista previa», el ojo con su iframe, la firma con el nombre del remitente y el De de sólo lectura.
//
// Lo que fija ahora:
//   · UNA columna, como redactar en Gmail: Mensaje nuevo, De, Para, Asunto y el cuerpo; SIN «Vista
//     previa» ni el ojo (el correo como llega se mira en «Probar»), y sin barra abajo del cuerpo;
//   · el cuerpo es el editor rico de las lecciones (por `editor-rico-perezoso`, nunca con un import
//     estático que lo meta en el chunk de /automations), sin subir adjuntos, con «{ }», el emoji y «</>» en
//     SU barra de formato (`botonesExtra`);
//   · un cambio del cuerpo trae `cuerpo_html` y el `cuerpo` DERIVADO; el modo HTML pasa cada tecla por
//     la MISMA lista blanca (`sanearHtmlEmail`) antes de llegar al paso;
//   · `paramsDeVista` (lo usa «Probar») arma el correo con las MISMAS reglas que el envío, y la firma es
//     el NEGOCIO (`firmaDelPie`), como en el motor. El guard mira LOS DOS lados;
//   · el De elige entre los vinculados con la MISMA función que usa el motor, y «Vincular nuevo» monta
//     el flujo de /email (`DominioSetup`) a demanda, en un portal.
//
// ── Roturas ── al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorEmailGmail, paramsDeVista, nombreDelRemitente, avisoDelRemitente, htmlLegible, AVISO_REEMPLAZA } from '../app/automations/EditorEmailGmail';
import { renderEmailHtml } from '../lib/email-html';
import { SIN_EMAIL_PROPIO } from '../lib/email-remitente';
import { sanearHtmlEmail } from '../lib/email-html-seguro';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const GMAIL = sinComentarios(leer('app/automations/EditorEmailGmail.tsx'));

const dibujar = (p: Partial<Parameters<typeof EditorEmailGmail>[0]> = {}) => renderToStaticMarkup(createElement(EditorEmailGmail, {
  asunto: 'Tu visita', preheader: 'Te espero el lunes', cuerpo: 'Hola', negocio: 'Inmobiliaria del Valle', onChange: () => {}, ...p,
}));

// ── La vista de cómo llega («Probar») = el envío ─────────────────────────────────────────────

test('la vista de cómo llega arma el mail con las reglas del motor, y firma con el NEGOCIO', () => {
  const v = paramsDeVista({ asunto: '', preheader: '', cuerpo: 'Hola {{nombre}}, te escribo de {{negocio}}', negocio: ' Inmobiliaria del Valle ', remitente: 'Ana Pérez <ana@valle.mx>' });
  assert.equal(v.subject, '(sin asunto)', 'el motor manda «(sin asunto)»');
  assert.equal(v.preheader, undefined, 'un preheader vacío no va');
  assert.equal(v.bodyText, 'Hola {{nombre}}, te escribo de Inmobiliaria del Valle', 'el nombre lo pone el envío para cada lead');
  assert.equal(v.fromName, 'Inmobiliaria del Valle', 'la firma es el negocio, no el nombre del remitente (punto 16)');
  assert.ok(!('bodyHtml' in v), 'sin cuerpo HTML (un email de antes), el correo de siempre');
  const w = paramsDeVista({ asunto: 'Tu visita en {{negocio}}', preheader: 'Te espero', cuerpo: 'x', remitente: 'MaKo <equipo@hola-mako.com>' });
  assert.equal(w.subject, 'Tu visita en {{negocio}}', 'sin negocio cargado, el token queda crudo: así llega');
  assert.equal(w.preheader, 'Te espero', 'el preheader guardado sigue saliendo aunque ya no se edite');
  assert.equal(w.fromName, '', 'sin negocio no se firma, y menos con «MaKo»');
  // Con el cuerpo del editor rico: va como HTML, con `{{negocio}}` resuelto POR CONTEXTO.
  const h = paramsDeVista({ asunto: 'a', preheader: '', cuerpo: 'Hola', cuerpoHtml: '<p>De <strong>{{negocio}}</strong>, <a href="https://valle.mx/?de={{negocio}}">aquí</a> {{nombre}}</p>', negocio: 'Valle & Co' });
  assert.equal(h.bodyHtml, '<p>De <strong>Valle &amp; Co</strong>, <a href="https://valle.mx/?de=Valle%20%26%20Co" target="_blank" rel="noopener noreferrer">aquí</a> {{nombre}}</p>');
});

test('el motor arma el email con las MISMAS reglas (los dos lados del contrato)', () => {
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(motor, /const asunto = aplicarVariables\(paso\.asunto \?\? '', vars\) \|\| '\(sin asunto\)';/);
  assert.match(motor, /preheader: aplicarVariables\(paso\.preheader \?\? '', vars\) \|\| undefined,/);
  assert.match(motor, /fromName: firmaDelPie\(negocio\),/, 'el motor firma con otra cosa que el negocio');
  assert.match(GMAIL, /fromName: firmaDelPie\(p\.negocio\),/, 'la vista firma con otra cosa que el negocio');
  assert.match(motor, /\.\.\.\(html \? \{ bodyHtml: aplicarVariablesHtml\(html, vars\) \} : \{\}\),/, 'el cuerpo HTML con la misma función de variables');
  assert.match(GMAIL, /\.\.\.\(p\.cuerpoHtml \? \{ bodyHtml: aplicarVariablesHtml\(p\.cuerpoHtml, vars\) \} : \{\}\),/);
  // El nombre visible del remitente (lo que el lead ve como «De» en «Probar»): el editor no puede
  // importar lib/resend.ts (server-only), así que repite la regla. Se compara el CUERPO, no un parecido.
  const resend = sinComentarios(leer('lib/resend.ts'));
  const deMotor = resend.slice(resend.indexOf('export function displayNameDe('), resend.indexOf('\n}\n', resend.indexOf('export function displayNameDe(')));
  const delEditor = GMAIL.slice(GMAIL.indexOf('export function nombreDelRemitente('), GMAIL.indexOf('\n}\n', GMAIL.indexOf('export function nombreDelRemitente(')));
  const cuerpo = (f: string) => f.slice(f.indexOf('{') + 1).trim();
  assert.ok(deMotor.length > 40 && delEditor.length > 40, 'no encontré las dos funciones');
  assert.equal(cuerpo(delEditor), cuerpo(deMotor), 'el nombre visible del editor y el del motor se separaron');
  assert.equal(nombreDelRemitente('"Ana" <a@b.c>'), 'Ana');
});

// ── Una columna, como redactar en Gmail ──────────────────────────────────────────────────────

test('una sola columna, en el orden de Gmail, SIN «Vista previa», sin el ojo y sin barra abajo', () => {
  const html = dibujar();
  const orden = ['Mensaje nuevo', '>De<', '>Para<', '>El lead<', 'aria-label="Asunto"', 'class="mk-gmail-cuerpo"'];
  let desde = -1;
  for (const t of orden) {
    const i = html.indexOf(t);
    assert.ok(i > desde, `«${t}» no está, o no está DEBAJO de lo anterior`);
    desde = i;
  }
  assert.ok(!html.includes('Vista previa'), 'volvió la «Vista previa» (punto 16: «eliminalo»)');
  assert.ok(!html.includes('Te espero el lunes'), 'el preheader se sigue dibujando');
  assert.ok(!html.includes('Ver cómo llega el correo') && !html.includes('<iframe'), 'volvió el ojo «Así llega» (punto 16)');
  assert.doesNotMatch(GMAIL, /verLlega|IconOjo|renderEmailHtml\(/, 'quedó el ojo en el fuente');
  assert.ok(!html.includes('Insertar un dato en el cuerpo'), 'volvió la barra de abajo con «{ }» (punto 16: va arriba, en la de formato)');
  assert.doesNotMatch(GMAIL, /grid-template-columns/, 'volvió la vista partida en dos columnas');
  assert.doesNotMatch(GMAIL, /height:\s*'100%'|height:100%/, 'contra un alto indefinido Safari da cero (AGENTS.md)');
});

test('el cuerpo es el editor rico de las lecciones, cargado a demanda, con «{ }», emoji y «</>» en SU barra', () => {
  assert.match(GMAIL, /import \{ EditorRicoPerezoso \} from '\.\.\/customer-success\/curso\/editor-rico-perezoso';/);
  assert.doesNotMatch(GMAIL, /from '@\/app\/_ui\/EditorRico'|from '\.\.\/_ui\/EditorRico'/, 'un import estático mete TipTap en el chunk de /automations');
  assert.doesNotMatch(GMAIL, /agencia\/EditorMensaje/, 'el editor de marcas de antes ya no es el cuerpo');
  const montaje = GMAIL.slice(GMAIL.indexOf('<EditorRicoPerezoso'), GMAIL.indexOf('/>', GMAIL.indexOf('<EditorRicoPerezoso')));
  assert.ok(montaje.length > 60, 'no encontré el montaje del editor rico');
  assert.match(montaje, /valor=\{modo === 'html' \? congelado : valorHtml\}/, 'en el modo HTML el editor recargaría el documento en cada tecla');
  assert.match(montaje, /onCambio=\{alCambiarCuerpo\}/);
  assert.match(montaje, /urlDeAdjunto=\{sinAdjuntos\}/);
  assert.match(montaje, /botonesExtra=\{botonesBarra\}/, '«{ }», el emoji y el HTML no están en la barra de formato');
  assert.doesNotMatch(montaje, /subirAdjunto/, 'el bucket del editor es privado: una imagen subida se vería rota en el correo');
  assert.match(montaje, /etiqueta="Cuerpo del email"/);
  const barra = GMAIL.slice(GMAIL.indexOf('const botonesBarra: BotonBarra[] = ['), GMAIL.indexOf('];', GMAIL.indexOf('const botonesBarra: BotonBarra[] = [')));
  assert.deepEqual([...barra.matchAll(/id: '([a-z]+)'/g)].map((m) => m[1]), ['dato', 'emoji', 'html']);
  assert.match(barra, /accion: \(el\) => abrirEn\('datos-cuerpo', el\)/);
  assert.match(barra, /accion: \(el\) => abrirEn\('emoji', el\)/);
  assert.match(barra, /activo: false, accion: \(\) => entrarHtml\(\)/);
});

test('un cambio del cuerpo trae el HTML y el texto DERIVADO; un email de antes abre como HTML', () => {
  const alCambiar = GMAIL.slice(GMAIL.indexOf('const alCambiarCuerpo = '), GMAIL.indexOf('};', GMAIL.indexOf('const alCambiarCuerpo = ')));
  assert.match(alCambiar, /const texto = textoDeHtmlEmail\(html\);/, 'el texto de respaldo sale de la función del server');
  assert.match(alCambiar, /setCopia\(\{ cuerpo: texto, html \}\);\s*onChange\(\{ cuerpo_html: html, cuerpo: texto \}\);/,
    'la copia se actualiza ANTES de avisar: si no, su propio cambio la re-siembra del texto y el editor se recarga en cada tecla');
  assert.match(GMAIL, /html: cuerpoHtml \|\| htmlDeCuerpoTexto\(cuerpo\)/, 'un email de antes abre con sus marcas como HTML');
  assert.match(GMAIL, /if \(!cuerpoHtml && cuerpo !== copia\.cuerpo\) setCopia\(\{ cuerpo, html: htmlDeCuerpoTexto\(cuerpo\) \}\);/);
  assert.match(GMAIL, /const valorHtml = cuerpoHtml \|\| copia\.html;/, 'lo que pasa quien monta manda');
});

// ── El modo HTML ─────────────────────────────────────────────────────────────────────────────

test('el modo HTML: cada tecla pasa por la MISMA lista blanca, y el editor rico se esconde (no se desmonta)', () => {
  const crudo = GMAIL.slice(GMAIL.indexOf('const alCambiarCrudo = '), GMAIL.indexOf('};', GMAIL.indexOf('const alCambiarCrudo = ')));
  assert.match(crudo, /setCrudo\(raw\);\s*alCambiarCuerpo\(sanearHtmlEmail\(raw\)\);/, 'lo escrito en HTML llega al paso sin el saneo');
  assert.match(GMAIL, /const entrarHtml = \(\) => \{ setCongelado\(valorHtml\); setCrudo\(htmlLegible\(valorHtml\)\);/);
  assert.match(GMAIL, /className="mk-gmail-cuerpo" style=\{modo === 'html' \? \{ display: 'none' \} : undefined\}/, 'el editor rico se desmonta y pierde su deshacer');
  assert.match(GMAIL, /<textarea ref=\{campoHtml\} className="mk-gmail-html" value=\{crudo\}/);
  assert.match(GMAIL, /aria-label="HTML del email" onChange=\{\(e\) => alCambiarCrudo\(e\.target\.value\)\}/);
  assert.match(GMAIL, /aria-pressed="true"\s*title="Volver al editor"/, 'el modo HTML no tiene cómo volver');
  // Lo que llega al paso desde el modo HTML no trae lo que la lista blanca saca.
  const malo = '<p onclick="x()">Hola <script>alert(1)</script><a href="javascript:x">y</a></p>';
  assert.equal(sanearHtmlEmail(malo), '<p>Hola y</p>');
});

test('htmlLegible: un renglón por bloque, e IDEMPOTENTE (entrar y salir no suma renglones)', () => {
  const html = '<h2>Hola</h2><p>Uno <strong>dos</strong></p><ul><li><p>a</p></li><li><p>b</p></li></ul><hr><p>fin</p>';
  const legible = htmlLegible(html);
  assert.equal(legible, '<h2>Hola</h2>\n<p>Uno <strong>dos</strong></p>\n<ul>\n<li><p>a</p>\n</li>\n<li><p>b</p>\n</li>\n</ul>\n<hr>\n<p>fin</p>');
  assert.equal(htmlLegible(legible), legible, 'cada vuelta por el modo HTML sumaría renglones');
  assert.equal(htmlLegible(sanearHtmlEmail(legible)), legible, 'lo saneado (que vuelve del paso) se lee igual');
  assert.equal(htmlLegible(''), '');
});

test('un dato y un emoji entran donde está el cursor: en el editor rico (PEGÁNDOLOS) o en la caja HTML', () => {
  const ins = GMAIL.slice(GMAIL.indexOf('function insertarEnEditorRico('), GMAIL.indexOf('\n}\n', GMAIL.indexOf('function insertarEnEditorRico(')));
  assert.match(ins, /querySelector<HTMLElement>\('\.ProseMirror'\)/);
  assert.match(ins, /new ClipboardEvent\('paste', \{ clipboardData: dt, bubbles: true, cancelable: true \}\)/,
    'ProseMirror toma el pegado de SU selección aunque el foco esté en el botón o en el buscador de emojis');
  const enCuerpo = GMAIL.slice(GMAIL.indexOf('const insertarEnCuerpo = '), GMAIL.indexOf('const abrirEn = '));
  assert.match(enCuerpo, /if \(modo === 'visual'\) \{ insertarEnEditorRico\(cajaCuerpo\.current, texto\); return; \}/);
  assert.match(enCuerpo, /insertarEnCursor\(crudo, el\?\.selectionStart, el\?\.selectionEnd, texto\);\s*alCambiarCrudo\(r\.valor\);/, 'en el modo HTML el dato no pasa por el saneo');
  assert.match(GMAIL, /onElegir=\{\(k\) => \{ insertarEnCuerpo\(`\{\{\$\{k\}\}\}`\); setAbierto\(null\); \}\}/);
  assert.match(GMAIL, /onPick=\{\(em\) => \{ insertarEnCuerpo\(em\); \}\}/);
  // ⚠️ LA PREMISA DE ANTES YA NO VALE (sexta tanda): «las de /mensajes no las resuelve el envío de
  // nutrición» era cierto con el motor de los 5 datos. Hoy el envío del email pasa el asunto y el
  // cuerpo por `datosParaElLead` (lib/nutricion.ts), que resuelve el catálogo entero de
  // lib/variables-aviso.ts. Lo que se cuida ahora es que el «{ }» sea el ÁRBOL de la casa con los
  // datos de un mensaje al LEAD (no los del equipo: los links al CRM no son para él).
  // PROBADO ROMPIÉNDOLO (09/10/2026, parte «datos»): `destino: 'equipo'` → 1 fallo; el envío del email
  // sin `datosParaElLead` → 1 fallo. Restaurado → verde.
  // (15/10/2026: salvo el «Email a la persona» de un evento de una persona, que trae SU contexto: `persona`.)
  assert.match(GMAIL, /const datos = datosOfrecidos\(persona\?\.contexto \?\? \{ destino: 'lead', conLead: true \}\);/, 'el «{ }» del email no es el del lead');
  assert.match(GMAIL, /import \{ ArbolDeDatos \} from '@\/app\/_components\/SelectorDatos';/);
  assert.doesNotMatch(GMAIL, /VARIABLES_LEAD|VARIABLES_NEGOCIO|<MenuWA alElegir=\{\(\) => setAbierto\(null\)\}\s*opciones=\{variables/, 'volvió la lista plana del motor viejo');
  const motor = leer('lib/nutricion.ts');
  const envio = motor.slice(motor.indexOf("// Los datos del «{ }», como el WhatsApp de arriba (`datosParaElLead`)."));
  assert.match(envio.slice(0, 1200), /const vars = await datosParaElLead\(/, 'el envío del email dejó de resolver el árbol');
  assert.match(envio.slice(0, 1200), /const asunto = aplicarVariables\(paso\.asunto \?\? '', vars\)/, 'el asunto no pasa por los mismos datos');
});

// ── El De ────────────────────────────────────────────────────────────────────────────────────

test('el De: los vinculados de la ruta, lo elegido con la función del MOTOR, y el del workspace es la ausencia', () => {
  const rutas = [...GMAIL.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1]!.trim());
  assert.deepEqual(rutas, ["'/api/email/dominio'"], 'el editor lee el remitente de un solo lugar (y no guarda nada por su cuenta)');
  assert.match(GMAIL, /signal: AbortSignal\.timeout\(/);
  assert.match(GMAIL, /vinculados: remitentesVinculados\(d\),/);
  assert.match(GMAIL, /const elegido = remitenteDelPaso\(remitente, estado\?\.remitente\) \?\? vinculados\[0\] \?\? null;/,
    'la pantalla diría un remitente que el envío ya no usa');
  assert.match(GMAIL, /const opciones = opcionesDeRemitente\(vinculados, remitente, estado\?\.remitente\);/);
  assert.match(GMAIL, /onChange\(\{ remitente: r === vinculados\[0\] \? null : r \}\);/, 'elegir el del workspace tiene que SACAR el campo');
  // Décima tanda (EMAIL 1): sin ninguno propio (el del negocio es el de MaKo), se vincula EL SUYO.
  assert.match(GMAIL, /\{ key: '__vincular', label: vinculados\.length \? 'Vincular nuevo' : 'Vincular tu email', icono: <IconMas \/>, onElegir: \(\) => setVincular\(true\) \}/);
  // Sin leer todavía, el De dice «…»; nunca inventa un remitente.
  assert.match(dibujar(), /class="mk-gmail-de-txt"[^>]*>…</);
  // Undécima tanda: sin remitente propio el chip dice SIN_EMAIL_PROPIO (lib/email-remitente.ts), la misma
  // constante que frena el envío; el email de MaKo en un cliente llega acá como el sandbox.
  assert.equal(avisoDelRemitente({ sandbox: true, envioHabilitado: true }), SIN_EMAIL_PROPIO, 'con el sandbox no sale aunque esté prendido');
  assert.equal(avisoDelRemitente({ sandbox: true, envioHabilitado: false }), SIN_EMAIL_PROPIO, 'el sandbox gana: prenderlo no lo arregla');
  assert.equal(avisoDelRemitente({ sandbox: false, envioHabilitado: false }), 'Email apagado');
  assert.equal(avisoDelRemitente({ sandbox: false, envioHabilitado: true }), null);
  assert.equal(avisoDelRemitente(null), null, 'sin leer el remitente no se inventa un aviso');
});

test('«Vincular nuevo» monta el flujo de /email (DominioSetup) a demanda, en un portal; y el paso pasa a usar el nuevo', () => {
  assert.match(GMAIL, /import type \{ DomState \} from '\.\.\/email\/EmailApp';/);
  assert.doesNotMatch(GMAIL, /import \{[^}]*\} from '\.\.\/email\/EmailApp'/, 'un import estático mete la tab de Email entera en /automations');
  assert.match(GMAIL, /import\('\.\.\/email\/EmailApp'\)/);
  assert.match(GMAIL, /<Setup dom=\{dom\} onUpdate=\{\(d\) => \{ setDom\(d\); onDominio\(d\); \}\} \/>/);
  assert.match(GMAIL, /return createPortal\(\s*<Modal titulo="Vincular remitente"/, 'sin portal, el modal queda adentro del lienzo');
  assert.match(sinComentarios(leer('app/email/EmailApp.tsx')), /export function DominioSetup\(/, 'el flujo de /email ya no se puede montar');
  const alVincular = GMAIL.slice(GMAIL.indexOf('const alVincular = '), GMAIL.indexOf('};', GMAIL.indexOf('const alVincular = ')));
  assert.match(alVincular, /const recien = nuevo\.vinculados\.filter\(\(r\) => !vinculados\.includes\(r\)\);/);
  assert.match(alVincular, /if \(recien\.length === 1\) onChange\(\{ remitente: recien\[0\] === nuevo\.vinculados\[0\] \? null : recien\[0\] \}\);/);
});

test('«Vincular nuevo» hoy REEMPLAZA (no suma): si ya hay un remitente, el modal lo dice ARRIBA, en una frase', () => {
  // El workspace tiene UN remitente y «Guardar remitente» lo pisa: el rótulo promete sumar. Ver la
  // cabecera de `VincularRemitente`.
  assert.match(GMAIL, /<VincularRemitente inicial=\{estado\?\.dom \?\? null\} reemplaza=\{vinculados\.length > 0\}/,
    'el aviso no depende de que ya haya un remitente (sin uno, vincular no reemplaza nada)');
  const modal = GMAIL.slice(GMAIL.indexOf('<Modal titulo="Vincular remitente"'), GMAIL.indexOf('</Modal>'));
  assert.match(modal, /^<Modal titulo="Vincular remitente"[^>]*>\s*\{reemplaza && \(\s*<div role="note"[^>]*>\{AVISO_REEMPLAZA\}<\/div>\s*\)\}\s*\{error \?/,
    'el aviso no va arriba del flujo, antes de «Guardar remitente»');
  assert.match(modal, /color: 'var\(--ink\)'/, 'la consecuencia va en tinta normal, no en gris (AGENTS.md)');
  assert.ok(AVISO_REEMPLAZA.split(/\s+/).length <= 7, `«${AVISO_REEMPLAZA}» es largo para dibujarse`);
  assert.match(AVISO_REEMPLAZA, /^Reemplaza /);
});

// ⛔ Acá vivía «el EditorMensaje (el de /mensajes) no cambió: sus defaults». Ese editor (el de marcas,
// app/agencia/EditorMensaje.tsx) se fue en la segunda pasada de la sexta tanda: los avisos al grupo
// usan el editor de WhatsApp (MaKo en WhatsApp 2 y 3). Lo cuida tests/variables-aviso.test.ts.

test('«Vincular nuevo» es UN modal: el de «Probar» es éste (`VincularRemitente`, exportado)', () => {
  // Hasta la segunda pasada de la sexta tanda `VincularEmisor` (PanelProbar) tenía su propia copia del
  // modal con DominioSetup: dos modales para lo mismo son los que dejan de decir lo mismo.
  // PROBADO ROMPIÉNDOLO (09/10/2026, parte «datos», arnés w2-datos/romper.mjs): PanelProbar cargando
  // su propio flujo de /email en vez de `VincularRemitente` → 2 fallos (éste y «Probar» 2 de
  // tests/panel-probar-ancho); volver a escribir su `RUTA_LINEAS` → 1 fallo. Restaurado → verde.
  assert.match(GMAIL, /^export function VincularRemitente\(/m);
  const probar = sinComentarios(leer('app/automations/PanelProbar.tsx'));
  // Desde la décima tanda (GENERAL 6) el modal de «Probar» es ConectarMedio (lo montan además la tarjeta,
  // Publicar y el CRON), y el del email sigue siendo ÉSTE.
  const conectar = sinComentarios(leer('app/automations/ConectarMedio.tsx'));
  assert.match(conectar, /return <VincularRemitente inicial=\{dom\} reemplaza=\{reemplaza\} onCerrar=/);
  assert.match(conectar, /import \{ VincularRemitente \} from '\.\/EditorEmailGmail';/);
  assert.match(probar, /import \{ ConectarMedio, useEstadoMedios \} from '\.\/ConectarMedio';/);
  for (const s of [probar, conectar]) assert.doesNotMatch(s, /DominioSetup|import\('\.\.\/email\/EmailApp'\)/, 'volvió la copia del modal');
  // Y las líneas del negocio salen de UNA ruta: la de SalidaWhatsApp.
  assert.match(probar, /import \{[^}]*\bRUTA_LINEAS\b[^}]*\} from '\.\/SalidaWhatsApp';/);
  assert.doesNotMatch(probar, /const RUTA_LINEAS\s*=/, 'PanelProbar volvió a escribir su ruta de líneas');
  assert.match(sinComentarios(leer('app/automations/SalidaWhatsApp.tsx')), /^export const RUTA_LINEAS = /m);
});

test('el correo como llega, con el cuerpo del editor: el HTML y no el texto de respaldo', () => {
  const v = paramsDeVista({ asunto: 'Tu visita', preheader: '', cuerpo: 'RESPALDO', cuerpoHtml: '<h2>Hola</h2><ul><li><p>uno</p></li></ul>' });
  const html = renderEmailHtml(v);
  assert.ok(!html.includes('RESPALDO'));
  assert.ok(html.includes('>Hola</h2>') && html.includes('>uno</p></li>'));
});

// ── Roturas ──────────────────────────────────────────────────────────────────────────────────
// 08/10/2026 (segunda tanda, arnés E-v2-romper.mjs): 9 roturas, 9 cazadas sobre la versión de dos
// columnas. La tercera tanda reescribió el editor (09/10/2026, arnés C-romper.mjs: 4 roturas, 4 cazadas).
// La cuarta tanda (punto 16) lo volvió a cambiar. 09/10/2026, arnés romper-email.mjs del scratchpad
// (una por vez, restaurada de memoria; base 26 pass / 0 fail con email-remitente y
// editor-rico-botones-extra). Las que tocan este archivo:
//   R5.  la vista firma con el nombre del remitente           → 3 fallos (dos acá + el pie del ws1)
//   R9.  el modo HTML manda al paso lo escrito sin sanear      → 1 (el modo HTML)
//   R10. htmlLegible sin consumir los saltos (no idempotente)  → 1 (htmlLegible)
//   R11. elegir el del workspace lo GUARDA en vez de sacarlo   → 1 (el De)
//   R12. el editor rico se desmonta en el modo HTML            → 1 (el modo HTML)
//   R13. lo elegido sin la regla del motor (remitenteDelPaso)  → 1 (el De)
//   R14. el motor firma con el nombre del remitente            → 2 (los dos lados + el motor)
// Cierre del punto 16 (arnés romper-email-2.mjs; base 29 pass / 0 fail):
//   R18. `reemplaza={false}` (el aviso no mira si hay remitente) → 1 fallo («Vincular nuevo» reemplaza)
//   R19. el modal sin el texto del aviso                        → 1 (ídem)
//   R20. el aviso en 14 palabras                              → 1 (ídem)
