'use client';

// =============================================================================
// Cobranza — «A quién cobrarle» en la tab General: la próxima cuota de cada cliente y «Marcar cobrada»
// =============================================================================
// Feedback de la reunión con Mauricio del 12/10/2026 (Fathom 858927676). Él, a los 54:29: «tú tienes en dashboard
// cobranza y el cobranza yo lo veo más operativo»; a los 71:28: «creo que en Operate… debe ser cobranza», «me genera
// mucho valor estar viendo quién sigue de cobranza. Pero nunca lo veo ahí realmente». Martín, al cerrar (86:17):
// «Número tres, en la tab general, la cobranza». General es la tab de lo que se HACE hoy (Operate).
//
// Es la lista del teléfono (app/m/dashboard/CobranzaM.tsx) en escritorio: la MISMA lectura (`leerAQuienCobrar`,
// lib/datos-comercial-server.ts: getOutstandingDetalle + armarCobranza, la del conjunto «Clientes por cobrar» del
// Dashboard), el mismo renglón y la MISMA acción, `marcarPagoAction` (app/crm/actions.ts), que valida que la cuota sea
// de ese lead en este workspace, recalcula lo cobrado, deja el historial y corta los recordatorios.
//
// ⚠️ LA FECHA DE PAGO ES HOY EN LA ZONA DEL NEGOCIO, calculada AL HACER CLIC (la decisión de escritorio: con el
//    vencimiento, el cobro caía en un período pasado y el Cash de éste no se movía).
// ⚠️ UN CLIC A LA VEZ (`enCurso`, un ref y no sólo el estado): dos clics antes del próximo render pasarían los dos la
//    guarda, y el segundo marcaría la cuota SIGUIENTE del lead después del refresco.
// La fila se va al marcar y vuelve si falla; el toast trae «Deshacer» (desmarca la cuota). Después, `router.refresh()`:
// el semáforo, el mes y esta lista cambian juntos, y el cliente vuelve si le queda otra cuota.
//
// La segunda vuelta del 14/10/2026 («Diseña nuevamente todos los "Bloque general", la mayoría son solamente texto»):
// cada cliente es una fila con su inicial en un círculo del color de su urgencia (rojo vencida, ámbar pronto), lo que
// debe y cuándo vence, y la acción a la derecha. Arriba, cuántas hay y cuántas vencieron. `limite` lo elige el bloque
// (lib/general-piezas.ts), `vacio` es su placeholder y `muestra` apaga las acciones (la vista previa del menú).
// =============================================================================

import { useRef, useState, useTransition, type CSSProperties, type ReactNode } from 'react';
import Link, { useRouter } from '@/app/_ui/Link';
import { Button, ButtonLink, Toast, useToast } from '@/app/_ui';
import { marcarPagoAction } from '@/app/crm/actions';
import { hoyEnTz } from '@/lib/date-utils';
import type { CobroM } from '@/app/m/dashboard/modelo';

/** El pago que marca la fila; null en la de una suscripción, que no tiene cuota (20/10/2026). */
const pagoDe = (f: CobroM): number | null => f.pagoId ?? null;
import { TituloBloque } from './bloques/comun';

const COLOR: Record<'vencida' | 'pronto' | 'al-dia', string> = { vencida: 'var(--bad)', pronto: 'var(--warn-fill)', 'al-dia': 'var(--faint)' };
const inicial = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '·';

