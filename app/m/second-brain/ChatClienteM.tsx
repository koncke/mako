'use client';

// =============================================================================
// El Ops Center del cliente en el teléfono: el del super admin, destilado (22/10/2026)
// =============================================================================
// Martín (21/10): «el ops center de los clientes se ve muy mal comparado al de SuperAdmin... Computadora Y teléfono». Es la
// MISMA estructura que su Ops Center del teléfono (app/m/operaciones/ChatsMovil.tsx), con los chats del cliente:
//   · la pantalla es la lista, como WhatsApp: «Nuevo chat» arriba, el Cerebro (la estrella de MaKo) y todos los demás en UNA
//     lista, por actividad (lib/chat-mako-reglas.ts → listaDelCliente): sin «Offer» ni «Antes» aparte;
//   · tocar uno abre su conversación en una hoja alta (SheetM), con la criatura y el nombre de título, el hilo de la
//     computadora (HiloMako, con lo de WhatsApp) y la caja ÚNICA pegada abajo (app/_chat/CajaChat.tsx, como la de ChatsMovil);
//   · una conversación de Offer o un chat de antes se SIGUE ahí, con su motor. El motor es el de la computadora
//     (app/second-brain/useChatCliente.ts): una sola vez.
// ⚠️ UNA SOLA HOJA (SheetM → «Una hoja sobre otra REEMPLAZA»): la Info de un mensaje y «Tus cuentas de IA» se abren ADENTRO de
//    la de la conversación, con su «‹» para volver, como el selector de la criatura en ChatsMovil.tsx.
// ⚠️ Los chats de Claude Code del super admin que mira un cliente van debajo (`masChats`, app/m/second-brain/SecondBrainCentroM.tsx).

import '@/app/admin/operaciones/centro.css';
import '@/app/m/operaciones/operaciones.css';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FilaM, ListaM, SeccionM, SheetM } from '@/app/m/_ui';
import { CirculoNuevo } from '@/app/admin/operaciones/NuevoChat';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TEXTO_SEGUNDO_RENGLON, partesDelNombre, porJefe } from '@/lib/centro-chats';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { useChatCliente } from '@/app/second-brain/useChatCliente';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from '@/app/second-brain/PiezasCliente';
import { edadCorta, esFilaDe, jefeDelGrupo, type ElegidoChat } from '@/lib/chat-mako-reglas';
import { aspectoDeChat } from '@/lib/centro-munecos';
import { asesorPorId, type IdAsesor } from '@/lib/asesores/catalogo';
import { GaleriaDeGurus } from '@/app/second-brain/GaleriaDeGurus';
import { HojaDelGuru } from './HojaDelGuru';
import { useMisTickets } from '@/app/tickets/usarMisTickets';
import type { SesionChat } from '@/lib/mako-turno-app-reglas';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';

/** Cuántos chats se ven antes de «Ver todos» (los de ChatsMovil.tsx). */
const VISIBLES = 10;

