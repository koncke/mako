'use client';

// =============================================================================
// /m/ads — la pantalla: período, resumen, campañas con su interruptor y el sheet de una campaña
// =============================================================================
// Prototipo `data-ir="ads"` (docs/prototipos/mako-mobile-v2.html) y docs/diseno-mako-mobile-v2.md,
// «Ads Manager». Los datos bajan YA filtrados y formateados del server (./datos.ts).
//
// LAS ESCRITURAS SON LAS DE ESCRITORIO: POST /api/meta-write (lib/meta-write.ts), con su guard
// (`wsDeAdsManager`: sólo quien administra ESTE workspace). El workspace lo pone el parche de
// fetch (app/_components/WsFetch.tsx) desde el `?ws=` de la pestaña; el body sólo lleva el id de
// Meta. Quien no administra ve todo y no toca nada (`puedeOperar`, el mismo guard en el server).
//
// ⚠️ LA CACHÉ DEL ÁRBOL NO SE ENTERA DE UNA ESCRITURA (docs/hallazgos-ads.md: `getMetaHealth`
//    tiene revalidate 120 y es stale-while-revalidate, y metaWrite no la invalida). Tirar para
//    refrescar o cambiar de período después de pausar podía traer el árbol VIEJO y prender el
//    interruptor de nuevo. Por eso lo escrito se recuerda con la hora del SERVIDOR y se suelta con
//    `presupuestosVigentes` (lib/presupuesto-cambio.ts), la misma regla de la tabla de escritorio
//    — para el presupuesto y, con 1/0, para el estado.
// =============================================================================

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button, ButtonLink } from '@/app/_ui/Button';
import { Icon } from '@/app/_components/icons';
import {
  ErrorM, FilaDatoM, FilaM, InterruptorM, ListaM, PieM, PildoraM, SeccionM, SegmentadoM, SheetM, VacioM, useConexion, useToastM,
} from '@/app/m/_ui';
import { horaDeEscritura, presupuestosVigentes, type EscritoPresupuesto } from '@/lib/presupuesto-cambio';
import {
  PERIODOS_ADS, agendasTexto, avisoDeFallo, cambioPresupuesto, deshacerPausaLaCampana, dinero, pasoDe, pasoSiguiente, textoDiario, tipeado,
  unidadDePresupuesto, type CampanaM, type HijoM, type LecturaAds, type PeriodoAdsId, type PresupuestoM,
} from './modelo';

type Ok = Extract<LecturaAds, { estado: 'ok' }>;
type Escritura = { ok: true; en: number } | { ok: false; aviso: string };

