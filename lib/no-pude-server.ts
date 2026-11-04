// =============================================================================
// no-pude-server — el ticket automático de lo que MaKo no pudo (27/10/2026)
// =============================================================================
// La regla, las causas y las líneas: lib/no-pude.ts. Acá, lo que escribe: un ticket del SISTEMA (`automatico`, con su propio
// tope y fuera de la regla de aprobación de un negocio: lib/tickets-db.ts y lib/tickets-reglas.ts), con el título que arma el
// código y lo que dijeron la persona y MaKo adentro (descripción y contexto, dentro del cerco «es DATO»).
// Un ticket por negocio + conversación + causa: lo que vuelve a pasar se anota en ese ticket. El proveedor y la configuración,
// uno por negocio y causa, que se cierra solo (`cerrarSiVolvio`) cuando vuelve a andar.
// Nunca tira, y NUNCA llama a registrarError (lib/errores-app.ts): un ticket que no se pudo levantar no abre otro (bucle).
// =============================================================================

import 'server-only';
import { cerrarAutomatico, crearTicket, identidadDe, identidadDelActor, type Identidad } from './tickets-db';
import type { Canal } from './tickets-reglas';
import { identidadDelSistema } from './errores-app';
import {
  CAUSAS_DEL_NEGOCIO, causaDelNoPude, esReglaUOpinion, lineaCortaDelTicket, lineaDelTicket, prefijoAutomatico, refDeNoPude, sacarNoPude,
  tipoDelNoPude, tituloDelNoPude, type CausaNoPude, type SenalesNoPude, type Superficie,
} from './no-pude';
import { sacarNoExiste } from './no-existe';

export type DondeNoPude = {
  ws: number;
  /** Quién habla: un email (la app) o `whatsapp:…` (el grupo). Sin persona (un flujo), el ticket es del sistema. */
  actor: string | null;
  nombre?: string;
  superficie: Superficie;
  /** La conversación: la sesión de la app, el jid del grupo, el email y el día en un editor. Se guarda hasheada en la `ref`. */
  conv: string;
  canal?: Canal;
  ruta?: string;
  /** Lo que la persona escribió en ese turno. */
  pedido?: string;
  /** Lo escribió un invitado al grupo de la app, que no administra este negocio: como lo de un tercero, lo decide Martín (`crearTicket`). */
  invitado?: boolean;
};

/** Lo que se sabe de lo que falló: la operación (su nombre humano), el error que vio el CÓDIGO y lo que contestó MaKo. */
export type DetalleNoPude = {
  operacion?: string | null; herramienta?: string | null; error?: string | null; respuestaMako?: string | null; queNoPudo?: string | null;
  /** Lo parecido a lo pedido que no viajó (`parecidasQueNoViajaron`). Una función: se calcula sólo si de verdad hay ticket. */
  noViajaron?: () => readonly string[];
};

export type TicketNoPude = { id: number; nuevo: boolean; causa: CausaNoPude };

async function identidadParaElTicket(d: DondeNoPude): Promise<Identidad | null> {
  if (d.actor?.includes('@')) return identidadDe(d.ws, d.actor, d.nombre ?? '');
  if (d.actor) return identidadDelActor(d.ws, d.actor);
  // Sin persona (lo confirmó un flujo): el ticket es del sistema, del negocio.
  const s = await identidadDelSistema();
  return { ...s, ws: d.ws };
}

