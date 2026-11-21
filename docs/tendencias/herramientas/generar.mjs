// De tabla.json (analizar.mjs) + nombres.json + como-usarla.json a los dos entregables:
//   docs/tendencias/tendencias.json  (lo lee la pestaña «Tendencias» de Content Machine)
//   docs/tendencias/mapa.md          (lo mismo, para leer)
// Uso: node generar.mjs <carpeta docs/tendencias del worktree>
import fs from 'node:fs';
const DIR = 'C:/dev/tendencias';
const OUT = process.argv[2] || 'C:/dev/wt-tendencias/docs/tendencias';
const T = JSON.parse(fs.readFileSync(`${DIR}/tabla.json`, 'utf8'));
const NOM = JSON.parse(fs.readFileSync(`${DIR}/nombres.json`, 'utf8'));
const USO = fs.existsSync(`${DIR}/como-usarla.json`) ? JSON.parse(fs.readFileSync(`${DIR}/como-usarla.json`, 'utf8')) : {};
const REF = JSON.parse(fs.readFileSync(`${DIR}/referentes.json`, 'utf8'));
const ORDEN = ['Anuncios', 'IA', 'Closing y ventas', 'YouTube', 'High ticket', 'Low ticket', 'Orgánico de nicho', 'Orgánico viral', 'Mentalidad y coaching'];
const ESTADOS = ['En crecimiento', 'Nuevo', 'Saturado', 'En baja'];
const n0 = (x) => (x == null || !Number.isFinite(x) ? null : x);
const fmt = (x) => (x == null ? '—' : Number(x).toLocaleString('es-ES'));
const SUB = { "edicion-con-ia": "Edición con IA", "carruseles-con-ia": "Carruseles con IA", "agentes-y-setters-ia": "Agentes y setters con IA",
  automatizaciones: "Agentes y setters con IA", "claude-como-empleado": "Agentes y setters con IA", "avatar-y-video-ia": "Avatares y video con IA" };
