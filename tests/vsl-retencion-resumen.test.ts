// La retención del VSL desde un RESUMEN (Dashboard v5, «la hoja Landing lenta»): la función SQL
// `retencion_vsl_resumen` (supabase/migrations/0261_retencion_vsl_resumen.sql) agrupa en la base lo que antes
// eran 48 mil eventos bajados dos veces por hoja, y `avancesDeResumen` (lib/vsl-retencion.ts) termina la
// cuenta. Es una SEGUNDA escritura de `avanceDe`, así que este test exige PARIDAD con el cálculo de siempre
// (`avancePorPersona` + `histogramaAbandono`) sobre los mismos eventos, y que la migración traiga TEXTUALES las
// dos regex de las que depende la paridad.
// Correr: npx tsx --test tests/vsl-retencion-resumen.test.ts
//
// MEDIDO CONTRA LA BASE REAL (12/10/2026, sólo lectura: el CUERPO de la función corrido como un SELECT suelto,
// sin crearla): ws1, 12/09 → 11/10, 48.340 eventos (32.488 del video) → 3.016 filas de resumen; 3.010 personas
// comparadas con la duración en null y en 1416 s: 0 diferencias de avance y los histogramas de salida iguales.
// En la base: 756 ms (la primera versión, con un join que el plan resolvía mal, 3,1 s; ver la migración).
//
// Probados rompiéndolos (12/10/2026, arnés que restaura de memoria), con la base en 0 fallos (6 tests):
//   · `avanceDeResumen` usando sólo `max_pct` (sin los segundos)              → 4 pass / 2 fail («paridad…», «la curva…»)
//   · `resumirEventos` sin el `continue` de las pruebas                       → 4 pass / 2 fail («paridad…», «el resumen agrupa…»)
//   · `resumirEventos` mandando a `max_seg` los eventos CON % positivo         → 4 pass / 2 fail («paridad…», «la curva…»)
//   · `avancesDeResumen` quedándose con el ÚLTIMO host y no el máximo         → 4 pass / 2 fail («paridad…», «la curva…»)
//   · la migración con `p\d+` cambiado por `p[0-9]+`                          → 5 pass / 1 fail («la migración trae…»)
//   · la migración sin el `revoke … from public, anon, authenticated`         → 5 pass / 1 fail («la migración no le abre…»)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ES_EVENTO_DE_VIDEO, RE_HOST_DE_URL, avancePorPersona, avancesDeResumen, curvaDesdeAvances, curvaRetencion, histogramaAbandono,
  histogramaDesdeSalidas, hostDeUrl, resumirEventos, type EventoResumible,
} from '../lib/vsl-retencion';
import { esPreviewDeEditor } from '../lib/landing-paginas';

// Un generador con semilla: el mismo azar en cada corrida.
function azar(semilla: number) { let s = semilla >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32); }

const TIPOS = ['play', 'pausa', 'retoma', 'fin', 'exit', 'p5', 'p25', 'p50', 'p100', 's3', 's30', 's300', 'salio', 'volvio', 'cierre', 'click', 'scroll', 'agendo', ' p10 ', 'desconocido'];
const URLS = ['https://minegocio.com/vsl?fbclid=1', 'minegocio.com/gracias', 'https://id-preview--abc.lovable.app/x', 'https://abc.lovableproject.com/', null, 'HTTPS://MiNegocio.com:443/vsl', ''];
const PERSONAS = [...Array.from({ length: 60 }, (_, i) => 'v' + i), ' v6 ', '', null];
const VIDEOS = ['vidA', 'vidB', null, ' vidA '];

function eventos(n: number, semilla: number): EventoResumible[] {
  const r = azar(semilla);
  const uno = <T>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  return Array.from({ length: n }, (_, i) => {
    const tipo = uno(TIPOS);
    const pct = r() < 0.4 ? null : r() < 0.15 ? 0 : Math.round(r() * 110);
    const seg = r() < 0.4 ? null : r() < 0.1 ? 0 : Math.round(r() * 2000) / 10;
    return {
      id: i + 1, created_at: new Date(Date.UTC(2026, 9, 1) + Math.floor(r() * 10 * 86_400_000)).toISOString(),
      visitor_id: uno(PERSONAS), tipo_evento: tipo, porcentaje: pct, segundos: seg, video_id: uno(VIDEOS),
      landing_url: uno(URLS), vsl_titulo: r() < 0.5 ? uno(['VSL Principal', 'Testimonio', ' VSL Principal ']) : null,
      prueba: r() < 0.1 ? 'mko-123' : r() < 0.05 ? '' : null,
    };
  });
}

