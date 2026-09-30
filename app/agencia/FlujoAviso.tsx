'use client';

// =============================================================================
// FlujoAviso — lo que MaKo te dice A VOS, dibujado como flujo
// =============================================================================
// El pedido llegó apuntando a ESTA pantalla: «Quiero que los editables del flujo
// de conversación sea como el editable de Manychat, que tiene una pantalla tipo
// flujo, y ahí se edita todo». La primera vez lo construí en /chatbot —elegí por
// dónde estaban las filas— y él estaba mirando Configuraciones › Notificaciones.
//
// Acá vive lo PROPIO de un aviso: cuatro nodos y qué se edita en cada uno. El
// gesto, el encuadre, las curvas y el panel son de `app/_components/Lienzo.tsx`,
// el mismo que dibuja la conversación con un lead.
//
// ── NO HAY UN SEGUNDO EDITOR DE NADA ───────────────────────────────────────
// Cada nodo abre el control que YA existía, tal cual, con su propio guardado:
// `Disparador` para cada cuánto, `EditorMensaje` para el texto, `Recordatorios`
// para la insistencia. Reescribirlos adentro del lienzo habría dejado dos
// escrituras del mismo dato — que es exactamente lo que esta tab ya pagó una vez
// con los dos interruptores de canal que decían cosas distintas.
//
// Lo único que se agrega es el prop `compacto`: adentro de un nodo, el rótulo y
// el hecho ya los dibuja la tarjeta, y repetirlos convierte un panel de 328 px en
// una columna de títulos.

import { useState } from 'react';
import { Lienzo, TarjetaNodo } from '@/app/_components/Lienzo';
import { BURBUJA_SALIENTE } from '@/app/whatsapp/_shared/BurbujaMaKo';
import { Disparador } from './Disparador';
import { Recordatorios } from './Recordatorios';
import { EditorMensaje } from './EditorMensaje';
import { grafoDeAviso, type AvisoParaGrafo } from '@/lib/flujo-aviso';
import type { NodoFlujo } from '@/lib/lienzo-grafo';

const SANS = "'Geist', sans-serif";

export function FlujoAviso({
  id, disparador, frecuenciaMin, texto, canales, endpoint, editable, guardando,
  insistir, onTexto, onInsistir, onCambio, probando, prueba, onProbar,
}: {
  id: string;
  disparador: string;
  frecuenciaMin: number;
  texto: string;
  canales: { wa: boolean; email: boolean };
  endpoint: string;
  /** Los avisos que redacta MaKo no dejan editar su TEXTO: son hechos exactos. */
  editable: boolean;
  guardando: boolean;
  /** El paso `insistir` tal como lo reporta `Recordatorios`. Lo necesita el GRAFO:
   *  sin esto el nodo del recordatorio no se puede dibujar. */
  insistir: { cadaMin: number; veces: number } | null;
  onTexto: (v: string) => void;
  onInsistir: (p: { cadaMin: number; veces: number } | null) => void;
  onCambio?: () => void;
  probando: boolean;
  prueba: string | null;
  onProbar: () => void;
}) {
  const [sel, setSel] = useState<string | null>(null);
  const aviso: AvisoParaGrafo = { disparador, frecuenciaMin, texto, canales, insistir, activo: true };
  const grafo = grafoDeAviso(aviso);

  return (
    <Lienzo
      grafo={grafo} seleccion={sel} onSeleccion={setSel}
      ayuda="Toca un paso para editarlo."
      alto="min(48svh, 420px)"
      renderNodo={(n, activo) => (
        <TarjetaNodo key={n.id} nodo={n} activo={activo} roto={Boolean(n.advertencia)}>
          {n.tipo === 'mensaje'
            ? (
              <div style={{ ...BURBUJA_SALIENTE, maxWidth: '100%', padding: '9px 11px', fontSize: 12.5, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                {texto.trim() || <span style={{ color: 'var(--faint)' }}>Sin escribir</span>}
              </div>
            )
            : <div style={{ fontSize: 12, color: 'var(--ink)', lineHeight: 1.45 }}>{n.detalle}</div>}
        </TarjetaNodo>
      )}
      renderEditor={(n) => (
        <EditorDelAviso
          nodo={n} id={id} disparador={disparador} frecuenciaMin={frecuenciaMin}
          texto={texto} endpoint={endpoint} editable={editable} guardando={guardando}
          porWhatsApp={canales.wa} onTexto={onTexto} onInsistir={onInsistir} onCambio={onCambio}
          probando={probando} prueba={prueba} onProbar={onProbar}
        />
      )}
    />
  );
}

function EditorDelAviso({
  nodo, id, disparador, frecuenciaMin, texto, endpoint, editable, guardando,
  porWhatsApp, onTexto, onInsistir, onCambio, probando, prueba, onProbar,
}: {
  nodo: NodoFlujo; id: string; disparador: string; frecuenciaMin: number; texto: string;
  endpoint: string; editable: boolean; guardando: boolean; porWhatsApp: boolean;
  onTexto: (v: string) => void;
  onInsistir: (p: { cadaMin: number; veces: number } | null) => void;
  onCambio?: () => void;
  probando: boolean; prueba: string | null; onProbar: () => void;
}) {
  if (nodo.tipo === 'entrada') {
    return (
      <Disparador
        id={id} disparador={disparador} frecuenciaMin={frecuenciaMin}
        endpoint={endpoint} onCambio={onCambio} compacto
      />
    );
  }

  if (nodo.tipo === 'mensaje') {
    if (!editable) {
      return (
        <>
          <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{texto}</div>
          <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 9, marginBottom: 0 }}>
            Este lo redacta MaKo: informa algo técnico y tiene que decir exactamente lo que pasó.
          </p>
        </>
      );
    }
    return (
      <>
        <EditorMensaje valor={texto} onChange={onTexto} filas={7} disabled={guardando} />
        <button onClick={onProbar} disabled={probando}
          style={{
            marginTop: 10, padding: '7px 12px', borderRadius: 9, border: '1px solid var(--border-strong)',
            background: 'transparent', color: 'var(--dim)', fontSize: 12.5, fontWeight: 600,
            cursor: 'pointer', fontFamily: SANS, opacity: probando ? 0.6 : 1,
          }}>{probando ? 'Generando…' : '✨ Probar con IA'}</button>
        {prueba && (
          <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: 'var(--primary-bg)', border: '1px solid var(--primary-weak)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, color: 'var(--primary-strong)', marginBottom: 4 }}>MaKo lo escribiría así</div>
            <div style={{ fontSize: 12.5, color: 'var(--ink)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{prueba}</div>
          </div>
        )}
      </>
    );
  }

  if (nodo.tipo === 'respuesta' || nodo.tipo === 'recordatorio') {
    return <Recordatorios plantillaId={id} endpoint={endpoint} porWhatsApp={porWhatsApp} onEstado={onInsistir} compacto />;
  }

  // La salida es un HECHO: por dónde llega lo decide el tile por el que entraste
  // a este mensaje, no un control acá adentro. Dos lugares para la misma decisión
  // es el switch que miente, y esta tab ya lo pagó.
  return (
    <>
      <div style={{ fontSize: 12.5, color: 'var(--ink)', lineHeight: 1.5 }}>{nodo.detalle}</div>
      <p style={{ fontSize: 11, color: 'var(--faint)', lineHeight: 1.45, marginTop: 8, marginBottom: 0 }}>
        Se elige en el recuadro de WhatsApp o el de Email, que es por donde entras a este mensaje.
      </p>
    </>
  );
}
