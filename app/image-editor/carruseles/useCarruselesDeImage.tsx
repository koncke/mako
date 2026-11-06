'use client';

// =============================================================================
// useCarruselesDeImage — lo de los carruseles en la portada de Image: las miniaturas y «Ver ejemplo»
// =============================================================================
// Aparte de ../ImageEditorCliente.tsx (la pantalla del editor) para que el cableado de los carruseles viva junto: la miniatura
// de cada carrusel por tipo (el MISMO documento que crea la acción, con el nombre del negocio: lo que se ve es lo que se va
// a crear) y el diálogo «Ver ejemplo» (un negocio ficticio, aparte). Se carga a pedido: no viaja con la portada.
// «Hacer el mío» (con su «Elige el tipo») se fue el 6/11/2026: un ejemplo del explorador se EDITA directo
// (./EditarCarrusel.tsx, Martín: «del ejemplo a la edición, sin pasos que no aporten»).
// =============================================================================

import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { documentoDeCarrusel, type Marca } from '@/lib/carruseles/documento';
import { tipoCarrusel, type TipoCarrusel } from '@/lib/carruseles/tipos';
import { estiloConKit, logoDeKit } from '@/lib/carruseles/marca-kit';
import { fuenteDelEditorDeImagen } from '@/lib/image-editor/fuente-del-editor';
import type { KitMarca } from '@/lib/marca/kits';
import { PLANTILLAS_NUEVO_DISENO } from '../plantillas-crear';
import { MiniaturaCarrusel } from './MiniaturaCarrusel';

const VerEjemplo = dynamic(() => import('./DialogosCarrusel').then((m) => m.VerEjemplo), { ssr: false });

let contador = 0;
const idLocal = () => `m${++contador}`;

/** El documento de cada carrusel por tipo, con la estructura del tipo y la marca del negocio. */
function docsDeCarruseles(marca: Marca, kit: KitMarca | null): Map<string, Record<string, unknown>> {
  const out = new Map<string, Record<string, unknown>>();
  for (const p of PLANTILLAS_NUEVO_DISENO) {
    const t = p.carrusel ? tipoCarrusel(p.carrusel) : null;
    // Con el kit de marca (5/11/2026), como lo arma el server al crearlo (app/image-editor/actions.ts).
    if (t) out.set(p.id, documentoDeCarrusel({ laminas: t.estructura(t.laminas.def), estilo: estiloConKit(t.estilo, kit, fuenteDelEditorDeImagen), marca, nuevoId: idLocal }));
  }
  return out;
}

export function useCarruselesDeImage({ negocio, kit = null, crearPlantilla }: {
  /** El nombre del negocio (sin él, «Tu negocio»: la guía de dónde va). */
  negocio: string | null;
  /** El kit de marca de por defecto: colores, fuentes y logo (lib/marca/kits.ts). */
  kit?: KitMarca | null;
  /** Crear con una plantilla de «Nuevo diseño» (la misma de la tarjeta): un texto de vuelta es el error. */
  crearPlantilla: (id: string) => Promise<string | null>;
}): {
  miniatura: (p: { id: string; nombre: string }) => ReactNode;
  onVerEjemplo: (p: { id: string }) => void;
  dialogos: ReactNode;
} {
  const marca = useMemo<Marca>(() => ({ nombre: negocio?.trim() || 'Tu negocio', usuario: null, logo: logoDeKit(kit) }), [negocio, kit]);
  const docs = useMemo(() => docsDeCarruseles(marca, kit), [marca, kit]);
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

  const dialogos = (
    <>
      {ejemplo && (
        <VerEjemplo tipo={ejemplo.tipo} onCerrar={() => setEjemplo(null)} onUsar={() => crearPlantilla(ejemplo.plantilla)} />
      )}
    </>
  );
  return { miniatura, onVerEjemplo, dialogos };
}
