import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCiTCag6lwIZcwjnAHPDf0ANaBX0B7DYlY",
    authDomain: "indexscorp.firebaseapp.com",
    projectId: "indexscorp",
    storageBucket: "indexscorp.firebasestorage.app",
    messagingSenderId: "925382774481",
    appId: "1:925382774481:web:19a3bcbc23bfc89fecbff0"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const urlParams = new URLSearchParams(window.location.search);
const CURRENT_PROJECT_ID = urlParams.get('projectId');
const CURRENT_PATH = window.location.pathname;

document.addEventListener("DOMContentLoaded", () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await renderizarSidebarGlobal(user);
        }
    });
});

async function renderizarSidebarGlobal(usuarioAuth) {
    const container = document.getElementById('sidebar');
    if (!container) return;

    let proyectos = [];
    let proyectoActualData = null;
    let logoEmpresa = "";
    let nombreEmpresa = "";
    let datosUsuario = null;
    let aplicacionesRenderizadas = "";

    try {
        // 1. Obtener perfil del usuario
        const userDocSnap = await getDoc(doc(db, "usuarios", usuarioAuth.uid));
        if (userDocSnap.exists()) {
            datosUsuario = userDocSnap.data();
        } else {
            return; 
        }

        const idEmpresaUsuario = datosUsuario.id_empresa;
        const rolUsuario = datosUsuario.rol_user;
        const proyectosPermitidosRaw = datosUsuario.proyect_user || "";
        const listaProyectosPermitidos = proyectosPermitidosRaw.split(/[,;]/).map(p => p.trim()).filter(p => p !== "");

        // 2. Traer logo y nombre de la empresa
        if (idEmpresaUsuario) {
            const empresaSnap = await getDoc(doc(db, "empresas", idEmpresaUsuario));
            if (empresaSnap.exists()) {
                const empData = empresaSnap.data();
                logoEmpresa = empData.logo_empresa || "";
                nombreEmpresa = empData.nombre_empresa || "";
            }
        }

        // 3. Cargar proyectos
        const proyectosQuery = query(collection(db, "proyectos"), where("id_empresa", "==", idEmpresaUsuario));
        const querySnapshot = await getDocs(proyectosQuery);
        
        querySnapshot.forEach((docSnap) => {
            if (rolUsuario === "Admin" || listaProyectosPermitidos.includes(docSnap.id)) {
                const data = docSnap.data();
                proyectos.push({ id: docSnap.id, ...data });
                if (docSnap.id === CURRENT_PROJECT_ID) {
                    proyectoActualData = data;
                }
            }
        });

        // 4. GENERACIÓN DINÁMICA DE APLICACIONES (NUEVO)
        if (proyectoActualData && proyectoActualData.apps && proyectoActualData.apps.length > 0) {
            // Agrupar apps permitidas por su categoría (Comunicación, Calidad, etc.)
            let categoriasApps = {}; 
            
            for (const idApp of proyectoActualData.apps) {
                const docApp = await getDoc(doc(db, "apps", idApp));
                if (docApp.exists()) {
                    const a = docApp.data();
                    const cat = a.category_app || "General";
                    
                    if (!categoriasApps[cat]) {
                        categoriasApps[cat] = {
                            icono: obtenerIconoCategoria(cat),
                            apps: []
                        };
                    }
                    
                    categoriasApps[cat].apps.push({
                        id: idApp,
                        nombre: a.name_app,
                        icono: a.icon_app,
                        html: a.archivohtml_app
                    });
                }
            }

            // Construir el HTML de los Acordeones de Apps
            for (const [categoria, dataCat] of Object.entries(categoriasApps)) {
                // Verificar si alguna app de esta categoría está abierta actualmente
                const isOpen = dataCat.apps.some(app => CURRENT_PATH.includes(app.html));
                
                aplicacionesRenderizadas += `
                <details class="group mb-1" ${isOpen ? 'open' : ''}>
                    <summary class="flex items-center justify-between px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer list-none">
                        <span class="flex items-center gap-2">
                            <span class="material-symbols-outlined text-[20px] text-slate-500">${dataCat.icono}</span> ${categoria}
                        </span>
                        <span class="material-symbols-outlined text-[16px] text-slate-400 group-open:rotate-180 transition-transform">expand_more</span>
                    </summary>
                    <div class="pl-8 pt-1 pb-2 space-y-1">
                        ${dataCat.apps.map(a => {
                            const isAppActive = CURRENT_PATH.includes(a.html);
                            return `
                            <a href="${a.html}?projectId=${CURRENT_PROJECT_ID}&appId=${a.id}" class="flex items-center gap-2 py-1.5 px-2 text-xs rounded transition ${isAppActive ? 'font-bold text-corpBlue-600 bg-slate-100' : 'text-slate-600 hover:text-slate-900'}">
                                ${a.nombre}
                            </a>`;
                        }).join('')}
                    </div>
                </details>`;
            }
        }

    } catch (e) {
        console.error("Error al cargar datos para el sidebar:", e);
    }

    const nombreProyectoActual = proyectoActualData ? (proyectoActualData.name_proyect || CURRENT_PROJECT_ID) : "Portal General";

    // 5. Construcción Final del HTML (Ajuste visual de altura min-h-[128px])
    container.innerHTML = `
        <div class="px-6 py-6 flex flex-col items-center justify-center border-b border-slate-200 bg-slate-50 text-center shrink-0 min-h-[128px]">
            ${logoEmpresa 
                ? `<img src="${logoEmpresa}" class="h-12 object-contain mb-2" alt="${nombreEmpresa}">`
                : `<div class="h-10 w-10 bg-corpBlue-100 text-corpBlue-600 rounded-full flex items-center justify-center mb-1"><span class="material-symbols-outlined text-xl">domain</span></div>`
            }
            
            ${CURRENT_PROJECT_ID ? `
                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Proyecto Activo</span>
                <h2 class="text-sm font-bold text-slate-800 leading-tight">${nombreProyectoActual}</h2>
            ` : `
                <h2 class="text-sm font-bold text-slate-800">${nombreEmpresa || 'Panel de Control'}</h2>
                <span class="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Portal General</span>
            `}
        </div>

        <div class="p-4 flex-1 overflow-y-auto space-y-6">
            <!-- Sección Portal Principal -->
            <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Navegación</p>
                <button onclick="window.irAlPanelPrincipal()" class="w-full text-left flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition ${!CURRENT_PROJECT_ID ? 'bg-slate-100 font-bold text-corpBlue-600' : ''}">
                    <span class="material-symbols-outlined text-[20px]">grid_view</span> Panel Principal
                </button>
            </div>

            <!-- Sección Proyectos con Buscador -->
            <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Mis Proyectos</p>
                <div class="relative mb-2">
                    <input type="text" id="sidebarSearchInput" placeholder="Buscar proyecto..." class="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg outline-none focus:border-corpBlue-500">
                    <span class="material-symbols-outlined absolute left-2 top-2 text-slate-400 text-[16px]">search</span>
                </div>
                <div id="sidebarProjectList" class="space-y-1 max-h-40 overflow-y-auto pr-1">
                    ${proyectos.map(p => `
                        <button onclick="window.cambiarProyectoNavegacion('${p.id}')" class="w-full text-left px-2.5 py-2 text-xs rounded-lg flex items-center justify-between transition ${p.id === CURRENT_PROJECT_ID ? 'bg-corpBlue-50 font-bold text-corpBlue-600' : 'text-slate-600 hover:bg-slate-100'}">
                            <span class="truncate pr-2">${p.name_proyect || p.id}</span>
                            <span class="w-2 h-2 rounded-full ${p.state_proyect === 'Activo' ? 'bg-emerald-500' : 'bg-amber-500'} shrink-0"></span>
                        </button>
                    `).join('')}
                    ${proyectos.length === 0 ? '<p class="text-xs text-slate-400 italic text-center py-2">Sin proyectos asignados</p>' : ''}
                </div>
            </div>

            <!-- Sección Aplicaciones PMBOK -->
            ${CURRENT_PROJECT_ID ? `
            <div>
                <p class="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Aplicaciones (PMBOK)</p>
                ${aplicacionesRenderizadas ? aplicacionesRenderizadas : '<p class="text-xs text-slate-400 italic px-2">No hay aplicaciones vinculadas a este proyecto.</p>'}
            </div>
            ` : ''}
        </div>
    `;

    // 6. Evento de Búsqueda
    const searchInput = document.getElementById('sidebarSearchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const buttons = document.querySelectorAll('#sidebarProjectList button');
            buttons.forEach(btn => {
                const text = btn.innerText.toLowerCase();
                btn.style.display = text.includes(term) ? 'flex' : 'none';
            });
        });
    }
}

