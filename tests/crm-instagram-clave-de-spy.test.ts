// =============================================================================
// El buscador del @ del CRM prueba LAS DOS claves de Apify, no una (2/11/2026)
// =============================================================================
// Martín, 2/11/2026: «ya con Apify debería funcionar el traer el perfil escribiendo el @, eso también en el CRM».
//
// NO FALTABA CÓDIGO: faltaba pedir la clave que existe, y es la clase de falla que no se ve mirando la pantalla.
// `app/api/crm/instagram-buscar/route.ts` ya tenía el respaldo por @ exacto desde el 22/10 —si Meta y Google no
// traen nada, lee el perfil con `leerPerfilInstagram`—, pero lo pedía con `fuentes: ['meta-plataforma', 'apify']`.
// Y hay DOS claves de Apify, en dos credenciales distintas:
//   · `apify`     → `APIFY_TOKEN`, de la plataforma (estricta) o del negocio. Medido el 22/10: no estaba en NINGUNO.
//   · `apify-spy` → `APIFY_CLAVE_DE_SPY`, del negocio. Es la que Martín pegó el 1/11 y la que hoy funciona.
// O sea que el respaldo pedía una llave que nadie tenía teniendo la otra al lado, y fallaba en silencio: sin clave
// la fuente se SALTA (`continue`), no tira error. La lista quedaba vacía y la pantalla decía «escribí el @ a mano».
//
// ⚠️ EL ORDEN IMPORTA Y ES PLATA: `apify` va ANTES que `apify-spy` porque la primera la paga la plataforma y la
// segunda el negocio. Invertirlo le cobra al cliente algo que la plataforma estaba por cubrir.
//
// ⚠️ ESTE TEST LEE EL CÓDIGO SIN COMENTARIOS a propósito. Un guard que empareja un identificador y no su USO pasa
// en verde sobre código roto: ya pasó dos veces esta semana (docs/hallazgos-competitors-spy.md). Acá se busca la
// lista `fuentes` DE LA LLAMADA, y en el lector se busca que `APIFY_CLAVE_DE_SPY` siga colgando de la fuente
// `apify-spy` — si alguien renombra la fuente, esto se cae en vez de quedar mudo.
//
// PROBADO ROMPIÉNDOLO (2/11/2026), con el archivo en 4 / 0, una rotura por vez y restaurada:
//   · la ruta de vuelta a `fuentes: ['meta-plataforma', 'apify']`                → 2 / 2
//   · `fuentes: ['meta-plataforma', 'apify-spy', 'apify']` (le cobra al cliente)  → 3 / 1
//   · la ruta sin `apify` (deja de aprovechar la clave de la plataforma)          → 3 / 1
//   · el lector sin la guarda `fuentes.includes('apify-spy')`                     → 3 / 1
// Correr: node --import tsx --test tests/crm-instagram-clave-de-spy.test.ts
// =============================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const RAIZ = join(__dirname, '..');
const leer = (r: string) => readFileSync(join(RAIZ, r), 'utf8').replace(/\r\n/g, '\n');
const sinComentarios = (src: string) => src
  .replace(/^[ \t]*\/\/.*$/gm, '')
  .replace(/\/\*[\s\S]*?\*\//g, '');

const RUTA = 'app/api/crm/instagram-buscar/route.ts';
const LECTOR = 'lib/instagram-perfil-server.ts';

/** Las fuentes de LA llamada a `leerPerfilInstagram` de la ruta, en su orden. Null si no hay llamada. */
function fuentesDelRespaldo(): string[] | null {
  const src = sinComentarios(leer(RUTA));
  const llamada = /leerPerfilInstagram\s*\([\s\S]{0,400}?\)/.exec(src);
  if (!llamada) return null;
  const lista = /fuentes\s*:\s*\[([^\]]*)\]/.exec(llamada[0]);
  if (!lista) return null;
  return [...lista[1].matchAll(/'([^']+)'|"([^"]+)"/g)].map((m) => m[1] ?? m[2]);
}

test('el respaldo por @ exacto del CRM prueba la clave de Spy', () => {
  const fuentes = fuentesDelRespaldo();
  assert.ok(fuentes, `no encontré la llamada a leerPerfilInstagram con sus fuentes en ${RUTA}`);
  assert.ok(
    fuentes.includes('apify-spy'),
    `el buscador del @ del CRM pide ${JSON.stringify(fuentes)} y no incluye 'apify-spy': es la ÚNICA fuente que `
    + 'prueba APIFY_CLAVE_DE_SPY, la clave que hoy existe. Sin ella el respaldo se salta en silencio.',
  );
});

test('y sigue probando primero la clave de la plataforma', () => {
  const fuentes = fuentesDelRespaldo() ?? [];
  assert.ok(fuentes.includes('apify'), `${JSON.stringify(fuentes)} no incluye 'apify': es la clave que paga la plataforma, y sacarla le cobra al negocio lo que estaba cubierto`);
  assert.ok(
    fuentes.indexOf('apify') < fuentes.indexOf('apify-spy'),
    `el orden es plata: 'apify' (la paga la plataforma) va ANTES que 'apify-spy' (la paga el negocio), y acá está ${JSON.stringify(fuentes)}`,
  );
});

test('Meta de la plataforma se sigue intentando antes que cualquier Apify', () => {
  const fuentes = fuentesDelRespaldo() ?? [];
  const primerApify = fuentes.findIndex((f) => f.startsWith('apify'));
  assert.ok(
    fuentes.indexOf('meta-plataforma') >= 0 && fuentes.indexOf('meta-plataforma') < primerApify,
    `una lectura de Meta no cuesta un crédito de Apify: 'meta-plataforma' va primero, y acá está ${JSON.stringify(fuentes)}`,
  );
});

test('la clave de Spy sigue colgando de la fuente apify-spy en el lector', () => {
  const src = sinComentarios(leer(LECTOR));
  assert.match(
    // 5/11/2026: las claves de Spy las lee `clavesApifyDeSpy` (varias claves), que arranca por APIFY_CLAVE_DE_SPY.
    src, /fuentes\.includes\(\s*'apify-spy'\s*\)[\s\S]{0,200}?clavesApifyDeSpy\(/,
    `en ${LECTOR}, APIFY_CLAVE_DE_SPY tiene que leerse sólo cuando las fuentes incluyen 'apify-spy'. Si eso cambió de `
    + 'nombre o de forma, la lista de la ruta dejó de significar lo que este test cuida y hay que actualizar los dos.',
  );
});
