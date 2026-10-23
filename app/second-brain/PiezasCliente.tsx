'use client';

// =============================================================================
// Las piezas del chat del cliente que dibujan la computadora y el teléfono (22/10/2026)
// =============================================================================
// El motor es useChatCliente.ts; esto es lo que se ve adentro de cada panel: el hilo (HiloMako, con lo de WhatsApp y la portada
// del chat vacío) y la caja ÚNICA (app/_chat/CajaChat.tsx) con todo lo suyo: la cita del mensaje que se responde, los textos
// largos pegados como documento y, si la persona no tiene su IA, «Conectar tu Claude» al final. La computadora lo pone en el
// panel del Ops Center (PanelChat.tsx) y el teléfono en su hoja (SheetM), como el super admin pone el suyo
// (Conversacion.tsx y ChatsMovil.tsx). Una sola vez, para que no se separen.

import type { RefObject } from 'react';
import { Icon } from '@/app/_components/icons';
import { CajaChat } from '@/app/_chat/CajaChat';
import { HiloMako } from '@/app/_chat/HiloMako';
import { CitaCaja, ContextoWA } from '@/app/admin/operaciones/MensajeWA';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { IconoChat } from '@/app/m/mako/iconos';
import { caracteres, nombrePegado } from '@/lib/chat-pegado';
import { ARRANQUES_SECOND_BRAIN, AVISO_EDITOR, AVISO_EDITOR_AJENO, AVISO_GRUPO, AVISO_LIENZO } from '@/lib/chat-mako-reglas';
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
        <button type="button" className="co-acceso" onClick={onAbrir} title="Tus cuentas de IA">
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

export function HiloDelCliente({ k }: { k: ChatCliente }) {
  // El grupo de WhatsApp se lee: sin el menú de un mensaje (no se responde, no se reacciona; se contesta en el grupo).
  return (
    <ContextoWA.Provider value={k.esGrupo || k.esAutomatizacion || k.esEditor ? null : k.accionesWA}>
      {k.esGrupo && k.hayMasDelGrupo && k.cargado && (
        <div className="co-anteriores">
          <button type="button" className="co-chip" onClick={() => void k.verAnteriores()} disabled={k.trayendoAnteriores}>
            {k.trayendoAnteriores ? 'Trayendo…' : 'Ver anteriores'}
          </button>
        </div>
      )}
      {!k.cargado ? null : k.errorCarga ? (
        <div className="co-portada">
          <p className="co-portada__dato">{k.errorCarga}</p>
          <button type="button" className="co-chip" onClick={k.recargar}>Reintentar</button>
        </div>
      ) : !k.items.length && !k.trabajo ? (
        <div className="co-portada">
          <Muneco titulo={k.nombreMuneco} aspecto={k.aspectoMuneco} animo="despierto" size={76} />
          <p className="co-portada__nombre">{k.esGrupo ? 'Todavía no hay mensajes en el grupo.' : k.esAutomatizacion || k.esEditor ? 'Todavía no hay mensajes en esta charla.' : '¿En qué te ayudo?'}</p>
          {(k.esJefe || k.idTurno == null) && k.idOffer == null && !k.esGrupo && !k.esAutomatizacion && !k.esEditor && <div className="ch-arranques">
            {ARRANQUES_SECOND_BRAIN.map((a) => <button key={a} type="button" className="co-chip" onClick={() => k.enviar(a)}>{a}</button>)}
          </div>}
        </div>
      ) : (
        <HiloMako items={k.items} quien={{ nombre: k.nombreMuneco, aspecto: k.aspectoMuneco }} ahora={k.ahora} escribiendo={k.enCurso ? { segs: k.segs } : null}
          tarjeta={k.tarjeta} onTarjeta={(x, a) => void k.correrTarjeta(x, a)} onReintentar={k.reintentar} onRecargar={k.recargar}
          onResponder={(t) => k.enviar(t)} onTrabajo={k.alTerminarTrabajo} marcas={k.marcas} />
      )}
    </ContextoWA.Provider>
  );
}

/**
 * La caja del chat del cliente: la ÚNICA de la app (Martín, 20/10: «Te pedí que unificaras el chat del Ops Center en todos lados,
 * su diseño y funcionalidades»). `movil`: la del teléfono, como la de ChatsMovil.tsx (Enter baja de renglón, crece el CSS).
 * `angosta`: el panel de la estrella (440 px) y el teléfono; lo que no es el campo va arriba y no le come el ancho.
 */
export function CajaDelCliente({ k, campo, seguir, movil = false, angosta = movil }: {
  k: ChatCliente; campo: RefObject<HTMLTextAreaElement | null>; seguir: () => HTMLElement | null; movil?: boolean; angosta?: boolean;
}) {
  // El grupo de WhatsApp de MaKo no se sigue desde acá: en lugar de la caja, dónde se contesta.
  if (k.esGrupo) return <p className="co-solo-lectura" role="note">{AVISO_GRUPO}</p>;
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
  const conectar = k.iaConectada === false
    ? <button type="button" className="co-chip co-conectar-ia" onClick={() => k.setConectando(true)}>Conectar tu IA</button> : null;
  return (
    <CajaChat texto={k.texto} onTexto={(v) => { k.setFaltaMic(null); k.setTexto(v); }} onMandar={k.enviarCaja}
      ocupado={k.enCurso} apagado={!k.cargado || !!k.errorCarga} placeholder={`Escribe a ${k.nombre}`} tituloMandar={movil ? undefined : 'Mandar (Enter)'}
      enterManda={!movil} campo={campo} seguir={seguir} onErrorMic={k.setFaltaMic} adjuntos={k.adjuntosCaja} voz={k.vozCaja}
      {...(movil ? { altoMax: null, fila: 'm-operaciones-caja__fila' } : {})}
      hayAlgoMas={k.pegados.length > 0} onPegar={k.pegarLargo}
      // Con qué IA corre este chat (8b): adentro del «+», sólo si hay cuentas para elegir.
      mas={k.cuentasIA?.length ? <SelectoresDelCliente k={k} /> : undefined}
      alFinal={angosta ? null : conectar}
      arriba={<>
        {angosta && conectar && <div className="co-conectar-ia-arriba">{conectar}</div>}
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
