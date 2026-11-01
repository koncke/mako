// =============================================================================
// Los referentes: quién aconseja de qué en el Ops Center (1/11/2026)
// =============================================================================
// Martín: «quisiera poner caricaturas de los grandes referentes teniendo en cuenta de que cada uno se dedica o es experto en X
// cosa. Por ejemplo, en el tema de Offer Coach, quisiera justamente ponerlo ahí a Hormozi... que se pueda elegir de la misma
// manera que se eligen caricaturas de MaKo». Se elige igual: tocando la criatura del chat (app/second-brain/ElegirReferente.tsx).
//
// ⚠️ DOS REGLAS DE OFICIO, NO UN RECORTE: la caricatura es un DIBUJO nuestro (app/admin/operaciones/Retratos.tsx), nunca una foto
//    procesada; y la pantalla dice «Inspirado en», porque la persona no participa ni respalda nada.
// ⚠️ CADA UNO LLEVA SU MATERIAL. Un referente sin ficha destilada de un curso no entra acá: sería un prompt con un nombre famoso.
//    La ficha vive en ./fichas.ts, que no entra al navegador.
// Sin `server-only`: lo usan la pantalla y el servidor.

export type IdAsesor = 'hormozi' | 'juan-ads' | 'julian-otalora' | 'sofia-contreras' | 'marcos-razzetti' | 'victor-heras'
  | 'agustin-nievas' | 'derek-chamizo' | 'david-turu' | 'ximena-fukuda' | 'guille-collado' | 'marc-verdu' | 'ramiro-cubria' | 'iman-gadzhi';

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
  { id: 'marcos-razzetti', nombre: 'Marcos Razzetti', completo: 'Marcos Razzetti', especialidad: 'Agencias', curso: 'Agencia 6 Cifras' },
  { id: 'victor-heras', nombre: 'Víctor Heras', completo: 'Víctor Heras', especialidad: 'Marca personal', curso: 'Master Marca Personal 5.0' },
  { id: 'agustin-nievas', nombre: 'Agustín Nievas', completo: 'Agustín Nievas', especialidad: 'Ventas y cierre', curso: 'Growing Closer' },
  { id: 'derek-chamizo', nombre: 'Derek Chamizo', completo: 'Derek Chamizo', especialidad: 'YouTube', curso: 'Universidad de YouTube' },
  { id: 'david-turu', nombre: 'David Turu', completo: 'David Turu', especialidad: 'Lanzamientos', curso: 'Academia de Lanzamiento' },
  { id: 'ximena-fukuda', nombre: 'Ximena Fukuda', completo: 'Ximena Fukuda', especialidad: 'Ventas orgánicas', curso: 'Método Fukuda' },
  { id: 'guille-collado', nombre: 'Guille Collado', completo: 'Guille Collado', especialidad: 'Contenido viral', curso: 'Hackeando el Algoritmo' },
  { id: 'marc-verdu', nombre: 'Marc Verdú', completo: 'Marc Verdú', especialidad: 'Ecommerce orgánico', curso: 'Organic Ecom 3.0' },
  { id: 'ramiro-cubria', nombre: 'Ramiro Cubria', completo: 'Ramiro Cubria', especialidad: 'Servicios high ticket', curso: 'Sell Your Knowledge' },
  { id: 'iman-gadzhi', nombre: 'Iman Gadzhi', completo: 'Iman Gadzhi', especialidad: 'Agencias', curso: 'Agency Navigator' },
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