const ORDEN_SUB = ["Edición con IA", "Carruseles con IA", "Agentes y setters con IA", "Avatares y video con IA", "IA en el negocio"];
const subDe = (f) => (f.sector === "IA" ? SUB[f.tema] || "IA en el negocio" : null);
// Un multiplicador sobre una ventana casi vacía (330 contra 4 = ×165) no dice nada: se muestra «×10 o más».
const veces = (x) => (x == null ? null : x >= 10 ? "×10 o más" : "×" + Number(x).toLocaleString("es-ES"));
const nombre = (f) => NOM[`${f.sector}|${f.tema}`] || (f.tema.startsWith('nuevo:') ? f.tema.slice(6) : f.tema);
const sectores = ORDEN.map((s) => {
  const filas = T.filas.filter((f) => f.sector === s).sort((a, b) => ORDEN_SUB.indexOf(subDe(a)) - ORDEN_SUB.indexOf(subDe(b)) || ESTADOS.indexOf(a.estado) - ESTADOS.indexOf(b.estado) || b.referentes - a.referentes || b.piezas - a.piezas);
  const refs = REF.referentes.filter((r) => r.sectores.some((x) => x === s || x.startsWith(`${s} ·`)));
  return {
    nombre: s, referentes: refs.length, piezas: filas.reduce((a, f) => a + f.piezas, 0),
    tendencias: filas.map((f) => {
      const u = USO[`${f.sector}|${f.tema}`] || {};
      return {
        id: `${f.sector}|${f.tema}`, nombre: nombre(f), subsector: subDe(f), estado: f.estado, llegaDelIngles: !!f.llegaDelIngles,
        senales: {
          referentes: f.referentes, referentesIngles: f.referentesIngles, piezas: f.piezas, piezas30: f.piezas30, piezas60: f.piezas60,
          ritmoPiezas: n0(f.ritmoPiezas), comentarios30: f.comentarios30, comentarios60: f.comentarios60, ritmoComentarios: n0(f.ritmoComentarios),
          comentariosPorMil: f.comentariosPorMil, comentariosPorMilSector: f.comentariosPorMilSector, conversacion: f.conversacion,
          pesoHaceUnAno: f.pesoHaceUnAno, pesoHoy: f.pesoHoy, primeraVez: f.primeraVez,
        },
        quienes: f.quienes, quienesIngles: f.quienesIngles, ctas: f.ctas,
        ejemplos: f.ejemplos.slice(0, 3),
        comoUsarla: u.gancho ? { gancho: u.gancho, cta: u.cta || null, porque: u.porque || null } : null,
        loQuePideLaGente: u.piden || [],
      };
    }),
  };
}).filter((s) => s.tendencias.length);
const json = {
  fecha: new Date().toISOString().slice(0, 10),
  metodo: {
    ventana: '90 días; cada cuenta se corta en su última medición',
    estados: {
      'Nuevo': 'aparece por primera vez en los últimos 60 días (contando el año anterior) y ya tiene 2 piezas o más en los últimos 30',
      'En crecimiento': 'los comentarios por día de los últimos 30 días son 1,3 veces o más los de los 60 anteriores, y se publica igual o más',
      'En baja': 'las piezas o los comentarios por día cayeron por debajo de 0,7 veces',
      'Saturado': 'se publica parejo y los comentarios no crecen: muchos lo dicen y ya no sorprende',
    },
    comentarios: 'sólo de piezas medidas con 7 días o más; cada pieza suma como mucho 5 veces la mediana de su cuenta',
  },
  sectores,
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/tendencias.json`, JSON.stringify(json, null, 1));

let md = `# Mapa de tendencias del mercado hispano de coaches, mentores e infoproductores\n\n${json.fecha}. ${REF.referentes.length} referentes en ${sectores.length} sectores, ${fmt(sectores.reduce((a, s) => a + s.piezas, 0))} piezas de los últimos 90 días.\n`;
md += `Lo mismo en datos: [tendencias.json](tendencias.json). Los referentes: [referentes.md](referentes.md). Cómo se mide: al final.\n`;
for (const s of sectores) {
  md += `\n## ${s.nombre}\n\n${s.referentes} referentes · ${fmt(s.piezas)} piezas\n\n| Tendencia | Estado | Señales | Cómo usarla |\n|---|---|---|---|\n`;
  for (const t of s.tendencias) {
    const x = t.senales;
    const sen = [`${x.referentes} referentes${x.referentesIngles ? ` (+${x.referentesIngles} en inglés)` : ''}`, `${x.piezas30} piezas en 30 días contra ${x.piezas60} en los 60 anteriores`,
      x.ritmoComentarios != null ? `comentarios ${veces(x.ritmoComentarios)}` : null, x.comentariosPorMil != null ? `${fmt(x.comentariosPorMil)} comentarios cada 1.000 vistas` : null,
      x.pesoHaceUnAno != null && x.pesoHoy != null ? `peso ${fmt(x.pesoHaceUnAno)} % → ${fmt(x.pesoHoy)} %` : null].filter(Boolean).join(' · ');
    const uso = t.comoUsarla ? `${t.comoUsarla.gancho}${t.comoUsarla.cta ? ` CTA: **${t.comoUsarla.cta}**` : ''}` : '—';
    md += `| ${t.subsector ? t.subsector + ": " : ""}**${t.nombre}**${t.llegaDelIngles ? ' (llega del inglés)' : ''} | ${t.estado} | ${sen} | ${uso} |\n`;
  }
  md += `\n**Ejemplos:**\n`;
  for (const t of s.tendencias) md += `- ${t.nombre}: ${t.ejemplos.map((e) => `[${e.referente}](${e.url}) (${fmt(e.comentarios)} comentarios)`).join(' · ')}\n`;
}
md += `\n## Cómo se mide\n\n${Object.entries(json.metodo.estados).map(([k, v]) => `- **${k}:** ${v}.`).join('\n')}\n- Comentarios: ${json.metodo.comentarios}.\n- Ventana: ${json.metodo.ventana}.\n`;
fs.writeFileSync(`${OUT}/mapa.md`, md);
console.log('tendencias.json y mapa.md:', sectores.map((s) => `${s.nombre} ${s.tendencias.length}`).join(' · '));
