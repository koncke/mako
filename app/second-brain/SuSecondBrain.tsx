'use client';

// =============================================================================
// «Su Second Brain»: el grafo del curso de un gurú (3/11/2026, #18)
// =============================================================================
// Martín: «No veo el second brain de los gurus en los chats de Ops Center». Una clase por punto, encadenadas en orden
// (lib/cerebro-referente.ts). Lo acomoda el servidor (`?cerebroDe=`), sin el texto de las clases, y el grafo pesa (la física y el
// lienzo): se baja recién cuando se abre. Lo usan los tres chats donde aconseja un gurú: el suyo, el Funnel Coach y una conversación
// de Offer. El teléfono dibuja `CerebroDelGuru` adentro de su hoja: una hoja sobre otra la reemplaza (SheetM).

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Modal } from '@/app/_ui';
import { CargandoMako } from '@/app/_ui/CargandoMako';
import type { Asesor } from '@/lib/asesores/catalogo';
import { filtroVacio, type EstadoFiltro } from '@/lib/cerebro-filtro';
import type { Cerebro } from '@/lib/cerebro-modelo';

const Grafo = dynamic(() => import('./Grafo').then((m) => m.Grafo), { ssr: false, loading: () => <CargandoMako que="su Second Brain" alto="100%" /> });

/** El chip de la cabecera y el modal que abre. */
export function BotonSuSecondBrain({ referente: r }: { referente: Asesor }) {
  const [viendo, setViendo] = useState(false);
  return (
    <>
      <button type="button" className="co-chip" onClick={() => setViendo(true)}>Su Second Brain</button>
      {viendo && (
        <Modal titulo={`El Second Brain de ${r.nombre}`} onCerrar={() => setViendo(false)} ancho={1100} alto="min(84vh, 760px)">
          <CerebroDelGuru referente={r} />
        </Modal>
      )}
    </>
  );
}

/** El grafo de SU curso, en oscuro como el Second Brain del negocio (VistaCerebro.tsx): está pensado para ese fondo. */
export function CerebroDelGuru({ referente: r }: { referente: Asesor }) {
  const [cerebro, setCerebro] = useState<Cerebro<string> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<EstadoFiltro>(filtroVacio);
  useEffect(() => {
    let vivo = true;
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
    <div data-tema="oscuro" style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--bg)', color: 'var(--ink)', colorScheme: 'dark', borderRadius: 12, overflow: 'hidden' }}>
      {error ? <p className="co-vacio">{error}</p>
        : cerebro ? <Grafo cerebro={cerebro} filtro={filtro} onFiltro={setFiltro} />
        : <CargandoMako que="su Second Brain" alto="100%" />}
    </div>
  );
}
