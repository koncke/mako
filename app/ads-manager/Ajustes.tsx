'use client';

// =============================================================================
// Media Buyer — Ajustes (/ads-manager/ajustes): con la densidad de «Hoy» y el molde de Settings de la casa (27/10/2026)
// =============================================================================
// Hasta el 27/10 era la página «AI Marketer settings» de Madgicx con su hoja propia (mb.css): cinco tarjetas con un campo
// grande por renglón, sus ayudas debajo y un «Guardar» arriba. Martín rechazó esa densidad en Hoy («Una cantidad de botones y
// texto impresionante»), y Settings ya tiene su referencia en esta casa: los ajustes de LINEAR (app/_ui/Ajustes.tsx, AGENTS.md
// → «Settings ya tiene su referencia»). Así quedó:
//   · el marco del Media Buyer (`.aa`: el fondo y el ancho de Hoy) con la columna centrada, el título sin bajada y «← Media Buyer»;
//   · secciones de nombre + tarjeta con FILAS: el nombre a la izquierda y el control a la derecha (interruptor, pastillas,
//     un campo chico), sin una ayuda por campo: lo que hace falta saber va en la línea gris de la fila, y sólo si suma;
//   · guarda al instante, cada control lo suyo (`cambio` con UN campo: lib/media-buyer/store.ts valida y mezcla), y un aviso
//     chico lo confirma. Un monto se guarda al salir del campo o con Enter, leído con `leerMonto` («1,500» es mil quinientos).
//   · «Dónde y hasta cuándo» llegó DESPUÉS de esta pantalla (29/10, lo prometido a la agencia de Thiago:
//     lib/media-buyer/zona.ts, ElegirLugares.tsx). Entra como una sección más, con el molde de filas.
// Lo que se guarda pasa por la misma puerta que siempre (POST /api/media-buyer, op config); lo mismo, por la API de MaKo
// (`topes_media_buyer`, `modo_media_buyer`, …: tests/media-buyer-api.test.ts).
// =============================================================================

import { useEffect, useState, type KeyboardEvent } from 'react';
import Link from '@/app/_ui/Link';
import { Switch, Toast, useToast } from '@/app/_ui';
import { FilaAjustes, GrupoAjustes, TituloAjustes } from '@/app/_ui/Ajustes';
import { ConectarViaZernio } from '@/app/_components/ConectarViaZernio';
import type { ConfigMediaBuyer, KpiMediaBuyer } from '@/lib/media-buyer/tipos';
import { textoCupo, type CupoMediaBuyer } from '@/lib/media-buyer/plan';
import { RUTA_CAMBIAR_PLAN } from '@/lib/topes-plan';
import { leerMonto } from '@/lib/media-buyer/monto';
import { fmtDinero } from '@/lib/format';
import { HASTA_SIN_SUBIR_DIAS, type LugarZona } from '@/lib/media-buyer/zona';
import { ElegirLugares } from './ElegirLugares';
import { aplicarCambio, conCampanas, evaluarFunnel, funnelElegido, usaAnuncios, usaLlamadas, sanearPerfil, type Llamadas, type ObjetivoOrganico, type PerfilCopiloto } from '@/lib/media-buyer/copiloto';
import { inspiradoEn, asesorPorId } from '@/lib/asesores/catalogo';

type Config = ConfigMediaBuyer & { ultimaCorrida: string | null; ultimaCorridaInfo: Record<string, unknown> | null; existeTabla: boolean };
type EstadoZernio = { tieneClave: boolean; cuenta: string | null; conectado: boolean };

const RESULTADOS: Array<[KpiMediaBuyer, string]> = [['lead', 'Leads'], ['agenda', 'Agendas'], ['venta', 'Ventas']];
const POR: Record<KpiMediaBuyer, string> = { lead: 'por lead', agenda: 'por agenda', venta: 'por venta' };

