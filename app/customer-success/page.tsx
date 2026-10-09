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
import { carteraEnEntrega } from './entrega';
import { lecturaDeFichas } from './ficha-lectura';
import type { ClienteCruce } from './cruce';
import { getWorkspaceActual, adminDeWorkspaceActual, estaImpersonando } from '@/lib/workspace';
import { AdminView } from '@/app/admin/AdminView';
import { carteraDeAgencia, esAgencia, altasDeAgencia } from '@/lib/agencia';
import { clientesAprobados } from '@/lib/agencia-cartera';
import { capaDef } from '@/lib/capas';
import { listarWorkspaces } from '@/lib/workspace';
import { listarUsuarios } from '@/lib/usuarios';
import { caraDeUsuario, urlGravatar } from '@/lib/gravatar';
import { getSesionAdmin } from '@/lib/auth';
import { PARAM_CLIENTE, leerClienteDeUrl } from '@/app/plan/board/filtro-cliente';
import { ultimoContactoDeClientes } from '@/lib/cs-cartera';
import { sincronizarOnboardingClientes } from './onboarding-clientes-sync';
import { serviciosConEtapas, filasDeEntrega } from './onboarding-clientes';
import { clasesDelProducto, progresoDeClientes } from '@/lib/curso-datos';
import { accesosDeClientes } from '@/lib/curso-admin';
import { colorDeEtapa } from '@/lib/servicio-etapas';
import type { Clase } from '@/lib/curso';
import { esDelProducto } from './pertenencia';
import { avanceDeCliente, etapaDelCliente, ordenarFilas } from './curso/reglas';
import type { FilaConAcceso } from './curso/AvanceCurso';
import type { CursoClientes } from './ClientesApp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata = { title: 'Clientes · Customer Success' };

