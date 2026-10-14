'use client';

// =============================================================================
// EditorPasoIA — la tarjeta «AI STEP» del lienzo de /automations: su cuerpo y su editor
// =============================================================================
// Novena tanda (10/10/2026): «Todo lo que hiciste de una cantidad impresionante de flujos y tarjetas eso
// justamente debería estar en una nueva tarjeta que sea "AI Step". Configuralo allí».
//
// UNDÉCIMA TANDA (11/10/2026, docs/diseno-undecima-tanda.md §2 puntos 11-13 y §6). Martín:
//   · «Toda la cantidad de tarjetas de "AI Step" deberían ser una sola... Si justamente es el mismo objetivo, solo
//     son diferentes objeciones o escenarios» → UN AI Step por objetivo: el OBJETIVO, la voz y los ejemplos en la
//     TARJETA, y los escenarios adentro (hasta `TOPE_ESCENARIOS_AI_STEP`) más «Lo demás».
//   · «No pongas tanto input de texto en AI Step... solo el primero donde le pides a la IA o grabas audio... El resto
//     con desplegables» → el ÚNICO texto libre es el objetivo (con dictar o grabar) y su «✦ Armar». Un escenario no
//     es un campo: sale de «✦ Armar», del catálogo (`ESCENARIOS_TIPICOS`, el mismo de la galería) o de «✦ Otro con
//     MaKo». Lo que sí se escribe es el ENSAYO, donde contesta la persona (el modal).
//   · «En el paso de "Libertad" lo complejizaste al pedo... Solo basta con los primeros 3 botones, que me gustaría
//     que sean un desplegable... El "Hasta" siempre es atado al objetivo. Y el "Te avisa cada vez" ya es uno de los 3
//     botones... Y elimina todo el resto de titulos y aclaraciones que sobran... Poco texto quiero» → la libertad es
//     un desplegable POR ESCENARIO (Sólo te avisa · Para aprobar · Sola; las que `libertadesPermitidas` no deja van
//     deshabilitadas), «Lo demás» ofrece las dos primeras, y se fueron «Hasta», «Te aviso cada vez», los textos de
//     ayuda, los títulos que sobraban y «＋ Otro AI Step».
//
// EL PANEL: CUATRO PASOS, uno abierto a la vez (el molde del CRON; los cerrados son una línea con su resumen):
//   1 Objetivo (el texto, dictar o grabar, «✦ Armar») · 2 Escenarios (cada fila: el nombre, su libertad y el tacho;
//   «Lo demás» al final; «＋ Escenario» con el catálogo y «✦ Otro con MaKo») · 3 Responde con (Texto o Audio, la voz, y
//   «Tu forma de escribir») · 4 Ensayar (el modal de objeciones).
//
// El DATO es el nodo `respuesta` con `paso_ia` (lib/flujo-grafo.ts, «EL AI STEP»). El motor y «Probar» lo recorren
// expandido (`expandirPasoIA`); acá se dibuja y se edita la forma compacta, que es lo que se guarda.
//
// ⚠️ LO QUE EL PANEL OFRECE Y ESCRIBE SALE DE FUNCIONES PURAS (lib/ai-step-armar.ts, lib/ai-step-ensayo.ts, con test):
// las opciones de libertad son `opcionesDeLibertad` (= `libertadesPermitidas`, la MISMA de Publicar y del motor), la
// libertad se escribe sólo con `conLibertad` (`camposDeLibertad`), «Lo demás» con `conLoDemas`, el catálogo con
// `escenarioTipico`, lo armado con `casosDelArmado`, y «Guardar respuestas» escribe los `ejemplos` del NODO
// (`cambioDelEnsayo`), nunca de un escenario.
// ⚠️ LO QUE FALTA PARA PUBLICAR va en rojo con la MISMA regla que el freno (`erroresDelPasoIA`, `faltaEnCaso`).
// ⚠️ ESTE ARCHIVO NO GUARDA NADA (como FlujoLienzo): cada cambio sube por `cambiar`. Tipear no apila (el Ctrl+Z
// del texto es del navegador); elegir una opción, armar con IA, sumar o quitar un escenario y guardar el ensayo, sí.
// ⚠️ IG Y MESSENGER NO SE OFRECEN TODAVÍA (§6: «la pantalla ofrece lo que el emisor hace»): el motor contesta
// por WhatsApp. Cuando el motor social esté, se suman a `MEDIOS_OFRECIDOS` y vuelven los chips del medio.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import dynamic from 'next/dynamic';
import { inpLienzo } from '@/app/_components/Lienzo';
import { Spinner } from '@/app/_ui';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { Dropdown, type DropdownOption, type IconoDeOpcion } from '@/app/components/Dropdown';
import { BotonDictar } from '@/app/plan/board/CrearTareaModal';
import { useEjemploQueSeEscribe } from './CrearConIA';
import { VozAIStep } from './VozAIStep';
import { ModalEnsayoAIStep } from './ModalEnsayoAIStep';
import {
  TOPE_OBJETIVO, TOPE_ESCENARIOS_AI_STEP, ROTULO_LO_DEMAS, ROTULO_MEDIO,
  faltaEnCaso, medioDe, erroresDelPasoIA,
  type CasoRespuesta, type PasoGrafo, type MedioAIStep, type EjemploCaso,
} from '@/lib/flujo-grafo';
import { resumenPasoIA, FILA_OBJETIVO_IA, FILA_ESCENARIOS_IA, FILA_CHIPS_IA, ICONOS_MAS } from '@/lib/flujo-conversacion';
import { libertadDeCaso, avisoDeLibertad, LIBERTADES, ROTULO_LIBERTAD, type Libertad } from '@/lib/ai-step-libertad';
import { escenarioTipico } from '@/lib/ai-step-escenarios';
import {
  casoDeArmado, casosDelArmado, conEscenario, sinEscenario, conLibertadDe, conLoDemas, libertadDeLoDemas,
  generadorDeIds, escenariosParaSumar, distintivoDeTipico, opcionesDeLibertad, OPCIONES_LO_DEMAS, GUIA_LO_DEMAS,
  type ArmadoAIStep, type ModoArmado, type LoDemasAIStep,
} from '@/lib/ai-step-armar';
import { cambioDelEnsayo } from '@/lib/ai-step-ensayo';

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

