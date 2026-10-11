'use client';

// =============================================================================
// EditorPasoIA — la tarjeta «AI STEP» del lienzo de /automations: su cuerpo y su editor
// =============================================================================
// Novena tanda (10/10/2026): «Todo lo que hiciste de una cantidad impresionante de flujos y tarjetas eso
// justamente debería estar en una nueva tarjeta que sea "AI Step". Configuralo allí».
//
// AI STEP v2 (décima tanda, 11/10/2026, FEEDBACK AI STEP 1-8; el diseño en docs/diseno-ai-step-v2.md):
//   · «solo permitir 1 caso por tarjeta de AI Step, y si quieren pueden crear otra tarjeta» → UN caso, y al
//     pie «＋ Otro AI Step» (crea otra tarjeta del mismo medio y la abre). «＋ Caso» se fue, y con él el scroll
//     lateral y el tacho tapado del punto 3.
//   · «Un "Caso" debe ser como el CRON, tener pasos... lo primero es siempre definir el OBJETIVO» → CINCO PASOS,
//     uno abierto a la vez (los cerrados son una línea con su resumen, y abrir uno lo trae a la vista):
//       1 Objetivo (el medio, «¿Qué tiene que lograr?», dictar, «✦ Armar el resto») · 2 Cuándo entra ·
//       3 Cómo responde (Texto o Audio con su voz, y «Tu forma de escribir», que reemplaza al «Tono») ·
//       4 Libertad (sólo avisa · para aprobar · sola, y hasta cuándo) · 5 Ensayar (el modal de objeciones).
//   · «siempre va a estar vinculado a un medio» → `medio` en la tarjeta, con su toque visual en `CuerpoPasoIA`.
//
// El DATO es el nodo `respuesta` con `paso_ia` (lib/flujo-grafo.ts, «EL AI STEP»): lo que en la forma de
// siempre eran las tarjetas hijas va ADENTRO del caso. El motor y «Probar» lo recorren expandido
// (`expandirPasoIA`); acá se dibuja y se edita la forma compacta, que es lo que se guarda.
//
// ⚠️ LO QUE FALTA PARA PUBLICAR va en rojo con la MISMA regla que el freno (`faltaEnCaso`). El objetivo NO frena
// (§10-A): lo pide la pantalla primero, pero lo migrado y lo de la API no lo tienen.
// ⚠️ «SOLA» NO REPITE LA GUARDA DE LA PLATA: lo que habla de precio no sale solo aunque el caso lo diga — lo frena
// el motor (`puedeContestarSolo`). Acá sólo se dice, en gris.
// ⚠️ ESTE ARCHIVO NO GUARDA NADA (como FlujoLienzo): cada cambio sube por `cambiar`. Tipear no apila (el Ctrl+Z
// del texto es del navegador); elegir una opción, armar con IA y guardar el ensayo, sí.
// ⚠️ IG Y MESSENGER NO SE OFRECEN TODAVÍA (§6: «la pantalla ofrece lo que el emisor hace»): el motor contesta
// por WhatsApp. Cuando el motor social esté, se suman a `MEDIOS_OFRECIDOS`.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { inpLienzo } from '@/app/_components/Lienzo';
import { Icon } from '@/app/_components/icons';
import { Switch, Spinner } from '@/app/_ui';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import { useEjemploQueSeEscribe } from './CrearConIA';
import { VozAIStep } from './VozAIStep';
import { ModalEnsayoAIStep } from './ModalEnsayoAIStep';
import {
  TOPE_RESPONDER, TOPE_OBJETIVO, TOPE_TITULO_CASO, TOPE_EJEMPLOS, ROTULO_CUALQUIERA, ROTULO_MEDIO,
  faltaEnCaso, esPasoIA, medioDe, puedeSumarAIStep, idDe,
  type CasoRespuesta, type PasoGrafo, type MedioAIStep, type EjemploCaso,
} from '@/lib/flujo-grafo';
import {
  resumenPasoIA, libertadDeCaso, FILA_NOMBRE_IA, FILA_OBJETIVO_IA, FILA_CHIPS_IA, ICONOS_MAS,
  type LibertadTarjeta,
} from '@/lib/flujo-conversacion';
import type { ArmadoAIStep } from '@/lib/ai-step-armar';

