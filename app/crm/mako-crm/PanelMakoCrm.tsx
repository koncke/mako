'use client';

// =============================================================================
// PanelMakoCrm — MaKo en el CRM: la ESTRELLA del Ops Center, con las sugerencias del CRM arriba del Cerebro
// =============================================================================
// Pedido de Martín (13/10/2026, General 3): «replica el mismo chat que hay en Automations, que se abre
// al costado… que siempre esté plegado y que ahí aparezcan notificaciones». El 14/10: «No veo nada
// sobre el chat de MaKo y las recomendaciones...». El mapa: docs/sugerencias-mako-crm.md.
//
//   · DESDE EL 22/10/2026 ES LA PIEZA DE TODAS LAS TABS (app/_chat/MakoEnLaTab.tsx, del chat «Ops Center»). Martín, 21/10:
//     «los iconos de las criaturas siempre debe ser el icono de MaKo, se envía lo que sea que envíen al cerebro y ya el
//     cerebro se encarga de repartir». La estrella abajo a la izquierda, el panel a la izquierda pegado a la barra de la
//     app, y lo que se escribe cae en el chat «Cerebro» de la persona. El chat propio del CRM (ChatMakoCrm, un hilo por
//     CRM) se fue con esto: no se arma otro en app/_chat/ ni acá.
//   · LO DEL CRM VA ARRIBA DEL HILO (`arriba`): las sugerencias (UNA línea cada una, «Hacerlo» y «Ahora no») y
//     «Calladas (N)». Su número va en la estrella plegada (`aviso`).
//   · LO CARO NO SE CALCULA ACÁ NI EN LA PÁGINA: las sugerencias se piden UNA vez al montarse (GET /api/crm/mako, que
//     no escribe y sale de la caché del server). El Cerebro se pide recién al ABRIR (la pieza monta el motor ahí).
//   · «HACERLO» Y «AHORA NO» los decide el server por ID (app/api/crm/mako/route.ts): la pantalla no elige plantilla ni
//     etapa. A quien no es admin no se le ofrece lo que es del admin (`hacer`, `callar`). Lo creado nace PAUSADO y la
//     fila deja el link para abrirlo en /automations.
//   · «HACERLO» DE UNA QUE SE REVISA CON MaKo (`tipo: 'chat'`) le manda el pedido al Cerebro (`pedido` de la pieza), con
//     el CRM NOMBRADO (`pedidoParaElCerebro`): el Cerebro no sabe desde qué CRM le escriben.
//   · LO CALLADO TIENE VUELTA: «Calladas (N)» despliega lo que el equipo calló en ESTE CRM con «Volver a mostrar» en
//     cada una. Del admin, como «Ahora no».
//   · ⚠️ UN PANEL POR CRM (`key`): cambiar de CRM desmonta el de antes (sus sugerencias y la estrella) y el nuevo nace
//     plegado, con las suyas.
// =============================================================================

import { useEffect, useState } from 'react';
import { Button } from '@/app/_ui';
import { MakoEnLaTab } from '@/app/_chat/MakoEnLaTab';
import type { PreguntaDeLaTab } from '@/app/admin/operaciones/PreguntasDelChat';
import { entidadDelLead, useLeadAbierto } from '../lead-abierto';
import { leerRespuesta } from '@/app/m/mako/chat-ui';
import { pedidoParaElCerebro, type SugerenciaDePantalla } from '@/lib/sugerencias-crm';
import { ReportarASoporte } from '@/app/_ui/ReportarASoporte';
import { AperturaMako, useApertura } from '@/app/_chat/AperturaMako';
import { useGuiaDeLaTab } from '@/app/_ui/guia/useGuiaDeLaTab';
import { useGuiaEnElChat } from '@/app/_ui/guia/store';
import { ASPECTO_MAKO } from '@/lib/centro-munecos';
import { SUPERFICIE_CRM, type HechosCrm } from '@/lib/aperturas/crm';

const RUTA = '/api/crm/mako';

type Respuesta = {
  crm: { id: number; nombre: string }; sugerencias: SugerenciaDePantalla[];
  /** null = lo callado no se pudo leer */
  calladas: SugerenciaDePantalla[] | null;
  callar: boolean;
};
type Hecha = { href: string; nombre: string; aviso: string | null };
type AccionFila = 'hacer' | 'ahora_no' | 'volver_a_mostrar';

/** Lo que vuelve a la lista entra en su clase: las del tablero (3) primero, como las ordena el motor. */
const conDeVuelta = (xs: readonly SugerenciaDePantalla[], s: SugerenciaDePantalla): SugerenciaDePantalla[] => {
  if (xs.some((x) => x.id === s.id)) return [...xs];
  const i = s.clase === 3 ? xs.filter((x) => x.clase === 3).length : xs.length;
  return [...xs.slice(0, i), s, ...xs.slice(i)];
};

