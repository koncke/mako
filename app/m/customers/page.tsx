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
import { vistaDeIngresos } from '@/lib/admin-ingresos';
import { cuantoEspera, pedidosPendientes } from '@/lib/pedidos-ingreso';
import { detalleDelPedido, textoDelCartel } from '@/lib/pedidos-ingreso-reglas';
import { ErrorM, FilaDatoM, ListaM, PantallaM, SeccionM } from '@/app/m/_ui';
import { CustomersM } from './CustomersM';

export const dynamic = 'force-dynamic';

export default async function CustomersMovil() {
  if (!(await getSesionAdmin())) redirect(await rutaConWs(HOME_MOVIL));
  await requireMovil();
  const vista = await vistaDeClientes().catch(() => null);
  if (!vista) return <PantallaM><ErrorM frase="No pudimos leer tus clientes. No es nada tuyo." /></PantallaM>;
  // Lo que espera a Martín (30/10/2026): en el teléfono se ve y se decide en la computadora, donde está el alta. Sin esto se enteraba
  // sólo por el correo. Sin poder leerlo no se dibuja: no es lo que vino a ver, y el error lo dice Accounts.
  const [espera, pedidos, ingresos] = await Promise.all([
    cuantoEspera(), pedidosPendientes().then((r) => r.pedidos).catch(() => []),
    // Lo que entra (Admin › Revenue). Sin poder leerlo, queda el bloque de siempre: no tumba la pantalla.
    vistaDeIngresos().catch(() => null),
  ]);
  const texto = textoDelCartel(espera.quierenEntrar, espera.deAgencias);
  const bandeja = texto ? (
    <SeccionM titulo={texto}>
      {pedidos.length > 0 && (
        <ListaM>
          {pedidos.map((p) => <FilaDatoM key={p.id} k={p.nombre ? `${p.nombre} · ${p.email}` : p.email} v={detalleDelPedido(p)} />)}
        </ListaM>
      )}
      <p style={{ margin: '8px 16px 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)' }}>Se aceptan en la computadora: Admin › Accounts.</p>
    </SeccionM>
  ) : null;
  return <PantallaM><CustomersM vista={vista} arriba={bandeja} ingresos={ingresos} /></PantallaM>;
}
