'use client';

// =============================================================================
// StoriesM — el día de stories en el teléfono: pedirlo, mirarlo como en Instagram y copiarlo
// =============================================================================
// Ver ./page.tsx. La secuencia se dibuja con <VisorStoriesM> (el visor de historias de Instagram); el pedido es una
// hoja. Las secuencias de esta sesión quedan en una lista debajo, como en escritorio («Secuencias de esta sesión»):
// se pierden al salir de la pantalla, así que lo que se quiera guardar se copia.
// =============================================================================

import { useState } from 'react';
import { Button } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import { rutaSeccion } from '@/lib/secciones-negocio';
import type { PiezaStory } from '@/lib/ig-writer';
import { OBJETIVOS_STORIES, empujaADm, type ObjetivoStories } from '@/app/stories/objetivos';
import { generarSecuenciaAction } from '@/app/stories/actions';
import { secuenciaATexto } from '@/app/stories/texto';
import { copiarTexto } from '@/app/m/copywriting/api';
import {
  FilaM, ListaM, PieFijoM, PieM, SeccionM, SheetM, VacioM, useConexion, useToastM,
} from '@/app/m/_ui';
import { CampoM, ErrorLineaM, OpcionesM, RotuloM } from '../_creacion/escritor';
import { VisorStoriesM } from './VisorStoriesM';

type Item = { pieza: PiezaStory; objetivo: ObjetivoStories; at: string };

const horaCorta = (iso: string) => {
  try { return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
};

export function StoriesM({ perfilListo }: { perfilListo: boolean }) {
  const toast = useToastM();
  const { enLinea } = useConexion();
  const [objetivo, setObjetivo] = useState<ObjetivoStories>('conexion');
  const [idea, setIdea] = useState('');
  const [sesion, setSesion] = useState<Item[]>([]);
  const [actual, setActual] = useState<Item | null>(null);
  const [hoja, setHoja] = useState(false);
  const [escribiendo, setEscribiendo] = useState(false);
  const [error, setError] = useState('');

  const escribir = async () => {
    if (escribiendo || !idea.trim()) return;
    setEscribiendo(true); setError('');
    try {
      const r = await generarSecuenciaAction(objetivo, idea);
      if (!r.ok) { setError(r.error); return; }
      const item: Item = { pieza: r.pieza, objetivo, at: new Date().toISOString() };
      setActual(item);
      setSesion((s) => [item, ...s]);
      setIdea('');
      setHoja(false);
      toast('Secuencia lista');
    } catch {
      setError('No se pudo escribir la secuencia. Revisa tu conexión y vuelve a intentar.');
    } finally {
      setEscribiendo(false);
    }
  };

  const copiar = async () => {
    if (!actual) return;
    toast((await copiarTexto(secuenciaATexto(actual.pieza))) ? 'Secuencia copiada' : 'No se pudo copiar');
  };

  const p = actual?.pieza ?? null;
  const interactivos = p ? p.frames.filter((f) => f.interactivoManual).length : 0;

  return (
    <>
      {!perfilListo && (
        <ListaM>
          <FilaM icono="cerebro" titulo="MaKo todavía no conoce tu negocio" segunda="Sin eso, las stories salen genéricas" href={rutaSeccion('archivero')} />
        </ListaM>
      )}

      {!p ? (
        <VacioM frase="Cuéntale a MaKo la idea del día." />
      ) : (
        <>
          <VisorStoriesM key={actual?.at} pieza={p} />
          <section className="m-stories-dia">
            <RotuloM>La idea del día</RotuloM>
            <p className="m-stories-dia__idea">{p.idea}</p>
            {(p.cta || p.palabraClave) && (
              <>
                <RotuloM>Cierre</RotuloM>
                <p className="m-stories-dia__cierre">
                  {p.cta}
                  {p.palabraClave && <> · <strong>{p.palabraClave}</strong></>}
                </p>
              </>
            )}
            {interactivos > 0 && (
              <p className="m-stories-dia__nota">
                {interactivos === 1 ? 'Un frame lleva un sticker' : `${interactivos} frames llevan stickers`}: se agregan a mano en Instagram.
              </p>
            )}
          </section>
        </>
      )}

      {sesion.length > 1 && (
        <SeccionM titulo="De esta sesión">
          <ListaM>
            {sesion.map((h) => (
              <FilaM
                key={h.at}
                leading={<span className="m-stories-mini" aria-hidden><Icon name="stories" size={18} /></span>}
                titulo={h.pieza.idea}
                segunda={`${OBJETIVOS_STORIES.find((o) => o.value === h.objetivo)?.label ?? h.objetivo} · ${h.pieza.frames.length} frames · ${horaCorta(h.at)}`}
                riel={h === actual ? <Icon name="check" size={18} /> : undefined}
                chevron={false}
                onClick={() => setActual(h)}
              />
            ))}
          </ListaM>
        </SeccionM>
      )}

      <PieFijoM>
        {p && (
          <Button variant="primary" size="lg" full icon={<Icon name="copy" size={18} />} onClick={() => void copiar()}>
            Copiar la secuencia
          </Button>
        )}
        <Button variant={p ? 'tertiary' : 'mako'} size="lg" full icon={p ? undefined : <Icon name="mako" size={18} />}
          disabled={!enLinea} onClick={() => { setError(''); setHoja(true); }}>
          {p ? 'Escribir otro día' : 'Escribir el día de stories'}
        </Button>
      </PieFijoM>

      <SheetM
        id="dia-stories"
        abierto={hoja}
        onCerrar={() => setHoja(false)}
        titulo="El día de stories"
        snap="alto"
        ocupado={escribiendo}
        rotuloCerrar="Cerrar el pedido"
        pie={(
          <PieM consecuencia={escribiendo
            ? 'MaKo está escribiendo. Tarda unos segundos.'
            : empujaADm(objetivo) ? 'El último frame pide responder con una palabra clave.' : undefined}>
            <Button variant="mako" size="lg" full icon={<Icon name="mako" size={18} />} loading={escribiendo}
              disabled={!idea.trim() || !enLinea} onClick={() => void escribir()}>
              Escribir la secuencia
            </Button>
          </PieM>
        )}
      >
        <CampoM valor={idea} onCambio={setIdea} etiqueta="La idea del día" deshabilitado={escribiendo}
          placeholder="La idea del día" />
        <SeccionM titulo="Qué quieres lograr hoy">
          <OpcionesM opciones={OBJETIVOS_STORIES} valor={objetivo} onCambio={setObjetivo} etiqueta="Qué quieres lograr hoy" deshabilitado={escribiendo} />
        </SeccionM>
        {error && <ErrorLineaM>{error}</ErrorLineaM>}
      </SheetM>
    </>
  );
}
