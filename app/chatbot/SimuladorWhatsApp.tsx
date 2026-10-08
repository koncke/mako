'use client';

// =============================================================================
// SimuladorWhatsApp — la tab /chatbot: la lista de automatizaciones flotando sobre el lienzo
// =============================================================================
// El nombre es de cuando esto era un chat simulado (réplica de PlantillasView de SuperAdmin). Hoy
// es la pantalla entera: el lienzo de la automatización elegida de borde a borde, la lista
// flotando a la izquierda y, al tocar «Probar», el teléfono acoplado a la derecha
// (PanelProbar). El editor de la secuencia (SecuenciaPerfil) queda SIEMPRE montado.

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Dropdown } from '../components/Dropdown';
import { SecuenciaPerfil, type EdicionLocal } from './SecuenciaPerfil';
import { PanelProbar, PANEL_PROBAR_ANCHO } from './PanelProbar';
import { RecordatorioFlujo, NOMBRE_RECORDATORIO } from './RecordatorioFlujo';
import type { ProductoOpcion } from './ChatAgentApp';
import type { AudioSetting, SecuenciaDto, Opcion } from './ChatAgentApp';
import type { Objetivo } from '@/lib/setting-estrategia';

export const EMOJI_OBJETIVO: Record<Objetivo, string> = { agendar: '📅', preparar: '🎯', reactivar: '🧲', cualificar: '❓', confirmar_pago: '💳' };

/**
 * EL ANCHO DE LA LISTA, Y SU HUECO AL BORDE. Son UNA constante porque los usan dos cosas: la
 * caja de la lista y el corrimiento de lo que flota sobre el lienzo. Con dos números, el título
 * vuelve a nacer debajo del buscador en cuanto alguien toque uno. El panel de «Probar» usa el
 * mismo hueco del lado derecho.
 */
export const LISTA_ANCHO = 272;
const LISTA_HUECO = 16;

/**
 * El tope del nombre de una automatización. Medido el 08/10/2026: los seis vigentes miden de 31
 * a 39 caracteres, y en dos renglones de la lista entran ~44. Lo hacen cumplir los escritores del
 * nombre (el server y el título del lienzo); la lista lo usa para el `title` de lo que no entre.
 */
export const TOPE_NOMBRE = 40;

/** El ítem del recordatorio en la lista. No es una fila de `nutricion_secuencias`. */
const ID_RECORDATORIO = 'recordatorio' as const;

// El objetivo puede ser uno del catálogo O uno que escribió el dueño: para esos no hay emoji
// propio y cae al genérico.
const emojiSecuencia = (j: SecuenciaDto): string =>
  (j.estrategia ? (EMOJI_OBJETIVO[j.estrategia.objetivo as Objetivo] ?? '🎯') : '⚑');

