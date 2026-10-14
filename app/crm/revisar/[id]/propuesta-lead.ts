// =============================================================================
// Lo que una propuesta de lead trae ADEMÁS de la tabla — puro, sin 'use client'
// =============================================================================
// La pantalla de revisión (/crm/revisar/<id>) dibuja los contactos con la tabla del
// importador, y la tabla sólo sabe de nombre, email, teléfono y empresa. Lo demás que
// trae una propuesta se perdía al confirmar, y lo pagaba sobre todo la LANDING:
//
//   · los PRODUCTOS que la persona pidió: el lead nacía en el embudo del negocio, y si
//     ya existía no se lo agregaba a ninguno — o sea que quien se anotó en «Mentoría»
//     no aparecía en el tablero de Mentoría (la regla es «agregar, nunca mover»);
//   · la ATRIBUCIÓN (utm, fbclid, la visita grabada): el lead nacía con origen
//     «importación», sin campaña y sin la sesión que lo ataba a lo que hizo antes.
//
// Vive acá, sin `'use client'`, porque lo leen el server (la página arma las filas
// iniciales; la action decide productos y atribución CON LOS DATOS DE LA PROPUESTA, no
// con lo que mande el navegador) y el cliente, y porque así tiene test.
// =============================================================================

import { recalcular, type FilaImport } from '@/app/crm/leads-importar';
import { respuestasGuardadas, type RespuestaOptin } from '@/lib/optin-respuestas';

const str = (v: unknown) => (typeof v === 'string' ? v : '');

/** Los leads crudos de la propuesta: el LOTE (`datos.leads`) o la forma vieja de uno en la raíz. */
function crudos(datos: Record<string, unknown>): Record<string, unknown>[] {
  return Array.isArray(datos.leads) ? (datos.leads as Record<string, unknown>[]) : [datos];
}

/**
 * Los leads propuestos, con la forma que espera la tabla del importador. El id es `p<i>`,
 * la posición en la propuesta: con él el server vuelve a encontrar la atribución de cada
 * fila sin creerle nada al navegador.
 */
export function filasDePropuesta(datos: Record<string, unknown>): FilaImport[] {
  return recalcular(crudos(datos).map((c, i) => ({
    id: `p${i}`,
    nombre: str(c.nombre),
    email: str(c.email),
    telefono: str(c.telefono),
    empresa: str(c.empresa),
    incluir: true,
    yaExiste: false,
  })));
}

/**
 * Las filas como las tiene que ver la persona AL ABRIR: con el «ya existe» resuelto y el
 * repetido DESTILDADO, igual que en el importador (ImportarLeadsModal: «el duplicado nace
 * destildado»). Sin esto la pantalla decía «Crear 1 lead» sobre un contacto repetido, el
 * server lo descubría al confirmar, lo omitía en silencio y la persona no quedaba en
 * ningún lado.
 */
export function filasIniciales(marcadas: FilaImport[]): FilaImport[] {
  return recalcular(marcadas).map((f) => (f.motivo ? { ...f, incluir: false } : f));
}

/**
 * Los productos que pidió la persona, en orden: el primero es la casa. `null` es el
 * producto del negocio. `[]` = la propuesta no trae productos (las de Claude y WhatsApp):
 * entonces entra donde entró siempre.
 */
export function productosDePropuesta(datos: Record<string, unknown>): Array<number | null> {
  if (!Array.isArray(datos.funnels)) return [];
  const out: Array<number | null> = [];
  for (const v of datos.funnels) {
    if (v === null) { if (!out.includes(null)) out.push(null); continue; }
    const n = typeof v === 'number' ? v : Number(v);
    if (Number.isInteger(n) && n > 0 && !out.includes(n)) out.push(n);
  }
  return out;
}

export type Atribucion = {
  origen_lead: string;
  visitor_id?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  fbclid?: string;
  /** Lo que contestó en el formulario de la landing (mig 0274). */
  optin_respuestas?: RespuestaOptin[];
};

const CAMPOS_ATRIB = ['visitor_id', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'fbclid'] as const;

/**
 * La atribución de cada fila, por id (`p<i>`), SÓLO para lo que llegó de la landing.
 *
 * Las propuestas de Claude, WhatsApp o la app no traen campaña: ahí no se escribe nada y
 * el lead queda como lo deja el importador. Lo que no viene, no se inventa.
 */
export function atribucionDePropuesta(origen: string | null, datos: Record<string, unknown>): Record<string, Atribucion> {
  if (origen !== 'landing') return {};
  const out: Record<string, Atribucion> = {};
  crudos(datos).forEach((c, i) => {
    const a: Atribucion = { origen_lead: 'landing' };
    for (const k of CAMPOS_ATRIB) {
      const v = str(c[k]).trim().slice(0, 300);
      if (v) a[k] = v;
    }
    // Ya llegan saneadas de la ruta; se vuelven a sanear porque se leen de la base.
    const resp = respuestasGuardadas(c.respuestas);
    if (resp.length) a.optin_respuestas = resp;
    out[`p${i}`] = a;
  });
  return out;
}

/** Quién propuso estos contactos, en una frase. «Claude» sólo si fue Claude. */
export function quienPropuso(origen: string | null, datos: Record<string, unknown>): string {
  if (origen === 'landing') return 'Llegó de tu landing';
  if (origen === 'whatsapp') return 'Lo propuso MaKo por WhatsApp';
  if (origen === 'claude') {
    const desde = str(datos.origen).trim();
    return `Lo propuso Claude${desde ? ` desde ${desde}` : ''}`;
  }
  return 'Lo propuso MaKo';
}
