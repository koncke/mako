'use client';

// =============================================================================
// PlantillasPropiasHoja — «Tus plantillas» y «De la comunidad» en la galería de «Nueva hoja» del Dashboard (18/11/2026)
// =============================================================================
// Leila (30/10/2026): las plantillas que guardó el negocio («Guardar como plantilla», en el ⋮ de una hoja) y las mejores de la
// comunidad, PRIMERO en «Nuevo …», al lado de las de MaKo (el molde de Copywriting y del Image Editor: `usePlantillasPropias`).
// En el Dashboard la tarjeta es la de la galería (`.nh-plantilla` de ./NuevaHoja.tsx): la miniatura de la hoja de verdad
// (./MiniaturaHoja.tsx, con datos de ejemplo), «Usar plantilla» al pasar el mouse, el nombre y, donde va «Sugerido», su
// insignia (🔒 sólo tu negocio, o sus estrellas: app/creaciones/plantillas-tarjeta.ts). Por eso viajan CON su definición.
//
// ⚠️ USARLA EN EL DASHBOARD NO NAVEGA: el editor tiene el informe abierto y lo autoguarda con su versión, así que la hoja la
//    agrega él (`onCrear`, la misma puerta que una plantilla de MaKo). El server da la definición y cuenta el uso
//    (`tomar` → lib/creaciones.ts `tomarCreacion`); la hoja entra con ids nuevos (`hojaParaUsar`, lib/creaciones-dashboard.ts).
//    Desde el editor de General (la galería única, `conTodas`) la hoja es del OTRO informe: la suma el server al informe del
//    Dashboard (`usarCreacionAction`) y se abre ahí con una navegación DURA, como una plantilla del otro informe.
// ⚠️ Sin la tabla o sin permiso (un miembro que no es admin), la lista queda vacía y la galería es la de siempre.
// =============================================================================

import { useMemo, useState } from 'react';
import { useWs } from '@/app/_ui/Link';
import { conWs } from '@/lib/ws-tab';
import { usePlantillasPropias } from '@/app/creaciones/usePlantillasPropias';
import { usarCreacionAction } from '@/app/creaciones/actions';
import { tarjetaDeCreacion } from '@/app/creaciones/plantillas-tarjeta';
import { hojaParaUsar, leerDefinicionDashboard } from '@/lib/creaciones-dashboard';
import type { CreacionConDefinicion } from '@/lib/creaciones';
import type { Hoja } from '@/lib/graficos-catalogo';
import { MiniaturaHoja } from './MiniaturaHoja';

const plano = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function PlantillasPropiasHoja({ busca, deshabilitado, enElDashboard, onCrear, onError }: {
  busca: string;
  deshabilitado: boolean;
  /** El editor abierto es el del Dashboard (la hoja se agrega acá). Si no (General), se suma al Dashboard y se abre allá. */
  enElDashboard: boolean;
  onCrear: (h: Hoja) => void;
  onError: (texto: string) => void;
}) {
  const ws = useWs();
  const propias = usePlantillasPropias('dashboard', { conDefinicion: true });
  const [usando, setUsando] = useState<number | null>(null);

  const tarjetas = useMemo(() => {
    const lista = propias.creaciones;
    if (!lista) return [];
    const q = plano(busca.trim());
    const de = (c: CreacionConDefinicion, quien: 'mia' | 'comunidad') => ({ c, hoja: leerDefinicionDashboard(c.definicion)?.hoja ?? null, insignia: tarjetaDeCreacion(c, quien).insignia ?? '' });
    return [...lista.mias.map((c) => de(c, 'mia')), ...lista.comunidad.map((c) => de(c, 'comunidad'))]
      .filter((x) => !q || plano(`${x.c.titulo} ${x.c.descripcion}`).includes(q));
  }, [propias.creaciones, busca]);

  const usar = async (c: CreacionConDefinicion) => {
    if (usando != null || deshabilitado) return;
    setUsando(c.id);
    try {
      if (!enElDashboard) {
        const r = await usarCreacionAction(c.id).catch(() => ({ error: 'Sin conexión' }));
        if ('error' in r) { onError(r.error); return; }
        window.location.assign(conWs(r.ruta, ws));
        return;
      }
      const r = await propias.tomar(c.id);
      if ('error' in r) { onError(r.error); return; }
      const h = hojaParaUsar(r.definicion);
      if (!h) { onError('Esa plantilla no se pudo leer.'); return; }
      onCrear(h);
    } finally {
      setUsando(null);
    }
  };

  return (
    <>
      {tarjetas.map(({ c, hoja, insignia }) => (
        <button key={c.id} type="button" className="nh-plantilla" data-propia={c.id} disabled={deshabilitado || usando != null}
          aria-label={`Usar la plantilla ${c.titulo} (${insignia})`} onClick={() => { void usar(c); }}>
          <span className="nh-mini">
            <MiniaturaHoja hoja={hoja} />
            <span className="nh-usar">Usar plantilla</span>
          </span>
          <span className="nh-pie">
            <span className="nh-nombre">{c.titulo}</span>
            <span className="nh-sugerido" title={insignia}>{insignia}</span>
          </span>
        </button>
      ))}
    </>
  );
}
