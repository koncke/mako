// =============================================================================
// MaKo inventando cómo funciona MaKo
// =============================================================================
// 25/08/2026. Un cliente preguntó si Clarity necesitaba el pixel de Meta. MaKo:
// «Clarity usa el Pixel de Meta para grabar eventos y mapas de calor» y «si querés
// datos reales de tu landing, el Pixel de Meta es obligatorio». Las dos FALSAS:
// Clarity es de Microsoft y viaja ADENTRO del propio snippet de MaKo.
//
// No fue un mal día del modelo: el prompt traía el negocio del cliente y CERO
// sobre cómo funciona la herramienta. Preguntado sobre su propio producto, el
// modelo hizo lo único que podía — rellenar.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { hechosMako, LARGO_WHATSAPP } from '../lib/hechos-mako';

const leer = (p: string): string => readFileSync(new URL(p, import.meta.url), 'utf8');
const H = hechosMako('https://hola-mako.com');

test('Los hechos desmienten explícitamente lo que MaKo había inventado', () => {
  // ⚠️ Desde el 06/10/2026 las grabaciones son de MaKo y no de Clarity, así que la
  // corrección del caso real se dice sobre ellas: el modo de falla —«las
  // grabaciones necesitan el pixel de Meta»— no dependía de qué herramienta grabara.
  assert.match(H, /GRABACIONES[^.]*NO TIENEN NADA QUE VER CON META/i,
    'se perdió la corrección del caso real: las grabaciones no necesitan el pixel de Meta');
  assert.match(H, /nunca lo digas/i, 'la corrección dejó de ser una prohibición explícita');
  // Y la contracara: qué SÍ pasa con el pixel de Meta, o MaKo se queda muda.
  assert.match(H, /Conversions API|CAPI/i, 'no dice que MaKo manda las conversiones desde el servidor');
});

// PROBADO ROMPIENDOLO: borrando el renglón «MAKO YA NO USA MICROSOFT CLARITY» de
// lib/hechos-mako.ts, este test falla. Los clientes siguen preguntando por Clarity
// —un cliente lo pidió por WhatsApp el mismo día del retiro— y sin el hecho, MaKo
// los mandaría a conectarlo.
test('MaKo sabe que ya no usa Clarity, y no manda a nadie a conectarlo', () => {
  assert.match(H, /MAKO YA NO USA MICROSOFT CLARITY/, 'sin el hecho, MaKo manda a conectar una herramienta que ya no existe');
  assert.match(H, /No le pidas que conecte Clarity/, 'la prohibición explícita se perdió');
  // Y el link que le daba a los clientes para «conectar Clarity» no abría nada desde
  // antes del retiro: la tarjeta estaba oculta. No puede volver.
  assert.ok(!H.includes('abrir=clarity'), 'un link a una tarjeta que no existe');
});

test('La base del link la pone el CÓDIGO, no el modelo', () => {
  // En la primera prueba de esto, MaKo contestó bien y linkeó a
  // `https://tu-dashboard.com/integraciones`: un dominio inventado.
  assert.ok(H.includes('https://hola-mako.com/integraciones?abrir=meta'), 'la URL no llega armada');
  const src = leer('../lib/hechos-mako.ts');
  assert.ok(!/hola-mako\.com/.test(src), 'el dominio quedó hardcodeado en el módulo');
  assert.match(leer('../lib/mako-context.ts'), /hechosMako\(APP_BASE_URL\)/,
    'la base dejó de salir de app-url: el modelo vuelve a inventar el dominio');
});

test('Prohíbe dictar código de terceros con ids de juguete', () => {
  // MaKo le dictó el <script> de Meta con `fbq('init', '1234567890123456')`. Un id
  // de ejemplo que alguien copia y pega es peor que no contestar: parece que anda.
  assert.match(H, /1234567890123456/, 'se perdió el ejemplo concreto de lo que NO se hace');
  assert.match(H, /NUNCA dictes un bloque de código/i, 'se perdió la prohibición');
});

test('Los hechos viajan en TODAS las superficies, no solo en WhatsApp', () => {
  // Van en buildSystemPrompt y no en el preámbulo del doer: la IA inventa sobre el
  // producto en el chat de la app igual que en WhatsApp.
  assert.match(leer('../lib/mako-context.ts'), /hechosMako/,
    'los hechos se sacaron del contexto compartido');
});

test('El largo de WhatsApp da la SALIDA, no solo el límite', () => {
  // El preámbulo ya pedía «2-5 líneas» y el modelo escribió 60 con bloques de
  // código. Prohibir sin ofrecer alternativa no cambia el comportamiento.
  assert.match(LARGO_WHATSAPP, /link/i, 'el tope no ofrece a dónde mandar el detalle');
  assert.match(leer('../lib/mako-doer-in.ts'), /\$\{LARGO_WHATSAPP\}/,
    'el tope de largo no está cableado al prompt del doer');
});

test('Una intención DUDOSA no puede crear un borrador de plan', () => {
  // Tres mensajes conversacionales del cliente —«ahí hice la prueba», «hay un
  // problema chiquito con el botón», «probá de vuelta, ya agregué otra api key»—
  // terminaron en tres «Listo, te armé el borrador» con un link a revisar un plan
  // que nunca pidió.
  // La selección de herramientas se mudó a lib/doer-herramientas.ts el 08/10/2026 (la misma
  // que usa el test de agenda): el corte vive ahí, y el doer le pasa el veredicto entero.
  const src = leer('../lib/doer-herramientas.ts');
  assert.match(src, /if \(!dudosa\) return base;/, 'se perdió el corte por clasificación dudosa');
  assert.match(src, /t\.name !== 'proponer_tareas_plan'/,
    'la tool de crear tareas volvió a estar disponible en un turno que no se pudo clasificar');
  assert.match(src, /toolsParaIntencion<[^>]*>\(v\.intencion, \[[^\]]*\], v\.dudosa\)/,
    'el flag `dudosa` dejó de llegar al selector de tools');
  assert.match(leer('../lib/mako-doer-in.ts'), /herramientasDelTurno\(\{\s*veredicto: intencion,/,
    'el doer dejó de pasarle el veredicto a la selección');
  // ⛔ Y el default del clasificador NO se toca: ante la duda, capturar sigue
  // siendo correcto para el dueño volcando ideas. Lo que se corrige es que la duda
  // no EJECUTE.
  assert.match(leer('../lib/mako-intencion.ts'), /intencion: 'capturar', dudosa: true/,
    'se cambió el default del clasificador en vez de impedir que la duda ejecute');
});
