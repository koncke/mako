// De tabla.json (analizar.mjs) + nombres.json + como-usarla.json a los dos entregables (lo visible dice «ÁNGULOS», Martín 21/11):
//   docs/tendencias/angulos.json  (lo lee la pestaña «Ángulos» de Content Machine: ranking + datos del gráfico de burbujas)
//   docs/tendencias/mapa.md       (lo mismo, para leer)
// Uso: node generar.mjs <carpeta docs/tendencias del worktree>
import fs from 'node:fs';
const DIR = 'C:/dev/tendencias';
const OUT = process.argv[2] || 'C:/dev/wt-tendencias/docs/tendencias';
const T = JSON.parse(fs.readFileSync(`${DIR}/tabla.json`, 'utf8'));
const NOM = JSON.parse(fs.readFileSync(`${DIR}/nombres.json`, 'utf8'));
const USO = fs.existsSync(`${DIR}/como-usarla.json`) ? JSON.parse(fs.readFileSync(`${DIR}/como-usarla.json`, 'utf8')) : {};
const REF = JSON.parse(fs.readFileSync(`${DIR}/referentes.json`, 'utf8'));
const ORDEN = ['Anuncios', 'IA', 'Closing y ventas', 'YouTube', 'High ticket', 'Low ticket', 'Orgánico de nicho', 'Orgánico viral', 'Operaciones', 'Mentalidad y coaching', 'Lifestyle'];
const SUB = { 'edicion-con-ia': 'Edición con IA', 'carruseles-con-ia': 'Carruseles con IA', 'agentes-y-setters-ia': 'Agentes y setters con IA',
  automatizaciones: 'Agentes y setters con IA', 'claude-como-empleado': 'Agentes y setters con IA', 'avatar-y-video-ia': 'Avatares y video con IA' };
const subDe = (f) => (f.sector === 'IA' ? SUB[f.tema] || 'IA en el negocio' : null);
const fmt = (x) => (x == null ? '—' : Number(x).toLocaleString('es-ES'));
const veces = (x) => (x == null ? null : x >= 10 ? '×10 o más' : `×${fmt(x)}`);
const nombre = (f) => NOM[`${f.sector}|${f.tema}`] || (f.tema.startsWith('nuevo:') ? f.tema.slice(6) : f.tema);

const sectores = ORDEN.map((s) => {
  const filas = T.filas.filter((f) => f.sector === s).sort((a, b) => (b.puntaje ?? -1) - (a.puntaje ?? -1) || b.contagio - a.contagio);
  const refs = REF.referentes.filter((r) => r.sectores.some((x) => x === s || x.startsWith(`${s} ·`)));
  const angulos = filas.map((f, i) => {
    const u = USO[`${f.sector}|${f.tema}`] || {};
    return {
      id: `${f.sector}|${f.tema}`, puesto: i + 1, nombre: nombre(f), subsector: subDe(f), estado: f.estado, puntaje: f.puntaje, llegaDelIngles: !!f.llegaDelIngles,
      senales: {
        insistencia: { porcentaje: f.insistencia, quien: f.insisteQuien, piezas: f.insistePiezas, deSusPiezas: f.insisteDe, referentesQueInsisten: f.referentesQueInsisten },
        interaccion: { comentariosPorMil: f.comentariosPorMil, comentariosPorMilDelSector: f.comentariosPorMilSector, meGustaPorMil: f.meGustaPorMil,
          compartidosPorMil: null, guardadosPorMil: null, conversacion: f.conversacion },
        contagio: { referentes: f.contagio, quienes: f.quienes, enIngles: f.quienesIngles },
        crecimiento: { piezas30: f.piezas30, piezas60: f.piezas60, ritmoPiezas: f.ritmoPiezas, comentarios30: f.comentarios30, comentarios60: f.comentarios60,
          ritmoComentarios: f.ritmoComentarios, enElAno: f.anual, pesoHaceUnAno: f.pesoHaceUnAno, pesoHoy: f.pesoHoy, primeraVez: f.primeraVez },
      },
      piezas: f.piezas, ctas: f.ctas, ejemplos: f.ejemplos.slice(0, 3),
      comoUsarla: u.gancho ? { gancho: u.gancho, cta: u.cta || null, porque: u.porque || null } : null,
      loQuePideLaGente: u.piden || [],
    };
  });
  return {
    nombre: s, referentes: refs.length, piezas: filas.reduce((a, f) => a + f.piezas, 0), angulos,
    // El gráfico de burbujas (Martín): X = contagio, Y = interacción cada 1.000 vistas, tamaño = piezas, color = estado.
    grafico: angulos.filter((a) => !a.llegaDelIngles).map((a) => ({ id: a.id, nombre: a.nombre, x: a.senales.contagio.referentes,
      y: a.senales.interaccion.comentariosPorMil, r: a.piezas, estado: a.estado, puntaje: a.puntaje })),
  };
}).filter((s) => s.angulos.length);

