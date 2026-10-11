'use client';

// =============================================================================
// ElementoInsertado — el Video y el Insertar del Dashboard (los que llevan algo de OTRO sitio adentro)
// =============================================================================
// Decisión 6 de Martín (11/10/2026): «Closing Analyst va COMPLETO al Dashboard, sumando los elementos
// Enlace, Video e Insertar (embed)». El Enlace es un texto y vive con el texto (./Elemento.tsx); acá van
// los dos que meten un reproductor o una página ajena en la hoja. Qué se ve lo decide lib/embeds.ts
// (`videoDe`, `insertableDe`): esta pantalla no reconoce un host ni arma un `src`.
//
//   · VIDEO: un proveedor de la lista va en su reproductor (iframe); un archivo .mp4/.webm/.m4v/.mov con
//     `<video>`; Fathom (las llamadas del Closing) con su MINIATURA y un clic para reproducir, como la tab
//     Closing. Siempre «Abrir ↗» al link original.
//   · INSERTAR: CUALQUIER https, como el «Insertar URL» de Looker (decisión que Claude le reporta a
//     Martín). Lo conocido pasa por `embedDe` (el `src` lo arma lib/embeds.ts); lo demás va tal cual. Con
//     el sandbox, los permisos y el referrer FIJOS de lib/embeds.ts (SANDBOX_EMBED, ALLOW_EMBED,
//     REFERRER_EMBED): sin `allow-top-navigation`, y NO `no-referrer` (YouTube exige el Referer: sin él,
//     error 153). Nunca nuestro propio host (`esHostPropio`): con allow-scripts + allow-same-origin un
//     iframe de nuestro origen se sacaría el sandbox. El host de ESTA pestaña también cuenta (localhost,
//     un deploy de prueba): `useHostPropio`.
//
// ⚠️ EDITANDO, EL IFRAME Y EL VIDEO VAN CON `pointer-events: none`. Si no, se tragan el clic que
//    selecciona la tarjeta y el arrastre de la grilla (un iframe es otro documento: el mousedown no
//    llega nunca a react-grid-layout).
// ⚠️ LO QUE LLENA LA CAJA VA ABSOLUTO (`LLENO`), adentro de una caja que estira con flex: un
//    `height: 100%` contra un alto de flex da CERO en Safari (AGENTS.md, «Dos reglas de layout»). Es el
//    ÚNICO alto al 100 % del archivo, y tests/graficos-elementos lo cuenta.
// ⚠️ SIN UN COLOR EN HEX: tokens de la app. El fondo de un video es `--sidebar`, que NO cambia en el
//    tema oscuro (es una isla oscura en los dos): un reproductor se ve igual en los dos temas.
// ⚠️ EL PDF NO IMPRIME UN IFRAME (sale en blanco, o pide permisos). Imprime la MINIATURA y el título de
//    un video, y un recuadro con el título y el proveedor de lo insertado (`.lk-solo-imprimir`,
//    editor-css.ts). El link de Fathom NO se imprime: es público, y un papel no se puede revocar.

import { useState, useSyncExternalStore, type CSSProperties, type MouseEvent as ReactMouseEvent } from 'react';
import { ALLOW_EMBED, REFERRER_EMBED, SANDBOX_EMBED, insertableDe, videoDe } from '@/lib/embeds';
import { urlHttps, type Elemento } from '@/lib/graficos-catalogo';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';

/** Lo que llena la caja: el iframe, el video o la miniatura, encima de todo. */
const LLENO: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, margin: 0, display: 'block' };

/** El radio de las tarjetas del tema de la hoja: el reproductor redondea igual que un gráfico. */
const RADIO = 'var(--dash-tarjeta-radio, 16px)';

const nadaQueEscuchar = () => () => {};
/**
 * El host donde corre esta pestaña (`location.hostname`), o null en el server. Con `useSyncExternalStore`
 * y no con un efecto: el server y el primer render del navegador dibujan lo mismo (null) y React pasa al
 * del navegador sin un desajuste de hidratación.
 */
export function useHostPropio(): string | null {
  return useSyncExternalStore(nadaQueEscuchar, () => window.location.hostname, () => null);
}

/**
 * El `src` del reproductor al darle play: con `autoplay=1` (el clic ya fue el pedido de reproducir). El
 * de `videoDe` no lo lleva: es el que se compara contra la lista y tiene que ser estable.
 */
