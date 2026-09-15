// ==========================================
// registro_fotografico.js (Con app_core y sidebar.js)
// ==========================================

import { auth, db, initAppCore } from "./app_core.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-storage.js";
import { doc, setDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const storage = getStorage();

let fotosLote = []; 
let ubicacionGPS = "-0.00000, -0.00000";

// --- INICIALIZACIÓN DE LA MICRO-APP ---
document.addEventListener("DOMContentLoaded", () => {
    initAppCore(true).then((estadoGlobal) => {
        if (!estadoGlobal || !estadoGlobal.proyectoActivo || !estadoGlobal.proyectoActivo.id) {
            alert("⚠️ Acceso denegado. No se seleccionó un proyecto válido.");
            window.location.href = "index.html"; 
            return;
        }

        // Setear la fecha de hoy
        const now = new Date();
        const localDate = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        document.getElementById('fechaRegistro').value = localDate;

        obtenerUbicacion();

        // Ocultar carga y mostrar contenido principal
        document.getElementById('pantalla-carga').classList.add('hidden');
        document.getElementById('navbar-global').classList.remove('hidden');
        document.getElementById('main-content').classList.remove('hidden');

    }).catch(error => {
        console.error("Error al iniciar:", error);
        alert("Ocurrió un error al cargar el contexto del proyecto.");
    });
});

function obtenerUbicacion() {
    navigator.geolocation.getCurrentPosition(
        (pos) => { 
            ubicacionGPS = `${pos.coords.latitude.toFixed(5)}, ${pos.coords.longitude.toFixed(5)}`; 
            document.getElementById('statusText').innerHTML = `<span class="text-green-600 flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[16px]">location_on</span> Ubicación detectada</span>`;
        },
        (err) => { 
            document.getElementById('statusText').innerHTML = `<span class="text-red-500 flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[16px]">location_off</span> Ubicación no disponible</span>`;
        },
        { enableHighAccuracy: true }
    );
}

// =====================================
// LÓGICA DE FOTOS Y MARCA DE AGUA
// =====================================

window.procesarFotoMultiple = async function(event) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    document.getElementById('statusText').innerHTML = `<span class="text-corpBlue-600 flex items-center justify-center gap-1"><span class="material-symbols-outlined animate-spin text-[16px]">refresh</span> Procesando marca(s) de agua...</span>`;
    
    for (let i = 0; i < files.length; i++) {
        await procesarUnaFoto(files[i]);
    }
    
    document.getElementById('statusText').innerHTML = `<span class="text-green-600 flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[16px]">check_circle</span> Fotos procesadas</span>`;
    
    document.getElementById('cameraInput').value = "";
    document.getElementById('galleryInput').value = "";
};

