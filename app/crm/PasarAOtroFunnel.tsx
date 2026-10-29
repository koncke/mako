'use client';

// =============================================================================
// PasarAOtroFunnel — la pregunta de PASAR los tildados a otro funnel y etapa (28/10/2026, ticket #21 de Leila)
// =============================================================================
// «Quiero limpiar la casilla de contacto nuevo de lidermente y pasarlo a Funnel general» (394 leads). La abre la barra en
// bloque (app/crm/AccionesLoteLeads.tsx), desde el desplegable «Funnel», debajo de los de AGREGAR: agregar suma y se
// deshace al toque, pasar SACA del funnel que se mira, y por eso pregunta.
//
// Lo que la pregunta dice ANTES de tocar nada (`previaPasarAction`): a qué etapa caen (la misma si el destino la tiene, si no
// se elige y se dice), cuántos ya pagaron en este funnel (no se pasan: sus pagos son de acá), cuántos ya agendaron (sólo si
// se marca), y cuántos ya estaban en el destino. Las reglas, puras, en lib/pasar-funnel-reglas.ts. Corre de a tandas con su
// avance y deja UN «Deshacer» para el lote entero en el aviso del tablero.

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/app/_ui/Modal';
import { SANS } from '@/app/_ui';
import { Dropdown } from '@/app/components/Dropdown';
import { previaPasarAction, pasarAOtroFunnelAction, deshacerPasarAction } from './lead-funnel-actions';
import { TANDA_LOTE, colaDelAviso, correrEnTandas } from './lote-tandas';
import { enTandas } from './traer-seleccion';
import { aPasar, avisosDePasar, etapaSugerida, etapasElegibles, resumenDePasar, type PreviaPasar } from '@/lib/pasar-funnel-reglas';
import type { ResultadoLote } from './AccionesLoteLeads';
import type { DeshacerPasar } from '@/lib/lead-funnel';

type Previa = PreviaPasar & { origen: string; destino: string };

