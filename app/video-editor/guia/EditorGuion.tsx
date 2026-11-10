'use client';

// =============================================================================
// EditorGuion — el guion de una plantilla guiada, bloque por bloque, con lo que dura y cuesta cada clip (9/11/2026)
// =============================================================================
// Lo abre MaKo desde el chat del editor («Escribir mi guion», lib/aperturas/video-guia.ts). Un campo por bloque de la referencia
// (lib/video-plantillas/mensaje-para.ts → BLOQUES): la estructura no se toca, la persona pone su texto. Debajo de cada uno, las
// palabras y lo que dura su clip (`duracionDeClip`: Martín, 9/11, «contar las palabras para determinar cuántos segundos»), así
// el clip no queda más largo que la frase y Omni no la repite.
// =============================================================================

import { useMemo, useState } from 'react';
import { Button, Modal, TextField } from '@/app/_ui';
import { BLOQUES_HABLADOS, clipsDelGuion, creditosDelGuion, problemasDelGuion, type GuionMensajePara, type IdBloque } from '@/lib/video-plantillas/mensaje-para';
import { TOPE_TEXTO_BLOQUE } from './reglas';

type Hablado = Exclude<IdBloque, 'cierre'>;

export function EditorGuion({ inicial, onGuardar, onCerrar }: {
  inicial: GuionMensajePara;
  onGuardar: (g: GuionMensajePara) => void;
  onCerrar: () => void;
}) {
  const [g, setG] = useState<GuionMensajePara>(inicial);
  const clips = useMemo(() => clipsDelGuion(g), [g]);
  const problemas = useMemo(() => problemasDelGuion(g), [g]);
  const creditos = creditosDelGuion(g);
  const poner = (k: Hablado | 'cta' | 'oferta', v: string) => setG((x) => ({ ...x, [k]: v }));

  return (
    <Modal titulo="Tu guion" ancho={600} onCerrar={onCerrar}
      pie={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%' }}>
          <span style={{ flex: 1, color: 'var(--dim)', fontSize: 'var(--fs-meta)' }}>
            {creditos > 0 ? `Los clips suman ${creditos} créditos de Flow` : 'Escribe cada bloque con tus palabras'}
          </span>
          <Button variant="secondary" onClick={onCerrar}>Cerrar</Button>
          <Button onClick={() => onGuardar(g)}>Guardar el guion</Button>
        </div>
      )}>
      <div style={{ display: 'grid', gap: 14 }} data-video-guion="">
        {BLOQUES_HABLADOS.map((b) => {
          const c = clips.find((x) => x.bloque === b.id);
          const d = c?.duracion;
          const pista = !d || d.palabras === 0 ? b.que
            : d.partir ? `${d.palabras} palabras: no entra en 10 s, pártelo en dos`
              : `${d.palabras} palabras · clip de ${d.segundos} s · ${d.creditos} créditos`;
          return (
            <TextField key={b.id} label={b.nombre} hint={pista} multiline maxLength={TOPE_TEXTO_BLOQUE}
              placeholder={b.molde} value={g[b.id as Hablado] ?? ''} onChange={(e) => poner(b.id as Hablado, e.target.value)} />
          );
        })}
        <TextField label="Lo que pides al final" hint="El cartel del cierre sin voz" maxLength={80} placeholder="Comenta «___»"
          value={g.cta ?? ''} onChange={(e) => poner('cta', e.target.value)} />
        <TextField label="Tu oferta" hint="El segundo cartel (opcional)" maxLength={80} placeholder="Una semana gratis"
          value={g.oferta ?? ''} onChange={(e) => poner('oferta', e.target.value)} />
        {problemas.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--dim)', fontSize: 'var(--fs-meta)' }}>
            {problemas.map((p) => <li key={p}>{p}</li>)}
          </ul>
        )}
      </div>
    </Modal>
  );
}
