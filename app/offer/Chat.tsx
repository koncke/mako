'use client';

// =============================================================================
// Chat — la conversación con MaKo sobre la oferta
// =============================================================================
// Los mensajes de MaKo a la izquierda, con su estrella, y el texto por <Markdown>
// (escribe negrita y listas); los del dueño a la derecha, en azul claro — NUNCA en
// dorado: el dorado dice «esto lo hizo MaKo» (app/_ui/LEEME.md, la regla de color).
//
// Debajo del último mensaje de MaKo van sus respuestas rápidas como pastillas
// grandes: un clic manda esa respuesta. Es lo que hace que la tab no sea un
// formulario: la mayoría de las preguntas se contestan sin escribir.
//
// ⚠️ El rótulo del «MaKo está trabajando» sale de GRAMATICA.analizando y viaja con
// su fuente al lado (lib/mako-gramatica.ts: «Revisando · 14 campañas activas»). No
// se inventa un «Pensando…» propio: tres pantallas con tres palabras para el mismo
// estado es lo que la gramática vino a cerrar.

import { useEffect, useRef } from 'react';
import { Button } from '@/app/_ui';
import { Markdown } from '@/app/_components/Markdown';
import { MakoStar } from '@/app/_components/MakoBrand';
import { GRAMATICA } from '@/lib/mako-gramatica';
import type { AdjuntoVista, OfferMensaje } from '@/lib/offer-marco';
import { ChipArchivo } from './ChipArchivo';
import { esOpcionArmar } from './ayudas';

const LECTURA = 760;

function Avatar({ animar = false }: { animar?: boolean }) {
  return (
    <span aria-hidden style={{
      flex: 'none', width: 32, height: 32, borderRadius: 999, marginTop: 2,
      background: 'var(--mako-bg)', border: '1px solid var(--mako-border)',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <MakoStar size={16} animate={animar} />
    </span>
  );
}

function Adjuntos({ lista, alinear }: { lista: AdjuntoVista[]; alinear: 'flex-start' | 'flex-end' }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: alinear }}>
      {lista.map((a) => (
        <ChipArchivo key={a.id} nombre={a.nombre} estado={a.aviso ? 'aviso' : 'listo'} nota={a.aviso} />
      ))}
    </div>
  );
}

function MensajeMako({ m }: { m: OfferMensaje }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <Avatar />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-start' }}>
        <div style={{
          maxWidth: '100%', background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: '4px 18px 18px 18px', padding: '12px 16px',
          fontSize: 'var(--fs-card)', lineHeight: 1.55, color: 'var(--ink)', overflowWrap: 'anywhere',
        }}>
          <Markdown text={m.texto} />
        </div>
        {!!m.adjuntos?.length && <Adjuntos lista={m.adjuntos} alinear="flex-start" />}
      </div>
    </div>
  );
}

