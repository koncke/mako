// =============================================================================
// Cada lugar que manda un WhatsApp por `enviarYEspejar` y sus hermanas está DECIDIDO: una persona o una automatización
// =============================================================================
// El «tiempo hasta el primer contacto» (lib/primer-contacto.ts) separa lo que escribe una persona de lo automático con la marca
// `wa_mensajes.automatico` (mig 0396), que pone `marcarSiEsAutomatico` (lib/evolution-envio.ts). Sin `quien`, el envío es
// AUTOMÁTICO (todos los que no lo dicen lo son); las dos puertas de una persona —Chats y el borrador aprobado— dicen
// `quien: 'persona'`. Un emisor NUEVO no puede caer en el default sin que alguien lo decida: este test barre el repo y falla con un
// archivo que no está en una de las dos listas. (Los cinco tests que leen esas llamadas tal cual —whatsapp-sin-vista-previa,
// chatbot-probar, recordatorio-lead, paso-ia, recordatorio-vista-previa— son la razón de que el default sea el automático y no un
// parámetro obligatorio.)
// Probado rompiéndolo (5/11/2026, base 2/0):
//   · sacar `quien: 'persona'` del envío de Chats                       → 1/1 (el 1);
//   · sacar un archivo de la lista de automáticos (un emisor sin decidir) → 1/1 (el 2).
// =============================================================================

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const LLAMADA = /\benviar(?:Media|Audio)?YEspejar\(\{/g;

/** Las puertas de una PERSONA: cada llamada dice `quien: 'persona'`. */
const PERSONA: Record<string, string> = {
  'app/api/whatsapp/evolution/mensajes/route.ts': 'lo que alguien escribe en Chats',
  'lib/evolution-envio.ts': 'el borrador que una persona aprueba con un clic (`enviarBorrador`)',
};
/** Los AUTOMÁTICOS: ninguna llamada dice `persona` (el default los marca). */
const AUTOMATICOS: Record<string, string> = {
  'lib/nutricion.ts': 'el motor de las automatizaciones',
  'lib/reunion-recordatorio.ts': 'los recordatorios de la reunión',
  'lib/prueba-paso.ts': 'la prueba de un paso (al teléfono de quien prueba)',
  'lib/setting-secuencias.ts': 'la prueba de una secuencia (al teléfono de quien prueba)',
  'lib/curso-invitar.ts': 'la invitación al curso',
  'lib/curso-mensajes.ts': 'los avisos del curso',
  // Entró con la tarjeta Pagos, por otra rama, y este test recién la vio al estar las dos en main: nadie lo decidió antes.
  'lib/recibos-negocio.ts': 'el recibo que emite la tarjeta «Emitir recibo»: sale a un lead que ya pagó, no es un primer contacto',
};

const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const leer = (ruta: string) => sinComentarios(readFileSync(join(RAIZ, ruta), 'utf8').replace(/\r\n/g, '\n'));

/** Los archivos que llaman a las tres funciones (en git: lo que se publica). */
function emisores(): string[] {
  const archivos = execFileSync('git', ['ls-files', 'lib', 'app'], { cwd: RAIZ, encoding: 'utf8' }).split('\n')
    .filter((f) => /\.(ts|tsx)$/.test(f));
  assert.ok(archivos.length > 500, `git ls-files trajo sólo ${archivos.length} archivos: no miró el repo`);
  return archivos.filter((f) => { LLAMADA.lastIndex = 0; return LLAMADA.test(leer(f)); });
}

test('1 · las puertas de una persona dicen «persona» en cada llamada; los automáticos, nunca', () => {
  for (const f of Object.keys(PERSONA)) {
    const src = leer(f);
    const llamadas = src.match(LLAMADA)?.length ?? 0;
    assert.ok(llamadas > 0, `${f}: ya no manda nada (sacalo de la lista)`);
    assert.equal(src.match(/quien: 'persona'/g)?.length ?? 0, llamadas, `${f}: una llamada sin quien: 'persona' contaría como automática (${PERSONA[f]})`);
  }
  for (const f of Object.keys(AUTOMATICOS)) assert.doesNotMatch(leer(f), /quien: 'persona'/, `${f}: ${AUTOMATICOS[f]} no es una persona`);
});

test('2 · todo archivo que manda está en una de las dos listas (un emisor nuevo se decide acá)', () => {
  const vistos = emisores();
  const decididos = new Set([...Object.keys(PERSONA), ...Object.keys(AUTOMATICOS)]);
  const sinDecidir = vistos.filter((f) => !decididos.has(f));
  assert.deepEqual(sinDecidir, [], `manda un WhatsApp y nadie decidió si es una persona o una automatización: ${sinDecidir.join(', ')}`);
  const viejos = [...decididos].filter((f) => !vistos.includes(f));
  assert.deepEqual(viejos, [], `ya no manda nada: sacalo de la lista (${viejos.join(', ')})`);
});
