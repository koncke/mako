// =============================================================================
// Hijo de tests/grupos-ops-lista-cartera.test.ts — NO es un test (no termina en .test.ts)
// =============================================================================
// La lista de grupos de quien administra una agencia, con la RUTA REAL (app/api/grupos) y la puerta real. La pestaña la pone
// `runWithWorkspace`, que es lo que lee `getWorkspaceActual`: en producción la pone la cookie de la vista de agencia. Imprime lo que
// contestó cada pedido; el padre mira.

import { db, comoPersona, decirResultado, sesionDe, usuario, type Sesion } from './_grupos-ops-arnes';
import { decirYSalir } from './_salir-cuando-salio';

const AGENCIA = 13, BRIGITTE_WS = 15, OTRO_CLIENTE = 16, REVOCADO = 17, INVITA = 30, PLATAFORMA = 9;
const AG = usuario(301, 'admin@agencia.test', 'Admin Agencia', AGENCIA, 'admin');
const BRIGITTE = usuario(401, 'duena@quince.test', 'Dueña Quince', BRIGITTE_WS, 'admin');

async function main() {
  db.workspaces.push(
    { id: PLATAFORMA, capa: 'superadmin', nombre: 'MaKo', estado: 'activo' }, { id: AGENCIA, capa: 'agencia', nombre: 'Agencia', estado: 'activo' },
    { id: BRIGITTE_WS, capa: 'completo', nombre: 'Quince', estado: 'activo' }, { id: OTRO_CLIENTE, capa: 'completo', nombre: 'Dieciséis', estado: 'activo' },
    { id: REVOCADO, capa: 'completo', nombre: 'Diecisiete', estado: 'activo' }, { id: INVITA, capa: 'completo', nombre: 'Treinta', estado: 'activo' },
  );
  db.usuarios.push(AG, BRIGITTE);
  db.agencias.push({ ws: AGENCIA });
  db.agencia_clientes.push(
    { agencia_ws: AGENCIA, cliente_ws: BRIGITTE_WS, estado: 'aprobado' }, { agencia_ws: AGENCIA, cliente_ws: OTRO_CLIENTE, estado: 'aprobado' },
    { agencia_ws: AGENCIA, cliente_ws: REVOCADO, estado: 'revocado' },
  );
  // Las dos tienen una invitación vigente a un grupo de afuera.
  db.grupo_invitados.push(
    { workspace_id: INVITA, email: AG.email, usuario_id: AG.id, desde_id: 0, salio_at: null, abrio_at: null },
    { workspace_id: INVITA, email: BRIGITTE.email, usuario_id: BRIGITTE.id, desde_id: 0, salio_at: null, abrio_at: null },
  );

  const { NextRequest } = await import('next/server');
  const { runWithWorkspace } = await import('../lib/workspace');
  const lista = await import('../app/api/grupos/route');
  const mensajes = await import('../app/api/grupos/[ws]/mensajes/route');

  const como = (u: Record<string, unknown>) => sesionDe(u) as Sesion;
  const wsDeLaLista = async (u: Record<string, unknown>, pestana: number | undefined) => comoPersona(como(u), async () => {
    const r = pestana === undefined ? await lista.GET() : await runWithWorkspace(pestana, () => lista.GET());
    const body = await r.json() as { grupos?: Array<{ ws: number }> };
    return (body.grupos ?? []).map((g) => g.ws);
  });
  const abrir = (u: Record<string, unknown>, pestana: number, ws: number) => comoPersona(como(u), async () =>
    (await runWithWorkspace(pestana, () => mensajes.GET(new NextRequest(`https://hola-mako.com/api/grupos/${ws}/mensajes`), { params: Promise.resolve({ ws: String(ws) }) }))).status);

  const out = {
    agenciaEnElCliente: await wsDeLaLista(AG, BRIGITTE_WS),
    agenciaEnSuNegocio: await wsDeLaLista(AG, AGENCIA),
    agenciaSinPestana: await wsDeLaLista(AG, undefined),
    agenciaEnUnRevocado: await wsDeLaLista(AG, REVOCADO),
    clienteEnSuNegocio: await wsDeLaLista(BRIGITTE, BRIGITTE_WS),
    // La puerta no cambió: la lista filtra, y desde la pestaña del cliente la agencia abre igual otro de su cartera.
    puertaOtroDeLaCartera: await abrir(AG, BRIGITTE_WS, OTRO_CLIENTE),
    puertaClienteAOtro: await abrir(BRIGITTE, BRIGITTE_WS, OTRO_CLIENTE),
  };
  await decirYSalir(decirResultado(out));
}

main().catch((e) => { console.error(e); process.exit(1); });