const json = {
  fecha: new Date().toISOString().slice(0, 10),
  referentes: REF.referentes.length,
  metodo: {
    senales: {
      insistencia: 'la mayor parte de lo que publica un mismo referente que va a este ángulo (contada con 3 piezas o más): si insiste, le funciona',
      interaccion: 'mediana de comentarios cada 1.000 vistas (piezas con 500 vistas o más y medidas con 7 días o más). Compartidos y guardados: no vienen en lo que se baja (Instagram muestra los compartidos en la app, los guardados casi nunca)',
      contagio: 'cuántos referentes distintos lo tratan en 90 días',
      crecimiento: 'piezas y comentarios por día de los últimos 30 días contra los 60 anteriores; y el peso del ángulo hace un año contra hoy, entre las mismas cuentas',
    },
    puntaje: 'de 0 a 100: el percentil del ángulo dentro de su sector en contagio, en interacción y en insistencia, promediados (si no hay vistas, las otras dos)',
    estados: {
      'Nuevo': 'aparece por primera vez en los últimos 60 días (contando el año anterior) y ya tiene 2 piezas o más en los últimos 30',
      'En crecimiento': 'los comentarios por día de los últimos 30 días son 1,3 veces o más los de los 60 anteriores, y se publica igual o más',
      'En baja': 'las piezas o los comentarios por día cayeron por debajo de 0,7 veces',
      'Saturado': 'se publica parejo y los comentarios no crecen: muchos lo dicen y ya no sorprende',
      'desempate': 'si los 30 días no dicen nada claro, decide el año: el peso del ángulo entre las mismas cuentas se duplicó (crece) o se partió a la mitad (baja)',
    },
    ventana: '90 días; cada cuenta se corta en su última medición',
  },
  sectores,
};
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(`${OUT}/angulos.json`, JSON.stringify(json, null, 1));

let md = `# Ángulos ganadores del mercado hispano de coaches, mentores e infoproductores\n\n${json.fecha} · ${json.referentes} referentes · ${sectores.length} sectores · ${fmt(sectores.reduce((a, s) => a + s.piezas, 0))} piezas de los últimos 90 días.\n`;
md += `Los datos (con el gráfico de cada sector): [angulos.json](angulos.json). Los referentes: [referentes.md](referentes.md). Cómo se mide: al final.\n`;
md += `\n**Cómo leer cada ángulo:** puntaje de 0 a 100 · **insistencia** (cuánto de lo suyo le dedica el referente que más insiste) · **interacción** (comentarios cada 1.000 vistas) · **contagio** (cuántos referentes lo tratan) · crecimiento (30 días contra los 60 anteriores).\n`;
for (const s of sectores) {
  md += `\n## ${s.nombre}\n\n${s.referentes} referentes · ${fmt(s.piezas)} piezas\n\n| # | Ángulo | Estado | Puntaje | Insistencia | Interacción | Contagio | Crecimiento | Cómo usarlo |\n|---|---|---|---|---|---|---|---|---|\n`;
  for (const a of s.angulos) {
    const x = a.senales;
    const ins = x.insistencia.quien ? `${x.insistencia.porcentaje} % (${x.insistencia.quien}: ${x.insistencia.piezas} de ${x.insistencia.deSusPiezas})` : '—';
    const inter = x.interaccion.comentariosPorMil != null ? `${fmt(x.interaccion.comentariosPorMil)} c/1.000 (sector ${fmt(x.interaccion.comentariosPorMilDelSector)})` : '—';
    const cre = [`${x.crecimiento.piezas30} contra ${x.crecimiento.piezas60} piezas`, x.crecimiento.ritmoComentarios != null ? `comentarios ${veces(x.crecimiento.ritmoComentarios)}` : null,
      x.crecimiento.pesoHaceUnAno != null && x.crecimiento.pesoHoy != null ? `año: ${fmt(x.crecimiento.pesoHaceUnAno)} % → ${fmt(x.crecimiento.pesoHoy)} %` : null].filter(Boolean).join(' · ');
    const uso = a.comoUsarla ? `${a.comoUsarla.gancho}${a.comoUsarla.cta ? ` CTA: **${a.comoUsarla.cta}**` : ''}` : '—';
    md += `| ${a.puesto} | ${a.subsector ? `${a.subsector}: ` : ''}**${a.nombre}**${a.llegaDelIngles ? ' (llega del inglés)' : ''} | ${a.estado} | ${a.puntaje ?? '—'} | ${ins} | ${inter} | ${x.contagio.referentes}${x.contagio.enIngles?.length ? ` (+${x.contagio.enIngles.length} en inglés)` : ''} | ${cre} | ${uso} |\n`;
  }
  md += `\n**Ejemplos:**\n`;
  for (const a of s.angulos) md += `- ${a.nombre}: ${a.ejemplos.map((e) => `[${e.referente}](${e.url}) (${fmt(e.comentarios)} comentarios)`).join(' · ')}\n`;
}
md += `\n## Cómo se mide\n\n${Object.entries(json.metodo.senales).map(([k, v]) => `- **${k[0].toUpperCase() + k.slice(1)}:** ${v}.`).join('\n')}\n- **Puntaje:** ${json.metodo.puntaje}.\n${Object.entries(json.metodo.estados).map(([k, v]) => `- **${k}:** ${v}.`).join('\n')}\n- **Ventana:** ${json.metodo.ventana}.\n`;
fs.writeFileSync(`${OUT}/mapa.md`, md);
console.log('angulos.json y mapa.md:', sectores.map((s) => `${s.nombre} ${s.angulos.length}`).join(' · '));
