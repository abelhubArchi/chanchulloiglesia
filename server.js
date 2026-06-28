const express = require('express');
const path = require('path');
const cors = require('cors');
const expressLayouts = require('express-ejs-layouts');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Configuración de middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(expressLayouts);

// Configuración del motor de plantillas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layout'); // Indica que use views/layout.ejs

const fs = require('fs');

// Cargar la Biblia en memoria
let bibleIndex = [];
let bibleData = {}; // { "genesis": [ [ "verse1", "verse2" ], ... ] }

try {
    const indexPath = path.join(__dirname, 'data', 'biblia', 'index.json');
    if (fs.existsSync(indexPath)) {
        bibleIndex = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
        
        // Cargar cada libro
        bibleIndex.forEach(book => {
            const bookPath = path.join(__dirname, 'data', 'biblia', `${book.key}.json`);
            if (fs.existsSync(bookPath)) {
                bibleData[book.key] = JSON.parse(fs.readFileSync(bookPath, 'utf8'));
            }
        });
        console.log(`Biblia cargada: ${bibleIndex.length} libros.`);
    } else {
        console.warn("Advertencia: No se encontró index.json en data/biblia");
    }
} catch (error) {
    console.error("Error cargando la Biblia:", error);
}

// API Endpoints
app.get('/api/bible/books', (req, res) => {
    res.json(bibleIndex);
});

app.get('/api/bible/search', (req, res) => {
    const query = req.query.q;
    if (!query || query.length < 3) return res.json([]);

    const normalizedQuery = query.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const searchTerms = normalizedQuery.split(/\s+/).filter(t => t.length > 0);
    const results = [];
    let count = 0;

    for (const book of bibleIndex) {
        const bookData = bibleData[book.key];
        if (!bookData) continue;

        for (let c = 0; c < bookData.length; c++) {
            const chapter = bookData[c];
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
                    if (count > 20) break; // Limitar resultados
                }
            }
            if (count > 20) break;
        }
        if (count > 20) break;
    }

    res.json(results);
});

app.get('/api/bible/verse', (req, res) => {
    const { book, chapter, verse } = req.query;
    if (!book || !chapter || !verse) return res.status(400).json({ error: "Faltan parámetros" });

    const bookData = bibleData[book];
    if (!bookData) return res.status(404).json({ error: "Libro no encontrado" });

    const chapterData = bookData[parseInt(chapter) - 1];
    if (!chapterData) return res.status(404).json({ error: "Capítulo no encontrado" });

    const verseText = chapterData[parseInt(verse) - 1];
    if (!verseText) return res.status(404).json({ error: "Versículo no encontrado" });

    const bookInfo = bibleIndex.find(b => b.key === book);

    res.json({
        bookKey: book,
        bookName: bookInfo ? bookInfo.title : book,
        shortName: bookInfo ? bookInfo.shortTitle : book,
        chapter: parseInt(chapter),
        verse: parseInt(verse),
        text: verseText
    });
});

app.get('/api/bible/book/:bookKey', (req, res) => {
    const bookKey = req.params.bookKey;
    const bookData = bibleData[bookKey];
    if (!bookData) return res.status(404).json({ error: "Libro no encontrado" });

    // Devolver número de versículos por capítulo
    const chapters = bookData.map(chapter => chapter.length);
    res.json({ chapters });
});

// Endpoint para descargar toda la Biblia para uso offline
app.get('/api/bible/all', (req, res) => {
    res.json({
        index: bibleIndex,
        data: bibleData
    });
});

// Rutas
app.get('/', (req, res) => {
    res.render('index', { page: 'home', title: 'Biblia Reina Valera' });
});

app.get('/biblia', (req, res) => {
    res.render('biblia', { page: 'biblia', title: 'Biblia | Reina Valera' });
});

app.get('/temas', (req, res) => {
    res.render('temas', { page: 'temas', title: 'Temas | Reina Valera' });
});

app.get('/personajes', (req, res) => {
    res.render('personajes', { page: 'personajes', title: 'Personajes | Reina Valera' });
});

// Iniciar servidor local (Ignorado en Vercel)
if (process.env.NODE_ENV !== 'production') {
    app.listen(port, '0.0.0.0', () => {
        const os = require('os');
        const networkInterfaces = os.networkInterfaces();
        let localIp = 'localhost';
        
        for (const interfaceName in networkInterfaces) {
            const interfaces = networkInterfaces[interfaceName];
            for (const iface of interfaces) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    localIp = iface.address;
                    break;
                }
            }
            if (localIp !== 'localhost') break;
        }

        console.log(`\n=========================================`);
        console.log(`Biblia Reina Valera corriendo en:`);
        console.log(`- Local: http://localhost:${port}`);
        console.log(`- Red (Móvil): http://${localIp}:${port}`);
        console.log(`=========================================\n`);
    });
}

// Exportar para Vercel Serverless Functions
module.exports = app;
