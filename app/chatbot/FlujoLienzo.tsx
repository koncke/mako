'use client';

// =============================================================================
// FlujoLienzo — la CONVERSACION con un lead, dibujada
// =============================================================================
// El pedido, textual: «Quiero que los editables del flujo de conversacion sea
// como el editable de Manychat, que tiene una pantalla tipo flujo, y ahi se edita
// todo», con la captura del Flow Builder al lado.
//
// Aca vive lo PROPIO de una secuencia: como se ve un mensaje en su nodo y que se
// edita al tocarlo. El gesto, el encuadre, las curvas y el panel son de
// app/_components/Lienzo.tsx, que tambien dibuja el flujo de un aviso — copiar el
// lienzo habria dejado dos que se separan en la primera edicion, que es la razon
// escrita por la que se borro el editor de diagramas del funnel.
//
// ── QUE SE COPIA DE MANYCHAT Y QUE NO ──────────────────────────────────────
// Lo que se copia, que es lo que hace que ese editor no se sienta una marana:
//   · El nodo MUESTRA EL MENSAJE tal cual le llega a la persona — la misma
//     burbuja de WhatsApp del resto del producto, no un resumen de campos. Sin
//     esto el lienzo es un diagrama, no un editor.
//   · Tocar un nodo abre su editor ENCIMA del lienzo, con los controles que ya
//     existian. En ManyChat es literal: «When you click on a step, a window will
//     pop up allowing you to edit it».
//   · Las ramas se leen SIN abrir nada: cada salida lleva su nombre en la flecha.
//
// Lo que NO se copia, y es una decision: el drag-to-connect y mover los nodos a
// mano. El porque —con la cita del dueno y los numeros— esta en
// lib/flujo-conversacion.ts.
//
// ── LO QUE ESTE LIENZO REEMPLAZA ───────────────────────────────────────────
// A las tres sub-tabs del perfil (Estrategia / Mensajes / Variantes), no se suma
// a ellas: dos editores del mismo dato divergen, y el segundo se queda viejo.

import { useEffect, useState, type ReactNode } from 'react';
import { Dropdown } from '../components/Dropdown';
import { Lienzo, TarjetaNodo, inpLienzo, rotuloLienzo } from '@/app/_components/Lienzo';
// El editor del paso «⚡ Acción» es UNO para los dos lienzos (este y el de /mensajes).
import { EditorAccionMako, useTitulosAcciones, type ValorAccion } from '@/app/_components/EditorAccionMako';
import { esPasoAccion } from '@/lib/nutricion-paso-accion';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';
import { BURBUJA_SALIENTE } from '@/app/whatsapp/_shared/BurbujaMaKo';
import { PasoAudioControl } from './PasoAudioControl';
import { Checkbox } from '@/app/_ui';
import { proveedorDelPaso } from '@/lib/nutricion-canal';
import {
  grafoDeSecuencia, CONDICION_TXT, CONDICIONES_VIVAS,
  type NodoFlujo, type PasoParaGrafo, type EstrategiaParaGrafo,
} from '@/lib/flujo-conversacion';
import type { AudioSetting, PasoSecuenciaDto } from './ChatAgentApp';
import type { Desenlace, ModoRespuesta } from '@/lib/setting-estrategia';

const SANS = "'Geist', sans-serif";

