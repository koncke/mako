// =============================================================================
// graficos-temas — el estilo del Dashboard es de la PÁGINA, no de cada gráfico
// =============================================================================
// Martín, 11/10/2026 (punto 8 del feedback): «no permitas editar el estilo de cada componente...
// En su lugar, en la topbar de edición poder editar el estilo de toda la página y que impacte a
// todos los componentes. Como lo tenemos en el editor de CURSOS... Que se pueda elegir color,
// tipografía, incluso diferentes plantillas de estilos de diseño. Eso te permite a ti ya
// pre-diseñar los componentes y que queden bien siempre.»
//
// Una hoja guarda TRES cosas: la plantilla (un id de este catálogo cerrado), un acento opcional
// (el primer color de la serie) y una tipografía opcional. Todo lo demás —cómo es la tarjeta, la
// paleta, si hay etiquetas, el grosor del trazo— lo decide la plantilla. Así ningún gráfico puede
// quedar «mal combinado»: el que diseña las combinaciones es este archivo.
//
// ⚠️ MODO OSCURO (punto 17): la tarjeta y el texto van SIEMPRE con tokens de la app (var(--surface),
//    var(--ink), var(--border)…), que se dan vuelta solos con html[data-tema="oscuro"] (globals.css).
//    Lo único en hex son las paletas de series, y cada color se eligió para leerse sobre las DOS
//    superficies (#FFFFFF y #2A2F39): tests/graficos-temas.test.ts mide el contraste.
// ⚠️ SIN `server-only`: lo leen el catálogo, la pantalla y los tests.

import { FUENTES as LETRAS_CURSO } from '../app/_cursos/fuentes';
import { radioDe, trazoDe } from './graficos-gordo';

export type TemaHoja = {
  /** El id de PLANTILLAS_TEMA. Un id que no existe cae a la de MaKo. */
  plantilla: string;
  /** El primer color de las series (y el acento de las KPI), o null = el de la plantilla. */
  acento: string | null;
  /** El id de TIPOGRAFIAS, o null = la de la plantilla. */
  fuente: string | null;
};

export type PlantillaTema = {
  id: string;
  nombre: string;
  /** Una frase corta: es texto de pantalla. */
  linea: string;
  /** Ocho colores de serie, legibles sobre la superficie clara y la oscura. */
  paleta: readonly string[];
  tarjeta: {
    fondo: 'surface' | 'surface-2' | 'transparente';
    borde: 'no' | 'suave' | 'fuerte';
    radio: number;
    sombra: boolean;
    /** El filete de 3 px arriba de una KPI (las tarjetas viejas de Marketing y Comercial). */
    filete: boolean;
  };
  titulo: { tam: number; peso: number; mayus: boolean };
  /** El rótulo de una KPI: en mono y mayúsculas (como las viejas) o en la letra de la hoja. */
  kpi: { etiqueta: 'mono' | 'letra'; tamValor: number };
  graficos: {
    /** Con etiquetas de valor: las que ENTRAN sin pisarse (lib/graficos-gordo.ts), nunca una por punto. */
    etiquetas: boolean;
    leyenda: 'arriba' | 'abajo' | 'no';
    cuadricula: boolean;
    ejes: boolean;
    /**
     * El trazo y el radio que se DIBUJAN (la muestra de app/dashboard/PanelEstilo.tsx los lee de acá). Los
     * pisos son de lib/graficos-gordo.ts —trazo de 3,5 a 5, radio desde 6— y `estiloEfectivo` los aplica
     * igual: una plantilla con un número más chico no adelgaza nada, sólo haría mentir a su muestra.
     */
    trazo: number;
    radioBarra: number;
    compacto: boolean;
  };
  /** La tipografía de la plantilla (id de TIPOGRAFIAS). */
  fuente: string;
};

/** El hex de un color, o null. EN POSITIVO: sólo `#rrggbb` (el valor termina en un `style`). */
export function hexONull(v: unknown): string | null {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : null;
}

