// ==========================================
// protocolos_cal.js - MÓDULO DE PROTOCOLOS (MODULAR)
// ==========================================

import { auth, db, initAppCore } from "./app_core.js";
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, arrayUnion, arrayRemove, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
// ==========================================
// 0. MATRIZ DE PERMISOS (SISTEMA RBAC - PROTOCOLOS)
// ==========================================
const PERMISOS_PROT = {
    "crear_editar": ["Admin", "Supervision"],
    "firmar_elaborado": ["Admin", "Supervision", "Contratista"],
    "firmar_revisado": ["Admin", "Supervision"],
    "firmar_aprobado": ["Admin", "Supervision"],
    "subir_pdf_fisico": ["Admin", "Supervision"],
    "enviar_correo": ["Admin", "Supervision"],
    "ver_pestanas_avanzadas": ["Admin", "Supervision", "Contratista"] // Solo el cliente tiene restringido ver Reportes
};

window.PROT_CACHE = [];
window.PROT_CACHE_LOADED = false;
window.tienePermiso = function(accion, mostrarAlerta = true) {
    // Si por algún motivo no hay rol cargado, asume el más restrictivo: Cliente
    const rolActual = (window.APP_STATE && window.APP_STATE.user && window.APP_STATE.user.rolUser) ? window.APP_STATE.user.rolUser : "Cliente"; 
    const rolesPermitidos = PERMISOS_PROT[accion] || [];
    
    if (rolesPermitidos.includes(rolActual)) {
        return true;
    } else {
        if (mostrarAlerta) alert(`⛔ Acceso denegado: El perfil '${rolActual}' no tiene autorización para realizar esta acción.`);
        return false;
    }
};

// Inicialización de la Micro-App
document.addEventListener("DOMContentLoaded", () => {
    initAppCore(true).then((estadoGlobal) => {
        if (!estadoGlobal || !estadoGlobal.proyectoActivo || !estadoGlobal.proyectoActivo.id) {
            alert("⚠️ Acceso denegado. No se seleccionó un proyecto válido.");
            window.location.href = "index.html"; 
            return;
        }

        const pantallaCarga = document.getElementById('pantalla-carga');
        const mainContent = document.getElementById('main-content');
        const navbarGlobal = document.getElementById('navbar-global');

        const protFecha = document.getElementById('protFecha');
        if (protFecha) protFecha.value = new Date().toISOString().split('T')[0];

        // 2. Cargar frentes en el selector (desde la caché de app_core)
        const selectFrente = document.getElementById('protFrente');
        if (selectFrente && estadoGlobal.proyectoActivo.frentes) {
            selectFrente.innerHTML = '<option value="" disabled selected>Seleccione frente...</option>';
            estadoGlobal.proyectoActivo.frentes.forEach(frente => {
                selectFrente.innerHTML += `<option value="${frente}">${frente}</option>`;
            });
        }

        // 3. Cargar sectores en el selector (desde la caché de app_core)
        const selectSector = document.getElementById('protSector');
        if (selectSector && estadoGlobal.proyectoActivo.sectores) {
            selectSector.innerHTML = '<option value="" disabled selected>Seleccione sector...</option>';
            estadoGlobal.proyectoActivo.sectores.forEach(sec => {
                selectSector.innerHTML += `<option value="${sec}">${sec}</option>`;
            });
        }
        
        // Llenar el Select de Protocolos desde el Mapa de la BD
        const selectProtocolo = document.getElementById('tipoProtocolo');
        const mapaProtocolos = estadoGlobal.proyectoActivo.protocolosMap || {};
        
        if (selectProtocolo) {
            selectProtocolo.innerHTML = '<option value="" disabled selected>Seleccione el protocolo a cargar...</option>';
            
            const archivosProtocolos = Object.keys(mapaProtocolos);
            
            if (archivosProtocolos.length > 0) {
                archivosProtocolos.forEach(archivo => {
                    const nombreVisible = mapaProtocolos[archivo];
                    // El value oculto es "prot_1_aec", pero el texto que se ve es el nombre visible
                    selectProtocolo.innerHTML += `<option value="${archivo}">${nombreVisible}</option>`;
                });
            } else {
                selectProtocolo.innerHTML = '<option value="" disabled>No hay protocolos asignados al proyecto</option>';
            }
        }
        
        if (pantallaCarga) pantallaCarga.classList.add('hidden');
        if (navbarGlobal) navbarGlobal.classList.remove('hidden');
        if (mainContent) mainContent.classList.remove('hidden');

        window.switchTab('registro');

    }).catch(error => {
        console.error("Error al iniciar Protocolos:", error);
    });
});

// ==========================================
// NAVEGACIÓN ENTRE LAS 3 PESTAÑAS
// ==========================================
window.switchTab = function(tabId) {
    // 1. Resetear botones visualmente
    document.querySelectorAll('.tab-btn').forEach(b => { 
        b.classList.remove('active', 'bg-corpBlue-600', 'text-white', 'border-corpBlue-600'); 
        b.classList.add('bg-white', 'text-slate-500', 'border-slate-300'); 
    });
    
    // 2. Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    // 3. Mapeo de Pestañas
    const mapBtn = { 'registro': 'btnTabRegistro', 'status': 'btnTabStatus', 'reporte': 'btnTabReporte' };
    const mapContent = { 'registro': 'tabRegistro', 'status': 'tabStatus', 'reporte': 'tabReporte' };

    // 4. Activar el botón seleccionado
    const btn = document.getElementById(mapBtn[tabId]);
    if (btn) {
        btn.classList.remove('bg-white', 'text-slate-500', 'border-slate-300'); 
        btn.classList.add('active', 'bg-corpBlue-600', 'text-white', 'border-corpBlue-600');
    }
    
    // 5. Mostrar el contenido seleccionado
    const content = document.getElementById(mapContent[tabId]);
    if (content) content.classList.add('active');

    // 6. Controlar visibilidad de la barra de guardado global (Solo visible en Registro)
    const barraAcciones = document.getElementById('barraAccionesGlobales');
    if (barraAcciones) {
        if (tabId === 'registro') {
            barraAcciones.classList.remove('hidden');
            barraAcciones.classList.add('flex');
        } else {
            barraAcciones.classList.add('hidden');
            barraAcciones.classList.remove('flex');
        }
    }

    // 7. MAGIA: Disparador automático para llenar el selector de PDFs en la pestaña 3
    if (tabId === 'reporte') {
        if (typeof window.cargarComboProtocolos === 'function') {
            window.cargarComboProtocolos();
        }
    }
};

