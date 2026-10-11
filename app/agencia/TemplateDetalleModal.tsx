'use client';

// =============================================================================
// TemplateDetalleModal — detalle + edición + CRUD de una plantilla de aviso
// =============================================================================
// Cubre TODO el chat (inline). Explica CUÁNDO se dispara (diagrama), deja EDITAR
// la referencia, ACTIVAR/DESACTIVAR, ELIMINAR y CREAR. La referencia NO es un
// molde: "Probar con IA" muestra cómo MaKo la adapta con datos reales.

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Dropdown } from '../components/Dropdown';
import { FlujoAviso } from './FlujoAviso';
import { PrefsDeMensaje } from '../perfil/PrefsDeMensaje';
import { Confirm } from '@/app/_ui/Confirm';
import { type as tipo } from '@/app/_ui/tokens';
import { CATEGORIAS_AVISO, esAvisoDelCliente, seEditaElTexto, type AvisoCatalogo, type CategoriaAviso } from '@/lib/avisos-catalogo';
import { IconoMenu } from '@/app/_ui/iconos-menu';
import { ICONO_CATEGORIA } from './categoria-icono';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import type { Muelles } from '@/lib/lienzo-grafo';
import { canalesDeMensaje, claveDeReporte } from '@/lib/mensaje-canales';

// El tipo NO se copia: se re-exporta del store, que es quien lo define. Escrito a
// mano acá se quedo viejo al primer campo nuevo (`canales`) y el compilador no podia
// decir nada, porque las dos formas seguian siendo validas por separado. `import type`
// se borra en compilacion, asi que traerlo de un modulo `server-only` no baja una sola
// linea al navegador.
// Un `export ... from` no crea binding local y el propio archivo deja de compilar:
// van los dos, el import y el re-export.
import type { PlantillaVista } from '@/lib/plantillas';
export type { PlantillaVista };

const ORDEN = CATEGORIAS_AVISO;
const LABEL: Record<CategoriaAviso, string> = { reporte: 'Reporte', aviso: 'Aviso', accion: 'Acción', pregunta: 'Pregunta' };
const btn: CSSProperties = { padding: '9px 16px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' };
const btnGhost: CSSProperties = { ...btn, background: 'transparent', color: 'var(--dim)', border: '1px solid var(--border-strong)' };
/** Las tarjetas del chrome FLOTANTE: fondo propio para leerse sobre el punteado
 *  del lienzo, y el mismo radio que el resto de la casa. */
const tarjetaChrome: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11,
  padding: '7px 12px', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
};
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 9, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontSize: 13.5, fontFamily: "'Geist', sans-serif", outline: 'none' };

/**
 * El endpoint entra por parámetro porque esta misma pantalla sirve a DOS dueños:
 * el super-admin de la agencia (`/api/admin/plantillas`) y el admin de un
 * workspace desde Configuraciones › Notificaciones (`/api/perfil/plantillas`).
 * Mismo protocolo, distinto guard — copiar el componente para cambiar una URL
 * dejaría dos pantallas que divergen en la primera edición.
 */
/** El endpoint del super-admin. Quien no lo usa, es un cliente en su propia tab. */
const ENDPOINT_AGENCIA = '/api/admin/plantillas';

