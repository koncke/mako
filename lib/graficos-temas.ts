// =============================================================================
// graficos-temas — el estilo del Dashboard es de la PÁGINA, no de cada gráfico
// =============================================================================
// Martín, 11/10/2026 (punto 8 del feedback): «no permitas editar el estilo de cada componente...
// En su lugar, en la topbar de edición poder editar el estilo de toda la página y que impacte a
// todos los componentes. Como lo tenemos en el editor de CURSOS... Que se pueda elegir color,
// tipografía, incluso diferentes plantillas de estilos de diseño. Eso te permite a ti ya
// pre-diseñar los componentes y que queden bien siempre.»
//
// Una hoja guarda la plantilla (un id de este catálogo cerrado), un acento opcional (el primer color de
// la serie) y una tipografía opcional. Desde el 17/10/2026 también los AJUSTES (`AJUSTES_TEMA`): las
// esquinas, el borde, la sombra y el fondo de las tarjetas, las etiquetas, la leyenda y la cuadrícula de
// los gráficos y los títulos en mayúsculas (Martín, del desplegable «Estilo de la hoja»: «deberías mejorar
// ese desplegable de estilos, ya que quedó limitado»). Cada ajuste es un valor de un conjunto cerrado y,
// sin tocar, es el de la plantilla: la combinación la sigue diseñando este archivo, la persona elige entre
// opciones que ya se ven bien. El paleta, el trazo y los rótulos de las KPI siguen siendo de la plantilla.
//
// ⚠️ MODO OSCURO (punto 17): la tarjeta y el texto van SIEMPRE con tokens de la app (var(--surface),
//    var(--ink), var(--border)…), que se dan vuelta solos con html[data-tema="oscuro"] (globals.css).
//    Lo único en hex son las paletas de series, y cada color se eligió para leerse sobre las DOS
//    superficies (#FFFFFF y #2A2F39): tests/graficos-temas.test.ts mide el contraste.
// ⚠️ SIN `server-only`: lo leen el catálogo, la pantalla y los tests.

import { FUENTES as LETRAS_CURSO } from '../app/_cursos/fuentes';
import { radioDe, trazoDe } from './graficos-gordo';
import { PALETAS_CORBEL, seriesDeEscena, type EscenaCorbel } from './graficos-corbel';

export type TemaHoja = {
  /** El id de PLANTILLAS_TEMA. Un id que no existe cae a la de MaKo. */
  plantilla: string;
  /** El primer color de las series (y el acento de las KPI), o null = el de la plantilla. */
  acento: string | null;
  /** El id de TIPOGRAFIAS, o null = la de la plantilla. */
  fuente: string | null;
} & AjustesTema;

/**
 * Los ajustes encima de la plantilla (17/10/2026). Ausente = el de la plantilla: una hoja de antes no trae ninguno y
 * se ve igual, y `sanearTema` sólo deja los que tienen un valor del conjunto.
 */
export type AjustesTema = {
  esquinas?: 'rectas' | 'suaves' | 'redondas';
  borde?: 'no' | 'suave' | 'fuerte';
  sombra?: 'no' | 'si';
  fondo?: 'surface' | 'surface-2' | 'transparente';
  etiquetas?: 'no' | 'si';
  leyenda?: 'arriba' | 'abajo' | 'no';
  cuadricula?: 'no' | 'si';
  titulos?: 'normal' | 'mayus';
};

/**
 * El catálogo de los ajustes, con lo que se ve en el panel: el grupo, el nombre y sus valores. La pantalla los dibuja
 * de acá (app/dashboard/PanelEstilo.tsx) y el saneo los valida de acá: un ajuste nuevo es una fila.
 */
