// =============================================================================
// api-mako/validar — del `parametros` de una operación salen el esquema y el saneo
// =============================================================================
// Una sola declaración (`Parametro[]`) y de ella:
//   · `esquemaJson()`  → el `input_schema` del ToolDef que ve Claude;
//   · `validarInput()` → lo que entra por HTTP (query string o body) o por una tool,
//                        con SOLO las claves declaradas y con el tipo que la lib espera.
//
// ⚠️ SOLO PASA LO DECLARADO. Un `Object.fromEntries(searchParams)` le entrega al
// runner cualquier clave que alguien invente, y esas claves terminan adentro de un
// `input` que las libs leen por nombre. Es la misma regla que ya tenía
// lib/agente-consultas.ts, ahora para todo el registro.
//
// ⚠️ LOS OPCIONALES QUE NO VIENEN NO SE MANDAN COMO VACÍOS: `limite: ''` o `limite: 0`
// pisaría el default de la lib con algo que nadie pidió.
//
// ⚠️ TODO TIENE TOPE. Un string sin `max` corta en 4000 caracteres y una lista en
// 200 ítems: un cuerpo sin tope es un JSON de megas en una función serverless, y
// el tope del cuerpo entero (256 KB) vive en http.ts.
//
// SIN `server-only`: es lógica pura, y los tests la ejercitan con entradas rotas.
// =============================================================================

import type { Parametro } from './tipos';

type Json = Record<string, unknown>;

export const MAX_STRING_DEFAULT = 4000;
export const MAX_ITEMS_DEFAULT = 200;

/** El `input_schema` (JSON Schema) que ve el modelo, derivado de `parametros`. */
export function esquemaJson(parametros: readonly Parametro[]): Json {
  const properties: Json = {};
  const required: string[] = [];
  for (const p of parametros) {
    properties[p.nombre] = propiedadJson(p);
    if (p.obligatorio) required.push(p.nombre);
  }
  const schema: Json = { type: 'object', properties };
  if (required.length) schema.required = required;
  return schema;
}

function propiedadJson(p: Parametro): Json {
  const base: Json = { description: p.descripcion };
  switch (p.tipo) {
    case 'string': return { ...base, type: 'string', ...(p.enum?.length ? { enum: [...p.enum] } : {}) };
    case 'number': return {
      ...base, type: p.entero ? 'integer' : 'number',
      ...(p.minimo != null ? { minimum: p.minimo } : {}),
      ...(p.maximo != null ? { maximum: p.maximo } : {}),
    };
    case 'boolean': return { ...base, type: 'boolean' };
    case 'string[]': return { ...base, type: 'array', items: { type: 'string', ...(p.enum?.length ? { enum: [...p.enum] } : {}) } };
    case 'object': return { ...base, ...esquemaJson(p.campos ?? []) };
    case 'object[]': return { ...base, type: 'array', items: esquemaJson(p.campos ?? []) };
  }
}

export type Validado = { input: Json } | { error: string; faltan?: string[] };

/**
 * Sanea un input crudo contra `parametros`.
 *
 * `origen: 'query'` es la query string de un GET: todo llega como string y se
 * coerciona (`"42"` → 42, `"true"` → true, `"a,b"` → ['a','b'], JSON para objetos).
 * `origen: 'json'` es un body o el input de una tool: los tipos ya vienen puestos y
 * un tipo equivocado se rechaza con un mensaje que dice QUÉ, porque lo lee un agente
 * que se puede corregir solo.
 */
export function validarInput(
  parametros: readonly Parametro[],
  crudo: Record<string, unknown> | null | undefined,
  origen: 'query' | 'json',
  camino = '',
): Validado {
  const src = crudo ?? {};
  const input: Json = {};
  const faltan: string[] = [];
  for (const p of parametros) {
    const ruta = camino ? `${camino}.${p.nombre}` : p.nombre;
    const v = src[p.nombre];
    const vacio = v == null || (typeof v === 'string' && v.trim() === '');
    if (vacio) {
      if (p.obligatorio) faltan.push(ruta);
      continue;
    }
    const r = coercionar(p, v, origen, ruta);
    if ('error' in r) return r;
    // Una lista obligatoria que queda vacía (`[]`, o `["", " "]` después de limpiar)
    // es una lista que no vino: pasarla haría que la lib reciba nada con cara de algo.
    // Salvo que la lista se declare `vaciaEsValor`: ahí `[]` es «vaciar».
    if (Array.isArray(r.valor) && r.valor.length === 0 && !(p.vaciaEsValor && !p.obligatorio)) {
      if (p.obligatorio) faltan.push(ruta);
      continue;
    }
    input[p.nombre] = r.valor;
  }
  if (faltan.length) {
    return { error: `falta${faltan.length === 1 ? '' : 'n'} ${faltan.map((f) => `«${f}»`).join(', ')}`, faltan };
  }
  return { input };
}

