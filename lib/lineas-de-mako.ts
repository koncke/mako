// =============================================================================
// lineas-de-mako — las dos líneas de Martín: quién avisa que se cayó la otra (puro)
// =============================================================================
// Martín, 03/11/2026: «veo que MaKo la linea principal se desconecto, seria bueno evitar que eso pase... Encontrar la forma
// de evitarlo.. Y si llega a pasar tengo mi linea secundaria para avisarme a mi mismo».
//
//   · PRINCIPAL: la voz de MaKo (`instanciaVoz`). Desde ahí habla en los grupos de los clientes.
//   · SECUNDARIA: la línea por default del negocio del super admin (el …3479). Nadie la miraba: `vigilarLineasClientes` saltea a la
//     plataforma y `vigilarVozMaKo` sólo mira la voz.
//   ⚠️ PUEDEN SER LA MISMA. Desde el 3/11/2026 a las 17:16 ART, por pedido de Martín, la voz está en el …3479. Con una sola línea no hay «la otra»:
//   se vigila ésa, y si cae el aviso va por mail, no a sí misma como si fuera otra.
//
// LO QUE SE MIDIÓ ESE DÍA (el detalle, en docs/hallazgos-comunicacion.md): WhatsApp rechazó el login de la principal con un
// 403. Evolution 2.3.7 no reintenta 401, 402, 403 ni 406 (`codesToNotReconnect`) y todo lo demás lo reintenta solo.
//   ⚠️ O sea que el 403 NO SE PUEDE EVITAR NI RECONECTAR DESDE ACÁ: lo decide WhatsApp, y la única salida es volver a vincular.
//   Lo que sí se puede es que Martín se entere en minutos, una vez, y con el link.
//
// LO QUE DECIDE ESTE MÓDULO, sin red, para que tenga test (tests/lineas-de-mako.test.ts):
//
//   · EL AVISO NUNCA SALE POR LA LÍNEA CAÍDA (`rutasDelAviso`). Con la principal viva sale de ahí hacia la secundaria: le llega a
//     Martín de OTRO número, así que suena. Con la principal caída, la secundaria se escribe A SÍ MISMA, un solo mensaje: el chat
//     consigo mismo es donde Martín ya se manda audios y links todos los días, y no le llega a nadie más.
//     ⚠️ No medí que un mensaje a uno mismo haga sonar el teléfono; por eso el mail de la voz sigue saliendo.
//     Con las dos caídas, o si no salió por ningún lado, va por mail.
//   · ⚠️ ESTE VIGILANTE NO MUEVE NI LA VOZ NI SU TRÁFICO. Sólo avisa: un mensaje por caída, y nunca al número caído, que puede ser una cuenta baneada.
//   · UNA VEZ POR CAÍDA, Y OTRO AL VOLVER. La marca se reclama con compare-and-set antes de mandar (dos corridas a la vez no
//     mandan dos), y se suelta si el aviso no llegó a ningún lado: la próxima corrida reintenta.
//     La excepción: si avisó «puede volver sola» y después WhatsApp cerró la sesión, avisa de nuevo. Cambió lo que hay que hacer.
//   · «NO PUDE PREGUNTAR» NO ES «ESTÁ CAÍDA». Sin respuesta de Evolution no se toca nada. El mail de «no puedo comprobar»
//     ya lo manda lib/canal-vigilante.ts.
//   · UN CORTE SE CONFIRMA, UN CIERRE NO. `close` con un código sin vuelta se avisa en la misma corrida: no va a volver solo.
//     Cualquier otro espera `CONFIRMAR_MIN`, porque un reinicio de Evolution deja todas las líneas unos segundos sin socket.
//   · LA SONDA SE RACIONA (`hayQueSondear`). Con el estado en `open` la sonda es tráfico real contra WhatsApp en una línea no
//     oficial: corre cada `SONDA_CADA_MIN`, no cada 3 minutos. El estado se lee de la base de Evolution, sin tocar WhatsApp.
//     Hace falta igual: `open` puede ser mentira (la voz estuvo seis días así en septiembre).
//   · REABRIR SIN BORRAR (`decidirReapertura`). Sólo `close` con un código que no sea sin vuelta. Con `connecting` ya reintenta
//     Evolution, y `/instance/connect` sólo devuelve el QR. Con `open` no hace nada, y `restart` tampoco la saca (medido el
//     11/09). Nunca logout ni delete: eso le borra la sesión a una línea que quizá vuelve.
//
// Por qué no pasa por el catálogo de avisos: el catálogo sale por `instanciaVoz`, que es lo que se acaba de caer.
//
// Sin `server-only`: lo importan el vigilante (lib/lineas-de-mako-vigilante.ts) y el test.

