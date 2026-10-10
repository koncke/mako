'use client';

// =============================================================================
// NotasLista — el cuaderno de una tarjeta: VARIAS notas, cada una con su fecha
// =============================================================================
// Antes era un textarea único: escribías una nota y la siguiente PISABA la anterior.
// Un cuaderno donde solo cabe una hoja no es un cuaderno. Ahora es como en la ficha de
// un lead (app/crm/lead-view/NotasCard.tsx): se agregan, quedan todas, cada una con el
// día y la hora, y se pueden escribir con formato.
//
// SIN MIGRACIÓN. El campo `notas` de la tarjeta es texto, y ahí adentro viaja un JSON
// con la lista. Lo viejo no se pierde: si el contenido no es una lista, se lee como
// UNA nota vieja (la que estaba escrita) y a partir de ahí se le suman las nuevas.
//
// Es del DUEÑO: la IA no toca las notas. El `detalle` lo escribe (y lo amplía) el
// Perro; esto es el cuaderno de quien trabaja — dónde quedó, con quién habló, el link
// que le pasaron, por qué lo frenó.
// =============================================================================

import { useMemo, useState, type CSSProperties } from 'react';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { RichText, sanitizeHtml, mdAHtml } from './RichText';

const SANS = "'Geist', sans-serif";
const MONO = "'Geist Mono', monospace";

export type Nota = { id: string; ts: number; texto: string };

/** El contenido del campo → lista de notas. Acepta el formato viejo (texto suelto). */
export function leerNotas(raw: string): Nota[] {
  const t = (raw ?? '').trim();
  if (!t) return [];
  if (t.startsWith('[')) {
    try {
      const arr = JSON.parse(t) as unknown;
      if (Array.isArray(arr)) {
        const notas = arr
          .filter((n): n is Record<string, unknown> => !!n && typeof n === 'object')
          .map((n) => ({ id: String(n.id ?? ''), ts: Number(n.ts) || 0, texto: String(n.texto ?? '') }))
          .filter((n) => n.texto.trim());
        if (notas.length || arr.length === 0) return notas;
      }
    } catch { /* no era JSON: cae abajo como nota vieja */ }
  }
  // Texto suelto de antes: se conserva como la primera nota, sin fecha conocida.
  return [{ id: 'legacy', ts: 0, texto: t }];
}

export const escribirNotas = (notas: Nota[]): string => (notas.length ? JSON.stringify(notas) : '');

const fmt = (ts: number): string => {
  if (!ts) return 'antes';
  try {
    return new Date(ts).toLocaleString('es-AR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch { return ''; }
};

const rowLabel: CSSProperties = { fontFamily: MONO, fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: 8, display: 'block' };

export function NotasLista({ valor, onGuardar }: {
  /** el campo `notas` crudo de la tarjeta (JSON nuevo o texto viejo). */
  valor: string;
  onGuardar: (nuevo: string) => void;
}) {
  const notas = useMemo(() => leerNotas(valor), [valor]);
  const [borrador, setBorrador] = useState('');
  // `key` para vaciar el RichText después de agregar: es contentEditable no controlado.
  const [nonce, setNonce] = useState(0);

  const agregar = () => {
    const html = sanitizeHtml(borrador).trim();
    if (!html || html === '<br>') return;
    const nueva: Nota = { id: `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, ts: Date.now(), texto: html };
    onGuardar(escribirNotas([nueva, ...notas]));
    setBorrador(''); setNonce((n) => n + 1);
  };
  const borrar = (id: string) => onGuardar(escribirNotas(notas.filter((n) => n.id !== id)));

  return (
    <div>
      <label style={rowLabel}>Notas{notas.length ? ` · ${notas.length}` : ''}</label>

      {/* Escribir primero: es lo que se viene a hacer acá. */}
      <div style={{ border: '1px solid var(--border-strong)', borderRadius: 11, background: 'var(--surface-2)', padding: '10px 12px' }}>
        <RichText key={nonce} value="" onChange={setBorrador} placeholder="Dónde quedó, con quién hablaste, qué lo frena…"
          style={{ fontSize: 13.5, minHeight: 46, color: 'var(--ink)' }} />
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
          <button type="button" onClick={agregar} disabled={!borrador.trim()}
            style={{ padding: '7px 15px', borderRadius: 9, border: 'none', background: borrador.trim() ? 'var(--primary)' : 'var(--border)', color: borrador.trim() ? '#fff' : 'var(--faint)', fontSize: 13, fontWeight: 700, cursor: borrador.trim() ? 'pointer' : 'default', fontFamily: SANS }}>
            Agregar nota
          </button>
        </div>
      </div>

      {/* Las que ya están, la más nueva arriba. */}
      {notas.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
          {notas.map((n) => (
            <div key={n.id} style={{ border: '1px solid var(--border)', borderRadius: 10, background: 'var(--surface)', padding: '10px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 5 }}>
                <span style={{ fontFamily: MONO, fontSize: 10.5, color: 'var(--faint)' }}>{fmt(n.ts)}</span>
                <BotonBorrar talla="sm" onClick={() => borrar(n.id)} title="Borrar la nota" />
              </div>
              <div style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.55 }}
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(mdAHtml(n.texto)) }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
