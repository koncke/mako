import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  revisarGuion, limpiarGuion, entradaDeGuion, hayDeDondeEscribir, bloqueSecuencia,
  pasoAVoz, pasoATexto, guionParaLeer, sinGuion, palabrasDe, guionVigente, textoDelNegocio,
  GUION_PASO_SYSTEM_TEMPLATE, FEATURE_GUION_AUDIO, GUION_PALABRAS, type PasoConVoz,
} from '../lib/guion-audio';
import { textoDelPaso } from '../lib/nutricion-canal';
import { CATALOGO_MODELOS, PROVEEDORES_PAGOS } from '../lib/model-catalogo';
import { renderTemplate } from '../lib/prompt-render-pure';

// =============================================================================
// El guion para leer al grabar la nota de voz de un mensaje (#748)
// =============================================================================
// Decisión de Martín (06/10/2026): «c: guion con IA gratis». La ruta iba por
// `chatClaude` con un tag que el veto cortaba mudo, y el control de grabar no mostraba
// ningún guion.
//
// Dos clases de test, y la diferencia importa:
//  · Lo puro se EJECUTA: el filtro de lo que devuelve el modelo y el pase de un paso a
//    nota de voz. Un guard de cableado contesta «¿está enchufado?», nunca «¿hace lo que
//    dice?».
//  · El cableado (la ruta por la cascada gratis, el control dibujando el guion, el
//    wizard usando el pase) se lee del FUENTE, sin comentarios y por BLOQUE: los
//    comentarios de estos archivos nombran `chatClaude` a propósito, para contar por qué
//    se fue.
//
// Probado rompiéndolo (06/10/2026), una rotura por vez con un arnés que restaura DE
// MEMORIA, sobre los 22 tests. Cada una dejó en rojo exactamente lo que tenía que dejar:
//  (1) `pasoAVoz` conservando el cuerpo                → 2 rojos (el del pie vacío y el de volver a texto)
//  (2) `revisarGuion` sin el chequeo de link/llaves     → 1 rojo
//  (3) la viñeta sin el ancla de renglón                → 1 rojo («son las 3. Te espero» caía como lista)
//  (4) sin la comparación de números                    → 1 rojo
//  (5) la ruta importando `chatClaude` otra vez         → 1 rojo
//  (6) `provs` con CASCADA_GRATIS en vez de CASCADA_DOCS → 1 rojo
//  (7) el pin aceptando un override a Claude            → 1 rojo
//  (8) un error fijo en vez de `errorDeCascada`         → 1 rojo
//  (9) «Para leer» movido debajo del ternario del grabador → 1 rojo
// (10) el wizard con el pase a mano que conservaba el cuerpo → 1 rojo
// (11) el lienzo sin la `key` del control               → 1 rojo
// (12) la tarjeta del onboarding sin dibujar el aviso   → 1 rojo
// (13) el pedido del onboarding tragando el fallo otra vez → 1 rojo
// (14) la feature fuera del catálogo                    → 1 rojo
// (15) el control ignorando el texto del mensaje (`guion`) → 1 rojo
// Las demás quedaron en verde en cada corrida (21 de 22, o 20 en la primera).
//
// La revisión adversarial (06/10/2026) sumó 7 tests y los rompió igual, con el mismo
// arnés: sin romper 29 de 29; cada rotura dejó 28 pases y 1 rojo, el suyo, y al restaurar
// volvió a 29 de 29.
//  (R1) `textoDelPaso` sorteando también en un audio        → «el pie vacío llega vacío…»
//  (R2) `pasoAVoz` sin restaurar `vozPrevia`                 → «voz → texto → voz…»
//  (R3) `guionVigente` ignorando de qué texto salió           → «el guion de MaKo vale sólo…»
//  (R4) `textoDelNegocio` sin objetivo ni preguntas           → «lo que la secuencia declara…»
//  (R5) el control mostrando `guionIA` sin `guionVigente`     → «el control ata el guion…»
//  (R6) la ruta con el `delNegocio` de antes                  → «la ruta mide las prohibiciones…»
//  (R7) `sinGuion` dejando pasar `vozPrevia`                  → «el guion no viaja al guardar…»
//  (R8) el motor armando el pie sin `textoDelPaso`            → «el motor usa el `textoDelPaso`…»

