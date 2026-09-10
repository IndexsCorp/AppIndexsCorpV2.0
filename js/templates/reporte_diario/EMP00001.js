/**
 * Plantilla PDFMake para EMP00001 (Haelservice)
 * Manejo dinámico de membretes en saltos de página de texto y fotos
 */
export function generarDocDefinition(datos) {
    // 1. Estructura de Encabezado (Encabezado Azul)
    const crearHeader = () => ({
        table: {
            widths: ['30%', '70%'],
            body: [[
                datos.logo 
                    ? { image: datos.logo, fit: [110, 35], alignment: 'center', margin: [0, 2, 0, 2] } 
                    : { text: datos.nombreEmpresa || '', color: 'white', bold: true, fontSize: 12, alignment: 'center', margin: [0, 8, 0, 0] },
                {
                    stack: [
                        { text: 'REPORTE DIARIO DE AVANCE DE OBRA', fontSize: 10, bold: true, color: '#FFFFFF', alignment: 'center' },
                        { text: 'PROYECTO', fontSize: 7, bold: true, color: '#85B648', alignment: 'center', margin: [0, 1, 0, 0] },
                        { text: (datos.nombreProyecto || '').toUpperCase(), fontSize: 9, bold: true, color: '#FFFFFF', alignment: 'center' }
                    ],
                    margin: [0, 2, 0, 2]
                }
            ]]
        },
        layout: { fillColor: () => '#233D5C', hLineWidth: () => 0, vLineWidth: () => 0 },
        margin: [0, 0, 0, 3]
    });

    // 2. Estructura de Metadatos (Cuadro de Cliente / Fecha)
    const crearMetadata = () => ({
        table: {
            widths: ['65%', '35%'],
            body: [[
                {
                    stack: [
                        { text: [{ text: 'CLIENTE: ', bold: true }, (datos.cliente || '').toUpperCase()] },
                        { text: [{ text: 'CONTRATISTA: ', bold: true }, (datos.contratista || '').toUpperCase()] },
                        { text: [{ text: 'ELABORADO POR: ', bold: true }, (datos.elaboradoPor || '').toUpperCase()] }
                    ],
                    fontSize: 8, margin: [2, 2, 2, 2]
                },
                {
                    stack: [
                        { text: [{ text: 'FECHA: ', bold: true }, datos.fecha] },
                        { text: [{ text: 'N° REGISTRO: ', bold: true }, { text: datos.correlativo, color: '#DC2626', bold: true }] }
                    ],
                    fontSize: 8, margin: [2, 2, 2, 2]
                }
            ]]
        },
        layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#1E293B', vLineColor: () => '#1E293B' },
        margin: [0, 0, 0, 0]
    });

    const makeSectionTitle = (title) => ({
        table: {
            widths: ['*'],
            body: [[{ text: title.toUpperCase(), fontSize: 8, bold: true, color: '#233D5C' }]]
        },
        layout: { fillColor: () => '#E2E8F0', hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 3 : 0), vLineColor: () => '#233D5C' },
        margin: [0, 4, 0, 4]
    });

    // 3. Bloque de Contenido de Texto (Actividades, Personal, Anotaciones)
    const docContent = [
        makeSectionTitle('1. Actividades Realizadas'),
        datos.listaActividades.length > 0 ? { ul: datos.listaActividades, margin: [10, 0, 0, 5] } : { text: 'Sin actividades registradas.', fontSize: 8, italic: true },
        makeSectionTitle('2. Distribución de Personal y Frentes de Trabajo'),
        {
            table: { widths: [25, '*', '*', 60], body: datos.bodyPersonal },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#1E293B', vLineColor: () => '#1E293B' },
            margin: [0, 2, 0, 5]
        },
        makeSectionTitle('3. Anotaciones del Día / Observaciones'),
        datos.listaAnotaciones.length > 0 ? { ul: datos.listaAnotaciones, margin: [10, 0, 0, 5] } : { text: 'Sin anotaciones registradas.', fontSize: 8, italic: true }
    ];

    // 4. Bloque de Fotos (Estricto 6 por página, inicia en página independiente)
    const FOTOS_POR_PAGINA = 6;
    for (let offset = 0; offset < datos.fotosProcesadas.length; offset += FOTOS_POR_PAGINA) {
        const bloqueFotos = datos.fotosProcesadas.slice(offset, offset + FOTOS_POR_PAGINA);

        docContent.push({ text: '', pageBreak: 'before' });
        docContent.push(makeSectionTitle('Registro Fotográfico y Actividades de Obra'));

        const photoColumns = [];
        for (let i = 0; i < bloqueFotos.length; i += 2) {
            const f1 = bloqueFotos[i];
            const f2 = bloqueFotos[i + 1];
            const numIndex1 = offset + i + 1;
            const numIndex2 = offset + i + 2;

            const rowCols = [
                {
                    stack: [{
                        table: { widths: ['*'], body: [
                            [{ image: f1.base64, fit: [260, 160], alignment: 'center', margin: [0, 2, 0, 2] }],
                            [{ text: `${numIndex1}. ${f1.texto}`, fontSize: 8, bold: true, alignment: 'center', margin: [2, 3, 2, 3], fillColor: '#F8FAFC' }]
                        ]},
                        layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#1E293B', vLineColor: () => '#1E293B' }
                    }], width: '50%'
                }
            ];

            if (f2) {
                rowCols.push({
                    stack: [{
                        table: { widths: ['*'], body: [
                            [{ image: f2.base64, fit: [260, 160], alignment: 'center', margin: [0, 2, 0, 2] }],
                            [{ text: `${numIndex2}. ${f2.texto}`, fontSize: 8, bold: true, alignment: 'center', margin: [2, 3, 2, 3], fillColor: '#F8FAFC' }]
                        ]},
                        layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#1E293B', vLineColor: () => '#1E293B' }
                    }], width: '50%'
                });
            } else {
                rowCols.push({ text: '', width: '50%' });
            }
            photoColumns.push({ columns: rowCols, columnGap: 12, margin: [0, 0, 0, 8] });
        }
        docContent.push(...photoColumns);
    }

    // 5. Definición final del documento con encabezado global
    return {
        pageSize: 'A4',
        pageMargins: [25, 95, 25, 20], // Margen superior de 95pt reservado para el membrete
        header: function(currentPage, pageCount) {
            return {
                margin: [25, 12, 25, 0],
                stack: [
                    crearHeader(),
                    crearMetadata()
                ]
            };
        },
        content: docContent
    };
}