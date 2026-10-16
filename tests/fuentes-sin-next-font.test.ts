// =============================================================================
// Ninguna fuente entra por `next/font/google`: el build no depende de Google
// =============================================================================
// El 15/10/2026 dos builds de producción seguidos murieron con «next/font/google queries have
// exactly one entry» · «Can't resolve '@vercel/turbopack-next/internal/font/google/font'», sobre
// el MISMO código que había compilado verde una hora antes. Entre el deploy bueno y el roto había
// un solo commit, que no tocaba fuentes ni dependencias: lo que falló fue la descarga de la fuente
// DURANTE el compilado. Producción se quedó en la versión anterior y los deploys de todos los
// chats quedaron bloqueados hasta sacarla.
//
// Eran dos: Noto Sans en el Image Editor e Inter en Chats. La segunda ni siquiera llegó a romper
// —el build cortó en la primera— así que se sacó antes de que nos tirara otro deploy.
//
// ⚠️ Lo más caro de este caso: el comentario de `app/chats/fuente.ts` ANTICIPABA el fallo con
// todas las letras («next build necesita red hacia Google Fonts. Sin red, el build falla al
// bajarla») y aun así quedó, porque durante semanas la red contestó. Un riesgo escrito y no
// cerrado es un riesgo que se cobra el día que menos conviene — por eso esto es un test y no otro
// párrafo.
//
// La convención del repo es la hoja de Google desde el NAVEGADOR (app/layout.tsx,
// app/_cursos/fuentes.ts, app/chats/fuente.tsx, app/image-editor/fuenteUi.tsx), con `precedence`
// para que React 19 la suba al head y la deduplique. Si alguna vez hace falta que la letra salga
// del mismo deploy, el camino es `next/font/local` con el woff2 commiteado: eso no pide nada en el
// build ni en el navegador. Lo que no vuelve es `next/font/google`.
//
// ⚠️ CÓMO SE VERIFICÓ, y la letra chica: el clon donde se escribió estaba NUEVE commits atrás, así
// que al correrlo dio 0 pases y 2 fallos — por el árbol viejo, no por el guard: le faltaba el
// `fuenteUi.tsx` del Image Editor y todavía tenía su `fuenteUi.ts`. Se validó contra el árbol de
// verdad con `git grep -l "from 'next/font/google'" origin/main -- app lib`, que devuelve
// únicamente el `app/chats/fuente.ts` que este commit saca, y comprobando que el `fuenteUi.tsx`
// de origin/main sirve la hoja y declara `precedence`. Queda PENDIENTE correrlo rompiéndolo sobre
// un árbol al día: si lo hacés, anotá acá los números.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const raiz = new URL('..', import.meta.url);
const leer = (r: string) => readFileSync(new URL(r, raiz), 'utf8').replace(/\r\n/g, '\n');

/** Los archivos versionados de app/ y lib/, que es donde puede entrar una fuente. */
function fuentes(): string[] {
  // fileURLToPath y no `.pathname.replace(/^\//, '')`: ese recorte sólo anda en Windows (deja «C:/…»);
  // en Linux convierte «/home/runner/…» en una ruta RELATIVA que no existe y git sale con ENOENT.
  // Lo cazó el primer run de GitHub Actions (15/10/2026): 10.496 de 10.497, y el que faltaba era éste.
  const salida = execFileSync('git', ['ls-files', 'app', 'lib'], { cwd: fileURLToPath(raiz), encoding: 'utf8' });
  return salida.split('\n').filter((f) => /\.(ts|tsx)$/.test(f));
}

test('ningún archivo importa next/font/google', () => {
  const culpables: string[] = [];
  for (const f of fuentes()) {
    let src: string;
    try { src = leer(f); } catch { continue; }
    // Sólo el IMPORT cuenta: los comentarios nombran la ruta a propósito, para explicar por qué no se usa.
    const sinComentarios = src.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    if (/from\s+['"]next\/font\/google['"]/.test(sinComentarios)) culpables.push(f);
  }
  assert.deepEqual(
    culpables,
    [],
    `estos archivos hacen que el build dependa de que Google conteste al compilar:\n  ${culpables.join('\n  ')}\n` +
      'Va como hoja de Google desde el navegador (molde: app/chats/fuente.tsx) o next/font/local con el woff2.',
  );
});

test('las hojas de fuente que quedaron declaran precedence, para que React las deduplique', () => {
  for (const f of ['app/chats/fuente.tsx', 'app/image-editor/fuenteUi.tsx']) {
    const src = leer(f);
    assert.match(src, /fonts\.googleapis\.com/, `${f} dejó de servir la hoja de Google`);
    assert.match(src, /precedence=/, `${f} no declara precedence: dos montajes = dos hojas en el head`);
  }
});