export function PasarAOtroFunnel({ ids, destinos, funnelActivo, etapaOrigen, onCerrar, onListo }: {
  ids: number[];
  /** Los funnels adonde se puede pasar (todos menos el que se mira, `destinosDeLote`). `fid: null` = el del negocio. */
  destinos: Array<{ fid: number | null; nombre: string }>;
  funnelActivo: number | null;
  /** La etapa de los tildados, si todos están en la misma: es la que se busca en el destino. */
  etapaOrigen: string | null;
  onCerrar: () => void;
  onListo: (r: ResultadoLote) => void;
}) {
  const [hacia, setHacia] = useState<string>(destinos.length === 1 ? String(destinos[0].fid ?? 'default') : '');
  const [previa, setPrevia] = useState<Previa | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [etapa, setEtapa] = useState<string>('');
  const [conAgendados, setConAgendados] = useState(false);
  const [avance, setAvance] = useState<string | null>(null);
  const fid = hacia === '' ? undefined : hacia === 'default' ? null : Number(hacia);

  useEffect(() => {
    if (fid === undefined) return;
    let vivo = true;
    setPrevia(null); setErr(null);
    void previaPasarAction(ids, funnelActivo, fid).then((r) => {
      if (!vivo) return;
      if (!r.ok) { setErr(r.error); return; }
      setPrevia(r);
      setEtapa(etapaSugerida(etapaOrigen, r.etapas).key ?? '');
    }).catch((e: unknown) => { if (vivo) setErr(e instanceof Error ? e.message : 'No pude leer a los elegidos.'); });
    return () => { vivo = false; };
    // `ids` cambia de identidad en cada dibujo del tablero: lo que importa es a dónde.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hacia]);

  const sugerida = previa ? etapaSugerida(etapaOrigen, previa.etapas) : null;
  const lista = useMemo(() => (previa ? aPasar(ids, previa, conAgendados) : []), [ids, previa, conAgendados]);
  const agendadosSinPlata = previa ? previa.agendaron.filter((id) => !previa.pagaron.includes(id) && ids.includes(id)).length : 0;
  const etapaLabel = previa?.etapas.find((s) => s.key === etapa)?.label ?? etapa;
  const n = lista.length;

  const pasar = async () => {
    if (!previa || !etapa || !n || avance) return;
    setErr(null);
    const t = await correrEnTandas(lista, TANDA_LOTE, async (tanda) => {
      const r = await pasarAOtroFunnelAction(tanda, funnelActivo, fid ?? null, etapa);
      if (!r.ok) throw new Error(r.error);
      return r;
    }, (k) => setAvance(`Pasando ${k} de ${n}…`));
    setAvance(null);
    const pasados = t.resultados.reduce((s, r) => s + r.pasados.length, 0);
    const deshacer: DeshacerPasar[] = t.resultados.flatMap((r) => r.deshacer);
    const texto = resumenDePasar({
      pasados,
      yaEstaban: t.resultados.reduce((s, r) => s + r.yaEstaban, 0),
      fallaron: t.resultados.reduce((s, r) => s + r.fallaron, 0),
      motivos: [...new Set(t.resultados.flatMap((r) => r.motivos))],
    }, previa.destino, etapaLabel) + colaDelAviso(t, ['pasó', 'pasaron']);
    onListo({
      texto, hubo: pasados > 0, ...(t.error ? { tono: 'warn' as const } : {}),
      deshacer: deshacer.length ? async () => {
        for (const tanda of enTandas(deshacer, TANDA_LOTE)) {
          const q = await deshacerPasarAction(tanda);
          if (!q.ok) throw new Error(q.error);
          if (q.fallaron) throw new Error(`${q.fallaron} no se pudieron devolver`);
        }
      } : undefined,
    });
  };

  const avisos = previa ? avisosDePasar(previa, ids, previa.origen, previa.destino) : [];
  return (
    <Modal
      titulo={`Pasar ${ids.length} ${ids.length === 1 ? 'lead' : 'leads'} a otro funnel`}
      ancho={520}
      onCerrar={avance ? () => {} : onCerrar}
      pie={(
        <>
          {avance && <span role="status" style={{ marginRight: 'auto', fontFamily: SANS, fontSize: 13, color: 'var(--dim)' }}>{avance}</span>}
          <button type="button" onClick={onCerrar} disabled={!!avance}
            style={{ padding: '11px 18px', borderRadius: 10, border: '1px solid var(--border-strong)', background: 'var(--surface)', color: 'var(--ink)', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: SANS }}>
            Cancelar
          </button>
          <button type="button" data-pasar-funnel onClick={() => void pasar()} disabled={!previa || !etapa || !n || !!avance}
            style={{ padding: '11px 22px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: '#fff', fontSize: 14, fontWeight: 700, fontFamily: SANS,
              cursor: previa && etapa && n && !avance ? 'pointer' : 'default', opacity: previa && etapa && n && !avance ? 1 : 0.5 }}>
            {previa && n ? `Pasar ${n}` : 'Pasar'}
          </button>
        </>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: SANS }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
          A qué funnel
          <Dropdown value={hacia} placeholder="Elige el funnel" ariaLabel="Funnel de destino" width="100%"
            options={destinos.map((d) => ({ value: String(d.fid ?? 'default'), label: d.nombre }))}
            onChange={setHacia} disabled={!!avance} />
        </label>
        {fid !== undefined && !previa && !err && <p style={{ margin: 0, fontSize: 13, color: 'var(--dim)' }}>Mirando a los elegidos…</p>}
        {previa && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>
            A qué etapa
            <Dropdown value={etapa} placeholder="Elige la etapa" ariaLabel="Etapa de destino" width="100%"
              options={etapasElegibles(previa.etapas).map((s) => ({ value: s.key, label: s.label }))}
              onChange={setEtapa} disabled={!!avance} />
            {/* La etapa de acá no existe allá: se dice, y la que se puso es la de entrada (se puede cambiar). */}
            {sugerida && !sugerida.igual && etapaOrigen && (
              <span style={{ fontSize: 12.5, fontWeight: 500, color: 'var(--dim)' }}>
                «{previa.destino}» no tiene esta etapa: caen en la que elijas.
              </span>
            )}
          </label>
        )}
        {avisos.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13, color: 'var(--ink)' }}>
            {avisos.map((a) => <li key={a}>{a}</li>)}
          </ul>
        )}
        {agendadosSinPlata > 0 && (
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--ink)', cursor: 'pointer' }}>
            <input type="checkbox" checked={conAgendados} onChange={(e) => setConAgendados(e.target.checked)} disabled={!!avance}
              style={{ width: 16, height: 16, accentColor: 'var(--primary)' }} />
            Pasar también {agendadosSinPlata === 1 ? 'el que agendó' : `los ${agendadosSinPlata} que agendaron`}
          </label>
        )}
        {previa && (
          <p style={{ margin: 0, fontSize: 12.5, color: 'var(--dim)' }}>
            Salen de «{previa.origen}» con su historial. No les llega ningún mensaje por pasarlos; si esa etapa tiene una
            automatización, los toma con su ritmo de siempre.
          </p>
        )}
        {previa && !n && <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--bad)' }}>Con lo marcado, no queda ninguno para pasar.</p>}
        {err && <div style={{ borderRadius: 10, padding: '10px 14px', fontSize: 13.5, fontWeight: 600, background: 'var(--bad-bg)', color: 'var(--bad)' }}>{err}</div>}
      </div>
    </Modal>
  );
}
