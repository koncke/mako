'use client';

// =============================================================================
// FichaCliente — el cliente y SU tablero, en un modal
// =============================================================================
// «No quiero que sea otra ruta, quiero que sea un pop-up, un modal» (26/09/2026).
//
// ⚠️ EL TABLERO ES EL DE VERDAD, no una copia de su diseño: se monta `PlanBoard` /
// `TodoBoard`, los mismos componentes que renderiza `/plan`, con las filas ya filtradas a
// este cliente. Tres tandas se fueron en dibujar algo «parecido» —una lista, después unas
// tarjetas— y las tres se rechazaron por lo mismo: parecido no es igual, y un segundo
// diseño de la misma cosa se mantiene sincronizado a mano hasta que alguien se olvida.
//
// ⚠️ Y NO HAY ESTADO DE CARGA, que es la otra mitad del pedido. Las filas llegan por prop
// desde el server (`filasDeTodos`, leído en la página): al abrir el modal ya están. Dos
// rondas de optimización no movieron el «Leyendo lo suyo» porque el problema nunca fue la
// velocidad — un modal que pide sus datos al abrirse tiene un estado de carga por más
// rápida que sea la consulta.
//
// ⚠️ DOS `useBoard` NO SE PISAN ACÁ. Es la razón por la que antes no monté el tablero, y
// era cierta a medias: dos instancias sobre las MISMAS filas serían dos escritores, pero
// esta ficha y `/plan` nunca están montadas a la vez (son dos pantallas). Lo que sí se
// acota es el ALTA: lo que se cree adentro nace con este cliente puesto, o desaparecería
// al recargar porque esta vista sólo lee lo suyo.
//
// ⚠️ NO HAY BOTÓN DE «ASIGNARLE TRABAJO», y se sacó a pedido: «si ya copiamos la tab de
// plan, ya hay otros botones para eso» (27/09/2026). Es cierto y es la consecuencia de
// montar el tablero de verdad: lo que se crea acá adentro nace suyo, y a lo que ya existe
// se le pone el cliente desde el campo «Cliente» de su propio detalle. Un tercer camino a
// la misma pregunta no suma una opción: parte la respuesta en tres.

//
// ⚠️ Y DEL TABLERO QUEDA SÓLO «PRIORIDADES» (05/10/2026). «Para que no sea tan confuso y
// copiar toda la tab de PLAN en el detail, dejar solo la sección de "PRIORIDADES" y Tareas,
// Proyectos y Recurrentes que se vean en la tab de Plan, y que haya un botón que te
// redirija con el filtro ya puesto». La ficha pasó a tener SU fila de tabs y el tablero se
// monta con `soloVista="prioridades"`, que le apaga su propio selector: sigue habiendo UNA
// fila, ahora la de la ficha.
//
// ⚠️ Y DESDE EL 06/10 LAS TABS SON Resumen · Tareas · Pagos · Llamadas · Historial · Equipo.
// «Prioridades» pasó a llamarse «Tareas» y lleva «Ver en el Plan» donde el tablero tenía su
// «⋮» («no cumple función allí»); Pagos e Historial son los del CRM («como está en el CRM»,
// «es importante que se registre historial en los clientes de Customer Success»). Y la
// etapa y el producto viven en la cabecera, como en el CRM (./FichaEntrega.tsx).
//
// ⚠️ Y EL MISMO DÍA ENTRÓ «Curso», después de Tareas: «Dentro del Detail de los clientes de
// Mauricio se tiene que ver este CURSO». Su avance clase por clase, su link al portal y las
// llamadas de la entrega (./FichaCurso.tsx). Como Equipo, NO se condiciona por lo que tenga
// adentro: un cliente sin clases ve la pestaña con su vacío, que dice dónde está parado.

import { useState, useRef, useEffect, type ReactNode } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { Modal, Tabs, type Tab } from '@/app/_ui';
import { PortadaPicker } from '@/app/_components/PortadaPicker';
import { useReposicionar, BarraReposicion } from '@/app/_components/Reposicionar';
import { IdentidadPicker } from '@/app/_components/IdentidadPicker';
import { Marca } from '@/app/_components/Marca';
import { EditableInline } from '@/app/_components/EditableInline';
import { fondoPortada, esFoto, urlPortada } from '@/lib/portadas';
import type { BoardUser } from '@/app/plan/board/types';
import type { ClienteRef } from '@/lib/plan-clientes';
import { PlanBoard } from '../plan/PlanBoard';
import { TodoBoard } from '../plan/TodoBoard';
import type { ClienteCruce } from './cruce';
import type { TrabajoDeCliente } from './trabajo';
import { colorDe } from './ClienteCard';
import { guardarDatosClienteAction, pagosDeClienteAction } from './actions';
import { atajar } from './sin-red';
import { CuentaDeMaKo, type CuentasProp, type MiembroDeCliente, type AltaPedida } from './CuentaDeMaKo';
import { ResumenCliente, LlamadasCliente, PagosCliente, HistorialCliente, type DatosCrm } from './FichaPestanas';
import { FichaEntrega, type EntregaFicha } from './FichaEntrega';
import { FichaCurso } from './FichaCurso';
import { rutaPlanDeCliente } from './ficha-datos';
import { useFotoCliente } from './foto-cliente';
import { ROTULO_ALTA, ROTULO_ROL, ROLES_ALTA, emailUtilizable, type EstadoAlta, type RolAlta } from '@/lib/agencia-altas';