const OnboardingChatAgent = dynamic(() => import('./OnboardingChatAgent').then((m) => m.OnboardingChatAgent), { ssr: false });

const SANS = "'Geist', sans-serif";
const UNA_LINEA: CSSProperties = { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

/** Los medios que la pantalla OFRECE hoy (§6): sólo los que el motor sabe contestar. */
const MEDIOS_OFRECIDOS: readonly MedioAIStep[] = ['whatsapp'];

/** El color de cada medio para el toque de la tarjeta (`--medio`). Instagram, su degradé. */
export const COLOR_MEDIO: Readonly<Record<MedioAIStep, string>> = {
  whatsapp: '#25D366',
  instagram: 'linear-gradient(90deg, #F58529, #DD2A7B 55%, #8134AF)',
  messenger: '#0084FF',
};

/** Los ejemplos que se escriben solos en «¿Qué tiene que lograr?» (el mecanismo de «Crear con IA»). */
const EJEMPLOS_OBJETIVO = [
  'Que agende una llamada',
  'Que confirme la reunión',
  'Que proponga otro día y horario',
  'Que vuelva a agendar',
  'Que llegue a la reunión sin hablar de cifras',
] as const;

/** Lo que dice «Escuchar»: una frase de una respuesta de verdad (la guía es una instrucción, no se dice). */
const TEXTO_PRUEBA_VOZ = 'Hola, ¿cómo estás? Te escribo por lo que me preguntaste: lo vemos ahora mismo.';

/** Lo que este archivo lee de la tarjeta (estructural: el DTO vive en un componente). */
export type PasoIAEditable = Pick<PasoGrafo, 'casos' | 'instrucciones' | 'otra_aviso' | 'medio' | 'suelta'>;
/** Un cambio de la tarjeta. `apilar`: entra a la pila de deshacer. */
export type CambioPasoIA = (patch: Partial<PasoIAEditable>, apilar: boolean) => void;

const CASO_VACIO: CasoRespuesta = { id: '', titulo: '', cuando: '', siguiente: null };

// ── La tarjeta ──────────────────────────────────────────────────────────────────

const ROTULO_LIBERTAD: Readonly<Record<LibertadTarjeta, string>> = { avisa: 'avisa', aprueba: 'aprueba', sola: 'sola' };

/**
 * LO DE ADENTRO DE LA TARJETA AI STEP (v2): el nombre del caso en negrita, «→ objetivo» y al pie los chips. Cada
 * renglón con el alto EXACTO que cuenta `altoPasoIA`. El MEDIO: una franja de 3 px arriba y su logo a la derecha
 * de la cabecera (`--medio`, posicionados contra la tarjeta, que es el ancestro con `position`). `pendientes`:
 * los hand-offs que salieron por «Otra cosa» («2 sin caso»), sólo en la tarjeta que los lleva.
 */
export function CuerpoPasoIA({ paso, pendientes, advertencia }: { paso: PasoGrafo; pendientes?: string; advertencia?: boolean }) {
  const r = resumenPasoIA(paso);
  const chip = (fuerte: boolean, borde?: boolean): CSSProperties => ({
    flex: 'none', padding: '0 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, lineHeight: '16px',
    border: `1px solid ${borde ? 'var(--medio-borde)' : fuerte ? 'var(--primary-weak)' : 'var(--border-strong)'}`,
    background: fuerte ? 'var(--primary-bg)' : 'var(--surface-2)', color: fuerte ? 'var(--primary-strong)' : 'var(--dim)',
  });
  const medioColor = COLOR_MEDIO[r.medio];
  const estiloMedio = { '--medio': medioColor, '--medio-borde': r.medio === 'instagram' ? '#DD2A7B' : medioColor } as CSSProperties;
  return (
    <div data-medio={r.medio} style={{ display: 'flex', flexDirection: 'column', fontFamily: SANS, ...estiloMedio }}>
      {/* El toque del medio (§3): una franja arriba y el logo en la cabecera. */}
      <span aria-hidden style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 3, background: 'var(--medio)' }} />
      <img src={r.medio === 'whatsapp' ? ICONOS_MAS.whatsapp : ICONOS_MAS[r.medio]} alt={ROTULO_MEDIO[r.medio]} title={ROTULO_MEDIO[r.medio]} width={14} height={14}
        style={{ position: 'absolute', top: 13, right: advertencia ? 30 : 12, display: 'block' }} />
      <div title={r.titulo} style={{ ...UNA_LINEA, height: FILA_NOMBRE_IA, lineHeight: `${FILA_NOMBRE_IA}px`, fontSize: 13, fontWeight: 700, color: r.falta ? 'var(--bad)' : 'var(--ink)' }}>
        {r.titulo}
      </div>
      <div style={{ ...UNA_LINEA, height: FILA_OBJETIVO_IA, lineHeight: `${FILA_OBJETIVO_IA}px`, fontSize: 11.5, color: r.objetivo ? 'var(--dim)' : 'var(--faint)' }}>
        {r.objetivo ? `→ ${r.objetivo}` : 'Sin objetivo'}
      </div>
      <div style={{ height: FILA_CHIPS_IA, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
        <span style={chip(r.libertad === 'sola', true)}>{ROTULO_LIBERTAD[r.libertad]}</span>
        {r.cualquiera && <span style={chip(false)}>cualquiera</span>}
        {r.audio && <span title="Contesta en audio" style={chip(false)}>🎙</span>}
        {r.unaVez && <span title="Contesta una vez" style={chip(false)}>1 vez</span>}
        {r.avisa && r.libertad !== 'avisa' && <span title="Te aviso" style={{ flex: 'none', display: 'inline-flex', color: 'var(--dim)' }}><Icon name="bell" size={13} /></span>}
        {pendientes && (
          <span style={{ marginLeft: 'auto', flex: 'none', padding: '1px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, color: 'var(--warn)', border: '1px solid var(--warn)', background: 'var(--surface)' }}>{pendientes}</span>
        )}
      </div>
    </div>
  );
}

// ── El editor ───────────────────────────────────────────────────────────────────

/** El último paso que se tocó de cada tarjeta, mientras dura la visita (una completa abre ahí: §2). */
const ultimoPaso = new Map<string, number>();

/** Los OTROS AI Step del mismo medio: sus nombres (el armado no los repite) y si alguno es «Cualquier respuesta». */
function hermanosDe(pasos: readonly PasoGrafo[], id: string, medio: MedioAIStep): { titulos: string[]; hayCualquiera: boolean } {
  const otros = pasos.filter((p, i) => esPasoIA(p) && idDe(p, i) !== id && medioDe(p) === medio);
  return {
    titulos: otros.map((p) => (p.casos?.[0]?.titulo ?? '').trim()).filter(Boolean),
    hayCualquiera: otros.some((p) => p.suelta !== true && p.casos?.some((c) => c.cualquiera === true)),
  };
}

/** Los campos que toca la libertad, para cada opción (§2.4). */
function camposDeLibertad(l: LibertadTarjeta): Partial<CasoRespuesta> {
  if (l === 'avisa') return { no_contesta: true, avisar: true, sola: undefined };
  if (l === 'sola') return { no_contesta: undefined, sola: true };
  return { no_contesta: undefined, sola: undefined };
}

/** Un caso sin las claves en `undefined` (lo que se guarda no lleva campos vacíos). */
function limpio(c: CasoRespuesta): CasoRespuesta {
  const out = { ...c } as Record<string, unknown>;
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out as CasoRespuesta;
}

/**
 * EL PANEL DEL AI STEP: cinco pasos, uno abierto a la vez. `id`: la tarjeta (recuerda el último paso tocado).
 * `pasos`: el flujo entero (los hermanos del medio). `onOtro`: «＋ Otro AI Step». `secuenciaId`: para que el
 * ensayo deje contestar a MaKo con la estrategia de la automatización.
 */
export function EditorPasoIA({ id, paso, pasos, busy, cambiar, onOtro, secuenciaId, onError }: {
  id: string; paso: PasoIAEditable; pasos: readonly PasoGrafo[]; busy: boolean; cambiar: CambioPasoIA;
  onOtro?: () => void; secuenciaId?: number | null; onError?: (m: string) => void;
}) {
  const c = paso.casos?.[0] ?? CASO_VACIO;
  const medio = medioDe(paso);
  const vacio = !c.titulo.trim() && !(c.objetivo ?? '').trim() && !c.cuando.trim() && !(c.responder ?? '').trim();
  const [abierto, setAbierto] = useState<number>(() => (vacio ? 1 : (ultimoPaso.get(id) ?? 1)));
  const abrir = (n: number) => { setAbierto(n); ultimoPaso.set(id, n); };
  const setCaso = (p: Partial<CasoRespuesta>, apilar: boolean) => cambiar({ casos: [limpio({ ...c, ...p })] }, apilar);
  const falta = faltaEnCaso(c);
  const hermanos = hermanosDe(pasos, id, medio);

  // «✦» al lado de lo que armó MaKo, hasta que se toca (§2.1).
  const [armados, setArmados] = useState<ReadonlySet<string>>(new Set());
  const tocar = (campo: string) => { if (armados.has(campo)) setArmados((s) => { const n = new Set(s); n.delete(campo); return n; }); };

  // ── Paso 1: «✦ Armar el resto» ──
  const [armando, setArmando] = useState<AbortController | null>(null);
  const [propuesta, setPropuesta] = useState<ArmadoAIStep | null>(null);
  const [errArmar, setErrArmar] = useState<string | null>(null);
  const aplicar = (a: ArmadoAIStep) => {
    // Lo de la libertad viene en los campos (`no_contesta`, `sola`, `avisar`); lo demás se pisa entero.
    setCaso({ titulo: a.titulo, cuando: a.cuando, responder: a.responder, cualquiera: a.cualquiera, no_contesta: a.no_contesta, sola: a.sola, avisar: a.avisar, hasta: a.hasta }, true);
    setArmados(new Set(['titulo', 'cuando', 'responder', 'libertad']));
    setPropuesta(null);
    abrir(2);
  };
  const armar = async () => {
    const objetivo = (c.objetivo ?? '').trim();
    if (!objetivo || armando) return;
    const ac = new AbortController();
    setArmando(ac); setErrArmar(null); setPropuesta(null);
    try {
      const r = await fetch('/api/automations/ai-step/armar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: ac.signal,
        body: JSON.stringify({ objetivo, medio, hermanos }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErrArmar(j?.error ?? 'MaKo no pudo armarlo.'); return; }
      // No pisa lo escrito a mano sin preguntar («¿Reemplazo lo que escribiste?»): un campo con texto que NO
      // armó MaKo (o que se tocó después de armarlo) es de la persona.
      const aMano = (['titulo', 'cuando', 'responder'] as const).some((k) => (c[k] ?? '').trim() && !armados.has(k));
      if (aMano) setPropuesta(j.armado as ArmadoAIStep);
      else aplicar(j.armado as ArmadoAIStep);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setErrArmar('MaKo no pudo armarlo.');
    } finally { setArmando(null); }
  };
  const ejemplo = useEjemploQueSeEscribe(!(c.objetivo ?? '').trim() && abierto === 1, EJEMPLOS_OBJETIVO);

  // ── Paso 3: «Tu forma de escribir» (la guía de voz: su primer bloque es «TU TONO») ──
  const [guia, setGuia] = useState<boolean | null>(null);
  const [abrirGuia, setAbrirGuia] = useState(false);
  useEffect(() => {
    let vivo = true;
    void (async () => {
      try {
        const j = await (await fetch('/api/chat-agent/onboarding?tab=setting', { cache: 'no-store' })).json();
        if (vivo && j?.ok) setGuia(j.guiaVoz === true);
      } catch { /* sin red: la línea queda neutra */ }
    })();
    return () => { vivo = false; };
  }, [abrirGuia]);

  // ── Paso 5: el ensayo ──
  const [ensayo, setEnsayo] = useState(false);
  const guardarEnsayo = (nuevos: EjemploCaso[]) => {
    // Los de antes y los nuevos, los últimos `TOPE_EJEMPLOS` (lo más reciente es lo que la persona dio por bueno).
    setCaso({ ejemplos: [...(c.ejemplos ?? []), ...nuevos].slice(-TOPE_EJEMPLOS) }, true);
    setEnsayo(false);
  };

  const libertad = libertadDeCaso(c);
  const resumenes: Record<number, string> = {
    1: (c.objetivo ?? '').trim() || 'Sin objetivo',
    2: c.titulo.trim() ? `${c.titulo.trim()} · ${c.cualquiera ? ROTULO_CUALQUIERA : (c.cuando.trim() || 'falta cuándo')}` : 'Falta el nombre',
    3: `${c.audio ? 'Audio' : 'Texto'} · ${(c.responder ?? '').replace(/\s+/g, ' ').trim() || (libertad === 'avisa' ? 'no contesta' : 'falta cómo responder')}`,
    4: `${libertad === 'avisa' ? 'Sólo te avisa' : libertad === 'sola' ? 'Sola' : 'Para aprobar'} · ${c.hasta === 'una' ? 'Una respuesta' : 'Hasta lograrlo'}`,
    5: c.ejemplos?.length ? `${c.ejemplos.length} ${c.ejemplos.length === 1 ? 'respuesta tuya' : 'respuestas tuyas'}` : 'Opcional',
  };
  const rojo = (n: number): boolean => (n === 2 && (falta === 'nombre' || falta === 'cuando')) || (n === 3 && falta === 'que_hace' && libertad !== 'avisa');

  return (
    <div data-editor-ai-step style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: SANS }}>
      <PasoAIStep n={1} titulo="Objetivo" abierto={abierto === 1} onAbrir={() => abrir(1)} resumen={resumenes[1]}>
        <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Por dónde contesta">
          {MEDIOS_OFRECIDOS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={medio === m} disabled={busy}
              onClick={() => cambiar({ medio: m === 'whatsapp' ? undefined : m }, true)}
              style={chipOpcion(medio === m)}>
              <img src={m === 'whatsapp' ? ICONOS_MAS.whatsapp : ICONOS_MAS[m]} alt="" width={14} height={14} />{ROTULO_MEDIO[m]}
            </button>
          ))}
        </div>
        <Rotulo>¿Qué tiene que lograr?</Rotulo>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <textarea value={c.objetivo ?? ''} rows={2} maxLength={TOPE_OBJETIVO} placeholder={ejemplo} disabled={busy}
            aria-label="Qué tiene que lograr" onChange={(e) => setCaso({ objetivo: e.target.value }, false)}
            style={{ ...inpLienzo, flex: 1, resize: 'vertical', lineHeight: 1.45 }} />
          <BotonDictar titulo="Dictar el objetivo" valor={c.objetivo ?? ''} onValor={(v) => setCaso({ objetivo: v.slice(0, TOPE_OBJETIVO) }, false)}
            onError={(m) => (onError ? onError(m) : setErrArmar(m))} />
        </div>
        {propuesta ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--ink)' }}>
            ¿Reemplazo lo que escribiste?
            <button type="button" onClick={() => aplicar(propuesta)} style={botonTexto(true)}>Reemplazar</button>
            <button type="button" onClick={() => setPropuesta(null)} style={botonTexto(false)}>No</button>
          </div>
        ) : armando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--dim)' }}>
            <Spinner size={14} />MaKo está armando el resto…
            <button type="button" onClick={() => armando.abort()} style={botonTexto(false)}>Cancelar</button>
          </div>
        ) : (
          <button type="button" disabled={busy || !(c.objetivo ?? '').trim()} onClick={() => { void armar(); }}
            style={{ ...botonTexto(true), alignSelf: 'flex-start', opacity: (c.objetivo ?? '').trim() ? 1 : 0.5 }}>✦ Armar el resto</button>
        )}
        {errArmar && <span style={{ fontSize: 12, color: 'var(--bad)' }}>{errArmar}</span>}
      </PasoAIStep>

      <PasoAIStep n={2} titulo="Cuándo entra" abierto={abierto === 2} onAbrir={() => abrir(2)} resumen={resumenes[2]} rojo={rojo(2)}>
        <Rotulo armado={armados.has('titulo')}>Nombre</Rotulo>
        <input value={c.titulo} maxLength={TOPE_TITULO_CASO} placeholder="Pregunta el precio" disabled={busy} aria-label="Nombre del caso"
          onChange={(e) => { tocar('titulo'); setCaso({ titulo: e.target.value }, false); }}
          style={{ ...inpLienzo, fontWeight: 600, ...(falta === 'nombre' ? { borderColor: 'var(--bad)' } : {}) }} />
        <div role="radiogroup" aria-label="Cuándo entra" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Opcion activa={c.cualquiera !== true} disabled={busy} onClick={() => setCaso({ cualquiera: undefined }, true)}>Cuando escribe algo como…</Opcion>
          {c.cualquiera !== true && (
            <textarea value={c.cuando} rows={3} placeholder="Pregunta cuánto cuesta o qué incluye" disabled={busy} aria-label="Cuándo entra"
              onChange={(e) => { tocar('cuando'); setCaso({ cuando: e.target.value }, false); }}
              style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45, ...(falta === 'cuando' ? { borderColor: 'var(--bad)' } : {}) }} />
          )}
          <Opcion activa={c.cualquiera === true} disabled={busy || (hermanos.hayCualquiera && c.cualquiera !== true)}
            onClick={() => setCaso({ cualquiera: true }, true)}
            nota={hermanos.hayCualquiera && c.cualquiera !== true ? 'Ya la tiene otro AI Step' : undefined}>{ROTULO_CUALQUIERA}</Opcion>
        </div>
      </PasoAIStep>

      <PasoAIStep n={3} titulo="Cómo responde" abierto={abierto === 3} onAbrir={() => abrir(3)} resumen={resumenes[3]} rojo={rojo(3)}>
        <Rotulo armado={armados.has('responder')}>Cómo responder</Rotulo>
        <textarea value={c.responder ?? ''} rows={4} maxLength={TOPE_RESPONDER} placeholder="Agradece, confirma el día y la hora, y pregunta si le queda bien" disabled={busy}
          aria-label="Cómo responder" onChange={(e) => { tocar('responder'); setCaso({ responder: e.target.value }, false); }}
          style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45, ...(rojo(3) ? { borderColor: 'var(--bad)' } : {}) }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12.5, color: 'var(--dim)', fontWeight: 600 }}>Responde con</span>
          <button type="button" disabled={busy} onClick={() => setCaso({ audio: undefined }, true)} style={chipOpcion(!c.audio)}>Texto</button>
          {medio === 'whatsapp' && (
            <button type="button" disabled={busy} onClick={() => setCaso({ audio: c.audio ?? { voz: 'propia' } }, true)} style={chipOpcion(!!c.audio)}>Audio</button>
          )}
        </div>
        {c.audio && medio === 'whatsapp' && (
          <VozAIStep voz={c.audio.voz} deshabilitado={busy} onVoz={(v) => setCaso({ audio: { voz: v } }, true)}
            textoPrueba={TEXTO_PRUEBA_VOZ} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: guia === false ? 'var(--warn)' : 'var(--dim)' }}>
          {guia === false ? 'Falta tu forma de escribir' : 'Tu forma de escribir'}
          <button type="button" disabled={busy} onClick={() => setAbrirGuia(true)} style={botonTexto(guia === false)}>{guia === false ? 'Crear' : 'Editar'}</button>
        </div>
        {!!c.ejemplos?.length && (
          <span style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 4px 2px 9px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, color: 'var(--ink)' }}>
            {c.ejemplos.length} {c.ejemplos.length === 1 ? 'respuesta tuya' : 'respuestas tuyas'}
            <button type="button" aria-label="Borrar tus respuestas del ensayo" disabled={busy} onClick={() => setCaso({ ejemplos: undefined }, true)}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', fontSize: 13, lineHeight: 1, padding: '0 4px' }}>✕</button>
          </span>
        )}
      </PasoAIStep>

      <PasoAIStep n={4} titulo="Libertad" abierto={abierto === 4} onAbrir={() => abrir(4)} resumen={resumenes[4]}>
        <Rotulo armado={armados.has('libertad')}>Responde</Rotulo>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="Cómo responde">
          {(['avisa', 'aprueba', 'sola'] as const).map((l) => (
            <button key={l} type="button" role="radio" aria-checked={libertad === l} disabled={busy || (l !== 'avisa' && !(c.responder ?? '').trim())}
              onClick={() => { tocar('libertad'); setCaso(camposDeLibertad(l), true); }} style={chipOpcion(libertad === l)}>
              {l === 'avisa' ? 'Sólo te avisa' : l === 'aprueba' ? 'Para aprobar' : 'Sola'}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 12, color: 'var(--faint)' }}>El precio siempre va para aprobar.</span>
        <Rotulo>Hasta</Rotulo>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }} role="radiogroup" aria-label="Hasta cuándo">
          <button type="button" role="radio" aria-checked={c.hasta !== 'una'} disabled={busy} onClick={() => setCaso({ hasta: undefined }, true)} style={chipOpcion(c.hasta !== 'una')}>Lograr el objetivo</button>
          <button type="button" role="radio" aria-checked={c.hasta === 'una'} disabled={busy} onClick={() => setCaso({ hasta: 'una' }, true)} style={chipOpcion(c.hasta === 'una')}>Una respuesta</button>
        </div>
        <Switch label="Te aviso cada vez" checked={c.avisar === true || libertad === 'avisa'} disabled={busy || libertad === 'avisa'}
          onChange={(v) => setCaso({ avisar: v ? true : undefined }, true)} />
        <span style={{ fontSize: 12, color: 'var(--faint)', lineHeight: 1.45 }}>Si no sabe qué contestar o la charla termina mal, te la paso.</span>
      </PasoAIStep>

      <PasoAIStep n={5} titulo="Ensayar" abierto={abierto === 5} onAbrir={() => abrir(5)} resumen={resumenes[5]}>
        <button type="button" disabled={busy || !c.titulo.trim()} onClick={() => setEnsayo(true)} style={{ ...botonTexto(true), alignSelf: 'flex-start' }}>Ensayar objeciones</button>
        {!c.titulo.trim() && <span style={{ fontSize: 12, color: 'var(--faint)' }}>Primero ponle nombre al caso.</span>}
      </PasoAIStep>

      {onOtro && (
        <button type="button" disabled={busy || !puedeSumarAIStep(pasos, medio)} onClick={onOtro} aria-label="Otro AI Step"
          style={{ marginTop: 4, alignSelf: 'flex-start', ...botonTexto(true), opacity: puedeSumarAIStep(pasos, medio) ? 1 : 0.5 }}>＋ Otro AI Step</button>
      )}

      {ensayo && typeof document !== 'undefined' && createPortal(
        <ModalEnsayoAIStep caso={c} medio={medio} secuenciaId={secuenciaId ?? null} onCerrar={() => setEnsayo(false)} onGuardar={guardarEnsayo} />,
        document.body,
      )}
      {abrirGuia && typeof document !== 'undefined' && createPortal(
        <OnboardingChatAgent soloPaso="contexto" onListo={() => setAbrirGuia(false)} />,
        document.body,
      )}
    </div>
  );
}

