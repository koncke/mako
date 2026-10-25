// =============================================================================
// Completar los datos de muchos leads — las dos máquinas del lado de la PANTALLA (24/10/2026)
// =============================================================================
// Las comparten el modal de traer de un grupo (./TraerDeGrupoWA.tsx) y la barra de lote del tablero (./AccionesLoteLeads.tsx):
// Martín pidió completar «en lote, con el multiple check, no sólo cuando cargo nuevos de grupos», y dos copias del mismo bucle
// son dos lugares donde un arreglo se olvida. Puras (sin React ni server): las llamadas al server entran por parámetro, así los
// tests las corren con dobles (tests/enriquecer-lote.test.ts).
//
// LA REGLA (la de AGENTS.md, «lote de a tandas»): de a tandas en serie, con avance; lo que el server no llegó a hacer vuelve a
// la cola; «Parar» frena entre una llamada y la siguiente; y si algo se corta, se dice cuántos sí y cuántos no. Nunca un corte
// callado, y nunca un bucle que no termina.

import type { ResultadoFichas, ResultadoPerfiles } from './grupo-wa-server';
import { TANDA_FICHAS, nombreDeFicha, type FichaWa } from '@/lib/grupo-wa-reglas';
import { miles } from './traer-seleccion';

const msg = (e: unknown) => (e instanceof Error ? e.message : 'error');

export type AvanceFichas = { nombres: number; empresas: number; guardadas: number; total: number; parado: boolean; error: string | null };

/**
 * Guarda las fichas que leyó la extensión, de a `TANDA_FICHAS`. `guardar` es la acción del server (la del grupo o la del lote);
 * lo que devuelve en `pendientes` (cortó por tiempo) vuelve al FRENTE de la cola. Una tanda que vuelve entera sin guardar corta
 * y lo dice. `parar()` se mira antes de cada tanda.
 */
export async function guardarFichasEnTandas(
  fichas: readonly FichaWa[], guardar: (tanda: FichaWa[]) => Promise<ResultadoFichas>,
  o: { parar: () => boolean; alAvanzar?: (guardadas: number, total: number) => void },
): Promise<AvanceFichas> {
  let nombres = 0, empresas = 0, guardadas = 0;
  let cola = [...fichas];
  const fin = (parado: boolean, error: string | null): AvanceFichas => ({ nombres, empresas, guardadas, total: fichas.length, parado, error });
  while (cola.length) {
    if (o.parar()) return fin(true, null);
    const tanda = cola.slice(0, TANDA_FICHAS);
    o.alAvanzar?.(guardadas, fichas.length);
    let g: ResultadoFichas;
    try { g = await guardar(tanda); } catch (e) { return fin(false, `${msg(e)} · quedaron ${miles(cola.length)} sin guardar.`); }
    if (!g.ok) return fin(false, `${g.error} · quedaron ${miles(cola.length)} sin guardar.`);
    nombres += g.nombres; empresas += g.empresas;
    const quedan = new Set(g.pendientes);
    const vuelven = tanda.filter((x) => quedan.has(x.telefono));
    if (vuelven.length === tanda.length) return fin(false, `Se cortó guardando: quedaron ${miles(cola.length)} sin guardar. Vuelve a tocar para seguir.`);
    guardadas += tanda.length - vuelven.length;
    cola = [...vuelven, ...cola.slice(tanda.length)];
  }
  return fin(false, null);
}

/** Lo que el WhatsApp de la persona tiene de esos leads: con nombre, cuenta de empresa, en 2 o más grupos suyos. */
export function coberturaDeFichas(fichas: readonly FichaWa[]): { conNombre: number; deEmpresa: number; enVarios: number } {
  return {
    conNombre: fichas.filter((x) => !!nombreDeFicha(x)).length,
    deEmpresa: fichas.filter((x) => x.esEmpresa).length,
    enVarios: fichas.filter((x) => x.grupos.length >= 2).length,
  };
}

/** El aviso al terminar «Completar desde mi WhatsApp»: la cobertura, lo escrito, y si paró o se cortó. */
export function resumenDeFichas(pedidos: number, fichas: readonly FichaWa[], a: AvanceFichas): string {
  const c = coberturaDeFichas(fichas);
  const escrito = `${miles(a.nombres)} ${a.nombres === 1 ? 'nombre completado' : 'nombres completados'}${a.empresas ? `, ${miles(a.empresas)} ${a.empresas === 1 ? 'empresa' : 'empresas'}` : ''}`;
  const cola = a.parado ? ' Paraste antes de terminar.' : a.error ? ` ${a.error}` : '';
  return `De ${miles(pedidos)}, tu WhatsApp tiene el nombre de ${miles(c.conNombre)}, ${miles(c.deEmpresa)} son cuenta de empresa y ${miles(c.enVarios)} están en 2 o más grupos tuyos · ${escrito}.${cola}`;
}

