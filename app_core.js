// ==========================================
// app_core.js - NÚCLEO CENTRAL DE LA APLICACIÓN
// ==========================================

// 1. Importar herramientas de Firebase (Versión unificada)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// 2. Configuración única de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyCiTCag6lwIZcwjnAHPDf0ANaBX0B7DYlY",
    authDomain: "indexscorp.firebaseapp.com",
    projectId: "indexscorp",
    storageBucket: "indexscorp.firebasestorage.app",
    messagingSenderId: "925382774481",
    appId: "1:925382774481:web:19a3bcbc23bfc89fecbff0"
};

// 3. Inicializar Firebase (Solo se ejecuta una vez)
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

// 4. Estructura base del Estado Global
window.APP_STATE = {
    user: {},
    empresa: {},
    proyectoActivo: {}
};

/**
 * Intenta cargar los datos desde la memoria local del teléfono/PC.
 * Retorna true si encontró caché, false si está vacío.
 */
function cargarEstadoDesdeCache() {
    const cache = localStorage.getItem("INDEX_APP_STATE");
    if (cache) {
        window.APP_STATE = JSON.parse(cache);
        return true;
    }
    return false;
}

/**
 * Función principal que arranca la aplicación.
 * @param {boolean} requiereProyecto - Si es 'true', fuerza la carga de los datos del proyecto (usado en micro-apps).
 */
export function initAppCore(requiereProyecto = true) {
    return new Promise((resolve, reject) => {
        
        // Verificamos si hay un ID de proyecto en la URL
        const urlParams = new URLSearchParams(window.location.search);
        const urlProjectId = urlParams.get('projectId');
        
        const tieneCache = cargarEstadoDesdeCache();

        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                // Si no hay usuario logueado, limpiamos caché y mandamos al login
                localStorage.removeItem("INDEX_APP_STATE");
                if (!window.location.pathname.includes('login.html') && !window.location.pathname.includes('index.html')) {
                    window.location.href = "index.html"; // O login.html dependiendo de tu estructura
                }
                resolve(null);
                return;
            }

            // ¿Necesitamos consultar la base de datos?
            // Sí, si no hay caché, o si el proyecto de la URL es distinto al proyecto guardado en caché
            const necesitaActualizarBD = !tieneCache || (requiereProyecto && urlProjectId && window.APP_STATE.proyectoActivo.id !== urlProjectId);

            if (necesitaActualizarBD) {
                try {
                    // A. Consultar Usuario (Permisos y Firmas)
                    const userDoc = await getDoc(doc(db, "usuarios", user.uid));
                    if (!userDoc.exists()) throw new Error("Usuario no encontrado en la base de datos.");
                    const userData = userDoc.data();

                    window.APP_STATE.user = {
                        uid: user.uid,
                        email: userData.email_user || user.email,
                        nombre: userData.name_user || "Usuario Desconocido",
                        cargo: userData.cargo_user || "Sin Cargo",
                        rolUser: userData.rol_user || "Usuario",
                        rolEmpresa: userData.rol_empresa || "Personal",
                        idEmpresa: userData.id_empresa || "",
                        firmaUrl: userData.firma_user || "",
                        proyectosPermitidos: userData.proyect_user || ""
                    };

                    // B. Consultar Empresa (Si el usuario tiene una asignada)
                    if (window.APP_STATE.user.idEmpresa) {
                        const empDoc = await getDoc(doc(db, "empresas", window.APP_STATE.user.idEmpresa));
                        if (empDoc.exists()) {
                            const empData = empDoc.data();
                            window.APP_STATE.empresa = {
                                id: empDoc.id,
                                nombre: empData.nombre_empresa || "",
                                logo: empData.logo_empresa || ""
                            };
                        }
                    }

                    // C. Consultar Proyecto (Solo si la pantalla lo requiere y hay un ID en la URL)
                    if (requiereProyecto && urlProjectId) {
                        const proyDoc = await getDoc(doc(db, "proyectos", urlProjectId));
                        if (proyDoc.exists()) {
                            const proyData = proyDoc.data();

                            // 1. Extraer los IDs relacionales del documento del proyecto
                            const idCliente = proyData.client_proyect || "";
                            const idContratista = proyData.contratista_proyect || "";
                            const idSupervision = proyData.supervision_proyect || "";

                            // 2. Función auxiliar interna para traer el nombre desde la colección "empresas"
                            const buscarNombreEmpresa = async (idEmpresaBusqueda) => {
                                if (!idEmpresaBusqueda) return "";
                                try {
                                    const empRef = await getDoc(doc(db, "empresas", idEmpresaBusqueda));
                                    if (empRef.exists()) {
                                        return empRef.data().nombre_empresa || "";
                                    }
                                } catch (e) {
                                    console.warn(`No se pudo leer la empresa ${idEmpresaBusqueda}`, e);
                                }
                                return ""; // Retorna vacío si no existe o hay error
                            };

                            // 3. Consultar las 3 empresas EN PARALELO para no perder milisegundos
                            const [nombreCliente, nombreContratista, nombreSupervision] = await Promise.all([
                                buscarNombreEmpresa(idCliente),
                                buscarNombreEmpresa(idContratista),
                                buscarNombreEmpresa(idSupervision)
                            ]);

                            // 4. Guardar en caché el objeto final ya "masticado"
                            window.APP_STATE.proyectoActivo = {
                                id: proyDoc.id,
                                nombre: proyData.name_proyect || urlProjectId,
                                frentes: proyData.frentes || [],
                                sectores: proyData.sectores || [],
                                especialidades: proyData.especialidad || [],
                                rubrosMap: proyData.rubrosmap || {},
                                
                                // Nombres YA TRADUCIDOS listos para imprimir en el PDF
                                cliente: nombreCliente,
                                contratista: nombreContratista,
                                supervision: nombreSupervision,
                                
                                // Guardamos los IDs originales por si la micro-app los necesita después
                                idClienteOficial: idCliente,
                                idContratistaOficial: idContratista,
                                idSupervisionOficial: idSupervision,
                                
                                correosPara: proyData.correos_Para || "",
                                correosCC: proyData.correos_cc || ""
                            };
                        }
                    }

                    // Guardar el estado consolidado en la memoria local
                    localStorage.setItem("INDEX_APP_STATE", JSON.stringify(window.APP_STATE));

                } catch (error) {
                    console.error("Error al sincronizar el Core:", error);
                    reject(error);
                    return;
                }
            }

            // --- ACTUALIZACIÓN DE UI GLOBAL ---
            actualizarUiGlobal();

            // Retornamos el estado completo para que la micro-app lo use
            resolve(window.APP_STATE);
        });
    });
}

