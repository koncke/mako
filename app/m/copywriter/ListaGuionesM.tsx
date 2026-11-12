'use client';

// =============================================================================
// ListaGuionesM — las páginas del Copywriter en el teléfono (el árbol de escritorio en una lista) y «Nueva»
// =============================================================================
// La lista de escritorio (la de app/_crear/PantallaCrear.tsx) en el orden del árbol: cada página y, debajo, las suyas
// (la segunda línea dice de cuál cuelgan). «Nueva» abre la hoja «¿Qué vas a crear hoy?» con los MISMOS templates de
// escritorio (lib/copywriter/plantillas.ts) y crea la página con el cuerpo del template. `?nuevo=<tipo>` (los links
// viejos: /reels, /stories, «Abrir en Copywriter») abre la hoja con los de ese tipo primero, como en escritorio.
// =============================================================================

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { FilaM, ListaM, PieFijoM, SeccionM, SheetM, VacioM, useToastM } from '@/app/m/_ui';
import { enOrdenReciente } from '@/lib/copywriter/arbol';
import { INFO_TIPO, propsNuevas, type PaginaCopy, type TipoGuion } from '@/lib/copywriter/tipos';
import type { CatalogosCopy } from '@/lib/copywriter/catalogos';
import { plantillasDe, plantillasVisibles, type Plantilla } from '@/lib/copywriter/plantillas';
import { pedirCrear } from '@/app/copywriter/cliente';

export function ListaGuionesM({ paginas, catalogos, tipoInicial = null, abrirHoja = false }: { paginas: PaginaCopy[]; catalogos: CatalogosCopy; tipoInicial?: TipoGuion | null; abrirHoja?: boolean }) {
  const router = useRouter();
  const toast = useToastM();
  // «Crear desde cero» de la portada (`?nueva`) también la abre (11/11/2026, D18).
  const [hoja, setHoja] = useState(!!tipoInicial || abrirHoja);
  const [creando, setCreando] = useState(false);
  // La última editada arriba (12/11/2026, en producción iba de la más vieja a la más nueva).
  const filas = enOrdenReciente(paginas);

  const todas = plantillasVisibles(plantillasDe(catalogos));
  const plantillas = tipoInicial ? [...todas.filter((x) => x.tipo === tipoInicial), ...todas.filter((x) => x.tipo !== tipoInicial)] : todas;
  const crear = async (pl: Plantilla) => {
    if (creando) return;
    setCreando(true);
    const props = propsNuevas(pl.tipo, pl.estructura, { plantilla: pl.ejemplo ? pl.id : null, duracion: pl.duracion });
    const r = await pedirCrear({ tipo: pl.tipo, props, contenido: pl.esqueleto() });
    setCreando(false);
    if (!r.ok) { toast(`No se pudo crear: ${r.error}`); return; }
    // Con un ejemplo, MaKo pregunta para qué es y a qué oferta adaptarlo: la página abre en su vista (GuionM).
    router.push(`/m/copywriter/${r.pagina.id}${pl.ejemplo ? '?mako=1' : ''}`);
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
