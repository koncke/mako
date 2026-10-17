// =============================================================================
// /m/conocimientos/<slug>/<n> — UNA clase (la app de Udemy en el celular). En la URL, /conocimientos?curso=<slug>&clase=<n>.
// =============================================================================
// El video arriba, a todo el ancho y 16:9 (el mismo reproductor de Drive que la computadora:
// app/conocimientos/CursoConocimientos.tsx), el resumen debajo con el Markdown de la casa, las herramientas y el
// material de la clase como links, y Anterior / Siguiente en el orden del curso (`aplicarAjustes`, como escritorio).
// Lo que no viene: la transcripción y el documento replicado, que en escritorio se piden aparte y pesan.
// =============================================================================

import '../../conocimientos.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { leerAjustesConError } from '@/lib/conocimiento-ajustes-datos';
import { aplicarAjustes } from '@/lib/conocimiento-ajustes';
import { buscarCurso } from '@/app/conocimientos/catalogo';
import type { Recurso } from '@/app/conocimientos/curso';
import { Markdown } from '@/app/_components/Markdown';
import { CabeceraM, FilaM, ListaM, PantallaM, SeccionM, VacioM } from '@/app/m/_ui';

export const dynamic = 'force-dynamic';

export default async function ClaseMovil({ params }: { params: Promise<{ slug: string; n: string }> }) {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  await requireMovil();
  const { slug, n } = await params;
  const base = buscarCurso(decodeURIComponent(slug));
  const curso = base ? aplicarAjustes(base, (await leerAjustesConError([base.slug])).filas, { conOcultos: false }) : null;
  const i = curso ? curso.clases.findIndex((c) => c.n === Number(n)) : -1;
  if (!base || !curso || i < 0) {
    return (
      <PantallaM>
        <CabeceraM titulo="Clase" />
        <VacioM frase="No encuentro esa clase." accion={{ rotulo: 'Ver los cursos', href: '/m/conocimientos' }} />
      </PantallaM>
    );
  }
  const c = curso.clases[i];
  const antes = curso.clases[i - 1];
  const despues = curso.clases[i + 1];
  const material = (c.recursoSlugs ?? []).map((s) => curso.recursos.find((r) => r.slug === s)).filter((r): r is Recurso => r != null);
  const enlace = (r: { driveId?: string; notionUrl?: string }) => (r.driveId ? `https://drive.google.com/file/d/${r.driveId}/view` : r.notionUrl ?? null);
  const nombre = curso.tituloCorto ?? curso.titulo;
  return (
    <PantallaM>
      <CabeceraM titulo={c.titulo} padre={{ href: `/m/conocimientos/${base.slug}`, label: nombre }} />
      {c.videoId && (
        <div className="m-conocimientos-video">
          <iframe src={`https://drive.google.com/file/d/${c.videoId}/preview`} allow="autoplay; fullscreen" allowFullScreen title={c.titulo} />
        </div>
      )}
      {c.resumen && <div className="m-conocimientos-md"><Markdown text={c.resumen} enlaces /></div>}
      {c.herramientas.length > 0 && (
        <SeccionM titulo="Herramientas">
          <ListaM>
            {c.herramientas.map((h) => <FilaM key={h.url} icono="tools" titulo={h.nombre} segunda={h.nota} href={h.url} />)}
          </ListaM>
        </SeccionM>
      )}
      {material.length > 0 && (
        <SeccionM titulo="Material">
          <ListaM>
            {material.map((r) => {
              const href = enlace(r);
              return <FilaM key={r.slug} icono="contexto" titulo={r.label} segunda={r.cardDesc} href={href ?? undefined} chevron={href != null} />;
            })}
          </ListaM>
        </SeccionM>
      )}
      <ListaM>
        {antes && <FilaM navegacion icono="flecha" titulo={antes.titulo} segunda="Anterior" href={`/m/conocimientos/${base.slug}/${antes.n}`} />}
        {despues && <FilaM navegacion icono="flecha" titulo={despues.titulo} segunda="Siguiente" href={`/m/conocimientos/${base.slug}/${despues.n}`} />}
      </ListaM>
    </PantallaM>
  );
}
