'use client';

// =============================================================================
// useBorradorSecuencia — lo que el lienzo de /automations tiene SIN PUBLICAR, guardado solo
// =============================================================================
// Sexta tanda, punto 7 (Martín, 09/10/2026): «Que se elimine una flecha no significa que se elimine la
// tarjeta posterior, sino que queda "flotando". Lo que no se puede es publicar o probar una
// automatización incompleta». Una automatización a medio armar —con una tarjeta suelta, una condición
// sin completar— no se puede publicar, y hasta la segunda pasada tampoco se podía GUARDAR: el lienzo
// editaba en memoria y lo único que escribía los pasos era Publicar. Al recargar o al cambiar de
// automatización se perdía.
//
// Esto lo guarda en su propia columna (`nutricion_secuencias.pasos_borrador`, mig 0240) por SU acción
// (POST /api/chat-agent/secuencias, `action: 'borrador'` → `guardarBorradorSecuencia`,
// lib/secuencia-borrador.ts), que valida sólo lo que rompe el DATO (`validarParaGuardar`). EL MOTOR
// NO LO LEE NUNCA. Mismo molde que app/automations/usePosicionesLienzo.ts:
//   · CON UN RESPIRO: tipear una frase es UN guardado, con el flujo final.
//   · AL IRSE (otra automatización, cerrar la pestaña) lo que esperaba su respiro se manda igual.
//   · SI NO SE LEYÓ (`puedeGuardar` false: el GET no trajo el borrador porque falta la columna o la
//     lectura falló) NO se guarda: guardarlo pisaría un borrador que la pantalla no vio. Y si el server
//     contesta `sinColumna`, se deja de intentar sin cartel (no es nada que la persona pueda arreglar).
//   · `guardado(json)` avisa con el flujo que quedó guardado: desde ahí, salir no pierde nada.
//
// ⚠️ CADA GUARDADO LLEVA LA BASE: la huella de lo publicado que esta pestaña ABRIÓ (revisión de la sexta
// tanda, 10/10/2026; lib/secuencia-borrador.ts, la cabecera). Si mientras tanto se publicó otra cosa (otra
// pestaña, MaKo por WhatsApp, un hand-off), el server no lo guarda y contesta `desactualizado`: se deja de
// guardar y la pantalla lo dice (`ERROR_DESACTUALIZADO`). Sin esto, un borrador armado sobre lo viejo se
// abría encima de lo nuevo y Publicar lo pisaba. Tres consecuencias que no se ven:
//   · PUBLICAR CAMBIA LA BASE. `antesDePublicar` cierra una compuerta: lo que salga de su respiro mientras
//     el PATCH viaja ESPERA (con la base vieja se rechazaría, y el cartel diría que otro publicó lo que
//     publicó esta misma pestaña). `publicado` descarta el borrador, toma la base NUEVA de la respuesta del
//     server y abre la compuerta; `noPublicado` la abre sin tocar nada. Y lo que estaba en vuelo antes de
//     publicar ya no se escucha (`ronda`): su respuesta habla de la base de antes.
//   · DESCARTAR NO MANDA LO PENDIENTE (hallazgo de la misma revisión: «Descartar cambios» lo guardaba,
//     porque el desmonte despacha lo que esperaba). `descartar` lo suelta, tira lo que esperaba la
//     compuerta, y borra el borrador DESPUÉS de lo que esté en vuelo: al revés, un guardado lento llegaba
//     detrás del borrado y lo resucitaba. NO adopta la base que devuelve el server: no publicó nada, y si
//     lo publicado había cambiado, adoptarla sería volver al bug.
//   · AL IRSE SE RELEE LA LISTA (`cerrar` → `onSalir`) si el server quedó distinto: la lista de
//     automatizaciones se lee al entrar, y volver a ésta en la misma visita abría lo de ANTES (lo publicado
//     sin el borrador, o el borrador que se acababa de descartar).
//
// La lógica vive en `crearBorrador`, sin React, para que un test la EJECUTE con relojes falsos
// (tests/chatbot-v6b-flujo.test.ts); el hook sólo la monta una vez y le engancha la salida.

