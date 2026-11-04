'use client';

// =============================================================================
// MiniaturaHoja — la vista previa de una plantilla de hoja: LA HOJA, dibujada en chico
// =============================================================================
// Martín, 14/10/2026: «Y los templates, la preview debería ser como los de landing generator, porque justamente se
// deberían ver como una página... Lo mismo te pido que le digas a dashboard». Y el mismo día, sobre la primera versión
// (que dibujaba un BOCETO de cada tipo: rectángulos grises, una línea inventada): «los templates tienen que ser fieles a
// lo que se va a ver, no inventes esas imagenes, que se vea tal cual... Y elimina los subtitulos de cada template, solo
// el título».
//
// LA MINIATURA ES LA HOJA, no un dibujo aparte: cada componente en su lugar de la grilla (las mismas x, y, w, h y el
// mismo FILA/MARGEN que el editor), con LOS MISMOS componentes del editor y el tema de la hoja:
//   · un gráfico es su tarjeta (`lk-comp`) con su título y `CuerpoGrafico`, el que dibuja la hoja. Lo único que no es
//     real es el número: un `Resultado` de ejemplo con la forma del suyo (lib/graficos-muestra.ts). Medir cada
//     plantilla al abrir serían ~150 gráficos por apertura;
//   · un bloque de General es su tarjeta con el bloque y sus datos de ejemplo (`PiezaGeneralDeMuestra`, lo presta la
//     página de General);
//   · un Texto con su tamaño de la hoja y sus variables con los valores de quien mira (en General) o de ejemplo; una
//     Sección, con la pieza de la hoja.
// Como la miniatura del Landing Generator, se ve el principio de la página y lo que no entra se corta abajo.
//
// ⚠️ LA ESCALA ES `transform: scale(k)` SOBRE LA PÁGINA DE ANCHO_REF px, con `k` medido del contenedor. La regla de la
//    casa contra medir dentro de una capa escalada vale para lo que se APUNTA: la miniatura no recibe el mouse
//    (`pointer-events: none`), y los gráficos miden su contenedor con ResizeObserver, que da el tamaño SIN escala.
// ⚠️ EL SERVER Y EL PRIMER DIBUJO SON IGUALES (la pantalla en blanco se dibuja también en el server): la página con cada
//    tarjeta y su título. Los cuerpos —los gráficos, los bloques y lo que depende de hoy— entran DESPUÉS de montar y
//    sólo cuando la miniatura se ve (IntersectionObserver): son ~150 gráficos en una galería que se scrollea.
// ⚠️ LA HOJA DE ESTILOS (`CSS_MINIATURA`) LA PONE QUIEN MONTA LAS MINIATURAS, UNA VEZ. Las tarjetas usan la del editor
//    (`lk-comp`, ./editor-css.ts), que ya está montada: la galería vive adentro del editor.
// =============================================================================

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { esElemento, esGrafico, sanearHoja, tituloDe, type Componente, type Elemento, type Hoja } from '@/lib/graficos-catalogo';
import type { PlantillaHoja } from '@/lib/graficos-plantillas';
import { acentoDePortada, paletaDe, paletaDeEscena, pintaPortada, varsDeTema } from '@/lib/graficos-temas';
import { PAGINA_MINIATURA, lugarEnMiniatura, resultadoDeMuestra } from '@/lib/graficos-muestra';
import { VARIABLES_TEXTO, conVariables, esPiezaGeneral, piezaGeneral } from '@/lib/general-piezas';
import { CuerpoGrafico, esTarjetaNumero } from './Grafico';
import { destinoDe } from '@/lib/graficos-destinos';
import { TAMANOS_TEXTO } from './Elemento';
import { CuerpoSeccion } from './Seccion';
import { PiezaGeneralDeMuestra, useVariablesInforme } from './ElementoGeneral';
import { marcoDePortada } from '@/lib/graficos-identidad';
import { tilesDeComponentes } from './Grafico';

/** El ancho de la página que se dibuja (px): la grilla y el lugar de cada componente salen de `lugarEnMiniatura`. */
const ANCHO_REF = PAGINA_MINIATURA.ancho;

/** La hoja de una plantilla con sus ids FIJOS: la misma en el server y en el navegador. */
export function hojaDeMuestra(p: PlantillaHoja): Hoja | null {
  try { return sanearHoja({ ...p.armar((local) => local), plantilla: p.id }, 0); } catch { return null; }
}

const EJEMPLOS = Object.fromEntries(VARIABLES_TEXTO.map((v) => [v.id, v.ejemplo]));

