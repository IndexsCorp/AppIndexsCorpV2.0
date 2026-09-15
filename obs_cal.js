// ==========================================
// obs_cal.js - Módulo de Observaciones de Calidad
// ==========================================

import { auth, db, initAppCore } from "./app_core.js";
import { doc, setDoc, collection, query, where, getDocs, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

const storage = getStorage();

// ==========================================
// 1. INICIALIZACIÓN DE LA APLICACIÓN
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    initAppCore(true).then((estadoGlobal) => {
        if (!estadoGlobal || !estadoGlobal.proyectoActivo || !estadoGlobal.proyectoActivo.id) {
            alert("⚠️ Acceso denegado. No se seleccionó un proyecto válido.");
            window.location.href = "index.html"; 
            return;
        }

        const proj = estadoGlobal.proyectoActivo;

        // 1. Llenar Select de Frentes
        const frenteSelect = document.getElementById('frente');
        if (proj.frentes && proj.frentes.length > 0) {
            proj.frentes.forEach(f => frenteSelect.innerHTML += `<option value="${f}">${f}</option>`);
        }

        // Llenar filtro de Especialidad en la pestaña Status
        const filtroEsp = document.getElementById('filtroEspecialidad');
        if (proj.especialidades && filtroEsp) {
            proj.especialidades.forEach(e => filtroEsp.innerHTML += `<option value="${e}">${e}</option>`);
        }

        // 2. Llenar Select de Sectores (Si existe en tu BD, sino usará la opción por defecto)
        const sectorSelect = document.getElementById('sector');
        if (proj.sectores && proj.sectores.length > 0) {
            proj.sectores.forEach(s => sectorSelect.innerHTML += `<option value="${s}">${s}</option>`);
        } else if (proj.frentes) { // Fallback por si no tienes array de sectores aún
            proj.frentes.forEach(s => sectorSelect.innerHTML += `<option value="${s}">${s}</option>`);
        }

        // 3. Llenar Select de Especialidades
        const espSelect = document.getElementById('especialidad');
        if (proj.especialidades && proj.especialidades.length > 0) {
            proj.especialidades.forEach(e => espSelect.innerHTML += `<option value="${e}">${e}</option>`);
        }

        // 4. Setear Fechas de Hoy
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('dateregis_obscal').value = today;
        
        // El filtro 'Desde' lo seteamos 7 días atrás por defecto para la pestaña Status
        const pastWeek = new Date();
        pastWeek.setDate(pastWeek.getDate() - 7);
        document.getElementById('filtroDesde').value = pastWeek.toISOString().split('T')[0];
        document.getElementById('filtroHasta').value = today;

        // 5. Ocultar pantalla de carga y mostrar UI
        document.getElementById('pantalla-carga').classList.add('hidden');
        document.getElementById('navbar-global').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');

    }).catch(error => {
        console.error("Error al iniciar Obs. de Calidad:", error);
        alert("Ocurrió un error al cargar el contexto del proyecto.");
    });
});

// ==========================================
// 2. CONTROL DE PESTAÑAS (TABS) Y NAVEGACIÓN
// ==========================================
window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-corpBlue-600', 'text-white', 'border-corpBlue-600', 'active');
        btn.classList.add('bg-white', 'text-slate-500', 'border-slate-300');
    });

    const selectedTab = document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (selectedTab) selectedTab.classList.add('active');

    const selectedBtn = document.getElementById('btnTab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (selectedBtn) {
        selectedBtn.classList.remove('bg-white', 'text-slate-500', 'border-slate-300');
        selectedBtn.classList.add('bg-corpBlue-600', 'text-white', 'border-corpBlue-600', 'active');
    }

    // Carga automática del combo de observaciones si entra a Reporte o Enviar
    if (tabId === 'pdf' || tabId === 'enviar') {
        window.cargarComboObservaciones();
    }
};

window.toggleObsAccordion = function(bodyId, iconId) {
    const body = document.getElementById(bodyId);
    const icon = document.getElementById(iconId);
    if (body) {
        body.classList.toggle('hidden');
        body.classList.toggle('flex');
    }
    if (icon) icon.classList.toggle('rotate-180');
};

// ==========================================
// 3. PESTAÑA: REGISTRAR HALLAZGO
// ==========================================

// --- Manejo de la Imagen de Evidencia ---
window.previewImagenHallazgo = function(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            document.getElementById('img_preview_hallazgo').src = e.target.result;
            document.getElementById('foto_base64_hallazgo').value = e.target.result; // Guardamos el base64 en el input oculto
            document.getElementById('preview_hallazgo_container').classList.remove('hidden');
        };
        reader.readAsDataURL(input.files[0]);
    }
};