/** El cálculo de SIEMPRE (videosDelPeriodo hasta el v5): sin las pruebas ni la vista previa, por video. */
function deSiempre(evs: EventoResumible[], dur: number | null) {
  const porVideo = new Map<string, EventoResumible[]>();
  for (const e of evs) {
    if (e.prueba || esPreviewDeEditor(e.landing_url ?? '')) continue;
    const k = (e.video_id ?? '').trim();
    (porVideo.get(k) ?? porVideo.set(k, []).get(k)!).push(e);
  }
  return new Map([...porVideo].map(([v, es]) => [v, { avances: avancePorPersona(es, dur, null), salidas: histogramaAbandono(es, dur, null) }]));
}
/** El cálculo NUEVO: el resumen (lo que devuelve la función SQL), sin la vista previa por host, por video. */
function delResumen(evs: EventoResumible[], dur: number | null) {
  const porVideo = new Map<string, ReturnType<typeof resumirEventos>>();
  for (const r of resumirEventos(evs)) {
    if (r.host && esPreviewDeEditor(`https://${r.host}`)) continue;
    const k = (r.video_id ?? '').trim();
    (porVideo.get(k) ?? porVideo.set(k, []).get(k)!).push(r);
  }
  return new Map([...porVideo].map(([v, rs]) => {
    const p = avancesDeResumen(rs, dur);
    return [v, { avances: new Map([...p].map(([k, x]) => [k, x.avance])), salidas: histogramaDesdeSalidas([...p.values()].map((x) => x.salida).filter((x): x is number => x != null)) }];
  }));
}

test('paridad: el resumen da el MISMO avance y las mismas salidas que los eventos, persona por persona', () => {
  let comparadas = 0;
  for (const semilla of [1, 2, 3, 7, 42, 1234]) {
    const evs = eventos(600, semilla);
    for (const dur of [null, 120, 0, 9999]) {
      const a = deSiempre(evs, dur);
      const b = delResumen(evs, dur);
      // Un video que sólo tiene eventos que no son del video aparece en el viejo con 0 personas: no es una curva.
      const conGente = (m: Map<string, { avances: Map<string, number | null> }>) => [...m].filter(([, x]) => x.avances.size).map(([k]) => k).sort();
      assert.deepEqual(conGente(b), conGente(a), `semilla ${semilla}, dur ${dur}: otros videos`);
      for (const [v, x] of a) {
        if (!x.avances.size) continue;
        const y = b.get(v)!;
        assert.deepEqual([...y.avances].sort(), [...x.avances].sort(), `semilla ${semilla}, dur ${dur}, video ${v}: otro avance`);
        assert.deepEqual(y.salidas, x.salidas, `semilla ${semilla}, dur ${dur}, video ${v}: otras salidas`);
        comparadas += x.avances.size;
      }
    }
  }
  assert.ok(comparadas > 500, `comparó sólo ${comparadas} personas: el generador no está ejercitando nada`);
});

test('la curva desde los avances es la MISMA que curvaRetencion sobre los eventos', () => {
  const evs = eventos(800, 99).filter((e) => !e.prueba && !esPreviewDeEditor(e.landing_url ?? '') && (e.video_id ?? '').trim() === 'vidA');
  const vieja = curvaRetencion(evs, 300, null);
  const p = avancesDeResumen(resumirEventos(evs), 300);
  const nueva = curvaDesdeAvances([...p.values()].map((x) => x.avance));
  assert.deepEqual(nueva, vieja);
  assert.ok(vieja.hayDatos && vieja.medidos > 10, 'la muestra no tiene curva');
});

