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
// sección, y las rutas que ya existían (/perfil/seguridad, /integraciones, /equipo) siguen
// siendo las mismas, sin redirecciones. (/configuraciones y /metodo redirigen desde el 26/10/2026: sus secciones se fueron.) La lista vive ACÁ y no en cada pantalla: el índice de la
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

// En inglés desde el 17/10/2026 noche (prototipo de coherencia: el menú de la foto y sus páginas con los nombres de las tabs).
// UN SOLO LUGAR desde el 24/10/2026 (Martín: «juntes todo en "Settings", que ya no sea "Business Setting", sólo "Settings", que
// esté primero en las opciones y que contenga todo junto»): «Settings», con un índice de DOS GRUPOS, «Tu cuenta» y «Tu negocio»,
// como los ajustes de Linear, Notion y Slack (cuenta y espacio de trabajo en la misma barra). Las rutas no cambian.
export const TITULO_AJUSTES = 'Settings';
export const TITULO_CUENTA = TITULO_AJUSTES;
export const TITULO_NEGOCIO = TITULO_AJUSTES;
export const GRUPO_CUENTA = 'Tu cuenta';
export const GRUPO_NEGOCIO = 'Tu negocio';

export const SECCIONES_CUENTA: SeccionAjustes[] = [
  // «Perfil» primero (24/10/2026, Martín: «"Perfil" primero en lugar de "Información personal"»).
  { key: 'info', label: 'Perfil', href: '/perfil', icono: 'persona', descripcion: 'Tu nombre, tu foto y cómo te contactan.' },
  { key: 'seguridad', label: 'Seguridad', href: '/perfil/seguridad', icono: 'escudo', descripcion: 'Cómo entras a MaKo y desde dónde.' },
  { key: 'notificaciones', label: 'Notificaciones', href: '/perfil/notificaciones', icono: 'avisar', descripcion: 'Los avisos que te llegan a ti.' },
  // Las TRES instalaciones (24/10/2026, Martín: «"Instalar la App" tiene que tener las 3 instalaciones: la app Mobile, Desktop y la
  // extensión»).
  { key: 'instalar', label: 'Instalar la app', href: '/perfil/instalar', icono: 'celular', descripcion: 'MaKo en tu teléfono, en tu computadora y en tu navegador.' },
  // «Tus cuentas de IA» SALIÓ DEL ÍNDICE el 24/10/2026 (Martín: «Elimina la tab de "Tus cuentas de IA", para eso ya tenemos
  // "Integraciones"»), pero /perfil/ia SIGUE: el instalador de Windows vuelve ahí al terminar (RUTA_TRAS_INSTALAR, en las PC
  // de los clientes) y el teléfono la abre. El admin la tiene en Integraciones (la tarjeta destacada); un closer o un setter
  // conecta su Claude desde la caja de cualquier chat con MaKo («Conectar tu IA», el mismo modal).
];

/** El índice de Settings: los dos grupos, y el del negocio sólo si quien mira lo administra (y ve alguna sección). */
export type GrupoSecciones = { titulo: string; secciones: SeccionAjustes[] };
export function gruposAjustes(cuenta: SeccionAjustes[], negocio: SeccionAjustes[] | null): GrupoSecciones[] {
  return [{ titulo: GRUPO_CUENTA, secciones: cuenta }, ...(negocio?.length ? [{ titulo: GRUPO_NEGOCIO, secciones: negocio }] : [])];
}

/**
 * En una «vista de otro» (la agencia o el super admin parados en un cliente) el perfil que se ve es el
 * del CLIENTE, pero la seguridad, los avisos y la app son de quien MIRA: no se ofrecen ahí.
 *
 * ⚠️ `administra`: NOTIFICACIONES SÍ (3/11/2026, ticket #49 de Joan: «no puedo ver las notificaciones dentro de la cuenta de un
 * cliente»). Desde el 25/10/2026 a quién le avisa MaKo lo del NEGOCIO vive adentro de esta sección, y el filtro de abajo, que se
 * escribió cuando esta sección era sólo de la persona, la dejó sin entrada para la agencia y para el super admin parados en un
 * cliente. La pantalla y su API andaban: faltaba el renglón. Mirando a otro, la pantalla muestra sólo WhatsApp y Email.
 */
