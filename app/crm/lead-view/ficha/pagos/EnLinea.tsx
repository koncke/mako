'use client';

// =============================================================================
// ficha/pagos/EnLinea — un dato de Pagos editado en el lugar (sin «Editar deal»)
// =============================================================================
// El gesto de la ficha (CampoEditable, 05/10/2026: «simplemente le doy click arriba y ya puedo sobre escribir»):
// un clic en el dato lo abre, se escribe, y al salir (o con Enter) se guarda; Escape cancela. Lo que cambia contra
// CampoEditable es QUIÉN escribe: allá `guardarCampoLeadAction` (columnas del lead); acá la acción de cada bloque
// de Pagos (`guardarVentaAction`, `guardarCampoDealAction`, `editarCuotaAction`), que mergea, hace compare-and-set
// y devuelve con qué se deshace. Por eso `onGuardar` devuelve el error (o null): el campo lo dice debajo y queda
// abierto con lo escrito, en vez de volver solo al valor viejo como si hubiera guardado.
//
// ⚠️ Lo que no se puede editar no se dibuja clickeable (`bloqueado`): un campo que invita y rebota se lee roto.
// ⚠️ UN GUARDADO A LA VEZ (revisión del 16/10/2026): Enter guarda, y el blur que sigue (el campo se deshabilita
//    mientras guarda) volvía a guardar el mismo valor contra el valor VIEJO del prop. En una obligación, la segunda
//    llamada llevaba el texto de antes como `esperado` y volvía con «otra pestaña lo cambió» sobre lo que sí guardó.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from 'react';
import { fmtDDMMYYYY } from '@/lib/date-utils';

const SANS = "'Geist', sans-serif";

export type TipoEnLinea = 'texto' | 'largo' | 'numero' | 'fecha';

export function EnLinea({ valor, tipo = 'texto', vacio = '—', titulo, prefijo, bloqueado = false, estilo, onGuardar }: {
  /** El valor guardado, como texto ('' = vacío). Una fecha va AAAA-MM-DD. */
  valor: string;
  tipo?: TipoEnLinea;
  vacio?: string;
  /** Para el lector de pantalla y el tooltip: «Edita el monto». */
  titulo: string;
  /** «$» delante de un monto. */
  prefijo?: string;
  bloqueado?: boolean;
  /** El estilo del texto cuando no se edita (el número grande de un bloque). */
  estilo?: CSSProperties;
  /** Guarda el valor nuevo (ya recortado). Devuelve el error para mostrar, o null si guardó. */
  onGuardar: (v: string) => Promise<string | null>;
}) {
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(valor);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const enCurso = useRef(false);

  useEffect(() => { if (!abierto) setBorrador(valor); }, [valor, abierto]);
  useEffect(() => { if (abierto) ref.current?.focus(); }, [abierto]);

  const visible = !valor ? vacio : tipo === 'fecha' ? fmtDDMMYYYY(valor) : `${prefijo ?? ''}${valor}`;
  if (bloqueado) return <span style={{ ...estilo, color: valor ? estilo?.color ?? 'var(--ink)' : 'var(--faint)' }}>{visible}</span>;

  const salir = async () => {
    if (enCurso.current) return;
    const v = tipo === 'largo' ? borrador.trim() : borrador.replace(/\s+/g, ' ').trim();
    if (v === valor.trim()) { setAbierto(false); setError(null); return; }
    enCurso.current = true;
    setGuardando(true);
    const e = await onGuardar(v).catch((x: unknown) => (x instanceof Error ? x.message : String(x)));
    enCurso.current = false;
    setGuardando(false);
    if (e) { setError(e); return; }
    setError(null);
    setAbierto(false);
  };
  const tecla = (e: KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); setBorrador(valor); setError(null); setAbierto(false); }
    if (e.key === 'Enter' && (tipo !== 'largo' || e.metaKey || e.ctrlKey)) { e.preventDefault(); void salir(); }
  };

  if (!abierto) {
    return (
      <button type="button" title={titulo} aria-label={titulo} onClick={() => setAbierto(true)}
        style={{ all: 'unset', cursor: 'text', display: 'block', width: '100%', minHeight: 22, fontFamily: SANS, whiteSpace: tipo === 'largo' ? 'pre-wrap' : undefined, overflowWrap: 'anywhere', ...estilo, color: valor ? estilo?.color ?? 'var(--ink)' : 'var(--faint)' }}>
        {visible}
      </button>
    );
  }
  const comun = {
    ref, value: borrador, disabled: guardando, 'aria-label': titulo, 'data-campo-editando': true,
    onChange: (e: { target: { value: string } }) => setBorrador(e.target.value),
    onBlur: () => void salir(), onKeyDown: tecla,
  };
  return (
    <span style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '100%' }}>
      {tipo === 'largo'
        ? <textarea className="mk-textarea" rows={3} {...comun} />
        : <input className="mk-input" type={tipo === 'numero' ? 'number' : tipo === 'fecha' ? 'date' : 'text'} inputMode={tipo === 'numero' ? 'decimal' : undefined} min={tipo === 'numero' ? 0 : undefined} step={tipo === 'numero' ? '0.01' : undefined} {...comun} />}
      {guardando && <span style={{ fontSize: 12, color: 'var(--faint)' }}>Guardando…</span>}
      {error && <span role="alert" style={{ fontSize: 12.5, color: 'var(--bad)' }}>{error}</span>}
    </span>
  );
}
