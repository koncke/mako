'use client';
// =============================================================================
// usePlantillasPropias — «Tus plantillas» y «De la comunidad» en «Nuevo …» de una tab (6/11/2026)
// =============================================================================
// Leila (30/10/2026): las plantillas que guardó el negocio («Guardar como plantilla», sólo suyas o compartidas) y las
// mejores de la comunidad, al lado de las de MaKo. Una tab que tiene enchufe (lib/creaciones-enchufes.ts) suma esto a sus
// `plantillas` de PantallaCrear y, en su `onPlantilla`, le pasa primero la tarjeta a `usar`: si es una de éstas (id
// `creacion:<n>`), la crea en el negocio con el enchufe y navega; si no, devuelve `false` y la tab sigue con lo suyo.
// Cada tarjeta lleva su grupo y su insignia: 🔒 sólo tu negocio, o las estrellas.
// ⚠️ Lo que viene de la base no traba la tab: sin la tabla, o sin permiso (un miembro que no es admin), la lista queda
// vacía y «Nuevo …» se dibuja con las de MaKo, como antes.
// =============================================================================

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import type { PlantillaCrear } from '@/app/_crear/reglas';
import type { Creacion } from '@/lib/creaciones';
import type { TipoCreacion } from '@/lib/creaciones-reglas';
import { plantillasDelTipoAction, usarCreacionAction } from './actions';
import { tarjetaDeCreacion, idDeTarjeta } from './plantillas-tarjeta';

export function usePlantillasPropias(tipo: TipoCreacion, opts: { formato?: string } = {}) {
  const router = useRouter();
  const [lista, setLista] = useState<{ mias: Creacion[]; comunidad: Creacion[] } | null>(null);
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    let vivo = true;
    plantillasDelTipoAction(tipo).then((r) => { if (vivo) setLista('error' in r ? { mias: [], comunidad: [] } : r); })
      .catch(() => { if (vivo) setLista({ mias: [], comunidad: [] }); });
    return () => { vivo = false; };
  }, [tipo, vuelta]);
  const recargar = useCallback(() => setVuelta((v) => v + 1), []);

  const plantillas = useMemo((): PlantillaCrear[] => {
    if (!lista) return [];
    return [
      ...lista.mias.map((c) => tarjetaDeCreacion(c, 'mia', opts.formato)),
      ...lista.comunidad.map((c) => tarjetaDeCreacion(c, 'comunidad', opts.formato)),
    ];
  }, [lista, opts.formato]);

  /** Si la tarjeta es una plantilla guardada, la usa y navega (devuelve el error, o null). Si no, `false`. */
  const usar = useCallback(async (p: PlantillaCrear): Promise<string | null | false> => {
    const id = idDeTarjeta(p.id);
    if (id == null) return false;
    const r = await usarCreacionAction(id).catch(() => ({ error: 'Sin conexión' }));
    if ('error' in r) return r.error;
    router.push(r.ruta);
    return null;
  }, [router]);

  return { plantillas, usar, recargar };
}