export default async function CustomerSuccessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
  // Lo que el Resumen y las Llamadas de cada ficha necesitan y la grilla no: teléfono,
  // plata y grabaciones. Arranca ACÁ y se espera más abajo, en paralelo con el resto: son
  // dos consultas sobre la cartera entera y no dependen de nada de lo que sigue. Nunca
  // tira — lo que no pudo leer viaja como `null` (ver ./ficha-lectura.ts).
  const lecturaFichas = lecturaDeFichas(clientes.map((c) => c.leadId))
    .catch((e) => {
      console.error('[cs] no pude leer los datos de las fichas:', mensaje(e));
      return { contacto: null, llamadas: null };
    });
  /**
   * EL ÚLTIMO CONTACTO DE CADA UNO, para la columna de la tabla (#109). Arranca acá, en paralelo
   * con lo de arriba, y por la MISMA lectura que usa la alerta al dueño (`ultimoContactoDeClientes`,
   * lib/cs-cartera.ts): si la columna y el aviso leyeran por dos caminos, el aviso podría decir
   * «23 días sin contacto» sobre una fila que dice «hace 2 días». Nunca tira: `null` es «no pude».
   */
  const lecturaContacto = ultimoContactoDeClientes(clientes.map((c) => c.leadId));

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

  /**
   * LA ENTREGA DE CADA SERVICIO VIENE CON EL HTML (mig 0188), por lo mismo que el
   * trabajo: cambiar de servicio en el selector del kanban no puede tener estado de
   * carga — es un filtro sobre lo que ya llegó.
   *
   * ⚠️ Y SE LEE AUNQUE NO HAYA CLIENTES. Las etapas de un servicio son una
   * configuración del negocio y existen antes del primer cliente; además es la
   * lectura que decide si el botón de la vista se ofrece. `carteraEnEntrega` no tira:
   * devuelve `ok: false` con su motivo, y la pantalla lo dice en vez de mostrar un
   * tablero vacío que afirmaría que nadie está en entrega.
   */
  const entrega = await carteraEnEntrega();

  /**
   * EL ONBOARDING DE LA TAB (#109; regla de la casa: toda tab tiene uno). Los pasos se DERIVAN de
   * lo que ya se leyó y se anotan en cada carga (./onboarding-clientes-sync.ts), así el ws1 —con su
   * catálogo, sus etapas y su cartera— entra con todo hecho y nada le tapa la pantalla. Con la
   * entrega sin leer, sus dos hechos van `null`: un cero ahí no es un dato.
   */
  const onboarding = await sincronizarOnboardingClientes({
    servicios: entrega.ok ? serviciosConEtapas(entrega.servicios) : null,
    clientes: clientes.length,
    movidos: entrega.ok ? filasDeEntrega(entrega.porServicio) : null,
  });

  /**
   * EL CURSO DE LA CARTERA (07/10/2026, items 4 y 9): la vista «Avance» y el menú de cada tarjeta
   * («Invitar al curso», «Permisos del curso»). Viene con el HTML por la regla de esta pantalla:
   * cambiar a Avance es un filtro sobre lo que ya llegó, sin estado de carga.
   */
  const curso = entrega.ok && clientes.length ? await cursoDeLaCartera(clientes, entrega) : undefined;

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
  // ⚠️ LA CARTERA SE LEE SÓLO SI ESTE WORKSPACE ES AGENCIA (05/10/2026). De ella cuelgan
  // las dos lecturas que CRUZAN de inquilino (el plan y el equipo de cada cliente, abajo),
  // y antes corrían con que hubiera filas aprobadas — o sea también para una agencia a la
  // que el super admin ya le sacó el permiso (`agencias`, mig 0176), cuyas filas de
  // `agencia_clientes` siguen ahí. Esconder la tab no alcanzaba: el equipo de otro
  // inquilino viajaba igual en el HTML. Son dos decisiones y la primera manda.
  const cartera = esAg && agenciaWs ? await carteraDeAgencia(agenciaWs) : [];

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
    // ⚠️ QUIÉN VE TODO LO DE CUENTAS Y EQUIPO: SÓLO UNA AGENCIA. De esto cuelgan
    // «Inspeccionar» / «Abrir cuenta» (CuentaDeMaKo), la tab «Equipo» de la ficha, «Pedir
    // sumar…» y «Sumar a alguien».
    //
    // Era `esSuper || esAg` desde el 27/09 («solamente deberían ver esa sección los
    // usuarios de agencia y super admin») y el 05/10/2026 se cerró a la mitad: «la tab de
    // "Equipo" y en general todo lo que tenga que ver con invitar a MaKo, debería solo
    // verse si la cuenta es AGENCIA, sino, no deberían estar esas opciones».
    //
    // ⚠️ Y PREGUNTA POR EL WORKSPACE QUE SE MIRA, NO POR QUIÉN MIRA. Con `esSuper` adentro,
    // el super admin parado en un cliente común veía controles que ese cliente no tiene —
    // la misma pantalla distinta según quién mire, que es lo que el dueño ya reportó como
    // lo más grave («¿me estás mostrando algo diferente al inspeccionar de lo que realmente
    // ven los usuarios?»). Parado en una agencia lo sigue viendo todo: `esAg` es del
    // workspace. `superAdmin` sigue abajo, y elige la PUERTA, no el permiso.
    visible: esAg,
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

  /**
   * CADA CLIENTE, CON LO QUE DIBUJA SU FICHA (Resumen y Llamadas).
   *
   * ⚠️ LA ETAPA YA NO VIAJA ACÁ (06/10/2026): la ficha la muestra en un desplegable que lee
   * la MISMA asignación que el kanban, con lo movido en la sesión encima (FichaEntrega). Una
   * foto armada acá diría la etapa de antes de moverlo.
   */
  const fichas = await lecturaFichas;
  const contactos = await lecturaContacto;

  /**
   * LA FICHA QUE LLEGA ABIERTA: `?cliente=<leadId>`. Se lee ACÁ y no en el navegador, por
   * lo mismo que `?vista=` en el Plan: viene con el primer HTML, así que un F5 o un link
   * compartido abren la ficha sin un parpadeo de la cartera entera antes.
   *
   * ⚠️ EL PARSER ES EL DEL PLAN (`leerClienteDeUrl`, entero estricto): `parseInt('12abc')`
   * es 12, y un parámetro a medio escribir que abre la ficha de OTRO cliente es peor que
   * uno que no abre nada. Y el nombre del parámetro también es el suyo (`PARAM_CLIENTE`):
   * es el mismo dato —«este cliente»— en dos pantallas, y dos strings a mano se separan.
   *
   * ⚠️ SÓLO EN ESTA RAMA, NO EN LA DEL SUPER ADMIN SIN IMPERSONAR: ahí la pantalla es la
   * grilla de WORKSPACES (`AdminView`), y un leadId no nombra a ninguno.
   *
   * No autoriza nada: si el id no es de un cliente de esta cartera, `ClientesApp` no abre
   * ninguna ficha (la busca en la lista que ya pasó por `getWorkspaceActual`).
   */
  const clienteInicial = leerClienteDeUrl((await searchParams)[PARAM_CLIENTE]);
  const sp = await searchParams;
  /**
   * LA VISTA Y EL SERVICIO CON QUE ABRE: `?vista=avance&producto=<id>` (07/10/2026). La vista Avance
   * se mudó de la tab Curso (item 4), y los links viejos (`/customer-success/curso?vista=avance`, el
   * «Ir a Avance» del onboarding del curso) tienen que caer ACÁ, en esa vista y en ese producto. Se
   * lee en el server por lo mismo que `?cliente=`: viene con el HTML, sin parpadeo. Un valor que no
   * sirve no abre nada raro: la vista se valida contra las que la pantalla ofrece y el producto
   * contra sus servicios (ClientesApp).
   */
  const uno = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const vistaInicial = uno(sp.vista) === 'avance' ? 'avance' as const : null;
  const productoInicial = /^[1-9]\d{0,11}$/.test(uno(sp.producto) ?? '') ? Number(uno(sp.producto)) : null;

  const clientesConFicha: ClienteCruce[] = clientes.map((c) => ({
    ...c,
    ficha: {
      contacto: fichas.contacto ? (fichas.contacto[c.leadId] ?? null) : null,
      llamadas: fichas.llamadas ? (fichas.llamadas[c.leadId] ?? []) : null,
      // La cara de su email, si nadie le eligió una (ver app/customer-success/foto-cliente.ts).
      fotoEmail: c.email?.trim() ? urlGravatar(c.email, 176) : null,
      // Sin fila en el mapa con la lectura bien = nunca hubo contacto (`fecha: null`), que no es
      // lo mismo que no haber podido leer (`null`).
      contactoUltimo: contactos ? (contactos[c.leadId] ?? { fecha: null, via: null }) : null,
    },
  }));

  return (
    <ClientesApp
      clientes={clientesConFicha}
      tablero={tablero}
      trabajo={trabajo}
      user={{ nombre: perfil.nombre, avatarUrl: perfil.avatarUrl }}
      cuentas={cuentas}
      entrega={entrega}
      /* Renombrar o borrar una columna le cambia el tablero a todo el equipo y puede
         dejar clientes en una etapa que ya no existe, así que la decide un admin del
         workspace. Mover un cliente de columna lo hace cualquiera que tenga la tab: es
         el trabajo del día. Y esto sólo decide si se DIBUJA el botón — el guard de
         verdad lo vuelve a hacer el server action, porque esconder un botón no protege
         nada. */
      puedeEditarEtapas={(await adminDeWorkspaceActual()) != null}
      clienteInicial={clienteInicial}
      onboarding={onboarding}
      curso={curso}
      vistaInicial={vistaInicial}
      productoInicial={productoInicial}
    />
  );
}

