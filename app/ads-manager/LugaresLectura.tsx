'use client';

// =============================================================================
// LugaresLectura — dónde se muestra un conjunto que ya corre, para LEER
// =============================================================================
// Lo dibujan EntityDetalle («Dónde se muestra») y EditarPublicoModal cuando los
// lugares quedan en sólo lectura. Sale de lugaresDesdeMeta (lib/meta-geo.ts): lo que
// esa función no entendió NO se dibuja como si fuera un lugar, se dice aparte — si no,
// la lista se leería completa y la parte que falta sería justo la que no sabemos tocar.
// =============================================================================

import type { CSSProperties } from 'react';
import { ETIQUETA_TIPO, nombrePais, rotuloRadio, type LecturaGeo, type LugarMeta } from '@/lib/meta-geo';

const MONO = "'Geist Mono', monospace";

// Un pin son coordenadas, y unas coordenadas no le dicen a nadie dónde cae: el chip abre
// el mapa. Es VER el punto; ELEGIR uno en un mapa espera una decisión de Martín (#715).
const mapaDe = (l: LugarMeta) => (l.tipo === 'pin' && l.lat != null && l.lng != null ? `https://www.google.com/maps/search/?api=1&query=${l.lat},${l.lng}` : null);

function Chip({ l }: { l: LugarMeta }) {
  const radio = rotuloRadio(l);
  const href = mapaDe(l);
  const style: CSSProperties = {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, fontSize: 12.5, color: 'var(--ink)', textDecoration: 'none',
    border: `1px solid ${l.excluir ? 'var(--bad)' : 'var(--border-strong)'}`, background: l.excluir ? 'var(--bad-bg)' : 'var(--surface)',
  };
  const tipo = `${ETIQUETA_TIPO[l.tipo]}${l.pais && l.tipo !== 'country' ? ` · ${nombrePais(l.pais)}` : ''}`;
  const cuerpo = (
    <>
      <span style={href ? { textDecoration: 'underline', textUnderlineOffset: 2 } : undefined}>{l.nombre}</span>
      {radio && <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--dim)' }}>{radio}</span>}
    </>
  );
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" title={`${tipo} · Ver en el mapa`} style={style}>{cuerpo}</a>
    : <span title={tipo} style={style}>{cuerpo}</span>;
}

function Fila({ rotulo, lugares }: { rotulo: string; lugares: LugarMeta[] }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
      <span style={{ flex: 'none', width: 62, fontFamily: MONO, fontSize: 10.5, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--faint)' }}>{rotulo}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
        {lugares.map((l) => <Chip key={`${l.tipo}:${l.key}`} l={l} />)}
      </div>
    </div>
  );
}

export function LugaresLectura({ lectura, avisoNoEntiendo = 'Tiene lugares que MaKo no sabe mostrar. Míralos en Meta.' }: {
  lectura: LecturaGeo;
  /** Lo que se dice si hay algo sin entender: el editor dice qué pasa con el resto. */
  avisoNoEntiendo?: string;
}) {
  const inc = lectura.lugares.filter((l) => !l.excluir);
  const exc = lectura.lugares.filter((l) => l.excluir);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {inc.length > 0 && <Fila rotulo="Incluye" lugares={inc} />}
      {exc.length > 0 && <Fila rotulo="Excluye" lugares={exc} />}
      {!lectura.lugares.length && !lectura.noEntiendo.length && <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>Sin lugares.</span>}
      {/* Las claves crudas van al title: sirven para diagnosticar, no para leer. */}
      {lectura.noEntiendo.length > 0 && (
        <span title={lectura.noEntiendo.join(' · ')} style={{ fontSize: 12.5, color: 'var(--dim)' }}>{avisoNoEntiendo}</span>
      )}
    </div>
  );
}
