'use client';

// =============================================================================
// Lo que se ve adentro del grupo: el hilo único, con el autor de cada mensaje (3/11/2026)
// =============================================================================
// Lo monta el panel de la computadora (app/second-brain/ChatDelGrupo.tsx) y la hoja del teléfono (app/m/second-brain/HojaDelGrupo.tsx). Es `HiloMako`, el de todos los chats, con
// `grupo` en cada mensaje (./pantalla.ts): lo de otra persona a la izquierda con su nombre, los avisos de MaKo con su marca, y lo del sistema en una píldora. Sin `HiloDelCliente`: ése
// pide el motor entero y marcaría «No te pude contestar esto» en cada mensaje entre personas.
//
// NUNCA UNA PANTALLA EN BLANCO NI UN ERROR TÉCNICO: cargando, la criatura; sin poder leer, «No pude abrir el grupo» con «Reintentar»; sacado del grupo, lo dice; vacío, qué cae acá.
//
// EL MENÚ: Responder y Copiar. Sin reacciones, fijar, destacar ni eliminar: guardados por persona, nadie más los vería, y en un grupo eso engaña (fuera de esta versión).

import { useCallback, useMemo, useState, type ReactNode, type RefObject } from 'react';
import { MenuMensajeWA, ContextoWA, type AccionesWA, type MenuAbiertoWA } from '@/app/admin/operaciones/MensajeWA';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { HiloMako, type EnMensaje, esRespuestaDeMaKo } from '@/app/_chat/HiloMako';
import { ArchivosHilo } from '@/app/_chat/ArchivosHilo';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';
import { Icon } from '@/app/_components/icons';
// Directo y no desde el índice de app/_ui (ver app/_ui/CargandoMako.tsx).
import { CargandoMako } from '@/app/_ui/CargandoMako';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { SIN_MARCAS } from '@/lib/centro-mensajes';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import { FRASES_DEL_GRUPO, itemsDelGrupo, mensajePorIdDeFila, quePuede } from './pantalla';
import type { HiloDelGrupoK } from './useHiloDelGrupo';
import '@/app/_chat/chat.css';
import './grupo.css';

const QUIEN = { nombre: 'MaKo', aspecto: ASPECTO_MAKO };
const SIN_EN_EL_MENU = ['reenviar', 'info', 'destacar', 'fijar', 'eliminar', 'transcripcion'] as const;

/** Lo de arriba de un mensaje de MaKo: «Aviso» si lo es, su nombre y lo que trae. El texto lo dibuja el hilo. */
function enMensajeDeMako(x: Extract<ItemHilo, { k: 'msg' }>): EnMensaje | null {
  const g = x.grupo;
  if (!g) return null;
  const nombre = g.deParte ?? 'MaKo';
  return {
    arriba: (
      <>
        {g.aviso && <span className="co-aviso-grupo"><Icon name="bell" size={12} />Aviso</span>}
        {!g.sigue && !g.aviso && <span className="co-autor" data-color={g.color ?? 'mako'}>{nombre}{g.chip && <span className="co-autor__chip">{g.chip}</span>}</span>}
        {g.aviso && g.chip && <span className="co-autor__chip">{g.chip}</span>}
        {!!x.archivos?.length && <ArchivosHilo archivos={x.archivos} />}
        {x.voz && <AudioPlay src={x.voz.url} duracion={x.voz.secs} color="var(--primary)" style={{ width: 240 }} />}
      </>
    ),
  };
}

/** Una portada: la criatura y una frase, con su botón si lo hay. */
function Portada({ titulo, detalle, children }: { titulo: string; detalle?: string; children?: ReactNode }) {
  return (
    <div className="co-portada" role="status">
      <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={76} />
      <p className="co-portada__nombre">{titulo}</p>
      {detalle && <p className="co-portada__dato">{detalle}</p>}
      {children}
    </div>
  );
}

