// =============================================================================
// MiniaturaHoja — la vista previa de una plantilla de hoja, dibujada como una PÁGINA
// =============================================================================
// Martín, 14/10/2026: «Y los templates, la preview debería ser como los de landing generator, porque justamente se
// deberían ver como una página... Lo mismo te pido que le digas a dashboard». El molde es la tarjeta de plantilla del
// Landing Generator (`.gp-cc-plantilla` de app/landing-generator/CajaCrear.tsx): la miniatura de la página, «Usar
// plantilla» al pasar el mouse, y el nombre y la línea abajo. La tarjeta vive en ./NuevaHoja.tsx; esto es la página.
//
// LA MINIATURA ES LA FORMA, NUNCA LOS DATOS. Dibuja cada componente de la plantilla en su lugar de la grilla (las
// mismas x, y, w, h que el editor) con un boceto de su tipo: barras, una línea, un número, una tabla, la cabecera
// oscura de General… y el título real de cada uno. No pide datos: medir cada plantilla al abrir serían ~157 gráficos
// por apertura (lo que /api/graficos/plantilla hace sólo para la que se elige). Y un boceto no afirma ningún número.
//
// ⚠️ LA ESCALA VA POR `cqw` (container-type en `.mh`), como la miniatura del Landing Generator, nunca por
//    `transform: scale()`: la página de referencia mide ANCHO_REF y todo se expresa en % de ese ancho.
// ⚠️ DETERMINISTA: las alturas de los bocetos salen del id del componente, y la hoja de muestra se arma con los ids
//    FIJOS de la plantilla (`hojaDeMuestra`), así el HTML del server y el del navegador coinciden (la pantalla en
//    blanco se dibuja también en el server).
// ⚠️ LA HOJA DE ESTILOS (`CSS_MINIATURA`) LA PONE QUIEN MONTA LAS MINIATURAS, UNA VEZ: con un <style> por tarjeta eran
//    trece copias iguales en la grilla.
// ⚠️ LAS VARIABLES DE UN TEXTO se dibujan con su ejemplo («{{saludo}}, {{nombre}}» → «Buenos días, Ana»): la llave
//    cruda en una miniatura se lee como un error.
// =============================================================================

import type { CSSProperties, ReactNode } from 'react';
import { COLS, TIPOS, esElemento, esGrafico, sanearHoja, tituloDe, type Componente, type Hoja } from '@/lib/graficos-catalogo';
import type { PlantillaHoja } from '@/lib/graficos-plantillas';
import { VARIABLES_TEXTO, conVariables, esPiezaGeneral, piezaGeneral, type PiezaGeneral } from '@/lib/general-piezas';

/** El ancho de una hoja en la pantalla (px) y su grilla (los de EditorInforme: FILA 30, MARGEN 16). */
const ANCHO_REF = 1180;
const FILA = 30;
const MARGEN = 16;
/** Una fila de la grilla y el aire entre tarjetas, en % del ancho de la miniatura (cqw). */
const U = ((FILA + MARGEN) / ANCHO_REF) * 100;
const AIRE = (MARGEN / ANCHO_REF) * 100;
/** Lo que ocupa arriba la cabecera de la miniatura (el emoji y el nombre de la hoja), en cqw. */
const CABEZA = 7.2;

/** La hoja de una plantilla con sus ids FIJOS: la misma en el server y en el navegador. */
export function hojaDeMuestra(p: PlantillaHoja): Hoja | null {
  try { return sanearHoja({ ...p.armar((local) => local), plantilla: p.id }, 0); } catch { return null; }
}

const EJEMPLOS = Object.fromEntries(VARIABLES_TEXTO.map((v) => [v.id, v.ejemplo]));

/** Un número estable de 0 a 1 por (id, i): las alturas del boceto no cambian entre renders. */
function azar(id: string, i: number): number {
  let h = 2166136261 ^ i;
  for (let k = 0; k < id.length; k++) { h ^= id.charCodeAt(k); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 1000) / 1000;
}

type Forma = 'barras' | 'columnas' | 'linea' | 'numero' | 'tabla' | 'circulo' | 'embudo' | 'indicador' | 'celdas' | 'mapa';