// ── Las tipografías: la de MaKo y las del editor de Cursos ────────────────────────────────

export type Tipografia = { id: string; nombre: string; tipo: string; pila: string; hoja: string | null };

/**
 * Geist (la de la app, ya cargada por app/layout.tsx) y las de Cursos (app/_cursos/fuentes.ts), salvo
 * «Archivo», que en el Dashboard no está cargada (la trae la hoja del curso). Las hojas de Google las
 * baja `useHojasDeFuentes` de app/_cursos/SelectorFuente.tsx, una por familia.
 */
export const TIPOGRAFIAS: readonly Tipografia[] = [
  { id: 'geist', nombre: 'Geist', tipo: 'La de MaKo', pila: "'Geist', system-ui, sans-serif", hoja: null },
  ...LETRAS_CURSO.filter((f) => f.id !== 'archivo').map((f) => ({ id: f.id, nombre: f.nombre, tipo: f.tipo, pila: f.pila, hoja: f.hoja })),
];
export const tipografiaDe = (id: string | null | undefined): Tipografia => TIPOGRAFIAS.find((f) => f.id === id) ?? TIPOGRAFIAS[0];

// ── Las plantillas ──────────────────────────────────────────────────────────────────────

/** La paleta de las tabs viejas (el azul de los embudos y los cuatro de Tendencias). */
export const PALETA_MAKO = ['#3B6FB0', '#C8870C', '#0E8E7E', '#6A4BD8', '#D0504A', '#1E9E57', '#B04A8C', '#2E8FB8'] as const;

/**
 * EL CATÁLOGO, CERRADO. El id es lo que se guarda: no se renombra (un id viejo cae a «mako» en el
 * saneo, sin error). El orden es el del menú.
 */
export const PLANTILLAS_TEMA: readonly PlantillaTema[] = [
  {
    id: 'mako', nombre: 'MaKo', linea: 'Las tarjetas de siempre, con el número grande.',
    paleta: PALETA_MAKO,
    tarjeta: { fondo: 'surface', borde: 'suave', radio: 16, sombra: false, filete: true },
    titulo: { tam: 19, peso: 600, mayus: false },
    kpi: { etiqueta: 'mono', tamValor: 44 },
    graficos: { etiquetas: false, leyenda: 'arriba', cuadricula: true, ejes: true, trazo: 4, radioBarra: 8, compacto: false },
    fuente: 'geist',
  },
  {
    id: 'minimal', nombre: 'Minimal', linea: 'Sin cajas: sólo los números y las líneas.',
    paleta: ['#3B6FB0', '#7C8798', '#0E8E7E', '#C8870C', '#6A4BD8', '#A15C38', '#D0504A', '#1E9E57'],
    tarjeta: { fondo: 'transparente', borde: 'no', radio: 0, sombra: false, filete: false },
    titulo: { tam: 16, peso: 600, mayus: false },
    kpi: { etiqueta: 'letra', tamValor: 40 },
    graficos: { etiquetas: false, leyenda: 'abajo', cuadricula: false, ejes: true, trazo: 3.5, radioBarra: 6, compacto: true },
    fuente: 'geist',
  },
  {
    id: 'suave', nombre: 'Suave', linea: 'Tarjetas tenues y esquinas redondas.',
    paleta: ['#4F7FE0', '#E08A3C', '#2E9C90', '#8B6BE0', '#E05C5A', '#3FA066', '#D06AA6', '#3AA2C8'],
    tarjeta: { fondo: 'surface-2', borde: 'no', radio: 22, sombra: false, filete: false },
    titulo: { tam: 18, peso: 600, mayus: false },
    kpi: { etiqueta: 'letra', tamValor: 42 },
    graficos: { etiquetas: false, leyenda: 'arriba', cuadricula: false, ejes: true, trazo: 4, radioBarra: 10, compacto: false },
    fuente: 'nunito',
  },
  {
    id: 'contraste', nombre: 'Contraste', linea: 'Trazos gruesos y etiquetas a la vista.',
    paleta: ['#2B5FB8', '#D97706', '#0B8A6B', '#6D3FD0', '#C53030', '#1E8A43', '#B1306E', '#0F7AB8'],
    tarjeta: { fondo: 'surface', borde: 'fuerte', radio: 6, sombra: false, filete: true },
    titulo: { tam: 18, peso: 700, mayus: true },
    kpi: { etiqueta: 'mono', tamValor: 46 },
    graficos: { etiquetas: true, leyenda: 'arriba', cuadricula: true, ejes: true, trazo: 5, radioBarra: 6, compacto: true },
    fuente: 'atkinson',
  },
  {
    id: 'elevada', nombre: 'Elevada', linea: 'Tarjetas que flotan, sin bordes.',
    paleta: PALETA_MAKO,
    tarjeta: { fondo: 'surface', borde: 'no', radio: 14, sombra: true, filete: false },
    titulo: { tam: 18, peso: 600, mayus: false },
    kpi: { etiqueta: 'letra', tamValor: 42 },
    graficos: { etiquetas: false, leyenda: 'arriba', cuadricula: true, ejes: true, trazo: 4, radioBarra: 8, compacto: false },
    fuente: 'inter',
  },
  {
    id: 'editorial', nombre: 'Editorial', linea: 'Títulos con serif, como un informe impreso.',
    paleta: ['#3E6E9E', '#B5762A', '#2F7D6D', '#6B4FA0', '#B04848', '#3E8A4F', '#9A4D7C', '#3A86A8'],
    tarjeta: { fondo: 'surface', borde: 'suave', radio: 4, sombra: false, filete: true },
    titulo: { tam: 22, peso: 600, mayus: false },
    kpi: { etiqueta: 'mono', tamValor: 42 },
    graficos: { etiquetas: false, leyenda: 'abajo', cuadricula: true, ejes: true, trazo: 3.5, radioBarra: 6, compacto: false },
    fuente: 'lora',
  },
];

