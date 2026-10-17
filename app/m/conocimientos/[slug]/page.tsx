// =============================================================================
// /m/conocimientos/<slug> — el «Contenido» de UN curso (la app de Udemy en el celular). En la URL, /conocimientos?curso=<slug>.
// =============================================================================
// Las secciones del curso (sus módulos, con el nombre que les puso el super admin) y las clases numeradas, en el orden
// del portal de escritorio (`aplicarAjustes`, sin las ocultas: a nadie más se le mandan). Cada clase abre su pantalla.
// La URL de escritorio es la de los links viejos del portal (`?curso=`), que la computadora traduce sola a su `#curso=`.
// =============================================================================

import '../conocimientos.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { leerAjustesConError } from '@/lib/conocimiento-ajustes-datos';
import { aplicarAjustes } from '@/lib/conocimiento-ajustes';
import { buscarCurso, VISTA_PROPIA } from '@/app/conocimientos/catalogo';
import { CabeceraM, FilaM, ListaM, PantallaM, SeccionM, VacioM } from '@/app/m/_ui';

export const dynamic = 'force-dynamic';

export default async function CursoMovil({ params }: { params: Promise<{ slug: string }> }) {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  await requireMovil();
  const { slug } = await params;
  const base = buscarCurso(decodeURIComponent(slug));
  if (!base || Object.values(VISTA_PROPIA).some((v) => v === base.slug)) {
    return (
      <PantallaM>
        <CabeceraM titulo="Curso" />
        <VacioM frase="No encuentro ese curso en el teléfono." accion={{ rotulo: 'Ver los cursos', href: '/m/conocimientos' }} />
      </PantallaM>
    );
  }
  const { filas } = await leerAjustesConError([base.slug]);
  const curso = aplicarAjustes(base, filas, { conOcultos: false });
  return (
    <PantallaM>
      <CabeceraM titulo={curso.tituloCorto ?? curso.titulo} />
      {curso.resumen && <p className="m-conocimientos-resumen">{curso.resumen}</p>}
      {curso.modulos.filter((m) => m.clases.length > 0).map((m) => (
        <SeccionM key={m.key} titulo={m.nombre}>
          <ListaM>
            {m.clases.map((c) => (
              <FilaM key={c.n} leading={<span className="m-conocimientos-n">{c.n}</span>} titulo={c.titulo} segunda={c.cardDesc || undefined}
                href={`/m/conocimientos/${base.slug}/${c.n}`} />
            ))}
          </ListaM>
        </SeccionM>
      ))}
    </PantallaM>
  );
}
