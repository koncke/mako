'use client';

// =============================================================================
// VisorToma — mirar una toma, y el anuncio entero de corrido
// =============================================================================
// El medio vertical grande vive en DOS lugares y este es uno: acá y en la
// comparación del escenario. En la lista de tomas no hay ninguno — se reservaba
// un hueco de 176×313 por fila, siete veces, para clips que el sistema todavía
// tiene prohibido producir. Eso no era continuidad de layout: eran 2.191 px de
// promesa vacía.
//
// ── Dos reglas, y la segunda es la que hace que esta pantalla siga sirviendo ─
//
// 1. EL VISOR NUNCA ESTÁ VACÍO. Una toma sin filmar muestra la imagen confirmada
//    de SU escenario. No es relleno: la producción va imagen → video, así que esa
//    imagen ES el primer cuadro que se va a animar. El hueco vacío existía porque
//    no se sabía qué poner, y el dato estaba a un `find()` de distancia.
//
// 2. AL TERMINAR, AVANZA. Sin esto, «Ver el anuncio entero» abre UNA toma y es
//    una promesa incumplida. Con un `onEnded` y un índice, las reproduce en orden
//    y se detiene en la primera que falta, mostrando su escenario.
//
// ⚠️ El ancho es 300 px y no 340 ni 360. `Modal` mide `min(85vh, 720px)` con
// header y pie fijos; a 360 el video mide 640 de alto y el pie —donde vive
// «Volver a filmar esta toma» con su línea de costo— cae fuera del viewport en
// una notebook de 900. A 300 el total cierra en ~700.
//
// ⚠️ Y nada de `position: sticky`: no hay uno solo en todo `app/_ui`, un
// `overflow` en cualquier ancestro lo apaga sin síntoma, y con la página sin
// scrollear un sticky roto se ve idéntico a uno sano. Para mostrar el detalle de
// algo, la casa usa `Modal`.

import { useCallback, useEffect, useState } from 'react';
import { Modal, Button, IconButton, Status, Spinner } from '@/app/_ui';
import { Icon } from '../_components/icons';
import type { PlanGuardado } from './video-datos';

const ANCHO = 300;

/** El escenario donde se filma esta toma. */
function escenaDe(item: PlanGuardado, n: number) {
  return item.escenas?.find((e) => n >= e.desde && n <= e.hasta) ?? null;
}

export function VisorToma({ item, n, onCerrar, onIr, onFilmar, costoTexto }: {
  item: PlanGuardado;
  n: number;
  onCerrar: () => void;
  /** Ir a otra toma. El visor no navega solo: avisa y quien lo abrió decide. */
  onIr: (n: number) => void;
  onFilmar: (n: number) => void;
  /** Lo que cuesta volver a filmar, ya redactado por quien sabe el saldo. */
  costoTexto: string;
}) {
  const total = item.plan.clips.length;
  const clip = item.plan.clips.find((c) => c.n === n);
  const video = item.video?.[String(n)];
  const escena = escenaDe(item, n);
  const imagen = escena ? item.imagenes?.[String(escena.n)]?.elegida : '';
  const [error, setError] = useState('');

  // ── Avanzar al terminar ─────────────────────────────────────────────────
  // A la SIGUIENTE que tenga video. Si no hay, se queda: mostrar la imagen del
  // escenario de la que falta es más honesto que cerrar el visor de golpe.
  const alTerminar = useCallback(() => {
    for (let k = n + 1; k <= total; k++) {
      if (item.video?.[String(k)]?.url) { onIr(k); return; }
    }
  }, [item, n, total, onIr]);

  // Las flechas del teclado. Es un visor: moverse con el teclado es lo esperado.
  useEffect(() => {
    const alTeclado = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' && n < total) onIr(n + 1);
      if (e.key === 'ArrowLeft' && n > 1) onIr(n - 1);
    };
    window.addEventListener('keydown', alTeclado);
    return () => window.removeEventListener('keydown', alTeclado);
  }, [n, total, onIr]);

  const marco: React.CSSProperties = {
    display: 'block', width: ANCHO, aspectRatio: '9 / 16', objectFit: 'cover',
    borderRadius: 14, background: 'var(--surface-2)', border: '1px solid var(--border)',
  };

  return (
    <Modal
      titulo={`Toma ${n} de ${total}`}
      encabezado={clip ? `${clip.segundos} segundos` : undefined}
      onCerrar={onCerrar}
      ancho={520}
      pie={video?.url ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Button
            variant="mako"
            icon={<Icon name="videogen" size={15} />}
            onClick={() => { setError(''); onFilmar(n); }}
          >
            Volver a filmar esta toma
          </Button>
          {/* La consecuencia PEGADA al botón, en tinta normal y antes del click. */}
          <span style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.45 }}>
            {costoTexto}
          </span>
        </div>
      ) : undefined}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconButton
            title="Ver la toma anterior"
            onClick={() => onIr(n - 1)}
            disabled={n <= 1}
          >
            <Icon name="chevron" size={17} />
          </IconButton>

          {video?.url ? (
            <video
              key={video.url}
              src={video.url}
              controls
              autoPlay
              playsInline
              onEnded={alTerminar}
              style={{ ...marco, background: '#000' }}
            />
          ) : imagen ? (
            <img src={imagen} alt={`El escenario de la toma ${n}`} style={marco} />
          ) : (
            <div style={{ ...marco, display: 'grid', placeItems: 'center' }}>
              <Spinner size={20} />
            </div>
          )}

          <IconButton
            title="Ver la toma siguiente"
            onClick={() => onIr(n + 1)}
            disabled={n >= total}
          >
            <span style={{ display: 'inline-flex', transform: 'rotate(180deg)' }}>
              <Icon name="chevron" size={17} />
            </span>
          </IconButton>
        </div>

        {/* Qué se está mirando, en una línea. El visor no muestra nada que haya
            que LEER: para eso está la lista. Esto es el rótulo, no el guion. */}
        {!video?.url && (
          <div style={{ textAlign: 'center', maxWidth: 380 }}>
            <Status tono={video?.trabajoId ? 'mako' : 'neutral'}>
              {video?.trabajoId ? 'Filmando' : 'Sin filmar'}
            </Status>
            <p style={{ margin: '9px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.55 }}>
              {video?.trabajoId
                ? `Google está filmando la toma ${n}. Suele tardar entre 1 y 3 minutos.`
                : imagen
                  ? `Así arranca la toma ${n}. Todavía no se filmó.`
                  : `Esta toma se filma en el escenario ${escena?.n ?? 1}, que todavía no está confirmado.`}
            </p>
            {!video?.trabajoId && imagen && (
              <div style={{ marginTop: 13, display: 'flex', justifyContent: 'center' }}>
                <Button
                  variant="mako"
                  icon={<Icon name="videogen" size={15} />}
                  onClick={() => { setError(''); onFilmar(n); }}
                >
                  Filmar la toma {n}
                </Button>
              </div>
            )}
            {!video?.trabajoId && imagen && (
              <div style={{ marginTop: 7, fontSize: 'var(--fs-sm)', color: 'var(--ink)' }}>
                {costoTexto}
              </div>
            )}
          </div>
        )}

        {error && (
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--bad)' }}>{error}</div>
        )}
      </div>
    </Modal>
  );
}
