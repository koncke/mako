// =============================================================================
// email-dominio-reglas — lo que se valida al conectar el dominio y fijar el remitente (puro, sin `server-only`)
// =============================================================================
// Nació el 4/11/2026, cuando el dominio de envío pasó a poder conectarse por la API de MaKo (Martín, sobre la campaña de
// email de Mauricio: «le di instrucciones de como configurarlo con la API de MaKo desde su claude»). Hasta ese día vivía
// adentro de app/api/email/dominio/route.ts, y un runner no podía llamarlo. Lo usan la ruta de /email y la API
// (lib/email-dominio.ts), con las MISMAS reglas: una sola puerta, dos entradas.
//
// Puro para que el test lo corra: el que habla con Resend y con la base es lib/email-dominio.ts.
// =============================================================================

/**
 * Lo que escribió la persona, como hostname. Acepta una URL («https://dominio.com/x») o un email («hola@dominio.com») y
 * saca el dominio. IDN → punycode con `new URL`. null = no es un dominio.
 */
export function normalizarDominio(raw: string): string | null {
  let d = String(raw ?? '').trim().toLowerCase();
  d = d.replace(/^https?:\/\//, '').replace(/[/?#].*$/, '');
  if (d.includes('@')) d = d.split('@').pop() ?? '';
  d = d.replace(/^www\./, '');
  if (!d) return null;
  try { d = new URL(`http://${d}`).hostname; } catch { return null; }
  // Etiquetas sin guion en los bordes; el TLD arranca con letra.
  const valido = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(d);
  return valido ? d : null;
}

export const DOMINIO_INVALIDO = 'Dominio inválido. Pon solo el dominio (ej: minegocio.com), sin https:// ni @.';

/** La parte antes del @ del remitente: letras, números y . _ % + -. */
export const LOCAL_INVALIDO = 'La parte antes del @ solo puede tener letras, números y . _ -';
export const SIN_NOMBRE = 'Pon el nombre que van a ver tus leads.';
export const RESPONDER_A_INVALIDO = 'La dirección para las respuestas no es un email válido.';

/**
 * El remitente del negocio, armado y validado: `Nombre <local@dominio>`. El nombre visible se limpia de lo que inyecta
 * encabezados o rompe un From (saltos de línea, ángulos, comillas, comas, punto y coma).
 */
export function armarRemitente(local: unknown, nombre: unknown, dominio: string): { ok: true; from: string } | { ok: false; error: string } {
  const l = String(local ?? '').trim().toLowerCase();
  const n = String(nombre ?? '').replace(/[\r\n\t<>",;]/g, '').replace(/\s+/g, ' ').trim().slice(0, 80);
  if (!/^[a-z0-9._%+-]{1,64}$/.test(l)) return { ok: false, error: LOCAL_INVALIDO };
  if (!n) return { ok: false, error: SIN_NOMBRE };
  return { ok: true, from: `${n} <${l}@${dominio}>` };
}

/**
 * La dirección a la que van las RESPUESTAS de los leads (`reply_to`). Puede ser de cualquier dominio (su Gmail, el del
 * equipo): no firma nada, sólo dice adónde contestar. null = vacía o inválida. Sin espacios, ángulos ni saltos: va a un
 * encabezado.
 */
export function sanearResponderA(raw: unknown): string | null {
  const v = String(raw ?? '').trim().toLowerCase();
  if (!v || v.length > 254) return null;
  if (/[\s<>"',;\\]/.test(v)) return null;
  return /^[a-z0-9._%+-]+@(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(v) ? v : null;
}

/** Un registro DNS como lo dice la API de MaKo: lo que hay que cargar en el proveedor del dominio, con su estado. */
export type RegistroDns = { tipo: string; nombre: string; valor: string; prioridad: number | null; ttl: string | null; estado: string | null; para: string };

/** Los registros de Resend, en palabras: qué tipo, qué nombre, qué valor y para qué. */
export function registrosParaCargar(records: ReadonlyArray<{ record?: string; name?: string; type?: string; value?: string; ttl?: string; priority?: number; status?: string }>): RegistroDns[] {
  return records.map((r) => ({
    tipo: String(r.type ?? ''), nombre: String(r.name ?? ''), valor: String(r.value ?? ''),
    prioridad: typeof r.priority === 'number' ? r.priority : null, ttl: r.ttl ? String(r.ttl) : null, estado: r.status ? String(r.status) : null,
    para: String(r.record ?? '').toUpperCase() === 'DKIM' ? 'firma (DKIM)' : String(r.record ?? '').toUpperCase() === 'SPF' ? 'quién puede mandar (SPF)' : String(r.record ?? r.type ?? ''),
  }));
}
