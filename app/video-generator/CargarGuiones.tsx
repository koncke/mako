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

import { useCallback, useRef, useState } from 'react';
import { Modal, Button, Alert, Textarea, Tabs } from '@/app/_ui';
import { ACCEPT_IMPORTAR, formatosLegibles } from '@/lib/formatos-archivo';
import {
  previoCargaAction, cargarGuionesAction, textoDeArchivoAction, textoDeLinkAction,
  type PrevioCarga,
} from './cargar-guiones-action';

export function CargarGuiones({ onCerrar, onCargado }: {
  onCerrar: () => void;
  onCargado: (cuantos: number) => void;
}) {
  /**
   * Las tres puertas terminan en el MISMO string.
   *
   * `crudo` es lo que se va a separar, venga de donde venga: se escribe, se lee de
   * un archivo o se baja de un link. Tener un texto por entrada obligaría a
   * decidir cuál gana cuando hay dos, y esa decisión no existe — lo último que
   * cargaste es lo que querés cargar.
   */
  const [crudo, setCrudo] = useState('');
  const [via, setVia] = useState<'escribir' | 'archivo' | 'link'>('escribir');
  const [link, setLink] = useState('');
  const [nota, setNota] = useState<string | null>(null);
  const inputArchivo = useRef<HTMLInputElement | null>(null);
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

  const traerDeArchivo = useCallback(async (file: File) => {
    setBusy(true); setError(null); setNota(null);
    try {
      const form = new FormData();
      form.set('archivo', file);
      const out = await textoDeArchivoAction(form);
      if (!out.ok) { setError(out.error); return; }
      setCrudo(out.texto);
      // Se muestra el texto en vez de saltar directo al previo: el usuario acaba
      // de subir un archivo a ciegas y lo primero que necesita es ver que lo leí
      // bien. Un pdf mal extraído se nota mirándolo, no contando guiones.
      setVia('escribir');
      setNota(out.nota ?? `Leí «${file.name}». Revisá que esté completo y seguí.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pude leer el archivo.');
    } finally {
      setBusy(false);
    }
  }, []);

  const traerDeLink = useCallback(async () => {
    setBusy(true); setError(null); setNota(null);
    try {
      const out = await textoDeLinkAction(link);
      if (!out.ok) { setError(out.error); return; }
      setCrudo(out.texto);
      setVia('escribir');
      setNota(out.nota ?? 'Bajé el texto del link. Revisá que esté completo y seguí.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No pude abrir el link.');
    } finally {
      setBusy(false);
    }
  }, [link]);

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
      // Más ancho que el default de 600: con tres pestañas arriba y un textarea
      // de doce filas, el modal por defecto aprieta el contenido contra los
      // bordes y las pestañas quedan amontonadas.
      ancho={720}
    >
      {error && <Alert tono="bad">{error}</Alert>}

      {!previo ? (
        <>
          <Tabs
            tabs={[
              { id: 'escribir', label: 'Escribir o pegar' },
              { id: 'archivo', label: 'Subir un archivo' },
              { id: 'link', label: 'Pegar un link' },
            ]}
            activa={via}
            onCambio={(k: string) => setVia(k as typeof via)}
          />

          <div style={{ marginTop: 14 }}>
            {via === 'escribir' && (
              <>
                <Textarea
                  rows={12}
                  value={crudo}
                  onChange={(e) => { setCrudo(e.target.value); setNota(null); }}
                  placeholder={'Pega acá tus guiones, como los tengas.\n\nSi hay varios en el mismo texto, los separo yo.'}
                />
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 10 }}>
                  No hace falta que estén prolijos ni separados. Si el texto trae varios, los
                  reconozco por sus títulos y te muestro cada uno antes de guardar nada.
                </div>
              </>
            )}

            {via === 'archivo' && (
              <div style={{ textAlign: 'center', padding: '18px 0' }}>
                <input
                  ref={inputArchivo}
                  type="file"
                  accept={ACCEPT_IMPORTAR}
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    // El value se limpia para que subir DOS VECES el mismo archivo
                    // dispare el evento la segunda: sin esto, corregir el archivo y
                    // volver a elegirlo no hace nada y parece que la app se colgó.
                    e.target.value = '';
                    if (f) void traerDeArchivo(f);
                  }}
                />
                <Button variant="secondary" onClick={() => inputArchivo.current?.click()} loading={busy}>
                  Elegir archivo
                </Button>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 12, lineHeight: 1.6 }}>
                  {/* Los formatos salen del catálogo del repo, no de una lista escrita
                      acá: una copia se queda vieja el día que se soporte uno más. */}
                  Puedo leer {formatosLegibles()}.
                </div>
              </div>
            )}

            {via === 'link' && (
              <div style={{ padding: '6px 0' }}>
                <input
                  type="url"
                  value={link}
                  onChange={(e) => setLink(e.target.value)}
                  placeholder="https://docs.google.com/document/d/…"
                  className="mk-input"
                  style={{ width: '100%' }}
                />
                <div style={{ marginTop: 12 }}>
                  <Button variant="secondary" onClick={() => void traerDeLink()} loading={busy} disabled={link.trim().length < 8}>
                    Traer el texto
                  </Button>
                </div>
                <div style={{ fontSize: 'var(--fs-sm)', color: 'var(--faint)', marginTop: 12, lineHeight: 1.6 }}>
                  Anda con Google Docs, Drive y cualquier página pública. Si es un
                  documento de Google, tiene que estar compartido como{' '}
                  <strong>«cualquiera con el enlace»</strong> — si no, lo que me llega es la
                  pantalla de acceso y no tu guion.
                </div>
              </div>
            )}
          </div>

          {nota && (
            <div style={{ marginTop: 12 }}>
              <Alert tono="good">{nota}</Alert>
            </div>
          )}

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

      {/* El avance vive fuera de las pestañas: las tres terminan en el mismo
          texto, así que el botón que lo separa es UNO. Aparece recién cuando hay
          algo que separar. */}
      {!previo && crudo.trim().length >= 30 && (
        <div style={{ marginTop: 16 }}>
          <Button variant="primary" onClick={() => void mirar()} loading={busy}>
            Ver qué encontré
          </Button>
        </div>
      )}
    </Modal>
  );
}
