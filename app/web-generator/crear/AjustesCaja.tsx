'use client';

// =============================================================================
// crear/AjustesCaja — CÓMO se genera, en el cuadro «¿Qué vas a crear hoy?»: el desplegable «Plan» y «Más ajustes»
// =============================================================================
// Tanda 7 (Martín, 15/10/2026), textual: «Y aprovecha el diseño que ya tenemos para meter las opciones... Por ejemplo la
// de "Personalizar", podría ir por defecto en el botón de + o en el desplegable de "plan", ya decide tú con criterio
// dónde iría... […] Todas las opciones como "Español México, la cantidad de secciones, el CTA de Agendar reunión u otros,
// etc... Deben ir dentro de + o en algún desplegable así...»
//
// Decidido (el porqué en ./ajustes.ts): la píldora «Plan» de la fila de abajo abre CÓMO se genera:
//   · arriba, Plan o Express (un radiogroup, con flechas);
//   · debajo, compactos, lo que más se toca: la cantidad de secciones (o diapositivas), el objetivo (el CTA:
//     «Agendar una reunión»…) y el idioma;
//   · «Más ajustes»: un panel PEGADO al cuadro (`PanelMasAjustes`, debajo de él, nunca otra pantalla) con lo que era
//     «Personalizar»: el largo del texto por sección, a quién le escribe, el tono, las imágenes, la landing de base
//     («Sobre cuál») y las instrucciones adicionales.
//
// ⚠️ EL DESPLEGABLE NO ES UN `MenuFlotante`: adentro hay otros desplegables (el objetivo, el idioma) que se abren en SU
//    portal, y un `MenuFlotante` se cierra con cualquier clic afuera de él — también con el de la opción del desplegable
//    de adentro. Es una capa propia (role="dialog", no modal) que ignora los clics en los menús (`[role="menu"]`) y
//    se registra en la pila como anidada: Escape cierra sólo lo de arriba (`esElDeArriba`, AGENTS.md, pila de modales).
// ⚠️ «Más ajustes» va AFUERA del <form> de la caja: un Enter en «Tono» mandaría el pedido.
// =============================================================================

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import type { ParamsGeneracion } from '@/lib/editor-landing/api-tipos';
import { MAX_INSTRUCCIONES, MAX_SECCIONES, MIN_SECCIONES } from '@/lib/editor-landing/ia-reglas';
import { useCapaModal } from '@/app/_components/pila-modales';
import { Desplegable, Ico, type OpcionDesplegable } from '../MiniaturaLanding';
import { hostDe } from '../panel-reglas';
import { cuantas, termino, type TipoCrear } from './tipo';
import { FUENTES, IDIOMAS, OBJETIVOS, OPCIONES_COMO, TEXTOS, type ModoGen } from './ajustes';

type SetParam = <K extends keyof ParamsGeneracion>(k: K, v: ParamsGeneracion[K]) => void;

/** La píldora «Plan» / «Express» de la fila de abajo del cuadro, y su desplegable. */
export function BotonComo({ modo, onModo, params, set, tipo, cantidadApagada, onMasAjustes }: {
  modo: ModoGen;
  onModo: (m: ModoGen) => void;
  params: ParamsGeneracion;
  set: SetParam;
  tipo: TipoCrear;
  /** «Tal cual» con un texto: las secciones las marca el texto, no la cantidad. */
  cantidadApagada?: boolean;
  onMasAjustes: () => void;
}) {
  const [ancla, setAncla] = useState<HTMLButtonElement | null>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const cerrar = useCallback((volver = true) => { setAncla(null); if (volver) boton.current?.focus(); }, []);
  const actual = OPCIONES_COMO.find((o) => o.valor === modo) ?? OPCIONES_COMO[0];
  return (
    <>
      <button
        ref={boton}
        type="button"
        className="gp-pildora gp-cc-como"
        aria-label={`Cómo se genera: ${actual.texto}`}
        aria-haspopup="dialog"
        aria-expanded={!!ancla}
        onClick={(e) => setAncla(ancla ? null : e.currentTarget)}
      >
        <Ico n={actual.icono} />
        <span className="gp-pildora-texto">{actual.texto}</span>
        <Ico n="chevron-abajo" t={12} />
      </button>
      {ancla && (
        <CapaComo
          ancla={ancla}
          onCerrar={cerrar}
          modo={modo}
          onModo={onModo}
          params={params}
          set={set}
          tipo={tipo}
          cantidadApagada={cantidadApagada}
          onMasAjustes={() => { cerrar(false); onMasAjustes(); }}
        />
      )}
    </>
  );
}

