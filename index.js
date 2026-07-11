const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'espoir_citoyen_v13_secret_key_2024';

// MIDDLEWARE
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// DATABASE
const db = new sqlite3.Database('./ong.db', (err) => {
  if (err) console.error(err);
  else console.log('✅ Base SQLite connectée: ong.db');
});

// INIT TABLES
db.serialize(() => {
  // Users
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    nom TEXT NOT NULL,
    role TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Membres
  db.run(`CREATE TABLE IF NOT EXISTS membres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    email TEXT,
    telephone TEXT,
    adresse TEXT,
    date_adhesion DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Projets
  db.run(`CREATE TABLE IF NOT EXISTS projets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL,
    description TEXT,
    budget REAL,
    statut TEXT DEFAULT 'En cours',
    date_debut DATE,
    date_fin DATE
  )`);
  
  // Cotisations
  db.run(`CREATE TABLE IF NOT EXISTS cotisations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    membre_id INTEGER,
    montant REAL NOT NULL,
    date_paiement DATETIME DEFAULT CURRENT_TIMESTAMP,
    annee INTEGER,
    FOREIGN KEY(membre_id) REFERENCES membres(id)
  )`);
  
  // Transactions
  db.run(`CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    montant REAL NOT NULL,
    description TEXT,
    categorie TEXT,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  
  // Séances
  db.run(`CREATE TABLE IF NOT EXISTS seances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    titre TEXT NOT NULL,
    date DATE NOT NULL,
    lieu TEXT,
    pv TEXT
  )`);
  
  // Insérer utilisateurs par défaut
  const users = [
    ['president@espoircitoyen.org', 'President2024!', 'Président ONG', 'Président'],
    ['tresorier@espoircitoyen.org', 'Tresorier2024!', 'Trésorier ONG', 'Trésorier'],
    ['secretaire@espoircitoyen.org', 'Secretaire2024!', 'Secrétaire ONG', 'Secrétaire']
  ];
  
  users.forEach(([email, pass, nom, role]) => {
    bcrypt.hash(pass, 10, (err, hash) => {
      db.run('INSERT OR IGNORE INTO users (email, password, nom, role) VALUES (?, ?, ?, ?)', 
        [email, hash, nom, role]);
    });
  });
});

// AUTH MIDDLEWARE
const authMiddleware = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token invalide' });
    req.user = decoded;
    next();
  });
};

// ROUTES AUTH
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get('SELECT * FROM users WHERE email = ?', [email], (err, user) => {
    if (err || !user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    
    bcrypt.compare(password, user.password, (err, match) => {
      if (!match) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      
      const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ token, user: { id: user.id, email: user.email, nom: user.nom, role: user.role } });
    });
  });
});

// ROUTES MEMBRES
app.get('/api/membres', authMiddleware, (req, res) => {
  db.all('SELECT * FROM membres ORDER BY nom', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/membres', authMiddleware, (req, res) => {
  const { nom, email, telephone, adresse } = req.body;
  db.run('INSERT INTO membres (nom, email, telephone, adresse) VALUES (?, ?, ?, ?)',
    [nom, email, telephone, adresse], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Membre ajouté' });
    });
});

app.put('/api/membres/:id', authMiddleware, (req, res) => {
  const { nom, email, telephone, adresse } = req.body;
  db.run('UPDATE membres SET nom=?, email=?, telephone=?, adresse=? WHERE id=?',
    [nom, email, telephone, adresse, req.params.id], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Membre modifié' });
    });
});

app.delete('/api/membres/:id', authMiddleware, (req, res) => {
  db.run('DELETE FROM membres WHERE id=?', [req.params.id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Membre supprimé' });
  });
});

// ROUTES PROJETS
app.get('/api/projets', authMiddleware, (req, res) => {
  db.all('SELECT * FROM projets ORDER BY date_debut DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/projets', authMiddleware, (req, res) => {
  const { titre, description, budget, statut, date_debut, date_fin } = req.body;
  db.run('INSERT INTO projets (titre, description, budget, statut, date_debut, date_fin) VALUES (?, ?, ?, ?, ?, ?)',
    [titre, description, budget, statut, date_debut, date_fin], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Projet ajouté' });
    });
});

// ROUTES COTISATIONS
app.get('/api/cotisations', authMiddleware, (req, res) => {
  db.all(`SELECT c.*, m.nom as membre_nom FROM cotisations c 
          LEFT JOIN membres m ON c.membre_id = m.id 
          ORDER BY c.date_paiement DESC`, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/cotisations', authMiddleware, (req, res) => {
  const { membre_id, montant, annee } = req.body;
  db.run('INSERT INTO cotisations (membre_id, montant, annee) VALUES (?, ?, ?)',
    [membre_id, montant, annee], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Cotisation enregistrée' });
    });
});

// ROUTES TRANSACTIONS
app.get('/api/transactions', authMiddleware, (req, res) => {
  db.all('SELECT * FROM transactions ORDER BY date DESC', (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/transactions', authMiddleware, (req, res) => {
  const { type, montant, description, categorie } = req.body;
  db.run('INSERT INTO transactions (type, montant, description, categorie) VALUES (?, ?, ?, ?)',
    [type, montant, description, categorie], function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: this.lastID, message: 'Transaction ajoutée' });
    });
});

// STATS DASHBOARD
app.get('/api/stats', authMiddleware, (req, res) => {
  const stats = {};
  db.get('SELECT COUNT(*) as total FROM membres', (err, row) => {
    stats.totalMembres = row.total;
    db.get('SELECT COUNT(*) as total FROM projets', (err, row) => {
      stats.totalProjets = row.total;
      db.get('SELECT SUM(montant) as total FROM transactions WHERE type="recette"', (err, row) => {
        stats.budget = row.total || 0;
        res.json(stats);
      });
    });
  });
});

// SERVE FRONTEND
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur ESPOIR CITOYEN V13 démarré sur port ${PORT}`);
  console.log(`📊 Base de données: ong.db`);
  console.log(`🔐 Auth JWT activée`);
});
