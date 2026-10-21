// =============================================================================
// dashboard-bloques — lo que el chat DIBUJA cuando se confirma un cambio del Dashboard
// =============================================================================
// Ops Center = lo principal (20/10/2026, docs/ops-center-principal.md, pieza 2.7, la parte del Dashboard), sobre el
// marco de bloques de Ops Center 3 (pieza 1.7, lib/chat-bloques.ts): una operación devuelve `datos.bloque` y el hilo lo
// dibuja con `BloqueHilo` (app/_chat/BloqueHilo.tsx), en la computadora y en el teléfono.
//
// Lo arma UN lugar: `aplicar` (lib/api-mako/areas/dashboard.run.ts), el ejecutar() de todas las acciones que cambian el
// informe, con el cambio confirmado y el informe de ANTES y el que quedó GUARDADO:
//   · crear o duplicar una hoja, agregar una tarjeta → G5 «creado», con «Abrir en el Dashboard» en esa hoja;
//   · renombrar o restilar una hoja, editar o mover una tarjeta, quitarla, los filtros, «Editar con MaKo», archivar una
//     hoja, restablecer el informe → G4 «antes y después», fila por fila.
//
// ⚠️ Puro y armado por CÓDIGO: los nombres salen del informe guardado, nunca del texto del modelo, y el link es una ruta
//    de la app (`/dashboard?hoja=<id>`) a la que la pantalla le suma el `?ws=` de quien mira. Lo que no tiene nada que
//    mostrar (un cambio que no dejó diferencia, un conector) devuelve null y el chat dibuja sólo el «Hecho».
// ⚠️ Una hoja no tiene una imagen guardada: el G5 de una hoja va sin miniatura y SIN medidas. Con `16 × 10` (la forma)
//    el marco vacío escribía «16 × 10», que se lee como el tamaño de una imagen (revisión del 21/10).
// ⚠️ «Abrir en el Dashboard» abre el informe de quien MIRA (`/dashboard` lee el de la sesión): el de un cambio en el informe
//    de OTRA persona va sin botón y con su nombre en el título (`enInformeDe`).
// =============================================================================

import type { Bloque as BloqueChat } from '@/lib/chat-bloques';
import { PLANTILLAS_TEMA } from '@/lib/graficos-temas';
import {
  PRESETS, esElemento, esGrafico, fuenteDe, metricaDe, tipoDe,
  type Componente, type Grafico, type Hoja, type Tablero,
} from '@/lib/graficos-catalogo';
import { nombreDeComponente, periodoDeGrafico, type Cambio } from './dashboard.helpers';

/** El botón del bloque. */
export const ABRIR_DASHBOARD = 'Abrir en el Dashboard';

/** La ruta de la hoja en la app (el `?ws=` lo suma la pantalla). Sin hoja, el Dashboard. */
export const hrefHoja = (id: string | null): string => (id ? `/dashboard?hoja=${encodeURIComponent(id)}` : '/dashboard');

const abrir = (id: string | null) => ({ titulo: ABRIR_DASHBOARD, href: hrefHoja(id) });
const nombreHoja = (h: Hoja): string => `${h.emoji ? `${h.emoji} ` : ''}${h.nombre}`.trim();
const comillas = (s: string) => `«${s}»`;

/** Qué tiene una hoja, en una línea: «3 gráficos y 1 elemento». */
export function contenidoDeHoja(h: Hoja): string {
  const g = h.componentes.filter(esGrafico).length;
  const e = h.componentes.filter(esElemento).length;
  const partes = [g ? `${g} ${g === 1 ? 'gráfico' : 'gráficos'}` : '', e ? `${e} ${e === 1 ? 'elemento' : 'elementos'}` : ''].filter(Boolean);
  return partes.length ? partes.join(' y ') : 'En blanco';
}

type Fila = { campo?: string; antes: string; despues: string };

const periodoTexto = (g: Grafico): string => {
  const p = periodoDeGrafico(g);
  return p.periodo === 'personalizado' ? `${p.desde} a ${p.hasta}` : (PRESETS.find((x) => x.id === p.periodo)?.nombre ?? p.periodo);
};
const lugarTexto = (c: Componente): string => `Columna ${c.x + 1}, fila ${c.y + 1}, ${c.w} de 12 columnas`;
const metricasTexto = (g: Grafico): string => {
  const f = fuenteDe(g.fuente);
  return g.metricas.map((m) => (f && metricaDe(f, m)?.nombre) ?? m).join(', ');
};
const dimensionTexto = (g: Grafico): string => {
  if (!g.dimension) return '';
  return fuenteDe(g.fuente)?.dimensiones.find((d) => d.id === g.dimension)?.nombre ?? g.dimension;
};
const temaTexto = (h: Hoja): string => {
  const p = PLANTILLAS_TEMA.find((x) => x.id === h.tema.plantilla)?.nombre ?? 'MaKo';
  return h.tema.acento ? `${p}, con el color ${h.tema.acento}` : p;
};

