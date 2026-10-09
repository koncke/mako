'use client';

// =============================================================================
// RecordatorioFlujo — el recordatorio de la reunión AL LEAD, dibujado como una automatización más
// =============================================================================
// Pedido de Martín (08/10/2026, punto 2), textual: «No entiendo por qué está el "Recordatorio de
// la reunión" cuando eso debe configurarse en las tarjetas!!!». Era un renglón arriba del lienzo
// con un interruptor y un modal de tres textos; ahora es un ítem de la lista de automatizaciones y
// se ve con el MISMO lienzo y las mismas tarjetas que una secuencia:
//
//   CRON «Agendó una reunión» → 24 h antes → mensaje → 1 h antes → mensaje → 15 min antes → mensaje
//
// ⚠️ SÓLO SE DIBUJA: LO SIGUE MANDANDO SU EMISOR DE SIEMPRE. `mandarRecordatoriosAlLead`
// (lib/reunion-recordatorio.ts) corre cada 10 minutos con una marca por toque. Pasarlo al motor
// horario de las secuencias rompía el de 15 minutos y podía duplicar envíos
// (docs/chatbot-flujo-ramas-diseno.md §5). Está PRENDIDO en el ws1 desde el 06/10 y su primer
// envío real es ~2026-10-09T01:00Z: esta pantalla lee y escribe EXACTAMENTE el mismo setting por
// la misma ruta (`/api/chat-agent/recordatorio-reunion`: `activo` + `textos`), así que no puede
// apagarse ni salir doble por mudarse de pantalla.
//
// Lo que se puede editar es lo que el emisor permite, y nada más:
//   · los TRES toques salen siempre: un texto vacío vuelve al de fábrica (`configDeRecordatorio`),
//     así que no hay «quitar» ni «＋» — un control que borra y el texto vuelve solo es un botón roto;
//   · los minutos (`TOQUES`) son fijos en el emisor: la tarjeta de espera los DICE y no se abre;
//   · el texto de cada mensaje, con sus variables (`VARIABLES`: nombre, cuando, hora, faltan,
//     link), sin audio ni archivos — el emisor manda texto.
//
// «Activar» escribe `activo` en el acto (como el interruptor de una secuencia). Los textos se
// escriben SÓLO con «Publicar»: es lo que dice el resto del lienzo.

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { Lienzo, TarjetaNodo } from '@/app/_components/Lienzo';
import { BurbujaHilo } from '@/app/whatsapp/_shared/BurbujaHilo';
import { EditorMensajeWhatsApp, type VariableEditor } from './EditorMensajeWhatsApp';
import type { PasoSecuenciaDto } from './ChatAgentApp';
import { ANCHO_NODO, ALTO_MIN, MARGEN, encerrar, type AristaFlujo, type GrafoFlujo, type NodoFlujo } from '@/lib/lienzo-grafo';
import { TOQUES, type Toque } from '@/lib/recordatorio-lead';
// El CRON no comparte el ⚡ con la Acción (segunda tanda, decisión 9): es UN ícono para los dos lienzos.
import { ICONO_CRON } from '@/lib/flujo-conversacion';

const URL_API = '/api/chat-agent/recordatorio-reunion';

/** El nombre de la automatización en la lista y en el título. */
export const NOMBRE_RECORDATORIO = 'Recordatorio de la reunión';

type ToqueDto = { min: number; texto: string; porDefecto: boolean; textoDefault: string };
type Estado = { activo: boolean; envioWhatsapp: boolean | null; toques: ToqueDto[]; variables: string[] };

/** Cuánto antes sale cada toque, como lo dice la tarjeta de espera. Fijos: los pone el emisor. */
const ANTES: Record<Toque, string> = { 1440: '24 h antes de la reunión', 60: '1 h antes', 15: '15 min antes' };

/** Las variables del recordatorio con su rótulo. Son las de `VARIABLES` (lib/recordatorio-lead.ts). */
const ROTULO_VARIABLE: Record<string, { label: string; ejemplo: string }> = {
  nombre: { label: 'Nombre', ejemplo: 'Luis' },
  cuando: { label: 'Cuándo', ejemplo: 'mañana' },
  hora: { label: 'Hora', ejemplo: '10:00 a. m.' },
  faltan: { label: 'Cuánto falta', ejemplo: 'en 1 hora' },
  link: { label: 'Link', ejemplo: 'https://meet…' },
};

const tarjetaChrome: CSSProperties = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11,
  padding: '7px 12px', boxShadow: '0 2px 8px rgba(0,0,0,.06)',
};

const ANCHO_CRON = 220;
const ANCHO_ESPERA = 176;
const GAP = 64;