/**
 * UN PASO DEL PANEL (el molde del CRON): abierto ocupa lo que necesita; cerrado es una línea con su número, su
 * nombre y su resumen. Abrir uno lo trae a la vista (`scrollIntoView`, «siempre me debe desplazar hacia donde
 * esté parado»). En rojo si le falta algo para publicar.
 */
function PasoAIStep({ n, titulo, abierto, onAbrir, resumen, rojo, children }: {
  n: number; titulo: string; abierto: boolean; onAbrir: () => void; resumen: string; rojo?: boolean; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (abierto) ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }, [abierto]);
  const numero: CSSProperties = {
    flex: 'none', width: 20, height: 20, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, fontWeight: 700, background: abierto ? 'var(--primary)' : rojo ? 'var(--bad-bg, var(--surface-2))' : 'var(--surface-2)',
    color: abierto ? '#fff' : rojo ? 'var(--bad)' : 'var(--dim)', border: abierto ? 'none' : `1px solid ${rojo ? 'var(--bad)' : 'var(--border)'}`,
  };
  return (
    <div ref={ref} data-paso-ai-step={n} style={{
      borderRadius: 12, border: `1px solid ${abierto ? 'var(--primary-weak)' : rojo ? 'var(--bad)' : 'var(--border)'}`,
      background: abierto ? 'var(--surface)' : 'var(--surface-2)',
    }}>
      <button type="button" onClick={onAbrir} aria-expanded={abierto}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: SANS, textAlign: 'left' }}>
        <span style={numero}>{n}</span>
        <span style={{ flex: 'none', fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{titulo}</span>
        {!abierto && <span style={{ ...UNA_LINEA, flex: 1, fontSize: 12, color: rojo ? 'var(--bad)' : 'var(--dim)' }}>{resumen}</span>}
      </button>
      {abierto && <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 10px 10px' }}>{children}</div>}
    </div>
  );
}

function Rotulo({ children, armado }: { children: ReactNode; armado?: boolean }) {
  return (
    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--dim)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {children}{armado && <span title="Lo armó MaKo" style={{ color: 'var(--mako, #F2B01E)' }}>✦</span>}
    </span>
  );
}

