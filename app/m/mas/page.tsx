// =============================================================================
// /m/mas — More: la lista agrupada estilo Ajustes, por las FAMILIAS de la sidebar (v3, 14/10/2026)
// =============================================================================
//   1. LA CARA (17/10/2026 noche, prototipo docs/prototipos/coherencia-1710.md, pedido 7): la foto REAL (la de
//      Información personal, `leerPerfil`; hasta ese día se dibujaban siempre iniciales), el nombre, el @usuario y el
//      lápiz → My Profile (/m/cuenta). El menú de la foto de escritorio tiene la misma cara (Sidebar.tsx).
//   2. ARRIBA, sin título (17/10/2026, como la sidebar de escritorio): el Ops Center (sólo el super admin sin mirar un
//      cliente; /m/operaciones, con la Ticketera adentro) y Second Brain, cada uno con su CRIATURA del Ops Center.
//      Hasta ese día el Ops Center y la Ticketera iban en una caja «Super admin» al final: la Ticketera vive adentro
//      del Centro desde el 16/10, y la caja se fue con la familia Admin de escritorio.
//   3. Una caja por familia de la sidebar, con su nombre de escritorio y en su orden (lo diario sin título · Sales ·
//      Marketing · Create), cada ícono con el color de SU sección (los `--sec-*` de app/_ui/ui.css)
//   4. El menú de la foto (API, Configuración del negocio, Reportar problema) y, para el super admin sin mirar un
//      cliente, el suyo (Billing, Client Agents, MaKo Context, AI Models, Knowledge, Dev): sin título, como en escritorio
//   5. Versión de computadora
//
// ⚠️ DESDE EL 17/10/2026 ESTÁ TODO LO QUE DIBUJA LA SIDEBAR (`masCompleto`, lib/movil-rutas.ts). Martín: «Implementa
// completamente MaKo Mobile en todas las tabs, porque hay muchas que aun no se pueden acceder». Antes More listaba sólo
// las secciones con pantalla (`SECCIONES_MAS`) y una tab sin ella no aparecía en ningún lado. Ahora una tab sin pantalla
// es una fila «En la computadora» que abre una hoja con el motivo y la salida a la versión de computadora (FilasMas.tsx),
// nunca un link pelado al escritorio encogido. Qué tab tiene pantalla, cuál es sólo de escritorio y cuál está en camino
// lo fija tests/movil-toda-tab.test.ts recorriendo nav.ts.
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
import { leerPerfil } from '@/lib/perfil';
import { Icon } from '@/app/_components/icons';
import { FAMILIAS_MAS, RUTA_CENTRO_M, RUTA_PRONTO, barraMovil, masCompleto, type FilaMas } from '@/lib/movil-rutas';
import { esNavSoloPro } from '@/lib/plan-esencial-reglas';
import { esEsencialDeLaSesion } from '@/lib/plan-esencial';
import { masParaAppIos, sinFilas } from '@/lib/tienda';
import { esAgencia } from '@/lib/agencia';
import { esAppIosDelPedido } from '@/lib/tienda-pedido';
import { Criatura } from '@/app/_components/Criatura';
import { MAKO_NAV } from '@/app/_components/nav';
import { FilaM } from '../_ui/FilaM';
import { PantallaM } from '../_ui/PantallaM';
import { AvatarM, ListaM } from '../_ui/Piezas';
import { SeccionM } from '../_ui/SeccionM';
import { RUTA_CUENTA } from '../_ui/cabecera';
import { contarBadges } from '../badges';
import { FilaVersionComputadora } from './VersionComputadora';
import { FilaComputadoraM, FilaGrupoM } from './FilasMas';
import { CartelPruebaM } from '../_prueba/PruebaM';
import { estadoDePrueba } from '@/lib/prueba-uso';

export const dynamic = 'force-dynamic';

/** El @usuario: la parte de antes de la arroba del email (no hay un usuario aparte en la base), como el menú de la foto. */
const usuarioDe = (email: string | null | undefined) => { const u = (email ?? '').split('@')[0]?.trim(); return u ? `@${u}` : ''; };

/** Las filas de arriba llevan la criatura del Ops Center de ese nombre, como en escritorio (nav.ts → `criatura`). */
const criatura = (nombre: string, estrella = false) => <span className="m-mas-logo" aria-hidden><Criatura nombre={nombre} estrella={estrella} size={28} /></span>;

