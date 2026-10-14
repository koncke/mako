'use client';

// =============================================================================
// El diálogo «Crear un diseño» del Inicio (el de Canva)
// =============================================================================
// Como el de Canva (relevamiento-canva-armazon.md §8): el título grande a la
// izquierda con la lista de categorías (ícono en un cuadradito de color) y, abajo,
// «Tamaño personalizado»; a la derecha un buscador y las tarjetas de la categoría.
// El ítem elegido lleva el fondo #F3ECFF y el texto #5100A8 medidos en su captura.
//
// «Tamaño personalizado» es el de Canva: «Unidades» (px, in, mm, cm), ancho y alto
// de 40 a 8000 px (en la unidad elegida, el mismo rango convertido) y «Crear un
// nuevo diseño». Los campos fuera de rango se pintan en rojo y el botón no crea.
//
// Se monta con un portal en <body> envuelto en `.cv` (los tokens del editor viven
// en esa clase) y toma su z-index de la pila de modales de la casa
// (app/_components/pila-modales.ts): adentro de la raíz del editor, el `isolation`
// de `.cv` lo dejaba debajo de la barra lateral de MaKo.

import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Proportions, Search } from 'lucide-react';
import { BotonCerrar } from '@/app/_ui/BotonBorrar';
import { useCapaModal } from '@/app/_components/pila-modales';
import { TarjetaTamano } from './TarjetaTamano';
import {
  LADO_MAX_PX, LADO_MIN_PX, TIPO, TIPOS, UNIDADES,
  aPx, buscarTamanos, dePx, escribirNumero, leerNumero, medidaEscrita, medidasDe, nuevoDe, rangoEn, tamanosDe, unidadDoc,
  type NuevoDiseno, type Tipo, type Unidad,
} from './tamanos';
import styles from './crear.module.css';

export type VistaCrear = Tipo | 'personalizado';

const ENFOCABLES = 'a[href], button:not(:disabled), input:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function CrearDiseno({ inicial = 'social', creando, onCrear, onCerrar }: {
  inicial?: VistaCrear;
  creando: boolean;
  onCrear: (nuevo: NuevoDiseno) => void;
  onCerrar: () => void;
}) {
  const capa = useCapaModal(true);
  const { esElDeArriba } = capa;
  const [vista, setVista] = useState<VistaCrear>(inicial);
  const [busqueda, setBusqueda] = useState('');
  const dialogo = useRef<HTMLDivElement>(null);
  const buscador = useRef<HTMLInputElement>(null);
  const idTitulo = useId();

  // El foco entra al buscador y, al cerrar, vuelve a lo que abrió el diálogo.
  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    buscador.current?.focus();
    return () => previo?.focus?.();
  }, []);

  // Escape cierra sólo si no hay otro modal encima (se pregunta en el momento de la tecla).
  useEffect(() => {
    const alTeclear = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented || !esElDeArriba()) return;
      e.preventDefault();
      onCerrar();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [esElDeArriba, onCerrar]);

  // Tab no se escapa del diálogo.
  function atraparTab(e: KeyboardEvent) {
    if (e.key !== 'Tab') return;
    const nodos = [...(dialogo.current?.querySelectorAll<HTMLElement>(ENFOCABLES) ?? [])].filter((n) => n.offsetParent !== null);
    const primero = nodos[0];
    const ultimo = nodos[nodos.length - 1];
    if (!primero || !ultimo) return;
    if (e.shiftKey && document.activeElement === primero) { e.preventDefault(); ultimo.focus(); }
    else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primero.focus(); }
  }

  const buscando = busqueda.trim() !== '';
  const resultados = useMemo(() => (buscando ? buscarTamanos(busqueda) : null), [buscando, busqueda]);
  const escrita = buscando ? medidaEscrita(busqueda) : null;
  const elegir = (v: VistaCrear) => { setVista(v); setBusqueda(''); };

  const tarjetas = resultados ?? (vista === 'personalizado' ? [] : tamanosDe(vista));
  const titulo = buscando ? 'Resultados' : vista === 'personalizado' ? 'Tamaño personalizado' : TIPO[vista].categoria;

  return createPortal(
    <div
      className={`cv ${styles.velo}`}
      style={{ zIndex: capa.z, display: capa.visible ? undefined : 'none' }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
    >
      <div ref={dialogo} role="dialog" aria-modal="true" aria-labelledby={idTitulo} className={styles.dialogo} onKeyDown={atraparTab}>
        <aside className={styles.lado}>
          <h2 id={idTitulo} className={styles.titulo}>Crear un diseño</h2>
          <nav className={styles.categorias} aria-label="Categorías">
            {TIPOS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={styles.categoria}
                aria-current={!buscando && vista === t.id ? 'true' : undefined}
                onClick={() => elegir(t.id)}
              >
                <span className={styles.icono} style={{ background: t.color }}>
                  <t.Icono size={16} strokeWidth={2.25} aria-hidden />
                </span>
                <span className={styles.texto}>{t.categoria}</span>
              </button>
            ))}
          </nav>
          <div className={styles.pie}>
            <button
              type="button"
              className={styles.categoria}
              aria-current={!buscando && vista === 'personalizado' ? 'true' : undefined}
              onClick={() => elegir('personalizado')}
            >
              <span className={`${styles.icono} ${styles.iconoGris}`}>
                <Proportions size={16} strokeWidth={2.25} aria-hidden />
              </span>
              <span className={styles.texto}>Tamaño personalizado</span>
            </button>
          </div>
        </aside>

        <section className={styles.contenido}>
          <div className={styles.barra}>
            <label className={styles.buscar}>
              <Search size={18} aria-hidden />
              <input
                ref={buscador}
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Busca un tamaño"
                aria-label="Busca un tamaño"
                autoComplete="off"
                spellCheck={false}
              />
            </label>
            <BotonCerrar onClick={onCerrar} />
          </div>

          <div className={styles.cuerpo} ref={capa.refScroll}>
            <h3 className={styles.subtitulo}>{titulo}</h3>
            {!buscando && vista === 'personalizado' ? (
              <Personalizado creando={creando} onCrear={onCrear} />
            ) : (
              <>
                <div className={styles.grilla}>
                  {escrita && (
                    <TarjetaTamano
                      nombre="Tamaño personalizado"
                      medidas={medidasDe(escrita)}
                      ancho={escrita.ancho}
                      alto={escrita.alto}
                      disabled={creando}
                      onClick={() => onCrear({ ...escrita, unidad: 'px' })}
                    />
                  )}
                  {tarjetas.map((t) => (
                    <TarjetaTamano
                      key={t.id}
                      nombre={t.nombre}
                      medidas={medidasDe(t)}
                      ancho={t.ancho}
                      alto={t.alto}
                      disabled={creando}
                      onClick={() => onCrear(nuevoDe(t))}
                    />
                  ))}
                </div>
                {tarjetas.length === 0 && !escrita && <p className={styles.vacio}>Sin resultados.</p>}
              </>
            )}
          </div>
        </section>
      </div>
    </div>,
    document.body,
  );
}

