import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { respetaElOriginal, piezasCriticas, numerosDe } from '../lib/texto-critico';
import { renderTemplate } from '../lib/prompt-render-pure';
import { TAB_ONBOARDINGS } from '../lib/tab-onboarding-catalogo';
import { pasoBloqueadoPor } from '../lib/onboarding-orden';

// =============================================================================
// El paso en modo IA: MaKo reescribe el mensaje para cada lead
// =============================================================================
// Pedido de Martín (05/10/2026): «haz el interruptor de IA» en la tarjeta de chat del
// lienzo, y que «Tu forma de escribir» se abra «la primera vez que se intente poner una
// tarjeta de chat y activar la opción de "IA"».
//
// Dos clases de test, y la diferencia importa:
//  · `respetaElOriginal` se EJECUTA. Es la segunda capa de «una regla en un prompt no es
//    una regla»: el prompt le pide al modelo conservar los datos, y esto lo comprueba
//    para cuando no lo haga. Un guard de cableado contesta «¿está enchufado?», nunca
//    «¿hace lo que dice?».
//  · El cableado del motor, del saneo y de la pantalla se lee del FUENTE, sin comentarios
//    y por BLOQUE: un guard que lee el archivo entero encuentra lo que el archivo dice de sí.
//
// Probado rompiéndolo (06/10/2026), una rotura por vez, restaurando de memoria:
//  (1) `piezasCriticas` sin la llave simple            → 1 rojo (el de `{nombre}`)
//  (2) `numerosDe` sin sacar los links                 → 1 rojo (el del año en la URL)
//      ⚠️ La primera versión pasó en VERDE: preguntaba por `respetaElOriginal`, donde
//      el link sale igual de los dos lados. Ahora se ejecuta `numerosDe` directo.
//  (3) el saneo conservando `ia` también por email     → 1 rojo (el del saneo)
//  (4) la IA escrita ARRIBA de las guardas del envío   → 1 rojo (el del orden)
//  (5) el modelo recibiendo el texto ya resuelto       → 1 rojo (el de la base cruda)
//  (6) el insert sin `texto_autor`                     → 1 rojo (el del registro)
//  (7) la cascada de `paso-ia` sin CASCADA_GRATIS      → 1 rojo (el de la cascada)
//  (8) el template con el escape inventado `{{"{{"}}`  → 1 rojo (el del template)
//  (9) `contexto` sin `opcional` en el catálogo         → 1 rojo (el del catálogo)
// (10) la casilla con su propia condición de canal      → 1 rojo (el de la casilla)
// (11) el lienzo abriendo el tutorial sin preguntar     → 1 rojo (el de la primera vez)
// (12) con el insert del envío elegido por `estado,` (06/10/2026, #789): la (6) sigue en
//      1 rojo, y un segundo insert que también guarde `estado,` → 1 rojo (el de «UN insert»)
// El resultado de cada una, en docs/hallazgos-comunicacion.md → «El paso en modo IA».

const RAIZ = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
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
// 1. Lo que una reescritura no puede perder (se EJECUTA)
// ─────────────────────────────────────────────────────────────────────────────

const BASE = 'Hola {{lead_nombre}}, ¿pudiste ver el video? Te dejo la agenda: https://cal.com/mako/30min y son $1.500 por mes.';

test('una reescritura que conserva placeholders, link y números pasa', () => {
  const v = respetaElOriginal(BASE, 'Hola {{lead_nombre}}! ¿Llegaste a mirar el video? Agenda acá https://cal.com/mako/30min, son $1500 al mes.');
  assert.deepEqual(v, { ok: true });
});

test('perder un placeholder, el link o el nombre con UNA llave no pasa', () => {
  assert.equal(respetaElOriginal(BASE, '¡Hola Juan! ¿Viste el video? https://cal.com/mako/30min, $1.500 por mes.').ok, false);
  assert.equal(respetaElOriginal(BASE, 'Hola {{lead_nombre}}, ¿viste el video? Agenda en mi perfil, $1.500 por mes.').ok, false);
  // `aplicarVariables` acepta `{nombre}` además de `{{nombre}}`: si la validación sólo
  // mirara las dobles, el mensaje saldría sin el nombre y con la validación en verde.
  assert.equal(respetaElOriginal('Hola {nombre}, ¿cómo vas con la propuesta?', 'Hola, ¿cómo vas con la propuesta que te mandé?').ok, false);
  assert.ok(piezasCriticas('Hola {nombre}').includes('{nombre}'));
  // Una frase entre llaves no es un dato. (Ojo: «{ y }» SÍ lo es — `aplicarVariables`
  // acepta espacios adentro, así que una palabra sola entre llaves es un token.)
  assert.deepEqual(piezasCriticas('Una llave { suelta y otra } aparte'), []);
});

