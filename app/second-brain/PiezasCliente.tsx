'use client';

// =============================================================================
// Las piezas del chat del cliente que dibujan la computadora y el teléfono (22/10/2026)
// =============================================================================
// El motor es useChatCliente.ts; esto es lo que se ve adentro de cada panel: el hilo (HiloMako, con lo de WhatsApp y la portada
// del chat vacío) y la caja ÚNICA (app/_chat/CajaChat.tsx) con todo lo suyo: la cita del mensaje que se responde, los textos
// largos pegados como documento y, si la persona no tiene su IA, «Conectar tu Claude» al final. La computadora lo pone en el
// panel del Ops Center (PanelChat.tsx) y el teléfono en su hoja (SheetM), como el super admin pone el suyo
// (Conversacion.tsx y ChatsMovil.tsx). Una sola vez, para que no se separen.

import { useMemo, type ReactNode, type RefObject } from 'react';
import { Icon } from '@/app/_components/icons';
import { AperturaMako, useApertura } from '@/app/_chat/AperturaMako';
import { FRASE_RESPONDER } from '@/app/_chat/app-de-escritorio';
import { useGuiaEnElChat } from '@/app/_ui/guia/store';
import { ancla } from '@/app/_ui/guia/ancla';
import { SUPERFICIE_OPS } from '@/lib/aperturas/ops';
import { CajaChat } from '@/app/_chat/CajaChat';
import { HiloMako } from '@/app/_chat/HiloMako';
import { CitaCaja, ContextoWA } from '@/app/admin/operaciones/MensajeWA';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { IconoChat } from '@/app/m/mako/iconos';
import { FranjaApp, useBloqueoApp } from '@/app/_chat/AppPrimero';
import { caracteres, nombrePegado } from '@/lib/chat-pegado';
import { ARRANQUES_SECOND_BRAIN, AVISO_EDITOR, AVISO_EDITOR_AJENO, AVISO_LIENZO } from '@/lib/chat-mako-reglas';
import { NOMBRE_MODELO_IA, type CuentaIA } from '@/lib/chat-ia-reglas';
import type { ChatCliente } from './useChatCliente';

/** El hilo del chat abierto: lo que dijo cada uno, con lo de WhatsApp; vacío, la portada con lo que más se le pide. */
/**
 * EL «USO» DEL CLIENTE, abajo de su barra como el del super admin (PiezasCentro.tsx → PieCentro), 22/10/2026. Martín: «Que vean el
 * USO, para poder conectar si quieren más cuentas de Claude o GPT... O desconectar». Abre el MISMO modal de siempre, «Tus cuentas
 * de IA» (su computadora con su Claude y su uso, sus claves con lo que gastó cada una, conectar otra y desconectar). Sólo lo del
 * negocio: nada de las cuentas de Martín ni de la plataforma (lo lee /api/ia-pc/estado con la sesión).
 */
export function UsoDelCliente({ conectada, onAbrir }: { conectada: boolean | null; onAbrir: () => void }) {
  return (
    <div className="co-barra__abajo">
      <div className="co-uso">
        <button type="button" className="co-acceso" onClick={onAbrir} {...ancla('sb-uso')} title="Tus cuentas de IA">
          <Icon name="config" size={17} />Uso
          <span className="co-uso__principal">{conectada == null ? '—' : conectada ? 'Tu IA' : 'Conecta tu IA'}</span>
        </button>
      </div>
    </div>
  );
}

/**
 * CON QUÉ IA CORRE ESTE CHAT (8b, 23/10/2026, Martín: «el "+" de la caja deja elegir con qué corre ese chat: el modelo y la
 * cuenta (Claude o GPT, y cuál). Por defecto decide el chat jefe»). Copiado del selector del super admin (PiezasCentro.tsx →
 * `SelectoresDeEnvio`): un desplegable chico por cosa, adentro del «+», con «Automático» primero. Las cuentas son las que
 * arma el servidor para ESTA persona (lib/chat-ia-reglas.ts → `CuentaDeIA`); sin ellas no se dibuja.
 */
