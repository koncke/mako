// =============================================================================
// /compartido/[token] — lo que ve alguien SIN LOGIN con un link compartido
// =============================================================================
// Server component: resuelve el token contra la fila viva, filtra el material
// por el alcance del link y renderiza solo eso. Si el token no existe, está
// revocado o venció, es un 404 igual que si nunca hubiera existido (no se
// distingue: eso ayudaría a enumerar tokens).
//
// noindex + no-store: un link compartido termina pegado en un chat o en una web.

import type { Metadata } from 'next';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import { listarAssetsDeWorkspace } from '@/lib/branding';
import { resolverToken, filtrarPorShare, registrarVisita } from '@/lib/shares';
import Galeria from './Galeria';
import CursoCompartido from './CursoCompartido';
import AnalisisCompartido from './AnalisisCompartido';
// ⚠️ La tab va PEREZOSA (su propio chunk): importada directo, el catálogo entero viajaba a TODO
//    link de esta ruta, también al de UN curso con lo que el super admin ocultó. Ver el archivo.
import PortalCompartido from './PortalCompartidoPerezoso';
import { buscarCurso, CURSOS_COMPARTIBLES, VISTA_PROPIA } from '@/app/conocimientos/catalogo';
import { PortalShell } from '@/app/conocimientos/CursoPortal';
import { ajustarFicha, aplicarAjustes, type FilaAjuste } from '@/lib/conocimiento-ajustes';
import { leerAjustes } from '@/lib/conocimiento-ajustes-datos';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Sin nombre de la casa: el título de la pestaña es lo primero que ve —y lo que
// copia al reenviar— quien recibe el link.
const GENERICA: Metadata = {
  title: 'Material compartido',
  robots: { index: false, follow: false },
};

/**
 * `resolverToken` memoizado POR REQUEST.
 *
 * `generateMetadata` y la page corren en la misma pasada y las dos necesitan el mismo
 * acceso; sin esto son dos lecturas a Supabase (share_invitados + shares) por cada carga
 * de un link. `cache()` de React las une en una.
 */
const resolver = cache(resolverToken);

/**
 * Lo que el super admin le cambió a esos cursos (mig 0221), memoizado POR REQUEST por la misma razón
 * que `resolver`: la tarjeta del link y la página leen lo mismo. Va ESTRICTO (tira si la base no
 * contesta): decide qué se OCULTA a un tercero, y una lectura caída que dijera «no hay ajustes» le
 * mostraría lo que se escondió. La clave es el texto de los slugs (separados por coma: un slug no
 * lleva) porque `cache` compara por identidad, y dos listas iguales armadas aparte son dos arrays.
 */
const ajustesDe = cache((slugs: string) => leerAjustes(slugs.split(',')));

/**
 * Lo que se ve si esa lectura falla: el curso no se abre, y se dice sin culpar a nadie. Es mejor que
 * mostrarle a un tercero lo que el super admin ocultó.
 */
function NoAbrio() {
  return (
    <PortalShell marca={<span className="al-brand"><span className="b">Cono<span>cimientos</span></span><span className="sub">Formación</span></span>}>
      <p className="al-sub">No pudimos abrir el curso. Prueba de nuevo en un rato.</p>
    </PortalShell>
  );
}

/**
 * La tarjeta que se ve al pegar el link en un chat.
 *
 * ⚠️ SOLO LOS CURSOS SE NOMBRAN, y el porqué es de privacidad, no de prolijidad. Un link
 * compartido termina pegado en un grupo de WhatsApp o en una web, y la tarjeta la arma el
 * scraper de esa plataforma SIN que nadie haga click — `robots: noindex` no lo frena,
 * porque no es un buscador. Así que lo que se ponga acá lo lee cualquiera que vea el
 * mensaje:
 *
 *   · `curso`      → se nombra. Que el que recibe el link sepa qué curso es ANTES de
 *                    abrirlo es justamente para lo que se manda.
 *   · `branding`   → NO. Es la galería privada de un workspace.
 *   · `conocimientos` → NO. Es la tab entera, no una cosa que valga anunciar.
 *   · lo que venga → NO, por default. Un `recurso` nuevo no se nombra hasta que alguien
 *                    decida que se puede; la lista es blanca a propósito.
 *
 * El resto cae en la tarjeta de marca de `app/layout.tsx` (/og-mako.jpg), que no dice
 * nada de nadie.
 */
export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const acceso = await resolver(token).catch(() => null);
  if (!acceso || acceso.share.recurso !== 'curso') return GENERICA;
  const slug = acceso.share.recurso_id;
  // Branding se sirve por su propio recurso; como curso da 404 (ver más abajo). Y el
  // Análisis de Negocio es material del método, no un curso que se nombre afuera.
  if (slug === VISTA_PROPIA.branding || slug === VISTA_PROPIA.analisis) return GENERICA;
  const base = buscarCurso(slug ?? undefined);
  if (!base) return GENERICA;
  // El título y la tapa de HOY, con lo que el super admin les cambió. Es una vista previa: si la
  // lectura falla, la del catálogo (no decide nada).
  const curso = ajustarFicha(base, await ajustesDe(base.slug).catch(() => []));
  return {
    ...GENERICA,
    title: curso.titulo,
    description: curso.cardDesc,
    openGraph: {
      type: 'article',
      title: curso.titulo,
      description: curso.cardDesc,
      // Sin `portada` NO se declara nada: así hereda la tarjeta de marca del layout, que
      // es mejor que una imagen rota. Hoy los 26 cursos compartibles tienen la suya —los
      // 6 que no son de la categoría propia de MaKo, que no se pueden compartir.
      ...(curso.portada ? { images: [{ url: curso.portada, width: 1200, height: 676, alt: curso.titulo }] } : {}),
    },
  };
}

