// =============================================================================
// Los dos lugares de ajustes: «Tu cuenta» y «Configuración del negocio» (15/10/2026)
// =============================================================================
// Pedido de Martín (15/10, vía «Estrategia 3 cuentas»): rediseñar Perfil, Integraciones y Configuraciones
// «como lo hace google u otras apps», y decidir si unificarlas. Aprobó «Como Google: dos lugares»:
//   · «Tu cuenta» — lo de la PERSONA, para todos los roles: sus datos, cómo entra, sus avisos.
//   · «Configuración del negocio» — lo del NEGOCIO, sólo para quien lo administra.
// Google (myaccount.google.com), Notion y Linear hacen el mismo corte (relevado el 15/10/2026).
//
// Cada sección es una RUTA, como en Google (/security, /personal-info): un link copiado abre la misma
// sección, y las rutas que ya existían (/perfil/seguridad, /integraciones, /equipo, /metodo) siguen
// siendo las mismas, sin redirecciones. La lista vive ACÁ y no en cada pantalla: el índice de la
// computadora y las filas del celular salen de esto, en el mismo orden y con los mismos rótulos.
// =============================================================================

import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';

export type SeccionAjustes = {
  key: string;
  label: string;
  href: string;
  icono: NombreIconoMenu;
  /** La línea debajo del título de la sección: qué se decide acá. */
  descripcion: string;
};

export const TITULO_CUENTA = 'Tu cuenta';
export const TITULO_NEGOCIO = 'Configuración del negocio';

export const SECCIONES_CUENTA: SeccionAjustes[] = [
  { key: 'info', label: 'Información personal', href: '/perfil', icono: 'persona', descripcion: 'Tu nombre, tu foto y cómo te contactan.' },
  { key: 'seguridad', label: 'Seguridad', href: '/perfil/seguridad', icono: 'escudo', descripcion: 'Cómo entras a MaKo y desde dónde.' },
  { key: 'notificaciones', label: 'Notificaciones', href: '/perfil/notificaciones', icono: 'avisar', descripcion: 'Los avisos que te llegan a ti.' },
  { key: 'instalar', label: 'Instalar la app', href: '/perfil/instalar', icono: 'celular', descripcion: 'MaKo en tu celular.' },
];

/**
 * En una «vista de otro» (la agencia o el super admin parados en un cliente) el perfil que se ve es el
 * del CLIENTE, pero la seguridad, los avisos y la app son de quien MIRA: no se ofrecen ahí.
 */
export function seccionesCuenta(deOtro: boolean, activa?: string): SeccionAjustes[] {
  // La activa se queda siempre: entrar por el link a /perfil/seguridad mirando a un cliente es tu propia
  // seguridad, y un índice sin la sección en la que estás no dice dónde estás.
  return deOtro ? SECCIONES_CUENTA.filter((s) => s.key === 'info' || s.key === activa) : SECCIONES_CUENTA;
}

/** Qué secciones del negocio puede ver quien mira. Lo resuelve el server (lib/ajustes-negocio.ts). */
export type DisponiblesNegocio = {
  /** Horario y Criterio de reuniones: hoy, sólo el super admin (la misma regla que tenía la pantalla). */
  general: boolean;
  /** Lo compró el negocio (la capa). */
  integraciones: boolean;
  /** Las credenciales de la plataforma: sólo la agencia (`getSesionAdmin`). */
  metodo: boolean;
  /** «Tu plan»: el plan de MaKo de un NEGOCIO. La plataforma misma no tiene uno (en producción decía «SuperAdmin —
   *  Acordado con MaKo — para darte de baja, escríbenos», 15/10/2026). */
  plan: boolean;
};

const SECCIONES_NEGOCIO: (SeccionAjustes & { si?: keyof DisponiblesNegocio })[] = [
  { key: 'general', label: 'General', href: '/configuraciones', icono: 'configurar', descripcion: 'A qué hora escribe MaKo y qué entra al tablero.', si: 'general' },
  { key: 'equipo', label: 'Equipo', href: '/equipo', icono: 'equipo', descripcion: 'Quién trabaja en tu negocio y qué ve cada uno.' },
  { key: 'integraciones', label: 'Integraciones', href: '/integraciones', icono: 'link', descripcion: 'WhatsApp, Meta, tu web y todo lo que se conecta.', si: 'integraciones' },
  { key: 'notificaciones', label: 'Notificaciones', href: '/configuraciones/notificaciones', icono: 'avisar', descripcion: 'A quién le avisa MaKo del negocio.' },
  { key: 'fiscal', label: 'Identidades fiscales', href: '/configuraciones/fiscal', icono: 'dinero', descripcion: 'Los datos con los que facturas.' },
  // El botón «Darme de baja», como todo SaaS (15/10/2026): /reembolsos y /terminos remiten acá.
  { key: 'plan', label: 'Tu plan', href: '/configuraciones/plan', icono: 'repetir', descripcion: 'Tu plan de MaKo y cómo darte de baja.', si: 'plan' },
  { key: 'metodo', label: 'Método', href: '/metodo', icono: 'llave', descripcion: 'Las credenciales de la plataforma.', si: 'metodo' },
];

export function seccionesNegocio(d: DisponiblesNegocio): SeccionAjustes[] {
  return SECCIONES_NEGOCIO.filter((s) => !s.si || d[s.si]).map(({ si: _si, ...s }) => s);
}

/**
 * La ruta con el resto de la query del pedido (el `?ws=` del cliente que se mira, sobre todo), menos lo
 * que se nombra. Un redirect que pierde el `?ws=` te devuelve a TU cuenta en el medio de mirar otra.
 */
export function conLaQuery(ruta: string, sp: Record<string, string | string[] | undefined>, quitar: string[] = []): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (quitar.includes(k) || v == null) continue;
    for (const x of Array.isArray(v) ? v : [v]) q.append(k, x);
  }
  const s = q.toString();
  return s ? `${ruta}?${s}` : ruta;
}

/**
 * El `?tab=` de la pantalla vieja de Configuraciones, que vive en los links ya mandados: los 49 avisos
 * apuntan a `/configuraciones?tab=notif` («apagar este reporte»), guardados en la base y en mensajes
 * que ya salieron. La pantalla vieja ni leía el parámetro (arrancaba fija en Notificaciones, y por eso
 * funcionaban «por coincidencia», docs/hallazgos-ui.md). Ahora cada valor va a su sección.
 */
export function rutaDeTabVieja(tab: string | null | undefined): string | null {
  switch (tab) {
    case 'notif': return '/configuraciones/notificaciones';
    case 'fiscal': return '/configuraciones/fiscal';
    case 'equipo': return '/equipo';
    case 'criterio':
    case 'horario': return '/configuraciones';
    default: return null;
  }
}