window.borrarImagenHallazgo = function() {
    document.getElementById('img_preview_hallazgo').src = '';
    document.getElementById('foto_base64_hallazgo').value = '';
    document.getElementById('preview_hallazgo_container').classList.add('hidden');
    document.getElementById('input_foto_obscal_cam').value = '';
    document.getElementById('input_foto_obscal_gal').value = '';
};

// Conversor interno para subida a Firebase
function dataURItoBlob(dataURI) {
    const byteString = atob(dataURI.split(',')[1]);
    const mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }
    return new Blob([ab], {type: mimeString});
}

// --- Guardar en Base de Datos ---
window.guardarObservacionCalidad = async function() {
    const PROJECT_ID = window.APP_STATE.proyectoActivo.id;
    const btn = document.getElementById('btnGuardarNuevaObs');
    
    // Recolectar datos del formulario
    const fecha = document.getElementById('dateregis_obscal').value;
    const frente = document.getElementById('frente').value;
    const sector = document.getElementById('sector').value;
    const ubicacion = document.getElementById('ubicacion_obscal').value.trim();
    const momento = document.getElementById('timeiden_obscal').value;
    
    const especialidad = document.getElementById('especialidad').value;
    const categoria = document.getElementById('categoria_obscal').value;
    const palabraClave = document.getElementById('wordkey_obscal').value.trim();
    const gravedad = document.getElementById('gravedad').value;
    const responsable = document.getElementById('responsable_subcontrata').value.trim();
    const fechaLimite = document.getElementById('datecierrecom_obscal').value;
    
    const descripcion = document.getElementById('descrip_obscal').value.trim();
    const fotoBase64 = document.getElementById('foto_base64_hallazgo').value;

    // Validación básica de campos obligatorios
    if (!fecha || !frente || !sector || !ubicacion || !especialidad || !descripcion) {
        return alert("⚠️ Por favor complete los campos obligatorios: Fecha, Frente, Sector, Ubicación, Especialidad y Descripción.");
    }

    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `Procesando... <span class="material-symbols-outlined animate-spin">refresh</span>`;

    try {
        let fotoUrl = "";

        // 1. Si adjuntó foto, subirla a Firebase Storage
        if (fotoBase64) {
            btn.innerHTML = `Subiendo foto... <span class="material-symbols-outlined animate-spin">refresh</span>`;
            const blob = dataURItoBlob(fotoBase64);
            const storagePath = `obscal_fotos/${PROJECT_ID}/${fecha}_${Date.now()}.jpg`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, blob);
            fotoUrl = await getDownloadURL(storageRef); // Obtenemos el link público
        }

        btn.innerHTML = `Guardando Registro... <span class="material-symbols-outlined animate-spin">refresh</span>`;
        
        // 2. Generar Correlativo / ID Único (Ej: OBS-2AOCLP)
        const obsId = "OBS-" + Date.now().toString(36).toUpperCase().slice(-6);

        // 3. Crear Referencia en Firestore con Clave Estructurada
        const docCustomId = `${PROJECT_ID}_${fecha}_${obsId}`;
        const nuevaObsRef = doc(db, "observaciones_calidad", docCustomId);

        // 4. Estructurar Objeto a Guardar
        const observacionData = {
            id_observacion: obsId,
            id_proyecto: PROJECT_ID,
            fecha_registro: fecha,
            frente: frente,
            sector: sector,
            ubicacion_especifica: ubicacion,
            momento_identificacion: momento || "No especificado",
            especialidad: especialidad,
            categoria: categoria,
            palabra_clave: palabraClave || "General",
            gravedad: gravedad,
            responsable_subcontrata: responsable || "No especificado",
            fecha_limite_cierre: fechaLimite || "",
            descripcion_hallazgo: descripcion,
            url_foto_hallazgo: fotoUrl,
            estado: "Pendiente", // Siempre nace como Pendiente
            creado_por: window.APP_STATE.user.nombre || window.APP_STATE.user.email,
            fecha_creacion_sistema: new Date().toISOString()
        };

        await setDoc(nuevaObsRef, observacionData);

        alert(`✅ Observación registrada exitosamente.\nCódigo de seguimiento: ${obsId}`);
        
        // Limpiar el formulario
        document.getElementById('formObservacionCalidad').reset();
        window.borrarImagenHallazgo();
        document.getElementById('dateregis_obscal').value = new Date().toISOString().split('T')[0];

    } catch (error) {
        console.error("Error al guardar la observación:", error);
        alert("Ocurrió un error al guardar: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};

// ==========================================
// 4. PESTAÑA: STATUS Y SEGUIMIENTO
// ==========================================

// --- Búsqueda y Filtrado de Observaciones ---
window.buscarObservaciones = async function() {
    const PROJECT_ID = window.APP_STATE.proyectoActivo.id;
    const desde = document.getElementById('filtroDesde').value;
    const hasta = document.getElementById('filtroHasta').value;
    const estado = document.getElementById('filtroEstado').value;
    const especialidad = document.getElementById('filtroEspecialidad').value;

    const loading = document.getElementById('loadingStatus');
    const resultados = document.getElementById('resultadosStatus');

    loading.classList.remove('hidden');
    resultados.innerHTML = '';

    try {
        // Consultar por el proyecto activo
        const q = query(collection(db, "observaciones_calidad"), where("id_proyecto", "==", PROJECT_ID));
        const querySnapshot = await getDocs(q);

        let docs = [];
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            data._docId = docSnap.id; // Guardamos el ID de la clave de Firestore
            docs.push(data);
        });

        // Filtrado en memoria
        docs = docs.filter(obs => {
            const f = obs.fecha_registro || '';
            const cumpleFecha = (!desde || f >= desde) && (!hasta || f <= hasta);
            const cumpleEstado = !estado || obs.estado === estado;
            const cumpleEsp = especialidad === 'Todas' || !especialidad || obs.especialidad === especialidad;
            return cumpleFecha && cumpleEstado && cumpleEsp;
        });

        // Ordenar del más reciente al más antiguo
        docs.sort((a, b) => (b.fecha_creacion_sistema || '').localeCompare(a.fecha_creacion_sistema || ''));

        loading.classList.add('hidden');

        if (docs.length === 0) {
            resultados.innerHTML = `
                <div class="p-8 text-center bg-slate-50 border border-slate-200 rounded-xl text-slate-500 font-bold">
                    <span class="material-symbols-outlined text-4xl mb-2 text-slate-300">search_off</span>
                    <p>No se encontraron observaciones con los filtros seleccionados.</p>
                </div>`;
            return;
        }

        // Renderizar las tarjetas
        docs.forEach((obs, index) => {
            resultados.innerHTML += renderizarTarjetaStatus(obs, index);
        });

    } catch (error) {
        console.error("Error buscando observaciones:", error);
        loading.classList.add('hidden');
        alert("Error al consultar la base de datos: " + error.message);
    }
};

