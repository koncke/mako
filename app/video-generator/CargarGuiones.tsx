'use client';

// =============================================================================
// Cargar guiones propios — elegir cómo, traerlos, confirmar
// =============================================================================
// TRES pasos, no una pantalla con todo junto. Es el molde de los formularios del
// repo: una pregunta por pantalla, y la primera es «¿cómo los traés?».
//
// La versión anterior eran tres pestañas arriba de un campo. Metía las tres
// entradas en la misma vista y obligaba a leerlas todas para elegir una; con tres
// opciones grandes se elige mirando, que es más rápido que leyendo.
//
// Y el último paso NO es un «¿confirmás?»: es CADA guion con su título, sus
// palabras y una marca si está repetido, con su casilla. El momento de mirarlo es
// el momento de poder sacarlo.

import { useCallback, useRef, useState } from 'react';
import { Modal, Button, Alert, Textarea } from '@/app/_ui';
import { Icon } from '../_components/icons';
import { ACCEPT_IMPORTAR } from '@/lib/formatos-archivo';
import {
  previoCargaAction, cargarGuionesAction, textoDeArchivoAction, textoDeLinkAction,
  type PrevioCarga,
} from './cargar-guiones-action';

type Via = 'escribir' | 'archivo' | 'link';

const OPCIONES: { via: Via; icono: string; titulo: string }[] = [
  { via: 'escribir', icono: 'escribir', titulo: 'Escribir o pegar' },
  { via: 'archivo', icono: 'descargar', titulo: 'Subir un archivo' },
  { via: 'link', icono: 'web', titulo: 'Pegar un link' },
];

