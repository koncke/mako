'use client';

// =============================================================================
// LimitesEnvioPanel — el NÚMERO con sus flechas de las filas de Configuraciones de una automatización
// =============================================================================
// Era el panel de los LÍMITES DE LA LÍNEA (décima tanda, 11/10/2026: por día, por hora, «MaKo contesta sola»), y desde el
// 22/10 su estado (`useLimitesDeLaLinea`). El 23/10/2026 (Martín, por el Cerebro): «No quiero nada para todas las
// automatizaciones». Lo de la línea se fue de la pantalla, con su hook, su ⓘ (el uso del cupo y «Primero lo que entra») y las
// acciones que lo leían y guardaban (app/configuraciones/limites-actions.ts): los topes duros de la línea siguen cuidando al
// número por dentro (lib/limites-envio.ts), y cuando frenan un envío lo dice la tarjeta («Tope del día», lib/por-que-no-sale.ts).
// Queda `Numero`, que usan las filas de la automatización. El archivo conserva su nombre: lo citan los «Vive en:».

import { useState, type CSSProperties } from 'react';
import { Icon } from '@/app/_components/icons';
import { leerNumero } from '@/lib/limites-envio';

const SANS = "'Geist', sans-serif";

/**
 * El número con sus dos flechas. Las flechas no pasan del rango; lo escrito a mano se valida al salir.
 * `apagado` (22/10/2026, Anti-ban): la opción no aplica, el número se ve GRIS y no se toca (se prende con su interruptor).
 */
export function Numero({ valor, min, max, disabled: noEdita, etiqueta, onCambio, onInvalido, apagado = false }: {
  valor: number; min: number; max: number; disabled: boolean; etiqueta: string;
  onCambio: (n: number) => void; onInvalido: (error: string | null) => void; apagado?: boolean;
}) {
  const disabled = noEdita || apagado;
  const [texto, setTexto] = useState(String(valor));
  // Lo guardado cambió por otro lado («Restaurar», la lectura): el campo lo sigue.
  const [visto, setVisto] = useState(valor);
  if (visto !== valor) { setVisto(valor); setTexto(String(valor)); }
  const escribir = (t: string) => {
    setTexto(t);
    const r = leerNumero(t, min, max);
    if (r.ok) { onInvalido(null); onCambio(r.n); } else onInvalido(r.error);
  };
  const flecha = (d: 1 | -1) => {
    const n = Math.min(max, Math.max(min, valor + d));
    setTexto(String(n)); onInvalido(null);
    if (n !== valor) onCambio(n);
  };
  const btn: CSSProperties = {
    width: 22, height: 15, padding: 0, border: 'none', background: 'transparent', color: 'var(--dim)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: disabled ? 'default' : 'pointer',
  };
  return (
    <div data-numero-apagado={apagado ? '' : undefined} style={{ display: 'inline-flex', alignItems: 'center', border: `1px solid ${apagado ? 'var(--border)' : 'var(--border-strong)'}`, borderRadius: 10, background: apagado ? 'var(--surface-2)' : 'var(--surface)', height: 34, boxSizing: 'border-box', overflow: 'hidden', flex: 'none' }}>
      <input value={texto} disabled={disabled} inputMode="numeric" aria-label={etiqueta}
        onChange={(e) => escribir(e.target.value.replace(/[^\d]/g, ''))}
        onKeyDown={(e) => { if (e.key === 'ArrowUp') { e.preventDefault(); flecha(1); } else if (e.key === 'ArrowDown') { e.preventDefault(); flecha(-1); } }}
        style={{ width: 52, height: '100%', border: 'none', outline: 'none', background: 'transparent', textAlign: 'center', fontFamily: SANS, fontSize: 14.5, fontWeight: 600, color: apagado ? 'var(--faint)' : 'var(--ink)' }} />
      <div style={{ display: 'flex', flexDirection: 'column', borderLeft: '1px solid var(--border)' }}>
        <button type="button" aria-label={`Subir ${etiqueta}`} disabled={disabled || valor >= max} onClick={() => flecha(1)} style={btn}>
          <span style={{ display: 'flex', transform: 'rotate(180deg)' }}><Icon name="chevron" size={13} /></span>
        </button>
        <button type="button" aria-label={`Bajar ${etiqueta}`} disabled={disabled || valor <= min} onClick={() => flecha(-1)} style={{ ...btn, borderTop: '1px solid var(--border)' }}>
          <Icon name="chevron" size={13} />
        </button>
      </div>
    </div>
  );
}
