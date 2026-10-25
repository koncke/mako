// =============================================================================
// Classroom › Clients (/classroom/clients) — tus clientes, y el trabajo de cada uno
// =============================================================================
// ⚠️ ESTO ES UNA PANTALLA, NO UNA RUTA (17/10/2026). La monta app/classroom/clients/page.tsx; la ruta vieja
// (/customer-success, app/customer-success/page.tsx) redirige allá. El porqué de que el código siga en
// esta carpeta, en docs/diseno-clients.md (D2).
//
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
// Las computadoras de un cliente en su ficha (app/admin/ComputadorasDelNegocio.tsx): el mismo dibujo que «Tus cuentas de IA».
import '@/app/integraciones/tus-cuentas-ia.css';
import { ClientesApp } from './ClientesApp';
import { getPerfil, getTarjetaClientes } from '@/lib/perfil';
import { clientesGanados, tableroDeLaCartera, filasDeTodos } from './trabajo';
import { carteraEnEntrega } from './entrega';
import { lecturaDeFichas } from './ficha-lectura';
import type { ClienteCruce } from './cruce';
import { adminDeWorkspaceActual, estaImpersonando, getWorkspaceActual, wsSuperAdmin } from '@/lib/workspace';
import { sacadosPorProducto } from '@/lib/comunidad-moderacion';
import { puedeOperar } from '@/lib/operaciones-reglas';
import { AdminView } from '@/app/admin/AdminView';
import { urlGravatar } from '@/lib/gravatar';
import { getSesionAdmin } from '@/lib/auth';
import { PARAM_CLIENTE, leerClienteDeUrl } from '@/app/plan/board/filtro-cliente';
import { ultimoContactoDeClientes } from '@/lib/cs-cartera';
import { cobrosDeLaCartera } from './cobro-tarjeta';
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

export async function PantallaClientes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
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
  const sesionAdmin = await getSesionAdmin();
  if (sesionAdmin && !(await estaImpersonando())) {
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
        titulo="Clients" icono="cs"
        trabajo={trabajoSA}
        clientes={clientesSA}
        user={{ nombre: perfilSA.nombre, avatarUrl: perfilSA.avatarUrl }}
        // Las computadoras de un cliente, en su ficha: sólo para quien pasa la guarda del Centro (la de sus acciones).
        verComputadoras={puedeOperar(sesionAdmin, await wsSuperAdmin())}
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
  /** EL COBRO DE CADA UNO, para el aviso «Pago rechazado» / «Cuota vencida» de la tarjeta (20/10/2026). Nunca tira. */
  const lecturaCobros = cobrosDeLaCartera(clientes.map((c) => c.leadId));
  /**
   * CÓMO VE QUIEN MIRA LA TARJETA DE UN CLIENTE (21/10/2026, «Personalizar tarjetas»): de SU fila (`usuarios.perfil`),
   * con el HTML, como el CRM (`getCamposTarjetaCrm` en app/crm/page.tsx). Nunca tira: sin fila, la de siempre.
   */
  const lecturaTarjeta = getTarjetaClientes();

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

  // ⚠️ LAS CUENTAS DE MaKo DE LOS CLIENTES DE UNA AGENCIA SE FUERON DE ACÁ (17/10/2026): viven en MaKo Partners
  // (/partners, lib/partners.ts). Martín: «ahí deberían vivir los clientes de agencia, que no son los mismos que
  // "client": podrían serlo como no». Esta pantalla ya no lee la cartera, el plan, el equipo ni el cobro de nadie:
  // eran dos lecturas que CRUZAN de inquilino, y ahora las hace sólo la tab que las muestra. Un cliente que además
  // tiene cuenta lo dice en su ficha («MaKo Partners →», FichaCliente) con su `clienteWs`, que ya viene en el lead.
  // La tarjeta y la ficha tampoco dibujan nada de eso: CuentaDeMaKo, la tab Equipo, el chip del plan y «Reenviar el
  // acceso» se fueron el mismo día (lo que hacían, a Partners; tests/cs-tarjeta-cuentas.test.ts).

  /**
   * CADA CLIENTE, CON LO QUE DIBUJA SU FICHA (Resumen y Llamadas).
   *
   * ⚠️ LA ETAPA YA NO VIAJA ACÁ (06/10/2026): la ficha la muestra en un desplegable que lee
   * la MISMA asignación que el kanban, con lo movido en la sesión encima (FichaEntrega). Una
   * foto armada acá diría la etapa de antes de moverlo.
   */
  const fichas = await lecturaFichas;
  const contactos = await lecturaContacto;
  const cobros = await lecturaCobros;
  const tarjeta = await lecturaTarjeta;

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
      cobro: cobros?.[c.leadId] ?? null,
    },
  }));

  return (
    <ClientesApp
      clientes={clientesConFicha}
      tablero={tablero}
      trabajo={trabajo}
      user={{ nombre: perfil.nombre, avatarUrl: perfil.avatarUrl }}
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
      tarjeta={tarjeta}
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
  const ws = await getWorkspaceActual();
  const [clasesR, progresoR, accesosR, sacados] = await Promise.all([
    Promise.all(entrega.servicios.map(async (s) => [s.productoId, await clasesDelProducto(s.productoId)] as const))
      .then((xs) => ({ ok: true as const, m: new Map<number, Clase[]>(xs) }), (e) => ({ ok: false as const, error: mensaje(e) })),
    progresoDeClientes(ids).then((m) => ({ ok: true as const, m }), (e) => ({ ok: false as const, error: mensaje(e) })),
    accesosDeClientes(ids).catch((e) => { console.warn('[cs] no pude leer los accesos al curso:', mensaje(e)); return null; }),
    // Los sacados de cada programa no van en su Avance (se ven en Members → «Fuera»). Sin poder leerlos, se listan.
    (ws ? sacadosPorProducto(ws) : Promise.resolve(new Map<number, Set<number>>()))
      .catch((e) => { console.warn('[cs] no pude leer a los sacados:', mensaje(e)); return new Map<number, Set<number>>(); }),
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
      .filter((c) => esDelProducto(c.leadId, s.productoId, entrega.casaPorLead, asignacion) && !sacados.get(s.productoId)?.has(c.leadId))
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
