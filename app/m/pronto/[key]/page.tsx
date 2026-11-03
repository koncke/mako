// =============================================================================
// /m/pronto/<key> — una tab «Coming soon» en el teléfono (17/10/2026)
// =============================================================================
// En escritorio, cada tab con `comingSoon` (nav.ts: Closing Script, Sales Roleplay, VSL Generator, Image Generator…) abre
// la pantalla «Coming soon» de MaKo (app/_components/ComingSoon.tsx). El teléfono DESTILA eso mismo: el MaKo que flota,
// el nombre de la tab y la frase, sin el `<main>` de 100vh ni el padding de 40 de escritorio. No inventa una función que
// escritorio no tiene (AGENTS.md → «lo que escritorio NO tiene, el teléfono tampoco lo suma»).
//
// Referencia: la pantalla «Coming soon» de una función nueva en la app de Notion o de Linear en el celular (el logo, el
// nombre y una línea, centrados, sin botones que no llevan a ningún lado).
//
// La ruta es UNA para todas: `rutaMovil` la elige para cualquier ítem `comingSoon` (lib/movil-rutas.ts, al final, para que
// la pantalla de verdad de una tab le gane) y `rutaEscritorio` vuelve al href de ese ítem. La puerta es la de su key,
// como el guard de escritorio (`requireRolWs([], { nav })` de cada page de «pronto»).
// =============================================================================

import './pronto.css';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL, RUTA_MAS, itemPronto } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { esAppIosDelPedido } from '@/lib/tienda-pedido';
import { Icon } from '@/app/_components/icons';
import { MakoLogo } from '@/app/_components/MakoBrand';
import { CabeceraM, PantallaM } from '@/app/m/_ui';

export const dynamic = 'force-dynamic';

export default async function ProntoM({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const item = itemPronto(key);
  // Una key que no es (o dejó de ser) «pronto»: su pantalla de verdad la da `rutaMovil` desde la URL de escritorio.
  // Y en la app de iPhone tampoco se ve: Apple lee «Coming soon» como relleno (guía 2.1, lib/tienda.ts).
  if (!item || await esAppIosDelPedido()) redirect(await rutaConWs(HOME_MOVIL));
  await requireMovil({ navKey: item.key });
  return (
    <PantallaM>
      <CabeceraM titulo={item.label} padre={{ href: RUTA_MAS, label: 'More' }} />
      <div className="m-pronto">
        <div className="m-pronto-logo" aria-hidden>
          <span className="m-pronto-halo" />
          <span className="m-pronto-flota"><MakoLogo size={76} /></span>
        </div>
        <p className="m-pronto-tab"><Icon name={item.icon} size={14} /><span>{item.label}</span></p>
        <h2 className="m-pronto-t">Coming soon</h2>
        <p className="m-pronto-frase">MaKo está construyendo esta función.</p>
      </div>
    </PantallaM>
  );
}
