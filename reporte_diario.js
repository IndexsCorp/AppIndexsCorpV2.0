import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, updateDoc, arrayUnion, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, getBlob } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";

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
const storage = getStorage(app);

const urlParams = new URLSearchParams(window.location.search);
const PROJECT_ID = urlParams.get('projectId');

window.APP_STATE = { frentes: [], especialidades: [], rubrosMap: {}, nombreProyecto: "" };
let ubicacionGPS = "-0.00000, -0.00000";

document.addEventListener("DOMContentLoaded", () => {
    if (!PROJECT_ID) {
        alert("⚠️ Acceso denegado. No se seleccionó un proyecto.");
        window.location.href = "index.html"; return;
    }

    onAuthStateChanged(auth, async (user) => {
        const pantallaCarga = document.getElementById('pantalla-carga');
        const mainContent = document.getElementById('main-content');
        const navbarGlobal = document.getElementById('navbar-global');

        if (user) {
            // Obtener perfil del usuario desde Firestore
            let perfilUsuario = null;
            try {
                const userDocSnap = await getDoc(doc(db, "usuarios", user.uid));
                if (userDocSnap.exists()) {
                    perfilUsuario = userDocSnap.data();
                }
            } catch (e) {
                console.error("Error obteniendo perfil de usuario", e);
            }

            // Guardar el ID de la empresa a nivel global para inyectar la plantilla luego
            window.APP_STATE.idEmpresaUsuario = perfilUsuario ? perfilUsuario.id_empresa : null;

            // Actualizar interfaz del menú superior
            const nombreMostrar = perfilUsuario && perfilUsuario.name_user ? perfilUsuario.name_user : user.email.split('@')[0];
            const iniciales = nombreMostrar.substring(0, 2).toUpperCase();
            const rolMostrar = perfilUsuario && perfilUsuario.rol_user ? perfilUsuario.rol_user : "Personal";
            
            document.getElementById('nav-user-initials').innerText = iniciales;
            document.getElementById('dropdown-user-name').innerText = nombreMostrar;
            const rolEl = document.getElementById('dropdown-user-rol');
            if (rolEl) rolEl.innerText = rolMostrar;
            
            // Fechas
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const today = `${year}-${month}-${day}`;

            ['dateField', 'prevDateField', 'envioDateField', 'editDateField'].forEach(id => {
                const el = document.getElementById(id);
                if(el) { el.value = today; }
            });

            await cargarConfiguracionProyecto();
            window.addActividadRow();
            window.addPersonnelRow();
            window.addAnotacionRow();
            obtenerUbicacion();

            // Ocultar carga y mostrar contenido
            if (pantallaCarga) pantallaCarga.classList.add('hidden');
            if (navbarGlobal) navbarGlobal.classList.remove('hidden');
            if (mainContent) mainContent.classList.remove('hidden');

        } else {
            alert("⚠️ Sesión expirada. Redirigiendo al portal.");
            window.location.href = "index.html";
        }
    });
});

