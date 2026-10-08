'use client';

// =============================================================================
// /api-mako — piezas chicas que comparten las vistas: íconos, copiar, fechas
// =============================================================================
// Los íconos son los Octicons de GitHub (licencia MIT), de 16 px y con `currentColor`: la
// tab copia el aspecto de GitHub (decisión de Martín, 08/10/2026), y sus íconos son parte.
// =============================================================================

import { useCallback, useRef, useState } from 'react';

const PATHS = {
  copy: ['M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 0 1 0 1.5h-1.5a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 9.25 16h-7.5A1.75 1.75 0 0 1 0 14.25Z', 'M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0 1 14.25 11h-7.5A1.75 1.75 0 0 1 5 9.25Zm1.75-.25a.25.25 0 0 0-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 0 0 .25-.25v-7.5a.25.25 0 0 0-.25-.25Z'],
  check: ['M13.78 4.22a.75.75 0 0 1 0 1.06l-7.25 7.25a.75.75 0 0 1-1.06 0L2.22 9.28a.751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018L6 10.94l6.72-6.72a.75.75 0 0 1 1.06 0Z'],
  chevronDown: ['M12.78 5.22a.749.749 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.06 0L3.22 6.28a.749.749 0 1 1 1.06-1.06L8 8.939l3.72-3.719a.749.749 0 0 1 1.06 0Z'],
  chevronRight: ['M6.22 3.22a.75.75 0 0 1 1.06 0l4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L9.94 8 6.22 4.28a.75.75 0 0 1 0-1.06Z'],
  key: ['M10.5 0a5.499 5.499 0 1 1-1.288 10.848l-.932.932a.749.749 0 0 1-.53.22H7v.75a.749.749 0 0 1-.22.53l-.5.5a.749.749 0 0 1-.53.22H5v.75a.749.749 0 0 1-.22.53l-.5.5a.749.749 0 0 1-.53.22h-2A1.75 1.75 0 0 1 0 14.25v-2c0-.199.079-.389.22-.53l4.932-4.932A5.5 5.5 0 0 1 10.5 0Zm-4 5.5c-.001.431.069.86.205 1.269a.75.75 0 0 1-.181.768L1.5 12.56v1.69c0 .138.112.25.25.25h1.69l.06-.06v-1.19a.75.75 0 0 1 .75-.75h1.19l.06-.06v-1.19a.75.75 0 0 1 .75-.75h1.19l1.023-1.025a.75.75 0 0 1 .768-.18A4 4 0 1 0 6.5 5.5ZM11 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'],
  book: ['M0 1.75A.75.75 0 0 1 .75 1h4.253c1.227 0 2.317.59 3 1.501A3.743 3.743 0 0 1 11.006 1h4.245a.75.75 0 0 1 .75.75v10.5a.75.75 0 0 1-.75.75h-4.507a2.25 2.25 0 0 0-1.591.659l-.622.621a.75.75 0 0 1-1.06 0l-.622-.621A2.25 2.25 0 0 0 5.258 13H.75a.75.75 0 0 1-.75-.75Zm7.251 10.324.004-5.073-.002-2.253A2.25 2.25 0 0 0 5.003 2.5H1.5v9h3.757a3.75 3.75 0 0 1 1.994.574ZM8.755 4.75l-.004 7.322a3.752 3.752 0 0 1 1.992-.572H14.5v-9h-3.495a2.25 2.25 0 0 0-2.25 2.25Z'],
  pulse: ['M6 2c.306 0 .582.187.696.471L10 10.731l1.304-3.26A.751.751 0 0 1 12 7h3.25a.75.75 0 0 1 0 1.5h-2.742l-1.812 4.528a.751.751 0 0 1-1.392 0L6 4.77 4.696 8.03A.75.75 0 0 1 4 8.5H.75a.75.75 0 0 1 0-1.5h2.742l1.812-4.529A.751.751 0 0 1 6 2Z'],
  alert: ['M6.457 1.047c.659-1.234 2.427-1.234 3.086 0l6.082 11.378A1.75 1.75 0 0 1 14.082 15H1.918a1.75 1.75 0 0 1-1.543-2.575Zm1.763.707a.25.25 0 0 0-.44 0L1.698 13.132a.25.25 0 0 0 .22.368h12.164a.25.25 0 0 0 .22-.368Zm.53 3.996v2.5a.75.75 0 0 1-1.5 0v-2.5a.75.75 0 0 1 1.5 0ZM9 11a1 1 0 1 1-2 0 1 1 0 0 1 2 0Z'],
  info: ['M0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8Zm8-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM6.5 7.75A.75.75 0 0 1 7.25 7h1a.75.75 0 0 1 .75.75v2.75h.25a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1 0-1.5h.25v-2h-.25a.75.75 0 0 1-.75-.75ZM8 6a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z'],
  x: ['M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.749.749 0 0 1 1.275.326.749.749 0 0 1-.215.734L9.06 8l3.22 3.22a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L8 9.06l-3.22 3.22a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z'],
  download: ['M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14Z', 'M7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z'],
  link: ['m7.775 3.275 1.25-1.25a3.5 3.5 0 1 1 4.95 4.95l-2.5 2.5a3.5 3.5 0 0 1-4.95 0 .751.751 0 0 1 .018-1.042.751.751 0 0 1 1.042-.018 1.998 1.998 0 0 0 2.83 0l2.5-2.5a2.002 2.002 0 0 0-2.83-2.83l-1.25 1.25a.751.751 0 0 1-1.042-.018.751.751 0 0 1-.018-1.042Zm-4.69 9.64a1.998 1.998 0 0 0 2.83 0l1.25-1.25a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042l-1.25 1.25a3.5 3.5 0 1 1-4.95-4.95l2.5-2.5a3.5 3.5 0 0 1 4.95 0 .751.751 0 0 1-.018 1.042.751.751 0 0 1-1.042.018 1.998 1.998 0 0 0-2.83 0l-2.5 2.5a1.998 1.998 0 0 0 0 2.83Z'],
  code: ['m11.28 3.22 4.25 4.25a.75.75 0 0 1 0 1.06l-4.25 4.25a.749.749 0 0 1-1.275-.326.749.749 0 0 1 .215-.734L13.94 8l-3.72-3.72a.749.749 0 0 1 .326-1.275.749.749 0 0 1 .734.215Zm-6.56 0a.751.751 0 0 1 1.042.018.751.751 0 0 1 .018 1.042L2.06 8l3.72 3.72a.749.749 0 0 1-.326 1.275.749.749 0 0 1-.734-.215L.47 8.53a.75.75 0 0 1 0-1.06Z'],
} as const;

