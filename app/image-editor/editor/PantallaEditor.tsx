'use client';

// =============================================================================
// El editor de UN diseño (lo monta el estudio, ./Estudio.tsx, una vez por diseño abierto)
// =============================================================================
// Lee el diseño de la base (/api/image-editor/disenos/<id>, mig 0278), arma el adaptador de MaKo
// (../mako/adaptadorNube.ts: guarda con compare-and-set, sube a «Subidos») y monta el EditorApp de
// Doory en modo `account`. Si el diseño no está en la base pero sí en ESTE navegador (lo creó la
// etapa 1, antes del 14/10), se sube primero (../mako/mudanza.ts) y se abre.
//
// Lo que Doory pide a su backend y MaKo todavía no tiene queda en `null` (Marca, fotos de stock,
// versiones, compartir, comentarios): el editor esconde esas herramientas solo.
//
// Desde el 27/10/2026 NADA de acá navega (Martín: «que no cambie de ruta»): «Inicio» de la barra y «Archivo → Crear un
// diseño nuevo» muestran la vista de crear del estudio en el lugar del editor; «Copiar y redimensionar» y «Guardar una
// copia» abren la copia en el mismo lugar (`estudio.abrir`). La tarjeta de la izquierda es ./TarjetaLateral.tsx (el chat
// de MaKo o tus diseños). El crédito de Doory lo dibuja el estudio, al pie, en cada diseño que se abre.

import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useRouter } from '@/app/_ui/Link';
import { EditorApp, type EditorHandle } from '../_doory/editor';
import { registerCommand } from '../_doory/editor/extensions';
import type { EditorAdapter } from '../_doory/types/adapter';
import type { DoryDocument } from '../_doory/types/document';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { repositorioDe } from '../espacio';
import { crearAdaptadorNube } from '../mako/adaptadorNube';
import { mudarLocales } from '../mako/mudanza';
import { crearDiseno, leerDiseno } from '../mako/nube';
// Los paneles del lado de MaKo (Proyectos…): se registran al cargar el módulo; la pantalla le pasa el workspace.
import { registrarProyectos } from '../mako/registro';
import { RUTA_INICIO, rutaDiseno } from '../ruta';
import { useEstudio } from './estudio';
import { Marco } from './Marco';
import { TarjetaLateral } from './TarjetaLateral';
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

export function PantallaEditor({ disenoId, ws, senales = null, editorRef: refDeAfuera }: {
  disenoId: string;
  ws: number | null;
  /** Lo que se sabe del negocio (lo lee la page): el panel de plantillas pone primero las sugeridas. */
  senales?: SenalesNegocio | null;
  /** El editor montado, para que el estudio guarde antes de cambiar de diseño o de vista. */
  editorRef?: RefObject<EditorHandle | null>;
}) {
  const router = useRouter();
  const estudio = useEstudio();
  const [carga, setCarga] = useState<Carga>({ estado: 'cargando' });
  const refPropio = useRef<EditorHandle>(null);
  const editorRef = refDeAfuera ?? refPropio;
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

  // Abrir otro diseño (una copia, «Proyectos»): en el lugar con el estudio; sin él (fuera del estudio), navegando.
  const irA = useRef<(id: string) => void>(() => {});
  irA.current = (id: string) => (estudio ? estudio.abrir(id) : router.push(rutaDiseno(id)));
  const nuevo = useRef<() => void>(() => {});
  nuevo.current = () => (estudio ? estudio.nuevo() : router.push(RUTA_INICIO));

  // «Archivo → Crear un diseño nuevo» de Canva: el editor no sabe de rutas, así que la cáscara lo registra como comando
  // (TopBar lo muestra si existe). Muestra la vista de crear en el lugar del editor, sin navegar.
  useEffect(
    () => registerCommand({ id: 'file.new', label: 'Crear un diseño nuevo', run: () => nuevo.current() }),
    [],
  );

  const version = useMemo(() => {
    let v = carga.estado === 'listo' ? carga.diseno.version : 1;
    return { get: () => v, set: (n: number) => { v = n; } };
  }, [carga]);

  const adapter = useMemo<EditorAdapter>(() => crearAdaptadorNube({
    id: disenoId,
    version,
    repoLocal: repositorioDe(ws),
    // «Copiar y redimensionar»: la copia es un diseño nuevo del workspace y se abre al toque, en el mismo lugar.
    duplicar: async ({ title, document }) => {
      const r = await crearDiseno({ titulo: title, doc: document });
      if (!r.ok) throw new Error(r.error);
      irA.current(r.id);
    },
    senales,
  }), [disenoId, version, ws, senales]);

  // Otra pestaña guardó este diseño en el medio (409). «Recargar» trae la última; «Guardar una copia»
  // guarda lo de ESTA pestaña como un diseño nuevo y lo abre, sin pisar a nadie.
  async function resolverConflicto(eleccion: 'reload' | 'save-as-copy') {
    if (eleccion === 'reload') { window.location.reload(); return; }
    const doc = editorRef.current?.getDocument();
    if (!doc) return;
    const r = await crearDiseno({ titulo: `${tituloRef.current || 'Diseño sin título'} (copia)`, doc });
    if (r.ok) irA.current(r.id);
  }

  if (carga.estado === 'cargando') {
    return <Marco etiqueta="Abriendo el diseño"><div className={styles.aviso}>Abriendo…</div></Marco>;
  }
  if (carga.estado !== 'listo') {
    return (
      <Marco etiqueta="El diseño no se pudo abrir">
        <div className={styles.aviso}>
          {carga.estado === 'error'
            ? <p role="alert">{carga.mensaje}<ReportarASoporte error={carga.mensaje} /></p>
            : <p>Este diseño no existe o se eliminó.</p>}
          <button type="button" className={styles.volver} onClick={() => nuevo.current()}>Ver mis diseños</button>
        </div>
      </Marco>
    );
  }

  return (
    <div className={styles.editor}>
      <EditorApp
        ref={editorRef}
        document={carga.diseno.doc}
        meta={{ id: carga.diseno.id, title: carga.diseno.titulo, mode: 'account', revision: carga.diseno.version }}
        adapter={adapter}
        onTitleChange={(t) => { tituloRef.current = t; }}
        onConflictResolve={(c) => void resolverConflicto(c)}
        topBarStart={
          // «Inicio» de Canva: la vista de crear (buscar tamaños y diseños, los tipos, «Mis diseños»), en el mismo lugar.
          <button type="button" className={styles.inicio} data-testid="ie-inicio" onClick={() => nuevo.current()}>
            <ChevronLeft size={20} aria-hidden="true" />
            <span>Inicio</span>
          </button>
        }
        // La tarjeta de MaKo siempre abierta a la izquierda, como en el Web Generator (26/10/2026): el chat o tus diseños.
        chatLateral={<TarjetaLateral />}
      />
    </div>
  );
}