const hoyLocal = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Un componente, como lo dibuja la hoja. `vivo`: ya montado y a la vista (los cuerpos entran recién ahí). */
function Pieza({ c, hoja, vivo, hoy, tile }: { c: Componente; hoja: Hoja; vivo: boolean; hoy: string; tile?: string }): ReactNode {
  const variables = useVariablesInforme();
  // La portada (lib/graficos-identidad.ts): la misma tarjeta pintada que en la hoja (con el color de la hoja, si tiene).
  const portada = pintaPortada(c, hoja.tema) ? marcoDePortada(c, acentoDePortada(hoja.tema)) : null;
  const conPortada = (clase: string): string => (portada ? `${clase} ${portada.clase}` : clase);
  const estilo = { flex: 1, ...(portada?.estilo ?? {}) } as CSSProperties;
  if (esGrafico(c)) {
    const kpi = esTarjetaNumero(c.tipo);
    return (
      <div className={conPortada(`lk-comp${kpi ? ' lk-comp--kpi' : ''}${c.tipo === 'frase' && !portada ? ' lk-comp--frase' : ''}`)} style={estilo} data-forma={portada?.forma} data-tile={tile}>
        <div className="lk-comp-cab"><div className="lk-comp-tit"><span>{tituloDe(c)}</span></div></div>
        {!kpi && c.subtitulo && <div className="lk-comp-sub">{c.subtitulo}</div>}
        {vivo && <CuerpoGrafico g={c} estado={{ cargando: false, resultado: resultadoDeMuestra(c, hoy) }} tema={hoja.tema} />}
        {/* El «Ver … →» del pie, como en la hoja (lib/graficos-destinos.ts). En la miniatura no se toca. */}
        {destinoDe(c.ir) && <span className="lk-comp-ir">{destinoDe(c.ir)!.rotulo} →</span>}
      </div>
    );
  }
  if (!esElemento(c)) return null;
  const e: Elemento = c;
  switch (e.tipo) {
    case 'texto': {
      const t = TAMANOS_TEXTO[e.tamano] ?? TAMANOS_TEXTO.l;
      const texto = conVariables(e.texto, variables ?? EJEMPLOS);
      // Un texto de portada (el saludo de la Bienvenida) es la tarjeta pintada con el texto como titular.
      if (portada) {
        return (
          <div className={conPortada('lk-comp lk-comp--texto-portada')} style={estilo} data-forma={portada.forma}>
            <div className="lk-comp-cab"><div className="lk-comp-tit"><span>{texto}</span></div></div>
          </div>
        );
      }
      return (
        <div className="mh-texto" style={{ fontSize: t.px, fontWeight: t.peso, lineHeight: t.alto }}>
          {texto}
        </div>
      );
    }
    case 'seccion':
      return <div className="lk-comp lk-comp--elemento" style={{ flex: 1 }}><CuerpoSeccion e={e} colores={paletaDe(hoja.tema)} /></div>;
    case 'general': {
      const p = e.general?.pieza;
      if (!esPiezaGeneral(p)) return null;
      const titulo = e.texto.trim() || piezaGeneral(p).nombre;
      return (
        <div className={conPortada('lk-comp lk-comp--general')} style={estilo} data-forma={portada?.forma}>
          {vivo ? <PiezaGeneralDeMuestra e={e} /> : <div className="gb"><div className="gb-cab"><h2 className="gb-tit">{titulo}</h2></div></div>}
        </div>
      );
    }
    case 'linea':
    case 'flecha':
      return <div className="mh-regla" />;
    default:
      // Lo que se dibuja con datos propios (una caja de IA, una ficha, un video): su tarjeta con su nombre.
      return (
        <div className="lk-comp" style={{ flex: 1 }}>
          <div className="lk-comp-cab"><div className="lk-comp-tit"><span>{e.tipo === 'ia' ? `✦ ${e.texto || 'Conclusiones de MaKo'}` : e.texto || ' '}</span></div></div>
        </div>
      );
  }
}

/**
 * La página: el nombre de la hoja arriba (como su barra) y cada componente en su lugar. Lo que no entra en la
 * proporción de la tarjeta se corta abajo, como la miniatura de una landing (que muestra su primera sección).
 */
/** Cada miniatura arranca en otro momento: juntas parecerían una sola animación, y son más caras en el mismo cuadro. */
const demoraDe = (id: string) => [...id].reduce((s, ch) => (s * 31 + ch.charCodeAt(0)) % 41, 0) / 10;

