// =============================================================================
// vigia-mako-grupos — qué mirar en las charlas de MaKo con cada cliente (puro)
// =============================================================================
// Pedido de Martín (17/10/2026): «que SIEMPRE se esté leyendo todos los grupos de MaKo en WhatsApp con clientes,
// porque MaKo muchas veces dice "no puedo" o tira errores… que se esté vigilando y que se debugeen los errores en
// automático cuando surjan». El que lee es scripts/vigia-mako-grupos.mts (sólo lectura, corre cada 15 minutos desde
// la sesión de Claude que es dueña del doer); acá vive QUÉ cuenta como incidente, para poder probarlo.
//
// Lo que entra son filas de `mako_doer_conv` (cada turno del grupo, mig 0086) y de `anthropic_usage` con las dos marcas
// de US$0 que deja el doer cuando algo salió mal: `cartel-ia` (el cartel de «no pude», que NO entra al historial) y
// `saneo-doer` (una promesa sin hacer o una grosería que se sacó antes de mandar, lib/doer-salida.ts).
//
// ⚠️ El historial guarda la respuesta YA SANEADA: desde el 17/10 una promesa sin herramientas no llega a la tabla. Por
// eso el vigía lee también `saneo-doer`: sin esa fila, lo que se atajó sería invisible para él.
//
// PURO y sin `server-only`: lo usan el script y tests/vigia-mako-grupos.test.ts.
// =============================================================================

import { promesasDe, groseriasDe } from './doer-salida';

export type FilaConv = { id: number; workspace_id: number; grupo_jid: string; role: string; content: string; created_at: string };
export type FilaUso = { id: number; workspace_id: number; created_at: string; feature: string; model: string | null; provider: string | null; motivo: string | null };

export type TipoIncidente = 'no-puede' | 'promesa' | 'queja' | 'voz' | 'sin-respuesta' | 'cartel' | 'saneo';
export type Incidente = {
  /** Estable entre vueltas: el vigía no repite lo que ya contó. */
  clave: string;
  /** Uno por mensaje: un «Déjame ver…» que además dice «me colgué» es UN incidente con dos tipos. */
  tipos: TipoIncidente[];
  ws: number;
  grupo: string | null;
  at: string;
  /** Lo que lo disparó, recortado. */
  texto: string;
  /** Lo que se encontró adentro («déjame ver», «cagada», «mentira»). */
  marcas: string[];
  /** El mensaje de la persona que contestaba MaKo (o el de MaKo que la persona desmiente). */
  antes: string | null;
  /** Cuándo se escribió `antes`: con eso se encuentran las filas de IA de ESE turno, no las del anterior. */
  antesAt: string | null;
};

