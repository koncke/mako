'use client';

// =============================================================================
// /m/copywriting — «Analizar guion»: escribir o DICTAR un guion, valorarlo, y el historial
// =============================================================================
// La vista de escritorio (app/ads-writer/AnalizarGuion.tsx) destilada: «Analiza un guion nuevo» con
// su campo (acá se escribe, se pega o se dicta, como en Grammarly) y «Valorar guion», y el
// «Historial» de valorados. La valoración se abre en una hoja con lo que decide (el veredicto, la
// lectura, los dos estimados y qué probar); los bloques, los patrones y el plan de validación, en la
// computadora junto con Sincronizar y Ángulos y avatares.
//
// ⚠️ DICTAR ES TEXTO AL CAMPO (`useDictar`, el mismo del chat de MaKo y del Plan): lo transcrito se
//    PEGA y se lee antes de valorar; nunca viaja como audio (docs/hallazgos-mobile.md, la regla de
//    `useGrabacionVoz`: ésa es para lo que queda como AUDIO).
// ⚠️ La ruta guarda la valoración en el historial: la lista nueva se pide con `router.refresh()`, y
//    se pide DESPUÉS de abrir la hoja (abrirla hace un pushState del `?sheet=`, que Next despacha
//    como un restore y puede descartar un refresh que ya estaba en la cola).
// =============================================================================

import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { haptico } from '@/lib/haptico';
import { useDictar } from '@/app/_components/useDictar';
import { faltaParaValorar } from '@/app/ads-writer/analizar';
import {
  ComputadoraM, ErrorM, FilaDatoM, FilaM, ListaM, PieM, PildoraM, SeccionM, SheetM, VacioM, useConexion, useToastM,
} from '@/app/m/_ui';
import { valorarGuion } from './api';
import { R, rotuloVeredicto, tonoDeVeredicto, valoracionM, type DatosAnalizarM, type ValoracionM } from './modelo';
import { COMPU } from './VistasM';

