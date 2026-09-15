// ==========================================
// Plantilla PDFMake - Observaciones de Calidad (EMP00001)
// ==========================================

export function generarDocDefinition(datos) {
    const esLevantada = datos.estado === 'Levantada';
    const colorEstado = esLevantada ? '#2563EB' : '#DC2626';

    // Construcción del bloque de imagen de Hallazgo
    let contenidoFotoHallazgo = { text: 'Sin registro fotográfico', alignment: 'center', italics: true, color: '#94A3B8', fontSize: 9, margin: [0, 30, 0, 0] };
    if (datos.fotoHallazgo) {
        contenidoFotoHallazgo = { image: datos.fotoHallazgo, fit: [230, 150], alignment: 'center' };
    }

    // Construcción del bloque de imagen de Solución
    let contenidoFotoLevantamiento = { text: esLevantada ? 'Sin registro fotográfico de solución' : 'Pendiente de ejecución', alignment: 'center', italics: true, color: '#94A3B8', fontSize: 9, margin: [0, 30, 0, 0] };
    if (datos.fotoLevantamiento) {
        contenidoFotoLevantamiento = { image: datos.fotoLevantamiento, fit: [230, 150], alignment: 'center' };
    }

    return {
        pageSize: 'A4',
        pageMargins: [30, 30, 30, 30],
        content: [
            // ENCABEZADO
            {
                table: {
                    widths: ['30%', '70%'],
                    body: [
                        [
                            datos.logo ? { image: datos.logo, fit: [120, 45], alignment: 'center' } : { text: datos.nombreEmpresa, bold: true, alignment: 'center', fontSize: 10 },
                            {
                                stack: [
                                    { text: 'REPORTE DE OBSERVACIÓN DE CALIDAD', fontSize: 12, bold: true, alignment: 'center', color: '#1E293B' },
                                    { text: datos.nombreProyecto.toUpperCase(), fontSize: 9, bold: true, alignment: 'center', color: '#2563EB', margin: [0, 2, 0, 0] }
                                ]
                            }
                        ]
                    ]
                },
                layout: {
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => '#CBD5E1',
                    vLineColor: () => '#CBD5E1'
                },
                margin: [0, 0, 0, 10]
            },

            // METADATOS TÉCNICOS
            {
                table: {
                    widths: ['60%', '40%'],
                    body: [
                        [
                            {
                                stack: [
                                    { text: [{ text: 'FRENTE / SECTOR: ', bold: true }, datos.frenteSector.toUpperCase()], fontSize: 8, margin: [0, 1, 0, 1] },
                                    { text: [{ text: 'UBICACIÓN ESPECÍFICA: ', bold: true }, datos.ubicacion.toUpperCase()], fontSize: 8, margin: [0, 1, 0, 1] },
                                    { text: [{ text: 'ESPECIALIDAD / TEMA: ', bold: true }, datos.especialidadTema.toUpperCase()], fontSize: 8, margin: [0, 1, 0, 1] },
                                    { text: [{ text: 'SUBCONTRATA RESPONSABLE: ', bold: true }, datos.responsable.toUpperCase()], fontSize: 8, margin: [0, 1, 0, 1] }
                                ]
                            },
                            {
                                fillBackgroundColor: '#F8FAFC',
                                stack: [
                                    { text: [{ text: 'N° REGISTRO: ', bold: true }, { text: datos.idObservacion, bold: true, color: '#1E3A8A' }], fontSize: 9, margin: [0, 1, 0, 1] },
                                    { text: [{ text: 'FECHA REPORTE: ', bold: true }, datos.fechaRegistro], fontSize: 8, margin: [0, 1, 0, 1] },
                                    { text: [{ text: 'ESTADO: ', bold: true }, { text: datos.estado.toUpperCase(), bold: true, color: colorEstado }], fontSize: 8, margin: [0, 1, 0, 1] },
                                    { text: [{ text: 'GRAVEDAD: ', bold: true }, datos.gravedad.toUpperCase()], fontSize: 8, margin: [0, 1, 0, 1] }
                                ]
                            }
                        ]
                    ]
                },
                layout: {
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => '#94A3B8',
                    vLineColor: () => '#94A3B8'
                },
                margin: [0, 0, 0, 12]
            },

            // BLOQUE 1: HALLAZGO
            {
                table: {
                    widths: ['100%'],
                    body: [[{ text: '1. DESCRIPCIÓN DEL HALLAZGO', bold: true, fontSize: 9, color: '#FFFFFF', fillColor: '#DC2626' }]]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 5]
            },
            {
                table: {
                    widths: ['50%', '50%'],
                    body: [
                        [
                            {
                                stack: [
                                    { text: datos.descripcionHallazgo, fontSize: 8, alignment: 'justify', margin: [0, 0, 0, 10] },
                                    { text: [{ text: 'Fecha Límite de Cierre: ', bold: true, color: '#991B1B' }, datos.fechaLimite], fontSize: 8 }
                                ]
                            },
                            contenidoFotoHallazgo
                        ]
                    ]
                },
                layout: {
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => '#E2E8F0',
                    vLineColor: () => '#E2E8F0'
                },
                margin: [0, 0, 0, 12]
            },

            // BLOQUE 2: ACCIÓN CORRECTIVA Y LEVANTAMIENTO
            {
                table: {
                    widths: ['100%'],
                    body: [[{ text: '2. ACCIÓN CORRECTIVA Y LEVANTAMIENTO', bold: true, fontSize: 9, color: '#FFFFFF', fillColor: '#16A34A' }]]
                },
                layout: 'noBorders',
                margin: [0, 0, 0, 5]
            },
            {
                table: {
                    widths: ['50%', '50%'],
                    body: [
                        [
                            {
                                stack: esLevantada ? [
                                    { text: datos.descripcionLevantamiento, fontSize: 8, alignment: 'justify', margin: [0, 0, 0, 10] },
                                    { text: [{ text: 'Fecha de Cierre: ', bold: true, color: '#166534' }, datos.fechaLevantamiento], fontSize: 8, margin: [0, 1, 0, 1] },
                                    { text: [{ text: 'Validado por: ', bold: true, color: '#166534' }, datos.validadoPor.toUpperCase()], fontSize: 8, margin: [0, 1, 0, 1] }
                                ] : [
                                    { text: 'Aún no se ha registrado la acción correctiva (Pendiente de ejecución).', fontSize: 8, italics: true, color: '#64748B' }
                                ]
                            },
                            contenidoFotoLevantamiento
                        ]
                    ]
                },
                layout: {
                    hLineWidth: () => 1,
                    vLineWidth: () => 1,
                    hLineColor: () => '#E2E8F0',
                    vLineColor: () => '#E2E8F0'
                }
            }
        ]
    };
}