// Función auxiliar para asignar íconos según categoría PMBOK
function obtenerIconoCategoria(categoria) {
    const iconos = {
        "Comunicación": "forum",
        "Calidad": "verified",
        "Seguridad": "health_and_safety",
        "Costos": "payments",
        "Cronograma": "calendar_month",
        "Recursos": "groups",
        "Riesgos": "warning"
    };
    return iconos[categoria] || "apps";
}

window.cambiarProyectoNavegacion = function(newProjectId) {
    const currentPath = window.location.pathname;
    if (currentPath.includes('index.html') || currentPath.endsWith('/')) {
        window.location.href = `reporte_diario.html?projectId=${newProjectId}`;
    } else {
        window.location.href = `${currentPath}?projectId=${newProjectId}`;
    }
};

window.irAlPanelPrincipal = function() {
    const currentPath = window.location.pathname;
    // Si ya estamos en el index, simplemente usamos la función de index.js para ocultar apps y mostrar proyectos
    if (currentPath.includes('index.html') || currentPath.endsWith('/')) {
        if (typeof window.volverAProyectos === 'function') {
            window.volverAProyectos();
        }
        // Cerrar el sidebar en móviles al navegar
        if (typeof window.toggleSidebar === 'function') {
            window.toggleSidebar();
        }
    } else {
        // Si estamos en otra app (ej: reporte_diario.html), redirigimos al index
        window.location.href = 'index.html';
    }
};