export const AJUSTES_TEMA = [
  { id: 'fondo', grupo: 'Tarjetas', nombre: 'Fondo', valores: [{ id: 'surface', nombre: 'Blanco' }, { id: 'surface-2', nombre: 'Gris' }, { id: 'transparente', nombre: 'Sin caja' }] },
  { id: 'esquinas', grupo: 'Tarjetas', nombre: 'Esquinas', valores: [{ id: 'rectas', nombre: 'Rectas' }, { id: 'suaves', nombre: 'Suaves' }, { id: 'redondas', nombre: 'Redondas' }] },
  { id: 'borde', grupo: 'Tarjetas', nombre: 'Borde', valores: [{ id: 'no', nombre: 'Sin borde' }, { id: 'suave', nombre: 'Suave' }, { id: 'fuerte', nombre: 'Marcado' }] },
  { id: 'sombra', grupo: 'Tarjetas', nombre: 'Sombra', valores: [{ id: 'no', nombre: 'Sin sombra' }, { id: 'si', nombre: 'Flotan' }] },
  { id: 'titulos', grupo: 'Tarjetas', nombre: 'Títulos', valores: [{ id: 'normal', nombre: 'Normal' }, { id: 'mayus', nombre: 'MAYÚSCULAS' }] },
  { id: 'etiquetas', grupo: 'Gráficos', nombre: 'Valores', valores: [{ id: 'no', nombre: 'Ocultos' }, { id: 'si', nombre: 'A la vista' }] },
  { id: 'leyenda', grupo: 'Gráficos', nombre: 'Leyenda', valores: [{ id: 'arriba', nombre: 'Arriba' }, { id: 'abajo', nombre: 'Abajo' }, { id: 'no', nombre: 'Sin leyenda' }] },
  { id: 'cuadricula', grupo: 'Gráficos', nombre: 'Cuadrícula', valores: [{ id: 'no', nombre: 'Sin líneas' }, { id: 'si', nombre: 'Con líneas' }] },
] as const satisfies ReadonlyArray<{ id: keyof AjustesTema; grupo: string; nombre: string; valores: ReadonlyArray<{ id: string; nombre: string }> }>;

export type IdAjuste = keyof AjustesTema;

/** El radio de cada «Esquinas». Las plantillas usan de 0 a 22: rectas como Editorial, redondas como Suave. */
const RADIO_ESQUINAS: Record<NonNullable<AjustesTema['esquinas']>, number> = { rectas: 4, suaves: 14, redondas: 22 };
const esquinasDe = (radio: number): NonNullable<AjustesTema['esquinas']> => (radio <= 8 ? 'rectas' : radio <= 17 ? 'suaves' : 'redondas');

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
  kpi: { etiqueta: 'mono' | 'letra'; tamValor: number; /** El tope del número: fijo, como en Corbel. Sin tope, llena su tarjeta. */ maximo?: number; maximoPortada?: number };
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
    /** El ancho tope de una columna. Sin esto, el de lib/graficos-gordo.ts. */
    anchoBarra?: number;
  };
  /** La tipografía de la plantilla (id de TIPOGRAFIAS). */
  fuente: string;
  /** Una paleta de Corbel (lib/graficos-corbel.ts): la hoja se pinta con sus tokens, en claro y en oscuro. */
  escena?: EscenaCorbel;
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
  { id: 'urb', nombre: 'Urbanist', tipo: 'Geométrica', pila: "'Urbanist', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif", hoja: 'https://fonts.googleapis.com/css2?family=Urbanist:wght@400;500;600;700&display=swap' },
  ...LETRAS_CURSO.filter((f) => f.id !== 'archivo').map((f) => ({ id: f.id, nombre: f.nombre, tipo: f.tipo, pila: f.pila, hoja: f.hoja })),
];
export const tipografiaDe = (id: string | null | undefined): Tipografia => TIPOGRAFIAS.find((f) => f.id === id) ?? TIPOGRAFIAS[0];

// ── Las plantillas ──────────────────────────────────────────────────────────────────────

