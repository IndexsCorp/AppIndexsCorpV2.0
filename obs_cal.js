// ==========================================
// CONTROL DE PESTAÑAS (TABS)
// ==========================================
window.switchTab = function(tabId) {
    // 1. Ocultar todos los contenidos
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // 2. Quitar el estilo de "activo" (Azul) a todos los botones
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('bg-corpBlue-600', 'text-white', 'border-corpBlue-600', 'active');
        btn.classList.add('bg-white', 'text-slate-500', 'border-slate-300');
    });

    // 3. Mostrar el contenido seleccionado
    const selectedTab = document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (selectedTab) {
        selectedTab.classList.add('active');
    }

    // 4. Poner el estilo de "activo" (Azul) al botón clickeado
    const selectedBtn = document.getElementById('btnTab' + tabId.charAt(0).toUpperCase() + tabId.slice(1));
    if (selectedBtn) {
        selectedBtn.classList.remove('bg-white', 'text-slate-500', 'border-slate-300');
        selectedBtn.classList.add('bg-corpBlue-600', 'text-white', 'border-corpBlue-600', 'active');
    }
};