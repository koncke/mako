'use client';

// =============================================================================
// FlujoAviso — lo que MaKo te dice A VOS, dibujado como flujo y editable ahí
// =============================================================================
// El pedido apuntando a Configuraciones › Notificaciones: «una pantalla tipo
// flujo, y ahí se edita todo». Y la segunda tanda, punto por punto: el lienzo
// ocupa todo el recuadro, las tarjetas se arrastran, se pueden agregar pasos, el
// disparador ofrece los eventos que existen, y el nodo «te llega» se va porque
// «es un paso que no hace nada».
//
// ── UN SOLO DUEÑO DEL FLUJO ────────────────────────────────────────────────
// Este componente lee y escribe el `Flujo` del mensaje —disparador, `insistir` y
// los pasos— y es el único que lo hace. Antes el paso `insistir` lo escribía
// `Recordatorios` por su cuenta: con el lienzo tocando también el disparador,
// eso eran dos dueños del MISMO objeto y `setFlujo` reemplaza el flujo entero, así
// que el segundo en guardar se llevaba puesto lo del primero. Aquel componente se
// absorbió acá con todo lo suyo (las dos opciones, los números, el techo dicho y
// el aviso de WhatsApp apagado).
//
// ── QUÉ CORRE DE VERDAD, Y QUÉ LO DICE ─────────────────────────────────────
// El aviso sale por su camino de siempre (su call site o su cron). Lo que este
// flujo agrega lo ejecuta `dispararEvento` (lib/flujos.ts), y SÓLO cuando pasa uno
// de los cinco eventos cableados. O sea:
//   · el `insistir` corre por los DOS caminos (el choke point de avisos lo lee);
//   · un paso de acción o un mensaje al lead corren sólo por el del EVENTO.
// Por eso un paso agregado sin evento elegido se dibuja con su advertencia en vez
// de en silencio: un paso que no corre y no lo dice es el control que se dibuja y
// no hace nada.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Lienzo, TarjetaNodo, inpLienzo, rotuloLienzo } from '@/app/_components/Lienzo';
import { TextoMarcas } from '@/app/_components/TextoMarcas';
import { BURBUJA_SALIENTE } from '@/app/whatsapp/_shared/BurbujaMaKo';
import { Dropdown } from '../components/Dropdown';
import { Disparador } from './Disparador';
import { EditorMensaje } from './EditorMensaje';
import { grafoDeAviso, podarPosiciones, esInsistir, pasosDibujados, insertarPasoTras, quitarPasoDibujado, type AvisoParaGrafo, type Posiciones } from '@/lib/flujo-aviso';
import {
  EVENTOS, INSISTIR_MAX_VECES, INSISTIR_MIN_MINUTOS, sanearInsistir,
  type Flujo, type Paso, type AccionFlujo,
} from '@/lib/flujos-tipos';
import type { NodoFlujo } from '@/lib/lienzo-grafo';

const SANS = "'Geist', sans-serif";

const btnFantasma = {
  padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border-strong)',
  background: 'var(--surface)', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600,
  cursor: 'pointer', fontFamily: SANS,
} as const;

const ACCIONES: Array<{ value: AccionFlujo; label: string }> = [
  { value: 'crear_tarea', label: 'Crear una tarea' },
  { value: 'inscribir_nutricion', label: 'Inscribir en nutrición' },
  { value: 'marcar_lead', label: 'Marcar el lead' },
];

const FLUJO_VACIO: Flujo = { version: 1, activo: true, disparador: { tipo: 'manual' }, pasos: [] };