// ==========================================
// CARGA DINÁMICA DE PLANTILLAS (MÓDULOS AISLADOS)
// ==========================================
window.cargarPlantillaChecklist = async function(tipoProtocolo) {
    const contenedor = document.getElementById('contenedorChecklistsDinamicos');
    const acordeonConcreto = document.getElementById('acordeonConcreto');
    if (!contenedor) return;

    contenedor.innerHTML = `<div class="p-4 text-center text-slate-500 font-bold"><span class="material-symbols-outlined animate-spin align-middle mr-2">refresh</span> Cargando estructura de ${tipoProtocolo}...</div>`;

    try {
        const module = await import(`./js/templates/protocolos_calidad/${tipoProtocolo}.js`);
        const plantilla = module.default;

        if (acordeonConcreto) {
            if (plantilla.requiereVolumenConcreto) {
                acordeonConcreto.classList.remove('hidden');
            } else {
                acordeonConcreto.classList.add('hidden');
            }
        }

        let html = "";
        plantilla.secciones.forEach((seccion, secIndex) => {
            html += `
            <div class="border border-slate-200 rounded-xl p-4 bg-slate-50 shadow-sm mb-6" data-seccion="${secIndex}">
                <h3 class="text-xs font-bold text-corpBlue-700 uppercase tracking-wider mb-3">${seccion.titulo}</h3>
                
                <!-- TABLA DE CHECKLIST -->
                <table class="w-full text-xs text-left bg-white rounded-lg border border-slate-200 overflow-hidden mb-3">
                    <thead class="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                        <tr>
                            <th class="p-2.5 w-10 text-center">#</th>
                            <th class="p-2.5">Descripción de la Actividad</th>
                            <th class="p-2.5 w-12 text-center">SI</th>
                            <th class="p-2.5 w-12 text-center">NO</th>
                            <th class="p-2.5 w-12 text-center">N/A</th>
                            <th class="p-2.5 w-10 text-center"></th>
                        </tr>
                    </thead>
                    
                    <!-- AQUÍ SE AÑADIÓ LA ETIQUETA TBODY CON EL ID DINÁMICO -->
                    <tbody id="tbody_seccion_${secIndex}">
                    
                    ${seccion.items.map((item, itemIndex) => `
                            <tr class="border-b border-slate-100 hover:bg-slate-50">
                                <td class="p-2 text-center font-bold text-slate-400">${itemIndex + 1}</td>
                                <td class="p-2">
                                    <input type="text" value="${item}" onchange="window.registrarCambioTraza(this)" class="w-full p-1 bg-transparent border-b border-transparent focus:border-corpBlue-500 outline-none text-slate-800 text-xs font-medium">
                                    <span class="traza-badge hidden text-[9px] font-bold text-corpBlue-400 mt-1 flex items-center gap-1"></span>
                                    <input type="hidden" class="traza-data" value="">
                                </td>
                                <td class="p-2 text-center"><input type="radio" name="check_${secIndex}_${itemIndex}" value="SI" onclick="window.toggleRadioTraza(this)" class="w-4 h-4 accent-emerald-600"></td>
                                <td class="p-2 text-center"><input type="radio" name="check_${secIndex}_${itemIndex}" value="NO" onclick="window.toggleRadioTraza(this)" class="w-4 h-4 accent-red-600"></td>
                                <td class="p-2 text-center"><input type="radio" name="check_${secIndex}_${itemIndex}" value="NA" onclick="window.toggleRadioTraza(this)" class="w-4 h-4 accent-slate-400" checked></td>
                                <td class="p-2 text-center">
                                    <button type="button" onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-500 transition"><span class="material-symbols-outlined text-sm">delete</span></button>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                
                <button type="button" onclick="window.agregarFilaChecklist('tbody_seccion_${secIndex}', ${secIndex})" class="bg-white hover:bg-slate-100 text-corpBlue-600 border border-slate-300 font-bold px-3 py-1.5 rounded-lg text-xs flex items-center gap-1 shadow-sm transition mb-4">
                    <span class="material-symbols-outlined text-sm">add</span> Añadir criterio
                </button>

                <!-- NUEVO: SECCIÓN DE OBSERVACIONES (TIPO BITÁCORA INMUTABLE) Y RESPONSABLE -->
                <div class="border-t border-slate-200 pt-4">
                    <label class="block text-xs font-semibold text-slate-600 mb-2">Registro de Anotaciones / Observaciones (${seccion.titulo}):</label>
                    
                    <!-- Historial inmutable de observaciones -->
                    <div id="historial_obs_seccion_${secIndex}" class="space-y-2 mb-3"></div>
                    
                    <!-- Controles para añadir nueva anotación/observación -->
                    <div class="flex flex-col md:flex-row gap-2 mb-4 bg-slate-100 p-2 rounded-lg border border-slate-200">
                        <select id="tipo_obs_seccion_${secIndex}" class="p-2 text-xs border border-slate-300 rounded-lg outline-none bg-white font-bold text-slate-700 w-full md:w-auto">
                            <option value="Anotación">📌 Anotación</option>
                            <option value="Por Levantar">🔴 Observación Importante</option>
                        </select>
                        <textarea id="input_obs_seccion_${secIndex}" rows="1" class="flex-1 p-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-corpBlue-500 bg-white resize-none" placeholder="Escriba el detalle y presione Añadir..."></textarea>
                        <button type="button" onclick="window.agregarObservacionFase(${secIndex})" class="bg-slate-700 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1 shrink-0 w-full md:w-auto">
                            <span class="material-symbols-outlined text-sm">add_comment</span> Añadir
                        </button>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg border border-slate-200">
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Responsable de Liberación:</label>
                            <input type="text" id="resp_seccion_${secIndex}" placeholder="Ej: Juan Rivas Chunga" class="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-corpBlue-500 bg-white font-medium text-slate-800">
                        </div>
                        <div>
                            <label class="block text-[10px] font-bold text-slate-500 mb-1 uppercase">Fecha de Liberación:</label>
                            <input type="date" id="fecha_seccion_${secIndex}" class="w-full p-2 text-xs border border-slate-300 rounded-lg outline-none focus:border-corpBlue-500 bg-white text-slate-800">
                        </div>
                    </div>
                </div>
            </div>`;
        });

        contenedor.innerHTML = html;

    } catch (error) {
        console.error("Error cargando plantilla:", error);
        contenedor.innerHTML = `<div class="p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-sm font-bold">No se encontró el archivo de diseño para el protocolo: <b>${tipoProtocolo}</b>.</div>`;
        if(acordeonConcreto) acordeonConcreto.classList.add('hidden');
    }
};


// ==========================================
// AÑADIR FILA MANUALMENTE AL CHECKLIST
// ==========================================
window.agregarFilaChecklist = function(tbodyId, secIndex) {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    
    const tr = document.createElement('tr');
    tr.className = "border-b border-slate-100 hover:bg-slate-50";
    const rowId = new Date().getTime(); 
    
    tr.innerHTML = `
        <td class="p-2 text-center font-bold text-slate-400">-</td>
        <td class="p-2">
            <input type="text" onchange="window.registrarCambioTraza(this)" placeholder="Escriba un nuevo criterio de inspección..." class="w-full p-1 bg-transparent border-b border-slate-300 focus:border-corpBlue-500 outline-none text-slate-800 text-xs font-medium">
            <span class="traza-badge hidden text-[9px] font-bold text-corpBlue-400 mt-1 flex items-center gap-1"></span>
            <input type="hidden" class="traza-data" value="">
        </td>
        <td class="p-2 text-center"><input type="radio" name="check_${secIndex}_${rowId}" value="SI" onclick="window.toggleRadioTraza(this)" class="w-4 h-4 accent-emerald-600"></td>
        <td class="p-2 text-center"><input type="radio" name="check_${secIndex}_${rowId}" value="NO" onclick="window.toggleRadioTraza(this)" class="w-4 h-4 accent-red-600"></td>
        <td class="p-2 text-center"><input type="radio" name="check_${secIndex}_${rowId}" value="NA" onclick="window.toggleRadioTraza(this)" class="w-4 h-4 accent-slate-400" checked></td>
        <td class="p-2 text-center">
            <button type="button" onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-500 transition"><span class="material-symbols-outlined text-sm">delete</span></button>
        </td>
    `;
    tbody.appendChild(tr);
};

// ==========================================
// GESTIÓN DE LISTAS: FRENTES Y SECTORES
// ==========================================

window.agregarItemLista = async function(campoBD, selectId) {
    if (!window.tienePermiso("crear_editar")) return;

    // 1. Obtener y ordenar la lista actual desde el caché global
    let listaActual = window.APP_STATE?.proyectoActivo?.[campoBD] || [];
    listaActual.sort((a, b) => a.localeCompare(b));
    
    // 2. Crear el texto para mostrar en el cuadro de diálogo
    let textoOpciones = listaActual.length > 0 
        ? "OPCIONES ACTUALES:\n" + listaActual.map(i => `• ${i}`).join("\n") 
        : "No hay opciones registradas.";
        
    const nuevoItem = prompt(`${textoOpciones}\n\nIngrese el nuevo nombre para agregar a la lista:`);
    if (!nuevoItem || nuevoItem.trim() === "") return;
    
    const valorLimpio = nuevoItem.trim();
    
    // 3. Evitar duplicados (ignorando mayúsculas/minúsculas)
    const existe = listaActual.some(item => item.toLowerCase() === valorLimpio.toLowerCase());
    if (existe) {
        alert("⚠️ Este ítem ya existe en la lista.");
        return;
    }

    const proyectoId = window.APP_STATE.proyectoActivo.id;
    
    try {
        const docRef = doc(db, "proyectos", proyectoId);
        await updateDoc(docRef, {
            [campoBD]: arrayUnion(valorLimpio)
        });
        
        await window.recargarListaEspecifica(campoBD, selectId);
        
        // Forzar la selección del ítem recién creado
        document.getElementById(selectId).value = valorLimpio;
        
    } catch (error) {
        console.error("Error al añadir ítem:", error);
        alert("Hubo un error de permisos o conexión al guardar.");
    }
};

window.eliminarItemLista = async function(campoBD, selectId) {
    if (!window.tienePermiso("crear_editar")) return;

    const selectElement = document.getElementById(selectId);
    const itemAEliminar = selectElement.value; // Toma el ítem que el usuario seleccionó visualmente
    
    if (!itemAEliminar) {
        alert("Primero seleccione en la lista el ítem que desea eliminar.");
        return;
    }
    
    if (!confirm(`¿Está seguro que desea eliminar definitivamente "${itemAEliminar}" del proyecto?`)) return;
    
    const proyectoId = window.APP_STATE.proyectoActivo.id;
    try {
        const docRef = doc(db, "proyectos", proyectoId);
        await updateDoc(docRef, {
            [campoBD]: arrayRemove(itemAEliminar)
        });
        
        await window.recargarListaEspecifica(campoBD, selectId);
        
    } catch (error) {
        console.error("Error al eliminar ítem:", error);
        alert("Hubo un error de permisos o conexión al eliminar.");
    }
};

window.recargarListaEspecifica = async function(campoBD, selectId) {
    const selectElement = document.getElementById(selectId);
    if (!selectElement) return;
    
    // 1. Guardar en memoria la opción que el usuario tiene seleccionada para no reiniciarla
    const seleccionActual = selectElement.value;
    
    selectElement.innerHTML = '<option value="" disabled selected>Sincronizando...</option>';
    
    try {
        const proyectoId = window.APP_STATE.proyectoActivo.id;
        const docRef = await getDoc(doc(db, "proyectos", proyectoId));
        
        if (docRef.exists()) {
            const data = docRef.data();
            let nuevaLista = data[campoBD] || [];
            
            // 2. Ordenar alfabéticamente siempre
            nuevaLista.sort((a, b) => a.localeCompare(b));
            
            // Actualizar la caché
            window.APP_STATE.proyectoActivo[campoBD] = nuevaLista;
            localStorage.setItem("INDEX_APP_STATE", JSON.stringify(window.APP_STATE));
            
            // Reconstruir opciones HTML
            selectElement.innerHTML = `<option value="" disabled ${!seleccionActual ? 'selected' : ''}>Seleccione...</option>`;
            nuevaLista.forEach(item => {
                selectElement.innerHTML += `<option value="${item}">${item}</option>`;
            });
            
            // 3. Restaurar la selección si el ítem no fue eliminado
            if (seleccionActual && nuevaLista.includes(seleccionActual)) {
                selectElement.value = seleccionActual;
            }
        }
    } catch (error) {
        console.error("Error recargando lista:", error);
        selectElement.innerHTML = '<option value="" disabled selected>Error de conexión</option>';
    }
};

// ==========================================
// REGISTRO DE TRAZABILIDAD POR FILA
// ==========================================
window.registrarCambioTraza = function(elemento) {
    const tr = elemento.closest('tr');
    if (!tr) return;

    const badge = tr.querySelector('.traza-badge');
    const dataInput = tr.querySelector('.traza-data');
    if (!badge || !dataInput) return;

    // Obtener nombre COMPLETO del usuario desde la caché global
    const nombreUsuario = window.APP_STATE?.user?.nombre || "Usuario Desconocido";
    
    // Obtener hora actual
    const ahora = new Date();
    const horaStr = ahora.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

    // Mostrar el badge visualmente con el nombre completo en lugar de iniciales
    badge.innerHTML = `<span class="material-symbols-outlined text-[10px]">history</span> Editado por ${nombreUsuario} (${horaStr})`;
    badge.classList.remove('hidden');

    // Guardar la data real en el input oculto para enviarlo a Firestore
    dataInput.value = JSON.stringify({
        usuario: nombreUsuario,
        fecha: ahora.toISOString()
    });
};

// ==========================================
// TOGGLE PARA DESMARCAR RADIO BUTTONS Y BORRAR TRAZA
// ==========================================
window.toggleRadioTraza = function(radio) {
    // Verificamos si este mismo botón ya estaba seleccionado previamente
    if (radio.getAttribute('data-last-checked') === 'true') {
        // Al hacer clic en un check ya marcado, lo desmarcamos
        radio.checked = false;
        radio.setAttribute('data-last-checked', 'false');
        
        // Buscamos la fila para borrar la huella (traza) y vaciar la memoria
        const tr = radio.closest('tr');
        if (tr) {
            const badge = tr.querySelector('.traza-badge');
            const dataInput = tr.querySelector('.traza-data');
            
            if (badge) {
                badge.innerHTML = "";
                badge.classList.add('hidden');
            }
            if (dataInput) {
                dataInput.value = "";
            }
        }
    } else {
        // Si seleccionó uno nuevo, reseteamos el estado interno de todos los de su grupo
        const hermanos = document.querySelectorAll(`input[name="${radio.name}"]`);
        hermanos.forEach(h => h.setAttribute('data-last-checked', 'false'));
        
        // Lo registramos como el botón activo actual
        radio.setAttribute('data-last-checked', 'true');
        
        // Invocamos el sellado de huella y hora
        window.registrarCambioTraza(radio);
    }
};

// ==========================================
// FIRMA DIGITAL (AUTENTICACIÓN EN UN CLIC)
// ==========================================
window.ejecutarFirmaDigital = function(tipo) {

    if (tipo === 'elaborado' && !window.tienePermiso("firmar_elaborado")) return;
    if (tipo === 'revisado' && !window.tienePermiso("firmar_revisado")) return;
    if (tipo === 'aprobado' && !window.tienePermiso("firmar_aprobado")) return;

    const user = window.APP_STATE?.user;
    if (!user || !user.nombre) {
        alert("Error: No se detectó una sesión válida.");
        return;
    }

    const capTipo = tipo.charAt(0).toUpperCase() + tipo.slice(1);
    const btn = document.getElementById(`btnFirma${capTipo}`);
    const display = document.getElementById(`firma${capTipo}Display`);
    const hiddenData = document.getElementById(`firma${capTipo}Data`);

    // 1. LÓGICA PARA REVOCAR (QUITAR) LA FIRMA
    if (hiddenData.value !== "") {
        const firmaActual = JSON.parse(hiddenData.value);
        
        // Validación de seguridad: Solo el que firmó (o un Admin) puede borrarla
        if (firmaActual.nombre !== user.nombre && user.rolUser !== "Admin") {
            alert("🔒 Acceso denegado. Solo el usuario que firmó puede revocar esta firma.");
            return;
        }
        
        if (confirm(`¿Desea revocar la firma de ${capTipo}?`)) {
            hiddenData.value = "";
            display.classList.add('hidden');
            display.classList.remove('cursor-pointer', 'hover:bg-red-50');
            display.onclick = null;
            btn.classList.remove('hidden');
            
            // Re-evaluar el estado al quitar la firma (ej. regresa a "En proceso")
            if(typeof window.evaluarEstadoProtocolo === 'function') window.evaluarEstadoProtocolo();
        }
        return;
    }

    // 2. LÓGICA PARA FIRMAR
    const ahora = new Date();
    const fechaHoraVisible = ahora.toLocaleString([], {dateStyle: 'short', timeStyle: 'short'}); 
    
    // Lee directamente el cargo mapeado desde app_core
    const cargo = user.cargo || user.rolEmpresa || "Sin cargo definido"; 

    // Guardar los datos exactos en el input oculto
    const firmaObj = {
        nombre: user.nombre,
        cargo: cargo,
        fecha: fechaHoraVisible,
        timestamp: ahora.toISOString()
    };
    hiddenData.value = JSON.stringify(firmaObj);

    // Pintar los datos en el cuadro visual
    document.getElementById(`firma${capTipo}Nombre`).innerText = user.nombre;
    document.getElementById(`firma${capTipo}Cargo`).innerText = cargo;
    document.getElementById(`firma${capTipo}Fecha`).innerText = fechaHoraVisible;

    // Cambiar la interfaz: Ocultar botón, mostrar credencial
    btn.classList.add('hidden');
    display.classList.remove('hidden');
    
    // Convertir el cuadro en un botón para revocar la firma
    display.onclick = () => window.ejecutarFirmaDigital(tipo);
    display.classList.add('cursor-pointer', 'hover:bg-red-50', 'transition');
    display.title = "Clic para revocar firma";
    
    // Evaluar el estado al firmar (ej. salta a "Liberado" si es la última firma)
    if(typeof window.evaluarEstadoProtocolo === 'function') window.evaluarEstadoProtocolo();
};

// ==========================================
// GUARDAR PROTOCOLO EN FIREBASE
// ==========================================
window.guardarProtocoloCompleto = async function(event) {
    if (!window.tienePermiso("crear_editar")) return;
    
    // Referencia al botón para animación de carga
    const btn = event ? event.currentTarget : document.querySelector('button[onclick="window.guardarProtocoloCompleto(event)"]');
    const htmlOriginal = btn ? btn.innerHTML : "Guardar Protocolo";

    try {
        // 1. Recopilar Datos Generales (La Raíz)
        const tipoProtocolo = document.getElementById('tipoProtocolo')?.value;
        const fecha = document.getElementById('protFecha')?.value;
        const correlativo = document.getElementById('protCorrelativo')?.value;
        const frente = document.getElementById('protFrente')?.value || "";
        const sector = document.getElementById('protSector')?.value || "";
        const ubicacion = document.getElementById('protUbicacion')?.value || "";
        const planoRef = document.getElementById('protPlanoRef')?.value || "";
        const elemento = document.getElementById('protElemento')?.value || "";
        const estadoFlujo = document.getElementById('protEstadoFlujo')?.value || "En proceso";

        // Validaciones básicas de campos obligatorios
        if (!tipoProtocolo) return alert("Por favor seleccione el Protocolo a Cargar.");
        if (!fecha || !correlativo || !elemento) return alert("Por favor complete Fecha, Correlativo y Elemento Específico.");

        // Iniciar estado de carga en el botón
        if (btn) {
            btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-sm">refresh</span> Guardando...';
            btn.disabled = true;
        }

        // 2. Recopilar Checklists Dinámicos directamente de la pantalla (DOM)
        const checklistsData = [];
        const seccionesDinamicas = document.querySelectorAll('#contenedorChecklistsDinamicos > div[data-seccion]');

        seccionesDinamicas.forEach(seccionDiv => {
            const secIndex = seccionDiv.getAttribute('data-seccion');
            const tituloSeccion = seccionDiv.querySelector('h3').innerText;

            // Iterar sobre las filas (items) de la tabla
            const filas = seccionDiv.querySelectorAll(`tbody tr`);
            const items = [];

            filas.forEach(tr => {
                const inputDesc = tr.querySelector('input[type="text"]');
                const radioSeleccionado = tr.querySelector('input[type="radio"]:checked');
                const inputTraza = tr.querySelector('.traza-data');
                
                let datosTraza = null;
                if (inputTraza && inputTraza.value) {
                    try { datosTraza = JSON.parse(inputTraza.value); } catch(e) {}
                }
                
                if (inputDesc && inputDesc.value.trim() !== "") {
                    items.push({
                        descripcion: inputDesc.value.trim(),
                        estado: radioSeleccionado ? radioSeleccionado.value : "NA",
                        traza: datosTraza
                    });
                }
            });

            // Extraer historial inmutable de observaciones
            const obsElements = seccionDiv.querySelectorAll(`#historial_obs_seccion_${secIndex} .obs-item`);
            const listaObservaciones = [];
            
            obsElements.forEach(el => {
                try { listaObservaciones.push(JSON.parse(el.getAttribute('data-obs'))); } catch(e) {}
            });

            const responsable = seccionDiv.querySelector(`#resp_seccion_${secIndex}`)?.value || "";
            const fechaFase = seccionDiv.querySelector(`#fecha_seccion_${secIndex}`)?.value || "";

            checklistsData.push({
                titulo: tituloSeccion,
                observaciones: listaObservaciones,
                responsable_fase: responsable,
                fecha_fase: fechaFase,
                items: items
            });
        });

        // 3. Recopilar Firmas Finales
        const extraerFirma = (tipo) => {
            const capTipo = tipo.charAt(0).toUpperCase() + tipo.slice(1);
            const hiddenInput = document.getElementById(`firma${capTipo}Data`);
            if (hiddenInput && hiddenInput.value) {
                try {
                    return JSON.parse(hiddenInput.value);
                } catch(e) {}
            }
            return { nombre: "", cargo: "", fecha: "" };
        };

        const firmasFinales = {
            elaborado: extraerFirma('elaborado'),
            revisado: extraerFirma('revisado'),
            aprobado: extraerFirma('aprobado')
        };

        // 4. Lógica de Documentos en Firebase
        const proyectoId = window.APP_STATE.proyectoActivo.id;
        const inputIdActual = document.getElementById('protocoloIdActual');
        const inputTimestampUI = document.getElementById('protocoloUltimoTimestamp');
        
        let nuevaReferencia;
        const coleccionRef = collection(db, "protocolos_calidad");

        if (inputIdActual && inputIdActual.value !== "") {
            nuevaReferencia = doc(coleccionRef, inputIdActual.value);
            
            const docSnap = await getDoc(nuevaReferencia);
            if (docSnap.exists()) {
                const dataBD = docSnap.data();
                const tiempoBD = dataBD.timestamp ? dataBD.timestamp.toDate().getTime() : 0;
                const tiempoUI = (inputTimestampUI && inputTimestampUI.value) ? parseInt(inputTimestampUI.value) : 0;
                
                if (tiempoBD > tiempoUI && tiempoUI !== 0) {
                    alert("⚠️ ALERTA DE CONFLICTO:\n\nOtro usuario ha modificado este protocolo mientras lo tenías abierto. El guardado ha sido bloqueado para no borrar su trabajo.\n\nPor favor, actualiza la página e inténtalo de nuevo.");
                    if (btn) { btn.innerHTML = htmlOriginal; btn.disabled = false; }
                    return; 
                }
            }
        } else {
            nuevaReferencia = doc(coleccionRef);
            if (inputIdActual) inputIdActual.value = nuevaReferencia.id; 
        }

        const protocoloDocumento = {
            id_proyecto: proyectoId,
            id_protocolo: nuevaReferencia.id,
            tipo_protocolo: tipoProtocolo,
            fecha_registro: fecha,
            correlativo: correlativo,
            frente: frente,
            sector: sector,
            ubicacion: ubicacion,
            plano_ref: planoRef,
            elemento: elemento,
            estado_flujo: estadoFlujo, 
            checklists: checklistsData,
            firmas_finales: firmasFinales,
            timestamp: serverTimestamp() 
        };

        // 5. Guardar en Firestore
        await setDoc(nuevaReferencia, protocoloDocumento);

        if (inputTimestampUI) inputTimestampUI.value = new Date().getTime();

        alert(`✅ Protocolo N° ${correlativo} guardado exitosamente como: ${estadoFlujo}`);
        window.switchTab('status');

    } catch (error) {
        console.error("Error al guardar el protocolo:", error);
        alert("Ocurrió un problema al guardar el documento. Revisa la consola.");
    } finally {
        if (btn) {
            btn.innerHTML = htmlOriginal;
            btn.disabled = false;
        }
    }
};

