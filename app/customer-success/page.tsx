// =============================================================================
// /customer-success — tus clientes, y el trabajo de cada uno
// =============================================================================
// La pantalla contesta UNA pregunta: ¿quiénes son mis clientes y qué trabajo
// tiene cada uno en el tablero? Nada más. Se abre un cliente y se ven sus
// proyectos, sus tareas y sus recurrentes, con el detalle de cada uno.
//
// ⚠️ SE PODÓ EL 26/09/2026, Y EL PORQUÉ IMPORTA. Esta pantalla había acumulado
// una señal de atención en tres niveles, un reloj de contrato con barra de
// avance, cinco tabs (Contrato · Conversaciones · Cobros · Contacto) y tres
// botones de estado. Nada de eso se pidió: venía de calcar la tab que UN cliente
// (el ws1) tenía armada para su negocio. El resultado era una ficha que, para un
// cliente recién cargado, decía «Semana 1», «Ninguno todavía» y tres «Sin
// cargar» — cuatro afirmaciones sobre datos que nadie cargó nunca.
//
// ⚠️ LO QUE SE FUE DE LA PANTALLA NO SE FUE DEL PRODUCTO. `lib/cs-cartera.ts`,
// `lib/cs-senal.ts` y `lib/cs-contrato.ts` siguen enteros porque los usa MaKo
// (`lib/api-mako/areas/cs.run.ts`: `ver_cartera_cs`, `ver_cliente_cs`). Son dos
// superficies con dos preguntas distintas, y podar una no es borrar la otra.

