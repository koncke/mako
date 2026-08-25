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
  assert.match(H, /CLARITY[^.]*NO TIENE NADA QUE VER CON META/i,
    'se perdió la corrección del caso real: Clarity no necesita el pixel de Meta');
  assert.match(H, /nunca lo digas/i, 'la corrección dejó de ser una prohibición explícita');
  // Y la contracara: qué SÍ pasa con el pixel de Meta, o MaKo se queda muda.
  assert.match(H, /Conversions API|CAPI/i, 'no dice que MaKo manda las conversiones desde el servidor');
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
  const src = leer('../lib/mako-doer-in.ts');
  assert.match(src, /if \(!dudosa\) return base;/, 'se perdió el corte por clasificación dudosa');
  assert.match(src, /t\.name !== 'proponer_tareas_plan'/,
    'la tool de crear tareas volvió a estar disponible en un turno que no se pudo clasificar');
  assert.match(src, /toolsParaIntencion\(intencion\.intencion, \[[^\]]*\], intencion\.dudosa\)/,
    'el flag `dudosa` dejó de llegar al selector de tools');
  // ⛔ Y el default del clasificador NO se toca: ante la duda, capturar sigue
  // siendo correcto para el dueño volcando ideas. Lo que se corrige es que la duda
  // no EJECUTE.
  assert.match(leer('../lib/mako-intencion.ts'), /intencion: 'capturar', dudosa: true/,
    'se cambió el default del clasificador en vez de impedir que la duda ejecute');
});