import { useEffect, useRef } from 'react';
import type { PasoSecuenciaDto } from './ChatAgentApp';

/** El respiro entre el último cambio y el guardado. Más largo que el de las posiciones: acá se tipea. */
export const RESPIRO_BORRADOR_MS = 1200;

/** El cartel cuando el server no lo guardó (corto: es un error de pantalla). */
export const ERROR_BORRADOR = 'No se guardó el borrador';
/** El cartel cuando lo publicado cambió desde que se abrió: lo que hay en el lienzo no se guarda. */
export const ERROR_DESACTUALIZADO = 'Cambió lo publicado: recarga';

export type MotorBorrador = {
  /** El flujo de ahora: se guarda después del respiro, si cambió desde lo último guardado. */
  cambio: (pasos: PasoSecuenciaDto[]) => void;
  /** Esto ya está guardado por otro camino: no se manda. */
  yaGuardado: (pasos: PasoSecuenciaDto[]) => void;
  /** Sale el PATCH de Publicar: lo que salga de su respiro espera, y lo que está en vuelo ya no se escucha. */
  antesDePublicar: () => void;
  /**
   * Se publicó ESTO (Publicar, o «Crear con IA» que ya lo guardó): el borrador se borra en el server, la
   * base pasa a ser la de lo publicado (la que devuelve el server) y lo que esperaba sale con ella.
   */
  publicado: (pasos: PasoSecuenciaDto[]) => Promise<void>;
  /** El PATCH falló: lo que esperaba sale con la base de siempre. */
  noPublicado: () => void;
  /**
   * «Volver a lo publicado» / «Descartar cambios»: lo pendiente NO sale y el borrador se borra en el
   * server, después de lo que esté en vuelo. Resuelve cuando el server contestó.
   */
  descartar: () => Promise<void>;
  /** Lo que esperaba su respiro sale YA (al esconder la pestaña). */
  despachar: () => void;
  /** Al irse: despacha, y resuelve cuando todo volvió. `true` si el server quedó distinto del GET. */
  cerrar: () => Promise<boolean>;
};

/**
 * EL GUARDADO DEL BORRADOR, sin React. `post` manda el cuerpo a la ruta (el hook le pone el
 * `secuenciaId` y `keepalive`); `avisos()` se lee en cada respuesta, así un aviso nuevo del
 * componente llega aunque el motor se haya creado en el primer render.
 */
