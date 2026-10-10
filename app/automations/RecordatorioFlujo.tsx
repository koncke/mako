'use client';

// =============================================================================
// RecordatorioFlujo — el recordatorio de la reunión AL LEAD, dibujado como una automatización más
// =============================================================================
// Pedido de Martín (08/10/2026, punto 2), textual: «No entiendo por qué está el "Recordatorio de
// la reunión" cuando eso debe configurarse en las tarjetas!!!». Era un renglón arriba del lienzo
// con un interruptor y un modal de tres textos; ahora es un ítem de la lista de automatizaciones y
// se ve con el MISMO lienzo y las mismas tarjetas que una automatización:
//
//   CRON «Agendó una reunión» → 24 h antes → mensaje → 1 h antes → mensaje → 15 min antes → mensaje
//
// ── 10/10/2026: «siguen habiendo cosas de versiones anteriores que estan mal..» ──────────────────
// Martín abrió /automations con la sexta tanda en producción y el recordatorio seguía con el lienzo de
// antes: las esperas como tarjetas DELAY, el CRON sin su cajita ni su «Entonces», las tarjetas creciendo
// con el texto, «Activar» al lado del título y el panel con la palabra «WHATSAPP» arriba. Armaba sus
// nodos a mano, así que ningún arreglo del lienzo de una automatización le llegaba. Ahora:
//   · el GRAFO lo arma el constructor de una automatización (`grafoRecordatorio`, lib/recordatorio-grafo.ts,
//     sobre `grafoDeSecuencia`): el DELAY en la flecha, el CRON de ManyChat, «Entonces», alto fijo y «…»;
//   · la tarjeta del CRON es `CuerpoCron` y la de cada mensaje la burbuja con `renglonesDeTarjeta`, las
//     mismas de FlujoLienzo; la cabecera del panel, `CabeceraWhatsApp`, con el NÚMERO de ese toque;
//   · el panel es el grande de `muelles` (`editorDeTarjeta`), como el de un mensaje;
//   · «Activar» va al lado de «Publicar» (sexta tanda, general 8), y el error pegado a los dos;
//   · lo no publicado se avisa a la lista (`onSinPublicar`, pregunta antes de cambiar de ítem) y al cerrar
//     la pestaña;
//   · Ctrl+Z / Ctrl+Y deshacen lo que no es tipear (volver al texto original, cambiar el número), con la
//     pila de la casa (`usePilaDeshacer`).
//
// ⚠️ SÓLO SE DIBUJA: LO SIGUE MANDANDO SU EMISOR DE SIEMPRE. `mandarRecordatoriosAlLead`
// (lib/reunion-recordatorio.ts) corre cada 10 minutos con una marca por toque. Está PRENDIDO en el ws1
// desde el 06/10: esta pantalla lee y escribe EXACTAMENTE el mismo setting por la misma ruta
// (`/api/chat-agent/recordatorio-reunion`: `activo`, `textos` y `lineas`), así que no puede apagarse ni
// salir doble por mudarse de pantalla. (El porqué de no pasarlo al motor de las automatizaciones decía
// que el motor no podía con el de 15 minutos; desde que las esperas se cumplen a la hora exacta eso
// puede haber cambiado, pero mudarlo con el emisor prendido manda dos veces: lo decide Martín.)
//
// Lo que se puede editar es lo que el emisor permite, y nada más:
//   · los TRES toques salen siempre: un texto vacío vuelve al de fábrica (`configDeRecordatorio`),
//     así que no hay «quitar» ni «＋» —un control que borra y el texto vuelve solo es un botón roto—,
//     ni flechas que arrastrar, ni «Siguiente paso» en el último;
//   · los minutos (`TOQUES`) son fijos en el emisor: la pastilla de la espera los DICE y no se abre;
//   · el texto de cada mensaje, con sus variables (`VARIABLES`: nombre, cuando, hora, faltan, link),
//     sin audio ni archivos —el emisor manda texto—, y por qué NÚMERO sale.
//
// LO QUE TODAVÍA NO TIENE, y por qué (cada uno necesita una pieza de otra parte; el detalle, en
// docs/hallazgos-chatbot.md → «Restos de versiones anteriores, grupo recordatorio»):
//   · el ✦ de MaKo (en el título y en la cabecera del mensaje): el que ayuda a escribir sólo conoce las
//     variables del motor, y acá escribiría `{{empresa}}` o la hora fija en vez de `{{hora}}`;
//   · mover las tarjetas y «Acomodar»: el guardado de las posiciones es de las automatizaciones;
//   · «▶ Probar»: el panel prueba una automatización con las variables del motor, no el emisor.
//
// «Activar» escribe `activo` en el acto (como el interruptor de una automatización). Los textos y los
// números se escriben SÓLO con «Publicar»: es lo que dice el resto del lienzo.