const RAIZ = fileURLToPath(new URL('..', import.meta.url));
const leer = (rel: string) => readFileSync(RAIZ + rel, 'utf8').replace(/\r\n/g, '\n');

/** Las líneas primero (un `//` puede abrir un `/*` que se cierra páginas abajo). */
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

/** El bloque entre dos anclas, con su cierre REAL y no un recorte por caracteres. */
function bloque(src: string, desde: string, hasta: string): string {
  const i = src.indexOf(desde);
  assert.ok(i >= 0, `no encontré el arranque del bloque: ${desde}`);
  const j = src.indexOf(hasta, i + desde.length);
  assert.ok(j > i, `no encontré el cierre del bloque: ${hasta}`);
  return src.slice(i, j);
}

const cuenta = (src: string, aguja: string) => src.split(aguja).length - 1;

// ─────────────────────────────────────────────────────────────────────────────
// 1. Lo que el modelo devuelve: ¿se puede leer en voz alta tal cual? (se EJECUTA)
// ─────────────────────────────────────────────────────────────────────────────

const BUENO = 'Hola, ¿cómo estás? Te grabo este audio porque quería contarte algo rápido. Armamos una sesión corta para ver tu caso y entender qué te está frenando hoy. No es una venta: es una charla para que te lleves claridad sobre lo que sigue. Te dejo por escrito el link para que elijas el horario que mejor te quede. ¿Te sirve esta semana?';

test('un guion hablado, del largo justo y sin datos inventados, pasa', () => {
  const n = palabrasDe(BUENO);
  assert.ok(n >= GUION_PALABRAS.min && n <= GUION_PALABRAS.max, `el ejemplo tiene ${n} palabras`);
  assert.deepEqual(revisarGuion(BUENO, ''), { ok: true });
});

// ⟵ ROTURA (2): sin el chequeo de `piezasCriticas` → este test rojo (1 fallo), el resto verde.
test('un link o un dato entre llaves no se dicen: el audio es el mismo para todos', () => {
  const link = revisarGuion(`${BUENO} Entra a https://cal.com/negocio/30min`, '');
  assert.equal(link.ok, false);
  assert.match((link as { motivo: string }).motivo, /link/);
  assert.equal(revisarGuion(`Hola {{lead_nombre}}, ${BUENO}`, '').ok, false);
  assert.equal(revisarGuion(`Hola {nombre}, ${BUENO}`, '').ok, false);
});

// ⟵ ROTURA (3): la viñeta sin el ancla de renglón (`^` y `/m`) → este test rojo: «son
//   las 3. Te espero» se rechazaba como lista.
test('corchetes, viñetas, negritas o emojis no son habla; un número con punto en la prosa sí', () => {
  assert.equal(revisarGuion(`Soy [tu nombre]. ${BUENO}`, '').ok, false);
  assert.equal(revisarGuion(`${BUENO}\n- Primero esto\n- Después aquello`, '').ok, false);
  assert.equal(revisarGuion(`${BUENO} **Importante**`, '').ok, false);
  assert.equal(revisarGuion(`${BUENO} 🙂`, '').ok, false);
  // Prosa con un número seguido de punto: no es una lista numerada.
  assert.deepEqual(revisarGuion(`${BUENO} Nos vemos a las 3. Te espero.`, 'la sesión es a las 3'), { ok: true });
});

test('de menos de 25 o de más de 170 palabras no es una nota de voz de 30 a 60 segundos', () => {
  const corto = revisarGuion('Hola, ¿cómo estás? ¿Viste el video?', '');
  assert.equal(corto.ok, false);
  assert.match((corto as { motivo: string }).motivo, /corto/);
  const largo = revisarGuion(`${BUENO} ${BUENO} ${BUENO}`, '');
  assert.equal(largo.ok, false);
  assert.match((largo as { motivo: string }).motivo, /largo/);
});

