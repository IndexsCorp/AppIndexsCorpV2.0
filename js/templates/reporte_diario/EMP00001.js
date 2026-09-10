/**
 * Plantilla PDFMake para EMP00001 (Haelservice)
 * Repetición garantizada de títulos de sección en saltos de página
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

    // Función que transforma cada ítem en una FILA INDEPENDIENTE para forzar la repetición del título
    const crearTablaLista = (titulo, listaItems, textoVacio) => {
        const body = [
            [{ text: titulo.toUpperCase(), fontSize: 8, bold: true, color: '#233D5C', fillColor: '#E2E8F0' }]
        ];

        if (listaItems && listaItems.length > 0) {
            listaItems.forEach(item => {
                body.push([{ ul: [item], margin: [5, 1, 5, 1] }]);
            });
        } else {
            body.push([{ text: textoVacio, fontSize: 8, italic: true, margin: [5, 2, 5, 2] }]);
        }

        return {
            table: {
                headerRows: 1, // Obliga a PDFMake a repetir la Fila 0 (Título) en caso de salto de página
                dontBreakRows: true, // Evita que una sola viñeta se corte feo a la mitad
                widths: ['*'],
                body: body
            },
            layout: {
                hLineWidth: () => 0,
                vLineWidth: (i) => (i === 0 ? 3 : 0),
                vLineColor: () => '#233D5C'
            },
            margin: [0, 4, 0, 4]
        };
    };

    // Estructura de Personal con título integrado como Fila 0
    const bodyPersonalConTitulo = [
        [{ text: '2. DISTRIBUCIÓN DE PERSONAL Y FRENTES DE TRABAJO', colSpan: 4, fontSize: 8, bold: true, color: '#233D5C', fillColor: '#E2E8F0', margin: [2, 2, 2, 2] }, {}, {}, {}],
        ...(datos.bodyPersonal || [])
    ];

    // 3. Contenido Principal de Texto
    const docContent = [
        // Sección 1: Actividades
        crearTablaLista('1. Actividades Realizadas', datos.listaActividades, 'Sin actividades registradas.'),

        // Sección 2: Personal (Repite título y cabecera de columnas N°/Rubro si se corta)
        {
            table: {
                headerRows: 2, // Repite Fila 0 (Título) y Fila 1 (N°, RUBRO, SECTOR, CANTIDAD)
                dontBreakRows: true,
                widths: [25, '*', '*', 60],
                body: bodyPersonalConTitulo
            },
            layout: {
                hLineWidth: () => 1,
                vLineWidth: (i) => (i === 0 ? 3 : 1),
                hLineColor: () => '#1E293B',
                vLineColor: (i) => (i === 0 ? '#233D5C' : '#1E293B')
            },
            margin: [0, 4, 0, 4]
        },

        // Sección 3: Anotaciones
        crearTablaLista('3. Anotaciones del Día / Observaciones', datos.listaAnotaciones, 'Sin anotaciones registradas.')
    ];

    // 4. Bloque de Fotos (Estricto 6 por página)
    const FOTOS_POR_PAGINA = 6;
    for (let offset = 0; offset < datos.fotosProcesadas.length; offset += FOTOS_POR_PAGINA) {
        const bloqueFotos = datos.fotosProcesadas.slice(offset, offset + FOTOS_POR_PAGINA);

        docContent.push({ text: '', pageBreak: 'before' });

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

        docContent.push({
            table: {
                headerRows: 1,
                widths: ['*'],
                body: [
                    [{ text: 'REGISTRO FOTOGRÁFICO Y ACTIVIDADES DE OBRA', fontSize: 8, bold: true, color: '#233D5C', fillColor: '#E2E8F0' }],
                    [{ stack: photoColumns, margin: [0, 2, 0, 2] }]
                ]
            },
            layout: {
                hLineWidth: () => 0,
                vLineWidth: (i) => (i === 0 ? 3 : 0),
                vLineColor: () => '#233D5C'
            },
            margin: [0, 4, 0, 4]
        });
    }

    // 5. Definición final con membrete global
    return {
        pageSize: 'A4',
        pageMargins: [25, 95, 25, 20],
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