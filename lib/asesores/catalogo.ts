// =============================================================================
// Los referentes: quién aconseja de qué en el Ops Center (1/11/2026)
// =============================================================================
// Martín: «quisiera poner caricaturas de los grandes referentes teniendo en cuenta de que cada uno se dedica o es experto en X
// cosa. Por ejemplo, en el tema de Offer Coach, quisiera justamente ponerlo ahí a Hormozi... que se pueda elegir de la misma
// manera que se eligen caricaturas de MaKo». Se elige igual: tocando la criatura del chat (app/second-brain/ElegirReferente.tsx).
//
// ⚠️ SU CARA ES public/asesores/<id>.png (app/admin/operaciones/Retratos.tsx), la que aprobó Martín. Y la pantalla dice «Inspirado en»: la persona no participa ni respalda
//    nada. Un referente nuevo necesita las dos cosas: su imagen y su ficha.
// ⚠️ CADA UNO LLEVA SU MATERIAL. Un referente sin ficha destilada de un curso no entra acá: sería un prompt con un nombre famoso.
//    La ficha vive en ./fichas.ts, que no entra al navegador.
// Sin `server-only`: lo usan la pantalla y el servidor.

export type IdAsesor = 'hormozi' | 'juan-ads' | 'julian-otalora' | 'sofia-contreras' | 'marcos-razzetti' | 'victor-heras'
  | 'agustin-nievas' | 'derek-chamizo' | 'david-turu' | 'ximena-fukuda' | 'guille-collado' | 'marc-verdu' | 'ramiro-cubria' | 'iman-gadzhi'
  // Segunda tanda (1/11/2026, Martín: «hay un montón de cursos que podríamos aprovechar de los que tenemos en Knowledge... Implementa la
  // mayor cantidad posible que tenga sentido»). Por qué estos seis y no los otros 110: docs/hallazgos-ops-center.md.
  | 'felipe-vergara' | 'jaime-higuera' | 'adria-sola' | 'augusto-bianchi' | 'tino-mossu' | 'jordi-segues'
  // ── Tercera tanda (2/11/2026): los doce que pidió Martín. El curso de cada uno está localizado
  //    en docs/pendientes-martin.md, verificado contra el `titulo:` del archivo y NO contra el
  //    nombre de la carpeta — eso ya puso dos nombres mal en producción.
  | 'emilio-puigrredon' | 'julian-alborna'
  // ── Cuarta tanda (4/11/2026): los diez que esperaban su cara (lib/asesores/en-espera.ts). Martín: «en los gurus, me siguen faltando un
  //    montón que ya habiamos hecho la miniatura». Su foto sale del canal público de cada uno; cómo, en docs/hallazgos-ops-center.md.
  | 'juan-carrizo' | 'vilma-nunez' | 'samuel-albaa' | 'alvaro-luque' | 'sergio-begueria'
  | 'romuald-fons' | 'mateo-maffia' | 'francisco-doglio' | 'andy-landa' | 'gonzalo-sere';

export type Asesor = {
  id: IdAsesor;
  /** Como se lo nombra en la fila y la cabecera. */
  nombre: string;
  completo: string;
  /** De qué es experto, en la galería. */
  especialidad: string;
  /** El curso de Knowledge del que sale su ficha: lo que el chat dice cuando atribuye. */
  curso: string;
  /** El coach sin referente al frente (eligió «MaKo») usa sus marcos: uno por tema que trabaja (oferta, anuncios y orgánico). Sólo
   *  esos, porque cada ficha son 5.000 caracteres en el system de cada mensaje. */
  enElCoach?: true;
};

