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
import { resolverToken, filtrarPorShare, registrarVisita, puedeEditar } from '@/lib/shares';
import { vistaDeTarea } from '@/lib/cs-tarea-vista';
import TareaCliente from './TareaCliente';
import Galeria from './Galeria';
import CursoCompartido from './CursoCompartido';
import AnalisisCompartido from './AnalisisCompartido';
import PortalCompartido from './PortalCompartido';
import { buscarCurso, VISTA_PROPIA } from '@/app/conocimientos/catalogo';

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
 *   · `tarea-cs`   → NO. El share apunta a un lead: el título llevaría el nombre de una
 *                    persona a cada chat donde se reenvíe.
 *   · `branding`   → NO. Es la galería privada de un workspace.
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
  const curso = buscarCurso(slug ?? undefined);
  if (!curso) return GENERICA;
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
    return <PortalCompartido invitado={acceso.invitado?.email ?? null} />;
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
    const curso = buscarCurso(slug);
    if (!curso) notFound();
    await registrarVisita(acceso);
    return <CursoCompartido curso={curso} invitado={acceso.invitado?.email ?? null} />;
  }

  // ── La tarea de un bloque del programa: la contesta el CLIENTE de un cliente ──
  // El share apunta al lead, y `puedeEditar` (mismo criterio que `puedeVer`) es
  // lo que habilita escribir. Acá solo se decide qué mostrar; quien AUTORIZA la
  // escritura es `/api/compartido/tarea`, porque si solo lo hiciera esta página
  // un POST directo escribiría sobre la tarea de otro.
  if (acceso.share.recurso === 'tarea-cs') {
    const leadId = Number(acceso.share.recurso_id);
    if (!Number.isFinite(leadId) || leadId <= 0) notFound();
    if (!puedeEditar(acceso.share, 'tarea-cs', String(leadId))) notFound();

    const { modulos, inicial, nombre, totales } = await vistaDeTarea(acceso.share.workspace_id, leadId);
    if (!modulos.length) notFound();
    await registrarVisita(acceso);
    return <TareaCliente token={token} nombre={nombre} modulos={modulos} inicial={inicial} totales={totales} />;
  }

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
