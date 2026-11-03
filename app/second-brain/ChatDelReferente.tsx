'use client';

// =============================================================================
// El chat con un GURÚ, adentro del Ops Center (3/11/2026, #16 y #18)
// =============================================================================
// Martín: «me interesa que se avance con los gurús, y el second brain de cada uno». Se elige desde «Nuevo chat» con el mismo
// selector de los coaches (./ElegirReferente.tsx), y es EL CHAT ÚNICO DE LA APP (AGENTS.md), copiado de ./ChatDelCoach.tsx: el
// panel, el hilo y la caja del Ops Center, y el motor useChatCliente → /api/mako/chat → turnoApp.
//   · SU HILO ES SUYO: una conversación por persona, negocio y gurú (`…:referente-<id>`, lib/chat-mako-reglas.ts). Elegir otra
//     vez al mismo gurú la retoma.
//   · ⚠️ LO QUE LO HACE GURÚ NO ES ESTA PANTALLA: es la CLAVE de la conversación, que lee el servidor (app/api/mako/chat/route.ts →
//     `contextoDelChat`): su ficha en cada mensaje y los tramos de su curso que hablan de la pregunta (lib/cerebro-referente.ts →
//     `cursoParaElTurno`). Por eso retomarla desde la lista del Ops Center sigue siendo con él.
//   · «SU SECOND BRAIN» (#18): el grafo de SU curso, una clase por punto, encima del chat. Lo acomoda el servidor
//     (`?cerebroDe=`), sin el texto de las clases.

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Modal } from '@/app/_ui';
import { CargandoMako } from '@/app/_ui/CargandoMako';
import { PanelDeChat } from '@/app/admin/operaciones/PanelChat';
import { BarraFijados, InfoMensaje, MenuMensajeWA } from '@/app/admin/operaciones/MensajeWA';
import { TusCuentasIA } from '@/app/integraciones/TusCuentasIA';
import { HiloMako } from '@/app/_chat/HiloMako';
import { useChatCliente } from './useChatCliente';
import { CajaDelCliente, HiloDelCliente, estadoDelCliente } from './PiezasCliente';
import { aspectoDeReferente } from '@/lib/centro-munecos';
import { tabDeReferente, type ElegidoChat } from '@/lib/chat-mako-reglas';
import { inspiradoEn, type Asesor } from '@/lib/asesores/catalogo';
import { filtroVacio, type EstadoFiltro } from '@/lib/cerebro-filtro';
import type { Cerebro } from '@/lib/cerebro-modelo';
import type { ItemHilo } from '@/app/m/mako/chat-ui';
import type { SesionChat } from '@/lib/mako-turno-app-reglas';

// El grafo pesa (la física y el lienzo): se baja recién cuando se abre su Second Brain.
const Grafo = dynamic(() => import('./Grafo').then((m) => m.Grafo), { ssr: false, loading: () => <CargandoMako que="su Second Brain" alto="100%" /> });

/** Lo que dice el chat vacío. No se guarda: es la portada. Es MaKo con sus marcos, nunca la persona. */
export const saludoDelReferente = (a: Pick<Asesor, 'completo' | 'curso'>): string =>
  `Te ayudo con lo que enseña ${a.completo} en «${a.curso}», llevado a tu negocio. ¿Qué quieres resolver?`;

