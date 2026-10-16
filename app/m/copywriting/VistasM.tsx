'use client';

// =============================================================================
// /m/copywriting — las vistas Anuncios y Guiones (la matriz y la galería de escritorio)
// =============================================================================
// Anuncios = MatrizView.tsx en lista: un grupo por avatar con su «3 de 5» (la lista agrupada de
// Linear), una fila por razón con cuántos guiones tiene y el estado más avanzado. Un anuncio SIN
// guion se toca y MaKo lo escribe ahí mismo, como la tarjeta punteada de escritorio («un clic y MaKo
// escribe el guion ahí mismo, sin abrir el modal»); uno con guiones abre su hoja.
// Guiones = GuionesGlobal.tsx sin la barra de filtros: la tarjeta es la de GuionCard.tsx (el GANCHO
// como cita, la espina de sus bloques, el ángulo y el avatar) con «Copiar» en el pie, como una cita
// de Readwise. Lo que la tarjeta abre y lo que copia son dos botones HERMANOS: un botón dentro de otro
// es HTML inválido (escritorio lo dejó escrito en GuionCard.tsx).
// =============================================================================

import { Icon } from '@/app/_components/icons';
import { ESTADO_GUION_LABEL } from '@/lib/guion-estado';
import { ComputadoraM, FilaM, ListaM, PildoraM, SeccionM, VacioM } from '@/app/m/_ui';
import { R, espinaDe, metaDeGuion, portadaDe, segundaDeAnuncio, tonoDeEstado, type GrupoAnuncios, type GuionM } from './modelo';

/** Lo que cada vista deja en la computadora (una fila al final). */
export const COMPU = {
  anuncios: 'Elegir con MaKo y rehacer la matriz',
  guiones: 'Editar, filtrar y cambiar el estado',
  analizar: 'Sincronizar, ángulos y avatares',
} as const;

export function AnunciosM({ grupos, escribiendo, onEscribir, onAbrir }: {
  grupos: GrupoAnuncios[];
  /** La celda en la que MaKo está escribiendo ahora (una por vez). */
  escribiendo: string | null;
  onEscribir: (celdaId: string) => void;
  onAbrir: (celdaId: string) => void;
}) {
  return (
    <>
      {grupos.map((gr) => (
        <SeccionM key={gr.avatarId} titulo={gr.avatar}
          accion={<span className="m-copywriting-cuenta">{gr.conGuion} de {gr.total}</span>}>
          <ListaM>
            {gr.filas.map((f) => {
              const enCurso = escribiendo === f.id;
              return (
                <FilaM
                  key={f.id}
                  titulo={f.nombre}
                  segunda={enCurso ? R.makoEscribiendo : segundaDeAnuncio(f)}
                  pill={f.estado ? <PildoraM tono={tonoDeEstado(f.estado)}>{ESTADO_GUION_LABEL[f.estado]}</PildoraM> : undefined}
                  enCurso={enCurso || undefined}
                  // Sin guion la fila ACTÚA (MaKo escribe), no abre: sin chevron.
                  chevron={f.n > 0}
                  onClick={enCurso ? undefined : () => (f.n ? onAbrir(f.id) : onEscribir(f.id))}
                  etiqueta={f.n ? undefined : `${R.queMakoEscriba}: ${f.nombre}`}
                />
              );
            })}
          </ListaM>
        </SeccionM>
      ))}
      <ComputadoraM que={COMPU.anuncios} />
    </>
  );
}

export function TarjetaGuionM({ x, onAbrir, onCopiar }: { x: GuionM; onAbrir: () => void; onCopiar: () => void }) {
  const portada = portadaDe(x.g.texto);
  const espina = espinaDe(x.g.texto);
  const meta = metaDeGuion(x);
  return (
    <article className="m-copywriting-guion">
      <button type="button" className="m-copywriting-guion__abrir" onClick={onAbrir} aria-label={`Abrir el guion de ${x.celda}`}>
        <span className="m-copywriting-guion__rotulo">{portada.titulo ?? 'Guion'}</span>
        <span className="m-copywriting-guion__cita">{portada.texto}</span>
        {espina.length > 0 && (
          <span className="m-copywriting-espina" aria-hidden>
            {espina.map((f, i) => <i key={i} style={{ flexGrow: f }} data-gancho={i === 0 || undefined} />)}
          </span>
        )}
        {meta && <span className="m-copywriting-guion__meta">{meta}</span>}
      </button>
      <div className="m-copywriting-guion__pie">
        <PildoraM tono={tonoDeEstado(x.g.estado)}>{ESTADO_GUION_LABEL[x.g.estado]}</PildoraM>
        <button type="button" className="m-copywriting-copiar" onClick={onCopiar}>
          <Icon name="copy" size={18} />
          Copiar
        </button>
      </div>
    </article>
  );
}

export function GaleriaM({ guiones, onAbrir, onCopiar }: {
  guiones: GuionM[];
  onAbrir: (x: GuionM) => void;
  onCopiar: (texto: string) => void;
}) {
  if (!guiones.length) {
    return (
      <>
        <VacioM frase="Todavía no hay guiones." />
        <ComputadoraM que={COMPU.guiones} />
      </>
    );
  }
  return (
    <>
      <div className="m-copywriting-galeria">
        {guiones.map((x) => (
          <TarjetaGuionM key={`${x.celdaId}:${x.g.id}`} x={x} onAbrir={() => onAbrir(x)} onCopiar={() => onCopiar(x.g.texto)} />
        ))}
      </div>
      <ComputadoraM que={COMPU.guiones} />
    </>
  );
}
