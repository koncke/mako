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
//
// El armazón es el de Canva (tanda 2): «Inicio» va a la izquierda de la barra
// superior (el ☰/Inicio de Canva, sin su logo) y el crédito de Doory queda como
// franja fina al pie, visible en cada apertura (lo exige su licencia).

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link, { useRouter } from '@/app/_ui/Link';
import { EditorApp } from '../_doory/editor';
import { registerCommand } from '../_doory/editor/extensions';
import { createGuestAdapter } from '../_doory/features/editor/adapters/guestAdapter';
import type { EditorAdapter } from '../_doory/types/adapter';
import type { LocalDesign } from '../_doory/lib/local/types';
import { repositorioDe } from '../espacio';
import { serviciosCatalogo } from '../mako/servicios';
// Los paneles del lado de MaKo (Proyectos…): se registran al cargar el módulo; la pantalla le pasa el workspace.
import { registrarProyectos } from '../mako/registro';
import { RUTA_INICIO, rutaDiseno } from '../ruta';
import { CreditoDoory } from './CreditoDoory';
import styles from './pantalla.module.css';

type Carga = { estado: 'cargando' } | { estado: 'listo'; diseno: LocalDesign } | { estado: 'no-existe' } | { estado: 'error'; mensaje: string };

export function PantallaEditor({ disenoId, ws }: { disenoId: string; ws: number | null }) {
  const repo = useMemo(() => repositorioDe(ws), [ws]);
  const router = useRouter();
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });

  useEffect(() => {
    let vivo = true;
    repo.getDesign(disenoId).then(
      (diseno) => { if (vivo) setCarga(diseno ? { estado: 'listo', diseno } : { estado: 'no-existe' }); },
      (e: unknown) => { if (vivo) setCarga({ estado: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo abrir.' }); },
    );
    return () => { vivo = false; };
  }, [repo, disenoId]);

  // «Proyectos» lee la base de ESTE workspace (el del server). Sin esto, la busca por el diseño abierto.
  useEffect(() => registrarProyectos(ws), [ws]);

  // «Archivo → Crear un diseño nuevo» de Canva: el editor no sabe de rutas, así que la cáscara lo registra
  // como comando (TopBar lo muestra si existe). Va al inicio, donde se elige el tamaño; el `?ws=` lo pone el router.
  useEffect(
    () => registerCommand({ id: 'file.new', label: 'Crear un diseño nuevo', run: () => router.push(RUTA_INICIO) }),
    [router],
  );

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
      // «Copiar y redimensionar»: la copia es un diseño nuevo en la MISMA base del workspace (así sus imágenes
      // `idb://` siguen resolviendo) y se abre al toque.
      duplicateDesign: async ({ title, document }) => {
        const copia = await repo.createDesign({ title, document });
        router.push(rutaDiseno(copia.id));
      },
    };
  }, [repo, disenoId, router]);

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
      <div className={styles.editor}>
        <EditorApp
          document={carga.diseno.document}
          meta={{ id: carga.diseno.id, title: carga.diseno.title, mode: 'account' }}
          adapter={adapter}
          topBarStart={
            <Link href={RUTA_INICIO} className={styles.inicio} data-testid="ie-inicio">
              <ChevronLeft size={20} aria-hidden="true" />
              <span>Inicio</span>
            </Link>
          }
        />
      </div>
      <CreditoDoory />
    </div>
  );
}
