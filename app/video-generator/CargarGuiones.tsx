'use client';

// =============================================================================
// Pegar guiones propios — se MIRA antes de guardar
// =============================================================================
// Dos pasos y no uno: pegar → ver qué encontró → confirmar. Pegar un archivo
// entero y que aparezcan siete guiones sin haberlos visto es cómo se llena el
// banco de basura que después nadie borra.
//
// Y lo que se muestra en el medio no es un «¿confirmás?»: es CADA guion con su
// título, sus palabras y una marca si está repetido, con su casilla. El momento
// de mirarlo es el momento de poder sacarlo.

import { useCallback, useState } from 'react';
import { Modal, Button, Alert, Textarea } from '@/app/_ui';
import { previoCargaAction, cargarGuionesAction, type PrevioCarga } from './cargar-guiones-action';

export function CargarGuiones({ onCerrar, onCargado }: {
  onCerrar: () => void;
  onCargado: (cuantos: number) => void;
}) {
  const [crudo, setCrudo] = useState('');
  const [previo, setPrevio] = useState<PrevioCarga | null>(null);
  const [elegidos, setElegidos] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mirar = useCallback(async () => {
    setBusy(true); setError(null);
    try {
      const out = await previoCargaAction(crudo);
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
  }, [crudo]);

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

  return (
    <Modal
      onCerrar={onCerrar}
      titulo={previo ? 'Esto encontré' : 'Cargar mis guiones'}
    >
      {error && <Alert tono="bad">{error}</Alert>}

      {!previo ? (
        <>
          <Textarea
            rows={12}
            value={crudo}
            onChange={(e) => setCrudo(e.target.value)}
            placeholder={'Pega acá tus guiones, como los tengas.\n\nSi hay varios en el mismo texto, los separo yo.'}
          />
          <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 10 }}>
            No hace falta que estén prolijos ni separados. Si el archivo trae varios, los
            reconozco por sus títulos y te muestro cada uno antes de guardar nada.
          </div>

          {/*
            Se dice lo que NO hace. Un guion que entra sin revisión entra sin
            alinearse al negocio, y el caso típico es invisible al leerlo: el CTA
            de la competencia manda a un webinar y el tuyo a tu VSL. Callarlo sería
            dejar creer que MaKo lo revisó.
          */}
          <div style={{ marginTop: 14 }}>
            <Alert tono="info">
              Estos guiones entran <strong>sin revisión</strong>: los guardo tal cual, sin
              mirar si encajan con tu oferta, tu avatar o tu embudo. Ojo con los que copiaste
              de otro lado — el llamado a la acción suele ser el que no aplica.
            </Alert>
          </div>
        </>
      ) : (
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

          {/* La consecuencia va PEGADA al botón, en tinta normal: es lo que pasa al
              apretar, y arriba y en gris no lo lee nadie. */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginTop: 16 }}>
            <Button variant="primary" onClick={() => void guardar()} loading={busy} disabled={elegidos.size === 0}>
              {elegidos.size === 1 ? 'Guardar 1 guion' : `Guardar ${elegidos.size} guiones`}
            </Button>
            <Button variant="tertiary" onClick={() => setPrevio(null)}>Volver a pegar</Button>
          </div>
        </>
      )}

      {!previo && (
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" onClick={() => void mirar()} loading={busy} disabled={crudo.trim().length < 30}>
            Ver qué encontré
          </Button>
        </div>
      )}
    </Modal>
  );
}
