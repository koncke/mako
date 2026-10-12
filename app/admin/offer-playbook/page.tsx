// =============================================================================
// /admin/offer-playbook — el criterio de la tab Offer y lo que se concluyó de cada curso
// =============================================================================
// Pedido de Martín (11/10/2026): «quiero que me dejes en SuperAdmin una tab con el
// criterio y todas las conclusiones que sacaste luego de analizar los cursos que
// hablan de OFFER, así lo puedo revisar». Y esa misma tarde: «simplifica mucho la
// tab… elimina las sub tab de "precio y garantías" y "Fuentes"… más gráfico… ponme
// una tab de "A definir"».
//
// Cinco pestañas (tabs.ts): A definir (pendientes.ts), Criterio (§1-§7 + lo que
// corre en lib/offer-marco.ts), Autores (lib/offer-autores.ts + las fuentes, §10),
// Discrepancias (§9) y Errores comunes (§8).
//
// LA FUENTE SIGUE SIENDO EL REPO. El marco es docs/offer-marco.md y esta pantalla lo
// RENDERIZA partido (secciones.ts), igual que /admin/docs: no hay copia.
//
// ⚠️ EL .md LLEGA AL DEPLOY POR `outputFileTracingIncludes` (next.config.ts). Sin eso
// `process.cwd()` lo encuentra en local y en producción no: por eso el fallo se
// MUESTRA (ErrorState) en vez de dibujar una tab vacía. «A definir» no lee el
// documento, así que se dibuja igual.
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
import { TabsPlaybook } from './TabsPlaybook';
import { ListaPendientes } from './ListaPendientes';
import { Criterio } from './Criterio';
import { Autores } from './Autores';
import { Discrepancias } from './Discrepancias';
import { Errores } from './Errores';
import { A_DEFINIR } from './pendientes';
import { tabDeParam, indiceDeSecciones, seccionesDeTab } from './secciones';
import './playbook.css';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Offer Playbook · Admin' };

function leerMarco(): { doc: string } | { error: string } {
  try {
    return { doc: readFileSync(join(process.cwd(), 'docs', 'offer-marco.md'), 'utf8') };
  } catch (e) {
    return { error: e instanceof Error ? e.message : String(e) };
  }
}

export default async function OfferPlaybookPage({ searchParams }: { searchParams: Promise<{ tab?: string; ver?: string | string[] }> }) {
  const admin = await getSesionAdmin();
  if (!admin) redirect('/inicio');

  // La tab se lee ACÁ y no con useSearchParams: la primera pintura sale del servidor
  // con la tab correcta (el molde es /admin/ui). `ver` dice qué desplegable llega
  // abierto (lo usan los links «§N.N» de cada autor).
  const { tab: pedida, ver: verCrudo } = await searchParams;
  const tab = tabDeParam(pedida);
  const ver = typeof verCrudo === 'string' ? verCrudo : null;

  const marco = leerMarco();

  // La versión la dice el documento («Versión 1 · 11/10/2026»), no esta pantalla.
  const version = 'doc' in marco ? marco.doc.match(/Versión\s+\d+\s*·\s*[\d/]+/)?.[0] ?? null : null;

  return (
    <Pagina>
      <PageHeader titulo="Offer Playbook" estado={version ? <Status>{version}</Status> : undefined} />
      <TabsPlaybook activa={tab} cuentas={{ definir: A_DEFINIR.length }} />

      <div className="opb">
        {tab === 'definir' ? <ListaPendientes />
          : 'error' in marco ? <ErrorState titulo="No se pudo leer el marco" detalle={`docs/offer-marco.md: ${marco.error}`} />
            : tab === 'criterio' ? <Criterio doc={marco.doc} ver={ver} />
              : tab === 'autores' ? <Autores indice={indiceDeSecciones(marco.doc)} fuentes={seccionesDeTab(marco.doc, 'autores')} ver={ver} />
                : tab === 'discrepancias' ? <Discrepancias secciones={seccionesDeTab(marco.doc, 'discrepancias')} ver={ver} />
                  : <Errores secciones={seccionesDeTab(marco.doc, 'errores')} />}
      </div>
    </Pagina>
  );
}
