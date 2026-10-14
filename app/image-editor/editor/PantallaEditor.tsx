'use client';

// =============================================================================
// La pantalla del editor de un diseño
// =============================================================================
// Lee el diseño del almacenamiento local del workspace (../espacio.ts), arma el
// adaptador de MaKo y monta el EditorApp de Doory. El adaptador es el de
// «invitado» de Doory (guarda en IndexedDB) con los catálogos de MaKo
// (../mako/servicios.ts) y el modo `account`: quien está acá ya entró a MaKo, así
// que el editor no le ofrece «crear una cuenta» (en modo `guest` lo haría).
//
// Lo que Doory pide a su backend y MaKo todavía no tiene queda en `null` (Marca,
// fotos de stock, versiones, compartir, comentarios): el editor esconde esas
// herramientas solo.

import { useEffect, useMemo, useState } from 'react';
import Link from '@/app/_ui/Link';
import { EditorApp } from '../_doory/editor';
import { createGuestAdapter } from '../_doory/features/editor/adapters/guestAdapter';
import type { EditorAdapter } from '../_doory/types/adapter';
import type { LocalDesign } from '../_doory/lib/local/types';
import { repositorioDe } from '../espacio';
import { serviciosCatalogo } from '../mako/servicios';
import { RUTA_INICIO } from '../ruta';
import { CreditoDoory } from './CreditoDoory';
import styles from './pantalla.module.css';

type Carga = { estado: 'cargando' } | { estado: 'listo'; diseno: LocalDesign } | { estado: 'no-existe' } | { estado: 'error'; mensaje: string };

export function PantallaEditor({ disenoId, ws }: { disenoId: string; ws: number | null }) {
  const repo = useMemo(() => repositorioDe(ws), [ws]);
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });

  useEffect(() => {
    let vivo = true;
    repo.getDesign(disenoId).then(
      (diseno) => { if (vivo) setCarga(diseno ? { estado: 'listo', diseno } : { estado: 'no-existe' }); },
      (e: unknown) => { if (vivo) setCarga({ estado: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo abrir.' }); },
    );
    return () => { vivo = false; };
  }, [repo, disenoId]);

  const adapter = useMemo<EditorAdapter>(() => {
    const base = createGuestAdapter({
      localId: disenoId,
      repository: repo,
      // En MaKo no hay «crear cuenta»: el editor corre en modo `account` y no lo pide.
      ensureSignedIn: async () => false,
      onMigrated: () => {},
    });
    return {
      ...base,
      services: { ...base.services, ...serviciosCatalogo(), brand: null, stock: null, versions: null, sharing: null, comments: null },
    };
  }, [repo, disenoId]);

  if (carga.estado === 'cargando') return <div className={styles.aviso}>Abriendo…</div>;
  if (carga.estado !== 'listo') {
    return (
      <div className={styles.aviso}>
        <p>{carga.estado === 'no-existe' ? 'Este diseño no está en este navegador.' : carga.mensaje}</p>
        <Link href={RUTA_INICIO} className={styles.volver}>Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className={styles.pantalla}>
      <CreditoDoory />
      <div className={styles.editor}>
        <EditorApp
          document={carga.diseno.document}
          meta={{ id: carga.diseno.id, title: carga.diseno.title, mode: 'account' }}
          adapter={adapter}
          topBarStart={<Link href={RUTA_INICIO} className={styles.inicio}>Inicio</Link>}
        />
      </div>
    </div>
  );
}