export function SimuladorWhatsApp({ secuencias, objetivos, etiquetaEtapa, negocio, rolAdmin, audios, canalCaido, onAudioNuevo, onWizard, onReload, productos, disparadores, pie, tz }: {
  productos: ProductoOpcion[];
  disparadores: Opcion[];
  secuencias: SecuenciaDto[];
  objetivos: Opcion[];
  etiquetaEtapa: (key: string) => string;
  negocio: string;
  /** El WhatsApp del negocio está caído: prender una secuencia no va a enviar nada. */
  canalCaido: boolean;
  rolAdmin: boolean;
  audios: AudioSetting[];
  onAudioNuevo: (a: AudioSetting) => void;
  onWizard: (id: number | 'nueva') => void;
  onReload: () => void;
  /** El pie de la LISTA (hoy: qué etapas quedaron sin secuencia). Viene de la tab
   *  porque el dato es del workspace, no de esta pieza. */
  pie?: ReactNode;
  /** La zona del negocio, para el texto del horario. */
  tz: string | null;
}) {
  const [busq, setBusq] = useState('');
  const [filtro, setFiltro] = useState<'todas' | 'activas' | 'pausadas'>('todas');
  const [elegida, setSelId] = useState<number | typeof ID_RECORDATORIO | ''>('');
  // Sin nada elegido, la primera. Se CALCULA y no se escribe con un efecto: un efecto que
  // corrige el estado dibuja primero la pantalla vacía y después la corrige.
  const selId = elegida === '' ? (secuencias[0]?.id ?? '') : elegida;
  /** El teléfono de «Probar» abierto. El lienzo NO se desmonta: se prueba lo que se edita. */
  const [probando, setProbando] = useState(false);
  /** Lo que el lienzo tiene sin publicar (`onCambioLocal`): es lo que prueba el panel. */
  const [edicion, setEdicion] = useState<EdicionLocal | null>(null);
  /** El interruptor del recordatorio, para el punto de la lista y el filtro. null = no se sabe. */
  const [recordatorioActivo, setRecordatorioActivo] = useState<boolean | null>(null);

  // El recordatorio es sólo del admin (su ruta tiene guard de admin): para el resto no existe.
  useEffect(() => {
    if (!rolAdmin) return;
    let vivo = true;
    void fetch('/api/chat-agent/recordatorio-reunion', { cache: 'no-store' }).then((r) => r.json()).then((j) => {
      if (vivo && j?.ok) setRecordatorioActivo(Boolean(j.activo));
    }).catch(() => { /* sin punto de estado */ });
    return () => { vivo = false; };
  }, [rolAdmin]);

  // ⚠️ EL BUSCADOR BUSCA POR NOMBRE, que es lo único que la lista muestra (pedido de Martín,
  // 08/10/2026, punto 3: «elimina el subtitulo, solo el título»). Buscar por un gancho que no se
  // ve devolvía filas que no dicen por qué coinciden.
  const q = busq.trim().toLowerCase();
  const pasaFiltro = (activa: boolean) => filtro === 'todas' || (filtro === 'activas') === activa;
  const lista = useMemo(
    () => secuencias.filter((j) => (filtro === 'todas' || (filtro === 'activas') === j.activa) && (!q || j.nombre.toLowerCase().includes(q))),
    [secuencias, q, filtro],
  );
  const verRecordatorio = rolAdmin
    && (filtro === 'todas' || (recordatorioActivo != null && pasaFiltro(recordatorioActivo)))
    && (!q || NOMBRE_RECORDATORIO.toLowerCase().includes(q));
  const sel = typeof selId === 'number' ? secuencias.find((j) => j.id === selId) : undefined;

  const elegir = (id: number | typeof ID_RECORDATORIO) => { setSelId(id); setProbando(false); setEdicion(null); };
  const recibirEdicion = useCallback((v: EdicionLocal) => setEdicion(v), []);

  /**
   * LA TAB ES EL LIENZO, Y LA LISTA SE LE APOYA ENCIMA.
   *
   * Martín, con la captura de /mensajes al lado: «fijate la sidebar que quiero que copies, es
   * como flotando, con bordes más redondos, con la barra de búsqueda… replicala tal cual… Y por
   * atrás debe pasar también la grilla». La cuadrícula NO se corta donde empieza la lista: el
   * lienzo ocupa el ancho entero y la lista es una tarjeta con su sombra encima (`position:
   * absolute`, no una columna del flex, que le quitaría ancho al lienzo).
   *
   * ⚠️ «PROBAR» YA NO REEMPLAZA AL LIENZO (punto 10, 08/10/2026). Era un modo 'chat' que
   * desmontaba el editor —se perdía lo no publicado— y dejaba el chat debajo de esta lista, con
   * «Editar» como única salida. Ahora es un teléfono acoplado a la DERECHA, como la lista a la
   * izquierda, y el lienzo le corre lo que flota con `insetDer`.
   */
  return (
    <div style={{ flex: 1, minHeight: 0, position: 'relative', minWidth: 0, display: 'flex' }}>
      {/* EL LIENZO: debajo de todo y de borde a borde. */}
      <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {selId === ID_RECORDATORIO && rolAdmin ? (
          <RecordatorioFlujo negocio={negocio} insetIzq={LISTA_ANCHO + LISTA_HUECO * 2} onCambio={setRecordatorioActivo} />
        ) : !sel ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--faint)', fontSize: 14 }}>
            Elige una automatización
          </div>
        ) : (
          /**
           * ⚠️ EL `key` ES OBLIGATORIO, y es un hallazgo de esta casa: «un `useState`
           * sembrado de props no se resiembra; si la vista deja de desmontarse, hay que
           * poner el key». Se cambia de secuencia SIN desmontar, así que sin esto el
           * nombre, el texto, el interruptor y el producto se quedarían con los de la
           * anterior.
           */
          <SecuenciaPerfil key={sel.id} secuencia={sel} objetivos={objetivos} etiquetaEtapa={etiquetaEtapa} rolAdmin={rolAdmin} audios={audios} negocio={negocio} canalCaido={canalCaido} tz={tz}
            insetIzq={LISTA_ANCHO + LISTA_HUECO * 2}
            insetDer={probando ? PANEL_PROBAR_ANCHO + LISTA_HUECO * 2 : undefined}
            onAudioNuevo={onAudioNuevo}
            productos={productos} disparadores={disparadores}
            secuencias={secuencias}
            onAbrirClave={(clave) => {
              // El «Sigue con» del lienzo tiene que LLEVAR: un nodo que nombra otra
              // secuencia y no la abre es la mitad inútil del encadenamiento.
              const otra = secuencias.find((j) => j.clave === clave);
              if (otra) elegir(otra.id);
            }}
            onProbar={() => setProbando(true)}
            onCambioLocal={recibirEdicion}
            onCambio={onReload} onWizard={() => onWizard(sel.id)} />
        )}
      </div>

      {/* LA LISTA, FLOTANDO.
          `aria-label` porque la app YA tiene un <aside>: el de la navegación global. Sin
          nombre los dos son «complementary» y no hay forma de distinguirlos —ni para un
          lector de pantalla ni para una verificación, que es como un arnés terminó
          clickeando los íconos del menú de la izquierda creyendo que eran secuencias.
          Y lleva su `overflowY` con la barra teñida de la casa: el scroll es del
          CONTENIDO —sus secuencias—, no de la navegación de la app, así que se ve. */}
      <aside aria-label="Tus secuencias" style={{
        position: 'absolute', left: LISTA_HUECO, top: LISTA_HUECO, bottom: LISTA_HUECO, width: LISTA_ANCHO, zIndex: 3,
        display: 'flex', flexDirection: 'column', minHeight: 0,
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18,
        boxShadow: '0 8px 28px rgba(18,21,27,.12)', overflow: 'hidden',
      }}>
        {/* El buscador va SIEMPRE, como en el molde. Antes aparecía con más de seis
            secuencias, y un control que aparece solo es un control que nadie busca. */}
        <div style={{ flex: 'none', padding: '14px 14px 12px', borderBottom: '1px solid var(--border)' }}>
          <input value={busq} onChange={(e) => setBusq(e.target.value)} placeholder="Buscar" aria-label="Buscar por nombre"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface-2)', color: 'var(--ink)', fontFamily: "'Geist', sans-serif", fontSize: 13.5, outline: 'none' }} />
          <div style={{ marginTop: 10 }}>
            {/* El filtro del molde es por categoría; acá la pregunta equivalente es por
                ESTADO. Una pausada no manda nada, y es lo que uno busca cuando algo no
                sale. Un filtro que devuelve siempre la misma lista sería ruido. */}
            <Dropdown value={filtro} onChange={(v) => setFiltro(v as 'todas' | 'activas' | 'pausadas')} width={180}
              ariaLabel="Filtrar secuencias" buttonStyle={{ padding: '8px 11px', fontSize: 13 }}
              options={[
                { value: 'todas', label: `Todas · ${secuencias.length}` },
                { value: 'activas', label: `Activas · ${secuencias.filter((j) => j.activa).length}` },
                { value: 'pausadas', label: `Pausadas · ${secuencias.filter((j) => !j.activa).length}` },
              ]} />
          </div>
        </div>
        <div className="mk-scroll-oscuro" style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 8 }}>
          {rolAdmin && (
            <button type="button" onClick={() => onWizard('nueva')}
              style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px dashed var(--border-strong)', background: 'transparent', color: 'var(--dim)', cursor: 'pointer', marginBottom: 6, opacity: 0.85, fontFamily: 'inherit' }}>
              <span style={{ width: 38, height: 38, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--faint)' }}>＋</span>
              <span style={{ fontWeight: 600, fontSize: 13.5 }}>Nueva secuencia</span>
            </button>
          )}
          {lista.length === 0 && !verRecordatorio && <div style={{ padding: 16, color: 'var(--faint)', fontSize: 13 }}>Ninguna coincide</div>}
          {lista.map((j) => (
            <ItemLista key={j.id} on={j.id === selId} activa={j.activa} emoji={emojiSecuencia(j)} nombre={j.nombre} onClick={() => elegir(j.id)} />
          ))}
          {/* EL RECORDATORIO, COMO UNA AUTOMATIZACIÓN MÁS (punto 2). Lo sigue mandando su
              emisor de siempre; la lista sólo lo abre en su lienzo. */}
          {verRecordatorio && (
            <ItemLista on={selId === ID_RECORDATORIO} activa={recordatorioActivo === true} emoji="⏰" nombre={NOMBRE_RECORDATORIO} onClick={() => elegir(ID_RECORDATORIO)} />
          )}
        </div>
        {/* El pie de la lista: lo que antes era una franja arriba del lienzo y le comía
            alto a la pizarra. Acá cuelga de lo que nombra —las secuencias— y no ocupa
            un renglón de la tab. */}
        {pie && <div style={{ flex: 'none', borderTop: '1px solid var(--border)', padding: '9px 14px' }}>{pie}</div>}
      </aside>

      {/* «PROBAR», ACOPLADO A LA DERECHA. Mismo hueco que la lista, y el lienzo le corre lo que
          flota (`insetDer`). Se remonta por automatización: otra secuencia es otra prueba. */}
      {probando && sel && (
        <PanelProbar
          key={sel.id}
          secuencia={sel} edicion={edicion} secuencias={secuencias} audios={audios} negocio={negocio}
          rolAdmin={rolAdmin} etiquetaEtapa={etiquetaEtapa} onCerrar={() => setProbando(false)}
          style={{ position: 'absolute', right: LISTA_HUECO, top: LISTA_HUECO, bottom: LISTA_HUECO, width: PANEL_PROBAR_ANCHO, zIndex: 3 }}
        />
      )}
    </div>
  );
}

