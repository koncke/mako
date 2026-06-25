export const meta = {
  name: 'closing-v2-analyze',
  description: 'Deep per-call analysis of Closing Analyst recordings (one analyst agent per call)',
  phases: [{ title: 'Analizar', detail: 'un agente analista por llamada' }],
}

// Cada agente lee el .txt de la llamada, hace un análisis profundo de venta
// consultiva y escribe el JSON de salida.
const RIDS = [100817150,104400149,105421353,108214838,108225427,108249147,108503834,109588302,109610971,109624092,110841842,111141971,111313175,113668455,114395879,120270442,121804145,122124791,123472994,123883329,125850952,129233893,130257470,130326484,131714628,131739192,131754580,132043900,132087069,132151058,133284499,133573061,133589256,135043604,135122814,135370687,135700135,136801229,136887692,137121763,137164098,137176851,137558296,138683597,138798077,139121629,139160780,139565350,139583414,140566614,140602974,140652461,140700149,140739407,140930882,140966018,141064920,141521613,142339504,142732049,142934995,143342145,144254488,144869333,144919416,144935380,144982748,146892503,146934410,146958065,146992350,147000679,147327019,147446570,147801707,147853969,148183275,148531866,149290376,149564444,149624925,150084256,150351722,150400050,150485974,150497354,150724556,150754529,150819873,151088260,151145379,151287659,151566214,151694077,152024069,152108384,152312508,152358999,152468640,152667568,152865402,153284757,153305405,153558774,153609068,153642543,153987842,154121853,154131149,154510420,154697908,154788899,154911298,155602602,156013578,156056643,156375367,156802851,156806237,157459087,157562733,157682453,157959307,158017271,98214315]
const ROOT = 'C:/Users/marti/OneDrive/Escritorio/dashboard-marketing-main/dashboard-marketing'

const SCHEMA = {
  type: 'object',
  properties: {
    recording_id: { type: 'number' },
    categoria: { type: 'string' },
    tipo: { type: ['string', 'null'] },
    score: { type: ['number', 'null'] },
    has_transcript: { type: 'boolean' },
    wrote_file: { type: 'boolean' },
  },
  required: ['recording_id', 'categoria', 'has_transcript', 'wrote_file'],
}

function prompt(rid) {
  return `Sos un analista experto en llamadas de VENTA CONSULTIVA. El cliente es Mauricio Bustos: vende un programa de mentoría/consultoría a dueños de negocio (metodología SPIN + manejo de objeciones + cierre).

Leé el archivo de la llamada (metadatos + contexto del lead + resumen de Fathom + transcript completo con marcas [segundos · mm:ss]):
  Read: ${ROOT}/scripts/_closing_work/${rid}.txt

PASO 1 — CLASIFICÁ:
- "venta": vender el programa a un prospecto que TODAVÍA NO es cliente. tipo "R1" = diagnóstico/calificación (mapear situación, dolor, calificar fit; sin precio formal o recién al final). tipo "R2" = propuesta/cierre (se presenta precio, se manejan objeciones, se busca el cierre).
- "entrega_servicio": trabajo CON un cliente que YA compró (coaching, accountability, 4DX, OKRs, sprints, seguimiento de compromisos). Aunque el título diga "Junta X" o "Primera sesión", si el contenido es ejecutar/acompañar, es servicio.
- "interna" / "otro": equipo, estrategia interna, demo, prueba.
Pistas fuertes: si el lead figura 'ganado' o con fecha de cierre/inicio de servicio ANTERIOR a esta llamada → casi seguro entrega_servicio. Si se negocia precio/condiciones y la persona aún decide contratar → venta.
Si el archivo dice "SIN TRANSCRIPT": poné has_transcript:false, clasificá por metadatos lo mejor posible, y NO inventes análisis (dims/strengths/etc. vacíos, score null).

PASO 2 — Si es "venta" Y hay transcript, hacé un análisis PROFUNDO, específico y citado (nada de frases genéricas). Cada evidencia debe citar el transcript con su t_seconds real (el número de [Ns]).
Producí EXACTAMENTE este JSON (sin texto fuera del JSON):
{
  "recording_id": ${rid},
  "es_venta": boolean,
  "categoria": "venta" | "entrega_servicio" | "interna" | "otro",
  "razon": "1 frase: por qué esa categoría",
  "tipo": "R1" | "R2" | null,
  "has_transcript": boolean,
  "score": number,                    // 0-10 global; null si no es venta o sin transcript
  "outcome": "desenlace corto, p.ej. Cierre ganado / Pasó a R2 / Perdido / Sin definir",
  "outcome_tone": "good" | "warn" | "bad",
  "summary": "4-6 frases: contexto, cómo se desarrolló, momento de quiebre, resultado",
  "next_step": "qué hacer ahora con este lead",
  "dims": [ { "g": "spin"|"exec", "label": string, "score": number, "note": "1-2 frases", "quote": "cita textual del transcript", "t_seconds": number } ],   // 7 items: Situación, Problema, Implicación, Necesidad / beneficio, Presentación de la propuesta, Manejo de objeciones, CTA / siguientes pasos
  "strengths": [ { "title": string, "quote": string, "t_seconds": number, "note": string } ],   // 2-4
  "weaknesses": [ { "title": string, "quote": string, "t_seconds": number, "note": string } ],  // 2-4
  "objections": [ { "quote": string, "t_seconds": number, "handled": boolean, "note": "cómo se manejó o por qué no" } ], // todas las que aparezcan
  "moments": [ { "t_seconds": number, "tone": "good"|"bad"|"neutral", "tag": "etiqueta corta", "quote": string } ],  // 6-12 hitos
  "annotations": [ { "t_seconds": number, "tone": "good"|"bad", "label": "etiqueta corta" } ],   // 8-20 marcadores a lo largo de TODA la llamada
  "recs": [ string ]                  // 3-5 recomendaciones de coaching accionables
}
Todo en español rioplatense (voseo), concreto y sin relleno. Para entrega_servicio/interna/otro: completá categoria, razon, summary (1-2 frases) y dejá los arrays vacíos y score null.

PASO 3 — Escribí el JSON (solo el objeto, válido) en:
  Write: ${ROOT}/scripts/_closing_work_out/${rid}.json

Devolvé el resumen estructurado pedido (recording_id, categoria, tipo, score, has_transcript, wrote_file=true).`
}

phase('Analizar')
const results = await parallel(
  RIDS.map((rid) => () =>
    agent(prompt(rid), { label: `rid:${rid}`, phase: 'Analizar', schema: SCHEMA, effort: 'high' })
      .then((r) => r || { recording_id: rid, categoria: 'error', has_transcript: false, wrote_file: false })
  )
)

const ok = results.filter(Boolean)
const by = {}
for (const r of ok) by[r.categoria] = (by[r.categoria] || 0) + 1
return {
  procesadas: ok.length,
  escritas: ok.filter((r) => r.wrote_file).length,
  ventas: ok.filter((r) => r.categoria === 'venta').length,
  sin_transcript: ok.filter((r) => !r.has_transcript).length,
  por_categoria: by,
  fallidas: ok.filter((r) => !r.wrote_file).map((r) => r.recording_id),
}
