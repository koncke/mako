// =============================================================================
// agente-contexto — el segundo cerebro del negocio, en markdown, para un agente
// =============================================================================
// Lo consume el Claude Code del cliente por GET /api/agente/contexto. Es lo que hace
// que su agente sepa a qué se dedica, qué vende, a quién, con qué voz y en qué fase
// está — sin que él tenga que explicarlo en cada sesión.
//
// ⚠️ «EL SEGUNDO CEREBRO ENTERO» NO ENTRA, Y NO ES UNA LIMITACIÓN: ES EL DISEÑO.
// Medido contra los seis workspaces vivos: `construirCerebro()` pesa 27-40 kB de JSON,
// las razones con sus guiones 6,5-9,1 kB, y el GET del plan del dueño ya devuelve
// 69,5 kB (438 tareas) — unos 17k tokens que se comen la ventana del agente antes de
// que el usuario escriba una palabra. Volcarle todo es la forma más segura de que no
// le quede lugar para trabajar.
//
// Por eso: un NÚCLEO chico y estable (~10 kB, tope duro de 16 kB) con lo que sirve
// SIEMPRE, y el resto por secciones bajo demanda. Es el mismo criterio que ya usa el
// doer de MaKo, que no manda el contexto entero sino que expone tools y deja que el
// modelo pida (lib/mako-tools.ts).
//
// Y NO se inventa un empaquetado nuevo: `lib/mako-context.ts → buildSystemPrompt()` ya
// arma 8-11 kB juntando persona, núcleo, perfil, fase, RAG y funnel. Acá se reusan sus
// MISMOS getters y se les suman las cinco piezas que a él no le hacen falta y a un
// agente externo sí: la voz, los avatares, las razones, el gancho y el catálogo.
// =============================================================================

import 'server-only';
import { perfilNegocioTexto } from './onboarding';
import { faseNegocioTexto } from './fase-store';
import { personalidadNegocioTexto } from './personalidad-store';
import { getPanorama } from './archivero';
import { getAvatares, avataresTexto } from './avatares';
import { getEntregables, entregablesTexto } from './entregable';
import { listProductos } from './productos';
import { getRazones } from './razones';

/** Tope duro del núcleo. Si se pasa, se recorta por secciones enteras (nunca a mitad
 *  de una frase) y se dice qué quedó afuera: un contexto truncado en silencio es peor
 *  que uno corto, porque el agente cree que lo tiene completo. */
export const TOPE_NUCLEO = 16_000;

/** Las secciones que se pueden pedir sueltas con `?seccion=`. */
export const SECCIONES = ['razones', 'panorama', 'productos'] as const;
export type SeccionAgente = (typeof SECCIONES)[number];

const limpio = (s: unknown): string => (typeof s === 'string' ? s.trim() : '');

/** Un bloque con su título, o nada si no hay contenido. Un encabezado seguido de
 *  vacío le enseña al agente que ese dato existe y está vacío, que es lo contrario de
 *  lo que queremos: si no hay, no se nombra (salvo en «lo que falta»). */
const bloque = (titulo: string, cuerpo: string): string =>
  limpio(cuerpo) ? `## ${titulo}\n\n${limpio(cuerpo)}\n` : '';

/**
 * El NÚCLEO: lo que le sirve al agente en cualquier conversación, sin importar de qué
 * hablen. Markdown y no JSON a propósito — el agente lo lee, no lo parsea, y el
 * markdown le cuesta menos tokens que las llaves y las comillas.
 */
export async function nucleoContexto(): Promise<{ md: string; recortado: string[] }> {
  const [perfil, fase, voz, avs, ents, prods] = await Promise.all([
    perfilNegocioTexto().catch(() => ''),
    faseNegocioTexto().catch(() => ''),
    personalidadNegocioTexto().catch(() => ''),
    getAvatares().catch(() => []),
    getEntregables().catch(() => []),
    listProductos(true).catch(() => []),
  ]);

  const catalogo = prods.length
    ? prods.map((p) => {
        const precio = p.monto_usd == null ? 'sin precio'
          : p.tipo === 'suscripcion' ? `USD ${p.monto_usd}/mes` : `USD ${p.monto_usd} pago único`;
        return `- ${p.nombre} — ${precio}${limpio(p.promesa) ? ` · ${limpio(p.promesa)}` : ''}`;
      }).join('\n')
    : '';

  // El orden importa: primero QUÉ es el negocio, después DÓNDE está parado (que es lo
  // que cambia las recomendaciones), y al final el detalle de a quién le vende y cómo
  // suena. Un agente que lee de arriba abajo se queda con lo primero si se le corta.
  const partes: Array<[string, string]> = [
    ['El negocio', perfil],
    ['Dónde está parado', fase],
    ['A quién le vende', avs.length ? avataresTexto(avs) : ''],
    ['El gancho', ents.length ? entregablesTexto(ents) : ''],
    ['El catálogo', catalogo],
    ['Cómo suena la marca', voz],
  ];

  let md = '';
  const recortado: string[] = [];
  for (const [titulo, cuerpo] of partes) {
    const b = bloque(titulo, cuerpo);
    if (!b) continue;
    if (md.length + b.length > TOPE_NUCLEO) { recortado.push(titulo); continue; }
    md += `${b}\n`;
  }
  return { md, recortado };
}