/** La paleta de las tabs viejas (el azul de los embudos y los cuatro de Tendencias). */
export const PALETA_MAKO = ['#3B6FB0', '#C8870C', '#0E8E7E', '#6A4BD8', '#D0504A', '#1E9E57', '#B04A8C', '#2E8FB8'] as const;

/** Un estilo de Corbel: todo igual (el esqueleto de su demo) menos la paleta. */
function conEscena(id: string, nombre: string, linea: string, escena: EscenaCorbel): PlantillaTema {
  return {
    id, nombre, linea, escena,
    paleta: seriesDeEscena(escena),
    tarjeta: { fondo: 'surface', borde: 'no', radio: 22, sombra: true, filete: false },
    titulo: { tam: 15, peso: 600, mayus: false },
    kpi: { etiqueta: 'letra', tamValor: 26, maximo: 26, maximoPortada: 34 },
    // El riel de Corbel: 30 de ancho tope y el extremo redondo. Sólido: su rayado acá significa «Estimado».
    graficos: { etiquetas: false, leyenda: 'arriba', cuadricula: true, ejes: true, trazo: 3.5, radioBarra: 15, compacto: false, anchoBarra: 30 },
    fuente: 'urb',
  };
}

/**
 * EL CATÁLOGO, CERRADO. El id es lo que se guarda: no se renombra (un id viejo cae a «mako» en el
 * saneo, sin error). El orden es el del menú.
 */