export function FichaCliente({ c, n, trabajo, user, clientes, cuentas, entrega, tabInicial, onImagen, onCerrar }: {
  c: ClienteCruce;
  /** Los productos, en cuáles está y cómo moverlo (la cabecera). Sin servicios —o con la
   *  lectura de la entrega caída— no se dibuja nada: el banner de la página ya lo dice. */
  entrega?: EntregaFicha;
  /** Su número de cliente. NO es el id del lead. */
  n: number;
  /** SU trabajo, leído y MAPEADO por el server. `null` = no se pudo leer. */
  trabajo: TrabajoDeCliente | null;
  user: BoardUser;
  clientes: ClienteRef[];
  /** Si este workspace es una agencia (`visible`), en qué estado está la cuenta de cada
   *  cliente y su equipo. Sin `visible`, la ficha no dibuja nada de cuentas ni de equipo. */
  cuentas?: CuentasProp;
  /** Con qué tab abre. `null` (o una que esta ficha no tiene) = Resumen. Lo usa «Ver su
   *  equipo» de la tarjeta. */
  tabInicial?: string | null;
  /** Cambió su foto o su portada. Lo persiste el padre, que es el que tiene la lista. */
  onImagen: (cambio: { avatarUrl?: string | null; portada?: string | null; portadaY?: number | null; avatarY?: number | null; icono?: string | null }) => void;
  onCerrar: () => void;
}) {
  const router = useRouter();
  /** El BOTÓN de la portada, no un booleano: de él cuelga el popover (ver PortadaPicker). */
  const [anclaPortada, setAnclaPortada] = useState<HTMLElement | null>(null);
  /** El reposicionador de la PORTADA. El de la foto de perfil vive adentro de su
   *  selector, porque ahí el encuadre se ve sobre el círculo y no sobre la banda. */
  const repo = useReposicionar(c.portadaY, (y) => onImagen({ portadaY: y }));
  /** El selector de la FOTO/ícono del cliente. Cuelga del avatar, igual que el de
   *  portada cuelga de su botón. */
  const [anclaFoto, setAnclaFoto] = useState<HTMLElement | null>(null);

  /**
   * SU EQUIPO: las personas que entran a la cuenta de MaKo de este cliente.
   *
   * ⚠️ VIENE CON EL HTML y filtrado por el SERVER (`equipoPorWs` en page.tsx, sólo los
   * `cliente_ws` aprobados). No se pide al abrir el modal por lo mismo que el tablero:
   * un modal que consulta al abrirse tiene estado de carga por más rápida que sea la
   * consulta, y esta ficha se sacó ese cartel de encima a propósito.
   */
  const equipo = c.clienteWs ? cuentas?.equipoPorWs?.[c.clienteWs] : undefined;
  /** Lo que esta agencia ya pidió sumar acá, en los tres estados (mig 0178). */
  const altas = c.clienteWs ? cuentas?.altasPorWs?.[c.clienteWs] : undefined;
  /**
   * ⚠️ TODO LO DE CUENTAS Y EQUIPO CUELGA DE `cuentas.visible`, Y `visible` ES «ESTE
   * WORKSPACE ES UNA AGENCIA» (page.tsx, 05/10/2026). «La tab de "Equipo" y en general todo
   * lo que tenga que ver con invitar a MaKo, debería solo verse si la cuenta es AGENCIA,
   * sino, no deberían estar esas opciones.» De acá cuelgan la tab «Equipo», «Pedir sumar…»
   * y «Sumar a alguien»; «Inspeccionar» / «Abrir cuenta» lo cortan adentro de CuentaDeMaKo
   * con el mismo flag. Un solo flag para todo: con uno por control, el día que se corrija
   * uno quedan los otros dibujándose donde no van.
   *
   * ⚠️ Y SIGUE SIENDO LA MISMA FICHA PARA TODOS LOS QUE MIRAN, que es la otra mitad de lo
   * que se decidió el 29/09 (ver abajo): `visible` pregunta por el WORKSPACE, no por la
   * persona. La agencia y el super admin parados en ella ven las mismas tabs; en un
   * cliente común no las ve nadie — tampoco el super admin, que antes las veía porque el
   * flag era `esSuper || esAg`.
   */
  const verCuentas = Boolean(cuentas?.visible);

  /**
   * ¿Puede PEDIR sumar a alguien?
   *
   * ⚠️ CUATRO CONDICIONES Y LAS CUATRO SON DISTINTAS: que este workspace sea una agencia
   * (`verCuentas`), que quien mira sea admin de ella (`puedePedirAltas`), que NO sea el
   * super admin —él suma directo, y pedirse permiso a sí mismo no es nada— y que este
   * cliente esté APROBADO. Y ninguna protege: el server las vuelve a hacer contra la base
   * en cada request. Acá sólo deciden si se dibuja.
   */
  const puedePedir = Boolean(
    verCuentas && c.clienteWs && cuentas?.puedePedirAltas && !cuentas.superAdmin
    && cuentas.estadoPorWs[c.clienteWs] === 'aprobado',
  );

  /**
   * SUMAR DIRECTO: el super admin no pide, crea — y esta ficha es el único lugar desde
   * el que mira el equipo de un cliente de una agencia.
   *
   * ⚠️ ES EL COMPLEMENTO DE `puedePedir`, NO SU COPIA. Los dos terminan en una persona
   * adentro de la cuenta, pero por caminos distintos y con consecuencias distintas: el
   * de la agencia deja un pedido esperando una firma, y éste la crea y le manda el
   * acceso en el acto. Por eso son dos endpoints, dos botones y dos frases.
   *
   * El pedido que lo motivó: «¿de qué sirve que tenga una tab de equipo que no puede
   * hacer nada? Ahí deberían poder agregarle setter o closer» (29/09/2026), mirando
   * justamente un cliente con cero usuarios. Y como todo lo de equipo, sólo adentro de
   * una agencia: `superAdmin` elige la PUERTA, no el permiso de ver.
   */
  const puedeSumar = Boolean(verCuentas && c.clienteWs && cuentas?.superAdmin);

  /**
   * LA FILA DE TABS DE LA FICHA, Y ES LA ÚNICA.
   *
   * ⛔ El 29/09/2026 se fue una segunda fila —«Tablero | Equipo»— que vivía arriba del
   * selector del tablero, a 8 px: «soluciona lo de la tab del tablero y equipo, ya
   * habíamos hablado de eso». Ese día «Equipo» pasó a ser una vista más del selector del
   * board (`vistaExtra`). El 05/10 la fila cambió de dueño: el tablero se monta con
   * `soloVista="prioridades"` —sin su selector— y la ficha dibuja la suya. Una fila, como
   * se pidió las dos veces; lo que no puede volver es una arriba de la otra.
   *
   * ⚠️ «Equipo» NO SE CONDICIONA POR LO QUE TENGA ADENTRO NI POR QUIÉN MIRA, que fue lo
   * más grave del 29/09: con `hayEquipo`, a la agencia le aparecía (podía «Pedir sumar») y
   * al super admin no (`puedePedir` lleva `!cuentas.superAdmin`), así que en un cliente
   * con CERO usuarios la tab desaparecía sólo para él — y lo que no veía, «no hay nadie
   * adentro», era lo que más le importaba. Ahora cuelga sólo de `verCuentas`, que es del
   * workspace.
   */
  const pestanas: Tab[] = [
    { id: 'resumen', label: 'Resumen' },
    // ⚠️ EL ID SIGUE SIENDO `prioridades` aunque el rótulo diga «Tareas»: es la VISTA del
    // tablero que se monta adentro (`soloVista`), y `tabInicial` la puede pedir por id.
    { id: 'prioridades', label: 'Tareas' },
    { id: 'curso', label: 'Curso' },
    { id: 'pagos', label: 'Pagos' },
    // El badge cuenta lo que hay sin tener que entrar. `undefined` (no se pudo leer) no
    // dibuja número: un 0 ahí afirmaría que nunca habló con su cliente.
    { id: 'llamadas', label: 'Llamadas', badge: c.ficha?.llamadas?.length },
    { id: 'historial', label: 'Historial' },
    ...(verCuentas ? [{ id: 'equipo', label: 'Equipo', badge: equipo?.length }] : []),
  ];
  const existe = (id: string | null | undefined): id is string => pestanas.some((p) => p.id === id);
  /** `tabInicial` es un pedido, no una orden: «Ver su equipo» sobre un workspace que no es
   *  agencia no tiene a dónde ir, y cae en Resumen en vez de abrir una pantalla en blanco. */
  const [pestana, setPestana] = useState<string>(() => (existe(tabInicial) ? tabInicial : 'resumen'));
  const activa = existe(pestana) ? pestana : 'resumen';
  /**
   * Las tabs que ya se abrieron, y QUEDAN MONTADAS (escondidas) al cambiar de tab.
   *
   * ⚠️ NO ES PARA AHORRAR UN RENDER: el tablero inicializa su estado de las props UNA vez
   * (`useBoard`), y lo que se edita adentro se guarda en el server sin volver a las props de
   * esta página. Desmontarlo al cambiar de tab y volver lo reconstruiría con las filas de
   * cuando se abrió la ficha: la tarea que se acaba de completar volvería abierta, sin un
   * error — se leería como que no se guardó. (Razonado sobre `useState(initialTasks)` de
   * useBoard, no medido: medirlo es completar una tarea de un cliente real.) Y montarlas
   * recién al entrar es lo que hace que abrir la ficha en Resumen no pague el tablero entero.
   *
   * ⚠️ Por lo mismo, los NÚMEROS del Resumen son los de cuando se abrió la ficha: salen de
   * las props (`trabajo`), no del estado del tablero. Se ponen al día con el próximo
   * `router.refresh()` o al volver a abrirla.
   */
  const [abiertas, setAbiertas] = useState<ReadonlySet<string>>(() => new Set([activa]));
  const cambiarPestana = (id: string) => {
    setPestana(id);
    setAbiertas((s) => (s.has(id) ? s : new Set([...s, id])));
  };

  /**
   * Lo que leen Pagos e Historial: UNA lectura, la primera vez que se abre cualquiera de
   * las dos. Abrir la ficha en Resumen no la paga.
   */
  const [crm, setCrm] = useState<DatosCrm | null>(null);
  const pideCrm = abiertas.has('pagos') || abiertas.has('historial');
  useEffect(() => {
    if (!pideCrm || crm !== null) return;
    setCrm('cargando');
    // Por `atajar` (./sin-red.ts), como toda acción de esta ficha y de ClientesApp: un
    // `.catch` a mano por llamada es la regla escrita en los call sites que existían.
    void atajar(pagosDeClienteAction(c.leadId), 'No pude leer sus datos.').then(setCrm);
  }, [pideCrm, crm, c.leadId]);

  /** Renombrar al cliente o cambiarle la empresa. ⚠️ Escribe en `leads`, o sea en el
   *  CRM: no hay tabla de clientes, un cliente es un lead ganado. */
  function guardarDatos(cambio: { nombre?: string; empresa?: string | null }) {
    setMal('');
    // ⚠️ SIN RED LA PROMESA RECHAZA, y sin `atajar` el `.then` no corría: el «no se guardó»
    // de abajo nunca llegaba al banner. No tumbaba la pantalla (esto no va en una
    // transición), pero era exactamente el silencio que este handler existe para evitar.
    void atajar(guardarDatosClienteAction(c.leadId, cambio), 'No se pudo guardar.').then((r) => {
      // ⚠️ SE AVISA SI NO SE GUARDÓ. Un campo que se edita en el lugar y falla en
      // silencio es peor que uno que no se puede editar: quien lo escribió se va
      // creyendo que quedó, y lo descubre al recargar.
      if (!r.ok) { setMal(r.error); return; }
      router.refresh();
    });
  }
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [mal, setMal] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const nombre = c.nombre.trim() || 'Sin nombre';
  const color = colorDe(nombre);
  /** Su WhatsApp o su email, si nadie le eligió una foto (./foto-cliente.ts). */
  const fotoAuto = useFotoCliente(c);
  const clienteFijo = { leadId: c.leadId, nombre };
  /** Al Plan, NO a una copia: con el filtro de este cliente puesto y en Tareas. Va con el
   *  `Link` de la casa, que preserva el `?ws=` — sin eso el super admin terminaría en SU
   *  plan y no en el de este cliente. */
  const verEnPlan = <Link className="fc-plan" href={rutaPlanDeCliente(c.leadId)}>Ver en el Plan →</Link>;

  /** La foto sube por el mismo route multipart que las portadas y se aplica sola: una
   *  imagen subida que después hay que elegir es un paso de más. */
  async function subirFoto(f: File) {
    setSubiendoFoto(true);
    setMal('');
    try {
      const fd = new FormData();
      fd.append('file', f);
      const r = await fetch('/api/portadas', { method: 'POST', body: fd });
      const j: { ok: boolean; url?: string; error?: string } = await r.json();
      if (!j.ok || !j.url) { setMal(j.error || 'No pude subir la foto.'); return; }
      onImagen({ avatarUrl: j.url });
    } catch (e) {
      setMal(e instanceof Error ? e.message : String(e));
    } finally {
      setSubiendoFoto(false);
    }
  }

  return (
    <Modal
      titulo={
        <span className="fc-cab">
          {/* LA PORTADA. `fondoPortada` decide si es una foto, un degradado del catálogo o
              —el default— el color derivado del nombre. La misma función pinta la tarjeta
              de la grilla, así que las dos no se pueden separar.

              ⚠️ LOS CONTROLES VAN ARRIBA A LA DERECHA Y AL HOVER, como los de Notion
              («donde hoy está Ver en el CRM debería estar Portada y Reposicionar y el
              ícono de descargar», 27/09/2026). El intento anterior —un solo botón al
              centro— no tenía dónde poner un segundo verbo: «cambiar» y «acomodar» son
              dos acciones sobre la misma imagen y un botón centrado sólo aguanta una. */}
          <span className="fc-portada">
            {/* ⚠️ UN SOLO `style`: el del fondo y el del cursor se fusionan acá. Con dos
                atributos gana el último y el `background` se perdía — TypeScript lo avisa
                («specified more than once»), pero en JSX plano sería mudo. */}
            <span className="fc-banda" aria-hidden ref={repo.props.ref}
              onPointerDown={repo.props.onPointerDown} onPointerMove={repo.props.onPointerMove}
              onPointerUp={repo.props.onPointerUp} onPointerCancel={repo.props.onPointerCancel}
              style={{ background: fondoPortada(c.portada, color, c.portadaY), ...repo.props.style }} />
            {repo.activo
              ? <BarraReposicion onGuardar={repo.guardar} onCancelar={repo.cancelar} />
              : (
                <span className="fc-acciones">
                  {/* INTERRUPTOR: el segundo click lo cierra. El popover excluye a su ancla
                      del click-afuera justamente para que esto se decida acá. */}
                  <button type="button" className="fc-pill"
                    onClick={(e) => { const b = e.currentTarget; setAnclaPortada((a) => (a ? null : b)); }}>
                    {c.portada ? 'Portada' : 'Poner portada'}
                  </button>
                  {/* ⚠️ SÓLO CON UNA FOTO. Un degradado no se puede acomodar —no hay
                      imagen que mover— y un botón que no puede hacer nada se lee como que
                      la app está rota. Es la misma regla que «Quitar la foto», que existía
                      sólo cuando había una. */}
                  {esFoto(c.portada) && (
                    <button type="button" className="fc-pill" onClick={repo.empezar}>Reposicionar</button>
                  )}
                  {esFoto(c.portada) && (
                    <a className="fc-pill fc-icono" href={urlPortada(c.portada) ?? '#'}
                      download target="_blank" rel="noreferrer"
                      title="Descargar la portada" aria-label="Descargar la portada">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 3v12" /><path d="m7 11 5 5 5-5" /><path d="M5 21h14" />
                      </svg>
                    </a>
                  )}
                </span>
              )}
          </span>
          <span className="fc-fila">
            {/* ⚠️ EL AVATAR ABRE EL SELECTOR, NO EL DIÁLOGO DE ARCHIVOS. Antes iba
                derecho a «elegir un archivo», que es UNA de las cuatro cosas que se
                pueden hacer con la marca de un cliente —subir, elegir un ícono, poner
                un emoji, sacarla— y encima no dejaba encuadrarla. Es el MISMO pop-up
                que el del ícono de un proyecto, a pedido. */}
            <button type="button" className="fc-av"
              onClick={(e) => { const b = e.currentTarget; setAnclaFoto((a) => (a ? null : b)); }}
              title="Cambiar la foto" aria-label={`Cambiar la foto de ${nombre}`}>
              <Marca icono={c.icono ?? c.avatarUrl} foto={fotoAuto} nombre={nombre} tam={88} y={c.avatarY} color={color} />
              <span className="fc-avcap">{subiendoFoto ? '…' : 'Foto'}</span>
            </button>
            <span className="fc-txt">
              <span className="nom">
                {/* ⚠️ EL NOMBRE ES TEXTO, NO UN INPUT. «Solo clickeando y escribiendo,
                    como los títulos o las descripciones de la tarea, que no parezca que
                    haya un recuadro de texto» (27/09/2026) — que es la misma regla que
                    ya gobierna el título de una tarjeta: sin borde, sin fondo, sin radio
                    y sin padding propio. Lo que dice que se edita es el `cursor: text`,
                    el `title` y el placeholder.
                    ⚠️ Y ESTO RENOMBRA EN EL CRM: no hay tabla de clientes, un cliente es
                    un lead ganado. Son la misma persona y es lo correcto, pero no es un
                    apodo de esta pantalla. */}
                <EditableInline
                  valor={nombre}
                  placeholder="Sin nombre"
                  titulo="Edita el nombre del cliente"
                  className="fc-ed fc-ed-nom"
                  onGuardar={(v) => guardarDatos({ nombre: v })} />
                {/* ⚠️ «CRM →» PASÓ A ESTAR ACÁ, PEGADO AL NOMBRE. Arriba a la derecha
                    competía con los controles de la imagen, que es lo que esa esquina
                    tiene que ofrecer ahora. Y pegado al nombre dice mejor a QUÉ lleva:
                    al CRM de esta persona, no al CRM. */}
                <Link href={`/crm/${c.leadId}`} className="fc-crm">CRM →</Link>
              </span>
              <span className="sub">
                {/* La empresa SÍ puede quedar vacía: es un dato opcional de verdad, y
                    con el campo en blanco el placeholder invita a completarlo. Por eso
                    «Cliente N» dejó de ser su reemplazo y pasó a estar siempre al lado:
                    antes aparecía sólo cuando NO había empresa, así que el número de
                    cliente se perdía justo en las fichas que sí la tenían. */}
                <EditableInline
                  valor={c.empresa ?? ''}
                  placeholder="Agrega la empresa"
                  titulo="Edita la empresa"
                  className="fc-ed fc-ed-sub"
                  onGuardar={(v) => guardarDatos({ empresa: v })} />
                <span className="id"> · Cliente {n}</span>
                {/* Becado (#747): cliente, no venta. Una palabra, sin control: se cambia en el CRM. */}
                {c.sinCobro && <span className="id"> · Sin cobro</span>}
              </span>
            </span>
            {/* ⛔ ACÁ ESTABA «Quitar la foto», y se fue (27/09/2026). Sacar la foto es una
                de las cosas que se hacen CON la foto, así que vive donde están todas las
                demás: adentro del selector que abre el avatar. Un verbo suelto al lado del
                nombre, para una sola de las cuatro acciones posibles, era la mitad de un
                control — y encima aparecía y desaparecía según hubiera foto. */}
            {/* Y ACÁ VIVE AHORA «Inspeccionar». Bajó de una caja propia arriba del
                tablero a ser el tercer hijo de esta fila: «a la misma altura pero
                alineado a la derecha, sutil». No hace falta empujarlo —`.fc-txt`
                declara `flex:1` y él `flex:none`— ni alinearlo: `.fc-fila` alinea
                por la BASE, así que queda a la altura del renglón del nombre solo. */}
            {/* EL PRODUCTO Y LA ETAPA, a la derecha como en la cabecera del CRM. */}
            {entrega && entrega.servicios.length > 0 && <FichaEntrega leadId={c.leadId} nombre={nombre} e={entrega} />}
            <CuentaDeMaKo c={c} cuentas={cuentas} onError={setMal} />
          </span>
        </span>
      }
      etiqueta={nombre}
      ancho={ANCHO}
      /* ⚠️ FIJO, no topado: adentro vive un tablero y cada vista trae lo suyo. Ver el
         porqué largo en el prop `alto` de `Modal`. El valor es el MISMO tope que la hoja
         ya aplicaba, así que la ficha llena se ve igual que antes — lo que cambia es que
         la vacía ya no encoge. */
      alto="min(85vh, 720px)"
      /* ⚠️ ADENTRO VIVE EL TABLERO, Y EL TABLERO ABRE SUS PROPIOS MODALES. Sin esto la pila
         apaga esta ficha con `display:none` en cuanto se abre uno —y como ese modal es un
         DESCENDIENTE suyo, se apaga con ella: click en una tarea = pantalla en blanco.
         Medido el 27/09/2026 (ver `contenedores` en app/_components/pila-modales.ts). */
      contenedor
      onCerrar={onCerrar}
    >
      {/* ⚠️ UN SOLO HIJO DIRECTO DEL CUERPO. El cuerpo del modal le pone padding y un
          filete arriba a cada hijo directo después del primero (ui.css): con la fila de
          tabs y cada panel sueltos, el panel visible dibujaba una raya debajo de la de las
          tabs — dos líneas a 18 px. Adentro de este envoltorio, la única raya es la de las
          tabs. */}
      <div className="fc-cuerpo">
        {mal && <p className="fc-mal">{mal}</p>}

        <Tabs tabs={pestanas} activa={activa} onCambio={cambiarPestana} />

        <Panel id="resumen" activa={activa} abiertas={abiertas}>
          <ResumenCliente c={c} />
        </Panel>

        <Panel id="prioridades" activa={activa} abiertas={abiertas}>
          {!trabajo ? (
            // «No pude leer» no se pinta como «no tiene trabajo»: son dos pantallas, y la
            // segunda sobre la primera es la mentira que nadie audita. El equipo ya no
            // depende de esto: vive en su propia tab.
            <p className="fc-mal">No pude leer su tablero. Vuelve a entrar a Clientes.</p>
          ) : trabajo.dueno ? (
            // ⚠️ `onRecargar` ES OBLIGATORIO ACÁ. El tablero recarga la página entera después
            // de una cascada de prioridad y al aplicar un borrador de reunión. Desde el
            // 06/10/2026 la ficha abierta viaja en `?cliente=` y un reload la vuelve a abrir —
            // pero en Resumen, con las tabs abiertas desmontadas y el tablero rearmado desde
            // cero. `router.refresh()` revalida el render del server (de donde salen estas
            // filas) sin desmontar el árbol del navegador.
            //
            // ⚠️ `soloVista="prioridades"`: sin su selector. Las otras tres vistas del
            // tablero se miran en el Plan («Ver en el Plan», donde el tablero tenía su «⋮»),
            // y con el selector puesto volvería a haber dos filas de tabs.
            <PlanBoard user={user} tareas={trabajo.tareas} proyectos={trabajo.proyectos}
              vacio={false} clientes={clientes} clienteFijo={clienteFijo} embebido
              soloVista="prioridades" accionEnLugarDelMenu={verEnPlan}
              onRecargar={() => router.refresh()} />
          ) : (
            <TodoBoard tareas={trabajo.tareas} categorias={trabajo.categorias} demo={false}
              user={user} clientes={clientes} clienteFijo={clienteFijo} embebido
              soloVista="prioridades" accionEnLugarDelMenu={verEnPlan}
              onRecargar={() => router.refresh()} />
          )}
        </Panel>

        {/* EL CURSO lee lo suyo al abrirse (una action), y relee si lo mueven de etapa desde
            la cabecera: por eso recibe la misma `entrega` que FichaEntrega. */}
        <Panel id="curso" activa={activa} abiertas={abiertas}>
          <FichaCurso leadId={c.leadId} entrega={entrega} />
        </Panel>

        <Panel id="pagos" activa={activa} abiertas={abiertas}>
          {/* Lo que la tarjeta del Deal ya escribió se aplica a `crm`, que se leyó una vez:
              el refresh no lo vuelve a leer (ver `PagosCliente`). */}
          <PagosCliente datos={crm ?? 'cargando'}
            onCambio={(patch) => setCrm((d) => (d && d !== 'cargando' && d.ok ? { ...d, lead: { ...d.lead, ...patch } } : d))} />
        </Panel>

        <Panel id="llamadas" activa={activa} abiertas={abiertas}>
          <LlamadasCliente llamadas={c.ficha?.llamadas} />
        </Panel>

        <Panel id="historial" activa={activa} abiertas={abiertas}>
          <HistorialCliente leadId={c.leadId} datos={crm ?? 'cargando'} />
        </Panel>

        {verCuentas && (
          <Panel id="equipo" activa={activa} abiertas={abiertas}>
            <EquipoDelCliente nombre={nombre} equipo={equipo ?? []} altas={altas ?? []}
              clienteWs={c.clienteWs ?? null} puedePedir={puedePedir} puedeSumar={puedeSumar}
              onError={setMal} onPedido={() => router.refresh()} />
          </Panel>
        )}
      </div>

      {/* El selector cuelga del botón de la portada y se queda abierto al elegir: la
          gracia es ver la banda cambiar detrás (ver la cabecera de PortadaPicker). Se
          registra en la pila como `anidada`, así que la ficha se sigue viendo y el Escape
          cierra sólo el panel. */}
      {anclaFoto && (
        <IdentidadPicker
          icono={c.icono ?? c.avatarUrl}
          y={c.avatarY}
          ancla={anclaFoto}
          titulo={`Foto de ${nombre}`}
          onElegir={(cambio) => {
            // ⚠️ SE ESCRIBE `icono` Y SE LIMPIA `avatar_url`, o quedan dos respuestas a
            // «¿qué se ve en el redondel?» y gana la que el código mire primero.
            // `avatar_url` sigue existiendo para lo que ya está guardado: `Marca` la lee
            // como respaldo, y en cuanto alguien elige algo acá deja de competir.
            //
            // ⚠️ Y EL EMOJI DE UN CLIENTE VA EN `icono`, no en una columna propia: un
            // lead no tiene `emoji` y no tiene ninguno de los consumidores de texto que
            // hacen que en un PROYECTO eso sea un error. Ver `glifoDeIcono`.
            // ⚠️ NO SE BORRA `avatar_url`, Y ESTO ES UN ARREGLO. La primera versión
            // mandaba `avatarUrl: null` para que el emoji ganara — y `icono` ya le
            // gana por precedencia en `Marca`, así que lo único que lograba era
            // DESTRUIR la URL de la foto: «Quitar» dejaba al cliente en iniciales y
            // no había forma de volver. Pasó en producción probando esto: le borré la
            // foto a un cliente real eligiendo un emoji, y hubo que ir a buscar el
            // archivo al bucket para reponerla. Conservándola, «Quitar» —que limpia
            // `icono`— devuelve la foto que había.
            if (cambio.emoji !== undefined) onImagen({ icono: cambio.emoji ? `emoji:${cambio.emoji}` : null, avatarY: null });
            else if (cambio.icono !== undefined) onImagen({ icono: cambio.icono, avatarY: cambio.y ?? null });
            else if (cambio.y !== undefined) onImagen({ avatarY: cambio.y });
          }}
          onCerrar={() => setAnclaFoto(null)} />
      )}

      {anclaPortada && (
        <PortadaPicker
          valor={c.portada}
          colorBase={color}
          ancla={anclaPortada}
          titulo={`Portada de ${nombre}`}
          onElegir={(v) => onImagen({ portada: v })}
          onCerrar={() => setAnclaPortada(null)}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: CSS }} />
    </Modal>
  );
}

