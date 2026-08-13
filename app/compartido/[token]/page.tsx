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
export const metadata: Metadata = {
  title: 'Material compartido',
  robots: { index: false, follow: false },
};

export default async function CompartidoPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const acceso = await resolverToken(token);
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