import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Lienzo, TarjetaNodo } from '@/app/_components/Lienzo';
import { Icon } from '@/app/_components/icons';
import { BurbujaHilo } from '@/app/whatsapp/_shared/BurbujaHilo';
import { Spinner } from '@/app/_ui';
import { usePilaDeshacer } from '@/app/_ui/usePilaDeshacer';
import { BotonPila } from './BotonPila';
import { EditorMensajeWhatsApp, CabeceraWhatsApp, type VariableEditor } from './EditorMensajeWhatsApp';
// Las piezas de la tarjeta de una automatización: la del CRON y cuántos renglones del texto entran.
import { CuerpoCron, renglonesDeTarjeta } from './FlujoLienzo';
import type { PasoSecuenciaDto } from './ChatAgentApp';
import { editorDeTarjeta, type Muelles } from '@/lib/lienzo-grafo';
import { ID_ENTRADA } from '@/lib/flujo-conversacion';
import { TOQUES, type Toque } from '@/lib/recordatorio-lead';
import {
  grafoRecordatorio, frenoDelRecordatorio, toqueDeId, esTarjetaDeToque, idToque, textoQueSale, DISPARADORES_RECORDATORIO,
} from '@/lib/recordatorio-grafo';

const URL_API = '/api/chat-agent/recordatorio-reunion';

/** El nombre de la automatización en la lista y en el título. */
export const NOMBRE_RECORDATORIO = 'Recordatorio de la reunión';
/** Su emoji, en el título. Es el mismo de su fila en la lista (`EMOJI_RECORDATORIO` de SimuladorWhatsApp). */
export const EMOJI_RECORDATORIO = '⏰';

type ToqueDto = { min: number; texto: string; porDefecto: boolean; textoDefault: string; linea?: string | null };
type Estado = { activo: boolean; envioWhatsapp: boolean | null; toques: ToqueDto[]; variables: string[] };
/** Lo que se edita, y la foto de la pila de deshacer: el texto y el número de cada toque. Sale con «Publicar». */
type Edicion = { textos: Partial<Record<Toque, string>>; lineas: Partial<Record<Toque, string | null>> };

/** Las variables del recordatorio con su rótulo. Son las de `VARIABLES` (lib/recordatorio-lead.ts). */
const ROTULO_VARIABLE: Record<string, { label: string; ejemplo: string }> = {
  nombre: { label: 'Nombre', ejemplo: 'Luis' },
  cuando: { label: 'Cuándo', ejemplo: 'mañana' },
  hora: { label: 'Hora', ejemplo: '10:00 a. m.' },
  faltan: { label: 'Cuánto falta', ejemplo: 'en 1 hora' },
  link: { label: 'Link', ejemplo: 'https://meet…' },
};

/** Las tarjetas del chrome FLOTANTE (las de SecuenciaPerfil: son la misma pieza en las dos pantallas). */
const tarjetaChrome: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11,
  padding: '7px 12px', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
};

/** Lo que dice el server, como edición: el texto y el número de cada toque. */
const edicionDe = (e: Estado): Edicion => ({
  textos: Object.fromEntries(e.toques.map((t) => [t.min, t.texto])) as Partial<Record<Toque, string>>,
  lineas: Object.fromEntries(e.toques.map((t) => [t.min, t.linea ?? null])) as Partial<Record<Toque, string | null>>,
});
const mismaEdicion = (a: Edicion, b: Edicion): boolean =>
  TOQUES.every((m) => (a.textos[m] ?? '') === (b.textos[m] ?? '') && (a.lineas[m] ?? null) === (b.lineas[m] ?? null));

/** Un toque como paso de mensaje, para las piezas compartidas (la burbuja, el editor, la cabecera). */
const pasoDeToque = (min: Toque, texto: string, linea: string | null): PasoSecuenciaDto => ({
  id: idToque(min), orden: min, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: texto,
  proveedor: 'no_oficial', template_wa: null, tipo: 'texto', ...(linea ? { linea } : {}),
});