const norm = (s: string): string => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const recorte = (s: string, n = 400): string => { const t = (s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };

/**
 * MaKo dice que no puede, que no tiene acceso, que algo falló o que falta conectar algo. Sobre el texto SIN tildes.
 * Lo que NO es: «no puedo creer», «no te puedo decir que no» — por eso el verbo va pegado a lo que no puede.
 */
const NO_PUEDE = /\b(?:no (?:(?:puedo|pude|podre)(?! (?:creer|imaginar|esperar|parar))|logro|logre|consigo|consegui|me deja|tengo (?:acceso|permiso|forma|como|manera|la herramienta|herramientas))|sin acceso|desde (?:este|aqui|aca) (?:chat |grupo |mensaje )?no|(?:hubo|tuve|tengo) un (?:error|problema|inconveniente)|(?:se|me) (?:cayo|colgo|trabo|rompio)|me colgue|primero (?:debes|tenes que|tienes que|hay que|necesitas) (?:activar|conectar|configurar|vincular)|no (?:esta|estan|tenes|tienes) (?:conectad|activad|habilitad|configurad|vinculad)|todavia no (?:puedo|se puede|tengo)|por (?:aqui|aca) no (?:puedo|se puede))/;

/** La persona desmiente a MaKo o se queja. Sobre el texto SIN tildes. «otra vez» o «de nuevo» sueltos no: son pedidos. */
const QUEJA = /\b(?:mentira|mentis|mentiste|me mentiste|malisimo|pesimo|horrible|desastre|no funciona|no anda|no sirve|no servis|no sirves|inutil|no hiciste|no lo hiciste|no hiciste nada|no cargaste|no agendaste|no (?:lo |la )?veo|no aparece|no me (?:respondes|contestas|respondiste|contestaste|entendes|entiendes|hiciste caso)|no entendiste|cualquier cosa|cualquiera|te equivocaste|estas mal|esta mal|no es asi|eso no es|no era eso|no te pedi|vendehumo|te limpio|sigue sin|todavia no (?:lo |la )?(?:veo|aparece|cargaste|hiciste)|ya esta conectad)\b/;

/** Las marcas de NO_PUEDE que trae un texto. */
export function noPuedeDe(texto: string): string[] {
  const m = norm(texto).match(new RegExp(NO_PUEDE.source, 'g'));
  return [...new Set(m ?? [])];
}
/** Las marcas de QUEJA que trae un texto. */
export function quejaDe(texto: string): string[] {
  const m = norm(texto).match(new RegExp(QUEJA.source, 'g'));
  return [...new Set(m ?? [])];
}

/** Cuánto se espera la respuesta de MaKo antes de contar el silencio (el buffer de audio son ~30 s; la IA, hasta 60). */
export const ESPERA_RESPUESTA_MS = 10 * 60_000;

/**
 * Los incidentes de un tramo de charla. `conv` puede traer filas de ANTES de la marca (para el contexto: el mensaje que
 * contestaba MaKo, el silencio que se cumple ahora); el vigía descarta lo ya contado por `clave`.
 *
 * `ahora` decide el silencio: un mensaje de la persona sin respuesta de MaKo después de `ESPERA_RESPUESTA_MS`. Con un
 * cartel de IA en esa ventana no es silencio (el cartel no entra al historial, ver lib/mako-doer-in.ts): es `cartel`.
 */
export function incidentesDe(conv: FilaConv[], usos: FilaUso[], ahora: number): Incidente[] {
  const out: Incidente[] = [];
  const porGrupo = new Map<string, FilaConv[]>();
  for (const f of [...conv].sort((a, b) => a.created_at.localeCompare(b.created_at) || a.id - b.id)) {
    const k = `${f.workspace_id}|${f.grupo_jid}`;
    porGrupo.set(k, [...(porGrupo.get(k) ?? []), f]);
  }
  for (const filas of porGrupo.values()) {
    for (let i = 0; i < filas.length; i++) {
      const f = filas[i];
      const previo = i > 0 ? filas[i - 1] : null;
      const base = { ws: f.workspace_id, grupo: f.grupo_jid, at: f.created_at, texto: recorte(f.content), antes: previo ? recorte(previo.content, 300) : null, antesAt: previo?.created_at ?? null };
      if (f.role === 'assistant') {
        const tipos: TipoIncidente[] = [];
        const marcas: string[] = [];
        for (const [tipo, m] of [['no-puede', noPuedeDe(f.content)], ['promesa', promesasDe(f.content)], ['voz', groseriasDe(f.content)]] as Array<[TipoIncidente, string[]]>) {
          if (m.length) { tipos.push(tipo); marcas.push(...m); }
        }
        if (tipos.length) out.push({ ...base, clave: `conv:${f.id}`, tipos, marcas });
      } else {
        const q = quejaDe(f.content);
        if (q.length) out.push({ ...base, clave: `conv:${f.id}`, tipos: ['queja'], marcas: q });
        const siguiente = filas[i + 1];
        const t0 = Date.parse(f.created_at);
        const contesto = !!siguiente && siguiente.role === 'assistant';
        if (!contesto && Number.isFinite(t0) && ahora - t0 > ESPERA_RESPUESTA_MS) {
          const limite = siguiente ? Date.parse(siguiente.created_at) : t0 + ESPERA_RESPUESTA_MS;
          const cartel = usos.some((u) => u.feature === 'cartel-ia' && u.workspace_id === f.workspace_id
            && Date.parse(u.created_at) >= t0 && Date.parse(u.created_at) <= limite);
          // Con un cartel lo cuenta la fila del cartel (abajo); sin él, es silencio.
          if (!cartel) out.push({ ...base, clave: `conv:${f.id}:sin-respuesta`, tipos: ['sin-respuesta'], marcas: [] });
        }
      }
    }
  }
  for (const u of usos) {
    if (u.feature !== 'cartel-ia' && u.feature !== 'saneo-doer') continue;
    // El `motivo` lo arma el doer: «ws18 · consultar · 3 keys · …». La fila va al ws del request (`wsDeProveedor` con un
    // proveedor que no es Claude), que es el del grupo; el del motivo manda igual, por si una corre sin contexto.
    const ws = Number(/^ws(\d+)\b/.exec(u.motivo ?? '')?.[1] ?? u.workspace_id);
    out.push({
      clave: `uso:${u.id}`, tipos: [u.feature === 'cartel-ia' ? 'cartel' : 'saneo'], ws, grupo: null, at: u.created_at,
      texto: recorte(u.motivo ?? ''), marcas: [u.model ?? ''].filter(Boolean), antes: null, antesAt: null,
    });
  }
  return out.sort((a, b) => a.at.localeCompare(b.at));
}

/** Una línea por incidente, para leerla en la terminal. */
export function lineaDe(i: Incidente, nombreWs: (ws: number) => string): string {
  const hora = i.at.slice(5, 16).replace('T', ' ');
  const marcas = i.marcas.length ? ` [${i.marcas.join(', ')}]` : '';
  return `${hora} UTC · ws${i.ws} ${nombreWs(i.ws)} · ${i.tipos.join(' + ')}${marcas}\n    ${i.texto}${i.antes ? `\n    ↳ antes: ${i.antes}` : ''}`;
}