/** POST a /api/meta-write. Nunca tira: una falla vuelve como el aviso corto del toast. */
async function escribir(body: Record<string, unknown>): Promise<Escritura> {
  try {
    const r = await fetch('/api/meta-write', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    // Meta devuelve sus errores ADENTRO del cuerpo: lo que manda es `ok`, nunca `r.ok` solo.
    const j = (await r.json().catch(() => null)) as { ok?: boolean; error?: string; message?: string; error_subcode?: number } | null;
    if (j?.ok) return { ok: true, en: horaDeEscritura(r.headers.get('date'), Date.now()) };
    console.warn(`[m/ads] ${String(body.op)} ${String(body.id)} no salió (HTTP ${r.status}): ${j?.error ?? j?.message ?? 'sin detalle'}`);
    return { ok: false, aviso: avisoDeFallo(r.status, j) };
  } catch (e) {
    console.warn('[m/ads] sin respuesta de /api/meta-write:', e);
    return { ok: false, aviso: 'No se pudo enviar' };
  }
}

/** Mapa → mapa nuevo con un valor puesto o sacado (los Map de estado se reemplazan, no se mutan). */
function con<V>(m: Map<string, V>, id: string, v: V | undefined): Map<string, V> {
  const n = new Map(m);
  if (v === undefined) n.delete(id); else n.set(id, v);
  return n;
}

export function AdsM({ periodo, lectura, puedeOperar }: { periodo: PeriodoAdsId; lectura: Ok; puedeOperar: boolean }) {
  const { campanas, resumen, moneda, cuentaEstado, leidaDesde } = lectura;
  const router = useRouter();
  const toast = useToastM();
  const { enLinea } = useConexion();

  // ── El período: vive en la URL y lo lee el server; el segmentado responde YA ──────────────
  const [pedido, setPedido] = useState<PeriodoAdsId | null>(null);
  const [cargando, empezar] = useTransition();
  useEffect(() => { if (!cargando) setPedido(null); }, [cargando]);
  const cambiarPeriodo = (id: PeriodoAdsId) => {
    if (id === periodo) return;
    setPedido(id);
    empezar(() => router.replace(`/m/ads?periodo=${id}`, { scroll: false }));
  };
  const periodoVisto = cargando && pedido ? pedido : periodo;
  const periodoEn = PERIODOS_ADS.find((p) => p.id === periodo)?.en ?? '';

  // ── Lo escrito desde aquí (ver la cabecera: la caché del árbol no se entera) ───────────────
  const [optEstado, setOptEstado] = useState<Map<string, boolean>>(() => new Map());
  const [optPresu, setOptPresu] = useState<Map<string, number>>(() => new Map());
  const escritosEstado = useRef(new Map<string, EscritoPresupuesto>());
  const escritosPresu = useRef(new Map<string, EscritoPresupuesto>());
  // En vuelo, por id de Meta. El ref decide (un «Deshacer» llega en otro render); el estado dibuja.
  const vuelo = useRef(new Set<string>());
  const [enVuelo, setEnVuelo] = useState<Set<string>>(() => new Set());
  const marcar = (id: string, si: boolean) => {
    if (si) vuelo.current.add(id); else vuelo.current.delete(id);
    setEnVuelo(new Set(vuelo.current));
  };

  // Cada lectura nueva del server (otro período, tirar para refrescar) decide qué sigue valiendo.
  useEffect(() => {
    const realesP = new Map<string, number | null>();
    const realesE = new Map<string, number | null>();
    for (const c of campanas) {
      realesE.set(c.id, c.activa ? 1 : 0);
      for (const p of c.presupuestos) realesP.set(p.id, p.diario);
    }
    const p = presupuestosVigentes(escritosPresu.current, realesP, leidaDesde);
    for (const id of p.soltar) escritosPresu.current.delete(id);
    setOptPresu(p.mantener);
    const e = presupuestosVigentes(escritosEstado.current, realesE, leidaDesde);
    for (const id of e.soltar) escritosEstado.current.delete(id);
    setOptEstado(new Map([...e.mantener].map(([id, v]) => [id, v === 1])));
  }, [campanas, leidaDesde]);

  const activaDe = (c: CampanaM) => optEstado.get(c.id) ?? c.activa;
  const diarioDe = (p: PresupuestoM) => optPresu.get(p.id) ?? p.diario;

  // ── Prender / pausar ─────────────────────────────────────────────────────────────────────
  // Pausar escribe SÓLO la campaña (los hijos dejan de entregar solos). Activar escribe la campaña
  // y la cascada (`hijos`). «Deshacer» vuelve EXACTAMENTE: deshacer una pausa activa sólo la
  // campaña; deshacer una activación pausa los hijos que se prendieron y la campaña SÓLO si antes
  // no estaba configurada activa (una en revisión sale apagada y ya lo estaba: `deshacerPausaLaCampana`).
  async function cambiarEstado(c: CampanaM, activar: boolean, hijos: HijoM[], conDeshacer: boolean) {
    if (vuelo.current.has(c.id)) return;
    marcar(c.id, true);
    const previo = escritosEstado.current.get(c.id);
    const pausarAlDeshacer = deshacerPausaLaCampana(c.configuradaActiva, previo);
    const mio: EscritoPresupuesto = { valor: activar ? 1 : 0, en: null };
    escritosEstado.current.set(c.id, mio);
    setOptEstado((m) => con(m, c.id, activar));
    const status = activar ? 'ACTIVE' : 'PAUSED';
    const [principal, ...resto] = await Promise.all([
      escribir({ level: 'campaign', id: c.id, op: 'status', status }),
      ...hijos.map((h) => escribir({ level: h.nivel, id: h.id, op: 'status', status })),
    ]);
    marcar(c.id, false);
    if (!principal.ok) {
      if (escritosEstado.current.get(c.id) === mio) {
        if (previo) { escritosEstado.current.set(c.id, previo); setOptEstado((m) => con(m, c.id, previo.valor === 1)); }
        else { escritosEstado.current.delete(c.id); setOptEstado((m) => con(m, c.id, undefined)); }
      }
      toast(principal.aviso);
      return;
    }
    mio.en = principal.en;
    if (escritosEstado.current.get(c.id) === mio) setOptEstado((m) => con(m, c.id, activar));
    const hechos = hijos.filter((_, i) => resto[i]?.ok);
    const fallaron = hijos.length - hechos.length;
    const texto = fallaron > 0 ? 'Parte no se activó' : activar ? 'Campaña activa' : 'Campaña en pausa';
    const deshacer = () => {
      if (!activar) void cambiarEstado(c, true, [], false);
      else if (pausarAlDeshacer) void cambiarEstado(c, false, hechos, false);
      else void apagarSoloHijos(c, previo, hechos);
    };
    toast(texto, conDeshacer ? { deshacer } : undefined);
  }

  /**
   * «Deshacer» la activación de una campaña que YA estaba configurada activa: a ella no se le escribe nada
   * (prenderla no le cambió nada a Meta), se pausan sólo los hijos que se prendieron y el interruptor vuelve
   * a como estaba antes del toque (`antes`).
   */
  async function apagarSoloHijos(c: CampanaM, antes: EscritoPresupuesto | undefined, hijos: HijoM[]) {
    if (vuelo.current.has(c.id)) return;
    marcar(c.id, true);
    const res = await Promise.all(hijos.map((h) => escribir({ level: h.nivel, id: h.id, op: 'status', status: 'PAUSED' })));
    marcar(c.id, false);
    if (antes) escritosEstado.current.set(c.id, antes); else escritosEstado.current.delete(c.id);
    setOptEstado((m) => con(m, c.id, antes ? antes.valor === 1 : undefined));
    toast(res.every((r) => r.ok) ? 'Deshecho' : 'Parte no se deshizo');
  }

  // ── Presupuesto diario ───────────────────────────────────────────────────────────────────
  // El molde de `writeBudget` de escritorio: se anota EN VUELO antes del POST, y si falla vuelve a
  // lo que la fila mostraba antes (no al árbol cargado, que puede ser de antes de otra escritura).
  async function ponerPresupuesto(p: PresupuestoM, nuevo: number, previoCuenta: number, conDeshacer: boolean): Promise<boolean> {
    if (vuelo.current.has(p.id)) return false;
    marcar(p.id, true);
    const previo = escritosPresu.current.get(p.id);
    const mio: EscritoPresupuesto = { valor: nuevo, en: null };
    escritosPresu.current.set(p.id, mio);
    setOptPresu((m) => con(m, p.id, nuevo));
    const r = await escribir({ level: p.nivel, id: p.id, op: 'budget', dailyBudgetMxn: nuevo });
    marcar(p.id, false);
    if (!r.ok) {
      if (escritosPresu.current.get(p.id) === mio) {
        if (previo) { escritosPresu.current.set(p.id, previo); setOptPresu((m) => con(m, p.id, previo.valor)); }
        else { escritosPresu.current.delete(p.id); setOptPresu((m) => con(m, p.id, undefined)); }
      }
      toast(r.aviso);
      return false;
    }
    mio.en = r.en;
    if (escritosPresu.current.get(p.id) === mio) setOptPresu((m) => con(m, p.id, nuevo));
    const corto = dinero(tipeado(nuevo, moneda), unidadDePresupuesto(moneda));
    toast(`${corto} al día`, conDeshacer ? { deshacer: () => { void ponerPresupuesto(p, previoCuenta, nuevo, false); } } : undefined);
    return true;
  }

  // ── El sheet de una campaña ──────────────────────────────────────────────────────────────
  // `fichaId` se queda puesto al cerrar: el sheet sale animado con su contenido, no vacío.
  const [abierto, setAbierto] = useState(false);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [valor, setValor] = useState(0);
  const ficha = campanas.find((c) => c.id === fichaId) ?? null;
  const sel = ficha?.presupuestos.find((p) => p.id === selId) ?? ficha?.presupuestos[0] ?? null;

  const abrir = (c: CampanaM) => {
    const p0 = c.presupuestos[0] ?? null;
    setFichaId(c.id);
    setSelId(p0?.id ?? null);
    setValor(p0 ? tipeado(diarioDe(p0), moneda) : 0);
    setAbierto(true);
  };
  const elegir = (p: PresupuestoM) => { setSelId(p.id); setValor(tipeado(diarioDe(p), moneda)); };
  const ocupado = sel != null && enVuelo.has(sel.id);
  const cerrar = () => { if (!ocupado) setAbierto(false); };

  const cambio = sel ? cambioPresupuesto(valor, diarioDe(sel), moneda) : null;
  const aplicar = async () => {
    if (!sel || !cambio?.cambia) return;
    const ok = await ponerPresupuesto(sel, cambio.nuevoCuenta, diarioDe(sel), true);
    if (ok) setAbierto(false);
  };

  // ── La lista ─────────────────────────────────────────────────────────────────────────────
  const [verResto, setVerResto] = useState(false);
  const destacadas = campanas.filter((c) => c.destacada);
  const resto = campanas.filter((c) => !c.destacada);
  // Si no hay ninguna destacada, esconder todo detrás de una fila no tiene sentido.
  const mostrarResto = verResto || destacadas.length === 0;

  /** «9 agendas · US$60/día», «En pausa · US$15/día». */
  const linea = (c: CampanaM): string | undefined => {
    const partes: string[] = [];
    const opt = optEstado.get(c.id);
    if (opt === false) partes.push('En pausa');
    else if (opt === true || c.activa) { if (c.gasto != null) partes.push(c.agendas > 0 ? agendasTexto(c.agendas) : 'Sin agendas'); }
    // En rojo, el estado ya lo dice la píldora: no se repite en la línea.
    else if (!c.estadoRojo) partes.push(c.estado);
    if (c.presupuestos.length === 1) partes.push(textoDiario(diarioDe(c.presupuestos[0]), moneda));
    else if (c.presupuestos.length > 1) partes.push(`${c.presupuestos.length} presupuestos`);
    else if (c.total != null) partes.push(`${dinero(tipeado(c.total, moneda), unidadDePresupuesto(moneda))} total`);
    return partes.length ? partes.join(' · ') : undefined;
  };

  /** La píldora decide algo: «Con problemas · N» (lo que escritorio pinta como URGENTE), o el pago. */
  const pildora = (c: CampanaM): ReactNode => {
    if (c.pagoFrenado && activaDe(c)) return <PildoraM tono="bad">Error en el pago</PildoraM>;
    if (c.problemas.length > 0) return <PildoraM tono="warn">Con problemas · {c.problemas.length}</PildoraM>;
    if (c.estadoRojo) return <PildoraM tono="bad">{c.estadoRojo}</PildoraM>;
    return null;
  };

  const fila = (c: CampanaM) => {
    const on = activaDe(c);
    return (
      <FilaM
        key={c.id}
        titulo={c.nombre}
        segunda={linea(c)}
        pill={pildora(c)}
        onClick={() => abrir(c)}
        control={(
          <InterruptorM
            etiqueta={`Activa: ${c.nombre}`}
            activo={on}
            deshabilitado={!puedeOperar || !enLinea || c.archivada || enVuelo.has(c.id)}
            onCambio={(v) => { void cambiarEstado(c, v, v ? c.hijos : [], true); }}
          />
        )}
      />
    );
  };

  // ── El cuerpo del sheet ──────────────────────────────────────────────────────────────────
  const unidad = unidadDePresupuesto(moneda);
  const paso = sel ? pasoDe(tipeado(diarioDe(sel), moneda), moneda) : 5;
  const nombrePaso = unidad === 'USD' ? `${paso} dólares` : `${paso.toLocaleString('es-AR')} ${unidad}`;
  const conPago = ficha != null && ficha.pagoFrenado && activaDe(ficha);
  const hayProblemas = ficha != null && (ficha.problemas.length > 0 || conPago);
  const editable = puedeOperar && sel != null;

  const cuerpo = ficha && (
    <>
      {ficha.gasto != null && (
        <ListaM>
          <FilaDatoM k={`Importe gastado ${periodoEn}`} v={ficha.gasto} />
          <FilaDatoM k="Resultados" v={agendasTexto(ficha.agendas)} />
          <FilaDatoM k="Coste por resultado" v={ficha.costo ?? '—'} />
        </ListaM>
      )}

      {hayProblemas && (
        <>
          <h3 className="m-ads-subt">Por qué no está entregando</h3>
          <ListaM>
            {conPago && <FilaM titulo="Error en el pago" segunda={cuentaEstado} />}
            {ficha.problemas.map((p) => <FilaM key={p.id} titulo={p.nombre} segunda={p.motivo} />)}
          </ListaM>
          {ficha.enMeta && (
            <div className="m-ads-meta">
              <ButtonLink href={ficha.enMeta.href} newTab variant="secondary" size="lg" full>{ficha.enMeta.rotulo}</ButtonLink>
            </div>
          )}
        </>
      )}

      {ficha.presupuestos.length > 0 && !puedeOperar && (
        <>
          <h3 className="m-ads-subt">Presupuesto diario</h3>
          <ListaM>
            {ficha.presupuestos.map((p) => (
              <FilaDatoM key={p.id} k={ficha.presupuestos.length > 1 ? p.nombre : 'Por día'} v={textoDiario(diarioDe(p), moneda)} />
            ))}
          </ListaM>
        </>
      )}

      {editable && sel && (
        <>
          <h3 className="m-ads-subt">{ficha.presupuestos.length > 1 ? 'Presupuesto por conjunto' : 'Presupuesto diario'}</h3>
          {ficha.presupuestos.length > 1 && (
            <ListaM etiqueta="Conjunto">
              {ficha.presupuestos.map((p) => (
                <FilaM
                  key={p.id}
                  titulo={p.nombre}
                  segunda={textoDiario(diarioDe(p), moneda)}
                  onClick={() => elegir(p)}
                  chevron={false}
                  riel={p.id === sel.id ? <span className="m-ads-elegido"><Icon name="check" size={20} /><span className="m-sr">Elegido</span></span> : null}
                  deshabilitada={ocupado}
                />
              ))}
            </ListaM>
          )}
          <div className="m-ads-stepper">
            <button
              type="button"
              className="m-ads-stepper__btn"
              aria-label={`Bajar ${nombrePaso}`}
              disabled={ocupado || valor <= 1}
              onClick={() => setValor((v) => pasoSiguiente(v, paso, -1))}
            >−</button>
            <output className="m-ads-stepper__valor" aria-live="polite" data-largo={dinero(valor, unidad).length > 8 || undefined}>{dinero(valor, unidad)}</output>
            <button
              type="button"
              className="m-ads-stepper__btn"
              aria-label={`Subir ${nombrePaso}`}
              disabled={ocupado}
              onClick={() => setValor((v) => pasoSiguiente(v, paso, 1))}
            >+</button>
          </div>
          <p className="m-ads-stepper__pie">Hoy: {dinero(tipeado(diarioDe(sel), moneda), unidad)} al día</p>
        </>
      )}

      {ficha.presupuestos.length === 0 && ficha.total != null && (
        <ListaM>
          <FilaDatoM k="Presupuesto total" v={dinero(tipeado(ficha.total, moneda), unidad)} />
        </ListaM>
      )}
    </>
  );

  const pie = editable && cambio ? (
    <PieM consecuencia={cambio.consecuencia}>
      <Button variant="primary" size="lg" full disabled={!cambio.cambia || !enLinea} loading={ocupado} onClick={() => { void aplicar(); }}>
        {cambio.boton}
      </Button>
      <Button variant="tertiary" size="lg" full disabled={ocupado} onClick={cerrar}>No cambiar</Button>
    </PieM>
  ) : undefined;

  return (
    <div className={cargando ? 'm-ads m-ads--cargando' : 'm-ads'} aria-busy={cargando || undefined}>
      <div className="m-ads-seg">
        <SegmentadoM
          etiqueta="Período"
          valor={periodoVisto}
          onCambio={cambiarPeriodo}
          opciones={PERIODOS_ADS.map((p) => ({ id: p.id, label: p.label }))}
        />
      </div>

      <div className="m-ads-resumen">
        {resumen ? (
          <ListaM etiqueta="Resumen">
            <FilaDatoM k="Importe gastado" v={resumen.gasto} />
            <FilaDatoM k="Resultados" v={resumen.resultados} />
            <FilaDatoM k="Coste por resultado" v={resumen.costo} />
          </ListaM>
        ) : (
          <ErrorM frase="No pudimos leer el gasto. No es nada tuyo." />
        )}
      </div>

      <SeccionM titulo="Campañas">
        {campanas.length === 0 ? (
          <VacioM frase="Todavía no hay campañas en Meta." />
        ) : (
          <>
            {destacadas.length > 0 && <ListaM>{destacadas.map(fila)}</ListaM>}
            {resto.length > 0 && (
              mostrarResto
                ? <ListaM>{resto.map(fila)}</ListaM>
                : (
                  <ListaM>
                    <FilaM titulo="Apagadas y sin gasto" navegacion riel={resto.length} onClick={() => setVerResto(true)} />
                  </ListaM>
                )
            )}
          </>
        )}
      </SeccionM>

      <SheetM
        abierto={abierto}
        onCerrar={cerrar}
        titulo={ficha?.nombre ?? 'Campaña'}
        id="campana"
        snap="alto"
        ocupado={ocupado}
        rotuloCerrar="Cerrar la campaña"
        pie={pie}
      >
        {cuerpo}
      </SheetM>
    </div>
  );
}
