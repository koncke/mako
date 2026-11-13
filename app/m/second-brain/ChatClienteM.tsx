'use client';

// =============================================================================
// El Ops Center del cliente en el teléfono: el del super admin, destilado (22/10/2026)
// =============================================================================
// Martín (21/10): «el ops center de los clientes se ve muy mal comparado al de SuperAdmin... Computadora Y teléfono». Es la
// MISMA estructura que su Ops Center del teléfono (app/m/operaciones/ChatsMovil.tsx), con los chats del cliente:
//   · la pantalla es la lista, como WhatsApp: «Nuevo chat» arriba, el Cerebro (la estrella de MaKo) y todos los demás en UNA
//     lista, por actividad (lib/chat-mako-reglas.ts → listaDelCliente): sin «Offer» ni «Antes» aparte;
//   · tocar uno abre su conversación A PANTALLA COMPLETA, como WhatsApp (PantallaChatM, 13/11/2026: el prototipo que aprobó Martín,
//     docs/prototipos/mako-mobile-chat.html), con la criatura y el nombre de título, el hilo de la computadora (HiloMako, con lo de
//     WhatsApp) y la caja ÚNICA pegada abajo (app/_chat/CajaChat.tsx, como la de ChatsMovil);
//   · una conversación de Offer o un chat de antes se SIGUE ahí, con su motor. El motor es el de la computadora
//     (app/second-brain/useChatCliente.ts): una sola vez.
// ⚠️ UNA SOLA CAPA (PantallaChatM usa el historial de SheetM → «Una hoja sobre otra REEMPLAZA»): la Info de un mensaje y «Tus cuentas
//    de IA» se abren ADENTRO de la conversación, con su «‹» para volver, como el selector de la criatura en ChatsMovil.tsx.
// LA LISTA, COMO EL PROTOTIPO (13/11/2026): arriba el buscador y en chips el Second Brain, la Ticketera y el Uso; los chats en UNA
// lista de borde a borde (el grupo del negocio fijado primero); y «Nuevo chat» es el «+» flotante de WhatsApp.
// ⚠️ Los chats de Claude Code del super admin que mira un cliente van debajo (`masChats`, app/m/second-brain/SecondBrainCentroM.tsx).
// EL FUNNEL COACH (4/11/2026, Martín: «Junta a "Offer coach" con "Funnel Coach"... en computadora y en teléfono»): su fila va debajo del
// Ops Center, como en la computadora, con las conversaciones de oferta colgando de ella; abre su hoja (HojaDelCoach.tsx).