/** Otro CRM es entrar de nuevo: otro panel, plegado y con sus sugerencias (ver la cabecera). */
/**
 * `apertura`: lo que la página sabe para que MaKo hable primero (lib/aperturas/crm.ts, 5/11/2026): los leads del NEGOCIO y si quien
 * mira lo administra. Sin esto (o con la lectura caída), MaKo calla.
 */
export function PanelMakoCrm({ funnelId, apertura }: { funnelId: number | null; apertura?: { leads: number | null; esAdmin: boolean } }) {
  return <PanelDeUnCrm key={funnelId ?? 'principal'} funnelId={funnelId} apertura={apertura} />;
}

function PanelDeUnCrm({ funnelId, apertura: datos }: { funnelId: number | null; apertura?: { leads: number | null; esAdmin: boolean } }) {
  // Con la ficha de un lead abierta, la estrella va con ese lead (OC6): el turno lo toma por defecto y el mensaje dice «desde CRM › Ana».
  const abierto = useLeadAbierto();
  const [sugs, setSugs] = useState<SugerenciaDePantalla[] | null>(null);
  const [calladas, setCalladas] = useState<SugerenciaDePantalla[]>([]);
  const [verCalladas, setVerCalladas] = useState(false);
  const [callar, setCallar] = useState(false);
  const [errorSugs, setErrorSugs] = useState<string | null>(null);
  const [hechas, setHechas] = useState<Record<string, Hecha>>({});
  const [ocupada, setOcupada] = useState<string | null>(null);
  const [errorFila, setErrorFila] = useState<Record<string, string>>({});
  /** El nombre de ESTE CRM: el pedido que sale al Cerebro lo nombra. */
  const [crm, setCrm] = useState<string | null>(null);
  const [pedido, setPedido] = useState<{ texto: string; vez: number } | null>(null);

  // ── Las sugerencias: UNA vez, al montarse (el server las tiene calculadas) ──
  useEffect(() => {
    let vivo = true;
    void (async () => {
      let status = 0; let cuerpo = '';
      try {
        const r = await fetch(`${RUTA}?funnel=${funnelId ?? ''}`, { signal: AbortSignal.timeout(30_000) });
        status = r.status; cuerpo = await r.text();
      } catch { /* red caída: status 0 */ }
      if (!vivo) return;
      const l = leerRespuesta<Respuesta>(status, cuerpo);
      if (!l.ok) { setSugs([]); setErrorSugs('No pude cargar las sugerencias.'); return; }
      setSugs(l.datos.sugerencias ?? []);
      setCalladas(l.datos.calladas ?? []);
      setCallar(l.datos.callar === true);
      setCrm(l.datos.crm?.nombre ?? null);
      setErrorSugs(null);
    })();
    return () => { vivo = false; };
  }, [funnelId]);

  const sacar = (id: string) => setSugs((xs) => (xs ?? []).filter((x) => x.id !== id));

  const pedirAlServer = async (accion: AccionFila, s: SugerenciaDePantalla) => {
    if (ocupada) return;
    setOcupada(`${accion}:${s.id}`);
    setErrorFila((m) => { const n = { ...m }; delete n[s.id]; return n; });
    try {
      let status = 0; let cuerpo = '';
      try {
        const r = await fetch(RUTA, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: accion, funnel: funnelId, sugerencia: s.id }),
          signal: AbortSignal.timeout(60_000),
        });
        status = r.status; cuerpo = await r.text();
      } catch { /* red caída: status 0 */ }
      const l = leerRespuesta<{ secuenciaId?: number; nombre?: string; aviso?: string | null; href?: string }>(status, cuerpo);
      if (!l.ok) {
        // Crear pudo haber corrido igual: no se dice «no pasó», se dice que no se sabe.
        setErrorFila((m) => ({ ...m, [s.id]: l.reintentable ? l.error : 'No sé si se hizo. Recarga para ver.' }));
        return;
      }
      if (accion === 'ahora_no') { sacar(s.id); setCalladas((xs) => [...xs.filter((x) => x.id !== s.id), s]); return; }
      // `cambio: false` (otra persona ya la había vuelto a mostrar, o venció) también deja la fila a la vista.
      if (accion === 'volver_a_mostrar') { setCalladas((xs) => xs.filter((x) => x.id !== s.id)); setSugs((xs) => conDeVuelta(xs ?? [], s)); return; }
      if (l.datos.href) setHechas((m) => ({ ...m, [s.id]: { href: l.datos.href!, nombre: l.datos.nombre ?? 'La automatización', aviso: l.datos.aviso ?? null } }));
    } finally {
      setOcupada(null);
    }
  };

  const hacer = (s: SugerenciaDePantalla) => {
    if (s.tipo === 'chat' && s.pedido) { setPedido({ texto: pedidoParaElCerebro(s.pedido, crm), vez: Date.now() }); sacar(s.id); return; }
    if (s.tipo === 'plantilla') void pedirAlServer('hacer', s);
  };

  const visibles = (sugs ?? []).filter((s) => !hechas[s.id]);
  const n = visibles.length;

  // LAS SUGERENCIAS VAN EN EL BLOQUE DE PREGUNTAS de la estrella (22/10/2026, Martín con captura: «Mira lo mal que se ve
  // esto»): una por vez arriba de la caja, con «Hacerlo» y «Ahora no» como sus opciones. Eran una lista suelta arriba del hilo,
  // con su propio scroll, que se comía la mitad del panel. Lo que hace cada opción es lo de siempre (`hacer`, `pedirAlServer`).
  const preguntas: PreguntaDeLaTab[] = (sugs ?? []).map((s) => {
    const hecha = hechas[s.id];
    const opciones: PreguntaDeLaTab['opciones'] = [
      ...(s.hacer ? [{ titulo: 'Hacerlo', recomendada: true, ...(s.tipo === 'link' && s.href ? { href: s.href } : { onElegir: () => hacer(s) }) }] : []),
      ...(callar ? [{ titulo: 'Ahora no', onElegir: () => void pedirAlServer('ahora_no', s) }] : []),
    ];
    const enCurso = ocupada === `hacer:${s.id}` ? 0 : ocupada === `ahora_no:${s.id}` ? (s.hacer ? 1 : 0) : null;
    return {
      id: s.id, pregunta: s.texto, opciones, ocupada: enCurso, quieta: !!ocupada && enCurso == null, error: errorFila[s.id] ?? null,
      hecha: hecha ? { texto: `Quedó pausada${hecha.aviso ? ` · ${hecha.aviso}` : ''}`, href: hecha.href, rotulo: 'Abrir' } : null,
    };
  });
  // Arriba del hilo queda sólo lo que no es una pregunta: que no se pudieron leer, y «Calladas (N)».
  const sugerencias = (errorSugs || (callar && calladas.length > 0)) ? (
    <section aria-label="Sugerencias del CRM" data-sugerencias-crm style={{ flex: 'none', borderBottom: '1px solid var(--border)', padding: '6px 0' }}>
      {errorSugs && <p role="status" style={{ margin: '8px 14px', fontSize: 13, color: 'var(--dim)' }}>{errorSugs}</p>}
      {callar && calladas.length > 0 && (
        <div style={{ padding: '4px 14px 6px', display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}>
          <Button variant="tertiary" size="sm" aria-expanded={verCalladas} onClick={() => setVerCalladas((v) => !v)}>
            Calladas ({calladas.length})
          </Button>
          {verCalladas && calladas.map((s) => {
            const enCurso = ocupada === `volver_a_mostrar:${s.id}`;
            return (
              <div key={s.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, paddingBottom: 4 }}>
                <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, color: 'var(--dim)', overflowWrap: 'anywhere' }}>{s.texto}</p>
                <Button variant="secondary" size="sm" loading={enCurso} disabled={!!ocupada && !enCurso} onClick={() => void pedirAlServer('volver_a_mostrar', s)}>Volver a mostrar</Button>
                {errorFila[s.id] && <p role="alert" style={{ margin: 0, fontSize: 12.5, color: 'var(--warn)' }}>{errorFila[s.id]}<ReportarASoporte /></p>}
              </div>
            );
          })}
        </div>
      )}
    </section>
  ) : null;

  // MAKO TOMA LA INICIATIVA (5/11/2026, docs/mako-iniciativa/plan.md T7): con el CRM vacío pregunta dónde están sus clientes
  // (lib/aperturas/crm.ts), y LA GUÍA de la pestaña pregunta la primera vez (app/crm/guia-crm.ts). Calla con algo en el bloque de
  // preguntas (las sugerencias medidas van primero) y mientras la guía habla o señala.
  const sinLeads = datos?.leads === 0;
  useGuiaDeLaTab('crm', { listo: sugs != null, hechos: { sinLeads }, rol: datos?.esAdmin ? 'admin' : 'miembro' });
  const guia = useGuiaEnElChat();
  const hechos: HechosCrm | null = datos ? { leads: datos.leads, esAdmin: datos.esAdmin, funnelId } : null;
  const estadoApertura = useApertura({ superficie: SUPERFICIE_CRM, hechos, libre: sugs != null && n === 0 && !guia.pregunta && !guia.senalando && !guia.esperando });
  const aperturaTab = estadoApertura.apertura ? <AperturaMako estado={estadoApertura} quien={{ nombre: 'MaKo', aspecto: ASPECTO_MAKO }} acciones={{}} /> : null;

  return <MakoEnLaTab tab="CRM" apertura={aperturaTab} entidad={entidadDelLead(abierto)} arriba={sugerencias} preguntas={preguntas} aviso={n} pedido={pedido} />;
}
