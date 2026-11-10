import 'server-only';
import { getTenantDb } from './workspace';
import { normalizarUrl } from './landing-paginas';
import { agruparPorBoton, esDeLaLanding, totalesDe, type BotonConClics, type ClicSuelto, type FilaClic } from './landing-clics';

/** El tope de filas que se leen de una sola vez. Arriba de esto la respuesta lo dice, no lo esconde. */
const TOPE_FILAS = 5000;

export type ClicsDeLanding = {
  url: string | null;
  dias: number;
  /** El período leído, en UTC (`hasta` exclusivo). */
  desde: string;
  hasta: string;
  /** FALSE = la consulta falló. Un cero con `medido: true` es un cero de verdad. */
  medido: boolean;
  clics: number;
  personas: number;
  botones: BotonConClics[];
  /** Sólo con `boton`: los clics de ése, uno por uno, del más nuevo al más viejo. */
  historial?: ClicSuelto[];
  /** True si se llegó al tope y hay clics más viejos sin leer. */
  recortado: boolean;
  nota: string;
};

/**
 * Los clics que el Pixel guardó para este negocio.
 *
 * ⚠️ EL FILTRO DE LANDING SE HACE EN JS Y NO EN LA CONSULTA, a propósito: la misma página llega con
 * y sin protocolo, con y sin barra final y con los `utm_*` pegados, así que un `eq` sobre
 * `landing_url` devuelve un cero que parece una respuesta. Es el mismo criterio que ya usa
 * lib/landing-token.ts para contar visitas por página.
 */
export async function clicsDeLanding(opts: { url?: string | null; dias?: number; boton?: string | null; limite?: number; desde?: string; hasta?: string }): Promise<ClicsDeLanding> {
  const dias = Math.max(1, Math.min(365, Math.round(opts.dias ?? 30)));
  const urlPedida = opts.url?.trim() ? normalizarUrl(opts.url) : null;
  const boton = opts.boton?.trim() || null;
  const limite = Math.max(1, Math.min(500, Math.round(opts.limite ?? 100)));
  // `desde`/`hasta` (ISO, `hasta` exclusivo) mandan sobre `dias` cuando vienen: los arma `periodoDeFechas` (lib/landing-retencion.ts).
  const desde = opts.desde ?? new Date(Date.now() - dias * 86_400_000).toISOString();
  const hasta = opts.hasta ?? new Date(Date.now() + 60_000).toISOString();
  const vacio: ClicsDeLanding = {
    url: urlPedida, dias, desde, hasta, medido: false, clics: 0, personas: 0, botones: [], recortado: false,
    nota: 'No se pudo leer: esto NO es un cero. Vuelve a pedirlo antes de concluir que nadie tocó nada.',
  };

  const db = await getTenantDb();
  const { data, error } = await db
    .from('vsl_events')
    .select('detalle, visitor_id, created_at, landing_url')
    .eq('tipo_evento', 'click')
    // Las pruebas del Pixel no cuentan: son los toques de quien está probando la instalación.
    .is('prueba', null)
    .gte('created_at', desde)
    .lt('created_at', hasta)
    .order('created_at', { ascending: false })
    .limit(TOPE_FILAS);
  if (error) return vacio;

  const crudas = ((data ?? []) as FilaClic[]).filter((f) => esDeLaLanding(f, urlPedida, normalizarUrl));
  const recortado = (data ?? []).length >= TOPE_FILAS;
  const { clics, personas } = totalesDe(crudas);
  const botones = agruparPorBoton(crudas);

  const base: ClicsDeLanding = {
    url: urlPedida, dias, desde, hasta, medido: true, clics, personas, botones, recortado,
    nota: clics === 0
      ? 'Cero clics medidos de verdad en el período: la consulta corrió bien y no hubo ninguno.'
      : `Las horas van en UTC (terminan en Z): la zona la pone quien lo lee.${recortado ? ` Se leyeron las ${TOPE_FILAS} más nuevas: hay clics más viejos sin contar, achicá «dias».` : ''}`,
  };
  if (!boton) return base;

  // El historial de UN botón: coincide por texto contenido, porque el `detalle` trae el href completo
  // con sus utm y nadie va a pegar eso a mano.
  const aguja = boton.toLowerCase();
  const suyos = crudas.filter((f) => (f.detalle ?? '').toLowerCase().includes(aguja));
  return {
    ...base,
    botones: agruparPorBoton(suyos),
    ...totalesDe(suyos),
    historial: suyos.slice(0, limite).map((f) => ({ cuando: f.created_at, visitante: f.visitor_id ?? '(sin id)', landing: f.landing_url ?? null })),
    nota: suyos.length === 0
      ? `Ningún clic de este período coincide con «${boton}». La consulta corrió bien: es un cero de verdad. Mira los botones sin filtro para ver cómo quedó guardado el texto.`
      : `${suyos.length} clics coinciden con «${boton}». Las horas van en UTC (terminan en Z).${suyos.length > limite ? ` Se devuelven los ${limite} más nuevos.` : ''}`,
  };
}