/** Los ejemplos que se escriben solos en el objetivo vacío (el mecanismo de «Crear con IA»). */
const EJEMPLOS_OBJETIVO = [
  'Que agende una llamada',
  'Que confirme la reunión',
  'Que proponga otro día y horario',
  'Que vuelva a agendar',
  'Que llegue a la reunión sin hablar de cifras',
] as const;

/** Lo que dice «Escuchar»: una frase de una respuesta de verdad (la guía es una instrucción, no se dice). */
const TEXTO_PRUEBA_VOZ = 'Hola, ¿cómo estás? Te escribo por lo que me preguntaste: lo vemos ahora mismo.';

/** El ícono de cada libertad en su desplegable (del set de la casa). */
const ICONO_LIBERTAD: Readonly<Record<Libertad, IconoDeOpcion>> = { avisa: 'avisar', aprueba: 'calificado', sola: 'enviar' };

/** Lo que este archivo lee de la tarjeta (estructural: el DTO vive en un componente). Undécima: lo del objetivo es de la tarjeta. */
export type PasoIAEditable = Pick<PasoGrafo, 'casos' | 'objetivo' | 'audio' | 'ejemplos' | 'medio' | 'suelta'>;
/** Un cambio de la tarjeta. `apilar`: entra a la pila de deshacer. */
export type CambioPasoIA = (patch: Partial<PasoIAEditable>, apilar: boolean) => void;

// ── La tarjeta ──────────────────────────────────────────────────────────────────

/** El chip de cada libertad (corto: va en el pie de la tarjeta, con su cuenta). */
const CHIP_LIBERTAD: Readonly<Record<Libertad, string>> = { avisa: 'avisa', aprueba: 'aprueba', sola: 'sola' };

