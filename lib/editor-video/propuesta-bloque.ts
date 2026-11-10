// =============================================================================
// editor-video/propuesta-bloque — la propuesta del Video Editor como tarjeta «Original | Modificado» en el chat
// =============================================================================
// Pieza 1.14 de «Ops Center = lo principal» (docs/ops-center-principal.md §2.4, bloque G4). Cada edición pedida por el
// chat deja una PROPUESTA del proyecto (./propuestas-server.ts) que se acepta en el editor, porque el proyecto vive en
// el navegador de quien lo editó. El chat no puede aplicarla, pero sí MOSTRARLA: fila por fila, el elemento como está
// hoy en la copia del proyecto y cómo queda, con «Aceptar en el editor» que abre ESA propuesta (`?propuesta=<id>`).
//
//   · La forma es la del bloque G4 del marco de bloques (lib/chat-bloques.ts, Ops Center 3): `t: 'antes_despues'`,
//     `titulo`, `filas` (`campo`, `antes`, `despues`) y `abrir` con una ruta de la app. Se arma acá, con datos, nunca
//     con texto del modelo; el turno la sanea antes de guardarla.
//   · «Original» sale de la COPIA del proyecto (la que sube el editor, lib/editor-video/espejo.ts): puede estar vieja,
//     y por eso el editor vuelve a revisar contra la línea de tiempo de ese momento al aceptar.
//   · Hasta 12 filas (el tope del G4): una propuesta junta lo que se pidió en un rato y puede tener más.
//
// Puro y sin `server-only`: lo leen el runner de la API y los tests.
// =============================================================================

import type { OperacionChat } from './chat-catalogo';
import { OPERACIONES_API } from './chat-api';

/** Cuántas filas lleva la tarjeta: el tope del bloque G4 (lib/chat-bloques.ts). */
export const MAX_FILAS_TARJETA = 12;

export type FilaPropuesta = { campo: string; antes: string; despues: string };

/** El bloque G4 que dibuja el chat (lib/chat-bloques.ts). Estructural: no importa el marco, sólo cumple su forma. */
export type BloquePropuesta = {
  t: 'antes_despues';
  titulo: string;
  filas: FilaPropuesta[];
  abrir: { titulo: string; href: string };
};

const TITULO_DE = new Map(OPERACIONES_API.map((o) => [o.op, o.titulo] as const));

/** «0:03», «1:05,5»: como se lee un tiempo en la línea de tiempo. */
export function tiempo(seg: number): string {
  if (!Number.isFinite(seg) || seg < 0) return '?';
  const m = Math.floor(seg / 60);
  const s = seg - m * 60;
  const entero = Math.floor(s);
  const dec = Math.round((s - entero) * 10);
  return `${m}:${String(entero).padStart(2, '0')}${dec ? `,${dec}` : ''}`;
}

const segundos = (n: number): string => `${String(Math.round(n * 10) / 10).replace('.', ',')} s`;
const entre = (a: number, b: number): string => `de ${tiempo(a)} a ${tiempo(b)}`;
const comillas = (s: string, max = 80): string => `«${s.length > max ? `${s.slice(0, max)}…` : s}»`;

type Elemento = { nombre: string; inicio?: number; fin?: number };

/** Los elementos de la copia, con su nombre y sus tiempos (la vista que guarda lib/editor-video/espejo.ts). */
export function elementosDeVista(vista: unknown): Map<string, Elemento> {
  const out = new Map<string, Elemento>();
  const v = (vista && typeof vista === 'object' ? vista : {}) as { pistas?: unknown; medios?: unknown };
  for (const p of Array.isArray(v.pistas) ? v.pistas : []) {
    const els = (p as { elementos?: unknown })?.elementos;
    for (const e of Array.isArray(els) ? els : []) {
      const x = e as { ref?: unknown; texto?: unknown; nombre?: unknown; inicio?: unknown; fin?: unknown };
      if (typeof x.ref !== 'string') continue;
      const nombre = typeof x.texto === 'string' ? comillas(x.texto, 40) : typeof x.nombre === 'string' ? x.nombre.slice(0, 40) : x.ref;
      out.set(x.ref, {
        nombre,
        ...(typeof x.inicio === 'number' ? { inicio: x.inicio } : {}),
        ...(typeof x.fin === 'number' ? { fin: x.fin } : {}),
      });
    }
  }
  for (const m of Array.isArray(v.medios) ? v.medios : []) {
    const x = m as { ref?: unknown; nombre?: unknown };
    if (typeof x.ref === 'string') out.set(x.ref, { nombre: typeof x.nombre === 'string' ? x.nombre.slice(0, 40) : x.ref });
  }
  return out;
}