// ==========================================
// MOTOR DE ANOTACIONES Y OBSERVACIONES (BITÁCORA INMUTABLE)
// ==========================================
window.agregarObservacionFase = function(secIndex) {
    const input = document.getElementById(`input_obs_seccion_${secIndex}`);
    const selectTipo = document.getElementById(`tipo_obs_seccion_${secIndex}`);
    const texto = input.value.trim();
    if (!texto) return;

    const contenedor = document.getElementById(`historial_obs_seccion_${secIndex}`);
    const nombreUsuario = window.APP_STATE?.user?.nombre || "Usuario Desconocido";
    const ahora = new Date();
    const fechaHoraVisible = ahora.toLocaleString([], {dateStyle: 'short', timeStyle: 'short'});
    const idUnico = "obs_" + ahora.getTime();
    const tipo = selectTipo.value;

    const dataObj = {
        id: idUnico,
        usuario: nombreUsuario,
        fecha: ahora.toISOString(),
        texto: texto,
        tipo: tipo // "Anotación", "Por Levantar", "Levantado"
    };

    contenedor.appendChild(window.crearElementoObservacion(dataObj, secIndex));
    input.value = "";
    
    window.evaluarEstadoProtocolo(); // <-- Agrega esto al final
};

// ==========================================
// CREAR BLOQUE VISUAL DE OBSERVACIÓN (CON BOTÓN ELIMINAR)
// ==========================================
window.crearElementoObservacion = function(data, secIndex) {
    if (!window.tienePermiso("crear_editar")) return;
    const div = document.createElement('div');
    div.className = `obs-item border p-3 rounded-lg text-xs shadow-sm ${data.tipo === 'Por Levantar' ? 'bg-red-50 border-red-200' : (data.tipo === 'Levantado' ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200')}`;
    div.setAttribute('data-obs', JSON.stringify(data)); 
    div.id = data.id;

    // Validación de seguridad para mostrar el botón de Eliminar (X)
    const nombreUsuarioActual = window.APP_STATE?.user?.nombre;
    const esAdmin = window.APP_STATE?.user?.rol_user === "Admin";
    // Solo el creador de la anotación (o un Admin) puede ver la "X"
    const puedeEliminar = (data.usuario === nombreUsuarioActual) || esAdmin;

    let cabecera = "";
    if (data.tipo === 'Por Levantar') cabecera = `<span class="font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded text-[10px]">🔴 OBS. IMPORTANTE (POR LEVANTAR)</span>`;
    else if (data.tipo === 'Levantado') cabecera = `<span class="font-bold text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded text-[10px]">✅ OBSERVACIÓN LEVANTADA</span>`;
    else cabecera = `<span class="font-bold text-slate-600 bg-slate-200 px-2 py-0.5 rounded text-[10px]">📌 ANOTACIÓN</span>`;

    let btnEliminarHtml = puedeEliminar ? `
        <button type="button" onclick="window.eliminarObservacion('${data.id}')" class="text-slate-400 hover:text-red-600 transition" title="Eliminar este registro">
            <span class="material-symbols-outlined text-[16px]">close</span>
        </button>
    ` : '';

    let html = `
        <div class="flex justify-between items-start mb-2 border-b border-black/5 pb-1.5">
            <div class="flex flex-wrap items-center gap-2">
                ${cabecera}
                <span class="font-bold text-[10px] text-slate-700 flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">person</span> ${data.usuario}</span>
            </div>
            <div class="flex items-center gap-3">
                <span class="text-[9px] text-slate-500 font-medium">${new Date(data.fecha).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}</span>
                ${btnEliminarHtml}
            </div>
        </div>
        <p class="font-medium text-slate-800 whitespace-pre-wrap leading-relaxed">${data.texto}</p>
    `;

    // Si la observación incluye los datos de levantamiento (quién y cuándo lo solucionó)
    if (data.tipo === 'Levantado' && data.levantadoPor) {
        html += `
            <div class="mt-2 pt-2 border-t border-emerald-200/50 bg-emerald-100/50 p-2 rounded">
                <p class="text-[10px] text-emerald-800 font-bold">Solucionado por: ${data.levantadoPor.nombre}</p>
                <p class="text-[9px] text-emerald-700">Fecha: ${new Date(data.levantadoPor.fecha).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'})}</p>
            </div>
        `;
    }

    // Botón para levantar la observación si está pendiente
    if (data.tipo === 'Por Levantar') {
        html += `
            <div class="mt-3 flex justify-end">
                <button type="button" onclick="window.levantarObservacion('${data.id}', ${secIndex})" class="bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded text-[10px] font-bold flex items-center gap-1 transition">
                    <span class="material-symbols-outlined text-[12px]">task_alt</span> Levantar Observación
                </button>
            </div>
        `;
    }

    div.innerHTML = html;
    return div;
};

