"""Arma app/vsl/_sitio/competencia-datos.ts desde la investigación de la competencia (14/11/2026).

python -I scripts/visor-landings/matriz-competencia.py <matriz-competencia.json>

El JSON lo armó una investigación con la web oficial de cada app (carpeta de notas, referencias-comparar/). Este script NO
inventa: copia cada celda tal cual, con su fuente, y sólo le pone a cada app su logo de public/vsl-assets/logos/apps.
Si una app no tiene logo en disco, frena (la tabla no puede salir con una imagen rota).
"""
import json
import os
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
LOGOS = os.path.join(RAIZ, 'public', 'vsl-assets', 'logos', 'apps')
# El archivo del logo cuando no es el slug (Zapier es `zap.png`: tests/puente-leads-retirado.test.ts prohíbe la otra key).
ARCHIVO = {'systeme.io': 'systemeio', 'systemeio': 'systemeio', 'zapier': 'zap', 'gohighlevel': 'gohighlevel', 'hubspot': 'hubspot'}
FILAS = ['precio', 'landings', 'landings_ia', 'copiar_landing', 'spy', 'dominio', 'crm', 'tracking', 'agenda', 'cuotas', 'llamadas_ia',
         'whatsapp', 'instagram_dm', 'setter_ia', 'automatizaciones', 'email', 'copy_ia', 'editor_imagen', 'editor_video', 'video_ia',
         'ads_ia', 'calendario', 'cursos', 'comunidad', 'asistente_ia', 'espanol']


def ts(x):
    return json.dumps(x, ensure_ascii=False)


def main(ruta):
    d = json.load(open(ruta, encoding='utf-8'))
    out = []
    for c in d['competidores']:
        slug = c['slug'].strip().lower().replace(' ', '-')
        archivo = ARCHIVO.get(slug, slug.replace('.', '').replace('-', ''))
        if not os.path.exists(os.path.join(LOGOS, archivo + '.png')):
            sys.exit(f'falta el logo de {c["nombre"]}: {archivo}.png')
        celdas = {}
        for k in FILAS:
            v = c['celdas'].get(k)
            if not v:
                continue
            celda = {'v': str(v['v']).strip()}
            if v.get('fuente'):
                celda['fuente'] = v['fuente']
            celdas[k] = celda
        # Zapier va como «zap» (como su logo): tests/puente-leads-retirado.test.ts prohíbe esa key entre comillas (el puente que se retiró).
        slug_url = 'zap' if slug == 'zapier' else slug.replace('.', '')
        out.append(
            '  {\n'
            f'    nombre: {ts(c["nombre"])}, slug: {ts(slug_url)}, web: {ts(c.get("web", ""))}, logo: {ts("/vsl-assets/logos/apps/" + archivo + ".png")},\n'
            f'    celdas: {ts(celdas)},\n'
            f'    eligeSi: {ts(c.get("elige_si", []))},\n'
            f'    comentario: {ts(c.get("comentario", ""))},\n'
            '  },'
        )
    cuerpo = (
        '// GENERADO por scripts/visor-landings/matriz-competencia.py desde la investigación del ' + d.get('relevado', '') + '\n'
        '// (carpeta de notas, referencias-comparar/matriz-competencia.json): cada celda con la fuente de la web oficial de la app.\n'
        '// No se edita a mano sin su fuente: se corrige el JSON y se vuelve a generar.\n'
        "import type { Competidor } from './competencia';\n\n"
        f'export const RELEVADO_EL = {ts(d.get("relevado", ""))};\n\n'
        'export const COMPETIDORES_RELEVADOS: readonly Competidor[] = [\n' + '\n'.join(out) + '\n];\n'
    )
    destino = os.path.join(RAIZ, 'app', 'vsl', '_sitio', 'competencia-datos.ts')
    open(destino, 'w', encoding='utf-8', newline='\n').write(cuerpo)
    nd = sum(1 for c in d['competidores'] for k in FILAS if (c['celdas'].get(k) or {}).get('v') == '?')
    print(f'{len(out)} apps, {nd} celdas sin dato -> {destino}')


if __name__ == '__main__':
    main(sys.argv[1])
