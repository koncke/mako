'use client';

// =============================================================================
// Los campos de una propuesta de acción: los MISMOS en /mako/revisar/<id> y en el chat (20/10/2026, ola 1, pieza 1.10)
// =============================================================================
// Sacados de RevisarAccion.tsx para que la tarjeta del chat (app/_chat/FormularioEnChat.tsx) despliegue el mismo
// formulario de la pantalla de revisión (docs/ops-center-principal.md §2.5): se pinta desde los `parametros` de la
// operación, con el input guardado como valor inicial, y lo que vuelve pasa otra vez por `validarInput` y `preparar()`.
//
// Datos PLANOS: acá no se importa el registro ni las defs, solo el TIPO `Parametro`.
// Un campo vaciado se manda como `null` y no se omite: la acción mezcla lo editado sobre el payload guardado, y
// omitirlo haría volver el valor viejo en silencio.
// =============================================================================

import { TextField, Field, Textarea, Select, Checkbox } from '@/app/_ui';
import type { Parametro } from '@/lib/api-mako/tipos';

export type OperacionPlana = {
  id: string;
  titulo: string;
  descripcion: string;
  escribe: string;
  reversible: boolean;
  parametros: Parametro[];
};

export type Valor = string | boolean;

/** Arriba de esto un string va en textarea: una línea de 200 caracteres no se revisa. */
const LARGO_TEXTAREA = 200;

export function valorInicial(p: Parametro, v: unknown): Valor {
  switch (p.tipo) {
    case 'boolean': return v === true;
    case 'string': return typeof v === 'string' ? v : v == null ? '' : String(v);
    case 'number': return typeof v === 'number' ? String(v) : typeof v === 'string' ? v : '';
    // Un valor por RENGLÓN, no separado por comas: «Llamar a Ana, y después a Luis»
    // es UN valor, y partirlo por comas al confirmar lo convertía en dos sin avisar.
    case 'string[]': return Array.isArray(v) ? v.map(String).join('\n') : typeof v === 'string' ? v : '';
    default: return v == null ? '' : JSON.stringify(v, null, 2);
  }
}

/** Lo que se manda al server, o el error de cada campo que no se pudo leer. */
export function armarPayload(params: Parametro[], valores: Record<string, Valor>, original: Record<string, unknown>):
  { payload: Record<string, unknown> } | { errores: Record<string, string> } {
  const payload: Record<string, unknown> = {};
  const errores: Record<string, string> = {};
  for (const p of params) {
    const v = valores[p.nombre];
    const texto = typeof v === 'string' ? v.trim() : '';
    switch (p.tipo) {
      case 'boolean':
        // Un casillero apagado que no venía en la propuesta no se inventa como `false`.
        payload[p.nombre] = v === true ? true : (p.nombre in original ? false : null);
        break;
      case 'string':
        payload[p.nombre] = texto || null;
        break;
      case 'number': {
        if (!texto) { payload[p.nombre] = null; break; }
        const n = Number(texto.replace(',', '.'));
        if (!Number.isFinite(n)) errores[p.nombre] = 'Escribe un número.';
        else if (p.entero && !Number.isInteger(n)) errores[p.nombre] = 'Tiene que ser un número entero.';
        else if (p.minimo != null && n < p.minimo) errores[p.nombre] = `Tiene que ser al menos ${p.minimo}.`;
        else if (p.maximo != null && n > p.maximo) errores[p.nombre] = `Tiene que ser como mucho ${p.maximo}.`;
        else payload[p.nombre] = n;
        break;
      }
      case 'string[]': {
        const lista = texto.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
        payload[p.nombre] = lista.length ? lista : null;
        break;
      }
      default: {
        if (!texto) { payload[p.nombre] = null; break; }
        try {
          const j: unknown = JSON.parse(texto);
          const esLista = Array.isArray(j);
          if (p.tipo === 'object' && (esLista || j === null || typeof j !== 'object')) errores[p.nombre] = 'Tiene que ser un objeto JSON: { … }.';
          else if (p.tipo === 'object[]' && !esLista) errores[p.nombre] = 'Tiene que ser una lista JSON: [ … ].';
          else payload[p.nombre] = j;
        } catch {
          errores[p.nombre] = 'El JSON no es válido. Revisa comillas, comas y llaves.';
        }
      }
    }
    if (p.obligatorio && payload[p.nombre] == null && !errores[p.nombre]) errores[p.nombre] = 'Este dato es obligatorio.';
  }
  return Object.keys(errores).length ? { errores } : { payload };
}