// ==========================================
// ELIMINAR OBSERVACIÓN (SOLO AUTOR)
// ==========================================
window.eliminarObservacion = function(obsId) {
    // CANDADO DE SEGURIDAD
    if (!window.tienePermiso("crear_editar")) return;

    if (!confirm("¿Está seguro que desea eliminar este registro?")) return;
    const obsElement = document.getElementById(obsId);
    if (obsElement) {
        obsElement.remove();
    }
};

window.levantarObservacion = function(obsId, secIndex) {
    if (!window.tienePermiso("crear_editar")) return;
    if (!confirm("¿Confirma que el defecto ha sido solucionado en campo?")) return;
    
    const obsElement = document.getElementById(obsId);
    if (!obsElement) return;

    let data = JSON.parse(obsElement.getAttribute('data-obs'));
    data.tipo = "Levantado";
    data.levantadoPor = {
        nombre: window.APP_STATE?.user?.nombre || "Usuario Desconocido",
        fecha: new Date().toISOString()
    };

    // Reemplazar el elemento visual
    const nuevoElemento = window.crearElementoObservacion(data, secIndex);
    obsElement.parentNode.replaceChild(nuevoElemento, obsElement);

    window.evaluarEstadoProtocolo(); // <-- Agrega esto al final
};

// ==========================================
// CEREBRO DEL WORKFLOW (EVALUADOR EN TIEMPO REAL)
// ==========================================
window.evaluarEstadoProtocolo = function() {
    const selectEstado = document.getElementById('protEstadoFlujo');
    const contenedorPdf = document.getElementById('contenedorPdfDigitalizado');
    if (!selectEstado) return;
    
    // Si ya está en estado Digitalizado (por base de datos), se respeta y se muestra el PDF
    if (selectEstado.value === "Digitalizado") {
        contenedorPdf.classList.remove('hidden');
        return;
    }

    let tieneObservacionesCriticas = false;
    
    // 1. Revisar si hay observaciones rojas en pantalla
    const obsElements = document.querySelectorAll('.obs-item');
    obsElements.forEach(el => {
        try {
            const data = JSON.parse(el.getAttribute('data-obs'));
            if (data.tipo === "Por Levantar") {
                tieneObservacionesCriticas = true;
            }
        } catch(e) {}
    });

    // 2. Revisar si están las 3 firmas
    const fElaborado = document.getElementById('firmaElaboradoData')?.value;
    const fRevisado = document.getElementById('firmaRevisadoData')?.value;
    const fAprobado = document.getElementById('firmaAprobadoData')?.value;
    
    const todasFirmas = (fElaborado !== "" && fRevisado !== "" && fAprobado !== "");

    // 3. Aplicar Reglas
    if (tieneObservacionesCriticas) {
        selectEstado.value = "Observado";
    } else if (todasFirmas) {
        selectEstado.value = "Liberado";
    } else {
        selectEstado.value = "En proceso";
    }
};

