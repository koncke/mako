'use client';

// =============================================================================
// /api-mako — piezas chicas que comparten las cuatro vistas de la pantalla
// =============================================================================

import { useCallback, useRef, useState, type ReactNode } from 'react';
import { Button } from '@/app/_ui';
import { MONO } from '@/app/_ui/tokens';

/** Copiar al portapapeles con el «Copiado» de confirmación. Si el navegador no deja,
 *  lo dice: un botón que no confirma se lee como que no funcionó. */
export function useCopiar(): { copiar: (clave: string, texto: string) => void; copiado: string | null; fallo: boolean } {
  const [copiado, setCopiado] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiar = useCallback((clave: string, texto: string) => {
    navigator.clipboard.writeText(texto).then(
      () => {
        setFallo(false); setCopiado(clave);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopiado(null), 1800);
      },
      () => setFallo(true),
    );
  }, []);
  return { copiar, copiado, fallo };
}

/** Un bloque de código que se copia entero. Scrollea de costado: es CONTENIDO, no
 *  navegación, así que acá el scroll lateral sí va (`mk-scroll-x`). */
export function Codigo({ texto, clave, copiar, copiado, alto }: {
  texto: string;
  clave: string;
  copiar: (clave: string, texto: string) => void;
  copiado: string | null;
  /** tope de alto: lo que pase scrollea adentro */
  alto?: number;
}) {
  return (
    <div style={{ position: 'relative' }}>
      <pre className="mk-scroll-x" style={{
        margin: 0, padding: '12px 14px', paddingRight: 92, borderRadius: 10,
        background: 'var(--surface-2)', border: '1px solid var(--border)',
        fontFamily: MONO, fontSize: 12, lineHeight: 1.6, color: 'var(--ink)',
        whiteSpace: 'pre', overflow: 'auto', ...(alto ? { maxHeight: alto } : {}),
      }}>{texto}</pre>
      <div style={{ position: 'absolute', top: 6, right: 6 }}>
        <Button size="sm" variant="secondary" onClick={() => copiar(clave, texto)}>{copiado === clave ? 'Copiado' : 'Copiar'}</Button>
      </div>
    </div>
  );
}

/** GET / POST, en mono y con el color de lo que hace: leer no toca nada. */
export function Metodo({ metodo }: { metodo: 'GET' | 'POST' }) {
  const leer = metodo === 'GET';
  return (
    <span style={{
      fontFamily: MONO, fontSize: 10.5, fontWeight: 700, letterSpacing: '.04em',
      padding: '2px 6px', borderRadius: 6, flex: 'none', minWidth: 40, textAlign: 'center',
      background: leer ? 'var(--good-bg)' : 'var(--primary-bg)',
      color: leer ? 'var(--good)' : 'var(--primary)',
    }}>{metodo}</span>
  );
}

/** Una clave en mono, chica. Para ids, rutas y pistas de token. */
export function Mono({ children, tenue }: { children: ReactNode; tenue?: boolean }) {
  return <code style={{ fontFamily: MONO, fontSize: 12, color: tenue ? 'var(--faint)' : 'var(--dim)', wordBreak: 'break-all' }}>{children}</code>;
}

const FECHA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** «8 oct, 14:05» en la zona del navegador, o «—». */
export const fechaCorta = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? FECHA.format(t) : '—';
};

/** «hace 5 min», «hace 3 h», «hace 2 días», o la fecha si es más viejo. */
export function hace(iso: string | null | undefined): string {
  if (!iso) return 'Nunca';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Nunca';
  const min = Math.round((Date.now() - t) / 60_000);
  if (min < 2) return 'Recién';
  if (min < 60) return `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  return d <= 14 ? `Hace ${d} días` : fechaCorta(iso);
}
