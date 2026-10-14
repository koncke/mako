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
// ⚠️ Y EL REPRODUCTOR NO ES LA ÚNICA PUERTA. Cuatro cosas distintas pueden fallar
// —la descarga del cuerpo, el archivo del reproductor, que la grabación llegue
// cortada, y que llegue sin la foto de la página— y cada una tiene su frase y su
// salida. Un pop-up que se queda girando
// es indistinguible de un producto roto, y «no se pudo» sin nada que apretar deja
// un dato que existe del otro lado de una pared.
// =============================================================================

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { Button, Modal, Spinner } from '@/app/_ui';
import { REPLAY_MINIMO_EVENTOS, duracionCorta, parsearCuerpo, textoDelCorte, tieneFoto, type SesionDeLead } from '@/lib/replay-ficha';
import { cargarReproductor, type CargaDelReproductor, type Reproductor } from '@/lib/replay-reproductor';
import { useTzWorkspace } from './useTzWorkspace';

const ANCHO = 720;

/**
 * Cuánto se espera el cuerpo de la grabación. Pesa 50-100 KB y baja en ~2 s (medido el
 * 13/10/2026 sobre las 12 últimas sesiones): pasado esto no es lento, está colgado, y un
 * `fetch` sin `signal` no se rinde nunca (AGENTS.md: el tope de la ruta no protege al cliente).
 */
const ESPERA_CUERPO_MS = 30_000;

/** Qué está pasando. Cada fallo es un estado propio porque cada uno se arregla distinto. */
type Fase =
  | { k: 'bajando' }
  | { k: 'listo'; ilegibles: number }
  | { k: 'sin_reproductor' }
  | { k: 'cortada' }
  | { k: 'sin_foto' }
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
  const lienzo = useRef<HTMLDivElement | null>(null);
  // El texto que bajó, para poder ofrecerlo si el reproductor es lo que falla: la
  // grabación ya está en esta pestaña y no se pierde por un archivo que no cargó.
  const crudo = useRef<string | null>(null);
  // Lo que hace falta para montar —el reproductor y los eventos— y lo montado.
  const listo = useRef<{ r: Extract<CargaDelReproductor, { ok: true }>; eventos: unknown[] } | null>(null);
  const montado = useRef<Reproductor | null>(null);

  /**
   * Monta el reproductor si están LAS DOS cosas: lo bajado y el recuadro en el DOM.
   *
   * ⚠️ HASTA EL 13/10/2026 SE MONTABA EN UN `requestAnimationFrame` pedido justo después de
   * `setFase('listo')`, con un `if (!nodo) return` mudo. Medido en producción (ws1, lead 2636,
   * envolviendo el rAF): el callback corrió 4 ms después de pedirlo y el recuadro TODAVÍA NO
   * EXISTÍA — React no había dibujado el render de 'listo'—, así que salía callado, y el recuadro
   * aparecía después vacío, gris, para siempre. Martín: «se quedó cargando eternamente». Montada a
   * mano en la misma página, la misma grabación andaba (166 eventos). Ahora lo llaman los DOS
   * momentos —cuando termina de bajar y cuando el recuadro se engancha (`refLienzo`)—, y el que
   * llega segundo es el que monta.
   */
  const intentarMontar = useCallback(() => {
    const nodo = lienzo.current;
    const l = listo.current;
    if (!nodo || !l || montado.current) return;
    try {
      // El ancho se LEE del DOM (nunca se calcula) porque el modal lo fija.
      montado.current = l.r.montar(nodo, l.eventos, nodo.clientWidth || ANCHO - 48);
    } catch {
      // El reproductor cargó y reventó con estos eventos: es el mismo callejón
      // que no tenerlo, así que la misma salida — decirlo y ofrecer el archivo.
      setFase({ k: 'sin_reproductor' });
    }
  }, []);

  /** El recuadro se engancha (o se va): si ya está lo bajado, se monta acá. */
  const refLienzo = useCallback((nodo: HTMLDivElement | null) => {
    lienzo.current = nodo;
    intentarMontar();
  }, [intentarMontar]);

  useEffect(() => {
    let vivo = true;
    setFase({ k: 'bajando' });
    crudo.current = null;
    listo.current = null;

    (async () => {
      let texto: string;
      try {
        const res = await fetch(`/api/crm/replay?sesion=${encodeURIComponent(sesion.id)}`, { cache: 'no-store', signal: AbortSignal.timeout(ESPERA_CUERPO_MS) });
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
      // ⚠️ SIN LA FOTO DE LA PÁGINA NO HAY QUÉ DIBUJAR, tenga los eventos que tenga
      // (ver `tieneFoto`): se dice antes de bajar el reproductor, que montaría un
      // cuadro negro. Medido el 08/10/2026: 9 sesiones selladas así, entre ws1 y ws11.
      if (!tieneFoto(eventos)) { setFase({ k: 'sin_foto' }); return; }

      const r = await cargarReproductor();
      if (!vivo) return;
      if (!r.ok) { setFase({ k: 'sin_reproductor' }); return; }

      // Se pinta el contenedor y se monta cuando exista (ver `intentarMontar`): si el recuadro
      // ya estaba, monta acá; si no, lo monta `refLienzo` cuando React lo dibuje.
      listo.current = { r, eventos };
      setFase({ k: 'listo', ilegibles });
      intentarMontar();
    })();

    return () => {
      vivo = false;
      listo.current = null;
      montado.current?.destruir();
      montado.current = null;
    };
  }, [sesion.id, intento, intentarMontar]);

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
          <div ref={refLienzo} style={{ width: '100%', minHeight: 320, borderRadius: 12, overflow: 'hidden', background: 'var(--surface-2)' }} />
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
      {fase.k === 'sin_foto' && <p style={{ fontSize: 13.5, color: 'var(--dim)', margin: 0, lineHeight: 1.5 }}>Llegó sin la página y no se puede reproducir.</p>}
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