async function api<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T & { ok: boolean; error?: string }> {
  const r = await fetch('/api/media-buyer', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return (await r.json().catch(() => ({ ok: false, error: `Error ${r.status}` }))) as T & { ok: boolean; error?: string };
}


/** Pastillas de una sola elección (el segmentado de la casa, `.aa-seg`): dos o tres opciones cortas, sin desplegable. */
function Pastillas<T extends string>({ valor, opciones, onCambio, etiqueta, deshabilitada }: {
  valor: T; opciones: Array<[T, string]>; onCambio: (v: T) => void; etiqueta: string; deshabilitada?: (v: T) => boolean;
}) {
  return (
    <span className="aa-seg" role="group" aria-label={etiqueta}>
      {opciones.map(([v, t]) => (
        <button key={v} type="button" aria-pressed={valor === v} disabled={deshabilitada?.(v)} onClick={() => { if (v !== valor) onCambio(v); }}>{t}</button>
      ))}
    </span>
  );
}

/** Un campo chico en la fila: guarda al salir o con Enter, sólo si cambió. */
function CampoFila({ valor, onGuardar, etiqueta, placeholder, prefijo, sufijo, ancho = 120, modo = 'decimal' }: {
  valor: string; onGuardar: (texto: string) => Promise<boolean>; etiqueta: string; placeholder?: string; prefijo?: string; sufijo?: string; ancho?: number;
  modo?: 'decimal' | 'numeric' | 'text';
}) {
  const [txt, setTxt] = useState(valor);
  useEffect(() => setTxt(valor), [valor]);
  const guardar = () => { if (txt.trim() !== valor.trim()) void onGuardar(txt).then((ok) => { if (!ok) setTxt(valor); }); };
  const enter = (e: KeyboardEvent<HTMLInputElement>) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); };
  return (
    <span className="aa-campo">
      {prefijo && <span>{prefijo}</span>}
      <input className="aj-en-linea" style={{ width: ancho, textAlign: modo === 'text' ? 'left' : undefined }} inputMode={modo} value={txt} placeholder={placeholder} aria-label={etiqueta}
        onChange={(e) => setTxt(e.target.value)} onBlur={guardar} onKeyDown={enter} />
      {sufijo && <span>{sufijo}</span>}
    </span>
  );
}