/** El boceto de un gráfico sale de su GRUPO de la galería (`TIPOS`), no de una lista aparte. */
function formaDe(tipo: string): Forma {
  const g = TIPOS.find((t) => t.id === tipo)?.grupo;
  switch (g) {
    case 'Tabla': case 'Tabla dinámica': return 'tabla';
    case 'Cuadro de resultados': return 'numero';
    case 'Serie temporal': case 'Líneas': case 'Áreas': case 'Cronología': case 'Dispersión': return 'linea';
    case 'Barras': return tipo.startsWith('barras') ? 'barras' : 'columnas';
    case 'Histograma': case 'Cascada': return 'columnas';
    case 'Circular': return 'circulo';
    case 'Embudo de conversión': case 'Sankey': return 'embudo';
    case 'Indicador': case 'Bala': return 'indicador';
    case 'Gráfico de rectángulos': return 'celdas';
    case 'Mapa': return 'mapa';
    default: return 'columnas';
  }
}

/** El boceto de un bloque de General, por lo que dibuja en la pantalla. */
function formaDeBloque(p: PiezaGeneral): 'hero' | 'filas' | 'semaforo' | 'numeros' | 'barrasH' | 'progreso' | 'lista' {
  switch (p) {
    case 'cabecera': return 'hero';
    case 'kpis': return 'filas';
    case 'semaforo': return 'semaforo';
    case 'mes': return 'numeros';
    case 'funnel': return 'barrasH';
    case 'objetivos': return 'progreso';
    default: return 'lista';
  }
}

function Boceto({ forma, id }: { forma: Forma | ReturnType<typeof formaDeBloque>; id: string }) {
  const n = (i: number, min = 0.25) => min + azar(id, i) * (1 - min);
  switch (forma) {
    case 'columnas':
      return (
        <svg className="mh-svg" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden>
          {Array.from({ length: 7 }, (_, i) => { const h = 46 * n(i); return <rect key={i} x={4 + i * 13.5} y={48 - h} width={9} height={h} rx={1.2} className="mh-tinta" />; })}
        </svg>
      );
    case 'barras':
    case 'barrasH':
      return (
        <svg className="mh-svg" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden>
          {Array.from({ length: 5 }, (_, i) => <rect key={i} x={2} y={3 + i * 9.6} width={96 * (forma === 'barrasH' ? 1 - i * 0.17 : n(i))} height={6} rx={1.2} className="mh-tinta" />)}
        </svg>
      );
    case 'linea': {
      // Una tendencia que sube con ruido (un boceto, no un dato): sin picos que caigan al piso.
      const pts = Array.from({ length: 8 }, (_, i) => `${(i / 7) * 100},${46 - 40 * (0.2 + 0.45 * (i / 7) + 0.3 * azar(id, i))}`).join(' ');
      return (
        <svg className="mh-svg" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden>
          <polygon points={`0,50 ${pts} 100,50`} className="mh-area" />
          <polyline points={pts} fill="none" className="mh-trazo" strokeWidth={2.2} vectorEffect="non-scaling-stroke" />
        </svg>
      );
    }
    case 'circulo':
      return (
        <svg className="mh-svg mh-svg--cuadrado" viewBox="0 0 40 40" aria-hidden>
          <circle cx={20} cy={20} r={14} fill="none" className="mh-pista" strokeWidth={8} />
          <circle cx={20} cy={20} r={14} fill="none" className="mh-trazo" strokeWidth={8} strokeDasharray={`${50 + 30 * azar(id, 1)} 100`} pathLength={100} transform="rotate(-90 20 20)" />
        </svg>
      );
    case 'embudo':
      return (
        <svg className="mh-svg" viewBox="0 0 100 50" preserveAspectRatio="none" aria-hidden>
          {Array.from({ length: 4 }, (_, i) => { const w = 96 - i * 20; return <rect key={i} x={(100 - w) / 2} y={3 + i * 12} width={w} height={9} rx={1.5} className="mh-tinta" />; })}
        </svg>
      );
    case 'indicador':
      return (
        <svg className="mh-svg" viewBox="0 0 100 50" aria-hidden>
          <path d="M14 46 A36 36 0 0 1 86 46" fill="none" className="mh-pista" strokeWidth={9} />
          <path d="M14 46 A36 36 0 0 1 70 18" fill="none" className="mh-trazo" strokeWidth={9} />
        </svg>
      );
    case 'celdas':
      return (
        <div className="mh-celdas" aria-hidden>
          {Array.from({ length: 6 }, (_, i) => <span key={i} style={{ flexGrow: 1 + Math.round(3 * azar(id, i)) }} />)}
        </div>
      );
    case 'mapa':
      return <div className="mh-mapa" aria-hidden />;
    case 'numero':
    case 'numeros':
      return (
        <div className={forma === 'numeros' ? 'mh-numeros' : 'mh-numero'} aria-hidden>
          {Array.from({ length: forma === 'numeros' ? 4 : 1 }, (_, i) => <span key={i}><b /><i style={{ width: `${40 + 40 * azar(id, i)}%` }} /></span>)}
        </div>
      );
    case 'tabla':
    case 'filas':
    case 'lista':
      return (
        <div className={`mh-filas${forma === 'lista' ? ' mh-filas--lista' : ''}`} aria-hidden>
          {Array.from({ length: 6 }, (_, i) => <span key={i}><i style={{ width: `${45 + 45 * azar(id, i)}%` }} /><b /></span>)}
        </div>
      );
    case 'progreso':
      return (
        <div className="mh-progreso" aria-hidden>
          {Array.from({ length: 3 }, (_, i) => <span key={i}><i style={{ width: `${25 + 65 * azar(id, i)}%` }} /></span>)}
        </div>
      );
    case 'semaforo':
      return <div className="mh-semaforo" aria-hidden><span data-c="rojo" /><span data-c="ambar" /><span data-c="verde" /></div>;
    case 'hero':
      return <div className="mh-hero-lineas" aria-hidden><i /><i /><b /></div>;
  }
}

