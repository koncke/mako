import { resolve } from 'node:path'; import { config } from 'dotenv';
config({ path: resolve(process.cwd(), '.env.local') });
const oai = process.env.OPENAI_API_KEY;
// Construir un PDF mínimo VÁLIDO con texto, calculando offsets del xref.
const text = 'Contrato de servicios. Total del plan: 6000 USD. Duracion del servicio: 4 meses. Fecha de cierre: 15/03/2026. Inicio del servicio: 01/04/2026. Cuota 1: 1500 USD el 15/03/2026. Cuota 2: 1500 USD el 15/04/2026.';
const stream = `BT /F1 12 Tf 30 760 Td (${text}) Tj ET`;
const objs = [
  '<</Type/Catalog/Pages 2 0 R>>',
  '<</Type/Pages/Kids[3 0 R]/Count 1>>',
  '<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>',
  `<</Length ${stream.length}>>\nstream\n${stream}\nendstream`,
  '<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>',
];
let pdf = '%PDF-1.4\n'; const offsets = [];
objs.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
const xrefStart = pdf.length;
pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n`;
offsets.forEach((off) => { pdf += String(off).padStart(10, '0') + ' 00000 n \n'; });
pdf += `trailer\n<</Size ${objs.length + 1}/Root 1 0 R>>\nstartxref\n${xrefStart}\n%%EOF`;
const b64 = Buffer.from(pdf, 'latin1').toString('base64');

const prompt = 'Extrae el plan de pagos. Devuelve SOLO JSON: {"total_usd":number|null,"duracion_meses":number|null,"fecha_cierre":"dd/mm/aaaa"|null,"fecha_inicio":"dd/mm/aaaa"|null,"cuotas":[{"monto":number,"fecha":"dd/mm/aaaa"}]}';
const r = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST', headers: { Authorization: `Bearer ${oai}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ model: 'gpt-4o', temperature: 0, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'file', file: { filename: 'contrato.pdf', file_data: `data:application/pdf;base64,${b64}` } }] }] }),
});
const j = await r.json();
if (j.error) console.log('OPENAI ERROR:', j.error.message);
else console.log('RESULT:', j.choices?.[0]?.message?.content);
