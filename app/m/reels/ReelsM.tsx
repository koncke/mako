'use client';

// =============================================================================
// ReelsM — los guiones de reel en el teléfono: la lista, pedir uno, leerlo, copiarlo y ajustarlo
// =============================================================================
// Ver ./page.tsx. Tres hojas, una a la vez (SheetM cierra la anterior al abrir la nueva):
//   · «Nuevo guion»: el tema, qué tiene que lograr y la duración → «Escribir el guion» (dorado: se lo pides a MaKo);
//   · el GUION: la portada y el caption como los muestra Instagram, y debajo el gancho, las escenas, la moraleja y
//     el CTA → «Copiar el guion»; «Ajustar el guion» abre la tercera;
//   · «Ajustar el guion»: qué cambiar → «Reescribir el guion» (una versión NUEVA, como escritorio: `anteriorId` y el
//     feedback; la de antes queda en la lista).
// ⚠️ Lo de adentro de una hoja no depende de `abierto` (sigue en pantalla los 220 ms de su salida): el guion que se
//    mira queda puesto aunque la hoja se cierre (app/m/_ui/LEEME.md).
// =============================================================================

import { useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { CAPTION_VISIBLE } from '@/lib/ig-formatos';
import { rutaSeccion } from '@/lib/secciones-negocio';
import { OBJETIVOS_REEL, DURACIONES_REEL, guionATexto } from '@/app/reels/reel-pedido';
import { generarReelAction } from '@/app/reels/actions';
import type { PiezaGuardada } from '@/app/reels/reels-datos';
import { copiarTexto } from '@/app/m/copywriting/api';
import {
  FilaM, ListaM, PieFijoM, PieM, SeccionM, SegmentadoM, SheetM, VacioM, useConexion, useToastM,
} from '@/app/m/_ui';
import { CampoM, ErrorLineaM, OpcionesM, RotuloM } from '../_creacion/escritor';

type Objetivo = (typeof OBJETIVOS_REEL)[number]['value'];
type Duracion = (typeof DURACIONES_REEL)[number]['value'];

/** Los rótulos cortos de la duración (el segmentado no entra con «50-60 segundos»). */
const DURACION_CORTA: Record<Duracion, string> = { optima: '50-60 s', corta: '30-40 s', larga: 'Hasta 90 s' };

function fechaCorta(iso: string): string {
  try { return new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }); } catch { return ''; }
}

/** El guion como lo lee quien lo graba: la portada y el caption de Instagram, y las partes en una columna. */
function GuionReelM({ item }: { item: PiezaGuardada }) {
  const p = item.pieza;
  const visible = p.caption.slice(0, CAPTION_VISIBLE);
  const resto = p.caption.slice(CAPTION_VISIBLE);
  return (
    <div className="m-reels-guion">
      <div className="m-reels-compartir">
        {/* La portada 9:16: lo que dice el título en pantalla, sobre el fondo oscuro del video. */}
        <div className="m-reels-portada" aria-hidden>
          <span>{p.hook.tituloEnPantalla || p.hook.frase}</span>
        </div>
        <p className="m-reels-caption">
          {visible}
          {resto && <span className="m-reels-caption__resto">{resto}</span>}
        </p>
      </div>

      <section className="m-reels-parte">
        <RotuloM>Gancho · 3 s</RotuloM>
        <p className="m-reels-gancho">«{p.hook.frase}»</p>
        {p.hook.visual && <p className="m-reels-camara"><Icon name="video" size={14} /> {p.hook.visual}</p>}
      </section>

      <section className="m-reels-parte">
        <RotuloM>{`Escenas (${p.escenas.length})`}</RotuloM>
        <ol className="m-reels-escenas">
          {p.escenas.map((e, i) => (
            <li key={i}>
              <span className="m-reels-escenas__n" aria-hidden>{String(i + 1).padStart(2, '0')}</span>
              <div>
                <p className="m-reels-texto">{e.texto}</p>
                {e.indicacionVisual && <p className="m-reels-camara"><Icon name="video" size={14} /> {e.indicacionVisual}</p>}
              </div>
            </li>
          ))}
        </ol>
      </section>

      {p.moraleja && (
        <section className="m-reels-parte">
          <RotuloM>Moraleja</RotuloM>
          <p className="m-reels-texto">{p.moraleja}</p>
        </section>
      )}

      <section className="m-reels-parte">
        <RotuloM>CTA</RotuloM>
        {p.cta
          ? <p className="m-reels-texto m-reels-texto--fuerte">{p.cta}{p.palabraClave ? ` · ${p.palabraClave}` : ''}</p>
          : <p className="m-reels-texto m-reels-texto--dim">Sin CTA: este reel es de alcance.</p>}
      </section>
    </div>
  );
}