export type AvancePerfiles = {
  hechas: number; empresas: number; completados: number; campos: number;
  /** Los que siguen sin consultar al terminar (para decir «faltan N»). */
  pendientes: number;
  corte: 'dia' | 'corrida' | null; parado: boolean; error: string | null;
};

/** Cuántas llamadas puede hacer una corrida como mucho (cada una, ~40 s): con el tope de 40 consultas sobra; si se llega, se dice. */
const VUELTAS_PERFILES = 20;

/**
 * Corre «Datos de empresa» después de la pregunta: llama con lo ya consultado (`hechas`, el tope de la corrida) y los que no
 * contestaron (`saltear`, para no empezar por ellos), hasta que el server dice que no sigue. El tope del DÍA lo cuenta el server.
 */
export async function correrPerfiles(
  cuenta: { pendientes: number; estaCorrida: number },
  llamar: (hechas: number, saltear: string[]) => Promise<ResultadoPerfiles>,
  o: { parar: () => boolean; alAvanzar?: (hechas: number, meta: number) => void },
): Promise<AvancePerfiles> {
  let hechas = 0, empresas = 0, completados = 0, campos = 0, pendientes = cuenta.pendientes;
  let corte: 'dia' | 'corrida' | null = null;
  const saltear: string[] = [];
  const fin = (parado: boolean, error: string | null): AvancePerfiles => ({ hechas, empresas, completados, campos, pendientes, corte, parado, error });
  for (let vuelta = 0; vuelta < VUELTAS_PERFILES; vuelta++) {
    if (o.parar()) return fin(true, null);
    o.alAvanzar?.(hechas, cuenta.estaCorrida);
    let r: ResultadoPerfiles;
    try { r = await llamar(hechas, [...saltear]); } catch (e) { return fin(false, msg(e)); }
    if (!r.ok) return fin(false, r.error);
    hechas += r.revisados; empresas += r.empresas; completados += r.completados; campos += r.campos;
    saltear.push(...r.sinRespuesta);
    pendientes = r.pendientes - (r.revisados - r.sinRespuesta.length);
    corte = r.corte;
    if (!r.sigue) return fin(false, null);
    if (r.revisados === 0) return fin(false, 'El servidor no llegó a consultar ninguno: prueba de nuevo en un rato.');
  }
  return fin(false, `Se cortó después de ${miles(hechas)} consultas: vuelve a tocar para seguir.`);
}

/** El aviso al terminar «Datos de empresa»: lo encontrado, y por qué quedan (el tope del día, o «vuelve a tocar»). */
export function resumenDePerfiles(a: AvancePerfiles): string {
  const datos = a.completados ? ` · ${miles(a.completados)} con datos nuevos (${miles(a.campos)} entre web, Instagram, correo y dirección)` : ' · ningún dato nuevo';
  const resto = a.pendientes <= 0 ? '' : a.corte === 'dia'
    ? ` Por hoy se terminaron las consultas de esta línea: mañana vuelve a tocar «Datos de empresa» para seguir con los ${miles(a.pendientes)} que faltan (los ya consultados no se repiten).`
    : ` Faltan ${miles(a.pendientes)}: vuelve a tocar «Datos de empresa» para seguir.`;
  const cola = a.parado ? ' Paraste antes de terminar.' : a.error ? ` ${a.error}` : '';
  return `${miles(a.empresas)} de ${miles(a.hechas)} tienen cuenta de empresa${datos}.${resto}${cola}`;
}

/**
 * La pregunta antes de «Datos de empresa»: cuántos ahora de cuántos faltan, y en cuánto (el Cerebro, 24/10: «la cuenta y el
 * tiempo antes»). CORTA a propósito: Martín en la llamada con Leandro (24/10, f13), sobre la que decía también el cupo del día
 * y que sólo se completa lo vacío: «el texto muy largo. No me gustan textos largos». El título pregunta y el botón dice
 * «Consultar N»; el tope del día se dice cuando corta, en `resumenDePerfiles`.
 */
export function preguntaDePerfiles(c: { pendientes: number; estaCorrida: number }, minutos: number, linea?: string | null): string {
  const cuantos = c.estaCorrida < c.pendientes ? `${miles(c.estaCorrida)} de los ${miles(c.pendientes)} que faltan` : `Los ${miles(c.pendientes)} que faltan`;
  const tiempo = minutos <= 1 ? 'un minuto' : `unos ${minutos} min`;
  // Desde el tablero la línea no se ve: se nombra (la consulta sale por ESA línea).
  return `${cuantos}, ${tiempo}${linea ? `, desde «${linea}»` : ''}. No les llega nada.`;
}