export type NombreIcono = keyof typeof PATHS;

export function Icono({ n, size = 16, className, titulo }: { n: NombreIcono; size?: number; className?: string; titulo?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" className={className} aria-hidden={titulo ? undefined : true} role={titulo ? 'img' : undefined} style={{ flex: 'none', verticalAlign: 'text-bottom' }}>
      {titulo && <title>{titulo}</title>}
      {PATHS[n].map((d) => <path key={d.slice(0, 12)} d={d} />)}
    </svg>
  );
}

/** Copiar al portapapeles con la confirmación (el ✓ de GitHub). Si el navegador no deja, lo
 *  dice: un botón que no confirma se lee como que no funcionó. */
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

/** El botón de copiar de GitHub: el ícono, que pasa a ✓ verde al copiar. */
export function BotonCopiar({ texto, clave, copiar, copiado, etiqueta = 'Copiar' }: {
  texto: string; clave: string; copiar: (clave: string, texto: string) => void; copiado: string | null; etiqueta?: string;
}) {
  const ok = copiado === clave;
  return (
    <button type="button" className="gh-btn-octicon" aria-label={ok ? 'Copiado' : etiqueta} title={ok ? 'Copiado' : etiqueta} onClick={() => copiar(clave, texto)}>
      <Icono n={ok ? 'check' : 'copy'} className={ok ? undefined : undefined} />
    </button>
  );
}

/** El verbo de un endpoint, como el badge de docs.github.com. */
export function Verbo({ metodo }: { metodo: string }) {
  return <span className={`gh-verbo gh-verbo--${metodo.toLowerCase()}`}>{metodo.toLowerCase()}</span>;
}

const FECHA_LARGA = new Intl.DateTimeFormat('es', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
const FECHA_HORA = new Intl.DateTimeFormat('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** «jue, 7 nov 2026», como «Thu, Nov 7 2024» en GitHub. */
export const fechaLarga = (iso: string | number | null | undefined): string => {
  if (iso == null) return '—';
  const t = typeof iso === 'number' ? iso : Date.parse(iso);
  return Number.isFinite(t) ? FECHA_LARGA.format(t) : '—';
};

/** «8 oct, 14:05» en la zona del navegador, o «—». */
export const fechaCorta = (iso: string | null | undefined): string => {
  if (!iso) return '—';
  const t = Date.parse(iso);
  return Number.isFinite(t) ? FECHA_HORA.format(t) : '—';
};

/** El «Last used within the last week» de GitHub, en una frase. */
export function ultimoUso(iso: string | null | undefined): string {
  if (!iso) return 'Nunca usado';
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return 'Nunca usado';
  const dias = (Date.now() - t) / 86_400_000;
  if (dias < 1) return 'Usado en las últimas 24 horas';
  if (dias < 7) return 'Usado en la última semana';
  if (dias < 14) return 'Usado en las últimas 2 semanas';
  if (dias < 31) return 'Usado en el último mes';
  if (dias < 92) return 'Usado en los últimos 3 meses';
  return `Usado por última vez el ${fechaLarga(t)}`;
}
