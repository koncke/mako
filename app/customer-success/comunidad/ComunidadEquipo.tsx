'use client';

// =============================================================================
// ComunidadEquipo — la tab Comunidad del EQUIPO (/customer-success/comunidad)
// =============================================================================
// La misma comunidad que ve el alumno (app/_comunidad/Comunidad.tsx), con la piel de la app y las
// server actions de ./actions.ts como camino al server. El equipo escribe con su nombre y es admin de
// la comunidad: fija, borra lo ajeno y —si administra el workspace— arma las categorías y los nombres
// de los niveles.
//
// El producto se elige arriba, como en el Curso: es un `?producto=` en la URL, leído en el server, así
// la página llega con su comunidad ya armada (sin estado de carga) y el link que se copia es la
// comunidad que se está mirando.

import { useMemo } from 'react';
import { EmptyState, Pagina, Select } from '@/app/_ui';
import { useRouter } from '@/app/_ui/Link';
import { Comunidad } from '@/app/_comunidad/Comunidad';
import type { ComunidadVista, FeedVista } from '@/lib/comunidad-tipos';
import type { PasoComunidad } from './onboarding-comunidad';
// La API del equipo vive en ./api-equipo.ts desde el 08/10/2026: la usa también la lección del editor
// del curso (los comentarios de una clase), y desde acá habría arrastrado la comunidad entera.
import { apiDelEquipo } from './api-equipo';

const ROTULO_PASO: Record<PasoComunidad, string> = {
  comunidad_categorias: 'Tus categorías',
  comunidad_post: 'Tu primer post',
  comunidad_alumnos: 'Un alumno participa',
};

export function ComunidadEquipo({ productos, productoId, inicial, error, onboarding, postInicial = null }: {
  productos: Array<{ id: number; nombre: string }>;
  productoId: number | null;
  inicial: { comunidad: ComunidadVista; feed: FeedVista } | null;
  error: string | null;
  /** La línea del onboarding de la tab (`null` = ya está). */
  onboarding: Record<PasoComunidad, boolean> | null;
  /** El post que se abre al entrar (`?post=`: el link de la ficha a lo que publicó un alumno). */
  postInicial?: number | null;
}) {
  const router = useRouter();
  const api = useMemo(() => (productoId ? apiDelEquipo(productoId) : null), [productoId]);

  if (!productos.length || !productoId || !api) {
    return (
      <Pagina>
        <EmptyState titulo="Sin productos" detalle="La comunidad es de un producto. Crea uno en el CRM." />
      </Pagina>
    );
  }

  const selector = productos.length > 1 ? (
    <div style={{ minWidth: 220 }}>
      <Select ariaLabel="Producto" value={String(productoId)}
        onChange={(v) => router.replace(`/customer-success/comunidad?producto=${encodeURIComponent(v)}`, { scroll: false })}
        options={productos.map((p) => ({ value: String(p.id), label: p.nombre }))} />
    </div>
  ) : <span className="cmu-dim cmu-chico">{productos[0].nombre}</span>;

  const linea = onboarding ? (
    <div className="cmu-onb" style={{ marginBottom: 14 }}>
      <b>Arma tu comunidad</b>
      {(Object.keys(ROTULO_PASO) as PasoComunidad[]).map((k) => (
        <span key={k} className="cmu-onb-paso" data-hecho={onboarding[k]}>{onboarding[k] ? '✓' : '○'} {ROTULO_PASO[k]}</span>
      ))}
    </div>
  ) : null;

  return (
    <Pagina>
      {error && !inicial ? (
        <EmptyState titulo="No pude cargar la comunidad" detalle={error} />
      ) : (
        <Comunidad key={productoId} api={api} tema="equipo" inicial={inicial} cabecera={selector} aviso={linea} postInicial={postInicial} />
      )}
    </Pagina>
  );
}