export function valorLegible(v: unknown): string {
  if (v == null || v === '') return '—';
  if (typeof v === 'string') return v;
  if (typeof v === 'boolean') return v ? 'Sí' : 'No';
  if (Array.isArray(v) && v.every((x) => typeof x !== 'object')) return v.join(', ');
  return JSON.stringify(v);
}

export function Campo({ p, valor, error, disabled, onChange }: {
  p: Parametro; valor: Valor; error?: string; disabled: boolean; onChange: (v: Valor) => void;
}) {
  const hint = p.descripcion;
  if (p.tipo === 'boolean') {
    return (
      <div>
        <Checkbox checked={valor === true} onChange={onChange} label={p.nombre} hint={hint} disabled={disabled} />
        {error && <span className="mk-err" role="alert">{error}</span>}
      </div>
    );
  }
  const texto = typeof valor === 'string' ? valor : '';
  if (p.tipo === 'string' && p.enum?.length) {
    const opciones = [
      ...(p.obligatorio ? [] : [{ value: '', label: 'Sin definir' }]),
      ...p.enum.map((e) => ({ value: e, label: e })),
    ];
    return <Select label={p.nombre} hint={hint} error={error} required={p.obligatorio} options={opciones} value={texto} onChange={onChange} disabled={disabled} />;
  }
  if (p.tipo === 'string') {
    return (
      <TextField label={p.nombre} hint={hint} error={error} required={p.obligatorio} value={texto} disabled={disabled}
        multiline={(p.max ?? 4000) > LARGO_TEXTAREA} maxLength={p.max}
        onChange={(e) => onChange(e.target.value)} />
    );
  }
  if (p.tipo === 'number') {
    const rango = [p.minimo != null ? `mínimo ${p.minimo}` : '', p.maximo != null ? `máximo ${p.maximo}` : '', p.entero ? 'entero' : ''].filter(Boolean).join(' · ');
    return (
      <TextField label={p.nombre} hint={rango ? `${hint} (${rango})` : hint} error={error} required={p.obligatorio} value={texto} disabled={disabled}
        type="number" inputMode={p.entero ? 'numeric' : 'decimal'} step={p.entero ? 1 : 'any'} min={p.minimo} max={p.maximo}
        onChange={(e) => onChange(e.target.value)} />
    );
  }
  if (p.tipo === 'string[]') {
    const opciones = p.enum?.length ? ` Valores posibles: ${p.enum.join(', ')}.` : '';
    const idLista = `campo-${p.nombre}`;
    return (
      <Field label={p.nombre} hint={`${hint} Un valor por renglón.${opciones}`} error={error} required={p.obligatorio} htmlFor={idLista}>
        <Textarea id={idLista} error={!!error} value={texto} disabled={disabled} rows={Math.min(10, Math.max(3, texto.split('\n').length))}
          onChange={(e) => onChange(e.target.value)} />
      </Field>
    );
  }
  // object / object[]: JSON a mano, validado al enviar.
  const id = `campo-${p.nombre}`;
  return (
    <Field label={p.nombre} hint={`${hint} En formato JSON.`} error={error} required={p.obligatorio} htmlFor={id}>
      <Textarea id={id} error={!!error} value={texto} disabled={disabled} rows={Math.min(14, Math.max(4, texto.split('\n').length))}
        spellCheck={false} style={{ fontFamily: "'Geist Mono', monospace", fontSize: 'var(--fs-meta)' }}
        onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}
