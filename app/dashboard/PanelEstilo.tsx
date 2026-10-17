'use client';

// =============================================================================
// PanelEstilo — el estilo de TODA la hoja: la plantilla, el color y la letra (punto 8)
// =============================================================================
// Martín, 11/10/2026: «no permitas editar el estilo de cada componente... En su lugar, en la topbar de
// edición poder editar el estilo de toda la página y que impacte a todos los componentes. Como lo
// tenemos en el editor de CURSOS... Que se pueda elegir color, tipografía, incluso diferentes plantillas
// de estilos de diseño.»
//
// Cambia `hoja.tema` (lib/graficos-temas.ts) y nada más: el lienzo aplica `varsDeTema(tema)` como
// variables CSS y `CuerpoGrafico` lee `estiloEfectivo(tema)`. Las tres secciones:
//   · PLANTILLAS: el catálogo cerrado, cada una con una muestra chiquita hecha con SU tarjeta, SU paleta
//     y SU letra (no una foto: si la plantilla cambia, la muestra cambia sola).
//   · COLOR: la paleta de la plantilla y «Otro color» (un círculo más, con la rueda). El color nativo dispara un cambio por cada
//     píxel que se arrastra: va con un respiro de 450 ms (el molde de CursoApp.tsx), así cada gesto es
//     UN paso del deshacer y no cuarenta. Elegir el primero de la paleta es volver al de la plantilla.
//   · LETRA: las TIPOGRAFIAS, cada una escrita con su propia letra (se bajan al abrir el panel, con
//     `useHojasDeFuentes`, una hoja por familia). Elegir la de la plantilla es volver a «la de la plantilla».
//   · TARJETAS y GRÁFICOS (17/10/2026, Martín: «deberías mejorar ese desplegable de estilos, ya que quedó
//     limitado»): los ajustes encima de la plantilla (`AJUSTES_TEMA`, lib/graficos-temas.ts) —fondo, esquinas,
//     borde, sombra y títulos de las tarjetas; valores, leyenda y cuadrícula de los gráficos—, cada uno como
//     botones de una sola elección con el de la plantilla marcado mientras no se toque. Elegir otra plantilla
//     los vuelve a los suyos.
//
// ES LA PIEZA COMPARTIDA del «Estilo de la hoja»: la usan el Dashboard y General (app/dashboard/EditorInforme.tsx)
// y la ficha del lead (app/crm/lead-view/ficha/EstiloDeLaHoja.tsx). Los ajustes se muestran con `ajustes`: quien
// lo prende tiene que GUARDARLOS (el saneo es `sanearTema`); un control que no se guarda miente un clic.
// Los estilos de los ajustes van en línea, no en una clase del editor, para que se vean igual en la ficha del CRM.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useHojasDeFuentes } from '@/app/_cursos/SelectorFuente';
import { RUEDA_COLOR } from '@/app/_ui/rueda-color';
import {
  AJUSTES_TEMA, PLANTILLAS_TEMA, TIPOGRAFIAS, ajusteDe, hexONull, paletaDe, plantillaDe, plantillaEfectiva, tipografiaDe,
  type AjustesTema, type PlantillaTema, type TemaHoja,
} from '@/lib/graficos-temas';

const RESPIRO_COLOR_MS = 450;

/** Elegir otra plantilla trae lo suyo: el color y los ajustes vuelven a los de ella. */
const SIN_AJUSTES = Object.fromEntries(AJUSTES_TEMA.map((a) => [a.id, undefined])) as AjustesTema;

