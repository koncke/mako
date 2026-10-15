// =============================================================================
// crear/recientes — «Tus indicaciones recientes»: comodidad de ESTE navegador (localStorage), nunca un dato
// =============================================================================
// Vivían en CrearConIA.tsx, en las pantallas «Generar» y «Pegar texto». Tanda 7 (Martín, 15/10/2026): el cuadro
// «¿Qué vas a crear hoy?» es la única puerta, y el «+» queda para ADJUNTAR: las indicaciones recientes van ahí
// (CajaCrear.tsx), y Crear las anota al pedir un esquema (`recordarIndicacion`).
// Por dónde entró el pedido: una instrucción (Generar) o un texto (Pegar, también el de un archivo importado).
// localStorage puede venir vacío o tirar (ventana privada): `leerLocal`/`guardarLocal` ya lo atajan.
// =============================================================================

import { guardarLocal, leerLocal } from '../cliente';

export type OrigenIndicacion = 'generar' | 'pegar';
export type Indicacion = { modo: OrigenIndicacion; texto: string; t: number };

const CLAVE_INDICACIONES = 'gp.crear.indicaciones';
const TOPE_INDICACIONES = 6;

export function leerIndicaciones(): Indicacion[] {
  const l = leerLocal<unknown>(CLAVE_INDICACIONES, []);
  return Array.isArray(l)
    ? (l as Indicacion[]).filter((x) => x && typeof x.texto === 'string' && x.texto.trim() && (x.modo === 'generar' || x.modo === 'pegar') && typeof x.t === 'number')
    : [];
}

export function recordarIndicacion(modo: OrigenIndicacion, texto: string): void {
  const t = texto.trim().slice(0, 20_000);
  if (!t) return;
  const otras = leerIndicaciones().filter((x) => !(x.modo === modo && x.texto === t));
  guardarLocal(CLAVE_INDICACIONES, [{ modo, texto: t, t: Date.now() }, ...otras].slice(0, TOPE_INDICACIONES));
}