/**
 * LO DE ADENTRO DE LA TARJETA AI STEP (undécima tanda: una por objetivo): «→ objetivo» en negrita (o «Falta el
 * objetivo», en rojo), los nombres de los escenarios en una línea y al pie los chips con cuántos hay de cada libertad
 * y 🎙. Cada renglón con el alto EXACTO que cuenta `altoPasoIA`: el alto es fijo. El MEDIO: una franja de 3 px arriba
 * y su logo a la derecha de la cabecera (`--medio`, posicionados contra la tarjeta, que es el ancestro con
 * `position`). `pendientes`: los hand-offs que salieron por «Lo demás» («2 sin caso»), sólo en la que los lleva.
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
      <div title={r.objetivo ?? undefined} style={{ ...UNA_LINEA, height: FILA_OBJETIVO_IA, lineHeight: `${FILA_OBJETIVO_IA}px`, fontSize: 13, fontWeight: 700, color: r.objetivo ? 'var(--ink)' : 'var(--bad)' }}>
        {r.objetivo ? `→ ${r.objetivo}` : 'Falta el objetivo'}
      </div>
      <div title={r.escenarios.map((e) => e.titulo).join(' · ')} style={{ ...UNA_LINEA, height: FILA_ESCENARIOS_IA, lineHeight: `${FILA_ESCENARIOS_IA}px`, fontSize: 11.5, color: r.escenarios.length ? 'var(--dim)' : 'var(--faint)' }}>
        {r.escenarios.length ? r.escenarios.map((e) => e.titulo).join(' · ') : ROTULO_LO_DEMAS}
      </div>
      <div style={{ height: FILA_CHIPS_IA, display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, overflow: 'hidden' }}>
        {LIBERTADES.filter((l) => r.conteo[l] > 0).map((l) => (
          <span key={l} title={ROTULO_LIBERTAD[l]} style={chip(l === 'sola', true)}>{r.conteo[l]} {CHIP_LIBERTAD[l]}</span>
        ))}
        {r.audio && <span title="Contesta en audio" style={chip(false)}>🎙</span>}
        {pendientes && (
          <span style={{ marginLeft: 'auto', flex: 'none', padding: '1px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, color: 'var(--warn)', border: '1px solid var(--warn)', background: 'var(--surface)' }}>{pendientes}</span>
        )}
      </div>
    </div>
  );
}

// ── El editor ───────────────────────────────────────────────────────────────────

/** El último paso que se tocó de cada tarjeta, mientras dura la visita (una completa abre ahí). */
const ultimoPaso = new Map<string, number>();

/** El valor de «＋ Escenario» que pide uno a MaKo (los del catálogo van como `t:<id>`). */
const OTRO_CON_MAKO = 'mako';

/** Las opciones de un desplegable de libertad, con su ícono. */
const conIconos = (ops: ReadonlyArray<{ value: Libertad; label: string; disabled: boolean }>): DropdownOption[] =>
  ops.map((o) => ({ value: o.value, label: o.label, icono: ICONO_LIBERTAD[o.value], disabled: o.disabled }));

/**
 * EL PANEL DEL AI STEP. `id`: la tarjeta (recuerda el último paso tocado). `pasos`: el flujo entero (los ids nuevos no
 * chocan con nada, y «Responde MaKo» del ensayo clasifica con él). `secuenciaId`: para que el ensayo deje contestar a
 * MaKo con la estrategia de la automatización.
 *
 * CONTRATO (ola 1 → ola 2): `EditorPasoIA({ id, paso, pasos, busy, cambiar, secuenciaId, onError })`;
 * `cambiar(patch, apilar)` con `patch` sobre la TARJETA (`objetivo`, `audio`, `ejemplos`, `casos`, `medio`).
 */
