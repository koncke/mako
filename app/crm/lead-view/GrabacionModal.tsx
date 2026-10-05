'use client';

// =============================================================================
// GrabacionModal — la grabación de sesión, reproducida DENTRO de la ficha
// =============================================================================
// Es lo único que el replay propio compra sobre Clarity: que la grabación se vea
// acá y no en el panel de un tercero, en otra pestaña, filtrando por un uuid.
//
// ⚠️ ES UN POP-UP ADENTRO DE UN MODAL (la ficha del lead ya es uno), así que va con
// `anidada`: la ficha NO se apaga detrás —es parte de la misma tarea— y registrarse
// en la pila (`app/_components/pila-modales.ts`) es lo que hace que el Escape de la
// ficha se abstenga. Sin eso, cerrar la grabación cerraría también la ficha, que es
// el bug medido el 27/09/2026 con el detalle de una tarea. Mismo molde que
// `NombrarVideosModal`.
//
// ⚠️ Y EL REPRODUCTOR NO ES LA ÚNICA PUERTA. Tres cosas distintas pueden fallar
// —la descarga del cuerpo, el archivo del reproductor, y que la grabación llegue
// cortada— y cada una tiene su frase y su salida. Un pop-up que se queda girando
// es indistinguible de un producto roto, y «no se pudo» sin nada que apretar deja
// un dato que existe del otro lado de una pared.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Button, Modal, Spinner } from '@/app/_ui';
import { REPLAY_MINIMO_EVENTOS, duracionCorta, parsearCuerpo, textoDelCorte, type SesionDeLead } from '@/lib/replay-ficha';
import { cargarReproductor, type Reproductor } from '@/lib/replay-reproductor';
import { useTzWorkspace } from './useTzWorkspace';

const ANCHO = 720;

/** Qué está pasando. Cada fallo es un estado propio porque cada uno se arregla distinto. */
type Fase =
  | { k: 'bajando' }
  | { k: 'listo'; ilegibles: number }
  | { k: 'sin_reproductor' }
  | { k: 'cortada' }
  | { k: 'no_existe' }
  | { k: 'sin_sellar' }
  | { k: 'sin_descarga' };

const fmtTs = (iso: string, tz: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz,
  }).format(d).replace(',', ' ·');
};

const aviso: CSSProperties = { fontSize: 12.5, color: 'var(--faint)', margin: '0 0 10px', lineHeight: 1.5 };

