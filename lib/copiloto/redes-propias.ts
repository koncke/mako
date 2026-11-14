// =============================================================================
// Marketing CoPilot — el lector de la cuenta PROPIA (14/11/2026): lo que se lee de afuera
// =============================================================================
// Lo que decide está en ./redes-propias-reglas.ts (puro, con test). Acá, sólo leer, con lo que ya paga el negocio o es gratis:
//   · Instagram: sus publicaciones de 30 días por Zernio (lib/zernio-organico.ts); la bio y el link por Meta, SÓLO las fuentes
//     gratis (`meta-negocio`, `meta-plataforma`): Apify queda para Spy hasta que Martín decida quién lo paga (docs/relevo).
//   · YouTube: la descripción del canal por la Data API (`claveDeYoutube`, la misma de Spy).
// Lo que falla no tumba lo demás y NUNCA tira: el punto que no se pudo leer no aparece.
// =============================================================================

import 'server-only';
import { rendimientoInstagram } from '@/lib/zernio-organico';
import { leerPerfilInstagram } from '@/lib/instagram-perfil-server';
import { apuntaDeRef, leerCanalCorto } from '@/lib/spy-youtube';
import { claveDeYoutube } from '@/lib/youtube';
import type { DatosInstagramPropio, DatosYoutubePropio } from './redes-propias-reglas';

const dia = (d: Date) => d.toISOString().slice(0, 10);

export async function leerInstagramPropio(ws: number, usuario: string): Promise<DatosInstagramPropio> {
  const u = usuario.replace(/^@/, '').trim();
  const hoy = new Date();
  const [rend, perfil] = await Promise.all([
    rendimientoInstagram(ws, { desde: dia(new Date(hoy.getTime() - 30 * 864e5)), hasta: dia(hoy), usuario: u, limite: 40 }).catch(() => null),
    leerPerfilInstagram(u, { ws, fuentes: ['meta-negocio', 'meta-plataforma'] }).catch(() => null),
  ]);
  const pubs = rend && !('error' in rend) && rend.publicaciones
    ? rend.publicaciones.map((p) => ({ tipo: p.tipo, fecha: p.fecha, texto: p.texto, vistas: p.sinMetricas ? null : p.vistas, url: p.url }))
    : null;
  return {
    usuario: u,
    bio: perfil?.ok ? perfil.perfil.bio : null,
    web: perfil?.ok ? perfil.perfil.web : null,
    publicaciones: pubs,
  };
}

export async function leerYoutubePropio(usuario: string): Promise<DatosYoutubePropio> {
  const u = usuario.trim();
  const vacio = { usuario: u, descripcion: null, suscriptores: null };
  const clave = await claveDeYoutube().catch(() => null);
  const apunta = apuntaDeRef(u.startsWith('@') || u.startsWith('UC') ? u : `@${u}`);
  if (!clave || !apunta) return vacio;
  const l = await leerCanalCorto(apunta, clave, fetch).catch(() => null);
  return l?.ok ? { usuario: u, descripcion: l.canal.descripcion, suscriptores: l.canal.suscriptores } : vacio;
}