// --- Renderizado Dinámico de la Tarjeta ---
function renderizarTarjetaStatus(obs, index) {
    const bodyId = `body-obs-${index}`;
    const iconId = `icon-obs-${index}`;
    const esPendiente = obs.estado === 'Pendiente';

    // Badge de Estado
    const statusBadge = esPendiente
        ? `<span class="text-xs font-bold px-2.5 py-1 rounded bg-red-100 text-red-700 uppercase tracking-wider flex items-center gap-1 shadow-sm">
             <span class="material-symbols-outlined text-[14px]">warning</span> Pendiente
           </span>`
        : `<span class="text-xs font-bold px-2.5 py-1 rounded bg-blue-100 text-blue-700 uppercase tracking-wider flex items-center gap-1 shadow-sm">
             <span class="material-symbols-outlined text-[14px]">done_all</span> Levantada / Validada
           </span>`;

    // Render de Foto de Hallazgo
    const fotoHallazgoHtml = obs.url_foto_hallazgo
        ? `<div class="w-full md:w-56 h-36 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 shrink-0 relative group">
             <img src="${obs.url_foto_hallazgo}" class="w-full h-full object-cover">
             <a href="${obs.url_foto_hallazgo}" target="_blank" class="absolute inset-0 bg-black/40 hidden group-hover:flex items-center justify-center text-white text-xs font-bold uppercase tracking-widest transition">
                Ver Foto
             </a>
           </div>`
        : `<div class="w-full md:w-56 h-36 bg-slate-100 rounded-lg border border-dashed border-slate-300 shrink-0 flex items-center justify-center text-slate-400 text-xs font-bold">
             Sin foto adjunta
           </div>`;

    // Render del Bloque de Solución (Si está Levantada o Si es Pendiente para ingresar datos)
    let bloqueAccionHtml = "";

    if (esPendiente) {
        const today = new Date().toISOString().split('T')[0];
        bloqueAccionHtml = `
            <div class="bg-slate-50 p-4 border-t border-slate-200">
                <h5 class="text-sm font-bold text-corpBlue-600 mb-3 flex items-center gap-1">
                    <span class="material-symbols-outlined text-[18px]">verified</span> Registro de Levantamiento y Validación
                </h5>
                <div class="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div class="md:col-span-8 space-y-3">
                        <textarea id="descriplevan_${obs._docId}" class="w-full p-2.5 text-sm border border-slate-300 rounded-lg outline-none focus:border-corpGreen" rows="2" placeholder="Detalle la acción correctiva ejecutada..."></textarea>
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Levantado por (Nombre):</label>
                                <input type="text" id="ejecutadopor_${obs._docId}" placeholder="Ej: Subcontrata / Maestro" class="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-corpGreen">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-slate-600 mb-1">Fecha de Levantamiento:</label>
                                <input type="date" id="fechaejecucion_${obs._docId}" value="${today}" class="w-full p-2 text-sm border border-slate-300 rounded-lg outline-none focus:border-corpGreen bg-white">
                            </div>
                        </div>
                    </div>
                    <div class="md:col-span-2">
                        <label class="flex flex-col items-center justify-center w-full h-full min-h-[5rem] border-2 border-dashed border-slate-300 rounded-lg bg-white cursor-pointer hover:bg-slate-50 transition p-2 text-center">
                            <span class="material-symbols-outlined text-slate-400">add_a_photo</span>
                            <span class="text-[11px] text-slate-500 font-bold mt-1">Foto Solución</span>
                            <input type="file" id="fotolevan_${obs._docId}" class="hidden" accept="image/*" onchange="window.previewFotoLevan(this, '${obs._docId}')">
                        </label>
                        <div id="prev_levan_cont_${obs._docId}" class="hidden mt-1 text-[10px] text-green-600 font-bold text-center">✓ Foto Lista</div>
                    </div>
                    <div class="md:col-span-2 flex">
                        <button type="button" onclick="window.ejecutarValidacion('${obs._docId}')" class="w-full bg-corpGreen hover:bg-corpGreen-hover text-white font-bold rounded-lg flex flex-col items-center justify-center transition shadow-sm p-2">
                            <span class="material-symbols-outlined mb-1 text-2xl">task_alt</span>
                            <span class="text-xs uppercase tracking-wider">Validar</span>
                        </button>
                    </div>
                </div>
            </div>`;
    } else {
        const fotoSolucionHtml = obs.url_foto_levantamiento
            ? `<a href="${obs.url_foto_levantamiento}" target="_blank" class="text-xs font-bold text-corpBlue-600 underline flex items-center gap-1 mt-2">
                 <span class="material-symbols-outlined text-sm">open_in_new</span> Ver Foto de Solución
               </a>`
            : '';

        bloqueAccionHtml = `
            <div class="bg-slate-50 p-4 border-t border-slate-200">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                    <div class="border-l-4 border-corpGreen pl-3">
                        <p class="text-xs font-bold text-corpGreen uppercase mb-1">Acción Correctiva Ejecutada</p>
                        <p class="text-sm text-slate-700">${obs.descripcion_levantamiento || "Sin descripción."}</p>
                        ${fotoSolucionHtml}
                    </div>
                    <div class="bg-white p-3 rounded-lg border border-slate-200">
                        <p class="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Trazabilidad</p>
                        <p class="text-xs text-slate-600"><span class="font-bold">Levantado por:</span> ${obs.ejecutado_por || 'N/A'} (${obs.fecha_levantamiento || 'N/A'})</p>
                        <p class="text-xs text-slate-600 mt-1"><span class="font-bold">Validado por:</span> ${obs.validado_por || 'N/A'}</p>
                    </div>
                </div>
            </div>`;
    }

    return `
        <div class="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden flex flex-col transition-all">
            <div class="bg-slate-50 border-b border-slate-200 p-4 cursor-pointer hover:bg-slate-100 transition" onclick="window.toggleObsAccordion('${bodyId}', '${iconId}')">
                <div class="flex justify-between items-start mb-3">
                    <div class="flex items-center gap-3">
                        <span class="font-black text-slate-800 text-lg">${obs.id_observacion}</span>
                        ${statusBadge}
                    </div>
                    <span id="${iconId}" class="material-symbols-outlined text-slate-500 transition-transform duration-300">expand_more</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-1.5 text-sm text-slate-600">
                    <p><span class="font-semibold text-slate-800">Frente / Sector:</span> ${obs.frente} - ${obs.sector}</p>
                    <p><span class="font-semibold text-slate-800">Ubicación:</span> ${obs.ubicacion_especifica}</p>
                    <p><span class="font-semibold text-slate-800">Especialidad:</span> ${obs.especialidad} (${obs.gravedad})</p>
                    <p><span class="font-semibold text-slate-800">Responsable:</span> ${obs.responsable_subcontrata}</p>
                </div>
            </div>

            <div id="${bodyId}" class="hidden flex-col">
                <div class="p-4 flex flex-col md:flex-row gap-5 bg-white">
                    <div class="flex-1">
                        <div class="bg-amber-50 text-amber-900 p-3 rounded-lg border border-amber-200 h-full">
                            <span class="font-bold block text-xs uppercase mb-2 tracking-wider flex items-center gap-1">
                                <span class="material-symbols-outlined text-[16px]">info</span> Descripción del Hallazgo:
                            </span>
                            <p class="text-sm">${obs.descripcion_hallazgo}</p>
                            <p class="text-xs mt-3 font-semibold text-amber-800">Registrado por: ${obs.creado_por} (${obs.fecha_registro})</p>
                        </div>
                    </div>
                    ${fotoHallazgoHtml}
                </div>
                ${bloqueAccionHtml}
            </div>
        </div>
    `;
}

