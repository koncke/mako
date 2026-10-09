'use client';

// =============================================================================
// EvolutionConnect — chip de estado + modal de conexión por QR del WhatsApp
// NO oficial (Evolution API). Autocontenido: su propio estado/fetching, se
// embebe en la tab WhatsApp.
// =============================================================================
// Flujo: "Conectar" → POST conectar (QR base64) → se pollea el estado cada 3s y
// se refresca el QR cada 20s (los QR de WhatsApp expiran) hasta que engancha.
// Reglas del PDF: es el número de EMPRESA (no oficial). El QR se escanea desde
// WhatsApp → Dispositivos vinculados.

import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { IconRefresh, IconWrench } from './_shared/composer-icons';
import { useConfirm } from '../_components/useConfirm';

type Estado = 'desconectado' | 'conectando' | 'conectado' | 'error';
type Qr = { base64: string | null; code: string | null; pairingCode: string | null };
type Resp<T> = { status: number; body: T };
type WhEstado = 'ok' | 'sin_secret' | 'secret_prod' | 'no_registrado' | 'url_distinta' | 'error';

// Explicación de cada estado del espejo de mensajes para el usuario. Los estados
// de ENV (sin_secret/secret_prod/url_distinta) son configuración de despliegue de
// la plataforma: los resuelve el equipo técnico, no el botón "reparar".
const MIRROR_MSG: Record<Exclude<WhEstado, 'ok'>, string> = {
  sin_secret: 'Falta el secret del webhook de Evolution en la configuración de la plataforma. Sin eso los mensajes no llegan a la app — avisa al equipo técnico.',
  secret_prod: 'La app en producción rechaza el secret del webhook: la configuración de la plataforma quedó desalineada. Avisa al equipo técnico y después toca «Reparar espejo».',
  url_distinta: 'La app no responde donde debería: la dirección configurada en la plataforma no es la real. Avisa al equipo técnico.',
  no_registrado: 'El webhook no está activado en este número, por eso no aparecen los chats. Toca «Reparar espejo» para activarlo.',
  error: 'No pude verificar el espejo ahora (Evolution no respondió). Prueba «Reparar espejo».',
};
// Solo estos estados los arregla el botón (los de env los corrige el equipo técnico).
const REPARABLE: WhEstado[] = ['no_registrado', 'error'];

async function apiGet<T>(url: string): Promise<Resp<T>> {
  const r = await fetch(url, { cache: 'no-store' });
  return { status: r.status, body: (await r.json()) as T };
}
async function apiPost<T>(url: string, body: unknown): Promise<Resp<T>> {
  const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: r.status, body: (await r.json()) as T };
}

const chipBase: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '5px 11px',
  borderRadius: '999px', fontSize: '12.5px', fontWeight: 600, cursor: 'pointer',
  fontFamily: "'Geist', sans-serif",
};
const MAX_FALLOS = 5; // tras N fallos seguidos del polling, cortar y avisar

