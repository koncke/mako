// =============================================================================
// Lo que lee «Configurar el piloto», para la computadora (./page.tsx) y el teléfono (app/m/ads/page.tsx, `?configurar=1`) — 14/11/2026
// =============================================================================

import 'server-only';
import { leerConfig, cupoDe } from '@/lib/media-buyer/store';
import { resolverTacticas } from '@/lib/media-buyer/tacticas';
import { leerPilotoRedes, numeroDelReel, pilotoRedesPermitido } from '@/lib/copiloto/piloto';
import { leerPerfilCopiloto } from '@/lib/media-buyer/copiloto-store';
import { ritmoDelPerfil } from '@/lib/copiloto/nevera';
import { getPlantilla } from '@/lib/plantillas';
import { runWithWorkspace } from '@/lib/workspace';
import { verRetargeting } from '@/lib/retargeting';
import type { ComponentProps } from 'react';
import type { ConfigurarPiloto, InicialPiloto } from './ConfigurarPiloto';

export async function cargarConfigurar(ws: number, pedida: string | undefined): Promise<ComponentProps<typeof ConfigurarPiloto>> {
  // `redesPermitidas`: el piloto de Instagram y el de YouTube son de MaKo Pro (14/11/2026); a un Esencial, su hoja es el candado.
  // Ante la duda, abierto (el servidor decide igual: lib/copiloto/piloto.ts → `guardarPilotoRedes` y `guardarNumeroReel`).
  const [config, cupo, reel, rt, redesPermitidas] = await Promise.all([leerConfig(ws), cupoDe(ws), numeroDelReel(ws).catch(() => null), verRetargeting(ws).catch(() => null), pilotoRedesPermitido(ws).catch(() => true)]);
  const red = pedida === 'instagram' || pedida === 'youtube' ? pedida : 'anuncios';
  // El piloto de Instagram y YouTube (lib/copiloto/piloto-redes.ts): lo de fábrica sale del ritmo del perfil.
  const perfil = await leerPerfilCopiloto(ws).catch(() => ({}));
  const [pilotoRedes, plantilla] = await Promise.all([
    leerPilotoRedes(ws, ritmoDelPerfil(perfil)).catch(() => null),
    runWithWorkspace(ws, () => getPlantilla('copiloto-nevera')).catch(() => null),
  ]);
  const redes = pilotoRedes ? { instagram: pilotoRedes.instagram, youtube: pilotoRedes.youtube, avisoNevera: plantilla?.enabled ?? true } : null;
  // Lo que vale hoy de cada táctica (el motor no viaja al navegador: se resuelve acá).
  const t = resolverTacticas(config.tacticas, { piloto: config.modo === 'piloto', pilotoPermitido: cupo.piloto });
  const inicial: InicialPiloto = {
    encendido: config.encendido, kpi: config.kpi, objetivo: config.objetivo, metaGastoMes: config.metaGastoMes, tacticas: config.tacticas,
    subida: Math.round(t.surf.p.subidaPct ?? config.subidaMaxPctDia),
    solo: { stop_loss: t.stop_loss.estado === 'automatica', surf: t.surf.estado === 'automatica', sunsetting: t.sunsetting.estado === 'automatica', ganador: t.ganador.estado === 'automatica' },
  };
  return { inicial, pilotoPermitido: cupo.piloto, reel, canalInicial: red, publicosMeta: rt ? rt.publicosMeta.prendido : null, redes, redesPermitidas };
}