// Preview visual de la foto de solución
window.previewFotoLevan = function(input, docId) {
    const prevText = document.getElementById(`prev_levan_cont_${docId}`);
    if (input.files && input.files[0] && prevText) {
        prevText.classList.remove('hidden');
    }
};

// --- Procesar Validación / Cierre del Hallazgo ---
window.ejecutarValidacion = async function(docId) {
    const PROJECT_ID = window.APP_STATE.proyectoActivo.id;
    const descInput = document.getElementById(`descriplevan_${docId}`);
    const ejecInput = document.getElementById(`ejecutadopor_${docId}`);
    const fechaInput = document.getElementById(`fechaejecucion_${docId}`);
    const fotoInput = document.getElementById(`fotolevan_${docId}`);

    const desc = descInput ? descInput.value.trim() : '';
    const ejec = ejecInput ? ejecInput.value.trim() : '';
    const fechaLev = fechaInput ? fechaInput.value : '';

    if (!desc || !ejec || !fechaLev) {
        return alert("⚠️ Por favor complete la descripción de la solución, el nombre de quien levantó la observación y la fecha.");
    }

    if (!confirm("¿Confirma que el hallazgo ha sido subsanado y desea marcarlo como LEVANTADO/VALIDADO?")) {
        return;
    }

    try {
        let fotoLevanUrl = "";

        // Si se subió foto de solución
        if (fotoInput && fotoInput.files && fotoInput.files[0]) {
            const file = fotoInput.files[0];
            const storagePath = `obscal_fotos/${PROJECT_ID}/levan_${Date.now()}.jpg`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, file);
            fotoLevanUrl = await getDownloadURL(storageRef);
        }

        // Actualizar documento en Firestore
        const obsRef = doc(db, "observaciones_calidad", docId);
        await updateDoc(obsRef, {
            estado: "Levantada",
            descripcion_levantamiento: desc,
            ejecutado_por: ejec,
            fecha_levantamiento: fechaLev,
            url_foto_levantamiento: fotoLevanUrl,
            validado_por: window.APP_STATE.user.nombre || window.APP_STATE.user.email,
            fecha_validacion: new Date().toISOString()
        });

        alert("✅ La observación ha sido marcada como LEVANTADA exitosamente.");
        
        // Recargar la búsqueda automáticamente
        window.buscarObservaciones();

    } catch (error) {
        console.error("Error al validar observación:", error);
        alert("Ocurrió un error al actualizar: " + error.message);
    }
};

