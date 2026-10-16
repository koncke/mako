'use client';

// =============================================================================
// /m/experimentos — la tab «Conclusions»: las verdades validadas, con su dato
// =============================================================================
// Escritorio (ConclusionsTab.tsx): cada experimento cerrado con su veredicto (Validada · Refutada ·
// No concluyente), el aprendizaje como texto grande, la métrica, baseline → resultado, la fecha del
// cierre y la línea. Acá, la lista de tarjetas de un feed de notas (como Apple Notes o Day One: la
// frase es lo que se lee, el resto es una línea gris) y la hoja con lo demás. Los filtros por
// veredicto se recortan: el veredicto ya va en la píldora de cada tarjeta.
// =============================================================================

import { useState } from 'react';
import { FilaDatoM, ListaM, PildoraM, SheetM, VacioM } from '@/app/m/_ui';
import { R, type ConclusionM } from './modelo';
import { LineaM } from './piezas';

export function VistaConclusionsM({ conclusiones }: { conclusiones: ConclusionM[] }) {
  const [sel, setSel] = useState<ConclusionM | null>(null);
  const [abierta, setAbierta] = useState(false);

  if (conclusiones.length === 0) return <VacioM frase={`${R.sinConclusiones}.`} />;

  return (
    <div className="m-experimentos-conclusiones">
      {conclusiones.map((c) => (
        <button key={c.id} type="button" className="m-experimentos-conclusion" onClick={() => { setSel(c); setAbierta(true); }}>
          <span className="m-experimentos-conclusion__cab"><PildoraM tono={c.tono}>{c.veredicto}</PildoraM></span>
          <span className="m-experimentos-conclusion__frase">{c.aprendizaje}</span>
          <span className="m-experimentos-conclusion__pie">{c.titulo} · {c.cerrado}</span>
        </button>
      ))}

      <SheetM abierto={abierta} onCerrar={() => setAbierta(false)} titulo={sel?.titulo ?? 'Conclusión'} id="conclusion"
        snap="alto" rotuloCerrar="Volver a Conclusions">
        {sel && (
          <div className="m-experimentos-hoja">
            <PildoraM tono={sel.tono}>{sel.veredicto}</PildoraM>
            <p className="m-experimentos-hoja__frase">{sel.aprendizaje}</p>
            <LineaM serie={sel.serie} tono={sel.linea} />
            <ListaM>
              <FilaDatoM k="Métrica" v={sel.metrica} />
              <FilaDatoM k="Baseline" v={sel.antes} />
              <FilaDatoM k="Resultado" v={sel.despues} />
              <FilaDatoM k="Cerrado" v={sel.cerrado} />
            </ListaM>
          </div>
        )}
      </SheetM>
    </div>
  );
}
