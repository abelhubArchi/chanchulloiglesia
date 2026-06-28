-- Script de inicialización de Base de Datos para Biblia de Estudio IA

CREATE TABLE IF NOT EXISTS books (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    testament VARCHAR(20) NOT NULL,
    abbreviations TEXT[] -- Array de strings con abreviaturas (ej: '{"Gen", "Gn", "Génesis"}')
);

CREATE TABLE IF NOT EXISTS verses (
    id SERIAL PRIMARY KEY,
    book_id INTEGER REFERENCES books(id),
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS themes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT
);

CREATE TABLE IF NOT EXISTS verse_themes (
    verse_id INTEGER REFERENCES verses(id),
    theme_id INTEGER REFERENCES themes(id),
    PRIMARY KEY (verse_id, theme_id)
);

CREATE TABLE IF NOT EXISTS characters (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    biography TEXT,
    family_tree TEXT
);

CREATE TABLE IF NOT EXISTS verse_characters (
    verse_id INTEGER REFERENCES verses(id),
    character_id INTEGER REFERENCES characters(id),
    PRIMARY KEY (verse_id, character_id)
);

CREATE TABLE IF NOT EXISTS cross_references (
    source_verse_id INTEGER REFERENCES verses(id),
    target_verse_id INTEGER REFERENCES verses(id),
    PRIMARY KEY (source_verse_id, target_verse_id)
);

-- Insertar datos de prueba básicos (Libro de Juan)
INSERT INTO books (id, name, testament, abbreviations) VALUES 
(43, 'Juan', 'Nuevo Testamento', '{"Juan", "juan", "JUAN", "Jn", "jn"}')
ON CONFLICT DO NOTHING;

INSERT INTO verses (book_id, chapter, verse, text) VALUES
(43, 3, 16, 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.'),
(43, 3, 17, 'Porque no envió Dios a su Hijo al mundo para condenar al mundo, sino para que el mundo sea salvo por él.'),
(43, 1, 1, 'En el principio era el Verbo, y el Verbo era con Dios, y el Verbo era Dios.'),
(43, 14, 6, 'Jesús le dijo: Yo soy el camino, y la verdad, y la vida; nadie viene al Padre, sino por mí.')
ON CONFLICT DO NOTHING;

INSERT INTO themes (id, name, description) VALUES
(1, 'Salvación', 'El acto de ser librado del pecado y sus consecuencias.'),
(2, 'Amor de Dios', 'El amor incondicional que Dios tiene por la humanidad.')
ON CONFLICT DO NOTHING;

INSERT INTO verse_themes (verse_id, theme_id) VALUES
((SELECT id FROM verses WHERE book_id = 43 AND chapter = 3 AND verse = 16), 1),
((SELECT id FROM verses WHERE book_id = 43 AND chapter = 3 AND verse = 16), 2)
ON CONFLICT DO NOTHING;