export function FlujoLienzo({
  pasos, estrategia, etiquetaEtapa, secuencias, audios, negocio, rolAdmin, busy,
  onEditarPaso, onAgregarPaso, onQuitarPaso, onAudio, onAudioNuevo, onError,
  onEditarVariante, onQuitarVariante, onModoIA, onAccion,
  onModo, onDesenlace, onAntiguedad, onEnvioAuto, onAbrirSecuencia,
  chrome, herramientas, pie, editorEntrada, onAgregarTras, insetIzq,
}: {
  pasos: PasoSecuenciaDto[];
  estrategia: EstrategiaParaGrafo;
  etiquetaEtapa: string;
  /** Las del workspace, para resolver a que apunta un «Sigue con». */
  secuencias: ReadonlyArray<{ clave: string; nombre: string }>;
  audios: AudioSetting[];
  negocio: string;
  rolAdmin: boolean;
  busy: boolean;
  onEditarPaso: (orden: number, campo: 'cuerpo' | 'asunto' | 'delay_horas', val: string | number) => void;
  onAgregarPaso: () => void;
  onQuitarPaso: (orden: number) => void;
  onAudio: (orden: number, audioId: number | null) => void;
  onAudioNuevo: (a: AudioSetting) => void;
  onError: (m: string) => void;
  onEditarVariante: (orden: number, i: number, val: string) => void;
  onQuitarVariante: (orden: number, i: number) => void;
  /** Prender o apagar «Lo adapta MaKo» en un paso. Sin esta prop la casilla no se dibuja. */
  onModoIA?: (orden: number, on: boolean) => void;
  /** Qué acción corre un paso «⚡ Acción» y con qué datos. Sin esta prop el editor queda apagado. */
  onAccion?: (orden: number, v: ValorAccion) => void;
  onModo: (m: ModoRespuesta) => void;
  onDesenlace: (d: Desenlace) => void;
  onAntiguedad: (h: number | null) => void;
  /** Prender o apagar «Sale sola» (`envio_automatico`). Sin esta prop el interruptor no se dibuja. */
  onEnvioAuto?: (on: boolean) => void;
  /** Abrir OTRA secuencia: es el «Go To», y tiene que llevar de verdad. */
  onAbrirSecuencia: (clave: string) => void;
  /** El título, el interruptor y «Probar»: FLOTAN sobre el lienzo, arriba a la
   *  izquierda. Mismo contrato que el editor de /mensajes. */
  chrome?: ReactNode;
  /** Pegado al zoom, abajo a la izquierda: deshacer y rehacer. */
  herramientas?: ReactNode;
  /** Abajo a la derecha: «Publicar». */
  pie?: ReactNode;
  /**
   * El editor del nodo de ENTRADA (el disparador). Viene de afuera porque su estado
   * —qué etapa, de qué producto— vive en quien monta el lienzo, igual que la pila de
   * deshacer. Antes era una línea de prosa ARRIBA del lienzo, que es justo lo que el
   * dueño sacó: «eso se configura con las tarjetas».
   */
  editorEntrada?: ReactNode;
  /** Cuánto se corre lo que FLOTA, porque la lista de secuencias se apoya sobre el
   *  borde izquierdo del lienzo. No angosta el dibujo — ver `Lienzo.insetIzq`. */
  insetIzq?: number;
  /** Agregar un paso DESPUÉS de este nodo: el ＋ que aparece al pasar el cursor por la
   *  tarjeta. Reemplaza al botón suelto «＋ Mensaje», que no decía DÓNDE entraba. Y
   *  pregunta QUÉ: un mensaje, o una acción de MaKo. */
  onAgregarTras?: (id: string, que: 'mensaje' | 'accion') => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const titulos = useTitulosAcciones(pasos.some(esPasoAccion));
  const grafo = grafoDeSecuencia(pasos as PasoParaGrafo[], estrategia, etiquetaEtapa, secuencias, (op) => titulos?.get(op));
  const pasoDe = (n: NodoFlujo) => (n.orden != null ? pasos.find((x) => x.orden === n.orden) ?? null : null);

  return (
    <Lienzo
      grafo={grafo} seleccion={sel} onSeleccion={setSel}
      sinMarco alto="100%" insetIzq={insetIzq}
      chrome={chrome} herramientas={herramientas}
      /* ⚠️ EL ＋ VA EN LA TARJETA, NO EN UNA ESQUINA. «El botón de "+mensaje" tampoco
         tiene sentido... si para eso habíamos hecho el botón de ＋ al lado de cada
         tarjeta... que hoy no está». Un botón suelto no dice dónde entra el paso; éste
         aparece a la derecha de la tarjeta, que es donde va a aparecer lo que se agregue. */
      onAgregarTras={rolAdmin && onAgregarTras ? ((id, que) => {
        const q = que === 'accion' ? 'accion' : 'mensaje';
        onAgregarTras(id, q);
        // Una acción nace SIN ELEGIR y así no se puede publicar: se abre su panel, que es lo
        // único que se puede hacer con ella. El paso entra justo después del nodo tocado
        // (`entrada` → el primero), así que su id es ése.
        if (q === 'accion') { const m = /^paso-(\d+)$/.exec(id); setSel(`paso-${m ? Number(m[1]) + 1 : 1}`); }
      }) : undefined}
      /* «⚡ Acción de MaKo» (decisión de Martín, 08/10/2026): el ＋ PREGUNTA qué agregar.
         Lista plana con emoji y título, como la de /mensajes. El ＋ del medio de una flecha
         ofrece sólo la acción (lo filtra el Lienzo): las flechas que no son la cadena
         principal no lo dibujan (`sinMas` en el grafo). */
      opcionesAgregar={[
        { value: 'mensaje', label: '💬 Mensaje' },
        { value: 'accion', label: '⚡ Acción de MaKo' },
      ]}
      /* Sólo donde el paso que se agregue cuelga de verdad de esa tarjeta: en la entrada
         (sería el primer mensaje) y después de cada mensaje. En el desenlace o en un
         «Sigue con» el ＋ señalaría un lugar y el paso caería en otro. */
      puedeAgregarTras={(idNodo) => idNodo === 'entrada' || /^paso-\d+$/.test(idNodo)}
      renderNodo={(n, activo) => (
        <TarjetaNodo key={n.id} nodo={n} activo={activo} roto={n.tipo === 'ir-a' && n.destinoExiste === false}>
          {n.tipo === 'mensaje' && pasoDe(n)
            ? <VistaMensaje paso={pasoDe(n)!} audios={audios} negocio={negocio} />
            : n.tipo === 'accion'
              // Sin burbuja: al lead no le llega nada. Lo que se lee es QUÉ hace MaKo.
              ? <div style={{ fontSize: 12.5, fontWeight: 600, color: n.advertencia ? 'var(--faint)' : 'var(--ink)', lineHeight: 1.45 }}>{n.detalle}</div>
              : <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.45 }}>{n.detalle}</div>}
        </TarjetaNodo>
      )}
      renderEditor={(n) => (
        <EditorDeNodo
          nodo={n} paso={pasoDe(n)} estrategia={estrategia} secuencias={secuencias}
          audios={audios} rolAdmin={rolAdmin} busy={busy}
          onEditarPaso={onEditarPaso} onQuitarPaso={(o) => { onQuitarPaso(o); setSel(null); }}
          onAudio={onAudio} onAudioNuevo={onAudioNuevo} onError={onError}
          onEditarVariante={onEditarVariante} onQuitarVariante={onQuitarVariante}
          onModoIA={onModoIA} onAccion={onAccion}
          onModo={onModo} onDesenlace={onDesenlace} onAntiguedad={onAntiguedad} onEnvioAuto={onEnvioAuto}
          onAbrirSecuencia={onAbrirSecuencia}
          editorEntrada={editorEntrada}
        />
      )}
      accion={pie}
    />
  );
}

