// =============================================================================
// /m/copywriter/<id> — un guion en el teléfono, paso 2: el documento, o MaKo (docs/diseno-copywriter.md, D1)
// =============================================================================
// Un paso por pantalla: arriba «Guion · MaKo» (el segmentado del teléfono) y debajo UNA de las dos, a pantalla entera.
// Es una pantalla de TRABAJO (un editor y un chat): sin título grande ni barra de abajo, con «‹ Guiones» para volver.
// Sin refrescar al tirar hacia abajo (`refrescable={false}`): adentro se escribe y se scrollea un documento, y tirar
// recargaría la página encima de lo que se está escribiendo (el motivo, en tests/movil-refrescar.test.ts).
// =============================================================================

import '../copywriter.css';
import { requireMovil } from '@/lib/movil-guard';
import { CabeceraM, ErrorM, PantallaM, VacioM } from '@/app/m/_ui';
import { getWorkspaceActual } from '@/lib/workspace';
import { abrir } from '@/lib/copywriter/server';
import { catalogosDelCopywriter, ofertasDelCopywriter } from '@/lib/copywriter/catalogos-server';
import { esIdPagina } from '@/lib/copywriter/tipos';
import { requireCopywriterM } from '../puerta';
import { GuionM } from '../GuionM';

export const dynamic = 'force-dynamic';

const VOLVER = { rotulo: 'Volver a los guiones', href: '/m/copywriter' };
const PADRE = { href: '/m/copywriter', label: 'Guiones' };

export default async function GuionMovil({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireMovil({ navKey: 'copywriter' });
  await requireCopywriterM();
  const { id } = await params;
  if (!esIdPagina(id)) return <PantallaM refrescable={false}><CabeceraM padre={PADRE} trabajo /><VacioM frase="Ese guion no está en esta cuenta." accion={VOLVER} /></PantallaM>;
  const [r, catalogos, ws, ofertas] = await Promise.all([abrir(id), catalogosDelCopywriter(), getWorkspaceActual().catch(() => null), ofertasDelCopywriter()]);
  if (!r.ok) {
    return (
      <PantallaM refrescable={false}>
        <CabeceraM padre={PADRE} trabajo />
        {r.status === 404 ? <VacioM frase="Ese guion no está en esta cuenta." accion={VOLVER} /> : <ErrorM frase={`No se pudo abrir el guion: ${r.error}`} />}
      </PantallaM>
    );
  }
  return (
    <PantallaM refrescable={false}>
      {/* La cabecera la pone GuionM: el título de la barra sigue al que se escribe (11/11/2026, decía «Sin título»). */}
      <GuionM ws={ws} guion={{ pagina: r.pagina, doc: r.doc }} catalogos={catalogos} ofertas={ofertas} enMako={(await searchParams).mako !== undefined} />
    </PantallaM>
  );
}