/** «0:07»: lo grabado cuando el navegador no dicta en vivo (graba y transcribe). */
const reloj = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function AnalizarM({ datos, guion, onGuion }: {
  datos: DatosAnalizarM;
  /** Lo escrito vive en la pantalla de arriba: ir a mirar los anuncios no lo borra. */
  guion: string;
  onGuion: (v: string) => void;
}) {
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [valorando, setValorando] = useState(false);
  const [hoja, setHoja] = useState<{ abierta: boolean; titulo: string; v: ValoracionM | null }>({ abierta: false, titulo: '', v: null });
  const refresco = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (refresco.current) clearTimeout(refresco.current); }, []);

  const dictar = useDictar(guion, onGuion, () => toast('No se pudo dictar'));

  const valorar = async () => {
    if (valorando) return;
    if (faltaParaValorar(guion)) { toast('El guion es muy corto'); return; }
    if (dictar.escuchando) dictar.alternar();
    setValorando(true);
    const r = await valorarGuion(guion);
    setValorando(false);
    if (!r.ok) { toast('No se pudo valorar'); return; }
    const v = valoracionM(r.valoracion);
    haptico('success');
    setHoja({ abierta: true, titulo: v?.titulo || 'Guion', v });
    if (refresco.current) clearTimeout(refresco.current);
    refresco.current = setTimeout(() => router.refresh(), 400);
  };

  if (datos.sinMeta) {
    return (
      <>
        <VacioM frase="Meta no está conectado en este negocio." />
        <ComputadoraM que="Conectar Meta en Integraciones" />
      </>
    );
  }

  const micApagado = !enLinea || valorando || dictar.subiendo;
  return (
    <>
      <SeccionM titulo={R.analizaNuevo}>
        <div className="m-copywriting-campo" data-escucha={dictar.escuchando || undefined}>
          <textarea
            className="m-copywriting-campo__texto"
            value={guion}
            onChange={(e) => onGuion(e.target.value)}
            rows={7}
            aria-label={R.guionAValorar}
            placeholder={dictar.escuchando ? 'Te escucho…' : 'Pega o dicta el guion'}
            readOnly={valorando}
          />
          <div className="m-copywriting-campo__barra">
            <button
              type="button"
              className="m-copywriting-mic"
              data-estado={dictar.escuchando ? 'escucha' : dictar.subiendo ? 'trabaja' : undefined}
              aria-label={dictar.escuchando ? 'Terminar de dictar' : 'Dictar'}
              aria-pressed={dictar.escuchando}
              disabled={micApagado && !dictar.escuchando}
              onClick={() => { haptico('light'); dictar.alternar(); }}
            >
              {dictar.subiendo
                ? <span className="mk-spin" aria-hidden />
                : dictar.escuchando && !dictar.enVivo
                  ? <span className="m-copywriting-mic__segs">{reloj(dictar.segundos)}</span>
                  : <Icon name="mic" size={22} />}
            </button>
          </div>
        </div>
        <div className="m-copywriting-valorar">
          <PieM consecuencia={valorando ? R.tarda : undefined}>
            <Button variant="mako" size="lg" full icon={<Icon name="mako" size={18} />} loading={valorando}
              disabled={!guion.trim() || !enLinea || dictar.subiendo} onClick={() => { void valorar(); }}>
              {R.valorar}
            </Button>
          </PieM>
        </div>
      </SeccionM>

      {datos.error ? (
        <ErrorM frase="No pude leer el historial. No es nada tuyo." />
      ) : datos.drafts.length > 0 && (
        <SeccionM titulo={R.historial}>
          <ListaM>
            {datos.drafts.map((d) => (
              <FilaM
                key={d.id}
                titulo={d.titulo}
                segunda={d.extracto || undefined}
                pill={d.veredicto ? <PildoraM tono={tonoDeVeredicto(d.veredicto)}>{rotuloVeredicto(d.veredicto)}</PildoraM> : undefined}
                riel={d.dia || undefined}
                onClick={d.v ? () => setHoja({ abierta: true, titulo: d.titulo, v: d.v }) : undefined}
              />
            ))}
          </ListaM>
        </SeccionM>
      )}

      <ComputadoraM que={COMPU.analizar} />

      <HojaValoracionM abierta={hoja.abierta} titulo={hoja.titulo} v={hoja.v}
        onCerrar={() => setHoja((h) => ({ ...h, abierta: false }))} />
    </>
  );
}

/** La valoración de un guion: el veredicto arriba y lo que se hace con él (la tarjeta de Grammarly). */
function HojaValoracionM({ abierta, titulo, v, onCerrar }: { abierta: boolean; titulo: string; v: ValoracionM | null; onCerrar: () => void }) {
  return (
    <SheetM id="valoracion" abierto={abierta} onCerrar={onCerrar} titulo={titulo || 'Guion'} snap="alto">
      {v ? (
        <div className="m-copywriting-valoracion">
          <div className="m-copywriting-valoracion__cab">
            {v.veredicto && <PildoraM tono={tonoDeVeredicto(v.veredicto)}>{rotuloVeredicto(v.veredicto)}</PildoraM>}
            <span className="m-copywriting-valoracion__aviso">{R.sinDatos}</span>
          </div>
          {(v.lectura.titulo || v.lectura.texto) && (
            <section className="m-copywriting-bloque">
              {v.lectura.titulo && <h3 className="m-copywriting-bloque__t">{v.lectura.titulo}</h3>}
              {v.lectura.texto && <p className="m-copywriting-bloque__x">{v.lectura.texto}</p>}
              {v.razon && <p className="m-copywriting-valoracion__razon">{v.razon}</p>}
            </section>
          )}
          <ListaM>
            <FilaDatoM k={R.hookEst} v={v.hook} />
            <FilaDatoM k={R.retEst} v={v.ret} />
          </ListaM>
          {v.probar.length > 0 && (
            <SeccionM titulo={R.queProbar}>
              <ul className="m-copywriting-probar">
                {v.probar.map((p, i) => (
                  <li key={i}>
                    {p.que && <b>{p.que}</b>}
                    {p.propuesta && <span>{p.propuesta}</span>}
                  </li>
                ))}
              </ul>
            </SeccionM>
          )}
        </div>
      ) : (
        <VacioM frase="Esta valoración no se puede leer." />
      )}
    </SheetM>
  );
}
