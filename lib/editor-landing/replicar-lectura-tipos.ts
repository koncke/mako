// =============================================================================
// editor-landing/replicar-lectura-tipos — la forma de la LECTURA de una landing antes de replicarla (28/10/2026)
// =============================================================================
// Lo arma replicar-lectura.ts (server) y lo muestra el panel «Replicar landing» (app/web-generator/crear/Replicar.tsx):
// por eso vive en un módulo sin `server-only`. Los ángulos que trae vuelven en el pedido de la réplica (ya pagados).
// =============================================================================

import type { MoldeSeccion } from './replicar-estructura';
import type { Angulos } from './replicar-angulos';
import type { SeLeeEnNavegador } from './lectura-tipos';

/** Los colores y las fuentes de la original, para mostrarlos (el tema propio lo arma la réplica). */
export type DisenoLeido = { colores: string[]; fuentes: string[]; imagenes: number };

/** Lo que ve la persona antes de replicar. */
export type LecturaReplica = {
  url: string;
  titulo: string;
  secciones: MoldeSeccion[];
  angulos: Angulos | null;
  /** Por qué no hay ángulos (la IA no contestó), para decirlo en la pantalla. */
  errorAngulos?: string;
  diseno: DisenoLeido | null;
  /**
   * ¿El negocio tiene su oferta cargada (el perfil)? Sin ella, la copia escrita de nuevo no tiene de qué hablar y vuelve
   * sobre la de la competencia (medido el 28/10/2026 en el ws9): la pantalla pide «Tu oferta».
   */
  tieneOferta?: boolean;
  /** El nombre de la oferta principal (`ofertas`), la que usa la réplica si la persona no escribe otra (12/11/2026). */
  ofertaPrincipal?: string;
};

/** Lo que contesta POST /api/landing-generator/replicar/leer. */
export type RespuestaLectura = { ok: true; lectura: LecturaReplica } | ({ ok: false; error: string } & Partial<SeLeeEnNavegador>);
