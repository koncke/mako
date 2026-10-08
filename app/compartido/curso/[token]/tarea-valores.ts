// =============================================================================
// tarea-valores — la forma de lo que el alumno contesta, del lado de la pantalla (puro)
// =============================================================================
// Sin 'use client' ni 'server-only': lo usa el formulario de la tarea (TareaAlumno.tsx) y lo
// EJECUTA tests/curso-portal.test.ts. Las reglas que deciden en el server (sanear, «¿alcanza para
// enviar?») viven en lib/curso.ts; acá está lo que la pantalla necesita para dibujar y para decir
// QUÉ falta antes de mandar.
//
// ⚠️ NO SE IMPORTA NADA DE lib/curso-portal.ts: ese módulo trae, por `import()`, la capa de datos
// con `server-only`, y un componente cliente que lo importara arrastraría ese grafo al navegador.

import { camposConRespuesta, campoLleno, campoCompleto, NOTA_MIN_DEFAULT, type Campo, type NotaQuiz, type Valores, type ValorCampo } from '@/lib/curso';

const esTabla = (v: ValorCampo | undefined): v is string[][] => Array.isArray(v) && v.length > 0 && Array.isArray(v[0]);
const ncol = (c: Campo) => Math.max(1, c.columnas?.length ?? 1);

/** Un renglón vacío de una tabla, del ancho de sus columnas. */
export const filaVacia = (c: Campo): string[] => Array.from({ length: ncol(c) }, () => '');

/**
 * Las filas que la tabla muestra para editar: lo guardado, completado hasta lo que pide el
 * formulario. Con filas FIJAS, la primera columna es su etiqueta (el molde del programa viejo,
 * `tablaParaEditar` en 07d07139^:lib/cs-valores.ts) y se guarda con ella: así lo contestado se
 * lee solo, sin tener que cruzarlo con el formulario. Con `filasMin`, se ven todas desde el
 * arranque — un botón «Agregar fila» esconde lo que se está pidiendo.
 */
export function filasDeTabla(c: Campo, guardado: ValorCampo | undefined): string[][] {
  const n = ncol(c);
  const base = esTabla(guardado) ? guardado : [];
  const filas = base.map((f) => {
    const fila = (Array.isArray(f) ? f : []).map((x) => String(x ?? ''));
    while (fila.length < n) fila.push('');
    return fila.slice(0, n);
  });
  if (c.filasFijas?.length) {
    return c.filasFijas.map((etiqueta, i) => {
      const f = filas[i] ?? filaVacia(c);
      return [etiqueta, ...f.slice(1)];
    });
  }
  const minimo = Math.max(1, c.filasMin ?? 1);
  while (filas.length < minimo) filas.push(filaVacia(c));
  return filas;
}

// ¿Este campo tiene algo contestado? La regla es la del SERVER (`campoLleno`, lib/curso.ts):
// hasta el 06/10/2026 estaba escrita dos veces y la del server contaba la etiqueta de una fila
// fija como respuesta. Se re-exporta con el mismo nombre porque la usan el formulario y su test.
// `campoCompleto` (#18): lo que pide un OBLIGATORIO — una checklist entera, un quiz contestado entero.
export { campoLleno, campoCompleto };

export type QueFalta =
  | { tipo: 'respuesta' }
  | { tipo: 'alguno' }
  | { tipo: 'campos'; labels: string[] };

/**
 * Qué le falta para poder ENVIAR, o `null` si ya alcanza. Es la misma regla que el server
 * (`respuestaCompleta`): sin campos, la respuesta libre; con campos, los obligatorios; sin
 * ninguno obligatorio, al menos uno contestado.
 */
export function queFalta(todos: readonly Campo[], valores: Valores): QueFalta | null {
  // Sin las `seccion` (item 12 del 08/10/2026): una no se contesta, y contada como campo dejaba la tarea
  // diciendo «contesta al menos una» para siempre. La misma puerta que el server (`respuestaCompleta`).
  const campos = camposConRespuesta(todos);
  if (!campos.length) {
    const r = valores.respuesta;
    return typeof r === 'string' && r.trim() ? null : { tipo: 'respuesta' };
  }
  const obligatorios = campos.filter((c) => c.obligatorio);
  if (!obligatorios.length) return campos.some((c) => campoLleno(c, valores[c.id])) ? null : { tipo: 'alguno' };
  const faltan = obligatorios.filter((c) => !campoCompleto(c, valores[c.id]));
  return faltan.length ? { tipo: 'campos', labels: faltan.map((c) => c.label) } : null;
}

// ── Lo que se dice de los tipos de la #18 (07/10/2026) ──────────────────────

/** Un tamaño de archivo, corto: «820 KB», «2,4 MB». */
export function fraseDeBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`;
}

/** Segundos como un reloj: 65 → «1:05». */
export function reloj(seg: number): string {
  const s = Math.max(0, Math.floor(Number.isFinite(seg) ? seg : 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * Lo que se le dice al alumno de UN quiz después de corregirlo, en frases cortas. `null` = todavía no
 * lo envió. Sin la respuesta correcta (no viaja): las preguntas que erró, por su número.
 *
 * ⚠️ «Sin intentos» se dice cuando el tope está y se usó entero SIN aprobar: es lo mismo que mira el
 * server para rechazar (`corregirEnvio`). Con dos reglas, la pantalla ofrecería «Enviar» sobre un
 * quiz que el server ya no corrige.
 */
export function estadoDeQuiz(c: Pick<Campo, 'notaMin' | 'intentos'>, n: NotaQuiz | undefined): {
  aprobado: boolean; sinIntentos: boolean; titulo: string; detalle: string | null;
} | null {
  if (!n) return null;
  if (n.aprobado) return { aprobado: true, sinIntentos: false, titulo: `Aprobado · ${n.nota} %`, detalle: null };
  const tope = c.intentos ?? 0;
  const quedan = tope > 0 ? Math.max(0, tope - n.intentos) : null;
  const malas = (n.malas ?? []).map((i) => i + 1);
  const partes = [
    malas.length ? `Revisa: ${malas.slice(0, 8).join(', ')}${malas.length > 8 ? '…' : ''}.` : null,
    quedan == null ? null : quedan === 0 ? 'Ya no quedan intentos.' : quedan === 1 ? 'Te queda 1 intento.' : `Te quedan ${quedan} intentos.`,
  ].filter(Boolean);
  return {
    aprobado: false,
    sinIntentos: quedan === 0,
    titulo: `Sacaste ${n.nota} %. Necesitas ${c.notaMin ?? NOTA_MIN_DEFAULT} %.`,
    detalle: partes.length ? partes.join(' ') : null,
  };
}

const corto = (s: string) => (s.length > 60 ? `${s.slice(0, 57).trimEnd()}…` : s);

/** Lo que falta, en una frase. Los rótulos largos se cortan: es un aviso, no el formulario. */
export function fraseQueFalta(f: QueFalta): string {
  if (f.tipo === 'respuesta') return 'Escribe tu respuesta antes de enviar.';
  if (f.tipo === 'alguno') return 'Contesta al menos una pregunta antes de enviar.';
  const [primera, ...resto] = f.labels;
  return resto.length
    ? `Falta «${corto(primera)}» y ${resto.length} más.`
    : `Falta «${corto(primera)}».`;
}
