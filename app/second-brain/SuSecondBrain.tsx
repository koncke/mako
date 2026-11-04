'use client';

// =============================================================================
// El Second Brain de un gurú: el grafo de su curso (3/11/2026, #18; rehecho el 4/11/2026)
// =============================================================================
// Martín (4/11/2026): «en lugar de "Su Second Brain" que diga "Second Brain de NOMBRE DEL GURU" y que esté alineado a la derecha del
// todo... Cuando le doy click no debe abrirse un modal, sino que debe reemplazar lo que está en el chat para mostrar su second brain,
// y en el botón de "Second Brain de..." que esté "Volver al chat"».
//   · EL BOTÓN es uno y cambia de rótulo: «Second Brain de Hormozi» ↔ «Volver al chat». Va a la derecha del todo de la cabecera
//     (`.co-cab__cerebro`, centro.css) y es lo último de sus acciones.
//   · EL GRAFO ocupa el lugar de la conversación (PanelChat.tsx → `reemplazo`): la conversación queda montada y escondida, y al volver
//     sigue donde estaba. En el teléfono va adentro de su hoja (app/m/second-brain/HojaDelGuru.tsx), en el lugar del hilo.
//   · LA FORMA del grafo (módulos con color, tamaños, títulos por sección) la arma el servidor: lib/cerebro-referente-vista.ts.
// Lo usan los tres chats donde aconseja un gurú: el suyo, el Funnel Coach y una conversación de Offer. La física y el lienzo pesan:
// se bajan recién cuando se abre.

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { CargandoMako } from '@/app/_ui/CargandoMako';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import type { Asesor } from '@/lib/asesores/catalogo';
import { filtroVacio, type EstadoFiltro } from '@/lib/cerebro-filtro';
import type { Cerebro } from '@/lib/cerebro-modelo';

const Grafo = dynamic(() => import('./Grafo').then((m) => m.Grafo), { ssr: false, loading: () => <CargandoMako que="su Second Brain" alto="100%" /> });

/** Lo que dice el botón: su Second Brain mientras se ve el chat, «Volver al chat» mientras se ve su Second Brain. */
export const rotuloSecondBrain = (r: Pick<Asesor, 'nombre'>, viendo: boolean): string => (viendo ? 'Volver al chat' : `Second Brain de ${r.nombre}`);

/** El botón de la cabecera. Quien lo monta guarda si se está viendo y pone el grafo en el lugar de la conversación. */
export function BotonSecondBrainDe({ referente: r, viendo, onCambiar }: { referente: Asesor; viendo: boolean; onCambiar: (viendo: boolean) => void }) {
  return (
    <button type="button" className="co-chip co-cab__cerebro" aria-pressed={viendo} onClick={() => onCambiar(!viendo)}>
      {rotuloSecondBrain(r, viendo)}
    </button>
  );
}

/** El grafo de SU curso, en oscuro como el Second Brain del negocio (VistaCerebro.tsx): está pensado para ese fondo. */
export function CerebroDelGuru({ referente: r, movil = false }: { referente: Asesor; movil?: boolean }) {
  const [cerebro, setCerebro] = useState<Cerebro<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoFiltro>(filtroVacio);
  useEffect(() => {
    let vivo = true;
    setCerebro(null);
    setError(null);
    void fetch(`/api/mako/chat?cerebroDe=${encodeURIComponent(r.id)}`, { cache: 'no-store' })
      .then((x) => x.json()).catch(() => null)
      .then((j: { ok?: boolean; cerebro?: Cerebro<string>; error?: string } | null) => {
        if (!vivo) return;
        if (j?.ok && j.cerebro) setCerebro(j.cerebro);
        else setError(j?.error ?? 'No se pudo leer su Second Brain. Prueba de nuevo en un momento.');
      });
    return () => { vivo = false; };
  }, [r.id]);
  return (
    <div data-tema="oscuro" style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)', colorScheme: 'dark', borderRadius: 12, overflow: 'hidden' }}>
      {error ? <p className="co-vacio" role="alert">{error}<ReportarASoporte /></p>
        : cerebro ? <Grafo cerebro={cerebro} filtro={filtro} onFiltro={setFiltro} movil={movil} />
        : <CargandoMako que="su Second Brain" alto="100%" />}
    </div>
  );
}
