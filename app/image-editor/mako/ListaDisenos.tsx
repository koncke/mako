'use client';

// =============================================================================
// ListaDisenos — tus diseños en la tarjeta de la izquierda del Image Editor (la otra vista del chat de MaKo)
// =============================================================================
// Pedido de Martín (27/10/2026), textual: «que los "proyectos" se vean en la barra del costado, y que no cambie de
// ruta». Copiada de la lista de landings del Web Generator (app/web-generator/editor/paneles/PanelLandings.tsx, a su vez
// la tarjeta de Automations): arriba el buscador y la estrella de MaKo que vuelve al chat; «Nuevo diseño» como primer
// renglón; los diseños; y al pie «Ver todo».
//
// Lo distinto del Web Generator: NADA navega. Un renglón abre ese diseño en el MISMO lugar (`estudio.abrir`: guarda el
// actual, monta el otro y escribe la URL con `replaceState`); «Nuevo diseño» cambia el editor por la vista de crear sin
// tocar esta lista; «Ver todo» abre esa vista en «Mis diseños» (la cuadrícula o la lista, con buscar y eliminar). Tocar
// el diseño abierto, o la estrella, vuelve al chat.
//
// No usa el estado del editor (`useEditor`): también se dibuja cuando no hay ningún diseño montado (la vista de crear).
// =============================================================================

import { useEffect, useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { Muneco } from '@/app/admin/operaciones/Muneco';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import type { ResumenDiseno } from '@/lib/image-editor/tipos';
import { useEstudio } from '../editor/estudio';
import { disenosDeLaLista } from '../editor/estudio-reglas';
import { listarDisenos } from './nube';
import styles from './lista.module.css';

/** La miniatura guardada o la hoja en blanco con la proporción del diseño. */
function Mini({ d }: { d: ResumenDiseno }) {
  if (d.miniatura) return <img src={d.miniatura} alt="" draggable={false} loading="lazy" />;
  const escala = 22 / Math.max(1, d.ancho, d.alto);
  return <span className={styles.hoja} style={{ width: Math.max(4, Math.round(d.ancho * escala)), height: Math.max(4, Math.round(d.alto * escala)) }} />;
}

export function ListaDisenos() {
  const estudio = useEstudio();
  const [disenos, setDisenos] = useState<ResumenDiseno[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const version = estudio?.version ?? 0;

  const cargar = async (vivo: () => boolean = () => true) => {
    setError(null);
    const r = await listarDisenos();
    if (!vivo()) return;
    // «No pude leerlos» no es «no tienes diseños»: se dice y se ofrece reintentar.
    if (!r.ok) { setError(r.error); return; }
    setDisenos(r.disenos);
  };
  useEffect(() => {
    let vivo = true;
    void cargar(() => vivo);
    return () => { vivo = false; };
  }, [version]);

  const visibles = useMemo(() => disenosDeLaLista(disenos ?? [], busca), [disenos, busca]);
  if (!estudio) return null;
  const { abierto, creando } = estudio;

  return (
    <div className={styles.lista} data-testid="ie-lista-disenos">
      <div className={styles.cab}>
        <input className={styles.busca} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar" aria-label="Buscar un diseño" />
        {abierto ? (
          <button type="button" className={styles.mako} onClick={estudio.verChat} title="Volver al chat con MaKo" aria-label="Volver al chat con MaKo">
            <Muneco titulo="MaKo" aspecto={ASPECTO_MAKO} animo="despierto" size={26} />
          </button>
        ) : null}
      </div>
      <nav className={styles.items} aria-label="Tus diseños">
        <button type="button" className={`${styles.item} ${styles.nuevo}`} aria-current={creando ? 'true' : undefined} onClick={() => estudio.nuevo()}>
          <span className={styles.icono}><Plus size={14} aria-hidden /></span><span className={styles.nombre}>Nuevo diseño</span>
        </button>
        {error ? (
          <p className={styles.aviso} role="alert">
            No pude leer tus diseños. <button type="button" className={styles.reintentar} onClick={() => { void cargar(); }}>Reintentar</button>
            <ReportarASoporte error={error} />
          </p>
        ) : disenos === null ? (
          <p className={styles.aviso}>Cargando…</p>
        ) : visibles.length === 0 ? (
          <p className={styles.aviso}>{busca.trim() ? 'Ninguno se llama así.' : 'Todavía no hay diseños.'}</p>
        ) : visibles.map((d) => {
          const actual = !creando && d.id === abierto;
          const titulo = d.titulo || 'Diseño sin título';
          return (
            <button key={d.id} type="button" className={styles.item} aria-current={actual ? 'true' : undefined} title={titulo}
              data-testid="ie-lista-diseno" onClick={() => (actual ? estudio.verChat() : estudio.abrir(d.id))}>
              <span className={styles.mini}><Mini d={d} /></span><span className={styles.nombre}>{titulo}</span>
            </button>
          );
        })}
      </nav>
      <div className={styles.pie}>
        <button type="button" className={styles.verTodo} onClick={() => estudio.nuevo('disenos')}>Ver todo</button>
      </div>
    </div>
  );
}