export function HiloDelGrupo({ k, rol, invitacion = false, desdeLeido, campo, nuevos, onBajar, onVolver }: {
  k: HiloDelGrupoK;
  /** Su fila de la lista. null: todavía no llegó, o el link lo abrió sin ella. Sin saber quién es, lo mínimo: a un invitado no se le ofrece lo que le daría 404. */
  rol: { invitado: boolean; administra: boolean } | null;
  /** Todavía dice «Invitación de…»: lo abre por primera vez. */
  invitacion?: boolean;
  /** Hasta dónde había leído al abrir: de ahí sale «Sin leer». */
  desdeLeido: number | null;
  campo?: RefObject<HTMLTextAreaElement | null>;
  /** Cuántos llegaron mientras leía arriba. */
  nuevos: number;
  onBajar: () => void;
  onVolver?: () => void;
}) {
  const puede = quePuede(rol);
  const invitado = rol?.invitado === true;
  const [menu, setMenu] = useState<MenuAbiertoWA | null>(null);
  const items = useMemo(
    () => itemsDelGrupo({ ws: k.ws, mensajes: k.mensajes, pendientes: k.pendientes, deWhatsApp: k.deWhatsApp.mensajes, desdeLeido }),
    [k.ws, k.mensajes, k.pendientes, k.deWhatsApp.mensajes, desdeLeido],
  );
  const { mensajes, setCita } = k;
  const responder = useCallback((id: Parameters<typeof mensajePorIdDeFila>[1]) => {
    const m = mensajePorIdDeFila(mensajes, id);
    // Lo que todavía sale, o lo de antes de WhatsApp: no tiene fila a la que responder.
    if (!m) return;
    setCita(m);
    campo?.current?.focus();
  }, [mensajes, setCita, campo]);
  const acciones = useMemo<AccionesWA>(() => ({
    abrirMenu: (m, x, y, tactil) => setMenu({ m, x, y, tactil }),
    responder: (m) => responder(m.id),
    reaccionar: () => {},
  }), [responder]);

  if (k.estado === 'fuera') {
    return <Portada titulo={FRASES_DEL_GRUPO.fuera}>{onVolver && <button type="button" className="co-chip" onClick={onVolver}>Volver a los chats</button>}</Portada>;
  }
  if (k.estado === 'cargando' && !k.mensajes.length) return <CargandoMako que="el grupo" alto="60vh" />;
  if (k.estado === 'error' && !k.mensajes.length && !k.pendientes.length) {
    return <Portada titulo={FRASES_DEL_GRUPO.noAbre}><button type="button" className="co-chip" onClick={() => void k.recargar()}>Reintentar</button></Portada>;
  }
  const hayAlgo = items.length > 0;
  return (
    <ContextoWA.Provider value={acciones}>
      {k.hayAntes && (
        <button type="button" className="co-anteriores" onClick={() => void k.verAnteriores()} disabled={k.trayendo}>{k.trayendo ? 'Trayendo…' : 'Ver anteriores'}</button>
      )}
      {!k.hayAntes && puede.verWhatsApp && k.deWhatsApp.hayMas && hayAlgo && (
        <button type="button" className="co-anteriores" onClick={() => void k.verDeWhatsApp()} disabled={k.deWhatsApp.pidiendo}>{k.deWhatsApp.pidiendo ? 'Trayendo…' : 'Ver lo anterior de WhatsApp'}</button>
      )}
      {k.deWhatsApp.nada && <span className="co-dia">Nada anterior en WhatsApp.</span>}
      {invitado && <span className="co-dia co-dia--sistema">{invitacion ? FRASES_DEL_GRUPO.invitacion : FRASES_DEL_GRUPO.invitadoDesde}</span>}
      {hayAlgo || k.pensando
        ? <HiloMako items={items} quien={QUIEN} ahora={k.ahora} escribiendo={k.pensando ? { segs: 0 } : null} tarjeta={null} onTarjeta={() => {}}
          onReintentar={k.reintentar} onDescartar={k.descartar} onRecargar={() => void k.sondear()} enMensaje={enMensajeDeMako} marcas={null} />
        : <Portada titulo={FRASES_DEL_GRUPO.vacio} detalle={FRASES_DEL_GRUPO.vacioDetalle} />}
      {nuevos > 0 && (
        <button type="button" className="co-nuevos-grupo" onClick={onBajar}>
          <span aria-hidden style={{ display: 'inline-flex' }}><Icon name="chevron" size={14} /></span>
          {nuevos === 1 ? '1 mensaje nuevo' : `${nuevos} mensajes nuevos`}
        </button>
      )}
      {/* «Reportar» (ticket #57): lo que no escribió quien mira se reporta desde el menú, no con un botón debajo (Play, Apple 1.2). */}
      <MenuMensajeWA abierto={menu} marcas={SIN_MARCAS} sin={SIN_EN_EL_MENU} sinReacciones onCerrar={() => setMenu(null)}
        reportable={esRespuestaDeMaKo} queSeReporta="un mensaje del grupo"
        onElegir={(m, id) => {
          setMenu(null);
          if (id === 'responder') responder(m.id);
          else if (id === 'copiar') void navigator.clipboard?.writeText(m.texto).catch(() => {});
        }} />
    </ContextoWA.Provider>
  );
}