test('cambiar, sacar o inventar un número no pasa; «$1.500» y «$1500» son el mismo dato', () => {
  assert.equal(respetaElOriginal(BASE, 'Hola {{lead_nombre}}, ¿viste el video? https://cal.com/mako/30min — $1.200 por mes.').ok, false);
  assert.equal(respetaElOriginal(BASE, 'Hola {{lead_nombre}}, ¿viste el video? https://cal.com/mako/30min, con precio mensual.').ok, false);
  const inventa = respetaElOriginal('Hola {{lead_nombre}}, ¿hablamos mañana?', 'Hola {{lead_nombre}}, ¿hablamos mañana a las 10?');
  assert.equal(inventa.ok, false);
  assert.match((inventa as { motivo: string }).motivo, /agregó un número/);
  // El «2026» de un link no es un número del mensaje. Se pregunta a `numerosDe` y no a
  // `respetaElOriginal`: el link tiene que estar IGUAL en las dos versiones, así que sus
  // dígitos salen iguales de los dos lados y la comparación no puede ver la diferencia —
  // la primera versión de este test lo preguntaba ahí y pasó en VERDE con el corte roto.
  assert.deepEqual(numerosDe('Mira https://mako.app/caso-2026 son $1.500 a las 10:30 con {{cuota_2}}'), ['1500', '1030']);
});

