'use client';

// =============================================================================
// «Nuevo chat» sin modal: abre el chat y MaKo decide dónde va con el primer mensaje (17/10/2026)
// =============================================================================
// Martín (22:50): «Nuevo chat jamás debe abrir un modal, eso es lo más contraintuitivo y contra IA que existe... Que simplemente
// abra el chat y que el usuario al comenzar a escribir la IA vaya entendiendo dónde lo debe colocar, si debe ser un jefe o un
// empleado, qué nombre ponerle, etc.». Antes «Nuevo chat» era un formulario (nombre, cuenta, primer mensaje) y recién después
// había un chat.
//
// Cómo anda: un chat vacío con la caja lista. Con el primer mensaje, `decidirChatNuevoAction` (la IA barata de la plataforma, con
// las reglas de lib/centro-chat-nuevo.ts de respaldo) dice si va a un chat que ya existe, a un empleado nuevo («CRM › Funnels») o
// a un jefe nuevo, y cómo se llama; se muestra arriba del chat y sale solo a los 4 segundos, por el camino firmado de siempre
// (`abrirChat` → mandar.ts → el Runner abre el chat en la PC). Martín puede cambiar el nombre o el lugar en esos segundos (tocando
// la cabecera o «Cambiar»), pero nunca está obligado: no se le pregunta nada.
// ⚠️ Lo usan la computadora (`ChatNuevoCentro`, un panel) y el teléfono (HojaChatNuevo en ChatsMovil.tsx): UNA lógica. Las piezas
// que se dibujan están en ChatNuevoPiezas.tsx (sin este motor, que habla con el servidor).
// ⚠️ UNA NOTA DE VOZ COMO PRIMER MENSAJE SALE EN EL ACTO (28/10/2026, «que se pueda utilizar el chat de la misma manera en todos
//    lados»): se ve y se escucha ya, con «Pasando tu nota a texto…», y con el texto MaKo decide dónde va, como con lo escrito
//    (`mandarNota`). Antes la caja la transcribía adentro y recién después salía. Si se sale del chat nuevo antes de que
//    salga, no sale (como lo escrito: la decisión se ve y se puede cambiar sólo acá).
// ⚠️ LOS ARCHIVOS DEL PRIMER MENSAJE VAN CON ÉL (28/10/2026): la caja es la ÚNICA (CajaChat, ChatNuevoPiezas.tsx) y lo adjuntado
//    viaja firmado con el mensaje: a un chat que ya existe, como desde su caja (`mandarTextoA`); a uno nuevo, en el trabajo que
//    lo abre, y la PC los baja antes de abrirlo (cartero 1.22.0, `abrirChat`). Sin un Runner 1.22.0 la caja no ofrece adjuntar.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Icon } from '@/app/_components/icons';
import type { AdjuntoCaja, Centro } from './useCentro';
import type { AdjuntosDeCaja } from './AdjuntosCaja';
import { TEXTO_SOLO_ADJUNTOS } from '@/lib/centro-caja';
import { decidirChatNuevoAction } from './acciones';
import { cuentaParaChatNuevo, decisionConNombre, decisionPorReglas, limpiarNombre, type DecisionChatNuevo } from '@/lib/centro-chat-nuevo';
import { CUENTAS_TERMINAL, comandoNuevoChat } from '@/lib/runner';
import { claveDeNombre } from '@/lib/centro-chats';
import { usoDeCuenta } from '@/lib/centro-uso';
import { CriaturaChatNuevo, CuerpoChatNuevo, TituloChatNuevo, type FaseChatNuevo } from './ChatNuevoPiezas';
import { CajaChatNuevo } from './CajaChatNuevo';
import { prepararNota } from '@/app/_chat/preparar-nota';
import type { GrabacionLista } from '@/app/_chat/nota-que-se-manda';

/** Cuánto se espera, con la decisión a la vista, antes de mandar: lo que tiene Martín para cambiarla. */
export const ESPERA_PARA_CAMBIAR_MS = 4000;

/** La caja del chat nuevo no es de ningún chat de la lista: lo adjuntado vive en el motor (useCentro.ts) con esta clave, que
 *  ningún chat tiene (las de la lista son `nombre:…` o una sesión). Sin dirección, no se guarda como borrador. */
export const CLAVE_CHAT_NUEVO = ':chat-nuevo';

