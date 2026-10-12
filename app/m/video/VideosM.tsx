'use client';

// =============================================================================
// VideosM — la lista de Video Generator: «En curso» y «Terminados»
// =============================================================================
// Prototipo: docs/prototipos/mako-mobile-v2.html, la pantalla `video` (la abre «Video
// Generator» en More). Un anuncio en curso abre su pantalla de trabajo (/m/video/<id>); uno
// terminado abre un sheet con el video y «Descargar el anuncio».
//
// El estado de cada toma lo decide `estadoDeToma` de escritorio (app/video-generator/
// tomas-estado.ts, el mismo que usa PasoTomas.tsx), sobre el plan adelgazado. Sin «Crear mi anuncio»: crear y filmar es de la
// computadora (decisión del 11/10/2026, el teléfono no gasta créditos).
// =============================================================================

import { useMemo, useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { estadoDeToma } from '@/app/video-generator/tomas-estado';
import { descargarComo } from '@/app/video-generator/descargar';
import { nombreDeAnuncio } from '@/app/video-generator/video-pedido';
import { FilaM, ListaM, PieM, SeccionM, SheetM, useToastM } from '@/app/m/_ui';
import { ReproductorM } from './ReproductorM';
import { duracionDe, reloj, resumenDeAnuncio, type TomaM } from './modelo';
import type { EnCursoM, TerminadoM } from './datos';

/** La miniatura 9:16 de una fila: el póster, o el primer cuadro del video; sin video, el ícono. */
function Mini({ url, poster }: { url: string | null; poster?: string | null }) {
  return (
    <span className="m-video-mini" aria-hidden>
      <Icon name="video" size={18} />
      {poster
        ? <img src={poster} alt="" loading="lazy" />
        : url
          ? <video src={`${url}#t=0.1`} muted playsInline preload="metadata" tabIndex={-1} />
          : null}
    </span>
  );
}

export function VideosM({ enCurso, terminados }: { enCurso: EnCursoM[]; terminados: TerminadoM[] }) {
  const toast = useToastM();
  // El que se mira queda puesto mientras el sheet se va: si se vaciara al cerrar, bajaría vacío.
  const [viendo, setViendo] = useState<TerminadoM | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [bajando, setBajando] = useState(false);

  const filas = useMemo(() => enCurso.map(({ titulo, plan, montaje }) => {
    const tomas: TomaM[] = plan.plan.clips.map((c) => ({ n: c.n, estado: estadoDeToma(plan, c.n), segundos: c.segundos }));
    const primera = plan.plan.clips.map((c) => plan.video?.[String(c.n)]?.url).find(Boolean) ?? null;
    return {
      id: plan.id,
      titulo,
      duracion: duracionDe(tomas, montaje),
      resumen: resumenDeAnuncio(tomas, montaje),
      mini: primera,
    };
  }), [enCurso]);

  const bajar = async (a: TerminadoM) => {
    setBajando(true);
    try {
      await descargarComo(a.url, nombreDeAnuncio(a.titulo));
      toast('Anuncio descargado');
    } catch {
      toast('No se pudo descargar');
    } finally {
      setBajando(false);
    }
  };

  return (
    <>
      {filas.length > 0 && (
        <SeccionM titulo="En curso">
          <ListaM>
            {filas.map((f) => (
              <FilaM
                key={f.id}
                href={`/m/video/${encodeURIComponent(f.id)}`}
                leading={<Mini url={f.mini} />}
                titulo={`${f.titulo} · ${reloj(f.duracion)}`}
                segunda={(
                  <>
                    {f.resumen.tono === 'bad' && <span className="m-video-punto" aria-hidden />}
                    {f.resumen.texto}
                  </>
                )}
              />
            ))}
          </ListaM>
        </SeccionM>
      )}

      {terminados.length > 0 && (
        <SeccionM titulo="Terminados">
          <ListaM>
            {terminados.map((a) => (
              <FilaM
                key={a.id}
                onClick={() => { setViendo(a); setAbierto(true); }}
                leading={<Mini url={a.url} poster={a.poster} />}
                titulo={a.titulo}
                segunda={a.formato ? `${reloj(a.segundos)} · ${a.formato}` : reloj(a.segundos)}
              />
            ))}
          </ListaM>
        </SeccionM>
      )}

      <SheetM
        abierto={abierto && viendo != null}
        onCerrar={() => setAbierto(false)}
        titulo={viendo?.titulo ?? ''}
        id="anuncio"
        snap="alto"
        ocupado={bajando}
        rotuloCerrar="Cerrar el anuncio"
        pie={viendo ? (
          <PieM>
            <Button
              variant="primary"
              size="lg"
              full
              loading={bajando}
              icon={<Icon name="descargar" size={20} />}
              onClick={() => void bajar(viendo)}
            >
              Descargar el anuncio
            </Button>
          </PieM>
        ) : undefined}
      >
        {viendo && (
          <div className="m-video-sheet">
            <ReproductorM src={viendo.url} poster={viendo.poster} clase="m-video-player--sheet" />
          </div>
        )}
      </SheetM>
    </>
  );
}
