// =============================================================================
// El chat del onboarding escribe en la caja del Ops Center, tal cual (20/10/2026)
// =============================================================================
// Martín (pedido del 18/10, punto 3): «el composer del chat del onboarding es el del Ops Center TAL CUAL: + para adjuntar,
// el micrófono para grabar audio, los adjuntos arriba, arrastrar y soltar, sin el enviar verde. Copiá el componente del Ops
// Center; no hagas uno nuevo». La caja del Ops Center vive adentro de app/admin/operaciones/Conversacion.tsx;
// app/offer/CajaDelCentro.tsx es esa fila con sus piezas. Este test las compara, y fija que el onboarding la use (y la tab
// Offer no: sigue con la barra de WhatsApp hasta el chat unificado).
//
// ROTURAS (20/10/2026, arnés romper-caja.js del scratchpad; base 4/0): la caja sin las miniaturas arriba → 3/1 · el
// arranque con la vista previa encima del chat → 3/1 · ChatOffer importa la caja (rompe los tests que lo cargan) → 3/1 ·
// la caja no suma lo elegido → 3/1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const leer = (rel: string) => readFileSync(join(__dirname, '..', rel), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '');

/** Lo que hace a la caja del Ops Center: si falta en la del onboarding, ya no es «tal cual». */
const PIEZAS = [
  '<ListaAdjuntos a={adjuntos} />',
  'className="co-caja__fila"',
  '<MasCaja a={adjuntos}',
  '<BotonEmojis campo={caja} valor={texto} onValor=',
  'className="co-caja__campo"',
  '<ResalteDeLinks texto={texto}',
  'onPaste={(e) => alPegar(e, adjuntos)}',
  'conVinetas(e.target.value, e.target.selectionStart)',
  'enterEnLista(texto, e.currentTarget.selectionStart, e.currentTarget.selectionEnd)',
  '<BotonMandar valor={texto}',
  '<LinksDeLaCaja texto={texto} />',
  'className="co-caja__estado"',
];

test('la caja del onboarding tiene las piezas de la del Ops Center, y ninguna propia', () => {
  const centro = sinComentarios(leer('app/admin/operaciones/Conversacion.tsx'));
  const onb = sinComentarios(leer('app/offer/CajaDelCentro.tsx'));
  for (const p of PIEZAS) {
    assert.ok(centro.includes(p), `el Ops Center ya no tiene «${p}»: revisar la copia`);
    assert.ok(onb.includes(p), `la caja del onboarding no tiene «${p}» del Ops Center`);
  }
  for (const pieza of ['ListaAdjuntos', 'MasCaja', 'BotonEmojis', 'BotonMandar', 'ResalteDeLinks']) {
    assert.match(onb, new RegExp(`import \\{[^}]*\\b${pieza}\\b[^}]*\\} from '@/app/admin/operaciones/`), `${pieza} tiene que ser LA del Ops Center`);
  }
  assert.doesNotMatch(onb, /<svg|ComposerWhatsApp/, 'un ícono propio (o la barra verde de WhatsApp) no es la caja del Ops Center');
  // El único botón propio es el micrófono de la nota de voz (20/10/2026): con la clase del de mandar del Ops Center.
  assert.deepEqual([...onb.matchAll(/<button[^>]*className="([^"]+)"/g)].map((m) => m[1]), ['co-enviar co-enviar--mic']);
  assert.match(onb, /import '@\/app\/admin\/operaciones\/centro\.css';/);
});

test('el onboarding escribe en ella, sin la vista previa encima del chat; la tab Offer sigue igual', () => {
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(app, /const vistaAdjuntos = !arranque && lista\.items\.length \? \(/, 'en el arranque los archivos van arriba del texto, no en una vista que tapa el chat');
  assert.match(app, /const cajaArranque = arranque \? \(\s*<CajaDelCentro /);
  assert.match(app, /caja=\{cajaArranque\}/);
  assert.match(app, /adjuntos=\{arranque\.manda \? undefined : adjuntosCaja\}/, 'con sólo texto (el nombre, un código) no se adjunta');
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  assert.match(chat, /\{caja \?\? <ComposerWhatsApp/, 'sin caja (la tab Offer), la barra de WhatsApp');
});

test('el «+», pegar y soltar suman a la MISMA lista, que se lee al mandar', () => {
  const app = sinComentarios(leer('app/offer/OfferApp.tsx'));
  assert.match(app, /onSumar: agregarArchivos,/);
  assert.match(app, /onQuitar: quitarArchivo,/);
  assert.match(app, /if \(lista\.ref\.current\.length\) \{ void enviarVista\(\); return; \}/, 'mandar con algo juntado tiene que leerlo antes del turno');
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  assert.match(chat, /if \(!ocupado\) onArchivos\(Array\.from\(e\.dataTransfer\.files\)\);/);
  assert.match(chat, /\{encima && caja && <div className="co-soltar" aria-hidden>Suelta para adjuntar<\/div>\}/);
});

test('ChatOffer no importa la caja: lo carga un test en node y la caja trae .css', () => {
  const chat = sinComentarios(leer('app/offer/ChatOffer.tsx'));
  assert.doesNotMatch(chat, /from '\.\/CajaDelCentro'|from '@\/app\/admin\/operaciones\/(AdjuntosCaja|Microfono|Emojis|ConLinks)'|\.css';/);
});