function MensajeYo({ m }: { m: OfferMensaje }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
      <div style={{ maxWidth: '82%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
        {m.texto.trim() && (
          <div style={{
            background: 'var(--primary-bg)', color: 'var(--ink)', borderRadius: '18px 18px 4px 18px', padding: '12px 16px',
            fontSize: 'var(--fs-card)', lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
          }}>
            {m.texto}
          </div>
        )}
        {!!m.adjuntos?.length && <Adjuntos lista={m.adjuntos} alinear="flex-end" />}
      </div>
    </div>
  );
}

export function Chat({
  mensajes, pendiente, respondiendo, opcionesHabilitadas, onOpcion,
  puedeConcluir, invitarAArmar, hayConclusion, ocupado, onArmar, onVerOferta, opcionArmar,
}: {
  mensajes: OfferMensaje[];
  /** El mensaje del dueño ya dibujado mientras MaKo contesta (optimista). */
  pendiente: OfferMensaje | null;
  respondiendo: boolean;
  /** Falso mientras se lee un archivo o MaKo contesta: un clic ahí mandaría a medias. */
  opcionesHabilitadas: boolean;
  onOpcion: (op: string) => void;
  puedeConcluir: boolean;
  /** Si después de la última conclusión se siguió hablando (o no hay conclusión). */
  invitarAArmar: boolean;
  hayConclusion: boolean;
  ocupado: boolean;
  onArmar: () => void;
  onVerOferta: () => void;
  /** El texto de la opción que arma la oferta (lib/offer-reglas.ts → OPCION_ARMAR). */
  opcionArmar: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const primera = useRef(true);

  // Autoscroll al último mensaje. La primera vez, sin animación: abrir una sesión
  // larga deslizándose desde arriba se lee como que la pantalla se está moviendo sola.
  const ultimo = mensajes[mensajes.length - 1];
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: primera.current ? 'auto' : 'smooth' });
    primera.current = false;
  }, [mensajes.length, ultimo?.id, pendiente?.id, respondiendo, puedeConcluir, invitarAArmar]);

  // Las respuestas rápidas cuelgan SÓLO del último mensaje, y sólo si es de MaKo:
  // las de una pregunta ya contestada no contestan nada.
  const opciones = !pendiente && ultimo?.de === 'mako' ? (ultimo.opciones ?? []).filter((o) => o.trim()) : [];
  const fuente = pendiente?.adjuntos?.length
    ? `${pendiente.adjuntos.length} ${pendiente.adjuntos.length === 1 ? 'archivo' : 'archivos'}`
    : 'tu respuesta';

  // La tarjeta del final: armar si se puede (y si hay algo nuevo desde la última
  // conclusión), o volver a la oferta que ya está. Mientras MaKo contesta, nada.
  const tarjeta = respondiendo ? null
    : puedeConcluir && invitarAArmar ? 'armar'
      : hayConclusion ? 'ver'
        : null;

  return (
    <div ref={scrollRef} role="log" aria-live="polite" aria-label="Conversación con MaKo"
      style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain' }}>
      <div style={{ maxWidth: LECTURA, marginInline: 'auto', padding: '4px 4px 20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
        {mensajes.map((m) => (m.de === 'mako' ? <MensajeMako key={m.id} m={m} /> : <MensajeYo key={m.id} m={m} />))}

        {opciones.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingLeft: 44, marginTop: -4 }}>
            {opciones.map((op, i) => {
              const armar = esOpcionArmar(op, opcionArmar) && puedeConcluir;
              return (
                <button key={`${i}-${op}`} type="button" className={`of-pill${armar ? ' of-pill--mako' : ''}`}
                  disabled={!opcionesHabilitadas} onClick={() => onOpcion(op)}>
                  {armar && <MakoStar size={14} animate={false} />}
                  {op}
                </button>
              );
            })}
          </div>
        )}

        {pendiente && <MensajeYo m={pendiente} />}

        {respondiendo && (
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }} role="status">
            <Avatar animar />
            <span style={{ fontSize: 'var(--fs-md)', color: 'var(--dim)' }}>
              <span style={{ color: 'var(--mako-ink)', fontWeight: 600 }}>{GRAMATICA.analizando.rotulo}</span>
              {' · '}{fuente}
              <span className="of-puntos" aria-hidden><span>.</span><span>.</span><span>.</span></span>
            </span>
          </div>
        )}

        {tarjeta && (
          <div style={{
            marginTop: 6, padding: '22px 20px', borderRadius: 18, display: 'flex', justifyContent: 'center',
            background: tarjeta === 'armar' ? 'var(--mako-bg)' : 'var(--surface)',
            border: `1px solid ${tarjeta === 'armar' ? 'var(--mako-border)' : 'var(--border)'}`,
          }}>
            {tarjeta === 'armar'
              ? (
                <Button variant="mako" size="xl" disabled={ocupado} onClick={onArmar} icon={<MakoStar size={18} color="currentColor" />}>
                  Armar mi oferta
                </Button>
              )
              : <Button variant="secondary" size="lg" onClick={onVerOferta}>Ver mi oferta</Button>}
          </div>
        )}
      </div>
    </div>
  );
}