import type { Sondeo } from './evolution-sonda';
import { CONFIRMAR_MIN } from './linea-vigilancia';

export type Rol = 'principal' | 'secundaria';

/** Las marcas viven en los settings del workspace de la plataforma, por ROL y no por instancia: la principal puede rotar de nombre. */
export const keyDesde = (rol: Rol): string => `mako.linea.${rol}.caida.desde`;
export const keyAvisado = (rol: Rol): string => `mako.linea.${rol}.caida.avisado`;
export const keyReapertura = (rol: Rol): string => `mako.linea.${rol}.reapertura`;

/** Los códigos con que Evolution 2.3.7 deja de reintentar (`codesToNotReconnect`): loggedOut, 402, forbidden y 406. */
export const CODIGOS_SIN_VUELTA: readonly number[] = [401, 402, 403, 406];
/** Cada cuánto se sondea una línea que dice `open` y no tiene ninguna marca. El cron corre cada 3 minutos. */
export const SONDA_CADA_MIN = 12;
/** Lo mínimo entre dos intentos de reabrir la misma sesión. */
export const REABRIR_CADA_MIN = 10;

/** Lo que Evolution guarda de la línea, sin hablar con WhatsApp. `estado` y `codigo` son de su base: el código es el de la ÚLTIMA caída terminal. */
export type FotoLinea = { existe: boolean; estado: string | null; codigo: number | null; cuando: string | null; numero: string | null };

/** Qué le pasó a la línea, que decide qué se le pide a Martín. */
export type TipoCaida = 'desvinculada' | 'zombi' | 'cortada';

export function tipoDeCaida(f: FotoLinea): TipoCaida {
  if (!f.existe) return 'desvinculada';
  if (f.estado === 'open') return 'zombi';
  // ⚠️ El código solo no alcanza: queda guardado de la caída anterior aunque se haya re-escaneado (`mako_ws11`: `open` con un
  // 401 del 09/10). Sólo `close` lo hace seguro: Evolution lo escribe al darse por vencido, y en un corte que reintenta pasa a
  // `connecting`. Un `connecting` con 403 también existe (`mako_ws1`, 08/09) y no se distingue de un corte con un código viejo:
  // cae en `cortada`, que trae el link igual pero no manda a escanear algo que quizá está volviendo.
  if (f.estado === 'close' && f.codigo != null && CODIGOS_SIN_VUELTA.includes(f.codigo)) return 'desvinculada';
  return 'cortada';
}

export type Marcas = { desde: string | null; avisado: string | null };

/** La marca de «ya avisé» guarda también de qué tipo fue el aviso: un «puede volver sola» no cubre un «hay que escanear». */
export const marcaAvisado = (iso: string, tipo: TipoCaida): string => `${iso}|${tipo}`;
const tipoAvisado = (marca: string): string => marca.split('|')[1] ?? '';

export type DecisionAviso =
  | { que: 'nada' }
  | { que: 'fijar_desde' }
  | { que: 'limpiar' }
  | { que: 'volvio' }
  | { que: 'avisar'; tipo: TipoCaida };

