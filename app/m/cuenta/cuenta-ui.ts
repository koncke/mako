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
// sin instalar, así que «Instalar la app» no bloquea los avisos.
//
// v2: todo eso es UNA fila con interruptor («Avisos en este teléfono», como en el prototipo) y,
// según el estado, una segunda línea corta, la fila «Instalar la app», «Qué te avisa» y «Probar
// aviso». Cómo se destraba un permiso negado va debajo de la lista.
//
// v3 (15/10/2026, «Tu cuenta» como Google): las secciones de la computadora son FILAS de la pantalla
// (lib/ajustes-secciones.ts). «Notificaciones» abre una hoja con lo de arriba y dice a la derecha cómo
// está ESTE teléfono (`rielNotificaciones`); «Instalar la app» es su propia fila y SIEMPRE lleva a algo
// (`filaInstalar`): en Android sin el aviso de Chrome, los pasos del menú del navegador.
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

/**
 * La segunda línea de la fila «Avisos en este teléfono» cuando el interruptor no se puede tocar:
 * dice POR QUÉ, corto. `null` = el interruptor dice todo (apagado, activo, revisando).
 */
export function segundaAvisos(vista: VistaAvisos): string | null {
  if (vista === 'instalar-ios') return 'Primero instala MaKo';
  if (vista === 'no-soportado') return 'Este navegador no los recibe';
  if (vista === 'bloqueado') return 'Bloqueados en el teléfono';
  return null;
}

/** El toast cuando activar no se pudo y no es un estado del teléfono (3-4 palabras). */
export function toastDeActivar(estado: string): string {
  if (estado === 'sin-claves') return 'Avisos no disponibles';
  if (estado === 'sin-cuenta') return 'Sesión sin cuenta propia';
  return 'No se pudo activar';
}

/** Lo que dice el riel de «Qué te avisa»: «Ninguno», «Todos» o «12 de 20» (de lo que esta persona ve). */
export function resumenAvisos(prefs: { activo: boolean; items: Record<string, boolean> }, tipos: readonly Pick<AvisoWaDef, 'id'>[]): string {
  if (!prefs.activo) return 'Ninguno';
  const prendidos = tipos.filter((t) => prefs.items[t.id] !== false).length;
  if (prendidos === 0) return 'Ninguno';
  if (prendidos === tipos.length) return 'Todos';
  return `${prendidos} de ${tipos.length}`;
}

/** El resultado de «Probar aviso», en 3-4 palabras para el toast. */
export function toastDePrueba(r: { ok: boolean; enviados: number; sinSuscripciones: number }): string {
  if (r.ok && r.enviados > 0) return 'Aviso enviado';
  if (r.sinSuscripciones > 0) return 'Ningún teléfono activo';
  return 'No se pudo enviar';
}

// ── «Tu cuenta» v3: las secciones como filas ─────────────────────────────────

/**
 * Lo que dice a la derecha la fila «Notificaciones»: cómo está ESTE teléfono, en una o dos palabras
 * (como «Desactivadas» en los Ajustes del iPhone). Prendido, qué llega (`resumenAvisos`: «Todos»,
 * «12 de 20», «Ninguno»); sin preferencias guardables, «Activados». Mientras se revisa el teléfono,
 * nada: una palabra que cambia de opinión al segundo es peor que el hueco.
 */
export function rielNotificaciones(vista: VistaAvisos, resumen: string | null): string | null {
  switch (vista) {
    case 'cargando': return null;
    case 'activo': return resumen ?? 'Activados';
    case 'bloqueado': return 'Bloqueados';
    case 'no-soportado': return 'No disponibles';
    // 'activar' (apagados) e 'instalar-ios' (adentro de la hoja dice «Primero instala MaKo»).
    default: return 'Apagados';
  }
}

export type FilaInstalar = 'revisando' | 'instalada' | 'pasos-ios' | 'boton' | 'pasos';

/**
 * Qué hace la fila «Instalar la app». Es una sección de «Tu cuenta» y está SIEMPRE (en la computadora
 * también), así que nunca es una fila muerta:
 *   · revisando → todavía no se leyó el teléfono (se dibuja quieta, sin flecha);
 *   · instalada → «Instalada» a la derecha, no abre nada;
 *   · pasos-ios → los pasos de Safari (iOS no tiene aviso de instalación);
 *   · boton → el aviso de Chrome que se guardó (`beforeinstallprompt`);
 *   · pasos → Android sin ese aviso (ya se descartó, u otro navegador): los pasos del menú.
 */
export function filaInstalar(p: { ios: boolean; instalada: boolean; puedePedir: boolean } | null): FilaInstalar {
  if (!p) return 'revisando';
  if (p.instalada) return 'instalada';
  return ofertaInstalar(p) ?? 'pasos';
}

export type PasoInstalar = { icono: string; frase: string };

// ⚠️ Los íconos son de app/_components/icons.tsx (uno inventado dibuja un punto; el test lo mira). El set
// no tiene el «Compartir» de iOS ni los tres puntos de Chrome: va el del navegador.
const PASOS_IOS: readonly PasoInstalar[] = [
  { icono: 'web', frase: 'Toca Compartir en la barra de Safari.' },
  { icono: 'grid', frase: 'Elige «Agregar a inicio».' },
  { icono: 'mako', frase: 'Abre MaKo desde el ícono nuevo.' },
];
// «Instalar» a secas: Chrome dice «Instalar app» o «Instalar aplicación» según la versión.
const PASOS_ANDROID: readonly PasoInstalar[] = [
  { icono: 'web', frase: 'Toca el menú del navegador.' },
  { icono: 'descargar', frase: 'Elige «Instalar» en ese menú.' },
  { icono: 'mako', frase: 'Abre MaKo desde el ícono nuevo.' },
];

/** Los pasos para dejar MaKo en la pantalla de inicio, los del sistema de ESTE teléfono. */
export function pasosInstalar(ios: boolean): readonly PasoInstalar[] {
  return ios ? PASOS_IOS : PASOS_ANDROID;
}
