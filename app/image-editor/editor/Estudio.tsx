'use client';

// =============================================================================
// El estudio del Image Editor: UNA pantalla para todos tus diseños, sin cambiar de ruta (27/10/2026)
// =============================================================================
// Pedido de Martín, textual: «veas de adaptar las tabs de video e imagen con el chat que tenemos de MaKo, para que se pueda
// editar con prompting, algo similar a lo que hicimos con Web Generator, que este al costado, que los "proyectos" se vean
// en la barra del costado, y que no cambie de ruta... Tambien ponle los colores de MaKo a esas tabs».
// Copiado del Web Generator (app/web-generator/editor/EditorLanding.tsx: `panelIzq`, `nueva`/`creando`), con una diferencia
// que pidió él: abrir OTRO diseño tampoco navega.
//
// Qué hace:
//   · `/image-editor/<id>` abre ese diseño; `/image-editor` sola abre el ÚLTIMO editado, o la vista de crear si no hay
//     ninguno (antes era una página de inicio aparte: ../inicio/Inicio.tsx ahora es esa vista, con TODO lo que tenía);
//   · abrir otro diseño (la lista de la tarjeta, «Proyectos» del riel, una copia) guarda el actual, monta el otro EN EL
//     MISMO LUGAR y escribe la URL con `history.replaceState` (../ruta.ts → `marcarEnUrl`, con el `?ws=`): un F5 lo reabre;
//   · «Nuevo diseño» (y «Inicio» de la barra) muestra la vista de crear EN LUGAR del editor, que queda montado debajo
//     (oculto, `inert` y guardado): volver es instantáneo y con el deshacer intacto. Elegir un tamaño crea el diseño y lo
//     abre acá mismo.
//
// ⚠️ Cambiar de diseño REMONTA el editor (`key` = id), no usa el «otro documento bajo el mismo editor» de EditorApp
// (`firstId` → `loadDocument`): ese camino deja el adaptador nuevo con un guardado del documento viejo todavía en vuelo (el
// guardado lee `engine.adapter` DESPUÉS de sus `await`), y pisaría el diseño B con lo de A. Remontado, el guardado en vuelo
// termina con el adaptador de A.
// ⚠️ El crédito de Doory va con `key` = el diseño: cerrarlo dura lo que dura ESE diseño; al abrir otro vuelve (lo exige su
// licencia: «each time … is launched», editor/CreditoDoory.tsx).
// =============================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { EditorHandle } from '../_doory/types/adapter';
import type { SenalesNegocio } from '@/lib/plantillas-sugeridas';
import { Inicio } from '../inicio/Inicio';
import { mudarLocales } from '../mako/mudanza';
import { listarDisenos } from '../mako/nube';
import { marcarEnUrl } from '../ruta';
import { CreditoDoory } from './CreditoDoory';
import { EstudioContexto, type AmbitoCrear, type Estudio as EstadoEstudio, type VistaTarjeta } from './estudio';
import { disenoAlEntrar } from './estudio-reglas';
import { Marco } from './Marco';
import { PantallaEditor } from './PantallaEditor';
import styles from './estudio.module.css';