const mensaje = (e: unknown): string =>
  e instanceof Error ? e.message : 'No pude leer tus clientes.';

/**
 * Lo que la cartera necesita del curso: qué productos tienen clases, el acceso de cada cliente (con
 * su INVITACIÓN: a qué email y cuándo) y las filas de Avance de cada producto.
 *
 * ⚠️ LAS FILAS SE ARMAN CON LAS MISMAS FUNCIONES QUE LA TAB CURSO Y LA FICHA (`etapaDelCliente`,
 * `avanceDeCliente`, `ordenarFilas` de ./curso/reglas.ts y `esDelProducto` de ./pertenencia.ts). Es
 * la tabla que se mudó de /customer-success/curso (item 4): con una cuenta propia acá, la ficha y
 * esta vista podrían decir dos cosas del mismo cliente.
 *
 * ⚠️ EL ACCESO TRAE EMAIL E `invitacion_enviada_at` (`accesosDeClientes`). Sin eso la columna
 * «Acceso» le ofrecía «Invitar» —nunca «Reenviar»— a gente ya invitada, con el modal vacío.
 *
 * ⚠️ CADA LECTURA FALLA POR SU CUENTA. Las clases o el progreso caídos → la vista dice «no pude
 * leer» (una tabla vacía se leería como «nadie empezó»). Los accesos caídos → `null`: la columna dice
 * «—» y la tarjeta NO ofrece invitar (no se invita a ciegas: podría ser un segundo mail).
 */
