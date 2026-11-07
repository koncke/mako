// =============================================================================
// Los nombres de programa que descartaban llamadas de venta de OTROS clientes
// =============================================================================
// La pre-clasificación del Closing Analyst descarta una llamada sin gastar Claude cuando el
// título la nombra como entrega de servicio. Hasta el 06/11/2026 ese detector traía cableado el
// vocabulario de UN cliente y se lo aplicaba a todos los workspaces:
//
//     /^\s*servicio:|^\s*coaching:|paddock\s*&\s*pit|programa\s+via
//      |sesiones\s+programa|reporte\s+semanal|scaling\s*up|mesa\s+de\s+trabajo/i
//
// Para otro cliente, una llamada de VENTA titulada «Mesa de trabajo» o «Scaling Up» se
// clasificaba como entrega ANTES de que el modelo la leyera: sin error, sin aviso y sin dejar
// ni la fila que el análisis sí deja. Descartar es destructivo y silencioso, así que la
// condición vive fuera de `server-only` para poder testearla — la regla de la casa.
// Correr: node --import tsx --test tests/closing-marcadores.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  esEntregaExplicita, marcadoresDe, normalizar, MINIMO_CARACTERES,
  PALABRAS_GENERICAS, RE_CONVENCION_APP, RE_VENTA_FUERTE, SIN_MARCADORES,
} from '../lib/closing-marcadores';

// Los nombres que estaban cableados, como los tendría cargados el negocio que SÍ los vende.
const NEGOCIO_UNO = marcadoresDe(['Paddock & Pit', 'Programa VIA', 'Scaling Up', 'Mesa de trabajo']);

test('EL BUG: el programa de un cliente no descarta la venta de otro', () => {
  // El negocio que vende «Mesa de trabajo» sigue descartando su sesión de entrega.
  assert.equal(esEntregaExplicita('Mesa de trabajo - sesión 4', NEGOCIO_UNO), true);
  assert.equal(esEntregaExplicita('Scaling Up con el equipo', NEGOCIO_UNO), true);
  assert.equal(esEntregaExplicita('Paddock & Pit octubre', NEGOCIO_UNO), true);

  // Y para CUALQUIER otro negocio, esos títulos son una llamada que el modelo tiene que leer.
  const otro = marcadoresDe(['Aceleradora Inmobiliaria']);
  for (const t of ['Mesa de trabajo', 'Scaling Up', 'Paddock & Pit', 'Programa VIA']) {
    assert.equal(esEntregaExplicita(t, otro), false,
      `era el bug: se descartaba «${t}» como entrega y no quedaba ni la fila`);
  }
});

test('el fallback es NINGÚN marcador, nunca los nombres del cliente de antes', () => {
  // Si no se pudo leer la configuración del negocio: a lo sumo se analiza de más —se ve y
  // cuesta plata— pero no se descarta una venta por el vocabulario de otro.
  for (const t of ['Mesa de trabajo', 'Scaling Up', 'Reporte semanal', 'Sesiones programa VIA']) {
    assert.equal(esEntregaExplicita(t, SIN_MARCADORES), false);
  }
  assert.equal(SIN_MARCADORES.nombres.length, 0);
  // Y el default del parámetro es ése, no una lista cualquiera que ande por ahí.
  assert.equal(esEntregaExplicita('Mesa de trabajo'), false);
});

test('los prefijos de la app se quedan, y valen para todos', () => {
  // Son convención de la app, no de un negocio: nadie los escribe por casualidad. Y alcanzan
  // solos, incluso sin configuración leída.
  assert.equal(esEntregaExplicita('SERVICIO: Juan Pérez', SIN_MARCADORES), true);
  assert.equal(esEntregaExplicita('  coaching: María', SIN_MARCADORES), true);
  assert.equal(esEntregaExplicita('Servicio : con espacio', SIN_MARCADORES), true);
  // PREFIJO, no subcadena: «un prefijo es una declaración; una subcadena es una adivinanza».
  assert.equal(esEntregaExplicita('Propuesta de servicio: cotización', SIN_MARCADORES), false,
    'una venta que menciona «servicio:» en el medio no es una declaración de entrega');
  assert.match('servicio: x', RE_CONVENCION_APP);
  assert.doesNotMatch('mi servicio: x', RE_CONVENCION_APP);
});

test('ANTE LA DUDA, VENTA: una señal fuerte de venta le gana al nombre del programa', () => {
  // El mismo nombre aparece en la llamada donde se VENDE ese programa. El prefijo es una
  // declaración y gana; el nombre es evidencia débil y pierde.
  assert.equal(esEntregaExplicita('Scaling Up - propuesta', NEGOCIO_UNO), false);
  assert.equal(esEntregaExplicita('Mesa de trabajo: diagnóstico inicial', NEGOCIO_UNO), false);
  assert.equal(esEntregaExplicita('Programa VIA - primera llamada', NEGOCIO_UNO), false);
  assert.equal(esEntregaExplicita('Junta 1 Paddock & Pit', NEGOCIO_UNO), false);
  // Cuesta un análisis que el modelo cierra bien; la duda al revés cuesta una venta que nadie
  // vuelve a mirar. Pero la declaración explícita no se discute:
  assert.equal(esEntregaExplicita('SERVICIO: propuesta de renovación', NEGOCIO_UNO), true);
  assert.match('Reunión 2 con Ana', RE_VENTA_FUERTE);
});

