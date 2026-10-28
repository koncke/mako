// =============================================================================
// avatares-ganados — los clientes que YA compraron, como prueba para armar los avatares (27/10/2026, MAU-02)
// =============================================================================
// Mauricio (ws1): «que redefina o defina mi avatar considerando los clientes que son ganados... no funciona al preguntar».
// `generarAvatares` (lib/avatares.ts) armaba los avatares con el perfil, el panorama y la fase: nunca miraba a quién le
// vendió de verdad. Esto le suma un bloque con los leads GANADOS del CRM, AGREGADO: cuántos, el ticket, el sexo, el ingreso
// estimado, lo que contestaron en el formulario (lo más repetido por pregunta) y por dónde entraron. Sin nombres, emails,
// teléfonos ni empresas: el avatar es un segmento, no una persona.
// ⚠️ ES DATO DE LOS CLIENTES DEL NEGOCIO: el pedido va con `pii` (sólo IA que no entrena con lo que recibe).
//
// `bloqueDeGanados` es puro (tests/avatares-ganados.test.ts); la lectura, `leerGanadosParaAvatar`, server.
// =============================================================================

import { respuestasGuardadas } from './optin-respuestas';

export type GanadoParaAvatar = {
  sexo?: string | null;
  ingreso_estimado?: string | null;
  optin_respuestas?: unknown;
  pagina_registro?: string | null;
  entrada_social?: string | null;
  monto_cierre_usd?: number | string | null;
};

/** Preguntas del formulario que son datos de contacto, no del segmento: no viajan. */
const DE_CONTACTO = /nombre|apellido|e-?mail|correo|tel[eé]fono|celular|whats|instagram|usuario|@|dni|documento/i;
/** Desde cuántos ganados el bloque dice algo (con menos, no es un patrón: es una anécdota). */
export const MINIMO_GANADOS = 3;

const contar = (xs: readonly string[]) => {
  const m = new Map<string, number>();
  for (const x of xs) { const k = x.trim(); if (k) m.set(k, (m.get(k) ?? 0) + 1); }
  return [...m].sort((a, b) => b[1] - a[1]);
};
const top = (xs: readonly string[], n = 4) => contar(xs).slice(0, n).map(([k, v]) => `${k} (${v})`).join(', ');
const pagina = (u: string) => { try { return new URL(u).pathname.replace(/\/+$/, '') || '/'; } catch { return u.slice(0, 60); } };

/**
 * El bloque para el prompt de los avatares, o '' si no hay ganados suficientes. Lo escribe el CÓDIGO: los números salen de
 * los datos, y el modelo los usa como prueba.
 */
export function bloqueDeGanados(filas: readonly GanadoParaAvatar[]): string {
  if (filas.length < MINIMO_GANADOS) return '';
  const lineas: string[] = [];
  const montos = filas.map((f) => Number(f.monto_cierre_usd)).filter((n) => Number.isFinite(n) && n > 0);
  lineas.push(`- Ganados en el CRM: ${filas.length}${montos.length ? `; ticket promedio US$${Math.round(montos.reduce((a, b) => a + b, 0) / montos.length)} (de ${montos.length} con monto)` : ''}.`);
  const sexos = filas.map((f) => String(f.sexo ?? '').trim().toLowerCase()).filter(Boolean);
  if (sexos.length) lineas.push(`- Sexo (de ${sexos.length} con el dato): ${top(sexos)}.`);
  const ingresos = filas.map((f) => String(f.ingreso_estimado ?? '').trim()).filter(Boolean);
  if (ingresos.length) lineas.push(`- Ingreso estimado (de ${ingresos.length}): ${top(ingresos)}.`);
  const porPregunta = new Map<string, string[]>();
  for (const f of filas) {
    for (const r of respuestasGuardadas(f.optin_respuestas)) {
      if (DE_CONTACTO.test(r.pregunta) || !r.respuesta.trim() || r.respuesta.length > 80) continue;
      const k = r.pregunta.trim().slice(0, 120);
      (porPregunta.get(k) ?? porPregunta.set(k, []).get(k)!).push(r.respuesta.trim().toLowerCase());
    }
  }
  for (const [pregunta, respuestas] of [...porPregunta].sort((a, b) => b[1].length - a[1].length).slice(0, 6)) {
    lineas.push(`- «${pregunta}» (contestaron ${respuestas.length}): ${top(respuestas)}.`);
  }
  const entradas = filas.map((f) => String(f.entrada_social ?? '').trim() || (f.pagina_registro ? pagina(String(f.pagina_registro)) : '')).filter(Boolean);
  if (entradas.length) lineas.push(`- Por dónde entraron: ${top(entradas)}.`);
  return [
    `LOS QUE YA TE COMPRARON (los clientes GANADOS del CRM, agregados): son la prueba de a quién le vende de verdad. Arma los avatares PARTIENDO de ellos y, si el perfil dice otra cosa, gana lo que muestran los ganados.`,
    ...lineas,
  ].join('\n');
}

/** Los ganados del negocio en curso, con sólo lo que sirve para el segmento (server: lo importa lib/avatares.ts). */
export async function leerGanadosParaAvatar(): Promise<GanadoParaAvatar[]> {
  const { getTenantDb } = await import('./workspace');
  const { leerTodo } = await import('./supabase-paginado');
  const db = await getTenantDb();
  return leerTodo<GanadoParaAvatar & { id: number }>(db, 'leads', 'id, sexo, ingreso_estimado, optin_respuestas, pagina_registro, entrada_social, monto_cierre_usd',
    { orden: 'id', eq: { estado_lead: 'ganado' } });
}