function obtenerUbicacion() {
    navigator.geolocation.getCurrentPosition(
        (pos) => { 
            ubicacionGPS = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`; 
        },
        (err) => { 
            console.warn("Ubicación no disponible.");
        },
        { enableHighAccuracy: true }
    );
}

async function cargarConfiguracionProyecto() {
    try {
        const docRef = doc(db, "proyectos", PROJECT_ID);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            
            window.APP_STATE.nombreProyecto = data.name_proyect || PROJECT_ID;
            window.APP_STATE.clienteProyecto = data.client_proyect || "";
            window.APP_STATE.contratistaProyecto = data.contratista_proyect || "";
            window.APP_STATE.supervisionProyecto = data.supervision_proyect || "";
            window.APP_STATE.ubicacionProyecto = data.ubi_proyect || "";
            window.APP_STATE.idEmpresa = data.id_empresa || "";
            
            // Consultar la colección relacional "empresas" usando id_empresa
            if (window.APP_STATE.idEmpresa) {
                const empRef = doc(db, "empresas", window.APP_STATE.idEmpresa);
                const empSnap = await getDoc(empRef);
                if (empSnap.exists()) {
                    const empData = empSnap.data();
                    window.APP_STATE.logoEmpresa = empData.logo_empresa || "";
                    window.APP_STATE.nombreEmpresa = empData.nombre_empresa || "";
                }
            }

            window.APP_STATE.correosPara = data.correos_Para || "";
            window.APP_STATE.correosCC = data.correos_cc || "";

            const nameEl = document.getElementById('sidebar-project-name');
            if (nameEl) nameEl.innerText = window.APP_STATE.nombreProyecto;

            window.APP_STATE.frentes = data.frentes || [];
            window.APP_STATE.especialidades = data.especialidad || [];
            window.APP_STATE.rubrosMap = data.rubrosmap || {};
        } else {
            alert("El proyecto no existe en la base de datos.");
        }
    } catch (error) {
        console.error("Error cargando configuración:", error);
    }
}

// --- FUNCIONES UI Y NAVEGACIÓN ---
window.toggleSidebar = function() { 
    document.getElementById('sidebar').classList.toggle('-translate-x-full'); 
    document.getElementById('sidebar').classList.toggle('translate-x-0'); 
    document.getElementById('sidebar-overlay').classList.toggle('hidden'); 
};

window.toggleUserMenu = function() { 
    document.getElementById('user-menu').classList.toggle('hidden'); 
};

window.switchTab = function(tabId) {
    document.querySelectorAll('.tab-btn').forEach(b => { 
        b.classList.remove('active', 'bg-corpBlue-600', 'text-white', 'border-corpBlue-600'); 
        b.classList.add('bg-white', 'text-slate-500', 'border-slate-300'); 
    });
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    
    const map = { 'ingresar': 'btnTabIngresar', 'modificar': 'btnTabModificar', 'previsualizar': 'btnTabPrevisualizar', 'enviar': 'btnTabEnviar' };
    const btn = document.getElementById(map[tabId]);
    if(btn) {
        btn.classList.remove('bg-white', 'text-slate-500', 'border-slate-300'); 
        btn.classList.add('active', 'bg-corpBlue-600', 'text-white', 'border-corpBlue-600');
    }
    const targetTab = document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if(targetTab) targetTab.classList.add('active');
};

window.toggleModalConfig = function() { 
    const modal = document.getElementById('modal-config');
    const isHidden = modal.classList.toggle('hidden'); 
    
    if (!isHidden) {
        const selectEsp = document.getElementById('modalEspecialidad');
        let options = '<option value="" disabled selected>Seleccione especialidad...</option>';
        window.APP_STATE.especialidades.forEach(e => {
            options += `<option value="${e}">${e}</option>`;
        });
        selectEsp.innerHTML = options;
    }
};

window.toggleModalFields = function() {
    const isRubro = document.getElementById('modalTipo').value === 'rubro';
    document.getElementById('modalFieldsRubro').classList.toggle('hidden', !isRubro);
    document.getElementById('modalFieldsFrente').classList.toggle('hidden', isRubro);
};

window.actualizarRubrosSelect = function(selectEsp) {
    const selectRubro = selectEsp.closest('.pers-card').querySelector('.pers-rubro');
    const esp = selectEsp.value;
    selectRubro.innerHTML = '<option value="" disabled selected>Rubro</option>';
    if(window.APP_STATE.rubrosMap[esp]) {
        window.APP_STATE.rubrosMap[esp].forEach(r => {
            selectRubro.innerHTML += `<option value="${r}">${r}</option>`;
        });
    }
};

window.changeQty = function(btn, delta) {
    const input = btn.parentElement.querySelector('input');
    let val = parseInt(input.value) || 0;
    if((val + delta) >= 1) input.value = val + delta;
};

document.addEventListener('DOMContentLoaded', () => {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            signOut(auth).then(() => {
                window.location.href = "index.html";
            });
        });
    }
});

// --- CONSTRUCTORES DE FILAS EN PANTALLA ---
window.addActividadRow = function(texto = "") {
    const div = document.createElement('div');
    div.className = 'bg-slate-50 p-4 rounded-xl border border-slate-200 relative mb-4 act-card';
    div.innerHTML = `
        <button type="button" class="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs shadow-sm hover:bg-red-600 transition" onclick="this.parentElement.remove()">✕</button>
        
        <textarea class="act-texto w-full p-2.5 text-sm border border-slate-300 rounded-lg outline-none mb-3" rows="2" placeholder="Describe la actividad realizada...">${texto}</textarea>
        
        <div class="flex gap-3 mb-4">
            <div class="flex-1 flex flex-col sm:flex-row gap-2 justify-center">
                <button type="button" class="flex-1 bg-corpBlue-600 hover:bg-corpBlue-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition" onclick="this.parentElement.querySelector('.act-camera').click()">
                    <span class="material-symbols-outlined text-[18px]">photo_camera</span> Tomar
                </button>
                <button type="button" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition" onclick="this.parentElement.querySelector('.act-upload').click()">
                    <span class="material-symbols-outlined text-[18px]">upload_file</span> Subir
                </button>
                <button type="button" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition" onclick="window.abrirModalFotosDia(this)">
                    <span class="material-symbols-outlined text-[18px]">photo_library</span> Galería
                </button>
                
                <input type="file" class="act-camera hidden" accept="image/*" capture="environment" onchange="window.previsualizarFoto(this)">
                <input type="file" class="act-upload hidden" accept="image/*" onchange="window.previsualizarFoto(this)">
            </div>

            <div class="foto-preview-container hidden w-24 h-24 sm:w-28 sm:h-28 shrink-0 relative border border-slate-300 rounded-lg bg-white shadow-sm">
                <img class="act-preview-img w-full h-full object-cover rounded-lg">
                <button type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md hover:bg-red-600 transition" onclick="window.removerFoto(this)">✕</button>
                <input type="hidden" class="act-foto-url"> 
                <input type="hidden" class="act-foto-base64">
            </div>
        </div>
        
        <button type="button" class="w-full bg-slate-800 hover:bg-slate-900 text-white font-bold py-2.5 rounded-lg text-sm transition shadow-sm btn-submit-act" onclick="window.submitActividad(this)">
            Guardar Actividad Individual
        </button>
    `;
    document.getElementById('actividadesContainer').appendChild(div);
};

window.toggleModalFotosDia = function() {
    document.getElementById('modal-fotos-dia').classList.toggle('hidden');
};

window.abrirModalFotosDia = function(btn) {
    alert("La consulta de fotos del día se implementará en la siguiente fase.");
};

window.removerFoto = function(btn) {
    const container = btn.closest('.foto-preview-container');
    container.classList.add('hidden');
    container.querySelector('.act-preview-img').removeAttribute('src');
    container.querySelector('.act-foto-url').value = '';
    container.querySelector('.act-foto-base64').value = '';
    const card = btn.closest('.act-card');
    if (card.querySelector('.act-camera')) card.querySelector('.act-camera').value = '';
    if (card.querySelector('.act-upload')) card.querySelector('.act-upload').value = '';
};

window.previsualizarFoto = function(input) {
    if(input.files && input.files[0]) {
        const file = input.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const img = new Image();
            img.onload = function() {
                const canvas = document.getElementById('photoCanvas');
                const ctx = canvas.getContext('2d');
                
                const MAX_WIDTH = 1920;
                let width = img.width;
                let height = img.height;
                
                if (width > MAX_WIDTH) {
                    height = Math.round((height * MAX_WIDTH) / width);
                    width = MAX_WIDTH;
                }
                
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);

                const fontSize = Math.max(12, Math.floor(height * 0.02)); 
                const logoImg = document.getElementById('logoImage');
                let logoHeight = height * 0.06; 
                let logoWidth = 0;
                let logoX = width * 0.03;
                const interlineado = fontSize * 1.5; 
                const bloqueTextoHeight = interlineado * 4;
                let logoY = height - (bloqueTextoHeight + logoHeight + (height * 0.04));

                if(logoImg.complete && logoImg.naturalHeight !== 0) {
                     const aspectRatio = logoImg.naturalWidth / logoImg.naturalHeight;
                     logoWidth = logoHeight * aspectRatio;
                     ctx.drawImage(logoImg, logoX, logoY, logoWidth, logoHeight);
                }
                
                ctx.font = `${fontSize}px sans-serif`; 
                ctx.fillStyle = "white";
                ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;
                
                const textX = logoX;
                let textY = logoY + logoHeight + (interlineado * 0.8); 

                ctx.fillText("Haelservice", textX, textY);
                textY += interlineado;
                
                ctx.fillText(window.APP_STATE.nombreProyecto.substring(0, 40), textX, textY);
                textY += interlineado;
                
                const fechaSeleccionada = document.getElementById('dateField').value;
                const partes = fechaSeleccionada.split('-'); 
                const fechaFormat = partes.length === 3 ? `${partes[2]}.${partes[1]}.${partes[0]}` : fechaSeleccionada;
                const horas = String(new Date().getHours()).padStart(2, '0');
                const minutos = String(new Date().getMinutes()).padStart(2, '0');
                const fechaStr = `${fechaFormat} ${horas}:${minutos}`;
                
                ctx.fillText(fechaStr, textX, textY);
                textY += interlineado;
                
                ctx.fillText(ubicacionGPS, textX, textY);
                ctx.shadowColor = "transparent";

                const base64Generado = canvas.toDataURL("image/jpeg", 0.85);

                const container = input.closest('.act-card').querySelector('.foto-preview-container');
                container.classList.remove('hidden');
                container.querySelector('.act-preview-img').src = base64Generado;
                container.querySelector('.act-foto-base64').value = base64Generado;
                container.querySelector('.act-foto-url').value = ''; 
            }
            img.src = e.target.result;
        }
        reader.readAsDataURL(file);
    }
};

window.addPersonnelRow = function() {
    let eOpt = '<option value="" disabled selected>Especialidad</option>';
    window.APP_STATE.especialidades.forEach(e => eOpt += `<option value="${e}">${e}</option>`);
    
    let fOpt = '<option value="" disabled selected>Frente</option>';
    window.APP_STATE.frentes.forEach(f => fOpt += `<option value="${f}">${f}</option>`);

    const div = document.createElement('div');
    div.className = 'bg-slate-50 p-4 rounded-xl border border-slate-200 relative mb-4 pers-card';
    div.innerHTML = `
        <button type="button" class="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs" onclick="this.parentElement.remove()">✕</button>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3 mt-4">
            <select class="pers-especialidad p-2 text-sm border border-slate-300 rounded-lg outline-none bg-white" onchange="window.actualizarRubrosSelect(this)">${eOpt}</select>
            <select class="pers-rubro p-2 text-sm border border-slate-300 rounded-lg outline-none bg-white"><option value="" disabled selected>Rubro</option></select>
            <select class="pers-sector p-2 text-sm border border-slate-300 rounded-lg outline-none bg-white">${fOpt}</select>
        </div>
        <div class="flex items-center border border-slate-300 rounded-lg overflow-hidden w-32 bg-slate-50 shadow-sm mt-1">
            <button type="button" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 border-r border-slate-300 transition" onclick="window.changeQty(this, -1)">-</button>
            <input type="number" class="pers-cant w-full p-1.5 text-sm text-center outline-none border-none bg-white font-semibold" value="1" min="1">
            <button type="button" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 border-l border-slate-300 transition" onclick="window.changeQty(this, 1)">+</button>
        </div>
    `;
    document.getElementById('personnelContainer').appendChild(div);
};

window.recargarSelectsManual = async function(btn) {
    const origText = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-outlined text-[16px] animate-spin">refresh</span> Cargando...`;
    btn.disabled = true;

    try {
        await cargarConfiguracionProyecto();

        document.querySelectorAll('.pers-card').forEach(card => {
            const selectEsp = card.querySelector('.pers-especialidad');
            const selectRubro = card.querySelector('.pers-rubro');
            const selectFrente = card.querySelector('.pers-sector');
            
            const valEsp = selectEsp.value;
            const valRubro = selectRubro.value;
            const valFrente = selectFrente.value;

            let eOpt = '<option value="" disabled>Especialidad</option>';
            window.APP_STATE.especialidades.forEach(e => {
                eOpt += `<option value="${e}">${e}</option>`;
            });
            selectEsp.innerHTML = eOpt;
            if (valEsp) selectEsp.value = valEsp;

            let fOpt = '<option value="" disabled>Frente</option>';
            window.APP_STATE.frentes.forEach(f => {
                fOpt += `<option value="${f}">${f}</option>`;
            });
            selectFrente.innerHTML = fOpt;
            if (valFrente) selectFrente.value = valFrente;

            if (valEsp && window.APP_STATE.rubrosMap[valEsp]) {
                let rOpt = '<option value="" disabled>Rubro</option>';
                window.APP_STATE.rubrosMap[valEsp].forEach(r => {
                    rOpt += `<option value="${r}">${r}</option>`;
                });
                selectRubro.innerHTML = rOpt;
                if (valRubro) selectRubro.value = valRubro;
            }
        });

        btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">check</span> Listo`;
    } catch (e) {
        console.error("Error al actualizar selects:", e);
        btn.innerHTML = `<span class="material-symbols-outlined text-[16px]">error</span> Error`;
    }

    setTimeout(() => {
        btn.innerHTML = origText;
        btn.disabled = false;
    }, 1500);
};

window.addAnotacionRow = function() {
    const div = document.createElement('div');
    div.className = 'bg-slate-50 p-4 rounded-xl border border-slate-200 relative mb-4 anot-card';
    div.innerHTML = `
        <button type="button" class="absolute top-2 right-2 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center text-xs" onclick="this.parentElement.remove()">✕</button>
        <input type="time" class="anot-hora p-2 text-sm border rounded-lg mb-2" value="${new Date().toTimeString().substring(0,5)}">
        <textarea class="anot-texto w-full p-2.5 text-sm border rounded-lg" rows="2" placeholder="Descripción..."></textarea>
    `;
    document.getElementById('anotacionesContainer').appendChild(div);
};

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

window.submitActividad = async function(btn) {
    const fechaInput = document.getElementById('dateField').value;
    const card = btn.closest('.act-card');
    const txt = card.querySelector('.act-texto').value;
    
    const fotoBase64 = card.querySelector('.act-foto-base64').value;
    let fotoUrlExistente = card.querySelector('.act-foto-url').value;

    if(!txt.trim() || !fechaInput) return alert("Verifique la fecha y la descripción de la actividad.");

    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Guardando...";

    try {
        let finalFotoUrl = fotoUrlExistente;

        if (fotoBase64 && !fotoUrlExistente) {
            btn.innerHTML = "Subiendo imagen...";
            const blob = dataURItoBlob(fotoBase64);
            const storagePath = `reportes_fotos/${PROJECT_ID}/${fechaInput}_${Date.now()}.jpg`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, blob);
            finalFotoUrl = await getDownloadURL(storageRef);
        }

        btn.innerHTML = "Guardando en Firestore...";
        const docId = fechaInput + "_" + PROJECT_ID;
        const reporteRef = doc(db, "reportes_diarios", docId);
        const usuarioActual = auth.currentUser ? auth.currentUser.email : "desconocido@indexscorp.com";

        const nuevaActividad = {
            id_act: "ACT_" + Date.now().toString(36),
            texto_act: txt.trim(),
            urlfoto_act: finalFotoUrl || ""
        };

        await setDoc(reporteRef, {
            id_proyect: PROJECT_ID,
            fecha_proyect: fechaInput,
            creadopor_proyect: usuarioActual,
            actividades: arrayUnion(nuevaActividad)
        }, { merge: true });

        btn.innerHTML = "✅ Actividad Guardada";
        setTimeout(() => {
            card.remove();
            if (document.querySelectorAll('.act-card').length === 0) {
                window.addActividadRow();
            }
        }, 1000);

    } catch (error) {
        console.error("Error al guardar actividad:", error);
        alert("Error al guardar actividad: " + error.message);
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};

window.submitPersonal = async function() {
    const fechaInput = document.getElementById('dateField').value;
    if(!fechaInput) return alert("Ingrese la fecha del reporte.");

    let personalArray = [];
    document.querySelectorAll('.pers-card').forEach(card => {
        const esp = card.querySelector('.pers-especialidad').value;
        const rubro = card.querySelector('.pers-rubro').value;
        const sector = card.querySelector('.pers-sector').value;
        const cant = card.querySelector('.pers-cant').value;

        if (esp && rubro && sector) {
            personalArray.push({
                id_personal: "PERS_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 5),
                especialidad_personal: esp,
                rubro_personal: rubro,
                sector_personal: sector,
                cantidad: cant
            });
        }
    });

    if(personalArray.length === 0) return alert("Complete todos los campos del personal antes de guardar.");

    const btn = document.getElementById('btnPersonal');
    const origText = btn.innerHTML;
    btn.disabled = true; 
    btn.innerHTML = "Guardando en Firebase...";

    try {
        const docId = fechaInput + "_" + PROJECT_ID;
        const reporteRef = doc(db, "reportes_diarios", docId);
        const usuarioActual = auth.currentUser ? auth.currentUser.email : "desconocido@indexscorp.com";

        await setDoc(reporteRef, {
            id_proyect: PROJECT_ID,
            fecha_proyect: fechaInput,
            creadopor_proyect: usuarioActual,
            personal: arrayUnion(...personalArray)
        }, { merge: true });

        btn.innerHTML = "✅ Personal Guardado";
        setTimeout(() => {
            document.getElementById('personnelContainer').innerHTML = ""; 
            window.addPersonnelRow(); 
            btn.disabled = false;
            btn.innerHTML = origText;
        }, 1500);

    } catch (error) {
        console.error("Error al guardar personal:", error);
        alert("Error al guardar: " + error.message);
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};

window.submitAnotaciones = async function() {
    const fechaInput = document.getElementById('dateField').value;
    if(!fechaInput) return alert("Ingrese la fecha del reporte.");

    let anotacionesArray = [];
    document.querySelectorAll('.anot-card').forEach(card => {
        const hora = card.querySelector('.anot-hora').value;
        const txt = card.querySelector('.anot-texto').value;

        if (txt.trim()) {
            anotacionesArray.push({
                id_anot: "ANOT_" + Date.now().toString(36),
                hora_anot: hora,
                texto_anot: txt.trim()
            });
        }
    });

    if(anotacionesArray.length === 0) return alert("Agregue al menos una anotación válida.");

    const btn = document.getElementById('btnAnotaciones');
    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Guardando en Firebase...";

    try {
        const docId = fechaInput + "_" + PROJECT_ID;
        const reporteRef = doc(db, "reportes_diarios", docId);
        const usuarioActual = auth.currentUser ? auth.currentUser.email : "desconocido@indexscorp.com";

        await setDoc(reporteRef, {
            id_proyect: PROJECT_ID,
            fecha_proyect: fechaInput,
            creadopor_proyect: usuarioActual,
            anotaciones: arrayUnion(...anotacionesArray)
        }, { merge: true });

        btn.innerHTML = "✅ Anotaciones Guardadas";
        setTimeout(() => {
            document.getElementById('anotacionesContainer').innerHTML = "";
            window.addAnotacionRow();
            btn.disabled = false;
            btn.innerHTML = origText;
        }, 1500);

    } catch (error) {
        console.error("Error al guardar anotaciones:", error);
        alert("Error al guardar: " + error.message);
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};

window.guardarNuevaConfiguracion = async function() {
    const tipo = document.getElementById('modalTipo').value;
    const btn = document.getElementById('btnGuardarConfig');
    const origText = btn.innerHTML;

    try {
        const projRef = doc(db, "proyectos", PROJECT_ID);
        btn.disabled = true;
        btn.innerHTML = `Agregando... <span class="material-symbols-outlined animate-spin text-sm">refresh</span>`;

        if (tipo === 'rubro') {
            const esp = document.getElementById('modalEspecialidad').value;
            const rubro = document.getElementById('modalRubro').value.trim();

            if (!esp) return alert("Seleccione una especialidad de la lista.");
            if (!rubro) return alert("Ingrese el nombre del rubro.");

            await updateDoc(projRef, {
                [`rubrosmap.${esp}`]: arrayUnion(rubro)
            });
        } else {
            const frente = document.getElementById('modalFrente').value.trim();
            if (!frente) return alert("Ingrese el nombre del frente.");

            await updateDoc(projRef, {
                frentes: arrayUnion(frente)
            });
        }

        window.toggleModalConfig();
        document.getElementById('modalRubro').value = "";
        document.getElementById('modalFrente').value = "";

        await cargarConfiguracionProyecto();
        
        if (typeof window.recargarSelectsManual === "function") {
            const tempBtn = document.createElement("button");
            await window.recargarSelectsManual(tempBtn);
        }

        alert("✅ Configuración actualizada correctamente.");

    } catch (error) {
        console.error("Error al guardar configuración:", error);
        alert("Error al agregar: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};

// ==========================================
// SECCIÓN: CONSULTAR Y MODIFICAR (PESTAÑA 2)
// ==========================================

window.CURRENT_EDIT_DOC = null;
window.CURRENT_EDIT_REF = null;

window.buscarReporteEdicion = async function() {
    const fecha = document.getElementById('editDateField').value;
    if(!fecha) return alert("Seleccione una fecha para buscar.");

    const loading = document.getElementById('loadingModificar');
    const contenedor = document.getElementById('resultadosEdicion');
    
    loading.classList.remove('hidden');
    contenedor.innerHTML = "";

    try {
        const docId = fecha + "_" + PROJECT_ID;
        const docRef = doc(db, "reportes_diarios", docId);
        const docSnap = await getDoc(docRef);

        loading.classList.add('hidden');

        if (docSnap.exists()) {
            window.CURRENT_EDIT_DOC = docSnap.data();
            window.CURRENT_EDIT_REF = docRef;
            window.renderizarEdicion();
        } else {
            contenedor.innerHTML = `<div class="p-4 bg-amber-50 text-amber-700 rounded-lg text-center font-bold border border-amber-200">No hay registros guardados para el día ${fecha}.</div>`;
            window.CURRENT_EDIT_DOC = null;
        }
    } catch (error) {
        console.error("Error buscando reporte:", error);
        loading.classList.add('hidden');
        alert("Error al buscar el reporte en la base de datos.");
    }
};

window.renderizarEdicion = function() {
    const data = window.CURRENT_EDIT_DOC;
    const contenedor = document.getElementById('resultadosEdicion');
    let html = "";

    html += `<h3 class="font-bold text-corpBlue-600 border-b pb-2 mb-3 mt-4 text-lg">Actividades Registradas</h3>`;
    if (data.actividades && data.actividades.length > 0) {
        data.actividades.forEach((act, index) => {
            html += `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 relative act-card">
                <button class="absolute top-2 right-2 bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded text-xs font-bold transition" onclick="eliminarElementoEdicion('actividades', ${index})">Eliminar</button>
                
                <label class="block text-xs font-bold text-slate-500 mb-1">Descripción:</label>
                <textarea id="edit_act_${index}" class="act-texto w-full p-2.5 border border-slate-300 rounded-lg mb-3 text-sm outline-none focus:border-corpBlue-500">${act.texto_act}</textarea>
                
                <div class="flex gap-3 mb-4">
                    <div class="flex-1 flex flex-col sm:flex-row gap-2 justify-center">
                        <button type="button" class="flex-1 bg-corpBlue-600 hover:bg-corpBlue-700 text-white text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition" onclick="this.parentElement.querySelector('.act-camera').click()">
                            <span class="material-symbols-outlined text-[18px]">photo_camera</span> Tomar
                        </button>
                        <button type="button" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition" onclick="this.parentElement.querySelector('.act-upload').click()">
                            <span class="material-symbols-outlined text-[18px]">upload_file</span> Subir
                        </button>
                        <button type="button" class="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold py-2 rounded-lg flex items-center justify-center gap-1 transition" onclick="window.abrirModalFotosDia(this)">
                            <span class="material-symbols-outlined text-[18px]">photo_library</span> Galería
                        </button>
                        
                        <input type="file" class="act-camera hidden" accept="image/*" capture="environment" onchange="window.previsualizarFoto(this)">
                        <input type="file" class="act-upload hidden" accept="image/*" onchange="window.previsualizarFoto(this)">
                    </div>

                    <div class="foto-preview-container ${act.urlfoto_act ? '' : 'hidden'} w-24 h-24 sm:w-28 sm:h-28 shrink-0 relative border border-slate-300 rounded-lg bg-white shadow-sm">
                        <img class="act-preview-img w-full h-full object-cover rounded-lg" src="${act.urlfoto_act || ''}">
                        <button type="button" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md hover:bg-red-600 transition" onclick="window.removerFoto(this)">✕</button>
                        <input type="hidden" class="act-foto-url" value="${act.urlfoto_act || ''}"> 
                        <input type="hidden" class="act-foto-base64">
                    </div>
                </div>
                
                <button class="w-full bg-slate-800 hover:bg-slate-900 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition btn-submit-act" onclick="window.actualizarActividadEdicion(this, ${index})">
                    Guardar Cambios de Actividad
                </button>
            </div>`;
        });
    } else {
        html += `<p class="text-sm text-slate-500 italic mb-6">No hay actividades guardadas.</p>`;
    }

    html += `<h3 class="font-bold text-indigo-700 border-b pb-2 mb-3 mt-6 text-lg">Personal Registrado</h3>`;
    if (data.personal && data.personal.length > 0) {
        const getEspOptions = (selected) => {
            let opt = '<option value="" disabled>Especialidad</option>';
            window.APP_STATE.especialidades.forEach(e => opt += `<option value="${e}" ${e === selected ? 'selected' : ''}>${e}</option>`);
            return opt;
        };
        const getFrenteOptions = (selected) => {
            let opt = '<option value="" disabled>Frente</option>';
            window.APP_STATE.frentes.forEach(f => opt += `<option value="${f}" ${f === selected ? 'selected' : ''}>${f}</option>`);
            return opt;
        };
        const getRubroOptions = (esp, selected) => {
            let opt = '<option value="" disabled>Rubro</option>';
            if (window.APP_STATE.rubrosMap[esp]) {
                window.APP_STATE.rubrosMap[esp].forEach(r => opt += `<option value="${r}" ${r === selected ? 'selected' : ''}>${r}</option>`);
            }
            return opt;
        };

        data.personal.forEach((pers, index) => {
            html += `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 relative pers-card">
                <button type="button" class="absolute top-2 right-2 bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded text-xs font-bold transition" onclick="eliminarElementoEdicion('personal', ${index})">Eliminar</button>
                
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-3 mt-4">
                    <select class="pers-especialidad p-2 text-sm border border-slate-300 rounded-lg outline-none bg-white" onchange="window.actualizarRubrosSelect(this)">
                        ${getEspOptions(pers.especialidad_personal)}
                    </select>
                    <select class="pers-rubro p-2 text-sm border border-slate-300 rounded-lg outline-none bg-white">
                        ${getRubroOptions(pers.especialidad_personal, pers.rubro_personal)}
                    </select>
                    <select class="pers-sector p-2 text-sm border border-slate-300 rounded-lg outline-none bg-white">
                        ${getFrenteOptions(pers.sector_personal)}
                    </select>
                </div>
                
                <div class="flex items-center mb-4">
                    <div class="flex items-center border border-slate-300 rounded-lg overflow-hidden w-32 bg-slate-50 shadow-sm">
                        <button type="button" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 border-r border-slate-300 transition" onclick="window.changeQty(this, -1)">-</button>
                        <input type="number" class="pers-cant w-full p-1.5 text-sm text-center outline-none border-none bg-white font-semibold" value="${pers.cantidad}" min="1">
                        <button type="button" class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 font-bold text-slate-600 border-l border-slate-300 transition" onclick="window.changeQty(this, 1)">+</button>
                    </div>
                </div>
                
                <button type="button" class="w-full bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold px-4 py-2.5 rounded-lg transition" onclick="window.actualizarPersonalEdicion(this, ${index})">
                    Guardar Cambios de Personal
                </button>
            </div>`;
        });
    } else {
        html += `<p class="text-sm text-slate-500 italic mb-6">No hay personal guardado.</p>`;
    }

    html += `<h3 class="font-bold text-amber-600 border-b pb-2 mb-3 mt-6 text-lg">Anotaciones Registradas</h3>`;
    if (data.anotaciones && data.anotaciones.length > 0) {
        data.anotaciones.forEach((anot, index) => {
            html += `
            <div class="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-4 relative">
                <button class="absolute top-2 right-2 bg-red-100 hover:bg-red-200 text-red-600 px-2 py-1 rounded text-xs font-bold transition" onclick="eliminarElementoEdicion('anotaciones', ${index})">Eliminar</button>
                
                <div class="flex gap-3 mb-3 mt-2">
                    <input type="time" id="edit_anot_hora_${index}" value="${anot.hora_anot}" class="p-2 border border-slate-300 rounded-lg text-sm w-28 outline-none">
                    <textarea id="edit_anot_txt_${index}" class="w-full p-2 border border-slate-300 rounded-lg text-sm outline-none">${anot.texto_anot}</textarea>
                </div>
                
                <button class="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-2 rounded-lg transition" onclick="actualizarAnotacion(${index})">Guardar Cambios de Anotación</button>
            </div>`;
        });
    } else {
        html += `<p class="text-sm text-slate-500 italic">No hay anotaciones guardadas.</p>`;
    }

    contenedor.innerHTML = html;
};

window.actualizarActividadEdicion = async function(btn, index) {
    const card = btn.closest('.act-card');
    const nuevoTexto = card.querySelector('.act-texto').value;
    const fotoBase64 = card.querySelector('.act-foto-base64').value;
    const fotoUrlExistente = card.querySelector('.act-foto-url').value;
    const fechaInput = document.getElementById('editDateField').value;

    if(!nuevoTexto.trim()) return alert("El texto no puede estar vacío.");

    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Actualizando...";

    try {
        let finalFotoUrl = fotoUrlExistente;

        if (fotoBase64 && !fotoUrlExistente) {
            btn.innerHTML = "Subiendo nueva imagen...";
            const blob = dataURItoBlob(fotoBase64); 
            const storagePath = `reportes_fotos/${PROJECT_ID}/${fechaInput}_${Date.now()}.jpg`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, blob);
            finalFotoUrl = await getDownloadURL(storageRef);
        }

        window.CURRENT_EDIT_DOC.actividades[index].texto_act = nuevoTexto.trim();
        window.CURRENT_EDIT_DOC.actividades[index].urlfoto_act = finalFotoUrl || "";
        
        btn.innerHTML = "Actualizando Base de Datos...";
        await updateDoc(window.CURRENT_EDIT_REF, { actividades: window.CURRENT_EDIT_DOC.actividades });
        
        btn.innerHTML = "✅ Actualizado";
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = origText;
        }, 1500);

    } catch(e) {
        console.error("Error al actualizar:", e);
        alert("Error al actualizar: " + e.message);
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};

window.actualizarPersonalEdicion = async function(btn, index) {
    const card = btn.closest('.pers-card');
    const esp = card.querySelector('.pers-especialidad').value;
    const rubro = card.querySelector('.pers-rubro').value;
    const sector = card.querySelector('.pers-sector').value;
    const cant = card.querySelector('.pers-cant').value;

    if (!esp || !rubro || !sector) return alert("Complete todos los campos del personal.");

    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = "Actualizando...";

    try {
        window.CURRENT_EDIT_DOC.personal[index].especialidad_personal = esp;
        window.CURRENT_EDIT_DOC.personal[index].rubro_personal = rubro;
        window.CURRENT_EDIT_DOC.personal[index].sector_personal = sector;
        window.CURRENT_EDIT_DOC.personal[index].cantidad = cant;
        
        await updateDoc(window.CURRENT_EDIT_REF, { personal: window.CURRENT_EDIT_DOC.personal });
        
        btn.innerHTML = "✅ Actualizado";
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = origText;
        }, 1500);

    } catch(e) {
        console.error("Error al actualizar personal:", e);
        alert("Error al actualizar: " + e.message);
        btn.disabled = false;
        btn.innerHTML = origText;
    }
};

window.actualizarAnotacion = async function(index) {
    const nuevaHora = document.getElementById(`edit_anot_hora_${index}`).value;
    const nuevoTexto = document.getElementById(`edit_anot_txt_${index}`).value;
    
    if(!nuevoTexto.trim()) return alert("El texto no puede estar vacío.");

    window.CURRENT_EDIT_DOC.anotaciones[index].hora_anot = nuevaHora;
    window.CURRENT_EDIT_DOC.anotaciones[index].texto_anot = nuevoTexto.trim();
    
    try {
        await updateDoc(window.CURRENT_EDIT_REF, { anotaciones: window.CURRENT_EDIT_DOC.anotaciones });
        alert("✅ Anotación actualizada en Firebase.");
    } catch(e) {
        alert("Error al actualizar: " + e.message);
    }
};

window.eliminarElementoEdicion = async function(campoArreglo, index) {
    if(!confirm("¿Estás seguro de eliminar este registro? Esta acción no se puede deshacer.")) return;

    window.CURRENT_EDIT_DOC[campoArreglo].splice(index, 1);

    try {
        await updateDoc(window.CURRENT_EDIT_REF, {
            [campoArreglo]: window.CURRENT_EDIT_DOC[campoArreglo]
        });
        window.renderizarEdicion();
    } catch(e) {
        alert("Error al eliminar: " + e.message);
    }
};

// ==========================================
// SECCIÓN: PREVISUALIZAR Y GENERAR PDF (PESTAÑA 3) CON PDFMAKE
// ==========================================

// Helper para convertir cualquier URL remota a Base64 para pdfmake
async function urlToBase64(url) {
    if (!url) return '';
    if (url.startsWith('data:image')) return url;

    // Método 1: Fetch directo (Ahora que arreglaste el CORS, este funcionará perfecto)
    try {
        const response = await fetch(url);
        if (response.ok) {
            const blob = await response.blob();
            return await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = () => resolve('');
                reader.readAsDataURL(blob);
            });
        }
    } catch (e) {
        console.warn("Fetch directo falló, intentando Canvas...", e);
    }

    // Método 2: Fallback por Canvas con Timeout de 5 segundos
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        
        const timeoutId = setTimeout(() => {
            console.warn("Timeout al cargar imagen");
            resolve('');
        }, 5000);

        img.onload = () => {
            clearTimeout(timeoutId);
            try {
                const canvas = document.createElement('canvas');
                canvas.width = img.naturalWidth || img.width;
                canvas.height = img.naturalHeight || img.height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            } catch (err) {
                resolve('');
            }
        };
        img.onerror = () => {
            clearTimeout(timeoutId);
            resolve('');
        };
        img.src = url;
    });
}

