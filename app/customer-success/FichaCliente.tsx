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

import { useState, useRef } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { Modal, Tabs } from '@/app/_ui';
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
import { guardarDatosClienteAction } from './actions';
import { CuentaDeMaKo, type CuentasProp, type MiembroDeCliente } from './CuentaDeMaKo';

export function FichaCliente({ c, n, trabajo, user, clientes, cuentas, tabInicial, onImagen, onCerrar }: {
  c: ClienteCruce;
  /** Su número de cliente. NO es el id del lead. */
  n: number;
  /** SU trabajo, leído y MAPEADO por el server. `null` = no se pudo leer. */
  trabajo: TrabajoDeCliente | null;
  user: BoardUser;
  clientes: ClienteRef[];
  /** Quién ve «Inspeccionar» y en qué estado está la cuenta de cada cliente. */
  cuentas?: CuentasProp;
  /** Con qué tab abre. `null` = la primera. Lo usa «Ver su equipo» de la tarjeta. */
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

  /** ⚠️ UNA SOLA TAB NO SON TABS: sin equipo que mostrar, la fila no se dibuja y el
   *  tablero queda como estaba. Una barra de un solo destino es ruido con cara de mapa. */
  const tabs = [
    { id: 'tablero', label: 'Tablero' },
    ...(equipo?.length ? [{ id: 'equipo', label: 'Equipo', badge: equipo.length }] : []),
  ];
  const [tab, setTab] = useState(
    tabInicial && tabs.some((t) => t.id === tabInicial) ? tabInicial : 'tablero',
  );

  /** Renombrar al cliente o cambiarle la empresa. ⚠️ Escribe en `leads`, o sea en el
   *  CRM: no hay tabla de clientes, un cliente es un lead ganado. */
  function guardarDatos(cambio: { nombre?: string; empresa?: string | null }) {
    setMal('');
    void guardarDatosClienteAction(c.leadId, cambio).then((r) => {
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
  const clienteFijo = { leadId: c.leadId, nombre };

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
              <Marca icono={c.icono ?? c.avatarUrl} nombre={nombre} tam={88} y={c.avatarY} color={color} />
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
            <CuentaDeMaKo c={c} cuentas={cuentas} onError={setMal} />
          </span>
        </span>
      }
      etiqueta={nombre}
      ancho={ANCHO}
      /* ⚠️ ADENTRO VIVE EL TABLERO, Y EL TABLERO ABRE SUS PROPIOS MODALES. Sin esto la pila
         apaga esta ficha con `display:none` en cuanto se abre uno —y como ese modal es un
         DESCENDIENTE suyo, se apaga con ella: click en una tarea = pantalla en blanco.
         Medido el 27/09/2026 (ver `contenedores` en app/_components/pila-modales.ts). */
      contenedor
      onCerrar={onCerrar}
    >
      {mal && <p className="fc-mal">{mal}</p>}

      {tabs.length > 1 && <Tabs tabs={tabs} activa={tab} onCambio={setTab} />}

      {tab === 'equipo' ? (
        <EquipoDelCliente nombre={nombre} equipo={equipo ?? []} />
      ) : !trabajo ? (
        // «No pude leer» no se pinta como «no tiene trabajo»: son dos pantallas, y la
        // segunda sobre la primera es la mentira que nadie audita.
        <p className="fc-mal">No pude leer su tablero. Vuelve a entrar a Clientes.</p>
      ) : trabajo.dueno ? (
        // ⚠️ `onRecargar` ES OBLIGATORIO ACÁ. El tablero recarga la página entera después
        // de una cascada de prioridad y al aplicar un borrador de reunión — y eso, adentro
        // de la ficha, la cierra: qué cliente está abierto es estado de React en
        // `ClientesApp`, no viaja en la URL. `router.refresh()` revalida el render del
        // server (de donde salen estas filas) sin desmontar el árbol del navegador.
        <PlanBoard user={user} tareas={trabajo.tareas} proyectos={trabajo.proyectos}
          vacio={false} clientes={clientes} clienteFijo={clienteFijo} embebido
          onRecargar={() => router.refresh()} />
      ) : (
        <TodoBoard tareas={trabajo.tareas} categorias={trabajo.categorias} demo={false}
          user={user} clientes={clientes} clienteFijo={clienteFijo} embebido
          onRecargar={() => router.refresh()} />
      )}

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
function EquipoDelCliente({ nombre, equipo }: {
  nombre: string;
  equipo: MiembroDeCliente[];
}) {
  if (equipo.length === 0) {
    // «Todavía nadie» y «no lo pude leer» son dos cosas; acá la lista viene con el HTML
    // y filtrada por el server, así que vacía significa vacía y se puede decir.
    return <p className="fc-eq-nada">Nadie más entra a la cuenta de {nombre} todavía.</p>;
  }
  return (
    <ul className="fc-eq">
      {equipo.map((u) => (
        <li key={u.id}>
          <Marca icono={null} foto={u.foto} nombre={u.nombre} tam={34} color={colorDe(u.nombre)} />
          <span className="t"><b>{u.nombre}</b><span>{u.email}</span></span>
          <span className="rol">{ROL_EQUIPO[u.rol] ?? u.rol}</span>
        </li>
      ))}
    </ul>
  );
}

/** Los tres roles del negocio del cliente, con el nombre que usa el producto. */
const ROL_EQUIPO: Record<string, string> = { admin: 'Admin', closer: 'Closer', setter: 'Setter' };
