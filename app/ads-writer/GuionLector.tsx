'use client';

// =============================================================================
// GuionLector — leer un guion entero, y (si corresponde) editarlo
// =============================================================================
// Un guion se lee en voz alta frente a una cámara, así que la lectura es el uso
// principal: bloques abiertos, línea larga y cómoda, y las acciones abajo con
// jerarquía en vez de cuatro botones grises idénticos.
//
// `onEditar` es OPCIONAL: con la prop, cada bloque del guion se edita in-place;
// sin ella, el lector es de lectura. Hoy lo monta SOLO la galería, y le pasa
// `onEditar` — la matriz tiene su propia lista de guiones inline y no usa este
// componente. La opcionalidad existe para el día que la matriz sí lo use (o
// para montarlo en un lugar donde editar no corresponda), no porque hoy haya
// dos usos distintos.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { SeccionCard, parsearSecciones, ICONO_SECCION_GUION, type Seccion } from '../components/SeccionCard';
import { Button, IconButton, Tag } from '../_ui';
import { EstadoChip } from '../onboarding/EstadoChip';
import { fechaGuion, type EstadoGuion, type GuionItem } from '../onboarding/guion-ui';

const MONO = "'Geist Mono', monospace";

// Ícono por sección. Las etiquetas salen de las estructuras del catálogo.
const ICONO = ICONO_SECCION_GUION;

/** Rearma el guion completo tras editar UNA sección: las tarjetas son
 *  independientes pero el campo guardado sigue siendo un solo string. */
const reconstruir = (secciones: Seccion[]) => secciones.map((s) => `${s.titulo}\n${s.texto}`).join('\n\n');

export function GuionLector({ g, celdaNombre, avatarNombre, anguloEmoji, onCerrar, onEstado, onRetrocederEstado, onEditar, onBorrar, onCopiar, onDescargar, irAlAnuncio }: {
  g: GuionItem;
  celdaNombre: string;
  avatarNombre?: string;
  anguloEmoji?: string;
  onCerrar: () => void;
  onEstado: (e: EstadoGuion) => void;
  onRetrocederEstado?: () => void;
  /** Presente = el guion se puede editar bloque por bloque. Ausente = lectura. */
  onEditar?: (texto: string) => void;
  onBorrar: () => void;
  onCopiar: () => Promise<boolean>;
  onDescargar: () => void;
  /** Solo desde la galería: saltar a la celda de la que salió este guion. */
  irAlAnuncio?: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const secciones = parsearSecciones(g.texto, undefined, 20);
  const panelRef = useRef<HTMLDivElement>(null);

  // Un diálogo se cierra con Escape y recibe el foco al abrir. Sin esto, con el
  // guion abierto el Tab seguía recorriendo las tarjetas de atrás y la única
  // salida era el mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } };
    document.addEventListener('keydown', onKey);
    panelRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onCerrar]);

  const [errCopia, setErrCopia] = useState(false);
  const copiar = async () => {
    const ok = await onCopiar();
    if (!ok) { setErrCopia(true); setTimeout(() => setErrCopia(false), 3000); return; }
    setCopiado(true); setTimeout(() => setCopiado(false), 1600);
  };

  return (
    <div onClick={onCerrar} style={backdrop}>
      <div ref={panelRef} tabIndex={-1} onClick={(e) => e.stopPropagation()} style={panel}
        role="dialog" aria-modal="true" aria-label={`Guion · ${celdaNombre}`}>
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '18px 22px 14px' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              <Tag icon={anguloEmoji}>{g.anguloNombre}</Tag>
              {g.estructuraNombre && <Tag>{g.estructuraNombre}</Tag>}
            </div>
            <div style={{ fontSize: 'var(--fs-sect)', fontWeight: 700, letterSpacing: '-0.01em', color: 'var(--ink)', lineHeight: 1.2 }}>{celdaNombre}</div>
            <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginTop: 4, fontFamily: MONO, fontVariantNumeric: 'tabular-nums' }}>
              {avatarNombre ? `${avatarNombre} · ` : ''}{fechaGuion(g.creadoEn)}
            </div>
          </div>
          <EstadoChip estado={g.estado} onChange={onEstado} onRetroceder={onRetrocederEstado} />
          <IconButton title="Cerrar" onClick={onCerrar}>✕</IconButton>
        </div>

        {/* Cuerpo — lo único que scrollea */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 22px 20px' }}>
          {secciones.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {secciones.map((s, i) => (
                <SeccionCard key={s.titulo + i} s={onEditar ? { titulo: s.titulo, texto: '' } : s}
                  abiertoDefault icono={ICONO[s.titulo] ?? '🎬'} size="sm">
                  {onEditar ? (
                    <div className="mtz-edit" contentEditable suppressContentEditableWarning spellCheck={false}
                      onBlur={(e) => {
                        const nv = (e.currentTarget.innerText || '').replace(/\n{3,}/g, '\n\n').trim();
                        if (nv !== s.texto.trim()) onEditar(reconstruir(secciones.map((sec, j) => (j === i ? { ...sec, texto: nv } : sec))));
                      }}
                      style={{ outline: 'none', cursor: 'text', borderRadius: 6, padding: '4px 8px', margin: '0 -8px', whiteSpace: 'pre-wrap', fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.7 }}
                    >{s.texto}</div>
                  ) : undefined}
                </SeccionCard>
              ))}
            </div>
          ) : (
            // Guion viejo, sin las etiquetas del catálogo: no se pierde, se ve entero.
            <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--ink)', lineHeight: 1.7, whiteSpace: 'pre-wrap', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--r-md)', padding: '14px 16px' }}>{g.texto}</div>
          )}
        </div>

        {/* Pie con jerarquía: copiar es lo que se hace de verdad; borrar, lo último */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <Button variant="primary" onClick={copiar} ok={copiado} okLabel="Copiado">Copiar el guion</Button>
          {errCopia && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--bad)' }}>El navegador no dejó copiar — selecciona el texto a mano.</span>}
          <Button variant="secondary" onClick={onDescargar}>Descargar .md</Button>
          {irAlAnuncio && <Button variant="tertiary" onClick={irAlAnuncio}>Ver el anuncio</Button>}
          <span style={{ flex: 1 }} />
          <IconButton title="Borrar este guion" danger onClick={onBorrar}>✕</IconButton>
        </div>
      </div>
    </div>
  );
}

const backdrop: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 200,
  background: 'rgba(18,21,27,.5)', backdropFilter: 'blur(2px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
};

const panel: CSSProperties = {
  width: 'min(720px, 100%)', height: 'min(680px, calc(100vh - 80px))',
  display: 'flex', flexDirection: 'column',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderTop: '3px solid var(--primary)', borderRadius: 'var(--r-xl)',
  boxShadow: '0 30px 70px rgba(18,21,27,.35)', overflow: 'hidden',
};
