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
import { getWorkspaceActual, rutaConWs } from '@/lib/workspace';
import { estadoContextoVideo, leerHistorial } from './video-datos';
import { estadoPuente } from '@/lib/flow-cola';
import { guionesDisponibles } from './guiones-datos';
import { puestasOfrecidas } from '@/lib/puestas-data';
import { leerAnuncios } from './anuncios-datos';
import { leerSaldoGuardado, costoPorClip } from './saldo-datos';
import { VideoGeneratorApp } from './VideoGeneratorApp';
import { onboardingRequeridoPara } from '@/lib/tab-onboarding-state';
import { puentearPasosCopyGen } from '@/lib/copygen-puente';
import { redirect } from 'next/navigation';
import { PuertaVideoGen } from './PuertaVideoGen';
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

  // La tab abre en su onboarding mientras no esté hecho, pero NO lo reemplaza
  // para siempre: el wizard tiene su salida («Lo configuro después»), y salir
  // devuelve la tab entera SIN recargar — un `router.refresh()` volvería a
  // correr este guard y devolvería el mismo wizard.
  // ⚠️ PRIMERO EL GUION, DESPUÉS EL VIDEO. `onboardingRequeridoPara` mira el
  // REQUISITO antes que el recorrido propio: si el Copy Generator todavía no está
  // configurado devuelve /ads-writer, y acá se redirige. Sin eso, alguien podía
  // llegar a esta tab sin un solo guion escrito — y lo que la tab hace es filmar
  // guiones, así que lo recibía con una lista vacía y ninguna explicación de dónde
  // salen. Ver lib/tab-onboarding-catalogo.ts → `requiere`.
  // `rutaConWs` y no el href pelado: un redirect sin `?ws=` pierde la pestaña del
  // cliente que se está mirando, y eso no falla — te deja en OTRA cuenta.
  // El puente ANTES de preguntar: si no, el cliente que ya hizo la fábrica de creativos
  // en el onboarding viejo rebota a /ads-writer, y recién ahí (en la page de allá) se le
  // puentea el estado. Funcionaría, pero le cuesta un rebote por algo que ya tenía hecho.
  await puentearPasosCopyGen();
  const requerido = await onboardingRequeridoPara('video-generator').catch(() => null);
  if (requerido && requerido !== '/video-generator') redirect(await rutaConWs(requerido));
  const faltaOnboarding = requerido === '/video-generator';

  /**
   * Una línea REAL de uno de sus guiones, para el subtítulo del aside.
   *
   * ⚠️ SUYA Y NO UN EJEMPLO. El aside del onboarding es el anuncio que vino a
   * hacer, y un subtítulo con texto inventado lo convierte en una maqueta — o
   * sea en decoración, que es justo lo que la regla del producto prohíbe: cada
   * píxel que se mueve transporta un hecho de SU negocio.
   *
   * Vacío cuando todavía no escribió ningún guion, y ahí el cuadro se queda sin
   * subtítulo en vez de mentir.
   */
  /**
   * Cuántos anuncios DISTINTOS puede filmar MaKo con lo que ya cargó.
   *
   * ⚠️ ES UN CONTEO, NO UNA PROYECCIÓN, y esa es toda la diferencia. Cada par
   * (guion × formato) es un anuncio distinto de verdad: el mismo texto filmado
   * como selfie en un auto y como plano secuencia en una oficina son dos piezas,
   * no dos versiones. El documento del onboarding lo llama «la fábrica» y fija su
   * regla: el copy dice «escribir/filmar», JAMÁS «ganadores».
   *
   * Y cuando da cero se dice otra cosa: una promesa que se desinfla es peor que
   * ninguna. Con cero guiones lo que falta no es entusiasmo, es un guion.
   */
  const anunciosPosibles = guiones.length * puestasOfrecidas().length;

  const primeraFrase = (guiones[0]?.hablado ?? guiones[0]?.texto ?? '')
    .split(/(?<=[.!?])\s+/)[0]?.trim().slice(0, 120) ?? '';

  const app = (
    <VideoGeneratorApp
      historialInicial={historial}
      contexto={contexto}
      puente={puente}
      guiones={guiones}
      anuncios={anuncios}
      saldo={saldo}
      costoClip={costoClip}
    />
  );

  return (
    <>
      <TemaOscuroScript />
      {faltaOnboarding ? (
        <PuertaVideoGen
          fotos={contexto.fotos}
          acentoInicial={contexto.acento.id}
          muletillasIniciales={contexto.acento.muletillas}
          puente={puente}
          linea={primeraFrase}
          creditos={saldo.creditos}
          anunciosPosibles={anunciosPosibles}
          acentoOrigen={contexto.acento.origen}
          acentoZona={contexto.acento.zona}
        >
          {app}
        </PuertaVideoGen>
      ) : app}
    </>
  );
}
