// =============================================================================
// El editor de email tipo Gmail: una columna, el editor rico, y lo que llega es lo que sale
// =============================================================================
// Pedido de Martín (08/10/2026, segunda tanda, punto 4): «crea el editor de Email, con la interfaz de
// Gmail, que se parezca». Tercera tanda (09/10/2026, punto 12 y decisión 12): «que no esté una cosa al
// costado y el editable en el otro costado... copies el editor de texto que tenemos en las descripciones
// de las clases de la tab de cursos, donde se puede poner de todo».
//
// Lo que fija este test:
//   · UNA columna, como redactar en Gmail: Mensaje nuevo, De, Para, Asunto, Vista previa y el cuerpo
//     abajo; sin la vista partida al costado (el correo como llega se ve con el ojo, en la misma columna);
//   · el cuerpo es el editor rico de las lecciones (`EditorRico`, por `editor-rico-perezoso`, nunca con
//     un import estático que lo meta en el chunk de /chatbot), sin subir adjuntos (el bucket es privado);
//   · un cambio del cuerpo trae `cuerpo_html` y el `cuerpo` DERIVADO con `textoDeHtmlEmail`, y un email
//     de antes abre su texto con marcas como HTML (`htmlDeCuerpoTexto`);
//   · la vista de cómo llega arma los parámetros de `renderEmailHtml` con las MISMAS reglas que el envío
//     (lib/nutricion.ts). El guard mira LOS DOS lados: si el motor cambia una regla, esto cae;
//   · el De es del workspace, de sólo lectura, con el aviso corto cuando no sale.
//
// ── Roturas ── al final.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EditorEmailGmail, paramsDeVista, nombreDelRemitente, avisoDelRemitente } from '../app/chatbot/EditorEmailGmail';
import { EditorMensaje } from '../app/agencia/EditorMensaje';
import { renderEmailHtml } from '../lib/email-html';