export const PLANTILLAS_TEMA: readonly PlantillaTema[] = [
  // ⚠️ LOS IDS SON CORTOS A PROPÓSITO: viajan como `enum` en cambiar_ficha_funnel, que va en CADA turno de WhatsApp, y su tope
  // lo mide tests/ficha-api.test.ts. Y son lo que se guarda: renombrar uno ya usado deja a sus hojas en la de por defecto, sin error.
  // EL DE POR DEFECTO (Martín, 31/10/2026: «tipo blanco y negro… el más sólido»): Corbel, con sus valores
  // (lib/graficos-corbel.ts). El id sigue siendo «mako» porque el id es lo que se guarda: toda hoja que nunca eligió otro
  // pasa a este sin migrar nada. Lo que antes era «MaKo» sigue, elegible, como «Clásica».
  conEscena('mako', 'Blanco y negro', 'Negro sobre gris: el más sólido.', 'mono'),
  conEscena('pastel', 'Pastel', 'Tiles de color claro y azul de acento.', 'pastel'),
  conEscena('azul', 'Océano', 'Azules de punta a punta.', 'ocean'),
  conEscena('verde', 'Salvia', 'Verdes tranquilos.', 'sage'),
  {
    id: 'vieja', nombre: 'Clásica', linea: 'Las tarjetas de antes, con el número grande.',
    paleta: PALETA_MAKO,
    tarjeta: { fondo: 'surface', borde: 'suave', radio: 16, sombra: false, filete: true },
    titulo: { tam: 21, peso: 600, mayus: false },
    kpi: { etiqueta: 'mono', tamValor: 44 },
    graficos: { etiquetas: false, leyenda: 'arriba', cuadricula: true, ejes: true, trazo: 4, radioBarra: 8, compacto: false },
    fuente: 'geist',
  },
  {
    id: 'minimal', nombre: 'Minimal', linea: 'Sin cajas: sólo los números y las líneas.',
    paleta: ['#3B6FB0', '#7C8798', '#0E8E7E', '#C8870C', '#6A4BD8', '#A15C38', '#D0504A', '#1E9E57'],
    tarjeta: { fondo: 'transparente', borde: 'no', radio: 0, sombra: false, filete: false },
    titulo: { tam: 18, peso: 600, mayus: false },
    kpi: { etiqueta: 'letra', tamValor: 40 },
    graficos: { etiquetas: false, leyenda: 'abajo', cuadricula: false, ejes: true, trazo: 3.5, radioBarra: 6, compacto: true },
    fuente: 'geist',
  },
  {
    id: 'suave', nombre: 'Suave', linea: 'Tarjetas tenues y esquinas redondas.',
    paleta: ['#4F7FE0', '#E08A3C', '#2E9C90', '#8B6BE0', '#E05C5A', '#3FA066', '#D06AA6', '#3AA2C8'],
    tarjeta: { fondo: 'surface-2', borde: 'no', radio: 22, sombra: false, filete: false },
    titulo: { tam: 20, peso: 600, mayus: false },
    kpi: { etiqueta: 'letra', tamValor: 42 },
    graficos: { etiquetas: false, leyenda: 'arriba', cuadricula: false, ejes: true, trazo: 4, radioBarra: 10, compacto: false },
    fuente: 'nunito',
  },
  {
    id: 'contraste', nombre: 'Contraste', linea: 'Trazos gruesos y etiquetas a la vista.',
    paleta: ['#2B5FB8', '#D97706', '#0B8A6B', '#6D3FD0', '#C53030', '#1E8A43', '#B1306E', '#0F7AB8'],
    tarjeta: { fondo: 'surface', borde: 'fuerte', radio: 6, sombra: false, filete: true },
    titulo: { tam: 20, peso: 700, mayus: true },
    kpi: { etiqueta: 'mono', tamValor: 46 },
    graficos: { etiquetas: true, leyenda: 'arriba', cuadricula: true, ejes: true, trazo: 5, radioBarra: 6, compacto: true },
    fuente: 'atkinson',
  },
  {
    id: 'elevada', nombre: 'Elevada', linea: 'Tarjetas que flotan, sin bordes.',
    paleta: PALETA_MAKO,
    tarjeta: { fondo: 'surface', borde: 'no', radio: 14, sombra: true, filete: false },
    titulo: { tam: 20, peso: 600, mayus: false },
    kpi: { etiqueta: 'letra', tamValor: 42 },
    graficos: { etiquetas: false, leyenda: 'arriba', cuadricula: true, ejes: true, trazo: 4, radioBarra: 8, compacto: false },
    fuente: 'inter',
  },
  // El de las plantillas de General: lo mismo que el de por defecto desde el 31/10/2026 (Martín, mirando una: «Quiero todo nuevo...
  // Guiate en lo que copiamos»). El id sigue porque es lo que guardan esas hojas: sin él, quedaban afuera sin avisar.
  conEscena('general', 'General', 'El blanco y negro, para leer de una pasada.', 'mono'),
  {
    id: 'editorial', nombre: 'Editorial', linea: 'Títulos con serif, como un informe impreso.',
    paleta: ['#3E6E9E', '#B5762A', '#2F7D6D', '#6B4FA0', '#B04848', '#3E8A4F', '#9A4D7C', '#3A86A8'],
    tarjeta: { fondo: 'surface', borde: 'suave', radio: 4, sombra: false, filete: true },
    titulo: { tam: 24, peso: 600, mayus: false },
    kpi: { etiqueta: 'mono', tamValor: 42 },
    graficos: { etiquetas: false, leyenda: 'abajo', cuadricula: true, ejes: true, trazo: 3.5, radioBarra: 6, compacto: false },
    fuente: 'lora',
  },
];

export const TEMA_BASE: TemaHoja = { plantilla: 'mako', acento: null, fuente: null };
export const plantillaDe = (id: string | null | undefined): PlantillaTema => PLANTILLAS_TEMA.find((p) => p.id === id) ?? PLANTILLAS_TEMA[0];

/**
 * Lo que llega del navegador o de la base. Corrige en vez de rechazar: un id roto cae a la de MaKo. Un ajuste sólo
 * queda si su valor es del catálogo Y distinto del de la plantilla: elegir el de la plantilla es volver a ella (así
 * cambiar de plantilla después trae lo suyo), y un tema sin ajustes es igual a uno de antes.
 */
