'use client';

// =============================================================================
// EditorPasoIA — la tarjeta «AI STEP» del lienzo de /automations: su cuerpo y su editor
// =============================================================================
// Pedido de Martín (10/10/2026, novena tanda), textual: «Todo lo que hiciste de una cantidad impresionante
// de flujos y tarjetas eso justamente debería estar en una nueva tarjeta que sea "AI Step". Configuralo
// allí». Eligió la forma «una tarjeta con sus casos adentro»: arriba el tono general (opcional) y una fila
// por situación —cuándo → cómo responder, si sale sola o va a revisar, si te avisa— y «Otra cosa → te
// aviso».
//
// El DATO es el nodo `respuesta` con `paso_ia` (lib/flujo-grafo.ts, «EL AI STEP»): lo que en la forma de
// siempre eran las tarjetas hijas de cada caso va ADENTRO del caso. El motor y «Probar» lo recorren
// expandido (`expandirPasoIA`); acá se dibuja y se edita la forma compacta, que es lo que se guarda.
//
//   · `CuerpoPasoIA`: lo de adentro de la tarjeta. Las filas y su alto salen de `filasDePasoIA` /
//     `altoPasoIA` (lib/flujo-conversacion.ts): los números de acá son ESOS (la tarjeta tiene alto fijo).
//   · `EditorPasoIA`: el panel. El tono, la lista de casos (nombre, cuándo, cómo responder, «Sale sola» y
//     «Avisarme»), «＋ Caso» y el aviso de «Otra cosa». Lo que le falta a un caso va en rojo con la MISMA
//     regla que frena Publicar (`faltaEnCaso`).
//
// ⚠️ «SALE SOLA» NO REPITE LA GUARDA DE LA PLATA. Lo que habla de precio, pago o montos no sale solo
// aunque el caso lo diga: lo frena el motor (`puedeContestarSolo`, lib/setter-conversacion.ts), igual que
// en un «MaKo contesta» de los de siempre. Una segunda copia acá se separaría de la del motor.
//
// ⚠️ ESTE ARCHIVO NO GUARDA NADA (como FlujoLienzo): cada cambio sube por `cambiar`. Tipear no apila (el
// Ctrl+Z del texto es del navegador); sumar o quitar un caso y los interruptores, sí.

import type { CSSProperties } from 'react';
import { inpLienzo } from '@/app/_components/Lienzo';
import { Icon } from '@/app/_components/icons';
import { Switch } from '@/app/_ui';
import { BotonQuitar, PLACEHOLDER } from './EditorCondicion';
import {
  TOPE_CASOS, TOPE_RESPONDER, TOPE_INSTRUCCIONES, TOPE_OTRA_AVISO, AVISO_OTRA_COSA, ROTULO_OTRA_COSA,
  faltaEnCaso, nuevoId, type CasoRespuesta, type PasoGrafo,
} from '@/lib/flujo-grafo';
import { filasDePasoIA, FILA_CASO_IA, FILA_MAS_CASOS_IA, FILA_OTRA_IA } from '@/lib/flujo-conversacion';

const SANS = "'Geist', sans-serif";

/** Lo que este archivo lee de la tarjeta (estructural: el DTO vive en un componente). */
export type PasoIAEditable = Pick<PasoGrafo, 'casos' | 'instrucciones' | 'otra_aviso'>;
/** Un cambio de la tarjeta. `apilar`: entra a la pila de deshacer. */
export type CambioPasoIA = (patch: Partial<PasoIAEditable>, apilar: boolean) => void;

const UNA_LINEA: CSSProperties = { minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };

// ── La tarjeta ──────────────────────────────────────────────────────────────────

/**
 * LO DE ADENTRO DE LA TARJETA AI STEP: una fila por caso (el nombre con «sola»/«revisa» y la campanita si
 * avisa; debajo, cómo responde) y al pie «Otra cosa → te aviso». Cada fila con el alto EXACTO que cuenta
 * `altoPasoIA`. `pendientes`: los hand-offs que salieron por «Otra cosa» («2 sin caso»), en esa fila.
 */