// ==========================================
// BUSCADOR DE PROTOCOLOS (PESTAÑA STATUS)
// ==========================================
window.buscarProtocolos = async function(forzarActualizacion = false) {
    const loading = document.getElementById('loadingStatus');
    
    // Si NO hay caché o el usuario exige actualizar, vamos a Firebase a gastar lecturas
    if (!window.PROT_CACHE_LOADED || forzarActualizacion) {
        if(loading) loading.classList.remove('hidden');
        document.getElementById('resultadosStatus').innerHTML = '';
        
        try {
            const proyectoId = window.APP_STATE.proyectoActivo.id;
            const q = query(collection(db, "protocolos_calidad"), where("id_proyecto", "==", proyectoId));
            const snap = await getDocs(q);

            window.PROT_CACHE = [];
            snap.forEach(doc => {
                let data = doc.data();
                data.id_protocolo = doc.id; // Aseguramos capturar el ID del documento
                window.PROT_CACHE.push(data);
            });

            // Ordenar del más reciente al más antiguo una sola vez al descargar
            window.PROT_CACHE.sort((a, b) => new Date(b.timestamp?.toDate() || 0) - new Date(a.timestamp?.toDate() || 0));
            window.PROT_CACHE_LOADED = true;
        } catch (error) {
            console.error("Error buscando protocolos en la nube:", error);
            document.getElementById('resultadosStatus').innerHTML = '<div class="p-4 text-red-600 font-bold text-center border border-red-200 rounded-lg bg-red-50">Ocurrió un error al buscar los datos. Revisa tu conexión.</div>';
            return; // Detener la ejecución si hay error
        } finally {
            if(loading) loading.classList.add('hidden');
        }
    }
    
    // Una vez asegurado el caché, filtramos y dibujamos en memoria (0 lecturas, 0 segundos)
    window.renderizarProtocolosDesdeCache();
};