export function sanearTema(raw: unknown): TemaHoja {
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const plantilla = PLANTILLAS_TEMA.some((p) => p.id === o.plantilla) ? String(o.plantilla) : TEMA_BASE.plantilla;
  const fuente = TIPOGRAFIAS.some((f) => f.id === o.fuente) ? String(o.fuente) : null;
  const tema: TemaHoja = { plantilla, acento: hexONull(o.acento), fuente };
  const dePlantilla = ajustesDePlantilla(plantillaDe(plantilla));
  for (const a of AJUSTES_TEMA) {
    const v = o[a.id];
    const valores: ReadonlyArray<{ id: string }> = a.valores;
    if (typeof v === 'string' && valores.some((x) => x.id === v) && v !== dePlantilla[a.id]) (tema as Record<string, unknown>)[a.id] = v;
  }
  return tema;
}

/** Lo que la plantilla trae en cada ajuste: el valor «sin tocar» que el panel muestra elegido. */
export function ajustesDePlantilla(p: PlantillaTema): Required<AjustesTema> {
  return {
    fondo: p.tarjeta.fondo,
    esquinas: esquinasDe(p.tarjeta.radio),
    borde: p.tarjeta.borde,
    sombra: p.tarjeta.sombra ? 'si' : 'no',
    titulos: p.titulo.mayus ? 'mayus' : 'normal',
    etiquetas: p.graficos.etiquetas ? 'si' : 'no',
    leyenda: p.graficos.leyenda,
    cuadricula: p.graficos.cuadricula ? 'si' : 'no',
  };
}

/** El valor de un ajuste en esta hoja: el elegido, o el de la plantilla. */
export const ajusteDe = <K extends IdAjuste>(tema: TemaHoja, id: K): NonNullable<AjustesTema[K]> =>
  (tema[id] ?? ajustesDePlantilla(plantillaDe(tema.plantilla))[id]) as NonNullable<AjustesTema[K]>;

/** ¿La hoja cambió algo del estilo de siempre? (la plantilla de MaKo, sin acento, sin letra ni ajustes). */
export const temaPropio = (tema: TemaHoja): boolean =>
  tema.plantilla !== TEMA_BASE.plantilla || !!tema.acento || !!tema.fuente || AJUSTES_TEMA.some((a) => tema[a.id] != null);

/**
 * La plantilla con los ajustes de la hoja encima: lo que se DIBUJA. Todo lo que pinta una tarjeta o un gráfico pasa
 * por acá (`estiloEfectivo`, `varsDeTema`, `fondoDeTarjeta` y la muestra del panel), así un ajuste no puede verse en
 * un lugar y no en otro. Con las esquinas rectas en una plantilla sin caja, el radio de la caja no se ve: es correcto.
 */
export function plantillaEfectiva(tema: TemaHoja): PlantillaTema {
  const p = plantillaDe(tema.plantilla);
  const fondo = tema.fondo ?? p.tarjeta.fondo;
  return {
    ...p,
    tarjeta: {
      ...p.tarjeta,
      fondo,
      borde: tema.borde ?? p.tarjeta.borde,
      radio: tema.esquinas ? RADIO_ESQUINAS[tema.esquinas] : p.tarjeta.radio,
      sombra: tema.sombra ? tema.sombra === 'si' : p.tarjeta.sombra,
    },
    titulo: { ...p.titulo, mayus: tema.titulos ? tema.titulos === 'mayus' : p.titulo.mayus },
    graficos: {
      ...p.graficos,
      etiquetas: tema.etiquetas ? tema.etiquetas === 'si' : p.graficos.etiquetas,
      leyenda: tema.leyenda ?? p.graficos.leyenda,
      cuadricula: tema.cuadricula ? tema.cuadricula === 'si' : p.graficos.cuadricula,
    },
  };
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
  /** El ancho tope de una columna (o el de lib/graficos-gordo.ts). */
  anchoBarra?: number;
  /** Cómo va el rótulo de una KPI. */
  kpiEtiqueta: 'mono' | 'letra';
  kpiTamValor: number;
  /** El tope del número de una tarjeta y el de una portada. Sin tope, llena lo que tenga. */
  kpiMaximo?: number;
  kpiMaximoPortada?: number;
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
  const p = plantillaEfectiva(tema);
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
    anchoBarra: p.graficos.anchoBarra,
    kpiEtiqueta: p.kpi.etiqueta,
    kpiTamValor: p.kpi.tamValor,
    kpiMaximo: p.kpi.maximo,
    kpiMaximoPortada: p.kpi.maximoPortada,
    filete: p.tarjeta.filete,
  };
}

