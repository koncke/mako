'use client';

// =============================================================================
// ExportarCerebro — bajarse el segundo cerebro como carpetas y archivos
// =============================================================================
// Replica el molde de app/plan/board/ExportarModal.tsx, con dos diferencias
// deliberadas:
//
//  1. Se le pasan `pasos` + `pasoActual` al WizardShell, NO `total`/`idx`. Los dos
//     ejemplares que hay en el repo usan lo viejo porque son anteriores al contrato
//     nuevo, y el JSDoc de la pieza es explícito: si el wizard tiene RAMAS se le pasa
//     el mapa. Éste la tiene (el paso de formato solo aparece si hay algo que bajar),
//     así que copiar el molde tal cual heredaría el defecto.
//  2. NO se usa `ListaElegible`: tiene buscador y orden alfabético, y sobre DIEZ áreas
//     fijas el buscador es ruido y el alfabético destruiría el orden narrativo que
//     `AREAS` eligió a propósito (sigue el recorrido del onboarding, no el abecedario).
//
// El criterio para que una pregunta se gane su lugar: **las dos respuestas tienen que
// producir archivos que personas distintas quieren de verdad.** Por eso son dos pasos
// y no cinco — «¿en qué formato?» no se pregunta porque la respuesta es siempre la
// misma, y un paso que se contesta solo es un paso que sobra.
// =============================================================================

import { useMemo, useState } from 'react';
import { WizardShell } from '@/app/_components/WizardShell';
import { AREAS, type AreaId, type Cerebro } from '@/lib/cerebro-modelo';
import { MONO, SANS } from '@/app/_ui/tokens';

/** Copiada, no compartida: es el mismo criterio con el que vive dos veces en el repo
 *  (ExportarModal y ExportarLeadsModal). Son diez líneas y sacarlas a un módulo
 *  común obligaría a parametrizar tres estilos para ahorrar nada. */
function Opcion({ on, titulo, sub, onClick, off = false }: { on: boolean; titulo: string; sub?: string; onClick: () => void; off?: boolean }) {
  return (
    <button
      type="button"
      onClick={off ? undefined : onClick}
      disabled={off}
      style={{
        width: '100%', padding: '12px 15px', borderRadius: 12, textAlign: 'left', fontFamily: SANS,
        display: 'flex', alignItems: 'center', gap: 11, cursor: off ? 'default' : 'pointer',
        transition: 'border-color .12s, background .12s',
        border: `1px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`,
        background: on ? 'var(--primary-bg)' : 'var(--surface-2)',
        color: off ? 'var(--faint)' : on ? 'var(--primary)' : 'var(--ink)',
        opacity: off ? 0.55 : 1,
      }}
    >
      <span style={{ width: 18, height: 18, flex: 'none', borderRadius: 6, border: `1.5px solid ${on ? 'var(--primary)' : 'var(--border-strong)'}`, background: on ? 'var(--primary)' : 'transparent', color: '#fff', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{on ? '✓' : ''}</span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 14.5, fontWeight: on ? 700 : 600 }}>{titulo}</span>
        {sub && <span style={{ display: 'block', fontSize: 12, color: 'var(--faint)', marginTop: 1 }}>{sub}</span>}
      </span>
    </button>
  );
}

export function ExportarCerebro({ cerebro, conteo, onClose }: {
  cerebro: Cerebro;
  conteo: Record<string, number>;
  onClose: () => void;
}) {
  // Arranca con TODO lo que tiene contenido tildado: el que quiere todo aprieta
  // «Descargar» y listo, y el que quiere solo su oferta destilda el resto. El default
  // sirve al caso frecuente y no le cuesta nada al caso raro.
  const conContenido = useMemo(() => AREAS.filter((a) => (conteo[a.id] ?? 0) > 0).map((a) => a.id as AreaId), [conteo]);
  const [elegidas, setElegidas] = useState<Set<AreaId>>(new Set(conContenido));
  const [bajando, setBajando] = useState(false);
  const [error, setError] = useState('');

  const archivos = useMemo(
    () => [...elegidas].reduce((n, a) => n + (conteo[a] ?? 0), 0),
    [elegidas, conteo],
  );
  const hayAlgo = archivos > 0;

  const alternar = (id: AreaId) => setElegidas((s) => {
    const n = new Set(s);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  async function bajar() {
    setBajando(true);
    setError('');
    try {
      const r = await fetch('/api/second-brain/exportar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ areas: [...elegidas] }),
      });
      if (!r.ok) throw new Error(`el servidor devolvió ${r.status}`);
      const blob = await r.blob();
      // El nombre lo pone el servidor en el Content-Disposition: es el único que sabe
      // cómo se llama el negocio y cuántas áreas entraron.
      const cd = r.headers.get('content-disposition') ?? '';
      const nombre = /filename="([^"]+)"/.exec(cd)?.[1] ?? 'segundo-cerebro.zip';
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Diferido: revocar en la misma vuelta cancela la descarga en Safari.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBajando(false);
    }
  }

  const resumen = `${archivos} ${archivos === 1 ? 'archivo' : 'archivos'}`;
  const todasTildadas = elegidas.size === conContenido.length;

  return (
    <WizardShell
      titulo={`Bajar tu segundo cerebro · ${resumen}`}
      pasos={['Qué te llevás']}
      pasoActual="Qué te llevás"
      pregunta="¿Qué te llevás?"
      ancho={760}
      puedeAvanzar={hayAlgo}
      enUltimo
      confirmLabel={bajando ? 'Armando el ZIP…' : hayAlgo ? 'Descargar ↓' : 'No hay nada para bajar'}
      atrasLabel="Cancelar"
      onAtras={onClose}
      onSiguiente={() => {}}
      onConfirmar={() => { if (hayAlgo && !bajando) void bajar(); }}
      onClose={onClose}
      extraFooter={
        <span style={{ fontFamily: MONO, fontSize: 11, color: error ? 'var(--bad)' : 'var(--faint)' }}>
          {error ? `No se pudo: ${error}` : resumen}
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => setElegidas(todasTildadas ? new Set() : new Set(conContenido))}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: MONO, fontSize: 11, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--primary)' }}
          >
            {todasTildadas ? 'Ninguna' : 'Todas'}
          </button>
        </div>

        {AREAS.map((a) => {
          const n = conteo[a.id] ?? 0;
          return (
            <Opcion
              key={a.id}
              on={elegidas.has(a.id as AreaId)}
              off={n === 0}
              titulo={a.nombre}
              // Un área vacía se muestra apagada y no se ofrece: preguntar por algo
              // que no existe hace que el formulario se sienta roto.
              sub={n === 0 ? 'todavía vacía' : `${n} ${n === 1 ? 'archivo' : 'archivos'} · ${a.que}`}
              onClick={() => alternar(a.id as AreaId)}
            />
          );
        })}

        <p style={{ margin: '6px 0 0', fontSize: 'var(--fs-sm)', color: 'var(--faint)', lineHeight: 1.55 }}>
          Bajás una carpeta con archivos de texto. Cada uno dice de dónde salió el dato y con qué está conectado.
          Si la abrís con Obsidian vas a ver el mismo mapa que acá.
        </p>
      </div>
    </WizardShell>
  );
}