const leer = (r: string) => readFileSync(new URL(`../${r}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const GMAIL = sinComentarios(leer('app/chatbot/EditorEmailGmail.tsx'));

const dibujar = (p: Partial<Parameters<typeof EditorEmailGmail>[0]> = {}) => renderToStaticMarkup(createElement(EditorEmailGmail, {
  asunto: 'Tu visita', preheader: 'Te espero el lunes', cuerpo: 'Hola', negocio: 'Inmobiliaria del Valle', onChange: () => {}, ...p,
}));

// ── La vista de cómo llega = el envío ────────────────────────────────────────────────────────

test('la vista de cómo llega arma el mail con las reglas del motor', () => {
  const v = paramsDeVista({ asunto: '', preheader: '', cuerpo: 'Hola {{nombre}}, te escribo de {{negocio}}', negocio: ' Inmobiliaria del Valle ', remitente: 'Ana Pérez <ana@valle.mx>' });
  assert.equal(v.subject, '(sin asunto)', 'el motor manda «(sin asunto)»');
  assert.equal(v.preheader, undefined, 'un preheader vacío no va');
  assert.equal(v.bodyText, 'Hola {{nombre}}, te escribo de Inmobiliaria del Valle', 'el nombre lo pone el envío para cada lead');
  assert.equal(v.fromName, 'Ana Pérez', 'la firma es el nombre del remitente');
  assert.ok(!('bodyHtml' in v), 'sin cuerpo HTML (un email de antes), el correo de siempre');
  const w = paramsDeVista({ asunto: 'Tu visita en {{negocio}}', preheader: 'Te espero', cuerpo: 'x', remitente: 'ana@valle.mx' });
  assert.equal(w.subject, 'Tu visita en {{negocio}}', 'sin negocio cargado, el token queda crudo: así llega');
  assert.equal(w.preheader, 'Te espero');
  assert.equal(w.fromName, '', 'un mail pelado no firma');
  // Con el cuerpo del editor rico: va como HTML, con `{{negocio}}` resuelto POR CONTEXTO.
  const h = paramsDeVista({ asunto: 'a', preheader: '', cuerpo: 'Hola', cuerpoHtml: '<p>De <strong>{{negocio}}</strong>, <a href="https://valle.mx/?de={{negocio}}">aquí</a> {{nombre}}</p>', negocio: 'Valle & Co', remitente: '' });
  assert.equal(h.bodyHtml, '<p>De <strong>Valle &amp; Co</strong>, <a href="https://valle.mx/?de=Valle%20%26%20Co" target="_blank" rel="noopener noreferrer">aquí</a> {{nombre}}</p>');
});

test('el motor arma el email con las MISMAS reglas (los dos lados del contrato)', () => {
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  assert.match(motor, /const asunto = aplicarVariables\(paso\.asunto \?\? '', vars\) \|\| '\(sin asunto\)';/);
  assert.match(motor, /preheader: aplicarVariables\(paso\.preheader \?\? '', vars\) \|\| undefined,/);
  assert.match(motor, /fromName: fromNameWs,/);
  assert.match(motor, /\.\.\.\(html \? \{ bodyHtml: aplicarVariablesHtml\(html, vars\) \} : \{\}\),/, 'el cuerpo HTML con la misma función de variables');
  assert.match(GMAIL, /\.\.\.\(p\.cuerpoHtml \? \{ bodyHtml: aplicarVariablesHtml\(p\.cuerpoHtml, vars\) \} : \{\}\),/);
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

// ── Una columna, como redactar en Gmail ──────────────────────────────────────────────────────

test('una sola columna, en el orden de Gmail, y sin la vista partida al costado', () => {
  const html = dibujar();
  const orden = ['Mensaje nuevo', '>De<', '>Para<', '>El lead<', 'aria-label="Asunto"', 'aria-label="Vista previa"', 'class="mk-gmail-cuerpo"'];
  let desde = -1;
  for (const t of orden) {
    const i = html.indexOf(t);
    assert.ok(i > desde, `«${t}» no está, o no está DEBAJO de lo anterior`);
    desde = i;
  }
  assert.ok(!html.includes('<iframe'), 'con el ojo apagado no hay correo al costado: se escribe');
  assert.doesNotMatch(GMAIL, /grid-template-columns/, 'volvió la vista partida en dos columnas');
  assert.ok(html.includes('aria-label="Ver cómo llega el correo"') && html.includes('aria-pressed="false"'), 'el ojo, apagado');
  assert.doesNotMatch(GMAIL, /height:\s*'100%'|height:100%/, 'contra un alto indefinido Safari da cero (AGENTS.md)');
});

test('el cuerpo es el editor rico de las lecciones, cargado a demanda y sin subir adjuntos', () => {
  assert.match(GMAIL, /import \{ EditorRicoPerezoso \} from '\.\.\/customer-success\/curso\/editor-rico-perezoso';/);
  assert.doesNotMatch(GMAIL, /from '@\/app\/_ui\/EditorRico'|from '\.\.\/_ui\/EditorRico'/, 'un import estático mete TipTap en el chunk de /chatbot');
  assert.doesNotMatch(GMAIL, /agencia\/EditorMensaje/, 'el editor de marcas de antes ya no es el cuerpo');
  const montaje = GMAIL.slice(GMAIL.indexOf('<EditorRicoPerezoso'), GMAIL.indexOf('/>', GMAIL.indexOf('<EditorRicoPerezoso')));
  assert.ok(montaje.length > 60, 'no encontré el montaje del editor rico');
  assert.match(montaje, /valor=\{valorHtml\}/);
  assert.match(montaje, /onCambio=\{alCambiarCuerpo\}/);
  assert.match(montaje, /urlDeAdjunto=\{sinAdjuntos\}/);
  assert.doesNotMatch(montaje, /subirAdjunto/, 'el bucket del editor es privado: una imagen subida se vería rota en el correo');
  assert.match(montaje, /etiqueta="Cuerpo del email"/);
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

test('un dato y un emoji entran al cuerpo PEGÁNDOLOS en el editor rico', () => {
  const ins = GMAIL.slice(GMAIL.indexOf('function insertarEnEditorRico('), GMAIL.indexOf('\n}\n', GMAIL.indexOf('function insertarEnEditorRico(')));
  assert.match(ins, /querySelector<HTMLElement>\('\.ProseMirror'\)/);
  assert.match(ins, /new ClipboardEvent\('paste', \{ clipboardData: dt, bubbles: true, cancelable: true \}\)/,
    'ProseMirror toma el pegado de SU selección aunque el foco esté en el botón o en el buscador de emojis');
  assert.match(GMAIL, /insertarEnEditorRico\(cajaCuerpo\.current, `\{\{\$\{v\.key\}\}\}`\)/);
  assert.match(GMAIL, /onPick=\{\(em\) => \{ insertarEnEditorRico\(cajaCuerpo\.current, em\); \}\}/);
  assert.match(GMAIL, /from '@\/lib\/template-vars'/, 'las variables son las del motor');
  assert.doesNotMatch(GMAIL, /variables-aviso/, 'las de /mensajes no las resuelve el envío de nutrición');
});

// ── El De y el correo como llega ─────────────────────────────────────────────────────────────

test('el De es del workspace y de sólo lectura; el correo como llega va aislado', () => {
  const rutas = [...GMAIL.matchAll(/fetch\(([^,)]+)/g)].map((m) => m[1]!.trim());
  assert.deepEqual(rutas, ["'/api/email/dominio'"], 'el editor no guarda nada: sólo lee el remitente');
  assert.match(GMAIL, /signal: AbortSignal\.timeout\(/);
  const iframe = GMAIL.slice(GMAIL.indexOf('<iframe'), GMAIL.indexOf('/>', GMAIL.indexOf('<iframe')));
  assert.match(iframe, /srcDoc=\{html\}/);
  assert.match(iframe, /sandbox="allow-popups allow-popups-to-escape-sandbox"/);
  assert.doesNotMatch(iframe, /allow-scripts|allow-same-origin/);
  assert.match(GMAIL, /verLlega \? renderEmailHtml\(paramsDeVista\(\{ asunto, preheader, cuerpo, cuerpoHtml: valorHtml, negocio, remitente \}\)\) : ''/,
    'el correo como llega es el MISMO render que sale, con el cuerpo que se está escribiendo');
  assert.match(GMAIL, /style=\{verLlega \? \{ display: 'none' \} : undefined\}/, 'el cuerpo se esconde, no se desmonta: no pierde su deshacer');
  assert.equal(avisoDelRemitente({ sandbox: true, envioHabilitado: true }), 'No sale · dominio sin verificar', 'con el sandbox no sale aunque esté prendido');
  assert.equal(avisoDelRemitente({ sandbox: true, envioHabilitado: false }), 'No sale · dominio sin verificar', 'el sandbox gana: prenderlo no lo arregla');
  assert.equal(avisoDelRemitente({ sandbox: false, envioHabilitado: false }), 'Email apagado');
  assert.equal(avisoDelRemitente({ sandbox: false, envioHabilitado: true }), null);
  assert.equal(avisoDelRemitente(null), null, 'sin leer el remitente no se inventa un aviso');
});

test('el correo como llega, con el cuerpo del editor: el HTML y no el texto de respaldo', () => {
  const v = paramsDeVista({ asunto: 'Tu visita', preheader: '', cuerpo: 'RESPALDO', cuerpoHtml: '<h2>Hola</h2><ul><li><p>uno</p></li></ul>', remitente: '' });
  const html = renderEmailHtml(v);
  assert.ok(!html.includes('RESPALDO'));
  assert.ok(html.includes('>Hola</h2>') && html.includes('>uno</p></li>'));
});

test('el EditorMensaje (el de /mensajes) no cambió: sus defaults', () => {
  const html = renderToStaticMarkup(createElement(EditorMensaje, { valor: 'Hola', onChange: () => {} }));
  assert.ok(html.includes('aria-label="El mensaje"'));
  assert.match(html, /max-height:430px/);
});

// ── Roturas ──────────────────────────────────────────────────────────────────────────────────
// 08/10/2026 (segunda tanda, arnés E-v2-romper.mjs): 9 roturas, 9 cazadas sobre la versión de dos
// columnas. La tercera tanda reescribió el editor. 09/10/2026, arnés C-romper.mjs del scratchpad (una
// por vez, restaurada de memoria; base 9 / 9): 4 roturas, 4 cazadas.
//   R12. el editor avisa ANTES de actualizar su copia               → 1 fallo
//   R13. el editor rico con un import estático (sin el perezoso)     → 1
//   R14. la vista de cómo llega sin el cuerpo HTML                   → 3
//   R15. la vista partida vuelve (un grid de dos columnas)           → 1