/**
 * Las variables CSS que pinta la hoja (en el `style` del contenedor del lienzo). La tarjeta, el
 * título y la letra las leen con su respaldo (`var(--dash-…, …)`), así una hoja sin tema se ve igual
 * que la de MaKo. Sólo tokens de la app y números: nada que no se dé vuelta en oscuro.
 */
export function varsDeTema(tema: TemaHoja): Record<string, string> {
  const p = plantillaEfectiva(tema);
  const letra = tipografiaDe(tema.fuente ?? p.fuente);
  // Con Corbel la tarjeta es de vidrio y la sombra lleva el borde interior de luz (el respaldo es para una hoja sin `data-paleta`).
  const fondo = p.tarjeta.fondo === 'surface' ? (p.escena ? 'var(--cb-glass, var(--surface))' : 'var(--surface)') : p.tarjeta.fondo === 'surface-2' ? 'var(--surface-2)' : 'transparent';
  const borde = p.tarjeta.borde === 'no' ? 'transparent' : p.tarjeta.borde === 'fuerte' ? 'var(--border-strong)' : 'var(--border)';
  const sombra = !p.tarjeta.sombra ? 'none' : p.escena ? 'inset 0 0 0 1px var(--cb-rim, transparent), var(--cb-shadow, 0 1px 2px rgba(18,21,27,.06))' : '0 1px 2px rgba(18,21,27,.06), 0 8px 24px rgba(18,21,27,.08)';
  return {
    '--dash-letra': letra.pila,
    '--dash-tarjeta-fondo': fondo,
    '--dash-tarjeta-borde': borde,
    '--dash-tarjeta-radio': `${p.tarjeta.radio}px`,
    '--dash-tarjeta-sombra': sombra,
    '--dash-tarjeta-pad': p.tarjeta.fondo === 'transparente' ? '8px 4px' : p.escena ? '20px' : '20px 22px',
    '--dash-titulo-tam': `${p.titulo.tam}px`,
    '--dash-titulo-peso': String(p.titulo.peso),
    '--dash-titulo-mayus': p.titulo.mayus ? 'uppercase' : 'none',
    '--dash-titulo-espacio': p.titulo.mayus ? '.04em' : p.escena ? '-0.075px' : '-0.015em',
    '--dash-acento': paletaDe(tema)[0],
  };
}

/** El valor de `data-paleta` de una hoja (lib/graficos-corbel.ts), o undefined si su estilo no es de Corbel. */
export const paletaDeEscena = (tema: TemaHoja): EscenaCorbel | undefined => plantillaDe(tema.plantilla).escena;

/**
 * El color con que se pinta una PORTADA en esta hoja: el que eligió (`acento`), el negro de su paleta de Corbel (que no
 * cambia por plantilla: la tapa de color de cada una es de «Clásica»), o null = el de su identidad. En hex porque las
 * series de la portada se mezclan con él; lo que se ve lo pisa `--cb-ocean`, que además cambia en oscuro.
 */
export function acentoDePortada(tema: TemaHoja): string | null {
  if (tema.acento) return tema.acento;
  const escena = paletaDeEscena(tema);
  return escena ? PALETAS_CORBEL[escena].claro['--cb-ocean'] : null;
}