export function SelectoresDelCliente({ k }: { k: ChatCliente }) {
  const cuentas = k.cuentasIA;
  if (!cuentas?.length) return null;
  const e = k.iaDelChat;
  const cuenta = e ? cuentas.find((c) => c.cuenta === e.cuenta) ?? null : null;
  return (
    <>
      <label className="co-envio-fila">
        <span>Cuenta</span>
        <select className="co-chip co-envio-sel" title="Con qué cuenta corre este chat" value={e?.cuenta ?? AUTOMATICO_IA} disabled={k.enCurso}
          onChange={(ev) => k.elegirIA(ev.target.value === AUTOMATICO_IA ? null : { cuenta: ev.target.value as CuentaIA })}>
          <option value={AUTOMATICO_IA}>Automático · lo decide el chat jefe</option>
          {cuentas.map((c) => <option key={c.cuenta} value={c.cuenta}>{c.nombre}</option>)}
        </select>
      </label>
      {cuenta && cuenta.modelos.length > 0 && (
        <label className="co-envio-fila">
          <span>Modelo</span>
          <select className="co-chip co-envio-sel" title="Con qué modelo corre" value={e?.modelo ?? AUTOMATICO_IA} disabled={k.enCurso}
            onChange={(ev) => k.elegirIA({ cuenta: cuenta.cuenta, ...(ev.target.value === AUTOMATICO_IA ? {} : { modelo: ev.target.value }) })}>
            <option value={AUTOMATICO_IA}>{cuenta.modeloDefault ? `Automático · ${NOMBRE_MODELO_IA[cuenta.modeloDefault] ?? cuenta.modeloDefault}` : 'Automático'}</option>
            {cuenta.modelos.map((m) => <option key={m} value={m}>{NOMBRE_MODELO_IA[m] ?? m}</option>)}
          </select>
        </label>
      )}
    </>
  );
}
const AUTOMATICO_IA = '';

/**
 * LA APERTURA DEL CEREBRO (29/10/2026, «MaKo toma la iniciativa», docs/mako-iniciativa/plan.md): lo que MaKo dice primero en el
 * Cerebro, el mismo en el Ops Center, la estrella de cada tab y la tarjeta de Create. Gana, en este orden:
 *   1. la de la tab (`propia`: la del CRM, la del Plan…), que habla de lo que la tab tiene abierto;
 *   2. la de la GUÍA de la pestaña (la primera vez, «¿Quieres que te ayude a aprender a usar esta pestaña?», app/_ui/guia/);
 *   3. la escalera del Cerebro (lib/aperturas/ops.ts): hoy, su IA.
 * Una por pantalla. Calla con MaKo trabajando, con la guía señalando, con la conversación sin cargar y fuera del Cerebro (un chat
 * de Offer, uno de antes). Las recomendaciones plegadas NO la callan: esperan plegadas, y lo que pide la apertura (su IA) es lo
 * que deja correr a casi todas.
 */
export function useAperturaDelCerebro(k: ChatCliente, o: { libre: boolean; propia?: ReactNode | null }): ReactNode | null {
  const guia = useGuiaEnElChat();
  const escritos = useMemo(() => k.items.filter((x) => x.k === 'msg' && x.role === 'user').length, [k.items]);
  const deLaGuia = k.esJefe && guia.pregunta?.apertura != null;
  const hechos = k.app == null || k.iaConectada == null ? null : { app: k.app, iaConectada: k.iaConectada };
  // La guía va primero (la primera vez en la pestaña): mientras decide si pregunta, la escalera espera.
  const libre = o.libre && k.esJefe && k.cargado && !k.errorCarga && !k.enCurso && !o.propia && !deLaGuia && !guia.senalando && !guia.esperando;
  const estado = useApertura({ superficie: SUPERFICIE_OPS, hechos, libre, escritos, app: k.app, iaConectada: k.iaConectada, onPedir: k.enviar });
  const quien = { nombre: k.nombreMuneco, aspecto: k.aspectoMuneco };
  if (o.propia) return o.propia;
  if (deLaGuia && guia.pregunta) return <AperturaMako estado={guia.pregunta} quien={quien} acciones={{}} onConectar={() => k.setConectando(true)} />;
  return estado.apertura ? <AperturaMako estado={estado} quien={quien} acciones={{}} onConectar={() => k.setConectando(true)} /> : null;
}

