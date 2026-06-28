const CACHE_NAME = 'biblia-ia-v1';
const BIBLE_DATA_URL = '/api/bible/all';

const STATIC_ASSETS = [
    '/',
    '/biblia',
    '/css/index.css',
    '/js/app.js',
    '/manifest.json',
    'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;600;700&display=swap',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            console.log('Caching static assets...');
            await cache.addAll(STATIC_ASSETS);
            console.log('Caching full bible data for offline use...');
            try {
                const bibleResponse = await fetch(BIBLE_DATA_URL);
                if (bibleResponse.ok) {
                    await cache.put(BIBLE_DATA_URL, bibleResponse);
                    console.log('Bible data cached successfully!');
                }
            } catch (err) {
                console.error('Failed to cache bible data on install', err);
            }
            return self.skipWaiting();
        })
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Si es una llamada a la API de la biblia (excepto la descarga total), interceptarla
    if (url.pathname.startsWith('/api/bible/') && url.pathname !== BIBLE_DATA_URL) {
        event.respondWith(handleBibleApi(url));
        return;
    }

    // Para el resto (archivos estáticos, páginas html), estrategia Stale-While-Revalidate o Cache First
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            const fetchPromise = fetch(event.request).then((networkResponse) => {
                if (networkResponse && networkResponse.ok && event.request.method === 'GET' && !url.pathname.startsWith('/api/')) {
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, networkResponse.clone());
                    });
                }
                return networkResponse;
            }).catch(() => {
                // Ignore network errors (offline)
            });
            return cachedResponse || fetchPromise;
        })
    );
});

async function handleBibleApi(url) {
    try {
        const cache = await caches.open(CACHE_NAME);
        const response = await cache.match(BIBLE_DATA_URL);
        if (!response) {
            // Si por alguna razón no está en caché, intenta obtenerlo de red
            const networkResponse = await fetch(url.href);
            return networkResponse;
        }

        const bible = await response.json();
        const bibleIndex = bible.index;
        const bibleData = bible.data;

        // /api/bible/books
        if (url.pathname === '/api/bible/books') {
            return createJsonResponse(bibleIndex);
        }

        // /api/bible/book/:bookKey
        if (url.pathname.startsWith('/api/bible/book/')) {
            const parts = url.pathname.split('/');
            const bookKey = parts[parts.length - 1];
            const bookDataObj = bibleData[bookKey];
            if (!bookDataObj) return createErrorResponse("Libro no encontrado");
            const chapters = bookDataObj.map(chapter => chapter.length);
            return createJsonResponse({ chapters });
        }

        // /api/bible/verse
        if (url.pathname === '/api/bible/verse') {
            const book = url.searchParams.get('book');
            const chapter = url.searchParams.get('chapter');
            const verse = url.searchParams.get('verse');

            if (!book || !chapter || !verse) return createErrorResponse("Faltan parámetros");
            const bookDataObj = bibleData[book];
            if (!bookDataObj) return createErrorResponse("Libro no encontrado");
            const chapterData = bookDataObj[parseInt(chapter) - 1];
            if (!chapterData) return createErrorResponse("Capítulo no encontrado");
            const verseText = chapterData[parseInt(verse) - 1];
            if (!verseText) return createErrorResponse("Versículo no encontrado");

            const bookInfo = bibleIndex.find(b => b.key === book);
            return createJsonResponse({
                bookKey: book,
                bookName: bookInfo ? bookInfo.title : book,
                shortName: bookInfo ? bookInfo.shortTitle : book,
                chapter: parseInt(chapter),
                verse: parseInt(verse),
                text: verseText
            });
        }

        // /api/bible/search
        if (url.pathname === '/api/bible/search') {
            const query = url.searchParams.get('q');
            if (!query || query.length < 3) return createJsonResponse([]);

            const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            const searchTerms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
            const results = [];
            let count = 0;

            for (const book of bibleIndex) {
                const bookDataObj = bibleData[book.key];
                if (!bookDataObj) continue;

                for (let c = 0; c < bookDataObj.length; c++) {
                    const chapter = bookDataObj[c];
                    for (let v = 0; v < chapter.length; v++) {
                        const text = chapter[v];
                        const normalizedText = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
                        
                        let isMatch = searchTerms.length > 0;
                        for (const term of searchTerms) {
                            if (!normalizedText.includes(term)) {
                                isMatch = false;
                                break;
                            }
                        }

                        if (isMatch) {
                            results.push({
                                bookKey: book.key,
                                bookName: book.title,
                                shortName: book.shortTitle,
                                chapter: c + 1,
                                verse: v + 1,
                                text: text
                            });
                            count++;
                            if (count > 20) break;
                        }
                    }
                    if (count > 20) break;
                }
                if (count > 20) break;
            }

            return createJsonResponse(results);
        }

        // Default fallback to network
        return await fetch(url.href);

    } catch (error) {
        console.error("Error in Service Worker Bible API:", error);
        return createErrorResponse("Error procesando de forma offline");
    }
}

function createJsonResponse(data) {
    return new Response(JSON.stringify(data), {
        headers: { 'Content-Type': 'application/json' }
    });
}

function createErrorResponse(message) {
    return new Response(JSON.stringify({ error: message }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
    });
}
