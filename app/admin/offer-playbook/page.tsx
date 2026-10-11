// =============================================================================
// /admin/offer-playbook — el criterio de la tab Offer y lo que se concluyó de cada curso
// =============================================================================
// Pedido de Martín (11/10/2026): «quiero que me dejes en SuperAdmin una tab con el
// criterio y todas las conclusiones que sacaste luego de analizar los cursos que
// hablan de OFFER, así lo puedo revisar».
//
// LA FUENTE SIGUE SIENDO EL REPO. El marco es docs/offer-marco.md y esta pantalla lo
// RENDERIZA partido en tabs (app/admin/offer-playbook/secciones.ts), igual que
// /admin/docs: no hay copia. Lo que corre de verdad (piezas y dimensiones) sale de
// lib/offer-marco.ts (EnElCodigo), y lo de cada autor de lib/offer-autores.ts.
//
// ⚠️ EL .md LLEGA AL DEPLOY POR `outputFileTracingIncludes` (next.config.ts). Sin eso
// `process.cwd()` lo encuentra en local y en producción no: por eso el fallo se
// MUESTRA (ErrorState) en vez de dibujar una tab vacía.
//
// ⚠️ EL GUARD ES EL ROL DE AGENCIA (getSesionAdmin), no `rol_ws`: el dueño de CADA
// workspace es 'admin' de su workspace. El proxy ya cierra /admin/* (SOLO_ADMIN); éste
// es el cerrojo que no depende de la ruta.
// =============================================================================

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { Pagina, PageHeader, ErrorState, Status } from '@/app/_ui';
import { MarkdownDoc } from '@/app/_components/MarkdownDoc';
import { AUTORES_OFERTA } from '@/lib/offer-autores';
import { TabsPlaybook } from './TabsPlaybook';
import { EnElCodigo } from './EnElCodigo';
import { Autores } from './Autores';
import { ListaPendientes } from './ListaPendientes';
import { esTabPlaybook, indiceDeSecciones, textoDeTab, type TabPlaybook } from './secciones';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Offer Playbook · Admin' };

function leerMarco(): { doc: string } | { error: string } {
  try {
    return { doc: readFileSync(join(process.cwd(), 'docs', 'offer-marco.md'), 'utf8') };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function OfferPlaybookPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  // La tab se lee ACÁ y no con useSearchParams: la primera pintura sale del servidor
  // con la tab correcta (el molde es /admin/ui).
  const { tab: pedida } = await searchParams;
  const tab: TabPlaybook = esTabPlaybook(pedida) ? pedida : 'criterio';

  const marco = leerMarco();
  if ('error' in marco) {
    return (
      <Pagina>
        <PageHeader titulo="Offer Playbook" />
        <ErrorState titulo="No se pudo leer el marco" detalle={`docs/offer-marco.md: ${marco.error}`} />
      </Pagina>
    );
  }

  // La versión la dice el documento («Versión 1 · 11/10/2026»), no esta pantalla.
  const version = marco.doc.match(/Versión\s+\d+\s*·\s*[\d/]+/)?.[0] ?? null;

  return (
    <Pagina>
      <PageHeader
        titulo="Offer Playbook"
        estado={version ? <Status>{version}</Status> : undefined}
      />
      <TabsPlaybook activa={tab} cuentas={{ autores: AUTORES_OFERTA.length }} />

      {tab === 'criterio' && <><EnElCodigo /><ListaPendientes /></>}
      {tab === 'autores'
        ? <Autores indice={indiceDeSecciones(marco.doc)} />
        : <MarkdownDoc texto={textoDeTab(marco.doc, tab)} />}
    </Pagina>
  );
}
