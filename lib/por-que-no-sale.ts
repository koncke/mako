// =============================================================================
// por-que-no-sale — por qué no le sale (todavía) el mensaje a un lead que está en una automatización (23/10/2026)
// =============================================================================
// Martín, por el Cerebro (P0 del 23/10/2026): «probamos en vivo la automatización de Mauricio y no funcionó, no salió ni a
// mí ni a su esposa». Medido: los dos se inscribieron por evento en 8 s, y el motor cortó por el horario de oficina (9 a 21
// en Tijuana; lo probaron a las 21:47 de allá) SIN ESCRIBIRLO EN NINGÚN LADO: ni un envío en fallo, ni un aviso, ni una
// línea en el lead. La regla que queda: si algo frena un envío, el lead y la tarjeta del paso lo DICEN en palabras
// («No salió: fuera del horario de oficina (9 a 21, hora de Tijuana). Sale hoy 9:00.»). Nunca silencio.
//
// Puro, con las MISMAS reglas que el motor (lib/nutricion.ts, `procesarEnvios`) y en su orden: la pausa, el envío de
// WhatsApp (y desde el 10/11/2026 el de email) del negocio, la línea, el horario de la automatización y los topes de la línea. Sin nada que
// lo frene devuelve null: sale en la próxima vuelta del motor (el tick de cada minuto). Lo usan la ficha y la tarjeta del
// CRM (lib/automatizaciones-del-lead.ts), el historial del lead al inscribirse y la tarjeta del paso en el lienzo.
// =============================================================================
import { dentroDelHorario, proximaApertura, textoDeApertura, horaCorta, type HorarioEnvio } from './horario-envio';

/**
 * Por qué no sale, en palabras (`texto`: la ficha, el historial, la tarjeta del paso), lo corto para un chip
 * («Sale mañana 9:00», «En pausa») y cuándo sale (null = no se sabe: depende de algo que tiene que pasar).
 */
export type FrenoDelEnvio = { texto: string; corto: string; saleAt: string | null };

/** Lo del negocio, leído UNA vez para todas las filas. */
export type ContextoDelEnvio = {
  ahoraMs: number;
  /** La zona del negocio, la del horario. null = no se pudo leer (el motor no manda con horario). */
  tz: string | null;
  /** El envío de WhatsApp del negocio (lib/envio-flags.ts). */
  whatsappPrendido: boolean;
  /**
   * El envío de EMAIL del negocio (10/11/2026). Ausente = no se leyó, y no se afirma nada: el motor marca cada email «canal email
   * apagado» y lo reintenta cada 24 h, y hasta acá eso no lo decía nadie.
   */
  emailPrendido?: boolean;
  /**
   * Lo que salió por WhatsApp en 24 h y en esta hora, con sus topes (lib/limites-envio.ts). `dia` es el de HOY, con la rampa de la
   * línea (5/11/2026, `topeDeHoyDelNegocio`): el mismo que usa el motor. `diaLinea`, el de la línea, si la rampa todavía no llegó.
   */
  linea: { dia: number; usadoDia: number; hora: number; usadoHora: number; diaLinea?: number };
};

/** Una inscripción viva, con lo de SU automatización. */
export type FilaQueEspera = {
  proximoEnvioAt: string | null;
  automatizacionActiva: boolean;
  /** El canal del mensaje que le toca; null = no es un mensaje (una acción, una condición, una espera). */
  canal: string | null;
  /** ¿Hay una línea de WhatsApp por la que salga? (la suya, o la por default del negocio). */
  hayLinea: boolean;
  /**
   * El último intento que FALLÓ de esa inscripción (`nutricion_envios`, estado 'fallo'), con el error del proveedor. Es lo
   * que dice si la línea está caída: la fila de la línea miente en las dos direcciones (el motor decide con la sonda).
   */
  ultimoFallo?: { error: string; at: number } | null;
  /** El horario que vale para esa automatización (`horarioDeLaAutomatizacion`); null = manda a cualquier hora. */
  horario: HorarioEnvio | null;
  /**
   * Lo que el motor manda IGUAL fuera del horario (`seMueveEnLaCorrida`): el carril del recordatorio y la tarjeta «MaKo
   * en WhatsApp» que dice «Lo manda igual». A ésos el horario no los frena (revisión adversarial del 23/10/2026).
   */
  correFueraDeHorario?: boolean;
  /**
   * Lo que NO pasa por los topes de la línea: el carril del recordatorio (`pasaPorAntiBan`). (Hasta el 23/10/2026 también
   * el lead con la reunión encima, por la excepción de «Misma persona», que se fue: los topes de la línea sí lo frenan.)
   */
  sinAntiBan?: boolean;
};

/** «America/Tijuana» → «Tijuana». */
export function ciudadDeZona(tz: string): string {
  return (tz.split('/').pop() ?? tz).replace(/_/g, ' ');
}

/** El error del proveedor, corto y terminado en punto. */
function recortar(e: string): string {
  const t = e.replace(/\s+/g, ' ').trim();
  const corto = t.length > 140 ? `${t.slice(0, 139)}…` : t;
  return /[.…!?]$/.test(corto) ? corto : `${corto}.`;
}