export default async function CompartidoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const acceso = await resolver(token);
  if (!acceso) notFound();

  // ── La TAB ENTERA de Conocimientos: el selector con todos los cursos ──
  // No lleva `recurso_id`: el alcance es "todo" y la lista se resuelve en cada
  // carga, así que un curso que se suma después aparece en los links ya dados.
  if (acceso.share.recurso === 'conocimientos') {
    await registrarVisita(acceso);
    // Lo que el super admin cambió, de los cursos que entran: se aplica allá, sin lo oculto.
    let ajustes: FilaAjuste[];
    try { ajustes = await ajustesDe(CURSOS_COMPARTIBLES.map((c) => c.slug).join(',')); } catch { return <NoAbrio />; }
    return <PortalCompartido invitado={acceso.invitado?.email ?? null} ajustes={ajustes} />;
  }

  // ── Un curso compartido: el MISMO portal de /conocimientos ──
  // Mismo componente que ve el admin (videos, recursos, prompts, transcripción),
  // sin el chrome de la app ni el botón de Compartir.
  // El catálogo es el MISMO que lista /conocimientos (ver catalogo.ts): si acá
  // se armara una lista aparte, cada curso nuevo nacería con el link roto.
  if (acceso.share.recurso === 'curso') {
    const slug = acceso.share.recurso_id;
    // El Análisis de Negocio es un curso INTERACTIVO (no clases de video): tiene
    // su propia vista compartida, con el mismo contenido que ve el admin.
    if (slug === VISTA_PROPIA.analisis) {
      await registrarVisita(acceso);
      return <AnalisisCompartido invitado={acceso.invitado?.email ?? null} />;
    }
    // Branding se comparte por su propio recurso ('branding' → Galeria), que es
    // el que sabe de secciones y piezas sueltas. Como curso no se sirve.
    if (slug === VISTA_PROPIA.branding) notFound();
    const base = buscarCurso(slug);
    if (!base) notFound();
    await registrarVisita(acceso);
    // ⚠️ EL CURSO SE AJUSTA ACÁ, EN EL SERVER, y SIN LO OCULTO (`aplicarAjustes` sin `conOcultos`): lo
    //    que el super admin ocultó no viaja al navegador del invitado, ni en el HTML ni en las props.
    let filas: FilaAjuste[];
    try { filas = await ajustesDe(base.slug); } catch { return <NoAbrio />; }
    return <CursoCompartido curso={aplicarAjustes(base, filas)} invitado={acceso.invitado?.email ?? null} />;
  }

  // ── El material de marca: la galería ──
  // ⚠️ LA CONDICIÓN ES EN POSITIVO, y no es prolijidad. Hasta el 26/09/2026 esta
  // era la rama de descarte: todo lo que no fuera curso ni conocimientos caía
  // acá. `puedeVer` (lib/shares.ts) decide por ALCANCE y **no mira `recurso`**,
  // así que un share de otro recurso con `alcance: 'item'` se compara contra los
  // ids de los assets de marca del workspace y sirve el que coincida. Con
  // `tarea-cs` —cuyo `recurso_id` es un id de lead— eso era una colisión a la
  // espera de un asset con ese id. El recurso que no tenga rama propia no se
  // sirve: 404.
  if (acceso.share.recurso !== 'branding') notFound();

  // ⚠️ `tarea-cs` YA NO SE SIRVE (26/09/2026). Era el cuestionario de las 44
  // clases del programa de un cliente: esta página lo dibujaba y
  // `/api/compartido/tarea` autorizaba la escritura. Las dos se fueron con el
  // programa, y con ellas la única forma de EMITIR uno de esos links (el
  // whitelist `RECURSOS` de `app/api/compartir/route.ts` nunca lo aceptó). Los
  // que ya andan dando vuelta caen en el 404 de acá arriba, que es lo correcto:
  // un link vivo al contenido de un cliente que ya nadie puede revocar desde la
  // pantalla es una puerta abierta.

  const todos = await listarAssetsDeWorkspace(acceso.share.workspace_id);
  const visibles = filtrarPorShare(acceso.share, todos);
  if (!visibles.length) notFound();

  await registrarVisita(acceso);

  return (
    <Galeria
      token={token}
      etiqueta={acceso.share.etiqueta}
      invitado={acceso.invitado?.email ?? null}
      assets={visibles.map((a) => ({
        id: a.id, seccion: a.seccion, grupo: a.grupo, archivo: a.archivo,
        titulo: a.titulo, mime: a.mime, bytes: a.bytes, embed: a.panda_embed,
      }))}
    />
  );
}
