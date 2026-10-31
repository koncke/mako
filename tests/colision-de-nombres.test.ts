// =============================================================================
// Dos módulos de la MISMA carpeta no pueden llamarse igual en minúsculas
// =============================================================================
// Medido el 30/10/2026 rescatando `nube/video-generator-2710` (el arreglo quedó en 9b5b2346e).
// `app/video-generator/estudio/` traía los dos: `composer.ts` (el módulo puro con las reglas del
// botón «Generar anuncio») y `Composer.tsx` (la pantalla). El `import { Composer } from
// './Composer'` de `EstudioVideo.tsx` resuelve probando extensiones EN ORDEN —`./Composer.ts`
// antes que `./Composer.tsx`— y en NTFS, que no distingue mayúsculas, `./Composer.ts` **es**
// `composer.ts`: el import traía el módulo puro.
//
//   EstudioVideo.tsx(38,10): TS2305: Module '"./Composer"' has no exported member 'Composer'.
//   EstudioVideo.tsx(38,26): TS1149: File name '…/Composer.ts' differs from already included
//                                   file name '…/composer.ts' only in casing.
//
// y detrás el TS7006 en cascada: el componente queda `any` y se lleva sus props.
//
// ⚠️ EN LINUX NO PASA, Y POR ESO NO LO FRENABA NADA. En Actions y en el build de Vercel
// `./Composer.ts` no existe, el resolvedor pasa de largo y encuentra `Composer.tsx`: VERDE. Y con
// `typescript.ignoreBuildErrors: true` (next.config.ts) el build tampoco frena. O sea un repo
// ROTO para todo el que trabaja en Windows que pasa el CI entero sin una queja — el modo de falla
// más caro de esta casa, porque el verde apaga la búsqueda.
//
// ⚠️ Y UN CHEQUEO INGENUO DE NOMBRES COMPLETOS NO LO CAZA. Los dos archivos COEXISTEN en NTFS
// porque sus nombres completos difieren (`composer.ts` ≠ `composer.tsx` también en minúsculas):
// no hay colisión de filesystem, `git checkout` no se queja y un `ls` los muestra a los dos. Lo
// que colisiona es el BASENAME SIN EXTENSIÓN, que es con lo que TypeScript sale a probar. Por eso
// este barrido compara `composer` contra `Composer` y NO `composer.ts` contra `Composer.tsx`.
//
// La regla: en una carpeta, dos archivos que TypeScript pueda resolver sin extensión no pueden
// tener el mismo basename en minúsculas. El arreglo es RENOMBRAR el que no es el componente (acá
// el módulo puro pasó a `composer-reglas.ts`), nunca bajarle la mayúscula a la pantalla.
//
// ⚠️ LA LISTA DE EXTENSIONES ES LA PIEZA QUE SOSTIENE AL GUARD, no un detalle: son las que
// TypeScript prueba sin que el import las nombre, con `allowJs` y `moduleResolution: bundler`
// (tsconfig.json). Entran también `.mjs` y `.cjs` —un import `.mts` o `.cts` resuelve a ellos, y
// `scripts/` está lleno—, y medido el 30/10/2026 no agregan ni un hallazgo. Lo que NO entra es
// todo lo demás, y se mide igual: con `.css` adentro aparecen CINCO falsos positivos, que son la
// convención de la casa (`app/_ui/Ajustes.tsx` + `ajustes.css`, y cuatro más) — una hoja de
// estilos no la resuelve un import sin extensión, así que no divergen entre filesystems.
//
// Lo medido ese día, con este mismo detector:
//   · origin/main (19.821 archivos)          → 0
//   · origin/integracion (19.875 archivos)   → 0
//   · 9012f6070, el árbol ANTES del arreglo  → 1, el `Composer` / `composer` de arriba
//   · 9b5b2346e, el árbol CON el arreglo     → 0
//
// Verificado rompiéndolo (30/10/2026) — base 4 pases / 0 fallos:
//   · `composer-reglas.ts` vuelve a llamarse `composer.ts`   -> 3 / 1  ← EL BUG REAL, lo caza el barrido
//   · el detector compara el nombre COMPLETO en minúsculas   -> 2 / 2  (el chequeo ingenuo: el árbol
//                                                                      viejo le pasa limpio)
//   · el detector no baja las mayúsculas                     -> 2 / 2  (ídem)
//   · `.css` entra a la lista de extensiones                 -> 1 / 3  (se acusa el repo entero)

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// fileURLToPath y no `.pathname`: en Linux (Actions) ese recorte deja una ruta RELATIVA y git
// sale con ENOENT. Ya costó el primer run de Actions, el 15/10/2026.
const RAIZ = fileURLToPath(new URL('..', import.meta.url));

/**
 * Lo que TypeScript prueba cuando el import NO nombra la extensión. El orden importa para
 * entender el bug (`.ts` antes que `.tsx`), pero para detectarlo da igual: lo que decide es que
 * los dos nombres caigan en el mismo casillero en minúsculas.
 */