/** Una sección suelta, para cuando el agente la necesita de verdad. */
export async function seccionContexto(seccion: SeccionAgente): Promise<string> {
  if (seccion === 'panorama') {
    const p = await getPanorama().catch(() => '');
    return bloque('Panorama del negocio', p);
  }
  if (seccion === 'productos') {
    const prods = await listProductos().catch(() => []);
    if (!prods.length) return '';
    return bloque('Catálogo completo', prods.map((p) => [
      `### ${p.nombre}`,
      p.monto_usd != null ? `Precio: USD ${p.monto_usd}${p.tipo === 'suscripcion' ? '/mes' : ' (pago único)'}` : '',
      limpio(p.promesa) && `Promesa: ${limpio(p.promesa)}`,
      limpio(p.incluye) && `Incluye: ${limpio(p.incluye)}`,
      limpio(p.garantia) && `Garantía: ${limpio(p.garantia)}`,
    ].filter(Boolean).join('\n')).join('\n\n'));
  }
  // 'razones': la matriz avatar × razón, que es la salida de la fábrica de creativos.
  // Se manda SIN los guiones: pesan 6,5-9,1 kB y quien los quiera los pide por su tab.
  const [razones, avs] = await Promise.all([getRazones().catch(() => []), getAvatares().catch(() => [])]);
  if (!razones.length) return '';
  const nombreAvatar = new Map(avs.map((a) => [a.id, a.nombre]));
  const lineas = razones.map((r) => {
    const quien = nombreAvatar.get(r.avatarId) ?? 'un segmento';
    const guiones = r.guiones?.length ? ` · ${r.guiones.length} ${r.guiones.length === 1 ? 'guion escrito' : 'guiones escritos'}` : '';
    return `- **${quien} → ${r.nombre}**${limpio(r.descripcion) ? `: ${limpio(r.descripcion)}` : ''}${limpio(r.copy) ? `\n  Hook: «${limpio(r.copy)}»` : ''}${guiones}`;
  });
  return bloque('Por qué compra cada segmento (la matriz)', lineas.join('\n'));
}

/**
 * El documento completo que devuelve el endpoint. Incluye el índice de lo que se puede
 * pedir aparte: sin eso, el agente no sabe que existe más y trabaja con menos de lo que
 * hay — que es exactamente el fallo silencioso que este módulo viene a evitar.
 */
export async function contextoParaAgente(): Promise<string> {
  const { md, recortado } = await nucleoContexto();
  const vacio = !limpio(md);
  const cabecera = [
    '# Tu negocio, según MaKo',
    '',
    vacio
      ? 'Todavía no hay contexto cargado. El cliente lo construye completando el onboarding en MaKo; hasta entonces, preguntale a él lo que necesites en vez de suponerlo.'
      : 'Esto es lo que MaKo sabe del negocio de quien te está hablando. Usalo como contexto de fondo: no hace falta que te lo vuelva a explicar.',
    '',
  ].join('\n');

  const pie = [
    '',
    '## Si necesitás más',
    '',
    'Estas secciones NO vienen acá porque son grandes y casi nunca hacen falta. Pedilas solo cuando el trabajo las requiera:',
    '',
    ...SECCIONES.map((s) => `- \`GET /api/agente/contexto?seccion=${s}\``),
    '',
    recortado.length
      ? `⚠️ Este resumen se recortó por tamaño. Quedó afuera: ${recortado.join(', ')}.`
      : '',
  ].filter(Boolean).join('\n');

  return `${cabecera}${md}${pie}\n`;
}