/** Lo que cambió entre dos versiones de UNA tarjeta, fila por fila (lo que no cambió no va). */
export function filasDeComponente(a: Componente, b: Componente): Fila[] {
  const filas: Fila[] = [];
  const si = (campo: string, antes: string, despues: string) => { if (antes !== despues) filas.push({ campo, antes: antes || '—', despues: despues || '—' }); };
  si('Título', nombreDeComponente(a), nombreDeComponente(b));
  if (esGrafico(a) && esGrafico(b)) {
    si('Tipo', tipoDe(a.tipo)?.nombre ?? a.tipo, tipoDe(b.tipo)?.nombre ?? b.tipo);
    si('Métricas', metricasTexto(a), metricasTexto(b));
    si('Por', dimensionTexto(a), dimensionTexto(b));
    si('Período', periodoTexto(a), periodoTexto(b));
  }
  si('Lugar', lugarTexto(a), lugarTexto(b));
  return filas;
}

/** Lo que cambió en una hoja: el nombre, el emoji, el subtítulo, el estilo y su lugar entre las hojas. */
function filasDeHoja(a: Hoja, b: Hoja, ia: number, ib: number, total: number): Fila[] {
  const filas: Fila[] = [];
  const si = (campo: string, antes: string, despues: string) => { if (antes !== despues) filas.push({ campo, antes: antes || '—', despues: despues || '—' }); };
  si('Nombre', a.nombre, b.nombre);
  si('Emoji', a.emoji ?? '', b.emoji ?? '');
  si('Subtítulo', a.subtitulo ?? '', b.subtitulo ?? '');
  if (JSON.stringify(a.tema) !== JSON.stringify(b.tema)) {
    const ta = temaTexto(a), tb = temaTexto(b);
    filas.push({ campo: 'Estilo', antes: ta, despues: tb === ta ? `${tb} (con otros ajustes)` : tb });
  }
  si('Lugar', `${ia + 1}ª de ${total}`, `${ib + 1}ª de ${total}`);
  return filas;
}

/** Las filas que dibuja un G4: las del marco (`MAX_FILAS`, lib/chat-bloques.ts), que corta el resto sin avisar. */
export const TOPE_FILAS_G4 = 12;

/**
 * Lo que «Editar con MaKo» agregó, sacó o cambió en la hoja: primero lo que se SACA (no se deshace), después lo que se
 * agrega y al final lo editado. Con más de lo que entra, la última fila cuenta el resto: el marco corta en 12 y lo
 * primero que perdía era «Se saca», que iba al final (revisión del 21/10).
 */
function filasDeEdicion(a: Hoja, b: Hoja): Fila[] {
  const deA = new Map(a.componentes.map((c) => [c.id, c] as const));
  const deB = new Map(b.componentes.map((c) => [c.id, c] as const));
  const sacadas: Fila[] = a.componentes.filter((c) => !deB.has(c.id)).map((c) => ({ campo: 'Se saca', antes: nombreDeComponente(c), despues: '—' }));
  const agregadas: Fila[] = [];
  const editadas: Fila[] = [];
  for (const c of b.componentes) {
    const antes = deA.get(c.id);
    if (!antes) agregadas.push({ campo: 'Se agrega', antes: '—', despues: nombreDeComponente(c) });
    else if (JSON.stringify(antes) !== JSON.stringify(c)) {
      const cambios = filasDeComponente(antes, c).filter((f) => f.campo !== 'Lugar');
      if (cambios.length) editadas.push({ campo: nombreDeComponente(c), antes: cambios.map((f) => `${f.campo}: ${f.antes}`).join(' · '), despues: cambios.map((f) => `${f.campo}: ${f.despues}`).join(' · ') });
    }
  }
  const filas = [...sacadas, ...agregadas, ...editadas];
  if (filas.length <= TOPE_FILAS_G4) return filas;
  const resto = filas.length - (TOPE_FILAS_G4 - 1);
  return [...filas.slice(0, TOPE_FILAS_G4 - 1), { campo: `Y ${resto} cambios más`, antes: '—', despues: 'Los ves en la hoja' }];
}

/**
 * El bloque de un cambio en el informe de OTRA persona (un admin que edita el de Ana): sin «Abrir en el Dashboard», que
 * abre el de quien mira (su «Marketing» sigue igual y el cambio parece no hecho; y una hoja de plantilla que no tiene se le
 * agrega a SU informe). El título dice de quién es; lo creado, que siempre lleva su botón, pasa a un antes y después.
 */
function enInformeDe(b: BloqueChat, de: string): BloqueChat {
  const titulo = `${b.titulo}, en el informe de ${de}`;
  if (b.t === 'creado') return { t: 'antes_despues', titulo, filas: [{ campo: b.estado ?? 'Nuevo', antes: '—', despues: b.nota ? `${b.titulo} (${b.nota})` : b.titulo }] };
  if (b.t === 'antes_despues') {
    const { abrir: _abrir, ...resto } = b;
    return { ...resto, titulo };
  }
  return b;
}