export function ChatDelReferente({ referente: r, onVolver }: { referente: Asesor; onVolver: () => void }) {
  const tab = tabDeReferente(r.id);
  const [elegido, setElegido] = useState<ElegidoChat | null>(null);
  const hilo = useRef<HTMLDivElement>(null);
  const caja = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/mako/chat?deTab=${encodeURIComponent(tab)}`, { cache: 'no-store' })
      .then((x) => (x.ok ? x.json() : null)).catch(() => null)
      .then((j: { sesion?: SesionChat | null } | null) => { if (vivo) setElegido(j?.sesion ? { antes: j.sesion.id } : { virtual: 'nuevo' }); });
    return () => { vivo = false; };
  }, [tab]);
  const k = useChatCliente({ elegido, setElegido, activo: false, entrarAlCerebro: false, chatInicial: null, opcionArmar: '', busca: '', caja, tab });
  const { mirarSuIA } = k;
  useEffect(() => { mirarSuIA(); }, [mirarSuIA]);
  useLayoutEffect(() => { const el = hilo.current; if (el) el.scrollTop = el.scrollHeight; }, [k.items.length, k.trabajo]);
  const seguirHilo = useCallback(() => hilo.current, []);

  const [viendoCerebro, setViendoCerebro] = useState(false);
  const aspecto = aspectoDeReferente(r.id);
  const quien = useMemo(() => ({ nombre: r.nombre, aspecto }), [r.nombre, aspecto]);
  const vacio = elegido != null && k.cargado && !k.errorCarga && !k.items.length && !k.trabajo;
  const saludo = useMemo<ItemHilo[]>(() => [{ k: 'msg', id: `saludo-${r.id}`, role: 'assistant', texto: saludoDelReferente(r), at: new Date().toISOString() }], [r]);

  return (
    <>
      <PanelDeChat hilo={hilo} adjuntos={k.adjuntosCaja}
        cabecera={{
          clave: tab, titulo: r.nombre, aspecto, animo: k.enCurso ? 'trabajando' : 'despierto', onVolver,
          acciones: (
            <>
              <span className="co-cab__inspirado">{inspiradoEn(r)}</span>
              <button type="button" className="co-chip" onClick={() => setViendoCerebro(true)}>Su Second Brain</button>
            </>
          ),
        }}
        arriba={<BarraFijados marcas={k.marcas} lineas={[]} mensajes={k.mensajesWA} titulo={r.nombre} onSoltar={(id) => void k.ponerMarca({ tipo: 'fijar', id, si: false })} />}
        despues={<>
          <MenuMensajeWA abierto={k.menuWA} marcas={k.marcas} onCerrar={() => k.setMenuWA(null)} onElegir={k.elegirEnMenu} sin={['reenviar']} />
          {k.infoWA && <Modal titulo="Info del mensaje" onCerrar={() => k.setInfoWA(null)} ancho={460}><InfoMensaje m={k.infoWA} /></Modal>}
        </>}
        caja={<div className="co-caja"><CajaDelCliente k={k} campo={caja} seguir={seguirHilo} /></div>}
        estado={estadoDelCliente(k)}>
        {vacio ? (
          <HiloMako items={saludo} quien={quien} ahora={k.ahora} escribiendo={null} tarjeta={null}
            onTarjeta={() => {}} onReintentar={() => {}} onRecargar={k.recargar} onResponder={(t) => k.enviar(t)} />
        ) : <HiloDelCliente k={k} />}
      </PanelDeChat>
      {viendoCerebro && <SuSecondBrain referente={r} onCerrar={() => setViendoCerebro(false)} />}
      {k.conectando && (
        <Modal titulo="Tus cuentas de IA" onCerrar={() => { k.setConectando(false); k.mirarSuIA(); }} ancho={640}>
          <TusCuentasIA sinCabecera conectar />
        </Modal>
      )}
    </>
  );
}

/** El grafo de SU curso: la raíz, una clase por punto y las clases encadenadas en orden (lib/cerebro-referente.ts). */
function SuSecondBrain({ referente: r, onCerrar }: { referente: Asesor; onCerrar: () => void }) {
  const [cerebro, setCerebro] = useState<Cerebro<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoFiltro>(filtroVacio);
  useEffect(() => {
    let vivo = true;
    void fetch(`/api/mako/chat?cerebroDe=${encodeURIComponent(r.id)}`, { cache: 'no-store' })
      .then((x) => x.json()).catch(() => null)
      .then((j: { ok?: boolean; cerebro?: Cerebro<string>; error?: string } | null) => {
        if (!vivo) return;
        if (j?.ok && j.cerebro) setCerebro(j.cerebro);
        else setError(j?.error ?? 'No se pudo leer su Second Brain. Prueba de nuevo en un momento.');
      });
    return () => { vivo = false; };
  }, [r.id]);
  return (
    <Modal titulo={`El Second Brain de ${r.nombre}`} onCerrar={onCerrar} ancho={1100} alto="min(84vh, 760px)">
      {/* En oscuro, como el Second Brain del negocio (VistaCerebro.tsx): el grafo está pensado para ese fondo. */}
      <div data-tema="oscuro" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)', colorScheme: 'dark', borderRadius: 12, overflow: 'hidden' }}>
        {error ? <p className="co-vacio">{error}</p>
          : cerebro ? <Grafo cerebro={cerebro} filtro={filtro} onFiltro={setFiltro} />
          : <CargandoMako que="su Second Brain" alto="100%" />}
      </div>
    </Modal>
  );
}