export function ReelsM({ historial: inicial, perfilListo }: { historial: PiezaGuardada[]; perfilListo: boolean }) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [historial, setHistorial] = useState(inicial);
  const [hoja, setHoja] = useState<'nuevo' | 'guion' | 'ajustar' | null>(null);
  // El guion que se mira: queda puesto mientras la hoja se va.
  const [viendo, setViendo] = useState<PiezaGuardada | null>(null);
  const [tema, setTema] = useState('');
  const [objetivo, setObjetivo] = useState<Objetivo>(OBJETIVOS_REEL[0].value);
  const [duracion, setDuracion] = useState<Duracion>(DURACIONES_REEL[0].value);
  const [feedback, setFeedback] = useState('');
  const [escribiendo, setEscribiendo] = useState(false);
  const [error, setError] = useState('');

  const abrir = (item: PiezaGuardada) => { setViendo(item); setHoja('guion'); };

  const escribir = async (ajuste?: { anterior: PiezaGuardada; feedback: string }) => {
    if (escribiendo) return;
    setEscribiendo(true); setError('');
    try {
      const r = await generarReelAction(ajuste
        ? { tema: ajuste.anterior.pedido || tema, objetivo, duracion, feedback: ajuste.feedback, anteriorId: ajuste.anterior.id }
        : { tema, objetivo, duracion });
      if (!r.ok) { setError(r.error); return; }
      setHistorial(r.historial);
      setFeedback('');
      if (!ajuste) setTema('');
      abrir(r.item);
      toast(ajuste ? 'Guion reescrito' : 'Guion listo');
    } catch {
      setError('No se pudo escribir el guion. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setEscribiendo(false);
    }
  };

  const copiar = async (item: PiezaGuardada) => {
    toast((await copiarTexto(guionATexto(item.pieza))) ? 'Guion copiado' : 'No se pudo copiar');
  };

  return (
    <>
      {!perfilListo && (
        <ListaM>
          <FilaM icono="cerebro" titulo="MaKo todavía no conoce tu negocio" segunda="Sin eso, salen genéricos" href={rutaSeccion('archivero')} />
        </ListaM>
      )}

      {historial.length === 0 ? (
        <VacioM frase="Todavía no hay guiones." />
      ) : (
        <SeccionM titulo="Guiones">
          <ListaM>
            {historial.map((h) => (
              <FilaM
                key={h.id}
                leading={<span className="m-reels-mini" aria-hidden><Icon name="videogen" size={18} /></span>}
                titulo={h.pieza.hook.frase || h.pedido}
                segunda={`${fechaCorta(h.at)} · ${h.pieza.duracionEstimadaSeg} s`}
                onClick={() => abrir(h)}
              />
            ))}
          </ListaM>
        </SeccionM>
      )}

      <PieFijoM>
        <Button variant="mako" size="lg" full icon={<Icon name="mako" size={18} />} disabled={!enLinea}
          onClick={() => { setError(''); setHoja('nuevo'); }}>
          Escribir un guion
        </Button>
      </PieFijoM>

      <SheetM
        id="nuevo-reel"
        abierto={hoja === 'nuevo'}
        onCerrar={() => setHoja(null)}
        titulo="Nuevo guion"
        snap="alto"
        ocupado={escribiendo}
        rotuloCerrar="Cerrar el pedido"
        pie={(
          <PieM consecuencia={escribiendo ? 'MaKo está escribiendo. Tarda unos segundos.' : undefined}>
            <Button variant="mako" size="lg" full icon={<Icon name="mako" size={18} />} loading={escribiendo}
              disabled={!tema.trim() || !enLinea} onClick={() => void escribir()}>
              Escribir el guion
            </Button>
          </PieM>
        )}
      >
        <CampoM valor={tema} onCambio={setTema} etiqueta="Tema o idea del reel" deshabilitado={escribiendo}
          placeholder="De qué trata el reel" />
        <SeccionM titulo="Qué tiene que lograr">
          <OpcionesM opciones={OBJETIVOS_REEL} valor={objetivo} onCambio={setObjetivo} etiqueta="Qué tiene que lograr" deshabilitado={escribiendo} />
        </SeccionM>
        <SeccionM titulo="Duración">
          <SegmentadoM etiqueta="Duración" valor={duracion} onCambio={setDuracion}
            opciones={DURACIONES_REEL.map((d) => ({ id: d.value, label: DURACION_CORTA[d.value] }))} />
        </SeccionM>
        {error && hoja === 'nuevo' && <ErrorLineaM>{error}</ErrorLineaM>}
      </SheetM>

      <SheetM
        id="guion-reel"
        abierto={hoja === 'guion' && viendo != null}
        onCerrar={() => setHoja(null)}
        titulo="Guion del reel"
        snap="alto"
        rotuloCerrar="Cerrar el guion"
        pie={viendo ? (
          <PieM>
            <Button variant="primary" size="lg" full icon={<Icon name="copy" size={18} />} onClick={() => void copiar(viendo)}>
              Copiar el guion
            </Button>
            <Button variant="tertiary" size="lg" full disabled={!enLinea} onClick={() => { setError(''); setHoja('ajustar'); }}>
              Ajustar el guion
            </Button>
          </PieM>
        ) : undefined}
      >
        {viendo && <GuionReelM item={viendo} />}
      </SheetM>

      <SheetM
        id="ajustar-reel"
        abierto={hoja === 'ajustar' && viendo != null}
        onCerrar={() => setHoja(viendo ? 'guion' : null)}
        titulo="Ajustar el guion"
        ocupado={escribiendo}
        rotuloCerrar="Volver al guion"
        pie={(
          <PieM consecuencia={escribiendo ? 'MaKo está reescribiendo. Tarda unos segundos.' : 'Sale una versión nueva; esta queda en la lista.'}>
            <Button variant="mako" size="lg" full icon={<Icon name="mako" size={18} />} loading={escribiendo}
              disabled={!feedback.trim() || !enLinea || !viendo} onClick={() => { if (viendo) void escribir({ anterior: viendo, feedback }); }}>
              Reescribir el guion
            </Button>
          </PieM>
        )}
      >
        <CampoM valor={feedback} onCambio={setFeedback} etiqueta="Qué cambiarías" deshabilitado={escribiendo}
          placeholder="Qué cambiarías de este guion" filas={5} />
        {error && hoja === 'ajustar' && <ErrorLineaM>{error}</ErrorLineaM>}
      </SheetM>
    </>
  );
}