export function HiloDelCliente({ k, apertura = null }: {
  k: ChatCliente;
  /** Lo que MaKo dice primero (`useAperturaDelCerebro`): con el hilo vacío, en lugar de la portada (también sin la app: sus
   *  botones andan); con historia, después del último mensaje. Nunca se guarda. */
  apertura?: ReactNode | null;
}) {
  // Sin la app de escritorio (23/10/2026) la conversación se sigue viendo: el cartel va en el lugar de la caja (CajaDelCliente,
  // 24/10/2026). Vacía, sin la portada: «¿En qué te ayudo?» y sus arranques invitarían a escribir lo que no se puede mandar. La
  // apertura sí (29/10/2026): sus botones no escriben nada.
  // ⚠️ LAS RESPUESTAS RÁPIDAS DEL HILO SIN LA APP (29/10/2026): mandan un mensaje al turno, que sin la app no sale; tocarlas no
  // hacía nada y no lo decía. Ahora lo dicen (`sinMandar`) y no se tocan.
  return (
    <ContextoWA.Provider value={k.esAutomatizacion || k.esEditor ? null : k.accionesWA}>
      {!k.cargado ? null : k.errorCarga ? (
        <div className="co-portada">
          <p className="co-portada__dato">{k.errorCarga}</p>
          <button type="button" className="co-chip" onClick={k.recargar}>Reintentar</button>
        </div>
      ) : !k.items.length && !k.trabajo ? (apertura ?? (k.app === 'bloquea' ? null : (
        <div className="co-portada">
          <Muneco titulo={k.nombreMuneco} aspecto={k.aspectoMuneco} animo="despierto" size={76} />
          <p className="co-portada__nombre">{k.esAutomatizacion || k.esEditor ? 'Todavía no hay mensajes en esta charla.' : '¿En qué te ayudo?'}</p>
          {(k.esJefe || k.idTurno == null) && k.idOffer == null && !k.esAutomatizacion && !k.esEditor && <div className="ch-arranques">
            {ARRANQUES_SECOND_BRAIN.map((a) => <button key={a} type="button" className="co-chip" onClick={() => k.enviar(a)}>{a}</button>)}
          </div>}
        </div>
      ))) : (<>
        <HiloMako items={k.items} quien={{ nombre: k.nombreMuneco, aspecto: k.aspectoMuneco }} ahora={k.ahora} escribiendo={k.enCurso ? { segs: k.segs } : null}
          tarjeta={k.tarjeta} onTarjeta={(x, a) => void k.correrTarjeta(x, a)} onReintentar={k.reintentar} onRecargar={k.recargar}
          onResponder={(t) => k.enviar(t)} sinMandar={k.app === 'bloquea' ? FRASE_RESPONDER : null} onTrabajo={k.alTerminarTrabajo} marcas={k.marcas} />
        {apertura}
      </>)}
    </ContextoWA.Provider>
  );
}

/**
 * La caja del chat del cliente: la ÚNICA de la app (Martín, 20/10: «Te pedí que unificaras el chat del Ops Center en todos lados,
 * su diseño y funcionalidades»). `movil`: la del teléfono, como la de ChatsMovil.tsx (Enter baja de renglón, crece el CSS).
 * `angosta`: el panel de la estrella (440 px) y el teléfono; lo que no es el campo va arriba y no le come el ancho.
 * `avisosArriba`: «Conectar tu IA» y la franja de la app los dibuja la pantalla, en una línea debajo de su cabecera (la
 * conversación del teléfono, app/m/_chat/AvisoDeIA.tsx); la caja no los repite.
 */
