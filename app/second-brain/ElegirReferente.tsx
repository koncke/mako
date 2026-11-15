'use client';

// =============================================================================
// Elegir quién aconseja en un coach (1/11/2026)
// =============================================================================
// Martín: «que se pueda elegir de la misma manera que se eligen caricaturas de MaKo». El mismo armado que ElegirMuneco.tsx (las clases
// `co-elegir`, copiadas de Notion Faces): los mosaicos en el medio y el retrato grande a la derecha. Lo que se elige acá no es sólo la
// cara: es con qué ficha aconseja ese chat (lib/asesores/contexto.ts). Por eso cada mosaico dice de qué es experto y el retrato dice
// «Inspirado en»: la persona no participa.
//
// SÓLO MaKo Pro (14/11/2026, lib/asesores/candado.ts): como la galería de «Nuevo chat» (./GaleriaDeGurus.tsx), con el candado EN LUGAR
// de la lista y «Pasar a Pro». Y acá es ADEMÁS lo honesto: el servidor corre el coach sin la ficha de nadie cuando el plan es Esencial
// (app/api/mako/chat/route.ts → `contextoDelChat`), así que una lista de caras que no cambian nada sería un botón que miente.
// ⛔ El coach NO se cierra: se abre igual en los dos planes y aconseja con los marcos de MaKo, atribuyendo. Lo que lleva candado es
//    poner a UNO al frente. El hook va adentro porque a esta pieza la monta cada chat, nunca un test como función.

import { useState } from 'react';
import { Button, Modal } from '@/app/_ui';
import { CandadoSoloPro } from '@/app/_components/CandadoSoloPro';
import { useSoloPro } from '@/app/_components/solo-pro';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASESORES, asesorPorId, inspiradoEn, type IdAsesor } from '@/lib/asesores/catalogo';
import { ASPECTO_MAKO, aspectoDeReferente } from '@/lib/centro-munecos';

export function ElegirReferente({ titulo, elegido, onElegir, onCerrar }: {
  /** El coach («Funnel Coach»). */
  titulo: string;
  elegido: IdAsesor | null;
  onElegir: (id: IdAsesor | null) => void;
  onCerrar: () => void;
}) {
  const [probando, setProbando] = useState<IdAsesor | null>(elegido);
  const a = asesorPorId(probando);
  const soloPro = useSoloPro('chat-referentes');
  // Con el candado no hay nada que elegir: el cartel y «Pasar a Pro», con el ancho del modal de siempre (sin el alto fijo, que es
  // para que lo único que scrollee sea la lista de fichas: acá no hay lista).
  if (soloPro) {
    return (
      <Modal titulo={titulo} onCerrar={onCerrar} ancho={520}>
        <CandadoSoloPro funcion="chat-referentes" />
      </Modal>
    );
  }
  return (
    // ⚠️ ANCHO Y ALTO FIJOS, Y NO ES DECORACIÓN. Con 640 de ancho las fichas quedaban de 120 px y la
    //    especialidad no entraba, y sin `alto` el cuerpo del modal se volvía un SEGUNDO scroll encima
    //    del de las fichas (Martín, 1/11/2026: «tiene 3 scrolls diferentes dentro del modal»). Con el
    //    alto fijo, lo único que scrollea es la lista de fichas.
    <Modal titulo={titulo} onCerrar={onCerrar} ancho={1040} alto="min(78vh, 620px)"
      pie={<Button onClick={() => onElegir(probando)}>Elegir</Button>}>
      <div className="co-elegir co-elegir--referentes">
        <div className="co-elegir__grilla">
          <div className="co-elegir__mosaicos" role="radiogroup" aria-label="Quién aconseja">
            <button type="button" role="radio" aria-checked={probando == null} className="co-elegir__mosaico co-elegir__mosaico--referente" onClick={() => setProbando(null)}>
              <Muneco titulo="MaKo" animo="despierto" size={52} aspecto={ASPECTO_MAKO} />
              <span>MaKo</span>
            </button>
            {ASESORES.map((r) => (
              <button key={r.id} type="button" role="radio" aria-checked={probando === r.id} className="co-elegir__mosaico co-elegir__mosaico--referente" onClick={() => setProbando(r.id)}>
                <Muneco titulo={r.nombre} animo="despierto" size={52} aspecto={aspectoDeReferente(r.id)} />
                <span>{r.nombre}<small>{r.especialidad}</small></span>
              </button>
            ))}
          </div>
        </div>
        <div className="co-elegir__retrato">
          <Muneco titulo={a?.nombre ?? 'MaKo'} animo="despierto" size={128} aspecto={a ? aspectoDeReferente(a.id) : ASPECTO_MAKO} />
          <span className="co-elegir__nombre">{a?.nombre ?? 'MaKo'}</span>
          {a && <small className="co-elegir__inspirado">{inspiradoEn(a)}</small>}
        </div>
      </div>
    </Modal>
  );
}