/** Deja escribir números con coma o punto decimal, nada más. */
const limpiar = (v: string) => v.replace(/[^\d.,]/g, '');

function Personalizado({ creando, onCrear }: { creando: boolean; onCrear: (nuevo: NuevoDiseno) => void }) {
  const [unidad, setUnidad] = useState<Unidad>('px');
  const [ancho, setAncho] = useState('1080');
  const [alto, setAlto] = useState('1080');
  const idUnidades = useId();
  const rango = rangoEn(unidad);
  const enRango = (texto: string) => {
    const n = leerNumero(texto);
    return n !== null && n >= rango.min && n <= rango.max;
  };
  const okAncho = enRango(ancho);
  const okAlto = enRango(alto);

  // Como en Canva: cambiar la unidad convierte lo escrito (la medida no cambia).
  function cambiarUnidad(u: Unidad) {
    if (u === unidad) return;
    const convertir = (texto: string) => {
      const n = leerNumero(texto);
      return n === null ? texto : escribirNumero(dePx(aPx(n, unidad), u), u);
    };
    setAncho(convertir(ancho));
    setAlto(convertir(alto));
    setUnidad(u);
  }

  function crear(e: FormEvent) {
    e.preventDefault();
    const w = leerNumero(ancho);
    const h = leerNumero(alto);
    if (!okAncho || !okAlto || w === null || h === null || creando) return;
    const px = (n: number) => Math.min(LADO_MAX_PX, Math.max(LADO_MIN_PX, Math.round(aPx(n, unidad))));
    onCrear({ ancho: px(w), alto: px(h), unidad: unidadDoc(unidad) });
  }

  return (
    <form className={styles.personalizado} onSubmit={crear} noValidate>
      <div className={styles.campo}>
        <span className={styles.rotulo} id={idUnidades}>Unidades</span>
        <div className={styles.unidades} role="radiogroup" aria-labelledby={idUnidades}>
          {UNIDADES.map((u) => (
            <button key={u} type="button" role="radio" aria-checked={u === unidad} className={styles.unidad} onClick={() => cambiarUnidad(u)}>
              {u}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.medidas}>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Ancho</span>
          <input className={styles.entrada} inputMode="decimal" value={ancho} aria-invalid={!okAncho} onChange={(e) => setAncho(limpiar(e.target.value))} />
        </label>
        <label className={styles.campo}>
          <span className={styles.rotulo}>Alto</span>
          <input className={styles.entrada} inputMode="decimal" value={alto} aria-invalid={!okAlto} onChange={(e) => setAlto(limpiar(e.target.value))} />
        </label>
      </div>
      <p className={styles.pista} data-error={okAncho && okAlto ? undefined : 'true'}>
        De {escribirNumero(rango.min, unidad)} a {escribirNumero(rango.max, unidad)} {unidad}
      </p>
      <button type="submit" className={styles.primario} disabled={!okAncho || !okAlto || creando}>
        Crear un nuevo diseño
      </button>
    </form>
  );
}