async function cursoDeLaCartera(
  clientes: Awaited<ReturnType<typeof clientesGanados>>,
  entrega: Extract<Awaited<ReturnType<typeof carteraEnEntrega>>, { ok: true }>,
): Promise<CursoClientes> {
  const ids = clientes.map((c) => c.leadId);
  const [clasesR, progresoR, accesosR] = await Promise.all([
    Promise.all(entrega.servicios.map(async (s) => [s.productoId, await clasesDelProducto(s.productoId)] as const))
      .then((xs) => ({ ok: true as const, m: new Map<number, Clase[]>(xs) }), (e) => ({ ok: false as const, error: mensaje(e) })),
    progresoDeClientes(ids).then((m) => ({ ok: true as const, m }), (e) => ({ ok: false as const, error: mensaje(e) })),
    accesosDeClientes(ids).catch((e) => { console.warn('[cs] no pude leer los accesos al curso:', mensaje(e)); return null; }),
  ]);

  const conCurso: Record<number, boolean> = {};
  if (clasesR.ok) for (const [p, cs] of clasesR.m) conCurso[p] = cs.length > 0;
  const sinFila = { estado: 'sin-link' as const, ingresos: 0, ultimoIngresoAt: null, email: null, invitacionEnviadaAt: null };
  const accesoDe = (leadId: number): FilaConAcceso['acceso'] => (accesosR ? (accesosR.get(leadId) ?? sinFila) : null);
  const accesos: CursoClientes['accesos'] = accesosR ? Object.fromEntries(ids.map((id) => [id, accesoDe(id)])) : null;

  // Con las clases caídas tampoco se sabe qué producto tiene curso: `conCurso` va vacío y la
  // tarjeta no ofrece nada del curso (no se invita a un curso que no se pudo leer).
  if (!clasesR.ok) return { conCurso, accesos, avance: { ok: false, error: clasesR.error } };
  if (!progresoR.ok) return { conCurso, accesos, avance: { ok: false, error: progresoR.error } };
  const porProducto: Extract<CursoClientes['avance'], { ok: true }>['porProducto'] = {};
  for (const s of entrega.servicios) {
    const clases = clasesR.m.get(s.productoId) ?? [];
    if (!clases.length) continue;
    const keys = s.etapas.map((e) => e.key);
    const asignacion = entrega.porServicio[s.productoId] ?? {};
    const filas = clientes
      .filter((c) => esDelProducto(c.leadId, s.productoId, entrega.casaPorLead, asignacion))
      .map((c): FilaConAcceso => {
        const etapa = etapaDelCliente(keys, asignacion[c.leadId]?.etapa);
        const a = avanceDeCliente(clases, keys, etapa, progresoR.m.get(c.leadId));
        return { leadId: c.leadId, nombre: c.nombre, empresa: c.empresa ?? null, email: c.email ?? null, etapa, ...a, acceso: accesoDe(c.leadId) };
      });
    porProducto[s.productoId] = {
      etapas: s.etapas.map((e) => ({ key: e.key, label: e.label, color: colorDeEtapa(e, s.fases) })),
      // `ordenarFilas` reordena los MISMOS objetos: el email y la invitación viajan con cada fila.
      filas: ordenarFilas(filas, keys),
    };
  }
  return { conCurso, accesos, avance: { ok: true, porProducto } };
}

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
    // `null` = NO SE PUDO LEER, que no es lo mismo que «nadie». Ver la siembra de abajo.
    listarUsuarios().catch(() => null),
  ]);
  const planPorWs: Record<number, string> = {};
  for (const w of wss) if (permitidos.has(w.id)) planPorWs[w.id] = capaDef(w.capa).nombre;

  const equipoPorWs: Record<number, EquipoItem[]> = {};
  // ⚠️ CADA CLIENTE APROBADO ARRANCA CON SU LISTA VACÍA, PERO SÓLO SI LA LECTURA ANDUVO. Así la
  // tarjeta distingue «cero personas» (`[]`: la cuenta existe y NO PUEDE ENTRAR NADIE) de «no
  // pude mirar» (sin entrada). Es el estado de Brigitte Eberlin (ws15) desde el 28/09, y la
  // tarjeta no lo decía: la agencia veía «Inspeccionar» y nada más (09/10/2026).
  if (usuarios) for (const ws of permitidos) equipoPorWs[ws] = [];
  for (const u of usuarios ?? []) {
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