export function CargarGuiones({ onCerrar, onCargado }: {
  onCerrar: () => void;
  onCargado: (cuantos: number) => void;
}) {
  /**
   * Las tres puertas terminan en el MISMO string.
   *
   * `crudo` es lo que se va a separar, venga de donde venga. Tener un texto por
   * entrada obligaría a decidir cuál gana cuando hay dos, y esa decisión no
   * existe: lo último que trajiste es lo que querés cargar.
   */
  const [crudo, setCrudo] = useState('');
  const [via, setVia] = useState<Via | null>(null);
  const [link, setLink] = useState('');
  const [previo, setPrevio] = useState<PrevioCarga | null>(null);
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputArchivo = useRef<HTMLInputElement | null>(null);

  const mirar = useCallback(async (texto: string) => {
    setBusy(true); setError(null);
    try {
      const out = await previoCargaAction(texto);
      if (!out.ok) { setError(out.error); return; }
      setPrevio(out.previo);
      // Vienen todos tildados MENOS los repetidos: lo más probable es que quiera
      // cargar todo, y el repetido es justo el que hay que decidir a mano.
      setElegidos(new Set(out.previo.guiones.map((g, i) => (g.duplicado ? -1 : i)).filter((i) => i >= 0)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo leer el texto.');
    } finally {
      setBusy(false);
    }
  }, []);

  const traerDeArchivo = useCallback(async (file: File) => {
    setBusy(true); setError(null);
    try {
      const form = new FormData();
      form.set('archivo', file);
      const out = await textoDeArchivoAction(form);
      if (!out.ok) { setError(out.error); return; }
      setCrudo(out.texto);
      // Del archivo se salta DIRECTO al previo. Mostrarle el texto extraído para
      // que apriete otro botón es un paso que no decide nada: si la extracción
      // salió mal se ve igual en la lista de guiones, y desde ahí puede volver.
      await mirar(out.texto);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pude leer el archivo.');
    } finally {
      setBusy(false);
    }
  }, [mirar]);

  const traerDeLink = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const out = await textoDeLinkAction(link);
      if (!out.ok) { setError(out.error); return; }
      setCrudo(out.texto);
      await mirar(out.texto);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pude abrir el link.');
    } finally {
      setBusy(false);
    }
  }, [link, mirar]);

  const guardar = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const out = await cargarGuionesAction(crudo, [...elegidos]);
      if (!out.ok) { setError(out.error); return; }
      onCargado(out.cargados);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudieron guardar.');
    } finally {
      setBusy(false);
    }
  }, [crudo, elegidos, onCargado]);

  const atras = useCallback(() => {
    if (previo) { setPrevio(null); return; }
    setVia(null); setError(null);
  }, [previo]);

  const titulo = previo
    ? 'Esto encontré'
    : via
      ? OPCIONES.find((o) => o.via === via)!.titulo
      : '¿Cómo quieres traerlos?';

  return (
    <Modal onCerrar={onCerrar} titulo={titulo} ancho={640}>
      {error && <Alert tono="bad">{error}</Alert>}

      {/* ── Paso 1: cómo ─────────────────────────────────────────────────── */}
      {!via && !previo && (
        <div style={{ display: 'grid', gap: 12, padding: '4px 0' }}>
          {OPCIONES.map((o) => (
            <button
              key={o.via}
              type="button"
              onClick={() => setVia(o.via)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                justifyContent: 'center', gap: 10, width: '100%',
                padding: '28px 18px', borderRadius: 14, cursor: 'pointer',
                fontFamily: 'inherit', background: 'var(--surface)',
                border: '1.5px solid var(--border)', color: 'var(--ink)',
                transition: 'border-color .12s, background .12s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--primary)';
                e.currentTarget.style.background = 'var(--primary-bg)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)';
                e.currentTarget.style.background = 'var(--surface)';
              }}
            >
              <Icon name={o.icono} size={26} />
              <span style={{ fontSize: 'var(--fs-card)', fontWeight: 650 }}>{o.titulo}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Paso 2: traerlos ─────────────────────────────────────────────── */}
      {via === 'escribir' && !previo && (
        <>
          <Textarea
            rows={12}
            value={crudo}
            onChange={(e) => setCrudo(e.target.value)}
            placeholder={'Pega acá tus guiones, como los tengas.\n\nSi hay varios en el mismo texto, los separo yo.'}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button variant="primary" onClick={() => void mirar(crudo)} loading={busy} disabled={crudo.trim().length < 30}>
              Continuar
            </Button>
            <Button variant="tertiary" onClick={atras}>Atrás</Button>
          </div>
        </>
      )}

      {via === 'archivo' && !previo && (
        <div style={{ textAlign: 'center', padding: '28px 0 8px' }}>
          <input
            ref={inputArchivo}
            type="file"
            accept={ACCEPT_IMPORTAR}
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              // El value se limpia para que subir DOS VECES el mismo archivo
              // dispare el evento la segunda: sin esto, corregirlo y volver a
              // elegirlo no hace nada y parece que la app se colgó.
              e.target.value = '';
              if (f) void traerDeArchivo(f);
            }}
          />
          <Button variant="primary" size="lg" onClick={() => inputArchivo.current?.click()} loading={busy}>
            Elegir archivo
          </Button>
          <div style={{ marginTop: 20 }}>
            <Button variant="tertiary" onClick={atras}>Atrás</Button>
          </div>
        </div>
      )}

      {via === 'link' && !previo && (
        <div style={{ padding: '12px 0 0' }}>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://docs.google.com/document/d/…"
            className="mk-input"
            style={{ width: '100%' }}
          />
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <Button variant="primary" onClick={() => void traerDeLink()} loading={busy} disabled={link.trim().length < 8}>
              Continuar
            </Button>
            <Button variant="tertiary" onClick={atras}>Atrás</Button>
          </div>
        </div>
      )}

      {/* ── Paso 3: qué encontró ─────────────────────────────────────────── */}
      {previo && (
        <>
          <div style={{ display: 'grid', gap: 8 }}>
            {previo.guiones.map((g, i) => {
              const on = elegidos.has(i);
              return (
                <label
                  key={i}
                  style={{
                    display: 'flex', gap: 11, alignItems: 'flex-start', cursor: 'pointer',
                    padding: '11px 13px', borderRadius: 10,
                    background: on ? 'var(--primary-bg)' : 'var(--surface-2)',
                    border: `1px solid ${on ? 'var(--primary)' : 'var(--border)'}`,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => setElegidos((s) => {
                      const n = new Set(s);
                      if (n.has(i)) n.delete(i); else n.add(i);
                      return n;
                    })}
                    style={{ marginTop: 3, flex: 'none' }}
                  />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 'var(--fs-md)', fontWeight: 650, color: 'var(--ink)' }}>
                      {g.titulo || `Guion ${i + 1}`}
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--fs-sm)', color: 'var(--dim)', marginTop: 3, lineHeight: 1.5 }}>
                      {g.texto.slice(0, 130).replace(/\n/g, ' ')}…
                    </span>
                    <span style={{ display: 'block', fontSize: 'var(--fs-meta)', color: 'var(--faint)', marginTop: 5 }}>
                      {g.palabras} palabras
                      {g.duplicado && (
                        <strong style={{ color: 'var(--warn)' }}> · repetido en este mismo texto</strong>
                      )}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>

          {previo.yaEstaban > 0 && (
            <div style={{ marginTop: 12 }}>
              <Alert tono="info">
                {previo.yaEstaban === 1
                  ? 'Uno de estos ya estaba cargado y no se va a duplicar.'
                  : `${previo.yaEstaban} de estos ya estaban cargados y no se van a duplicar.`}
              </Alert>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
            <Button variant="primary" onClick={() => void guardar()} loading={busy} disabled={elegidos.size === 0}>
              {elegidos.size === 1 ? 'Guardar 1 guion' : `Guardar ${elegidos.size} guiones`}
            </Button>
            <Button variant="tertiary" onClick={atras}>Atrás</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