function procesarUnaFoto(file) {
    return new Promise((resolve) => {
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

                // --- TEXTO Y LOGO ---
                const fontSize = Math.max(12, Math.floor(height * 0.02)); 
                const interlineado = fontSize * 1.5; 
                const logoX = width * 0.03;
                
                ctx.font = `${fontSize}px sans-serif`; 
                ctx.fillStyle = "white";
                ctx.shadowColor = "rgba(0, 0, 0, 0.8)";
                ctx.shadowBlur = 4;
                ctx.shadowOffsetX = 1;
                ctx.shadowOffsetY = 1;

                const sellarFoto = (logoHeightPx, logoWidthPx, logoObject) => {
                    const bloqueTextoHeight = interlineado * 4;
                    let currentY = height - (bloqueTextoHeight + logoHeightPx + (height * 0.04));

                    if (logoObject) {
                        ctx.drawImage(logoObject, logoX, currentY, logoWidthPx, logoHeightPx);
                    }
                    
                    let textY = currentY + logoHeightPx + (interlineado * 0.8); 

                    // 1. Empresa Contratista
                    ctx.fillText(window.APP_STATE.empresa.nombre || "Empresa Sin Nombre", logoX, textY);
                    textY += interlineado;
                    
                    // 2. Nombre del Proyecto
                    ctx.fillText((window.APP_STATE.proyectoActivo.nombre || "").substring(0, 40), logoX, textY);
                    textY += interlineado;
                    
                    // 3. Fecha y Hora
                    const fechaSeleccionada = document.getElementById('fechaRegistro').value;
                    const partes = fechaSeleccionada.split('-'); 
                    const fechaFormat = `${partes[2]}.${partes[1]}.${partes[0]}`;
                    const horas = String(new Date().getHours()).padStart(2, '0');
                    const minutos = String(new Date().getMinutes()).padStart(2, '0');
                    ctx.fillText(`${fechaFormat} ${horas}:${minutos}`, logoX, textY);
                    textY += interlineado;
                    
                    // 4. Ubicación GPS
                    ctx.fillText(ubicacionGPS, logoX, textY);
                    ctx.shadowColor = "transparent";

                    // Generar y guardar
                    const base64Generado = canvas.toDataURL("image/jpeg", 0.85);
                    fotosLote.push(base64Generado);
                    actualizarGaleria();
                    resolve();
                };

                // Cargar Logo oficial desde caché
                const logoUrl = window.APP_STATE.empresa.logo;
                if (logoUrl) {
                    const watermarkObj = new Image();
                    watermarkObj.crossOrigin = "Anonymous";
                    watermarkObj.onload = function() {
                        const aspect = watermarkObj.naturalWidth / watermarkObj.naturalHeight;
                        const targetLogoHeight = height * 0.06;
                        const targetLogoWidth = targetLogoHeight * aspect;
                        sellarFoto(targetLogoHeight, targetLogoWidth, watermarkObj);
                    };
                    watermarkObj.onerror = function() {
                        sellarFoto(0, 0, null);
                    };
                    watermarkObj.src = logoUrl;
                } else {
                    sellarFoto(0, 0, null);
                }
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function actualizarGaleria() {
    const zonaSubida = document.getElementById('zonaSubida');
    const galeriaScroll = document.getElementById('galeriaScroll');
    
    if(fotosLote.length > 0) {
        zonaSubida.classList.remove('hidden');
        zonaSubida.classList.add('flex');
        document.getElementById('contadorFotos').innerText = fotosLote.length;
        document.getElementById('textoBtnGuardar').innerText = `Subir ${fotosLote.length} foto(s)`;
        
        galeriaScroll.innerHTML = "";
        fotosLote.forEach((foto, index) => {
            galeriaScroll.innerHTML += `
                <div class="relative w-full aspect-[3/4]">
                    <img src="${foto}" class="w-full h-full object-cover rounded-lg border border-slate-300 shadow-sm bg-white">
                    <button onclick="window.eliminarFoto(${index})" class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-[12px] font-bold shadow-md hover:bg-red-600 transition">X</button>
                </div>
            `;
        });
    } else {
        zonaSubida.classList.add('hidden');
        zonaSubida.classList.remove('flex');
    }
}

window.eliminarFoto = function(index) {
    fotosLote.splice(index, 1);
    actualizarGaleria();
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

// =====================================
// ENVÍO A FIREBASE STORAGE Y FIRESTORE
// =====================================
window.guardarYEnviarLote = async function() {
    if (fotosLote.length === 0) return;
    
    const PROJECT_ID = window.APP_STATE.proyectoActivo.id;
    const btn = document.getElementById('btnGuardarMasivo');
    const toggleLocal = document.getElementById('toggleLocal').checked;
    const fechaSeleccionada = document.getElementById('fechaRegistro').value;
    
    btn.innerHTML = `Subiendo a la nube... <span class="material-symbols-outlined animate-spin text-lg">refresh</span>`;
    btn.disabled = true;

    let errores = 0;
    let fotosParaFirestore = []; // Nuevo: Arreglo para guardar en base de datos

    for (let i = 0; i < fotosLote.length; i++) {
        const fotoBase64 = fotosLote[i];

        // 1. Descarga Local Opcional
        if (toggleLocal) {
            try {
                const a = document.createElement("a");
                a.href = fotoBase64;
                a.download = `IMG_${PROJECT_ID}_${Date.now()}_${i+1}.jpg`; 
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            } catch(e) { console.log("Error descarga local: " + i); }
        }

        // 2. Subida a Firebase Storage
        try {
            const blob = dataURItoBlob(fotoBase64);
            const storagePath = `registro_fotos/${PROJECT_ID}/${fechaSeleccionada}/FOTO_${Date.now()}_${i+1}.jpg`;
            const storageRef = ref(storage, storagePath);
            await uploadBytes(storageRef, blob);
            
            // 3. Obtener la URL pública oficial
            const urlDescarga = await getDownloadURL(storageRef);
            
            fotosParaFirestore.push({
                id_foto: "FOTO_" + Date.now().toString(36) + "_" + i,
                url: urlDescarga,
                hora_subida: new Date().toISOString()
            });

        } catch (error) {
            console.error("Error subiendo foto", error);
            errores++;
        }
    }

    // 4. Guardar unificado en FIRESTORE (La lógica que pediste)
    if (fotosParaFirestore.length > 0) {
        try {
            const docId = fechaSeleccionada + "_" + PROJECT_ID;
            const galeriaRef = doc(db, "registro_fotos", docId);
            const usuarioSube = window.APP_STATE.user.nombre || window.APP_STATE.user.email;

            await setDoc(galeriaRef, {
                id_proyect: PROJECT_ID,
                fecha_proyect: fechaSeleccionada,
                creadopor_proyect: usuarioSube,
                fotos: arrayUnion(...fotosParaFirestore) // Agrega las nuevas sin borrar las viejas
            }, { merge: true });
        } catch (dbError) {
            console.error("Error guardando en Firestore:", dbError);
            errores++;
        }
    }

    if (errores === 0) {
        alert(`✅ Lote de ${fotosLote.length} foto(s) guardado exitosamente en la base de datos.`);
    } else {
        alert(`⚠️ Proceso terminado, pero ocurrieron ${errores} errores.`);
    }

    fotosLote = [];
    actualizarGaleria();
    btn.innerHTML = `<span class="material-symbols-outlined">cloud_upload</span> Subir Fotos a Firebase`;
    btn.disabled = false;
    document.getElementById('statusText').innerHTML = `<span class="text-green-600 flex items-center justify-center gap-1"><span class="material-symbols-outlined text-[16px]">check_circle</span> Listo para nuevo lote</span>`;
};