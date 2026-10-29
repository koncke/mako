// =============================================================================
// /m/copywriter — el Copywriter en el teléfono, paso 1: la lista de guiones (docs/diseno-copywriter.md, D1)
// =============================================================================
// La tab de escritorio (app/copywriter) destilada, un paso por pantalla: acá la lista (el árbol de escritorio, con las
// subpáginas debajo de su página) y «Nuevo guion»; tocar uno abre el guion (/m/copywriter/<id>), que es otra pantalla.
// Referencia de app real: Notion en el teléfono (la lista de páginas con su ícono y un «+» grande para una nueva).
// Quién: `requireMovil({ navKey: 'copywriter' })` y la puerta de escritorio (./puerta.ts: desde el 29/10/2026, todos).
// =============================================================================

import './copywriter.css';
import { requireMovil } from '@/lib/movil-guard';
import { CabeceraM, ErrorM, PantallaM } from '@/app/m/_ui';
import { listar } from '@/lib/copywriter/server';
import { mudarLoDeAntes } from '@/lib/copywriter/mudanza';
import { catalogosDelCopywriter } from '@/lib/copywriter/catalogos-server';
import { requireCopywriterM } from './puerta';
import { ListaGuionesM } from './ListaGuionesM';

export const dynamic = 'force-dynamic';

export default async function CopywriterMovil() {
  await requireMovil({ navKey: 'copywriter' });
  await requireCopywriterM();
  // La primera vez, lo que el negocio ya tenía (Ads Writer, Reels) pasa a páginas (lib/copywriter/mudanza.ts).
  await mudarLoDeAntes();
  const [r, catalogos] = await Promise.all([listar(), catalogosDelCopywriter()]);
  return (
    <PantallaM>
      <CabeceraM titulo="Copywriting" />
      {r.ok
        ? <ListaGuionesM paginas={r.paginas} catalogos={catalogos} />
        : <ErrorM frase={`No se pudo leer la lista de páginas: ${r.error}`} />}
    </PantallaM>
  );
}
