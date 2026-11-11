'use client';

// =============================================================================
// GuionM — una página en el teléfono: «Página · MaKo», una de las dos por pantalla
// =============================================================================
// El MISMO editor de escritorio (app/copywriter/editor/EditorGuion.tsx, `movil`: sin el asa ⋮⋮ —en el teléfono no hay
// cursor que pase por el margen—, la página a lo ancho) y el
// MISMO chat (app/copywriter/PanelMaKo.tsx). Lo que es del teléfono: el segmentado arriba y que cada vista ocupa la
// pantalla. Las dos quedan MONTADAS y se esconden con `hidden` (cambiar de vista no pierde lo escrito ni la charla).
// =============================================================================

import '@/app/copywriter/notion.css';
import { useCallback, useRef, useState } from 'react';
import type { DocVivo } from '@/app/copywriter/editor/propuesta';
import { useRouter } from '@/app/_ui/Link';
import { CabeceraM, SegmentadoM, useToastM } from '@/app/m/_ui';
import { cambiarPagina } from '@/lib/copywriter/arbol';
import type { GuionAbierto, PaginaCopy } from '@/lib/copywriter/tipos';
import type { CatalogosCopy } from '@/lib/copywriter/catalogos';
import { EditorGuion, type ApiPagina } from '@/app/copywriter/editor/EditorGuion';
import { PanelMaKo, type GuionVivo } from '@/app/copywriter/PanelMaKo';
import type { OfertaCorta } from '@/lib/copywriter/iniciativa';
import { pedirPapelera, pedirRenombrar } from '@/app/copywriter/cliente';

type Vista = 'guion' | 'mako';
/** El «‹ Guiones» de la barra (el mismo de app/m/copywriter/[id]/page.tsx). */
const PADRE_GUION = { href: '/m/copywriter', label: 'Guiones' };
// (El id sigue siendo «guion»: lo usan el segmentado y las notas guardadas por vista.)

export function GuionM({ ws, guion, catalogos, ofertas, enMako = false }: {
  ws: number | null; guion: GuionAbierto; catalogos: CatalogosCopy; ofertas?: readonly OfertaCorta[];
  /** Recién creada desde una plantilla (`?mako`): abre en MaKo, que pregunta para qué es (lib/copywriter/iniciativa.ts). */
  enMako?: boolean;
}) {
  const router = useRouter();
  const toast = useToastM();
  const [vista, setVista] = useState<Vista>(enMako ? 'mako' : 'guion');
  const [pagina, setPagina] = useState<PaginaCopy>(guion.pagina);
  const [editor, setEditor] = useState<DocVivo | null>(null);
  // «Preguntar a MaKo» con lo seleccionado: la cita entra en la caja de MaKo (la llena PanelMaKo).
  const citar = useRef<((seleccion?: string) => void) | null>(null);
  const [pausa, setPausa] = useState(false);
  const caja = useRef<HTMLTextAreaElement | null>(null);
  const vivo = useRef<GuionVivo | null>(null);
  const leerVivo = useCallback(() => vivo.current, []);
  const api = useRef<ApiPagina | null>(null);
  const leerApi = useCallback(() => api.current, []);
  const avisar = useCallback((t: string) => toast(t), [toast]);
  // Cuando MaKo empieza a escribir, se ve el guion construyéndose; su «Aceptar» queda en MaKo, con el número arriba.
  const alPausar = useCallback((p: boolean) => { setPausa(p); if (p) setVista('guion'); }, []);

  const renombrar = (c: { titulo?: string; emoji?: string | null }) => {
    void pedirRenombrar(pagina.id, c).then((r) => { if (!r.ok) toast(`No se pudo guardar: ${r.error}`); });
  };

  return (
    <div className="m-copywriter">
      {/* El nombre de la barra es el de la página EN VIVO (`onPaginaEnVivo`): 11/11/2026, en producción la barra seguía
          diciendo «Sin título» con el título ya escrito, hasta volver a abrir la página. */}
      <CabeceraM titulo={pagina.titulo} padre={PADRE_GUION} trabajo />
      <div className="m-copywriter-seg">
        <SegmentadoM etiqueta="Vista" valor={vista} onCambio={setVista} opciones={[{ id: 'guion', label: 'Página' }, { id: 'mako', label: 'MaKo', n: pausa ? 1 : null }]} />
      </div>
      <div className="nt" data-movil="">
        <div hidden={vista !== 'guion'} className="m-copywriter-vista">
          <EditorGuion guion={{ ...guion, pagina }} paginas={[pagina]} catalogos={catalogos} movil pausa={pausa}
            onPaginaEnVivo={(c) => setPagina((p) => { const x = cambiarPagina([p], p.id, c); return x.ok ? x.paginas[0] : p; })}
            onTitulo={(titulo) => renombrar({ titulo })} onEmoji={(emoji) => { setPagina((p) => ({ ...p, emoji })); renombrar({ emoji }); }}
            onAbrir={() => {}} onPapelera={() => void pedirPapelera(pagina.id).then((r) => { if (r.ok) router.push('/m/copywriter'); else toast(r.error); })}
            onEditor={setEditor} onMako={(s) => { setVista('mako'); window.setTimeout(() => { if (citar.current) citar.current(s); else caja.current?.focus(); }, 50); }}
            avisar={avisar} onVivo={(v) => { vivo.current = v; }} onApi={(a) => { api.current = a; }} />
        </div>
        <div hidden={vista !== 'mako'} className="m-copywriter-vista">
          <PanelMaKo ws={ws} guion={guion} paginas={[pagina]} editor={editor} leerVivo={leerVivo} leerApi={leerApi} catalogos={catalogos} campo={caja} onPausa={alPausar} avisar={avisar} citarRef={citar} ofertas={ofertas} />
        </div>
      </div>
    </div>
  );
}