export function FlujoAviso({
  id, disparador, frecuenciaMin, texto, canales, posiciones, endpoint, editable, guardando,
  onTexto, onCambio, probando, prueba, onProbar, chrome, pie,
}: {
  id: string;
  disparador: string;
  frecuenciaMin: number;
  texto: string;
  canales: { wa: boolean; email: boolean };
  posiciones: Posiciones;
  endpoint: string;
  /** Los avisos que redacta MaKo no dejan editar su TEXTO: son hechos exactos. */
  editable: boolean;
  guardando: boolean;
  onTexto: (v: string) => void;
  onCambio?: () => void;
  probando: boolean;
  prueba: string | null;
  onProbar: () => void;
  /** El título, el interruptor y la salida: flotan SOBRE el lienzo. */
  chrome?: React.ReactNode;
  /** Lo que va abajo a la derecha del lienzo. Hoy es «Publicar», y lo pone el
   *  detalle porque es él el que sabe qué está sin publicar. */
  pie?: React.ReactNode;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const [flujo, setFlujo] = useState<Flujo | null>(null);
  const [pos, setPos] = useState<Posiciones>(posiciones);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const api = useCallback(async (body: unknown) => {
    try {
      const r = await (await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })).json();
      if (!r?.ok) setErr(r?.error || 'No se pudo guardar');
      return r;
    } catch (e) { setErr(e instanceof Error ? e.message : 'No se pudo guardar'); return { ok: false }; }
  }, [endpoint]);

  useEffect(() => {
    let vivo = true;
    void api({ action: 'flujo-get', id }).then((r) => { if (vivo) setFlujo((r?.flujo as Flujo | null) ?? null); });
    return () => { vivo = false; };
  }, [api, id]);

  async function guardarFlujo(f: Flujo | null) {
    setBusy(true); setErr(null);
    const r = await api({ action: 'flujo-set', id, flujo: f });
    if (r?.ok) setFlujo((r.flujo as Flujo | null) ?? null);
    setBusy(false);
  }

  const insistir = (flujo?.pasos ?? []).find(esInsistir) ?? null;
  const pasosExtra = pasosDibujados(flujo?.pasos ?? []);

  const aviso: AvisoParaGrafo = {
    disparador, frecuenciaMin, texto, canales, posiciones: pos,
    insistir: insistir ? { cadaMin: insistir.cadaMin, veces: insistir.veces } : null,
    evento: flujo?.disparador ?? null,
    pasos: pasosExtra,
  };
  const grafo = grafoDeAviso(aviso);

  // ⚠️ EL GUARDADO DE LA POSICIÓN ES OPTIMISTA Y SE DEBE. Arrastrar tiene que
  // responder en el frame; esperar el POST deja la tarjeta volviendo a su lugar
  // cada vez. Si falla, se dice — no se revierte: revertir una posición a mitad de
  // una sesión de acomodar es más desconcertante que un cartel.
  const guardarPos = useRef<ReturnType<typeof setTimeout> | null>(null);
  function mover(nodoId: string, x: number, y: number) {
    const sig = podarPosiciones({ ...pos, [nodoId]: { x, y } }, grafo.nodos.map((n) => n.id));
    setPos(sig);
    if (guardarPos.current) clearTimeout(guardarPos.current);
    guardarPos.current = setTimeout(() => { void api({ action: 'posiciones', id, posiciones: sig }); }, 450);
  }

  /**
   * AGREGAR UN PASO DESPUÉS DE ESTA TARJETA.
   *
   * El único tipo que queda es la ACCIÓN: «eliminar "mensaje al lead", ya que no
   * estamos configurando el chatbot». Con un solo tipo el ＋ no abre ningún menú —
   * un desplegable de una opción es una pregunta que ya está contestada.
   *
   * Dónde entra sale del id del nodo: los pasos del grafo son `paso-<i>`, así que
   * el ＋ de `paso-2` inserta en la posición 3 y el de cualquier nodo del tronco
   * (entrada, mensaje, recordatorio) inserta al principio. Eso es lo que hace que
   * el botón diga DÓNDE va a caer el paso, que es lo que un botón suelto en una
   * esquina no puede decir.
   */
  function agregarTras(nodoId: string) {
    const base = flujo ?? FLUJO_VACIO;
    const nuevo: Paso = { tipo: 'accion', accion: 'crear_tarea' };
    void guardarFlujo({ ...base, activo: true, pasos: insertarPasoTras(base.pasos, nodoId, nuevo) });
  }

  return (
    <>
      <Lienzo
        grafo={grafo} seleccion={sel} onSeleccion={setSel} onMover={mover}
        onAgregarTras={editable && !busy ? agregarTras : undefined}
        chrome={chrome} sinMarco alto="100%"
        renderNodo={(n, activo) => (
          <TarjetaNodo key={n.id} nodo={n} activo={activo} roto={Boolean(n.advertencia)}>
            {n.tipo === 'mensaje' && n.id === 'mensaje'
              ? (
                <div style={{ ...BURBUJA_SALIENTE, maxWidth: '100%', padding: '9px 11px', fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                  {texto.trim() ? <TextoMarcas texto={texto} /> : <span style={{ color: 'var(--faint)' }}>Sin escribir</span>}
                </div>
              )
              : <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{n.detalle}</div>}
          </TarjetaNodo>
        )}
        renderEditor={(n) => (
          <EditorDelAviso
            nodo={n} id={id} disparador={disparador} frecuenciaMin={frecuenciaMin}
            texto={texto} endpoint={endpoint} editable={editable} guardando={guardando || busy}
            canales={canales} flujo={flujo} insistir={insistir}
            onTexto={onTexto} onCambio={onCambio} onFlujo={guardarFlujo}
            onQuitarPaso={(i) => {
              const base = flujo ?? FLUJO_VACIO;
              void guardarFlujo({ ...base, pasos: quitarPasoDibujado(base.pasos, i) });
              setSel(null);
            }}
            probando={probando} prueba={prueba} onProbar={onProbar}
          />
        )}
        accion={pie}
      />
      {err && (
        <div style={{ flex: 'none', marginTop: 8, fontSize: 12.5, fontWeight: 600, color: 'var(--bad)' }}>{err}</div>
      )}
    </>
  );
}

// ── El editor de cada nodo ──────────────────────────────────────────────────

function EditorDelAviso({
  nodo, id, disparador, frecuenciaMin, texto, endpoint, editable, guardando, canales,
  flujo, insistir, onTexto, onCambio, onFlujo, onQuitarPaso, probando, prueba, onProbar,
}: {
  nodo: NodoFlujo; id: string; disparador: string; frecuenciaMin: number; texto: string;
  endpoint: string; editable: boolean; guardando: boolean; canales: { wa: boolean; email: boolean };
  flujo: Flujo | null;
  insistir: Extract<Paso, { tipo: 'insistir' }> | null;
  onTexto: (v: string) => void;
  onCambio?: () => void;
  onFlujo: (f: Flujo | null) => void;
  onQuitarPaso: (i: number) => void;
  probando: boolean; prueba: string | null; onProbar: () => void;
}) {
  const base = flujo ?? FLUJO_VACIO;

  if (nodo.tipo === 'entrada') {
    const d = base.disparador;
    const actual = d.tipo === 'evento' ? d.evento : '';
    return (
      <>
        <div style={{ fontSize: 12, color: 'var(--dim)', lineHeight: 1.5, marginBottom: 12, whiteSpace: 'pre-wrap' }}>{disparador}</div>
        <Disparador
          id={id} disparador={disparador} frecuenciaMin={frecuenciaMin}
          endpoint={endpoint} onCambio={onCambio} compacto
        />
        <div style={{ marginTop: 12 }}>
          <label style={rotuloLienzo}>Y también cuando…</label>
          <Dropdown
            value={actual}
            options={[{ value: '', label: 'Nada más: sólo lo de arriba' }, ...EVENTOS.map((e) => ({ value: e.key, label: e.label }))]}
            onChange={(v) => onFlujo({
              ...base, activo: true,
              disparador: v ? { tipo: 'evento', evento: v as typeof EVENTOS[number]['key'] } : { tipo: 'manual' },
            })}
            width="100%" ariaLabel="Otro evento que dispare este mensaje"
          />
          {/* Los cinco son los que tienen un choke point cableado. La lista no se
              inventa: un evento sin choke point es una opción que no ocurre nunca. */}
          <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 7, marginBottom: 0 }}>
            Además de lo de arriba, este mensaje también sale cuando pasa esto.
          </p>
        </div>
      </>
    );
  }

  if (nodo.id === 'mensaje') {
    if (!editable) {
      return (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}><TextoMarcas texto={texto} /></div>
          <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 9, marginBottom: 0 }}>
            Este lo redacta MaKo: informa algo técnico y tiene que decir exactamente lo que pasó.
          </p>
        </>
      );
    }
    return (
      <>
        <EditorMensaje valor={texto} onChange={onTexto} filas={6} disabled={guardando} />
        <button onClick={onProbar} disabled={probando} style={{ ...btnFantasma, marginTop: 10 }}>
          {probando ? 'Escribiendo…' : '✨ Que lo escriba MaKo'}
        </button>
        {/* ⚠️ LA SUGERENCIA SE APLICA, NO SE MIRA. El botón dejaba un texto en azul
            debajo y no tocaba el mensaje: «no hace nada, me escribe algo abajo pero
            no cambia el texto». Un botón que produce algo y no lo pone donde va es
            medio botón. Nada se guarda hasta «Guardar», así que es reversible. */}
        {prueba && prueba !== texto && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--primary-strong)', marginBottom: 5 }}>MaKo lo escribiría así</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5, marginBottom: 8 }}><TextoMarcas texto={prueba} /></div>
            <button onClick={() => onTexto(prueba)} style={{ ...btnFantasma, background: 'var(--primary)', color: '#fff', border: 'none' }}>
              Usar este texto
            </button>
          </div>
        )}
      </>
    );
  }

  if (nodo.tipo === 'respuesta' || nodo.tipo === 'recordatorio') {
    const prender = () => onFlujo({
      ...base, activo: true,
      pasos: [...base.pasos.filter((p) => p.tipo !== 'insistir'), sanearInsistir({ texto: '', cadaMin: INSISTIR_MIN_MINUTOS, veces: 2 })],
    });
    const apagar = () => {
      const pasos = base.pasos.filter((p) => p.tipo !== 'insistir');
      // Sin pasos y sin evento, el flujo no tiene nada que hacer: se va entero. Y
      // `setFlujo` cierra las insistencias ya abiertas — apagar algo que tiene cola
      // tiene que cerrar la cola, o siguen saliendo hasta cinco mensajes más.
      onFlujo(pasos.length || base.disparador.tipo !== 'manual' ? { ...base, pasos } : null);
    };
    const cambiar = (p: Partial<{ cadaMin: number; veces: number }>) => {
      if (!insistir) return;
      const nuevo = sanearInsistir({ ...insistir, ...p });
      onFlujo({ ...base, pasos: base.pasos.map((x) => (x.tipo === 'insistir' ? nuevo : x)) });
    };
    return (
      <>
        <div style={{ display: 'flex', gap: 7, marginBottom: insistir ? 12 : 0 }}>
          <Opcion activa={!insistir} onClick={() => insistir && apagar()} disabled={guardando}>Se manda una vez</Opcion>
          <Opcion activa={!!insistir} onClick={() => !insistir && prender()} disabled={guardando}>Te lo recuerdo</Opcion>
        </div>
        {insistir && (
          <>
            <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--ink)', flexWrap: 'wrap' }}>
              Cada
              <input type="number" min={INSISTIR_MIN_MINUTOS} step={15} value={insistir.cadaMin} disabled={guardando}
                onChange={(e) => cambiar({ cadaMin: Number(e.target.value) })}
                style={{ ...inpLienzo, width: 76 }} />
              min, hasta
              <input type="number" min={1} max={INSISTIR_MAX_VECES} value={insistir.veces} disabled={guardando}
                onChange={(e) => cambiar({ veces: Number(e.target.value) })}
                style={{ ...inpLienzo, width: 62 }} />
              veces
            </label>
            {/* El techo se DICE, no se ofrece como campo: es lo único que impide que
                esto se convierta en quemar la línea de WhatsApp del cliente. */}
            <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 7, marginBottom: 0 }}>
              Se corta apenas alguien escribe «ok» en el grupo, y de noche espera a la mañana.
              El máximo son {INSISTIR_MAX_VECES} cada {INSISTIR_MIN_MINUTOS} minutos.
            </p>
            {!canales.wa && (
              <p style={{ fontSize: 11.5, color: 'var(--warn)', lineHeight: 1.45, marginTop: 6, marginBottom: 0 }}>
                Los recordatorios salen por WhatsApp, y este mensaje lo tienes apagado ahí.
              </p>
            )}
          </>
        )}
      </>
    );
  }

  // Un paso agregado: acción o mensaje al lead.
  if (nodo.tipo === 'accion' || nodo.tipo === 'mensaje-lead') {
    const i = nodo.orden ?? 0;
    const vivos = pasosDibujados(base.pasos);
    const paso = vivos[i];
    const reemplazar = (nuevo: Paso) => onFlujo({ ...base, pasos: base.pasos.map((p) => (p === paso ? nuevo : p)) });
    return (
      <>
        {paso?.tipo === 'accion' && (
          <>
            <label style={rotuloLienzo}>Qué hace</label>
            <Dropdown value={paso.accion} options={ACCIONES}
              onChange={(v) => reemplazar({ ...paso, accion: v as AccionFlujo })}
              width="100%" ariaLabel="Qué hace este paso" />
          </>
        )}
        {paso?.tipo === 'mensaje' && (
          <>
            <label style={rotuloLienzo}>Qué le escribe al lead</label>
            <textarea value={paso.texto} rows={4} disabled={guardando}
              onChange={(e) => reemplazar({ ...paso, texto: e.target.value })}
              style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45 }} />
          </>
        )}
        <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 8, marginBottom: 0 }}>
          {/* No se dispara solo NUNCA: la regla del negocio es que MaKo propone y una
              persona confirma. Decirlo acá evita la sorpresa del primer disparo. */}
          {paso?.tipo === 'mensaje'
            ? 'MaKo te lo propone en el grupo y sale con tu «sí». Nunca se manda solo.'
            : 'MaKo te lo propone en el grupo y se hace con tu «sí».'}
        </p>
        {nodo.advertencia && (
          <p style={{ fontSize: 11.5, color: 'var(--warn)', lineHeight: 1.45, marginTop: 6, marginBottom: 0 }}>{nodo.advertencia}</p>
        )}
        <button onClick={() => onQuitarPaso(i)} disabled={guardando}
          style={{ marginTop: 12, background: 'none', border: 'none', color: 'var(--bad)', fontSize: 12, fontWeight: 600, cursor: 'pointer', padding: 0, fontFamily: SANS }}>
          Quitar este paso
        </button>
      </>
    );
  }

  return <div style={{ fontSize: 12.5, color: 'var(--dim)', lineHeight: 1.5 }}>{nodo.detalle}</div>;
}

function Opcion({ activa, onClick, disabled, children }: {
  activa: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={activa}
      style={{
        padding: '5px 12px', borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
        fontSize: 12.5, fontWeight: 600, fontFamily: SANS,
        border: `1px solid ${activa ? 'var(--primary)' : 'var(--border-strong)'}`,
        background: activa ? 'var(--primary-bg)' : 'var(--surface)',
        color: activa ? 'var(--primary)' : 'var(--dim)', opacity: disabled ? 0.6 : 1,
      }}>
      {activa ? '✓ ' : ''}{children}
    </button>
  );
}