function Opcion({ activa, disabled, onClick, nota, children }: { activa: boolean; disabled?: boolean; onClick: () => void; nota?: string; children: ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={activa} disabled={disabled} onClick={onClick} title={nota}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 2px', border: 'none', background: 'transparent', cursor: disabled ? 'default' : 'pointer', fontFamily: SANS, fontSize: 13, color: disabled ? 'var(--faint)' : 'var(--ink)', textAlign: 'left' }}>
      <span aria-hidden style={{ width: 14, height: 14, borderRadius: 999, border: `1.5px solid ${activa ? 'var(--primary)' : 'var(--border-strong)'}`, boxShadow: activa ? 'inset 0 0 0 3px var(--surface), inset 0 0 0 8px var(--primary)' : 'none', flex: 'none' }} />
      {children}
      {nota && <span style={{ fontSize: 11.5, color: 'var(--faint)' }}>· {nota}</span>}
    </button>
  );
}

function chipOpcion(activa: boolean): CSSProperties {
  return {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 11px', borderRadius: 999, cursor: 'pointer',
    border: `1px solid ${activa ? 'var(--primary)' : 'var(--border)'}`, background: activa ? 'var(--primary-bg)' : 'var(--surface)',
    color: activa ? 'var(--primary-strong)' : 'var(--ink)', fontFamily: SANS, fontSize: 12.5, fontWeight: 600,
  };
}

function botonTexto(primario: boolean): CSSProperties {
  return {
    border: 'none', background: 'transparent', padding: '4px 2px', cursor: 'pointer', fontFamily: SANS, fontSize: 13,
    fontWeight: 600, color: primario ? 'var(--primary)' : 'var(--dim)',
  };
}