/**
 * Una fila de la lista: el emoji, el NOMBRE ENTERO y el punto de estado. Nada más.
 *
 * ⚠️ SIN SUBTÍTULO (pedido de Martín, 08/10/2026, punto 3): «elimina el subtitulo, solo el
 * título. Y procura que se vea todo, con un máximo de caracteres para los títulos». El nombre va
 * en DOS renglones (`line-clamp`): en un renglón de ~162 px entraban ~22 caracteres y los seis
 * vigentes (31 a 39) se cortaban todos. Dos renglones son ~44, por encima del tope de 40.
 */
function ItemLista({ on, activa, emoji, nombre, onClick }: {
  on: boolean; activa: boolean; emoji: string; nombre: string; onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} title={nombre.length > TOPE_NOMBRE ? nombre : undefined}
      style={{ width: '100%', textAlign: 'left', display: 'flex', gap: 11, alignItems: 'center', padding: '10px 12px', borderRadius: 12, border: '1px solid ' + (on ? 'var(--border-strong)' : 'transparent'), background: on ? 'var(--surface-2)' : 'transparent', cursor: 'pointer', marginBottom: 2, opacity: activa ? 1 : 0.55, fontFamily: 'inherit' }}>
      <span style={{ width: 38, height: 38, borderRadius: '50%', flex: 'none', background: 'var(--surface-2)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19 }}>{emoji}</span>
      <span style={{ minWidth: 0, flex: 1, fontWeight: 600, fontSize: 13.5, lineHeight: 1.3, color: 'var(--ink)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', overflowWrap: 'anywhere' }}>{nombre}</span>
      {/* El punto dice el estado sin una palabra: en una fila de 272 px,
          «pausada» se come el nombre. El rótulo entero está en el lienzo. */}
      <span title={activa ? 'Activa' : 'Pausada'} style={{ width: 8, height: 8, borderRadius: '50%', background: activa ? 'var(--good)' : 'var(--border-strong)', flex: 'none' }} />
    </button>
  );
}
