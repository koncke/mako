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

import { useState } from 'react';
import { Dropdown } from '../components/Dropdown';
import { Lienzo, TarjetaNodo, inpLienzo, rotuloLienzo } from '@/app/_components/Lienzo';
import { AudioPlay } from '@/app/whatsapp/_shared/AudioPlay';
import { BURBUJA_SALIENTE } from '@/app/whatsapp/_shared/BurbujaMaKo';
import { PasoAudioControl } from './PasoAudioControl';
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
  onEditarVariante, onQuitarVariante,
  onModo, onDesenlace, onAntiguedad, onAbrirSecuencia,
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
  onModo: (m: ModoRespuesta) => void;
  onDesenlace: (d: Desenlace) => void;
  onAntiguedad: (h: number | null) => void;
  /** Abrir OTRA secuencia: es el «Go To», y tiene que llevar de verdad. */
  onAbrirSecuencia: (clave: string) => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const grafo = grafoDeSecuencia(pasos as PasoParaGrafo[], estrategia, etiquetaEtapa, secuencias);
  const pasoDe = (n: NodoFlujo) => (n.orden != null ? pasos.find((x) => x.orden === n.orden) ?? null : null);

  return (
    <Lienzo
      grafo={grafo} seleccion={sel} onSeleccion={setSel}
      ayuda="Toca un paso para editarlo."
      renderNodo={(n, activo) => (
        <TarjetaNodo key={n.id} nodo={n} activo={activo} roto={n.tipo === 'ir-a' && n.destinoExiste === false}>
          {n.tipo === 'mensaje' && pasoDe(n)
            ? <VistaMensaje paso={pasoDe(n)!} audios={audios} negocio={negocio} />
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
          onModo={onModo} onDesenlace={onDesenlace} onAntiguedad={onAntiguedad}
          onAbrirSecuencia={onAbrirSecuencia}
        />
      )}
      accion={rolAdmin ? (
        <button onClick={onAgregarPaso} disabled={busy}
          style={{
            padding: '9px 14px', borderRadius: 10, border: '1px dashed var(--border-strong)',
            background: 'var(--surface)', color: 'var(--dim)', fontFamily: SANS,
            fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}>＋ Mensaje</button>
      ) : undefined}
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
  onModo, onDesenlace, onAntiguedad, onAbrirSecuencia,
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
  onModo: (m: ModoRespuesta) => void;
  onDesenlace: (d: Desenlace) => void;
  onAntiguedad: (h: number | null) => void;
  onAbrirSecuencia: (clave: string) => void;
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
        <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 12 }}>{nodo.detalle}</div>
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
      </>
    );
  }

  if (nodo.tipo === 'mensaje' && paso) {
    return (
      <>
        {paso.tipo === 'audio' ? (
          <PasoAudioControl
            orden={paso.orden} audios={audios} audioId={paso.audio_id ?? null} disabled={busy}
            onElegir={(id) => onAudio(paso.orden, id)} onGrabado={onAudioNuevo} onError={onError}
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
            <label style={rotuloLienzo}>El mensaje</label>
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

        {paso.requiere && (
          <p style={{ fontSize: 11, color: CONDICIONES_VIVAS.has(paso.requiere) ? 'var(--faint)' : 'var(--warn)', lineHeight: 1.45, marginTop: 9, marginBottom: 0 }}>
            {CONDICIONES_VIVAS.has(paso.requiere)
              ? `Sale ${CONDICION_TXT[paso.requiere]}.`
              : 'Dice «solo si no contestó», pero hoy sale siempre: el motor todavía no mira esa condición.'}
          </p>
        )}

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