export function decidirAviso(e: {
  sondeo: Sondeo;
  /** La secundaria deja de vigilarse si se la desvinculó a propósito o nunca se vinculó: eso no es una caída. */
  vigilada: boolean;
  tipo: TipoCaida;
  marcas: Marcas;
  ahoraMs: number;
}): DecisionAviso {
  const hayMarcas = !!(e.marcas.desde || e.marcas.avisado);
  if (e.sondeo === 'sin_respuesta') return { que: 'nada' };
  if (e.sondeo === 'vivo') {
    if (e.marcas.avisado) return { que: 'volvio' };
    return hayMarcas ? { que: 'limpiar' } : { que: 'nada' };
  }
  if (!e.vigilada) return hayMarcas ? { que: 'limpiar' } : { que: 'nada' };
  if (e.marcas.avisado) {
    return tipoAvisado(e.marcas.avisado) === 'cortada' && e.tipo !== 'cortada' ? { que: 'avisar', tipo: e.tipo } : { que: 'nada' };
  }
  if (e.tipo === 'desvinculada') return { que: 'avisar', tipo: e.tipo };
  const desde = e.marcas.desde ? Date.parse(e.marcas.desde) : NaN;
  if (Number.isNaN(desde)) return { que: 'fijar_desde' };
  return e.ahoraMs - desde < CONFIRMAR_MIN * 60_000 ? { que: 'nada' } : { que: 'avisar', tipo: e.tipo };
}

/** ¿Esta corrida le pregunta a WhatsApp? Sin socket (`close`, `connecting`) la sonda no sale de Evolution; con `open`, sí. */
export function hayQueSondear(e: { estado: string | null; marcas: Marcas; ahoraMs: number }): boolean {
  if (e.estado !== 'open') return true;
  if (e.marcas.desde || e.marcas.avisado) return true;
  return new Date(e.ahoraMs).getUTCMinutes() % SONDA_CADA_MIN < 3;
}

export function decidirReapertura(e: { sondeo: Sondeo; foto: FotoLinea; vigilada: boolean; ultimo: string | null; ahoraMs: number }): boolean {
  if (e.sondeo !== 'muerto' || !e.vigilada || !e.foto.existe || e.foto.estado !== 'close') return false;
  if (e.foto.codigo != null && CODIGOS_SIN_VUELTA.includes(e.foto.codigo)) return false;
  const ultimo = e.ultimo ? Date.parse(e.ultimo) : NaN;
  return Number.isNaN(ultimo) || e.ahoraMs - ultimo >= REABRIR_CADA_MIN * 60_000;
}

export type Ruta = { linea: string; a: string[] };
export type ExtremoRuta = { instancia: string; sondeo: Sondeo; numero: string | null };

/** Por dónde sale un aviso, en orden de preferencia. Vacío = no hay WhatsApp posible, va por mail. Una línea que no da `vivo` no manda. */
export function rutasDelAviso(e: { principal: ExtremoRuta; secundaria: ExtremoRuta | null }): Ruta[] {
  const { principal: p, secundaria: s } = e;
  if (!s || !s.numero) return [];
  const rutas: Ruta[] = [];
  if (p.sondeo === 'vivo') rutas.push({ linea: p.instancia, a: [s.numero] });
  if (s.sondeo === 'vivo') rutas.push({ linea: s.instancia, a: [s.numero] });
  return rutas;
}

function duracion(desde: string | null, ahoraMs: number): string {
  const ms = desde ? Date.parse(desde) : NaN;
  const min = Number.isNaN(ms) ? 1 : Math.max(1, Math.round((ahoraMs - ms) / 60_000));
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return h < 48 ? `${h} h` : `${Math.floor(h / 24)} días`;
}

