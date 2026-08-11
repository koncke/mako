// =============================================================================
// cs-valores — lo que contestó el cliente, y cómo se lee
// =============================================================================
// `valores` es la fuente de verdad: { campoId: valor }, campo por campo.
// `respuesta` es su versión LEGIBLE, y se DERIVA de acá — no se escribe a mano
// en ningún lado.
//
// Por qué existen las dos. La IA reescribe prosa y el cliente aprueba prosa:
// nadie aprueba un JSON, y una tabla de cinco columnas reescrita por un modelo
// deja de ser una tabla. Así que lo estructurado se guarda estructurado, y
// además se renderiza a texto para que el resto del bucle —la reescritura, la
// aprobación, el histórico— siga trabajando sobre algo que un humano lee.
//
// SIN `server-only`: lo usa el formulario del cliente para saber si un campo
// está contestado, y lo miran los tests.

import { camposDe, type Campo } from './programa-campos';

/** string = texto/línea/número/elección · string[] = checks · string[][] = tabla */
export type Valor = string | string[] | string[][];
export type Valores = Record<string, Valor>;

const esTabla = (v: Valor | undefined): v is string[][] => Array.isArray(v) && Array.isArray(v[0]);
const esLista = (v: Valor | undefined): v is string[] => Array.isArray(v) && !Array.isArray(v[0]);

/** ¿Este campo tiene algo? Una tabla con todas las celdas vacías NO cuenta:
 *  si no, agregar un renglón vacío marcaría el bloque como contestado. */
export function tieneValor(v: Valor | undefined): boolean {
  if (v === undefined || v === null) return false;
  if (typeof v === 'string') return v.trim().length > 0;
  if (esTabla(v)) return v.some(fila => fila.some(c => (c ?? '').trim().length > 0));
  if (esLista(v)) return v.some(x => (x ?? '').trim().length > 0);
  return false;
}

/** Cuántas de las obligatorias faltan. Es lo que le dice al cliente cuánto le
 *  queda, y lo que decide si el bloque está realmente contestado. */
export function faltantes(claseId: string, valores: Valores): Campo[] {
  return camposDe(claseId).filter(c => c.obligatorio && !tieneValor(valores[c.id]));
}

/** El renglón vacío de una tabla, del ancho de sus columnas. */
export function filaVacia(campo: Campo): string[] {
  return (campo.columnas ?? []).map(() => '');
}

/** Las filas que la tabla tiene que mostrar de entrada: las fijas si las hay,
 *  si no el mínimo que el cuestionario exige, y si no una sola. */
export function filasIniciales(campo: Campo): string[][] {
  if (campo.filasFijas?.length) {
    return campo.filasFijas.map(f => [f, ...(campo.columnas ?? []).slice(1).map(() => '')]);
  }
  const n = Math.max(1, campo.filasMin ?? 1);
  return Array.from({ length: n }, () => filaVacia(campo));
}

/** La tabla como la va a editar el formulario: lo guardado, completado hasta el
 *  mínimo. Si el cuestionario pide ocho renglones, se ven ocho desde el arranque
 *  — un botón «agregar renglón» esconde el pedido. */
export function tablaParaEditar(campo: Campo, guardado: Valor | undefined): string[][] {
  const cols = (campo.columnas ?? []).length;
  const base = esTabla(guardado) ? guardado : [];
  const filas = base.map(f => {
    const fila = [...f];
    while (fila.length < cols) fila.push('');
    return fila.slice(0, cols);
  });
  if (campo.filasFijas?.length) {
    // Las fijas mandan: si alguien agregó una fila de más a mano, se conserva,
    // pero las primeras siempre son las del cuestionario y en su orden.
    return campo.filasFijas.map((etiqueta, i) => {
      const f = filas[i] ?? Array.from({ length: cols }, () => '');
      return [etiqueta, ...f.slice(1)];
    }).concat(filas.slice(campo.filasFijas.length));
  }
  const minimo = Math.max(1, campo.filasMin ?? 1);
  while (filas.length < minimo) filas.push(Array.from({ length: cols }, () => ''));
  return filas;
}

// ── De valores a texto legible ───────────────────────────────────────────────

/** Un campo, como se lee. Las tablas salen en Markdown para que se vean como
 *  tabla en cualquier lado donde después se muestre el texto. */
function campoATexto(campo: Campo, v: Valor | undefined): string | null {
  if (!tieneValor(v)) return null;
  if (typeof v === 'string') return v.trim();
  if (esLista(v)) return v.filter(x => (x ?? '').trim()).map(x => `- ${x.trim()}`).join('\n');
  if (esTabla(v)) {
    const cols = campo.columnas ?? [];
    const filas = v.filter(f => f.some(c => (c ?? '').trim()));
    if (!filas.length) return null;
    const linea = (celdas: string[]) => `| ${cols.map((_, i) => (celdas[i] ?? '').trim() || '—').join(' | ')} |`;
    return [
      `| ${cols.join(' | ')} |`,
      `| ${cols.map(() => '---').join(' | ')} |`,
      ...filas.map(linea),
    ].join('\n');
  }
  return null;
}

/**
 * Todo el bloque, legible. Es lo que va a `respuesta` y lo que después lee la
 * IA para reescribir: sin la pregunta encima, una respuesta suelta no se
 * entiende ni la puede mejorar nadie.
 */
export function aTexto(claseId: string, valores: Valores): string {
  const partes: string[] = [];
  for (const campo of camposDe(claseId)) {
    const t = campoATexto(campo, valores[campo.id]);
    if (t) partes.push(`**${campo.label}**\n${t}`);
  }
  return partes.join('\n\n');
}

/** Saneo de lo que llega por la red. Se recorta contra los campos QUE EXISTEN:
 *  un id inventado no entra, y una tabla no puede traer más columnas que las
 *  suyas. Sin esto, un POST puede guardar cualquier cosa en el jsonb. */
export function sanear(claseId: string, crudo: unknown, topeCelda = 4000): Valores {
  if (!crudo || typeof crudo !== 'object') return {};
  const entrada = crudo as Record<string, unknown>;
  const out: Valores = {};
  const corto = (x: unknown) => String(x ?? '').slice(0, topeCelda);

  for (const campo of camposDe(claseId)) {
    const v = entrada[campo.id];
    if (v === undefined || v === null) continue;

    if (campo.tipo === 'tabla') {
      if (!Array.isArray(v)) continue;
      const cols = (campo.columnas ?? []).length;
      out[campo.id] = v.slice(0, 200)
        .filter(Array.isArray)
        .map(f => (f as unknown[]).slice(0, cols).map(corto))
        .map(f => { while (f.length < cols) f.push(''); return f; });
      continue;
    }
    if (campo.tipo === 'checks') {
      if (!Array.isArray(v)) continue;
      // Solo opciones que existen: un check inventado es un dato que después
      // nadie sabe de dónde salió.
      const validas = new Set(campo.opciones ?? []);
      out[campo.id] = (v as unknown[]).map(x => String(x ?? '')).filter(x => validas.has(x));
      continue;
    }
    if (campo.tipo === 'eleccion') {
      const s = String(v ?? '');
      if ((campo.opciones ?? []).includes(s)) out[campo.id] = s;
      continue;
    }
    out[campo.id] = corto(v);
  }
  return out;
}
