// =============================================================================
// /admin/dev/<area> — el registro de construcción de una tab del producto
// =============================================================================
// La misma idea que ya funciona en «MaKo UX/UI»: mientras se trabaja una tab,
// queda escrito el ROADMAP (en qué fase está) y el CHANGE HISTORY (qué se
// pidió, qué se hizo y por qué). Después, cambiar o debuguear esa tab no
// arranca de cero.
//
// El contenido de cada área vive en su `bitacora.ts` y es lo ÚNICO escrito a
// mano, porque es lo único que ningún código puede deducir. La pantalla es
// compartida (`../_registro/Registro.tsx`): agregar un área es agregar datos,
// no otra pantalla.
//
// Solo super-admin: es herramienta de construcción, no producto.

import { notFound, redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { areaDe } from '../areas';
import { registroDe } from '../registros';
import { roadmapDe, tareasDelCamino, wsDelBoard } from '../roadmap';
import { enPlan, listPlanBoard } from '@/lib/plan-board';
import { getPerfil } from '@/lib/perfil';
import { historialGitDe } from '../_historial.generado';
import { RegistroArea } from './RegistroArea';

export const dynamic = 'force-dynamic';

export default async function AreaDevPage({ params, searchParams }: {
  params: Promise<{ area: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  // El mismo guard que el resto de /admin: rol de AGENCIA, re-chequeado contra
  // la base en cada request. requireRolWs([]) no sirve acá — `rol_ws` vale
  // 'admin' para el dueño de CADA workspace.
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  const { area: slug } = await params;
  // El área se llamaba «ads-generator» y pasó a llamarse como la feature. La
  // ruta vieja redirige en vez de dar 404: está escrita en la bitácora del
  // rediseño y en links que ya circularon.
  if (slug === 'ads-generator') redirect('/admin/dev/ads-writer');
  // El área se llamaba «cs-analyst» y era la mitad del asunto: el analista de
  // riesgo es UNA pieza de Customer Success, no el módulo. Mismo trato que
  // arriba — la ruta vieja redirige, no da 404.
  if (slug === 'cs-analyst') redirect('/admin/dev/customer-success');
  const area = areaDe(slug);
  if (!area) notFound();

  // Los dos paneles derivados: el Roadmap sale del plan y el historial de git.
  // Ver el encabezado de `../areas.ts` para por qué no se escriben a mano.
  const ws = wsDelBoard(admin.ws);
  const { tareas } = await roadmapDe(slug, ws);
  // Las áreas con Roadmap escrito a mano reclaman tareas de VARIOS proyectos (el
  // camino de Customer Success toca Dashboard, Legal y fiscal, Avisos…), así que
  // `roadmapDe` —que filtra por los proyectos del área— no alcanza. Devuelve []
  // para las demás: es la misma consulta cacheada, no una segunda ida a la base.
  const tareasCamino = await tareasDelCamino(slug, ws);
  // El board COMPLETO, solo para las áreas con roadmap propio: su pantalla abre la
  // tarjeta con el MISMO modal que /plan, y ese modal necesita el `Board` entero
  // (checklist, historial, MaKo). Para las demás no se pide nada.
  const plan = tareasCamino.length
    ? await enPlan(() => listPlanBoard()).catch(() => null)
    : null;
  const user = await getPerfil().then((p) => ({ nombre: p.nombre, avatarUrl: p.avatarUrl })).catch(() => ({ nombre: '', avatarUrl: '' }));
  // La sub-tab se lee ACÁ y no con `useSearchParams`: ese hook hace que el
  // boundary se saltee el render del servidor y la primera pintura salga vacía.
  // Es el mismo molde que app/admin/ui/page.tsx, que ya lo dejó escrito — y
  // acá importa más, porque `?tab=` es además el único camino para abrir un
  // panel desde afuera (un clic sintético no llega al onClick de React).
  const { tab } = await searchParams;
  return <RegistroArea area={area} registro={registroDe(slug)} tareas={tareas} commits={historialGitDe(slug)} tabInicial={tab} tareasCamino={tareasCamino} plan={plan} user={user} />;
}
