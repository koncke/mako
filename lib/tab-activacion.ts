// =============================================================================
// tab-activacion — qué necesita cada tab para prenderse, y qué promete mientras
// =============================================================================
// El problema que resuelve: hoy una tab sin su integración NO dice que le falta
// una integración. Comercial renderiza seis secciones en $0 y un gráfico plano
// (se lee como roto, no como "todavía no"), y WhatsApp dice "Sin conversaciones"
// cuando en realidad Chatwoot nunca se conectó — un error de config disfrazado
// de dato vacío, que es la peor lectura posible: le echa la culpa al dato.
//
// En vez de eso, la tab muestra la MISMA pantalla partida del onboarding: a la
// izquierda el aside negro con lo que va a poder hacer (y, apenas conecta, los
// datos reales de SU cuenta); a la derecha, el form pidiendo la credencial.
// El cliente aprende UNA pantalla y la reconoce en los cuatro lugares.
//
// Datos puros (sin 'server-only'): lo consumen las pages (server) y el panel
// (client).
// =============================================================================

import type { Slide } from './servicio-slides';

export type TabActivacion = {
  /** Key del nav (lib/capas.ts, app/_components/nav.ts). */
  key: string;
  /** Cómo se llama la tab para el cliente. */
  titulo: string;
  /**
   * Servicio del catálogo (lib/metodo-catalogo.ts) que hay que conectar para
   * prenderla. La página pregunta por él con integracionConectada().
   */
  servicio: string;
  /** Línea mono del aside. */
  eyebrow: string;
  /** Qué le falta, en criollo — el subtítulo de la derecha. */
  queFalta: string;
  /** El carrusel: qué va a poder hacer cuando la conecte. */
  slides: Slide[];
  /**
   * Aviso honesto cuando conectar NO alcanza para que la tab tenga contenido
   * (ej. Closing necesita además que existan llamadas grabadas). Se muestra
   * abajo del form. null = con conectar alcanza.
   */
  ademas?: string;
};

// OJO — la regla de las slides es la misma que la de lib/servicio-slides.ts y no
// se negocia: cada una describe algo que la app HACE HOY. Nada gateado por un
// flag apagado, nada owner-only, nada de ComingSoon. Una promesa falsa acá se
// paga con la confianza del cliente el día 1, que es el peor día para perderla.
export const TABS_ACTIVACION: Record<string, TabActivacion> = {};

export const tabActivacion = (key: string): TabActivacion | null => TABS_ACTIVACION[key] ?? null;