/**
 * El bloque de un cambio confirmado: G5 para lo que se crea, G4 para lo que cambia. `antes` es el informe sobre el que
 * se aplicó y `despues` el que quedó guardado; `de`, de quién es el informe cuando NO es de quien chatea (null = suyo).
 * null = nada que dibujar.
 */
export function bloqueDelCambio(c: Cambio, antes: Tablero, despues: Tablero, de: string | null = null): BloqueChat | null {
  const b = bloqueDeInforme(c, antes, despues);
  return b && de ? enInformeDe(b, de) : b;
}

function bloqueDeInforme(c: Cambio, antes: Tablero, despues: Tablero): BloqueChat | null {
  if (c.op === 'restablecer') {
    return {
      t: 'antes_despues', titulo: 'Tu informe, como lo arma MaKo',
      filas: [{ campo: 'Hojas', antes: antes.hojas.map(nombreHoja).join(', ') || '—', despues: despues.hojas.map(nombreHoja).join(', ') || '—' }],
      abrir: abrir(null),
    };
  }
  if (c.op === 'crear_hoja' || c.op === 'duplicar_hoja') {
    const id = c.op === 'crear_hoja' ? c.hoja.id : c.copia.id;
    const h = despues.hojas.find((x) => x.id === id);
    if (!h) return null;
    return { t: 'creado', titulo: nombreHoja(h), estado: c.op === 'crear_hoja' ? 'Nueva' : 'Copia', nota: contenidoDeHoja(h), abrir: abrir(h.id) };
  }
  const ia = antes.hojas.findIndex((x) => x.id === c.hojaId);
  const ib = despues.hojas.findIndex((x) => x.id === c.hojaId);
  const a = ia >= 0 ? antes.hojas[ia] : undefined;
  const b = ib >= 0 ? despues.hojas[ib] : undefined;
  switch (c.op) {
    case 'borrar_hoja':
      return a ? { t: 'antes_despues', titulo: `La hoja ${comillas(nombreHoja(a))}`, filas: [{ campo: 'Dónde está', antes: 'En el Dashboard', despues: 'En Archivados: se restaura desde el desplegable de hojas' }], abrir: abrir(null) } : null;
    case 'editar_hoja': {
      if (!a || !b) return null;
      const filas = filasDeHoja(a, b, ia, ib, despues.hojas.length);
      return filas.length ? { t: 'antes_despues', titulo: `La hoja ${comillas(nombreHoja(b))}`, filas, abrir: abrir(b.id) } : null;
    }
    case 'agregar_componente': {
      const comp = b?.componentes.find((x) => x.id === c.componente.id);
      return b && comp ? { t: 'creado', titulo: nombreDeComponente(comp), estado: 'Agregado', nota: `En la hoja ${comillas(nombreHoja(b))}`, abrir: abrir(b.id) } : null;
    }
    case 'reemplazar_componente':
    case 'mover_componente': {
      const id = c.op === 'mover_componente' ? c.componenteId : c.componente.id;
      const ca = a?.componentes.find((x) => x.id === id);
      const cb = b?.componentes.find((x) => x.id === id);
      if (!b || !ca || !cb) return null;
      const filas = filasDeComponente(ca, cb);
      return filas.length ? { t: 'antes_despues', titulo: nombreDeComponente(cb), filas, abrir: abrir(b.id) } : null;
    }
    case 'quitar_componente': {
      const comp = a?.componentes.find((x) => x.id === c.componenteId);
      return a && comp ? { t: 'antes_despues', titulo: `La hoja ${comillas(nombreHoja(a))}`, filas: [{ campo: nombreDeComponente(comp), antes: 'En la hoja', despues: 'Quitado' }], abrir: abrir(a.id) } : null;
    }
    case 'agregar_filtro':
    case 'quitar_filtro': {
      if (!a || !b) return null;
      const n = (h: Hoja) => `${h.controles.length} ${h.controles.length === 1 ? 'filtro' : 'filtros'}`;
      return n(a) !== n(b) ? { t: 'antes_despues', titulo: `La barra de ${comillas(nombreHoja(b))}`, filas: [{ campo: 'Filtros', antes: n(a), despues: n(b) }], abrir: abrir(b.id) } : null;
    }
    case 'editar_con_ia': {
      if (!a || !b) return null;
      const filas = filasDeEdicion(a, b);
      return filas.length ? { t: 'antes_despues', titulo: `Lo que cambió en ${comillas(nombreHoja(b))}`, filas, abrir: abrir(b.id) } : null;
    }
    default:
      // Los conectores: una flecha entre dos tarjetas no tiene un antes y un después que valga una tarjeta.
      return null;
  }
}
