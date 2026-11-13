// =============================================================================
// /m/agency — Agency Dashboard en el teléfono (la URL que se ve es /agency: LAS MISMAS RUTAS)
// =============================================================================
// Destila la tab de escritorio (app/agency/page.tsx, 25/10/2026): las cuentas de MaKo de los clientes del negocio, con lo que
// espera cada una. Abrir una cuenta, pagarla y sumar gente a un equipo quedan en la computadora. Reemplaza el /m/agency
// provisorio de Planes (que montaba la cartera vieja de /m/partners).
//
// ⚠️ EL TELÉFONO NO VENDE (T5, docs/tiendas-play-appstore.md, 3/11/2026): la landing con el precio tampoco se dibuja acá.
//
// ⚠️ DEL 4/11 AL 13/11/2026 NO SE DIBUJÓ EN NINGÚN TELÉFONO: decía plata que se le debe a MaKo («Falta pagar», «Esperando su
//    pago», «Renovación pendiente», «Quién paga», el número de «Pendientes»). VUELVE SIN ESO (ticket #94: Joan, de Código
//    Inmobiliario, no encontraba a sus clientes en el teléfono; Martín: «Soluciona esto»): la cartera, ver y entrar a cada
//    cliente. Sumar un cliente y cambiar su plan siguen en la computadora. More la muestra sólo a una agencia (app/m/mas).
//
// ⚠️ La puerta: la key `agency` de More (el admin de cualquier negocio, la misma regla que el menú de la foto) y el rol
//    (admin), que se pregunta acá igual que en escritorio. El cliente de una agencia no la ve (no hay promociones para él).

import './agency.css';
import { redirect } from 'next/navigation';
import { requireMovil } from '@/lib/movil-guard';
import { adminDeWorkspaceActual, estaImpersonando, getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { getSesionAdmin } from '@/lib/auth';
import { esClienteDeAgencia } from '@/lib/agencia';
import { cuentasDePartner, partnersDeLaPlataforma } from '@/lib/partners';
import { estadoAgency } from '@/lib/agency';
import { CabeceraM, ComputadoraM, ErrorM, PantallaM, VacioM } from '@/app/m/_ui';
import { RUTA_MAS } from '@/lib/movil-rutas';
import { AgencyM, AgenciasM } from './AgencyM';

export const dynamic = 'force-dynamic';

export default async function AgencyPagina({ searchParams }: { searchParams: Promise<{ cuenta?: string }> }) {
  await requireMovil({ navKey: 'agency' });
  const sp = await searchParams;
  const esSuper = (await getSesionAdmin()) != null;

  // El super admin sin cliente: todas las agencias, como en la computadora.
  if (esSuper && !(await estaImpersonando())) {
    const agencias = await partnersDeLaPlataforma().catch(() => null);
    return (
      <PantallaM>
        <CabeceraM titulo="Agency Dashboard" padre={{ href: RUTA_MAS, label: 'More' }} />
        {agencias ? <AgenciasM agencias={agencias} /> : <ErrorM frase="No pudimos leer las agencias. No es nada tuyo." />}
      </PantallaM>
    );
  }

  const ws = await getWorkspaceActual();
  if (ws == null) redirect('/m');
  const admin = (await adminDeWorkspaceActual()) != null;
  if (!admin && !esSuper) redirect(await rutaConWs('/m'));
  // ⚠️ La misma puerta que en escritorio, y con la misma función: `esClienteDeAgencia`, no `agenciaDeCliente` (P15,
  //    30/10/2026 — ésa devuelve null con DOS dueños y dejaba entrar justo a ese cliente). El `!== false` es el que
  //    trata el «no pude leer» como «no entra»; ver app/agency/page.tsx.
  const deAgencia = await esClienteDeAgencia(ws);
  if (!esSuper && deAgencia !== false) redirect(await rutaConWs('/m'));

  const estado = await estadoAgency(ws);
  if (!estado.esAgency) {
    return (
      <PantallaM>
        <CabeceraM titulo="Agency Dashboard" padre={{ href: RUTA_MAS, label: 'More' }} />
        <VacioM frase="Agency Dashboard se usa en la computadora." />
      </PantallaM>
    );
  }

  const cartera = await cuentasDePartner(ws);
  if (!cartera.ok) {
    return (
      <PantallaM>
        <CabeceraM titulo="Agency Dashboard" padre={{ href: RUTA_MAS, label: 'More' }} />
        <ErrorM frase="No pudimos leer tus clientes. No es nada tuyo." />
      </PantallaM>
    );
  }
  const cuenta = /^[1-9]\d{0,11}$/.test(sp.cuenta ?? '') ? Number(sp.cuenta) : null;
  return (
    <PantallaM>
      <AgencyM cuentas={cartera.cuentas} puedeAbrir={admin} superAdmin={esSuper} cuentaInicial={cuenta} />
      <ComputadoraM que="Sumar un cliente, cambiar su plan y sumar personas a su equipo" />
    </PantallaM>
  );
}