export function useChatNuevo(k: Centro, onAbrir: (clave: string) => void) {
  const [texto, setTexto] = useState('');
  const [enviado, setEnviado] = useState<string | null>(null);
  const [fase, setFase] = useState<FaseChatNuevo>('escribiendo');
  const [decision, setDecision] = useState<DecisionChatNuevo | null>(null);
  const [editando, setEditando] = useState<{ texto: string; error: string | null } | null>(null);
  /** La nota de voz del primer mensaje (se escucha arriba de su texto) y por qué no se entendió. */
  const [nota, setNota] = useState<{ url: string; secs: number } | null>(null);
  const [errorNota, setErrorNota] = useState<string | null>(null);
  /** Los archivos del primer mensaje, ya mandado: se ven en su burbuja y vuelven a salir con «Reintentar». */
  const [archivos, setArchivos] = useState<AdjuntoCaja[]>([]);
  const caja = useRef<HTMLTextAreaElement | null>(null);
  const contexto = () => ({ tabs: k.tabs, chats: k.chats.map((c) => ({ clave: c.clave, titulo: c.titulo })) });
  const enLaCaja = k.adjuntosDe(CLAVE_CHAT_NUEVO);
  /** Lo adjuntado pasa de la caja al mensaje, con sus propias vistas previas (vaciar la caja suelta las suyas). */
  const tomarArchivos = (): AdjuntoCaja[] => {
    const xs = enLaCaja.map((a) => ({ ...a, url: URL.createObjectURL(a.file) }));
    k.vaciarAdjuntos(CLAVE_CHAT_NUEVO);
    setArchivos(xs);
    return xs;
  };
  /** Lo tomado vuelve a la caja (la nota que no se entendió) con vistas previas NUEVAS: si se salió del chat nuevo mientras la
   *  nota se pasaba a texto, al desmontar se revocaron las suyas y la miniatura volvía rota (la verificación de tren-t). */
  const devolverArchivos = (xs: AdjuntoCaja[]) => {
    for (const a of xs) URL.revokeObjectURL(a.url);
    k.devolverAdjuntos(CLAVE_CHAT_NUEVO, xs.map((a) => ({ ...a, url: URL.createObjectURL(a.file) })));
    setArchivos([]);
  };
  const vistas = useRef<AdjuntoCaja[]>([]);
  vistas.current = archivos;
  useEffect(() => () => { for (const a of vistas.current) URL.revokeObjectURL(a.url); }, []);

  /** MaKo decide dónde va el primer mensaje. */
  async function decidir(t: string) {
    const r = await decidirChatNuevoAction(t, contexto().chats).catch(() => null);
    setDecision(r?.ok ? r.decision : decisionPorReglas(t, contexto()));
    setFase('confirmando');
  }

  /** El primer mensaje, escrito (o sólo lo adjuntado): con los archivos MaKo decide por sus nombres. */
  async function mandar() {
    const t = texto.trim();
    if ((!t && !enLaCaja.length) || fase !== 'escribiendo') return;
    const nombres = tomarArchivos().map((a) => a.file.name);
    setEnviado(t || TEXTO_SOLO_ADJUNTOS);
    setTexto('');
    setFase('decidiendo');
    await decidir(t || `${TEXTO_SOLO_ADJUNTOS} ${nombres.join(', ')}`);
  }

  /** El primer mensaje, una nota de voz: se ve ya, se pasa a texto por detrás y con eso MaKo decide. Lo escrito queda en la
   *  caja. Lo adjuntado sale con la nota y se toma de la caja YA, antes de pasarla a texto (revisión de 0453923ab): tomado
   *  después, con la lista del dibujo en que arrancó, salía firmado lo que se había quitado en esos segundos y se borraba lo
   *  que se había sumado. Si la nota no se entendió, vuelve a la caja. */
  async function mandarNota(g: GrabacionLista) {
    if (fase !== 'escribiendo') return;
    const tomados = tomarArchivos();
    const voz = { url: URL.createObjectURL(g.audio), secs: g.segundos };
    setNota(voz);
    setErrorNota(null);
    setFase('pasando');
    const r = await prepararNota(g.audio);
    if ('error' in r) {
      URL.revokeObjectURL(voz.url);
      setNota(null);
      setErrorNota(r.error);
      devolverArchivos(tomados);
      setFase('escribiendo');
      return;
    }
    setEnviado(r.texto);
    setFase('decidiendo');
    await decidir(r.texto);
  }

  /** Sale por el camino firmado: a un chat que ya existe, o abriendo uno nuevo en la PC. Con sus archivos, si los trae. */
  async function salir(d: DecisionChatNuevo) {
    if (!enviado) return;
    const fs = archivos.map((a) => a.file);
    setFase('saliendo');
    if (d.accion === 'existente') {
      const c = k.chats.find((x) => x.clave === d.clave);
      if (c) {
        if (await k.mandarTextoA(c, enviado, fs)) { onAbrir(c.clave); return; }
        setFase('fallo');
        return;
      }
      // El chat ya no está en la lista: se abre como nuevo con ese nombre.
    }
    // Con archivos, la cuenta cuyo Runner los lleva a un chat nuevo (1.22.0); si ninguna, `abrirChat` dice por qué no salió.
    const abren = CUENTAS_TERMINAL.filter((c) => k.puedeAbrirEn(c));
    const conArchivos = fs.length ? abren.filter((c) => k.adjuntaEnNuevo(c)) : abren;
    const cuenta = cuentaParaChatNuevo(conArchivos.length ? conArchivos : abren, (c) => usoDeCuenta(k.carteros.find((x) => x.cuenta === c)?.cuota ?? null, k.ahora).semana?.pct ?? null);
    if (!cuenta) { setFase('sin_forma'); return; }
    setFase((await k.abrirChat({ nombre: d.nombre, cuenta, texto: enviado, archivos: fs })) ? 'abriendo' : 'fallo');
  }
  const salirRef = useRef(salir);
  salirRef.current = salir;

  // Con la decisión a la vista y sin que Martín toque nada, sale sola.
  useEffect(() => {
    if (fase !== 'confirmando' || editando || !decision) return;
    const t = window.setTimeout(() => { void salirRef.current(decision); }, ESPERA_PARA_CAMBIAR_MS);
    return () => window.clearTimeout(t);
  }, [fase, editando, decision]);

  // Abriéndose: cuando el chat aparece en la lista, se abre.
  useEffect(() => {
    if (fase !== 'abriendo' || !decision) return;
    const c = k.chats.find((x) => claveDeNombre(x.titulo) === claveDeNombre(decision.nombre));
    if (c) onAbrir(c.clave);
  }, [fase, k.chats, decision, onAbrir]);

  // La caja lista para escribir.
  useEffect(() => { caja.current?.focus({ preventScroll: true }); }, []);

  const puedeCambiar = !!decision && (fase === 'confirmando' || fase === 'fallo');
  // Lo adjuntado en la caja, como en la de cualquier chat del Centro (el «+», pegar y arrastrar). Los topes grandes: un Runner
  // que lleva archivos a un chat nuevo (1.22.0) también los baja grandes (1.16.0).
  const adjuntos: AdjuntosDeCaja = {
    items: enLaCaja, puede: k.adjuntaEnNuevo(),
    onSumar: (fs) => void k.sumarAdjuntos(CLAVE_CHAT_NUEVO, fs, true), onQuitar: (id) => k.quitarAdjunto(CLAVE_CHAT_NUEVO, id),
    onNoPuede: k.sinAdjuntos, onSinImagen: k.sinImagen,
  };
  return {
    texto, setTexto, enviado, fase, decision, editando, caja, puedeCambiar, nota, errorNota, adjuntos, archivos,
    apertura: k.apertura, copiarConAviso: k.copiarConAviso,
    mandar, mandarNota: (g: GrabacionLista) => { void mandarNota(g); },
    reintentar: () => { if (decision) void salir(decision); },
    cambiar: () => { if (decision && puedeCambiar) setEditando({ texto: decision.nombre, error: null }); },
    escribirNombre: (t: string) => setEditando({ texto: t, error: null }),
    dejar: () => setEditando(null),
    /** El nombre que escribió Martín: si ya hay un chat así va a él; si lleva «›» es un empleado; si no, un jefe. */
    aceptarNombre: () => {
      if (!editando) return;
      const nombre = limpiarNombre(editando.texto);
      if (!nombre) { setEditando({ ...editando, error: 'Sólo letras y números' }); return; }
      const d = decisionConNombre(nombre, contexto());
      setDecision(d);
      setEditando(null);
      void salir(d);
    },
    comandoParaCopiar: () => (decision ? comandoNuevoChat(CUENTAS_TERMINAL[0], decision.nombre) : ''),
  };
}