export function Cobranza({ filas, tz, error, alcance = null, limite = Infinity, vacio = null, muestra = false, sinCabeza = false, total, alCambiar }: {
  filas: CobroM[]; tz: string; error: string | null;
  /** Cuántos son en total cuando `filas` es un RECORTE: la foto guardada del chat con MaKo lleva 30 de 35
   *  (app/_chat/bloques/CobranzaHilo.tsx). Sin esto, la cabecera decía 30 y MaKo, en el mismo mensaje, 35. */
  total?: number;
  /** Un rótulo al lado del título (lo que la hoja mira, si no es todo el negocio). */
  alcance?: string | null;
  /** Cuántas se ven antes de «Ver todas». */
  limite?: number;
  /** Lo que se dibuja sin nadie por cobrar (el placeholder del bloque). */
  vacio?: ReactNode;
  /** La vista previa: sin acciones. */
  muestra?: boolean;
  /** Sin el título ni el conteo: la muestra de su placeholder (el bloque ya puso su cabecera arriba). */
  sinCabeza?: boolean;
  /** Qué hacer después de marcar o deshacer. Sin esto, `router.refresh()` (la hoja de General); el chat con MaKo vuelve a
   *  leer su lista (app/_chat/bloques/CobranzaHilo.tsx, la 2.27). */
  alCambiar?: () => void;
}) {
  const { toast, show, clear } = useToast();
  const router = useRouter();
  const [, empezar] = useTransition();
  const [ocultas, setOcultas] = useState<ReadonlySet<number>>(new Set());
  const [marcando, setMarcando] = useState<number | null>(null);
  const [todas, setTodas] = useState(false);
  const enCurso = useRef(false);
  const refrescar = alCambiar ?? (() => router.refresh());

  const ocultar = (pagoId: number, si: boolean) => setOcultas((prev) => {
    const s = new Set(prev);
    if (si) s.add(pagoId); else s.delete(pagoId);
    return s;
  });

  // Sólo la fila de una CUOTA se marca; la de una suscripción (sin `pagoId`) abre su ficha (20/10/2026).
  const deshacer = (f: CobroM & { pagoId: number }) => {
    ocultar(f.pagoId, false);
    empezar(async () => {
      try {
        await marcarPagoAction(f.pagoId, f.leadId, false, null);
        refrescar();
      } catch (e) {
        console.error('[general] deshacer cobro:', e instanceof Error ? e.message : String(e));
        show('No se pudo deshacer', undefined, 'bad');
      }
    });
  };

  const marcar = async (f: CobroM & { pagoId: number }) => {
    if (enCurso.current) return;
    enCurso.current = true;
    setMarcando(f.pagoId);
    try {
      const r = await marcarPagoAction(f.pagoId, f.leadId, true, hoyEnTz(tz));
      ocultar(f.pagoId, true);
      // Ya estaba cobrada (la lista era vieja): sin Deshacer, que desmarcaría el cobro de otro.
      if (r.yaEstaba) show('Ya estaba cobrada');
      else show('Cuota cobrada', () => deshacer(f));
      empezar(() => refrescar());
    } catch (e) {
      console.error('[general] marcar cobro:', e instanceof Error ? e.message : String(e));
      show('No se pudo marcar', undefined, 'bad');
    } finally {
      enCurso.current = false;
      setMarcando(null);
    }
  };

  const vivas = filas.filter((f) => f.pagoId == null || !ocultas.has(f.pagoId));
  const vistas = todas ? vivas : vivas.slice(0, limite);
  const vencidas = vivas.filter((f) => f.urgencia === 'vencida').length;
  const cuantas = Math.max(total ?? 0, vivas.length);

  return (
    <div data-cobranza-general="" className="gb" style={S.raiz}>
      {/* La cabecera de un bloque de la hoja (./bloques/comun.tsx): el título del tema, el alcance y los dos conteos. */}
      {!sinCabeza && (
        <div className="gb-cab">
          <TituloBloque>A quién cobrarle</TituloBloque>
          {alcance && <span className="gb-cab-extra">{alcance}</span>}
        </div>
      )}
      {/* Cuántos hay por cobrar, en grande (la quinta vuelta: «textos enormes»), y cuántos ya vencieron. */}
      {!sinCabeza && !error && vivas.length > 0 && (
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', marginBottom: 'clamp(8px, 1.6cqi, 14px)' }}>
          <span className="gb-p">{cuantas}</span>
          <span className="gb-d">por cobrar</span>
          {vencidas > 0 && <span className="gb-d" style={{ fontWeight: 700, color: 'var(--bad)' }}>· {vencidas} {vencidas === 1 ? 'vencida' : 'vencidas'}</span>}
        </span>
      )}
      {error ? (
        <span style={S.dim}>{error}</span>
      ) : !vivas.length ? (
        vacio ?? <span style={S.dim}>Nadie con cuotas por cobrar.</span>
      ) : (
        // Sólo las filas que entran enteras (`gb-cabe`, ./bloques/comun.tsx); con «Ver las N» abierto, la lista crece y
        // el bloque scrollea.
        <ul style={S.lista} className={todas ? undefined : 'gb-cabe'}>
          {vistas.map((f) => {
            const c = COLOR[f.urgencia ?? 'al-dia'];
            // «US$500 · vence el jue» (lo arma lib/datos-comercial-server.ts): el monto va aparte y en grande, como el
            // teléfono; si la línea no trae el separador, se muestra entera abajo del nombre.
            const corte = f.linea.indexOf(' · ');
            const monto = corte > 0 ? f.linea.slice(0, corte) : null;
            const cuando = corte > 0 ? f.linea.slice(corte + 3) : f.linea;
            return (
              <li key={`${f.leadId}:${f.pagoId ?? 'mensual'}`} className="gb-fila" style={{ gap: 'clamp(10px, 2cqi, 16px)' }}>
                <span aria-hidden style={{ ...S.avatar, background: `color-mix(in srgb, ${c} 16%, transparent)`, color: f.urgencia ? c : 'var(--dim)', boxShadow: `inset 0 0 0 1.5px ${f.urgencia ? c : 'var(--border)'}` }}>{inicial(f.nombre)}</span>
                <span style={S.texto}>
                  {muestra
                    ? <span className="gb-t" style={S.nombre}>{f.nombre}</span>
                    : <Link href={`/crm/${f.leadId}${f.funnelId != null ? `?funnel=${f.funnelId}` : ''}`} className="gb-t" style={S.nombre}>{f.nombre}</Link>}
                  <span className="gb-d" style={{ color: f.urgencia === 'vencida' ? 'var(--bad)' : 'var(--dim)' }}>{cuando}</span>
                </span>
                {monto && <span className="gb-num" style={S.monto}>{monto}</span>}
                {pagoDe(f) != null ? (
                  <Button variant="secondary" size="sm" loading={marcando === f.pagoId}
                    disabled={muestra || (marcando != null && marcando !== f.pagoId)}
                    onClick={() => { void marcar({ ...f, pagoId: pagoDe(f) as number }); }} aria-label={`Marcar cobrada la cuota de ${f.nombre}`}>
                    Cobrada
                  </Button>
                ) : !muestra && (
                  // Una suscripción no tiene cuota que marcar: el mes se registra en su ficha, tab Pagos.
                  <ButtonLink variant="secondary" size="sm" href={`/crm/${f.leadId}?tab=pagos`}>Abrir</ButtonLink>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {!error && vivas.length > limite && (
        <button type="button" style={S.ver} aria-expanded={todas} onClick={() => setTodas((t) => !t)}>
          {todas ? 'Ver menos' : cuantas > vivas.length ? `Ver ${vivas.length} de ${cuantas}` : `Ver las ${vivas.length}`}
        </button>
      )}
      <Toast state={toast} onClose={clear} />
    </div>
  );
}

// Sólo tokens que existen en claro y en oscuro.
const S: Record<string, CSSProperties> = {
  raiz: { display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 },
  ver: { alignSelf: 'flex-start', marginTop: 10, border: 'none', background: 'none', padding: 0, font: 'inherit', fontSize: 13, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' },
  dim: { fontSize: 14, color: 'var(--dim)' },
  // Filas con su línea (`gb-fila`), no una tarjeta por cliente adentro de la tarjeta del bloque.
  lista: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column' },
  avatar: { flex: 'none', width: 'clamp(34px, calc(4cqi + 18px), 48px)', height: 'clamp(34px, calc(4cqi + 18px), 48px)', borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 'clamp(13px, calc(1.2cqi + 9px), 16px)', fontWeight: 700 },
  // El monto de la cuota: el número de la fila (19 px en el teléfono, como el prototipo).
  monto: { flex: 'none', fontSize: 'clamp(19px, calc(5cqi + 2px), 34px)', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--ink)' },
  texto: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 },
  nombre: { color: 'var(--ink)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
};
