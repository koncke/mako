// =============================================================================
// El copy que ve un CLIENTE va en español neutro de México
// =============================================================================
// La regla es del dueño y está en AGENTS.md: «Que NO tenga lenguaje argento, nada
// de lo que hagas debe tenerlo». Existía sin ninguna guarda que la mirara — el
// único test de copy (`puente-panel-copy.test.ts`) cubre UNA pantalla.
//
// Y una regla sin control determinista se cumple casi siempre, que es otra cosa:
// el 01/09/2026 una auditoría encontró **«Pedíselo»** en `app/_ui/Estados.tsx`, o
// sea en `PermissionState`, la primitive que ve TODO cliente que choca con un
// permiso. Sobrevivió porque nadie la miraba.
//
// ── Qué NO audita, y por qué ───────────────────────────────────────────────
// · `app/admin/`, `app/vsl/` y las bitácoras: son de Martín y para Martín. Ahí el
//   rioplatense ES la voz correcta. Medido: 112 de las 114 apariciones de toda la
//   app viven ahí, y ninguna es un error.
// · Los comentarios del código. Se audita lo que se PINTA.
// · La voz de MaKo cuando le habla al dueño (avisos, WhatsApp interno).
//
// ── Y por qué la lista es corta ────────────────────────────────────────────
// ⚠️ SOLO FORMAS ACENTUADAS. `sabes`, `haces`, `mira`, `deja`, `manda` y `toca`
// SIN tilde son español correcto —«tú sabes», «MaKo deja de usarlo»— y meterlas
// daba 1.103 falsos positivos. Un detector que grita por todo se apaga, y apagado
// no detecta nada. Con la lista acentuada quedan 2 en 225 archivos, y una de esas
// dos era real.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Lo que un cliente puede llegar a leer. */
const SUPERFICIE = [
  'app/_ui', 'app/_components', 'app/crm', 'app/video-generator', 'app/marketing',
  'app/whatsapp', 'app/email', 'app/onboarding', 'app/integraciones', 'app/perfil',
  'app/chatbot', 'app/todo', 'app/conocimiento', 'app/funnel', 'app/equipo',
];

/**
 * ⚠️ LOS LÍMITES VAN POR UNICODE, NO POR `\b`.
 *
 * El `\b` de JavaScript es ASCII incluso con el flag `u`: en `mirá` no hay borde
 * entre la `á` y el espacio, así que `\b(mirá)\b` da **cero coincidencias, sin
 * error**. Y lo que se escapa son justo los imperativos, que son la forma de todo
 * CTA. Ya está documentado en AGENTS.md y por eso este test tiene el caso.
 */
const limite = (s: string) => new RegExp(`(?<!\\p{L})(${s})(?!\\p{L})`, 'iu');

const VOSEO = [
  // Presente
  'podés', 'tenés', 'querés', 'sabés', 'decís', 'hacés', 'venís', 'vivís', 'sentís',
  // Imperativos: la forma de todo CTA, y la que más se cuela
  'andá', 'mirá', 'tocá', 'dejá', 'mandá', 'escribí', 'elegí', 'poné', 'sacá',
  'cargá', 'probá', 'revisá', 'seguí', 'apretá', 'agregá', 'buscá', 'abrí',
  'cerrá', 'completá', 'contá', 'esperá', 'fijate', 'acordate', 'quedate', 'llevate',
  // Con pronombre pegado
  'pedíselo', 'pedíle', 'decíle', 'mandále', 'tenélo', 'dejálo', 'ponéle',
];

/** Saca comentarios: lo que se audita es lo que se pinta, no lo que se explica. */
function sinComentarios(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^\s*\/\/.*$/gm, ' ')
    .replace(/([^:])\/\/.*$/gm, '$1 ');
}

function archivosDe(dir: string): string[] {
  const out: string[] = [];
  let entradas: string[];
  try { entradas = readdirSync(dir); } catch { return out; }
  for (const e of entradas) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...archivosDe(p));
    else if (/\.tsx?$/.test(e)) out.push(p);
  }
  return out;
}

test('el copy del cliente no tiene voseo', () => {
  const malos: string[] = [];
  let revisados = 0;
  for (const d of SUPERFICIE) {
    for (const f of archivosDe(join(RAIZ, d))) {
      revisados++;
      const src = sinComentarios(readFileSync(f, 'utf8'));
      for (const [i, linea] of src.split('\n').entries()) {
        for (const forma of VOSEO) {
          const m = limite(forma).exec(linea);
          if (!m) continue;
          malos.push(`${f.replace(RAIZ, '').replace(/\\/g, '/')}:${i + 1} «${m[1]}» — ${linea.trim().slice(0, 80)}`);
          break;
        }
      }
    }
  }
  // Que el test recorra algo: un cero sobre un universo vacío se lee igual que un
  // cero sobre uno lleno, y es la forma más silenciosa de que una guarda se muera.
  assert.ok(revisados > 150, `solo se revisaron ${revisados} archivos: ¿se movió alguna carpeta de SUPERFICIE?`);
  assert.deepEqual(malos, [], `voseo en copy que ve el cliente:\n  ${malos.join('\n  ')}`);
});

test('⚠️ el detector encuentra un imperativo ACENTUADO', () => {
  // El caso que `\b` deja pasar. Sin esta aserción, el test podría estar roto y
  // dar verde sobre toda la app — que es exactamente lo que pasó con el detector
  // de voseo de `puestas-data.ts` antes de que se arreglara.
  assert.ok(limite('mirá').test('Ahora mirá el resultado'));
  assert.ok(limite('pedíselo').test('Pedíselo a quien administra la cuenta.'));
});

test('y NO marca el español correcto de México', () => {
  // `sabes`, `haces` y `deja` sin tilde son válidos: «tú sabes», «MaKo deja de
  // usarlo». Meterlos daba 1.103 falsos positivos y habría vuelto inservible al
  // test. Esta aserción es la que impide que alguien los agregue «por las dudas».
  for (const ok of [
    'Con estas preguntas sabes si el lead te sirve',
    'MaKo deja de usarlo como referencia',
    'Mira el resultado antes de publicar',
    'Toca el botón para continuar',
  ]) {
    for (const forma of VOSEO) {
      assert.ok(!limite(forma).test(ok), `falso positivo: «${forma}» en "${ok}"`);
    }
  }
});
