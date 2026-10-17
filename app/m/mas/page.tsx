// =============================================================================
// /m/mas — More: la lista agrupada estilo Ajustes, por las FAMILIAS de la sidebar (v3, 14/10/2026)
// =============================================================================
//   1. Tu cuenta (avatar, nombre, negocio) → /m/cuenta
//   2. ARRIBA, sin título (17/10/2026, como la sidebar de escritorio): el Ops Center (sólo el super admin sin mirar un
//      cliente; /m/operaciones, con la Ticketera adentro) y Second Brain, cada uno con su CRIATURA del Ops Center.
//      Hasta ese día el Ops Center y la Ticketera iban en una caja «Super admin» al final: la Ticketera vive adentro
//      del Centro desde el 16/10, y la caja se fue con la familia Admin de escritorio.
//   3. Una caja por familia de la sidebar, con su nombre de escritorio y en su orden (Operate · Sales Machine):
//      `gruposMas`
//   4. Versión de computadora
//
// ⚠️ DECISIONES NO VA EN `SECCIONES_MAS`, A PROPÓSITO (14/10/2026, acordado con el chat «Pricing MaKo»,
// dueño de la tab). SECCIONES_MAS es para tabs DEL NEGOCIO gateadas por una key de nav.ts (puedeVerKey),
// y de ahí salen la barra del rol, la cabecera y el desvío. Decisiones no es una tab del negocio: es el
// tablero de la PLATAFORMA, no tiene key en nav.ts, y su guard es «super admin» (getSesionAdmin =
// sesión con rol 'admin', la misma pregunta que se hace acá). Si entrara a SECCIONES_MAS podría «subir
// a la barra» de un rol al que le falta un destino, que es justo lo que no tiene que pasar.
//
// Lo que el rol no ve, NO aparece (`gruposMas` → `puedeVerKey`, la misma regla del Sidebar
// y del guard de cada sección). Lo que subió a la barra (porque el rol no ve CRM o Plan) no
// se repite aquí. More lo ve cualquiera con sesión: `requireMovil()` sin navKey.
// =============================================================================

import './mas.css';
import { requireMovil } from '@/lib/movil-guard';
import { getWorkspace } from '@/lib/workspace';
import { gruposMas } from '@/lib/movil-rutas';
import { Criatura } from '@/app/_components/Criatura';
import { FilaM } from '../_ui/FilaM';
import { PantallaM } from '../_ui/PantallaM';
import { AvatarM, ListaM } from '../_ui/Piezas';
import { SeccionM } from '../_ui/SeccionM';
import { RUTA_CUENTA } from '../_ui/cabecera';
import { contarBadges } from '../badges';
import { FilaVersionComputadora } from './VersionComputadora';

export const dynamic = 'force-dynamic';

/** El Ops Center del super admin (app/m/operaciones; en la URL, /admin/operaciones), con la Ticketera adentro. */
const RUTA_CENTRO = '/m/operaciones';
/** Las filas de arriba llevan la criatura del Ops Center de ese nombre, como en escritorio (nav.ts → `criatura`). */
const criatura = (nombre: string) => <span className="m-mas-logo" aria-hidden><Criatura nombre={nombre} size={28} /></span>;

export default async function MasPagina() {
  const ctx = await requireMovil();
  const grupos = gruposMas(ctx.rol, ctx.capa);
  const [negocio, badges] = await Promise.all([
    ctx.impersonando
      ? Promise.resolve(ctx.clienteNombre)
      : ctx.ws != null
        ? getWorkspace(ctx.ws).then((w) => w?.nombre?.trim() || null).catch(() => null)
        : Promise.resolve(null),
    contarBadges({ rol: ctx.rol, capa: ctx.capa, ws: ctx.ws }, grupos.flatMap((g) => g.secciones.map((s) => s.id))),
  ]);
  const nombre = (ctx.sesion.nombre ?? '').trim();
  // ⚠️ Se apaga mientras el super admin MIRA a un cliente (15/10/2026), como en el Sidebar: ahí la barra es la del cliente.
  const veOpsCenter = ctx.sesion.rol === 'admin' && !ctx.impersonando;
  const arriba = grupos.find((g) => g.familia === null);
  const familias = grupos.filter((g) => g.familia !== null);

  return (
    <PantallaM>
      <ListaM>
        <FilaM
          leading={<AvatarM nombre={nombre} email={ctx.sesion.email} tam="lg" />}
          titulo={nombre || ctx.sesion.email}
          segunda={negocio ?? undefined}
          href={RUTA_CUENTA}
        />
      </ListaM>

      {(veOpsCenter || arriba) && (
        <SeccionM titulo={null}>
          <ListaM>
            {veOpsCenter && <FilaM navegacion leading={criatura('Ops Center')} titulo="Ops Center" href={RUTA_CENTRO} />}
            {arriba?.secciones.map((s) => (
              <FilaM key={s.id} navegacion leading={criatura(s.label)} titulo={s.label}
                riel={badges[s.id] ? <span className="m-num">{badges[s.id]}</span> : undefined} href={s.href} />
            ))}
          </ListaM>
        </SeccionM>
      )}

      {familias.map((g) => (
        <SeccionM key={g.familia} titulo={g.titulo ?? undefined}>
        <ListaM>
          {g.secciones.map((s) => (
            <FilaM
              key={s.id}
              navegacion
              icono={s.icon}
              titulo={s.label}
              riel={badges[s.id] ? <span className="m-num">{badges[s.id]}</span> : undefined}
              href={s.href}
            />
          ))}
        </ListaM>
        </SeccionM>
      ))}

      <div className="m-mas-compu">
        <ListaM>
          <FilaVersionComputadora />
        </ListaM>
      </div>
    </PantallaM>
  );
}