/** El grafo: una fila, de izquierda a derecha. No hay ramas: el emisor manda los tres toques. */
export function grafoRecordatorio(textos: Partial<Record<Toque, string>>): GrafoFlujo {
  const nodos: NodoFlujo[] = [];
  const aristas: AristaFlujo[] = [];
  let x = MARGEN;
  const poner = (n: Omit<NodoFlujo, 'x' | 'y'>) => {
    const prev = nodos[nodos.length - 1];
    nodos.push({ ...n, x, y: MARGEN });
    if (prev) aristas.push({ desde: prev.id, hasta: n.id, tono: 'normal' });
    x += n.ancho + GAP;
  };
  poner({ id: 'entrada', tipo: 'entrada', titulo: 'CRON', icono: ICONO_CRON, detalle: 'Agendó una reunión', ancho: ANCHO_CRON, alto: ALTO_MIN });
  for (const min of TOQUES) {
    poner({ id: `espera-${min}`, tipo: 'espera', titulo: 'Esperar', icono: '⏳', detalle: ANTES[min], ancho: ANCHO_ESPERA, alto: ALTO_MIN });
    // Un alto que crece con el texto, para que la flecha salga a la altura de la cabecera.
    const largo = (textos[min] ?? '').length;
    poner({ id: `toque-${min}`, tipo: 'mensaje', titulo: 'WhatsApp', icono: 'whatsapp', orden: min, ancho: ANCHO_NODO, alto: Math.max(ALTO_MIN + 30, 70 + Math.ceil(largo / 34) * 18) });
  }
  const caja = encerrar(nodos);
  return { nodos, aristas, ancho: caja.ancho, alto: caja.alto };
}

/** El texto de cada toque, como lo devuelve la ruta. */
const textosDe = (e: Estado): Partial<Record<Toque, string>> =>
  Object.fromEntries(e.toques.map((t) => [t.min, t.texto])) as Partial<Record<Toque, string>>;

/** Un paso de mensaje para el editor compartido: el texto del toque y nada más. */
const pasoDeToque = (min: number, texto: string): PasoSecuenciaDto => ({
  orden: min, canal: 'whatsapp', delay_horas: 0, asunto: null, cuerpo: texto,
  proveedor: 'no_oficial', template_wa: null, tipo: 'texto',
});

