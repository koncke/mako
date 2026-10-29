'use client';

// =============================================================================
// ListaGuionesM — las páginas del Copywriter en el teléfono (el árbol de escritorio en una lista) y «Nueva»
// =============================================================================
// El árbol de escritorio (app/copywriter/Arbol.tsx) en el orden en que se dibuja allá: cada página y, debajo, las suyas
// (la segunda línea dice de cuál cuelgan). «Nueva» abre la hoja «¿Qué vas a crear hoy?» con los MISMOS templates de
// escritorio (lib/copywriter/plantillas.ts) y crea la página con el cuerpo del template.
// =============================================================================

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { FilaM, ListaM, PieFijoM, SeccionM, SheetM, VacioM, useToastM } from '@/app/m/_ui';
import { enOrdenDeArbol } from '@/lib/copywriter/arbol';
import { INFO_TIPO, propsNuevas, type PaginaCopy } from '@/lib/copywriter/tipos';
import type { CatalogosCopy } from '@/lib/copywriter/catalogos';
import { plantillasDe, type Plantilla } from '@/lib/copywriter/plantillas';
import { pedirCrear } from '@/app/copywriter/cliente';

export function ListaGuionesM({ paginas, catalogos }: { paginas: PaginaCopy[]; catalogos: CatalogosCopy }) {
  const router = useRouter();
  const toast = useToastM();
  const [hoja, setHoja] = useState(false);
  const [creando, setCreando] = useState(false);
  const filas = enOrdenDeArbol(paginas);

  const plantillas = plantillasDe(catalogos);
  const crear = async (pl: Plantilla) => {
    if (creando) return;
    setCreando(true);
    const r = await pedirCrear({ tipo: pl.tipo, props: propsNuevas(pl.tipo, pl.estructura), contenido: pl.contenido() });
    setCreando(false);
    if (!r.ok) { toast(`No se pudo crear: ${r.error}`); return; }
    router.push(`/m/copywriter/${r.pagina.id}`);
  };

  return (
    <>
      {filas.length === 0
        ? <VacioM frase="Todavía no hay páginas." accion={{ rotulo: 'Nueva', onClick: () => setHoja(true) }} />
        : (
          <SeccionM titulo="Páginas">
            <ListaM>
              {filas.map(({ p, padre }) => (
                <FilaM key={p.id} icono="escribir" titulo={p.titulo} href={`/m/copywriter/${p.id}`}
                  segunda={padre ? `${INFO_TIPO[p.tipo].label} · en ${padre.titulo}` : INFO_TIPO[p.tipo].label} />
              ))}
            </ListaM>
          </SeccionM>
        )}
      <PieFijoM>
        <Button variant="primary" size="lg" full onClick={() => setHoja(true)} disabled={creando}>Nueva</Button>
      </PieFijoM>
      <SheetM abierto={hoja} onCerrar={() => setHoja(false)} titulo="¿Qué vas a crear hoy?">
        <ListaM>
          {plantillas.map((pl) => (
            <FilaM key={pl.id} icono="escribir" titulo={`${pl.emoji} ${pl.nombre}`} segunda={pl.descripcion} onClick={() => { setHoja(false); void crear(pl); }} deshabilitada={creando} />
          ))}
        </ListaM>
      </SheetM>
    </>
  );
}
