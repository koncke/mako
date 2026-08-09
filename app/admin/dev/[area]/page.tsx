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
import { roadmapDe, wsDelBoard } from '../roadmap';
import { historialGitDe } from '../_historial.generado';
import { RegistroArea } from './RegistroArea';

export const dynamic = 'force-dynamic';

export default async function AreaDevPage({ params }: { params: Promise<{ area: string }> }) {
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
  const area = areaDe(slug);
  if (!area) notFound();

  // Los dos paneles derivados: el Roadmap sale del plan y el historial de git.
  // Ver el encabezado de `../areas.ts` para por qué no se escriben a mano.
  const { tareas } = await roadmapDe(slug, wsDelBoard(admin.ws));
  return <RegistroArea area={area} registro={registroDe(slug)} tareas={tareas} commits={historialGitDe(slug)} />;
}
