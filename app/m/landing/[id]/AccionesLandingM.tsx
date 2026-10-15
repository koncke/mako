'use client';

// =============================================================================
// AccionesLandingM — lo que se TOCA en la pantalla de una landing: copiar el enlace y publicar
// =============================================================================
// No dibuja la página (eso lo hace el server con el render público); pone:
//   · la cabecera: el nombre de la landing y, si está publicada, «Copiar el enlace público»
//     (la única acción a la derecha, ícono de 44 con su aria-label);
//   · el pie fijo, sólo si está publicada: «Publicar cambios», apagado si no hay nada pendiente,
//     con la consecuencia pegada arriba en tinta (prototipo, `data-ir="landing-ed"`).
//
// PUBLICAR es la MISMA acción que el diálogo de escritorio (DialogoPublicar.tsx): POST a
// /api/landing-generator con `{ accion: 'publicar', id, version, slug }` por `pedirDocs`
// (app/web-generator/cliente.ts, sin 'use client' y sin valores de server). La ruta pone la
// puerta (admin del negocio + la tab en su capa) y publicar.ts publica LO GUARDADO en la versión
// que esta pantalla abrió: si escritorio guardó algo después, contesta conflicto y la pantalla se
// recarga con la versión nueva en vez de publicar otra cosa. El `?ws=` lo pega el parche de fetch
// (app/_components/WsFetch.tsx), que el layout raíz monta también en /m.
//
// Un borrador nunca publicado no tiene pie: publicar por primera vez es elegir la dirección (el
// slug), y eso queda en la computadora.
// =============================================================================

import { useCallback, useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { CabeceraM, PieFijoM, useConexion, useToastM } from '@/app/m/_ui';
import { pedirDocs } from '@/app/web-generator/cliente';
import { piePublicar } from '../modelo';

export function AccionesLandingM({ id, titulo, url, slug, version, cambios, sitioActivo }: {
  id: number;
  titulo: string;
  /** La dirección pública, o null si no está publicada. */
  url: string | null;
  /** El slug con el que se republica (null = borrador: sin pie). */
  slug: string | null;
  /** La versión GUARDADA que se abrió: publicar exige que siga siendo ésa. */
  version: number;
  /** Lo guardado cambió después de publicar. */
  cambios: boolean;
  sitioActivo: boolean;
}) {
  const toast = useToastM();
  const router = useRouter();
  const { enLinea } = useConexion();
  const [publicando, setPublicando] = useState(false);

  const copiar = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast('Enlace copiado');
    } catch {
      toast('No se pudo copiar');
    }
  }, [url, toast]);

  // Memorizada: CabeceraM vuelve a avisarle al shell cada vez que cambia la acción.
  const accion = useMemo(() => (url ? (
    <button type="button" className="m-cabecera__accion" aria-label="Copiar el enlace público" onClick={() => void copiar()}>
      <Icon name="copy" size={22} />
    </button>
  ) : null), [url, copiar]);

  const publicar = async () => {
    if (!slug || publicando) return;
    setPublicando(true);
    const r = await pedirDocs({ accion: 'publicar', id, version, slug });
    setPublicando(false);
    if (!r.ok) {
      if (r.conflicto) {
        toast('Hay una versión nueva');
        router.refresh();
      } else {
        console.error(`[m/landing] publicar #${id}:`, r.error);
        toast('No se pudo publicar');
      }
      return;
    }
    toast('Cambios publicados');
    router.refresh();
  };

  const pie = piePublicar({ cambios, sitioActivo, enLinea });

  return (
    <>
      <CabeceraM titulo={titulo} accion={accion} />
      {slug && (
        <PieFijoM consecuencia={pie.consecuencia}>
          <Button variant="primary" size="lg" full disabled={!pie.habilitado} loading={publicando} onClick={() => void publicar()}>
            Publicar cambios
          </Button>
        </PieFijoM>
      )}
    </>
  );
}