/** Un componente de la plantilla, en su lugar y con su boceto. */
function Pieza({ c }: { c: Componente }): ReactNode {
  if (esGrafico(c)) {
    return (
      <div className="mh-tarjeta">
        <span className="mh-tit">{tituloDe(c)}</span>
        <Boceto forma={formaDe(c.tipo)} id={c.id} />
      </div>
    );
  }
  if (!esElemento(c)) return null;
  switch (c.tipo) {
    case 'texto':
      return <div className={`mh-texto mh-texto--${c.tamano ?? 'm'}`}>{conVariables(c.texto, EJEMPLOS)}</div>;
    case 'seccion':
      return <div className="mh-seccion">{c.texto}</div>;
    case 'general': {
      const p = c.general?.pieza;
      if (!esPiezaGeneral(p)) return null;
      const titulo = c.texto.trim() || piezaGeneral(p).nombre;
      if (p === 'cabecera') {
        return <div className="mh-tarjeta mh-hero"><span className="mh-tit">{titulo}</span><Boceto forma="hero" id={c.id} /></div>;
      }
      return <div className="mh-tarjeta"><span className="mh-tit">{titulo}</span><Boceto forma={formaDeBloque(p)} id={c.id} /></div>;
    }
    case 'linea':
    case 'flecha':
      return <div className="mh-regla" />;
    case 'ia':
      return <div className="mh-tarjeta"><span className="mh-tit">✦ {c.texto || 'Conclusiones de MaKo'}</span><Boceto forma="lista" id={c.id} /></div>;
    case 'accion':
      return <div className="mh-accion">{c.accion?.rotulo || c.texto}</div>;
    default:
      return <div className="mh-tarjeta mh-medio" />;
  }
}

/**
 * La página: la cabecera (el emoji y el nombre de la hoja) y cada componente en su lugar. Lo que no entra en la
 * proporción de la tarjeta se corta abajo, como la miniatura de una landing (que muestra su primera sección).
 */
export function MiniaturaHoja({ hoja, proporcion = '16 / 10' }: { hoja: Hoja | null; proporcion?: string }) {
  return (
    <div className="mh" style={{ aspectRatio: proporcion }}>
      {hoja && (
        <>
          <div className="mh-cabeza"><span aria-hidden>{hoja.emoji}</span> {hoja.nombre}</div>
          {hoja.componentes.map((c) => {
            const pos: CSSProperties = {
              left: `calc(${(c.x / COLS) * 100}% + ${AIRE / 2}cqw)`,
              width: `calc(${(c.w / COLS) * 100}% - ${AIRE}cqw)`,
              top: `${CABEZA + c.y * U}cqw`,
              height: `${Math.max(0.5, c.h * U - AIRE)}cqw`,
            };
            return <div key={c.id} className="mh-pos" style={pos}><Pieza c={c} /></div>;
          })}
        </>
      )}
    </div>
  );
}

