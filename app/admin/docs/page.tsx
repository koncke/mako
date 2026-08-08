// =============================================================================
// /admin/docs — la documentación del repo, leída del repo
// =============================================================================
// LA FUENTE ÚNICA SIGUE SIENDO EL ARCHIVO. Esta pantalla los RENDERIZA; no hay
// copia en Supabase ni módulo generado. Es la regla «una cosa, un lugar» de
// AGENTS.md aplicada: una segunda copia se queda vieja, y este repo ya tiene la
// prueba —app/conocimientos/curso.ts dice «AUTO-GENERADO por gen-curso.mjs» y
// ese script no existe más, así que nadie puede regenerarlo.
//
// CÓMO LLEGAN LOS .md AL DEPLOY. `next.config.ts` los mete en el bundle de la
// función con `outputFileTracingIncludes`. Sin eso, `process.cwd()` encuentra
// los archivos en local y devuelve vacío en producción — que es exactamente lo
// que le pasa a /api/admin/graph, cuyos dos `catch` están vacíos y muestran un
// cartel de «no disponible» sin un solo error. Acá el fallo se MUESTRA.
//
// TODO PASA POR LA URL (?d= el documento, ?q= la búsqueda) y se resuelve en el
// servidor. La primera versión mandaba los 20 documentos al cliente para poder
// filtrar sin recargar: 675 KB por visita, y creciendo — los docs se
// duplicaron en un solo día. Ahora viaja UNO, el que se está leyendo, y la
// pantalla no lleva un byte de JavaScript propio.

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { Pagina, PageHeader, ErrorState } from '@/app/_ui';
import { DocsView, type Doc } from './DocsView';
import { CATALOGO } from './catalogo';
import { metaDeDocs } from './git-meta';

// Se leen del disco en cada request: así un `git pull` en el server se ve sin
// rebuild, y el costo es leer archivos de un filesystem local.
export const dynamic = 'force-dynamic';

/** Los que se abren primero: el orden en que conviene leerlos. */
const PRIMEROS = ['AGENTS', 'mapa-del-proyecto', 'hallazgos', 'dos-cuentas', 'conectores', 'chats', 'corridas-multiagente'];

function cargar(): { docs: Doc[]; error?: string } {
  const raiz = process.cwd();
  try {
    const archivos = readdirSync(join(raiz, 'docs'))
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({ slug: f.replace(/\.md$/, ''), ruta: join(raiz, 'docs', f), rel: `docs/${f}` }));

    archivos.unshift({ slug: 'AGENTS', ruta: join(raiz, 'AGENTS.md'), rel: 'AGENTS.md' });

    // Las transcripciones viven en su propia carpeta para no ahogar la lista:
    // son 49 contra 22. Sus slugs arrancan con `chat-`, que es lo que las manda
    // al grupo «Chats» del final.
    try {
      for (const f of readdirSync(join(raiz, 'docs', 'chats'))) {
        if (f.endsWith('.md')) {
          archivos.push({ slug: f.replace(/\.md$/, ''), ruta: join(raiz, 'docs', 'chats', f), rel: `docs/chats/${f}` });
        }
      }
    } catch { /* todavía no hay transcripciones exportadas */ }

    const meta = metaDeDocs();

    const docs: Doc[] = archivos.map(({ slug, ruta, rel }) => {
      const texto = readFileSync(ruta, 'utf8');
      // El título sale del primer `# ` del documento; el nombre del archivo es
      // el respaldo para uno que todavía no lo tenga.
      const h1 = texto.match(/^#\s+(.+)$/m);
      return {
        slug, rel, texto,
        titulo: h1 ? h1[1].trim() : slug,
        lineas: texto.split('\n').length,
        ficha: CATALOGO[slug] ?? null,
        meta: meta[slug] ?? null,
      };
    });

    const peso = (s: string) => {
      const i = PRIMEROS.indexOf(s);
      return i >= 0 ? i : PRIMEROS.length + (s.startsWith('hallazgos-') ? 0 : 1);
    };
    docs.sort((a, b) => peso(a.slug) - peso(b.slug) || a.slug.localeCompare(b.slug));
    return { docs };
  } catch (e) {
    return { docs: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function DocsPage({ searchParams }: { searchParams: Promise<{ d?: string; q?: string }> }) {
  // getSesionAdmin() es el rol de AGENCIA, re-chequeado contra la base en cada
  // request. NO sirve requireRolWs([]): `rol_ws` vale 'admin' para el dueño de
  // CADA workspace, así que ese guard abriría esto a todos los clientes.
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  const { docs, error } = cargar();

  if (error || docs.length === 0) {
    return (
      <Pagina>
        <PageHeader titulo="Documentación" proposito="Lo que hay que saber antes de tocar el código." />
        <ErrorState
          titulo="No se pudieron leer los documentos"
          detalle={
            error
              ? 'Si esto pasa en producción y no en local, falta docs/**/*.md en outputFileTracingIncludes de next.config.ts: sin eso los archivos no viajan al bundle de la función.'
              : 'No hay ningún .md en docs/.'
          }
          detalleTecnico={error}
        />
      </Pagina>
    );
  }

  const { d, q } = await searchParams;
  const busca = (q ?? '').trim().toLowerCase();

  // La búsqueda corre acá, sobre el texto que ya está en memoria. Es lo que un
  // agente hace con `Grep docs/` y lo que con los ojos no había forma de hacer:
  // el problema real no es leer un documento, es saber CUÁL abrir.
  const lista = docs
    .map((doc) => ({
      slug: doc.slug,
      titulo: doc.titulo,
      lineas: doc.lineas,
      grupo: doc.ficha?.grupo ?? (doc.slug.startsWith('chat-') ? 'Chats' : 'Referencia'),
      tabs: doc.ficha?.tabs ?? [],
      hits: busca ? doc.texto.toLowerCase().split(busca).length - 1 : 0,
    }))
    .filter((x) => !busca || x.hits > 0);

  if (busca) lista.sort((a, b) => b.hits - a.hits);

  // Con búsqueda activa se abre el documento que más coincidencias tiene,
  // salvo que se haya elegido uno a mano y siga en los resultados.
  const elegido = docs.find((x) => x.slug === d && lista.some((l) => l.slug === x.slug))
    ?? docs.find((x) => x.slug === lista[0]?.slug)
    ?? docs[0];

  return <DocsView lista={lista} activo={elegido} q={q ?? ''} total={docs.length} />;
}
