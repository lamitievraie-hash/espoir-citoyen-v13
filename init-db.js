const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const db = new sqlite3.Database('./ong.db');

db.serialize(() => {
  // 1. Créer la table Membres D'ABORD
  db.run(`CREATE TABLE IF NOT EXISTS Membres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'membre'
  )`);

  // 2. PUIS insérer le président
  db.run(`INSERT OR IGNORE INTO Membres (nom, email, password, role) VALUES (?, ?, ?, ?)`, 
    ['Président', 'president@espoircitoyen.org', bcrypt.hashSync('admin123', 10), 'admin']
  );

  // 3. Table Projets
  db.run(`CREATE TABLE IF NOT EXISTS Projets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL,
    description TEXT,
    budget REAL DEFAULT 0,
    statut TEXT DEFAULT 'en_cours'
  )`);
  
  console.log('✅ Base ong.db créée avec succès');
});

db.close();
  
  // Table Projets
  db.run(`CREATE TABLE IF NOT EXISTS Projets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL,
    description TEXT,
    budget REAL DEFAULT 0,
    statut TEXT DEFAULT 'en_cours',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Créer un admin par défaut
  const hashedPassword = bcrypt.hashSync('admin123', 10);
  db.run(`INSERT OR IGNORE INTO Membres (nom, email, password, role) 
          VALUES ('Admin', 'admin@espoir.ci',?, 'admin')`, [hashedPassword]);
  
  console.log('✅ Base ong.db créée');
  console.log('✅ Tables: Membres, Projets');
  console.log('✅ Compte admin: admin@espoir.ci / admin123');
});

db.close();