type Coercion = { valor: unknown } | { error: string };

function coercionar(p: Parametro, v: unknown, origen: 'query' | 'json', ruta: string): Coercion {
  const tipoRecibido = Array.isArray(v) ? 'array' : typeof v;
  const mal = (esperado: string): Coercion => ({ error: `«${ruta}» tiene que ser ${esperado}, llegó ${tipoRecibido === 'string' ? `«${String(v).slice(0, 60)}»` : tipoRecibido}` });
  const maxStr = p.max ?? MAX_STRING_DEFAULT;
  const maxItems = p.max ?? MAX_ITEMS_DEFAULT;

  switch (p.tipo) {
    case 'string': {
      let s: string;
      if (typeof v === 'string') s = v.trim();
      else if (origen === 'json' && (typeof v === 'number' || typeof v === 'boolean')) s = String(v);
      else return mal('un texto');
      if (s.length > maxStr) return { error: `«${ruta}» supera el tope de ${maxStr} caracteres (llegaron ${s.length})` };
      // Un NUL no lo tipea nadie, y Postgres lo rechaza con un error crudo de la base.
      if (s.includes('\u0000')) return { error: `«${ruta}» trae un carácter nulo, que no se puede guardar` };
      return enumOk(p, s, ruta);
    }
    case 'number': {
      const n = typeof v === 'number' ? v : (typeof v === 'string' ? Number(v.trim()) : NaN);
      if (!Number.isFinite(n)) return mal('un número');
      if (p.entero && !Number.isInteger(n)) return { error: `«${ruta}» tiene que ser un número entero, llegó ${n}` };
      if (p.minimo != null && n < p.minimo) return { error: `«${ruta}» tiene que ser al menos ${p.minimo}, llegó ${n}` };
      if (p.maximo != null && n > p.maximo) return { error: `«${ruta}» tiene que ser como mucho ${p.maximo}, llegó ${n}` };
      return { valor: n };
    }
    case 'boolean': {
      if (typeof v === 'boolean') return { valor: v };
      if (typeof v === 'string') {
        const t = v.trim().toLowerCase();
        if (['true', '1', 'si', 'sí', 'yes'].includes(t)) return { valor: true };
        if (['false', '0', 'no'].includes(t)) return { valor: false };
      }
      return mal('true o false');
    }
    case 'string[]': {
      let arr: unknown;
      if (Array.isArray(v)) arr = v;
      else if (typeof v === 'string') arr = origen === 'query' || !v.trim().startsWith('[') ? v.split(',') : parseJson(v);
      if (!Array.isArray(arr) || !arr.every((x) => typeof x === 'string')) return mal('una lista de textos');
      const lista = arr.map((x) => String(x).trim()).filter(Boolean);
      if (lista.length > maxItems) return { error: `«${ruta}» supera el tope de ${maxItems} ítems (llegaron ${lista.length})` };
      for (const x of lista) {
        if (x.length > MAX_STRING_DEFAULT) return { error: `un ítem de «${ruta}» supera los ${MAX_STRING_DEFAULT} caracteres` };
        if (x.includes('\u0000')) return { error: `un ítem de «${ruta}» trae un carácter nulo` };
        const e = enumOk(p, x, ruta); if ('error' in e) return e;
      }
      return { valor: lista };
    }
    case 'object': {
      const obj = typeof v === 'string' ? parseJson(v) : v;
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return mal('un objeto');
      const r = validarInput(p.campos ?? [], obj as Json, 'json', ruta);
      return 'error' in r ? { error: r.error } : { valor: r.input };
    }
    case 'object[]': {
      const arr = typeof v === 'string' ? parseJson(v) : v;
      if (!Array.isArray(arr)) return mal('una lista de objetos');
      if (arr.length > maxItems) return { error: `«${ruta}» supera el tope de ${maxItems} ítems (llegaron ${arr.length})` };
      const salida: Json[] = [];
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i];
        if (!it || typeof it !== 'object' || Array.isArray(it)) return { error: `«${ruta}[${i}]» tiene que ser un objeto` };
        const r = validarInput(p.campos ?? [], it as Json, 'json', `${ruta}[${i}]`);
        if ('error' in r) return { error: r.error };
        salida.push(r.input);
      }
      return { valor: salida };
    }
  }
}

function enumOk(p: Parametro, valor: string, ruta: string): Coercion {
  if (p.enum?.length && !p.enum.includes(valor)) {
    return { error: `«${ruta}» tiene que ser uno de: ${p.enum.join(' | ')}; llegó «${valor.slice(0, 60)}»` };
  }
  return { valor };
}

function parseJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return undefined; }
}