import { requireCapa } from '@/lib/tab-access';
import { ClientesApp } from './ClientesApp';
import { getPerfil } from '@/lib/perfil';
import { clientesGanados, tableroDeLaCartera, filasDeTodos } from './trabajo';
import { getWorkspaceActual, adminDeWorkspaceActual, estaImpersonando } from '@/lib/workspace';
import { AdminView } from '@/app/admin/AdminView';
import { carteraDeAgencia, esAgencia, altasDeAgencia } from '@/lib/agencia';
import { clientesAprobados } from '@/lib/agencia-cartera';
import { capaDef } from '@/lib/capas';
import { listarWorkspaces } from '@/lib/workspace';
import { listarUsuarios } from '@/lib/usuarios';
import { caraDeUsuario } from '@/lib/gravatar';
import { getSesionAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Clientes · Customer Success' };

export default async function CustomerSuccessPage() {
  await requireCapa('customer-success');

  // ⚠️ LA MISMA TAB CONTESTA DOS PREGUNTAS SEGUN QUIEN MIRE, y no es un atajo: es
  // que «mis clientes» significa cosas distintas. Para un negocio son sus LEADS
  // GANADOS; para la plataforma son sus WORKSPACES — y los clientes del super
  // admin son literalmente eso: Mauricio es el ws1, Leila el 11, Juanfran el 13.
  // Antes eso vivia en /admin, o sea la misma pregunta contestada en dos pantallas.
  //
  // «SIN IMPERSONAR» es la mitad que importa: adentro de un cliente, el super admin
  // tiene que ver la cartera de ESE cliente, no la de la plataforma. Lo decide
  // `estaImpersonando()`, que es la misma funcion de la que cuelga el chrome — si
  // mirara otra cosa, la barra diria un cliente y la lista seria de otro.
  if ((await getSesionAdmin()) && !(await estaImpersonando())) {
    /**
     * ⚠️ EL TRABAJO VIENE CON EL HTML, igual que en la ficha de un cliente. «Cuando
     * entro al detail de un cliente tarda un montón en cargar sus tareas, cuando ya
     * habíamos dicho que debe quedar registro y ser automático» (28/09/2026), y tenía
     * razón: una versión anterior lo pedía por fetch al abrir la ficha, con su spinner.
     * Es la MISMA lectura que ya hace esta pantalla para un cliente común, así que sale
     * gratis — y es lo que hace que el detalle no tenga estado de carga.
     *
     * ⚠️ Y ES EL TRABAJO DEL SUPER ADMIN ATRIBUIDO A CADA CLIENTE, no el tablero del
     * cliente: `filasDeTodos()` lee SU tablero (`plan_tareas`, porque su capa es
     * `superadmin`) y lo agrupa por `cliente_lead_id`. Traer el del otro inquilino fue
     * exactamente el error que se reportó: «no tiene sentido eso».
     *
     * Si alguna de las tres lecturas falla, la pantalla se dibuja igual: la grilla de
     * workspaces sale de otro lado (/api/admin/workspaces) y lo único que se pierde es
     * el tablero de la ficha, que lo dice.
     */
    const [trabajoSA, clientesSA, perfilSA] = await Promise.all([
      filasDeTodos().catch(() => null),
      clientesGanados().catch(() => []),
      getPerfil().catch(() => ({ nombre: '', avatarUrl: '' })),
    ]);
    return (
      <AdminView
        titulo="Clientes" icono="cs"
        trabajo={trabajoSA}
        clientes={clientesSA}
        user={{ nombre: perfilSA.nombre, avatarUrl: perfilSA.avatarUrl }}
      />
    );
  }

  // ⚠️ SI LA LISTA NO SE PUEDE LEER, NO SE DIBUJA UNA LISTA VACÍA. Un workspace
  // que todavía no ganó a nadie y uno cuya consulta falló se ven idénticos, y el
  // primero es el caso normal — así que el segundo tiene que poder decirse.
  let clientes: Awaited<ReturnType<typeof clientesGanados>>;
  try {
    clientes = await clientesGanados();
  } catch (e) {
    return <ClientesApp clientes={[]} tablero={{ ok: false, error: mensaje(e) }} error={mensaje(e)}
      trabajo={{ dueno: false, porCliente: {} }} user={{ nombre: '', avatarUrl: '' }} />;
  }

  // Cuántos proyectos, tareas y recurrentes tiene cada uno. Sólo los números: el
  // detalle lo pide la ficha al abrirse (./actions.ts).
  //
  // ⚠️ SE CRUZA CONTRA LA CARTERA ENTERA, no cliente por cliente. El cruce blando
  // decide si una palabra distingue a alguien mirando a TODOS; con la lista
  // recortada, cualquier palabra sería única y le metería a un cliente el trabajo
  // de otro.
  //
  // ⚠️ Y SI FALLA, FALLA VISIBLE: `{ ok: false }`, nunca una lista vacía.
  const tablero = clientes.length
    ? await tableroDeLaCartera(clientes).catch((e) => ({ ok: false as const, error: mensaje(e) }))
    : ({ ok: true as const, porLead: {}, huerfanos: [], sinProyecto: 0 });

  // ⚠️ EL TRABAJO DE TODOS VIENE CON EL HTML, y ésa es toda la razón por la que el
  // detalle puede ser un modal sin estado de carga. Ver el porqué largo en
  // `filasDeTodos` (./trabajo.ts): dos rondas de optimización no movieron el «Leyendo
  // lo suyo» porque el problema no era la velocidad, era pedir los datos al abrir.
  //
  // Si falla, la grilla se dibuja igual y el modal lo dice: los números de las tarjetas
  // salen del cruce, que es otra lectura. Media pantalla es mejor que ninguna.
  const trabajo = clientes.length
    ? await filasDeTodos().catch(() => null)
    : { dueno: false, porCliente: {} };

  const perfil = await getPerfil().catch(() => ({ nombre: '', avatarUrl: '' }));

  // ⚠️ LA CARTERA VIENE CON EL HTML, por lo mismo que el trabajo: la ficha es un
  // modal sin estado de carga, y pedirle esto al abrirse le devolvería el «Leyendo
  // lo suyo» que esta pantalla ya se sacó de encima. Son dos consultas chicas sobre
  // una tabla con una fila por cliente-de-agencia.
  //
  // ⚠️ Y ES PARA DIBUJAR, NADA MÁS. `estadoPorWs` no autoriza: quien decide si esta
  // agencia entra a ese cliente es el server en cada request (lib/agencia.ts), y la
  // puerta (`/api/agencia/entrar`) se lo vuelve a preguntar a la base. Esconder un
  // botón no protege nada; lo que protege es el guard.
  const agenciaWs = await getWorkspaceActual();
  const esSuper = (await getSesionAdmin()) != null;
  const esAg = await esAgencia(agenciaWs);
  const cartera = agenciaWs ? await carteraDeAgencia(agenciaWs) : [];

  // ⚠️ EL PLAN Y EL EQUIPO DE CADA CLIENTE, SÓLO DE LOS APROBADOS. «Estas tarjetas de
  // clientes también deben tener el plan, cada uno, con normalidad… el resto de cosas
  // las podemos ver como otras tabs, como el equipo de ese cliente/agencia»
  // (27/09/2026). Las dos lecturas cruzan de inquilino, así que van con el MISMO corte
  // que la entrada y escrito en POSITIVO: sólo los `cliente_ws` que esta agencia tiene
  // APROBADOS. Con la cartera vacía no se lee nada — que es el caso de todo cliente
  // común, o sea el 99% de las visitas a esta pantalla.
  const mios = clientesAprobados(agenciaWs, cartera);

  // Lo que esta agencia ya pidió, agrupado por cliente. Viene con el HTML por lo
  // mismo que todo lo demás de esta pantalla: la ficha es un modal sin estado de
  // carga. ⚠️ Y SE LEE AUNQUE NO HAYA APROBADOS: un pedido sobre un cliente que
  // después se revocó tiene que seguir viéndose, o la agencia lo pide de nuevo
  // contra un índice único que ya lo tiene.
  const altasPorWs: Record<number, Awaited<ReturnType<typeof altasDeAgencia>>> = {};
  if (esAg && agenciaWs) {
    for (const a of await altasDeAgencia(agenciaWs)) (altasPorWs[a.cliente_ws] ??= []).push(a);
  }
  const { planPorWs, equipoPorWs } = mios.length
    ? await datosDeMisClientes(mios)
    : { planPorWs: {}, equipoPorWs: {} };
  const cuentas = {
    estadoPorWs: Object.fromEntries(cartera.map((f) => [f.cliente_ws, f.estado])) as Record<number, string>,
    // Abrirle cuenta a un cliente pide DOS cosas, y son dos preguntas distintas:
    // que este workspace sea una agencia habilitada por el super-admin (mig 0176)
    // y que quien mira sea su admin. Sin la primera, cualquier cliente con la tab
    // de Customer Success podría crear workspaces en la plataforma; sin la
    // segunda, podría hacerlo un closer.
    puedeAbrir: esAg && (await adminDeWorkspaceActual()) != null,
    // ⚠️ QUIÉN VE EL CONTROL, y es lo que faltaba. Antes lo veía todo el mundo y
    // a la mayoría le decía «Sin cuenta» — una afirmación sobre algo que a un
    // cliente común no le incumbe. «Solamente deberían ver esa sección los
    // usuarios de agencia y super admin» (27/09/2026).
    visible: esSuper || esAg,
    // El MECANISMO, no el permiso: el super admin entra por `?ws=` (su contexto
    // es la pestaña) y una agencia por la cookie firmada. `getSesionAdmin`
    // contesta por la SESIÓN, que es justo lo que hace falta acá — sigue siendo
    // super admin aunque esté parado adentro de un cliente.
    superAdmin: esSuper,
    // Para DIBUJAR el chip del plan y la tab de Equipo. Vacíos cuando no hay cartera.
    planPorWs,
    equipoPorWs,
    altasPorWs,
    // Quién puede PEDIR un alta. Es la misma condición que abrir una cuenta —agencia
    // habilitada + admin de este workspace—, y la de verdad la vuelve a hacer el server
    // en cada request contra la cartera (`puedeEntrarAhora`). Acá sólo decide si se
    // dibuja el formulario: esconder un botón no protege nada.
    puedePedirAltas: esAg && (await adminDeWorkspaceActual()) != null,
  };

  return (
    <ClientesApp
      clientes={clientes}
      tablero={tablero}
      trabajo={trabajo}
      user={{ nombre: perfil.nombre, avatarUrl: perfil.avatarUrl }}
      cuentas={cuentas}
    />
  );
}

const mensaje = (e: unknown): string =>
  e instanceof Error ? e.message : 'No pude leer tus clientes.';

/**
 * El plan y el equipo de los clientes que esta agencia tiene aprobados.
 *
 * ⚠️ DOS LECTURAS GLOBALES FILTRADAS ACÁ, y no dos consultas por cliente: `listarUsuarios`
 * y `listarWorkspaces` ya son las que usa /admin, traen todo de una y el filtro es un
 * `Set`. Con 14 clientes, catorce consultas serían catorce viajes para lo mismo.
 *
 * ⚠️ Y EL FILTRO ES EL QUE PROTEGE, no la pantalla. Lo que no esté en `aprobados` no
 * entra a estos mapas: si mañana alguien dibuja el equipo de un cliente que no le
 * corresponde, no va a tener de dónde sacarlo.
 */
/** Una persona del equipo de un cliente, como la dibuja la ficha. */
type EquipoItem = { id: number; nombre: string; email: string; rol: string; foto: string | null };

async function datosDeMisClientes(aprobados: number[]): Promise<{
  planPorWs: Record<number, string>;
  equipoPorWs: Record<number, EquipoItem[]>;
}> {
  const permitidos = new Set(aprobados);
  const [wss, usuarios] = await Promise.all([
    listarWorkspaces().catch(() => []),
    listarUsuarios().catch(() => []),
  ]);
  const planPorWs: Record<number, string> = {};
  for (const w of wss) if (permitidos.has(w.id)) planPorWs[w.id] = capaDef(w.capa).nombre;

  const equipoPorWs: Record<number, EquipoItem[]> = {};
  for (const u of usuarios) {
    const ws = u.workspace_id;
    if (ws == null || !permitidos.has(ws)) continue;
    (equipoPorWs[ws] ??= []).push({
      id: u.id,
      nombre: (u.nombre ?? '').trim() || u.email,
      email: u.email,
      // `rol_ws` es null para quien cruza workspaces; en el equipo de un cliente el
      // default honesto es el que la propia base usa al crear: admin del negocio.
      rol: u.rol_ws ?? 'admin',
      // Su foto, o la de su email. El orden lo decide `caraDeUsuario` y no esta
      // pantalla: escrito acá, la ficha y la grilla de la plataforma podrían elegir
      // distinto sobre la misma persona.
      foto: caraDeUsuario(u, 96),
    });
  }
  return { planPorWs, equipoPorWs };
}