const ANCHO_CAPA = 330;

function CapaComo({ ancla, onCerrar, modo, onModo, params, set, tipo, cantidadApagada, onMasAjustes }: {
  ancla: HTMLElement;
  onCerrar: (volver?: boolean) => void;
  modo: ModoGen;
  onModo: (m: ModoGen) => void;
  params: ParamsGeneracion;
  set: SetParam;
  tipo: TipoCrear;
  cantidadApagada?: boolean;
  onMasAjustes: () => void;
}) {
  const { z, esElDeArriba } = useCapaModal(true, { anidada: true });
  const ref = useRef<HTMLDivElement>(null);
  const radios = useRef<(HTMLButtonElement | null)[]>([]);
  const [pos, setPos] = useState<{ top: number; left: number; ancho: number } | null>(null);
  const cerrarRef = useRef(onCerrar);
  useLayoutEffect(() => { cerrarRef.current = onCerrar; });

  // Debajo de la píldora; si abajo no entra y arriba sí, arriba (como MenuFlotante).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const r = ancla.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const ancho = Math.min(ANCHO_CAPA, vw - 16);
    const left = Math.max(8, Math.min(r.left, vw - ancho - 8));
    const alto = el.offsetHeight;
    let top = r.bottom + 6;
    if (top + alto > vh - 8 && r.top - 6 - alto > 8) top = r.top - 6 - alto;
    setPos({ top: Math.max(8, top), left, ancho });
  }, [ancla]);

  // El foco entra a la opción elegida (Plan o Express): con las flechas se cambia, con Tab se sigue.
  useEffect(() => {
    if (!pos) return;
    radios.current[OPCIONES_COMO.findIndex((o) => o.valor === modo)]?.focus();
    // Sólo al abrir: después el foco es de la persona.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!pos]);

  useEffect(() => {
    // Un clic afuera cierra; en un menú de un desplegable de adentro (otro portal) NO: es elegir una opción.
    const fuera = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || ref.current?.contains(t) || ancla.contains(t) || t.closest?.('[role="menu"]')) return;
      cerrarRef.current(false);
    };
    const tecla = (e: globalThis.KeyboardEvent) => {
      if (e.key !== 'Escape' || !esElDeArriba()) return;
      e.stopImmediatePropagation();
      cerrarRef.current(true);
    };
    const mover = (e: Event) => { if (!(e.target instanceof Node && ref.current?.contains(e.target))) cerrarRef.current(false); };
    const achicar = () => cerrarRef.current(false);
    document.addEventListener('mousedown', fuera, true);
    document.addEventListener('keydown', tecla, true);
    window.addEventListener('resize', achicar);
    window.addEventListener('scroll', mover, true);
    return () => {
      document.removeEventListener('mousedown', fuera, true);
      document.removeEventListener('keydown', tecla, true);
      window.removeEventListener('resize', achicar);
      window.removeEventListener('scroll', mover, true);
    };
  }, [ancla, esElDeArriba]);

  const flechas = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const d = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const j = (i + d + OPCIONES_COMO.length) % OPCIONES_COMO.length;
    onModo(OPCIONES_COMO[j].valor);
    radios.current[j]?.focus();
  };

  const plural = termino(tipo, { plural: true, mayuscula: true });
  return createPortal(
    <div className="gma gp gp-capa">
      <div
        ref={ref}
        role="dialog"
        aria-label="Cómo se genera"
        className="gp-menu gp-como"
        style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, width: pos?.ancho ?? ANCHO_CAPA, zIndex: z + 1, visibility: pos ? 'visible' : 'hidden' }}
      >
        <div role="radiogroup" aria-label="Plan o Express">
          {OPCIONES_COMO.map((o, i) => (
            <button
              key={o.valor}
              ref={(el) => { radios.current[i] = el; }}
              type="button"
              role="radio"
              aria-checked={modo === o.valor}
              tabIndex={modo === o.valor ? 0 : -1}
              className="gp-menu-item"
              data-sub="si"
              data-activo={modo === o.valor ? 'si' : undefined}
              onClick={() => onModo(o.valor)}
              onKeyDown={(e) => flechas(e, i)}
            >
              <Ico n={o.icono} />
              <span className="gp-menu-textos">
                <span className="gp-menu-texto">{o.texto}</span>
                <span className="gp-menu-sub">{o.sub}</span>
              </span>
              {modo === o.valor && <span className="gp-menu-check"><Ico n="check" /></span>}
            </button>
          ))}
        </div>
        <div className="gp-menu-sep" role="separator" />
        <div className="gp-como-fila">
          <span className="gp-como-rotulo">{plural}</span>
          <div className="gp-como-stepper" role="group" aria-label={`Cantidad de ${termino(tipo, { plural: true })}`}>
            <button type="button" aria-label={`Menos ${termino(tipo, { plural: true })}`} disabled={cantidadApagada || params.cantidad <= MIN_SECCIONES} onClick={() => set('cantidad', params.cantidad - 1)}><Ico n="menos" t={12} /></button>
            <span aria-live="polite">{cantidadApagada ? 'Las marca tu texto' : cuantas(params.cantidad, tipo)}</span>
            <button type="button" aria-label={`Más ${termino(tipo, { plural: true })}`} disabled={cantidadApagada || params.cantidad >= MAX_SECCIONES} onClick={() => set('cantidad', params.cantidad + 1)}><Ico n="mas" t={12} /></button>
          </div>
        </div>
        <div className="gp-como-fila">
          <span className="gp-como-rotulo">Objetivo</span>
          <Desplegable etiqueta="Objetivo" valor={params.objetivo} opciones={OBJETIVOS} onCambio={(v) => set('objetivo', v)} ancho={320} alinear="derecha" />
        </div>
        <div className="gp-como-fila">
          <span className="gp-como-rotulo">Idioma</span>
          <Desplegable etiqueta="Idioma de salida" icono="traducir" valor={params.idioma} opciones={IDIOMAS} onCambio={(v) => set('idioma', v)} alinear="derecha" />
        </div>
        <div className="gp-menu-sep" role="separator" />
        <button type="button" className="gp-menu-item" onClick={onMasAjustes}>
          <Ico n="ajustes" />
          <span className="gp-menu-textos"><span className="gp-menu-texto">Más ajustes</span></span>
          <Ico n="chevron-derecha" t={14} />
        </button>
      </div>
    </div>,
    document.body,
  );
}