export function Estudio({ disenoId = null, ws, senales = null }: {
  /** El diseño de la URL (`/image-editor/<id>`); sin él, se abre el último o la vista de crear. */
  disenoId?: string | null;
  ws: number | null;
  senales?: SenalesNegocio | null;
}) {
  const [abierto, setAbierto] = useState<string | null>(disenoId);
  // Sin diseño en la URL, primero se averigua cuál abrir (`buscando`); mientras, la tarjeta y «Abriendo…».
  const [buscando, setBuscando] = useState(!disenoId);
  const [creando, setCreando] = useState(false);
  const [ambito, setAmbito] = useState<{ ambito: AmbitoCrear; n: number }>({ ambito: 'todo', n: 0 });
  const [tarjeta, setTarjeta] = useState<VistaTarjeta>('chat');
  const [version, setVersion] = useState(0);
  const editorRef = useRef<EditorHandle | null>(null);

  // Lo pendiente del diseño abierto se guarda ANTES de irse (el mismo gesto que «Nueva landing» del Web Generator). Sólo si
  // hay algo: `saveNow` guarda SIEMPRE (es el Ctrl+S), y cada cambio de diseño sería un guardado y una miniatura de más.
  const guardarActual = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor?.isDirty()) return;
    try {
      await editor.saveNow();
    } catch {
      /* si no se pudo, el aviso de «sin guardar» del editor queda; el diseño sigue en la base como estaba */
    }
  }, []);

  const abrir = useCallback((id: string) => {
    if (id === abierto) {
      setCreando(false);
      setTarjeta('chat');
      return;
    }
    // Todo junto DESPUÉS de guardar: la vista de crear no se cierra mostrando un instante el diseño de antes.
    void guardarActual().then(() => {
      setAbierto(id);
      setCreando(false);
      setTarjeta('chat');
      setVersion((v) => v + 1);
      marcarEnUrl(id);
    });
  }, [abierto, guardarActual]);

  const nuevo = useCallback((a: AmbitoCrear = 'todo') => {
    void guardarActual();
    setAmbito((x) => ({ ambito: a, n: x.n + 1 }));
    setTarjeta('disenos');
    setCreando(true);
  }, [guardarActual]);

  const verChat = useCallback(() => {
    if (!abierto) return;
    setCreando(false);
    setTarjeta('chat');
  }, [abierto]);

  const verDisenos = useCallback(() => setTarjeta('disenos'), []);

  // Un link de AFUERA a otro diseño (el Ops Center, un chat: `/image-editor/<otro>`) re-renderiza esta misma página con
  // otro id, y React conserva el estudio: sin esto se quedaba en el de antes. Se abre como cualquier otro, guardando primero.
  const deLaUrl = useRef(disenoId);
  useEffect(() => {
    if (!disenoId || disenoId === deLaUrl.current) return;
    deLaUrl.current = disenoId;
    // El mismo que ya está abierto (la URL que escribimos nosotros, releída): nada que hacer.
    if (disenoId !== abierto) abrir(disenoId);
  }, [disenoId, abierto, abrir]);

  // `/image-editor` sola: lo que quedó en el navegador (etapa 1) sube primero; después, el último editado o crear.
  useEffect(() => {
    if (!buscando) return;
    let vivo = true;
    void mudarLocales(ws).catch(() => undefined).then(() => listarDisenos()).then((r) => {
      if (!vivo) return;
      const id = r.ok ? disenoAlEntrar(r.disenos) : null;
      if (id) {
        setAbierto(id);
        marcarEnUrl(id);
      } else {
        // Sin diseños (o sin poder leerlos: la vista de crear lo dice con su error), se elige qué crear.
        setCreando(true);
        setTarjeta('disenos');
      }
      setBuscando(false);
    });
    return () => { vivo = false; };
  }, [buscando, ws]);

  const estudio = useMemo<EstadoEstudio>(
    () => ({ abierto, creando, tarjeta, version, abrir, nuevo, verChat, verDisenos }),
    [abierto, creando, tarjeta, version, abrir, nuevo, verChat, verDisenos],
  );

  // La vista de crear: la del inicio de siempre (../inicio/Inicio.tsx), con abrir y crear EN EL LUGAR.
  const vistaCrear = (
    <div className={styles.crear}>
      {abierto ? (
        <button type="button" className={styles.cerrar} onClick={verChat} title="Volver al diseño" aria-label="Volver al diseño">
          <X size={20} aria-hidden />
        </button>
      ) : null}
      <Inicio
        key={ambito.n}
        ws={ws}
        ambitoInicial={ambito.ambito}
        abierto={abierto}
        onAbrir={abrir}
        onCreado={abrir}
        onBorrado={(id) => {
          setVersion((v) => v + 1);
          if (id !== abierto) return;
          // Se eliminó el que estaba abierto: se desmonta y la URL vuelve a la de la tab.
          setAbierto(null);
          marcarEnUrl(null);
        }}
      />
    </div>
  );

  return (
    <EstudioContexto.Provider value={estudio}>
      <div className={styles.pantalla}>
        <div className={styles.area}>
          {abierto ? (
            // El editor queda MONTADO mientras se elige qué crear: oculto e `inert` (sin foco ni atajos), no desmontado.
            <div className={styles.capa} inert={creando} aria-hidden={creando || undefined} style={creando ? { visibility: 'hidden' } : undefined}>
              <PantallaEditor key={abierto} disenoId={abierto} ws={ws} senales={senales} editorRef={editorRef} />
            </div>
          ) : null}
          {buscando ? (
            <div className={styles.encima}>
              <Marco etiqueta="Abriendo">
                <div className={styles.aviso}>Abriendo…</div>
              </Marco>
            </div>
          ) : creando || !abierto ? (
            <div className={styles.encima} data-testid="ie-vista-crear">
              <Marco etiqueta="Nuevo diseño">{vistaCrear}</Marco>
            </div>
          ) : null}
        </div>
        <CreditoDoory key={abierto ?? 'sin-diseno'} />
      </div>
    </EstudioContexto.Provider>
  );
}