export function srcAlReproducir(src: string): string {
  try {
    const u = new URL(src);
    u.searchParams.set('autoplay', '1');
    return u.toString();
  } catch { return src; }
}

/**
 * Editando, el clic en un link SELECCIONA la tarjeta (sube a su onClick) y no navega. Lo usan el «Abrir ↗»
 * de un video y el Enlace (./Elemento.tsx).
 */
export const soloSeleccionar = (ev: ReactMouseEvent) => ev.preventDefault();

/**
 * El recuadro de un elemento sin contenido (o con uno que no se puede mostrar), sólo EDITANDO: mirando,
 * un elemento vacío no le pide nada a nadie. Lo usan la imagen (./Elemento.tsx), el video y lo insertado.
 */
export function RecuadroVacio({ icono, texto }: { icono: NombreIconoMenu; texto: string }) {
  return (
    <div style={{
      flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      gap: 6, border: '1.5px dashed var(--border-strong)', borderRadius: 8, color: 'var(--faint)', fontSize: 13, textAlign: 'center', padding: 8, overflow: 'hidden',
    }}>
      <IconoMenu nombre={icono} size={22} />
      <span>{texto}</span>
    </div>
  );
}

/** Un iframe con el sandbox, los permisos y el referrer FIJOS de lib/embeds.ts. */
function Marco({ src, titulo, editando }: { src: string; titulo: string; editando: boolean }) {
  return (
    <iframe
      src={src}
      title={titulo}
      sandbox={SANDBOX_EMBED}
      allow={ALLOW_EMBED}
      loading="lazy"
      referrerPolicy={REFERRER_EMBED}
      style={{ ...LLENO, pointerEvents: editando ? 'none' : undefined }}
    />
  );
}

/** La caja del reproductor en pantalla (en el PDF no va: `.lk-sin-imprimir`). */
const cajaPantalla = (fondo: string): CSSProperties => ({ flex: 1, minHeight: 0, minWidth: 0, position: 'relative', overflow: 'hidden', borderRadius: RADIO, background: fondo });

// ── El video ────────────────────────────────────────────────────────────────────────────

