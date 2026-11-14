// =============================================================================
// Marketing CoPilot — la nevera de contenido, leída del Calendario (13/11/2026)
// =============================================================================
// Lee las publicaciones propias del negocio (lib/calendario.ts → listarPropios, y lib/calendario-publicar.ts → leerPublicaciones para
// la red, el archivo y si salió) de los últimos 30 días a los próximos 120, y las cuenta con ./nevera-reglas.ts. El ritmo sale de lo
// que respondió en el CoPilot (lib/media-buyer/copiloto.ts → planOrganico: reels y carruseles por semana, y las historias; en YouTube,
// `ritmo` son videos por semana). Sólo lectura, dentro de runWithWorkspace(ws).
// =============================================================================

import 'server-only';
import { runWithWorkspace } from '@/lib/workspace';
import { listarPropios } from '@/lib/calendario';
import { leerPublicaciones } from '@/lib/calendario-publicar';
import { zonaDelNegocio } from '@/lib/timezone';
import { funnelElegido, planOrganico, type PerfilCopiloto } from '@/lib/media-buyer/copiloto';
import { armarNevera, avisosDeLaNevera, type FilaNevera, type PiezaNevera, type RitmoNevera } from './nevera-reglas';
import { ritmoDeLaEntrada } from './entrada';

export type Nevera = { filas: FilaNevera[]; avisos: Array<{ formato: FilaNevera['formato']; titulo: string }>; horas: number | null; hoy: string };

const diaEn = (iso: string, tz: string): string => new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const sumar = (dia: string, n: number) => { const d = new Date(`${dia}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** El ritmo por formato, de lo que respondió en el CoPilot. Sin `ritmo` ni `tiempo` respondido, no hay ritmo (no se inventa). */
export function ritmoDelPerfil(p: PerfilCopiloto): RitmoNevera | null {
  // La entrada nueva (14/11, ./entrada.ts): el tiempo que tiene, en las redes que eligió. Gana sobre el `ritmo` de la charla vieja.
  const deLaEntrada = ritmoDeLaEntrada(p);
  if (deLaEntrada) return deLaEntrada;
  if (p.ritmo == null) return null;
  if (funnelElegido(p)?.id === 'youtube') return { video: p.ritmo };
  const { reparto } = planOrganico(p);
  return { reel: reparto.reels, post: reparto.carruseles, story: reparto.stories };
}

export async function leerNevera(ws: number, perfil: PerfilCopiloto): Promise<Nevera> {
  const tz = await zonaDelNegocio(ws);
  const hoy = diaEn(new Date().toISOString(), tz);
  const piezas = await runWithWorkspace(ws, async () => {
    const filas = (await listarPropios(sumar(hoy, -30), sumar(hoy, 120), tz)).filter((f) => f.tipo === 'publicacion');
    const pubs = await leerPublicaciones(filas.map((f) => f.id));
    return filas.map((f): PiezaNevera => {
      const p = pubs.get(f.id);
      return { formato: f.formato, red: p?.red ?? null, dia: diaEn(f.inicio, tz), conArchivo: !!p?.archivo, publicada: p?.publicacion === 'publicada', hecha: f.estado === 'hecho' };
    });
  });
  const filas = armarNevera(piezas, hoy, ritmoDelPerfil(perfil));
  const horas = perfil.horas ?? null;
  return { filas, avisos: avisosDeLaNevera(filas, horas), horas, hoy };
}