export const ASESORES: readonly Asesor[] = [
  { id: 'hormozi', nombre: 'Hormozi', completo: 'Alex Hormozi', especialidad: 'Oferta', curso: '100M Money Models', enElCoach: true },
  { id: 'juan-ads', nombre: 'Juan ADS', completo: 'Juan Osorio', especialidad: 'Anuncios', curso: 'Metodología JADS', enElCoach: true },
  { id: 'julian-otalora', nombre: 'Julián Otálora', completo: 'Julián Otálora', especialidad: 'Contenido orgánico', curso: 'Método Contenido Irresistible', enElCoach: true },
  { id: 'sofia-contreras', nombre: 'Sofía Contreras', completo: 'Sofía Contreras', especialidad: 'Marketing perpetuo', curso: 'MasteryHaus' },
  { id: 'marcos-razzetti', nombre: 'Marcos Razzetti', completo: 'Marcos Razzetti', especialidad: 'Agencias: captar clientes', curso: 'Agencia 6 Cifras' },
  { id: 'victor-heras', nombre: 'Víctor Heras', completo: 'Víctor Heras', especialidad: 'Marca personal', curso: 'Master Marca Personal 5.0' },
  { id: 'agustin-nievas', nombre: 'Agustín Nievas', completo: 'Agustín Nievas', especialidad: 'Ventas y cierre', curso: 'Growing Closer' },
  { id: 'derek-chamizo', nombre: 'Derek Chamizo', completo: 'Derek Chamizo', especialidad: 'YouTube', curso: 'Universidad de YouTube' },
  { id: 'david-turu', nombre: 'David Turu', completo: 'David Turu', especialidad: 'Lanzamientos', curso: 'Academia de Lanzamiento' },
  { id: 'ximena-fukuda', nombre: 'Ximena Fukuda', completo: 'Ximena Fukuda', especialidad: 'Ventas orgánicas', curso: 'Método Fukuda' },
  { id: 'guille-collado', nombre: 'Guille Collado', completo: 'Guille Collado', especialidad: 'Contenido viral', curso: 'Hackeando el Algoritmo' },
  { id: 'marc-verdu', nombre: 'Marc Verdú', completo: 'Marc Verdú', especialidad: 'Ecommerce orgánico', curso: 'Organic Ecom 3.0' },
  { id: 'ramiro-cubria', nombre: 'Ramiro Cubria', completo: 'Ramiro Cubria', especialidad: 'Servicios high ticket', curso: 'Sell Your Knowledge' },
  { id: 'iman-gadzhi', nombre: 'Iman Gadzhi', completo: 'Iman Gadzhi', especialidad: 'Agencias: cerrar y vender', curso: 'Agency Navigator' },
  // ── Segunda tanda (1/11/2026) ──────────────────────────────────────────────────────────────────────────────────────
  // El criterio de Martín: «de algunos, por ejemplo, de trading o de e-commerce o de cosas que no tienen sentido para
  // MaKo, pero el resto sí tiene sentido». MaKo es TICKET ALTO (coaches, agencias, consultorías), así que cada curso se
  // midió por lo que ENSEÑA, no por cómo se llama — y ahí se cayeron varios que por el título parecían encajar
  // («Belikethealgo» es trading, «Master Escala 100k» es dropshipping). La lista de los descartados, con el motivo
  // de cada uno, está en docs/hallazgos-ops-center.md: es lo que evita volver a leer 130 cursos.
  { id: 'felipe-vergara', nombre: 'Felipe Vergara', completo: 'Felipe Vergara', especialidad: 'Anuncios: medir y escalar', curso: 'Vender por FB e IG Ads' },
  { id: 'jaime-higuera', nombre: 'Jaime Higuera', completo: 'Jaime Higuera', especialidad: 'Socio de crecimiento', curso: 'Growth Partner' },
  { id: 'adria-sola', nombre: 'Adrià Sola', completo: 'Adrià Sola Pastor', especialidad: 'Comunicación y oratoria', curso: 'Instituto de Comunicación' },
  { id: 'augusto-bianchi', nombre: 'Augusto Bianchi', completo: 'Augusto Bianchi', especialidad: 'Llamadas de ticket alto', curso: 'Academia Five Stars' },
  { id: 'tino-mossu', nombre: 'Tino Mossu', completo: 'Tino Mossu', especialidad: 'Objeciones y seguimiento', curso: 'La universidad del Closer' },
  { id: 'jordi-segues', nombre: 'Jordi Segués', completo: 'Jordi Segués', especialidad: 'TikTok', curso: 'TikTok 100k' },
  { id: 'emilio-puigrredon', nombre: 'Emilio Puigrredón', completo: 'Emilio Puigrredón', especialidad: 'Embudo en redes', curso: 'Social Funnel' },
  { id: 'julian-alborna', nombre: 'Julián Alborna', completo: 'Julián Alborna', especialidad: 'Contenido que se comparte', curso: 'Inteligencia Viral 2026' },
  // ── Cuarta tanda (4/11/2026) ──
  { id: 'juan-carrizo', nombre: 'Juan Carrizo', completo: 'Juan Carrizo', especialidad: 'Oferta y valor', curso: 'Aumenta tu valor y ATV ADVANTAGE' },
  { id: 'vilma-nunez', nombre: 'Vilma Núñez', completo: 'Vilma Núñez', especialidad: 'Marketing y crecimiento', curso: 'Certificación en Marketing Digital potenciada por IA' },
  { id: 'samuel-albaa', nombre: 'Samuel Albaa', completo: 'Samuel Albaa', especialidad: 'Práctica del closer', curso: 'Growing Closer' },
  { id: 'alvaro-luque', nombre: 'Álvaro Luque', completo: 'Álvaro Luque', especialidad: 'Lanzamientos', curso: 'The perfect launch' },
  { id: 'sergio-begueria', nombre: 'Sergio Begueria', completo: 'Sergio Begueria', especialidad: 'Marca personal y video', curso: 'Instituto De Marca Personal' },
  { id: 'romuald-fons', nombre: 'Romuald Fons', completo: 'Romuald Fons', especialidad: 'SEO', curso: 'Bigseo Academy' },
  { id: 'mateo-maffia', nombre: 'Mateo Maffia', completo: 'Mateo Maffia', especialidad: 'Video corto que vende', curso: 'BYF' },
  { id: 'francisco-doglio', nombre: 'Francisco Doglio', completo: 'Francisco Doglio', especialidad: 'Equipo comercial y webinars', curso: 'ARCADIA' },
  { id: 'andy-landa', nombre: 'Andy Landa', completo: 'Andy Landa', especialidad: 'Automatizaciones de Instagram', curso: 'ManyChat Master - Instagram' },
  { id: 'gonzalo-sere', nombre: 'Gonzalo Seré', completo: 'Gonzalo Seré', especialidad: 'Estrategia de contenido', curso: 'Growing Content Specialist' },
];

