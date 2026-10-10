// =============================================================================
// Borrar es UNO en toda la app: el tacho de la casa, ROJO siempre
// =============================================================================
// Pedido de Martín (09/10/2026, sexta tanda, general 9), textual: «Cambia el botón de BORRAR con ese
// ícono de basura que no se ve, no se entiende, busca un ícono más reconocible o otro icono de basura,
// porque ese no se entiende. Esto en TODOS lados. Y que siempre el ícono de borrar sea rojo.»
//
// El tacho de la casa es `TRAZOS_BORRAR` (app/_ui/iconos-menu.tsx), y lo dibujan cuatro puertas, las
// cuatro rojas sin que quien llama lo pueda cambiar:
//   · `IconoBorrar` / `BotonBorrar` (app/_ui/BotonBorrar.tsx), para un botón o un renglón;
//   · `IconoMenu nombre="borrar"` / `icono: 'borrar'` en un renglón del desplegable;
//   · `Icon name="trash"` (app/_components/icons.tsx), que desde esta tanda dibuja ESE tacho y lo pinta
//     rojo él mismo: así `IconBtn name="trash"` (/integraciones), `BotonLote icono="trash"` (Ads Manager)
//     y las pantallas de otras partes cambiaron sin tocar una línea.
//
// Este test barre `git ls-files app lib components` (OJO: un archivo nuevo sin `git add -N` no lo ve) y
// falla si aparece un tacho que no sea ése. Las tres señales, sobre el fuente SIN COMENTARIOS (la casa
// cita en los comentarios lo que se sacó, y un guard que lee el comentario se acusa a sí mismo):
//   · el emoji 🗑 (U+1F5D1), que es lo que se veía en el panel del lienzo y en Retros;
//   · un trazo de tacho dibujado a mano: un path que arranca con la TAPA (una raya horizontal de 10 a 19)
//     y en el subpath siguiente sube a la MANIJA (`M x y V2..5`). Es la firma que comparten los seis que
//     había (el del composer, el de la fila del CRM, el de la barra de lote del CRM, el del Archivero, el
//     del editor rico y el del Plan), y NO la tienen los íconos de alinear, el reloj de arena ni la nota
//     del set (los cuatro falsos positivos que dio una firma más floja, medido el 09/10/2026);
//   · un nombre de tacho propio: `IconTrash`, `I_BORRAR`, `IconoTachoFila`, `IconoPapelera`, `basura:`.
//
// Lo que NO puede ver: una ✕ que BORRA (las hay que cierran, y por el texto no se distinguen). Esas se
// barrieron a mano en esta tanda; el criterio quedó en docs/hallazgos-chatbot.md (parte «barrido»).
//
// ── Roturas (09/10/2026, con un arnés que restaura de memoria; base en verde: 5 pasan, 0 fallan) ──
//   · un `🗑` de vuelta en el botón de Retros (app/experimentos/RetroTab.tsx)           -> 4 / 1
//   · el trazo viejo del CRM de vuelta en app/crm/CrmBoard.tsx (`M3 6h18M8 6V4h8v2…`)   -> 4 / 1
//   · un `IconTrash` nuevo en una pantalla (app/onboarding/ProductosView.tsx)             -> 4 / 1
//   · `trash:` de icons.tsx vuelto a un dibujo propio                                      -> 4 / 1
//   · `Icon` sin el rojo forzado para `trash`                                               -> 4 / 1
//   · `IconoTacho` del Plan vuelto a su svg                                                 -> 4 / 1
//   · app/whatsapp/EmojiPicker.tsx sin su 🗑️ (la excepción permanente quedó vieja)          -> 4 / 1
//   · el 🗑 del panel del lienzo reemplazado (la excepción PENDIENTE quedó vieja)            -> 4 / 1
//   · el parser deja de sacar los comentarios                                              -> 4 / 1 (se
//     acusan los archivos que CITAN en su comentario el 🗑 que se fue)
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const RAIZ = join(import.meta.dirname, '..');
const leer = (f: string) => { try { return readFileSync(join(RAIZ, f), 'utf8').replace(/\r\n/g, '\n'); } catch { return ''; } };
const sinComentarios = (s: string) => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

