'use client';

// =============================================================================
// ficha/registro-resumen — los COMPONENTES de los bloques de la tab Resumen
// =============================================================================
// Las reglas (vacío, lo que incluye, los diseños) están en ./reglas-resumen.ts, que es puro y lo ejecutan los tests.
//
// 16/10/2026 — EL RESUMEN NATIVO (Martín: «completamente diferente en diseño y funcionalidad»). Hasta acá eran las
// tarjetas de antes envueltas (InfoPrincipalCard, CalificacionCard, RespuestasFormulario, OrigenCard, MotivoYPlazoCard).
// Ahora cada bloque es una pieza propia (./resumen/), con el molde de Attio y HubSpot y la vista épica de General:
//   · ./resumen/contacto.tsx — el contacto, las redes y la web, la dirección y el sexo;
//   · ./resumen/calificacion.tsx — «¿Era calificado?» (lo que aprende Meta);
//   · ./resumen/datos.tsx — el ingreso estimado, el setter y el closer, el tiempo en la etapa, el motivo y el plazo;
//   · ./resumen/reunion.tsx — la próxima reunión y la siguiente acción;
//   · ./resumen/respuestas.tsx — lo que contestó y la respuesta destacada;
//   · ./resumen/origen.tsx — de dónde vino, la página donde se registró y la publicación por la que entró;
//   · ./resumen/duplicados.tsx — las fichas parecidas y las notas (las de Customer Success);
//   · ./resumen/charla.tsx — la charla (WhatsApp y DM), el pase a humano, los cambios de MaKo, el mensaje listo, las
//     automatizaciones en curso y lo que le mandamos (17/10/2026: estaban en las plantillas y se salteaban).
// Customer Success sigue con sus tarjetas (InfoPrincipalCard y NotasCard): su ficha todavía no está en bloques.
// =============================================================================

import { REGLAS_RESUMEN } from './reglas-resumen';
import type { EntradaRegistro } from './tipos';
import { Contacto, Direccion, RedesYWeb, Sexo } from './resumen/contacto';
import { Calificacion } from './resumen/calificacion';
import { IngresoEstimado, MotivoDeSalida, PlazoNutricion, SetterYCloser, TiempoEnEtapa } from './resumen/datos';
import { ProximaReunion, SiguienteAccion } from './resumen/reunion';
import { LoQueContesto, RespuestaDestacada } from './resumen/respuestas';
import { Origen, PaginaDeRegistro, PublicacionDeEntrada } from './resumen/origen';
import { Notas, PosiblesDuplicados } from './resumen/duplicados';
import {
  AutomatizacionesEnCurso, CambiosDeMako, CharlaDm, CharlaWhatsApp, LoQueLeMandamosBloque, MensajeListoBloque, PaseAHumanoBloque,
} from './resumen/charla';

export const REGISTRO_RESUMEN: { [K in keyof typeof REGLAS_RESUMEN]: EntradaRegistro } = {
  'siguiente-accion': { Componente: SiguienteAccion, ...REGLAS_RESUMEN['siguiente-accion'] },
  'posibles-duplicados': { Componente: PosiblesDuplicados, ...REGLAS_RESUMEN['posibles-duplicados'] },
  contacto: { Componente: Contacto, ...REGLAS_RESUMEN.contacto },
  'redes-y-web': { Componente: RedesYWeb, ...REGLAS_RESUMEN['redes-y-web'] },
  direccion: { Componente: Direccion, ...REGLAS_RESUMEN.direccion },
  sexo: { Componente: Sexo, ...REGLAS_RESUMEN.sexo },
  'setter-y-closer': { Componente: SetterYCloser, ...REGLAS_RESUMEN['setter-y-closer'] },
  'proxima-reunion': { Componente: ProximaReunion, ...REGLAS_RESUMEN['proxima-reunion'] },
  calificacion: { Componente: Calificacion, ...REGLAS_RESUMEN.calificacion },
  'ingreso-estimado': { Componente: IngresoEstimado, ...REGLAS_RESUMEN['ingreso-estimado'] },
  'tiempo-en-etapa': { Componente: TiempoEnEtapa, ...REGLAS_RESUMEN['tiempo-en-etapa'] },
  'motivo-de-salida': { Componente: MotivoDeSalida, ...REGLAS_RESUMEN['motivo-de-salida'] },
  'plazo-nutricion': { Componente: PlazoNutricion, ...REGLAS_RESUMEN['plazo-nutricion'] },
  'lo-que-contesto': { Componente: LoQueContesto, ...REGLAS_RESUMEN['lo-que-contesto'] },
  'respuesta-destacada': { Componente: RespuestaDestacada, ...REGLAS_RESUMEN['respuesta-destacada'] },
  origen: { Componente: Origen, ...REGLAS_RESUMEN.origen },
  'pagina-de-registro': { Componente: PaginaDeRegistro, ...REGLAS_RESUMEN['pagina-de-registro'] },
  'publicacion-de-entrada': { Componente: PublicacionDeEntrada, ...REGLAS_RESUMEN['publicacion-de-entrada'] },
  notas: { Componente: Notas, ...REGLAS_RESUMEN.notas },
  'charla-whatsapp': { Componente: CharlaWhatsApp, ...REGLAS_RESUMEN['charla-whatsapp'] },
  'charla-dm': { Componente: CharlaDm, ...REGLAS_RESUMEN['charla-dm'] },
  'pase-a-humano': { Componente: PaseAHumanoBloque, ...REGLAS_RESUMEN['pase-a-humano'] },
  'cambios-de-mako': { Componente: CambiosDeMako, ...REGLAS_RESUMEN['cambios-de-mako'] },
  'mensaje-listo': { Componente: MensajeListoBloque, ...REGLAS_RESUMEN['mensaje-listo'] },
  'automatizaciones-en-curso': { Componente: AutomatizacionesEnCurso, ...REGLAS_RESUMEN['automatizaciones-en-curso'] },
  'lo-que-le-mandamos': { Componente: LoQueLeMandamosBloque, ...REGLAS_RESUMEN['lo-que-le-mandamos'] },
};