export function CuerpoPasoIA({ paso, pendientes }: { paso: PasoGrafo; pendientes?: string }) {
  const f = filasDePasoIA(paso);
  // «sola» en el primario (sale sin que nadie la mire), «revisa» en gris (queda un borrador).
  const chip = (fuerte: boolean): CSSProperties => ({
    flex: 'none', padding: '0 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, lineHeight: '16px',
    border: `1px solid ${fuerte ? 'var(--primary-weak)' : 'var(--border-strong)'}`,
    background: fuerte ? 'var(--primary-bg)' : 'var(--surface-2)', color: fuerte ? 'var(--primary-strong)' : 'var(--dim)',
  });
  return (
    <div style={{ display: 'flex', flexDirection: 'column', fontFamily: SANS }}>
      {f.casos.map((c, k) => (
        <div key={c.id} data-caso-ia={c.id} title={c.titulo}
          style={{
            height: FILA_CASO_IA, boxSizing: 'border-box', borderTop: k ? '1px solid var(--border)' : 'none',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 2,
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <span style={{ ...UNA_LINEA, flex: 1, fontSize: 12.5, fontWeight: 600, color: c.falta ? 'var(--bad)' : 'var(--ink)' }}>{c.titulo}</span>
            {c.chip && <span style={chip(c.chip === 'sola')}>{c.chip}</span>}
            {c.avisa && <span title="Te aviso" style={{ flex: 'none', display: 'inline-flex', color: 'var(--dim)' }}><Icon name="bell" size={13} /></span>}
          </div>
          <span style={{ ...UNA_LINEA, fontSize: 11.5, color: c.chip ? 'var(--dim)' : 'var(--faint)' }}>→ {c.resumen}</span>
        </div>
      ))}
      {f.mas > 0 && (
        <div style={{ height: FILA_MAS_CASOS_IA, boxSizing: 'border-box', display: 'flex', alignItems: 'center', fontSize: 11.5, color: 'var(--dim)' }}>
          +{f.mas} {f.mas === 1 ? 'caso' : 'casos'}
        </div>
      )}
      <div style={{
        height: FILA_OTRA_IA, boxSizing: 'border-box', borderTop: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: 'var(--dim)',
      }}>
        <span style={{ flex: 'none', display: 'inline-flex' }}><Icon name="bell" size={13} /></span>
        <span style={{ ...UNA_LINEA, flex: 1 }}>{f.otra}</span>
        {pendientes && (
          <span style={{ flex: 'none', padding: '1px 7px', borderRadius: 999, fontSize: 10.5, fontWeight: 600, color: 'var(--warn)', border: '1px solid var(--warn)', background: 'var(--surface)' }}>{pendientes}</span>
        )}
      </div>
    </div>
  );
}

// ── El editor ───────────────────────────────────────────────────────────────────

/**
 * EL PANEL DEL AI STEP. `pasos`: el flujo entero, para el id de un caso nuevo (`nuevoId` no repite ninguno
 * del flujo: ni de una tarjeta ni de otro caso).
 */
export function EditorPasoIA({ paso, pasos, busy, cambiar }: {
  paso: PasoIAEditable; pasos: readonly PasoGrafo[]; busy: boolean; cambiar: CambioPasoIA;
}) {
  const casos = paso.casos ?? [];
  const setCaso = (k: number, p: Partial<CasoRespuesta>, apilar: boolean) =>
    cambiar({ casos: casos.map((c, j) => (j === k ? { ...c, ...p } : c)) }, apilar);
  const lleno = busy || casos.length >= TOPE_CASOS;
  const agregar = () => {
    if (lleno) return;
    cambiar({ casos: [...casos, { id: nuevoId(pasos), titulo: '', cuando: '', siguiente: null }] }, true);
  };
  const rojo = (falta: boolean): CSSProperties => (falta ? { borderColor: 'var(--bad)' } : {});
  const caja = (falta: boolean): CSSProperties => ({
    position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: 10, borderRadius: 12,
    border: `1px solid ${falta ? 'var(--bad)' : 'var(--border)'}`, background: 'var(--surface-2)',
  });
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: SANS }}>
      <textarea value={paso.instrucciones ?? ''} rows={2} maxLength={TOPE_INSTRUCCIONES} placeholder="Tono (opcional)" disabled={busy}
        aria-label="Tono general" onChange={(e) => cambiar({ instrucciones: e.target.value }, false)}
        style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45 }} />

      {casos.map((c, k) => {
        const falta = faltaEnCaso(c);
        const contesta = !!(c.responder ?? '').trim();
        return (
          <div key={c.id} data-caso-ia={c.id} style={caja(falta != null)}>
            <BotonQuitar onClick={() => cambiar({ casos: casos.filter((x) => x.id !== c.id) }, true)} disabled={busy} aria="Quitar este caso" />
            <input value={c.titulo} maxLength={40} placeholder="Nombre del caso" disabled={busy} aria-label="Nombre del caso"
              onChange={(e) => setCaso(k, { titulo: e.target.value }, false)}
              style={{ ...inpLienzo, fontWeight: 600, ...rojo(falta === 'nombre') }} />
            <textarea value={c.cuando} rows={2} placeholder="Cuándo aplica" disabled={busy} aria-label="Cuándo aplica"
              onChange={(e) => setCaso(k, { cuando: e.target.value }, false)}
              style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45, ...rojo(falta === 'cuando') }} />
            <textarea value={c.responder ?? ''} rows={3} maxLength={TOPE_RESPONDER} placeholder="Cómo responder" disabled={busy} aria-label="Cómo responder"
              onChange={(e) => setCaso(k, { responder: e.target.value }, false)}
              style={{ ...inpLienzo, resize: 'vertical', lineHeight: 1.45, ...rojo(falta === 'que_hace') }} />
            <div style={{ display: 'flex', flexWrap: 'wrap', columnGap: 18 }}>
              {/* Sin respuesta no hay nada que salga solo: el interruptor se apaga, y lo guardado no cambia. */}
              <Switch label="Sale sola" checked={contesta && c.sola === true} disabled={busy || !contesta}
                onChange={(v) => setCaso(k, { sola: v }, true)} />
              <Switch label="Avisarme" checked={c.avisar === true} disabled={busy}
                onChange={(v) => setCaso(k, { avisar: v }, true)} />
            </div>
          </div>
        );
      })}

      <button type="button" onClick={agregar} disabled={lleno} aria-label="Agregar un caso"
        style={{ ...PLACEHOLDER, display: 'flex', alignItems: 'center', cursor: lleno ? 'default' : 'pointer', color: lleno ? 'var(--faint)' : 'var(--primary)', fontFamily: SANS, fontWeight: 600 }}>
        ＋ Caso
      </button>

      <div style={caja(false)}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, fontWeight: 600, color: 'var(--ink)' }}>
          <span style={{ display: 'inline-flex', color: 'var(--dim)' }}><Icon name="bell" size={15} /></span>
          {ROTULO_OTRA_COSA} → te aviso
        </div>
        <input value={paso.otra_aviso ?? ''} maxLength={TOPE_OTRA_AVISO} placeholder={AVISO_OTRA_COSA} disabled={busy} aria-label="Aviso de otra cosa"
          onChange={(e) => cambiar({ otra_aviso: e.target.value }, false)} style={inpLienzo} />
      </div>
    </div>
  );
}