/**
 * Actualiza los elementos comunes del HTML (Nombres, logos, iniciales en la barra superior)
 */
function actualizarUiGlobal() {
    const user = window.APP_STATE.user;
    const iniciales = user.nombre ? user.nombre.substring(0, 2).toUpperCase() : "US";
    
    // Navbar y Dropdowns
    const initialsBtn = document.getElementById("nav-user-initials");
    if (initialsBtn) initialsBtn.textContent = iniciales;

    const nameLabel = document.getElementById("dropdown-user-name");
    if (nameLabel) nameLabel.textContent = user.nombre;

    const rolLabel = document.getElementById("dropdown-user-rol");
    if (rolLabel) rolLabel.textContent = `${user.cargo} (${user.rolEmpresa})`;

    // Nombre del proyecto en el Sidebar
    const projNameLabel = document.getElementById('sidebar-project-name');
    if (projNameLabel && window.APP_STATE.proyectoActivo.nombre) {
        projNameLabel.textContent = window.APP_STATE.proyectoActivo.nombre;
    }
}

// ==========================================
// FUNCIONES GLOBALES REUTILIZABLES (Enlazadas a window)
// ==========================================

window.cerrarSesionGlobal = function() {
    signOut(auth).then(() => {
        localStorage.removeItem("INDEX_APP_STATE");
        window.location.href = "index.html"; // O a tu página de login
    });
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    if (sidebar && overlay) {
        sidebar.classList.toggle('-translate-x-full');
        sidebar.classList.toggle('translate-x-0');
        overlay.classList.toggle('hidden');
    }
};

window.toggleUserMenu = function() {
    const menu = document.getElementById('user-menu');
    if (menu) menu.classList.toggle('hidden');
};