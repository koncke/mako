'use client';

// =============================================================================
// Chats en el teléfono: la misma lista y la misma conversación que la computadora, destiladas (16/10/2026)
// =============================================================================
// Copiado de WhatsApp y de Codex en el iPhone (capturas del 15/10, docs/hallazgos-operaciones.md): la lista en
// secciones —acá, una por CUENTA, que es lo que separa dos «CRM» con el mismo nombre—, cada fila con su punto,
// el título, la edad a la derecha y lo último que pasó debajo; al tocarla, la conversación a pantalla casi
// completa con la caja de escribir FIJA abajo, como WhatsApp. El hilo es el de la computadora (Hilo.tsx).
//
// ⚠️ MANDAR DESDE EL TELÉFONO pasa por el MISMO camino que la computadora (app/admin/operaciones/mandar.ts →
// encolarPedidoAction, con su `puedeOperar`): se firma con la clave de ESTE teléfono, y la PC tiene que
// aceptarla (cartero.mjs clave). Hasta entonces la caja lo dice y ofrece copiar la clave.

import '@/app/admin/operaciones/centro.css';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FilaM, ListaM, SeccionM, SheetM, VacioM, useToastM } from '@/app/m/_ui';
import { Icon } from '@/app/_components/icons';
import type { Alcance } from '@/lib/operaciones-reglas';
import {
  comoSale, historialDelChat, nombreCuenta, seccionesDeChats, textoDeEnvio, vistaPrevia, type CarteroP, type ChatCentro, type TrabajoP,
} from '@/lib/centro-chats';
import type { PedidoP, PushP } from '@/lib/progreso-reglas';
import Link from '@/app/_ui/Link';
import { Hilo, Tick } from '@/app/admin/operaciones/Hilo';
import { Muneco, animoDe } from '@/app/admin/operaciones/Muneco';

const ESTADO: Record<ChatCentro['estado'], string> = { trabajando: 'Trabajando', abierto: 'Abierto', cerrado: 'Cerrado', sin_dato: 'Sin dato' };
const metaDe = (c: ChatCentro) => [nombreCuenta(c.cuenta), ESTADO[c.estado]].filter(Boolean).join(' · ');
import { copiar, type useFirma } from '@/app/admin/operaciones/mandar';

/** Cuántos chats se ven por cuenta antes de «Ver todos». */
const VISIBLES = 6;