export function GrabacionModal({ sesion, onCerrar }: { sesion: SesionDeLead; onCerrar: () => void }) {
  const tz = useTzWorkspace();
  const [fase, setFase] = useState<Fase>({ k: 'bajando' });
  const [intento, setIntento] = useState(0);
  const lienzo = useRef<HTMLDivElement>(null);
  // El texto que bajó, para poder ofrecerlo si el reproductor es lo que falla: la
  // grabación ya está en esta pestaña y no se pierde por un archivo que no cargó.
  const crudo = useRef<string | null>(null);

  useEffect(() => {
    let vivo = true;
    let montado: Reproductor | null = null;
    setFase({ k: 'bajando' });
    crudo.current = null;

    (async () => {
      let texto: string;
      try {
        const res = await fetch(`/api/crm/replay?sesion=${encodeURIComponent(sesion.id)}`, { cache: 'no-store' });
        if (!res.ok) {
          // El código dice qué pasó, y son cosas opuestas: 409 es «esperá», 404 es
          // «ya no está» y 5xx es «no pude». Un solo mensaje para los tres mandaría
          // a reintentar algo que no va a cambiar.
          if (!vivo) return;
          setFase({ k: res.status === 409 ? 'sin_sellar' : res.status === 404 ? 'no_existe' : 'sin_descarga' });
          return;
        }
        texto = await res.text();
      } catch {
        if (vivo) setFase({ k: 'sin_descarga' });
        return;
      }
      if (!vivo) return;
      crudo.current = texto;

      const { eventos, ilegibles } = parsearCuerpo(texto);
      if (eventos.length < REPLAY_MINIMO_EVENTOS) { setFase({ k: 'cortada' }); return; }

      const r = await cargarReproductor();
      if (!vivo) return;
      if (!r.ok) { setFase({ k: 'sin_reproductor' }); return; }

      // Se pinta el contenedor ANTES de montar: el nodo tiene que existir y tener
      // ancho, y el ancho se LEE del DOM (nunca se calcula) porque el modal lo fija.
      setFase({ k: 'listo', ilegibles });
      requestAnimationFrame(() => {
        const nodo = lienzo.current;
        if (!vivo || !nodo) return;
        try {
          montado = r.montar(nodo, eventos, nodo.clientWidth || ANCHO - 48);
        } catch {
          // El reproductor cargó y reventó con estos eventos: es el mismo callejón
          // que no tenerlo, así que la misma salida — decirlo y ofrecer el archivo.
          setFase({ k: 'sin_reproductor' });
        }
      });
    })();

    return () => { vivo = false; montado?.destruir(); };
  }, [sesion.id, intento]);

  const bajarEventos = () => {
    const t = crudo.current;
    if (!t) return;
    const url = URL.createObjectURL(new Blob([t], { type: 'application/x-ndjson' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${sesion.id}.jsonl`;
    a.click();
    // El objeto queda vivo hasta que el navegador arranca la descarga.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  };

  if (typeof document === 'undefined') return null;

  const corte = textoDelCorte(sesion.corte);

  return createPortal(
    <Modal
      titulo="Grabación de su visita"
      encabezado={`${fmtTs(sesion.inicio, tz)} · ${duracionCorta(sesion.segundos)}`}
      ancho={ANCHO}
      anidada
      sinFiletes
      onCerrar={onCerrar}
      pie={<Button variant="secondary" onClick={onCerrar}>Cerrar</Button>}
    >
      {/* ⚠️ EL CORTE SE DICE ANTES DE REPRODUCIR. Una grabación que termina en el
          minuto 10 se lee como que la persona se fue ahí, y la cortamos nosotros. */}
      {corte && <p style={aviso}>{corte}</p>}

      {fase.k === 'bajando' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '28px 0', color: 'var(--dim)', fontSize: 13.5 }}>
          <Spinner /> Trayendo la grabación…
        </div>
      )}

      {fase.k === 'listo' && (
        <>
          {/* Lo que se perdió en el camino queda ESCRITO: una grabación a la que le
              falta un pedazo no se puede mostrar como completa. */}
          {fase.ilegibles > 0 && (
            <p style={aviso}>Le faltan {fase.ilegibles} {fase.ilegibles === 1 ? 'pedazo' : 'pedazos'}: se va a ver con saltos.</p>
          )}
          <div ref={lienzo} style={{ width: '100%', minHeight: 320, borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)' }} />
        </>
      )}

      {fase.k === 'sin_reproductor' && (
        <>
          <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: '0 0 4px', lineHeight: 1.5 }}>No se pudo cargar el reproductor.</p>
          <p style={aviso}>La grabación está: no se perdió nada.</p>
          <Button variant="secondary" onClick={bajarEventos} disabled={!crudo.current}>Descargar la grabación</Button>
        </>
      )}

      {fase.k === 'cortada' && <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0, lineHeight: 1.5 }}>Llegó cortada y no alcanza para reproducirla.</p>}
      {fase.k === 'no_existe' && <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0, lineHeight: 1.5 }}>Esta grabación ya no está.</p>}
      {fase.k === 'sin_sellar' && <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0, lineHeight: 1.5 }}>Todavía se está guardando. Se puede ver en unos minutos.</p>}

      {fase.k === 'sin_descarga' && (
        <>
          <p style={{ fontSize: 13.5, color: 'var(--ink)', margin: '0 0 8px', lineHeight: 1.5 }}>No pude bajar la grabación.</p>
          <Button variant="secondary" onClick={() => setIntento((n) => n + 1)}>Volver a intentar</Button>
        </>
      )}
    </Modal>,
    document.body,
  );
}