window.ejecutarValidacion = async function(obsId) {
    console.log("Función ejecutarValidacion pendiente de desarrollo para ID:", obsId);
};

// ==========================================
// 5. PESTAÑA: PREVISUALIZAR Y GENERAR REPORTE PDF
// ==========================================

let pdfBlobGeneradoObs = null;
let CURRENT_OBS_PREVIEW = null;

async function urlToBase64Obs(url) {
    if (!url) return null;
    if (url.startsWith('data:image')) return url;

    try {
        const response = await fetch(url);
        if (response.ok) {
            const blob = await response.blob();
            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve(null);
                reader.readAsDataURL(blob);
            });
        }
    } catch (e) {
        console.warn("Error convirtiendo URL a Base64:", e);
    }
    return null;
}

window.cargarComboObservaciones = async function() {
    const PROJECT_ID = window.APP_STATE?.proyectoActivo?.id;
    if (!PROJECT_ID) return;

    const prevSelect = document.getElementById('prevObsSelect');
    const envioSelect = document.getElementById('envioObsSelect');

    if (!prevSelect && !envioSelect) return;

    try {
        const q = query(collection(db, "observaciones_calidad"), where("id_proyecto", "==", PROJECT_ID));
        const querySnapshot = await getDocs(q);

        let optionsHtml = '<option value="" disabled selected>Busque y seleccione una observación...</option>';
        let docs = [];

        querySnapshot.forEach(docSnap => {
            const data = docSnap.data();
            data._docId = docSnap.id;
            docs.push(data);
        });

        docs.sort((a, b) => (b.fecha_creacion_sistema || '').localeCompare(a.fecha_creacion_sistema || ''));

        docs.forEach(obs => {
            const badge = obs.estado === 'Pendiente' ? '[PENDIENTE]' : '[LEVANTADA]';
            optionsHtml += `<option value="${obs._docId}">${badge} ${obs.id_observacion} - ${obs.frente} / ${obs.sector} (${obs.especialidad})</option>`;
        });

        if (prevSelect) prevSelect.innerHTML = optionsHtml;
        if (envioSelect) envioSelect.innerHTML = optionsHtml;

    } catch (error) {
        console.error("Error al cargar combo de observaciones:", error);
    }
};

