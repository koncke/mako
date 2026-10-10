// =============================================================================
// Los enchufes de la cuarta tanda que quedaron en archivos de OTRAS partes (09/10/2026)
// =============================================================================
// Cada parte de la tanda escribió su capacidad en su archivo y dejó el call site como bloqueante,
// porque el archivo donde se enchufa era de otra parte (AGENTS.md, «repartir trabajo por archivo
// garantiza salidas huérfanas»). Son cuatro, y los cuatro compilaban sin hacer nada:
//   · el «De» del email: el editor lo acepta y el lienzo no se lo pasaba (se guardaba y no se veía);
//   · el número de salida en el editor de WhatsApp: la fila no se dibuja sin `linea`;
//   · «✦ MaKo» al lado del título del panel: sin `accionesTitulo` seguía en la fila de arriba;
//   · la tarjeta: dibujaba la transcripción del audio y sólo la primera parte de un mensaje.
//
// PROBADO ROMPIÉNDOLO. Sexta tanda, segunda pasada (09/10/2026, parte «flujo»; base en verde 7 / 0), restaurada DE MEMORIA. Pasan / fallan:
//   S1. `onLinea` vuelve con el cast (`as Partial<PasoGrafo>`)                  -> 6 / 1
//
// Correr: node --import tsx --test tests/chatbot-enchufes.test.ts
// Probado rompiéndolo (09/10/2026, base 7/0): ver el pie del archivo.
// =============================================================================
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { altoDeMensaje, RENGLON_MAS_PARTES, type PasoParaGrafo } from '../lib/flujo-conversacion';

const leer = (p: string): string => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (s: string): string => s.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
/** El bloque entre `abre` y `cierra`, con el largo controlado (un recorte que se fue de largo mira otra cosa). */
const bloque = (src: string, abre: string, cierra: string, tope: number): string => {
  const ini = src.indexOf(abre);
  assert.ok(ini >= 0, `no encontré «${abre}»`);
  const fin = src.indexOf(cierra, ini + abre.length);
  assert.ok(fin > ini, `no encontré el cierre «${cierra}»`);
  const b = src.slice(ini, fin);
  assert.ok(b.length < tope, `el recorte mide ${b.length}: está mirando otra cosa`);
  return b;
};

const FLUJO = sinComentarios(leer('app/automations/FlujoLienzo.tsx'));
const PERFIL = sinComentarios(leer('app/automations/SecuenciaPerfil.tsx'));
const LIENZO = sinComentarios(leer('app/_components/Lienzo.tsx'));

const msg = (extra: Record<string, unknown>): PasoParaGrafo =>
  ({ id: 'm', canal: 'whatsapp', proveedor: 'no_oficial', tipo: 'texto', cuerpo: 'Hola, te dejo esto', ...extra }) as unknown as PasoParaGrafo;

test('la tarjeta de un mensaje de VARIAS partes mide la primera más el renglón «+N más»', () => {
  const una = altoDeMensaje(msg({}));
  const tres = altoDeMensaje(msg({ partes: [
    { tipo: 'texto', cuerpo: 'Hola, te dejo esto' }, { tipo: 'texto', cuerpo: 'https://hola-mako.com' }, { tipo: 'audio', audio_id: 3 },
  ] }));
  assert.equal(tres - una, 4 + RENGLON_MAS_PARTES, `el «+N más» suma ${tres - una}`);
  // Una lista de UNA parte es un mensaje de los de siempre: no suma nada.
  assert.equal(altoDeMensaje(msg({ partes: [{ tipo: 'texto', cuerpo: 'Hola, te dejo esto' }] })), una);
});

test('la tarjeta dibuja la primera parte, «+N más» y NO la transcripción del audio', () => {
  const vista = bloque(FLUJO, 'function VistaMensaje(', '\nfunction VistaEmail(', 4_000);
  assert.match(vista, /partesExplicitas\(paso\)/, 'la tarjeta no cuenta las partes');
  assert.match(vista, /RENGLON_MAS_PARTES/, 'el renglón no usa el alto con que lo mide `altoDeMensaje`');
  assert.match(vista, /transcript: null/, 'la tarjeta vuelve a dibujar la transcripción');
});

test('el «De» del email llega al editor, y elegirlo se puede deshacer', () => {
  const email = bloque(FLUJO, 'function EditorEmail(', '\nfunction EditorEtiquetaLienzo(', 2_500);
  assert.match(email, /remitente=\{paso\.remitente \?\? null\}/, 'el editor no recibe el remitente del paso');
  assert.match(email, /cambiar\(patch, 'remitente' in patch\)/, 'elegir el «De» no entra a la pila de deshacer');
});