export const asesorPorId = (id: unknown): Asesor | null => ASESORES.find((a) => a.id === id) ?? null;

/** Lo que dice la pantalla debajo de la caricatura: nunca sugiere que la persona participa. */
export const inspiradoEn = (a: Pick<Asesor, 'completo'>): string => `Inspirado en ${a.completo}`;

// ── Quién tiene al frente el coach ─────────────────────────────────────────────────────────────────────────────────────────
// UN SOLO COACH desde el 4/11/2026. Martín: «Junta a "Offer coach" con "Funnel Coach", que se quede solo "Funnel coach" y que tenga
// ambas funcionalidades dentro... Por defecto, que esté la cara de hormozi». Hasta ese día eran dos, cada uno con su referente
// (`{ funnel, offer }` en la misma fila), y lo que alguien ya eligió en cualquiera de los dos no se pierde: lo resuelve
// `referenteDelCoach`, y lo nuevo se guarda como `{ coach }` AL LADO de lo de antes (lib/funnel-plan-db.ts), nunca encima.

/** Martín, 4/11/2026: «Por defecto, que esté la cara de hormozi». Sólo para quien nunca eligió: el default no pisa una elección. */
export const REFERENTE_DE_FABRICA: IdAsesor = 'hormozi';

/** Dónde se guarda lo elegido: app_settings del negocio. La clave es la de los dos coaches de antes, y su contenido de antes sigue ahí. */
export const CLAVE_REFERENTES = 'coaches.referentes';