window.generarPrevisualizacionObsPdf = async function() {
    const select = document.getElementById('prevObsSelect');
    const docId = select ? select.value : '';

    if (!docId) return alert("⚠️ Por favor, seleccione una observación de la lista.");

    const btn = document.getElementById('btnGenerarPrevPdf');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">refresh</span> Compilando Vectorial...`;

    try {
        const obsRef = doc(db, "observaciones_calidad", docId);
        const obsSnap = await getDoc(obsRef);

        if (!obsSnap.exists()) return alert("No se encontró la observación seleccionada.");

        const data = obsSnap.data();
        data._docId = obsSnap.id;
        CURRENT_OBS_PREVIEW = data;

        // Convertir imágenes a Base64 para pdfMake
        const logoB64 = window.APP_STATE.empresa?.logo ? await urlToBase64Obs(window.APP_STATE.empresa.logo) : null;
        const fotoHallazgoB64 = await urlToBase64Obs(data.url_foto_hallazgo);
        const fotoLevanB64 = await urlToBase64Obs(data.url_foto_levantamiento);

        const datosPlantilla = {
            logo: logoB64,
            nombreEmpresa: window.APP_STATE.empresa?.nombre || "EMPRESA CONTRATISTA",
            nombreProyecto: window.APP_STATE.proyectoActivo.nombre,
            idObservacion: data.id_observacion,
            fechaRegistro: data.fecha_registro || '-',
            frenteSector: `${data.frente} / ${data.sector}`,
            ubicacion: data.ubicacion_especifica || '-',
            especialidadTema: `${data.especialidad} ${data.palabra_clave ? '- ' + data.palabra_clave : ''}`,
            responsable: data.responsable_subcontrata || '-',
            estado: data.estado || 'Pendiente',
            gravedad: data.gravedad || 'Media',
            descripcionHallazgo: data.descripcion_hallazgo || 'Sin descripción.',
            fechaLimite: data.fecha_limite_cierre || 'No especificada',
            fotoHallazgo: fotoHallazgoB64,
            descripcionLevantamiento: data.descripcion_levantamiento || '',
            fechaLevantamiento: data.fecha_levantamiento || '-',
            validadoPor: data.validado_por || '-',
            fotoLevantamiento: fotoLevanB64
        };

        // Importación dinámica de la plantilla elegida
        let generarDocDefinition;
        const idEmpresa = window.APP_STATE.empresa?.id || 'EMP00001';
        try {
            const modulo = await import(`./js/templates/obs_calidad/${idEmpresa}.js`);
            generarDocDefinition = modulo.generarDocDefinition;
        } catch (e) {
            const modulo = await import(`./js/templates/obs_calidad/EMP00001.js`);
            generarDocDefinition = modulo.generarDocDefinition;
        }

        const docDefinition = generarDocDefinition(datosPlantilla);
        const pdfDoc = pdfMake.createPdf(docDefinition);

        pdfDoc.getBlob((blob) => {
            pdfBlobGeneradoObs = blob;
            const pdfUrl = URL.createObjectURL(blob);

            document.getElementById('pdfPlaceholderObs')?.classList.add('hidden');
            const rootCont = document.getElementById('pdfContenedorRaiz');

            const esCelular = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (esCelular) {
                rootCont.innerHTML = `
                    <div class="text-center p-6 bg-slate-50 rounded-xl w-full border border-slate-300">
                        <span class="material-symbols-outlined text-4xl text-corpBlue-600 mb-2">picture_as_pdf</span>
                        <p class="text-slate-700 font-bold mb-3 text-sm">PDF Compilado Exitosamente</p>
                        <a href="${pdfUrl}" target="_blank" class="inline-block bg-corpBlue-600 text-white font-bold py-2.5 px-6 rounded-lg text-sm shadow">
                            Visualizar Documento
                        </a>
                    </div>`;
            } else {
                rootCont.innerHTML = `<iframe src="${pdfUrl}" class="w-full h-[600px] rounded-xl shadow-md border border-slate-300"></iframe>`;
            }

            rootCont.classList.remove('hidden');
            rootCont.classList.add('flex');

            const btnGuardar = document.getElementById('btnGuardarOficialObs');
            btnGuardar.classList.remove('hidden');
            btnGuardar.classList.add('flex');
        });

    } catch (error) {
        console.error("Error al generar PDF vectorial de observación:", error);
        alert("Error al procesar el documento: " + error.message);
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
};

window.accionGuardarPDFDefinitivoObs = async function() {
    if (!pdfBlobGeneradoObs || !CURRENT_OBS_PREVIEW) return alert("Primero debe compilar la vista previa del PDF.");

    const PROJECT_ID = window.APP_STATE.proyectoActivo.id;
    const obsId = CURRENT_OBS_PREVIEW.id_observacion;
    const docId = CURRENT_OBS_PREVIEW._docId;
    const btn = document.getElementById('btnGuardarOficialObs');

    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">cloud_upload</span> Guardando Oficialmente...`;

    try {
        const storagePath = `obscal_pdfs/${PROJECT_ID}/${obsId}.pdf`;
        const storageRef = ref(storage, storagePath);

        await uploadBytes(storageRef, pdfBlobGeneradoObs);
        const urlPDFDescarga = await getDownloadURL(storageRef);

        const obsRef = doc(db, "observaciones_calidad", docId);
        await updateDoc(obsRef, {
            url_pdf_oficial: urlPDFDescarga,
            fecha_guardado_pdf: new Date().toISOString()
        });

        btn.innerHTML = "✅ PDF Registrado Oficialmente";
        alert(`✅ PDF de la observación ${obsId} guardado/actualizado en Storage y Firestore.`);

    } catch (error) {
        console.error("Error al guardar PDF oficial de observación:", error);
        alert("Error al guardar en la nube: " + error.message);
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = origText;
        }, 2000);
    }
};