export function crearBorrador(dep: {
  post: (body: Record<string, unknown>) => Promise<{ json: () => Promise<unknown> }>;
  /** El flujo con el que se abrió (lo publicado o el borrador): ése no se vuelve a mandar. */
  inicial: PasoSecuenciaDto[];
  /** El borrador se leyó (hay o no hay) y quien mira puede editar. */
  puedeGuardar: boolean;
  /**
   * La huella de lo publicado que abrió esta pestaña (`SecuenciaDto.base`, la calcula el server en el
   * GET). Se lee UNA vez: una lista releída después trae la de AHORA, y adoptarla sería el bug.
   */
  base: string | null | undefined;
  avisos: () => { onGuardado?: (json: string) => void; onError?: (m: string) => void };
  respiroMs?: number;
}): MotorBorrador {
  const respiro = dep.respiroMs ?? RESPIRO_BORRADOR_MS;
  const leido = dep.puedeGuardar;
  let sinColumna = false;
  /** El server dijo que lo publicado ya no es lo que se abrió: no se guarda más hasta publicar. */
  let vieja = false;
  let base = typeof dep.base === 'string' ? dep.base : null;
  const guardable = () => leido && !sinColumna && !vieja;
  let ultimo = JSON.stringify(dep.inicial);
  let pendiente: { t: ReturnType<typeof setTimeout>; pasos: PasoSecuenciaDto[] } | null = null;
  /** Sube al publicar y al descartar: la respuesta de un pedido de una ronda anterior no se escucha. */
  let ronda = 0;
  /** Sube sólo al DESCARTAR: lo que esperaba la compuerta de antes ya no tiene que salir. */
  let intencion = 0;
  /** Lo que un guardado espera antes de salir: Publicar en vuelo, o la base nueva que trae `publicado`. */
  let compuerta: Promise<void> = Promise.resolve();
  let abrir: (() => void) | null = null;
  /**
   * El último pedido que SALIÓ (guardado o borrado), con su respuesta: un borrado va detrás. Sólo lo que
   * salió: un guardado que espera la compuerta no cuenta, o `publicado` esperaría a lo que lo espera a él.
   */
  let enviado: Promise<void> = Promise.resolve();
  /** El último borrado, con su respuesta: un guardado nuevo sale detrás. */
  let borrado: Promise<void> = Promise.resolve();
  /** Todo lo que falta terminar, incluido lo que espera la compuerta: `cerrar` lo espera entero. */
  let trabajo: Promise<void> = Promise.resolve();
  const sumar = (p: Promise<void>) => { trabajo = Promise.all([trabajo, p]).then(() => undefined); };
  let tocoServer = false;

  const mandar = (pasos: PasoSecuenciaDto[]): void => {
    const json = JSON.stringify(pasos);
    const i = intencion;
    sumar((async () => {
      await compuerta;
      // Y detrás de un borrado en vuelo: si no, un Ctrl+Z justo después de «Volver a lo publicado» podía
      // llegar antes que el borrado y quedar borrado.
      await borrado;
      if (i !== intencion || !guardable()) {
        // Se descartó mientras esperaba: no sale. Si vuelve a aparecer en el lienzo, se manda de nuevo.
        if (ultimo === json) ultimo = '';
        return;
      }
      // Es lo último que va a tener el server (después de un `publicado`, que anotó lo publicado).
      ultimo = json;
      const r0 = ronda;
      const envio = (async () => {
        try {
          const r = await dep.post({ action: 'borrador', pasos, base });
          const j = await r.json().catch(() => null) as { ok?: boolean; sinColumna?: boolean; desactualizado?: boolean } | null;
          if (r0 !== ronda) return;
          if (j?.sinColumna) { sinColumna = true; return; }
          if (j?.desactualizado) { vieja = true; soltar(); dep.avisos().onError?.(ERROR_DESACTUALIZADO); return; }
          if (!j?.ok) { dep.avisos().onError?.(ERROR_BORRADOR); return; }
          tocoServer = true;
          dep.avisos().onGuardado?.(json);
        } catch {
          if (r0 === ronda) dep.avisos().onError?.(ERROR_BORRADOR);
        }
      })();
      enviado = envio;
      await envio;
    })());
  };

  const soltar = () => { if (pendiente) { clearTimeout(pendiente.t); pendiente = null; } };
  const cerrarCompuerta = () => {
    if (abrir) return;
    compuerta = new Promise<void>((res) => { abrir = res; });
  };
  const abrirCompuerta = () => { const a = abrir; abrir = null; a?.(); };
  /** Borra el borrador en el server DETRÁS de lo que ya salió; devuelve la base que contestó. */
  const borrar = (): Promise<string | null> => {
    tocoServer = true;
    const antes = enviado;
    let base2: string | null = null;
    const p = (async () => {
      await antes;
      try {
        const r = await dep.post({ action: 'descartar-borrador' });
        const j = await r.json().catch(() => null) as { ok?: boolean; base?: unknown; sinColumna?: boolean } | null;
        if (j?.sinColumna) sinColumna = true;
        if (j?.ok && typeof j.base === 'string') base2 = j.base;
      } catch { /* sin red: el que sigue guardando lo va a decir */ }
    })();
    enviado = p;
    borrado = p;
    sumar(p);
    return p.then(() => base2);
  };

  const despachar = () => {
    const p = pendiente;
    if (!p) return;
    soltar();
    const json = JSON.stringify(p.pasos);
    if (json === ultimo) return;
    ultimo = json;
    mandar(p.pasos);
  };

  return {
    cambio(pasos) {
      if (!guardable()) return;
      const json = JSON.stringify(pasos);
      // Volvió a lo último guardado (deshacer hasta ahí): lo que esperaba ya no hace falta.
      if (json === ultimo) { soltar(); return; }
      soltar();
      // Al vencer se vuelve a mirar: si mientras tanto eso pasó a estar guardado (se publicó tal cual),
      // no sale.
      const t = setTimeout(() => { pendiente = null; if (json === ultimo) return; ultimo = json; mandar(pasos); }, respiro);
      pendiente = { t, pasos };
    },
    yaGuardado(pasos) {
      soltar();
      ultimo = JSON.stringify(pasos);
    },
    antesDePublicar() {
      ronda++;
      cerrarCompuerta();
    },
    async publicado(pasos) {
      // Lo que espera su respiro NO se suelta: es lo que se tocó mientras se publicaba, y sale encima de
      // lo publicado (si es lo publicado mismo, el respiro lo ve y no sale).
      ronda++;
      ultimo = JSON.stringify(pasos);
      cerrarCompuerta();
      if (leido && !sinColumna) {
        const b = await borrar();
        // La base nueva es la de lo que ESTA pestaña publicó: los borradores que siguen se arman
        // encima. Sin respuesta queda la de antes, y el próximo guardado dice que hay que recargar.
        if (b) { base = b; vieja = false; }
      }
      abrirCompuerta();
    },
    noPublicado() {
      abrirCompuerta();
    },
    async descartar() {
      soltar();
      ronda++;
      intencion++;
      abrirCompuerta();
      if (!leido || sinColumna) return;
      await borrar();
    },
    despachar,
    async cerrar() {
      despachar();
      await trabajo;
      return tocoServer;
    },
  };
}