document.addEventListener("DOMContentLoaded", () => {
    const firmaGuardada = localStorage.getItem("firmaResidente");
    if (firmaGuardada) {
        const inputFirma = document.getElementById("pdfFirma");
        if(inputFirma) inputFirma.value = firmaGuardada;
    }
});

let pdfBlobGenerado = null; // Variable global restaurada para guardar el Blob

window.accionGenerarPrevisualizacion = async function() {
    const fecha = document.getElementById('prevDateField').value;
    const firma = document.getElementById('pdfFirma').value.trim();
    const btn = document.getElementById('btnGenerarPrev');
    
    if (!fecha) return alert("Seleccione una fecha para el reporte.");
    if (!firma) return alert("Por favor, ingrese el nombre de quien elabora el reporte.");

    localStorage.setItem("firmaResidente", firma);

    const origText = btn.innerHTML;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">refresh</span> Compilando Vectorial...`;
    btn.disabled = true;

    try {
        const docId = fecha + "_" + PROJECT_ID;
        const docSnap = await getDoc(doc(db, "reportes_diarios", docId));

        if (!docSnap.exists()) {
            alert(`No hay registros guardados para el día ${fecha}.`);
            btn.innerHTML = origText;
            btn.disabled = false;
            return;
        }

        const data = docSnap.data();

        // 1. Preparación de datos 
        const partesFecha = fecha.split('-'); 
        const fechaFmt = `${partesFecha[2]}/${partesFecha[1]}/${partesFecha[0]}`;
        const correlativo = `${partesFecha[0].substring(2)}${partesFecha[1]}${partesFecha[2]}`;

        // 2. Formatear arreglos para PDFMake
        const listaActividades = (data.actividades || []).map(a => ({ text: a.texto_act, fontSize: 8, margin: [0, 1, 0, 1] }));
        const listaAnotaciones = (data.anotaciones || []).map(an => ({ text: `[${an.hora_anot}] ${an.texto_anot}`, fontSize: 8, margin: [0, 1, 0, 1] }));

        let totalCant = 0;
        let bodyPersonal = [
            [
                { text: 'N°', bold: true, alignment: 'center', fontSize: 8, fillColor: '#F1F5F9' },
                { text: 'RUBRO', bold: true, fontSize: 8, fillColor: '#F1F5F9' },
                { text: 'SECTOR / FRENTE', bold: true, fontSize: 8, fillColor: '#F1F5F9' },
                { text: 'CANTIDAD', bold: true, alignment: 'center', fontSize: 8, fillColor: '#F1F5F9' }
            ]
        ];
        (data.personal || []).forEach((p, idx) => {
            const cant = parseInt(p.cantidad) || 0;
            totalCant += cant;
            bodyPersonal.push([
                { text: `${idx + 1}.`, alignment: 'center', fontSize: 8 },
                { text: p.rubro_personal || '', fontSize: 8 },
                { text: p.sector_personal || '', fontSize: 8 },
                { text: cant.toString(), alignment: 'center', bold: true, fontSize: 8 }
            ]);
        });
        bodyPersonal.push([
            { text: 'TOTAL PERSONAL DEL DÍA:', colSpan: 3, alignment: 'right', bold: true, fontSize: 8, fillColor: '#F1F5F9' },
            {}, {}, { text: totalCant.toString(), alignment: 'center', bold: true, fontSize: 9, fillColor: '#F1F5F9' }
        ]);

        const actividadesConFoto = (data.actividades || []).filter(a => a.urlfoto_act);
        const fotosProcesadas = [];
        for (let a of actividadesConFoto) {
            const b64 = await urlToBase64(a.urlfoto_act);
            if (b64) fotosProcesadas.push({ base64: b64, texto: a.texto_act });
        }

        // 3. Objeto de datos estandarizado para la plantilla
        const datosPlantilla = {
            logo: window.APP_STATE.logoEmpresa ? await urlToBase64(window.APP_STATE.logoEmpresa) : '',
            nombreEmpresa: window.APP_STATE.nombreEmpresa || "",
            nombreProyecto: window.APP_STATE.nombreProyecto,
            cliente: window.APP_STATE.clienteProyecto,
            contratista: window.APP_STATE.contratistaProyecto,
            elaboradoPor: firma,
            fecha: fechaFmt,
            correlativo: correlativo,
            listaActividades: listaActividades,
            bodyPersonal: bodyPersonal,
            listaAnotaciones: listaAnotaciones,
            fotosProcesadas: fotosProcesadas
        };

        // 4. Importar dinámicamente la plantilla PDFMake
        let generarDocDefinition;
        const idEmpresa = window.APP_STATE.idEmpresaUsuario || 'default';
        try {
            const modulo = await import(`./js/templates/reporte_diario/${idEmpresa}.js`);
            generarDocDefinition = modulo.generarDocDefinition;
        } catch (e) {
            const modulo = await import(`./js/templates/reporte_diario/EMP00001.js`);
            generarDocDefinition = modulo.generarDocDefinition;
        }

        // 5. Generar PDFMake y Visor
        const docDefinition = generarDocDefinition(datosPlantilla);
        const pdfDoc = pdfMake.createPdf(docDefinition);
        
        pdfDoc.getBlob((blob) => {
            pdfBlobGenerado = blob; // Guardamos el blob en memoria para la subida
            const pdfUrl = URL.createObjectURL(blob);
            
            document.getElementById('pdfPlaceholder').classList.add('hidden');
            const rootCont = document.getElementById('pdfContenedorRaiz');
            
            const esCelular = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (esCelular) {
                rootCont.innerHTML = `
                    <div class="text-center p-8 bg-slate-100 rounded-xl w-full border border-slate-300 shadow-sm">
                        <span class="material-symbols-outlined text-5xl text-corpBlue-600 mb-3">picture_as_pdf</span>
                        <p class="text-slate-700 font-bold mb-4 text-lg">El PDF está compilado</p>
                        <a href="${pdfUrl}" target="_blank" class="inline-block bg-corpBlue-600 text-white font-bold py-3 px-8 rounded-lg shadow-md">
                            Visualizar Documento
                        </a>
                    </div>`;
            } else {
                rootCont.innerHTML = `<iframe src="${pdfUrl}" class="w-full h-[650px] rounded-xl shadow-lg border border-slate-300"></iframe>`;
            }
            rootCont.classList.remove('hidden');

            // Restaurar botón de guardado oficial
            const btnGuardar = document.getElementById('btnGuardarOficial');
            btnGuardar.classList.remove('hidden');
            btnGuardar.classList.add('flex');
            btnGuardar.onclick = window.accionGuardarPDFDefinitivo; // Restauramos la subida a Firebase
            btnGuardar.innerHTML = `<span class="material-symbols-outlined">cloud_upload</span> Generar PDF / Guardar Oficialmente`;
        });

    } catch (error) {
        console.error("Error al generar PDF vectorial:", error);
        alert("Error al procesar los datos: " + error.message);
    } finally {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
};

// GUARDADO AUTOMÁTICO DEL BLOB A FIREBASE STORAGE
window.accionGuardarPDFDefinitivo = async function() {
    const fecha = document.getElementById('prevDateField').value;
    const btn = document.getElementById('btnGuardarOficial');

    if (!pdfBlobGenerado) return alert("Primero debe generar la vista previa del PDF.");

    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">cloud_upload</span> Subiendo a Firebase...`;

    try {
        const storagePath = `reportes_pdfs/${PROJECT_ID}/${fecha}_RD_${window.APP_STATE.nombreProyecto}.pdf`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, pdfBlobGenerado);
        const urlPDFDescarga = await getDownloadURL(storageRef);

        const docId = fecha + "_" + PROJECT_ID;
        const reporteRef = doc(db, "reportes_diarios", docId);
        const partesFecha = fecha.split('-');
        const correlativoNum = `${partesFecha[0].substring(2)}${partesFecha[1]}${partesFecha[2]}`;

        await setDoc(reporteRef, {
            url_pdf_oficial: urlPDFDescarga,
            num_registro_oficial: correlativoNum,
            fecha_guardado_pdf: new Date().toISOString()
        }, { merge: true });

        document.getElementById('envioDateField').value = fecha;
        window.cargarDatosMensajeria();

        btn.innerHTML = "✅ PDF Guardado Oficialmente";
        alert(`✅ PDF vectorial compilado y registrado en Firebase Storage exitosamente.`);

    } catch (error) {
        console.error("Error al guardar PDF:", error);
        alert("Error al guardar en Storage: " + error.message);
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = origText;
        }, 2000);
    }
};


