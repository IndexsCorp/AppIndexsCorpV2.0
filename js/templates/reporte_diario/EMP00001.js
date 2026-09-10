/**
 * Plantilla PDFMake para EMP00001 (Haelservice)
 */
export function generarDocDefinition(datos) {
    const crearHeader = () => ({
        table: {
            widths: ['30%', '70%'],
            body: [[
                datos.logo ? { image: datos.logo, fit: [110, 40], alignment: 'center', margin: [0, 2, 0, 2] } : { text: datos.nombreEmpresa || '', color: 'white', bold: true, fontSize: 14, alignment: 'center', margin: [0, 10, 0, 0] },
                {
                    stack: [
                        { text: 'REPORTE DIARIO DE AVANCE DE OBRA', fontSize: 11, bold: true, color: '#FFFFFF', alignment: 'center' },
                        { text: 'PROYECTO', fontSize: 8, bold: true, color: '#85B648', alignment: 'center', margin: [0, 1, 0, 0] },
                        { text: (datos.nombreProyecto || '').toUpperCase(), fontSize: 10, bold: true, color: '#FFFFFF', alignment: 'center' }
                    ],
                    margin: [0, 3, 0, 3]
                }
            ]]
        },
        layout: { fillColor: () => '#233D5C', hLineWidth: () => 0, vLineWidth: () => 0 },
        margin: [0, 0, 0, 4]
    });

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
        margin: [0, 0, 0, 8]
    });

    const makeSectionTitle = (title) => ({
        table: {
            widths: ['*'],
            body: [[{ text: title.toUpperCase(), fontSize: 8, bold: true, color: '#233D5C' }]]
        },
        layout: { fillColor: () => '#E2E8F0', hLineWidth: () => 0, vLineWidth: (i) => (i === 0 ? 3 : 0), vLineColor: () => '#233D5C' },
        margin: [0, 4, 0, 4]
    });

    const docContent = [
        crearHeader(),
        crearMetadata(),
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

    if (datos.fotosProcesadas.length > 0) {
        docContent.push({ text: '', pageBreak: 'before' });
        docContent.push(crearHeader());
        docContent.push(crearMetadata());
        docContent.push(makeSectionTitle('Registro Fotográfico y Actividades de Obra'));

        const photoColumns = [];
        for (let i = 0; i < datos.fotosProcesadas.length; i += 2) {
            const f1 = datos.fotosProcesadas[i];
            const f2 = datos.fotosProcesadas[i + 1];

            const rowCols = [
                {
                    stack: [{
                        table: { widths: ['*'], body: [
                            [{ image: f1.base64, fit: [265, 175], alignment: 'center', margin: [0, 4, 0, 4] }],
                            [{ text: `${i + 1}. ${f1.texto}`, fontSize: 9, bold: true, alignment: 'center', margin: [2, 4, 2, 4], fillColor: '#F8FAFC' }]
                        ]},
                        layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#1E293B', vLineColor: () => '#1E293B' }
                    }], width: '50%'
                }
            ];

            if (f2) {
                rowCols.push({
                    stack: [{
                        table: { widths: ['*'], body: [
                            [{ image: f2.base64, fit: [265, 175], alignment: 'center', margin: [0, 4, 0, 4] }],
                            [{ text: `${i + 2}. ${f2.texto}`, fontSize: 9, bold: true, alignment: 'center', margin: [2, 4, 2, 4], fillColor: '#F8FAFC' }]
                        ]},
                        layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => '#1E293B', vLineColor: () => '#1E293B' }
                    }], width: '50%'
                });
            } else {
                rowCols.push({ text: '', width: '50%' });
            }
            photoColumns.push({ columns: rowCols, columnGap: 14, margin: [0, 0, 0, 12] });
        }
        docContent.push(...photoColumns);
    }

    return {
        pageSize: 'A4',
        pageMargins: [25, 25, 25, 25],
        content: docContent
    };
}