/**
 * «Más ajustes»: lo que era «Personalizar», en un panel pegado debajo del cuadro (nunca otra pantalla). AFUERA del
 * <form> de la caja: un Enter en un campo de acá no manda el pedido.
 */
export function PanelMasAjustes({ params, set, tipo, analizadas, errorAnalizadas, onAnalizarUna, onCerrar }: {
  params: ParamsGeneracion;
  set: SetParam;
  tipo: TipoCrear;
  analizadas: readonly { url: string; veredicto: string | null; score: number | null }[];
  errorAnalizadas: string | null;
  /** Sin analizadas, «Sobre cuál» dice dónde se analiza: el cuadro en Analizar. */
  onAnalizarUna: () => void;
  onCerrar: () => void;
}) {
  const primero = useRef<HTMLButtonElement>(null);
  useEffect(() => { primero.current?.focus(); }, []);
  const opcionesBase = useMemo<OpcionDesplegable<string>[]>(() => [
    { valor: '', texto: 'Sin landing de base', icono: 'cerrar' },
    ...analizadas.map((a) => ({
      valor: a.url,
      texto: `Sobre ${hostDe(a.url)}`,
      sub: a.score != null ? `Puntaje ${a.score}${a.veredicto ? ` · ${a.veredicto}` : ''}` : a.veredicto ?? undefined,
      icono: 'reporte',
    })),
  ], [analizadas]);
  const largo = `Texto por ${termino(tipo)}`;
  return (
    <section className="gp-cc-ajustes" aria-label="Más ajustes" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } }}>
      <div className="gp-cc-ajustes-cabeza">
        <h2 className="gp-cc-ajustes-titulo"><Ico n="ajustes" t={15} /> Más ajustes</h2>
        <button type="button" className="gp-icono-btn" aria-label="Cerrar los ajustes" onClick={onCerrar}><Ico n="cerrar" /></button>
      </div>
      <div className="gp-cc-ajustes-grilla">
        <div className="gp-cc-ajuste">
          <span className="gp-cc-ajuste-rotulo">{largo}</span>
          <div className="gp-cc-segmentos" role="group" aria-label={largo}>
            {TEXTOS.map((t, i) => (
              <button key={t.valor} ref={i === 0 ? primero : undefined} type="button" aria-pressed={params.textoPorSeccion === t.valor} onClick={() => set('textoPorSeccion', t.valor)}>{t.texto}</button>
            ))}
          </div>
        </div>
        <div className="gp-cc-ajuste">
          <span className="gp-cc-ajuste-rotulo">Imágenes</span>
          <Desplegable etiqueta="Fuente de la imagen" valor={params.fuenteImagenes} opciones={FUENTES} onCambio={(v) => set('fuenteImagenes', v)} ancho={340} />
        </div>
        <label className="gp-cc-ajuste">
          <span className="gp-cc-ajuste-rotulo">Escribe para</span>
          <input className="gp-campo" value={params.audiencia} maxLength={300} placeholder="Por ejemplo, dueños de restaurantes" onChange={(e) => set('audiencia', e.target.value)} />
        </label>
        <label className="gp-cc-ajuste">
          <span className="gp-cc-ajuste-rotulo">Tono</span>
          <input className="gp-campo" value={params.tono} maxLength={120} placeholder="Por ejemplo, cercano y profesional" onChange={(e) => set('tono', e.target.value)} />
        </label>
        {/* «Sobre cuál» es de una LANDING (su diagnóstico entra al prompt): en una presentación no se dibuja, y
            `paramsDeTipo` tampoco lo manda — nada viaja a la IA sin estar en la pantalla. */}
        {tipo === 'landing' && (
          <div className="gp-cc-ajuste gp-cc-ajuste-ancho">
            <span className="gp-cc-ajuste-rotulo">Sobre cuál</span>
            <div className="gp-cc-ajuste-fila">
              <Desplegable
                etiqueta="Sobre cuál"
                valor={params.basadoEnUrl ?? ''}
                opciones={opcionesBase}
                onCambio={(v) => set('basadoEnUrl', v || null)}
                deshabilitado={!analizadas.length && !errorAnalizadas}
                ancho={340}
              />
              {errorAnalizadas && <span className="gp-cc-ajuste-error">No se pudieron leer las landings analizadas.</span>}
              {!analizadas.length && !errorAnalizadas && <button type="button" className="gp-cc-enlace" onClick={onAnalizarUna}>Analizar una página</button>}
            </div>
          </div>
        )}
        <label className="gp-cc-ajuste gp-cc-ajuste-ancho">
          <span className="gp-cc-ajuste-rotulo">Instrucciones adicionales</span>
          <textarea className="gp-campo" rows={2} value={params.instrucciones} maxLength={MAX_INSTRUCCIONES} placeholder="Opcional" onChange={(e) => set('instrucciones', e.target.value)} />
        </label>
      </div>
    </section>
  );
}