export function RecordatorioFlujo({ negocio, insetIzq, insetDer, muelles, onCambio, onSinPublicar }: {
  negocio: string;
  /** Cuánto se corre lo que flota, para no nacer debajo de la lista. Con `muelles`, gana el suyo. */
  insetIzq?: number;
  insetDer?: number;
  /** Dónde va cada cosa que flota (`muelles`, lib/lienzo-grafo.ts): con esto el panel es el grande. */
  muelles?: Muelles | null;
  /** Avisa que cambió el interruptor (la lista pinta el punto de estado). */
  onCambio?: (activo: boolean) => void;
  /** Hay textos o números SIN PUBLICAR: la lista pregunta antes de cambiar de ítem (como en una automatización). */
  onSinPublicar?: (hay: boolean) => void;
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<'activo' | 'textos' | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [edicion, setEdicion] = useState<Edicion>({ textos: {}, lineas: {} });
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(URL_API, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (!r.ok || !j.ok) { setErr(j.error || 'No se pudo leer'); return; }
        setEstado(j as Estado);
        setEdicion(edicionDe(j as Estado));
        setErr(null);
      })
      .catch(() => { if (vivo) setErr('Sin conexión'); });
    return () => { vivo = false; };
  }, []);

  async function guardar(cuerpo: { activo?: boolean; textos?: Partial<Record<Toque, string>>; lineas?: Partial<Record<Toque, string | null>> }): Promise<Estado | null> {
    setErr(null);
    try {
      const r = await fetch(URL_API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j.ok) { setErr(j.error || 'No se pudo guardar'); return null; }
      setEstado(j as Estado);
      return j as Estado;
    } catch {
      setErr('Sin conexión');
      return null;
    }
  }

  const flashOk = (m: string) => { setFlash(m); setTimeout(() => setFlash(null), 2400); };

  const activar = async () => {
    if (!estado) return;
    const v = !estado.activo;
    setGuardando('activo');
    // Optimista: el interruptor responde al toque y vuelve atrás si el server no lo guardó.
    setEstado({ ...estado, activo: v });
    const ok = await guardar({ activo: v });
    if (!ok) setEstado((e) => (e ? { ...e, activo: !v } : e));
    else { onCambio?.(ok.activo); flashOk(ok.activo ? 'Activado ✓' : 'Pausado ✓'); }
    setGuardando(null);
  };

  /**
   * LA PILA DE DESHACER (la de la casa, app/_ui/usePilaDeshacer.ts), como en una automatización: la foto
   * es la edición entera y se apila lo que es una DECISIÓN (volver al texto original, cambiar el número).
   * Tipear no: el Ctrl+Z del texto es del navegador. Los botones ↶ ↷ son `BotonPila`, el de una automatización.
   */
  const { apilar, deshacer, rehacer, puedeDeshacer, puedeRehacer } = usePilaDeshacer<Edicion>(
    (foto) => { const antes = edicion; setEdicion(foto); return antes; },
    { activa: estado != null },
  );
  const fotoAntes = () => apilar({ textos: { ...edicion.textos }, lineas: { ...edicion.lineas } });
  const ponerTexto = (min: Toque, texto: string) => {
    setErr(null);
    setEdicion((e) => ({ ...e, textos: { ...e.textos, [min]: texto } }));
  };
  const ponerLinea = (min: Toque, linea: string | null) => {
    if ((edicion.lineas[min] ?? null) === linea) return;
    setErr(null);
    fotoAntes();
    setEdicion((e) => ({ ...e, lineas: { ...e.lineas, [min]: linea } }));
  };
  const volverAlOriginal = (min: Toque, texto: string) => {
    setErr(null);
    fotoAntes();
    setEdicion((e) => ({ ...e, textos: { ...e.textos, [min]: texto } }));
  };

  const publicados = useMemo(() => (estado ? edicionDe(estado) : null), [estado]);
  const sinPublicar = publicados != null && !mismaEdicion(edicion, publicados);

  /**
   * LO NO PUBLICADO SE AVISA (como `SecuenciaPerfil`): a la lista, que pregunta antes de cambiar de ítem
   * —hasta acá cambiar de automatización lo perdía sin aviso—, y al navegador, que pregunta al cerrar la
   * pestaña. Al irse, ya no hay nada sin publicar acá.
   */
  const avisarSinPublicar = useRef(onSinPublicar);
  useEffect(() => { avisarSinPublicar.current = onSinPublicar; });
  useEffect(() => { avisarSinPublicar.current?.(sinPublicar); }, [sinPublicar]);
  useEffect(() => () => { avisarSinPublicar.current?.(false); }, []);
  useEffect(() => {
    if (!sinPublicar) return;
    const alSalir = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', alSalir);
    return () => window.removeEventListener('beforeunload', alSalir);
  }, [sinPublicar]);

  const publicar = async () => {
    if (!estado) return;
    // Lo que la ruta rechazaría frena ACÁ y abre la tarjeta culpable (como `frenoDelFlujo`).
    const freno = frenoDelRecordatorio(edicion.textos);
    if (freno) { setErr(freno.error); setSel(idToque(freno.toque)); return; }
    setGuardando('textos');
    const ok = await guardar({
      textos: Object.fromEntries(TOQUES.map((m) => [m, edicion.textos[m] ?? ''])),
      lineas: Object.fromEntries(TOQUES.map((m) => [m, edicion.lineas[m] ?? null])),
    });
    if (ok) {
      // Lo que quedó es lo del server: un texto vacío vuelve al de fábrica.
      setEdicion(edicionDe(ok));
      flashOk('Publicado ✓');
    }
    setGuardando(null);
  };

  const grafo = useMemo(() => grafoRecordatorio(edicion.textos), [edicion.textos]);
  const variables: VariableEditor[] = (estado?.variables ?? Object.keys(ROTULO_VARIABLE)).map((k) => ({
    key: k, label: ROTULO_VARIABLE[k]?.label ?? k, ejemplo: ROTULO_VARIABLE[k]?.ejemplo,
  }));

  // EL PANEL, COMO EL DE UN MENSAJE DE UNA AUTOMATIZACIÓN: el grande de `muelles` (apaisado si entra) y
  // el tamaño por TIPO de tarjeta (`editorDeTarjeta`). Sin `muelles`, el de columna de siempre.
  const formaPanel: 'apaisado' | 'columna' = muelles?.editorForma === 'apaisado' ? 'apaisado' : 'columna';
  const talla = editorDeTarjeta(muelles, sel != null ? grafo.nodos.find((n) => n.id === sel)?.tipo : null);
  const izq = muelles ? muelles.insets.izq : insetIzq;

  // Hasta saber qué dice cada toque, el giro (no los textos de fábrica: el negocio puede tener los suyos).
  if (!estado) {
    return (
      <div style={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', paddingLeft: izq, color: 'var(--dim)', fontSize: 13.5 }}>
        {err ? <span role="alert" style={{ color: 'var(--bad)' }}>{err}</span> : <Spinner size={18} />}
      </div>
    );
  }
  // ⚠️ UN GUARDADO A LA VEZ: «Activar» y «Publicar» escriben el MISMO setting y la ruta lo lee, lo
  // cambia y lo escribe ENTERO. Con los dos en vuelo, el que llega último escribe lo que leyó antes del
  // otro: un «Activar» apretado mientras se publica devolvía los textos de antes.
  const ocupado = guardando != null;

  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Lienzo
        grafo={grafo} sinMarco alto="100%"
        insetIzq={izq} insetDer={muelles ? muelles.insets.der : insetDer}
        insetDerChrome={muelles?.insets.derChrome} insetDerAbajo={muelles?.insets.derAbajo}
        panelForma={formaPanel} panelAncho={talla.ancho} panelAlto={talla.alto}
        seleccion={sel}
        // Los botones de la pila, pegados al zoom, como en una automatización (restos de versiones anteriores).
        herramientas={(
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <BotonPila titulo="Deshacer (Ctrl+Z)" onClick={deshacer} activo={puedeDeshacer}>↶</BotonPila>
            <BotonPila titulo="Rehacer (Ctrl+Y)" onClick={rehacer} activo={puedeRehacer}>↷</BotonPila>
          </div>
        )}
        // Sólo los mensajes se abren: el disparador y las esperas no tienen nada que elegir.
        onSeleccion={(id) => setSel(esTarjetaDeToque(id) ? id : null)}
        // El click derecho en el fondo: «Publicar» (el lienzo suma «Centrar»). Crear, duplicar o borrar
        // tarjetas no: el emisor manda los tres toques.
        menuLienzo={() => [{
          id: 'publicar', label: 'Publicar', grupo: 90, icono: <Icon name="check" size={16} />,
          deshabilitado: !sinPublicar || ocupado, onElegir: () => void publicar(),
        }]}
        renderNodo={(n, activo) => {
          if (n.id === ID_ENTRADA) {
            return <TarjetaNodo key={n.id} nodo={n} activo={activo}><CuerpoCron disparadores={[...DISPARADORES_RECORDATORIO]} /></TarjetaNodo>;
          }
          const min = toqueDeId(n.id);
          if (min == null) return <TarjetaNodo key={n.id} nodo={n} activo={activo}>{n.detalle}</TarjetaNodo>;
          // Lo que le llega, como en una automatización: la burbuja, con los renglones que entran en el alto
          // FIJO de la tarjeta y «…» si no entra. Sin `aplicarVariables`: este emisor no resuelve
          // `{{negocio}}` (la ruta lo rechaza), así que la tarjeta tampoco.
          const paso = pasoDeToque(min, textoQueSale(edicion.textos, min), null);
          return (
            <TarjetaNodo key={n.id} nodo={n} activo={activo}>
              <BurbujaHilo compacta saliente autor={negocio} lineas={renglonesDeTarjeta(paso, 0)} contenido={{ texto: paso.cuerpo }} />
            </TarjetaNodo>
          );
        }}
        // LA CABECERA DEL PANEL DE UN WHATSAPP (sexta tanda, WhatsApp 2): el logo y el NÚMERO por el que sale
        // ESE toque, en lugar de la palabra «WhatsApp». Sin el ✦ todavía (ver la cabecera del archivo).
        tituloEditor={(n) => {
          const min = toqueDeId(n.id);
          if (min == null) return null;
          return (
            <CabeceraWhatsApp paso={pasoDeToque(min, '', edicion.lineas[min] ?? null)} lineaAutomatizacion={null}
              conMako={false} deshabilitado={ocupado} onLinea={(l) => ponerLinea(min, l)} />
          );
        }}
        renderEditor={(n) => {
          const min = toqueDeId(n.id);
          if (min == null) return null;
          const t = estado.toques.find((x) => x.min === min);
          const valor = edicion.textos[min] ?? '';
          return (
            <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, gap: 8 }}>
              <EditorMensajeWhatsApp
                key={idToque(min)}
                paso={pasoDeToque(min, valor, edicion.lineas[min] ?? null)}
                onChange={(patch) => { if (patch.cuerpo !== undefined) ponerTexto(min, patch.cuerpo ?? ''); }}
                audios={[]} variables={variables} negocio={negocio} deshabilitado={ocupado}
                permiteIA={false} permiteAudio={false} permiteAdjuntos={false} mostrarRevisar={false}
                placeholder="El recordatorio"
              />
              {t && valor.trim() !== t.textoDefault && (
                <button type="button" disabled={ocupado} onClick={() => volverAlOriginal(min, t.textoDefault)} title="Volver al texto de fábrica"
                  style={{ flex: 'none', alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12, color: 'var(--primary)', cursor: 'pointer' }}>
                  Original
                </button>
              )}
            </div>
          );
        }}
        chrome={(
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%' }}>
            {/* El ancho es FIJO, el mismo del título de una automatización (SecuenciaPerfil). */}
            <div style={{ ...tarjetaChrome, minWidth: 0, width: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 'none', fontSize: 18, lineHeight: 1 }}>{EMOJI_RECORDATORIO}</span>
              <span style={{ minWidth: 0, flex: 1, color: 'var(--ink)', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{NOMBRE_RECORDATORIO}</span>
            </div>
          </div>
        )}
        accion={(
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {/* El error va ACÁ, pegado al botón que lo produce (como en una automatización). */}
            {err ? (
              <span role="alert" style={{ ...tarjetaChrome, maxWidth: 380, fontSize: 12.5, color: 'var(--bad)', borderColor: 'var(--bad)', lineHeight: 1.4 }}>{err}</span>
            ) : flash ? (
              <span style={{ ...tarjetaChrome, fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>{flash}</span>
            ) : null}
            {/* Prendido no es «sale»: con el envío de WhatsApp apagado no sale nada. `null` = no se
                pudo leer, y entonces no se afirma nada. Va pegado al interruptor, que es lo que matiza. */}
            {estado.activo && estado.envioWhatsapp === false && (
              <span style={{ ...tarjetaChrome, flex: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--warn)' }}>Envío apagado</span>
            )}
            {/* «ACTIVAR», AL LADO DE «PUBLICAR» (sexta tanda, general 8: «Activar pasa a estar al lado de
                "Publicar"»): las dos deciden qué sale y se miran juntas. */}
            <div style={{ ...tarjetaChrome, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: estado.activo ? 'var(--good)' : 'var(--dim)' }}>Activar</span>
              <button onClick={() => void activar()} disabled={ocupado} aria-pressed={estado.activo}
                aria-label="Activar el recordatorio" title={estado.activo ? 'Pausar' : 'Activar'}
                style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, background: estado.activo ? 'var(--good)' : 'var(--border-strong)', cursor: 'pointer', flex: 'none', transition: 'background .15s' }}>
                <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: estado.activo ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
              </button>
            </div>
            {/* Apagado cuando no hay nada que publicar (como en una automatización: sin el cartel «Sin publicar»). */}
            <button onClick={() => void publicar()} disabled={!sinPublicar || ocupado}
              style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: sinPublicar ? 'pointer' : 'default', opacity: !sinPublicar || ocupado ? 0.45 : 1, fontFamily: 'inherit' }}>
              {guardando === 'textos' ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        )}
      />
    </div>
  );
}
