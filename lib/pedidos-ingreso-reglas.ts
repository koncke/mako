// =============================================================================
// pedidos-ingreso-reglas — la bandeja «Quieren entrar» (puro, con test; lo usan el server y las pantallas)
// =============================================================================
// El server vive en lib/pedidos-ingreso.ts. Acá: qué se acepta de un pedido, cómo se suma a la fila que ya existe y lo que se
// le dice a cada uno.
// =============================================================================

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type OrigenPedido = 'google' | 'planes';

export type PedidoNuevo = {
  email: string; nombre: string | null; origen: OrigenPedido; verificado: boolean;
  detalle: string | null; whatsapp: string | null; leadId: number | null;
};

export type FilaPedido = {
  id: number; email: string; nombre: string | null; origen: OrigenPedido; correo_verificado: boolean;
  detalle: string | null; whatsapp: string | null; lead_id: number | null; intentos: number;
  primer_at: string; ultimo_at: string; estado: 'pendiente' | 'descartado';
};

/** Lo que la pantalla de login le dice a quien quedó registrado: desde su lado, no escribió a una pared. */
export const TEXTO_PEDIDO_REGISTRADO = 'Tu cuenta de Google todavía no tiene acceso a MaKo. Ya registramos tu pedido: cuando te den acceso, te llega un correo.';

/** Quien intenta con Google y por qué: un correo sin confirmar por Google no entra (si no, cualquiera llena la bandeja con correos ajenos). */
export function intentoDeGoogle(ui: { email?: unknown; email_verified?: unknown; name?: unknown }): PedidoNuevo | null {
  if (ui.email_verified !== true) return null;
  return pedidoLimpio({ email: ui.email, nombre: ui.name, origen: 'google', verificado: true });
}

/** El pedido limpio, o null si no trae un correo que sirva. */
export function pedidoLimpio(p: { email: unknown; nombre?: unknown; origen: OrigenPedido; verificado: boolean; detalle?: unknown; whatsapp?: unknown; leadId?: unknown }): PedidoNuevo | null {
  const email = typeof p.email === 'string' ? p.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) return null;
  const texto = (v: unknown, tope: number) => {
    const s = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, tope) : '';
    return s || null;
  };
  const wa = typeof p.whatsapp === 'string' ? p.whatsapp.replace(/\D/g, '') : '';
  const lead = Number(p.leadId);
  return {
    email, nombre: texto(p.nombre, 200), origen: p.origen, verificado: p.verificado, detalle: texto(p.detalle, 300),
    whatsapp: /^\d{8,15}$/.test(wa) ? wa : null, leadId: Number.isInteger(lead) && lead > 0 ? lead : null,
  };
}

/**
 * Cómo queda la fila cuando la misma persona vuelve. Suma el intento y completa lo que faltaba, sin pisar con vacíos. Un correo
 * que Google ya confirmó no se desconfirma porque después alguien lo haya escrito en /planes. El estado no se toca: un
 * descartado sigue descartado aunque insista (no vuelve a la bandeja ni a mandar el aviso).
 */
export function pedidoQueVuelve(f: Pick<FilaPedido, 'nombre' | 'correo_verificado' | 'detalle' | 'whatsapp' | 'lead_id' | 'intentos'>, p: PedidoNuevo, ahora: string) {
  return {
    intentos: f.intentos + 1, ultimo_at: ahora, origen: p.origen, correo_verificado: f.correo_verificado || p.verificado,
    nombre: p.nombre ?? f.nombre, detalle: p.detalle ?? f.detalle, whatsapp: p.whatsapp ?? f.whatsapp, lead_id: p.leadId ?? f.lead_id,
  };
}

/** Lo que se ve en la bandeja debajo del nombre. */
export function detalleDelPedido(f: Pick<FilaPedido, 'origen' | 'correo_verificado' | 'detalle' | 'whatsapp' | 'intentos'>): string {
  return [
    f.detalle ?? (f.origen === 'google' ? 'Intentó entrar con Google' : 'Pidió entrar desde la página de planes'),
    f.correo_verificado ? 'Correo verificado por Google' : 'Correo sin verificar',
    ...(f.whatsapp ? [`WhatsApp +${f.whatsapp}`] : []),
    ...(f.intentos > 1 ? [`${f.intentos} intentos`] : []),
  ].join(' · ');
}

/** Donde se aceptan: la pestaña Accounts de Customers. `/admin` redirige a la pestaña Customers, donde NO están. */
export const RUTA_QUIEREN_ENTRAR = '/admin?tab=accounts';

/**
 * El cartel arriba de las pestañas de Customers: lo que espera a Martín se ve sin abrir Accounts (30/10/2026). También lo de las
 * agencias, que tenía el mismo punto ciego. null = no hay nada: no se dibuja.
 */
export function textoDelCartel(quierenEntrar: number, deAgencias: number): string | null {
  const partes = [
    ...(quierenEntrar > 0 ? [`${quierenEntrar} ${quierenEntrar === 1 ? 'quiere' : 'quieren'} entrar`] : []),
    ...(deAgencias > 0 ? [`${deAgencias} ${deAgencias === 1 ? 'pedido' : 'pedidos'} de agencia`] : []),
  ];
  return partes.length ? partes.join(' · ') : null;
}

/** El alta a mano arranca con esto: el negocio se llama como la persona hasta que Martín lo cambie. */
export function altaDelPedido(f: Pick<FilaPedido, 'email' | 'nombre'>): { nombre: string; adminEmail: string; adminNombre: string } {
  const nombre = f.nombre?.trim() || f.email.split('@')[0];
  return { nombre, adminEmail: f.email, adminNombre: f.nombre?.trim() ?? '' };
}