// Sin backticks acá adentro: es un template literal. Sólo tokens de la casa (se dan vuelta en oscuro). Los tamaños de
// letra van en cqw: la miniatura es la página a escala, y el texto también.
export const CSS_MINIATURA = `
.mh{position:relative;width:100%;overflow:hidden;container-type:inline-size;background:var(--bg);border-radius:10px;pointer-events:none;user-select:none;font-family:inherit}
.mh-cabeza{position:absolute;left:1.6cqw;top:1.5cqw;right:1.6cqw;font-size:2.4cqw;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2}
.mh-pos{position:absolute;display:flex;min-width:0;min-height:0}
.mh-tarjeta{flex:1;min-width:0;display:flex;flex-direction:column;gap:.8cqw;padding:1.2cqw 1.3cqw;border-radius:1cqw;background:var(--surface);border:max(1px,.1cqw) solid var(--border);overflow:hidden}
.mh-tit{font-size:1.25cqw;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.2;flex:none}
.mh-svg{flex:1;min-height:0;width:100%;display:block}
.mh-svg--cuadrado{align-self:center;width:auto;aspect-ratio:1}
.mh-tinta{fill:color-mix(in srgb,var(--primary) 70%,var(--surface))}
.mh-trazo{stroke:var(--primary)}
.mh-area{fill:color-mix(in srgb,var(--primary) 16%,transparent)}
.mh-pista{stroke:color-mix(in srgb,var(--ink) 10%,transparent)}
.mh-numero,.mh-numeros{flex:1;display:flex;gap:1.2cqw;align-items:center}
.mh-numero span,.mh-numeros span{flex:1;display:flex;flex-direction:column;gap:.6cqw;min-width:0}
.mh-numero b,.mh-numeros b{display:block;height:2.4cqw;width:70%;border-radius:.4cqw;background:var(--ink);opacity:.82}
.mh-numero i,.mh-numeros i{display:block;height:.7cqw;border-radius:.3cqw;background:color-mix(in srgb,var(--ink) 18%,transparent)}
.mh-filas{flex:1;display:flex;flex-direction:column;justify-content:space-between;min-height:0;overflow:hidden}
.mh-filas span{display:flex;align-items:center;gap:1cqw;padding:.35cqw 0;border-top:max(1px,.08cqw) solid var(--border)}
.mh-filas i{display:block;height:.7cqw;border-radius:.3cqw;background:color-mix(in srgb,var(--ink) 22%,transparent)}
.mh-filas b{display:block;margin-left:auto;width:12%;height:.7cqw;border-radius:.3cqw;background:color-mix(in srgb,var(--primary) 55%,transparent)}
.mh-filas--lista b{width:1.6cqw;height:1.6cqw;border-radius:50%}
.mh-progreso{flex:1;display:flex;flex-direction:column;justify-content:space-around}
.mh-progreso span{display:block;height:1cqw;border-radius:.5cqw;background:color-mix(in srgb,var(--ink) 10%,transparent);overflow:hidden}
.mh-progreso i{display:block;height:100%;background:var(--primary)}
.mh-semaforo{flex:1;display:flex;align-items:center;justify-content:center;gap:2cqw}
.mh-semaforo span{width:3.2cqw;height:3.2cqw;border-radius:50%}
.mh-semaforo [data-c="rojo"]{background:var(--bad)}
.mh-semaforo [data-c="ambar"]{background:var(--warn)}
.mh-semaforo [data-c="verde"]{background:var(--good)}
.mh-hero{background:var(--sidebar);border-color:var(--sidebar)}
.mh-hero .mh-tit{color:#fff}
.mh-hero-lineas{flex:1;display:flex;flex-direction:column;gap:.9cqw;justify-content:center}
.mh-hero-lineas i{display:block;height:1cqw;width:60%;border-radius:.4cqw;background:rgba(255,255,255,.35)}
.mh-hero-lineas i + i{width:40%}
.mh-hero-lineas b{display:block;height:1.4cqw;width:85%;border-radius:.7cqw;background:color-mix(in srgb,var(--primary) 80%,#fff)}
.mh-celdas{flex:1;display:flex;flex-wrap:wrap;gap:.5cqw}
.mh-celdas span{flex-basis:28%;border-radius:.4cqw;background:color-mix(in srgb,var(--primary) 60%,var(--surface))}
.mh-mapa{flex:1;border-radius:.6cqw;background:color-mix(in srgb,var(--primary) 18%,var(--surface))}
.mh-texto{flex:1;min-width:0;color:var(--ink);font-weight:700;line-height:1.15;overflow:hidden}
.mh-texto--s{font-size:1.3cqw;font-weight:500;color:var(--dim)}
.mh-texto--m{font-size:1.7cqw;font-weight:600}
.mh-texto--l{font-size:2.4cqw}
.mh-texto--xl{font-size:3.4cqw}
.mh-seccion{flex:1;display:flex;align-items:flex-end;font-size:2cqw;font-weight:700;color:var(--ink);border-bottom:max(1px,.1cqw) solid var(--border)}
.mh-regla{flex:1;align-self:center;height:max(1px,.15cqw);background:var(--border-strong)}
.mh-accion{align-self:flex-start;padding:.6cqw 1.4cqw;border-radius:9999px;background:var(--primary);color:var(--on-primary);font-size:1.2cqw;font-weight:600}
.mh-medio{background:color-mix(in srgb,var(--ink) 6%,var(--surface))}
`;
