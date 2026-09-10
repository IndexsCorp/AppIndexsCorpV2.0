/**
 * Plantilla de Reporte Diario para la Empresa: EMP00001 (Haelservice)
 * 
 * @param {Object} datos - Objeto con toda la información necesaria para renderizar.
 * Propiedades esperadas: 
 * - logo, nombreEmpresa, nombreProyecto, cliente, contratista, elaboradoPor, fecha, correlativo
 * - htmlActividades, htmlPersonal, htmlAnotaciones (Strings con HTML)
 * - fotosArray (Arreglo de objetos [{url: "...", descripcion: "..."}])
 */
export function renderizarPDF(datos) {
    // 1. PÁGINA DE TEXTO (Actividades, Personal y Anotaciones)
    const paginaPrincipal = `
        <div class="pagina-a4 bg-white text-black p-8 shadow-2xl relative" style="width: 210mm; min-height: 297mm; box-sizing: border-box; font-family: Arial, sans-serif;">
            
            <!-- ENCABEZADO -->
            <div style="background-color: #142538; display: flex; justify-content: space-between; align-items: center; padding: 16px;">
                <div style="width: 33%;">
                    ${datos.logo 
                        ? `<img src="${datos.logo}" alt="Logo" style="max-height: 64px; object-fit: contain; background-color: rgba(255,255,255,0.1); padding: 4px; border-radius: 4px;">` 
                        : `<div style="color: white; font-weight: bold; font-size: 1.25rem;">${datos.nombreEmpresa || ''}</div>`
                    }
                </div>
                <div style="width: 66%; text-align: center; color: white;">
                    <h1 style="font-size: 1.25rem; font-weight: 900; text-transform: uppercase; margin: 0;">Reporte Diario de Avance de Obra</h1>
                    <p style="font-size: 0.75rem; font-weight: bold; color: #85B648; text-transform: uppercase; margin-top: 2px;">PROYECTO</p>
                    <p style="font-size: 0.875rem; font-weight: bold; text-transform: uppercase; margin: 0;">${datos.nombreProyecto || ''}</p>
                </div>
            </div>

            <!-- CUADRO DE METADATOS -->
            <div style="display: flex; border: 2px solid #1e293b; font-size: 0.75rem; margin-bottom: 24px; background-color: white;">
                <div style="width: 66.66%; padding: 8px; border-right: 2px solid #1e293b;">
                    <div style="margin-bottom: 4px;"><span style="font-weight: bold;">CLIENTE:</span> ${datos.cliente || '-'}</div>
                    <div style="margin-bottom: 4px;"><span style="font-weight: bold;">CONTRATISTA:</span> ${datos.contratista || '-'}</div>
                    <div><span style="font-weight: bold;">ELABORADO POR:</span> ${datos.elaboradoPor || '-'}</div>
                </div>
                <div style="width: 33.33%; padding: 8px; display: flex; flex-direction: column; justify-content: center; background-color: #f8fafc;">
                    <div style="margin-bottom: 4px;"><span style="font-weight: bold;">FECHA:</span> ${datos.fecha || '-'}</div>
                    <div><span style="font-weight: bold;">N° REGISTRO:</span> <span style="color: #dc2626; font-weight: 900;">${datos.correlativo || '-'}</span></div>
                </div>
            </div>

            <!-- CONTENIDO DE TEXTO -->
            <div style="margin-bottom: 16px;">${datos.htmlActividades || ''}</div>
            <div style="margin-bottom: 16px;">${datos.htmlPersonal || ''}</div>
            <div style="margin-bottom: 16px;">${datos.htmlAnotaciones || ''}</div>
        </div>
    `;

    // 2. GENERAR PÁGINAS DE FOTOS DINÁMICAS (Máximo 6 por página)
    let paginasFotosHTML = '';
    const listaFotos = datos.fotosArray || []; 

    if (listaFotos.length > 0) {
        const TAMANO_BLOQUE = 6;
        
        for (let i = 0; i < listaFotos.length; i += TAMANO_BLOQUE) {
            const bloqueFotos = listaFotos.slice(i, i + TAMANO_BLOQUE);
            
            const fotosGridHTML = bloqueFotos.map(foto => `
                <div style="border: 1px solid #cbd5e1; border-radius: 8px; padding: 8px; background-color: #f8fafc; text-align: center;">
                    <img src="${foto.url}" style="width: 100%; height: 160px; object-fit: cover; border-radius: 4px; margin-bottom: 6px;">
                    <p style="font-size: 10px; color: #334155; margin: 0; font-weight: 600;">${foto.descripcion || 'Sin descripción'}</p>
                </div>
            `).join('');

            paginasFotosHTML += `
                <div class="pagina-a4 bg-white text-black p-8 shadow-2xl relative mt-8" style="width: 210mm; min-height: 297mm; box-sizing: border-box; font-family: Arial, sans-serif; page-break-before: always;">
                    
                    <!-- ENCABEZADO DE ANEXO FOTOGRÁFICO -->
                    <div style="background-color: #142538; display: flex; justify-content: space-between; align-items: center; padding: 16px; margin-bottom: 16px;">
                        <div style="width: 33%;">
                            ${datos.logo ? `<img src="${datos.logo}" alt="Logo" style="max-height: 64px; object-fit: contain;">` : ''}
                        </div>
                        <div style="width: 66%; text-align: center; color: white;">
                            <h1 style="font-size: 1.25rem; font-weight: 900; text-transform: uppercase; margin: 0;">Anexo Fotográfico</h1>
                            <p style="font-size: 0.75rem; font-weight: bold; color: #85B648; text-transform: uppercase; margin-top: 2px;">PROYECTO: ${datos.nombreProyecto || ''}</p>
                        </div>
                    </div>

                    <!-- CUADRÍCULA DE FOTOS (2 columnas x 3 filas) -->
                    <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px;">
                        ${fotosGridHTML}
                    </div>
                </div>
            `;
        }
    }

    return paginaPrincipal + paginasFotosHTML;
}