async function api(endpoint: string, body: unknown): Promise<{ ok: boolean; error?: string; plantilla?: PlantillaVista; texto?: string; borrada?: boolean }> {
  try { return await (await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json(); } catch { return { ok: false }; }
}

/**
 * ⚠️ `alto` y `marco` existen porque este panel se monta en DOS sitios con forma
 * distinta: como panel derecho del chat de /mensajes (una tarjeta de 620 con su
 * borde) y adentro de la celda de la bandeja de email, donde el borde y el radio
 * ya los pone la caja de afuera — una tarjeta adentro de otra deja doble marco y
 * scroll anidado. Son dos props y no un `embebido` porque son dos decisiones: el
 * alto lo manda la fila del grid, y el marco, quién lo dibuja.
 */
export function TemplateDetalleModal({ plantilla, onClose, onCambio, onVerChat, onEliminar, endpoint = ENDPOINT_AGENCIA, alto = 620, marco = true, insetIzq, muelles }: {
  plantilla: PlantillaVista | null; onClose: () => void; onCambio?: () => void;
  /**
   * Abre la vista de PROBAR (el chat). Opcional a propósito: el que no la implementa
   * NO DIBUJA EL BOTÓN, que es la regla de la casa para un componente compartido —
   * mostrarlo sin poder usarlo se lee como que la app está rota. Hoy lo pasa
   * `PlantillasView`; `BandejaEmail` no, porque ahí el chat de WhatsApp no es la
   * preview de nada.
   */
  onVerChat?: () => void;
  /**
   * EL TACHO LO RESUELVE QUIEN MONTA (novena tanda, 10/10/2026). En /automations, «Eliminar» un mensaje es el
   * MISMO del «⋯» de su fila: pregunta con la confirmación de la casa y OCULTA (se recupera), por paridad con
   * la automatización, que archiva. Ausente = lo de siempre: el tacho borra acá mismo (/mensajes, el
   * catálogo de la agencia, y la bandeja de correo, cuya ruta también oculta).
   */
  onEliminar?: () => void;
  endpoint?: string;
  alto?: number | string; marco?: boolean;
  /**
   * Lo que tapa una pieza apoyada sobre el borde IZQUIERDO del lienzo: la lista de /automations, que
   * desde la quinta tanda (punto 5) monta este mismo detalle para los Mensajes de MaKo. Va directo
   * al `insetIzq` del lienzo (chrome, zoom, panel del nodo y encuadre: AGENTS.md, «Apoyar algo
   * sobre el borde de un lienzo son CUATRO lugares»). Es un NÚMERO y no un flag `embebido`: cuánto
   * tapa lo decide quien apoya la pieza (`muelles`), no este componente. Ausente = 0, como siempre.
   */
  insetIzq?: number;
  /**
   * DÓNDE FLOTA CADA COSA en /automations (`muelles`, lib/lienzo-grafo.ts): con esto el panel de cada tarjeta
   * tiene el tamaño de una automatización (`editorDeTarjeta`) y no los 460 px fijos de Configuraciones.
   * Llega desde la lista (SimuladorWhatsApp → MensajeMakoLienzo). Ausente = como siempre.
   */
  muelles?: Muelles | null;
}) {
  const crear = plantilla === null;
  const [titulo, setTitulo] = useState(plantilla?.titulo ?? '');
  const [categoria, setCategoria] = useState<CategoriaAviso>(plantilla?.categoria ?? 'aviso');
  const [requiereResp, setRequiereResp] = useState(plantilla?.requiereRespuesta ?? false);
  /**
   * SE EDITA EL BORRADOR, SE COMPARA CONTRA LO PUBLICADO.
   *
   * `texto` es lo que se está escribiendo y arranca del borrador si había uno:
   * «siempre que me salgo de la vista, de la manera que sea, se guarde como
   * borrador, que no se pierda nada». `orig` es lo que MaKo manda HOY, y la
   * diferencia entre los dos es lo único que decide si hay algo sin publicar —
   * nunca un flag aparte, que se queda viejo en cuanto alguien deshace a mano lo
   * que había escrito.
   */
  const [texto, setTexto] = useState(plantilla?.borrador ?? plantilla?.ejemplo ?? '');
  const [orig, setOrig] = useState(plantilla?.ejemplo ?? '');
  /**
   * EL ASUNTO DEL EMAIL. Sembrado de props como los otros cinco — y por eso el
   * `key={…}` del editor en PlantillasView es obligatorio: un `useState(props.x)` no se
   * resiembra, y con la vista de editar por default este componente ya no se desmonta al
   * cambiar de mensaje.
   */
  const [asunto, setAsunto] = useState(plantilla?.asunto ?? '');
  const [editandoTitulo, setEditandoTitulo] = useState(false);
  const [preguntandoSalida, setPreguntandoSalida] = useState(false);
  const [enabled, setEnabled] = useState(plantilla?.enabled ?? true);
  /**
   * ⚠️ EL INTERRUPTOR Y EL NOMBRE SE RESIEMBRAN DE LAS PROPS (novena tanda, 10/10/2026). El «⋯» de la fila en
   * /automations pausa o activa el mensaje SIN remontar este detalle (misma `key`), y el `useState` de arriba
   * se siembra una sola vez: el interruptor del pie seguía diciendo lo de antes (AGENTS.md, «Un `useState`
   * sembrado de props no se resiembra»). Es el patrón de la automatización (SecuenciaPerfil, `activaVista`):
   * un ajuste de estado AL DIBUJAR, no un efecto, así el interruptor cambia en el mismo pintado que la lista.
   * El nombre, igual —salvo mientras se está escribiendo: no se le pisa a nadie lo que tipea—.
   */
  const [enabledVisto, setEnabledVisto] = useState(plantilla?.enabled);
  if (plantilla && plantilla.enabled !== enabledVisto) { setEnabledVisto(plantilla.enabled); setEnabled(plantilla.enabled); }
  const [tituloVisto, setTituloVisto] = useState(plantilla?.titulo);
  if (plantilla && plantilla.titulo !== tituloVisto) { setTituloVisto(plantilla.titulo); if (!editandoTitulo) setTitulo(plantilla.titulo); }
  const [prueba, setPrueba] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [flash, setFlash] = useState<{ txt: string; mal: boolean } | null>(null);

  // ⚠️ EL ERROR NO PUEDE SALIR EN VERDE. Esto servía a las dos cosas y el span de
  // abajo estaba cableado a `var(--good)`, así que el 403 de un aviso que MaKo
  // redacta se leía como un guardado. Un rechazo pintado de «hecho» es peor que
  // ninguno: nadie vuelve a mirar.
  const flashOk = (m: string) => { setFlash({ txt: m, mal: false }); setTimeout(() => setFlash(null), 2200); };
  const flashMal = (m: string) => { setFlash({ txt: m, mal: true }); setTimeout(() => setFlash(null), 4000); };
  const id = plantilla?.id;
  /**
   * POR DÓNDE SALE DE VERDAD. Un REPORTE (horario, diario, semanal) sale por lo que dicen las preferencias
   * de notificaciones (`notification_prefs`), no por los canales de su plantilla: el lienzo del reporte
   * semanal dibujaba la tarjeta de WhatsApp (el default de la plantilla) y no la de Email, que es por donde
   * sale (revisión del ws9, 10/10/2026). La pregunta la contesta UNA función, `canalesDeMensaje`, la misma
   * que usa la bandeja de correo. Mientras las preferencias no llegan, los de la plantilla.
   */
  const [prefs, setPrefs] = useState<Parameters<typeof canalesDeMensaje>[2]>(null);
  const esReporte = !!(id && claveDeReporte(id));
  useEffect(() => {
    if (!esReporte) return;
    let vivo = true;
    void fetch('/api/perfil').then((r) => r.json()).catch(() => null).then((jp) => { if (vivo && jp?.ok) setPrefs(jp.prefs); });
    return () => { vivo = false; };
  }, [esReporte]);
  const canales = canalesDeMensaje(id ?? '', plantilla, prefs);
  const sinPublicar = !crear && texto !== orig;

  // El POST del borrador con un respiro: uno por tecla serían sesenta por segundo.
  // Los refs son para el cierre — el `useEffect` de desmonte se crea una vez y no
  // puede leer el `texto` de un render futuro.
  const timerBorrador = useRef<ReturnType<typeof setTimeout> | null>(null);
  /**
   * ⚠️ LO ÚLTIMO QUE SE GUARDÓ, que NO es lo publicado. Al salir se mandaba el borrador
   * cuando `texto !== orig`, y `orig` es el texto PUBLICADO: para cualquier mensaje que
   * ya tenga un borrador, esa comparación es verdadera desde el primer render, así que
   * ABRIR la pantalla escribía en la base sin que nadie tipeara una letra. Medido el
   * 05/10/2026: un POST de 1.085 ms por cada clic en la lista, y uno al cargar — en el
   * ws1 el mensaje que se abre por defecto tiene borrador, así que pasaba siempre.
   *
   * La pregunta correcta es «¿cambió desde lo último que guardé?», y eso arranca en el
   * borrador que vino del server (o en el publicado, si no había ninguno).
   */
  const guardado = useRef(plantilla?.borrador ?? plantilla?.ejemplo ?? '');
  const ultimo = useRef({ texto, id, endpoint });
  ultimo.current = { texto, id, endpoint };

  const mandarBorrador = (v: string) => {
    if (!id || v === guardado.current) return;   // nada cambió: no hay nada que escribir
    guardado.current = v;
    void api(endpoint, { action: 'borrador', id, texto: v });
  };

  /** Lo que llama el editor en cada tecla: pinta ya y guarda con retraso. */
  const escribir = (v: string) => {
    setTexto(v);
    if (timerBorrador.current) clearTimeout(timerBorrador.current);
    timerBorrador.current = setTimeout(() => mandarBorrador(v), 900);
  };

  /**
   * ⚠️ SALIR DE LA VISTA GUARDA, POR LOS DOS CAMINOS QUE SE PUEDEN VER.
   *
   * El desmonte cubre cerrar el detalle o cambiar de mensaje; `visibilitychange`
   * cubre cambiar de pestaña y cerrar el navegador, donde el desmonte no corre.
   * Lo que NO se cubre es matar el proceso — para eso están los 900 ms del
   * debounce, que es la ventana real de pérdida.
   */
  useEffect(() => {
    const vaciar = () => {
      const u = ultimo.current;
      if (timerBorrador.current) { clearTimeout(timerBorrador.current); timerBorrador.current = null; }
      if (u.id && u.texto !== guardado.current) {
        guardado.current = u.texto;
        void api(u.endpoint, { action: 'borrador', id: u.id, texto: u.texto });
      }
    };
    const alEsconder = () => { if (document.visibilityState === 'hidden') vaciar(); };
    document.addEventListener('visibilitychange', alEsconder);
    return () => { document.removeEventListener('visibilitychange', alEsconder); vaciar(); };
  }, []);
  // ⚠️ EL MISMO CORTE QUE HACE EL SERVER, para no ofrecer un editor que va a
  // contestar 403. El que decide sigue siendo la ruta —esconder el campo no
  // protege nada— pero un textarea que rechaza todo lo que se escriba es peor que
  // no tenerlo: se lee como que la app está rota, no como que no te corresponde.
  const puedeEditarTexto = endpoint === ENDPOINT_AGENCIA || (id != null && esAvisoDelCliente(id));
  // ⚠️ Y EL TEXTO DE UN AVISO DEL CLIENTE CUYO TEXTO ARMA EL CÓDIGO TAMPOCO (sexta tanda, 09/10/2026):
  // el guardado no sale nunca (`textoDelCodigo`, lib/avisos-catalogo.ts). Es OTRA pregunta que la de
  // arriba: el flujo de ese aviso (su CRON por evento, sus pasos) sigue siendo del cliente y sigue
  // editable; lo que no se ofrece es escribir un mensaje que nadie manda. La pregunta es la MISMA que
  // hace la ruta (`seEditaElTexto`). La agencia sigue editando todo en /mensajes: lo decide Martín.
  const puedeEditarElMensaje = endpoint === ENDPOINT_AGENCIA || (id != null && seEditaElTexto(id));

  // ⚠️ El `else` no es decoración: la ruta del cliente contesta 403 para todo aviso
  // que redacta MaKo, y sin esta rama «Guardar» no decía NADA — el síntoma exacto que
  // esta pantalla viene arrastrando desde el primer reporte del cliente.
  /**
   * PUBLICAR = lo escrito pasa a ser lo que MaKo manda.
   *
   * ⚠️ El borrador se manda ANTES y sin el debounce: `publicar` promueve lo que
   * está GUARDADO, así que sin este paso se publicaría el texto de hace un
   * segundo. Es el mismo modo de falla de siempre — nada da error y sale la
   * versión anterior.
   */
  const publicar = async (): Promise<boolean> => {
    if (!id) return false;
    setBusy('pub');
    if (timerBorrador.current) { clearTimeout(timerBorrador.current); timerBorrador.current = null; }
    const g = await api(endpoint, { action: 'borrador', id, texto });
    if (!g.ok) { flashMal(g.error || 'No se pudo guardar'); setBusy(null); return false; }
    const r = await api(endpoint, { action: 'publicar', id });
    if (r.ok) { setOrig(texto); flashOk('Publicado ✓'); onCambio?.(); }
    else flashMal(r.error || 'No se pudo publicar');
    setBusy(null);
    return Boolean(r.ok);
  };

  /** La X y el Escape: si hay algo sin publicar, se pregunta antes de irse. */
  const intentarCerrar = () => { if (sinPublicar) setPreguntandoSalida(true); else onClose(); };

  const guardarTitulo = async () => {
    setEditandoTitulo(false);
    const t = titulo.trim();
    if (!id || !t || t === plantilla?.titulo) { setTitulo(plantilla?.titulo ?? ''); return; }
    const r = await api(endpoint, { action: 'titulo', id, titulo: t });
    if (r.ok) onCambio?.();
    else { flashMal(r.error || 'No se pudo cambiar el nombre'); setTitulo(plantilla?.titulo ?? ''); }
  };

  /**
   * El asunto se guarda al SALIR del campo, no en cada tecla: son 160 caracteres y
   * escribir en la base a mitad de una palabra deja «Tu reporte de la sem» en la bandeja
   * de alguien si el aviso sale en ese segundo. Vacío es un valor válido —«usá el
   * título»— así que no hay guard de «no mandes vacío».
   */
  const guardarAsunto = async () => {
    const a = asunto.trim();
    if (!id || a === (plantilla?.asunto ?? '')) return;
    const r = await api(endpoint, { action: 'asunto', id, asunto: a });
    if (r.ok) { flashOk(a ? 'Asunto guardado ✓' : 'Vuelve a usar el título ✓'); onCambio?.(); }
    else { flashMal(r.error || 'No se pudo guardar el asunto'); setAsunto(plantilla?.asunto ?? ''); }
  };

  const guardarCategoria = async (c: CategoriaAviso) => {
    setCategoria(c);
    if (!id) return;
    const r = await api(endpoint, { action: 'categoria', id, categoria: c });
    if (r.ok) onCambio?.();
    else { flashMal(r.error || 'No se pudo cambiar la categoría'); setCategoria(plantilla?.categoria ?? 'aviso'); }
  };
  const toggle = async () => { if (!id) return; setBusy('toggle'); const r = await api(endpoint, { action: 'enabled', id, enabled: !enabled }); if (r.ok) { setEnabled(!enabled); flashOk(!enabled ? 'Activada ✓' : 'Desactivada ✓'); onCambio?.(); } setBusy(null); };
  const eliminar = async () => {
    if (!id) return;
    // En /automations lo resuelve la lista: la misma confirmación y el mismo «ocultar» que el «⋯» (`onEliminar`).
    if (onEliminar) { onEliminar(); return; }
    setBusy('del'); const r = await api(endpoint, { action: 'borrar', id }); if (r.ok) { onCambio?.(); onClose(); } setBusy(null);
  };
  /**
   * ⚠️ EL `contexto` YA ESTABA ACEPTADO EN LAS DOS RUTAS Y NADIE LO MANDABA NUNCA.
   * Medido: cero ocurrencias de «contexto» en app/agencia/. Sin él la ruta caía a
   * «Usa datos de ejemplo realistas», que es exactamente lo que el dueño reportó:
   * «si lo escribe MaKo, debería primero preguntar QUÉ escribir, si no no tiene
   * contexto sobre qué escribir». Era un campo que faltaba del lado del cliente, no
   * una capacidad que faltara del lado del server.
   */
  const probar = async (contexto?: string) => {
    if (!id) return;
    setBusy('probar');
    const r = await api(endpoint, { action: 'probar', id, contexto: contexto?.trim() || undefined });
    if (r.ok && r.texto) setPrueba(r.texto);
    setBusy(null);
  };
  const crearNueva = async () => {
    setBusy('crear');
    const r = await api(endpoint, { action: 'crear', titulo, categoria, requiereRespuesta: requiereResp, texto });
    if (r.ok) { onCambio?.(); onClose(); }
    setBusy(null);
  };

  return (
    <div style={{ height: alto, width: '100%', background: 'var(--surface)', border: marco ? '1px solid var(--border)' : 'none', borderRadius: marco ? 16 : 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {crear ? (
        <>
          <div style={{ flex: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
            <button onClick={onClose} title="Cerrar el editor" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', fontSize: 14, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>← Cerrar el editor</button>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 24 }}>
            <div style={{ maxWidth: 560 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--ink)', marginBottom: 16 }}>Nueva plantilla</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Título (ej. Recordar renovación)" style={inp} />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Dropdown value={categoria} onChange={(v) => setCategoria(v as CategoriaAviso)} width={180} ariaLabel="Categoría" options={ORDEN.map((k) => ({ value: k, label: LABEL[k], icono: ICONO_CATEGORIA[k] }))} />
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 13, color: 'var(--dim)', cursor: 'pointer' }}>
                    <input type="checkbox" checked={requiereResp} onChange={(e) => setRequiereResp(e.target.checked)} /> Espera respuesta
                  </label>
                </div>
                <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={6} placeholder="Referencia del mensaje (MaKo la adapta con datos reales)…" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
                <button onClick={crearNueva} disabled={busy === 'crear' || !titulo.trim()} style={{ ...btn, opacity: busy === 'crear' || !titulo.trim() ? 0.5 : 1 }}>Crear plantilla</button>
              </div>
            </div>
          </div>
        </>
      ) : plantilla && id ? (
        /* ⚠️ EL LIENZO ES EL RECUADRO. Pedido textual: «cuando le doy a editar, el
           lienzo tiene que ocupar absolutamente todo el recuadro, incluso donde dice
           «cerrar el editor», de lo contrario se ve muy chico».

           Antes eran topbar + cabecera + lienzo + pie, y entre las tres le comían ~180
           px de 620: el dibujo entraba al 33% y las tarjetas eran del tamaño de una
           uña. Ahora todo eso FLOTA encima, incluido «Guardar» — que además asomaba
           por detrás del dibujo: «hay un botón azul detrás del lienzo, no tiene
           sentido». */
        <FlujoAviso
          id={id}
          insetIzq={insetIzq}
          muelles={muelles}
          disparador={plantilla.disparador}
          frecuenciaMin={plantilla.frecuenciaMin}
          texto={texto}
          canales={canales}
          asunto={asunto} onAsunto={setAsunto} onAsuntoGuardar={() => void guardarAsunto()}
          tituloMensaje={titulo || plantilla.titulo}
          aporta={plantilla.aporta ?? []}
          posiciones={plantilla.posiciones}
          endpoint={endpoint}
          editable={puedeEditarTexto}
          textoEditable={puedeEditarElMensaje}
          guardando={busy === 'pub'}
          onTexto={escribir}
          onCambio={onCambio}
          probando={busy === 'probar'}
          prueba={prueba}
          onProbar={probar}
          /* ⚠️ EL TÍTULO A LA IZQUIERDA Y LOS CONTROLES A LA DERECHA, con la salida
             en el extremo. Antes era una fila de tarjetitas en el orden en que se
             fueron escribiendo —cerrar, título, activa, guardar—, que es el orden de
             nadie. Pedido textual: «el título de la automatización bien a la
             izquierda, arriba», «el botón de Activa debería estar arriba a la derecha»
             y «a la derecha del todo debería estar la X de cerrar». */
          chrome={(
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                {/**
                  * ⚠️ EL ANCHO ES FIJO, Y NO ES UN DETALLE: es lo que hace que subir la
                  * tipografía no empeore otra cosa. Con `maxWidth` el ancho lo decide el
                  * contenido, y en modo edición el contenido es un `<input>`, que NO mide
                  * su texto — mide `size=20 × el avance del «0»` de la fuente activa. La
                  * tarjeta encogía 84 px al hacer click, y con el título más grande serían
                  * 96. Fijándolo, los dos estados miden lo mismo.
                  */}
                <div style={{ ...tarjetaChrome, minWidth: 0, width: 420 }}>
                  {/* ⚠️ LA CATEGORÍA ES UN EMOJI ANTES DEL TÍTULO, Y SIGUE SIENDO EL ÚNICO
                      CONTROL QUE LA ESCRIBE. Pedido el 04/10/2026: «esos botones de
                      categoría deberían ser un simple emoji antes del título, para que se
                      entienda de qué se trata, pero que no se confunda con algo útil
                      dentro de la secuencia» — el desplegable de 168 px debajo del título
                      se leía como un paso del lienzo.

                      Lo que NO se podía hacer es dejarla de sólo lectura: `guardarCategoria`
                      es el único escritor de `categoria` en toda la app (el otro Dropdown,
                      el del alta, sólo la elige al crear), y la categoría es dato de MOTOR,
                      no un rótulo — `lib/avisos-agrupables.ts` declara que un `accion` o un
                      `pregunta` NUNCA se posponen al resumen diario, y el comentario de ahí
                      dice que cuando se pospuso «ya pasó una vez y duplicó dos tareas». Así
                      que el emoji ES el control: se clickea y abre el mismo desplegable.
                      El `Dropdown` lo ancla en un portal, así que no ocupa lugar en la fila. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    {/* ⚠️ SIN `width`. Con `width={168}` el emoji ocupaba 168 px —el
                        Dropdown se lo pone al BOTÓN, no al menú— y empujaba el título
                        medio ancho de tarjeta a la derecha, cortándolo con «…». El menú
                        se dimensiona solo (`width: max-content` + `minWidth` del botón),
                        así que sacarlo no lo achica. Reportado con captura: «mira como se
                        ve el título de cortado, tiene que estar pegado el emoji». */}
                    <div style={{ flex: 'none', display: 'flex' }}>
                      <Dropdown value={categoria} onChange={(v) => void guardarCategoria(v as CategoriaAviso)}
                        ariaLabel="Categoría del mensaje"
                        buttonStyle={{ padding: 0, border: 'none', background: 'none', fontSize: 19, lineHeight: 1, color: 'var(--dim)' }}
                        sinFlecha botonLabel={<IconoMenu nombre={ICONO_CATEGORIA[categoria]} size={20} />}
                        options={ORDEN.map((k) => ({ value: k, label: LABEL[k], icono: ICONO_CATEGORIA[k] }))} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                  {/* El nombre se cambia HACIENDO CLICK EN ÉL, como en el resto de la
                      casa: un lápiz al lado es un segundo control para la misma acción.

                      ⚠️ Y MANDA SOBRE LA CATEGORÍA. Medido en pantalla: el título estaba
                      en 13,5 px y el desplegable de abajo en 14 — el nombre de la
                      automatización era literalmente más chico que su propia etiqueta.
                      «El título de la automatización NO puede ser más chico que el
                      desplegable de abajo de categoría, tiene que ser más grande.» Sale
                      del token y no de un número suelto, así que sube solo en mobile. */}
                  {editandoTitulo ? (
                    <input
                      autoFocus value={titulo} onChange={(e) => setTitulo(e.target.value)}
                      onBlur={() => void guardarTitulo()}
                      onKeyDown={(e) => { if (e.key === 'Enter') void guardarTitulo(); if (e.key === 'Escape') { setTitulo(plantilla.titulo); setEditandoTitulo(false); } }}
                      style={{ width: '100%', boxSizing: 'border-box', padding: 0, border: 'none', outline: 'none', background: 'transparent', color: 'var(--ink)', fontSize: tipo.card, fontWeight: 700, fontFamily: 'inherit' }}
                    />
                  ) : (
                    <button onClick={() => setEditandoTitulo(true)} title="Cambiar el nombre"
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: 0, border: 'none', background: 'none', cursor: 'text', fontSize: tipo.card, fontWeight: 700, color: 'var(--ink)', fontFamily: 'inherit', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {titulo || plantilla.titulo}
                    </button>
                  )}
                    </div>
                  </div>
                </div>

                {id && <PrefsDeMensaje id={id} estilo={tarjetaChrome} />}

                {/* ⚠️ ACÁ ESTABA LA ✕, Y SE FUE CON EL MODAL. Pedido el 04/10/2026: el
                    editor pasa a ser la vista por DEFAULT, así que ya no hay nada que
                    cerrar — «pon un botón arriba a la derecha, donde está el botón de
                    cerrar (que ya no debería estar más), que diga "Probar"».

                    Lo que la ✕ hacía de más era disparar el Confirm «¿Publicar los
                    cambios?» al salir con un borrador. Eso NO se perdió, cambió de forma:
                    el borrador ya se guardaba solo (al desmontar y por `visibilitychange`,
                    con test), así que lo único que el Confirm agregaba era el AVISO de que
                    MaKo sigue mandando el texto viejo — y un aviso que aparece al salir es
                    un EVENTO. Ahora es un ESTADO: la lista marca toda plantilla con
                    borrador sin publicar (`PlantillasView`), así que sobrevive a cambiar de
                    mensaje, al reload y a la vista de Probar. Es la regla de la casa: «un
                    aviso es un EVENTO, una bandeja es un ESTADO».

                    Y el rótulo del botón nuevo es «Probar» sólo en pantalla: adentro se
                    llama `onVerChat`, porque `onProbar` YA existe en este archivo y es otra
                    cosa — «✨ Que lo escriba MaKo», que paga IA. */}
                <div style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                  {plantilla.esCustom && (
                    // El tacho rojo de la casa (sexta tanda, General 9), no un texto rojo.
                    <BotonBorrar onClick={() => void eliminar()} disabled={busy === 'del'} title="Eliminar este mensaje" />
                  )}
                  {onVerChat && (
                    <button onClick={onVerChat} title="Ver cómo le llega este mensaje"
                      style={{ ...tarjetaChrome, fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', cursor: 'pointer', fontFamily: 'inherit' }}>Probar</button>
                  )}
                </div>
              </div>
          )}
          /* ABAJO A LA DERECHA, donde antes estaban los botones de agregar pasos:
             «el botón de guardar debería estar abajo en donde hoy está acción […] y
             el botón de abajo en lugar de guardar, que se llame Publicar». Agregar
             un paso pasó al ＋ que aparece al costado de cada tarjeta. */
          /* ⚠️ «Sin publicar» VIVE AL LADO DEL BOTÓN, no en la esquina de enfrente.
             Estaba arriba a la derecha y «Publicar» abajo a la derecha: 544 px de
             distancia medidos. «El mensaje de "Sin publicar" debería estar en todo caso
             abajo, al lado del botón de publicar. Qué sentido tiene que esté arriba.»

             Y el `flash` («Publicado ✓», los errores) baja con él: mudar uno solo
             dejaría dos mensajes de estado en dos esquinas opuestas, que es peor que
             los dos arriba.

             ⚠️ Y LA CONDICIÓN PERDIÓ SU PRIMERA RAMA CON EL CHIP (04/10/2026). Era
             `sinPublicar || puedeEditarTexto || flash` porque el chip «Sin publicar»
             tenía que salir aunque el texto no se pudiera editar — si no, alguien con un
             borrador quedaba sin cartel y sin botón. El chip se fue por pedido («elimina
             el chip de "Sin publicar", es simple: si ya está todo publicado, el botón de
             publicar debe estar más opaco y que no permita clickearlo»), así que dejar la
             rama `sinPublicar` ahí sólo dibujaba una caja VACÍA en esas superficies.

             El aviso que esa rama protegía no se perdió: se mudó a la LISTA, que marca
             toda plantilla con borrador sin publicar. Es un estado y no un evento, así
             que además sobrevive a cambiar de mensaje y al reload. */
          // «Publicar» publica el TEXTO: sin texto que se pueda editar, no hay qué publicar (el flujo se
          // guarda solo, en el acto).
          // ⚠️ «ACTIVAR» VIVE AL LADO DE «PUBLICAR» (sexta tanda, General 8, literal: «Activar pasa a estar al
          // lado de "Publicar"»), como en una automatización. Antes iba en su tarjeta a la derecha del título
          // (tres mudanzas el 04/10, y ganaba la última); la de la sexta tanda es más nueva. Se muda con su rama
          // `fijo`: un mensaje fijo no ofrece switch y dice «Siempre activa». Por eso el pie existe siempre que
          // haya un mensaje: el interruptor no depende de que el texto se pueda editar.
          pie={id ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
              {flash && (
                <span style={{ ...tarjetaChrome, fontSize: tipo.meta, fontWeight: 600, color: flash.mal ? 'var(--bad)' : 'var(--good)' }}>{flash.txt}</span>
              )}
                    <div style={{ ...tarjetaChrome, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        {plantilla.fijo ? (
                          <span title="Este avisa que MaKo dejó de recibir datos: si se apaga, el resto de los números miente sin que nadie se entere."
                            style={{ fontSize: 12, fontWeight: 600, color: 'var(--dim)' }}>Siempre activa</span>
                        ) : (
                          <>
                            <span style={{ fontSize: 12, fontWeight: 600, color: enabled ? 'var(--good)' : 'var(--dim)' }}>Activar</span>
                            <button onClick={toggle} disabled={busy === 'toggle'} aria-pressed={enabled} title={enabled ? 'Desactivar' : 'Activar'}
                              style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, background: enabled ? 'var(--good)' : 'var(--border-strong)', cursor: 'pointer', flex: 'none', transition: 'background .15s' }}>
                              <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: enabled ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
                            </button>
                          </>
                        )}
                    </div>
              {puedeEditarElMensaje && (
                <button onClick={() => void publicar()} disabled={busy === 'pub' || !sinPublicar}
                  title={sinPublicar ? 'Publicar: MaKo empieza a usar este texto' : 'No hay cambios sin publicar'}
                  style={{ ...btn, padding: '9px 18px', opacity: busy === 'pub' || !sinPublicar ? 0.45 : 1 }}>
                  {busy === 'pub' ? 'Publicando…' : 'Publicar'}
                </button>
              )}
            </div>
          ) : undefined}
        />
      ) : null}
      {/* ⚠️ LOS DOS BOTONES CIERRAN: la pregunta es QUÉ pasa con lo escrito, no si
          te querés ir. Y ninguno dice «Sí» ni «Cancelar» — cada uno nombra su
          acción, que es regla de la casa. */}
      {preguntandoSalida && (
        <Confirm
          title="¿Publicar los cambios?"
          message="Sin publicar, MaKo sigue mandando el texto anterior."
          confirmLabel="Publicar y cerrar" cancelLabel="Dejar como borrador" tone="primary"
          loading={busy === 'pub'}
          onConfirm={() => { void publicar().then(() => { setPreguntandoSalida(false); onClose(); }); }}
          onCancel={() => { setPreguntandoSalida(false); onClose(); }}
        />
      )}
    </div>
  );
}