// ==========================================
// 6. PESTAÑA: ENVIAR NOTIFICACIÓN Y CORREO
// ==========================================

window.CURRENT_OBS_PDF_URL_TO_SEND = null;

window.cargarDatosMensajeriaObs = async function() {
    const select = document.getElementById('envioObsSelect');
    const docId = select ? select.value : '';

    if (!docId) return alert("⚠️ Seleccione una observación de la lista para cargar la mensajería.");

    const btn = document.getElementById('btnCargarCorreoObs');
    const origText = btn ? btn.innerHTML : '';
    if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">sync</span> Cargando...`;
        btn.disabled = true;
    }

    try {
        const obsRef = doc(db, "observaciones_calidad", docId);
        const obsSnap = await getDoc(obsRef);

        if (!obsSnap.exists()) {
            alert("No se encontró la observación en la base de datos.");
            return;
        }

        const obs = obsSnap.data();
        const projName = window.APP_STATE.proyectoActivo.nombre || "PROYECTO";
        const obsId = obs.id_observacion || "OBS-CAL";
        const estado = (obs.estado || "PENDIENTE").toUpperCase();

        // 1. Configurar Asunto del Correo
        document.getElementById('envioAsunto').value = `[CALIDAD] OBSERVACIÓN ${obsId} - ${projName} (${estado})`;

        // 2. Formatear Correos del Proyecto (Para / CC)
        const formatEmails = (str) => str ? str.replace(/;/g, ',').replace(/\s+/g, '') : "";
        document.getElementById('envioPara').value = formatEmails(window.APP_STATE.proyectoActivo.correosPara);
        document.getElementById('envioCc').value = formatEmails(window.APP_STATE.proyectoActivo.correosCC);

        // 3. Obtener el Enlace del PDF Oficial de Firestore
        let linkDescarga = "⚠️ (El PDF oficial aún no ha sido generado/guardado en la pestaña Reporte)";
        if (obs.url_pdf_oficial) {
            window.CURRENT_OBS_PDF_URL_TO_SEND = obs.url_pdf_oficial;
            linkDescarga = obs.url_pdf_oficial;
        } else {
            window.CURRENT_OBS_PDF_URL_TO_SEND = null;
        }

        // 4. Redactar el Cuerpo del Mensaje
        let cuerpoTexto = `Estimados,\n\n`;
        cuerpoTexto += `Se remite la Notificación de Calidad correspondiente al proyecto ${projName}.\n\n`;
        cuerpoTexto += `--- RESUMEN DEL HALLAZGO ---\n`;
        cuerpoTexto += `• Código: ${obsId}\n`;
        cuerpoTexto += `• Estado: ${estado}\n`;
        cuerpoTexto += `• Frente / Sector: ${obs.frente || '-'} / ${obs.sector || '-'}\n`;
        cuerpoTexto += `• Ubicación: ${obs.ubicacion_especifica || '-'}\n`;
        cuerpoTexto += `• Especialidad: ${obs.especialidad || '-'}\n`;
        cuerpoTexto += `• Subcontrata / Responsable: ${obs.responsable_subcontrata || '-'}\n`;
        cuerpoTexto += `• Descripción: ${obs.descripcion_hallazgo || '-'}\n\n`;

        if (obs.estado === 'Levantada') {
            cuerpoTexto += `--- ACCIÓN CORRECTIVA / SOLUCIÓN ---\n`;
            cuerpoTexto += `• Descripción Solución: ${obs.descripcion_levantamiento || '-'}\n`;
            cuerpoTexto += `• Ejecutado por: ${obs.ejecutado_por || '-'}\n`;
            cuerpoTexto += `• Validado por: ${obs.validado_por || '-'}\n\n`;
        }

        cuerpoTexto += `Puede visualizar y descargar el documento oficial (PDF) desde el siguiente enlace seguro:\n${linkDescarga}\n\n`;
        cuerpoTexto += `Quedamos atentos a sus comentarios para la pronta atención de este registro.\n\n`;
        cuerpoTexto += `Atentamente,\n${window.APP_STATE.user.nombre || ''}\n${window.APP_STATE.user.cargo || 'Área de Calidad'}`;

        document.getElementById('envioCuerpo').value = cuerpoTexto;

    } catch (error) {
        console.error("Error al cargar mensajería de observación:", error);
        alert("Error al cargar datos: " + error.message);
    } finally {
        if (btn) {
            btn.innerHTML = origText;
            btn.disabled = false;
        }
    }
};

