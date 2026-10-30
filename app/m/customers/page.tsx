// =============================================================================
// /m/customers — Customers en el teléfono (la URL que se ve es /customers: LAS MISMAS RUTAS) (26/10/2026)
// =============================================================================
// Hasta este día el teléfono decía «Esta pantalla se usa en la computadora». La pantalla, en ./CustomersM.tsx; los datos,
// los MISMOS de escritorio (`vistaDeClientes`, lib/clientes-plataforma.ts).
//
// ⚠️ La puerta es la de escritorio: el super admin (`getSesionAdmin`), antes de leer nada, como /m/cobros y /m/agente.

import './customers.css';
import { redirect } from 'next/navigation';
import { getSesionAdmin } from '@/lib/auth';
import { requireMovil } from '@/lib/movil-guard';
import { HOME_MOVIL } from '@/lib/movil-rutas';
import { rutaConWs } from '@/lib/workspace';
import { vistaDeClientes } from '@/lib/clientes-plataforma';
import { ErrorM, PantallaM } from '@/app/m/_ui';
import { CustomersM } from './CustomersM';

export const dynamic = 'force-dynamic';

export default async function CustomersMovil() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  await requireMovil();
  const vista = await vistaDeClientes().catch(() => null);
  if (!vista) return <PantallaM><ErrorM frase="No pudimos leer tus clientes. No es nada tuyo." /></PantallaM>;
  return <PantallaM><CustomersM vista={vista} /></PantallaM>;
}