export function seccionesCuenta(deOtro: boolean, activa?: string, administra = false): SeccionAjustes[] {
  // La activa se queda siempre: entrar por el link a /perfil/seguridad mirando a un cliente es tu propia
  // seguridad, y un índice sin la sección en la que estás no dice dónde estás.
  return deOtro ? SECCIONES_CUENTA.filter((s) => s.key === 'info' || s.key === activa || (administra && s.key === 'notificaciones')) : SECCIONES_CUENTA;
}

/** Qué secciones del negocio puede ver quien mira. Lo resuelve el server (lib/ajustes-negocio.ts). */
export type DisponiblesNegocio = {
  /** Lo compró el negocio (la capa). */
  integraciones: boolean;
  /** «Tu plan»: el plan de MaKo de un NEGOCIO. La plataforma misma no tiene uno (en producción decía «SuperAdmin —
   *  Acordado con MaKo — para darte de baja, escríbenos», 15/10/2026). */
  plan: boolean;
};

const SECCIONES_NEGOCIO: (SeccionAjustes & { si?: keyof DisponiblesNegocio })[] = [
  // «General» SALIÓ el 26/10/2026 (Martín: «Elimina la tab "General" de configuraciones... El huso horario ya se configura en cada
  // Automatización. La zona horaria, para el resto, ponlo dentro de "Perfil". y "Criterio de reuniones" eliminalo»). La zona del
  // negocio es una fila de Perfil; el horario de oficina, la tuerca de cada automatización; el criterio quedó con su valor.
  // /configuraciones redirige a la primera sección.
  { key: 'equipo', label: 'Equipo', href: '/equipo', icono: 'equipo', descripcion: 'Quién trabaja en tu negocio y qué ve cada uno.' },
  // El enchufe desde el 26/10/2026 (Martín: «Fijate el icono de integraciones... Parece un link»): se lee «conexiones».
  { key: 'integraciones', label: 'Integraciones', href: '/integraciones', icono: 'enchufe', descripcion: 'WhatsApp, Meta, tu web y todo lo que se conecta.', si: 'integraciones' },
  // «Notificaciones» del negocio SALIÓ del índice el 25/10/2026 (Martín la vio DOS veces, «Perfil, Notificaciones, Instalar App,
  // Equipo, Notificaciones...»): a quién le avisa MaKo lo del negocio vive en la de «Tu cuenta», abajo, para quien administra.
  // /configuraciones/notificaciones redirige ahí (los avisos viejos con `?tab=notif` caen en esa ruta).
  { key: 'fiscal', label: 'Identidades fiscales', href: '/configuraciones/fiscal', icono: 'dinero', descripcion: 'Los datos con los que facturas, y en qué moneda.' },
  // El botón «Darme de baja», como todo SaaS (15/10/2026): /reembolsos y /terminos remiten acá.
  { key: 'plan', label: 'Tu plan', href: '/configuraciones/plan', icono: 'repetir', descripcion: 'Tu plan de MaKo y cómo darte de baja.', si: 'plan' },
  // «Método» SALIÓ el 26/10/2026 (Martín: «Elimina "Método" no entiendo eso... Si para eso ya tenemos "Integraciones"»): cada una
  // de sus credenciales tiene su tarjeta en Integraciones (las IA, en «Tus cuentas de IA»). /metodo redirige ahí.
  // «Prompts» SALIÓ del índice el 26/10/2026 (Martín: «sobra la de prompts en super admin, y no se si lo tienen los usuarios,
  // pero no deberían»; los usuarios nunca la vieron: era `si: 'metodo'`, sólo la agencia). Su pantalla sigue en
  // /configuraciones/prompts, con su puerta (sólo la agencia): se abre por su link, no desde Settings.
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
    // «General» se fue el 26/10/2026: el horario es de cada automatización y la zona del negocio está en Perfil.
    case 'criterio':
    case 'horario': return '/perfil';
    default: return null;
  }
}
