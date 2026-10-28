'use client';

// =============================================================================
// ListaGuionesM — los guiones en el teléfono (el árbol de escritorio en una lista) y «Nuevo guion»
// =============================================================================
// El árbol de escritorio (app/copywriter/Arbol.tsx) en el orden en que se dibuja allá: cada página y, debajo, las suyas
// (la segunda línea dice de cuál cuelgan). «Nuevo guion» abre la hoja con los cuatro tipos y crea el guion con la
// estructura de la biblioteca, igual que escritorio (`estructuraPorDefecto`).
// =============================================================================

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { FilaM, ListaM, PieFijoM, SeccionM, SheetM, VacioM, useToastM } from '@/app/m/_ui';
import { enOrdenDeArbol } from '@/lib/copywriter/arbol';
import { INFO_TIPO, TIPOS_GUION, propsNuevas, type PaginaCopy, type TipoGuion } from '@/lib/copywriter/tipos';
import { docDeEstructura } from '@/lib/copywriter/doc';
import { estructuraPorDefecto, type CatalogosCopy } from '@/lib/copywriter/catalogos';
import { pedirCrear } from '@/app/copywriter/cliente';

export function ListaGuionesM({ paginas, catalogos }: { paginas: PaginaCopy[]; catalogos: CatalogosCopy }) {
  const router = useRouter();
  const toast = useToastM();
  const [hoja, setHoja] = useState(false);
  const [creando, setCreando] = useState(false);
  const filas = enOrdenDeArbol(paginas);

  const crear = async (tipo: TipoGuion) => {
    if (creando) return;
    setCreando(true);
    const e = estructuraPorDefecto(catalogos, tipo);
    const r = await pedirCrear({ tipo, props: propsNuevas(tipo, e?.id ?? null), ...(e ? { contenido: docDeEstructura(e.etiquetas) } : {}) });
    setCreando(false);
    if (!r.ok) { toast(`No se pudo crear: ${r.error}`); return; }
    router.push(`/m/copywriter/${r.pagina.id}`);
  };

  return (
    <>
      {filas.length === 0
        ? <VacioM frase="Todavía no hay guiones." accion={{ rotulo: 'Crear un guion', onClick: () => setHoja(true) }} />
        : (
          <SeccionM titulo="Guiones">
            <ListaM>
              {filas.map(({ p, padre }) => (
                <FilaM key={p.id} icono="escribir" titulo={p.titulo} href={`/m/copywriter/${p.id}`}
                  segunda={padre ? `${INFO_TIPO[p.tipo].label} · en ${padre.titulo}` : INFO_TIPO[p.tipo].label} />
              ))}
            </ListaM>
          </SeccionM>
        )}
      <PieFijoM>
        <Button variant="primary" size="lg" full onClick={() => setHoja(true)} disabled={creando}>Nuevo guion</Button>
      </PieFijoM>
      <SheetM abierto={hoja} onCerrar={() => setHoja(false)} titulo="¿Qué guion?">
        <ListaM>
          {TIPOS_GUION.map((t) => (
            <FilaM key={t} icono="escribir" titulo={INFO_TIPO[t].label} segunda={INFO_TIPO[t].uno} onClick={() => { setHoja(false); void crear(t); }} deshabilitada={creando} />
          ))}
        </ListaM>
      </SheetM>
    </>
  );
}
