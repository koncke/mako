// =============================================================================
// /video-generator — server wrapper: guard + contexto + monta la app
// =============================================================================
// Mismo patrón que /reels: la page aplica el guard (requireRolWs con la key
// exacta del nav) y junta el estado que la vista necesita. El trabajo pesado
// vive en VideoGeneratorApp.tsx ('use client').
//
// El estado del contexto se lee VIVO en cada carga (no se recuerda): si el
// cliente borra sus fotos, el aviso de «sin foto no hay identidad» vuelve solo.

import { requireRolWs } from '@/lib/tab-access';
import { getWorkspaceActual } from '@/lib/workspace';
import { estadoContextoVideo, leerHistorial } from './video-datos';
import { estadoPuente } from '@/lib/flow-cola';
import { guionesDisponibles } from './guiones-datos';
import { leerAnuncios } from './anuncios-datos';
import { leerSaldoGuardado, costoPorClip } from './saldo-datos';
import { VideoGeneratorApp } from './VideoGeneratorApp';
// El interruptor del tema, en el HTML del servidor: corre antes del primer
// pintado y evita el fogonazo blanco. Ver TemaOscuroScript.
import { TemaOscuroScript } from '@/app/_components/TemaOscuroScript';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function Page() {
  await requireRolWs([], { nav: 'video-generator' });

  const ws = await getWorkspaceActual();
  // Agencia sin impersonar: no hay workspace del que leer. La vista igual se
  // sirve (las actions cortan con su propio error si intenta operar).
  if (ws == null) return <><TemaOscuroScript /><VideoGeneratorApp historialInicial={[]} contexto={null} puente={null} guiones={[]} anuncios={[]} saldo={{ creditos: null, at: null, tier: '' }} costoClip={{ creditos: 15, medido: false }} /></>;

  const [historial, contexto, puente, guiones, anuncios, saldo, costoClip] = await Promise.all([
    leerHistorial(),
    estadoContextoVideo(),
    // Estado VIVO: si el cliente desconecta el navegador, el panel lo dice sola
    // la próxima vez que entra.
    estadoPuente().catch(() => null),
    // Los guiones que MaKo ya escribió. Con `catch` porque su ausencia no puede
    // tumbar la pantalla: sin guiones la tab se abre igual y el wizard dice
    // dónde escribirlos.
    guionesDisponibles().catch(() => []),
    // Los anuncios ya terminados. Mismo criterio que los guiones: su ausencia no
    // puede tumbar la pantalla, porque la tab sirve igual sin ellos.
    leerAnuncios().catch(() => []),
    // El saldo GUARDADO, no una consulta: preguntarle al navegador del cliente en
    // cada carga de la página es tráfico contra Google por algo que casi nunca
    // cambió. La pantalla lo refresca sola cuando hace falta.
    leerSaldoGuardado().catch(() => ({ creditos: null, at: null, tier: '' })),
    costoPorClip().catch(() => ({ creditos: 15, medido: false })),
  ]);

  return (
    <>
    <TemaOscuroScript />
    <VideoGeneratorApp
      historialInicial={historial}
      contexto={contexto}
      puente={puente}
      guiones={guiones}
      anuncios={anuncios}
      saldo={saldo}
      costoClip={costoClip}
    />
    </>
  );
}
