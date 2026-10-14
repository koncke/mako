'use client';

// =============================================================================
// El inicio del Image Editor: crear un diseño y los recientes
// =============================================================================
// Versión «plantilla para ir trabajando» (14/10): los tamaños de Canva y la lista
// de diseños de ESTE workspace guardados en el navegador (../espacio.ts). El inicio
// copiado de Canva (titular, buscador, accesos por tipo) llega con el re-vestido.
//
// Crear = guardar un documento en blanco y navegar a /image-editor/<id> con el `?ws=`.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { useConfirm } from '@/app/_ui/Confirm';
import { createBlankDocument } from '../_doory/lib/document';
import type { LocalDesignSummary } from '../_doory/lib/local/types';
import { repositorioDe } from '../espacio';
import { RUTA_INICIO } from '../ruta';
import styles from './inicio.module.css';

/** Los tamaños más usados de «Crear un diseño» de Canva, en px. */
export const TAMANOS = [
  { id: 'instagram-post', nombre: 'Publicación de Instagram (cuadrada)', ancho: 1080, alto: 1080 },
  { id: 'instagram-vertical', nombre: 'Publicación de Instagram (vertical)', ancho: 1080, alto: 1350 },
  { id: 'instagram-story', nombre: 'Historia de Instagram', ancho: 1080, alto: 1920 },
  { id: 'presentation', nombre: 'Presentación (16:9)', ancho: 1920, alto: 1080 },
  { id: 'youtube-thumbnail', nombre: 'Miniatura de YouTube', ancho: 1280, alto: 720 },
  { id: 'facebook-post', nombre: 'Publicación de Facebook', ancho: 940, alto: 788 },
  { id: 'a4', nombre: 'Documento A4', ancho: 794, alto: 1123 },
] as const;

function useMiniatura(blob?: Blob): string | null {
  const url = useMemo(() => (blob ? URL.createObjectURL(blob) : null), [blob]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  return url;
}

function Tarjeta({ d, onAbrir, onBorrar }: { d: LocalDesignSummary; onAbrir: () => void; onBorrar: () => void }) {
  const mini = useMiniatura(d.thumbnail);
  return (
    <div className={styles.tarjeta}>
      <button type="button" className={styles.miniatura} onClick={onAbrir} aria-label={`Abrir ${d.title}`}>
        {mini ? <img src={mini} alt="" /> : <span className={styles.vacia} style={{ aspectRatio: `${d.width} / ${d.height}` }} />}
      </button>
      <div className={styles.pie}>
        <button type="button" className={styles.titulo} onClick={onAbrir}>{d.title}</button>
        <BotonBorrar talla="xs" title={`Eliminar «${d.title}»`} onClick={onBorrar} />
      </div>
      <span className={styles.medidas}>{d.width} × {d.height} px{d.pageCount > 1 ? ` · ${d.pageCount} páginas` : ''}</span>
    </div>
  );
}

export function Inicio({ ws }: { ws: number | null }) {
  const repo = useMemo(() => repositorioDe(ws), [ws]);
  const router = useRouter();
  const { confirm, confirmNode } = useConfirm();
  const [disenos, setDisenos] = useState<LocalDesignSummary[] | null>(null);
  const [ancho, setAncho] = useState('1080');
  const [alto, setAlto] = useState('1080');
  const [creando, setCreando] = useState(false);

  const cargar = useCallback(() => {
    repo.listDesigns().then((lista) => setDisenos([...lista].sort((a, b) => b.updatedAt - a.updatedAt)), () => setDisenos([]));
  }, [repo]);
  useEffect(cargar, [cargar]);

  async function crear(w: number, h: number, nombre: string, presetId?: string) {
    if (creando) return;
    setCreando(true);
    try {
      const d = await repo.createDesign({ title: nombre, document: createBlankDocument(w, h, { presetId }) });
      router.push(`${RUTA_INICIO}/${d.id}`);
    } finally {
      setCreando(false);
    }
  }

  async function borrar(d: LocalDesignSummary) {
    if (!(await confirm(`Se elimina «${d.title}» de este navegador.`, { title: 'Eliminar diseño' }))) return;
    await repo.deleteDesign(d.id);
    cargar();
  }

  const w = Number.parseInt(ancho, 10);
  const h = Number.parseInt(alto, 10);
  const medidaOk = w >= 40 && h >= 40 && w <= 8000 && h <= 8000;

  return (
    <div className={styles.inicio}>
      <header className={styles.cabecera}>
        <h1>¿Qué vas a diseñar hoy?</h1>
      </header>

      <section className={styles.seccion}>
        <h2>Crear un diseño</h2>
        <div className={styles.tamanos}>
          {TAMANOS.map((t) => (
            <button key={t.id} type="button" className={styles.tamano} disabled={creando} onClick={() => crear(t.ancho, t.alto, t.nombre, t.id)}>
              <span className={styles.forma} style={{ aspectRatio: `${t.ancho} / ${t.alto}` }} />
              <span className={styles.nombre}>{t.nombre}</span>
              <span className={styles.medidas}>{t.ancho} × {t.alto} px</span>
            </button>
          ))}
          <form className={styles.personalizado} onSubmit={(e) => { e.preventDefault(); if (medidaOk) void crear(w, h, 'Diseño sin título'); }}>
            <span className={styles.nombre}>Tamaño personalizado</span>
            <div className={styles.campos}>
              <label>Ancho<input inputMode="numeric" value={ancho} onChange={(e) => setAncho(e.target.value.replace(/\D/g, ''))} /></label>
              <label>Alto<input inputMode="numeric" value={alto} onChange={(e) => setAlto(e.target.value.replace(/\D/g, ''))} /></label>
              <span className={styles.medidas}>px</span>
            </div>
            <button type="submit" className={styles.primario} disabled={!medidaOk || creando}>Crear nuevo diseño</button>
          </form>
        </div>
      </section>

      <section className={styles.seccion}>
        <h2>Recientes</h2>
        {disenos === null ? null : disenos.length === 0 ? (
          <p className={styles.vacio}>Todavía no hay diseños.</p>
        ) : (
          <div className={styles.grilla}>
            {disenos.map((d) => (
              <Tarjeta key={d.id} d={d} onAbrir={() => router.push(`${RUTA_INICIO}/${d.id}`)} onBorrar={() => void borrar(d)} />
            ))}
          </div>
        )}
      </section>
      {confirmNode}
    </div>
  );
}