/** La hoja del desplegable y del panel (tokens de CSS_GP; el desplegable usa la cara de `.gp-menu`). */
export const CSS_AJUSTES = `
.gp .gp-cc-como { flex: none; }
.gp .gp-como { display: flex; flex-direction: column; }
.gp .gp-como-fila { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 40px; padding: 2px 8px; }
.gp .gp-como-rotulo { flex: none; font-size: 13.5px; font-weight: 500; color: var(--gp-tenue); }
.gp .gp-como-fila .gp-pildora { min-width: 0; max-width: 200px; }
.gp .gp-como-stepper { display: inline-flex; align-items: center; height: 32px; border: 1px solid var(--gp-borde); border-radius: 9999px; background: var(--gp-superficie); font-size: 13px; font-weight: 500; }
.gp .gp-como-stepper button { display: grid; place-items: center; width: 30px; height: 30px; border: 0; border-radius: 9999px; background: transparent; color: var(--gp-texto); cursor: pointer; }
.gp .gp-como-stepper button:hover:not(:disabled) { background: var(--gp-hover); }
.gp .gp-como-stepper button:disabled { opacity: .35; cursor: default; }
.gp .gp-como-stepper span { min-width: 104px; text-align: center; white-space: nowrap; }

/* «Más ajustes»: pegado debajo del cuadro, con su mismo ancho y su misma cara. */
.gp .gp-cc-ajustes { width: 100%; max-width: 720px; margin-top: -6px; padding: 12px 16px 16px; border: 1px solid var(--gp-borde-suave); border-radius: 14px; background: var(--gp-superficie); box-shadow: 0 10px 15px -3px rgba(0,0,0,.08), 0 4px 6px -2px rgba(0,0,0,.04); }
.gp .gp-cc-ajustes-cabeza { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px; }
.gp .gp-cc-ajustes-titulo { display: inline-flex; align-items: center; gap: 8px; margin: 0; font-size: 15px; font-weight: 600; color: var(--gp-titulo); }
.gp .gp-cc-ajustes-grilla { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 16px; }
.gp .gp-cc-ajuste { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
.gp .gp-cc-ajuste-ancho { grid-column: 1 / -1; }
.gp .gp-cc-ajuste-rotulo { font-size: 13px; font-weight: 600; color: var(--gp-tenue); }
.gp .gp-cc-ajuste .gp-pildora { align-self: flex-start; }
.gp .gp-cc-ajuste-fila { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; }
.gp .gp-cc-ajuste-error { font-size: 12.5px; color: var(--gp-peligro); }
.gp .gp-cc-enlace { padding: 0; border: 0; background: transparent; color: var(--gp-activo-texto); font-size: 13.5px; font-weight: 600; cursor: pointer; }
.gp .gp-cc-segmentos { display: inline-flex; flex-wrap: wrap; gap: 4px; align-self: flex-start; padding: 3px; border-radius: 10px; background: var(--gp-borde-suave); }
.gp .gp-cc-segmentos button { height: 30px; padding: 0 12px; border: 0; border-radius: 8px; background: transparent; color: var(--gp-texto); font-size: 13px; font-weight: 500; cursor: pointer; }
.gp .gp-cc-segmentos button[aria-pressed="true"] { background: var(--gp-superficie); color: var(--gp-activo-texto); box-shadow: var(--gp-sombra-tarjeta); }
@media (max-width: 560px) {
  .gp .gp-cc-ajustes-grilla { grid-template-columns: minmax(0, 1fr); }
}
`;
