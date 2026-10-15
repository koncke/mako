// =============================================================================
// Seguridad — lo que se DIBUJA, puro (15/10/2026)
// =============================================================================
// Pedido de Martín, textual, mirando /perfil/seguridad: «Esto se ve horrible y no debería estar en perfil
// debería estar en configuraciones... Rediseñalo completamente, tanto para desktop como mobile, copia tal
// cual la sección de seguridad de google, en diseño y todo.» (Después aprobó dejarla en «Tu cuenta»: lo
// que le molestó era la pantalla, y Google, Notion y Linear ponen la seguridad del lado de la persona.)
//
// El molde, relevado en myaccount.google.com/security el 15/10/2026 (sólo el diseño):
//   · arriba, UNA tarjeta de estado con el escudo («Tu cuenta está protegida» o qué falta);
//   · secciones con título y una línea, y adentro una LISTA AGRUPADA: cada fila es un ícono a la
//     izquierda, el nombre y su estado debajo, y la fila ENTERA abre su detalle;
//   · NINGUNA acción destructiva en la vista general: quitar, olvidar o generar nuevos viven adentro
//     del detalle de cada fila;
//   · los dispositivos se distinguen por lo que los hace distintos, no por el nombre del navegador.
//
// Computadora y celular dibujan LAS MISMAS filas, en el mismo orden y con los mismos rótulos: salen de
// acá. El teléfono destila (menos texto), no rediseña.
// =============================================================================

import type { NombreIconoMenu } from '@/app/_ui/iconos-menu';

export type EstadoSeguridad = {
  obligatorio: boolean;
  obligatorioDesde: string | null;
  esTelefono: boolean;
  cuenta: string;
  passkeysDisponibles: boolean;
  canales: ('whatsapp' | 'email')[];
  totp: boolean;
  whatsapp: string | null;
  email: string | null;
  passkeys: { id: number; nombre: string | null; created_at: string; usado_at: string | null }[];
  codigosRestantes: number;
  contrasena: boolean | null;
  dispositivos: { id: number; nombre: string | null; created_at: string; usado_at: string | null; expira_at: string }[];
};

export type ClaveDetalle = 'app' | 'llaves' | 'contrasena' | 'codigos' | 'whatsapp' | 'email';
export const CLAVES_DETALLE: readonly ClaveDetalle[] = ['app', 'llaves', 'contrasena', 'codigos', 'whatsapp', 'email'];
/** «Administrar todos los dispositivos»: donde vive «Olvidar todos», fuera de la vista general. */
export const VER_DISPOSITIVOS = 'dispositivos';

export type FilaSeguridad = {
  clave: ClaveDetalle;
  icono: NombreIconoMenu;
  titulo: string;
  detalle: string;
  /** El estado, como pastilla (verde = activo, ámbar = falta). Sin pastilla, sólo el detalle. */
  estado?: { texto: string; tono: 'good' | 'warn' };
};

export const fechaCorta = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '';

/** Los métodos de verdad (los códigos de recuperación no cuentan: son la salida). */
export function cantidadMetodos(e: EstadoSeguridad): number {
  return (e.totp ? 1 : 0) + e.passkeys.length + (e.whatsapp ? 1 : 0) + (e.email ? 1 : 0);
}

/** La tarjeta de arriba: lo que falta, en una línea, y a qué detalle lleva. */
export function estadoGeneral(e: EstadoSeguridad): { protegida: boolean; titulo: string; detalle: string; ir?: ClaveDetalle } {
  const faltan: string[] = [];
  if (cantidadMetodos(e) === 0) faltan.push('la verificación en 2 pasos');
  if (e.contrasena === false) faltan.push('tu contraseña');
  if (!faltan.length) return { protegida: true, titulo: 'Tu cuenta está protegida', detalle: 'Tienes la verificación en 2 pasos y tu contraseña.' };
  const plazo = e.obligatorioDesde && Date.parse(e.obligatorioDesde) > Date.now()
    ? ` antes del ${new Date(e.obligatorioDesde).toLocaleString('es', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' })}`
    : '';
  return {
    protegida: false,
    titulo: `Te falta ${faltan.join(' y ')}`,
    detalle: e.obligatorio ? `Es obligatorio${plazo}.` : 'Protege tu cuenta si te roban el correo.',
    // Primero el segundo paso: la contraseña se crea con un código de la app (contrasena-guardar).
    ir: cantidadMetodos(e) === 0 ? 'app' : 'contrasena',
  };
}