window.accionEnviarCorreoDefinitivoObs = async function(proveedor) {
    const para = document.getElementById('envioPara').value.trim();
    const cc = document.getElementById('envioCc').value.trim();
    const asunto = document.getElementById('envioAsunto').value.trim();
    const cuerpo = document.getElementById('envioCuerpo').value.trim();

    if (!para || !asunto) return alert("Por favor complete los campos 'Para' y 'Asunto'.");

    if (!window.CURRENT_OBS_PDF_URL_TO_SEND) {
        if (!confirm("⚠️ No se encontró un enlace de PDF guardado para esta observación. ¿Desea abrir el cliente de correo de todos modos?")) {
            return;
        }
    }

    const toEnc = para.split(',').map(e => encodeURIComponent(e.trim())).join(',');
    const ccEnc = cc ? cc.split(',').map(e => encodeURIComponent(e.trim())).join(',') : '';
    const suEnc = encodeURIComponent(asunto);
    const bodyEnc = encodeURIComponent(cuerpo);

    const esCelular = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    let mailtoEstandar = `mailto:${toEnc}?`;
    if (ccEnc) mailtoEstandar += `cc=${ccEnc}&`;
    mailtoEstandar += `subject=${suEnc}&body=${bodyEnc}`;

    if (proveedor === 'gmail' && !esCelular) {
        window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=${toEnc}&cc=${ccEnc}&su=${suEnc}&body=${bodyEnc}`, '_blank');
    } else if (proveedor === 'outlook' && !esCelular) {
        window.open(`https://outlook.office.com/mail/deeplink/compose?to=${toEnc}&cc=${ccEnc}&subject=${suEnc}&body=${bodyEnc}`, '_blank');
    } else {
        window.location.href = mailtoEstandar;
    }
};