// GUARDADO AUTOMÁTICO DEL BLOB A FIREBASE STORAGE
window.accionGuardarPDFDefinitivo = async function() {
    const fecha = document.getElementById('prevDateField').value;
    const btn = document.getElementById('btnGuardarOficial');

    if (!pdfBlobGenerado) return alert("Primero debe generar la vista previa del PDF.");

    const origText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">cloud_upload</span> Subiendo a Firebase...`;

    try {
        const storagePath = `reportes_pdfs/${PROJECT_ID}/${fecha}_RD_${window.APP_STATE.nombreProyecto}.pdf`;
        const storageRef = ref(storage, storagePath);
        
        await uploadBytes(storageRef, pdfBlobGenerado);
        const urlPDFDescarga = await getDownloadURL(storageRef);

        const docId = fecha + "_" + PROJECT_ID;
        const reporteRef = doc(db, "reportes_diarios", docId);
        const partesFecha = fecha.split('-');
        const correlativoNum = `${partesFecha[0].substring(2)}${partesFecha[1]}${partesFecha[2]}`;

        await setDoc(reporteRef, {
            url_pdf_oficial: urlPDFDescarga,
            num_registro_oficial: correlativoNum,
            fecha_guardado_pdf: new Date().toISOString()
        }, { merge: true });

        document.getElementById('envioDateField').value = fecha;
        window.cargarDatosMensajeria();

        btn.innerHTML = "✅ PDF Guardado Oficialmente";
        alert(`✅ PDF vectorial compilado y registrado en Firebase Storage exitosamente.`);

    } catch (error) {
        console.error("Error al guardar PDF:", error);
        alert("Error al guardar en Storage: " + error.message);
    } finally {
        setTimeout(() => {
            btn.disabled = false;
            btn.innerHTML = origText;
        }, 2000);
    }
};

