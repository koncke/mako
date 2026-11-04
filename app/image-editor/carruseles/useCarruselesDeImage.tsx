'use client';

// =============================================================================
// useCarruselesDeImage — lo de los carruseles en la portada de Image: miniaturas, «Ver ejemplo» y «Hacer el mío»
// =============================================================================
// Aparte de ../ImageEditorCliente.tsx (la pantalla del editor) para que el cableado de los carruseles viva junto: la miniatura
// de cada carrusel por tipo (el MISMO documento que crea la acción, con el nombre del negocio: lo que se ve es lo que se va
// a crear), el diálogo «Ver ejemplo» (un negocio ficticio, aparte) y «Hacer el mío» desde una referencia del explorador.
// Los diálogos se cargan a pedido: no viajan con la portada.
// =============================================================================

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { documentoDeCarrusel, type Marca } from '@/lib/carruseles/documento';
import { tipoCarrusel, type TipoCarrusel } from '@/lib/carruseles/tipos';
import type { Carrusel } from '@/lib/carruseles/explorar';
import { PLANTILLAS_NUEVO_DISENO } from '../plantillas-crear';
import { rutaDiseno } from '../ruta';
import { MiniaturaCarrusel } from './MiniaturaCarrusel';
import { crearCarruselDesdeReferenciaAction } from './actions';

const VerEjemplo = dynamic(() => import('./DialogosCarrusel').then((m) => m.VerEjemplo), { ssr: false });
const HacerElMio = dynamic(() => import('./DialogosCarrusel').then((m) => m.HacerElMio), { ssr: false });

let contador = 0;
const idLocal = () => `m${++contador}`;

/** El documento de cada carrusel por tipo, con la estructura del tipo y la marca del negocio. */
function docsDeCarruseles(marca: Marca): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const p of PLANTILLAS_NUEVO_DISENO) {
    const t = p.carrusel ? tipoCarrusel(p.carrusel) : null;
    if (t) out.set(p.id, documentoDeCarrusel({ laminas: t.estructura(t.laminas.def), estilo: t.estilo, marca, nuevoId: idLocal }));
  }
  return out;
}

export function useCarruselesDeImage({ negocio, crearPlantilla }: {
  /** El nombre del negocio (sin él, «Tu negocio»: la guía de dónde va). */
  negocio: string | null;
  /** Crear con una plantilla de «Nuevo diseño» (la misma de la tarjeta): un texto de vuelta es el error. */
  crearPlantilla: (id: string) => Promise<string | null>;
}): {
  miniatura: (p: { id: string; nombre: string }) => ReactNode;
  onVerEjemplo: (p: { id: string }) => void;
  onUsar: (c: Carrusel) => void;
  dialogos: ReactNode;
} {
  const router = useRouter();
  const marca = useMemo<Marca>(() => ({ nombre: negocio?.trim() || 'Tu negocio', usuario: null }), [negocio]);
  const docs = useMemo(() => docsDeCarruseles(marca), [marca]);
  const miniatura = useCallback((p: { id: string; nombre: string }) => {
    const doc = docs.get(p.id);
    return doc ? <MiniaturaCarrusel doc={doc} nombre={p.nombre} /> : null;
  }, [docs]);

  const [ejemplo, setEjemplo] = useState<{ plantilla: string; tipo: TipoCarrusel } | null>(null);
  const onVerEjemplo = useCallback((p: { id: string }) => {
    const pl = PLANTILLAS_NUEVO_DISENO.find((x) => x.id === p.id);
    const t = pl?.carrusel ? tipoCarrusel(pl.carrusel) : null;
    if (pl && t) setEjemplo({ plantilla: pl.id, tipo: t });
  }, []);

  const [referencia, setReferencia] = useState<Carrusel | null>(null);
  const crearDesdeReferencia = useCallback(async (tipo: string, laminas: number): Promise<string | null> => {
    if (!referencia) return null;
    const r = await crearCarruselDesdeReferenciaAction(referencia.id, tipo, laminas);
    if (!r.ok) return r.error;
    router.push(rutaDiseno(r.id));
    // El diálogo queda en «Creando…» hasta que la pantalla se va.
    return new Promise<null>(() => {});
  }, [referencia, router]);

  const dialogos = (
    <>
      {ejemplo && (
        <VerEjemplo tipo={ejemplo.tipo} onCerrar={() => setEjemplo(null)} onUsar={() => crearPlantilla(ejemplo.plantilla)} />
      )}
      {referencia && (
        <HacerElMio carrusel={referencia} marca={marca} onCerrar={() => setReferencia(null)} onCrear={crearDesdeReferencia} />
      )}
    </>
  );
  return { miniatura, onVerEjemplo, onUsar: setReferencia, dialogos };
}
