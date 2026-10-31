// =============================================================================
// El video de MaKo en el Ads Manager: lo que NO puede pasar por el camino (tarea #797)
// =============================================================================
// Guards sobre el FUENTE. Desde el 27/10/2026 las rutas `creative-upload` y `mis-creativos` del Ads Manager
// viejo están BORRADAS (el Media Buyer sube por `lib/media-buyer/subir.ts`): lo que queda de esta tarea es la
// lectura de los videos de MaKo, que sigue viva y la usa el Media Buyer:
//   · «no pude leer» no se contesta como lista vacía, ni con un catch que devuelva [];
//   · ninguna lectura trae el pedido entero ni el resultado entero (las urls de las tomas y el guion);
//   · y un 'use client' sólo importa TIPOS de lib/creativo-mako.
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const leer = (p: string) => readFileSync(join(process.cwd(), p), 'utf8').replace(/\r\n/g, '\n');
// Las líneas de comentario PRIMERO y los bloques después (AGENTS.md).
const sinComentarios = (src: string) => src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const codigo = (p: string) => sinComentarios(leer(p));

test('«no pude leer» no es «no tienes videos»', () => {
  const fuentes = codigo('lib/creativo-mako-fuentes.ts');
  // Las dos lecturas de montaje_trabajos leen el error, y el historial va en estricto.
  assert.equal((fuentes.match(/if \(error\) throw new Error\(/g) ?? []).length, 2, 'las dos lecturas de montaje_trabajos tiran con su error');
  assert.equal((fuentes.match(/\.from\('montaje_trabajos'\)/g) ?? []).length, 2);
  assert.match(fuentes, /leerHistorialEstricto\(\)/);
  assert.doesNotMatch(fuentes, /\bleerHistorial\(\)/, 'leerHistorial traga el error y devuelve []');
  // Y nada acá lo vuelve a tragar: este módulo no tiene ningún catch legítimo. Un
  // `try { … } catch { return []; }` alrededor de la lectura estricta deja el literal de
  // arriba en pie y pinta «Todavía no hay videos» sobre un workspace que los tiene.
  assert.doesNotMatch(fuentes, /\bcatch\b|allSettled|\.then\(/, 'lib/creativo-mako-fuentes.ts no atrapa errores: los que no puede leer, los tira');
  // Y nunca el pedido entero (las urls de las tomas y el guion) ni el resultado entero:
  // las dos lecturas usan las mismas columnas, y ninguna es el jsonb pelado.
  assert.equal((fuentes.match(/\.select\(COLUMNAS_MONTAJE\)/g) ?? []).length, 2);
  const cols = /const COLUMNAS_MONTAJE = '([^']*)';/.exec(fuentes)?.[1] ?? '';
  assert.ok(cols.includes('url:resultado->>url'), 'la url sale del jsonb, sola');
  for (const c of cols.split(',').map((s) => s.trim())) assert.doesNotMatch(c, /^(pedido|resultado)$/, `columna entera: ${c}`);
});

test("'use client' sólo importa TIPOS de lib/creativo-mako", () => {
  const dir = join(process.cwd(), 'app/ads-manager');
  for (const f of readdirSync(dir).filter((x) => /\.tsx?$/.test(x))) {
    const src = leer(`app/ads-manager/${f}`);
    if (!src.includes("'use client'")) continue;
    for (const m of src.matchAll(/^import ([^;]*) from '@\/lib\/creativo-mako';/gm)) {
      assert.match(m[1], /^type \{/, `app/ads-manager/${f}: importa un VALOR de lib/creativo-mako`);
    }
    assert.doesNotMatch(src, /from '@\/lib\/creativo-mako-fuentes'/, `app/ads-manager/${f}: importa el módulo del server`);
  }
});

//   ROTO A PROPÓSITO (07/10/2026; re-contadas el 27/10 con los dos tests que quedan, cada una 1 pass / 1 fail):
//   · tomasDelWorkspace envuelto en `try { … } catch { return []; }` → «no pude leer»;
//   · `.select('*')` en una de las dos lecturas de montaje_trabajos → «no pude leer»;
//   · un `import { resolverCreativoMako } from '@/lib/creativo-mako'` en Hoy.tsx → «'use client' sólo importa TIPOS».
