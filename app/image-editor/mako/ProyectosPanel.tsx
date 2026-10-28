'use client';

// =============================================================================
// «Proyectos»: los diseños del workspace, como la pestaña de Canva
// =============================================================================
// Pestañas «Diseños» y «Carpetas» (Carpetas: todavía no; ver hallazgos-editor-imagen.md). Cada
// diseño se ve con su miniatura y su nombre; un clic guarda el actual y abre el
// otro EN EL MISMO LUGAR (el estudio, ../editor/Estudio.tsx, 27/10/2026: antes recargaba en otra ruta). En Canva el clic
// AGREGA las páginas de ese diseño al actual; acá abre, que es lo que pidió el plano de la tanda 2. En la pantalla chica
// es la pestaña de la tira de abajo: ahí no está la tarjeta con la lista, y ésta es la lista.
//
// Los diseños son los del workspace de la pestaña, en la base (/api/image-editor/disenos,
// mig 0278): el `?ws=` lo pone `WsFetch` en el pedido y el server decide con `getWorkspaceActual`.

import { useEffect, useState } from 'react';
import { useEditor, type EditorEngine } from '../_doory/editor/extensions';
import type { ResumenDiseno } from '@/lib/image-editor/tipos';
import { listarDisenos } from './nube';
import { rutaDiseno } from '../ruta';
import { useEstudio } from '../editor/estudio';
import styles from './proyectos.module.css';

type Pestana = 'disenos' | 'carpetas';
type Carga = { estado: 'cargando' } | { estado: 'listo'; disenos: ResumenDiseno[] } | { estado: 'error' };

function Tarjeta({ d, abierto, abriendo, onAbrir }: { d: ResumenDiseno; abierto: boolean; abriendo: boolean; onAbrir: () => void }) {
  // La miniatura respeta la forma del diseño, dentro de lo que entra en dos columnas.
  const proporcion = Math.min(2, Math.max(0.5, d.ancho / Math.max(1, d.alto)));
  return (
    <div className={styles.item}>
      <button
        type="button"
        className={`${styles.tarjeta} ${abierto ? styles.abierto : ''}`}
        style={{ aspectRatio: proporcion }}
        aria-label={abierto ? `${d.titulo} (abierto)` : `Abrir ${d.titulo}`}
        aria-current={abierto || undefined}
        aria-busy={abriendo || undefined}
        disabled={abriendo}
        data-testid="proyectos-diseno"
        onClick={onAbrir}
      >
        {d.miniatura ? <img src={d.miniatura} alt="" draggable={false} /> : <span className={styles.vacia} />}
        {abierto ? <span className={styles.marca}>Abierto</span> : null}
      </button>
      <span className={styles.titulo} title={d.titulo}>
        {d.titulo}
      </span>
    </div>
  );
}

function Disenos({ editor }: { editor: EditorEngine }) {
  const estudio = useEstudio();
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const actual = editor.designId;

  useEffect(() => {
    let vivo = true;
    void listarDisenos().then((r) => {
      if (vivo) setCarga(r.ok ? { estado: 'listo', disenos: r.disenos } : { estado: 'error' });
    });
    return () => {
      vivo = false;
    };
  }, []);

  async function abrir(id: string): Promise<void> {
    if (id === actual || abriendo) return;
    setAbriendo(id);
    // Desde el 27/10/2026, en el MISMO lugar (Martín: «que no cambie de ruta»): el estudio guarda lo pendiente y monta el
    // otro diseño. Fuera del estudio (un banco de pruebas), como antes: guardar y recargar en la otra ruta.
    if (estudio) {
      estudio.abrir(id);
      return;
    }
    try {
      await editor.persistence.saveNow();
    } catch {
      /* si no se pudo guardar, el aviso de «sin guardar» del navegador decide */
    }
    window.location.href = rutaDiseno(id);
  }

  if (carga.estado === 'cargando') return <p className={styles.aviso}>Cargando…</p>;
  if (carga.estado === 'error') return <p className={styles.aviso}>No se pudieron cargar los diseños.</p>;
  if (carga.disenos.length === 0) return <p className={styles.aviso}>Todavía no hay diseños.</p>;
  return (
    <div className={styles.grilla}>
      {carga.disenos.map((d) => (
        <Tarjeta key={d.id} d={d} abierto={d.id === actual} abriendo={abriendo === d.id} onAbrir={() => void abrir(d.id)} />
      ))}
    </div>
  );
}

export function ProyectosPanel(_props: { close(): void; ws?: number | null }) {
  const editor = useEditor();
  const [pestana, setPestana] = useState<Pestana>('disenos');

  return (
    <>
      <div className={styles.pestanas} role="tablist" aria-label="Proyectos">
        <button type="button" role="tab" className={styles.pestana} aria-selected={pestana === 'disenos'} data-testid="proyectos-tab-disenos" onClick={() => setPestana('disenos')}>
          Diseños
        </button>
        <button type="button" role="tab" className={styles.pestana} aria-selected={pestana === 'carpetas'} data-testid="proyectos-tab-carpetas" onClick={() => setPestana('carpetas')}>
          Carpetas
        </button>
      </div>
      {pestana === 'carpetas' ? (
        <p className={styles.aviso}>Próximamente</p>
      ) : (
        <Disenos editor={editor} />
      )}
    </>
  );
}
