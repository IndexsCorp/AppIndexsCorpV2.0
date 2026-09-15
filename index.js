// ==========================================
// index.js - PORTAL PRINCIPAL
// ==========================================

// 1. Importar desde nuestro núcleo central en lugar de inicializar Firebase de nuevo
import { auth, db, initAppCore } from "./app_core.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, getDocs, doc, getDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Variable local para la navegación en el portal
let proyectoActual = null;

// --- INICIALIZACIÓN ---
document.addEventListener('DOMContentLoaded', () => {
    // Manejo de caché de credenciales (para autocompletar el login)
    const savedUser = localStorage.getItem('indexCorp_user');
    const savedPass = localStorage.getItem('indexCorp_pass');
    if(savedUser && savedPass) {
        document.getElementById('user-input').value = savedUser;
        document.getElementById('pass-input').value = savedPass;
        document.getElementById('recordar').checked = true;
    }

    const btnLogin = document.getElementById('btn-login');
    if (btnLogin) btnLogin.addEventListener('click', iniciarSesion);

    // Arrancamos el AppCore pasándole 'false' porque en el index no necesitamos cargar un proyecto específico todavía
    initAppCore(false).then((estadoGlobal) => {
        const pantallaCarga = document.getElementById('pantalla-carga');
        const bloqueLogin = document.getElementById('bloque-login');

        if (estadoGlobal && estadoGlobal.user.uid) {
            // Usuario con sesión activa
            bloqueLogin.classList.add('hidden');
            document.getElementById('navbar-global').classList.remove('hidden');
            document.getElementById('bloque-proyectos').classList.remove('hidden');
            document.getElementById('bloque-apps').classList.add('hidden');
            
            window.cargarProyectos();
            
            if(pantallaCarga) pantallaCarga.classList.add('hidden');
        } else {
            // Usuario sin sesión (Mostrar Login)
            bloqueLogin.classList.remove('hidden');
            bloqueLogin.classList.add('flex');
            if(pantallaCarga) pantallaCarga.classList.add('hidden');
        }
    }).catch(error => {
        console.error("Error al inicializar la app:", error);
        alert("Hubo un problema de conexión. Intente actualizar la página.");
    });
});

// --- LÓGICA DE LOGIN ---
function iniciarSesion() {
    const usuario = document.getElementById('user-input').value.trim();
    const pass = document.getElementById('pass-input').value.trim();
    const recordar = document.getElementById('recordar').checked;
    const btn = document.getElementById('btn-login');
    
    if(!usuario || !pass) {
        alert("Por favor, ingresa tu usuario y contraseña.");
        return;
    }

    btn.innerHTML = 'Cargando... <span class="material-symbols-outlined text-lg animate-spin">refresh</span>';
    btn.disabled = true;

    signInWithEmailAndPassword(auth, usuario, pass)
        .then(() => {
            if(recordar) {
                localStorage.setItem('indexCorp_user', usuario);
                localStorage.setItem('indexCorp_pass', pass);
            } else {
                localStorage.removeItem('indexCorp_user');
                localStorage.removeItem('indexCorp_pass');
            }
            // Recargamos la página para que el initAppCore detecte la nueva sesión
            window.location.reload(); 
        })
        .catch((error) => {
            alert("Error de inicio de sesión: Verifique sus credenciales.");
            console.error("Detalle:", error);
            btn.innerHTML = 'Ingresar <span class="material-symbols-outlined text-lg">login</span>';
            btn.disabled = false;
        });
}