/**
 * ¿Esta pieza se pinta como portada? Con Corbel, sólo si entra en media hoja: el negro va en un tercio y nunca como encabezado
 * (Martín: «No es necesario tener esa barra negra gigante»). Una tapa a lo ancho de una hoja guardada se dibuja en vidrio, sin
 * moverle nada: lo que cambia es cómo se dibuja, no el dato.
 */
export const pintaPortada = (c: { w: number }, tema: TemaHoja): boolean => !paletaDeEscena(tema) || c.w <= 6;

/**
 * El color del FONDO sobre el que se dibuja un gráfico (el de la tarjeta; sin tarjeta, el de la página): es el
 * halo de las etiquetas de valor y el borde de los puntos (lib/graficos-gordo.ts). Un token: se da vuelta solo.
 */
export function fondoDeTarjeta(tema: TemaHoja): string {
  const f = plantillaEfectiva(tema).tarjeta.fondo;
  return f === 'surface' ? 'var(--surface)' : f === 'surface-2' ? 'var(--surface-2)' : 'var(--bg)';
}

/** Las tipografías que una hoja necesita bajar (para `useHojasDeFuentes`). */
export function letrasDe(tema: TemaHoja): string[] {
  const id = tema.fuente ?? plantillaDe(tema.plantilla).fuente;
  return tipografiaDe(id).hoja ? [id] : [];
}

// ── EL VOCABULARIO DE MEDIDO CONTRA NO MEDIDO ───────────────────────────────────────────
// Un número ESTIMADO no se dibuja igual que uno MEDIDO. Hasta el 31/10/2026 se dibujaban
// igual: un pronóstico y una medición compartían el mismo relleno sólido, así que la
// pantalla afirmaba con la misma voz lo que leyó y lo que supuso.
//
// Ya teníamos la mitad de la regla escrita (`AGENTS.md`: «lo que no se puede medir no se
// estima: el campo queda en `null` y ni la pantalla ni la API dicen una palabra — nunca un
// cero, nunca un "falta"»). Esto es la OTRA mitad: cómo se ve un número no medido cuando sí
// decidimos mostrarlo.
//
// ⚠️ Por qué es un vocabulario CERRADO de cinco, y no cinco decisiones sueltas: tenemos 46
// tipos de gráfico y el usuario los mezcla en la misma hoja. Mirando 114 tableros ajenos
// (docs/diseno-dashboards-codeandchill.md, §E2) el mismo punteado significaba un umbral en
// uno, otro período en otro y otra unidad en un tercero. Cada recurso significa UNA cosa.
//
// ⚠️ Esto NO autoriza a inventar un dato. Marcar algo como `no-medido` requiere que el dato
// SEPA que no fue medido. Si no se sabe, no se muestra la afirmación.

/**
 * De dónde salió lo que se está dibujando. Cada valor tiene un recurso visual propio y
 * ninguno pisa a otro.
 */
export type Procedencia =
  /** Pasó y lo leímos. Relleno y trazo SÓLIDOS. Es el que no hace falta declarar. */
  | 'medido'
  /** Proyectado, comprometido o todavía no ocurrido. RAYADO en diagonal (o trazo punteado). */
  | 'no-medido'
  /** Un hueco que todavía no pasó (la hora de hoy que aún no corrió). CONTORNO sin relleno. */
  | 'hueco'
  /** Otro período (el mes anterior, el año pasado). El MISMO color, en tono más claro. */
  | 'otro-periodo'
  /** Un umbral o una meta (la cuota, el tope de gasto). Línea FINA de 1 px, y con rótulo. */
  | 'umbral';

/**
 * Qué significa cada recurso, en palabras. Lo lee la leyenda cuando una hoja mezcla
 * procedencias, y lo leen los tests para que nadie agregue un sexto recurso sin nombrarlo.
 */