/** Una tab de la ficha. Se monta la primera vez que se abre y queda montada, escondida,
 *  cuando se pasa a otra: ver por qué en `abiertas`. */
function Panel({ id, activa, abiertas, children }: {
  id: string; activa: string; abiertas: ReadonlySet<string>; children: ReactNode;
}) {
  if (!abiertas.has(id)) return null;
  return <div role="tabpanel" className="fc-panel" hidden={activa !== id}>{children}</div>;
}

/**
 * ⚠️ CASI TODA LA PANTALLA, y no los 600 de la casa. El Kanban tiene cuatro columnas: la
 * regla del ancho de `Modal` es para TEXTO —la medida de lectura— y acá adentro va el
 * tablero. `Modal` topea en el viewport, así que en una pantalla chica no desborda.
 */
const ANCHO = 1560;

const CSS = `
/* ⚠️ LA CABECERA DEL MODAL SE CONVIERTE EN LA PORTADA, y por eso se le saca el padding,
   el gap y el filete. Con el padding puesto, fc-cab sólo podía reclamar los 24 px de los
   costados con un margen negativo — y quedaban afuera el gap de 16 y los 32 del botón de
   cerrar, o sea los 48 px de la derecha que se reportaron como «el banner se corta a la
   derecha» (26/09/2026). Acertarle con un margen negativo mayor sería adivinar una suma
   que cambia el día que alguien toque ui.css; sacar el padding no tiene casos.
   (Y sin comillas invertidas acá adentro: esto vive en un template literal y una sola
   cerraría la hoja a la mitad — AGENTS.md lo tiene medido, deja la pantalla en blanco.) */
.mk-modal__cab:has(.fc-cab){ position:relative; padding:0; gap:0; border-bottom:0; align-items:stretch; }
.mk-modal__cab:has(.fc-cab) .mk-modal__tit{ gap:0; }
.mk-modal__h:has(.fc-cab){ align-self:stretch; }
/* El botón de cerrar sale del flujo y flota sobre la portada, que es lo que deja que la
   banda llegue a los dos bordes. Fondo propio: abajo puede haber una foto clara. */
/* ⚠️ CERRAR SE TIENE QUE VER DISTINTO DE LAS ACCIONES. «Que el botón de cerrar sea
   diferente a los otros, sino, confunde» (27/09/2026): eran cuatro pastillas oscuras
   translúcidas en fila y la última cerraba la ficha entera. Dos cosas lo separan
   ahora: es un CÍRCULO sólido y no una pastilla, y vive en otra esquina — las
   acciones se fueron abajo a la derecha. La forma distingue mejor que el color:
   sobre una foto cualquiera, dos grises translúcidos se ven iguales. */
.mk-modal__cab:has(.fc-cab) .mk-modal__x{ position:absolute; top:12px; right:12px; z-index:4;
  width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center;
  background:rgba(18,21,27,.82); color:#fff; border-radius:999px; padding:0;
  box-shadow:0 1px 6px rgba(18,21,27,.30); }
.mk-modal__cab:has(.fc-cab) .mk-modal__x:hover{ background:#12151b; color:#fff; }

.fc-cab{ display:block; position:relative; }
/* Bien estirada («está muy angosto, debería ser más estirado»): 140 px sobre 1560 de
   ancho. Una foto de portada se lee como una banda, no como una tarjeta. */
.fc-portada{ display:block; position:relative; }
.fc-banda{ display:block; height:160px; width:100%; }

/* EL BOTÓN DE LA PORTADA: al centro y sólo al pasar el cursor, igual que el de la foto.
   Aparece también con el foco del teclado — un control que sólo existe con el mouse no
   existe para quien navega con Tab. */
.fc-cambiar{ position:absolute; left:50%; top:50%; transform:translate(-50%,-50%);
  background:rgba(20,22,26,.52); border:0; border-radius:999px; padding:8px 16px;
  font:inherit; font-size:12.5px; font-weight:500; color:#fff; cursor:pointer;
  white-space:nowrap; opacity:0; transition:opacity .12s; backdrop-filter:blur(3px); }
.fc-portada:hover .fc-cambiar{ opacity:1; }
.fc-cambiar:focus-visible{ opacity:1; outline:2px solid #fff; outline-offset:2px; }
.fc-cambiar:hover{ background:rgba(20,22,26,.72); }

/* Los controles de la imagen: arriba a la derecha, a la altura del botón de cerrar, y
   SÓLO al pasar el cursor. Un grupo de tres botones permanente sobre una foto compite
   con la foto; apareciendo al hover no le saca lugar a nada hasta que hace falta.
   Aparecen también con el foco del teclado — un control que sólo existe con el mouse
   no existe para quien navega con Tab. */
/* ⚠️ ABAJO A LA DERECHA DE LA PORTADA, no al lado del botón de cerrar. Es donde las
   pone Notion y es lo que se pidió — y además resuelve la confusión de arriba sin
   depender del color: cerrar vive en una esquina y editar en la otra. */
.fc-acciones{ position:absolute; right:14px; bottom:12px; z-index:3; display:flex; gap:6px;
  opacity:0; transition:opacity .12s; }
.fc-portada:hover .fc-acciones, .fc-acciones:focus-within{ opacity:1; }
/* Pastilla CLARA: la otra mitad de distinguirla del botón de cerrar, que es un
   círculo oscuro sólido. Sobre una foto clara el vidrio blanco sigue leyéndose
   gracias al borde y a la sombra. */
.fc-pill{ background:rgba(255,255,255,.90); border:0; border-radius:999px; padding:6px 13px;
  font:inherit; font-size:12.5px; font-weight:600; color:#16181d; cursor:pointer;
  text-decoration:none; white-space:nowrap; backdrop-filter:blur(6px);
  box-shadow:0 1px 4px rgba(18,21,27,.18); }
.fc-pill:hover{ background:#fff; color:#16181d; }
.fc-pill:focus-visible{ outline:2px solid var(--primary); outline-offset:2px; }
/* El de descargar es un ícono solo: cuadrado, para que no se lea como un botón de
   texto al que se le perdió el texto. Su nombre va en el title y en el aria-label. */
.fc-icono{ display:inline-flex; align-items:center; justify-content:center;
  width:30px; height:28px; padding:0; }

/* «CRM →» al lado del nombre: tinta, no píldora. Acá abajo ya no hay una foto que
   tape, así que un botón oscuro sería un parche de color en medio de una línea de
   texto. */
.fc-crm{ margin-left:10px; font-size:12.5px; font-weight:600; color:var(--primary);
  text-decoration:none; white-space:nowrap; vertical-align:middle; }
.fc-crm:hover{ text-decoration:underline; }
/* «Ver en el Plan», en el lugar del «⋮» del tablero: un botón con borde y del mismo alto
   que los controles de esa fila, para que no se lea como un link suelto en una barra. */
.fc-plan{ flex:none; display:inline-flex; align-items:center; height:38px; padding:0 14px;
  border:1px solid var(--border-strong); border-radius:9px; background:var(--surface);
  font-size:13px; font-weight:600; color:var(--primary); text-decoration:none; white-space:nowrap; }
.fc-plan:hover{ border-color:var(--primary); }

/* ⚠️ EL AVATAR MONTA SOBRE LA BANDA; EL NOMBRE, NO. Con un margin-top negativo en la
   fila entera sube TODO —avatar y texto—, y el nombre queda escrito sobre la foto: con un
   degradado claro se leía, con una foto de un bosque no. Va absoluto porque la cuenta es
   exacta (140 de banda − 31 de monte = 62/2) y no depende del alto del texto, que cambia
   con el nombre. El padding izquierdo de la fila le deja su lugar. */
/* ⚠️ MENOS AIRE ABAJO DEL NOMBRE. «No debería haber tanto espacio blanco entre el
   nombre del cliente y la tab de tareas» (27/09/2026): eran 14 de esta fila MÁS el
   padding propio del cuerpo del modal, y los dos se suman sin que ninguno parezca
   grande por separado. Se recorta acá, que es el que existe para esta pantalla; el
   del cuerpo lo comparten otras 25. */
.fc-fila{ display:flex; align-items:flex-end; gap:14px; padding:10px 24px 4px 128px; min-height:40px; }
.mk-modal__cab:has(.fc-cab) + .mk-modal__cuerpo{ padding-top:6px; }
/* ⚠️ Y EL PRIMER HIJO DEL CUERPO PIERDE SU PADDING DE BLOQUE. La regla de bloque del
   cuerpo del modal le pone 18 px arriba a cada hijo directo para separar bloques de
   texto — correcto cuando el contenido son bloques, y acá el único hijo es el TABLERO
   ENTERO. Medido nivel por nivel en Chrome: 6 del cuerpo + 18 de esa regla + 20 del
   header del tablero = 44 px de blanco entre el nombre y las tabs. Ninguno de los tres
   parece grande solo, que es por qué se reportó dos veces y la primera pasada tocó el
   más chico de los tres. Es la misma familia que el hallazgo de la regla de hijo
   directo pisando a un overlay anidado.
   (Y sin comillas invertidas acá adentro: esto vive en un template literal y una sola
   cierra la hoja a la mitad. Es la tercera vez hoy.) */
.mk-modal__cab:has(.fc-cab) + .mk-modal__cuerpo > *:first-child{ padding-top:0; border-top:0; }

/* El nombre y la empresa, editables sin caja. La tipografía la heredan de su
   renglón: el componente no trae ninguna. */
.fc-ed-nom{ font-size:20px; font-weight:670; letter-spacing:-.02em; }
.fc-ed-sub{ font-size:12.5px; font-weight:400; color:var(--dim); }
/* ⚠️ MÁS GRANDE Y CON MARCO. «La foto de perfil debe ser más grande» + «que la rodee
   el marco, como en la preview de la card» (27/09/2026). El anillo es el MISMO que ya
   usa el Avatar de la grilla —unos pocos px del color de la superficie— y acá hace
   falta más que allá: la foto monta sobre la portada, así que sin el aro se funde con
   la imagen. La cuenta del top es exacta: 160 de banda menos 44 (la mitad de 88). */
.fc-av{ position:absolute; left:24px; top:116px; display:block; padding:0; border:0;
  background:none; cursor:pointer; line-height:0; border-radius:999px;
  box-shadow:0 0 0 4px var(--surface), 0 2px 10px rgba(18,21,27,.14); }
/* ⚠️ «Foto» VA AL CENTRO DEL CÍRCULO, no en una banda abajo («el mensaje de Foto más
   centrado, no abajo», 27/09/2026). Pegado al borde inferior tapaba justo el mentón de
   la persona —que es donde el ojo confirma que es ella— y en un círculo de 62 px esa
   banda es el 20% del alto. Al centro y sobre un velo, la foto se sigue leyendo debajo
   y el rótulo dice lo que el click hace. */
.fc-avcap{ position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
  border-radius:999px; background:rgba(20,22,26,.48); color:#fff; font-size:10.5px;
  font-weight:600; letter-spacing:.01em; opacity:0; transition:opacity .12s; }
.fc-av:hover .fc-avcap{ opacity:1; }
.fc-txt{ display:flex; flex-direction:column; gap:1px; min-width:0; flex:1; padding-bottom:4px; }
.fc-txt .nom{ font-size:20px; font-weight:670; letter-spacing:-.02em; line-height:1.2;
  color:var(--ink); overflow-wrap:anywhere; }
.fc-txt .sub{ font-size:12.5px; font-weight:400; color:var(--dim); overflow:hidden;
  text-overflow:ellipsis; white-space:nowrap; }
.fc-txt .id{ color:var(--faint); }

.fc-mal{ margin:16px 2px; font-size:13.5px; color:var(--bad); }
/* Escondida con el atributo, y el important porque cualquier display que alguien le ponga
   a la clase le ganaria al del navegador y la tab escondida volveria a verse debajo. */
.fc-panel[hidden]{ display:none !important; }

.fc-eq{ list-style:none; margin:0; padding:0; }
.fc-eq li{ display:flex; align-items:center; gap:12px; padding:12px 2px;
  border-bottom:1px solid var(--border); }
.fc-eq li:last-child{ border-bottom:0; }
.fc-eq .t{ display:flex; flex-direction:column; gap:1px; min-width:0; flex:1; }
.fc-eq .t b{ font-size:14px; font-weight:600; color:var(--ink);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fc-eq .t span{ font-size:12.5px; color:var(--dim);
  overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.fc-eq .rol{ flex:none; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px;
  background:var(--surface-2); color:var(--dim); }
.fc-eq-nada{ margin:16px 2px; font-size:13.5px; color:var(--faint); }
/* Un pedido todavia no es una persona de la cuenta: se ve, y se ve que no esta. */
.fc-eq li.pend{ opacity:.72; }
.fc-eq .est{ flex:none; font-size:11px; font-weight:600; padding:2px 8px; border-radius:999px;
  background:var(--warn-bg); color:var(--warn); white-space:nowrap; }
.fc-eq .est.mal{ background:var(--bad-bg); color:var(--bad); }

.fc-sumar{ margin-top:14px; border:1px dashed var(--border-strong); background:none;
  border-radius:10px; padding:9px 14px; font:inherit; font-size:13px; font-weight:600;
  color:var(--dim); cursor:pointer; }
.fc-sumar:hover{ color:var(--primary); border-color:var(--primary); }
.fc-pedir{ display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin-top:14px; }
.fc-in{ flex:1 1 180px; min-width:0; border:1px solid var(--border); border-radius:9px;
  padding:9px 11px; font:inherit; font-size:13.5px; background:var(--surface);
  color:var(--ink); }
.fc-sel{ flex:0 0 130px; }
.fc-ok, .fc-no{ flex:none; border-radius:9px; padding:9px 14px; font:inherit; font-size:13px;
  font-weight:600; cursor:pointer; }
.fc-ok{ border:1px solid var(--primary); background:var(--primary); color:#fff; }
.fc-ok:disabled{ opacity:.5; cursor:default; }
.fc-no{ border:1px solid var(--border); background:var(--surface); color:var(--dim); }

@media(prefers-reduced-motion:reduce){ .fc-avcap, .fc-cambiar{ transition:none; } }
`;


