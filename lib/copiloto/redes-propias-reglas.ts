// =============================================================================
// Marketing CoPilot — el lector de la cuenta PROPIA (14/11/2026): lo que decide el código, PURO (con test)
// =============================================================================
// Martín a Julio (13/11, min 00:47-00:51): el CoPilot lee tu Instagram (el link del perfil, la bio, el CTA del reel más visto) y tu
// YouTube, y te dice qué tocar. Hasta hoy la tarjeta de cada red sólo decía «conectado». Los datos los trae ./redes-propias.ts:
//   · Instagram: las publicaciones de los últimos 30 días con sus números, por Zernio (lib/zernio-organico.ts, la conexión del
//     negocio); la bio y el link, por Meta cuando se puede (lib/instagram-perfil-server.ts, sólo las fuentes GRATIS: Apify queda
//     para Spy hasta que se decida quién lo paga). Las destacadas no las da ninguna API gratis: no se miran (no se inventa).
//   · YouTube: la descripción del canal, por la Data API (lib/spy-youtube.ts).
// Cada punto es un renglón «bien / a tocar» con UNA frase; lo que está a tocar es además una tarea de «Lo que te toca» (./tareas.ts).
// Lo que no se pudo leer NO es una falla: no aparece (memoria sin-falta-si-no-hay-dato).
// =============================================================================

export type PuntoRed = { clave: string; bien: boolean; texto: string; tarea?: string; href?: string };

/** Un pedido de acción: escribir, comentar, entrar al link, agendar, guardar o seguir. */
const CTA = /\b(escr[ií]b[ei]|escr[ií]beme|coment[aá](?:me)?|dm|mensaje|link|enlace|bio|agenda|reserva|clic|click|guarda|gu[aá]rdalo|s[ií]gueme|suscr[ií]bete|inscr[ií]bete|reg[ií]strate|descarga|aplica|postula|whatsapp|wa\.me)\b|👇|👉|⬇️|🔗/i;
export const tieneCta = (texto: string | null | undefined): boolean => !!texto && CTA.test(texto);

const dominio = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try { return new URL(/^https?:\/\//i.test(u) ? u : `https://${u}`).hostname.replace(/^www\./, '').toLowerCase(); } catch { return null; }
};

export type PublicacionPropia = { tipo: 'reel' | 'story' | 'post' | 'carrusel'; fecha: string | null; texto: string; vistas: number | null; url: string | null };

export type DatosInstagramPropio = {
  usuario: string;
  /** null = no se pudo leer (sin conexión de Meta con Instagram): esos puntos no aparecen. */
  bio: string | null;
  web: string | null;
  /** null = Zernio no las trajo (sin el complemento de Analytics, o falló): esos puntos no aparecen. */
  publicaciones: PublicacionPropia[] | null;
};

/** Los puntos de Instagram. `landings`: las URL de las páginas del negocio; `porSemana`: reels + carruseles que eligió (o null). */
export function puntosInstagram(d: DatosInstagramPropio, o: { landings: readonly string[]; porSemana: number | null; hoy: Date }): PuntoRed[] {
  const out: PuntoRed[] = [];
  if (d.bio != null) {
    out.push(tieneCta(d.bio)
      ? { clave: 'instagram:bio-cta', bien: true, texto: 'Tu bio pide algo concreto.' }
      : { clave: 'instagram:bio-cta', bien: false, texto: 'Tu bio no pide nada: quien llega no sabe qué hacer.', tarea: 'Suma a tu bio qué hacer: «Escríbeme» o «Agenda en el link»', href: `https://www.instagram.com/${d.usuario}/` });
    const web = dominio(d.web);
    const propias = new Set(o.landings.map(dominio).filter(Boolean));
    if (!web) out.push({ clave: 'instagram:link-perfil', bien: false, texto: 'Tu perfil no tiene link.', tarea: 'Pon el link de tu landing en tu perfil de Instagram', href: `https://www.instagram.com/${d.usuario}/` });
    else if (propias.size) {
      out.push(propias.has(web)
        ? { clave: 'instagram:link-perfil', bien: true, texto: 'El link de tu perfil lleva a tu página.' }
        : { clave: 'instagram:link-perfil', bien: false, texto: `El link de tu perfil lleva a ${web}, no a tu página.`, tarea: 'Cambia el link de tu perfil por el de tu landing', href: `https://www.instagram.com/${d.usuario}/` });
    }
  }
  if (d.publicaciones) {
    const desde = o.hoy.getTime() - 7 * 864e5;
    const semana = d.publicaciones.filter((p) => (p.tipo === 'reel' || p.tipo === 'post' || p.tipo === 'carrusel') && p.fecha && Date.parse(p.fecha) >= desde).length;
    if (o.porSemana) {
      out.push(semana >= o.porSemana
        ? { clave: 'instagram:ritmo', bien: true, texto: `Esta semana publicaste ${semana}: tu ritmo es ${o.porSemana}.` }
        : { clave: 'instagram:ritmo', bien: false, texto: `Esta semana publicaste ${semana} de ${o.porSemana}.`, tarea: `Publica ${o.porSemana - semana} más esta semana en Instagram`, href: '/calendario' });
    }
    const reels = d.publicaciones.filter((p) => p.tipo === 'reel' && p.vistas != null);
    const top = reels.sort((a, b) => (b.vistas ?? 0) - (a.vistas ?? 0))[0];
    if (top) {
      const n = (top.vistas ?? 0).toLocaleString('es');
      out.push(tieneCta(top.texto)
        ? { clave: 'instagram:reel-cta', bien: true, texto: `Tu reel más visto (${n} vistas) pide algo.` }
        : { clave: 'instagram:reel-cta', bien: false, texto: `Tu reel más visto (${n} vistas) no pide nada: esas vistas no traen mensajes.`, tarea: 'Suma un pedido al texto de tu reel más visto: «Comenta X y te lo mando»', ...(top.url ? { href: top.url } : {}) });
    }
  }
  return out;
}

export type DatosYoutubePropio = { usuario: string; descripcion: string | null; suscriptores: number | null };

export function puntosYoutube(d: DatosYoutubePropio, o: { landings: readonly string[] }): PuntoRed[] {
  if (d.descripcion == null) return [];
  const out: PuntoRed[] = [];
  const desc = d.descripcion.trim();
  if (!desc) return [{ clave: 'youtube:descripcion', bien: false, texto: 'Tu canal no tiene descripción.', tarea: 'Escribe la descripción de tu canal: a quién ayudas y qué hacer', href: 'https://studio.youtube.com/' }];
  out.push(tieneCta(desc)
    ? { clave: 'youtube:descripcion', bien: true, texto: 'La descripción de tu canal pide algo.' }
    : { clave: 'youtube:descripcion', bien: false, texto: 'La descripción de tu canal no pide nada.', tarea: 'Suma a la descripción de tu canal qué hacer y tu link', href: 'https://studio.youtube.com/' });
  const propias = o.landings.map(dominio).filter((x): x is string => !!x);
  if (propias.length) {
    const lleva = propias.some((p) => desc.toLowerCase().includes(p));
    out.push(lleva
      ? { clave: 'youtube:link', bien: true, texto: 'Tu canal lleva a tu página.' }
      : { clave: 'youtube:link', bien: false, texto: 'Tu canal no lleva a tu página.', tarea: 'Pon el link de tu landing en la descripción de tu canal', href: 'https://studio.youtube.com/' });
  }
  return out;
}
