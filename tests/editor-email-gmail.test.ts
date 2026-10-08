// =============================================================================
// El editor de email tipo Gmail: lo que se ve es lo que sale
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 4): «De la misma manera que creaste el editor de
// WhatsApp, crea el editor de Email, con la interfaz de Gmail, que se parezca.» Decisión 12 del diseño.
// `app/chatbot/EditorEmailGmail.tsx`: a la izquierda «Mensaje nuevo» (De, Para, Asunto, Vista previa y
// el cuerpo), a la derecha el mail ABIERTO con el MISMO render que manda el motor.
//
// Lo que fija este test:
//   · la vista previa arma los parámetros de `renderEmailHtml` con las MISMAS reglas que el envío
//     (lib/nutricion.ts): «(sin asunto)», el preheader vacío que no va, la firma del remitente, y sólo
//     `{{negocio}}` resuelto. El guard mira LOS DOS lados: si el motor cambia una regla, esto cae;
//   · el cuerpo es el EditorMensaje de las marcas `*` `_` `~` y NO un editor que emita HTML (el envío
//     lo escapa: el lead recibiría `<b>` literal), sin botón ni imágenes (el motor no los manda);
//   · el De es del workspace, de sólo lectura, con el aviso corto cuando no sale;
//   · el EditorMensaje que se reusa sigue igual para /mensajes (sus defaults).
//
// ── Roturas (08/10/2026) ── al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorEmailGmail, paramsDeVista, nombreDelRemitente, avisoDelRemitente, urlParaInsertar } from '../app/chatbot/EditorEmailGmail';
import { EditorMensaje } from '../app/agencia/EditorMensaje';
import { renderEmailHtml } from '../lib/email-html';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const GMAIL = sinComentarios(leer('app/chatbot/EditorEmailGmail.tsx'));

// ── La vista previa = el envío ───────────────────────────────────────────────────────────────

test('la vista previa arma el mail con las reglas del motor', () => {
  const v = paramsDeVista({ asunto: '', preheader: '', cuerpo: 'Hola {{nombre}}, te escribo de {{negocio}}', negocio: ' Inmobiliaria del Valle ', remitente: 'Ana Pérez <ana@valle.mx>' });
  assert.equal(v.subject, '(sin asunto)', 'el motor manda «(sin asunto)»');
  assert.equal(v.preheader, undefined, 'un preheader vacío no va');
  assert.equal(v.bodyText, 'Hola {{nombre}}, te escribo de Inmobiliaria del Valle', 'el nombre lo pone el envío para cada lead');
  assert.equal(v.fromName, 'Ana Pérez', 'la firma es el nombre del remitente');
  const w = paramsDeVista({ asunto: 'Tu visita en {{negocio}}', preheader: 'Te espero', cuerpo: 'x', remitente: 'ana@valle.mx' });
  assert.equal(w.subject, 'Tu visita en {{negocio}}', 'sin negocio cargado, el token queda crudo: así llega');
  assert.equal(w.preheader, 'Te espero');
  assert.equal(w.fromName, '', 'un mail pelado no firma');
});

test('el motor arma el email con las MISMAS reglas (los dos lados del contrato)', () => {
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(motor, /const asunto = aplicarVariables\(paso\.asunto \?\? '', vars\) \|\| '\(sin asunto\)';/);
  assert.match(motor, /preheader: aplicarVariables\(paso\.preheader \?\? '', vars\) \|\| undefined,/);
  assert.match(motor, /fromName: fromNameWs,/);
  // La firma: el editor no puede importar lib/resend.ts (lleva server-only por la API key), así que
  // repite la regla. Se compara la REGEX con la del motor, no un parecido.
  const resend = sinComentarios(leer('lib/resend.ts'));
  const deMotor = resend.slice(resend.indexOf('export function displayNameDe('), resend.indexOf('\n}\n', resend.indexOf('export function displayNameDe(')));
  const delEditor = GMAIL.slice(GMAIL.indexOf('export function nombreDelRemitente('), GMAIL.indexOf('\n}\n', GMAIL.indexOf('export function nombreDelRemitente(')));
  const cuerpo = (f: string) => f.slice(f.indexOf('{') + 1).trim();
  assert.ok(deMotor.length > 40 && delEditor.length > 40, 'no encontré las dos funciones');
  assert.equal(cuerpo(delEditor), cuerpo(deMotor), 'la firma del editor y la del motor se separaron');
  assert.equal(nombreDelRemitente('"Ana" <a@b.c>'), 'Ana');
});

test('el render es el de verdad: el iframe recibe lo que arma renderEmailHtml', () => {
  const html = renderToStaticMarkup(createElement(EditorEmailGmail, {
    asunto: 'Tu visita', preheader: 'Te espero el lunes', cuerpo: '*Hola* {{nombre}}, soy de {{negocio}}', negocio: 'Inmobiliaria del Valle', onChange: () => {},
  }));
  const esperado = renderEmailHtml(paramsDeVista({ asunto: 'Tu visita', preheader: 'Te espero el lunes', cuerpo: '*Hola* {{nombre}}, soy de {{negocio}}', negocio: 'Inmobiliaria del Valle', remitente: '' }));
  // El escapado de atributos de React: & " ' < >.
  const escapar = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#x27;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  assert.ok(html.includes(`srcDoc="${escapar(esperado)}"`) || html.includes(`srcdoc="${escapar(esperado)}"`), 'el iframe no muestra el render del envío');
  assert.ok(esperado.includes('<strong>Hola</strong>') && esperado.includes('Inmobiliaria del Valle') && esperado.includes('{{nombre}}'));
  // Lo de Gmail, a la vista y sin rótulos de más.
  for (const t of ['Mensaje nuevo', '>De<', '>Para<', '>El lead<', 'aria-label="Asunto"', 'aria-label="Vista previa"', 'aria-label="Cuerpo del email"', '>Tu visita<']) {
    assert.ok(html.includes(t), `falta ${t}`);
  }
});