export function EditorPasoIA({ id, paso, pasos, busy, cambiar, secuenciaId, onError }: {
  id: string; paso: PasoIAEditable; pasos: readonly PasoGrafo[]; busy: boolean; cambiar: CambioPasoIA;
  secuenciaId?: number | null; onError?: (m: string) => void;
}) {
  const casos = paso.casos ?? [];
  const objetivo = paso.objetivo ?? '';
  const medio = medioDe(paso);
  const escenarios = casos.filter((c) => c.cualquiera !== true);
  const loDemas = libertadDeLoDemas(casos);
  const lleno = escenarios.length >= TOPE_ESCENARIOS_AI_STEP;
  const [abierto, setAbierto] = useState<number>(() => (!objetivo.trim() && !escenarios.length ? 1 : (ultimoPaso.get(id) ?? 1)));
  const abrir = (n: number) => { setAbierto(n); ultimoPaso.set(id, n); };

  /** Los casos nuevos de la tarjeta (un cambio que apila). */
  const setCasos = (cs: CasoRespuesta[]) => cambiar({ casos: cs }, true);
  /** Ids de caso que no chocan con ninguna tarjeta, rama ni caso del flujo, ni con los de ESTA tarjeta. */
  const ids = () => generadorDeIds([...pasos, { casos } as PasoGrafo]);

  // ── Paso 1: «✦ Armar» (todos) y, desde el paso 2, «✦ Otro con MaKo» (uno) ──
  const [armando, setArmando] = useState<{ ac: AbortController; modo: ModoArmado } | null>(null);
  const [propuesta, setPropuesta] = useState<ArmadoAIStep | null>(null);
  const [errArmar, setErrArmar] = useState<string | null>(null);
  const aplicar = (a: ArmadoAIStep) => {
    setCasos(casosDelArmado(a, ids()));
    setPropuesta(null);
    abrir(2);
  };
  const armar = async (modo: ModoArmado) => {
    const obj = objetivo.trim();
    if (!obj || armando) return;
    const ac = new AbortController();
    setArmando({ ac, modo }); setErrArmar(null); setPropuesta(null);
    try {
      const r = await fetch('/api/automations/ai-step/armar', {
        method: 'POST', headers: { 'content-type': 'application/json' }, signal: ac.signal,
        body: JSON.stringify({ objetivo: obj, medio, modo, escenarios: escenarios.map((c) => ({ titulo: c.titulo, cuando: c.cuando })) }),
      });
      const j = await r.json().catch(() => null);
      if (!j?.ok) { setErrArmar(j?.error ?? 'MaKo no pudo armarlo.'); return; }
      const a = j.armado as ArmadoAIStep;
      if (modo === 'uno') { if (a.escenarios[0]) setCasos(conEscenario(casos, casoDeArmado(a.escenarios[0], ids()()))); return; }
      // Con escenarios puestos no se pisan sin preguntar («¿Reemplazo?»).
      if (escenarios.length) setPropuesta(a); else aplicar(a);
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) setErrArmar('MaKo no pudo armarlo.');
    } finally { setArmando(null); }
  };
  const ejemplo = useEjemploQueSeEscribe(!objetivo.trim() && abierto === 1, EJEMPLOS_OBJETIVO);

  // ── Paso 2: «＋ Escenario» (el catálogo, sin los que ya están, y «✦ Otro con MaKo») ──
  const tipicos = escenariosParaSumar(casos);
  const opcionesSumar: DropdownOption[] = [
    ...tipicos.map((e) => ({ value: `t:${e.id}`, label: e.titulo, icono: ICONO_LIBERTAD[e.libertad], ...(distintivoDeTipico(e) ? { sub: distintivoDeTipico(e) } : {}) })),
    { value: OTRO_CON_MAKO, label: 'Otro con MaKo', icono: 'mako', disabled: !objetivo.trim() },
  ];
  const sumar = (v: string) => {
    if (lleno) return;
    if (v === OTRO_CON_MAKO) { void armar('uno'); return; }
    if (v.startsWith('t:')) setCasos(conEscenario(casos, escenarioTipico(v.slice(2), ids()())));
  };

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

  // ── Paso 4: el ensayo. «Guardar respuestas» escribe los `ejemplos` del NODO, nunca de un escenario. ──
  const [ensayo, setEnsayo] = useState(false);
  const ejemplos = paso.ejemplos ?? [];
  const guardarEnsayo = (nuevos: EjemploCaso[]) => {
    cambiar(cambioDelEnsayo(paso, nuevos), true);
    setEnsayo(false);
  };

  // En rojo, lo que frena Publicar (la MISMA regla, `erroresDelPasoIA`): el objetivo en el paso 1, el resto en el 2.
  const errEscenarios = erroresDelPasoIA({ ...paso, objetivo: 'x' } as PasoGrafo, id, true).length > 0;
  const resumenes: Record<number, string> = {
    1: objetivo.trim() || 'Falta el objetivo',
    2: escenarios.length ? escenarios.map((c) => c.titulo.trim() || 'Sin nombre').join(' · ') : ROTULO_LO_DEMAS,
    3: paso.audio && medio === 'whatsapp' ? 'Audio' : 'Texto',
    4: ejemplos.length ? `${ejemplos.length} ${ejemplos.length === 1 ? 'respuesta tuya' : 'respuestas tuyas'}` : '',
  };
  const rojo = (n: number): boolean => (n === 1 && !objetivo.trim()) || (n === 2 && errEscenarios);

  return (
    <div data-editor-ai-step style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: SANS }}>
      <PasoAIStep n={1} titulo="Objetivo" abierto={abierto === 1} onAbrir={() => abrir(1)} resumen={resumenes[1]} rojo={rojo(1)}>
        {MEDIOS_OFRECIDOS.length > 1 && (
          <div style={{ display: 'flex', gap: 6 }} role="radiogroup" aria-label="Por dónde contesta">
            {MEDIOS_OFRECIDOS.map((m) => (
              <button key={m} type="button" role="radio" aria-checked={medio === m} disabled={busy}
                onClick={() => cambiar({ medio: m === 'whatsapp' ? undefined : m }, true)}
                style={chipOpcion(medio === m)}>
                <img src={m === 'whatsapp' ? ICONOS_MAS.whatsapp : ICONOS_MAS[m]} alt="" width={14} height={14} />{ROTULO_MEDIO[m]}
              </button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
          <textarea value={objetivo} rows={2} maxLength={TOPE_OBJETIVO} placeholder={ejemplo} disabled={busy}
            aria-label="Objetivo" onChange={(e) => cambiar({ objetivo: e.target.value }, false)}
            style={{ ...inpLienzo, flex: 1, resize: 'vertical', lineHeight: 1.45 }} />
          <BotonDictar titulo="Dictar el objetivo" valor={objetivo} onValor={(v) => cambiar({ objetivo: v.slice(0, TOPE_OBJETIVO) }, false)}
            onError={(m) => (onError ? onError(m) : setErrArmar(m))} />
        </div>
        {propuesta ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', fontSize: 12.5, color: 'var(--ink)' }}>
            ¿Reemplazo los escenarios?
            <button type="button" onClick={() => aplicar(propuesta)} style={botonTexto(true)}>Reemplazar</button>
            <button type="button" onClick={() => setPropuesta(null)} style={botonTexto(false)}>No</button>
          </div>
        ) : armando?.modo === 'todo' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--dim)' }}>
            <Spinner size={14} />MaKo está armando…
            <button type="button" onClick={() => armando.ac.abort()} style={botonTexto(false)}>Cancelar</button>
          </div>
        ) : (
          <button type="button" disabled={busy || !objetivo.trim() || !!armando} onClick={() => { void armar('todo'); }}
            style={{ ...botonTexto(true), alignSelf: 'flex-start', opacity: objetivo.trim() ? 1 : 0.5 }}>✦ Armar</button>
        )}
        {errArmar && abierto === 1 && <span style={{ fontSize: 12, color: 'var(--bad)' }}>{errArmar}</span>}
      </PasoAIStep>

      <PasoAIStep n={2} titulo="Escenarios" abierto={abierto === 2} onAbrir={() => abrir(2)} resumen={resumenes[2]} rojo={rojo(2)}>
        {escenarios.map((c) => {
          // «SOLA» CON SU AVISO (14/10/2026): con plata ya se puede, y se dice al lado (`avisoDeLibertad`).
          const aviso = avisoDeLibertad(c, libertadDeCaso(c));
          return (
            <div key={c.id} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div data-escenario={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ ...UNA_LINEA, flex: 1, fontSize: 13, fontWeight: 600, color: faltaEnCaso(c) ? 'var(--bad)' : 'var(--ink)' }}>{c.titulo.trim() || 'Sin nombre'}</span>
                <Dropdown value={libertadDeCaso(c)} options={conIconos(opcionesDeLibertad(c))} search={false} width={156} disabled={busy}
                  ariaLabel={`Libertad de ${c.titulo.trim() || 'el escenario'}`} onChange={(v) => setCasos(conLibertadDe(casos, c.id, v as Libertad))} />
                <BotonBorrar talla="sm" title={`Quitar «${c.titulo.trim() || 'el escenario'}»`} disabled={busy} onClick={() => setCasos(sinEscenario(casos, c.id))} />
              </div>
              {aviso && <span data-aviso-libertad style={{ fontSize: 11.5, color: 'var(--warn)' }}>{aviso}</span>}
            </div>
          );
        })}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div data-escenario="lo-demas" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ ...UNA_LINEA, flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--dim)' }}>{ROTULO_LO_DEMAS}</span>
            <Dropdown value={loDemas} options={conIconos(OPCIONES_LO_DEMAS)} search={false} width={156} disabled={busy}
              ariaLabel={`Libertad de ${ROTULO_LO_DEMAS}`} onChange={(v) => setCasos(conLoDemas(casos, v as LoDemasAIStep, ids()()))} />
            <span aria-hidden style={{ flex: 'none', width: 26 }} />
          </div>
          {loDemas === 'sola' && <span data-aviso-libertad style={{ fontSize: 11.5, color: 'var(--warn)' }}>{avisoDeLibertad({ titulo: ROTULO_LO_DEMAS, cuando: '', responder: GUIA_LO_DEMAS, cualquiera: true }, 'sola')}</span>}
        </div>
        {armando?.modo === 'uno' ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12.5, color: 'var(--dim)' }}>
            <Spinner size={14} />MaKo está armando…
            <button type="button" onClick={() => armando.ac.abort()} style={botonTexto(false)}>Cancelar</button>
          </div>
        ) : (
          <Dropdown value="" resetAfterSelect search variante="placeholder" options={opcionesSumar} onChange={sumar}
            disabled={busy || lleno || !!armando} ariaLabel="Sumar un escenario" menuAncho={340}
            botonLabel={<span style={{ fontSize: 13, fontWeight: 600, fontFamily: SANS }}>＋ Escenario</span>} />
        )}
        {errArmar && abierto === 2 && <span style={{ fontSize: 12, color: 'var(--bad)' }}>{errArmar}</span>}
      </PasoAIStep>

      <PasoAIStep n={3} titulo="Responde con" abierto={abierto === 3} onAbrir={() => abrir(3)} resumen={resumenes[3]}>
        <Dropdown value={paso.audio && medio === 'whatsapp' ? 'audio' : 'texto'} search={false} width="100%" disabled={busy} ariaLabel="Responde con"
          options={[
            { value: 'texto', label: 'Texto', icono: 'texto' },
            { value: 'audio', label: 'Audio', icono: 'audio', disabled: medio !== 'whatsapp' },
          ]}
          onChange={(v) => cambiar({ audio: v === 'audio' ? (paso.audio ?? { voz: 'propia' }) : undefined }, true)} />
        {paso.audio && medio === 'whatsapp' && (
          <VozAIStep voz={paso.audio.voz} deshabilitado={busy} onVoz={(v) => cambiar({ audio: { voz: v } }, true)}
            textoPrueba={TEXTO_PRUEBA_VOZ} />
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: guia === false ? 'var(--warn)' : 'var(--dim)' }}>
          {guia === false ? 'Falta tu forma de escribir' : 'Tu forma de escribir'}
          <button type="button" disabled={busy} onClick={() => setAbrirGuia(true)} style={botonTexto(guia === false)}>{guia === false ? 'Crear' : 'Editar'}</button>
        </div>
      </PasoAIStep>

      <PasoAIStep n={4} titulo="Ensayar" abierto={abierto === 4} onAbrir={() => abrir(4)} resumen={resumenes[4]}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" disabled={busy || !objetivo.trim()} onClick={() => setEnsayo(true)}
            style={{ ...botonTexto(true), opacity: objetivo.trim() ? 1 : 0.5 }}>Ensayar objeciones</button>
          {!!ejemplos.length && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 4px 2px 9px', borderRadius: 999, border: '1px solid var(--border)', background: 'var(--surface-2)', fontSize: 12, color: 'var(--ink)' }}>
              {ejemplos.length} {ejemplos.length === 1 ? 'respuesta tuya' : 'respuestas tuyas'}
              <button type="button" aria-label="Borrar tus respuestas del ensayo" disabled={busy} onClick={() => cambiar({ ejemplos: undefined }, true)}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--dim)', fontSize: 13, lineHeight: 1, padding: '0 4px' }}>✕</button>
            </span>
          )}
        </div>
      </PasoAIStep>

      {ensayo && typeof document !== 'undefined' && createPortal(
        <ModalEnsayoAIStep ai={{ objetivo: objetivo.trim(), escenarios: escenarios.map((c) => ({ titulo: c.titulo, cuando: c.cuando })) }}
          pasos={pasos} medio={medio} secuenciaId={secuenciaId ?? null} onCerrar={() => setEnsayo(false)} onGuardar={guardarEnsayo} />,
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