import '@/app/admin/operaciones/centro.css';
import '@/app/m/operaciones/operaciones.css';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { FilaM, ListaM, SheetM } from '@/app/m/_ui';
import { NuevoChatFlotante } from '@/app/m/_chat/NuevoChatFlotante';
import Link from '@/app/_ui/Link';
import { Icon } from '@/app/_components/icons';
import { CUERPO_CHAT, PantallaChatM } from '@/app/m/_chat/PantallaChatM';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { esRespuestaDeMaKo } from '@/app/_chat/HiloMako';
import { TEXTO_SEGUNDO_RENGLON, partesDelNombre, porJefe } from '@/lib/centro-chats';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { useChatCliente } from '@/app/second-brain/useChatCliente';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from '@/app/second-brain/PiezasCliente';
import { ORIGEN_FUNNEL_COACH, edadCorta, esFilaDe, jefeDelGrupo, type ElegidoChat } from '@/lib/chat-mako-reglas';
import { ASPECTO_MAKO, aspectoDeChat, aspectoDeReferente } from '@/lib/centro-munecos';
import { asesorPorId, inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import { GaleriaDeGurus } from '@/app/second-brain/GaleriaDeGurus';
import { HojaDelGuru } from './HojaDelGuru';
import { HojaDelCoach } from './HojaDelCoach';
import { useCoaches } from '@/app/second-brain/useCoaches';
import { HojaDelGrupo } from './HojaDelGrupo';
import { FilasDelGrupoM } from './FilasDelGrupoM';
import { useGrupos } from '@/app/_chat/grupo/useGrupos';
import { useMisTickets } from '@/app/tickets/usarMisTickets';
import type { SesionChat } from '@/lib/mako-turno-app-reglas';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { previaDelCoach } from '@/lib/funnel-plan';

/** Cuántos chats se ven antes de «Ver todos» (los de ChatsMovil.tsx). */
const VISIBLES = 10;
/** ¿Esta fila es la que se busca? Por el nombre, sin acentos ni mayúsculas. */
const plano = (t: string) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
export const coincide = (titulo: string, busca: string): boolean => !busca.trim() || plano(titulo).includes(plano(busca.trim()));

export function ChatClienteM({ sesionesIniciales, hrefMapa = null, opcionArmar = '', chatInicial = null, offerInicial = null, grupoInicial = null, masChats }: {
  sesionesIniciales: SesionChat[];
  /** El grafo (sólo el admin de la tab, lo decide el servidor): «Second Brain» arriba de los chats. */
  hrefMapa?: string | null;
  /** «Armar mi oferta» (lib/offer-reglas.ts → OPCION_ARMAR, que baja de la página). */
  opcionArmar?: string;
  /** `?chat=` y `?offer=`: la conversación que se abre al entrar. */
  chatInicial?: number | null;
  offerInicial?: number | null;
  /** `?grupo=`: el grupo que se abre al entrar (el push de un aviso). */
  grupoInicial?: number | null;
  /** Otros chats debajo de los suyos: los de Claude Code del super admin que mira un cliente. */
  masChats?: () => ReactNode;
}) {
  const [elegido, setElegido] = useState<ElegidoChat | null>(() => (offerInicial != null ? { offer: offerInicial } : chatInicial != null ? { id: chatInicial } : null));
  const [abierta, setAbierta] = useState(elegido != null);
  const [todas, setTodas] = useState(false);
  const [busca, setBusca] = useState('');
  const caja = useRef<HTMLTextAreaElement>(null);
  const hilo = useRef<HTMLDivElement>(null);
  // El coach (uno desde el 4/11/2026): quién aconseja, si hay oferta y si esta persona lo puede cambiar. Su referente es también la cara
  // de las conversaciones de oferta, que cuelgan de él.
  const { referente, oferta, puedeElegir, elegirReferente } = useCoaches();
  const delCoach = asesorPorId(referente);
  const k = useChatCliente({ elegido, setElegido, activo: true, entrarAlCerebro: false, chatInicial, opcionArmar, busca: '', caja, sesionesIniciales, aspectoOffer: delCoach ? aspectoDeReferente(delCoach.id) : null });
  // Su Ticketera: el número de la fila (los que esperan su respuesta).
  // Para el super admin que mira un cliente (`masChats`), no: lo suyo está en su Ops Center, como en la computadora.
  const misTickets = useMisTickets(!masChats);
  // Su «Uso» (D3): «Tus cuentas de IA» en una hoja, sin ir directo a conectar.
  const [verUso, setVerUso] = useState(false);

  // Como un chat: abre en lo último. La hoja monta su cuerpo en un portal y lo mide después del primer pintado, así que se baja
  // en el cuadro siguiente (el mismo cuidado que ChatsMovil.tsx).
  const seguirHoja = useCallback(() => hilo.current?.closest(CUERPO_CHAT) as HTMLElement | null, []);
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
  // El grupo del negocio (3/11/2026): su hoja, con su motor (HojaDelGrupo.tsx). Lo mismo: una hoja por vez (también la del coach).
  const grupos = useGrupos();
  const [grupo, setGrupo] = useState<number | null>(grupoInicial);
  const [conCoach, setConCoach] = useState(false);
  const abrirGuru = (id: IdAsesor) => { setAbierta(false); setGrupo(null); setConCoach(false); setGuru(id); };
  const abrirGrupo = (ws: number) => { setAbierta(false); setGuru(null); setConCoach(false); setGrupo(ws); };
  const abrirCoach = () => { setAbierta(false); setGuru(null); setGrupo(null); setConCoach(true); };
  const abrir = (e: ElegidoChat) => { if (k.elegir(e)) { setGuru(null); setGrupo(null); setConCoach(false); setAbierta(true); } };
  const cerrar = () => { setAbierta(false); k.setInfoWA(null); k.setConectando(false); k.setMenuWA(null); };
  /** Lo que se abre ADENTRO de la hoja, con su «‹» (una sola hoja): la Info de un mensaje o «Tus cuentas de IA». */
  const panel = k.conectando ? 'conectar' : k.infoWA ? 'info' : null;
  const volverDelPanel = () => { if (k.conectando) { k.setConectando(false); k.mirarSuIA(); } k.setInfoWA(null); };

  const [cerebro, ...todasLasFilas] = k.lista;
  // El coach es del admin del negocio (sus herramientas lo son): su fila, como en la computadora. Con ella, las conversaciones de oferta
  // cuelgan de él; sin ella (no la ve), siguen en la lista, para que nada se pierda.
  const verCoach = hrefMapa != null || puedeElegir;
  const filasOffer = verCoach ? todasLasFilas.filter((f) => f.origen === 'offer') : [];
  const resto = verCoach ? todasLasFilas.filter((f) => f.origen !== 'offer') : todasLasFilas;
  const buscando = !!busca.trim();
  const corte = buscando ? resto.filter((f) => coincide(f.titulo, busca)) : todas ? resto : resto.filter((f, i) => i < VISIBLES || esFilaDe(f, elegido));
  /** Una fila: la criatura (la SUYA), el nombre, la edad a la derecha y, si trabaja, «Trabajando…» (las de ChatsMovil.tsx). En su
   *  grupo (`sub`, debajo de su jefe), corrida a la derecha y con «↳» y lo de después de «›», como un sub-chat del super admin. */
  const fila = (f: (typeof k.lista)[number], sub = false) => {
    const vivo = !f.jefeDeGrupo && esFilaDe(f, elegido) && k.enCurso;
    return (
      <FilaM key={f.clave} chevron={false}
        leading={<span className={sub ? 'm-operaciones-sub' : undefined}><Muneco titulo={f.criatura} aspecto={f.aspecto} animo={vivo ? 'trabajando' : 'despierto'} size={sub ? 36 : 48} /></span>}
        titulo={<span className="m-operaciones-texto1">{sub ? `↳ ${partesDelNombre(f.titulo).sub ?? f.titulo}` : f.titulo}</span>}
        segunda={vivo ? <span className="m-operaciones-vivo">{TEXTO_SEGUNDO_RENGLON.vivo}</span> : undefined}
        riel={<span className="m-operaciones-riel"><span className="m-operaciones-hace">{edadCorta(f.actividad, k.ahora)}</span></span>}
        onClick={() => (f.guru ? abrirGuru(f.guru) : abrir(f.elegido))} />
    );
  };
  const estado = estadoDelCliente(k);

  return (
    <>
      {/* Arriba, como el prototipo: el buscador y en chips lo que no es un chat (el grafo, su Ticketera y su Uso). */}
      <label className="m-ops-buscar">
        <Icon name="search" size={18} />
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar en tus chats" />
      </label>
      <div className="m-ops-chips">
        {hrefMapa && <Link className="m-ops-chip" href={hrefMapa}>Second Brain</Link>}
        {/* Su Ticketera (22/10/2026): levantar uno y ver los suyos, con los que esperan su respuesta. */}
        {!masChats && !misTickets.fueraDelPlan && (
          <Link className="m-ops-chip" href="/m/tickets">Ticketera{misTickets.esperanTuRespuesta > 0 && <span className="m-ops-chip__n">{misTickets.esperanTuRespuesta}</span>}</Link>
        )}
        {/* Su «Uso» (D3): sus cuentas de IA. Sin IA conectada, el chip lo dice. */}
        {!masChats && <button type="button" className="m-ops-chip" onClick={() => setVerUso(true)}>{k.iaConectada === false ? 'Conecta tu IA' : 'Uso'}</button>}
      </div>
      <div className="m-ops-wa">
        <ListaM etiqueta="Chats">
          {/* Fijado, el primero de los chats (Martín: «que esté posicionado arriba»). */}
          {(!buscando || coincide(grupos.grupos?.map((g) => g.titulo).join(' ') ?? '', busca)) && <FilasDelGrupoM g={grupos} abierto={grupo} onAbrir={abrirGrupo} />}
          {cerebro && coincide(cerebro.titulo, busca) && fila(cerebro)}
          {verCoach && coincide(ORIGEN_FUNNEL_COACH, busca) && (
            <FilaM chevron={false}
              leading={<Muneco titulo={delCoach?.nombre ?? 'MaKo'} aspecto={delCoach ? aspectoDeReferente(delCoach.id) : ASPECTO_MAKO} animo="despierto" size={48} />}
              titulo={<span className="m-operaciones-texto1">{ORIGEN_FUNNEL_COACH}</span>}
              segunda={delCoach ? inspiradoEn(delCoach) : previaDelCoach(oferta)}
              onClick={abrirCoach} />
          )}
          {(buscando ? filasOffer.filter((f) => coincide(f.titulo, busca)) : filasOffer).map((f) => fila(f, true))}
          {/* Agrupados por su origen (22/10/2026), con el agrupado del super admin: cada grupo con su fila JEFE (la suya, o la de
              `jefeDelGrupo` si no tiene chat propio: «Offer», «Dashboard») y los suyos debajo, sin títulos de sección. */}
          {porJefe(corte).flatMap((g) => {
            const j = g.chat ?? (() => { const v = jefeDelGrupo(g); return v ? { ...v, aspecto: aspectoDeChat(v.clave) } : null; })();
            return j ? [fila(j), ...g.subs.map((f) => fila(f, true))] : g.subs.map((f) => fila(f));
          })}
          {!buscando && !todas && resto.length > corte.length && <FilaM titulo={`Ver los ${resto.length} chats`} onClick={() => setTodas(true)} navegacion />}
        </ListaM>
      </div>
      {k.errorLista && <p className="m-operaciones-hilo__meta" role="alert">{k.errorLista}<ReportarASoporte /></p>}
      {masChats?.()}
      {/* «Nuevo chat», el «+» de WhatsApp: abajo a la derecha, con su lugar al final de la lista. */}
      <NuevoChatFlotante onClick={() => abrir({ virtual: 'nuevo' })} />
      <SheetM abierto={verUso} onCerrar={() => { setVerUso(false); k.mirarSuIA(); }} snap="alto" id="uso-cliente" titulo="Tus cuentas de IA">
        <TusCuentasIA sinCabecera />
      </SheetM>

      <PantallaChatM abierto={abierta && elegido != null} onCerrar={cerrar} id="chat-cliente"
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
      </PantallaChatM>
      {delGuru && <HojaDelGuru key={delGuru.id} referente={delGuru} onCerrar={() => setGuru(null)} />}
      {conCoach && <HojaDelCoach referente={referente} oferta={oferta} puedeElegir={puedeElegir} onReferente={elegirReferente} onCerrar={() => setConCoach(false)} />}
      {grupo != null && (
        <HojaDelGrupo key={grupo} ws={grupo} grupo={grupos.grupos?.find((f) => f.ws === grupo) ?? null} onCerrar={() => { setGrupo(null); grupos.recargar(); }} onLeido={grupos.anotarLeido}
          onCambio={grupos.recargar} onSalio={() => { setGrupo(null); grupos.recargar(); }} />
      )}
      <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} reportable={esRespuestaDeMaKo} />
    </>
  );
}
