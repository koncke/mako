'use client';

// =============================================================================
// GuionCard — la tarjeta de un guion en la galería
// =============================================================================
// El problema de diseño: un guion es TEXTO, y una galería de texto es fea por
// default. ¿Cuál es la portada de un guion?
//
// EL GANCHO. `parsearSecciones` ya parte el guion en bloques etiquetados
// (GANCHO, PROBLEMA, ANTES… según la estructura con la que se escribió), y el
// PRIMER bloque son los 3-5 segundos que deciden si el anuncio funciona. Es lo
// más denso, lo más distinto entre un guion y otro, y lo único que el dueño
// necesita para comparar sin abrir nada. (La lista vieja ya calculaba esas
// secciones para cada fila y tiraba el resultado: la portada no cuesta cómputo.)
//
// La ESPINA de abajo de la portada no es decoración: cada segmento es una
// sección y su ancho es proporcional a cuánto texto tiene. Dos guiones con la
// misma estructura pero distinto reparto tienen silueta distinta, y un gancho
// que se comió medio guion se ve sin leer una palabra.
// =============================================================================

import type { CSSProperties } from 'react';
import { parsearSecciones } from '../components/SeccionCard';
import { Tag } from '../_ui';
import { EstadoChip } from '../onboarding/EstadoChip';
import { fechaGuion, type EstadoGuion, type GuionItem } from '../onboarding/guion-ui';

const MONO = "'Geist Mono', monospace";

/** El ancho mínimo de la tarjeta. Es el mismo que usa la grilla de Ads Analyst:
 *  la fábrica y el analista se ven hermanos a propósito. */
export const GUION_CARD_MIN = 300;

export type GuionCardData = {
  g: GuionItem;
  celdaNombre: string;
  avatarNombre: string;
  /** Emoji del ángulo, del catálogo editable. Es dato, no un ícono de UI. */
  anguloEmoji?: string;
};

export function GuionCard({ data, onAbrir, onEstado, onRetrocederEstado }: {
  data: GuionCardData;
  onAbrir: () => void;
  onEstado: (e: EstadoGuion) => void;
  onRetrocederEstado?: () => void;
}) {
  const { g, celdaNombre, avatarNombre, anguloEmoji } = data;
  const secciones = parsearSecciones(g.texto, undefined, 20);
  const total = secciones.reduce((n, s) => n + s.texto.length, 0) || 1;
  const portada = secciones[0];

  return (
    // ⚠️ La tarjeta NO es un <button>. El pie lleva el EstadoChip, que también lo
    // es, y contenido interactivo dentro de un botón es HTML inválido: el parser
    // cierra el externo al ver el interno, y un lector de pantalla lee la tarjeta
    // entera concatenada como nombre del botón. Lo clickeable es todo lo de
    // ARRIBA del pie; el chip queda afuera, como hermano.
    <div className="mk-guion-card" style={card}>
      <button type="button" onClick={onAbrir} style={zonaAbrir}
        aria-label={`Abrir el guion de ${celdaNombre}, ángulo ${g.anguloNombre}`}>
      {/* A · La portada: el gancho tratado como cita */}
      <div style={{ background: 'var(--surface-2)', padding: '16px 16px 14px' }}>
        <span style={eyebrow}>{portada ? portada.titulo : 'Guion'}</span>
        <div style={cita}>
          {portada ? portada.texto : g.texto.slice(0, 200)}
        </div>
      </div>

      {/* B · La espina: una sección, un segmento, ancho = cuánto texto tiene */}
      {secciones.length > 1 && (
        <div style={{ display: 'flex', gap: 2, height: 4 }} aria-hidden
          title={secciones.map((s) => s.titulo).join(' · ')}>
          {secciones.map((s, i) => (
            <span key={s.titulo + i} style={{
              flex: `${Math.max(s.texto.length, 1) / total} 0 0`,
              background: i === 0 ? 'var(--ink)' : 'var(--border-strong)',
            }} />
          ))}
        </div>
      )}

      {/* C · Categorías y destino */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Tag icon={anguloEmoji}>{g.anguloNombre}</Tag>
          {g.estructuraNombre && <Tag>{g.estructuraNombre}</Tag>}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 'var(--fs-md)', fontWeight: 600, color: 'var(--ink)', lineHeight: 1.35 }}>{celdaNombre}</div>
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginTop: 2 }}>{avatarNombre}</div>
        </div>
      </div>
      </button>

      {/* D · Pie: cuándo, y el único control además de abrir. Fuera del botón. */}
      <div style={pie}>
        <span style={{ fontFamily: MONO, fontSize: 'var(--fs-meta)', color: 'var(--faint)', fontVariantNumeric: 'tabular-nums' }}>
          {fechaGuion(g.creadoEn)}
        </span>
        <EstadoChip estado={g.estado} onChange={onEstado} onRetroceder={onRetrocederEstado} />
      </div>
    </div>
  );
}

/** La misma geometría, vacía: lo que se ve mientras cargan los guiones. */
export function GuionCardFantasma() {
  return (
    <div style={{ ...card, cursor: 'default' }} aria-hidden>
      <div style={{ background: 'var(--surface-2)', padding: '16px 16px 14px' }}>
        <span className="mk-skel" style={{ display: 'block', width: 54, height: 9, borderRadius: 3 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginTop: 12 }}>
          {[100, 96, 88, 60].map((w, i) => (
            <span key={i} className="mk-skel" style={{ display: 'block', width: `${w}%`, height: 11, borderRadius: 3 }} />
          ))}
        </div>
      </div>
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        <span className="mk-skel" style={{ display: 'block', width: 130, height: 20, borderRadius: 999 }} />
        <span className="mk-skel" style={{ display: 'block', width: '70%', height: 13, borderRadius: 3 }} />
      </div>
      <div style={pie}>
        <span className="mk-skel" style={{ display: 'block', width: 72, height: 11, borderRadius: 3 }} />
        <span className="mk-skel" style={{ display: 'block', width: 84, height: 26, borderRadius: 999 }} />
      </div>
    </div>
  );
}

const card: CSSProperties = {
  display: 'flex', flexDirection: 'column', padding: 0,
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)', overflow: 'hidden',
  transition: 'border-color .14s ease, box-shadow .14s ease, transform .14s ease',
};

/** Todo lo que abre el guion. Es el botón de verdad; el pie queda afuera. */
const zonaAbrir: CSSProperties = {
  display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
  textAlign: 'left', padding: 0, border: 'none', background: 'none',
  font: 'inherit', color: 'inherit', cursor: 'pointer',
};

const eyebrow: CSSProperties = {
  fontFamily: MONO, fontSize: 10.5, letterSpacing: '.12em',
  textTransform: 'uppercase', color: 'var(--faint)',
};

const cita: CSSProperties = {
  borderLeft: '2px solid var(--border-strong)', paddingLeft: 12, marginTop: 8,
  fontSize: 'var(--fs-card)', fontWeight: 600, lineHeight: 1.45,
  letterSpacing: '-0.01em', color: 'var(--ink)',
  display: '-webkit-box', WebkitLineClamp: 4, WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};

const pie: CSSProperties = {
  marginTop: 'auto', padding: '10px 14px', borderTop: '1px solid var(--border)',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
};