const ISO = (ms: number | null): string | null => (ms == null ? null : new Date(ms).toISOString());

export function porQueNoSale(f: FilaQueEspera, c: ContextoDelEnvio): FrenoDelEnvio | null {
  const freno = (texto: string, corto: string, saleMs: number | null = null): FrenoDelEnvio => ({ texto, corto, saleAt: ISO(saleMs) });
  if (!f.automatizacionActiva) return freno('No sale: la automatización está en pausa.', 'En pausa');
  const prox = f.proximoEnvioAt ? Date.parse(f.proximoEnvioAt) : NaN;
  if (!Number.isFinite(prox)) return null;
  const vencida = prox <= c.ahoraMs;
  const wa = f.canal === 'whatsapp';
  // Lo del canal, como el motor: con el envío apagado o sin línea, un WhatsApp no sale a ninguna hora. Va ANTES del horario:
  // decir «Sale mañana 9:00» de algo que tampoco va a salir a esa hora es mentir.
  if (wa && !c.whatsappPrendido) return freno('No sale: el envío de WhatsApp del negocio está apagado.', 'WhatsApp apagado');
  if (wa && !f.hayLinea) return freno('No sale: el negocio no tiene una línea de WhatsApp.', 'Sin línea de WhatsApp');
  if (f.canal === 'email' && c.emailPrendido === false) return freno('No sale: el envío de email del negocio está apagado. Se prende en Email › Envío real, o al volver a activar la automatización.', 'Email apagado');

  const horario = f.correFueraDeHorario ? null : f.horario;
  /** El primer momento desde `ms` en que el horario deja mandar (sin horario, `ms`). */
  const abierto = (ms: number): number | null => (!horario || c.tz == null ? ms : proximaApertura(ms, c.tz, horario));
  /** «hoy 9:00» / «mañana 9:00» / «el lunes 9:00», en la zona del negocio. */
  const cuando = (ms: number): string => textoDeApertura(ms, c.ahoraMs, c.tz ?? 'UTC');
  const ciudad = c.tz == null ? 'UTC' : ciudadDeZona(c.tz);

  // EL HORARIO: lo vencido afuera queda en la fila y sale al abrir (el tick barre el negocio: `acabaDeAbrir`).
  if (horario) {
    if (c.tz == null) return vencida ? freno('No salió: no pude leer la zona horaria del negocio.', 'No salió') : null;
    const desde = Math.max(prox, c.ahoraMs);
    if (!dentroDelHorario(desde, c.tz, horario)) {
      const abre = abierto(desde);
      const rango = `${horaCorta(horario.desde)} a ${horaCorta(horario.hasta)}, hora de ${ciudad}`;
      // «Abre», no «Sale»: al abrir pueden frenarlo el goteo o los topes de la línea, y eso no se promete (revisión
      // adversarial del 23/10/2026: «300 esperando · Sale mañana 9:00» con un tope de 50 por día).
      const sale = abre != null ? ` Sale cuando abre: ${cuando(abre)}.` : '';
      const corto = abre != null ? `Abre ${cuando(abre)}` : 'Fuera de horario';
      return vencida
        ? freno(`No salió: fuera del horario de oficina (${rango}).${sale}`, corto, abre)
        : freno(`Cae fuera del horario de oficina (${rango}).${sale}`, corto, abre);
    }
  }
  // LO QUE FALLÓ AL MANDAR, con el error del proveedor (la línea caída, el número que no existe). Un fallo NO avanza el
  // paso: el motor lo reprograma y lo vuelve a intentar, así que la fila ya no está vencida y sin esto se callaba
  // (medido en el arnés del ws3 el 23/10/2026: el intento falló y la ficha decía «Lo próximo sale…»).
  if (f.ultimoFallo?.error) {
    return freno(`No salió: ${recortar(f.ultimoFallo.error)}${vencida ? '' : ` Lo vuelve a intentar ${cuando(prox)} (hora de ${ciudad}).`}`, 'Falló al mandar');
  }
  if (!vencida) return null;
  // LOS TOPES DE LA LÍNEA (los de Configuraciones: por día en 24 h corridas, y por hora). El carril no pasa por ellos.
  if (wa && !f.sinAntiBan && c.linea.usadoDia >= c.linea.dia) {
    // Con la rampa por delante (5/11/2026): lo que frena hoy es el tope de hoy, que sube cada día que llega.
    const rampa = c.linea.diaLinea != null && c.linea.diaLinea > c.linea.dia;
    return freno(rampa
      ? `No salió: tu número arranca de a poco y hoy llegó a su tope (${c.linea.dia}). Sube cada día que llega, hasta ${c.linea.diaLinea}. Sale cuando se libere lugar.`
      : `No salió: la línea llegó a su tope del día (${c.linea.dia}). Sale cuando se libere lugar.`, 'Tope del día');
  }
  if (wa && !f.sinAntiBan && c.linea.usadoHora >= c.linea.hora) return freno(`En fila: la línea llegó a su tope de la hora (${c.linea.hora}). Sale en la próxima hora.`, 'Tope de la hora');
  return null;
}