/** El video: el reproductor del proveedor, un `<video>` o la miniatura de Fathom; abajo, el título y «Abrir ↗». */
export function CuerpoVideo({ e, editando }: { e: Elemento; editando: boolean }) {
  // Lo que se está reproduciendo y la miniatura que no cargó son DE ESA dirección: cambiar el link los
  // borra solos, sin un efecto que los resetee (el mismo truco que la imagen).
  const [jugando, setJugando] = useState<string | null>(null);
  const [sinMiniatura, setSinMiniatura] = useState<string | null>(null);
  const r = e.url ? videoDe(e.url) : null;

  if (!r || !r.ok) {
    if (editando) return <RecuadroVacio icono="video" texto={r ? r.error : 'Pega el link del video'} />;
    // Mirando, un link guardado que ya no se reconoce (la lista cambió) se sigue pudiendo abrir. ⚠️ Vuelto
    // a sanear (`urlHttps`): lo que llega a un href no depende de que el guardado haya corrido (medido: sin
    // esto, un `javascript:` que se salteó el saneo llegaba al href de este link).
    const link = urlHttps(e.url);
    if (!link) return <div style={{ flex: 1, minHeight: 0 }} />;
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <a href={link} target="_blank" rel="noopener noreferrer" className="lk-sin-imprimir" style={{ color: 'var(--primary)', fontSize: 14, fontWeight: 600 }}>Ver el video ↗</a>
      </div>
    );
  }

  const v = r.valor;
  const titulo = e.texto.trim() || v.nombre;
  const reproduciendo = jugando === v.src;
  const miniatura = v.miniatura && sinMiniatura !== v.miniatura ? v.miniatura : null;

  let reproductor;
  if (v.modo === 'directo') {
    reproductor = (
      <video src={v.src} controls preload="metadata" playsInline aria-label={titulo}
        style={{ ...LLENO, objectFit: 'contain', pointerEvents: editando ? 'none' : undefined }} />
    );
  } else if (v.alClic && !reproduciendo) {
    // Fathom: la miniatura y un clic para reproducir. Editando, el clic SELECCIONA (no reproduce).
    reproductor = (
      <button type="button" aria-label={`Reproducir ${titulo}`} tabIndex={editando ? -1 : 0}
        onClick={editando ? undefined : () => setJugando(v.src)}
        style={{ ...LLENO, padding: 0, background: 'transparent', cursor: editando ? 'inherit' : 'pointer' }}>
        {miniatura && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={miniatura} alt="" loading="lazy" decoding="async" draggable={false} referrerPolicy={REFERRER_EMBED}
            onError={() => setSinMiniatura(miniatura)} style={{ ...LLENO, objectFit: 'cover' }} />
        )}
        <BotonPlay />
      </button>
    );
  } else {
    reproductor = <Marco src={reproduciendo ? srcAlReproducir(v.src) : v.src} titulo={titulo} editando={editando} />;
  }

  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="lk-sin-imprimir" style={cajaPantalla('var(--sidebar)')}>{reproductor}</div>
      {/* El PDF: la miniatura (o un recuadro con el proveedor), nunca el reproductor. */}
      {v.miniatura ? (
        <div className="lk-solo-imprimir" style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden', borderRadius: RADIO }}>
          {/* Sin `loading="lazy"`: una imagen perezosa adentro de algo escondido no se baja nunca, y el
              PDF saldría con el recuadro vacío. Con prioridad baja: no compite con lo que se ve (y React
              no la precarga en el server). */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={v.miniatura} alt="" decoding="async" fetchPriority="low" referrerPolicy={REFERRER_EMBED} style={{ ...LLENO, objectFit: 'cover' }} />
        </div>
      ) : (
        <div className="lk-solo-imprimir lk-imp-caja"><IconoMenu nombre="video" size={20} /><span>{v.nombre}</span></div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, fontSize: 13, lineHeight: 1.3, fontFamily: 'var(--dash-letra, inherit)' }}>
        <span title={titulo} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600, color: e.texto.trim() ? 'var(--ink)' : 'var(--dim)' }}>{titulo}</span>
        <a href={v.link} target="_blank" rel="noopener noreferrer" className="lk-sin-imprimir" title="Se abre en otra pestaña"
          onClick={editando ? soloSeleccionar : undefined} draggable={editando ? false : undefined}
          style={{ flex: 'none', color: 'var(--primary)', fontWeight: 600, textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Abrir ↗
        </a>
      </div>
    </div>
  );
}

/** El círculo con el triángulo de reproducir, sobre la miniatura. */
function BotonPlay() {
  return (
    <span aria-hidden style={{
      position: 'absolute', top: '50%', left: '50%', width: 56, height: 56, margin: '-28px 0 0 -28px', borderRadius: 999,
      display: 'grid', placeItems: 'center', background: 'var(--on-sidebar)', boxShadow: '0 8px 24px var(--scrim)',
    }}>
      <svg width={22} height={22} viewBox="0 0 24 24" aria-hidden style={{ display: 'block', marginLeft: 3 }}>
        <path d="M7 4.5v15l13-7.5Z" style={{ fill: 'var(--sidebar)' }} />
      </svg>
    </span>
  );
}

// ── Lo insertado ────────────────────────────────────────────────────────────────────────

/** Una página de otro sitio (o el reproductor de un proveedor de la lista) en un iframe con sandbox. */
export function CuerpoInsertado({ e, editando }: { e: Elemento; editando: boolean }) {
  const propio = useHostPropio();
  const r = e.url ? insertableDe(e.url, propio) : null;
  if (!r || !r.ok) {
    if (editando) return <RecuadroVacio icono="insertar" texto={r ? r.error : 'Pega un link o un código'} />;
    return <div style={{ flex: 1, minHeight: 0 }} />;
  }
  const i = r.valor;
  const titulo = e.texto.trim() || i.nombre;
  return (
    <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div className="lk-sin-imprimir" style={cajaPantalla('transparent')}>
        <Marco src={i.src} titulo={titulo} editando={editando} />
      </div>
      <div className="lk-solo-imprimir lk-imp-caja">
        <IconoMenu nombre="insertar" size={20} />
        <span className="lk-imp-tit">{titulo}</span>
        {titulo !== i.nombre && <span>{i.nombre}</span>}
      </div>
    </div>
  );
}