/**
 * SU EQUIPO — quiénes entran a la cuenta de MaKo de este cliente.
 *
 * ⚠️ ES UNA LISTA, NO UNA PILA DE TARJETAS: son cosas del mismo tipo, y la regla de la
 * casa es filete, no caja. Y es de SOLO LECTURA a propósito: sumar o sacar gente de un
 * inquilino es una acción de la plataforma (vive en /customer-success del super admin,
 * `EquipoDelCliente` de AdminView), no algo que una agencia hace desde la ficha. Un
 * botón acá abriría una segunda puerta a la misma escritura, con su propio guard que
 * mantener.
 */
function EquipoDelCliente({ nombre, equipo, altas, clienteWs, puedePedir, puedeSumar, onError, onPedido }: {
  nombre: string;
  equipo: MiembroDeCliente[];
  /** Lo que esta agencia pidió. Los pendientes van en la MISMA lista: ver abajo. */
  altas: AltaPedida[];
  clienteWs: number | null;
  /** La agencia PIDE: queda pendiente de una firma. */
  puedePedir: boolean;
  /** El super admin CREA: la persona entra y le llega el acceso en el acto. */
  puedeSumar: boolean;
  onError: (m: string) => void;
  onPedido: () => void;
}) {
  const [pidiendo, setPidiendo] = useState(false);
  const [mandando, setMandando] = useState(false);
  const [email, setEmail] = useState('');
  const [nom, setNom] = useState('');
  const [rol, setRol] = useState<RolAlta>('admin');

  // ⚠️ LOS RECHAZADOS TAMBIÉN SE VEN. Un pedido que desaparece hace indistinguible
  // «se lo rechazaron» de «nunca lo mandé», y la agencia lo vuelve a pedir o se queda
  // esperando una firma que ya se dio. Los aprobados NO: ésos ya son una persona de la
  // lista de arriba, y repetirlos sería contar dos veces a la misma.
  const visibles = altas.filter((a) => a.estado !== 'aprobada');

  /**
   * UNA SOLA FUNCIÓN Y DOS DESTINOS, porque el formulario es el mismo y lo que cambia es
   * quién firma. Escribir dos formularios sería la copia que diverge en la próxima
   * edición — y acá los campos son los mismos tres (email, nombre, rol).
   *
   * ⚠️ `/api/admin/usuarios` CREA Y MANDA EL ACCESO en la misma llamada. No hay paso de
   * aprobación porque el que la llama ES quien aprobaría.
   */
  const pedir = async () => {
    if (!clienteWs || !emailUtilizable(email) || mandando) return;
    setMandando(true);
    onError('');
    try {
      const j = await (await fetch(puedeSumar ? '/api/admin/usuarios' : '/api/agencia/altas', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(puedeSumar
          ? { action: 'crear', email: email.trim(), nombre: nom.trim(), rol: 'usuario', workspace_id: clienteWs, rol_ws: rol }
          : { clienteWs, email: email.trim(), nombre: nom.trim(), rolWs: rol }),
      })).json();
      if (!j?.ok) { onError(j?.error ?? (puedeSumar ? 'No se pudo sumar.' : 'No se pudo pedir.')); return; }
      setEmail(''); setNom(''); setPidiendo(false);
      // `router.refresh()` y no un reload: la ficha abierta viaja en `?cliente=` y un
      // reload la reabriría, pero en Resumen y no en esta tab — se leería como que te sacó.
      onPedido();
    } catch {
      onError('No se pudo pedir.');
    } finally { setMandando(false); }
  };

  // ⚠️ SIN CUENTA NO HAY «NADIE ADENTRO»: NO HAY ADENTRO. Un cliente al que todavía no se le
  // abrió su cuenta de MaKo caía en el vacío de abajo, que dice «esta cuenta no tiene a
  // nadie» — una afirmación sobre una cuenta que no existe. Visto en el navegador el
  // 05/10/2026 sobre un cliente de Código Inmobiliario sin `cliente_ws`. Lo que se hace al
  // respecto («Abrir cuenta») ya está arriba, al lado del nombre. Va DESPUÉS de los hooks.
  if (clienteWs == null) return <p className="fc-eq-nada">Todavía no tiene cuenta de MaKo.</p>;

  return (
    <>
      {equipo.length === 0 && visibles.length === 0 ? (
        /* ⚠️ «NADIE MÁS» DECÍA LO CONTRARIO DE LO QUE PASA. Acá la lista vacía significa
           CERO personas —ni siquiera el dueño de la cuenta— y «nadie más entra a la
           cuenta de Brigitte» se lee como que Brigitte sí entra y nadie la acompaña. El
           dueño lo reportó así: «pareciera que se bugeó y que la propia Brigitte no
           puede entrar». Y no es un matiz: es exactamente el estado que dejó el alta sin
           email del 28/09, y el que hay que poder ver de un vistazo.
           («Todavía nadie» y «no lo pude leer» siguen siendo dos cosas distintas: acá la
           lista viene con el HTML y filtrada por el server, así que vacía es vacía.) */
        <p className="fc-eq-nada">
          Esta cuenta todavía no tiene a nadie adentro, así que <b>no puede entrar nadie</b>
          {puedeSumar || puedePedir ? '. Suma a la persona que la va a usar.' : '.'}
        </p>
      ) : (
        <ul className="fc-eq">
          {equipo.map((u) => (
            <li key={u.id}>
              <Marca icono={null} foto={u.foto} nombre={u.nombre} tam={34} color={colorDe(u.nombre)} />
              <span className="t"><b>{u.nombre}</b><span>{u.email}</span></span>
              <span className="rol">{ROL_EQUIPO[u.rol] ?? u.rol}</span>
            </li>
          ))}
          {/* ⚠️ LOS PEDIDOS VAN EN LA MISMA LISTA Y ATENUADOS, no en un bloque aparte.
              La pregunta que contesta esta tab es «¿quién entra a esta cuenta?», y la
              respuesta incluye a quien está a una firma de entrar. Un segundo bloque
              obliga a leer dos listas para contestar una sola pregunta. */}
          {visibles.map((a) => (
            <li key={'alta-' + a.id} className="pend">
              <Marca icono={null} foto={null} nombre={a.nombre || a.email} tam={34} color={colorDe(a.email)} />
              <span className="t">
                <b>{a.nombre || a.email}</b>
                {a.nombre && <span>{a.email}</span>}
              </span>
              <span className="rol">{ROTULO_ROL[a.rol_ws as RolAlta] ?? a.rol_ws}</span>
              <span className={a.estado === 'rechazada' ? 'est mal' : 'est'}>
                {ROTULO_ALTA[a.estado as EstadoAlta] ?? a.estado}
              </span>
            </li>
          ))}
        </ul>
      )}

      {(puedePedir || puedeSumar) && (pidiendo ? (
        <div className="fc-pedir">
          <input className="fc-in" type="email" value={email} placeholder="persona@empresa.com"
            autoFocus onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void pedir(); }} />
          <input className="fc-in" value={nom} placeholder="Nombre (opcional)"
            onChange={(e) => setNom(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void pedir(); }} />
          <select className="fc-in fc-sel" value={rol} onChange={(e) => setRol(e.target.value as RolAlta)}
            aria-label="Rol en el negocio">
            {ROLES_ALTA.map((r) => <option key={r} value={r}>{ROTULO_ROL[r]}</option>)}
          </select>
          {/* ⚠️ EL BOTÓN DICE LO QUE PASA, Y NO PASA LO MISMO. Para la agencia el pedido
              queda esperando una firma, así que «Sumar» prometería que la persona ya
              entra; para el super admin la persona entra Y le llega el mail, así que
              «Pedir» escondería que se le escribió a alguien. */}
          <button type="button" className="fc-ok" disabled={!emailUtilizable(email) || mandando}
            onClick={() => void pedir()}>
            {mandando ? (puedeSumar ? 'Sumando…' : 'Pidiendo…') : (puedeSumar ? 'Sumar y mandarle el acceso' : 'Pedir')}
          </button>
          <button type="button" className="fc-no" onClick={() => setPidiendo(false)}>Cancelar</button>
        </div>
      ) : (
        <button type="button" className="fc-sumar" onClick={() => setPidiendo(true)}>
          {puedeSumar ? 'Sumar a alguien' : 'Pedir sumar a alguien'}
        </button>
      ))}
    </>
  );
}

/** Los tres roles del negocio del cliente, con el nombre que usa el producto. */
const ROL_EQUIPO: Record<string, string> = { admin: 'Admin', closer: 'Closer', setter: 'Setter' };