export function PanelEstilo({ tema, onCambiar, ajustes = false }: {
  tema: TemaHoja;
  onCambiar: (parche: Partial<TemaHoja>) => void;
  /** Mostrar los ajustes de tarjetas y gráficos (sólo si quien monta el panel los guarda). */
  ajustes?: boolean;
}) {
  useHojasDeFuentes(TIPOGRAFIAS.map((t) => t.id));
  const p = plantillaDe(tema.plantilla);
  const efectiva = plantillaEfectiva(tema);
  const paleta = paletaDe(tema);
  const letra = tema.fuente ?? p.fuente;

  // «Otro color»: lo que se arrastra se ve en el acto (en la muestra de este panel) y se guarda al soltar.
  const [probando, setProbando] = useState<string | null>(null);
  const espera = useRef<number | null>(null);
  const pendiente = useRef<string | null>(null);
  const cambiar = useRef(onCambiar);
  cambiar.current = onCambiar;
  const elegirAcento = (hex: string | null) => {
    const h = hex ? hexONull(hex) : null;
    // Volver al primero de la paleta de la plantilla es «sin acento»: así cambiar de plantilla después
    // trae su color, en vez de dejar pegado uno que ya no le corresponde.
    cambiar.current({ acento: h && h !== p.paleta[0].toLowerCase() ? h : null });
  };
  const probar = (hex: string) => {
    setProbando(hex);
    pendiente.current = hex;
    if (espera.current) window.clearTimeout(espera.current);
    espera.current = window.setTimeout(() => {
      espera.current = null;
      const v = pendiente.current;
      pendiente.current = null;
      if (v) elegirAcento(v);
    }, RESPIRO_COLOR_MS);
  };
  // Si el panel se cierra en medio del respiro, lo último que se eligió se guarda igual.
  useEffect(() => () => {
    if (espera.current) window.clearTimeout(espera.current);
    const v = pendiente.current;
    if (v) { const h = hexONull(v); cambiar.current({ acento: h }); }
  }, []);

  const acentoVisto = probando ?? paleta[0];
  const enPaleta = p.paleta.some((c) => c.toLowerCase() === acentoVisto.toLowerCase());

  return (
    <div className="lk-estilo" onClick={(e) => e.stopPropagation()}>
      <div className="lk-estilo-tit">Plantilla</div>
      <div className="lk-plantillas" role="group" aria-label="Plantilla">
        {PLANTILLAS_TEMA.map((pl) => (
          <button key={pl.id} type="button" className="lk-plantilla" aria-pressed={pl.id === p.id} title={pl.linea}
            onClick={() => { if (pl.id !== p.id) onCambiar({ plantilla: pl.id, acento: null, ...SIN_AJUSTES }); }}>
            {/* La elegida, con los ajustes de la hoja encima: la muestra es lo que se ve. */}
            <Muestra p={pl.id === p.id ? efectiva : pl} acento={pl.id === p.id ? acentoVisto : null} letra={pl.id === p.id ? letra : null} />
            <span className="lk-plantilla-nom">{pl.nombre}</span>
          </button>
        ))}
      </div>

      <div className="lk-estilo-tit">Color</div>
      <div className="lk-colores" role="group" aria-label="Color">
        {p.paleta.map((c) => (
          <button key={c} type="button" className="lk-color" style={{ background: c }} aria-label={`Color ${c}`} title={c}
            aria-pressed={acentoVisto.toLowerCase() === c.toLowerCase()} onClick={() => { setProbando(null); elegirAcento(c); }} />
        ))}
        {/* «Otro color» es un círculo más, con la rueda arcoíris de la casa (app/_ui/rueda-color.ts) y el selector
            del sistema encima, invisible (tanda v5, punto 17: era una pastilla con texto). Si el color elegido no es
            de la paleta, la rueda queda marcada y lleva un punto con ese color: si no, no se sabe qué quedó. */}
        <label className="lk-color lk-color--rueda" title="Otro color" style={{ background: RUEDA_COLOR }} data-elegido={!enPaleta || undefined}>
          {!enPaleta && <span aria-hidden className="lk-color-punto" style={{ background: acentoVisto }} />}
          <input type="color" value={acentoVisto} aria-label="Otro color" onChange={(e) => probar(e.target.value)} />
        </label>
      </div>

      <div className="lk-estilo-tit">Letra</div>
      <div className="lk-letras" role="group" aria-label="Letra">
        {TIPOGRAFIAS.map((t) => (
          <button key={t.id} type="button" className="lk-letra" aria-pressed={t.id === letra}
            onClick={() => { if (t.id !== letra) onCambiar({ fuente: t.id === p.fuente ? null : t.id }); }}>
            <span className="lk-letra-nom" style={{ fontFamily: t.pila }}>{t.nombre}</span>
            <span className="lk-letra-tipo">{t.id === p.fuente ? 'La de la plantilla' : t.tipo}</span>
          </button>
        ))}
      </div>

      {ajustes && ['Tarjetas', 'Gráficos'].map((grupo) => (
        <div key={grupo} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="lk-estilo-tit">{grupo}</div>
          {AJUSTES_TEMA.filter((a) => a.grupo === grupo).map((a) => (
            <div key={a.id} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <span style={{ fontSize: 12, color: 'var(--dim)' }}>{a.nombre}</span>
              <Elegir etiqueta={a.nombre} valor={ajusteDe(tema, a.id)} valores={a.valores}
                onElegir={(v) => onCambiar({ [a.id]: v } as Partial<TemaHoja>)} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

/** Botones de una sola elección, todos a la vista (son 2 o 3 valores: un desplegable los escondería). */
function Elegir({ etiqueta, valor, valores, onElegir }: {
  etiqueta: string; valor: string; valores: ReadonlyArray<{ id: string; nombre: string }>; onElegir: (v: string) => void;
}) {
  return (
    <div role="group" aria-label={etiqueta} style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--border)' }}>
      {valores.map((v) => {
        const sel = v.id === valor;
        return (
          <button key={v.id} type="button" aria-pressed={sel} onClick={() => { if (!sel) onElegir(v.id); }}
            style={{
              flex: 1, minWidth: 0, height: 30, border: 'none', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 12.5, fontWeight: 500, padding: '0 6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              background: sel ? 'var(--surface)' : 'transparent', color: sel ? 'var(--ink)' : 'var(--dim)',
              boxShadow: sel ? '0 0 0 1px var(--border-strong)' : 'none',
            }}>
            {v.nombre}
          </button>
        );
      })}
    </div>
  );
}

/** La tarjeta de la plantilla en chiquito: su fondo, su borde, su radio, su sombra, su letra y su paleta. */
function Muestra({ p, acento, letra }: { p: PlantillaTema; acento: string | null; letra: string | null }) {
  const fondo = p.tarjeta.fondo === 'surface' ? 'var(--surface)' : p.tarjeta.fondo === 'surface-2' ? 'var(--surface-2)' : 'transparent';
  const borde = p.tarjeta.borde === 'no' ? 'transparent' : p.tarjeta.borde === 'fuerte' ? 'var(--border-strong)' : 'var(--border)';
  const colores = p.paleta.slice(0, 4).map((c, i) => (i === 0 && acento ? acento : c));
  const estilo: CSSProperties = {
    background: fondo,
    border: `1px solid ${borde}`,
    borderRadius: Math.min(12, p.tarjeta.radio / 2 + 2),
    boxShadow: p.tarjeta.sombra ? '0 2px 8px rgba(0,0,0,.12)' : 'none',
    fontFamily: tipografiaDe(letra ?? p.fuente).pila,
    ...(p.tarjeta.filete ? { borderTop: `3px solid ${colores[0]}` } : {}),
  };
  return (
    <span className="lk-muestra" style={estilo} aria-hidden>
      <span className="lk-muestra-tit" style={{ textTransform: p.titulo.mayus ? 'uppercase' : 'none' }}>Ventas</span>
      <span className="lk-muestra-barras">
        {[60, 95, 45, 75].map((h, i) => <span key={i} style={{ height: `${h}%`, background: colores[i], borderRadius: Math.min(3, p.graficos.radioBarra) }} />)}
      </span>
    </span>
  );
}