/** «Cómo entras a MaKo»: una fila por forma de entrar, en este orden. */
export function filasDeAcceso(e: EstadoSeguridad): FilaSeguridad[] {
  const filas: FilaSeguridad[] = [
    {
      clave: 'app', icono: 'escudo', titulo: 'Verificación en 2 pasos',
      detalle: e.totp ? 'Con la app de autenticación' : 'Un código de tu celular, además de Google',
      estado: e.totp ? { texto: 'Activada', tono: 'good' } : { texto: 'Desactivada', tono: 'warn' },
    },
    {
      clave: 'llaves', icono: 'llave', titulo: 'Llaves de acceso',
      detalle: e.passkeys.length ? `${e.passkeys.length} llave${e.passkeys.length > 1 ? 's' : ''} · huella o Face ID` : 'Se crean desde tu celular',
    },
    {
      clave: 'contrasena', icono: 'candado', titulo: 'Contraseña',
      detalle: e.contrasena ? 'Para entrar con tu correo, sin Google' : e.contrasena === false ? 'Para entrar con tu correo, sin Google' : 'No se pudo leer',
      estado: e.contrasena === false ? { texto: 'Falta crearla', tono: 'warn' } : e.contrasena ? { texto: 'Creada', tono: 'good' } : undefined,
    },
  ];
  // Un canal que hoy no manda códigos no se ofrece; si ya estuviera activo, se sigue mostrando.
  if (e.whatsapp || e.canales.includes('whatsapp')) filas.push({ clave: 'whatsapp', icono: 'whatsapp', titulo: 'Código por WhatsApp', detalle: e.whatsapp ?? 'Sin activar' });
  if (e.email || e.canales.includes('email')) filas.push({ clave: 'email', icono: 'email', titulo: 'Correo de respaldo', detalle: e.email ?? 'Sin activar' });
  filas.push({
    clave: 'codigos', icono: 'numero', titulo: 'Códigos de recuperación',
    detalle: cantidadMetodos(e) ? `Te quedan ${e.codigosRestantes} de 10 códigos de un solo uso` : 'Se crean al activar la verificación en 2 pasos',
  });
  return filas;
}

export type FilaDispositivo = { id: number; titulo: string; detalle: string; icono: NombreIconoMenu };

/**
 * «Tus dispositivos»: los recordados (no piden el código por 30 días). Tres «Chrome en Android» iguales
 * no se distinguen por el nombre: se distinguen por CUÁNDO se agregaron y cuándo se usaron, y si dos
 * comparten nombre, el título lo numera.
 */
export function filasDeDispositivos(e: EstadoSeguridad): FilaDispositivo[] {
  const porNombre = new Map<string, number>();
  for (const d of e.dispositivos) porNombre.set(d.nombre || 'Dispositivo', (porNombre.get(d.nombre || 'Dispositivo') ?? 0) + 1);
  const vistos = new Map<string, number>();
  return e.dispositivos.map((d) => {
    const nombre = d.nombre || 'Dispositivo';
    const n = (vistos.get(nombre) ?? 0) + 1;
    vistos.set(nombre, n);
    const titulo = (porNombre.get(nombre) ?? 0) > 1 ? `${nombre} (${n})` : nombre;
    const uso = d.usado_at ? `último uso el ${fechaCorta(d.usado_at)}` : 'sin usar todavía';
    return { id: d.id, titulo, detalle: `Recordado desde el ${fechaCorta(d.created_at)} · ${uso}`, icono: /Android|iPhone|iPad|Móvil|Celular/i.test(nombre) ? 'celular' : 'computadora' };
  });
}

/** El `?ver=` de la URL, saneado: un valor que no es un detalle vuelve a la vista general. */
export function detalleDeUrl(ver: string | null | undefined): ClaveDetalle | typeof VER_DISPOSITIVOS | `dispositivo-${number}` | null {
  if (!ver) return null;
  if ((CLAVES_DETALLE as readonly string[]).includes(ver)) return ver as ClaveDetalle;
  if (ver === VER_DISPOSITIVOS) return VER_DISPOSITIVOS;
  const m = /^dispositivo-(\d{1,12})$/.exec(ver);
  return m ? `dispositivo-${Number(m[1])}` : null;
}