export const TEMA_BASE: TemaHoja = { plantilla: 'mako', acento: null, fuente: null };
export const plantillaDe = (id: string | null | undefined): PlantillaTema => PLANTILLAS_TEMA.find((p) => p.id === id) ?? PLANTILLAS_TEMA[0];

/** Lo que llega del navegador o de la base. Corrige en vez de rechazar: un id roto cae a la de MaKo. */
export function sanearTema(raw: unknown): TemaHoja {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const plantilla = PLANTILLAS_TEMA.some((p) => p.id === o.plantilla) ? String(o.plantilla) : TEMA_BASE.plantilla;
  const fuente = TIPOGRAFIAS.some((f) => f.id === o.fuente) ? String(o.fuente) : null;
  return { plantilla, acento: hexONull(o.acento), fuente };
}

// ── Lo que se dibuja ────────────────────────────────────────────────────────────────────

/** Lo que `CuerpoGrafico` necesita saber del estilo: sale ENTERO del tema de la hoja. */
export type EstiloEfectivo = {
  colores: string[];
  etiquetas: boolean;
  leyenda: 'arriba' | 'abajo' | 'derecha' | 'no';
  cuadricula: boolean;
  ejes: boolean;
  compacto: boolean;
  trazo: number;
  radioBarra: number;
  /** Cómo va el rótulo de una KPI. */
  kpiEtiqueta: 'mono' | 'letra';
  kpiTamValor: number;
  /** El filete de las KPI. */
  filete: boolean;
};

/** La paleta efectiva: la de la plantilla, con el acento elegido adelante. */
export function paletaDe(tema: TemaHoja): string[] {
  const p = plantillaDe(tema.plantilla).paleta.slice();
  if (tema.acento) { p[0] = tema.acento; }
  return p;
}