export default async function MasPagina() {
  const ctx = await requireMovil();
  // ⚠️ Se apaga mientras el super admin MIRA a un cliente (15/10/2026), como en el Sidebar: ahí la barra es la del cliente.
  const veOpsCenter = ctx.sesion.rol === 'admin' && !ctx.impersonando;
  // Desde el 20/10/2026 el Ops Center es el lugar del medio de la barra (para el super admin, el Centro): no se repite acá.
  const centroEnBarra = barraMovil(ctx.rol, ctx.capa, veOpsCenter).some((b) => b.href === RUTA_CENTRO_M);
  // La app de iPhone sin lo que Apple lee como relleno: «En la computadora» y «Coming soon» (guía 2.1, lib/tienda.ts).
  const appIos = await esAppIosDelPedido();
  const completo = masCompleto(ctx.rol, ctx.capa, veOpsCenter);
  // EL AGENCY DASHBOARD, SÓLO A UNA AGENCIA (13/11/2026, ticket #94): volvió al teléfono para que una agencia vea y abra a sus
  // clientes; a un negocio que no es agencia no le sirve (su página dice «se usa en la computadora»). `esAgencia` es la capa
  // y la fila de `agencias`, y «no pude leer» es «no» (lib/agencia.ts).
  const conAgency = ctx.ws != null && (await esAgencia(ctx.ws));
  const paraEste = conAgency ? completo : sinFilas(completo, (k) => k === 'agency');
  const grupos = appIos ? masParaAppIos(paraEste, RUTA_PRONTO) : paraEste;
  // MaKo Esencial por la pasarela (23/10/2026): las tabs de Pro se ven, marcadas (lib/plan-esencial-reglas.ts). Sin «Pasar a
  // Pro»: el teléfono no vende (T5, docs/tiendas-play-appstore.md).
  const esencial = await esEsencialDeLaSesion();
  const ids = grupos.flatMap((g) => g.filas.flatMap((f) => (f.tipo === 'pantalla' && f.seccion ? [f.seccion] : [])));
  // LA VERSIÓN DE PRUEBA (25/10/2026, copiada de Madgicx): el cartel de la barra lateral, en el menú del teléfono.
  const prueba = ctx.ws != null ? await estadoDePrueba(ctx.ws) : null;
  const [negocio, badges, perfil] = await Promise.all([
    ctx.impersonando
      ? Promise.resolve(ctx.clienteNombre)
      : ctx.ws != null
        ? getWorkspace(ctx.ws).then((w) => w?.nombre?.trim() || null).catch(() => null)
        : Promise.resolve(null),
    // `mas`: lo que espera una decisión, que se ve en la fila del Dashboard (su campana vive ahí; app/m/badges.ts).
    contarBadges({ rol: ctx.rol, capa: ctx.capa, ws: ctx.ws }, [...ids, 'mas']),
    leerPerfil().catch(() => null),
  ]);
  // La foto y el nombre salen de TU fila (lo último que guardaste en Información personal), como /m/cuenta; si el perfil
  // leído es el de otro (el super admin mirando un cliente), ni la foto ni el nombre son tuyos y vuelve la sesión.
  const tuyo = perfil && !perfil.vista.deOtro ? perfil.perfil : null;
  const nombre = (tuyo?.nombre || ctx.sesion.nombre || '').trim();
  const usuario = usuarioDe(ctx.sesion.email);
  const arriba = grupos.find((g) => g.id === 'arriba');
  // El Ops Center va ADENTRO de lo diario desde el 20/10/2026, como en la barra de escritorio (feedback del 18/10, pt 10):
  // una sola caja «Today» con el Ops Center primero y lo diario que no está en la barra de abajo.
  const diario = grupos.find((g) => g.id === 'diario');
  const resto = grupos.filter((g) => g.id !== 'arriba' && g.id !== 'diario');
  const tituloDiario = FAMILIAS_MAS.find((f) => f.id === 'diario')?.label ?? null;

  /** El número de una fila: el de su sección, o el de la campana en la del Dashboard (que no es una sección). */
  const numeroDe = (f: FilaMas) => (f.tipo !== 'pantalla' ? undefined : f.seccion ? badges[f.seccion] : f.key === 'hoy' ? badges.mas : undefined);

  /** Una fila de More: su pantalla, la hoja «En la computadora», o la hoja de un desplegable. */
  const fila = (f: FilaMas, conCriatura = false) => (
    f.tipo === 'computadora' ? <FilaComputadoraM key={f.key} fila={f} />
      : f.tipo === 'grupo' ? <FilaGrupoM key={f.key} fila={f} />
        : (
          <FilaM key={f.key} navegacion {...(conCriatura ? { leading: criatura(f.label, !!MAKO_NAV.find((it) => it.key === f.key)?.estrella) } : { icono: f.icon })} titulo={f.label}
            {...(esencial && esNavSoloPro(f.key) ? { segunda: 'De MaKo Pro' } : {})}
            riel={numeroDe(f) ? <span className="m-num">{numeroDe(f)}</span> : undefined} href={f.href} />
        )
  );

  return (
    <PantallaM>
      <ListaM>
        <FilaM
          leading={(
            <span className="m-mas-cara">
              <AvatarM nombre={nombre} email={ctx.sesion.email} foto={tuyo?.avatarUrl} tam="lg" />
              <span className="m-mas-cara__lapiz" aria-hidden><Icon name="pen" size={11} /></span>
            </span>
          )}
          titulo={nombre || ctx.sesion.email}
          segunda={[usuario, negocio].filter(Boolean).join(' · ') || undefined}
          href={RUTA_CUENTA}
        />
      </ListaM>
      {prueba?.enPrueba && <CartelPruebaM dias={prueba.dias} plan={prueba.plan ?? 'tu plan'} despues={prueba.despues} />}

      {((veOpsCenter && !centroEnBarra) || arriba || diario) && (
        <div className="m-mas-sec" data-sec="diario">
          <SeccionM titulo={tituloDiario}>
            <ListaM>
              {veOpsCenter && !centroEnBarra && <FilaM navegacion leading={criatura('Ops Center', true)} titulo="Ops Center" href={RUTA_CENTRO_M} />}
              {arriba?.filas.map((f) => fila(f, true))}
              {diario?.filas.map((f) => fila(f))}
            </ListaM>
          </SeccionM>
        </div>
      )}

      {resto.map((g) => (
        <div key={g.id} className="m-mas-sec" data-sec={g.id === 'menu' || g.id === 'superadmin' ? 'ajustes' : g.id}>
          <SeccionM titulo={g.titulo ?? null}>
            <ListaM>{g.filas.map((f) => fila(f))}</ListaM>
          </SeccionM>
        </div>
      ))}

      {!appIos && (
        <div className="m-mas-compu">
          <ListaM>
            <FilaVersionComputadora />
          </ListaM>
        </div>
      )}
    </PantallaM>
  );
}