export const VOCABULARIO: Record<Procedencia, { nombre: string; comoSeVe: string }> = {
  medido: { nombre: 'Medido', comoSeVe: 'Relleno sólido' },
  'no-medido': { nombre: 'Estimado', comoSeVe: 'Rayado en diagonal' },
  hueco: { nombre: 'Todavía no pasó', comoSeVe: 'Contorno sin relleno' },
  'otro-periodo': { nombre: 'Período anterior', comoSeVe: 'El mismo color, más claro' },
  umbral: { nombre: 'Meta', comoSeVe: 'Línea fina con rótulo' },
};

/**
 * Un color aclarado hacia el blanco: `t` = 1 es el color tal cual, 0 es blanco. Es el tono de
 * «otro período», y lo usa también el degradado de las áreas.
 *
 * ⚠️ Aclara hacia el BLANCO, no hacia la superficie: en el tema oscuro un tono más claro
 * sigue leyéndose como «el mismo color, más suave», que es lo que la regla pide.
 */
export function aclarar(hex: string, t: number): string {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex.startsWith('var(') ? `color-mix(in srgb, ${hex} ${Math.round(t * 100)}%, white)` : hex;
  const n = parseInt(m[1], 16);
  const canal = (c: number) => Math.round(255 - (255 - c) * t).toString(16).padStart(2, '0');
  return `#${canal((n >> 16) & 255)}${canal((n >> 8) & 255)}${canal(n & 255)}`;
}

/** Cuánto se aclara el tono de «otro período»: el mismo color, reconocible, claramente detrás. */
export const ACLARADO_OTRO_PERIODO = 0.42;

/**
 * El id del `<pattern>` de rayado de un color. Se deriva del COLOR y no del gráfico, así dos
 * bloques de la misma hoja comparten un solo patrón y el id es estable entre renders.
 */
export const idRayado = (color: string): string => `rayado-${color.replace(/[^0-9a-z]/gi, '')}`;

/** Lo que se le pasa a una marca de SVG para que se dibuje con su procedencia. */
export type Pintura = {
  fill: string;
  fillOpacity: number;
  stroke: string;
  strokeWidth: number;
  /** Presente sólo donde el trazo va cortado. */
  strokeDasharray?: string;
};

/**
 * Cómo se pinta una marca según de dónde salió su número. `trazo` es el grosor de la hoja
 * (`EstiloEfectivo.trazo`), que los pisos del sistema «gordo» ya garantizan.
 *
 * El rayado se devuelve como `url(#…)`: quien dibuja tiene que haber emitido el `<pattern>`
 * (app/dashboard/graficos/Vocabulario.tsx), o el relleno sale vacío.
 */
export function pinturaDe(proc: Procedencia, color: string, trazo: number): Pintura {
  switch (proc) {
    case 'no-medido':
      // Rayado: el color está en las rayas, y el contorno sólido mantiene la forma legible.
      return { fill: `url(#${idRayado(color)})`, fillOpacity: 1, stroke: color, strokeWidth: 1, strokeDasharray: '5 4' };
    case 'hueco':
      // Sin relleno: el contorno dice «acá va a haber algo», no «acá hay cero».
      return { fill: 'transparent', fillOpacity: 0, stroke: color, strokeWidth: 1.5, strokeDasharray: '3 3' };
    case 'otro-periodo':
      return { fill: aclarar(color, ACLARADO_OTRO_PERIODO), fillOpacity: 1, stroke: aclarar(color, ACLARADO_OTRO_PERIODO), strokeWidth: trazo };
    case 'umbral':
      // Fina de 1 px: es lo que la distingue de una serie (que va de 3,5 a 5). Y va con rótulo.
      return { fill: 'transparent', fillOpacity: 0, stroke: color, strokeWidth: 1, strokeDasharray: '6 5' };
    case 'medido':
    default:
      return { fill: color, fillOpacity: 1, stroke: color, strokeWidth: trazo };
  }
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