const nombreDe = (rol: Rol): string => (rol === 'principal' ? 'la línea de MaKo' : 'tu línea secundaria');
const colaDe = (numero: string | null): string => (numero ? ` (…${numero.slice(-4)})` : '');
const efectoDe = (rol: Rol): string => (rol === 'principal'
  ? 'Mientras tanto MaKo no oye ni avisa en los grupos de los clientes.'
  : 'Por ahí no entran ni salen tus chats, y si MaKo se cae no hay por dónde avisarte por WhatsApp.');

/** El texto del aviso. Sólo `cortada` no manda a escanear: escanear tumba una sesión que está por volver. */
export function textoCaida(e: { rol: Rol; tipo: TipoCaida; foto: FotoLinea; desde: string | null; ahoraMs: number; link: string }): string {
  const titulo = `${nombreDe(e.rol)}*${colaDe(e.foto.numero)}`;
  const efecto = efectoDe(e.rol);
  if (e.tipo === 'cortada') {
    return `🟠 *Se cortó ${titulo}\nNo responde desde hace ${duracion(e.desde, e.ahoraMs)} y está intentando volver sola. ${efecto}\n\n`
      + `Todavía no escanees: escanear puede tumbar una sesión que está por volver. Si en una hora sigue igual, entra aquí:\n${e.link}`;
  }
  if (e.tipo === 'zombi') {
    return `🔴 *Se cayó ${titulo}\nFigura conectada pero no responde desde hace ${duracion(e.desde, e.ahoraMs)}. ${efecto}\n\n`
      + `Se arregla escaneando otra vez. Entra a este link desde la compu y escanea con ese teléfono:\n${e.link}`;
  }
  const causa = e.foto.existe ? `WhatsApp cerró la sesión hace ${duracion(e.foto.cuando ?? e.desde, e.ahoraMs)}.` : 'Ya no está vinculada.';
  return `🔴 *Se cayó ${titulo}\n${causa} ${efecto}\n\n`
    + 'Primero mira si ese teléfono abre WhatsApp normal. Si dice que la cuenta está suspendida, no escanees: se apela desde el teléfono.\n'
    + `Si abre normal, entra a este link desde la compu y escanea con ese teléfono:\n${e.link}`;
}

export function textoVolvio(e: { rol: Rol; numero: string | null; desde: string | null; ahoraMs: number }): string {
  return `✅ *Volvió ${nombreDe(e.rol)}*${colaDe(e.numero)}\nEstuvo caída ${duracion(e.desde, e.ahoraMs)}. Ya entra y sale todo.`;
}

export type DepsVigia = {
  /** Las dos tiran si no se pudieron leer: no saber cuál es la línea no es un estado de la línea. */
  voz(): Promise<string>;
  secundaria(): Promise<string | null>;
  /** null = no se pudo preguntar. */
  foto(instancia: string): Promise<FotoLinea | null>;
  sondear(instancia: string): Promise<{ sondeo: Sondeo }>;
  /** Estricta: una marca que no se pudo leer leída como «no hay marca» repetiría el aviso. */
  leer(key: string): Promise<string | null>;
  escribir(key: string, valor: string): Promise<void>;
  cambiarSi(key: string, esperado: string | null, nuevo: string): Promise<boolean>;
  enviar(linea: string, numero: string, texto: string): Promise<{ ok: boolean; error?: string }>;
  mail(asunto: string, cuerpo: string): Promise<{ enviadoA: number; error?: string }>;
  reabrir(instancia: string): Promise<void>;
  /** Dónde se vuelve a vincular la voz: depende de qué línea sea (el canal de MaKo se escanea en /agencia, una línea de negocio en /whatsapp). */
  linkPrincipal(instancia: string): string;
  linkSecundaria(instancia: string): string;
  ahoraMs(): number;
};

export type ResultadoLinea = {
  rol: Rol; instancia: string; sondeo: Sondeo; estado: string | null; codigo: number | null;
  que: DecisionAviso['que']; llego?: boolean; por?: 'whatsapp' | 'email'; reabierta?: boolean; error?: string;
};

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const sinMarcas = (t: string): string => t.replace(/\*/g, '');