test('el número de salida viaja de SecuenciaPerfil al editor de WhatsApp', () => {
  const montaje = bloque(PERFIL, '<FlujoLienzo', '\n        chrome={', 3_000);
  assert.match(montaje, /linea=\{rolAdmin \? \{ actual: lineaSec, onElegir: elegirLineaDesdeEditor \} : undefined\}/);
  const elegir = bloque(PERFIL, 'const elegirLineaDesdeEditor', 'await guardarLinea(linea);', 1_200);
  assert.match(elegir, /mensajes\?lineas=1/, 'un número recién vinculado no vuelve a pedir la lista');
  // ⚠️ SEXTA TANDA (WhatsApp 2): el número va en la CABECERA del panel y es de CADA mensaje; la línea de
  // la automatización llega a la cabecera como lo que se ve cuando la tarjeta no eligió otra.
  const cabecera = bloque(FLUJO, 'tituloEditor={cabeceraDe(', '\n    />', 1_500);
  assert.match(cabecera, /<CabeceraWhatsApp paso=\{paso\} lineaAutomatizacion=\{linea\?\.actual \?\? null\}/, 'la cabecera no recibe la línea de la automatización');
  // Segunda pasada: `linea` es un campo del paso (`PasoSecuenciaDto`), sin el cast de antes (`conLinea`).
  assert.match(cabecera, /onLinea=\{\(l\) => onPasos\(\(prev\) => cambiarNodo\(prev, n\.id, \{ linea: l \}\), true\)\}/, 'elegir el número de un mensaje no se guarda en ESE paso (o no se puede deshacer)');
  assert.doesNotMatch(cabecera, /conLinea|as Partial</, 'volvió el cast de la línea');
  assert.match(FLUJO, /editorEntrada=\{editorEntrada\} formaPanel=\{formaPanel\} linea=\{linea\}/, 'EditorDeNodo no la pasa');
});

test('«✦ MaKo» va en la cabecera del panel, con la MISMA regla que el editor, y una sola vez', () => {
  const editor = bloque(FLUJO, 'function EditorMensaje(', '\nfunction EditorAccion(', 4_500);
  assert.match(editor, /permiteIA=\{permiteIADe\(paso, !!onModoIA\)\}/);
  const cabecera = bloque(FLUJO, 'tituloEditor={cabeceraDe(', '\n    />', 1_500);
  assert.match(cabecera, /conMako=\{permiteIADe\(paso, !!onModoIA\)\}/);
  const regla = bloque(FLUJO, 'function cabeceraDe(', '\n}\n', 800);
  assert.match(regla, /!rolAdmin/, 'un setter vería el número y el botón sin poder editar');
  // El editor ya no dibuja su propio ✦: lo abre la cabecera (un solo botón).
  assert.doesNotMatch(sinComentarios(leer('app/automations/EditorMensajeWhatsApp.tsx')).slice(0, 2_000), /<BotonMakoWhatsApp/);
});

test('el lienzo dibuja `accionesTitulo` al lado del título, sin reemplazarlo', () => {
  assert.match(LIENZO, /const extra = accionesTitulo \? accionesTitulo\(nodoSel\) : null;/);
  const panel = bloque(LIENZO, 'const extra = accionesTitulo', '</>', 900);
  assert.match(panel, /\{nodoSel\.titulo\}/, 'el título desapareció');
  assert.match(panel, /\{extra && /, 'lo de al lado del título no se dibuja');
});

test('`/mensajes` (el otro lienzo) no se entera: `accionesTitulo` es opcional', () => {
  assert.match(LIENZO, /accionesTitulo\?: \(nodo: NodoFlujo\) => ReactNode;/);
});

// ── Probado rompiéndolo (09/10/2026), de a una y restaurando de memoria. Base 7/0 ──
// R1 la tarjeta vuelve a pasar `a?.transcript`                         → 6/1
// R2 `altoDeMensaje` sin el renglón «+N más»                            → 6/1
// R3 el EditorEmail sin `remitente=`                                    → 6/1
// R4 elegir el «De» sin apilar (`cambiar(patch, false)`)                → 6/1
// R5 SecuenciaPerfil sin `linea=` en <FlujoLienzo                       → 6/1
// R6 EditorMensaje sin `makoEnCabecera`                                 → 6/1
// R7 la cabecera sin el `!rolAdmin`                                     → 6/1
// Sexta tanda (09/10/2026, parte «whatsapp»): las dos de la cabecera se reescribieron sobre la nueva
// (`tituloEditor` + `CabeceraWhatsApp`); se re-probaron, base 7/0: `cabeceraDe` sin `!rolAdmin` → 6/1;
// la cabecera con `lineaAutomatizacion={null}` → 6/1; `onLinea` guardando sin apilar (`, false)`) → 6/1.
