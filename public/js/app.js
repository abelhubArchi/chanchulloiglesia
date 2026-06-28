document.addEventListener('DOMContentLoaded', () => {
    // ---- Service Worker Registration (PWA) ----
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('Service Worker registrado con éxito:', registration.scope);
                })
                .catch(error => {
                    console.log('Fallo al registrar el Service Worker:', error);
                });
        });
    }

    // ---- Tema Oscuro / Claro ----
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    
    // Check localStorage
    if (localStorage.getItem('theme') === 'dark') {
        body.setAttribute('data-theme', 'dark');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    themeToggle.addEventListener('click', () => {
        if (body.getAttribute('data-theme') === 'dark') {
            body.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        } else {
            body.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    });

    // ---- Búsqueda Inteligente Real ----
    const searchInput = document.getElementById('searchInput');
    const suggestionsBox = document.getElementById('suggestionsBox');

    if (searchInput && suggestionsBox) {
        let debounceTimer;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            const query = e.target.value.trim();
            if (query.length > 2) {
                debounceTimer = setTimeout(() => {
                    fetch(`/api/bible/search?q=${encodeURIComponent(query)}`)
                        .then(res => res.json())
                        .then(data => {
                            if (data.length > 0) {
                                suggestionsBox.innerHTML = data.map(verse => {
                                    const ref = `${verse.bookName} ${verse.chapter}:${verse.verse}`;
                                    return `<div class="suggestion-item" data-book="${verse.bookKey}" data-chapter="${verse.chapter}" data-verse="${verse.verse}">
                                        <strong>${ref}</strong> - <span style="font-size: 0.8em; color: var(--text-color); opacity: 0.8;">${verse.text.substring(0, 50)}...</span>
                                    </div>`;
                                }).join('');
                                suggestionsBox.style.display = 'block';
                            } else {
                                suggestionsBox.innerHTML = `<div class="suggestion-item">No se encontraron resultados</div>`;
                                suggestionsBox.style.display = 'block';
                            }
                        })
                        .catch(err => console.error(err));
                }, 300); // 300ms debounce
            } else {
                suggestionsBox.style.display = 'none';
            }
        });

        // Click outside to close
        document.addEventListener('click', (e) => {
            if (!searchInput.contains(e.target) && !suggestionsBox.contains(e.target)) {
                suggestionsBox.style.display = 'none';
            }
        });

        suggestionsBox.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            if (item && item.getAttribute('data-book')) {
                const book = item.getAttribute('data-book');
                const chapter = item.getAttribute('data-chapter');
                const verse = item.getAttribute('data-verse');
                
                localStorage.setItem('currentVerseQuery', JSON.stringify({ book, chapter, verse }));
                window.location.href = '/biblia';
            }
        });
    }

    // ---- Búsqueda Manual ----
    const bookSelect = document.getElementById('bookSelect');
    const chapterSelect = document.getElementById('chapterSelect');
    const verseSelect = document.getElementById('verseSelect');
    const manualSearchBtn = document.getElementById('manualSearchBtn');

    if (bookSelect) {
        let currentBookChapters = [];

        // Load books
        fetch('/api/bible/books')
            .then(res => res.json())
            .then(data => {
                data.sort((a, b) => a.shortTitle.localeCompare(b.shortTitle));
                bookSelect.innerHTML = '<option value="">Selecciona libro...</option>' + 
                    data.map(b => `<option value="${b.key}">${b.shortTitle}</option>`).join('');
            });

        bookSelect.addEventListener('change', () => {
            const bookKey = bookSelect.value;
            if (bookKey) {
                fetch(`/api/bible/book/${bookKey}`)
                    .then(res => res.json())
                    .then(data => {
                        currentBookChapters = data.chapters;
                        chapterSelect.innerHTML = '<option value="">Capítulo...</option>' + 
                            currentBookChapters.map((_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
                        chapterSelect.disabled = false;
                        verseSelect.innerHTML = '<option value="">--</option>';
                        verseSelect.disabled = true;
                    });
            } else {
                chapterSelect.innerHTML = '<option value="">--</option>';
                chapterSelect.disabled = true;
                verseSelect.innerHTML = '<option value="">--</option>';
                verseSelect.disabled = true;
            }
        });

        chapterSelect.addEventListener('change', () => {
            const chapterIdx = parseInt(chapterSelect.value) - 1;
            if (chapterIdx >= 0 && currentBookChapters[chapterIdx]) {
                const numVerses = currentBookChapters[chapterIdx];
                verseSelect.innerHTML = '<option value="">Versículo...</option>' + 
                    Array.from({length: numVerses}, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('');
                verseSelect.disabled = false;
            } else {
                verseSelect.innerHTML = '<option value="">--</option>';
                verseSelect.disabled = true;
            }
        });

        if (manualSearchBtn) {
            manualSearchBtn.addEventListener('click', () => {
                const book = bookSelect.value;
                const chapter = chapterSelect.value;
                const verse = verseSelect.value;
                
                if (book && chapter && verse) {
                    localStorage.setItem('currentVerseQuery', JSON.stringify({ book, chapter, verse }));
                    window.location.href = '/biblia';
                } else {
                    alert("Por favor selecciona libro, capítulo y versículo.");
                }
            });
        }
    }

    // ---- Vista de Biblia Real ----
    const verseTitle = document.getElementById('verseTitle');
    const verseText = document.getElementById('verseText');
    
    if (verseTitle && verseText) {
        const savedQueryJson = localStorage.getItem('currentVerseQuery');
        if (savedQueryJson) {
            try {
                const { book, chapter, verse } = JSON.parse(savedQueryJson);
                fetch(`/api/bible/verse?book=${book}&chapter=${chapter}&verse=${verse}`)
                    .then(res => res.json())
                    .then(data => {
                        if (data.error) {
                            verseTitle.textContent = "Error";
                            verseText.textContent = data.error;
                        } else {
                            verseTitle.textContent = `${data.bookName} ${data.chapter}:${data.verse}`;
                            verseText.textContent = data.text;
                        }
                    })
                    .catch(err => {
                        verseTitle.textContent = "Error de red";
                        verseText.textContent = "No se pudo cargar el versículo.";
                    });
            } catch (e) {
                console.error(e);
            }
        } else {
            // Default verse
            fetch(`/api/bible/verse?book=juan&chapter=3&verse=16`)
                .then(res => res.json())
                .then(data => {
                    if (!data.error) {
                        verseTitle.textContent = `${data.bookName} ${data.chapter}:${data.verse}`;
                        verseText.textContent = data.text;
                    }
                });
        }
    }

    // ---- PWA Install Logic ----
    let deferredPrompt;
    const installBanner = document.getElementById('installBanner');
    const installBtn = document.getElementById('installBtn');
    const closeInstallBtn = document.getElementById('closeInstallBtn');
    const installMessage = document.getElementById('installMessage');

    // Detectar iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;

    if (isIOS && !isStandalone) {
        installMessage.innerHTML = 'Para instalar en iPhone, toca el ícono <i class="fas fa-share-square"></i> Compartir y elige <strong>"Agregar a inicio"</strong>.';
        installBtn.style.display = 'none'; // iOS no soporta el botón automático de instalación
        if (installBanner) installBanner.classList.remove('hidden');
    }

    window.addEventListener('beforeinstallprompt', (e) => {
        // Prevenir la alerta por defecto del mini-infobar en móviles
        e.preventDefault();
        // Guardar el evento para dispararlo luego
        deferredPrompt = e;
        
        // Mostrar el banner personalizado
        if (installBanner && !isStandalone) {
            installBanner.classList.remove('hidden');
        }
    });

    if (installBtn) {
        installBtn.addEventListener('click', async () => {
            if (installBanner) installBanner.classList.add('hidden');
            
            if (deferredPrompt) {
                // Mostrar el prompt del sistema
                deferredPrompt.prompt();
                // Esperar a ver qué responde el usuario
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to the install prompt: ${outcome}`);
                // Limpiar la variable
                deferredPrompt = null;
            } else {
                // Por si acaso están en HTTP local y Chrome bloquea el evento
                alert("Para instalar, toca los 3 puntitos del navegador y busca la opción 'Instalar aplicación' o 'Agregar a la pantalla principal'.");
            }
        });
    }

    if (closeInstallBtn) {
        closeInstallBtn.addEventListener('click', () => {
            if (installBanner) installBanner.classList.add('hidden');
        });
    }

    // ---- Offline/Online Detection ----
    const offlineBadge = document.getElementById('offlineBadge');
    
    function updateOnlineStatus() {
        if (!navigator.onLine) {
            if (offlineBadge) offlineBadge.classList.remove('hidden');
        } else {
            if (offlineBadge) offlineBadge.classList.add('hidden');
        }
    }

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    
    // Check inicial
    updateOnlineStatus();
});
