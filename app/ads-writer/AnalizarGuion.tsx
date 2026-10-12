'use client';

// =============================================================================
// AnalizarGuion — la vista «Analizar guion» de Ads Writer (/ads-writer?tab=analizar)
// =============================================================================
// Decisión de Martín (11/10/2026): lo de Ads Analyst que EJECUTA una tarea se muda a Ads Writer, y lo
// que es análisis (patrones, cuadrante, la tabla de guiones) a la hoja «Ads Analyst» del Dashboard. La
// tab /ads-analyst se retiró y redirige a esa hoja. Acá viven las tres tareas, con el comportamiento
// que tenían en app/ads-analyst/ScriptsBrowser.tsx:
//
//   · «Analiza un guion nuevo»: POST /api/ads-analyst/valorar → la valoración (ValoracionGuion.tsx) y
//     el historial (tabla script_drafts), que se abre y se borra (DELETE ?id=).
//   · Sincronizar: POST /api/ads-analyst/sync, con la pregunta previa según cuánto hay pendiente.
//   · Ángulos y avatares: el mismo editor (app/components/TaxonomyManager.tsx).
//
// Las rutas /api/ads-analyst/* NO se renombran (AGENTS.md: las APIs y las claves no se mudan con la
// pantalla). Los datos los arma la page en el server (app/ads-writer/page.tsx → `vistaAnalizar`).
//
// LO QUE CAMBIÓ AL MUDARSE, y por qué:
//   · Cada `fetch` lleva `signal` con el tope de su ruta + margen (./analizar.ts). Allá no lo tenían, y
//     un corte de red dejaba el botón girando para siempre.
//   · Borrar del historial pregunta antes. Allá borraba de un clic sin aviso; acá es el mismo `useConfirm`
//     con el que Ads Writer ya pregunta antes de borrar un guion de la matriz.
//   · «Actualizar igual» con guiones recién sincronizados ya NO fuerza el re-análisis. Con `force`,
//     syncScriptAnalyses (lib/ads-analyst.ts) toma TODOS los transcripts como candidatos en orden de
//     ad_id y corre los primeros seis: o sea, re-analizaba (y cobraba) siempre los mismos seis, y los
//     pendientes de los que hablaba la pregunta podían no tocarse nunca. Sin `force` corre justo esos.
//     Por lo mismo, con todo al día pero con errores, el botón reintenta los errores (sin `force` se
//     reintentan; con `force`, sólo si caían entre los seis primeros, que es lo que el texto de allá
//     prometía sin cumplir).
//
// ⚠️ ESTA VISTA NO SE DESMONTA al cambiar de vista (AdsWriterApp la esconde con `display`), así que un
// guion a medio pegar sobrevive a ir a mirar la matriz. Por eso el historial es un `useState` que se
// RESIEMBRA cuando el server manda otro (AGENTS.md, «Un `useState` sembrado de props no se resiembra»).
// =============================================================================

import { useMemo, useRef, useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Alert, Button, ButtonLink, Section, Textarea, useConfirm } from '@/app/_ui';
import { MONO } from '@/app/_ui/tokens';
import { BotonBorrar } from '@/app/_ui/BotonBorrar';
import { MakoStar } from '@/app/_components/MakoBrand';
import { TaxonomyManager, type TaxItem } from '@/app/components/TaxonomyManager';
import type { ScriptDraft, Valoracion } from '@/lib/ads-analyst';
import { ValoracionView, rgba, veredictoDe, type InfoAngulo } from './ValoracionGuion';
import {
  TOPE_BORRAR_MS, TOPE_SYNC_MS, TOPE_VALORAR_MS,
  faltaParaValorar, haceCuanto, lineaConteo, mensajeDeFallo, puertaSync, textoResultadoSync,
  type ConteoGuiones,
} from './analizar';