test('vacío, de seis párrafos o de dos palabras no es «el mismo mensaje adaptado»', () => {
  assert.equal(respetaElOriginal(BASE, '   ').ok, false);
  assert.equal(respetaElOriginal(BASE, `${BASE} ${'Además te cuento muchas cosas más. '.repeat(10)}`).ok, false);
  assert.equal(respetaElOriginal('Hola {{lead_nombre}}, ¿cómo estás? ¿Pudiste revisar lo que te mandé ayer?', 'Hola {{lead_nombre}}').ok, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. El saneo: `tipo: 'ia'` sólo donde el motor lo honra
// ─────────────────────────────────────────────────────────────────────────────

const NUTRI = sinComentarios(leer('lib/nutricion.ts'));

test('el saneo conserva el modo IA sólo en WhatsApp no oficial', () => {
  // (08/10/2026: lo que se escribe es el grafo normalizado, `pasos: grafo`.)
  const saneo = bloque(NUTRI, 'export async function setSecuenciaPasos', '.update({ pasos: grafo');
  assert.match(
    saneo,
    /p\.tipo === 'ia' && p\.canal !== 'email' && proveedorDelPaso\(p\) === 'no_oficial'\s*\?\s*\{ tipo: 'ia' as const \}/,
    'sin esta condición, un paso por plantilla oficial o por email guardaría un modo que el motor no ejecuta',
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. El motor: escribe después de las guardas, con la base CRUDA, y lo registra
// ─────────────────────────────────────────────────────────────────────────────

const RAMA_NO_OFICIAL = bloque(
  NUTRI,
  "} else if (waOn && paso.canal === 'whatsapp' && paso.proveedor === 'no_oficial') {",
  "} else if (waOn && paso.canal === 'whatsapp') {",
);

test('la IA se escribe DESPUÉS de cada guarda que corta el envío, y sólo en las dos ramas que mandan texto', () => {
  assert.equal(cuenta(RAMA_NO_OFICIAL, 'await escribirTexto()'), 2, 'son dos ramas: el envío automático y el borrador');
  const primera = RAMA_NO_OFICIAL.indexOf('await escribirTexto()');
  for (const guarda of ['if (!lead?.telefono)', '} else if (!evoConectado)', 'await estaBloqueado(lead.telefono)']) {
    const g = RAMA_NO_OFICIAL.indexOf(guarda);
    assert.ok(g >= 0, `no encontré la guarda ${guarda}`);
    assert.ok(primera > g, `la IA se escribe antes de «${guarda}»: gastaría cuota en un mensaje que no sale`);
  }
  // El borrador: después de mirar si ya hay uno pendiente.
  assert.ok(
    RAMA_NO_OFICIAL.lastIndexOf('await escribirTexto()') > RAMA_NO_OFICIAL.lastIndexOf('await tieneBorradorNutriPendiente(lead.id)'),
    'el texto del borrador se escribe antes de saber si hay otro pendiente',
  );
  // Y lo que sale es lo que se escribió, no `cuerpoNO`.
  assert.match(RAMA_NO_OFICIAL, /enviarYEspejar\(\{ telefono: lead\.telefono, texto: t\.texto, leadId: lead\.id, linea: lineaSec \}\)/);
  assert.match(RAMA_NO_OFICIAL, /crearBorrador\(\{ leadId: lead\.id, telefono: lead\.telefono, texto: t\.texto,/);
  assert.equal(cuenta(RAMA_NO_OFICIAL, 'if (t.motivo) nota ='), 2, 'el respaldo se registra con su motivo en las dos ramas');
});

test('el modelo recibe el cuerpo CRUDO y las variables se aplican a lo que devuelve', () => {
  // El cierre es el de la función (8 espacios), no el primer `};` — ése es el de un return.
  const def = bloque(RAMA_NO_OFICIAL, 'const escribirTexto = async', '\n        };');
  assert.match(def, /if \(paso\.tipo !== 'ia'\) return \{ texto: cuerpoNO, autor: 'fijo' \}/);
  assert.match(def, /await import\('@\/lib\/paso-ia'\)/, 'import estático = ciclo con nutricion-generator');
  assert.match(def, /escribirPasoIA\(\{ cuerpo: paso\.cuerpo,/, 'con el texto ya resuelto, la validación no puede ver si perdió un placeholder');
  assert.match(def, /aplicarVariables\(r\.texto, varsNO\)/);
  assert.match(def, /\{ texto: cuerpoNO, autor: 'fallback', motivo: r\.motivo \}/);
});

test('cada envío registra QUÉ texto salió y QUIÉN lo escribió (mig 0197)', () => {
  // ⚠️ EL INSERT DEL ENVÍO, no el primero del archivo. Desde el 06/10/2026 (#789) el motor
  // tiene otro antes —el rastro de un cierre SIN envío, en estado 'omitido', que no lleva
  // texto porque no salió nada— y este guard, que tomaba el primero, pasó a mirar ése.
  // El del envío es el único que guarda el `estado` que decidieron las ramas (`estado,`).
  const inserts = NUTRI.split("await supabase.from('nutricion_envios').insert({").slice(1).map((s) => s.slice(0, s.indexOf('});')));
  const delEnvio = inserts.filter((b) => /\n\s+estado,\n/.test(b));
  assert.equal(delEnvio.length, 1, `esperaba UN insert del envío (el que guarda \`estado,\`), hay ${delEnvio.length}`);
  const ins = delEnvio[0];
  assert.match(ins, /texto_enviado: textoEnviado,/);
  assert.match(ins, /texto_autor: textoAutor,/);
  const mig = leer('supabase/migrations/0197_paso_ia.sql');
  assert.match(mig, /add column if not exists texto_enviado text/);
  assert.match(mig, /texto_autor in \('fijo', 'ia', 'fallback'\)/);
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. lib/paso-ia.ts: gratis, validado, y nunca tira
// ─────────────────────────────────────────────────────────────────────────────

const PASO_IA_CRUDO = leer('lib/paso-ia.ts');
const PASO_IA = sinComentarios(PASO_IA_CRUDO);

test('la llamada va por la cascada GRATIS, con la validación determinista como filtro', () => {
  const fn = bloque(PASO_IA, 'export async function escribirPasoIA', '\n}\n');
  assert.match(fn, /provs: CASCADA_GRATIS,/, 'lo que se gasta es CUOTA, nunca plata: el plan nunca paga IA');
  assert.doesNotMatch(PASO_IA, /chatClaude|anthropic/i);
  assert.match(fn, /validar: \(t\) => respetaElOriginal\(base, limpiar\(t\)\)\.ok,/);
  // Nunca tira: el catch devuelve el respaldo.
  assert.match(fn, /catch \(e\) \{\s*return \{ texto: args\.cuerpo, autor: 'fallback'/);
});

test('el template llega al modelo con los placeholders LITERALES (renderTemplate no tiene escape)', () => {
  const tpl = bloque(PASO_IA_CRUDO, 'export const PASO_IA_SYSTEM_TEMPLATE = `', '`;').slice('export const PASO_IA_SYSTEM_TEMPLATE = `'.length);
  assert.doesNotMatch(tpl, /\{\{"/, 'un escape inventado llega como basura visible al prompt');
  const render = renderTemplate(tpl, { voz: 'VOZ-DE-PRUEBA' });
  assert.ok(render.includes('VOZ-DE-PRUEBA'), 'el slot de la voz se tiene que llenar');
  assert.ok(render.includes('{{lead_nombre}}') && render.includes('{nombre}'), 'el modelo tiene que ver las dos formas de placeholder');
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. «Tu forma de escribir»: opcional en la tab, abierto por la casilla
// ─────────────────────────────────────────────────────────────────────────────

test('el paso de la voz vuelve al catálogo como OPCIONAL: no reabre el onboarding de la tab', () => {
  const pasos = TAB_ONBOARDINGS.setting.pasos;
  const ctx = pasos.find((p) => p.key === 'contexto');
  assert.ok(ctx, 'sin la key en la lista, marcarPasoTab la rechaza y el paso no se cierra nunca');
  assert.equal(ctx!.opcional, true, 'no opcional = la tab vuelve a pedir onboarding a todo el que ya la tenía lista');
  // Con el WhatsApp hecho, marcar la voz no tiene nada por delante que lo frene.
  assert.equal(pasoBloqueadoPor(pasos, { wa_no_oficial: { done: true } }, 'contexto'), null);
});

// ⚠️ REESCRITO EL 08/10/2026 (el lienzo con ramas): la casilla pasó a ser el ✦ del editor
// único de WhatsApp (`EditorMensajeWhatsApp`, prop `permiteIA`), con la MISMA condición; y
// la tarjeta marca la IA con `ia` en la burbuja (`BurbujaHilo`). Roturas: la condición sin
// `proveedorDelPaso` (su propia regla de canal) → 1 rojo; la burbuja sin `ia` → 1 rojo.
test('la casilla sale sólo donde el saneo conserva el modo, con la MISMA función', () => {
  const lienzo = sinComentarios(leer('app/chatbot/FlujoLienzo.tsx'));
  assert.match(lienzo, /permiteIA=\{!!onModoIA && paso\.canal === 'whatsapp' && proveedorDelPaso\(paso\) === 'no_oficial' && paso\.tipo !== 'audio' && paso\.tipo !== 'media'\}/);
  assert.match(lienzo, /import \{ proveedorDelPaso \} from '@\/lib\/nutricion-canal'/);
  // Y la tarjeta lo dice: sin la marca, una tarjeta IA y una fija se ven idénticas.
  assert.match(lienzo, /ia: paso\.tipo === 'ia',/);
});

// La rotura (11) se re-probó el 08/10 sobre la forma nueva: abrir el tutorial sin
// preguntar (sacando `abrirGuiaVoz(j)`) → 1 rojo; y el lienzo sin pasarle el aviso al
// perfil (`onModoIA?.(on)` fuera de `modoIA`) → 1 rojo.
test('la primera vez que se tilda, el lienzo PREGUNTA si falta la voz y abre sólo ese paso', () => {
  const perfil = sinComentarios(leer('app/chatbot/SecuenciaPerfil.tsx'));
  const fn = bloque(perfil, 'const abrirGuiaSiFalta = (on: boolean) => {', '\n  };');
  assert.match(fn, /if \(!on \|\| guiaOfrecida\.enLaVisita\) return;/, 'apagar la IA no tiene por qué abrir nada');
  assert.match(fn, /fetch\('\/api\/chat-agent\/onboarding\?tab=setting'/);
  // Pregunta por la GUÍA, no por el tilde del paso (#745): el tilde se marca sin guía escrita.
  assert.match(fn, /if \(abrirGuiaVoz\(j\)\) \{ guiaOfrecida\.enLaVisita = true; setGuiaVoz\(true\); \}/);
  // Una vez por VISITA, no por secuencia: la marca vive en el módulo (el perfil se remonta).
  assert.match(perfil, /^const guiaOfrecida = \{ enLaVisita: false \};$/m);
  assert.match(perfil, /<OnboardingChatAgent soloPaso="contexto" onListo=\{\(\) => setGuiaVoz\(false\)\} \/>/);
  assert.match(perfil, /onModoIA=\{rolAdmin \? abrirGuiaSiFalta : undefined\}/);
  // El lienzo cambia el tipo (un cambio que se deshace) y AVISA al perfil.
  const lienzo = sinComentarios(leer('app/chatbot/FlujoLienzo.tsx'));
  const modo = bloque(lienzo, 'const modoIA = (on: boolean) => {', '\n  };');
  assert.match(modo, /cambiar\(\{ tipo: on \? 'ia' : 'texto' \}, true\);\s*onModoIA\?\.\(on\);/);
  // Con el tutorial encima, el Ctrl+Z del lienzo de atrás no corre.
  assert.match(perfil, /activa: rolAdmin && !guiaVoz/);
});