export async function correrVigilancia(d: DepsVigia): Promise<{ lineas: ResultadoLinea[]; error?: string }> {
  let voz: string;
  let sec: string | null;
  try {
    voz = await d.voz();
    sec = await d.secundaria();
  } catch (e) {
    return { lineas: [], error: `no pude leer cuáles son las líneas: ${msg(e)}` };
  }
  if (sec === voz) sec = null;
  const ahoraMs = d.ahoraMs();
  const ahora = new Date(ahoraMs).toISOString();

  const medir = async (rol: Rol, instancia: string) => {
    const foto = await d.foto(instancia).catch(() => null);
    const base = { rol, instancia, estado: foto?.estado ?? null, codigo: foto?.codigo ?? null };
    let crudo: string | null;
    let marcas: Marcas;
    let reapertura: string | null;
    try {
      const [desde, avisado, ultima] = await Promise.all([d.leer(keyDesde(rol)), d.leer(keyAvisado(rol)), d.leer(keyReapertura(rol))]);
      crudo = avisado;
      marcas = { desde: desde || null, avisado: avisado || null };
      reapertura = ultima || null;
    } catch (e) {
      return { ...base, foto, sondeo: 'sin_respuesta' as Sondeo, crudo: null, marcas: { desde: null, avisado: null }, reapertura: null, error: `no pude leer las marcas: ${msg(e)}` };
    }
    let sondeo: Sondeo = 'sin_respuesta';
    if (foto && !foto.existe) sondeo = 'muerto';
    else if (foto && hayQueSondear({ estado: foto.estado, marcas, ahoraMs })) {
      sondeo = (await d.sondear(instancia).catch(() => ({ sondeo: 'sin_respuesta' as Sondeo }))).sondeo;
    } else if (foto) sondeo = 'vivo';
    return { ...base, foto, sondeo, crudo, marcas, reapertura, error: undefined as string | undefined };
  };

  const medidas = [await medir('principal', voz), ...(sec ? [await medir('secundaria', sec)] : [])];
  const p = medidas[0];
  const s = medidas[1] ?? null;
  const rutas = rutasDelAviso({
    principal: { instancia: p.instancia, sondeo: p.sondeo, numero: p.foto?.numero ?? null },
    secundaria: s ? { instancia: s.instancia, sondeo: s.sondeo, numero: s.foto?.numero ?? null } : null,
  });

  const porWhatsApp = async (texto: string): Promise<{ llego: boolean; error?: string }> => {
    let error: string | undefined;
    for (const r of rutas) {
      let llego = false;
      for (const numero of r.a) {
        const envio = await d.enviar(r.linea, numero, texto).catch((e) => ({ ok: false, error: msg(e) }));
        if (envio.ok) llego = true;
        else error = envio.error;
      }
      if (llego) return { llego };
    }
    return { llego: false, error: error ?? (rutas.length ? undefined : 'no hay ninguna línea viva') };
  };

  const resultados: ResultadoLinea[] = [];
  const pendientesDeMail: Array<{ r: ResultadoLinea; texto: string; soltar?: () => Promise<unknown> }> = [];

  for (const m of medidas) {
    const r: ResultadoLinea = { rol: m.rol, instancia: m.instancia, sondeo: m.sondeo, estado: m.estado, codigo: m.codigo, que: 'nada', ...(m.error ? { error: m.error } : {}) };
    resultados.push(r);
    if (m.error) continue;
    // Una línea sin foto queda en `sin_respuesta`, y ahí `decidirAviso` no mira el resto.
    const foto: FotoLinea = m.foto ?? { existe: true, estado: null, codigo: null, cuando: null, numero: null };
    // La principal se vigila siempre, porque MaKo muda es una caída aunque la instancia ya no exista. La secundaria,
    // sólo si existe y alguna vez se vinculó: si no, es un número que se soltó a propósito.
    const vigilada = m.rol === 'principal' || (foto.existe && !!foto.numero);
    const tipo = tipoDeCaida(foto);
    const decision = decidirAviso({ sondeo: m.sondeo, vigilada, tipo, marcas: m.marcas, ahoraMs });
    r.que = decision.que;
    const link = m.rol === 'principal' ? d.linkPrincipal(m.instancia) : d.linkSecundaria(m.instancia);
    try {
      if (decidirReapertura({ sondeo: m.sondeo, foto, vigilada, ultimo: m.reapertura, ahoraMs })) {
        await d.escribir(keyReapertura(m.rol), ahora);
        await d.reabrir(m.instancia);
        r.reabierta = true;
      }
      if (decision.que === 'fijar_desde') await d.escribir(keyDesde(m.rol), ahora);
      if (decision.que === 'limpiar') {
        await d.escribir(keyDesde(m.rol), '');
        await d.escribir(keyAvisado(m.rol), '');
      }
      if (decision.que === 'volvio') {
        if (!(await d.cambiarSi(keyAvisado(m.rol), m.crudo, ''))) { r.que = 'nada'; continue; }
        // Se limpia aunque el «volvió» no llegue: con un «desde» viejo, la próxima caída se avisaría sin confirmarla.
        await d.escribir(keyDesde(m.rol), '');
        const texto = textoVolvio({ rol: m.rol, numero: foto.numero, desde: m.marcas.desde, ahoraMs });
        const w = await porWhatsApp(texto);
        if (w.llego) { r.llego = true; r.por = 'whatsapp'; } else pendientesDeMail.push({ r, texto });
      }
      if (decision.que === 'avisar') {
        const claim = marcaAvisado(ahora, decision.tipo);
        if (!(await d.cambiarSi(keyAvisado(m.rol), m.crudo, claim))) { r.que = 'nada'; continue; }
        const soltar = () => d.cambiarSi(keyAvisado(m.rol), claim, m.crudo ?? '');
        const desde = m.marcas.desde ?? ahora;
        if (!m.marcas.desde) await d.escribir(keyDesde(m.rol), desde);
        const texto = textoCaida({ rol: m.rol, tipo: decision.tipo, foto, desde, ahoraMs, link });
        const w = await porWhatsApp(texto);
        if (w.llego) { r.llego = true; r.por = 'whatsapp'; } else pendientesDeMail.push({ r, texto, soltar });
      }
    } catch (e) {
      r.error = msg(e);
    }
  }

  if (pendientesDeMail.length) {
    const ambas = !!s && p.sondeo === 'muerto' && s.sondeo === 'muerto';
    const asunto = ambas ? '🚨 Las dos líneas de WhatsApp de MaKo están caídas' : sinMarcas(pendientesDeMail[0].texto.split('\n')[0]);
    const cabecera = ambas
      ? `Las dos líneas están caídas, así que este aviso sólo puede llegar por mail.\nLínea de MaKo: ${d.linkPrincipal(p.instancia)}\nLínea secundaria: ${d.linkSecundaria(s!.instancia)}`
      : 'No pude avisarte por WhatsApp, así que este aviso llega por mail.';
    const cuerpo = [cabecera, ...pendientesDeMail.map((x) => sinMarcas(x.texto))].join('\n\n');
    const envio = await d.mail(asunto, cuerpo).catch((e) => ({ enviadoA: 0, error: msg(e) }));
    for (const x of pendientesDeMail) {
      x.r.llego = envio.enviadoA > 0;
      x.r.por = 'email';
      if (envio.enviadoA > 0) continue;
      x.r.error = envio.error ?? 'el mail no salió';
      // ⚠️ Sólo se suelta la de la caída: si no llegó a ningún lado, la próxima corrida reintenta.
      if (x.soltar) await x.soltar().catch((e) => { x.r.error = `${x.r.error}; no pude soltar la marca: ${msg(e)}`; });
    }
  }
  return { lineas: resultados };
}