test('el resumen agrupa por persona, video y HOST; sin persona no hay persona; las pruebas no entran', () => {
  const base = { tipo_evento: 'p50', porcentaje: 50, segundos: null, video_id: 'v', vsl_titulo: null, prueba: null };
  const r = resumirEventos([
    { ...base, id: 1, created_at: '2026-10-02T10:00:00Z', visitor_id: 'a', landing_url: 'https://uno.com/x' },
    { ...base, id: 2, created_at: '2026-10-01T10:00:00Z', visitor_id: 'a', landing_url: 'https://uno.com/y', porcentaje: 80 },
    { ...base, id: 3, created_at: '2026-10-03T10:00:00Z', visitor_id: 'a', landing_url: 'https://dos.com/' },
    { ...base, id: 4, created_at: '2026-10-03T10:00:00Z', visitor_id: '', landing_url: 'https://uno.com/' },
    { ...base, id: 5, created_at: '2026-10-03T10:00:00Z', visitor_id: 'b', landing_url: 'https://uno.com/', prueba: 'mko-1' },
    { ...base, id: 6, created_at: '2026-10-03T10:00:00Z', visitor_id: 'c', landing_url: null, tipo_evento: 'salio', segundos: 500 },
  ]);
  const a1 = r.find((x) => x.visitor_id === 'a' && x.host === 'uno.com')!;
  assert.equal(a1.max_pct, 80);
  assert.equal(a1.primera, '2026-10-01T10:00:00Z');
  assert.equal(a1.url, 'https://uno.com/y', 'la URL del PRIMER evento');
  assert.ok(r.some((x) => x.visitor_id === 'a' && x.host === 'dos.com'));
  assert.ok(r.some((x) => x.visitor_id === null), 'sin persona queda una fila sin persona (y avancesDeResumen la saltea)');
  assert.ok(!r.some((x) => x.visitor_id === 'b'), 'una prueba no entra');
  assert.ok(!r.some((x) => x.visitor_id === 'c'), '«salio» habla de la página, no del video');
  assert.equal(avancesDeResumen(r, null).size, 1, 'sólo «a» es una persona del video');
});

test('el host de la URL: el de la regex que comparte la función SQL', () => {
  assert.equal(hostDeUrl('https://www.MiNegocio.com:8443/vsl?x=1#y'), 'www.minegocio.com');
  assert.equal(hostDeUrl('minegocio.com/gracias'), 'minegocio.com');
  assert.equal(hostDeUrl(''), null);
  assert.equal(hostDeUrl(null), null);
  // Lo que importa del host: que la vista previa del constructor se reconozca igual que con la URL entera.
  for (const u of ['https://id-preview--abc.lovable.app/x', 'https://abc.lovableproject.com/', 'https://minegocio.com/vsl']) {
    assert.equal(esPreviewDeEditor(`https://${hostDeUrl(u)}`), esPreviewDeEditor(u), u);
  }
});

test('la migración trae las regex TEXTUALES de lib/vsl-retencion.ts y el corte de la vista previa queda en TS', () => {
  const mig = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '0261_retencion_vsl_resumen.sql'), 'utf8').replace(/\r\n/g, '\n');
  const cuerpo = mig.slice(mig.indexOf('as $$'), mig.indexOf('$$;', mig.indexOf('as $$')));
  // Una segunda escritura de esEventoDeVideo: si la constante cambia, la base tiene que cambiar con ella.
  assert.ok(cuerpo.includes(`~ '${ES_EVENTO_DE_VIDEO.source}'`), 'la regex de los eventos del video no es la de ES_EVENTO_DE_VIDEO');
  assert.ok(cuerpo.includes(`'${RE_HOST_DE_URL.source}'`), 'la regex del host no es la de RE_HOST_DE_URL');
  // Las mismas reglas que avanceDe y histogramaAbandono.
  assert.match(cuerpo, /max\(porcentaje\) filter \(where porcentaje > 0\) as max_pct/);
  assert.match(cuerpo, /max\(segundos\) filter \(where not coalesce\(porcentaje > 0, false\) and segundos > 0\) as max_seg/);
  assert.match(cuerpo, /filter \(where tipo_evento = 'exit' and porcentaje > 0\) as max_pct_exit/);
  assert.match(cuerpo, /coalesce\(e\.prueba, ''\) = ''/, 'las pruebas no entran (noEsDelNegocio)');
  // El workspace EXPLÍCITO y el día de la zona de la app.
  assert.match(cuerpo, /e\.workspace_id = p_ws/);
  assert.match(cuerpo, /e\.created_at >= \(p_desde::timestamp at time zone p_tz\)/);
  assert.match(cuerpo, /e\.created_at < \(\(p_hasta \+ 1\)::timestamp at time zone p_tz\)/);
  // Un arreglo y no un setof: PostgREST corta las funciones en 1000 filas sin avisar.
  assert.match(mig, /\) returns jsonb\n/);
});

test('la migración no le abre la función a la clave pública', () => {
  const mig = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '0261_retencion_vsl_resumen.sql'), 'utf8').replace(/\r\n/g, '\n');
  assert.match(mig, /revoke all on function public\.retencion_vsl_resumen\(bigint, date, date, text, text\[\]\) from public, anon, authenticated;/);
  assert.match(mig, /security invoker/);
  // Sobre el SQL sin comentarios: la cabecera puede explicar por qué no lleva `security definer`.
  assert.doesNotMatch(mig.replace(/^\s*--.*$/gm, ''), /security definer/);
  assert.match(mig, /ORDEN DE DESPLIEGUE/);
});