export function Ajustes({ config: inicial, cupo, perfil: perfilInicial = null }: { config: Config; cupo: CupoMediaBuyer; perfil?: PerfilCopiloto | null }) {
  const [config, setConfig] = useState(inicial);
  // TU ESTRATEGIA (6/11/2026): lo que se respondió en la primera entrada, editable acá. Un funnel sin anuncios no tiene cuenta de Meta
  // que ajustar: sólo ve esto (y cómo sumar anuncios).
  const [perfil, setPerfil] = useState<PerfilCopiloto | null>(perfilInicial);
  const funnel = perfil ? funnelElegido(perfil) : null;
  const sinCampanas = !!funnel && !conCampanas(funnel.id, perfil?.presupuestoMes);
  // DÓNDE y HASTA: el control responde al toque y guarda SU campo; `config` vuelve del servidor (y con él, lo de otra pestaña).
  // ⚠️ `zona` puede NO VENIR: la migración 0350 (zona y fechas) no está aplicada en todos los entornos, y una config sin ella
  // llega sin el campo. `ElegirLugares` hace `elegidos.length`, así que sin el `?? []` la pantalla entera tira un TypeError.
  const [zona, setZona] = useState<LugarZona[]>(inicial.zona ?? []);
  const [hasta, setHasta] = useState(inicial.hasta ?? '');
  useEffect(() => { setZona(config.zona ?? []); setHasta(config.hasta ?? ''); }, [config.zona, config.hasta]);
  const [zernio, setZernio] = useState<EstadoZernio | null>(null);
  const { toast, show, clear } = useToast();
  const leerZernio = () => { void api<EstadoZernio>({ op: 'estado_zernio' }).then((r) => { if (r.ok) setZernio({ tieneClave: r.tieneClave, cuenta: r.cuenta, conectado: r.conectado }); }); };
  useEffect(leerZernio, []);

  // Cada control manda SU campo: lo que otro cambió en el medio (otra pestaña, MaKo por el chat) no se pisa.
  const guardar = async (cambio: Partial<ConfigMediaBuyer>): Promise<boolean> => {
    if (!config.existeTabla) { show('Falta aplicar la migración del Media Buyer.', undefined, 'bad'); return false; }
    const r = await api<{ config: Config }>({ op: 'config', cambio });
    if (r.ok) { setConfig((c) => ({ ...c, ...r.config })); show('Guardado', undefined, 'good'); return true; }
    show(r.error ?? 'No se pudo guardar.', undefined, 'bad');
    return false;
  };
  // Un monto escrito: vacío = sin valor; lo que no se entiende NO sale. Hasta el 27/10 iba como NaN «para que el servidor lo
  // rechace», y `JSON.stringify(NaN)` es `null`: «abc» en el objetivo lo BORRABA (quedaba el recomendado) con un «Guardado».
  type CampoMonto = 'objetivo' | 'presupuestoMaxDia' | 'metaVentasMes' | 'metaGastoMes';
  const conMonto = async (campo: CampoMonto, s: string): Promise<boolean> => {
    if (s.trim() === '') return guardar({ [campo]: null });
    const n = leerMonto(s);
    if (n == null) { show('No entiendo ese monto: escríbelo como 1500 o 1,500.', undefined, 'bad'); return false; }
    return guardar({ [campo]: n });
  };
  const conPct = async (s: string): Promise<boolean> => {
    if (!/^\s*\d{1,3}\s*$/.test(s) || Number(s) > 100) { show('La subida va de 0% a 100%.', undefined, 'bad'); return false; }
    return guardar({ subidaMaxPctDia: Number(s) });
  };
  const guardarPerfil = async (cambio: Partial<PerfilCopiloto>): Promise<boolean> => {
    if (!perfil) return false;
    const sig = sanearPerfil(aplicarCambio(perfil, cambio));
    const r = await api({ op: 'copiloto', perfil: sig });
    if (r.ok) { setPerfil(sig); show('Guardado', undefined, 'good'); return true; }
    show(r.error ?? 'No se pudo guardar.', undefined, 'bad');
    return false;
  };
  // Un monto de la estrategia: el cero vale (no hay presupuesto), vacío no.
  const monto = async (campo: 'ticket' | 'presupuestoMes', s: string): Promise<boolean> => {
    if (campo === 'presupuestoMes' && /^\s*0\s*$/.test(s)) return guardarPerfil({ presupuestoMes: 0 });
    const n = leerMonto(s);
    if (n == null) { show('No entiendo ese monto: escríbelo como 1500 o 1,500.', undefined, 'bad'); return false; }
    return guardarPerfil({ [campo]: n });
  };
  const ritmo = async (s: string): Promise<boolean> => {
    if (!/^\s*\d{1,2}\s*$/.test(s) || Number(s) < 1 || Number(s) > 21) { show('Entre 1 y 21 por semana.', undefined, 'bad'); return false; }
    return guardarPerfil({ ritmo: Number(s) });
  };
  const veredicto = perfil && funnel && perfil.ticket != null
    ? evaluarFunnel(funnel.id, { ticket: perfil.ticket, presupuestoMes: perfil.presupuestoMes ?? 0, llamadas: perfil.llamadas ?? 'yo' }) : null;
  const refInspirado = perfil?.referente ? asesorPorId(perfil.referente) : null;
  const txt = (n: number | null) => (n == null ? '' : String(n));
  const recomendado = config.ultimaCorridaInfo && typeof config.ultimaCorridaInfo.objetivo === 'number' && config.ultimaCorridaInfo.objetivoEsRecomendado
    ? config.ultimaCorridaInfo.objetivo as number : null;
  const cuenta = config.cuentaPublicitaria ?? zernio?.cuenta ?? null;

  return (
    <div className="aa">
      <div className="aa-ajustes">
        <TituloAjustes titulo="Ajustes" volver={{ href: '/ads-manager', label: 'Marketing CoPilot' }} />

        {perfil && funnel && (
          <GrupoAjustes titulo="Tu estrategia">
            <FilaAjustes titulo={funnel.nombre} href="/ads-manager?estrategia=1" valor="Cambiar"
              tono={veredicto && !veredicto.sirve ? 'warn' : undefined} estado={veredicto && !veredicto.sirve ? 'Revisar' : undefined}
              detalle={veredicto && !veredicto.sirve ? <>{veredicto.motivo}{veredicto.mejor ? ' Habla con MaKo para ver qué conviene.' : ''}</> : refInspirado ? inspiradoEn(refInspirado) : funnel.que} />
            <FilaAjustes titulo="Una venta te deja" fin={<CampoFila etiqueta="Lo que te deja una venta" prefijo="US$" valor={txt(perfil.ticket ?? null)} placeholder="Sin dato" onGuardar={(s) => monto('ticket', s)} />} />
            {usaAnuncios(funnel.id) && (
              <FilaAjustes titulo="Anuncios por mes" detalle={(perfil.presupuestoMes ?? 0) === 0 ? 'Con US$0 no hay Campañas: se difunde sin pagar' : null}
                fin={<CampoFila etiqueta="Presupuesto en anuncios por mes" prefijo="US$" valor={txt(perfil.presupuestoMes ?? null)} placeholder="0" onGuardar={(s) => monto('presupuestoMes', s)} />} />
            )}
            {usaLlamadas(funnel.id) && (
              <FilaAjustes titulo="Quién llama" fin={<Pastillas<Llamadas> etiqueta="Quién llama" valor={perfil.llamadas ?? 'yo'} opciones={[['yo', 'Yo'], ['equipo', 'Un equipo'], ['nadie', 'Nadie']]} onCambio={(v) => void guardarPerfil({ llamadas: v })} />} />
            )}
            {(funnel.id === 'organico' || funnel.id === 'youtube') && (
              <FilaAjustes titulo={funnel.id === 'youtube' ? 'Videos por semana' : 'Piezas por semana'}
                fin={<CampoFila etiqueta="Por semana" modo="numeric" ancho={70} valor={txt(perfil.ritmo ?? null)} placeholder="3" onGuardar={ritmo} />} />
            )}
            {funnel.id === 'organico' && (
              <FilaAjustes titulo="Qué buscas" fin={<Pastillas<ObjetivoOrganico> etiqueta="Qué buscas" valor={perfil.objetivo ?? 'mixto'} opciones={[['viralidad', 'Viralidad'], ['ventas', 'Ventas'], ['mixto', 'Ambas']]} onCambio={(v) => void guardarPerfil({ objetivo: v })} />} />
            )}
          </GrupoAjustes>
        )}

        {sinCampanas && (
          <GrupoAjustes titulo="Anuncios">
            <FilaAjustes titulo="Todavía sin anuncios" detalle={usaAnuncios(funnel!.id) ? 'Sin presupuesto no hay Campañas. Si más adelante quieres anunciar, ponlo arriba en «Anuncios por mes».' : 'Tu funnel no los necesita. Si más adelante quieres sumarlos, cambia de funnel.'}
              href="/ads-manager?estrategia=1" valor="Cambiar funnel" />
          </GrupoAjustes>
        )}

        {!sinCampanas && <>
        <GrupoAjustes titulo="Media Buyer">
          {/* Apagado igual pausa lo que llegó a su fecha: la fecha de fin vale con el Media Buyer apagado (main, 29/10). */}
          <FilaAjustes titulo="Encendido" detalle={config.encendido ? null : 'Apagado no mira tu cuenta ni lanza nada: sólo pausa lo que llegó a su fecha'}
            fin={<Switch checked={config.encendido} onChange={(v) => void guardar({ encendido: v })} />} />
          <FilaAjustes titulo="Modo"
            detalle={cupo.piloto ? <>Por táctica, en <Link href="/ads-manager/automatizaciones" className="aa-link">Automatizaciones</Link></>
              : <>{cupo.recomendacionesDia != null ? textoCupo(cupo.recomendacionesDia) : 'El automático es de MaKo Pro.'} <Link href={RUTA_CAMBIAR_PLAN} className="aa-link">Pasar a Pro</Link></>}
            fin={<Pastillas etiqueta="Modo" valor={config.modo} opciones={[['propone', 'Propone'], ['piloto', 'Automático']]}
              deshabilitada={(v) => v === 'piloto' && !cupo.piloto} onCambio={(v) => void guardar({ modo: v })} />} />
        </GrupoAjustes>

        <GrupoAjustes titulo="Objetivo y metas">
          <FilaAjustes titulo="Resultado" fin={<Pastillas etiqueta="Resultado" valor={config.kpi} opciones={RESULTADOS} onCambio={(v) => void guardar({ kpi: v })} />} />
          <FilaAjustes titulo={`Costo ${POR[config.kpi]}`} detalle={config.objetivo == null ? 'Vacío: lo calcula MaKo con tu cuenta' : null}
            fin={<CampoFila etiqueta={`Costo ${POR[config.kpi]} objetivo`} valor={txt(config.objetivo)} prefijo="US$"
              placeholder={recomendado != null ? fmtDinero(recomendado) : 'Automático'} onGuardar={(s) => conMonto('objetivo', s)} />} />
          <FilaAjustes titulo="Meta de ventas del mes" fin={<CampoFila etiqueta="Meta de ventas del mes" prefijo="US$" valor={txt(config.metaVentasMes)} placeholder="Sin meta"
            onGuardar={(s) => conMonto('metaVentasMes', s)} />} />
          <FilaAjustes titulo="Gasto previsto del mes" fin={<CampoFila etiqueta="Gasto previsto del mes" prefijo="US$" valor={txt(config.metaGastoMes)} placeholder="Sin meta"
            onGuardar={(s) => conMonto('metaGastoMes', s)} />} />
        </GrupoAjustes>

        <GrupoAjustes titulo="Topes">
          <FilaAjustes titulo="Subida máxima por día" fin={<CampoFila etiqueta="Subida máxima por día" modo="numeric" ancho={80} sufijo="%"
            valor={String(config.subidaMaxPctDia)} onGuardar={conPct} />} />
          <FilaAjustes titulo="Presupuesto máximo por día" detalle="Lo prendido de toda la cuenta" fin={<CampoFila etiqueta="Presupuesto máximo por día" prefijo="US$"
            valor={txt(config.presupuestoMaxDia)} placeholder="Sin tope" onGuardar={(s) => conMonto('presupuestoMaxDia', s)} />} />
        </GrupoAjustes>

        {/* DÓNDE y HASTA (main, 29/10): la zona y la fecha de fin. Sin la migración 0350 guardarlas da error, y `guardar`
            ya corta antes con «Falta aplicar la migración»: no frena al resto de Ajustes. */}
        <GrupoAjustes titulo="Dónde y hasta cuándo">
          <FilaAjustes ancho titulo="Dónde" detalle="Vacío: toda la cuenta. Con una zona, MaKo no prende ni sube lo que muestra anuncios fuera de ella."
            fin={<ElegirLugares etiqueta="Dónde" elegidos={zona} onCambio={(xs) => { setZona(xs); void guardar({ zona: xs }); }} />} />
          {/* La fecha se guarda al SALIR del campo (o con Enter), NUNCA en cada tecla: un año a medio escribir es
              «0002-11-05» y guardarlo pausa las campañas (lo midió la revisión adversarial del 29/10 en Lienzo.tsx). */}
          <FilaAjustes titulo="Hasta" detalle={`Pasada la fecha MaKo pausa tus campañas, y desde ${HASTA_SIN_SUBIR_DIAS} días antes no sube presupuestos. Cada campaña puede tener la suya en Campañas.`}
            fin={<input className="aj-en-linea" type="date" aria-label="Hasta" value={hasta} style={{ width: 150 }}
              onChange={(e) => setHasta(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
              onBlur={() => { if ((hasta || null) !== (config.hasta ?? null)) void guardar({ hasta: hasta || null }).then((ok) => { if (!ok) setHasta(config.hasta ?? ''); }); }} />} />
        </GrupoAjustes>

        <GrupoAjustes titulo="Cuenta de Meta">
          <FilaAjustes titulo="Cuenta publicitaria" detalle="La de Integraciones manda" fin={<CampoFila etiqueta="Cuenta publicitaria (act_…)" modo="text" ancho={200}
            valor={config.cuentaPublicitaria ?? ''} placeholder={zernio?.cuenta ?? 'act_123456789'} onGuardar={(s) => guardar({ cuentaPublicitaria: s.trim() || null })} />} />
          <FilaAjustes titulo="Conexión" detalle={zernio == null ? null : zernio.conectado ? `Por Zernio${cuenta ? ` · ${cuenta}` : ''}` : 'Sin conectar: no crea anuncios nuevos'}
            fin={<ConectarViaZernio red="metaads" volver="/ads-manager/ajustes" adAccountId={zernio?.cuenta ?? null} size="sm" variant="secondary" onConectado={leerZernio}>
              {zernio?.conectado ? 'Reconectar' : 'Conectar con Facebook'}
            </ConectarViaZernio>} />
        </GrupoAjustes>
        </>}
      </div>
      <Toast state={toast} onClose={clear} />
    </div>
  );
}
