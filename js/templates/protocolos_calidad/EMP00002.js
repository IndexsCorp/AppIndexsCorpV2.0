/**
 * Plantilla Maestra pdfMake - PROTOCOLOS DE CALIDAD
 * Archivo: PLANTILLA_GENERICA.js
 */

export function generarDocDefinition(datos) {
    
    // ==========================================
    // CONFIGURACIÓN DE TEMA CORPORATIVO
    // ==========================================
    const TEMA = {
        colorPrimario: '#1E293B',    // Azul marino oscuro (Textos principales)
        colorTitulos: '#336A94',     // Azul corporativo (Titulos de secciones)
        fondoCabecera: '#F8FAFC',    // Gris muy claro (Fondo de tablas)
        lineaBordes: '#CBD5E1',      // Gris intermedio (Bordes de tablas)
        textoGris: '#64748B'         // Gris oscuro (Etiquetas)
    };

    // ==========================================
    // HEADER: LOGO Y TÍTULO DEL PROTOCOLO
    // ==========================================
    const crearCabeceraDocumento = () => {
        return {
            table: {
                widths: ['25%', '75%'],
                body: [[
                    // Columna Logo
                    datos.logo 
                        ? { image: datos.logo, fit: [120, 50], alignment: 'center', margin: [0, 5, 0, 5] } 
                        : { text: datos.proyecto.contratista, color: TEMA.colorPrimario, bold: true, fontSize: 10, alignment: 'center', margin: [0, 15, 0, 0] },
                    // Columna Títulos
                    {
                        stack: [
                            { text: datos.protocolo.codigo_visible.toUpperCase(), fontSize: 14, bold: true, color: TEMA.colorPrimario, alignment: 'center', margin: [0, 5, 0, 3] },
                            { text: `PROYECTO: ${datos.proyecto.nombre.toUpperCase()}`, fontSize: 9, bold: true, color: TEMA.textoGris, alignment: 'center' }
                        ],
                        margin: [0, 2, 0, 2]
                    }
                ]]
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
            margin: [0, 0, 0, 10]
        };
    };

    // ==========================================
    // BLOQUE 1: DATOS GENERALES DEL PROYECTO
    // ==========================================
    const crearDatosProyecto = () => {
        return {
            table: {
                widths: ['15%', '35%', '15%', '35%'],
                body: [
                    [
                        { text: 'CLIENTE:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: datos.proyecto.cliente, fontSize: 8 },
                        { text: 'SUPERVISIÓN:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: datos.proyecto.supervision, fontSize: 8 }
                    ],
                    [
                        { text: 'CONTRATISTA:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: datos.proyecto.contratista, fontSize: 8, colSpan: 3 },
                        {}, {}
                    ]
                ]
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
            margin: [0, 0, 0, 5]
        };
    };

    // ==========================================
    // BLOQUE 2: DATOS DEL PROTOCOLO DE INSPECCIÓN
    // ==========================================
    const crearDatosInspeccion = () => {
        return {
            table: {
                widths: ['20%', '30%', '15%', '35%'],
                body: [
                    [
                        { text: 'FECHA:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: datos.protocolo.fecha_inspeccion, fontSize: 8 },
                        { text: 'CORRELATIVO:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: `N° ${datos.protocolo.correlativo}`, fontSize: 8, bold: true, color: '#DC2626' }
                    ],
                    [
                        { text: 'FRENTE / SECTOR:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: `${datos.protocolo.frente} / ${datos.protocolo.sector}`, fontSize: 8 },
                        { text: 'UBICACIÓN (EJES):', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: datos.protocolo.ubicacion_ejes, fontSize: 8 }
                    ],
                    [
                        { text: 'PLANO REFERENCIA:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: datos.protocolo.plano_referencia, fontSize: 8 },
                        { text: 'ELEMENTO:', bold: true, fontSize: 8, color: TEMA.textoGris, fillColor: TEMA.fondoCabecera },
                        { text: datos.protocolo.elemento_liberar, fontSize: 8, bold: true }
                    ]
                ]
            },
            layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
            margin: [0, 0, 0, 15]
        };
    };

    // ==========================================
    // CUERPO DEL DOCUMENTO
    // ==========================================
    const docContent = [];
    
    // Inyectamos el bloque de cabecera que hicimos arriba
    docContent.push(crearCabeceraDocumento());
    docContent.push(crearDatosProyecto());
    docContent.push(crearDatosInspeccion());

    // ==========================================
    // BLOQUE 3: DIBUJAR LOS CHECKLISTS DINÁMICOS
    // ==========================================
    
    if (datos.checklists && datos.checklists.length > 0) {
        datos.checklists.forEach((seccion, indexSeccion) => {
            
            // Título de la sección
            docContent.push({
                text: `${indexSeccion + 1}. ${seccion.titulo.toUpperCase()}`,
                fontSize: 10,
                bold: true,
                color: TEMA.colorTitulos,
                margin: [0, 5, 0, 5]
            });

            // Cabecera de la tabla de checklist
            const tablaChecklistBody = [
                [
                    { text: 'ÍTEM', bold: true, fontSize: 8, alignment: 'center', fillColor: TEMA.fondoCabecera },
                    { text: 'DESCRIPCIÓN DE LA ACTIVIDAD', bold: true, fontSize: 8, fillColor: TEMA.fondoCabecera },
                    { text: 'SÍ', bold: true, fontSize: 8, alignment: 'center', fillColor: TEMA.fondoCabecera },
                    { text: 'NO', bold: true, fontSize: 8, alignment: 'center', fillColor: TEMA.fondoCabecera },
                    { text: 'N/A', bold: true, fontSize: 8, alignment: 'center', fillColor: TEMA.fondoCabecera }
                ]
            ];

            // Rellenar las filas con los criterios de inspección
            if (seccion.items && seccion.items.length > 0) {
                seccion.items.forEach((item, itemIndex) => {
                    tablaChecklistBody.push([
                        { text: itemIndex + 1, fontSize: 8, alignment: 'center', color: TEMA.textoGris },
                        { 
                            stack: [
                                { text: item.descripcion || item, fontSize: 8 },
                                (item.traza && item.traza.usuario) 
                                    ? { text: `Editado por ${item.traza.usuario} (${new Date(item.traza.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})})`, fontSize: 6, italics: true, color: '#64748B', margin: [0, 2, 0, 0] } 
                                    : {}
                            ]
                        },
                        { text: item.estado === 'SI' ? 'X' : '', bold: true, alignment: 'center' },
                        { text: item.estado === 'NO' ? 'X' : '', bold: true, alignment: 'center' },
                        { text: item.estado === 'NA' ? 'X' : '', bold: true, alignment: 'center' }
                    ]);
                });
            } else {
                tablaChecklistBody.push([{ text: 'No hay criterios registrados en esta fase.', colSpan: 5, italic: true, fontSize: 8, alignment: 'center', color: TEMA.textoGris }, {}, {}, {}, {}]);
            }

            // Inyectar la tabla en el documento
            docContent.push({
                table: {
                    headerRows: 1,
                    widths: ['8%', '74%', '6%', '6%', '6%'],
                    body: tablaChecklistBody
                },
                layout: { hLineWidth: () => 1, vLineWidth: () => 1, hLineColor: () => TEMA.lineaBordes, vLineColor: () => TEMA.lineaBordes },
                margin: [0, 0, 0, 5]
            });

            // Inyectar anotaciones si existen en esa sección
            if (seccion.observaciones && seccion.observaciones.length > 0) {
                const obsList = seccion.observaciones.map(o => `• [${o.tipo}] ${o.texto}`).join('\n');
                docContent.push({
                    text: `Anotaciones: \n${obsList}`,
                    fontSize: 8,
                    italics: true,
                    color: TEMA.textoGris,
                    margin: [20, 0, 0, 10]
                });
            } else {
                docContent.push({ text: '', margin: [0, 0, 0, 10] }); // Espacio vacío
            }
        });
    } else {
        docContent.push({
            text: "No se encontró estructura de checklist para este protocolo.",
            fontSize: 9,
            italic: true,
            alignment: 'center',
            color: '#DC2626',
            margin: [0, 20, 0, 20]
        });
    }

    // ==========================================
    // BLOQUE 4: FIRMAS DIGITALES
    // ==========================================
    const renderFirma = (firmaObjeto, tituloLabel) => {
        if (!firmaObjeto || !firmaObjeto.nombre) {
            return { stack: [{ text: '_______________________', alignment: 'center', margin: [0, 30, 0, 5], color: TEMA.lineaBordes }, { text: tituloLabel, alignment: 'center', fontSize: 7, bold: true, color: TEMA.colorTitulos }] };
        }
        return {
            stack: [
                { text: 'Firmado Digitalmente', alignment: 'center', fontSize: 6, color: '#16A34A', margin: [0, 15, 0, 2] },
                { text: firmaObjeto.nombre, alignment: 'center', fontSize: 9, bold: true, color: TEMA.colorPrimario },
                { text: firmaObjeto.cargo, alignment: 'center', fontSize: 7, color: TEMA.textoGris, margin: [0, 0, 0, 2] },
                { text: firmaObjeto.fecha, alignment: 'center', fontSize: 6, color: TEMA.textoGris, margin: [0, 0, 0, 5] },
                { text: '_______________________', alignment: 'center', margin: [0, 0, 0, 5], color: TEMA.lineaBordes },
                { text: tituloLabel, alignment: 'center', fontSize: 7, bold: true, color: TEMA.colorTitulos }
            ]
        };
    };

    docContent.push({
        columns: [
            renderFirma(datos.firmas.elaborado, 'ELABORADO POR (CONTRATISTA)'),
            renderFirma(datos.firmas.revisado, 'REVISADO POR (SUPERVISIÓN)'),
            renderFirma(datos.firmas.aprobado, 'APROBADO POR (CLIENTE / QA)')
        ],
        margin: [0, 20, 0, 0],
        unbreakable: true
    });

    // ==========================================
    // RETORNO DEL OBJETO PDFMAKE
    // ==========================================
    return {
        pageSize: 'A4',
        pageMargins: [35, 30, 35, 30], 
        content: docContent,
        defaultStyle: { fontSize: 9, color: TEMA.colorPrimario }
    };
}