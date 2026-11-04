'use client';

// =============================================================================
// El chat del Second Brain: la columna derecha del grafo es una conversación con MaKo (23/10/2026)
// =============================================================================
// Martín: «quiero que Second Brain, la sidebar que tiene a la derecha sea reemplazada por un chat con MaKo, que tenga la criatura
// de MaKo... Que se guarde el historial claro, pero que si no hay nada que MaKo mande el mensaje "Hola NOMBRE. Este es tu Second
// Brain, aquí está toda la información de tu negocio. ¿Qué quieres saber hoy?"».
//   · ES EL CHAT DEL OPS CENTER (la regla de UN chat en toda la app): el motor (useChatCliente.ts), el panel (PanelChat.tsx), el
//     hilo y la caja (PiezasCliente.tsx), como los monta la estrella de cada tab (app/_chat/MakoEnLaTab.tsx);
//   · SU HILO ES SUYO: una conversación por persona y por negocio (`mako-movil:<persona>:second-brain`, lib/chat-mako-reglas.ts →
//     TAB_SECOND_BRAIN). Se crea con el primer mensaje y el Ops Center la lista en el grupo «Second Brain»;
//   · VACÍO, MaKo saluda con el nombre de pila de quien mira, y debajo lo que antes se leía en la barra del grafo, para
//     preguntárselo (ARRANQUES_DEL_SECOND_BRAIN). El saludo no se guarda: es la portada del chat vacío.
// Lo que mostraba la barra (y dónde quedó): cuántas cosas sabe MaKo → la cabecera del Second Brain (VistaCerebro.tsx); el
// detalle de un punto, con «Ver el documento» y «Editar <área>» → al tocar un punto, encima del chat (Grafo.tsx); las áreas con
// su filtro → el «Filtrar» del lienzo; «Editar» de cada área → el detalle de su punto; Tu Norte, el cuello de botella y «Lo
// último» → se le preguntan a MaKo (los arranques).
// ⚠️ Trae CSS (las piezas del Ops Center): VistaCerebro.tsx lo carga con next/dynamic.

import '@/app/admin/operaciones/centro.css';
import '@/app/_chat/chat.css';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '@/app/_ui';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { HiloMako, esRespuestaDeMaKo } from '@/app/_chat/HiloMako';
import { useChatCliente } from './useChatCliente';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from './PiezasCliente';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { ARRANQUES_DEL_SECOND_BRAIN, ORIGEN_SECOND_BRAIN, TAB_SECOND_BRAIN, saludoDelSecondBrain, type ElegidoChat } from '@/lib/chat-mako-reglas';
import type { Desde } from '@/lib/chat-desde';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { SesionChat } from '@/lib/mako-turno-app-reglas';

/** De dónde escribe la persona: el turno sabe que está mirando su Second Brain (y el mensaje lleva su chip). */
const DESDE: Desde = { tab: ORIGEN_SECOND_BRAIN, entidad: null, modo: null };

export default function ChatDelSecondBrain({ movil = false }: {
  /** El teléfono: la caja del teléfono (Enter baja de renglón). */
  movil?: boolean;
}) {
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  // SU conversación, si ya habló: se lee, no se crea (la crea el primer mensaje, `tab`). Sin ella, el chat vacío con el saludo.
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/mako/chat?deTab=${TAB_SECOND_BRAIN}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { sesion?: SesionChat | null } | null) => { if (vivo) setElegido(j?.sesion ? { antes: j.sesion.id } : { virtual: 'nuevo' }); });
    return () => { vivo = false; };
  }, []);
  // El nombre de quien mira, para el saludo.
  const [nombre, setNombre] = useState<string | null>(null);
  useEffect(() => {
    let vivo = true;
    void fetch('/api/auth/me', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null)
      .then((j: { nombre?: string | null } | null) => { if (vivo) setNombre(j?.nombre ?? ''); });
    return () => { vivo = false; };
  }, []);
  // El motor del Ops Center, sin la lista (`activo: false`): acá hay UNA conversación.
  const k = useChatCliente({ elegido, setElegido, activo: false, entrarAlCerebro: false, chatInicial: null, opcionArmar: '', busca: '', caja, desde: DESDE, tab: TAB_SECOND_BRAIN });
  // «Conectar tu IA» al final de la caja, como en el Ops Center (la lista no se lee, pero esto sí).
  const { mirarSuIA } = k;
  useEffect(() => { mirarSuIA(); }, [mirarSuIA]);
  // Como un chat: abre en lo último y baja con lo nuevo.
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [k.items.length, k.trabajo]);
  const seguirHilo = useCallback(() => hilo.current, []);

  /** Vacío y cargado: el saludo de MaKo (no se guarda). */
  const vacio = elegido != null && k.cargado && !k.errorCarga && !k.items.length && !k.trabajo;
  const saludo = useMemo<ItemHilo[]>(() => (nombre == null ? [] : [{ k: 'msg', id: 'saludo-sb', role: 'assistant', texto: saludoDelSecondBrain(nombre), at: new Date().toISOString() }]), [nombre]);

  return (
    <>
      <PanelDeChat hilo={hilo} adjuntos={k.adjuntosCaja}
        cabecera={{ clave: 'second-brain', titulo: 'MaKo', criatura: 'MaKo', aspecto: ASPECTO_MAKO, animo: k.enCurso ? 'trabajando' : 'despierto', onVolver: () => {} }}
        arriba={<BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo="MaKo" onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />}
        despues={<>
          <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} reportable={esRespuestaDeMaKo} />
          {k.infoWA && <Modal titulo="Info del mensaje" onCerrar={() => k.setInfoWA(null)} ancho={460}><InfoMensaje m={k.infoWA} /></Modal>}
        </>}
        caja={<div className="co-caja"><CajaDelCliente k={k} campo={caja} seguir={seguirHilo} movil={movil} angosta /></div>}
        estado={estadoDelCliente(k)}>
        {vacio ? (
          <>
            <HiloMako items={saludo} quien={{ nombre: 'MaKo', aspecto: ASPECTO_MAKO }} ahora={k.ahora} escribiendo={null} tarjeta={null}
              onTarjeta={() => {}} onReintentar={() => {}} onRecargar={k.recargar} onResponder={(t) => k.enviar(t)} />
            <div className="ch-arranques sb-chat__arranques">
              {ARRANQUES_DEL_SECOND_BRAIN.map((a) => <button key={a} type="button" className="co-chip" onClick={() => k.enviar(a)}>{a}</button>)}
            </div>
          </>
        ) : <HiloDelCliente k={k} />}
      </PanelDeChat>
      {k.conectando && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { k.setConectando(false); k.mirarSuIA(); }} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>
      )}
    </>
  );
}
