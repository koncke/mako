// =============================================================================
// /m/cuenta — qué se ofrece en «Avisos en este teléfono», puro y con test
// =============================================================================
// La fila de avisos tiene un estado por teléfono y por navegador, y cada uno pide
// UNA cosa distinta. El orden de las preguntas importa y es el de la plataforma:
//   · iPhone sin instalar → no hay push posible (iOS 16.4+ sólo lo da a la app
//     agregada a inicio): primero instalar, un paso por pantalla.
//   · sin soporte → se dice y se ofrece instalar si Chrome dejó el aviso.
//   · bloqueado → sólo se destraba en los ajustes del teléfono (no hay botón que lo
//     arregle: un botón que no puede hacer nada se lee como que la app está rota).
//   · apagado → «Activar avisos», que pide el permiso DENTRO del toque.
//   · activo → qué avisos llegan + «Probar aviso».
// La instalación en Android es OTRA fila, independiente: Chrome deja recibir push
// sin instalar, así que «Instalar MaKo» no bloquea los avisos.
// =============================================================================

import type { EstadoAvisos } from '@/lib/push-cliente';
import type { AvisoWaDef } from '@/lib/notif-catalogo';

export type VistaAvisos = 'cargando' | 'instalar-ios' | 'no-soportado' | 'bloqueado' | 'activar' | 'activo';

export function vistaAvisos(estado: EstadoAvisos | null): VistaAvisos {
  if (estado == null) return 'cargando';
  if (estado === 'instalar-primero') return 'instalar-ios';
  if (estado === 'no-soportado') return 'no-soportado';
  if (estado === 'bloqueado') return 'bloqueado';
  if (estado === 'activo') return 'activo';
  return 'activar';
}

/** ¿Se ofrece instalar? iPhone sin instalar → los pasos; Chrome con el aviso guardado → el botón. */
export function ofertaInstalar(o: { ios: boolean; instalada: boolean; puedePedir: boolean }): 'pasos-ios' | 'boton' | null {
  if (o.instalada) return null;
  if (o.ios) return 'pasos-ios';
  return o.puedePedir ? 'boton' : null;
}

/** Cómo se destraba un permiso negado, en una frase (depende del teléfono, no del navegador). */
export function comoDesbloquear(ios: boolean, instalada: boolean): string {
  if (ios) return 'Actívalos en Ajustes › Notificaciones › MaKo.';
  return instalada
    ? 'Actívalos en Ajustes › Apps › MaKo › Notificaciones.'
    : 'Actívalos en los permisos del sitio, en el candado de la barra de direcciones.';
}

/** Lo que se le ofrece prender y apagar a esta persona: lo de admins, sólo a admins. */
export function tiposParaRol<T extends Pick<AvisoWaDef, 'id'>>(tipos: readonly T[], soloAdmins: ReadonlySet<string>, esAdmin: boolean): T[] {
  return esAdmin ? [...tipos] : tipos.filter((t) => !soloAdmins.has(t.id));
}

/** El rol, como lo lee una persona (sin jerga). */
export function rolLegible(rol: 'admin' | 'closer' | 'setter' | null | undefined): string {
  if (rol === 'closer') return 'Closer';
  if (rol === 'setter') return 'Setter';
  return 'Administrador';
}

/** El resultado de «Probar aviso», en 3-4 palabras para el toast. */
export function toastDePrueba(r: { ok: boolean; enviados: number; sinSuscripciones: number }): string {
  if (r.ok && r.enviados > 0) return 'Aviso enviado';
  if (r.sinSuscripciones > 0) return 'Ningún teléfono activo';
  return 'No se pudo enviar';
}