const edad = (t: number | null, ahora: number): string => {
  if (t == null || !Number.isFinite(t)) return '';
  const s = Math.max(0, Math.round((ahora - t) / 1000));
  if (s < 60) return 'ahora';
  if (s < 3600) return `${Math.round(s / 60)} min`;
  if (s < 86_400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86_400)} d`;
};

export function ChatsM({ chats, carteros, pedidos, trabajos, pushes, ahora, esperas, firma, onEnviado }: {
  chats: ChatCentro[];
  carteros: CarteroP[];
  pedidos: PedidoP[];
  trabajos: TrabajoP[];
  pushes: PushP[];
  ahora: number;
  /** Cuántas tarjetas de la Ticketera espera cada chat (lib/centro-chats.ts → esperasPorChat). */
  esperas: Record<string, number>;
  firma: ReturnType<typeof useFirma>;
  /** Lo que se acaba de mandar, para que se vea enseguida mientras llega el refresco. */
  onEnviado: (t: TrabajoP) => void;
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const [enteras, setEnteras] = useState<Set<string>>(new Set());
  const [borradores, setBorradores] = useState<Record<string, string>>({});
  const [alcance, setAlcance] = useState<Alcance>('solo_esto');
  const [enviando, setEnviando] = useState(false);
  const toast = useToastM();
  const porId = useMemo(() => new Map(pedidos.map((p) => [p.id, p])), [pedidos]);
  const elegido = chats.find((c) => c.clave === abierto) ?? null;
  const lineas = elegido ? historialDelChat(elegido, porId, trabajos) : [];
  const hilo = useRef<HTMLDivElement>(null);
  // Como un chat: abre en lo último. La hoja monta su cuerpo en un portal y lo mide después del primer pintado,
  // así que se baja en el cuadro siguiente (en el mismo efecto no hay todavía qué scrollear).
  useEffect(() => {
    const t = setTimeout(() => { const el = hilo.current?.closest('.m-sheet__cuerpo') as HTMLElement | null; if (el) el.scrollTop = el.scrollHeight; }, 80);
    return () => clearTimeout(t);
  }, [abierto, lineas.length]);

  const secciones = useMemo(() => seccionesDeChats(chats), [chats]);

  if (!chats.length) return <VacioM frase="Ningún chat todavía: aparecen cuando el cartero da su vuelta." />;

  const envio = elegido ? comoSale(elegido, carteros, firma.clave === undefined ? undefined : firma.clave?.id ?? null, ahora) : null;
  const texto = elegido ? borradores[elegido.clave] ?? '' : '';

  async function mandar() {
    if (!elegido?.sesion || !envio?.puede || enviando || !texto.trim()) return;
    setEnviando(true);
    const r = await firma.mandar({ sesion: elegido.sesion, cuenta: elegido.cuenta, titulo: elegido.titulo }, texto, alcance);
    setEnviando(false);
    if (!r.ok) { toast(r.error); return; }
    onEnviado({ id: r.id, destino: elegido.sesion, destino_titulo: elegido.titulo, destino_cuenta: elegido.cuenta, created_at: r.creado, texto: texto.trim(), estado: 'escrito', motivo: null, cierre: null });
    setBorradores((b) => ({ ...b, [elegido.clave]: '' }));
    setAlcance('solo_esto');
  }
  const copiarClave = async () => {
    if (!firma.clave) return;
    toast(await copiar(firma.clave.spki) ? 'Clave copiada: pégala en el chat Cartero' : 'No pude copiar');
  };
  const crearClave = async () => { toast((await firma.crear()) ? 'Clave creada: cópiala y pégala en el chat Cartero' : 'No pude crear la clave'); };

  const estado = envio ? textoDeEnvio(envio) : null;
  const pie = elegido && envio ? (
    envio.puede ? (
      <div className="m-operaciones-caja">
        <div className="m-operaciones-caja__fila">
          <textarea
            rows={1}
            value={texto}
            onChange={(e) => setBorradores((b) => ({ ...b, [elegido.clave]: e.target.value }))}
            placeholder={`Escribe a ${elegido.titulo}`}
            aria-label={`Escribe a ${elegido.titulo}`}
            disabled={enviando}
          />
          <button type="button" className="co-enviar" onClick={mandar} disabled={enviando || !texto.trim()} aria-label="Firmar y mandar">
            {enviando ? <span className="co-enviar__giro" aria-hidden /> : <Icon name="flecha" size={18} />}
          </button>
        </div>
        <div className="m-operaciones-caja__fila m-operaciones-caja__fila--meta">
          <button type="button" className="co-chip" aria-pressed={alcance === 'de_ahora_en_mas'} onClick={() => setAlcance(alcance === 'solo_esto' ? 'de_ahora_en_mas' : 'solo_esto')}>
            {alcance === 'solo_esto' ? 'Sólo esto' : 'Y de ahora en más'}
          </button>
          {estado && <span className="m-operaciones-caja__estado">{estado}</span>}
        </div>
      </div>
    ) : envio.por === 'leyendo_clave' ? null : (
      <div className="m-operaciones-caja m-operaciones-caja--quieta">
        <span className="m-operaciones-caja__estado">{estado}</span>
        {envio.por === 'sin_clave' && <button type="button" className="co-chip" onClick={crearClave}>Crear clave</button>}
        {envio.por === 'clave_no_aceptada' && <button type="button" className="co-chip" onClick={copiarClave}><Icon name="copy" size={14} />Copiar clave</button>}
      </div>
    )
  ) : undefined;

  return (
    <>
      {secciones.map(({ clave: k, titulo, chats: lista }) => {
        const todas = enteras.has(k);
        const corte = todas ? lista : lista.slice(0, VISIBLES);
        return (
          <SeccionM key={k} titulo={titulo}>
            <ListaM etiqueta={titulo}>
              {corte.map((c) => {
                const p = vistaPrevia(historialDelChat(c, porId, trabajos));
                const vivo = c.estado === 'trabajando' && !c.viejo;
                return (
                  <FilaM
                    key={c.clave}
                    leading={<Muneco titulo={c.titulo} animo={animoDe(c)} size={40} espera={esperas[c.clave] ?? 0} />}
                    titulo={<span className="m-operaciones-texto1">{c.titulo}</span>}
                    segunda={vivo
                      ? <span className="m-operaciones-vivo">trabajando…</span>
                      : (esperas[c.clave] ?? 0) > 0 ? <span className="m-operaciones-espera">Espera tu respuesta</span>
                      : p ? <span className="m-operaciones-previa">{p.tick ? <Tick estado={p.tick} /> : p.propio ? 'Tú: ' : ''}{p.texto}</span>
                        : undefined}
                    riel={<span className="m-operaciones-hace">{edad(c.actividad, ahora)}</span>}
                    onClick={() => setAbierto(c.clave)}
                    chevron={false}
                  />
                );
              })}
              {lista.length > corte.length && <FilaM titulo={`Ver los ${lista.length} chats`} onClick={() => setEnteras((s) => new Set(s).add(k))} navegacion />}
            </ListaM>
          </SeccionM>
        );
      })}
      <SheetM abierto={!!elegido} onCerrar={() => setAbierto(null)} titulo={elegido?.titulo ?? 'Chat'} snap="alto" pie={pie}>
        {elegido && (
          <div className="m-operaciones-hilo" ref={hilo}>
            <p className="m-operaciones-hilo__meta">
              <Muneco titulo={elegido.titulo} animo={animoDe(elegido)} size={24} />
              {metaDe(elegido)}
            </p>
            {(esperas[elegido.clave] ?? 0) > 0 && (
              <Link href="/m/tickets/decisiones" className="co-espera" style={{ margin: 0 }}>
                {(esperas[elegido.clave] ?? 0) === 1 ? 'Una tarjeta espera tu respuesta' : `${esperas[elegido.clave]} tarjetas esperan tu respuesta`}
                <span className="co-espera__ir">Contestar</span>
              </Link>
            )}
            <Hilo lineas={lineas} pushes={pushes} ahora={ahora} vacio="Todavía no hay nada con este chat." quien={{ titulo: elegido.titulo, animo: animoDe(elegido), dato: metaDe(elegido) }} />
          </div>
        )}
      </SheetM>
    </>
  );
}