window.renderizarProtocolosDesdeCache = function() {
    const contenedor = document.getElementById('resultadosStatus');
    const filtroDesde = document.getElementById('filtroDesde')?.value;
    const filtroHasta = document.getElementById('filtroHasta')?.value;
    const filtroEstado = document.getElementById('filtroEstado')?.value;

    if(!contenedor) return;
    contenedor.innerHTML = '';

    // 1. Filtrar la memoria RAM
    const docsFiltrados = window.PROT_CACHE.filter(prot => {
        let cumpleFecha = true;
        if (filtroDesde) cumpleFecha = cumpleFecha && (prot.fecha_registro >= filtroDesde);
        if (filtroHasta) cumpleFecha = cumpleFecha && (prot.fecha_registro <= filtroHasta);
        
        let cumpleEstado = true;
        if (filtroEstado && filtroEstado !== "") cumpleEstado = (prot.estado_flujo && prot.estado_flujo.includes(filtroEstado));
        
        return cumpleFecha && cumpleEstado;
    });

    if (docsFiltrados.length === 0) {
        contenedor.innerHTML = `
            <div class="p-8 text-center text-slate-500 font-bold bg-slate-50 rounded-xl border border-dashed border-slate-300">
                <span class="material-symbols-outlined text-4xl mb-2 text-slate-300">search_off</span>
                <p>No se encontraron protocolos con estos filtros.</p>
                <button type="button" onclick="window.buscarProtocolos(true)" class="mt-4 text-corpBlue-600 hover:text-corpBlue-700 underline text-sm transition">Forzar sincronización con la nube</button>
            </div>`;
        return;
    }

    // 2. Agrupar protocolos por tipo
    const agrupados = {};
    docsFiltrados.forEach(prot => {
        const tipo = prot.tipo_protocolo || 'Sin_Tipo';
        if (!agrupados[tipo]) agrupados[tipo] = [];
        agrupados[tipo].push(prot);
    });

    // 3. Obtener el diccionario de nombres amigables de tu app_core
    const mapaProtocolos = window.APP_STATE?.proyectoActivo?.protocolosMap || {};

    let htmlFinal = '';

    // 4. Renderizar un Acordeón por cada Tipo de Protocolo
    for (const [tipoCode, listaProt] of Object.entries(agrupados)) {
        
        // Traducir el código (ej. prot_1_aec) al nombre legible (ej. Acero, encofrado...)
        const nombreAmigable = mapaProtocolos[tipoCode] || tipoCode.replace(/_/g, ' ').toUpperCase();

        htmlFinal += `
            <details class="bg-white rounded-xl shadow-sm border border-slate-200 group mb-4" open>
                <summary class="px-6 py-4 cursor-pointer flex justify-between items-center border-b border-slate-100 bg-slate-50 rounded-t-xl hover:bg-slate-100 transition">
                    <h3 class="text-sm font-bold text-corpBlue-700 flex items-center gap-2">
                        <span class="material-symbols-outlined text-corpBlue-500">folder_open</span> 
                        ${nombreAmigable} <span class="bg-corpBlue-100 text-corpBlue-700 px-2 py-0.5 rounded-full text-xs ml-2">${listaProt.length}</span>
                    </h3>
                    <span class="material-symbols-outlined text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                </summary>
                <div class="p-4 space-y-3 bg-slate-50/50 rounded-b-xl">
        `;

        // 5. Renderizar las tarjetas dentro de su acordeón
        listaProt.forEach(prot => {
            let colorBadge = "bg-slate-100 text-slate-600";
            if(prot.estado_flujo === "Liberado") colorBadge = "bg-emerald-100 text-emerald-700";
            if(prot.estado_flujo === "Observado") colorBadge = "bg-red-100 text-red-700";
            if(prot.estado_flujo === "En proceso") colorBadge = "bg-amber-100 text-amber-700";
            if(prot.estado_flujo === "Digitalizado") colorBadge = "bg-blue-100 text-blue-700";

            htmlFinal += `
                <div class="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row justify-between items-center gap-4 hover:shadow-md transition">
                    <div class="w-full md:w-auto flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="font-black text-corpBlue-700 text-lg">#${prot.correlativo || 'N/A'}</span>
                            <span class="${colorBadge} px-2 py-0.5 rounded text-[10px] font-bold uppercase">${prot.estado_flujo || 'Desconocido'}</span>
                        </div>
                        <h4 class="text-sm font-bold text-slate-800">${nombreAmigable}</h4>
                        <p class="text-xs font-semibold text-slate-600 mt-1">${prot.elemento || 'Sin elemento'}</p>
                        <p class="text-[10px] text-slate-500 mt-1 uppercase">
                            <span class="font-bold">Fecha:</span> ${prot.fecha_registro || 'N/A'} | 
                            <span class="font-bold">Frente:</span> ${prot.frente || 'N/A'} | 
                            <span class="font-bold">Sector:</span> ${prot.sector || 'N/A'}
                        </p>
                    </div>
                    <div class="flex gap-2 w-full md:w-auto shrink-0">
                        <button onclick="window.cargarProtocoloEnPantalla('${prot.id_protocolo}')" class="w-full md:w-auto bg-slate-800 hover:bg-slate-900 text-white px-4 py-2.5 rounded-lg text-xs font-bold transition flex justify-center items-center gap-2 shadow-sm">
                            <span class="material-symbols-outlined text-[16px]">edit_document</span> Modificar
                        </button>
                    </div>
                </div>
            `;
        });

        htmlFinal += `
                </div>
            </details>
        `;
    }

    // Agregar botón discreto de actualización al final
    htmlFinal += `
        <div class="text-center mt-6 mb-4">
            <button type="button" onclick="window.buscarProtocolos(true)" class="text-xs text-slate-400 hover:text-corpBlue-600 transition flex items-center justify-center gap-1 mx-auto bg-white border border-slate-200 px-4 py-2 rounded-full shadow-sm">
                <span class="material-symbols-outlined text-[14px]">sync</span> Sincronizar últimos cambios de la nube
            </button>
        </div>`;
        
    contenedor.innerHTML = htmlFinal;
};

