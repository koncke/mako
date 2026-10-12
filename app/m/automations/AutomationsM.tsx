'use client';

// =============================================================================
// /m/automations — la pantalla: la lista con su interruptor y el sheet de una automatización
// =============================================================================
// Prototipo `data-ir="auto"` (docs/prototipos/mako-mobile-v2.html). Los datos bajan YA leídos del
// server (./datos.ts): esta pantalla no lee el grafo, sólo lo dibuja.
//
// LAS ESCRITURAS SON LAS DE ESCRITORIO, por las mismas rutas y con el mismo cuerpo (el `?ws=` lo pone
// el parche de fetch, app/_components/WsFetch.tsx):
//   · prender / pausar → PATCH /api/whatsapp/secuencias { id, activa } (SecuenciaPerfil `toggle`). Activar
//     valida lo mismo que Publicar en el server (`validarActivacion`): el motivo vuelve en el toast.
//   · Publicar los cambios → PATCH /api/whatsapp/secuencias { id, pasos } con el flujo del borrador tal como
//     lo abre el lienzo, y después POST { action: 'descartar-borrador' } (SecuenciaPerfil `publicar` →
//     `borrador.publicado`). El server lo valida con `validarGrafo` y los frenos del medio y la voz.
//   · Descartar los cambios → POST /api/chat-agent/secuencias { action: 'descartar-borrador' } («⋯ →
//     Descartar cambios» de la lista). Deshacer lo vuelve a guardar con `action: 'borrador'` y la base
//     que devolvió el descarte (lo mismo que hace Ctrl+Z en el lienzo).
// Las dos rutas contestan 403 a quien no es admin: quien no lo es ve todo y no toca nada (`puedeEditar`).
//
// ⚠️ PUBLICAR Y DESCARTAR MANDAN LO QUE SE VIO (`visto`: la base y el `guardado_at` del borrador). Esta
// pantalla no edita: escribe una FOTO del server que puede tener horas. Si la computadora guardó o publicó
// otra cosa después, el server no escribe nada (409 `desactualizado`, lib/secuencia-borrador.ts) y acá se
// relee. El descarte que sigue a Publicar manda sólo el `guardado_at` (publicar ya movió la base).
// =============================================================================

import { useState } from 'react';
import { useRouter } from '@/app/_ui/Link';
import { Button } from '@/app/_ui/Button';
import {
  FilaDatoM, FilaM, InterruptorM, ListaM, PieM, PildoraM, SeccionM, SheetM, useConexion, useToastM,
} from '@/app/m/_ui';
import { haptico } from '@/lib/haptico';
import { avisoCorto, type AutomatizacionM, type BorradorM, type PasoM, type SeccionAutoM } from './reglas';

const RUTA_PASOS = '/api/whatsapp/secuencias';
const RUTA_SECUENCIAS = '/api/chat-agent/secuencias';

type Respuesta = { ok: boolean; error?: string; base?: string; guardado_at?: string; sinRed?: boolean; desactualizado?: boolean };

/** Un pedido a una ruta de escritorio. Nunca tira: sin red vuelve `sinRed`. */
async function pedir(url: string, method: 'PATCH' | 'POST', body: Record<string, unknown>): Promise<Respuesta> {
  try {
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = (await r.json().catch(() => null)) as (Respuesta & Record<string, unknown>) | null;
    if (j?.ok) {
      return { ok: true, base: typeof j.base === 'string' ? j.base : undefined, guardado_at: typeof j.guardado_at === 'string' ? j.guardado_at : undefined };
    }
    return { ok: false, error: typeof j?.error === 'string' ? j.error : undefined, desactualizado: j?.desactualizado === true };
  } catch {
    return { ok: false, sinRed: true };
  }
}

/**
 * Lo que esta pantalla escribió encima de lo que trajo el server, hasta la próxima lectura. `guardado_at` es
 * el del borrador que volvió a guardar «Deshacer» un descarte: lo que se vio AHORA es eso, no lo leído.
 */
type Cambio = { activa?: boolean; publicada?: boolean; descartada?: boolean; guardado_at?: string };