/** El mensaje COMO LLEGA. Es la pieza que hace que esto sea un editor y no un
 *  diagrama: la misma burbuja que el resto del producto (`BURBUJA_SALIENTE`), no
 *  una tarjeta con el texto recortado. */
function VistaMensaje({ paso, audios, negocio }: { paso: PasoSecuenciaDto; audios: AudioSetting[]; negocio: string }) {
  if (paso.tipo === 'audio') {
    const a = audios.find((x) => x.id === paso.audio_id);
    return (
      <div style={{ ...BURBUJA_SALIENTE, padding: '9px 11px', fontSize: 12.5, maxWidth: '100%', minWidth: 0, overflow: 'hidden' }}>
        {a?.url
          ? <AudioPlay src={a.url} style={{ maxWidth: '100%' }} />
          : <span style={{ color: 'var(--faint)' }}>Sin audio elegido</span>}
        {a?.titulo && <div style={{ fontSize: 11, color: 'var(--dim)', marginTop: 5 }}>{a.titulo}{a.duracion_s ? ` · ${Math.round(a.duracion_s)}s` : ''}</div>}
      </div>
    );
  }
  const texto = (paso.cuerpo || '').replace(/\{\{\s*negocio\s*\}\}/g, negocio);
  return (
    <>
      {/* Sin esto, una tarjeta en modo IA y una fija se ven idénticas: la burbuja
          muestra el texto BASE, y lo que le llega a cada lead es otra cosa. */}
      {paso.tipo === 'ia' && (
        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--mako-ink)', marginBottom: 5 }}>✦ Lo adapta MaKo</div>
      )}
      {paso.canal === 'email' && paso.asunto && (
        <div style={{ fontSize: 11, color: 'var(--faint)', marginBottom: 5 }}>Asunto: {paso.asunto}</div>
      )}
      <div style={{ ...BURBUJA_SALIENTE, padding: '9px 11px', fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
        {texto.trim() || <span style={{ color: 'var(--faint)' }}>Sin escribir</span>}
      </div>
    </>
  );
}

// ── El editor del nodo tocado ───────────────────────────────────────────────

function EditorDeNodo({
  nodo, paso, estrategia, secuencias, audios, rolAdmin, busy,
  onEditarPaso, onQuitarPaso, onAudio, onAudioNuevo, onError, onEditarVariante, onQuitarVariante,
  onModoIA, onAccion, onModo, onDesenlace, onAntiguedad, onEnvioAuto, onAbrirSecuencia, editorEntrada,
}: {
  nodo: NodoFlujo; paso: PasoSecuenciaDto | null; estrategia: EstrategiaParaGrafo;
  secuencias: ReadonlyArray<{ clave: string; nombre: string }>;
  audios: AudioSetting[]; rolAdmin: boolean; busy: boolean;
  onEditarPaso: (orden: number, campo: 'cuerpo' | 'asunto' | 'delay_horas', val: string | number) => void;
  onQuitarPaso: (orden: number) => void;
  onAudio: (orden: number, audioId: number | null) => void;
  onAudioNuevo: (a: AudioSetting) => void;
  onError: (m: string) => void;
  onEditarVariante: (orden: number, i: number, val: string) => void;
  onQuitarVariante: (orden: number, i: number) => void;
  onModoIA?: (orden: number, on: boolean) => void;
  onAccion?: (orden: number, v: ValorAccion) => void;
  onModo: (m: ModoRespuesta) => void;
  onDesenlace: (d: Desenlace) => void;
  onAntiguedad: (h: number | null) => void;
  onEnvioAuto?: (on: boolean) => void;
  onAbrirSecuencia: (clave: string) => void;
  /** Lo que se edita en el nodo de ENTRADA: QUÉ dispara la secuencia. Ver FlujoLienzo. */
  editorEntrada?: ReactNode;
}) {
  const des = (estrategia?.desenlace ?? {}) as Partial<Desenlace>;
  const cambiarDes = (p: Partial<Desenlace>) => onDesenlace({
    logrado: (des.logrado ?? 'respondio') as Desenlace['logrado'],
    logradoEtapa: des.logradoEtapa ?? null,
    logradoSecuencia: des.logradoSecuencia ?? null,
    falloHoras: des.falloHoras ?? 0,
    falloEtapa: des.falloEtapa ?? null,
    falloSecuencia: des.falloSecuencia ?? null,
    ...p,
  });
  const opcionesSecuencia = [{ value: '', label: 'Ninguna: termina aquí' },
    ...secuencias.map((s) => ({ value: s.clave, label: s.nombre }))];

  // ⚠️ UN SETTER NO EDITA, PERO TIENE QUE PODER LEER. Con `nodo.detalle` a secas,
  // abrir un nodo de MENSAJE le mostraba una caja vacía: los nodos de mensaje no
  // tienen `detalle` —su contenido es el mensaje— así que el panel salía en blanco
  // justo en los nodos que más se abren.
  if (!rolAdmin) {
    return nodo.tipo === 'mensaje' && paso
      ? <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{paso.cuerpo || 'Sin escribir'}</div>
      : <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{nodo.detalle}</div>;
  }

  if (nodo.tipo === 'entrada') {
    const h = estrategia?.antiguedad_max_horas ?? null;
    return (
      <>
        {/* ⚠️ EL DISPARADOR SE EDITA ACÁ, EN LA TARJETA. Era una línea de prosa arriba
            del lienzo con dos desplegables sueltos, y el dueño la sacó con todas las
            letras: «eso se configura con las tarjetas». El nodo de entrada ES la
            pregunta «qué lo dispara», así que su editor es el lugar. */}
        {editorEntrada ?? <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 12 }}>{nodo.detalle}</div>}
        <label style={rotuloLienzo}>Solo a leads recientes</label>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <input
            type="number" min={1} step={1} value={h ?? ''} placeholder="sin límite" disabled={busy}
            onChange={(e) => onAntiguedad(e.target.value.trim() === '' ? null : Math.max(1, Number(e.target.value)))}
            style={{ ...inpLienzo, width: 96 }}
          />
          <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>horas</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 7, marginBottom: 0 }}>
          Vacío: le escribe a cualquiera que esté en la etapa.
        </p>
        {/* «SALE SOLA» VOLVIÓ (#786). Su único control vivía en EstrategiaWizard, y desde el
            05/10 nada abre ese wizard: el lienzo dejaba editar el tope y prender la secuencia,
            pero no si los mensajes salen solos — y sin esto, a un lead que no pagó cada mensaje
            le queda como BORRADOR (la regla dura de lib/evolution-envio.ts). Va en la tarjeta
            de entrada porque es de la secuencia entera, no de un paso. Checkbox y no Switch:
            se guarda con «Publicar», como «Lo adapta MaKo». */}
        {onEnvioAuto && (
          <div style={{ marginTop: 14 }}>
            <Checkbox
              checked={estrategia?.envio_automatico === true} disabled={busy}
              onChange={(v) => onEnvioAuto(v)}
              label="Sale sola"
              hint={estrategia?.envio_automatico === true ? undefined : 'Apagado: cada mensaje queda como borrador.'}
            />
          </div>
        )}
      </>
    );
  }

  /**
   * EL PASO «⚡ ACCIÓN DE MAKO». El editor es el compartido (`EditorAccionMako`): qué
   * acción y con qué datos. Lo que se configura acá CORRE SOLO cuando la secuencia llega a
   * este paso, sin pedir un «sí» (decisión de Martín, 08/10/2026) — por eso no hay texto que
   * lo explique: lo dice el propio editor, en una línea.
   *
   * ⚠️ LA `key` LLEVA LA OPERACIÓN. El editor siembra estado de sus props (el texto crudo de
   * un campo JSON) y es UNO que se reusa al tocar otro nodo: sin la key, lo escrito para una
   * acción se quedaba dibujado en la siguiente (AGENTS.md, el `useState` sembrado de props).
   */
  if (nodo.tipo === 'accion' && paso) {
    return (
      <>
        <EditorAccionMako
          key={`accion-${paso.orden}-${paso.accion?.operacion ?? ''}`}
          valor={{ operacion: paso.accion?.operacion || undefined, params: paso.accion?.params ?? {} }}
          onCambio={(v) => onAccion?.(paso.orden, v)}
          disabled={busy || !onAccion}
        />
        <div style={{ marginTop: 12 }}>
          <label style={rotuloLienzo}>Cuándo corre</label>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <input type="number" min={0} step={1} value={paso.delay_horas} disabled={busy}
              onChange={(e) => onEditarPaso(paso.orden, 'delay_horas', Math.max(0, Number(e.target.value)))}
              style={{ ...inpLienzo, width: 90 }} />
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
              {paso.ancla === 'reunion' ? 'horas antes de la reunión' : 'horas después'}
            </span>
          </div>
        </div>
        <AvisoCondicion requiere={paso.requiere} verbo="Corre" />
        <button onClick={() => onQuitarPaso(paso.orden)} disabled={busy}
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--bad)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: SANS }}>
          Quitar esta acción
        </button>
      </>
    );
  }

  if (nodo.tipo === 'mensaje' && paso) {
    return (
      <>
        {/* `key` por paso: el editor es UNO y se reusa al tocar otro nodo, y el guion que
            escribió MaKo vive en el estado del control — sin la key, el de un mensaje se
            quedaba dibujado en el siguiente. El cuerpo de un paso de audio es su PIE (lo
            que va por escrito), así que MaKo lo recibe como tal y no como algo para leer. */}
        {paso.tipo === 'audio' ? (
          <PasoAudioControl
            key={`audio-${paso.orden}`}
            orden={paso.orden} audios={audios} audioId={paso.audio_id ?? null} disabled={busy}
            onElegir={(id) => onAudio(paso.orden, id)} onGrabado={onAudioNuevo} onError={onError}
            paraGuion={{ objetivo: estrategia?.objetivo, gancho: estrategia?.gancho, preguntas: estrategia?.preguntas, pie: paso.cuerpo }}
          />
        ) : (
          <>
            {paso.canal === 'email' && (
              <>
                <label style={rotuloLienzo}>Asunto</label>
                <input value={paso.asunto ?? ''} disabled={busy}
                  onChange={(e) => onEditarPaso(paso.orden, 'asunto', e.target.value)}
                  style={{ ...inpLienzo, marginBottom: 10 }} />
              </>
            )}
            {/* ⚠️ LA CASILLA SÓLO DONDE EL MOTOR LA HONRA: WhatsApp no oficial. Por la
                vía oficial sale una plantilla que aprobó Meta, y por email no hay rama de
                IA — y `setSecuenciaPasos` le saca el `tipo: 'ia'` a esos pasos al guardar,
                así que dibujarla ahí sería un control que se des-tilda solo. Por eso la
                condición es la MISMA función que usa el saneo, no una copia.
                Checkbox y no Switch: se guarda con «Publicar», y un switch promete que
                el cambio ya pasó (app/_ui/Toggle.tsx). */}
            {onModoIA && paso.canal === 'whatsapp' && proveedorDelPaso(paso) === 'no_oficial' && (
              <div style={{ marginBottom: 10 }}>
                <Checkbox
                  checked={paso.tipo === 'ia'} disabled={busy}
                  onChange={(v) => onModoIA(paso.orden, v)}
                  label="Lo adapta MaKo"
                  hint={paso.tipo === 'ia' ? 'Si MaKo no puede, sale tu texto.' : undefined}
                />
              </div>
            )}
            <label style={rotuloLienzo}>{paso.tipo === 'ia' ? 'Qué tiene que decir' : 'El mensaje'}</label>
            {/* Un textarea y no el `Autocrece` de la burbuja: aquél crece hasta el
                alto del texto —correcto DENTRO de una burbuja, donde una barra de
                scroll es un cuerpo extraño— y acá el editor tiene alto propio. */}
            <textarea value={paso.cuerpo} disabled={busy} rows={5}
              onChange={(e) => onEditarPaso(paso.orden, 'cuerpo', e.target.value)}
              style={{ ...inpLienzo, minHeight: 92, lineHeight: 1.5, resize: 'vertical' }} />
          </>
        )}

        <div style={{ marginTop: 10 }}>
          <label style={rotuloLienzo}>Cuándo sale</label>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <input type="number" min={0} step={1} value={paso.delay_horas} disabled={busy}
              onChange={(e) => onEditarPaso(paso.orden, 'delay_horas', Math.max(0, Number(e.target.value)))}
              style={{ ...inpLienzo, width: 90 }} />
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>
              {paso.ancla === 'reunion' ? 'horas antes de la reunión' : 'horas después'}
            </span>
          </div>
        </div>

        <AvisoCondicion requiere={paso.requiere} verbo="Sale" />

        {paso.tipo !== 'audio' && (
          <div style={{ marginTop: 12 }}>
            <label style={rotuloLienzo}>Otras formas de decirlo</label>
            {(paso.variantes ?? []).length === 0 ? (
              <p style={{ fontSize: 11.5, color: 'var(--faint)', margin: 0, lineHeight: 1.45 }}>
                Sale siempre igual. Mandar el mismo texto a cientos de personas es lo que WhatsApp busca para restringir un número.
              </p>
            ) : (paso.variantes ?? []).map((v, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', marginBottom: 6 }}>
                <textarea value={v} rows={2} disabled={busy}
                  onChange={(e) => onEditarVariante(paso.orden, i, e.target.value)}
                  style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45, flex: 1 }} />
                <button onClick={() => onQuitarVariante(paso.orden, i)} title="Quitar variante"
                  style={{ background: 'none', border: 'none', color: 'var(--faint)', cursor: 'pointer', fontSize: 13, padding: '5px 2px' }}>✕</button>
              </div>
            ))}
          </div>
        )}

        <button onClick={() => onQuitarPaso(paso.orden)} disabled={busy}
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--bad)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: SANS }}>
          Quitar este mensaje
        </button>
      </>
    );
  }

  if (nodo.tipo === 'respuesta') {
    const modo = (estrategia?.modo ?? 'asistido') as ModoRespuesta;
    return (
      <>
        <label style={rotuloLienzo}>Si el lead contesta</label>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
          {([['asistido', 'MaKo deja el borrador'], ['automatico', 'Se frena y sigues tú']] as const).map(([v, t]) => (
            <button key={v} onClick={() => onModo(v)} disabled={busy} aria-pressed={modo === v}
              style={{
                padding: '6px 11px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: SANS,
                border: `1px solid ${modo === v ? 'var(--primary)' : 'var(--border-strong)'}`,
                background: modo === v ? 'var(--primary-bg)' : 'var(--surface)',
                color: modo === v ? 'var(--primary)' : 'var(--dim)',
              }}>{modo === v ? '✓ ' : ''}{t}</button>
          ))}
        </div>
      </>
    );
  }

  if (nodo.tipo === 'desenlace') {
    return (
      <>
        <label style={rotuloLienzo}>Termina bien cuando</label>
        <Dropdown
          value={String(des.logrado ?? 'respondio')}
          options={[
            { value: 'respondio', label: 'El lead contesta' },
            { value: 'agendo', label: 'El lead agenda' },
            { value: 'pago', label: 'El lead paga' },
            { value: 'ninguno', label: 'No cierra sola' },
          ]}
          onChange={(v) => cambiarDes({ logrado: v as Desenlace['logrado'] })}
          width="100%" ariaLabel="Qué cuenta como objetivo cumplido"
        />
        <div style={{ marginTop: 10 }}>
          <label style={rotuloLienzo}>Se da por perdida a las</label>
          <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
            <input type="number" min={0} step={1} value={des.falloHoras ?? 0} disabled={busy}
              onChange={(e) => cambiarDes({ falloHoras: Math.max(0, Number(e.target.value)) })}
              style={{ ...inpLienzo, width: 90 }} />
            <span style={{ fontSize: 12.5, color: 'var(--dim)' }}>horas sin respuesta</span>
          </div>
          <p style={{ fontSize: 11, color: 'var(--faint)', marginTop: 5, marginBottom: 0 }}>0: no se pierde nunca.</p>
        </div>
        <div style={{ marginTop: 12 }}>
          <label style={rotuloLienzo}>✅ Si lo logra, sigue con</label>
          <Dropdown value={des.logradoSecuencia ?? ''} options={opcionesSecuencia}
            onChange={(v) => cambiarDes({ logradoSecuencia: v || null })} width="100%" ariaLabel="Secuencia que sigue si se logra" />
        </div>
        <div style={{ marginTop: 10 }}>
          <label style={rotuloLienzo}>🏁 Si se pierde, sigue con</label>
          <Dropdown value={des.falloSecuencia ?? ''} options={opcionesSecuencia}
            onChange={(v) => cambiarDes({ falloSecuencia: v || null })} width="100%" ariaLabel="Secuencia que sigue si se pierde" />
        </div>
      </>
    );
  }

  if (nodo.tipo === 'ir-a' && nodo.claveDestino) {
    return (
      <>
        <div style={{ fontSize: 12.5, color: nodo.destinoExiste ? 'var(--ink)' : 'var(--bad)', lineHeight: 1.5, marginBottom: 10 }}>
          {nodo.destinoExiste
            ? nodo.detalle
            : 'Apunta a una secuencia que ya no existe: el lead se queda sin nada después.'}
        </div>
        {nodo.destinoExiste && (
          <button onClick={() => onAbrirSecuencia(nodo.claveDestino!)}
            style={{ padding: '8px 13px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 12.5, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
            Abrir esta secuencia
          </button>
        )}
      </>
    );
  }

  return <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{nodo.detalle}</div>;
}

/** La condición de un paso, dicha con lo que el motor HACE. La comparten el mensaje y la
 *  acción: una condición vale igual para los dos, y dos copias del texto se separan. */
function AvisoCondicion({ requiere, verbo }: { requiere: PasoSecuenciaDto['requiere']; verbo: 'Sale' | 'Corre' }) {
  if (!requiere) return null;
  return (
    <p style={{ fontSize: 11, color: CONDICIONES_VIVAS.has(requiere) ? 'var(--faint)' : 'var(--warn)', lineHeight: 1.45, marginTop: 9, marginBottom: 0 }}>
      {CONDICIONES_VIVAS.has(requiere)
        ? `${verbo} ${CONDICION_TXT[requiere]}.`
        : `Dice «solo si no contestó», pero hoy ${verbo.toLowerCase()} siempre: el motor todavía no mira esa condición.`}
    </p>
  );
}