// ⟵ ROTURA (4): sin la comparación de números → este test rojo (1 fallo).
test('un número que el negocio no escribió es un invento; uno que sí escribió, no', () => {
  const inventa = revisarGuion(`${BUENO} Y son 1.500 pesos al mes.`, 'Hola, ¿viste el video?');
  assert.equal(inventa.ok, false);
  assert.match((inventa as { motivo: string }).motivo, /1500/);
  // «$1500» en el perfil y «1.500» en el guion son el mismo dato.
  assert.deepEqual(revisarGuion(`${BUENO} Y son 1.500 pesos al mes.`, 'El programa cuesta $1500 al mes.'), { ok: true });
});

test('se le saca lo que un modelo pone alrededor, y los renglones se quedan', () => {
  assert.equal(limpiarGuion('```\nGuion: «Hola, ¿qué tal?»\n```'), 'Hola, ¿qué tal?');
  assert.equal(limpiarGuion('"Te cuento algo."'), 'Te cuento algo.');
  // Si se juntara todo en un párrafo antes de revisar, una lista pasaría como prosa.
  assert.equal(limpiarGuion('Uno\n- dos\n\n\n\ntres'), 'Uno\n- dos\n\ntres');
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Lo que pide la pantalla (se EJECUTA)
// ─────────────────────────────────────────────────────────────────────────────

test('el pedido se sanea: sin objeto no es un pedido de paso, y lo largo se recorta', () => {
  assert.equal(entradaDeGuion(null), null);
  assert.equal(entradaDeGuion('hola'), null);
  assert.equal(entradaDeGuion([1, 2]), null);
  const e = entradaDeGuion({ texto: '  Hola  ', pie: 'x'.repeat(5000), objetivo: 'agendar', preguntas: [' ¿A qué te dedicas? ', '', 3, '¿Cuándo empiezas?'] })!;
  assert.equal(e.texto, 'Hola');
  assert.equal(e.pie.length, 1000);
  assert.equal(e.gancho, '');
  assert.deepEqual(e.preguntas, ['¿A qué te dedicas?', '¿Cuándo empiezas?']);
  // Sin texto y sin nada de la secuencia no hay de dónde escribir: se pide, no se inventa.
  assert.equal(hayDeDondeEscribir(entradaDeGuion({})!), false);
  assert.equal(hayDeDondeEscribir(entradaDeGuion({ objetivo: 'reactivar' })!), true);
});

// ⟵ ROTURA (R4, revisión adversarial): `textoDelNegocio` sin el objetivo ni las preguntas → rojo.
test('lo que la secuencia declara cuenta como del negocio: ni sus números ni su objetivo son inventos', () => {
  const e = entradaDeGuion({ texto: '', objetivo: 'agendar', gancho: '', preguntas: ['¿Facturas más de 10 mil al mes?'] })!;
  const del = textoDelNegocio(e);
  // P2 de las prohibiciones del onboarding es /\b(agend\w+|…)\b/: con el objetivo afuera,
  // un negocio sin link de agenda rechazaba todo guion que dijera «agendemos».
  assert.match(del, /\bagend\w+/);
  const conNumero = `${BUENO} Si facturas más de 10 mil al mes, esto es para ti.`;
  assert.deepEqual(revisarGuion(conNumero, del), { ok: true }, 'el 10 lo escribió el negocio en sus preguntas');
  // El rótulo de 'preparar' («Preparar para la llamada») es texto del producto: no entra.
  assert.doesNotMatch(textoDelNegocio(entradaDeGuion({ objetivo: 'preparar' })!), /llamada/);
  // Y el pie también es del negocio.
  assert.match(textoDelNegocio(entradaDeGuion({ pie: 'Agenda aquí: https://cal.com/x' })!), /Agenda aquí/);
});

test('la ruta mide las prohibiciones y los números contra `textoDelNegocio`', () => {
  const gdp = bloque(sinComentarios(leer('app/api/chat-agent/onboarding/guion-audio/route.ts')), 'async function guionDePaso(', '\n}\n');
  assert.match(gdp, /const delNegocio = textoDelNegocio\(e\);/);
  assert.match(gdp, /&& !p\.re\.test\(delNegocio\)\);/);
  assert.match(gdp, /const permitido = \[delNegocio, perfil\]\.join\('\\n'\);/);
});

test('el objetivo llega al modelo con su NOMBRE, no con el valor interno', () => {
  const b = bloqueSecuencia({ objetivo: 'agendar', gancho: 'Guía de 5 pasos', preguntas: ['¿A qué te dedicas?'] });
  assert.match(b, /Objetivo: Agendar una reunión\./);
  assert.match(b, /Guía de 5 pasos/);
  assert.match(b, /¿A qué te dedicas\?/);
  // Uno escrito a mano con «Otro» pasa tal cual.
  assert.match(bloqueSecuencia({ objetivo: 'Vender el taller', gancho: '', preguntas: [] }), /Objetivo: Vender el taller\./);
  assert.equal(bloqueSecuencia({ objetivo: '', gancho: '', preguntas: [] }), '(la secuencia no tiene objetivo cargado)');
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pasar un mensaje a nota de voz: el texto se lee, el pie queda vacío (se EJECUTA)
// ─────────────────────────────────────────────────────────────────────────────

// Con el tipo del paso ANCHO, como el del wizard: un literal `tipo: 'texto'` haría que el
// tipo de vuelta de `pasoAVoz` dijera 'texto' sobre un paso que ya es de voz.
type Paso = PasoConVoz & { orden: number; canal: 'whatsapp' | 'email' };
const TEXTO: Paso = { orden: 1, canal: 'whatsapp', tipo: 'texto', audio_id: null, cuerpo: 'Hola, ¿pudiste ver el video?' };

// ⟵ ROTURA (1): `pasoAVoz` dejando el cuerpo puesto (el bug: el lead recibía el audio y el
//   mismo texto) → este test y el de «volver a texto» en rojo (2 fallos), el resto verde.
test('al pasar a voz, el texto pasa a ser el guion y el pie queda VACÍO', () => {
  const voz = pasoAVoz(TEXTO, 42);
  assert.equal(voz.tipo, 'audio');
  assert.equal(voz.audio_id, 42);
  assert.equal(voz.proveedor, 'no_oficial');
  assert.equal(voz.cuerpo, '', 'con el cuerpo puesto, el motor lo manda como pie: el audio y además el mismo texto');
  assert.equal(voz.guion, 'Hola, ¿pudiste ver el video?');
  assert.equal(guionParaLeer(voz), 'Hola, ¿pudiste ver el video?');
  // Antes de pasarlo (mientras se graba la primera vez), lo que se lee es el texto.
  assert.equal(guionParaLeer(TEXTO), 'Hola, ¿pudiste ver el video?');
});

test('cambiar el audio de un paso que YA era de voz no toca su pie', () => {
  const voz = { ...pasoAVoz(TEXTO, 42), cuerpo: 'Te dejo el video: https://x.co/v' };
  const otro = pasoAVoz(voz, 7);
  assert.equal(otro.audio_id, 7);
  assert.equal(otro.cuerpo, 'Te dejo el video: https://x.co/v', 'el cuerpo de un paso de voz ES el pie');
  assert.equal(otro.guion, 'Hola, ¿pudiste ver el video?');
});

test('volver a texto restaura el texto y no pierde el pie que se escribió', () => {
  const voz = { ...pasoAVoz(TEXTO, 42), cuerpo: 'https://x.co/v' };
  const t = pasoATexto(voz);
  assert.equal(t.tipo, 'texto');
  assert.equal(t.audio_id, null);
  assert.equal(t.cuerpo, 'Hola, ¿pudiste ver el video?\n\nhttps://x.co/v');
  assert.equal(t.guion, null);
  assert.deepEqual(pasoATexto(pasoAVoz(TEXTO, 42)).cuerpo, TEXTO.cuerpo);
  // Un paso que ya es de texto no se toca.
  assert.equal(pasoATexto(TEXTO), TEXTO);
});

test('el guion no viaja al guardar: el server no lo conoce y lo tiraría sin avisar', () => {
  const limpio = sinGuion(pasoAVoz(TEXTO, 42));
  assert.equal('guion' in limpio, false);
  assert.equal(limpio.audio_id, 42);
  // Lo mismo para cómo estaba partido el paso al volver a texto.
  const vuelta = sinGuion(pasoATexto({ ...pasoAVoz(TEXTO, 42), cuerpo: 'https://x.co/v' }));
  assert.equal('vozPrevia' in vuelta, false);
  assert.equal('guion' in vuelta, false);
});

// ⟵ ROTURA (R2, revisión adversarial): `pasoAVoz` sin restaurar `vozPrevia` → rojo.
test('voz → texto → voz sin tocar el texto deja cada cosa en su lugar: el link sigue siendo el pie', () => {
  // El camino real: el desplegable del grabador, «Grabar uno nuevo…», pasa el paso a
  // texto (`onElegir(null)`) y grabar lo vuelve a voz.
  const conPie = { ...pasoAVoz(TEXTO, 42), cuerpo: 'Te dejo el video: https://x.co/v' };
  const otraVez = pasoAVoz(pasoATexto(conPie), 7);
  assert.equal(otraVez.cuerpo, 'Te dejo el video: https://x.co/v', 'sin esto el link dejaba de salir: quedaba metido en el guion');
  assert.equal(otraVez.guion, 'Hola, ¿pudiste ver el video?');
  assert.equal(otraVez.audio_id, 7);
  assert.equal(otraVez.vozPrevia, null);
  // Un paso de voz sin guion (el que viene guardado): vuelve con su pie y nada para leer.
  const guardado: Paso = { orden: 2, canal: 'whatsapp', tipo: 'audio', audio_id: 9, cuerpo: 'https://x.co/v' };
  const ida = pasoAVoz(pasoATexto(guardado), 9);
  assert.equal(ida.cuerpo, 'https://x.co/v');
  assert.equal(guionParaLeer(ida), '');
  // Si en el medio editaron el texto, el texto entero es lo que se lee y el pie arranca vacío.
  const editado = { ...pasoATexto(conPie), cuerpo: 'Otro texto, escrito a mano.' };
  const voz2 = pasoAVoz(editado, 7);
  assert.equal(voz2.cuerpo, '');
  assert.equal(voz2.guion, 'Otro texto, escrito a mano.');
});

// ⟵ ROTURA (R1, revisión adversarial): `textoDelPaso` sorteando también en un audio → rojo.
test('el pie vacío llega vacío: un paso de audio no sortea variantes del texto que había antes', () => {
  // Lo que pasa de verdad al guardar: `setSecuenciaPasos` mergea las variantes POR ORDEN,
  // así que un mensaje que tenía variantes las conserva al pasar a voz.
  const variantes = ['¿Llegaste a ver el video?', '¿Pudiste mirar el video que te mandé?'];
  const guardado = { ...sinGuion(pasoAVoz(TEXTO, 42)), variantes };
  for (let i = 0; i < 40; i++) {
    assert.equal(textoDelPaso(guardado), '', 'el motor mandaba una variante del texto viejo como pie: el audio y lo mismo por escrito');
  }
  // Con un pie puesto, sale SIEMPRE el pie (el sorteo mandaba el link una de cada N veces).
  const conPie = { ...guardado, cuerpo: 'https://x.co/v' };
  for (let i = 0; i < 40; i++) assert.equal(textoDelPaso(conPie), 'https://x.co/v');
  // Un mensaje de texto sigue sorteando entre su cuerpo y sus variantes.
  const salen = new Set(Array.from({ length: 200 }, () => textoDelPaso({ ...TEXTO, variantes })));
  assert.deepEqual([...salen].sort(), [TEXTO.cuerpo, ...variantes].sort());
});

test('el motor usa el `textoDelPaso` que tiene test, no una copia propia', () => {
  const motor = sinComentarios(leer('lib/nutricion.ts'));
  assert.doesNotMatch(motor, /function textoDelPaso\(/, 'una segunda copia vuelve a sortear en los audios');
  assert.match(motor, /import \{[^}]*\btextoDelPaso\b[^}]*\} from '@\/lib\/nutricion-canal';/);
  assert.match(motor, /const cuerpoNO = aplicarVariables\(textoDelPaso\(paso\), varsNO\);/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. El prompt y el catálogo
// ─────────────────────────────────────────────────────────────────────────────

test('el prompt llena sus tres slots y pide habla corta, sin links, con tuteo', () => {
  const r = renderTemplate(GUION_PASO_SYSTEM_TEMPLATE, { perfil: 'PERFIL-X', secuencia: 'SEC-X', voz: 'VOZ-X' });
  for (const v of ['PERFIL-X', 'SEC-X', 'VOZ-X']) assert.ok(r.includes(v), `no se llenó ${v}`);
  assert.doesNotMatch(r, /\{\{(perfil|secuencia|voz)\}\}/);
  assert.match(r, /tuteo/);
  assert.match(r, /Nunca leas un link en voz alta/);
  assert.match(r, /30 a 60 segundos/);
});

// ⟵ ROTURA (14): la fila con otro nombre de feature → rojo (1 fallo).
test('la feature está en el catálogo con un default GRATIS (antes el veto la cortaba mudo)', () => {
  const f = CATALOGO_MODELOS.find((x) => x.feature === FEATURE_GUION_AUDIO);
  assert.ok(f, 'sin la fila, el override de /modelos-ia no tiene dónde vivir');
  assert.ok(!PROVEEDORES_PAGOS.includes(f!.def.provider), `el guion no se paga: def es ${f!.def.provider}`);
});

test('el prompt está registrado y la ruta lo renderiza con esa misma key', () => {
  const reg = sinComentarios(leer('lib/prompt-registry.ts'));
  const fila = bloque(reg, "key: 'chatbot.guion-audio'", '},');
  assert.match(fila, /default: GUION_PASO_SYSTEM_TEMPLATE,/);
  assert.match(reg, /import \{ GUION_PASO_SYSTEM_TEMPLATE \} from '\.\/guion-audio';/);
  const ruta = sinComentarios(leer('app/api/chat-agent/onboarding/guion-audio/route.ts'));
  assert.match(ruta, /renderPrompt\('chatbot\.guion-audio', GUION_PASO_SYSTEM_TEMPLATE, \{/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. La ruta: por la cascada gratis, nunca por Claude, y el fallo se DICE
// ─────────────────────────────────────────────────────────────────────────────

const RUTA = sinComentarios(leer('app/api/chat-agent/onboarding/guion-audio/route.ts'));

// ⟵ ROTURA (5): devolverle a la ruta el `chatClaude` del pedido del onboarding → este
//   test rojo (1 fallo).
test('la ruta no llama a Claude: una sola puerta al modelo, y es la cascada gratis', () => {
  assert.doesNotMatch(RUTA, /chatClaude|@\/lib\/anthropic/, 'Claude vuelve a cortarse por el veto y la ruta falla muda');
  assert.equal(cuenta(RUTA, 'chatCheapCascade('), 1, 'una sola llamada: la de `escribir`, que usan los dos pedidos');
  const esc = bloque(RUTA, 'async function escribir(', '\n}\n');
  // ⟵ ROTURA (6): `provs` con CASCADA_GRATIS → rojo (1 fallo). Es la lista SIN Gemini:
  //   ws13, ws15 y ws17 no tienen otra key (medido el 06/10/2026).
  assert.match(esc, /provs: usaPin \? \[pin\.provider as ProvName\] : CASCADA_DOCS,/);
  // ⟵ ROTURA (7): el pin aceptando cualquier proveedor → rojo (1 fallo).
  assert.match(esc, /const usaPin = pin != null && pin\.provider !== 'anthropic';/, 'un override a Claude no puede hacer pagar el guion');
  assert.match(esc, /feature: FEATURE_GUION_AUDIO,/);
  assert.match(esc, /validar: \(t\) => \{\s*const porque = p\.revisar\(limpiarGuion\(t\)\);/);
  assert.match(esc, /erroresOut: errores,/);
});

// ⟵ ROTURA (8): `escribir` devolviendo un error fijo en vez de `errorDeCascada` → rojo.
//   (12) y (13), la tarjeta sin el aviso y el onboarding tragando el fallo → el mismo rojo.
test('cuando no sale nada, el motivo se dice: rechazo del filtro o errorDeCascada, nunca silencio', () => {
  const esc = bloque(RUTA, 'async function escribir(', '\n}\n');
  assert.match(esc, /if \(rechazos\.length\) return \{ error: `El guion que escribió MaKo \$\{rechazos\[rechazos\.length - 1\]\}\. Prueba de nuevo\.` \};/);
  assert.match(esc, /return \{ error: await errorDeCascada\(errores, 'escribir el guion'\) \};/);
  // El pedido del onboarding ya no traga el fallo: viaja como `aviso`.
  assert.match(RUTA, /return Response\.json\(\{ ok: true, bullets, ejemplo, \.\.\.\(aviso && !ejemplo \? \{ aviso \} : \{\}\) \}\);/);
  assert.match(sinComentarios(leer('app/chatbot/GrabadorAudioPaso.tsx')), /\{!guion\.ejemplo && guion\.aviso && \(/);
});

test('el pedido de un paso sale ANTES que el del onboarding, y su guion pasa por el filtro', () => {
  const post = bloque(RUTA, 'export async function POST(', '\n}\n');
  const paso = post.indexOf('const paso = entradaDeGuion(body.paso);');
  assert.ok(paso >= 0);
  assert.ok(paso < post.indexOf('defDeClave(clave)'), 'un pedido de paso no tiene `clave`: caería en «Audio desconocido»');
  assert.match(post, /return await guionDePaso\(paso\);/);
  const gdp = bloque(RUTA, 'async function guionDePaso(', '\n}\n');
  assert.match(gdp, /const v = revisarGuion\(t, permitido\);/);
  assert.match(gdp, /if \('error' in r\) return Response\.json\(\{ ok: false, error: r\.error \}/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. El control dibuja el guion, y los dos que lo montan se lo pasan
// ─────────────────────────────────────────────────────────────────────────────

const CONTROL = sinComentarios(leer('app/chatbot/PasoAudioControl.tsx'));

// ⟵ ROTURA (9): el bloque «Para leer» movido debajo del ternario del grabador → rojo
//   (1 fallo). ⟵ ROTURA (15): `paraLeer` sin el `guion` del mensaje → el mismo rojo.
test('«Para leer» se dibuja ARRIBA del grabador y afuera de su ternario: se ve mientras se graba', () => {
  const cuerpo = bloque(CONTROL, '{(audioId || grabando) && (', '{audio?.transcript && (');
  const leerIdx = cuerpo.indexOf('>Para leer<');
  assert.ok(leerIdx >= 0, 'el rótulo «Para leer» no está en el bloque del audio');
  assert.ok(cuerpo.includes('{paraLeer}'), 'el texto para leer no se dibuja');
  assert.ok(leerIdx < cuerpo.indexOf('{voz.recording ? ('), 'si queda debajo o adentro del ternario, desaparece al grabar');
  assert.match(CONTROL, /const paraLeer = \(deMaKo \?\? guion \?\? ''\)\.trim\(\);/);
});

// ⟵ ROTURA (R3, revisión adversarial): `guionVigente` ignorando `de` → rojo.
test('el guion de MaKo vale sólo para el texto del que salió', () => {
  const ia = { texto: 'Lo que escribió MaKo.', de: 'Hola, ¿pudiste ver el video?' };
  assert.equal(guionVigente(ia, 'Hola, ¿pudiste ver el video?'), 'Lo que escribió MaKo.');
  // «↻ Reescribir» o editar el mensaje: el guion era de otro texto y no se muestra.
  assert.equal(guionVigente(ia, 'Te escribo por la reunión del jueves.'), null);
  assert.equal(guionVigente(null, 'x'), null);
});

// ⟵ ROTURA (R5, revisión adversarial): el control mostrando `guionIA` sin pasar por
//   `guionVigente`, o atándolo a la transcripción del audio → rojo.
test('el control ata el guion de MaKo al TEXTO del mensaje y no a la transcripción', () => {
  assert.match(CONTROL, /const delMensaje = guion\?\.trim\(\) \?\? '';/);
  assert.match(CONTROL, /const deMaKo = guionVigente\(guionIA, delMensaje\);/);
  const pedir = bloque(CONTROL, 'async function pedirGuion()', '\n  }\n');
  assert.match(pedir, /const de = delMensaje;/);
  assert.match(pedir, /setGuionIA\(\{ texto: j\.guion, de \}\);/);
  assert.match(CONTROL, /: deMaKo \? '✦ Otra versión' : '✦ Escríbeme el guion'\}/);
});

test('el botón sale sólo con `paraGuion`, y pide desde el MENSAJE (no desde la versión anterior)', () => {
  assert.match(CONTROL, /\{paraGuion && \(\s*<button/);
  assert.match(CONTROL, /'✦ Escríbeme el guion'/);
  const pedir = bloque(CONTROL, 'async function pedirGuion()', '\n  }\n');
  assert.match(pedir, /fetch\(RUTA_GUION, \{/);
  assert.match(CONTROL, /const RUTA_GUION = '\/api\/chat-agent\/onboarding\/guion-audio';/);
  assert.match(pedir, /body: JSON\.stringify\(\{ paso: \{/);
  assert.match(pedir, /texto: guion\?\.trim\(\) \|\| audio\?\.transcript\?\.trim\(\) \|\| '',/);
  assert.doesNotMatch(pedir, /texto: guionIA/);
  // Un tope que vive en la ruta no protege al navegador.
  assert.match(pedir, /signal: AbortSignal\.timeout\(ESPERA_GUION_MS\),/);
  assert.match(pedir, /onError\(j\?\.error \|\| /, 'el motivo que manda la ruta es el que se muestra');
});

// (Rotura 10 retirada el 08/10/2026, segunda tanda: el wizard de 9 pasos dejó de ser la entrada
// para crear —«＋ Nueva» abre el lienzo con «Crear con IA»— y su archivo se borró sin call sites.)

// ⚠️ REESCRITO EL 08/10/2026: el lienzo ya NO monta `PasoAudioControl` (punto 8: «El
// editable del audio también está horrible, todos los botones amontonados... que todo lo que
// tenga que ver con WhatsApp tenga un mismo editable»). El audio, el texto y los archivos van
// en UN editor, `EditorMensajeWhatsApp`; el wizard sigue con su control. Lo que este guard
// cuidaba sigue valiendo: el editor es UNO que se reusa al tocar otra tarjeta, y sin una key
// por tarjeta lo de un mensaje (el guion, lo grabado) se queda dibujado en el siguiente.
// ⟵ ROTURA (11): sin la `key` del editor en el lienzo → rojo (1 fallo). Y volver a montar
//   `PasoAudioControl` en el lienzo → rojo (1 fallo).
test('el lienzo edita el audio con el editor único de WhatsApp, con una key por tarjeta', () => {
  const lienzo = sinComentarios(leer('app/chatbot/FlujoLienzo.tsx'));
  assert.doesNotMatch(lienzo, /<PasoAudioControl/, 'volvió el control suelto del audio al lienzo');
  const ed = bloque(lienzo, '<EditorMensajeWhatsApp', '/>');
  assert.match(ed, /key=\{`msg-\$\{id\}`\}/, 'el editor es uno: sin key, lo de un mensaje se ve en el siguiente');
  assert.match(ed, /audios=\{audios\} onAudioNuevo=\{onAudioNuevo\}/, 'la biblioteca de audios no llega al editor');
});
