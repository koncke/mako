'use client';

// =============================================================================
// «Proyectos»: los diseños del workspace, como la pestaña de Canva
// =============================================================================
// Pestañas «Diseños» y «Carpetas» (Carpetas llega con Supabase, etapa 3). Cada
// diseño se ve con su miniatura y su nombre; un clic guarda el actual y abre el
// otro (`rutaDiseno`, con el `?ws=` de la pestaña). En Canva el clic AGREGA las
// páginas de ese diseño al actual; acá abre, que es lo que pidió el plano de la tanda 2.
//
// Los diseños viven en el navegador, una base de IndexedDB por workspace
// (../espacio.ts). Cuál es la base lo dice el server (`ws`, ver ./registro.ts); si
// nadie lo pasó, se busca la base que tiene el diseño abierto: primero la del
// `?ws=` de la URL y después las del navegador con el nombre de `nombreBase`. Es
// sólo para elegir una base LOCAL: no decide datos del server.

import { useEffect, useMemo, useState } from 'react';
import { parseWs, WS_PARAM } from '@/lib/ws-tab';
import { useEditor, type EditorEngine } from '../_doory/editor/extensions';
import type { LocalRepository } from '../_doory/lib/local/repository';
import type { LocalDesignSummary } from '../_doory/lib/local/types';
import { repositorioDe } from '../espacio';
import { rutaDiseno } from '../ruta';
import styles from './proyectos.module.css';

type Pestana = 'disenos' | 'carpetas';
type Carga = { estado: 'cargando' } | { estado: 'listo'; disenos: LocalDesignSummary[] } | { estado: 'error' };

/** `mako-ws3-image-editor` → 3. Mismo formato que `nombreBase` de ../espacio.ts. */
const BASE = /^mako-ws(\d+)-image-editor$/;

/** La base del navegador que tiene el diseño abierto (ver el encabezado). */
async function repoDelDiseno(disenoId: string): Promise<LocalRepository | null> {
  const candidatos: number[] = [];
  const deUrl = parseWs(new URLSearchParams(window.location.search).get(WS_PARAM));
  if (deUrl !== null) candidatos.push(deUrl);
  try {
    // `databases()` lista las bases que YA existen: así no se crea una vacía por preguntar.
    const bases = typeof indexedDB !== 'undefined' && typeof indexedDB.databases === 'function' ? await indexedDB.databases() : [];
    for (const b of bases) {
      const m = BASE.exec(b.name ?? '');
      if (m && !candidatos.includes(Number(m[1]))) candidatos.push(Number(m[1]));
    }
  } catch {
    /* el navegador no deja listar las bases: quedan las de la URL */
  }
  for (const ws of candidatos) {
    const repo = repositorioDe(ws);
    const esta = await repo.getDesign(disenoId).then(Boolean, () => false);
    if (esta) return repo;
  }
  return null;
}

function useRepo(editor: EditorEngine, ws: number | null | undefined): LocalRepository | null | 'buscando' {
  const fijo = useMemo(() => (ws === undefined ? null : repositorioDe(ws)), [ws]);
  const [hallado, setHallado] = useState<LocalRepository | null | 'buscando'>('buscando');
  const disenoId = editor.designId;
  useEffect(() => {
    if (fijo) return;
    let vivo = true;
    void repoDelDiseno(disenoId).then((r) => {
      if (vivo) setHallado(r);
    });
    return () => {
      vivo = false;
    };
  }, [fijo, disenoId]);
  return fijo ?? hallado;
}

function useMiniatura(blob?: Blob): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => {
    if (url) URL.revokeObjectURL(url);
  }, [url]);
  return url;
}

function Tarjeta({ d, abierto, abriendo, onAbrir }: { d: LocalDesignSummary; abierto: boolean; abriendo: boolean; onAbrir: () => void }) {
  const mini = useMiniatura(d.thumbnail);
  // La miniatura respeta la forma del diseño, dentro de lo que entra en dos columnas.
  const proporcion = Math.min(2, Math.max(0.5, d.width / Math.max(1, d.height)));
  return (
    <div className={styles.item}>
      <button
        type="button"
        className={`${styles.tarjeta} ${abierto ? styles.abierto : ''}`}
        style={{ aspectRatio: proporcion }}
        aria-label={abierto ? `${d.title} (abierto)` : `Abrir ${d.title}`}
        aria-current={abierto || undefined}
        aria-busy={abriendo || undefined}
        disabled={abriendo}
        data-testid="proyectos-diseno"
        onClick={onAbrir}
      >
        {mini ? <img src={mini} alt="" draggable={false} /> : <span className={styles.vacia} />}
        {abierto ? <span className={styles.marca}>Abierto</span> : null}
      </button>
      <span className={styles.titulo} title={d.title}>
        {d.title}
      </span>
    </div>
  );
}

function Disenos({ repo, editor }: { repo: LocalRepository; editor: EditorEngine }) {
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const [abriendo, setAbriendo] = useState<string | null>(null);
  const actual = editor.designId;

  useEffect(() => {
    let vivo = true;
    repo.listDesigns().then(
      (disenos) => {
        if (vivo) setCarga({ estado: 'listo', disenos });
      },
      () => {
        if (vivo) setCarga({ estado: 'error' });
      },
    );
    return () => {
      vivo = false;
    };
  }, [repo]);

  async function abrir(id: string): Promise<void> {
    if (id === actual || abriendo) return;
    setAbriendo(id);
    try {
      // Lo que esté sin guardar se guarda antes de irse (la navegación recarga la página).
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

export function ProyectosPanel({ ws }: { close(): void; ws?: number | null }) {
  const editor = useEditor();
  const repo = useRepo(editor, ws);
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
      ) : repo === 'buscando' ? (
        <p className={styles.aviso}>Cargando…</p>
      ) : repo === null ? (
        <p className={styles.aviso}>No se encontraron los diseños de este navegador.</p>
      ) : (
        <Disenos repo={repo} editor={editor} />
      )}
    </>
  );
}