// --- CARGAR PROYECTOS (FILTRADOS POR PERMISOS Y EMPRESA) ---
window.cargarProyectos = async function() {
    const contenedor = document.getElementById('contenedor-proyectos');
    contenedor.innerHTML = '<div class="col-span-full flex items-center gap-2 text-slate-500"><span class="material-symbols-outlined animate-spin">refresh</span> Consultando base de datos...</div>';
    
    try {
        // Tomamos los datos del usuario logueado directamente del estado global en caché
        const user = window.APP_STATE.user;
        let proyectosQuery;
        
        // Si el usuario pertenece a una empresa, solo vemos los proyectos de esa empresa
        if (user.idEmpresa) {
            proyectosQuery = query(collection(db, "proyectos"), where("id_empresa", "==", user.idEmpresa));
        } else {
            proyectosQuery = collection(db, "proyectos"); 
        }

        const querySnapshot = await getDocs(proyectosQuery);
        let html = '';
        
        if(querySnapshot.empty) {
            html = '<p class="text-slate-500 col-span-full">No tienes proyectos asignados en este momento.</p>';
        } else {
            // Filtramos qué proyectos puede ver específicamente según su arreglo proyect_user
            const listaPermitidos = user.proyectosPermitidos ? user.proyectosPermitidos.split(/[,;]/).map(p => p.trim()).filter(p => p !== "") : [];
            const esAdmin = user.rolUser === "Admin";

            let proyectosMostrados = 0;

            querySnapshot.forEach((docSnap) => {
                if (esAdmin || listaPermitidos.includes(docSnap.id)) {
                    proyectosMostrados++;
                    const p = docSnap.data();
                    const id = docSnap.id;
                    const badgeColor = p.state_proyect === 'Activo' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700';
                    const badgeIcon = p.state_proyect === 'Activo' ? 'check_circle' : 'pending';

                    html += `
                    <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition-shadow group flex flex-col">
                        <div class="flex justify-between items-start mb-4">
                            <span class="bg-slate-100 text-slate-600 text-xs font-bold px-2.5 py-1 rounded-md">${id}</span>
                            <span class="${badgeColor} text-[11px] font-bold px-2 py-1 rounded-full flex items-center gap-1">
                                <span class="material-symbols-outlined text-[14px]">${badgeIcon}</span> ${p.state_proyect}
                            </span>
                        </div>
                        <h3 class="text-lg font-bold text-slate-800 mb-1">${p.name_proyect}</h3>
                        <p class="text-sm text-slate-500 flex items-center gap-1 mb-6 flex-grow">
                            <span class="material-symbols-outlined text-[16px]">location_on</span> ${p.ubi_proyect}
                        </p>
                        <button onclick="window.abrirProyecto('${id}', '${p.name_proyect}')" class="w-full bg-slate-50 hover:bg-corpBlue-50 text-corpBlue-600 border border-slate-200 hover:border-teal-200 font-bold py-2 rounded-lg transition flex justify-center items-center gap-2 text-sm">
                            <span class="material-symbols-outlined text-[18px]">apps</span> Ver Aplicaciones
                        </button>
                    </div>`;
                }
            });

            if (proyectosMostrados === 0) {
                html = '<p class="text-slate-500 col-span-full">No tienes proyectos asignados en este momento.</p>';
            }
        }
        contenedor.innerHTML = html;
    } catch (error) {
        console.error("Error cargando proyectos:", error);
        contenedor.innerHTML = `<p class="text-red-500 col-span-full">Error al cargar proyectos.</p>`;
    }
};

// --- CARGAR APPS POR PROYECTO ---
window.cargarApps = async function(idProyecto) {
    const contenedor = document.getElementById('contenedor-apps');
    contenedor.innerHTML = '<div class="col-span-full flex items-center gap-2 text-slate-500"><span class="material-symbols-outlined animate-spin">refresh</span> Cargando aplicaciones...</div>';

    try {
        const docProyecto = await getDoc(doc(db, "proyectos", idProyecto));
        
        if (!docProyecto.exists() || !docProyecto.data().apps) {
            contenedor.innerHTML = '<p class="text-slate-500 col-span-full">No hay aplicaciones habilitadas para este proyecto.</p>';
            return;
        }

        const idsAppsPermitidas = docProyecto.data().apps;
        let html = '';

        for (const idApp of idsAppsPermitidas) {
            const docApp = await getDoc(doc(db, "apps", idApp));
            
            if (docApp.exists()) {
                const a = docApp.data();
                html += `
                <button onclick="window.abrirApp('${a.archivohtml_app}', '${idApp}')" class="bg-white rounded-xl p-6 shadow-sm border border-slate-200 hover:shadow-md hover:border-teal-300 transition-all flex flex-col items-center text-center group w-full">
                    <div class="w-16 h-16 bg-corpBlue-50 text-corpBlue-600 rounded-full flex items-center justify-center mb-4 group-hover:bg-corpBlue-500 group-hover:text-white transition-colors">
                        <span class="material-symbols-outlined text-3xl">${a.icon_app}</span>
                    </div>
                    <h3 class="font-bold text-slate-800 text-sm md:text-base mb-1">${a.name_app}</h3>
                    <p class="text-xs text-slate-500">${a.category_app}</p>
                </button>`;
            }
        }
        contenedor.innerHTML = html || '<p class="text-slate-500 col-span-full">No se encontraron los datos de las aplicaciones.</p>';

    } catch (error) {
        console.error("Error al cargar apps:", error);
        contenedor.innerHTML = '<p class="text-red-500 col-span-full">Error al cargar aplicaciones.</p>';
    }
};

// --- NAVEGACIÓN PRINCIPAL ---
window.abrirProyecto = function(idProyecto, nombreProyecto) {
    proyectoActual = idProyecto;
    
    document.getElementById('bloque-proyectos').classList.add('hidden');
    document.getElementById('bloque-apps').classList.remove('hidden');
    document.getElementById('nombre-proyecto-apps').innerText = `[${idProyecto}] ${nombreProyecto}`;
    document.getElementById('nav-title').innerText = 'Aplicaciones';
    
    window.cargarApps(idProyecto);
};

window.volverAProyectos = function() {
    proyectoActual = null;
    document.getElementById('bloque-apps').classList.add('hidden');
    document.getElementById('bloque-proyectos').classList.remove('hidden');
    document.getElementById('nav-title').innerText = 'Mis Proyectos';
};

window.abrirApp = function(archivoHtml, idApp) {
    if (!archivoHtml || archivoHtml === "undefined") {
        alert("Error: El archivo HTML de esta aplicación no está definido.");
        return;
    }
    // Redirige pasando el projectId en la URL; el app_core de la siguiente vista se encargará de descargar sus metadatos
    window.location.href = archivoHtml + "?projectId=" + encodeURIComponent(proyectoActual) + "&appId=" + encodeURIComponent(idApp);
};