/** Lo que la page lee en el server y le pasa a la vista. Todo serializable. */
export type DatosAnalizar = {
  /** Cuántos guiones hay analizados, pendientes, sin analizar y con error (getScriptAnalystView). */
  conteo: ConteoGuiones;
  /** La última vez que se escribió un análisis, ISO. */
  ultimaSync: string | null;
  /** Si no se pudo leer el conteo: el mensaje crudo (el conteo viene en cero y NO significa «no hay»). */
  errorLectura: string | null;
  /** El historial de guiones valorados, más recientes primero. */
  drafts: ScriptDraft[];
  /** El vocabulario de ángulos (los del negocio o los 5 de fábrica) y el de avatares. */
  angulos: TaxItem[];
  avatares: TaxItem[];
};

/**
 * El día de una fecha ISO como dd/mm (o dd/mm/aaaa), sacado del TEXTO: con un `Date` el server y el
 * navegador lo pasarían cada uno a su huso, y el día dibujado podría cambiar al hidratar.
 */
function diaMes(iso: string, conAnio = false): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}${conAnio ? `/${m[1]}` : ''}` : '';
}

/** Lo que distingue a una fila del historial: el guion en una línea. */
function extracto(guion: string): string {
  const plano = guion.replace(/\s+/g, ' ').trim();
  return plano.length > 80 ? `${plano.slice(0, 80)}…` : plano;
}

const POST_JSON = { method: 'POST', headers: { 'Content-Type': 'application/json' } } as const;

export function AnalizarGuion({ conteo, ultimaSync, errorLectura, drafts: draftsDelServer, angulos, avatares }: DatosAnalizar) {
  const router = useRouter();
  const { confirm, confirmNode } = useConfirm();

  // El historial: una copia para poder sacar una fila sin esperar al server, que se resiembra cuando
  // el server manda otra lista (después de valorar, de sincronizar o de volver a esta vista).
  const [drafts, setDrafts] = useState<ScriptDraft[]>(draftsDelServer);
  const [draftsVistos, setDraftsVistos] = useState<ScriptDraft[]>(draftsDelServer);
  if (draftsDelServer !== draftsVistos) {
    setDraftsVistos(draftsDelServer);
    setDrafts(draftsDelServer);
  }

  const [guion, setGuion] = useState('');
  const [valorando, setValorando] = useState(false);
  const [valoracion, setValoracion] = useState<Valoracion | null>(null);
  const [valError, setValError] = useState<string | null>(null);
  const resultadoRef = useRef<HTMLDivElement>(null);

  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<{ texto: string; error: boolean } | null>(null);
  const [borrarError, setBorrarError] = useState<string | null>(null);
  const [taxonomia, setTaxonomia] = useState(false);

  const angulo: InfoAngulo = useMemo(() => {
    const m = new Map(angulos.map((a) => [a.key, { label: a.label, c: a.color }]));
    return (k: string) => m.get(k) ?? { label: k, c: '#6B675C' };
  }, [angulos]);

  async function valorar() {
    const falta = faltaParaValorar(guion);
    if (falta) { setValError(falta); return; }
    setValorando(true); setValError(null); setValoracion(null);
    try {
      const r = await fetch('/api/ads-analyst/valorar', { ...POST_JSON, body: JSON.stringify({ guion }), signal: AbortSignal.timeout(TOPE_VALORAR_MS) });
      const j = await r.json().catch(() => null);
      if (!j?.ok) throw new Error(j?.error || 'No se pudo valorar el guion.');
      setValoracion(j.valoracion as Valoracion);
      // La ruta lo guardó en el historial: se pide la lista nueva (trae el id para poder borrarlo).
      router.refresh();
    } catch (e) {
      setValError(mensajeDeFallo('valorar', e));
    } finally {
      setValorando(false);
    }
  }

  function verDraft(d: ScriptDraft) {
    setValoracion(d.valoracion); setGuion(d.guion); setValError(null);
    // El historial está abajo de la valoración: sin esto, el clic cambia algo que queda fuera de la vista.
    requestAnimationFrame(() => resultadoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  function limpiar() { setGuion(''); setValoracion(null); setValError(null); }

  async function borrarDraft(d: ScriptDraft) {
    const ok = await confirm('Se borra del historial con su valoración. No se puede deshacer.', { title: '¿Borrar este guion?', confirmLabel: 'Borrar' });
    if (!ok) return;
    setBorrarError(null);
    setDrafts((ds) => ds.filter((x) => x.id !== d.id));
    try {
      const r = await fetch(`/api/ads-analyst/valorar?id=${d.id}`, { method: 'DELETE', signal: AbortSignal.timeout(TOPE_BORRAR_MS) });
      const j = await r.json().catch(() => null);
      if (!j?.ok) throw new Error(j?.error || 'No se pudo borrar el guion.');
    } catch (e) {
      // Vuelve a su lugar: la lista no puede afirmar un borrado que el server no hizo.
      setDrafts((ds) => (ds.some((x) => x.id === d.id) ? ds : [...ds, d].sort((a, b) => b.created_at.localeCompare(a.created_at))));
      setBorrarError(mensajeDeFallo('borrar', e));
    }
  }

  async function sincronizar(force: boolean) {
    setSyncing(true); setSyncMsg({ texto: 'Analizando guiones… puede tardar unos minutos.', error: false });
    try {
      const r = await fetch('/api/ads-analyst/sync', { ...POST_JSON, body: JSON.stringify({ force }), signal: AbortSignal.timeout(TOPE_SYNC_MS) });
      const j = await r.json().catch(() => null);
      if (!j?.ok) throw new Error(j?.error || 'No se pudo sincronizar.');
      setSyncMsg({ texto: textoResultadoSync(j), error: false });
      router.refresh();
    } catch (e) {
      setSyncMsg({ texto: mensajeDeFallo('sync', e), error: true });
    } finally {
      setSyncing(false);
    }
  }

  async function pedirSync() {
    // Sin guiones a la vista no hay nada que pisar ni nada que esperar: corre directo, como hacía el
    // estado vacío de Ads Analyst. (Con el conteo sin leer, también: viene en cero.)
    if (conteo.enVista === 0) { void sincronizar(false); return; }
    const { pend, nivel } = puertaSync(conteo, ultimaSync);
    const guiones = `guion${pend === 1 ? '' : 'es'}`;
    if (nivel === 'ok') {
      const ok = await confirm(`Hay ${pend} ${guiones} sin analizar. MaKo los analiza ahora y puede tardar unos minutos.`,
        { title: 'Analizar los guiones nuevos', confirmLabel: 'Sí, analizar', cancelLabel: 'Cancelar', danger: false });
      if (ok) void sincronizar(false);
    } else if (nivel === 'reciente') {
      const ok = await confirm(`Se actualizó ${haceCuanto(ultimaSync)}: los ${pend} pendientes quizá todavía se están procesando.`,
        { title: 'Recién sincronizaste', confirmLabel: 'Analizar igual', cancelLabel: 'Cancelar', danger: false });
      if (ok) void sincronizar(false);
    } else if (conteo.errores > 0) {
      const ok = await confirm(`No hay guiones nuevos. ${conteo.errores} quedaron con error y se pueden volver a intentar.`,
        { title: 'Ya está todo al día', confirmLabel: 'Reintentar', cancelLabel: 'Cerrar', danger: false });
      if (ok) void sincronizar(false);
    } else {
      const ok = await confirm('No hay guiones nuevos sin analizar. Actualizar igual vuelve a analizar guiones ya analizados y gasta IA.',
        { title: 'Ya está todo al día', confirmLabel: 'Actualizar igual', cancelLabel: 'Cerrar', danger: false });
      if (ok) void sincronizar(true);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sect-gap)' }}>
      {/* Con qué compara MaKo: la cobertura del análisis y las dos herramientas que la cambian. */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        {/* El mensaje crudo del server va al `title`: sirve para reportarlo, no para leerlo. */}
        <span title={errorLectura ?? undefined} style={{ fontFamily: MONO, fontSize: 'var(--fs-meta)', color: 'var(--faint)' }}>
          {errorLectura ? 'Sin conteo' : lineaConteo(conteo)}
          {ultimaSync && diaMes(ultimaSync) ? ` · sync ${diaMes(ultimaSync)}` : ''}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {syncMsg && (
            <span role="status" style={{ fontSize: 'var(--fs-meta)', color: syncMsg.error ? 'var(--bad)' : 'var(--dim)', maxWidth: 360 }}>{syncMsg.texto}</span>
          )}
          <ButtonLink href="/dashboard?hoja=ads-analyst" variant="tertiary" size="sm">Ver los patrones</ButtonLink>
          <Button variant="secondary" size="sm" onClick={() => setTaxonomia(true)}>Ángulos y avatares</Button>
          <Button variant="secondary" size="sm" loading={syncing} onClick={() => { void pedirSync(); }}>Sincronizar</Button>
        </div>
      </div>

      {errorLectura && (
        <Alert tono="bad" accion={{ label: 'Volver a leer', onClick: () => router.refresh() }}>
          No se pudo leer cuántos guiones hay analizados.
        </Alert>
      )}

      <Section card titulo="Analiza un guion nuevo">
        <p style={{ margin: 0, fontSize: 'var(--fs-sm)', color: 'var(--dim)', lineHeight: 1.5 }}>
          Pega un guion que todavía no subiste a Meta. MaKo lo compara con lo que ya te funciona y te dice qué esperar y cómo probarlo.
        </p>
        <Textarea value={guion} onChange={(e) => setGuion(e.target.value)} rows={6} aria-label="Guion a valorar"
          placeholder="Pega aquí el guion completo del video…" style={{ width: '100%', marginTop: 14, resize: 'vertical' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12, flexWrap: 'wrap' }}>
          <Button variant="mako" icon={<MakoStar size={15} color="#17140C" />} loading={valorando} onClick={() => { void valorar(); }}>
            Valorar guion
          </Button>
          {valorando && <span style={{ fontSize: 'var(--fs-meta)', color: 'var(--dim)' }}>Puede tardar hasta 2 minutos.</span>}
          {valError && <span role="alert" style={{ fontSize: 'var(--fs-meta)', color: 'var(--bad)' }}>{valError}</span>}
          {guion.length > 0 && !valorando && <Button variant="tertiary" size="sm" onClick={limpiar}>Limpiar</Button>}
        </div>
        <div ref={resultadoRef} style={{ scrollMarginTop: 16 }}>
          {valoracion && <ValoracionView v={valoracion} angulo={angulo} />}
        </div>
      </Section>

      {drafts.length > 0 && (
        <Section titulo="Historial" nota={String(drafts.length)}>
          {borrarError && <div style={{ marginBottom: 10 }}><Alert tono="bad">{borrarError}</Alert></div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {drafts.map((d) => {
              const vv = veredictoDe(d.verdicto);
              const a = d.angle ? angulo(d.angle) : null;
              return (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 11, padding: '10px 13px' }}>
                  <button type="button" onClick={() => verDraft(d)} title="Ver su valoración"
                    style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', padding: 0 }}>
                    {a && <span title={a.label} style={{ width: 8, height: 8, borderRadius: '50%', flex: 'none', background: a.c }} />}
                    <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 'none', maxWidth: 200 }}>{d.short || 'Guion'}</span>
                    <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1, minWidth: 0 }}>{extracto(d.guion)}</span>
                  </button>
                  <span style={{ display: 'inline-block', fontSize: 10.5, fontWeight: 600, padding: '2px 9px', borderRadius: 999, background: rgba(vv.c, .1), color: vv.c, border: `1px solid ${rgba(vv.c, .3)}`, whiteSpace: 'nowrap', flex: 'none' }}>{vv.label}</span>
                  <span style={{ fontFamily: MONO, fontSize: 11, color: 'var(--faint)', whiteSpace: 'nowrap', flex: 'none' }}>{diaMes(d.created_at, true)}</span>
                  <BotonBorrar talla="sm" title="Borrar del historial" onClick={() => { void borrarDraft(d); }} />
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {taxonomia && (
        <TaxonomyManager angles={angulos} avatares={avatares}
          onClose={() => setTaxonomia(false)}
          onSaved={() => { setTaxonomia(false); router.refresh(); }} />
      )}
      {confirmNode}
    </div>
  );
}
