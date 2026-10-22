'use client';

// =============================================================================
// TipoEtapaModal — «Tipo de etapa» desde el «⋯» de una columna del CRM (21/10/2026)
// =============================================================================
// Martín, 21/10/2026: «En cada columna, a excepción de las que ya sabes que no deberían cambiar, debes poner en los 3
// puntos una opción de "Tipo de etapa" para poder decidir si es una etapa de reunión, o las otras que tenemos».
// Los tres tipos del desplegable del pop-up de etapas (Etapa / Reunión / Nutrición), con lo que ES cada uno y, al
// elegir otro, lo que PASA (`avisoCambioDeTipo`, lib/etapa-reunion.ts): qué les pasa a los leads de la columna, qué
// reuniones cambian de número, el evento que deja de caer acá. Guarda la pantalla (`onCambiar` → la op `tipo` de
// `editarEtapaAction`, la MISMA del pop-up de etapas), con su «Deshacer».
// Qué columnas lo llevan: `columnaConTipo` (ni la entrada, ni el cierre, ni las terminales).
// =============================================================================

import { useEffect, useState } from 'react';
import { Modal } from '@/app/_ui';
import { IconoMenu, type NombreIconoMenu } from '@/app/_ui/iconos-menu';
import {
  DETALLE_TIPO_ETAPA, NOMBRE_TIPO_ETAPA, TIPOS_ETAPA, avisoCambioDeTipo, tipoDeColumna, type TipoEtapa,
} from '@/lib/etapa-reunion';
import { listarEventosAgendaAction } from './agenda-evento-actions';

const ICONO_TIPO: Readonly<Record<TipoEtapa, NombreIconoMenu>> = { etapa: 'etapa', reunion: 'evento', nutricion: 'repetir' };

type Columna = { key: string; label: string; kind?: string; marcadaComo?: string; band?: string };

export function TipoEtapaModal({ columna, recorrido, leads, funnelId, onCambiar, onCerrar }: {
  columna: Columna;
  /** Las etapas del recorrido del funnel, en orden (banda `pipeline`): para contar las reuniones. */
  recorrido: readonly Columna[];
  /** Cuántos leads hay en la columna (los que dibuja el tablero). */
  leads: number;
  /** El funnel que se mira (para buscar el evento vinculado a esta etapa); null = el del negocio. */
  funnelId: number | null;
  onCambiar: (tipo: TipoEtapa) => Promise<boolean>;
  onCerrar: () => void;
}) {
  const actual = tipoDeColumna(columna);
  const [elegido, setElegido] = useState<TipoEtapa>(actual);
  const [guardando, setGuardando] = useState(false);
  const [evento, setEvento] = useState<string | null>(null);

  // Sólo si HOY es reunión: el evento que deja de caer acá al cambiarla. Sin agenda conectada, no hay ninguno.
  useEffect(() => {
    if (actual !== 'reunion') return;
    let vivo = true;
    void listarEventosAgendaAction().then((r) => {
      if (!vivo || !r.ok) return;
      const e = r.eventos.find((x) => x.vinculo && x.vinculo.etapa === columna.key && (funnelId == null || x.vinculo.funnelId === funnelId));
      setEvento(e ? e.nombre : null);
    }).catch(() => { /* sin la lectura, el aviso no nombra el evento */ });
    return () => { vivo = false; };
  }, [actual, columna.key, funnelId]);

  const aviso = avisoCambioDeTipo({ recorrido, columna, tipo: elegido, leads, evento });
  const cambiar = async () => {
    setGuardando(true);
    const ok = await onCambiar(elegido);
    setGuardando(false);
    if (ok) onCerrar();
  };

  return (
    <Modal titulo={`Tipo de etapa · ${columna.label}`} ancho={500} onCerrar={onCerrar}
      pie={(
        <>
          <button type="button" onClick={onCerrar} disabled={guardando}
            style={{ height: 38, padding: '0 16px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: 'inherit', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            Cancelar
          </button>
          <button type="button" onClick={() => void cambiar()} disabled={guardando || elegido === actual}
            style={{ height: 38, padding: '0 16px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'var(--on-primary)', fontFamily: 'inherit', fontSize: 14, fontWeight: 650, cursor: elegido === actual ? 'default' : 'pointer', opacity: guardando || elegido === actual ? 0.5 : 1 }}>
            {elegido === actual ? 'Ya es así' : `Cambiar a ${NOMBRE_TIPO_ETAPA[elegido]}`}
          </button>
        </>
      )}>
      <div role="radiogroup" aria-label="Tipo de etapa" style={{ display: 'grid', gap: 8 }}>
        {TIPOS_ETAPA.map((t) => {
          const on = elegido === t;
          return (
            <button key={t} type="button" role="radio" aria-checked={on} disabled={guardando} onClick={() => setElegido(t)}
              style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '11px 12px', borderRadius: 12, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border)'}`, background: on ? 'var(--primary-bg)' : 'var(--surface)' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 32, height: 32, flex: 'none', borderRadius: 9, background: 'var(--surface-2)', color: on ? 'var(--primary)' : 'var(--dim)' }}>
                <IconoMenu nombre={ICONO_TIPO[t]} size={17} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>
                  {NOMBRE_TIPO_ETAPA[t]}{t === actual ? <span style={{ fontWeight: 500, color: 'var(--dim)' }}> · la de ahora</span> : null}
                </span>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--dim)', marginTop: 1 }}>{DETALLE_TIPO_ETAPA[t]}</span>
              </span>
            </button>
          );
        })}
      </div>
      {aviso.length > 0 && (
        <div role="status" style={{ marginTop: 14, padding: '10px 12px', borderRadius: 12, background: 'var(--surface-2)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--dim)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>Qué pasa</div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 3 }}>
            {aviso.map((l) => <li key={l} style={{ fontSize: 13.5, color: 'var(--ink)', lineHeight: 1.4 }}>{l}</li>)}
          </ul>
        </div>
      )}
    </Modal>
  );
}