export function CajaDelCliente({ k, campo, seguir, movil = false, angosta = movil, avisosArriba = false }: {
  k: ChatCliente; campo: RefObject<HTMLTextAreaElement | null>; seguir: () => HTMLElement | null; movil?: boolean; angosta?: boolean;
  avisosArriba?: boolean;
}) {
  // Antes de cualquier `return`: es un hook (su estado es «ya lo descargó»).
  const bloqueoApp = useBloqueoApp(() => k.setConectando(true));
  // Una charla del lienzo de Automations (OC5): se lee acá y se sigue en el lienzo, que es el que sabe editar la automatización.
  // Un chat de un editor (OC8): se lee acá y se sigue en el editor, que es el que aplica lo que propone.
  if (k.esEditor) {
    // El de otra persona del equipo se lee acá: en el editor se abriría el tuyo (`hrefEditor` es null).
    return k.hrefEditor
      ? <p className="co-solo-lectura" role="note">{AVISO_EDITOR} <a className="ch-enlace" href={k.hrefEditor}>Seguir en el editor</a></p>
      : <p className="co-solo-lectura" role="note">{AVISO_EDITOR_AJENO}</p>;
  }
  if (k.esAutomatizacion) {
    return <p className="co-solo-lectura" role="note">{AVISO_LIENZO}{k.hrefLienzo && <> <a className="ch-enlace" href={k.hrefLienzo}>Seguir en el lienzo</a></>}</p>;
  }
  // Sin su Claude o su GPT, el botón para conectarlo («Tus cuentas de IA», ahí mismo). En la caja ancha, al final de la fila (Martín,
  // 21/10). En la ANGOSTA, como chip ARRIBA del campo: al final le comía el ancho y «Escribe a Cerebro» salía cortado (Offer, en
  // producción, 22/10/2026). No con una container query: la contención de `.co-caja` volvería ella el marco de lo `fixed` de
  // adentro (el «+», los emojis).
  const conectar = k.iaConectada === false && !avisosArriba
    ? <button type="button" className="co-chip co-conectar-ia" onClick={() => k.setConectando(true)} {...ancla('mk-conectar')}>Conectar tu IA</button> : null;
  // Sin la app de escritorio no hay con qué contestar: LA CAJA MISMA no deja escribir, y en el lugar del micrófono dice «Instalar
  // MaKo» (24/10/2026, Martín: «directamente en el chat donde está el botón de audio se debería reemplazar por "Instalar MaKo"»).
  // Es la misma caja (una sola), con `bloqueo`; sin el «Conectar tu IA», que con la app sin instalar no destraba nada.
  const bloqueada = k.app === 'bloquea';
  return (
    <CajaChat texto={k.texto} onTexto={(v) => { k.setFaltaMic(null); k.setTexto(v); }} onMandar={k.enviarCaja}
      ocupado={k.enCurso} apagado={!k.cargado || !!k.errorCarga} placeholder={`Escribe a ${k.nombre}`} tituloMandar={movil ? undefined : 'Mandar (Enter)'}
      enterManda={!movil} campo={campo} seguir={seguir} onErrorMic={k.setFaltaMic} adjuntos={k.adjuntosCaja} voz={k.vozCaja}
      {...(movil ? { altoMax: null, fila: 'm-operaciones-caja__fila' } : {})}
      hayAlgoMas={k.pegados.length > 0} onPegar={k.pegarLargo}
      // Con qué IA corre este chat (8b): adentro del «+», sólo si hay cuentas para elegir.
      mas={k.cuentasIA?.length ? <SelectoresDelCliente k={k} /> : undefined}
      alFinal={angosta || bloqueada ? null : conectar}
      bloqueo={bloqueada ? bloqueoApp : undefined}
      arriba={<>
        {angosta && conectar && !bloqueada && <div className="co-conectar-ia-arriba">{conectar}</div>}
        {/* En el teléfono, sin la app: el aviso de descargarla en la computadora, y el chat sigue (ahí no se instala). */}
        {k.app === 'en-la-computadora' && !avisosArriba && <FranjaApp />}
        {k.cita && <CitaCaja cita={k.cita} onQuitar={() => k.setCita(null)} />}
        {k.pegados.length > 0 && (
          <ul className="ch-elegidos" aria-label="Textos pegados">
            {k.pegados.map((p) => (
              <li key={p.id} className="ch-elegido ch-elegido--pegado">
                <IconoChat nombre="archivo" size={20} />
                <span className="ch-elegido__nombre" title={nombrePegado(p.texto)}>{`${nombrePegado(p.texto, 24)} · ${caracteres(p.texto)}`}</span>
                <button type="button" className="ch-elegido__quitar" onClick={() => k.quitarPegado(p.id)} aria-label="Quitar el texto pegado">
                  <Icon name="x" size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </>} />
  );
}

/** La línea de abajo de la caja: lo que dijo el micrófono, el «+», una marca que no se guardó, o que Offer está armando. */
export const estadoDelCliente = (k: ChatCliente): string => k.faltaMic ?? (k.armandoOffer ? 'MaKo está armando tu oferta. Puede tardar unos minutos.' : k.resumenIA ?? '');
