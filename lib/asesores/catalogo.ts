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
  | 'emilio-puigrredon' | 'julian-alborna';

export type Asesor = {
  id: IdAsesor;
  /** Como se lo nombra en la fila y la cabecera. */
  nombre: string;
  completo: string;
  /** De qué es experto, en la galería. */
  especialidad: string;
  /** El curso de Knowledge del que sale su ficha: lo que el chat dice cuando atribuye. */
  curso: string;
  /** El Funnel Coach sin referente al frente usa sus marcos: anuncios y orgánico. Sólo esos, porque cada ficha son 5.000 caracteres en el system. */
  enElFunnel?: true;
};

export const ASESORES: readonly Asesor[] = [
  { id: 'hormozi', nombre: 'Hormozi', completo: 'Alex Hormozi', especialidad: 'Oferta', curso: '100M Money Models' },
  { id: 'juan-ads', nombre: 'Juan ADS', completo: 'Juan Osorio', especialidad: 'Anuncios', curso: 'Metodología JADS', enElFunnel: true },
  { id: 'julian-otalora', nombre: 'Julián Otálora', completo: 'Julián Otálora', especialidad: 'Contenido orgánico', curso: 'Método Contenido Irresistible', enElFunnel: true },
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
];

export const asesorPorId = (id: unknown): Asesor | null => ASESORES.find((a) => a.id === id) ?? null;

/** Lo que dice la pantalla debajo de la caricatura: nunca sugiere que la persona participa. */
export const inspiradoEn = (a: Pick<Asesor, 'completo'>): string => `Inspirado en ${a.completo}`;

// ── Qué referente tiene cada coach ───────────────────────────────────────────────────────────────────────────────────────

export type IdCoach = 'funnel' | 'offer';
/** null = MaKo, sin referente al frente. */
export type ReferentesElegidos = Record<IdCoach, IdAsesor | null>;

/** Martín: «tercero offer coach, que cambiaría por Hormozi». El Funnel Coach abre como MaKo: usa a los dos de su tema y atribuye. */
export const REFERENTES_DE_FABRICA: ReferentesElegidos = { funnel: null, offer: 'hormozi' };

/** Dónde se guarda lo elegido: app_settings del negocio. */
export const CLAVE_REFERENTES = 'coaches.referentes';

/** Lo guardado o lo que llega del navegador: un id que no existe vuelve al de fábrica, nunca rompe. */
export function sanearReferentes(v: unknown): ReferentesElegidos {
  const o = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  const uno = (c: IdCoach): IdAsesor | null => {
    if (o[c] === null) return null;
    return asesorPorId(o[c])?.id ?? REFERENTES_DE_FABRICA[c];
  };
  return { funnel: uno('funnel'), offer: uno('offer') };
}