export function ChatClienteM({ sesionesIniciales, hrefMapa = null, opcionArmar = '', chatInicial = null, offerInicial = null, masChats }: {
  sesionesIniciales: SesionChat[];
  /** El grafo (sólo el admin de la tab, lo decide el servidor): «Second Brain» arriba de los chats. */
  hrefMapa?: string | null;
  /** «Armar mi oferta» (lib/offer-reglas.ts → OPCION_ARMAR, que baja de la página). */
  opcionArmar?: string;
  /** `?chat=` y `?offer=`: la conversación que se abre al entrar. */
  chatInicial?: number | null;
  offerInicial?: number | null;
  /** Otros chats debajo de los suyos: los de Claude Code del super admin que mira un cliente. */
  masChats?: () => ReactNode;
}) {
  const [elegido, setElegido] = useState<ElegidoChat | null>(() => (offerInicial != null ? { offer: offerInicial } : chatInicial != null ? { id: chatInicial } : null));
  const [abierta, setAbierta] = useState(elegido != null);
  const [todas, setTodas] = useState(false);
  const caja = useRef<HTMLTextAreaElement>(null);
  const hilo = useRef<HTMLDivElement>(null);
  const k = useChatCliente({ elegido, setElegido, activo: true, entrarAlCerebro: false, chatInicial, opcionArmar, busca: '', caja, sesionesIniciales });
  // Su Ticketera: el número de la fila (los que esperan su respuesta).
  // Para el super admin que mira un cliente (`masChats`), no: lo suyo está en su Ops Center, como en la computadora.
  const misTickets = useMisTickets(!masChats);
  // Su «Uso» (D3): «Tus cuentas de IA» en una hoja, sin ir directo a conectar.
  const [verUso, setVerUso] = useState(false);

  // Como un chat: abre en lo último. La hoja monta su cuerpo en un portal y lo mide después del primer pintado, así que se baja
  // en el cuadro siguiente (el mismo cuidado que ChatsMovil.tsx).
  const seguirHoja = useCallback(() => hilo.current?.closest('.m-sheet__cuerpo') as HTMLElement | null, []);
  const enChatNuevo = elegido != null && 'virtual' in elegido && elegido.virtual === 'nuevo';
  // El chat nuevo se queda arriba: abajo de la portada están los gurús, y bajando se perdía lo que dice.
  const quedaArriba = enChatNuevo && !k.items.length;
  useEffect(() => {
    if (!abierta || quedaArriba) return;
    const t = setTimeout(() => { const el = seguirHoja(); if (el) el.scrollTop = el.scrollHeight; }, 80);
    return () => clearTimeout(t);
  }, [abierta, k.items.length, k.trabajo, seguirHoja, quedaArriba]);

  // El chat con un gurú: su propia hoja, con su motor (HojaDelGuru.tsx). Una sola a la vez: abrirla cierra la de la conversación.
  const [guru, setGuru] = useState<IdAsesor | null>(null);
  const delGuru = asesorPorId(guru);
  const abrirGuru = (id: IdAsesor) => { setAbierta(false); setGuru(id); };
  const abrir = (e: ElegidoChat) => { if (k.elegir(e)) { setGuru(null); setAbierta(true); } };
  const cerrar = () => { setAbierta(false); k.setInfoWA(null); k.setConectando(false); k.setMenuWA(null); };
  /** Lo que se abre ADENTRO de la hoja, con su «‹» (una sola hoja): la Info de un mensaje o «Tus cuentas de IA». */
  const panel = k.conectando ? 'conectar' : k.infoWA ? 'info' : null;
  const volverDelPanel = () => { if (k.conectando) { k.setConectando(false); k.mirarSuIA(); } k.setInfoWA(null); };

  const [cerebro, ...resto] = k.lista;
  const corte = todas ? resto : resto.filter((f, i) => i < VISIBLES || esFilaDe(f, elegido));
  /** Una fila: la criatura (la SUYA), el nombre, la edad a la derecha y, si trabaja, «Trabajando…» (las de ChatsMovil.tsx). En su
   *  grupo (`sub`, debajo de su jefe), corrida a la derecha y con «↳» y lo de después de «›», como un sub-chat del super admin. */
  const fila = (f: (typeof k.lista)[number], sub = false) => {
    const vivo = !f.jefeDeGrupo && esFilaDe(f, elegido) && k.enCurso;
    return (
      <FilaM key={f.clave} chevron={false}
        leading={<span className={sub ? 'm-operaciones-sub' : undefined}><Muneco titulo={f.criatura} aspecto={f.aspecto} animo={vivo ? 'trabajando' : 'despierto'} size={sub ? 32 : 40} /></span>}
        titulo={<span className="m-operaciones-texto1">{sub ? `↳ ${partesDelNombre(f.titulo).sub}` : f.titulo}</span>}
        segunda={vivo ? <span className="m-operaciones-vivo">{TEXTO_SEGUNDO_RENGLON.vivo}</span> : undefined}
        riel={<span className="m-operaciones-riel"><span className="m-operaciones-hace">{edadCorta(f.actividad, k.ahora)}</span></span>}
        onClick={() => (f.guru ? abrirGuru(f.guru) : abrir(f.elegido))} />
    );
  };
  const estado = estadoDelCliente(k);

  return (
    <>
      {/* El grafo del negocio, arriba de los chats (como «Second Brain» en el Ops Center del super admin). */}
      {hrefMapa && <ListaM etiqueta="Second Brain"><FilaM navegacion titulo="Second Brain" icono="cerebro" href={hrefMapa} /></ListaM>}
      {/* Su Ticketera (22/10/2026), como la del Ops Center del super admin en el teléfono: levantar uno y ver los suyos. */}
      {!masChats && !misTickets.fueraDelPlan && <ListaM etiqueta="Ticketera">
        <FilaM navegacion titulo="Ticketera" icono="soporte" href="/m/tickets"
          segunda={misTickets.esperanTuRespuesta > 0 ? `${misTickets.esperanTuRespuesta} esperan tu respuesta` : 'Tus tickets'} />
      </ListaM>}
      <SeccionM titulo="Chats">
        <ListaM etiqueta="Chats">
          <FilaM leading={<CirculoNuevo size={40} />} titulo="Nuevo chat" onClick={() => abrir({ virtual: 'nuevo' })} navegacion />
          {cerebro && fila(cerebro)}
          {/* Agrupados por su origen (22/10/2026), con el agrupado del super admin: cada grupo con su fila JEFE (la suya, o la de
              `jefeDelGrupo` si no tiene chat propio: «Offer», «Dashboard») y los suyos debajo, sin títulos de sección. */}
          {porJefe(corte).flatMap((g) => {
            const j = g.chat ?? (() => { const v = jefeDelGrupo(g); return v ? { ...v, aspecto: aspectoDeChat(v.clave) } : null; })();
            return j ? [fila(j), ...g.subs.map((f) => fila(f, true))] : g.subs.map((f) => fila(f));
          })}
          {!todas && resto.length > corte.length && <FilaM titulo={`Ver los ${resto.length} chats`} onClick={() => setTodas(true)} navegacion />}
        </ListaM>
      </SeccionM>
      {k.errorLista && <p className="m-operaciones-hilo__meta" role="alert">{k.errorLista}<ReportarASoporte /></p>}
      {masChats?.()}
      {/* Su «Uso», abajo como en el Ops Center del super admin («Uso y Runners»): sus cuentas de IA, conectar y desconectar. */}
      {!masChats && <ListaM etiqueta="Uso">
        <FilaM navegacion titulo="Uso" icono="config" onClick={() => setVerUso(true)}
          segunda={k.iaConectada == null ? 'Tus cuentas de IA' : k.iaConectada ? 'Tu IA conectada' : 'Conecta tu IA'} />
      </ListaM>}
      <SheetM abierto={verUso} onCerrar={() => { setVerUso(false); k.mirarSuIA(); }} snap="alto" id="uso-cliente" titulo="Tus cuentas de IA">
        <TusCuentasIA sinCabecera />
      </SheetM>

      <SheetM abierto={abierta && elegido != null} onCerrar={cerrar} snap="alto" id="chat-cliente"
        titulo={panel === 'conectar' ? 'Tus cuentas de IA' : panel === 'info' ? 'Info del mensaje' : (
          // El título es el chat, como la cabecera de WhatsApp: la criatura a la izquierda del nombre (ChatsMovil.tsx).
          <span className="m-operaciones-titulo">
            <span className="m-operaciones-titulo__muneco"><Muneco titulo={k.nombreMuneco} aspecto={k.aspectoMuneco} animo={k.enCurso ? 'trabajando' : 'despierto'} size={34} /></span>
            <span className="m-operaciones-titulo__texto"><span className="m-operaciones-titulo__nombre">{k.nombre}</span></span>
          </span>
        )}
        pie={panel ? undefined : (
          <div className="m-operaciones-caja">
            {/* La caja ÚNICA, la del teléfono del super admin: Enter baja de renglón y se manda con el botón. */}
            <CajaDelCliente k={k} campo={caja} seguir={seguirHoja} movil />
            {estado && <div className="m-operaciones-caja__fila m-operaciones-caja__fila--meta"><span className="m-operaciones-caja__estado">{estado}</span></div>}
          </div>
        )}>
        {panel && (
          <button type="button" className="m-operaciones-volver" onClick={volverDelPanel}>
            <span aria-hidden>‹</span> {k.nombre}
          </button>
        )}
        {panel === 'info' && k.infoWA && <InfoMensaje m={k.infoWA} />}
        {panel === 'conectar' && <TusCuentasIA sinCabecera conectar />}
        {!panel && (
          <div className="m-operaciones-hilo" ref={hilo}>
            {/* Los fijados, pegados arriba de la conversación (WhatsApp): tocar va al mensaje. */}
            <div className="m-operaciones-cabeza">
              <div className="m-operaciones-fijados">
                <BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={k.nombre} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />
              </div>
            </div>
            <HiloDelCliente k={k} />
            {enChatNuevo && !k.items.length && !k.trabajo && <GaleriaDeGurus onElegir={abrirGuru} />}
          </div>
        )}
      </SheetM>
      {delGuru && <HojaDelGuru key={delGuru.id} referente={delGuru} onCerrar={() => setGuru(null)} />}
      <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} />
    </>
  );
}
