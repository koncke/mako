'use client';

// =============================================================================
// GuionM — un guion en el teléfono: «Guion · MaKo», una de las dos por pantalla
// =============================================================================
// El MISMO editor de escritorio (app/copywriter/editor/EditorGuion.tsx, `movil`: sin asa, la página a lo ancho) y el
// MISMO chat (app/copywriter/PanelMaKo.tsx). Lo que es del teléfono: el segmentado arriba y que cada vista ocupa la
// pantalla. Las dos quedan MONTADAS y se esconden con `hidden` (cambiar de vista no pierde lo escrito ni la charla).
// =============================================================================

import '@/app/copywriter/notion.css';
import { useCallback, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useRouter } from '@/app/_ui/Link';
import { SegmentadoM, useToastM } from '@/app/m/_ui';
import { cambiarPagina } from '@/lib/copywriter/arbol';
import type { GuionAbierto, PaginaCopy } from '@/lib/copywriter/tipos';
import type { CatalogosCopy } from '@/lib/copywriter/catalogos';
import { EditorGuion } from '@/app/copywriter/editor/EditorGuion';
import { PanelMaKo, type GuionVivo } from '@/app/copywriter/PanelMaKo';
import { pedirPapelera, pedirRenombrar } from '@/app/copywriter/cliente';

type Vista = 'guion' | 'mako';

export function GuionM({ ws, guion, catalogos }: { ws: number | null; guion: GuionAbierto; catalogos: CatalogosCopy }) {
  const router = useRouter();
  const toast = useToastM();
  const [vista, setVista] = useState<Vista>('guion');
  const [pagina, setPagina] = useState<PaginaCopy>(guion.pagina);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [pausa, setPausa] = useState(false);
  const caja = useRef<HTMLTextAreaElement | null>(null);
  const vivo = useRef<GuionVivo | null>(null);
  const leerVivo = useCallback(() => vivo.current, []);
  const avisar = useCallback((t: string) => toast(t), [toast]);

  const renombrar = (c: { titulo?: string; emoji?: string | null }) => {
    void pedirRenombrar(pagina.id, c).then((r) => { if (!r.ok) toast(`No se pudo guardar: ${r.error}`); });
  };

  return (
    <div className="m-copywriter">
      <div className="m-copywriter-seg">
        <SegmentadoM etiqueta="Vista" valor={vista} onCambio={setVista} opciones={[{ id: 'guion', label: 'Guion' }, { id: 'mako', label: 'MaKo' }]} />
      </div>
      <div className="nt" data-movil="">
        <div hidden={vista !== 'guion'} className="m-copywriter-vista">
          <EditorGuion guion={{ ...guion, pagina }} paginas={[pagina]} catalogos={catalogos} movil pausa={pausa}
            onPaginaEnVivo={(c) => setPagina((p) => { const x = cambiarPagina([p], p.id, c); return x.ok ? x.paginas[0] : p; })}
            onTitulo={(titulo) => renombrar({ titulo })} onEmoji={(emoji) => { setPagina((p) => ({ ...p, emoji })); renombrar({ emoji }); }}
            onAbrir={() => {}} onPapelera={() => void pedirPapelera(pagina.id).then((r) => { if (r.ok) router.push('/m/copywriter'); else toast(r.error); })}
            onEditor={setEditor} onMako={() => { setVista('mako'); window.setTimeout(() => caja.current?.focus(), 50); }}
            avisar={avisar} onVivo={(v) => { vivo.current = v; }} />
        </div>
        <div hidden={vista !== 'mako'} className="m-copywriter-vista">
          <PanelMaKo ws={ws} guion={guion} paginas={[pagina]} editor={editor} leerVivo={leerVivo} campo={caja} onPausa={setPausa} avisar={avisar} />
        </div>
      </div>
    </div>
  );
}