const RESOLUBLES = ['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs'];

/** `git ls-files` lista el ÍNDICE: un archivo nuevo sin stagear es invisible acá (AGENTS.md). */
function archivosVersionados(ref?: string): string[] {
  const args = ref ? ['ls-tree', '-r', '--name-only', ref] : ['ls-files'];
  // maxBuffer explícito: son ~20.000 rutas, cerca del megabyte que child_process trae por default.
  const salida = execFileSync('git', args, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return salida.split(/\r?\n/).map((f) => f.trim()).filter(Boolean);
}

type Pieza = { dir: string; sinExt: string; archivo: string };

/** Parte una ruta en carpeta + basename sin extensión, o null si TypeScript no la resuelve. */
function pieza(ruta: string): Pieza | null {
  const corte = ruta.lastIndexOf('/');
  const dir = corte === -1 ? '' : ruta.slice(0, corte);
  const base = corte === -1 ? ruta : ruta.slice(corte + 1);
  const punto = base.lastIndexOf('.');
  if (punto <= 0) return null; // sin extensión, o un dotfile: TypeScript no lo resuelve así
  if (!RESOLUBLES.includes(base.slice(punto).toLowerCase())) return null;
  return { dir, sinExt: base.slice(0, punto), archivo: base };
}

/**
 * Las carpetas donde dos archivos distintos comparten basename en minúsculas.
 *
 * ⚠️ Se exige que los nombres DIFIERAN: `foo.ts` + `foo.js` caen en el mismo casillero y no son
 * este bug — ahí el resolvedor elige el `.ts` igual en Windows que en Linux, así que no hay
 * VERDE-acá-ROJO-allá. Lo que este guard persigue es la DIVERGENCIA entre filesystems, que la
 * produce la mayúscula y nada más.
 */
function colisiones(archivos: string[]): string[] {
  const porCasillero = new Map<string, Pieza[]>();
  for (const ruta of archivos) {
    const p = pieza(ruta);
    if (!p) continue;
    const clave = `${p.dir}\u0000${p.sinExt.toLowerCase()}`;
    if (!porCasillero.has(clave)) porCasillero.set(clave, []);
    porCasillero.get(clave)!.push(p);
  }
  const malas: string[] = [];
  for (const [clave, grupo] of porCasillero) {
    if (new Set(grupo.map((g) => g.sinExt)).size < 2) continue;
    const [dir, enMinusculas] = clave.split('\u0000');
    const nombres = grupo.map((g) => g.archivo).sort();
    malas.push(`${dir || '.'}/ «${enMinusculas}» ← ${nombres.join(' + ')}`);
  }
  return malas.sort();
}

/**
 * El caso hermano, por el mismo mecanismo: una CARPETA con `index` y un archivo vecino que se
 * llaman igual en minúsculas. `./Foo` resuelve `./Foo.ts` antes que `./Foo/index.ts`, y en NTFS
 * `./Foo.ts` es el `foo.ts` de al lado. Medido el 30/10/2026: 0 en origin/main y 0 en el árbol
 * anterior al arreglo, así que entra sin falsos positivos.
 */
function colisionesConCarpeta(archivos: string[]): string[] {
  const conIndex = new Set<string>();
  const porCarpeta = new Map<string, Pieza[]>();
  for (const ruta of archivos) {
    const p = pieza(ruta);
    if (!p) continue;
    if (p.sinExt.toLowerCase() === 'index' && p.dir) conIndex.add(p.dir);
    if (!porCarpeta.has(p.dir)) porCarpeta.set(p.dir, []);
    porCarpeta.get(p.dir)!.push(p);
  }
  const malas: string[] = [];
  for (const dir of conIndex) {
    const corte = dir.lastIndexOf('/');
    if (corte === -1) continue;
    const padre = dir.slice(0, corte);
    const nombre = dir.slice(corte + 1);
    for (const vecino of porCarpeta.get(padre) ?? []) {
      if (vecino.sinExt === nombre) continue; // el import nombra lo mismo escrito igual: no divergen
      if (vecino.sinExt.toLowerCase() !== nombre.toLowerCase()) continue;
      malas.push(`${padre}/ «${nombre.toLowerCase()}» ← la carpeta «${nombre}/» y el archivo «${vecino.archivo}»`);
    }
  }
  return malas.sort();
}

test('⚠️ ninguna carpeta del repo tiene dos módulos que sólo se diferencien en MAYÚSCULAS', () => {
  const archivos = archivosVersionados();
  // «No encontré nada que revisar» y «revisé y está todo bien» son respuestas DISTINTAS.
  assert.ok(archivos.length > 5000, `git ls-files devolvió ${archivos.length} archivos: esto no corrió en el repo`);

  assert.deepEqual(
    colisiones(archivos),
    [],
    'en NTFS el import se trae el archivo EQUIVOCADO (TS1149 + TS2305 + un componente `any`), y en Linux\n'
      + '—Actions y el build de Vercel— el mismo árbol da VERDE, así que no lo frena nada más.\n'
      + 'Se renombra el que no es el componente (molde: app/video-generator/estudio/composer-reglas.ts).\n',
  );
});

test('y ninguna carpeta con `index` choca con un archivo vecino', () => {
  const archivos = archivosVersionados();
  assert.ok(archivos.length > 5000, `git ls-files devolvió ${archivos.length} archivos: esto no corrió en el repo`);

  assert.deepEqual(
    colisionesConCarpeta(archivos),
    [],
    '`./Foo` prueba `./Foo.ts` antes que `./Foo/index.ts`, y en NTFS ese `./Foo.ts` es el archivo de al lado.\n',
  );
});

test('el detector CAZA el árbol anterior al arreglo (9012f6070)', (t) => {
  // El commit es alcanzable desde origin/integracion y desde las dos ramas del rescate, así que
  // en Actions (actions/checkout con fetch-depth: 0) está. En un clon superficial no, y ahí esto
  // se saltea DICIÉNDOLO: un test que se saltea mudo da verde sin haber mirado nada.
  const SHA = '9012f6070';
  try {
    execFileSync('git', ['cat-file', '-e', `${SHA}^{commit}`], { cwd: RAIZ, stdio: 'ignore' });
  } catch {
    const motivo = `${SHA} no está en este clon (¿superficial?): no se pudo medir el detector contra el árbol del bug`;
    console.error(`⚠️  ${motivo}`);
    t.skip(motivo);
    return;
  }

  const viejo = archivosVersionados(SHA);
  assert.ok(viejo.length > 5000, `el árbol de ${SHA} vino con ${viejo.length} archivos: no se leyó nada`);

  const choques = colisiones(viejo);
  assert.equal(choques.length, 1, `el detector tendría que encontrar exactamente el bug medido, y encontró:\n${choques.join('\n')}`);
  assert.match(choques[0], /^app\/video-generator\/estudio\/ «composer» ← Composer\.tsx \+ composer\.ts$/);

  // Y el árbol CON el arreglo está limpio: si no, el guard estaría persiguiendo otra cosa.
  assert.deepEqual(colisiones(archivosVersionados('9b5b2346e')), []);
});

test('el detector deja pasar lo que NO es este bug', () => {
  // ⚠️ Un detector se prueba con lo que tiene que DEJAR PASAR, no sólo con lo que tiene que cazar:
  // uno que marca todo también da «0 fallos» cuando el repo está bien, y es indistinguible de uno
  // que anda.
  assert.deepEqual(
    colisiones(['app/x/Composer.tsx', 'app/x/composer.ts']),
    ['app/x/ «composer» ← Composer.tsx + composer.ts'],
    'el caso medido tiene que salir aunque las extensiones difieran',
  );
  assert.deepEqual(colisiones(['app/x/Foo.ts', 'app/y/foo.ts']), [], 'en carpetas distintas no hay nada que resolver mal');
  assert.deepEqual(colisiones(['app/x/Foo.ts', 'app/x/foo.css']), [], 'un `.css` no lo resuelve TypeScript sin extensión');
  assert.deepEqual(colisiones(['app/x/Foo.ts', 'app/x/foo.md']), [], 'ni un `.md`');
  assert.deepEqual(colisiones(['app/x/foo.ts', 'app/x/foo.js']), [], 'mismo nombre y otra extensión resuelve IGUAL en los dos filesystems');
  assert.deepEqual(colisiones(['app/x/Foo.ts', 'app/x/foo.ts']), ['app/x/ «foo» ← Foo.ts + foo.ts'], 'y el nombre completo que sólo cambia de caja, también');
  assert.deepEqual(colisiones(['app/x/tipos.d.ts', 'app/x/Tipos.ts']), [], 'un `.d.ts` declara un `.js`: su basename es `tipos.d`, no `tipos`');
  assert.deepEqual(colisiones(['.eslintrc.js', 'app/x/a.ts']), [], 'un dotfile de la raíz no es un módulo que alguien importe sin extensión');

  assert.deepEqual(
    colisionesConCarpeta(['app/x/Foo/index.ts', 'app/x/foo.ts']),
    ['app/x/ «foo» ← la carpeta «Foo/» y el archivo «foo.ts»'],
    'la carpeta con index contra el archivo vecino',
  );
  assert.deepEqual(colisionesConCarpeta(['app/x/foo/index.ts', 'app/x/foo.ts']), [], 'escrito igual, los dos filesystems eligen el archivo: no divergen');
  assert.deepEqual(colisionesConCarpeta(['app/x/Foo/piezas.ts', 'app/x/foo.ts']), [], 'sin `index`, `./Foo` no podía resolver a la carpeta');
});
