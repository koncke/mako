// =============================================================================
// app/m/_ui — las primitivas de MaKo Mobile
// =============================================================================
//   import { PantallaM, SeccionM, FilaM, SheetM, useToastM } from '@/app/m/_ui';
//
// De app/_ui se reusan tal cual: Button (md o lg, NUNCA sm), ButtonLink, Badge,
// Status, Mako. No se usan en /m: Pagina (88 px de padding), Modal (diálogo de
// 600 px), Tooltip (no hay hover en un dedo), Eyebrow (kicker vetado), y
// EmptyState/ErrorState (sus botones son sm): para eso están VacioM y ErrorM.
//
// Ninguna pantalla de /m pone su propio <main>: el shell ya lo pone.
// =============================================================================

export { ShellM, type DestinoBarra } from './ShellM';
export { CabeceraM } from './CabeceraM';
export { PantallaM } from './PantallaM';
export { SeccionM } from './SeccionM';
export { FilaM, type FilaMProps, type AccionSwipe } from './FilaM';
export { TarjetaDecision, type EstadoDecision } from './TarjetaDecision';
export { SheetM, type SheetMProps } from './SheetM';
export { VacioM, SkeletonFilas } from './Estados';
export { ErrorM } from './ErrorM';
export { HoraM } from './HoraM';
export { SalirDeLaVista } from './SalirDeLaVista';
export { CerrarSesion } from './CerrarSesion';
export { useToastM, useConexion, useShellM, type OpcionesToast, type ConexionM, type CabeceraPisada } from './contexto';
export { horaCorta } from './formato';
export { cabeceraPorRuta, llevaBarra, profundidad, RUTA_CUENTA, RUTA_CONFIGURAR, TITULO_CUENTA, type PadreM } from './cabecera';
export {
  rubberband, proyectar, velocidadDe, ejeDelGesto, decidirSwipe, destinoDelSheet, distanciaDePull,
  RUBBER, VELOCIDAD_FLICK, HISTERESIS, UMBRAL_SWIPE, UMBRAL_PULL, RETENCION_PULL,
  type Muestra, type SnapSheet,
} from './gestos';