export function EvolutionConnect({ onEstado, ocultarChip = false, abierto, onAbierto, inline = false, panelVisible = true, linea = null, nueva = false, onLineaCreada, onLineasCambiaron }: {
  /**
   * La línea de la que habla este panel (`evolution_instancias.instance_name`); `null` = la de
   * por default. Quien lo monta le pone `key` con la línea: así cambiar de línea es otro
   * panel, sin estado viejo de la anterior.
   */
  linea?: string | null;
  /** «Agregar otro número»: el QR es el de una línea NUEVA, que nace al pedirlo. */
  nueva?: boolean;
  /** La línea nueva quedó vinculada: quien lo monta la elige en el desplegable. */
  onLineaCreada?: (linea: string) => void;
  /** Se desvinculó, renombró o cambió la de por default: hay que releer la lista. */
  onLineasCambiaron?: (movidas?: number) => void;
  /**
   * Le avisa al padre en qué estado quedó el canal.
   *
   * Existe por el chip «Chatbot: ON» de al lado, que estaba en VERDE con el
   * número caído: es verdad sobre el FLAG y falso sobre el SISTEMA. Para que
   * pueda decir la verdad necesita saber esto, y el estado vive acá.
   *
   * `null` = todavía no se sabe. Que el padre reciba `null` y no
   * 'desconectado' es el punto: no puede afirmar nada mientras no sepa.
   */
  onEstado?: (e: Estado | null, caida?: { desvinculado: boolean; fecha: string | null }) => void;
  /**
   * Sin chip propio: el estado lo muestra el botón de la tab «No Oficial», que
   * titila en rojo cuando el número está caído.
   *
   * ⚠️ El componente SIGUE montado aunque no dibuje nada: acá viven el sondeo del
   * estado, el QR y el modal entero. Desmontarlo para «limpiar el header» dejaría
   * a la tab sin forma de saber si el número está vivo y sin pantalla de conexión.
   */
  ocultarChip?: boolean;
  /** Modal controlado desde afuera. Con `inline`, el modal es SOLO para gestionar un número ya conectado. */
  abierto?: boolean;
  onAbierto?: (v: boolean) => void;
  /**
   * El número caído se conecta EN LA PANTALLA, no en un pop-up.
   *
   * ⚠️ Era un modal sobre la bandeja y se leía como algo que hay que sacarse de encima: el
   * que entra rápido cierra el cartel y se queda sin entender que el canal no manda nada.
   * Un panel que OCUPA el lugar de los chats no se puede ignorar, y no tapa nada útil —
   * con el número caído, lo de atrás son conversaciones viejas.
   */
  inline?: boolean;
  /** Con `inline`: si esta tab es la que se está mirando (si no, sigue sondeando sin dibujar). */
  panelVisible?: boolean;
} = {}) {
  const { confirm, confirmNode } = useConfirm();
  const [estado, setEstado] = useState<Estado>('desconectado');
  // ⚠️ ANTES DEL PRIMER FETCH NO SABEMOS NADA, y `estado` arranca en
  // 'desconectado' — o sea que sin esto el chip AFIRMA una desconexión en cada
  // carga de la pantalla, durante el instante que tarda la request. Con el chip
  // viejo (gris, «conectar») eso pasaba desapercibido; con el nuevo, que grita
  // DESCONECTADA en ámbar, sería una falsa alarma en cada F5.
  // «Todavía no pregunté» es un tercer estado y se dice como tal.
  const [cargado, setCargado] = useState(false);
  // ¿El estado que muestro lo MIDIÓ alguien, o es la fila?
  // El sondeo real (traer los grupos) tarda demasiado en una cuenta grande —
  // `mako_ws11` timeoutea a los 30s—, así que el GET le pone 4s de presupuesto y
  // cuando no llega devuelve la fila con `confirmado: false`. Un verde que nadie
  // comprobó no se puede ver igual que uno medido: ese es exactamente el chip
  // que dijo «conectada» sobre una sesión muerta.
  const [confirmado, setConfirmado] = useState(true);
  // Por qué se cayó, cuando se sabe. Un 403/401 de WhatsApp es «te desvinculé»:
  // no vuelve sola y hay que escanear de nuevo. Cualquier otro código es un
  // corte que SÍ puede volver, y ahí mandar a re-escanear seria de más.
  const [caida, setCaida] = useState<{ codigo: number | null; cuando: string | null; desvinculado: boolean } | null>(null);
  const [numero, setNumero] = useState<string | null>(null);
  const [configurado, setConfigurado] = useState(true);
  const [visible, setVisible] = useState(false); // el admin lo ve; setter/closer no (403)
  const [openLocal, setOpenLocal] = useState(false);

  // Controlado (la tab lo abre al entrar con el numero caido) o propio (el chip).
  const open = abierto ?? openLocal;
  const setOpen = useCallback((v: boolean) => { setOpenLocal(v); onAbierto?.(v); }, [onAbierto]);
  /**
   * ¿Estamos en el trabajo de CONECTAR? De esto cuelgan pedir el QR, renovarlo y sondear.
   *
   * Colgaba de `open` (el modal). Con el panel en pantalla ya no hay modal que abrir, así
   * que el QR nunca se pedía: la pantalla quedaba con el recuadro vacío para siempre.
   */
  const conectando = (inline ? visible && panelVisible !== false : open) && estado !== 'conectado';
  const [qr, setQr] = useState<Qr | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [caido, setCaido] = useState(false); // Evolution no responde tras varios intentos
  const [wh, setWh] = useState<WhEstado | null>(null); // salud del espejo de mensajes
  const [reparando, setReparando] = useState(false);
  const [sincronizando, setSincronizando] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const [pedirSync, setPedirSync] = useState(false); // pop-up "¿sincronizar?" al recién conectar
  const [borrando, setBorrando] = useState(false);
  // La línea de este panel. En un ref porque con `nueva` NACE en el primer pedido: el QR
  // de la línea nueva se pide sin línea y de ahí en adelante todo habla de la que volvió.
  const lineaRef = useRef<string | null>(linea);
  const conLinea = <T extends Record<string, unknown>>(b: T): T & { linea: string | null } => ({ ...b, linea: lineaRef.current });
  // Lo que la pantalla de gestión necesita saber de ESTA línea entre todas las del negocio.
  const [infoLinea, setInfoLinea] = useState<{ etiqueta: string; esDefault: boolean; total: number } | null>(null);
  const [etiquetaEdit, setEtiquetaEdit] = useState('');

  const load = useCallback(async () => {
    try {
      const q = lineaRef.current ? `?linea=${encodeURIComponent(lineaRef.current)}` : '';
      const { status, body } = await apiGet<{ ok: boolean; configurado: boolean; estado: Estado; numero: string | null; confirmado?: boolean; caida?: { codigo: number | null; cuando: string | null; desvinculado: boolean } | null; linea?: string | null; lineas?: Array<{ linea: string; etiqueta: string | null; esDefault: boolean }> }>(`/api/whatsapp/evolution${q}`);
      if (status === 403) { setVisible(false); return; }      // setter/closer → sin chip
      setVisible(true);                                        // admin (o error): mostrar chip
      // Una línea NUEVA todavía no existe: el estado de la de por default no es el suyo, y
      // tomarlo dibujaría «conectado» en vez del QR que se vino a escanear.
      if (body.ok && nueva && !lineaRef.current) { setConfigurado(body.configurado); setEstado('desconectado'); setCargado(true); return; }
      if (body.ok) {
        setConfigurado(body.configurado); setEstado(body.estado); setNumero(body.numero); setConfirmado(body.confirmado !== false); setCaida(body.caida ?? null);
        if (body.linea) lineaRef.current = body.linea;
        const esta = (body.lineas ?? []).find((l) => l.linea === body.linea);
        setInfoLinea(esta ? { etiqueta: esta.etiqueta ?? '', esDefault: esta.esDefault, total: (body.lineas ?? []).length } : null);
        setEtiquetaEdit(esta?.etiqueta ?? '');
      }
      setCargado(true);
    } catch {
      setVisible(true); setEstado('error'); setCargado(true); // fallo de red → chip visible, reintentable
    }
  }, [nueva]);

  useEffect(() => { void load(); }, [load]);

  // Un solo lugar avisa al padre: en el efecto y no adentro de cada setEstado,
  // que son cinco y el próximo se olvidaría.
  // El estado solo no alcanza: una sesión que WhatsApp desvinculó se queda en `conectando`
  // para siempre, y sin el motivo el botón de la tab no puede distinguirla de una que está
  // a punto de engancharse. Por eso viaja también la caída.
  useEffect(() => {
    onEstado?.(cargado ? estado : null, caida ? { desvinculado: caida.desvinculado, fecha: caida.cuando } : undefined);
  }, [estado, cargado, caida, onEstado]);

  // Abierto DESDE AFUERA y sin conexion: hay que pedir el QR igual que hace el chip al
  // tocarlo, o el modal se abre con el recuadro vacio y «Sin QR» — que es justo lo que el
  // dueño leeria como «esto tampoco anda».
  const pidioQr = useRef(false);
  useEffect(() => {
    if (!conectando) { pidioQr.current = false; return; }
    if (pidioQr.current || !cargado) return;
    pidioQr.current = true;
    void abrir();
    // `abrir` se redefine en cada render (no es un callback memoizado); la guarda de una
    // sola llamada es `pidioQr`, no la lista de dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectando, cargado, estado]);

  // Polling del estado (3s) + refresh del QR (20s) mientras el modal está abierto
  // sin conectar. Con backoff: tras MAX_FALLOS fallos seguidos corta y avisa.
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  useEffect(() => {
    if (!conectando) return;
    let fallos = 0;
    const poll = setInterval(() => {
      void (async () => {
        // Una línea NUEVA todavía sin nombre: sondear sin línea preguntaría por la de por
        // default, y con ella conectada el panel diría «Conectado» con el número de OTRA línea.
        if (nueva && !lineaRef.current) return;
        try {
          const { body } = await apiPost<{ ok: boolean; estado: Estado; numero: string | null }>('/api/whatsapp/evolution', conLinea({ action: 'estado' }));
          if (body.ok && body.estado !== 'error') {
            fallos = 0; setCaido(false);
            // Transición a conectado (recién escaneó el QR) → preguntar si sincronizar.
            if (body.estado === 'conectado' && estadoRef.current !== 'conectado') {
              setPedirSync(true);
              if (nueva && lineaRef.current) onLineaCreada?.(lineaRef.current);
            }
            setEstado(body.estado);
            if (body.numero) setNumero(body.numero);
          } else if (++fallos >= MAX_FALLOS) { setCaido(true); }
        } catch { if (++fallos >= MAX_FALLOS) setCaido(true); }
      })();
    }, 3000);
    const refresh = setInterval(() => {
      void (async () => {
        if (estadoRef.current === 'conectado') return;
        if (nueva && !lineaRef.current) return;   // ver el sondeo de arriba
        try {
          const { body } = await apiPost<{ ok: boolean; qr?: Qr }>('/api/whatsapp/evolution', conLinea({ action: 'refrescar' }));
          if (body.ok && body.qr) { setQr(body.qr); setCaido(false); }
          else setCaido(true); // no se pudo renovar → el QR de pantalla ya venció
        } catch { setCaido(true); }
      })();
    }, 20000);
    return () => { clearInterval(poll); clearInterval(refresh); };
    // `nueva` y `onLineaCreada` no cambian durante la vida del panel (va con `key` por línea).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conectando, estado]);

  // Salud del espejo de mensajes: al abrir el modal ya conectado, verificamos que
  // el webhook esté activo (si no, los chats no aparecen aunque diga "conectado").
  useEffect(() => {
    if (!open || estado !== 'conectado') { setWh(null); return; }
    let vivo = true;
    void (async () => {
      try {
        const { body } = await apiPost<{ ok: boolean; estado: WhEstado }>('/api/whatsapp/evolution', conLinea({ action: 'webhook-estado' }));
        if (vivo && body.ok) setWh(body.estado);
      } catch { /* sin salud → no mostramos nada, no rompe */ }
    })();
    return () => { vivo = false; };
  }, [open, estado]);

  // ⚠️ La fila y la instancia de una línea NUEVA nacen al pedir el QR, antes de que nadie escanee.
  // Si el panel se va sin haberla conectado (Cancelar, elegir otra línea, cambiar de tab), queda
  // una línea fantasma para siempre en el desplegable. Al desmontar se suelta, con `keepalive`
  // porque la página puede estar yéndose. Es una línea extra: desvincularla borra su fila.
  useEffect(() => () => {
    if (!nueva || !lineaRef.current || estadoRef.current === 'conectado') return;
    try {
      void fetch('/api/whatsapp/evolution', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ action: 'desconectar', linea: lineaRef.current }),
      });
    } catch { /* si no sale, queda en la lista con «Quitar este número» */ }
    // Sólo al desmontar: `nueva` no cambia durante la vida del panel (va con `key` por línea).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // «Quitar este número»: una línea EXTRA que no está conectada (una que nunca se escaneó, o una
  // que se cayó) se puede sacar desde el mismo panel del QR. La de por default no: se vuelve a
  // vincular, porque es por la que sale todo lo que no nombra una línea.
  async function quitarLinea() {
    if (!(await confirm('¿Quitar este número del negocio?'))) return;
    setBusy(true); setErr(null);
    try {
      const { body } = await apiPost<{ ok: boolean; error?: string; movidas?: number }>('/api/whatsapp/evolution', conLinea({ action: 'desconectar' }));
      if (!body.ok) throw new Error(body.error || 'No se pudo quitar');
      onLineasCambiaron?.(body.movidas ?? 0);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function repararMirror() {
    setReparando(true); setErr(null);
    try {
      const { body } = await apiPost<{ ok: boolean; estado: WhEstado; error?: string }>('/api/whatsapp/evolution', conLinea({ action: 'reparar-webhook' }));
      setWh(body.estado);
      if (!body.ok && body.error) setErr(body.error);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setReparando(false); }
  }

  async function sincronizar() {
    setSincronizando(true); setSyncMsg(null); setErr(null);
    try {
      const { body } = await apiPost<{ ok: boolean; chats?: number; mensajes?: number; error?: string }>('/api/whatsapp/evolution', conLinea({ action: 'sincronizar' }));
      if (!body.ok) throw new Error(body.error || 'No se pudo sincronizar');
      setSyncMsg(`Listo: ${body.chats ?? 0} chats · ${body.mensajes ?? 0} mensajes traídos.`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setSincronizando(false); }
  }

  async function borrarChats() {
    if (!(await confirm('¿Borrar TODOS los chats guardados del WhatsApp no oficial? Empiezas de 0. (No afecta tu WhatsApp; solo el espejo guardado en la app.)'))) return;
    setBorrando(true); setSyncMsg(null); setErr(null);
    try {
      const { body } = await apiPost<{ ok: boolean; borrados?: number; error?: string }>('/api/whatsapp/evolution', conLinea({ action: 'borrar-chats' }));
      if (!body.ok) throw new Error(body.error || 'No se pudo borrar');
      setSyncMsg(`Listo: se borraron ${body.borrados ?? 0} mensajes guardados. Empiezas de 0.`);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBorrando(false); }
  }

  function cerrar() {
    setOpen(false);
    void load(); // revalida el chip con el estado real al cerrar
  }

  // El nombre de la línea se guarda al salir del campo. Vacío = sin nombre (se ve el número).
  async function guardarEtiqueta() {
    if (!infoLinea || etiquetaEdit.trim() === infoLinea.etiqueta.trim()) return;
    try {
      const { body } = await apiPost<{ ok: boolean; error?: string }>('/api/whatsapp/evolution', conLinea({ action: 'renombrar-linea', etiqueta: etiquetaEdit }));
      if (!body.ok) throw new Error(body.error || 'No se pudo guardar el nombre');
      setInfoLinea({ ...infoLinea, etiqueta: etiquetaEdit.trim() });
      onLineasCambiaron?.();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
  }

  async function usarPorDefault() {
    setBusy(true); setErr(null);
    try {
      const { body } = await apiPost<{ ok: boolean; error?: string }>('/api/whatsapp/evolution', conLinea({ action: 'predeterminar-linea' }));
      if (!body.ok) throw new Error(body.error || 'No se pudo cambiar');
      if (infoLinea) setInfoLinea({ ...infoLinea, esDefault: true });
      onLineasCambiaron?.();
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function abrir() {
    setOpen(true); setBusy(true); setErr(null); setQr(null); setCaido(false);
    try {
      // La primera vez de una línea NUEVA se pide «nueva-linea»; las siguientes (el «↻ Nuevo
      // QR») ya hablan de la que volvió. Pedir «nueva-linea» de nuevo crearía una tercera.
      const primeraDeNueva = nueva && !lineaRef.current;
      const { body } = await apiPost<{ ok: boolean; error?: string; estado: Estado; qr: Qr; linea?: string }>('/api/whatsapp/evolution', primeraDeNueva ? { action: 'nueva-linea' } : conLinea({ action: 'conectar' }));
      if (!body.ok) throw new Error(body.error || 'No se pudo iniciar la conexión');
      if (body.linea) lineaRef.current = body.linea;
      setEstado(body.estado); setQr(body.qr);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  async function desconectar() {
    const cual = infoLinea && infoLinea.total > 1 ? ` «${infoLinea.etiqueta || numero || 'esta línea'}»` : ' el WhatsApp de empresa';
    if (!(await confirm(`¿Desconectar${cual}? Vas a tener que volver a escanear el QR para reconectar.`))) return;
    setBusy(true); setErr(null);
    try {
      const { body } = await apiPost<{ ok: boolean; error?: string; movidas?: number }>('/api/whatsapp/evolution', conLinea({ action: 'desconectar' }));
      if (!body.ok) throw new Error(body.error || 'No se pudo desconectar');
      setEstado('desconectado'); setNumero(null); setOpen(false);
      onLineasCambiaron?.(body.movidas ?? 0);
    } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }

  if (!visible) return null;

  const conectado = estado === 'conectado';

  // ⚠️ TRES ESTADOS, NO DOS — Y EL CAÍDO SE TIENE QUE LEER COMO CAÍDO.
  //
  // El chip decía «API no Oficial: conectar» con punto gris sobre fondo neutro,
  // entre «API Oficial» en verde y «Envío real: ON» en verde. El dueño miró esa
  // barra y dijo, textual, «acá me dice que está todo conectado» — con el número
  // caído hacía cinco días y la nutrición fallando en silencio.
  //
  // Tres cosas fallaban a la vez, y cada una sola ya alcanzaba:
  //
  // 1. EL RÓTULO ERA UN INFINITIVO. «conectar» es una invitación, no un estado, y
  //    al lado de dos chips que sí dicen un estado se lee como uno más de la
  //    familia. Un estado se nombra: DESCONECTADA.
  // 2. EL ESTILO ERA NEUTRO. Gris sobre `--surface-2` es el aspecto de «opción
  //    disponible», no el de «esto está roto». Y como el color era el único que
  //    intentaba decirlo, la regla de la casa —«el color nunca es el único
  //    portador»— quedaba violada en las dos puntas: ni el color ni el texto.
  // 3. «no conectado» TAPABA A «no pude preguntarlo». `estado` arranca en
  //    'desconectado' antes del primer fetch y cae en 'error' si la red falla,
  //    así que el chip AFIRMABA una desconexión sobre algo que todavía no sabía.
  //    Ésa es la regla que este repo ya pagó en el onboarding: 'desconocido' no
  //    es 'desconectado', y afirmar lo segundo manda a re-escanear un QR que no
  //    hace falta.
  const chipStyle: CSSProperties = conectado
    ? confirmado
      ? { ...chipBase, background: 'var(--good-bg)', border: '1px solid var(--good)', color: 'var(--good)' }
      // Conectado SEGÚN LA FILA, sin confirmar con WhatsApp: borde punteado y
      // sin el verde pleno. La forma dice que es una lectura de segunda mano.
      : { ...chipBase, background: 'var(--surface-2)', border: '1px dashed var(--good)', color: 'var(--dim)' }
    : !cargado || estado === 'error'
      // No pudimos preguntarlo: ni verde ni rojo. No se afirma nada.
      ? { ...chipBase, background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', color: 'var(--dim)' }
      // Desconectado de verdad, o conectando. Ámbar: pide atención sin gritar
      // como un error del sistema — la sesión se cae sola y es normal.
      : { ...chipBase, background: 'var(--warn-bg)', border: '1px solid var(--warn)', color: 'var(--warn)' };

  const puntoColor = conectado ? 'var(--good)' : (!cargado || estado === 'error') ? 'var(--faint)' : 'var(--warn)';
  // La fecha en que se desvinculó, dicha como la diría una persona.
  const fechaCaida = caida?.cuando
    ? new Date(caida.cuando).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })
    : null;
  const rotulo = conectado
    ? (confirmado
      ? `WhatsApp no oficial conectado${numero ? ` · ${numero}` : ''}`
      : 'No Oficial: conectado según el último registro (sin confirmar)')
    : !cargado ? 'No Oficial: comprobando…'
      : estado === 'conectando' ? 'No Oficial: conectando…'
      : estado === 'error' ? 'No Oficial: no pude comprobarlo'
        : caida?.desvinculado
          // ⚠️ «DESCONECTADA» describe NUESTRO lado y no le dice nada al que lo
          // lee. El dueño vio ese cartel, abrió WhatsApp en su teléfono, lo
          // encontró perfecto y contestó «no entiendo» — y tenía razón: su
          // TELÉFONO estaba bien. Lo que se cayó es el dispositivo vinculado.
          // «Se desvinculó el 3 de septiembre» nombra un hecho que puede ir a
          // comprobar en WhatsApp → Dispositivos vinculados.
          ? `WhatsApp se desvinculó${fechaCaida ? ` el ${fechaCaida}` : ''} — volver a vincular`
          : 'WhatsApp no oficial DESCONECTADO — reconectar';

  // ── El número caído se conecta ACÁ, en el lugar de los chats ────────────────
  // Texto al mínimo a propósito: título, dónde tocar en el celular, y el QR. Todo lo
  // demás (sincronizar, desconectar, salud del espejo) es para un número YA conectado y
  // vive en el modal de gestión, que se abre tocando la tab.
  if (inline) {
    if (!visible) return null;                 // setter/closer: sin permiso, sin panel
    // Conectado: sigue el render normal (sin chip), que es el que trae el modal de GESTIÓN
    // —sincronizar, borrar historial, desconectar— y se abre tocando la tab.
    if (conectado) return renderNormal();
    if (!panelVisible) return null;            // otra tab a la vista: sondea, no dibuja
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
        {/* El diálogo de «Quitar este número» se dibuja acá: sin su nodo, `confirm` espera para siempre. */}
        {confirmNode}
        <div style={{ textAlign: 'center', maxWidth: '360px' }}>
          <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--ink)' }}>{nueva ? 'Conecta otro número' : 'Conecta tu WhatsApp'}</div>
          {caida?.desvinculado && (
            // El único texto que se agrega al mínimo, y es el que evita el «no entiendo, mi
            // teléfono anda bien»: nombra el hecho del mundo del dueño, no nuestro estado.
            <div style={{ fontSize: '13px', color: 'var(--warn)', marginTop: '4px' }}>
              WhatsApp cerró la sesión{fechaCaida ? ` el ${fechaCaida}` : ''}. Tu teléfono está bien.
            </div>
          )}
          <div style={{ fontSize: '13.5px', color: 'var(--dim)', marginTop: '6px' }}>
            En tu celular: <strong style={{ color: 'var(--ink)' }}>Dispositivos vinculados → Vincular dispositivo</strong>
          </div>
          <div style={{ width: '260px', height: '260px', margin: '18px auto 0', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
            {caido ? (
              <span style={{ fontSize: '13px', color: 'var(--bad)', padding: '0 16px' }}>El servicio de WhatsApp no responde ahora mismo.</span>
            ) : busy && !qr ? (
              <span style={{ fontSize: '13px', color: 'var(--dim)' }}>Generando QR…</span>
            ) : qr?.base64 ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qr.base64} alt="QR de WhatsApp" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            ) : (
              <span style={{ fontSize: '13px', color: 'var(--faint)' }}>Sin QR</span>
            )}
          </div>
          <button onClick={() => void abrir()} disabled={busy} style={{ marginTop: '12px', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>↻ Nuevo QR</button>
          {!nueva && infoLinea && infoLinea.total > 1 && !infoLinea.esDefault && (
            <div><button onClick={() => void quitarLinea()} disabled={busy} style={{ marginTop: '8px', background: 'none', border: 'none', color: 'var(--bad)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Quitar este número</button></div>
          )}
          {!configurado && <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--warn)' }}>El WhatsApp no oficial no está configurado en el servidor.</div>}
          {err && <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--bad)' }}>{err}</div>}
        </div>
      </div>
    );
  }

  function renderNormal() {
    return (
    <>
      {confirmNode}
      {!ocultarChip && <button onClick={() => { setOpen(true); if (!conectado) void abrir(); }} style={chipStyle}
        title={
          conectado ? `WhatsApp no oficial conectado${numero ? ` (${numero})` : ''}`
            : !cargado ? 'Comprobando el estado del WhatsApp no oficial…'
            : estado === 'error' ? 'No se pudo comprobar el estado del WhatsApp no oficial — puede estar bien'
              : caida?.desvinculado
                ? `WhatsApp cerró la sesión del dispositivo vinculado${fechaCaida ? ` el ${fechaCaida}` : ''}. Tu teléfono está bien — lo que hay que volver a vincular es el dispositivo que usa MaKo (WhatsApp → Dispositivos vinculados). Mientras tanto las secuencias no envían nada.`
                : 'Tu WhatsApp no oficial está desconectado: las secuencias no envían nada. Toca para volver a vincularlo.'
        }>
        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: puntoColor }} />
        {rotulo}
      </button>}

      {open && (
        <div onClick={cerrar} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '24px' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: '440px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
              <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--ink)' }}>WhatsApp de empresa</div>
              <button onClick={cerrar} title="Cerrar" style={{ background: 'none', border: 'none', fontSize: '20px', color: 'var(--faint)', cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--dim)', lineHeight: 1.5, marginBottom: '16px' }}>
              Número no oficial (por QR). En el celular de la empresa: <strong style={{ color: 'var(--ink)' }}>WhatsApp → Dispositivos vinculados → Vincular dispositivo</strong> y escanea.
            </div>

            {!configurado && <div style={{ padding: '10px', borderRadius: '9px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', color: 'var(--warn)', fontSize: '12.5px' }}>El WhatsApp no oficial no está configurado en el servidor.</div>}

            {conectado ? (
              <div>
                <div style={{ width: '46px', height: '46px', margin: '0 auto', borderRadius: '50%', background: 'var(--good-bg)', color: 'var(--good)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                </div>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--good)', marginTop: '6px' }}>Conectado</div>
                {numero && <div style={{ fontSize: '13px', color: 'var(--dim)', marginTop: '2px', fontFamily: "'Geist Mono', monospace" }}>{numero}</div>}

                {/* El nombre de la línea y cuál manda: sólo con más de una. Con un número, el
                    nombre no distingue nada y «por default» no tiene alternativa. */}
                {infoLinea && infoLinea.total > 1 && (
                  <div style={{ marginTop: '14px', textAlign: 'left' }}>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase', color: 'var(--faint)', marginBottom: '5px' }}>Nombre</label>
                    <input value={etiquetaEdit} onChange={(e) => setEtiquetaEdit(e.target.value)} onBlur={() => void guardarEtiqueta()}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      placeholder="Ventas, Soporte…" maxLength={40}
                      style={{ width: '100%', boxSizing: 'border-box', padding: '8px 11px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13px', outline: 'none' }} />
                    {infoLinea.esDefault
                      ? <div style={{ fontSize: '12px', color: 'var(--dim)', marginTop: '7px' }}>Por default</div>
                      : <button onClick={() => void usarPorDefault()} disabled={busy} style={{ marginTop: '8px', padding: '6px 12px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Usar por default</button>}
                  </div>
                )}

                {/* Recién conectó → preguntar si querés traer las conversaciones. */}
                {pedirSync && (
                  <div style={{ marginTop: '14px', padding: '13px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface-2)', textAlign: 'left' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--ink)' }}>¿Traes tus conversaciones ahora?</div>
                    <div style={{ fontSize: '12px', color: 'var(--dim)', lineHeight: 1.45, marginTop: '3px' }}>Puedes sincronizar los chats que ya tienes en este número, o empezar limpio y que se vayan sumando a medida que escribes/recibes.</div>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <button onClick={() => { setPedirSync(false); void sincronizar(); }} disabled={sincronizando} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 13px', borderRadius: '9px', border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: sincronizando ? 0.6 : 1 }}>{sincronizando ? 'Sincronizando…' : <><IconRefresh size={14} /> Sí, sincronizar</>}</button>
                      <button onClick={() => setPedirSync(false)} style={{ padding: '8px 13px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer' }}>No, empezar limpio</button>
                    </div>
                  </div>
                )}

                {/* Salud del espejo de mensajes: sin esto, "conectado" pero los chats no aparecen. */}
                {wh === 'ok' && <div style={{ marginTop: '12px', fontSize: '12.5px', color: 'var(--good)', fontWeight: 600 }}>Espejo de mensajes: activo</div>}
                {wh && wh !== 'ok' && (
                  <div style={{ marginTop: '14px', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--warn-fill)', background: 'var(--warn-bg)', textAlign: 'left' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--warn)' }}>El espejo de mensajes no está activo</div>
                    <div style={{ fontSize: '12px', color: 'var(--dim)', lineHeight: 1.45, marginTop: '3px' }}>{MIRROR_MSG[wh]}</div>
                    {REPARABLE.includes(wh) && (
                      <button onClick={() => void repararMirror()} disabled={reparando} style={{ marginTop: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '9px', border: 'none', background: 'var(--ink)', color: 'var(--on-ink)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: reparando ? 0.6 : 1 }}>{reparando ? 'Reparando…' : <><IconWrench size={13} /> Reparar espejo</>}</button>
                    )}
                  </div>
                )}

                {/* Sincronizar todo: trae los chats/mensajes de Evolution al espejo
                    A PEDIDO (el inbox no vuelca la agenda entera solo). */}
                <div style={{ marginTop: '16px', padding: '11px 13px', borderRadius: '10px', border: '1px solid var(--border)', background: 'var(--surface-2)', textAlign: 'left' }}>
                  <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'var(--ink)' }}>Sincronizar conversaciones</div>
                  <div style={{ fontSize: '12px', color: 'var(--dim)', lineHeight: 1.45, marginTop: '3px' }}>Trae al inbox los chats que ya tienes en este número. El inbox no baja toda la agenda solo — solo lo que sincronizas o lo que entra/sale desde aquí.</div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '10px' }}>
                    <button onClick={() => void sincronizar()} disabled={sincronizando} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 13px', borderRadius: '9px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: sincronizando ? 0.6 : 1 }}>{sincronizando ? 'Sincronizando…' : <><IconRefresh size={14} /> Sincronizar todo</>}</button>
                    <button onClick={() => void borrarChats()} disabled={borrando} title="Borra TODAS las conversaciones guardadas del inbox (no toca tu WhatsApp)" style={{ padding: '7px 13px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--surface)', color: 'var(--bad)', fontFamily: "'Geist', sans-serif", fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', opacity: borrando ? 0.6 : 1 }}>{borrando ? 'Borrando…' : 'Borrar todo el historial'}</button>
                  </div>
                  {syncMsg && <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--good)', fontWeight: 600 }}>{syncMsg}</div>}
                </div>

                <button onClick={() => void desconectar()} disabled={busy} style={{ marginTop: '16px', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--bad)', background: 'var(--surface)', color: 'var(--bad)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>{busy ? '…' : 'Desconectar'}</button>
              </div>
            ) : caido ? (
              <div>
                <div style={{ fontSize: '34px' }}>⚠️</div>
                <div style={{ fontSize: '15px', fontWeight: 600, color: 'var(--bad)', marginTop: '6px' }}>Evolution no responde</div>
                <div style={{ fontSize: '12.5px', color: 'var(--dim)', marginTop: '4px' }}>El servicio de WhatsApp no oficial no está respondiendo ahora mismo.</div>
                <button onClick={() => void abrir()} disabled={busy} style={{ marginTop: '16px', padding: '9px 16px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: '13.5px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>Reintentar</button>
              </div>
            ) : (
              <div>
                <div style={{ width: '260px', height: '260px', margin: '0 auto', borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {busy && !qr ? (
                    <span style={{ fontSize: '13px', color: 'var(--dim)' }}>Generando QR…</span>
                  ) : qr?.base64 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={qr.base64} alt="QR de WhatsApp" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <span style={{ fontSize: '13px', color: 'var(--faint)' }}>Sin QR</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--faint)', marginTop: '10px' }}>El QR se renueva solo. En cuanto escanees, esta ventana lo detecta.</div>
                <button onClick={() => void abrir()} disabled={busy} style={{ marginTop: '12px', padding: '8px 14px', borderRadius: '10px', border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--dim)', fontFamily: "'Geist', sans-serif", fontSize: '13px', fontWeight: 600, cursor: 'pointer', opacity: busy ? 0.6 : 1 }}>↻ Nuevo QR</button>
              </div>
            )}

            {err && <div style={{ marginTop: '14px', padding: '9px 12px', borderRadius: '9px', border: '1px solid var(--bad)', background: 'var(--bad-bg)', color: 'var(--bad)', fontSize: '13px' }}>{err}</div>}
          </div>
        </div>
      )}
    </>
    );
  }

  return renderNormal();
}
