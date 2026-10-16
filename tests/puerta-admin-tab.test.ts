// =============================================================================
// La puerta de las rutas /api de Experiments y Second Brain (lib/puerta-admin-tab.ts)
// =============================================================================
// Las pantallas de esas dos tabs son sólo del admin (`requireRolWs([], { nav })` en escritorio,
// `requireMovil({ navKey })` en el teléfono), pero el proxy sólo pide SESIÓN fuera de /admin y /metodo: un
// closer o un setter con su cookie, desde la consola de la misma pestaña, aceptaba ítems de la Retro (crea
// experimentos y tareas), corría una Retro (hasta 9 llamadas a Opus), borraba retros, cerraba experimentos y le
// sacaba a la búsqueda del Second Brain los precios y las objeciones del negocio. Revisión de MaKo Mobile,
// tanda 2 (16/10/2026); el hueco de escritorio estaba anotado en docs/hallazgos-plan.md desde el 16/09.
//
// Las rutas importan `server-only` (vía lib/workspace): no se ejecutan desde un test. Se mira el FUENTE sin
// comentarios, como tests/seguridad-cortes-de-rol.test.ts: que TODO handler de esas carpetas arranque con la
// puerta (una ruta nueva nace cerrada), que la puerta deje pasar sólo a 'admin', y que la tab que pide cada
// ruta sea la misma que pide su página.
//
// PROBADO ROMPIÉNDOLO (16/10/2026, base 3 / 0), una rotura por vez, restaurada desde lo leído:
//   R1  /api/retro POST sin las dos líneas de la puerta                                   → 2 / 1
//   R2  /api/experimentos/ideas POST con la puerta DESPUÉS de leer el body                → 2 / 1
//   R3  /api/second-brain/buscar con soloAdminDeTab('experimentos')                        → 2 / 1
//   R4  la puerta en negativo: `rol === 'closer' || rol === 'setter'` en vez de `!== 'admin'` → 2 / 1
//   R5  la puerta sin el corte de la capa                                                  → 2 / 1
//   R6  app/experimentos/page.tsx pidiendo nav 'retro' (la ruta pediría otra tab)          → 2 / 1
// Restaurado → 3 / 0.
//
// Correr: node --import tsx --test tests/puerta-admin-tab.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (rel: string) => readFileSync(join(RAIZ, rel), 'utf8').replace(/\r\n/g, '\n');
/** Sin comentarios: los de bloque, las líneas enteras de `//` y la cola `// …` detrás de código. */
const fuente = (rel: string) => leer(rel)
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/([;,{}()\]])[ \t]+\/\/.*$/gm, '$1');

/** El cuerpo de una función de nivel 0, sin la firma: de la línea que sigue a `) {` a la `}` de la columna 0. */
function cuerpo(src: string, firma: string, que: string): string {
  const i = src.indexOf(firma);
  assert.ok(i >= 0, `no encontré ${que} (${firma}): el test dejó de mirar el archivo`);
  const abre = src.indexOf('{\n', i);
  const cierra = src.indexOf('\n}\n', abre);
  assert.ok(abre > 0 && cierra > abre, `no pude recortar ${que}`);
  return src.slice(abre + 2, cierra + 1);
}
const primeras = (c: string, n: number) => c.split('\n').map((l) => l.trim()).filter(Boolean).slice(0, n);
const HANDLERS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const handlersDe = (src: string) => HANDLERS.filter((m) => src.includes(`export async function ${m}(`));
const rutasDe = (base: string) => (readdirSync(join(RAIZ, base), { recursive: true }) as string[])
  .map((p) => p.replace(/\\/g, '/')).filter((p) => p.endsWith('route.ts')).map((p) => `${base}/${p}`);

/** La tab que pide cada carpeta de rutas, y la página que la pide igual. */
const AREAS = [
  { rutas: [...rutasDe('app/api/experimentos'), ...rutasDe('app/api/retro')], nav: 'experimentos', pagina: 'app/experimentos/page.tsx', minimo: 6,
    puerta: "requireRolWs([], { nav: 'experimentos' })" },
  // La página del Second Brain es el CHAT con MaKo desde el 16/10/2026 (entra con la puerta de MaKo, closer y setter
  // incluidos): lo que es del admin de la tab es el MAPA, y lo corta con la misma regla que estas rutas.
  { rutas: rutasDe('app/api/second-brain'), nav: 'second-brain', pagina: 'app/second-brain/page.tsx', minimo: 2,
    puerta: "esAdminDeTab('second-brain')" },
] as const;

test('Experiments y Second Brain: TODO handler de TODA ruta arranca con la puerta de su tab (una ruta nueva nace cerrada)', () => {
  for (const { rutas, nav, minimo } of AREAS) {
    let n = 0;
    for (const r of rutas) {
      const src = fuente(r);
      const hs = handlersDe(src);
      assert.ok(hs.length > 0, `${r} no tiene handlers: el test dejó de mirarlo`);
      for (const m of hs) {
        const dos = primeras(cuerpo(src, `export async function ${m}(`, `${r} ${m}`), 2);
        // exportar ya cerraba con el guard de la página (redirige): vale igual, es el mismo corte.
        if (dos[0] === `await requireRolWs([], { nav: '${nav}' });`) { n++; continue; }
        assert.deepEqual(dos, [`const cerrada = await soloAdminDeTab('${nav}');`, 'if (cerrada) return cerrada;'],
          `${r} ${m}: no arranca con soloAdminDeTab('${nav}'): un closer o un setter la usa desde la consola`);
        assert.match(src, /import \{ soloAdminDeTab \} from '@\/lib\/puerta-admin-tab';/, `${r} no importa la puerta`);
        n++;
      }
    }
    assert.ok(n >= minimo, `esperaba al menos ${minimo} handlers de '${nav}' y encontré ${n}`);
  }
});

test('lib/puerta-admin-tab.ts: entra el admin y NADIE más (en positivo), y sólo si su capa tiene la tab', () => {
  const c = cuerpo(fuente('lib/puerta-admin-tab.ts'), 'export async function soloAdminDeTab(', 'la puerta');
  assert.deepEqual(primeras(c, 5), [
    'const rol = await getRolWsEfectivo();',
    "if (rol == null) return cerrada(401, 'Sin sesión: vuelve a entrar');",
    "if (rol !== 'admin') return cerrada(403, 'Sólo el admin del negocio');",
    "if (!tabEnCapa(nav, await getCapaActual())) return cerrada(404, 'No existe');",
    'return null;',
  ]);
});

test('la tab que pide cada ruta es la misma que pide su página (escritorio y teléfono)', () => {
  for (const { nav, pagina, puerta } of AREAS) {
    assert.ok(fuente(pagina).includes(puerta), `${pagina} ya no pide la tab '${nav}': la ruta y la página dejaron de cerrar lo mismo`);
    const movil = pagina.replace(/^app\//, 'app/m/');
    assert.ok(fuente(movil).includes(`requireMovil({ navKey: '${nav}' })`), `${movil} ya no pide la tab '${nav}'`);
  }
});