/** Un elemento como está hoy: «Hola» (t2, de 0:02 a 0:05). Si la copia no lo tiene (lo agrega la misma propuesta), su ref. */
function comoEsta(ref: string, els: Map<string, Elemento>): string {
  const e = els.get(ref);
  if (!e) return ref;
  const t = e.inicio !== undefined && e.fin !== undefined ? `, ${entre(e.inicio, e.fin)}` : '';
  return `${e.nombre} (${ref}${t})`;
}

/** Lo que queda después de la operación, en palabras. Exhaustivo: una operación nueva sin texto no compila. */
export function despuesDe(op: OperacionChat, els: Map<string, Elemento> = new Map()): string {
  switch (op.op) {
    case 'agregar_texto': return `Texto ${comillas(op.texto)} ${entre(op.inicio, op.inicio + op.duracion)}`;
    case 'cambiar_texto': return comillas(op.texto);
    case 'borrar': return 'Se borra';
    case 'mover': return `Empieza en ${tiempo(op.inicio)}`;
    case 'duracion': return `Dura ${segundos(op.duracion)}`;
    case 'dividir': return `Partido en ${tiempo(op.en)}`;
    case 'recortar': return `Queda desde ${op.inicio !== undefined ? tiempo(op.inicio) : 'el principio'} hasta ${op.fin !== undefined ? tiempo(op.fin) : 'el final'}`;
    case 'volumen': return `Volumen ${op.db > 0 ? '+' : ''}${op.db} dB`;
    case 'silenciar': return op.silenciado ? 'Sin sonido' : 'Con sonido';
    case 'fundido': return [op.entrada ? `fundido de entrada de ${segundos(op.entrada)}` : '', op.salida ? `fundido de salida de ${segundos(op.salida)}` : ''].filter(Boolean).join(' y ').replace(/^./, (c) => c.toUpperCase()) || 'Sin fundidos';
    case 'reducir_ruido': return op.activo ? 'Sin ruido de fondo' : 'Con el ruido original';
    case 'normalizar': return op.activo ? 'Volumen parejo' : 'Volumen original';
    case 'separar_audio': return op.separado ? 'El audio en su propia pista' : 'El audio junto al video';
    case 'ocultar': return op.oculto ? 'Oculto' : 'Visible';
    case 'velocidad': return op.x !== undefined ? `A ${String(op.x).replace('.', ',')}×` : op.curva ? `Con la curva ${comillas(op.curva)}` : 'A velocidad normal';
    case 'transicion': return op.id ? `Transición ${comillas(op.id)}` : 'Sin transición';
    case 'animacion': return op.id ? `Animación ${comillas(op.id)}` : 'Sin animación';
    case 'filtro': return op.id ? `Filtro ${comillas(op.id)}` : 'Sin filtro';
    case 'efecto': return op.quitar ? `Sin el efecto ${comillas(op.id)}` : `Efecto ${comillas(op.id)}`;
    case 'capa_efecto': return `${op.tipo === 'filtro' ? 'Filtro' : 'Efecto'} ${comillas(op.id)} ${entre(op.inicio, op.inicio + op.duracion)}`;
    case 'ajustar_color': return `Color: ${Object.entries(op.valores).map(([k, n]) => `${k.replace(/_/g, ' ')} ${Number(n) > 0 ? '+' : ''}${n}`).join(', ') || 'sin cambios'}`;
    case 'estilo_texto': return 'Con otro estilo de texto';
    case 'transformar': return 'Con otra posición o tamaño';
    case 'reflejar': return op.horizontal && op.vertical ? 'Reflejado en los dos sentidos' : op.vertical ? 'Reflejado de arriba abajo' : 'Reflejado de lado';
    case 'revertir': return op.revertido ? 'Al revés' : 'Al derecho';
    case 'congelar': return `Cuadro congelado en ${tiempo(op.en)}`;
    case 'reemplazar_en_subtitulos': return comillas(op.reemplazo);
    case 'resaltar_palabras': return op.modo === 'ninguno' ? 'Sin resaltar' : op.modo === 'palabra' ? 'Resalta la palabra que se dice' : 'Resalta la frase que se dice';
    case 'generar_subtitulos': return 'Con subtítulos automáticos';
    case 'cortar_frase': return `Sin ${comillas(op.frase)}`;
    case 'cortar_tramo': return `Sin el tramo ${entre(op.inicio, op.fin)}`;
    case 'eliminar_muletillas': return 'Sin muletillas';
    case 'borrar_silencios': return 'Sin los silencios (se buscan al aceptar)';
    case 'reemplazar_clip': return `Con el archivo ${els.get(op.medio)?.nombre ?? op.medio}`;
    case 'usar_plantilla': return `La plantilla ${comillas(op.id)}, con ${Object.keys(op.textos).length} textos y ${Object.keys(op.clips).length} clips`;
    case 'palabras_clave':
      return op.modo === 'ninguna'
        ? 'Sin palabras clave'
        : op.modo === 'auto'
          ? 'Con las palabras clave de color'
          : op.modo === 'quitar'
            ? `Sin ${(op.palabras ?? []).map((w) => comillas(w)).join(', ')} de color`
            : `Con ${(op.palabras ?? []).map((w) => comillas(w)).join(', ')} de color`;
    case 'animar_palabras': return op.animacion === 'ninguna' ? 'La palabra que se dice, quieta' : op.animacion === 'pop' ? 'La palabra que se dice salta' : 'La palabra que se dice crece';
    case 'usar_preset_subtitulos': return `Con el preset ${comillas(op.preset)}`;
    case 'broll': return op.planos === false ? 'Con B-roll propuesto' : 'Con B-roll y cambios de plano propuestos';
    case 'clips_magicos': return `Los ${op.cuantos ?? 5} mejores momentos, para abrir aparte`;
    case 'edicion_automatica': return 'Editado de una por los agentes (se ve en «Edición automática»)';
    case 'emojis_subtitulos': return op.activar ? 'Con un emoji encima de los subtítulos que lo piden' : 'Sin los emojis de los subtítulos';
    default: {
      const nunca: never = op;
      return String((nunca as { op?: unknown }).op ?? '');
    }
  }
}