/** El chat nuevo de la computadora: un panel como el de cualquier chat, con su cabecera, su conversación y su caja. */
export function ChatNuevoCentro({ centro: k, onAbrir, onVolver, gurus }: {
  centro: Centro; onAbrir: (clave: string) => void; onVolver: () => void;
  /** Los gurús (3/11/2026), debajo de la portada: abren un chat con MaKo y no uno de Claude Code. */
  gurus?: ReactNode;
}) {
  const n = useChatNuevo(k, onAbrir);
  return (
    <section className="co-panel" aria-label="Nuevo chat">
      <header className="co-cab">
        <button type="button" className="co-acceso co-cab__volver" style={{ width: 'auto' }} onClick={onVolver} aria-label="Volver a los chats">
          <span style={{ display: 'inline-flex', transform: 'rotate(90deg)' }}><Icon name="chevron" size={18} /></span>
        </button>
        <span className="co-cab__muneco"><CriaturaChatNuevo n={n} /></span>
        <div className="co-cab__texto"><h1 className="co-cab__titulo"><TituloChatNuevo n={n} /></h1></div>
      </header>
      <div className="co-cuerpo">
        <div className="co-conv">
          <div className="co-hilo"><div className="co-hilo__col"><CuerpoChatNuevo n={n} alPie={gurus} /></div></div>
          <CajaChatNuevo n={n} />
        </div>
      </div>
    </section>
  );
}