export function AutomationsM({ secciones, puedeEditar }: { secciones: SeccionAutoM[]; puedeEditar: boolean }) {
  const toast = useToastM();
  const router = useRouter();
  const { enLinea } = useConexion();

  // Una lectura nueva (tirar para refrescar) trae la verdad del server: lo escrito acá se suelta.
  const [leidas, setLeidas] = useState(secciones);
  const [cambios, setCambios] = useState<Record<number, Cambio>>({});
  if (leidas !== secciones) { setLeidas(secciones); setCambios({}); }
  const poner = (id: number, c: Cambio) => setCambios((v) => ({ ...v, [id]: { ...v[id], ...c } }));

  /** Los interruptores que esperan al server (uno no bloquea a los demás). */
  const [enVuelo, setEnVuelo] = useState<ReadonlySet<number>>(new Set());
  const marcarVuelo = (id: number, si: boolean) => setEnVuelo((s) => {
    const n = new Set(s);
    if (si) n.add(id); else n.delete(id);
    return n;
  });

  // El sheet: `abiertaId` es la ÚLTIMA abierta (el contenido se queda mientras el sheet baja).
  const [abiertaId, setAbiertaId] = useState<number | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [ocupado, setOcupado] = useState<'publicar' | 'descartar' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const todas = secciones.flatMap((s) => s.filas);
  const vista = (a: AutomatizacionM): { activa: boolean; borrador: BorradorM | null; pasos: PasoM[] } => {
    const c = cambios[a.id] ?? {};
    const sinBorrador = c.publicada === true || c.descartada === true;
    return {
      activa: c.activa ?? a.activa,
      borrador: sinBorrador || !a.borrador ? null : c.guardado_at ? { ...a.borrador, guardado_at: c.guardado_at } : a.borrador,
      // Descartar vuelve a lo publicado; publicar deja lo que se veía (el borrador ya es lo publicado).
      pasos: c.descartada && a.borrador ? a.borrador.publicados : a.pasos,
    };
  };

  const abrir = (id: number) => { setAbiertaId(id); setError(null); setAbierto(true); };
  const cerrar = () => { if (!ocupado) setAbierto(false); };

  /** El server no escribió: lo que esta pantalla vio ya no es lo de ahora. Se relee y no se reintenta. */
  const cambioAfuera = () => {
    haptico('error');
    setOcupado(null);
    setAbierto(false);
    toast('Cambió en otro lado');
    router.refresh();
  };

  // ── Prender / pausar ─────────────────────────────────────────────────────────────────────────
  const alternar = async (a: AutomatizacionM, activa: boolean, deshaciendo = false) => {
    if (!puedeEditar || enVuelo.has(a.id)) return;
    if (!enLinea) { toast('Sin conexión'); return; }
    const antes = !activa;
    poner(a.id, { activa });
    marcarVuelo(a.id, true);
    const r = await pedir(RUTA_PASOS, 'PATCH', { id: a.id, activa });
    marcarVuelo(a.id, false);
    if (!r.ok) {
      poner(a.id, { activa: antes });
      haptico('error');
      toast(r.sinRed ? 'Sin conexión' : avisoCorto(r.error, activa ? 'No se activó' : 'No se pausó'));
      return;
    }
    if (deshaciendo) { toast('Deshecho'); return; }
    toast(activa ? 'Activa' : 'Pausada', { deshacer: () => { void alternar(a, antes, true); } });
  };

  // ── Publicar / descartar lo del lienzo ───────────────────────────────────────────────────────
  const a = abiertaId != null ? todas.find((x) => x.id === abiertaId) ?? null : null;
  const v = a ? vista(a) : null;
  const b = v?.borrador ?? null;

  const publicar = async () => {
    if (!a || !b || b.freno || b.enComputadora || ocupado) return;
    if (!enLinea) { toast('Sin conexión'); return; }
    setOcupado('publicar');
    setError(null);
    const r = await pedir(RUTA_PASOS, 'PATCH', { id: a.id, pasos: b.pasos, visto: { base: b.base, guardado_at: b.guardado_at } });
    if (!r.ok && r.desactualizado) { cambioAfuera(); return; }
    if (!r.ok) {
      haptico('error');
      // 409 trae «Conecta tu WhatsApp» (el medio); 400, el primer motivo de la validación del server.
      setError(r.sinRed ? 'Sin conexión. Vuelve a intentar.' : r.error || 'No se pudo publicar. Vuelve a intentar.');
      setOcupado(null);
      return;
    }
    // Lo publicado ya no es un borrador: se borra, como en escritorio. Si esto falla, el borrador quedó
    // armado sobre la base de ANTES y el server ya no lo abre (`borradorVigente`): no hay nada que decir.
    // Sólo si sigue siendo EL que se publicó (`guardado_at`): uno que guardó otro después no se toca.
    await pedir(RUTA_SECUENCIAS, 'POST', { action: 'descartar-borrador', secuenciaId: a.id, visto: { guardado_at: b.guardado_at } });
    poner(a.id, { publicada: true });
    haptico('success');
    setOcupado(null);
    setAbierto(false);
    toast('Publicada');
  };

  /** Deshacer un descarte: el MISMO flujo vuelve a ser el borrador, sobre lo publicado de ahora. */
  const rehacer = async (id: number, pasos: unknown[], base: string) => {
    if (!enLinea) { toast('Sin conexión'); return; }
    const r = await pedir(RUTA_SECUENCIAS, 'POST', { action: 'borrador', secuenciaId: id, pasos, base });
    if (!r.ok) { haptico('error'); toast('No se pudo deshacer'); return; }
    // El borrador vuelve con OTRO `guardado_at`: es el que manda Publicar desde ahora (si no, el server
    // diría que cambió en otro lado por lo que escribió esta misma pantalla). Sin `guardado_at` el server
    // no guardó nada (era igual a lo publicado): no queda borrador, y la pantalla ya lo dice.
    if (r.guardado_at) poner(id, { descartada: false, guardado_at: r.guardado_at });
    toast('Deshecho');
  };

  const descartar = async () => {
    if (!a || !b || ocupado) return;
    if (!enLinea) { toast('Sin conexión'); return; }
    setOcupado('descartar');
    setError(null);
    const r = await pedir(RUTA_SECUENCIAS, 'POST', {
      action: 'descartar-borrador', secuenciaId: a.id, visto: { base: b.base, guardado_at: b.guardado_at },
    });
    if (!r.ok && r.desactualizado) { cambioAfuera(); return; }
    setOcupado(null);
    if (!r.ok) {
      haptico('error');
      setError(r.sinRed ? 'Sin conexión. Vuelve a intentar.' : r.error || 'No se pudieron descartar. Vuelve a intentar.');
      return;
    }
    poner(a.id, { descartada: true });
    setAbierto(false);
    const { id } = a;
    const { pasos } = b;
    const base = r.base;
    toast('Cambios descartados', base ? { deshacer: () => { void rehacer(id, pasos, base); } } : undefined);
  };

  const pie = a && b && puedeEditar ? (
    <PieM consecuencia={b.enComputadora ? 'Se publica desde la computadora.' : b.freno ?? 'Los próximos envíos usan la versión nueva.'}>
      {!b.freno && !b.enComputadora && (
        <Button variant="primary" size="lg" full loading={ocupado === 'publicar'} disabled={ocupado === 'descartar'} onClick={publicar}>
          Publicar los cambios
        </Button>
      )}
      <Button variant="tertiary" size="lg" full loading={ocupado === 'descartar'} disabled={ocupado === 'publicar'} onClick={descartar}>
        Descartar los cambios
      </Button>
    </PieM>
  ) : undefined;

  return (
    <div className="m-auto">
      {secciones.map((s) => {
        const lista = (
          <ListaM etiqueta={s.titulo ?? 'Automatizaciones'}>
            {s.filas.map((x) => {
              const e = vista(x);
              return (
                <FilaM
                  key={x.id}
                  titulo={x.nombre}
                  segunda={x.disparador || undefined}
                  pill={e.borrador ? <PildoraM tono="warn">Sin publicar</PildoraM> : undefined}
                  onClick={() => abrir(x.id)}
                  control={(
                    <InterruptorM
                      etiqueta={`${x.nombre}: activa`}
                      activo={e.activa}
                      deshabilitado={!puedeEditar || enVuelo.has(x.id)}
                      onCambio={(nuevo) => { void alternar(x, nuevo); }}
                    />
                  )}
                />
              );
            })}
          </ListaM>
        );
        return s.titulo
          ? <SeccionM key={s.id} id={`m-auto-${s.id}`} titulo={s.titulo}>{lista}</SeccionM>
          : <div key={s.id} className="m-auto-lista">{lista}</div>;
      })}

      <SheetM id="automatizacion" abierto={abierto} onCerrar={cerrar} titulo={a?.nombre ?? 'Automatización'} snap="alto"
        ocupado={!!ocupado} pie={pie} rotuloCerrar="Cerrar la automatización">
        {error && <p className="m-auto-error" role="alert">{error}</p>}
        {a && v && (
          <>
            {a.numeros && (
              <ListaM etiqueta="Números">
                <FilaDatoM k="Enviados en 30 días" v={String(a.numeros.enviados)} />
                <FilaDatoM k="Respuestas" v={String(a.numeros.respuestas)} />
                <FilaDatoM k="Leads en curso" v={String(a.numeros.enCurso)} />
              </ListaM>
            )}
            <h3 className="m-auto-subt">Pasos</h3>
            {v.pasos.length ? (
              <ListaM etiqueta="Pasos">
                {v.pasos.map((p) => (
                  <FilaM key={p.id} icono={p.icono} titulo={p.titulo} segunda={p.linea ?? undefined} navegacion />
                ))}
              </ListaM>
            ) : (
              <p className="m-auto-nada">Sin pasos todavía.</p>
            )}
          </>
        )}
      </SheetM>
    </div>
  );
}