// ── Lo que NO hay ────────────────────────────────────────────────────────────────────────────

test('el cuerpo guarda marcas, no HTML: el EditorMensaje de /agencia, nunca EditorRico ni TipTap', () => {
  assert.match(GMAIL, /import \{ EditorMensaje, type EditorMensajeHandle \} from '\.\.\/agencia\/EditorMensaje';/);
  assert.doesNotMatch(GMAIL, /EditorRico|@tiptap|dangerouslySetInnerHTML/, 'un cuerpo en HTML sale escapado: el lead vería las etiquetas');
  const vista = GMAIL.slice(GMAIL.indexOf('export function paramsDeVista('), GMAIL.indexOf('\n}\n', GMAIL.indexOf('export function paramsDeVista(')));
  assert.ok(vista.length > 100, 'no encontré paramsDeVista');
  assert.doesNotMatch(vista, /\bcta\b|titulo|marca/, 'el motor no manda botón, título ni banda: prometerlo sería una mentira de pantalla');
  assert.doesNotMatch(GMAIL, /<img\b|\bcta\b/, 'ni imágenes ni botón en la barra');
  assert.match(GMAIL, /from '@\/lib\/template-vars'/, 'las variables son las del motor');
  assert.doesNotMatch(GMAIL, /variables-aviso/, 'las de /mensajes no las resuelve el envío de nutrición');
});

test('el De es del workspace y de sólo lectura; el mail abierto va aislado', () => {
  const rutas = [...GMAIL.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1]!.trim());
  assert.deepEqual(rutas, ["'/api/email/dominio'"], 'el editor no guarda nada: sólo lee el remitente');
  assert.match(GMAIL, /signal: AbortSignal\.timeout\(/);
  const iframe = GMAIL.slice(GMAIL.indexOf('<iframe'), GMAIL.indexOf('/>', GMAIL.indexOf('<iframe')));
  assert.match(iframe, /sandbox="allow-popups allow-popups-to-escape-sandbox"/);
  assert.doesNotMatch(iframe, /allow-scripts|allow-same-origin/);
  assert.equal(avisoDelRemitente({ sandbox: true, envioHabilitado: true }), 'No sale · dominio sin verificar', 'con el sandbox no sale aunque esté prendido');
  assert.equal(avisoDelRemitente({ sandbox: true, envioHabilitado: false }), 'No sale · dominio sin verificar', 'el sandbox gana: prenderlo no lo arregla');
  assert.equal(avisoDelRemitente({ sandbox: false, envioHabilitado: false }), 'Email apagado');
  assert.equal(avisoDelRemitente({ sandbox: false, envioHabilitado: true }), null);
  assert.equal(avisoDelRemitente(null), null, 'sin leer el remitente no se inventa un aviso');
});

test('el 🔗 mete la URL como TEXTO, con esquema para que el envío la vuelva link', () => {
  assert.equal(urlParaInsertar('valle.mx/visita'), 'https://valle.mx/visita');
  assert.equal(urlParaInsertar(' http://x.y '), 'http://x.y');
  assert.equal(urlParaInsertar('dos palabras'), null);
  assert.equal(urlParaInsertar(''), null);
});

test('el EditorMensaje que se reusa no cambió para /mensajes (sus defaults)', () => {
  const html = renderToStaticMarkup(createElement(EditorMensaje, { valor: 'Hola', onChange: () => {} }));
  assert.ok(html.includes('aria-label="El mensaje"'));
  assert.match(html, /max-height:430px/);
});

// ── Roturas (08/10/2026) ─────────────────────────────────────────────────────────────────────
// Arnés en el scratchpad (E-v2-romper.mjs): UNA rotura por vez, corre este archivo y restaura de
// memoria. Base: 7 / 7. 9 roturas, 9 cazadas (fallos de 7):
//   B1. el asunto vacío sin «(sin asunto)»                           → 1
//   B2. el preheader vacío viaja como ''                             → 1
//   B3. la firma con otra regex que la del motor                     → 1
//   B4. el iframe con allow-scripts                                  → 1
//   B5. «Email apagado» antes que el sandbox                         → 0 la primera vez: el único caso
//       probado tenía el envío prendido, donde el orden no cambia nada. Con el caso «sandbox y
//       apagado» agregado → 1.
//   B6. la vista previa inventa el nombre del lead                   → 2
//   B7. el 🔗 sin esquema                                             → 1
//   B8. EditorMensaje cambia su default para /mensajes               → 1
//   B9. el iframe con otro render que el del envío (la banda de MaKo)→ 1