const EMOJI = '\u{1F5D1}';
/** Una cadena que ARRANCA con la tapa (raya de 10 a 19) y, en el subpath siguiente, sube a la manija (y=2..5). */
const TRAZO = /["'`]M\s?[\d.]+[ ,][\d.]+\s?h1\d(?:\.\d+)?[\s|]*M\s?[\d.]+[ ,][\d.]+\s?V\s?[2-5](?:\.\d+)?/;
const NOMBRES = /\b(IconTrash|I_BORRAR|IconoTachoFila|IconoPapelera)\b|\bbasura\s*:/;

/** Por qué tiene un tacho propio y está bien que lo tenga. Una que ya no lo tiene, FALLA (se borra). */
const PERMANENTES: Record<string, string> = {
  'app/whatsapp/EmojiPicker.tsx': 'el 🗑️ es un EMOJI que la persona manda en un mensaje, no un control de borrar',
};
/** Lo que guarda el pedido LITERAL de Martín: ahí el 🗑 y la palabra «basura» son citas. */
const esBitacora = (f: string) => /^app\/admin\/dev\/(.+\/)?bitacora\.ts$/.test(f) || f === 'app/admin/dev/_historial.generado.ts';

/**
 * Lo que vive en archivos de OTRAS partes de la sexta tanda, que hacen su propio barrido. Cada una dice
 * qué tiene y quién la cambia. ⚠️ Cuando esa parte lo cambie, la entrada queda vieja y este test FALLA a
 * propósito: la lista sólo se achica, y una excepción que no corresponde a nada es un permiso escrito
 * para que el tacho viejo vuelva a ese archivo.
 */
const PENDIENTES: Record<string, string> = {
  'app/_components/Lienzo.tsx': 'el 🗑 del panel del lienzo (el que ve Martín): parte «lienzo»',
  'app/chatbot/IconosDisparador.tsx': 'un tacho propio, ya rojo: parte del Chatbot',
  'app/chatbot/EditorMensajeWhatsApp.tsx': 'usa `IconTrash` del composer: parte «whatsapp»',
  'app/chatbot/EditorMensajeSocial.tsx': 'usa `IconTrash` del composer: parte «canales»',
  'app/whatsapp/_shared/composer-icons.tsx': '`IconTrash`, el tacho del composer: parte «whatsapp»',
  'app/whatsapp/_shared/VoiceRecorder.tsx': 'usa `IconTrash` del composer: parte «whatsapp»',
  'app/crm/AccionesLoteLeads.tsx': 'el tacho de la barra de lote del CRM: archivo de otra parte',
};

function archivos(): string[] {
  const todos = execFileSync('git', ['ls-files', 'app', 'lib', 'components'], { cwd: RAIZ, encoding: 'utf8' })
    .split(/\r?\n/).map((f) => f.trim()).filter((f) => /\.(tsx?|mjs|js)$/.test(f) && !/\.d\.ts$/.test(f));
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas DISTINTAS.
  assert.ok(todos.length > 300, `git ls-files devolvió ${todos.length} archivos: esto no corrió en el repo`);
  return todos;
}

/** Qué señales de un tacho propio tiene un fuente (ya sin comentarios). */
function tachosDe(src: string): string[] {
  const s = sinComentarios(src);
  const out: string[] = [];
  if (s.includes(EMOJI)) out.push('el emoji 🗑');
  const t = s.match(TRAZO); if (t) out.push(`un trazo de tacho a mano («${t[0].slice(0, 28)}…»)`);
  const n = s.match(NOMBRES); if (n) out.push(`un tacho con nombre propio («${n[0]}»)`);
  return out;
}

const HALLADOS = new Map(archivos().filter((f) => !esBitacora(f)).map((f) => [f, tachosDe(leer(f))] as const).filter(([, h]) => h.length > 0));

test('⚠️ ningún archivo dibuja un tacho que no sea el de la casa', () => {
  const malos = [...HALLADOS].filter(([f]) => !(f in PERMANENTES) && !(f in PENDIENTES)).map(([f, h]) => `${f}: ${h.join(', ')}`);
  assert.deepEqual(malos, [], `Usá IconoBorrar / BotonBorrar (app/_ui/BotonBorrar.tsx) o icono: 'borrar':\n  ${malos.join('\n  ')}`);
});

test('las excepciones no quedan viejas: cada una sigue teniendo lo que la justifica', () => {
  const viejas = [...Object.keys(PERMANENTES), ...Object.keys(PENDIENTES)].filter((f) => !HALLADOS.has(f));
  assert.deepEqual(viejas, [], `Ya no tienen tacho propio: sacalas de la lista de este test:\n  ${viejas.join('\n  ')}`);
});

test('`Icon name="trash"` ES el tacho de la casa, y rojo', () => {
  const ICONS = sinComentarios(leer('app/_components/icons.tsx'));
  assert.match(ICONS, /^\s*trash: TRAZOS_BORRAR,$/m, 'el `trash` del set del sidebar volvió a un dibujo propio');
  assert.match(ICONS, /import \{ TRAZOS_BORRAR \} from '\.\.\/_ui\/iconos-menu';/);
  // El rojo lo pone `Icon` y no el que llama: un tacho gris se lee como decoración.
  const icon = ICONS.slice(ICONS.indexOf('export function Icon('));
  assert.match(icon, /const borrar = name === 'trash';/);
  assert.match(icon, /\.\.\.\(borrar \? \{ color: 'var\(--bad\)' \} : null\)/, '`Icon` ya no pinta rojo el tacho');
});

test('el tacho del Plan (`IconoTacho`) es el de la casa', () => {
  const P = sinComentarios(leer('app/plan/board/piezas.tsx'));
  const cuerpo = P.slice(P.indexOf('export function IconoTacho'), P.indexOf('export function IconoTacho') + 140);
  assert.match(cuerpo, /return <IconoBorrar size=\{size\} \/>;/, 'el Plan volvió a dibujar su propio tacho');
});

test('la firma del trazo caza los tachos de antes y no los íconos parecidos', () => {
  // Los seis que había (medidos el 09/10/2026, ahora reemplazados o pendientes de otra parte).
  for (const viejo of [
    'M3.5 6h17M8 6V4h8v2M6.5 6l1 14h9l1-14M10 10.5v6M14 10.5v6',
    'M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6',
    'M3 6h18|M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6',
    'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v5M14 11v5',
    'M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v6M14 11v6',
    'M2.6 4.2h10.8M6.4 4.2V2.9h3.2v1.3M4.3 4.2l.6 8.3a1 1 0 0 0 1 .9h4.2a1 1 0 0 0 1-.9l.6-8.3',
  ]) assert.match(`"${viejo}"`, TRAZO, `la firma ya no caza ${viejo.slice(0, 24)}`);
  // Los cuatro falsos positivos de una firma más floja.
  for (const sano of [
    'M4 6h16M4 12h10M4 18h13', 'M4 14h16M4 20h16M12 11V3', 'M5 4.5h14v9.5l-6 6H5V4.5Z', 'M7 3h10M7 21h10M8 3v2.5c0 1.6 1.2 2.8 4',
  ]) assert.doesNotMatch(`"${sano}"`, TRAZO, `la firma caza un ícono que no es un tacho: ${sano}`);
});