export function useBorradorSecuencia(
  secuenciaId: number,
  opts: {
    puedeGuardar: boolean;
    inicial: PasoSecuenciaDto[];
    /** La huella de lo publicado que abrió la pestaña (`SecuenciaDto.base`). Se lee al montar. */
    base: string | null | undefined;
    onGuardado?: (json: string) => void;
    onError?: (m: string) => void;
    /** Al irse, si el server quedó distinto de lo que trajo el GET: hay que releer la lista. */
    onSalir?: () => void;
  },
): Omit<MotorBorrador, 'despachar' | 'cerrar'> {
  const avisos = useRef({ onGuardado: opts.onGuardado, onError: opts.onError, onSalir: opts.onSalir });
  useEffect(() => { avisos.current = { onGuardado: opts.onGuardado, onError: opts.onError, onSalir: opts.onSalir }; });
  // UNA vez por montaje: SecuenciaPerfil se monta con `key={sel.id}`, así que otra automatización es
  // otro motor (y el desmonte de la anterior ya despachó lo suyo).
  const motor = useRef<MotorBorrador | null>(null);
  if (!motor.current) {
    motor.current = crearBorrador({
      post: (body) => fetch('/api/chat-agent/secuencias', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, keepalive: true,
        body: JSON.stringify({ secuenciaId, ...body }),
      }),
      inicial: opts.inicial, puedeGuardar: opts.puedeGuardar, base: opts.base, avisos: () => avisos.current,
    });
  }
  const m = motor.current;

  // Al irse, y al esconder la pestaña (el desmonte no corre al cerrarla): lo que esperaba su respiro
  // sale ya, con `keepalive` para que sobreviva al cierre. Y al irse, cuando todo volvió, se relee la
  // lista si algo cambió en el server: volver a esta automatización en la misma visita abría lo de antes.
  useEffect(() => {
    const alEsconder = () => { if (document.visibilityState === 'hidden') m.despachar(); };
    document.addEventListener('visibilitychange', alEsconder);
    return () => {
      document.removeEventListener('visibilitychange', alEsconder);
      void m.cerrar().then((cambio) => { if (cambio) avisos.current.onSalir?.(); });
    };
  }, [m]);

  return {
    cambio: m.cambio, yaGuardado: m.yaGuardado, antesDePublicar: m.antesDePublicar,
    publicado: m.publicado, noPublicado: m.noPublicado, descartar: m.descartar,
  };
}