test('LA TRAMPA: un nombre que cualquier negocio usaría no entra como marcador', () => {
  // Sin esta guarda, un negocio con un producto llamado «Consultoría» o «Programa mensual» se
  // quedaba sin análisis de ninguna llamada que mencione la palabra, sus ventas incluidas: el
  // mismo bug servido por la configuración en vez de por el código.
  for (const n of ['Programa', 'Consultoría', 'Coaching', 'Sesiones de seguimiento',
    'Programa de coaching', 'Plan mensual', 'Servicios', 'Reunión', 'Demo', 'Asesoría VIP',
    // los nombres que pone la app cuando el dueño no puso ninguno
    'Oferta principal', 'Producto', 'Plan inicial', 'Programa completo']) {
    assert.equal(marcadoresDe([n]).nombres.length, 0, `«${n}» no distingue nada y descartaría ventas`);
  }
  // Pero una palabra genérica JUNTO a una propia sí distingue, y entra la frase entera.
  assert.deepEqual(marcadoresDe(['Programa VIA']).nombres, ['programa via']);
  assert.equal(esEntregaExplicita('VIA sin más', marcadoresDe(['Programa VIA'])), false,
    'el marcador es la frase, no la palabra propia sola');
});

test('LA TRAMPA 2: un nombre corto caza por accidente dentro de un título ajeno', () => {
  assert.equal(marcadoresDe(['VIA']).nombres.length, 0);
  assert.equal(marcadoresDe(['Pro']).nombres.length, 0);
  assert.ok(MINIMO_CARACTERES >= 6, 'bajarlo trae de vuelta los falsos positivos');
  // Y los que sí entran cazan como palabra completa, no como pedazo de otra.
  const m = marcadoresDe(['Paddock']);
  assert.deepEqual(m.nombres, ['paddock']);
  assert.equal(esEntregaExplicita('Paddockmania 3', m), false, 'pedazo de palabra no cuenta');
  assert.equal(esEntregaExplicita('El Paddock de octubre', m), true);
});

test('el rótulo de una reunión de venta del embudo NO puede ser marcador', () => {
  // El caso que le dio nombre al bug: un negocio cuya reunión de VENTA se llama «Mesa de
  // trabajo». Si además tiene un producto con ese nombre, el título es ambiguo para el propio
  // dueño, y ahí la casa ya fijó para dónde se cae.
  const m = marcadoresDe(['Mesa de trabajo', 'Paddock & Pit'], ['Mesa de Trabajo', 'Propuesta']);
  assert.deepEqual(m.nombres, ['paddock pit'], 'el que rotula una reunión de venta queda afuera');
  assert.equal(esEntregaExplicita('Mesa de trabajo con Luis', m), false);
});

test('la normalización es LA MISMA para el nombre y para el título', () => {
  // Si no, el marcador existe y nunca caza: el modo de falla invisible.
  assert.equal(normalizar('Paddock & Pit'), 'paddock pit');
  assert.equal(normalizar('  SESIÓN   Programa-VÍA '), 'sesion programa via');
  assert.equal(normalizar(null), '');
  const m = marcadoresDe(['Paddock & Pit']);
  for (const t of ['paddock&pit', 'PADDOCK  &  PIT', 'Paddock-Pit', 'Pádrock']) {
    const esperado = t !== 'Pádrock';
    assert.equal(esEntregaExplicita(t, m), esperado, `«${t}»`);
  }
});

test('no queda vocabulario de ningún negocio hardcodeado en closing.ts', () => {
  // La guarda que impide que vuelva. El comentario que cuenta el bug SÍ nombra los valores
  // viejos, así que se mira el código sin comentarios.
  const src = readFileSync(new URL('../lib/closing.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  for (const v of ['paddock', 'programa via', 'sesiones programa', 'reporte semanal', 'scaling', 'mesa de trabajo']) {
    assert.ok(!src.toLowerCase().includes(v), `volvió «${v}» al código: eso se le aplica a TODOS los clientes`);
  }
  assert.ok(/marcadoresDelWorkspace/.test(src), 'los marcadores tienen que resolverse por workspace');
  assert.ok(/preClassify\(m, internos, marcadores\)/.test(src), 'el barrido tiene que pasarlos');
});

test('las palabras genéricas cubren lo que de verdad se llama un producto', () => {
  for (const p of ['programa', 'coaching', 'mentoria', 'asesoria', 'consultoria', 'sesion',
    'junta', 'reunion', 'llamada', 'mensual', 'premium', 'seguimiento', 'diagnostico',
    'oferta', 'producto', 'principal']) {
    assert.ok(PALABRAS_GENERICAS.has(p), `falta «${p}»: un producto así descartaría ventas`);
  }
  // Y están normalizadas: un acento acá dejaría la palabra fuera para siempre.
  for (const p of PALABRAS_GENERICAS) assert.equal(normalizar(p), p, `«${p}» no está normalizada`);
});
