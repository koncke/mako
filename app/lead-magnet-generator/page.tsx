// =============================================================================
// /lead-magnet-generator — los lead magnets del negocio y las plantillas para armar uno (5/11/2026)
// =============================================================================
// Martín (29/10/2026): «me lo imagino como una o varias plantillas...». La tab es la pantalla de Create: sin nada abierto, «¿Qué
// vas a crear hoy?» con las plantillas; con `?lm=<id>`, ese lead magnet. Cada plantilla crea la pieza en su herramienta
// (lib/lead-magnets/). Por ahora sólo la plataforma (./puerta.ts). Lo que no se pudo leer se dice: no es «no tienes ninguno».
// =============================================================================

import { Pagina } from '@/app/_ui';
import { ESTILO_PAGINA_CREAR } from '@/app/_crear/reglas';
import { compartidosPorPieza, landingsDelNegocio, listarLeadMagnets } from '@/lib/lead-magnets/server';
import { propuestasGuardadas } from '@/lib/lead-magnets/proponer';
import { puertaLeadMagnets } from './puerta';
import { LeadMagnets } from './LeadMagnets';
import { vistaDeLeadMagnet, type LeadMagnetVista } from './reglas';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

export default async function LeadMagnetGeneratorPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await puertaLeadMagnets();
  const sp = await searchParams;
  const actual = typeof sp.lm === 'string' ? sp.lm : null;
  // Una lectura de la lista y una de las landings (para saber cuáles están publicadas y cuáles se borraron).
  const [r, landings, compartidos, propuestas] = await Promise.all([listarLeadMagnets(), landingsDelNegocio(), compartidosPorPieza(), propuestasGuardadas()]);
  // Sólo lo que la pantalla dibuja: ni el qué es ni la línea de anuncio (los escribe el onboarding y los lee la IA).
  const lista: LeadMagnetVista[] = r.ok ? r.lista.map((e) => vistaDeLeadMagnet(e, landings, compartidos)) : [];
  return (
    <Pagina ancho="completo" densidad="compacta" style={ESTILO_PAGINA_CREAR}>
      <LeadMagnets lista={lista} error={r.ok ? null : r.error} actual={actual} propuestas={propuestas} />
    </Pagina>
  );
}