// ==========================================
// CARGAR PROTOCOLO PARA CONSULTA / EDICIÓN
// ==========================================
window.cargarProtocoloEnPantalla = async function(protocoloId) {
    try {
        // 1. Mostrar pantalla de carga
        const pantallaCarga = document.getElementById('pantalla-carga');
        if(pantallaCarga) pantallaCarga.classList.remove('hidden');

        // 2. Traer el documento completo desde Firebase
        const docRef = doc(db, "protocolos_calidad", protocoloId);
        const snap = await getDoc(docRef);
        
        if (!snap.exists()) {
            alert("Error: El protocolo solicitado no existe o fue eliminado.");
            if(pantallaCarga) pantallaCarga.classList.add('hidden');
            return;
        }
        
        const data = snap.data();

        // 3. Setear los Candados Ocultos (Upsert y Concurrencia)
        document.getElementById('protocoloIdActual').value = snap.id;
        document.getElementById('protocoloUltimoTimestamp').value = data.timestamp ? data.timestamp.toDate().getTime() : 0;

        // 4. Llenar Datos Generales
        document.getElementById('tipoProtocolo').value = data.tipo_protocolo;
        document.getElementById('protFecha').value = data.fecha_registro;
        document.getElementById('protCorrelativo').value = data.correlativo;
        document.getElementById('protFrente').value = data.frente || "";
        document.getElementById('protSector').value = data.sector || "";
        document.getElementById('protUbicacion').value = data.ubicacion || "";
        document.getElementById('protPlanoRef').value = data.plano_ref || "";
        document.getElementById('protElemento').value = data.elemento || "";

        // 5. Cargar la estructura visual de los checklists antes de rellenarlos
        await window.cargarPlantillaChecklist(data.tipo_protocolo);

        // 6. Rellenar las Ramas (Checklists Dinámicos y Bitácora)
        data.checklists.forEach((seccionData, secIndex) => {
            const seccionDiv = document.querySelector(`#contenedorChecklistsDinamicos > div[data-seccion="${secIndex}"]`);
            if (!seccionDiv) return;

            // A) Reconstruir Items y Huellas
            const tbody = document.getElementById(`tbody_seccion_${secIndex}`);
            if (tbody) {
                tbody.innerHTML = ""; // Limpiamos la base
                seccionData.items.forEach((itemData, itemIndex) => {
                    const tr = document.createElement('tr');
                    tr.className = "border-b border-slate-100 hover:bg-slate-50";
                    const rowId = "restored_" + itemIndex + "_" + new Date().getTime();

                    // Restaurar huella visual
                    let badgeHtml = '<span class="traza-badge hidden text-[9px] font-bold text-corpBlue-400 mt-1 flex items-center gap-1"></span>';
                    let trazaValue = '';
                    if (itemData.traza && itemData.traza.usuario) {
                        const fechaFormat = new Date(itemData.traza.fecha).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
                        badgeHtml = `<span class="traza-badge text-[9px] font-bold text-corpBlue-400 mt-1 flex items-center gap-1"><span class="material-symbols-outlined text-[10px]">history</span> Editado por ${itemData.traza.usuario} (${fechaFormat})</span>`;
                        trazaValue = JSON.stringify(itemData.traza).replace(/'/g, "&#39;");
                    }

                    tr.innerHTML = `
                        <td class="p-2 text-center font-bold text-slate-400">${itemIndex + 1}</td>
                        <td class="p-2">
                            <input type="text" value="${itemData.descripcion || ''}" onchange="window.registrarCambioTraza(this)" class="w-full p-1 bg-transparent border-b border-transparent focus:border-corpBlue-500 outline-none text-slate-800 text-xs font-medium">
                            ${badgeHtml}
                            <input type="hidden" class="traza-data" value='${trazaValue}'>
                        </td>
                        <td class="p-2 text-center"><input type="radio" name="check_${secIndex}_${rowId}" value="SI" onclick="window.toggleRadioTraza(this)" class="w-4 h-4 accent-emerald-600" ${itemData.estado === 'SI' ? 'checked data-last-checked="true"' : ''}></td>
                        <td class="p-2 text-center"><input type="radio" name="check_${secIndex}_${rowId}" value="NO" onclick="window.toggleRadioTraza(this)" class="w-4 h-4 accent-red-600" ${itemData.estado === 'NO' ? 'checked data-last-checked="true"' : ''}></td>
                        <td class="p-2 text-center"><input type="radio" name="check_${secIndex}_${rowId}" value="NA" onclick="window.toggleRadioTraza(this)" class="w-4 h-4 accent-slate-400" ${itemData.estado === 'NA' ? 'checked data-last-checked="true"' : ''}></td>
                        <td class="p-2 text-center">
                            <button type="button" onclick="this.closest('tr').remove()" class="text-slate-300 hover:text-red-500 transition"><span class="material-symbols-outlined text-sm">delete</span></button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                });
            }

            // B) Restaurar Bitácora Inmutable
            const obsContenedor = document.getElementById(`historial_obs_seccion_${secIndex}`);
            if (obsContenedor) {
                obsContenedor.innerHTML = "";
                if (seccionData.observaciones && Array.isArray(seccionData.observaciones)) {
                    seccionData.observaciones.forEach(obs => {
                        obsContenedor.appendChild(window.crearElementoObservacion(obs, secIndex));
                    });
                }
            }

            // C) Restaurar Responsables de Fase
            if (document.getElementById(`resp_seccion_${secIndex}`)) document.getElementById(`resp_seccion_${secIndex}`).value = seccionData.responsable_fase || "";
            if (document.getElementById(`fecha_seccion_${secIndex}`)) document.getElementById(`fecha_seccion_${secIndex}`).value = seccionData.fecha_fase || "";
        });

        // 7. Restaurar Firmas Finales
        const restaurarFirma = (tipo, datosFirma) => {
            const capTipo = tipo.charAt(0).toUpperCase() + tipo.slice(1);
            const btn = document.getElementById(`btnFirma${capTipo}`);
            const display = document.getElementById(`firma${capTipo}Display`);
            
            if (!datosFirma || !datosFirma.nombre) {
                // Si no hay firma, asegurarse de que el botón se muestre
                document.getElementById(`firma${capTipo}Data`).value = "";
                btn.classList.remove('hidden');
                display.classList.add('hidden');
                return;
            }
            
            document.getElementById(`firma${capTipo}Data`).value = JSON.stringify(datosFirma);
            document.getElementById(`firma${capTipo}Nombre`).innerText = datosFirma.nombre;
            document.getElementById(`firma${capTipo}Cargo`).innerText = datosFirma.cargo || "";
            document.getElementById(`firma${capTipo}Fecha`).innerText = datosFirma.fecha || "";
            
            btn.classList.add('hidden');
            display.classList.remove('hidden');
            display.onclick = () => window.ejecutarFirmaDigital(tipo);
            display.classList.add('cursor-pointer', 'hover:bg-red-50', 'transition');
            display.title = "Clic para revocar firma";
        };

        restaurarFirma('elaborado', data.firmas_finales?.elaborado);
        restaurarFirma('revisado', data.firmas_finales?.revisado);
        restaurarFirma('aprobado', data.firmas_finales?.aprobado);

        // 8. Re-evaluar Estado y redirigir a Pestaña 1
        if(typeof window.evaluarEstadoProtocolo === 'function') window.evaluarEstadoProtocolo();
        
        if(pantallaCarga) pantallaCarga.classList.add('hidden');
        
        // Magia: Mueve la vista a la pestaña de registro
        window.switchTab('registro');

    } catch (error) {
        console.error("Error al cargar el protocolo:", error);
        alert("Ocurrió un error al descargar los datos del protocolo.");
        const pantallaCarga = document.getElementById('pantalla-carga');
        if(pantallaCarga) pantallaCarga.classList.add('hidden');
    }
};

// ==========================================
// LIMPIAR FORMULARIO (NUEVO PROTOCOLO)
// ==========================================
window.limpiarFormularioProtocolo = function() {
    // 1. Limpiar identificadores ocultos (CRÍTICO para que Firebase cree un documento nuevo)
    const idActual = document.getElementById('protocoloIdActual');
    const timestamp = document.getElementById('protocoloUltimoTimestamp');
    if (idActual) idActual.value = "";
    if (timestamp) timestamp.value = "0";

    // 2. Limpiar campos generales
    const campos = ['tipoProtocolo', 'protCorrelativo', 'protUbicacion', 'protPlanoRef', 'protElemento', 'protFrente', 'protSector'];
    campos.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });

    // 3. Resetear el estado
    const estado = document.getElementById('protEstadoFlujo');
    if (estado) estado.value = "En proceso";

    // 4. Limpiar el contenedor de checklists dinámicos
    const contenedorChecklists = document.getElementById('contenedorChecklistsDinamicos');
    if (contenedorChecklists) {
        contenedorChecklists.innerHTML = `
            <div class="p-8 text-center text-slate-400 font-bold border-2 border-dashed border-slate-300 rounded-xl bg-slate-50">
                <span class="material-symbols-outlined text-4xl mb-2">fact_check</span>
                <p>Seleccione un tipo de protocolo en los datos generales para cargar su estructura de inspección.</p>
            </div>
        `;
    }

    // 5. Resetear botones de Firmas
    ['Elaborado', 'Revisado', 'Aprobado'].forEach(tipo => {
        if (document.getElementById(`firma${tipo}Data`)) document.getElementById(`firma${tipo}Data`).value = "";
        if (document.getElementById(`btnFirma${tipo}`)) document.getElementById(`btnFirma${tipo}`).classList.remove('hidden');
        if (document.getElementById(`firma${tipo}Display`)) document.getElementById(`firma${tipo}Display`).classList.add('hidden');
    });

    // 6. Mover al usuario a la pestaña de registro
    window.switchTab('registro');
};

// ==========================================
// 5. PESTAÑA: PREVISUALIZAR Y GENERAR REPORTE PDF
// ==========================================

let pdfBlobGeneradoProtocolo = null;
let CURRENT_PROT_PREVIEW = null;

window.generarDossierPdfProtocolo = async function() {
    if (!window.tienePermiso("crear_editar")) return;
    
    // Obtener el ID del protocolo desde el selector de la pestaña Reportes
    const select = document.getElementById('reporteProtocoloSelect');
    const docId = select ? select.value : '';

    if (!docId) return alert("⚠️ Por favor, seleccione un protocolo de la lista superior.");

    const btn = document.querySelector('button[onclick="window.generarDossierPdfProtocolo()"]');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">refresh</span> Compilando Dossier...`;

    try {
        // 1. Obtener la data completa desde Firestore
        const obsRef = doc(db, "protocolos_calidad", docId);
        const obsSnap = await getDoc(obsRef);

        if (!obsSnap.exists()) return alert("Error: No se encontró el protocolo en la base de datos.");

        const data = obsSnap.data();
        data._docId = obsSnap.id;
        CURRENT_PROT_PREVIEW = data;

        // 2. Preparar los datos corporativos
        let logoB64 = null;
        if (window.APP_STATE.empresa?.logo) {
            try {
                // Función auxiliar simplificada para convertir logo a Base64
                const response = await fetch(window.APP_STATE.empresa.logo);
                if (response.ok) {
                    const blob = await response.blob();
                    logoB64 = await new Promise(resolve => {
                        const reader = new FileReader();
                        reader.onloadend = () => resolve(reader.result);
                        reader.readAsDataURL(blob);
                    });
                }
            } catch (e) { console.warn("No se pudo cargar el logo:", e); }
        }

        // Obtener nombres completos del diccionario
        const dictEmpresas = JSON.parse(localStorage.getItem("INDEX_EMPRESAS_DICT") || "{}");
        const nombreCliente = dictEmpresas[window.APP_STATE.proyectoActivo.idClienteOficial] || window.APP_STATE.proyectoActivo.cliente || "No especificado";
        const nombreSupervision = dictEmpresas[window.APP_STATE.proyectoActivo.idSupervisionOficial] || window.APP_STATE.proyectoActivo.supervision || "No especificado";
        const nombreContratista = window.APP_STATE.empresa?.nombre || "EMPRESA CONTRATISTA";

        // Obtener nombre amigable del protocolo
        const mapaProtocolos = window.APP_STATE.proyectoActivo.protocolosMap || {};
        const nombreAmigable = mapaProtocolos[data.tipo_protocolo] || data.tipo_protocolo.replace(/_/g, ' ').toUpperCase();

        // 3. Estructurar el JSON exacto que espera la plantilla
        const datosPlantilla = {
            logo: logoB64,
            proyecto: {
                nombre: window.APP_STATE.proyectoActivo.nombre,
                cliente: nombreCliente,
                supervision: nombreSupervision,
                contratista: nombreContratista
            },
            protocolo: {
                codigo_visible: nombreAmigable,
                correlativo: data.correlativo || "-",
                fecha_inspeccion: data.fecha_registro || "-",
                frente: data.frente || "-",
                sector: data.sector || "-",
                ubicacion_ejes: data.ubicacion || "-",
                plano_referencia: data.plano_ref || "-",
                elemento_liberar: data.elemento || "-",
                estado: data.estado_flujo || "En proceso"
            },
            checklists: data.checklists || [],
            firmas: data.firmas_finales || {}
        };

        // 4. Búsqueda e Inyección de la Plantilla JavaScript (Diseño pdfMake)
        let generarDocDefinition;
        const idEmpresa = window.APP_STATE.empresa?.id || 'EMP00001';
        
        try {
            // Busca el diseño de PDF corporativo de la empresa actual (Ej: EMP00002.js)
            const modulo = await import(`./js/templates/protocolos_calidad/${idEmpresa}.js`);
            generarDocDefinition = modulo.generarDocDefinition;
            
        } catch (e) {
            console.warn(`Plantilla PDF específica no encontrada para ${idEmpresa}. Cargando diseño por defecto.`, e);
            // Si la empresa no tiene un diseño único, usa la base EMP00002.js
            const modulo = await import(`./js/templates/protocolos_calidad/EMP00002.js`);
            generarDocDefinition = modulo.generarDocDefinition;
        }

        // 5. Compilar PDF Vectorial
        const docDefinition = generarDocDefinition(datosPlantilla);
        const pdfDoc = pdfMake.createPdf(docDefinition);

        pdfDoc.getBlob((blob) => {
            pdfBlobGeneradoProtocolo = blob;
            const pdfUrl = URL.createObjectURL(blob);

            const rootCont = document.getElementById('pdfContenedorRaiz');
            if(!rootCont) return;

            // Detección de celular para no forzar iframes pesados
            const esCelular = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            
            if (esCelular) {
                rootCont.innerHTML = `
                    <div class="text-center p-6 bg-slate-50 rounded-xl w-full border border-slate-300 h-full flex flex-col justify-center items-center">
                        <span class="material-symbols-outlined text-5xl text-corpBlue-600 mb-2">picture_as_pdf</span>
                        <p class="text-slate-700 font-bold mb-1 text-base">PDF Compilado Exitosamente</p>
                        <p class="text-slate-500 text-xs mb-4">La vista previa incrustada no está disponible en móviles.</p>
                        <a href="${pdfUrl}" target="_blank" class="bg-corpBlue-600 text-white font-bold py-3 px-8 rounded-lg text-sm shadow-md flex items-center gap-2">
                            <span class="material-symbols-outlined text-[18px]">visibility</span> Abrir Documento
                        </a>
                    </div>`;
            } else {
                rootCont.innerHTML = `<iframe src="${pdfUrl}" class="w-full h-full rounded-xl shadow-md border border-slate-300"></iframe>`;
            }

            rootCont.classList.remove('hidden');
            rootCont.classList.add('flex');
        });

    } catch (error) {
        console.error("Error al generar PDF de Protocolo:", error);
        alert("Error crítico al compilar el documento: " + error.message);
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
};

window.cargarComboProtocolos = async function(filtro = "") {
    // Si el caché no está cargado (porque el usuario entró directo a esta pestaña), lo forzamos
    if (!window.PROT_CACHE_LOADED) {
        await window.buscarProtocolos(false);
    }

    const select = document.getElementById('reporteProtocoloSelect');
    if (!select) return;

    const textoBusqueda = filtro.toLowerCase().trim();
    let optionsHtml = '<option value="" disabled selected>Seleccione un protocolo para compilar...</option>';

    // Obtener el diccionario de nombres amigables
    const mapaProtocolos = window.APP_STATE?.proyectoActivo?.protocolosMap || {};

    window.PROT_CACHE.forEach(prot => {
        const nombreAmigable = mapaProtocolos[prot.tipo_protocolo] || prot.tipo_protocolo;
        
        // Etiqueta visual para que el usuario sepa si está imprimiendo algo ya liberado
        let badge = '[PROCESO]';
        if (prot.estado_flujo === 'Liberado') badge = '[LIBERADO]';
        else if (prot.estado_flujo === 'Observado') badge = '[OBSERVADO]';
        else if (prot.estado_flujo === 'Digitalizado') badge = '[DIGITALIZ]';

        // Cadena invisible para que el buscador encuentre coincidencias por número, frente o sector
        const cadenaInvisible = `${prot.correlativo} ${nombreAmigable} ${prot.estado_flujo} ${prot.frente} ${prot.sector} ${prot.elemento}`.toLowerCase();
        
        if (textoBusqueda === "" || cadenaInvisible.includes(textoBusqueda)) {
            optionsHtml += `<option value="${prot.id_protocolo}">${badge} #${prot.correlativo} - ${nombreAmigable} (${prot.frente} / ${prot.sector})</option>`;
        }
    });

    select.innerHTML = optionsHtml;
};