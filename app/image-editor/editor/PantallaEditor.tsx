'use client';

// =============================================================================
// La pantalla del editor de un diseño
// =============================================================================
// Lee el diseño de la base (/api/image-editor/disenos/<id>, mig 0278), arma el adaptador de MaKo
// (../mako/adaptadorNube.ts: guarda con compare-and-set, sube a «Subidos») y monta el EditorApp de
// Doory en modo `account`. Si el diseño no está en la base pero sí en ESTE navegador (lo creó la
// etapa 1, antes del 14/10), se sube primero (../mako/mudanza.ts) y se abre.
//
// Lo que Doory pide a su backend y MaKo todavía no tiene queda en `null` (Marca, fotos de stock,
// versiones, compartir, comentarios): el editor esconde esas herramientas solo.
//
// El armazón es el de Canva (tanda 2): «Inicio» va a la izquierda de la barra superior (el ☰/Inicio
// de Canva, sin su logo) y el crédito de Doory queda como franja fina al pie, visible en cada apertura
// (lo exige su licencia).

import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import Link, { useRouter } from '@/app/_ui/Link';
import { EditorApp, type EditorHandle } from '../_doory/editor';
import { registerCommand } from '../_doory/editor/extensions';
import type { EditorAdapter } from '../_doory/types/adapter';
import type { DoryDocument } from '../_doory/types/document';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { repositorioDe } from '../espacio';
import { crearAdaptadorNube } from '../mako/adaptadorNube';
import { mudarLocales } from '../mako/mudanza';
import { crearDiseno, leerDiseno } from '../mako/nube';
// Los paneles del lado de MaKo (Proyectos…): se registran al cargar el módulo; la pantalla le pasa el workspace.
import { registrarProyectos } from '../mako/registro';
import { RUTA_INICIO, rutaDiseno } from '../ruta';
import { CreditoDoory } from './CreditoDoory';
import styles from './pantalla.module.css';

type Abierto = { id: string; titulo: string; doc: DoryDocument; version: number };
type Carga = { estado: 'cargando' } | { estado: 'listo'; diseno: Abierto } | { estado: 'no-existe' } | { estado: 'error'; mensaje: string };

async function abrir(id: string, ws: number | null): Promise<Carga> {
  let r = await leerDiseno(id);
  // No está en la base: si lo tiene este navegador (etapa 1), se sube y se vuelve a leer.
  if (!r.ok && /no existe/i.test(r.error)) {
    const m = await mudarLocales(ws, id);
    if (m.mudados) r = await leerDiseno(id);
  }
  if (r.ok) return { estado: 'listo', diseno: { id: r.diseno.id, titulo: r.diseno.titulo, doc: r.diseno.doc as DoryDocument, version: r.diseno.version } };
  return /no existe/i.test(r.error) ? { estado: 'no-existe' } : { estado: 'error', mensaje: r.error };
}

export function PantallaEditor({ disenoId, ws, senales = null }: {
  disenoId: string;
  ws: number | null;
  /** Lo que se sabe del negocio (lo lee la page): el panel de plantillas pone primero las sugeridas. */
  senales?: SenalesNegocio | null;
}) {
  const router = useRouter();
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const editorRef = useRef<EditorHandle>(null);
  const tituloRef = useRef('');

  useEffect(() => {
    let vivo = true;
    void abrir(disenoId, ws).then((c) => {
      if (!vivo) return;
      if (c.estado === 'listo') tituloRef.current = c.diseno.titulo;
      setCarga(c);
    });
    return () => { vivo = false; };
  }, [disenoId, ws]);

  // «Proyectos» lista los diseños del workspace de la pestaña.
  useEffect(() => registrarProyectos(ws), [ws]);

  // «Archivo → Crear un diseño nuevo» de Canva: el editor no sabe de rutas, así que la cáscara lo registra
  // como comando (TopBar lo muestra si existe). Va al inicio, donde se elige el tamaño; el `?ws=` lo pone el router.
  useEffect(
    () => registerCommand({ id: 'file.new', label: 'Crear un diseño nuevo', run: () => router.push(RUTA_INICIO) }),
    [router],
  );

  const version = useMemo(() => {
    let v = carga.estado === 'listo' ? carga.diseno.version : 1;
    return { get: () => v, set: (n: number) => { v = n; } };
  }, [carga]);

  const adapter = useMemo<EditorAdapter>(() => crearAdaptadorNube({
    id: disenoId,
    version,
    repoLocal: repositorioDe(ws),
    // «Copiar y redimensionar»: la copia es un diseño nuevo del workspace y se abre al toque.
    duplicar: async ({ title, document }) => {
      const r = await crearDiseno({ titulo: title, doc: document });
      if (!r.ok) throw new Error(r.error);
      router.push(rutaDiseno(r.id));
    },
    senales,
  }), [disenoId, version, ws, router, senales]);

  // Otra pestaña guardó este diseño en el medio (409). «Recargar» trae la última; «Guardar una copia»
  // guarda lo de ESTA pestaña como un diseño nuevo y lo abre, sin pisar a nadie.
  async function resolverConflicto(eleccion: 'reload' | 'save-as-copy') {
    if (eleccion === 'reload') { window.location.reload(); return; }
    const doc = editorRef.current?.getDocument();
    if (!doc) return;
    const r = await crearDiseno({ titulo: `${tituloRef.current || 'Diseño sin título'} (copia)`, doc });
    if (r.ok) window.location.href = rutaDiseno(r.id);
  }

  if (carga.estado === 'cargando') return <div className={styles.aviso}>Abriendo…</div>;
  if (carga.estado !== 'listo') {
    return (
      <div className={styles.aviso}>
        <p>{carga.estado === 'no-existe' ? 'Este diseño no existe o se eliminó.' : carga.mensaje}</p>
        <Link href={RUTA_INICIO} className={styles.volver}>Volver al inicio</Link>
      </div>
    );
  }

  return (
    <div className={styles.pantalla}>
      <div className={styles.editor}>
        <EditorApp
          ref={editorRef}
          document={carga.diseno.doc}
          meta={{ id: carga.diseno.id, title: carga.diseno.titulo, mode: 'account', revision: carga.diseno.version }}
          adapter={adapter}
          onTitleChange={(t) => { tituloRef.current = t; }}
          onConflictResolve={(c) => void resolverConflicto(c)}
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
