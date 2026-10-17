'use client';

// =============================================================================
// PlantillasM — «Templates» de AI Avatar en el teléfono: chips de categoría, la grilla y el detalle de un tema
// =============================================================================
// Ver ./page.tsx. El detalle va en una hoja: la portada grande, el resumen, el lugar, escuchar la voz y «Usar esta
// plantilla» (→ Avatars con `?plantilla=`, el «Usar» de escritorio).
// =============================================================================

import { useState } from 'react';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { CATEGORIAS, PLANTILLAS_AVATAR, vozSugerida, type PlantillaAvatar } from '@/lib/ai-avatar/plantillas';
import { FilaDatoM, ListaM, PieM, SheetM } from '@/app/m/_ui';
import { ChipM, ChipsM, PortadaM, useReproductorM } from '../piezas';

export function PlantillasM() {
  const { sonando, tocar } = useReproductorM();
  const [cat, setCat] = useState<string>('Todas');
  const [viendo, setViendo] = useState<PlantillaAvatar | null>(null);
  const [abierta, setAbierta] = useState(false);
  const lista = cat === 'Todas' ? PLANTILLAS_AVATAR : PLANTILLAS_AVATAR.filter((p) => p.categoria === cat);
  const voz = viendo ? vozSugerida(viendo.voz) : null;

  return (
    <>
      <ChipsM etiqueta="Categoría">
        {['Todas', ...CATEGORIAS].map((c) => <ChipM key={c} activo={cat === c} onClick={() => setCat(c)}>{c}</ChipM>)}
      </ChipsM>

      <div className="m-ai-avatar-grilla">
        {lista.map((p) => (
          <button key={p.id} type="button" className="m-ai-avatar-tema" onClick={() => { setViendo(p); setAbierta(true); }}>
            <PortadaM p={p} />
            <span className="m-ai-avatar-tema__nombre">{p.nombre}</span>
            <span className="m-ai-avatar-tema__cat">{p.categoria}</span>
          </button>
        ))}
      </div>

      <SheetM
        id="plantilla"
        abierto={abierta && viendo != null}
        onCerrar={() => setAbierta(false)}
        titulo={viendo?.nombre ?? 'Plantilla'}
        snap="alto"
        rotuloCerrar="Cerrar la plantilla"
        pie={viendo ? (
          <PieM>
            <ButtonLink variant="primary" size="lg" full href={`/m/ai-avatar/avatares?plantilla=${encodeURIComponent(viendo.id)}`}>
              Usar esta plantilla
            </ButtonLink>
            {voz && (
              <Button variant="tertiary" size="lg" full onClick={() => tocar(viendo.id, voz.muestra)}>
                {sonando === viendo.id ? 'Pausar la voz' : 'Escuchar la voz'}
              </Button>
            )}
          </PieM>
        ) : undefined}
      >
        {viendo && (
          <div className="m-ai-avatar-detalle">
            <div className="m-ai-avatar-detalle__portada"><PortadaM p={viendo} /></div>
            <p className="m-ai-avatar-detalle__resumen">{viendo.resumen}</p>
            <ListaM>
              <FilaDatoM k="Categoría" v={viendo.categoria} />
              <FilaDatoM k="Dónde" v={viendo.lugar} />
              {voz && <FilaDatoM k="Voz" v={`${voz.nombre} · ${voz.acento}`} />}
            </ListaM>
          </div>
        )}
      </SheetM>
    </>
  );
}