/**
 * Quién aconseja en el coach, según lo guardado (o lo que llega del navegador). null = MaKo, sin referente al frente: también es
 * una elección. Un id que ya no existe nunca rompe: sigue con la regla siguiente.
 *
 * Lo de ANTES del 4/11 (`{ funnel, offer }`), con la regla de Martín: «si eligió para el Funnel Coach, gana esa; si sólo eligió para
 * el Offer Coach, se usa esa; si no eligió nada, Hormozi».
 *   · `funnel` con un referente: eligió en el Funnel Coach (su fábrica era MaKo, así que un referente ahí es una elección).
 *   · si no, `offer`: `null` es que eligió MaKo en el Offer Coach (su fábrica era Hormozi); un referente, el que eligió.
 * ⚠️ LO QUE NO SE PUEDE DISTINGUIR: cada vez que se elegía en un coach, se guardaban los DOS (el otro con su fábrica). Así que
 *    `{ funnel: null, offer: 'hormozi' }` es tanto «eligió MaKo en el Funnel Coach» como «eligió Hormozi en el Offer Coach» (o volvió
 *    a él). Sale Hormozi: una elección de Hormozi no se pisa, y una de MaKo se recupera tocando la criatura. Cuántos negocios
 *    quedaron así se mide en producción (docs/relevo/nube-funnel-coach.md).
 */
export function referenteDelCoach(v: unknown): IdAsesor | null {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  // Lo elegido desde el 4/11/2026, con el coach único.
  if ('coach' in o) {
    if (o.coach === null) return null;
    const a = asesorPorId(o.coach);
    if (a) return a.id;
  }
  const delFunnel = asesorPorId(o.funnel);
  if (delFunnel) return delFunnel.id;
  if ('offer' in o) {
    if (o.offer === null) return null;
    return asesorPorId(o.offer)?.id ?? REFERENTE_DE_FABRICA;
  }
  // Sólo `{ funnel: null }`: eligió MaKo en el Funnel Coach y nada en el de la oferta.
  return o.funnel === null ? null : REFERENTE_DE_FABRICA;
}

/** Lo que se guarda al elegir: lo de antes queda como estaba (si se vuelve atrás un deploy, cada coach sigue con lo suyo) y `coach` manda. */
export function conReferenteElegido(guardado: unknown, id: IdAsesor | null): Record<string, unknown> {
  const o = guardado && typeof guardado === 'object' && !Array.isArray(guardado) ? (guardado as Record<string, unknown>) : {};
  return { ...o, coach: asesorPorId(id)?.id ?? null };
}

/**
 * Lo que pide el navegador al elegir: `referente` (desde el 4/11/2026) o, de una pestaña abierta antes del cambio,
 * `referentes: { funnel | offer }` con UN coach. Lo de una pestaña vieja también es una elección para el coach único.
 * null = no pidió un referente que exista (la ruta contesta 400: nunca se guarda otro en su lugar).
 */
export function referentePedido(b: { referente?: unknown; referentes?: unknown }): { id: IdAsesor | null } | null {
  const uno = (v: unknown): { id: IdAsesor | null } | null => (v === null ? { id: null } : asesorPorId(v) ? { id: asesorPorId(v)!.id } : null);
  if ('referente' in b) return uno(b.referente);
  const r = b.referentes && typeof b.referentes === 'object' && !Array.isArray(b.referentes) ? (b.referentes as Record<string, unknown>) : null;
  if (r) for (const k of ['funnel', 'offer']) if (k in r) return uno(r[k]);
  return null;
}