// ==========================================
// SECCIÓN: PESTAÑA ENVIAR CORREO (PESTAÑA 4)
// ==========================================

window.cargarDatosMensajeria = async function() {
    const fecha = document.getElementById('envioDateField').value;
    if (!fecha) return alert("Seleccione una fecha para cargar el correo.");

    const partesFecha = fecha.split('-');
    if (partesFecha.length !== 3) return;

    // Captura directa y segura por ID
    const btn = document.getElementById('btnCargarCorreo');
    const origText = btn ? btn.innerHTML : '';
    
    if (btn) {
        btn.innerHTML = `<span class="material-symbols-outlined text-lg animate-spin">sync</span> Cargando...`;
        btn.disabled = true;
    }

    const fechaFmt = `${partesFecha[2]}/${partesFecha[1]}/${partesFecha[0]}`;
    const correlativo = `${partesFecha[0].substring(2)}${partesFecha[1]}${partesFecha[2]}`;
    const projName = window.APP_STATE.nombreProyecto || PROJECT_ID;

    // 1. Llenar Asunto
    document.getElementById('envioAsunto').value = `REPORTE DIARIO DE OBRA - ${projName} - N° ${correlativo} (${fechaFmt})`;

    // 2. Llenar Para y CC
    const formatEmails = (str) => str ? str.replace(/;/g, ',').replace(/\s+/g, '') : "";
    document.getElementById('envioPara').value = formatEmails(window.APP_STATE.correosPara);
    document.getElementById('envioCc').value = formatEmails(window.APP_STATE.correosCC);

    // 3. Consultar PDF oficial guardado en Firestore
    let linkDescarga = "⚠️ (El PDF aún no ha sido generado/guardado en la pestaña PDF)";

    try {
        const docId = fecha + "_" + PROJECT_ID;
        const docSnap = await getDoc(doc(db, "reportes_diarios", docId));
        
        if (docSnap.exists() && docSnap.data().url_pdf_oficial) {
            window.CURRENT_PDF_URL_TO_SEND = docSnap.data().url_pdf_oficial;
            linkDescarga = window.CURRENT_PDF_URL_TO_SEND;
        } else {
            window.CURRENT_PDF_URL_TO_SEND = null;
        }
    } catch(e) {
        console.warn("No se pudo obtener el PDF oficial de Firestore:", e);
    }

    // 4. Llenar Cuerpo
    document.getElementById('envioCuerpo').value = `Buenas tardes estimados,\n\nSe remite el Reporte Diario de Avance de Obra correspondiente a la fecha ${fechaFmt} para el proyecto ${projName}.\n\nPuede visualizar y descargar el documento oficial (PDF) desde el siguiente enlace seguro:\n${linkDescarga}\n\nQuedamos atentos a cualquier duda u observación.\n\nAtentamente,`;

    if (btn) {
        btn.innerHTML = origText;
        btn.disabled = false;
    }
};

window.accionEnviarCorreoDefinitivo = async function(proveedor) {
    const para = document.getElementById('envioPara').value.trim();
    const cc = document.getElementById('envioCc').value.trim();
    const asunto = document.getElementById('envioAsunto').value.trim();
    const cuerpo = document.getElementById('envioCuerpo').value.trim();

    if (!para || !asunto) return alert("Por favor complete los campos 'Para' y 'Asunto'.");

    if (!window.CURRENT_PDF_URL_TO_SEND) {
        if (!confirm("⚠️ No se encontró un enlace de PDF guardado para esta fecha. ¿Deseas abrir el correo de todos modos?")) {
            return;
        }
    }

    // Separamos por comas, codificamos cada correo individualmente y los volvemos a unir con comas reales
    const toEnc = para.split(',').map(e => encodeURIComponent(e.trim())).join(',');
    const ccEnc = cc ? cc.split(',').map(e => encodeURIComponent(e.trim())).join(',') : '';
    const suEnc = encodeURIComponent(asunto);
    const bodyEnc = encodeURIComponent(cuerpo);

    const esCelular = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // EL ORDEN ES CRÍTICO: El parámetro 'body' siempre debe ir al final
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