export function MiniaturaHoja({ hoja, proporcion = '16 / 10' }: { hoja: Hoja | null; proporcion?: string }) {
  const caja = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState<number | null>(null);
  const [vivo, setVivo] = useState(false);
  const [enVista, setEnVista] = useState(false);
  const [hoy, setHoy] = useState('');

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo) return;
    const medir = () => { const w = nodo.clientWidth; if (w > 0) setEscala(w / ANCHO_REF); };
    medir();
    setHoy(hoyLocal());
    const ro = new ResizeObserver(medir);
    ro.observe(nodo);
    // Los cuerpos entran cuando la miniatura se ve, y se quedan. El movimiento, sólo mientras se ve.
    const io = new IntersectionObserver((xs) => { if (xs.some((x) => x.isIntersecting)) { setVivo(true); io.disconnect(); } }, { rootMargin: '200px' });
    io.observe(nodo);
    const mira = new IntersectionObserver((xs) => setEnVista(xs.some((x) => x.isIntersecting)));
    mira.observe(nodo);
    return () => { ro.disconnect(); io.disconnect(); mira.disconnect(); };
  }, []);

  const tiles = hoja && paletaDeEscena(hoja.tema) ? tilesDeComponentes(hoja.componentes) : null;
  const pagina: CSSProperties = {
    ...(hoja ? varsDeTema(hoja.tema) : {}),
    width: ANCHO_REF,
    transform: `scale(${escala ?? 0.2})`,
    visibility: escala == null ? 'hidden' : undefined,
  } as CSSProperties;

  return (
    <div ref={caja} className="mh" style={{ aspectRatio: proporcion, '--mh-demora': `${demoraDe(hoja?.id ?? '')}s` } as CSSProperties} data-paleta={hoja ? paletaDeEscena(hoja.tema) : undefined} data-en-vista={enVista || undefined}>
      {hoja && (
        <div className="mh-pagina" style={pagina}>
          {hoja.componentes.map((c) => {
            return <div key={c.id} className="mh-pos" style={lugarEnMiniatura(c)}><Pieza c={c} hoja={hoja} vivo={vivo && !!hoy} hoy={hoy} tile={tiles?.get(c.id)} /></div>;
          })}
        </div>
      )}
    </div>
  );
}

// Sin backticks acá adentro: es un template literal. Sólo tokens de la casa (se dan vuelta en oscuro).
export const CSS_MINIATURA = `
/* EN MOVIMIENTO (Martín, 1/11/2026: «las preview se deben ver en movimiento»). La tienda que copiamos usa videos grabados: acá la miniatura
   ya es la hoja de verdad en chico, así que se le anima lo que ya está dibujado, sólo mientras se ve y cada una con su demora. */
@keyframes mh-traza{0%{stroke-dashoffset:3000}30%,100%{stroke-dashoffset:0}}
@keyframes mh-crece{0%{transform:scaleY(0)}24%,100%{transform:scaleY(1)}}
@keyframes mh-aparece{0%{opacity:0}26%,100%{opacity:1}}
.mh[data-en-vista] .recharts-line-curve,.mh[data-en-vista] .recharts-area-curve{stroke-dasharray:3000;animation:mh-traza 7s var(--ease,ease) var(--mh-demora,0s) infinite}
.mh[data-en-vista] .recharts-area-area,.mh[data-en-vista] .recharts-pie-sector{animation:mh-aparece 7s ease-out var(--mh-demora,0s) infinite}
.mh[data-en-vista] .recharts-bar-rectangle path{transform-box:fill-box;transform-origin:bottom;animation:mh-crece 7s var(--ease,ease) var(--mh-demora,0s) infinite}
@media (prefers-reduced-motion: reduce){.mh[data-en-vista] *{animation:none !important}}
.mh{position:relative;width:100%;overflow:hidden;background:var(--bg);border-radius:10px;pointer-events:none;user-select:none}
.mh-pagina{position:absolute;left:0;top:0;transform-origin:top left;font-family:var(--dash-letra,inherit);color:var(--ink)}
.mh-pos{position:absolute;display:flex;min-width:0;min-height:0}
.mh-pos > .lk-comp{min-height:0}
.mh .gen-pieza{overflow:hidden}
.mh-texto{flex:1;min-width:0;overflow:hidden;color:var(--ink);font-family:var(--dash-letra,inherit)}
.mh-regla{flex:1;align-self:center;height:1px;background:var(--border-strong)}
`;