export function estiloEfectivo(tema: TemaHoja): EstiloEfectivo {
  const p = plantillaDe(tema.plantilla);
  return {
    colores: paletaDe(tema),
    etiquetas: p.graficos.etiquetas,
    leyenda: p.graficos.leyenda,
    cuadricula: p.graficos.cuadricula,
    ejes: p.graficos.ejes,
    compacto: p.graficos.compacto,
    // Los pisos del sistema «gordo» (punto 13): ninguna plantilla los baja.
    trazo: trazoDe(p.graficos.trazo),
    radioBarra: radioDe(p.graficos.radioBarra),
    kpiEtiqueta: p.kpi.etiqueta,
    kpiTamValor: p.kpi.tamValor,
    filete: p.tarjeta.filete,
  };
}

/**
 * Las variables CSS que pinta la hoja (en el `style` del contenedor del lienzo). La tarjeta, el
 * título y la letra las leen con su respaldo (`var(--dash-…, …)`), así una hoja sin tema se ve igual
 * que la de MaKo. Sólo tokens de la app y números: nada que no se dé vuelta en oscuro.
 */
export function varsDeTema(tema: TemaHoja): Record<string, string> {
  const p = plantillaDe(tema.plantilla);
  const letra = tipografiaDe(tema.fuente ?? p.fuente);
  const fondo = p.tarjeta.fondo === 'surface' ? 'var(--surface)' : p.tarjeta.fondo === 'surface-2' ? 'var(--surface-2)' : 'transparent';
  const borde = p.tarjeta.borde === 'no' ? 'transparent' : p.tarjeta.borde === 'fuerte' ? 'var(--border-strong)' : 'var(--border)';
  return {
    '--dash-letra': letra.pila,
    '--dash-tarjeta-fondo': fondo,
    '--dash-tarjeta-borde': borde,
    '--dash-tarjeta-radio': `${p.tarjeta.radio}px`,
    '--dash-tarjeta-sombra': p.tarjeta.sombra ? '0 1px 2px rgba(18,21,27,.06), 0 8px 24px rgba(18,21,27,.08)' : 'none',
    '--dash-tarjeta-pad': p.tarjeta.fondo === 'transparente' ? '8px 4px' : '20px 22px',
    '--dash-titulo-tam': `${p.titulo.tam}px`,
    '--dash-titulo-peso': String(p.titulo.peso),
    '--dash-titulo-mayus': p.titulo.mayus ? 'uppercase' : 'none',
    '--dash-titulo-espacio': p.titulo.mayus ? '.04em' : '-0.015em',
    '--dash-acento': paletaDe(tema)[0],
  };
}

/**
 * El color del FONDO sobre el que se dibuja un gráfico (el de la tarjeta; sin tarjeta, el de la página): es el
 * halo de las etiquetas de valor y el borde de los puntos (lib/graficos-gordo.ts). Un token: se da vuelta solo.
 */
export function fondoDeTarjeta(tema: TemaHoja): string {
  const f = plantillaDe(tema.plantilla).tarjeta.fondo;
  return f === 'surface' ? 'var(--surface)' : f === 'surface-2' ? 'var(--surface-2)' : 'var(--bg)';
}

/** Las tipografías que una hoja necesita bajar (para `useHojasDeFuentes`). */
export function letrasDe(tema: TemaHoja): string[] {
  const id = tema.fuente ?? plantillaDe(tema.plantilla).fuente;
  return tipografiaDe(id).hoja ? [id] : [];
}

/**
 * El color de una KPI según lo que SIGNIFICA su métrica (lo cobrado es bueno, lo pendiente es malo),
 * no según un color elegido a mano: con el estilo por página, el significado tiene que salir del
 * dato. `null` = neutra (filete gris, número en tinta).
 */
export function colorDeTono(tono: 'bueno' | 'malo' | 'acento' | null | undefined, tema: TemaHoja): string | null {
  if (tono === 'bueno') return 'var(--good)';
  if (tono === 'malo') return 'var(--bad)';
  if (tono === 'acento') return paletaDe(tema)[1] ?? paletaDe(tema)[0];
  return null;
}