export function RecordatorioFlujo({ negocio, insetIzq, onCambio }: {
  negocio: string;
  /** Cuánto se corre lo que flota, para no nacer debajo de la lista. */
  insetIzq?: number;
  /** Avisa que cambió el interruptor (la lista pinta el punto de estado). */
  onCambio?: (activo: boolean) => void;
}) {
  const [estado, setEstado] = useState<Estado | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [guardando, setGuardando] = useState<'activo' | 'textos' | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  /** Los textos que se están editando, por toque. Se guardan SÓLO con «Publicar». */
  const [borrador, setBorrador] = useState<Partial<Record<Toque, string>>>({});
  const [sel, setSel] = useState<string | null>(null);

  useEffect(() => {
    let vivo = true;
    fetch(URL_API, { cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!vivo) return;
        if (!r.ok || !j.ok) { setErr(j.error || 'No se pudo leer'); return; }
        setEstado(j as Estado);
        setBorrador(textosDe(j as Estado));
        setErr(null);
      })
      .catch(() => { if (vivo) setErr('Sin conexión'); });
    return () => { vivo = false; };
  }, []);

  async function guardar(cuerpo: { activo?: boolean; textos?: Partial<Record<Toque, string>> }): Promise<Estado | null> {
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

  const activar = async () => {
    if (!estado) return;
    const v = !estado.activo;
    setGuardando('activo');
    // Optimista: el interruptor responde al toque y vuelve atrás si el server no lo guardó.
    setEstado({ ...estado, activo: v });
    const ok = await guardar({ activo: v });
    if (!ok) setEstado((e) => (e ? { ...e, activo: !v } : e));
    else onCambio?.(ok.activo);
    setGuardando(null);
  };

  const publicados = useMemo(
    () => (estado ? textosDe(estado) : {}),
    [estado],
  );
  const sinPublicar = TOQUES.some((m) => (borrador[m] ?? '') !== (publicados[m] ?? ''));

  const publicar = async () => {
    setGuardando('textos');
    const ok = await guardar({ textos: Object.fromEntries(TOQUES.map((m) => [m, borrador[m] ?? ''])) });
    if (ok) {
      // Lo que quedó es lo del server: un texto vacío vuelve al de fábrica.
      setBorrador(textosDe(ok));
      setFlash('Publicado ✓');
      setTimeout(() => setFlash(null), 2400);
    }
    setGuardando(null);
  };

  const grafo = useMemo(() => grafoRecordatorio(borrador), [borrador]);
  const variables: VariableEditor[] = (estado?.variables ?? Object.keys(ROTULO_VARIABLE)).map((k) => ({
    key: k, label: ROTULO_VARIABLE[k]?.label ?? k, ejemplo: ROTULO_VARIABLE[k]?.ejemplo,
  }));
  const toqueDe = (n: NodoFlujo): Toque | null => {
    const m = /^toque-(\d+)$/.exec(n.id);
    const min = m ? Number(m[1]) : NaN;
    return (TOQUES as readonly number[]).includes(min) ? (min as Toque) : null;
  };

  return (
    <div style={{ flex: 1, minHeight: 0, width: '100%', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <Lienzo
        grafo={grafo} sinMarco alto="100%" insetIzq={insetIzq}
        seleccion={sel}
        // Sólo los mensajes se abren: el disparador y las esperas no tienen nada que elegir.
        onSeleccion={(id) => setSel(id && /^toque-\d+$/.test(id) ? id : null)}
        renderNodo={(n, activo) => {
          const min = toqueDe(n);
          return (
            <TarjetaNodo key={n.id} nodo={n} activo={activo}>
              {min != null
                ? <BurbujaHilo compacta saliente autor={negocio} contenido={{ texto: borrador[min] ?? '' }} />
                : <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--ink)', lineHeight: 1.45 }}>{n.detalle}</div>}
            </TarjetaNodo>
          );
        }}
        renderEditor={(n) => {
          const min = toqueDe(n);
          if (min == null) return null;
          const t = estado?.toques.find((x) => x.min === min);
          const valor = borrador[min] ?? '';
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ fontSize: 12, color: 'var(--dim)' }}>{ANTES[min]}</div>
              <EditorMensajeWhatsApp
                key={`toque-${min}`}
                paso={pasoDeToque(min, valor)}
                onChange={(patch) => { if (patch.cuerpo !== undefined) setBorrador((b) => ({ ...b, [min]: patch.cuerpo ?? '' })); }}
                audios={[]} variables={variables} negocio={negocio}
                permiteIA={false} permiteAudio={false} permiteAdjuntos={false} mostrarRevisar={false}
                placeholder="El recordatorio"
              />
              {t && valor.trim() !== t.textoDefault && (
                <button type="button" onClick={() => setBorrador((b) => ({ ...b, [min]: t.textoDefault }))}
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', padding: 0, font: 'inherit', fontSize: 12, color: 'var(--primary)', cursor: 'pointer' }}>
                  Original
                </button>
              )}
            </div>
          );
        }}
        chrome={(
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ ...tarjetaChrome, minWidth: 0, maxWidth: 400, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 'none', fontSize: 18, lineHeight: 1 }}>📅</span>
              <span style={{ minWidth: 0, color: 'var(--ink)', fontSize: 14.5, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{NOMBRE_RECORDATORIO}</span>
            </div>
            <div style={{ ...tarjetaChrome, flex: 'none', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: estado?.activo ? 'var(--good)' : 'var(--dim)' }}>Activar</span>
              <button onClick={() => void activar()} disabled={!estado || guardando === 'activo'} aria-pressed={!!estado?.activo}
                aria-label="Activar el recordatorio" title={estado?.activo ? 'Pausar' : 'Activar'}
                style={{ width: 38, height: 22, borderRadius: 999, border: 'none', padding: 2, background: estado?.activo ? 'var(--good)' : 'var(--border-strong)', cursor: estado ? 'pointer' : 'default', flex: 'none', transition: 'background .15s' }}>
                <span style={{ display: 'block', width: 18, height: 18, borderRadius: '50%', background: '#fff', transform: estado?.activo ? 'translateX(16px)' : 'none', transition: 'transform .15s' }} />
              </button>
            </div>
            {/* Prendido no es «sale»: con el envío de WhatsApp apagado no sale nada. `null` = no se
                pudo leer, y entonces no se afirma nada. */}
            {estado?.activo && estado.envioWhatsapp === false && (
              <span style={{ ...tarjetaChrome, flex: 'none', fontSize: 12.5, fontWeight: 600, color: 'var(--warn)' }}>Envío apagado</span>
            )}
            {err && <span style={{ ...tarjetaChrome, flex: 'none', fontSize: 12.5, color: 'var(--bad)' }}>{err}</span>}
          </div>
        )}
        accion={(
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            {flash && <span style={{ ...tarjetaChrome, fontSize: 12.5, fontWeight: 600, color: 'var(--good)' }}>{flash}</span>}
            <button onClick={() => void publicar()} disabled={!estado || !sinPublicar || guardando === 'textos'}
              style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: sinPublicar ? 'pointer' : 'default', opacity: !sinPublicar || guardando === 'textos' ? 0.45 : 1, fontFamily: 'inherit' }}>
              {guardando === 'textos' ? 'Publicando…' : 'Publicar'}
            </button>
          </div>
        )}
      />
    </div>
  );
}