/** Cómo está hoy lo que la operación toca. «—» cuando no toca nada que ya exista (agrega, o es del video entero). */
export function antesDe(op: OperacionChat, els: Map<string, Elemento> = new Map()): string {
  if (op.op === 'reemplazar_en_subtitulos') return comillas(op.buscar);
  if (op.op === 'cortar_frase') return comillas(op.frase);
  if (op.op === 'borrar') return op.refs.map((r) => comoEsta(r, els)).join('; ');
  const ref = (op as { ref?: unknown }).ref;
  // agregar_texto y capa_efecto llevan `ref` para NOMBRAR lo nuevo, no algo que exista.
  if (typeof ref === 'string' && op.op !== 'agregar_texto' && op.op !== 'capa_efecto') return comoEsta(ref, els);
  return '—';
}

/** Las filas de la tarjeta: una por operación, con su título, cómo está hoy y cómo queda. */
export function filasDePropuesta(operaciones: readonly OperacionChat[], vista: unknown): FilaPropuesta[] {
  const els = elementosDeVista(vista);
  return operaciones.slice(0, MAX_FILAS_TARJETA).map((op) => ({
    campo: (TITULO_DE.get(op.op) ?? op.op).slice(0, 60),
    antes: antesDe(op, els),
    despues: despuesDe(op, els),
  }));
}

/** La ruta del editor en ESA propuesta. Una ruta de la app: el `?ws=` lo pone quien navega. */
export const rutaDePropuesta = (proyecto: string, id: string): string =>
  `/video-editor/${encodeURIComponent(proyecto)}?propuesta=${encodeURIComponent(id)}`;

/** El bloque G4 de una propuesta, o null si no hay filas (no se dibuja una tarjeta vacía). */
export function bloqueDePropuesta(p: { proyecto: string; nombre?: string | null; id: string; filas: readonly FilaPropuesta[]; total?: number }): BloquePropuesta | null {
  if (!p.filas.length) return null;
  const mas = p.total && p.total > p.filas.length ? ` (y ${p.total - p.filas.length} más en el editor)` : '';
  const nombre = (p.nombre ?? '').trim();
  return {
    t: 'antes_despues',
    titulo: `${nombre ? `Cambios propuestos en ${comillas(nombre, 60)}` : 'Cambios propuestos en el video'}${mas}`.slice(0, 120),
    filas: [...p.filas],
    abrir: { titulo: 'Aceptar en el editor', href: rutaDePropuesta(p.proyecto, p.id) },
  };
}