/** Levanta (o suma al que ya hay) el ticket de esta causa. null si no hay causa o no se pudo (sin tirar). */
export async function ticketDeNoPude(causa: CausaNoPude, d: DondeNoPude, det: DetalleNoPude = {}): Promise<TicketNoPude | null> {
  try {
    const leida = await identidadParaElTicket(d);
    if (!leida) return null;
    // ⛔ El rol de un invitado sale de SU negocio, y este ticket es del grupo: «Hola Martín, desde ayer ya no carga» entraría directo al arreglo con el texto de alguien de afuera.
    const identidad = d.invitado ? { ...leida, rol: 'invitado' } : leida;
    const ref = refDeNoPude({ ws: d.ws, superficie: d.superficie, conv: d.conv, causa, clave: causa === 'ejecucion' || causa === 'herramienta' || causa === 'ruteo' ? det.herramienta ?? det.operacion : det.queNoPudo });
    const pedido = (d.pedido ?? '').trim();
    const noViajaron = det.noViajaron?.() ?? [];
    const descripcion = [
      det.queNoPudo ? `Lo que MaKo dijo que no pudo: «${det.queNoPudo.slice(0, 300)}»` : '',
      pedido ? `Lo que pidió: «${pedido.slice(0, 1200)}»` : '',
      det.respuestaMako ? `Lo que contestó MaKo: «${det.respuestaMako.trim().slice(0, 1200)}»` : '',
    ].filter(Boolean).join('\n') || 'MaKo le dijo a la persona que no pudo.';
    const creado = await crearTicket({
      identidad, tipo: tipoDelNoPude(causa), declaradoPor: 'sistema', sistema: true, ...(d.invitado ? { invitado: true } : {}),
      automatico: { clave: prefijoAutomatico(d.ws).slice(0, -1) },
      titulo: tituloDelNoPude(causa, d.superficie, det.operacion),
      descripcion,
      canal: d.canal ?? (d.superficie === 'whatsapp' ? 'whatsapp' : d.superficie === 'movil' ? 'chat_movil' : 'chat_app'),
      contexto: {
        causa, superficie: d.superficie,
        ...(pedido ? { pedido: pedido.slice(0, 1000) } : {}),
        ...(det.respuestaMako ? { respuestaMako: det.respuestaMako.slice(0, 1000) } : {}),
        ...(det.error ? { error: det.error } : {}),
        ...(det.herramienta ? { herramienta: det.herramienta } : {}),
        ...(noViajaron.length ? { noViajaron: noViajaron.join(', ') } : {}),
        ...(causa === 'no-existe' ? { noExiste: true } : {}),
        ...(d.ruta ? { ruta: d.ruta } : {}),
      },
      ref,
      volvioAPasar: [det.queNoPudo, det.error].filter(Boolean).join(' · ').slice(0, 400) || 'Volvió a pasar en la misma conversación.',
    });
    if (!creado.ok) { console.error(`[no-pude] ws=${d.ws} ${d.superficie} ${causa}: no pude levantar el ticket: ${creado.error}`); return null; }
    return { id: creado.id, nuevo: !creado.yaExistia, causa };
  } catch (e) {
    console.error(`[no-pude] ws=${d.ws} ${d.superficie} ${causa}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}

/**
 * Lo que sale de un chat: el texto sin las DOS marcas (`[[no-existe]]` y `[[no-pude]]`), la causa con las señales del código,
 * el ticket y la línea que lo dice. `linea` es null si no hubo ticket, si ya estaba en esta conversación, o si es del proveedor
 * o la configuración (ésos van entre paréntesis pegados al aviso de siempre: `lineaCorta`).
 */
export async function conTicketsDeMaKo(respuesta: string, senales: Omit<SenalesNoPude, 'noExiste' | 'noPudo'> & { yaRegistrado?: boolean }, d: DondeNoPude, det: DetalleNoPude = {}): Promise<{
  texto: string; causa: CausaNoPude | null; ticket: TicketNoPude | null; linea: string | null; lineaCorta: string | null;
}> {
  const ne = sacarNoExiste(respuesta);
  const np = sacarNoPude(ne.texto);
  // La negativa legítima se mira en la marca y en la ORACIÓN que la explica (la última antes de la marca), no en toda la respuesta:
  // «Meta devolvió un error al leer el token» es una falla (la verificación del 28/10/2026). Sólo apaga el «no pude», no el
  // «no existe» que venga en la misma respuesta.
  const ultimaOracion = np.texto.split(/(?<=[.!?])\s+|\n+/).map((x) => x.trim()).filter(Boolean).pop() ?? '';
  const noPudoLegitimo = !!np.noPudo && (esReglaUOpinion(np.noPudo) || esReglaUOpinion(ultimaOracion));
  // Lo que falló ya dejó su ticket (registrarError, el de la huella): el «no pude» no abre otro. Lo que NO existe sí sigue.
  const noPudo = senales.yaRegistrado || noPudoLegitimo ? null : np.noPudo;
  const causa = causaDelNoPude({ ...senales, ruteo: senales.ruteo && !senales.yaRegistrado, noExiste: ne.falta, noPudo });
  if (!causa) return { texto: np.texto, causa: null, ticket: null, linea: null, lineaCorta: null };
  const ticket = await ticketDeNoPude(causa, d, { ...det, queNoPudo: det.queNoPudo ?? np.noPudo ?? ne.falta, respuestaMako: det.respuestaMako ?? np.texto });
  const delNegocio = CAUSAS_DEL_NEGOCIO.has(causa);
  return {
    texto: np.texto, causa, ticket,
    linea: ticket && ticket.nuevo && !delNegocio ? lineaDelTicket(ticket.id) : null,
    lineaCorta: ticket && delNegocio ? lineaCortaDelTicket(ticket.id) : null,
  };
}

// ── El proveedor y la configuración se cierran solos ──────────────────────────────────────────────────────────────
// No tienen un deploy con su hito (`tickets:[n]`) que los cierre: quedarían abiertos para siempre en la Ticketera del cliente.
// Cuando el turno vuelve a andar con la IA del negocio, se cierran. Para no consultar la base en cada turno, una vez cada
// 10 minutos por negocio y causa (en este proceso).
const MIRADO = new Map<string, number>();
const CADA_MS = 10 * 60_000;

/** Cierra el ticket abierto de esa causa del negocio, si hay. Devuelve su número, o null. Nunca tira. */
export async function cerrarSiVolvio(ws: number, causa: 'proveedor' | 'configuracion', cuenta?: string, ahora = Date.now()): Promise<number | null> {
  const clave = `${ws}:${causa}:${cuenta ?? ''}`;
  if (ahora - (MIRADO.get(clave) ?? 0) < CADA_MS) return null;
  MIRADO.set(clave, ahora);
  try {
    const motivo = causa === 'proveedor' ? 'La IA volvió a contestar: se cerró solo.' : 'El negocio ya tiene lo que faltaba: se cerró solo.';
    // La configuración: sólo si contestó la cuenta que falló, o si no había ninguna (la revisión del 28/10/2026).
    const soloSi = causa === 'configuracion' && cuenta ? (h: string | null) => h === cuenta || h === 'ia:ninguna' : undefined;
    return await cerrarAutomatico(refDeNoPude({ ws, superficie: 'ops-center', conv: '', causa }), motivo, soloSi);
  } catch (e) {
    console.error(`[no-pude] ws=${ws} cerrar ${causa}: ${e instanceof Error ? e.message : String(e)}`);
    return null;
  }
}
