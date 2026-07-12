const express = require('express');
const path = require('path');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'espoir_citoyen_secret_key';

app.use(express.json());
app.use(express.static('public'));

// === BASE DE DONNÉES ===
const db = new sqlite3.Database('./ong.db', (err) => {
  if (err) {
    console.error('Erreur connexion DB:', err.message);
  } else {
    console.log('✅ Connecté à la base SQLite.');

    // Table Membres
    db.run(`CREATE TABLE IF NOT EXISTS Membres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mot_de_passe TEXT NOT NULL,
      role TEXT DEFAULT 'membre',
      date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (!err) {
        // Table Cotisations - APRÈS Membres
        db.run(`CREATE TABLE IF NOT EXISTS Cotisations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          membre_id INTEGER NOT NULL,
          montant REAL NOT NULL,
          date_cotisation DATE DEFAULT (date('now')),
          mois TEXT NOT NULL,
          annee INTEGER NOT NULL,
          methode TEXT DEFAULT 'Espèces',
          note TEXT,
          date_creation DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(membre_id) REFERENCES Membres(id)
        )`);

        // Insertion des users par défaut
        const users = [
          ['Président ESPOIR CITOYEN', 'president@espoircitoyen.org', 'admin123', 'admin'],
          ['Trésorier ESPOIR CITOYEN', 'tresorier@espoircitoyen.org', 'admin123', 'admin'],
          ['Secrétaire ESPOIR CITOYEN', 'secretaire@espoircitoyen.org', 'admin123', 'admin']
        ];

        users.forEach(([nom, email, password, role]) => {
          bcrypt.hash(password, 10, (err, hash) => {
            if (!err) {
              db.run(
                `INSERT OR IGNORE INTO Membres (nom, email, mot_de_passe, role) VALUES (?,?,?,?)`,
                [nom, email, hash, role]
              );
            }
          });
        });
      }
    });
  }
});

// === AUTH ===
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;

  db.get(`SELECT * FROM Membres WHERE email =?`, [email], (err, user) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    if (!user) return res.status(401).json({ error: 'Email ou mot de passe incorrect' });

    bcrypt.compare(password, user.mot_de_passe, (err, result) => {
      if (result) {
        const token = jwt.sign(
          { id: user.id, email: user.email, role: user.role },
          JWT_SECRET,
          { expiresIn: '24h' }
        );
        res.json({
          token,
          user: { id: user.id, nom: user.nom, email: user.email, role: user.role }
        });
      } else {
        res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      }
    });
  });
});

// === ROUTES UNIQUES - PAS DE DOUBLONS ===

app.get('/user', (req, res) => {
  res.json({
    id: 1,
    nom: "Président ESPOIR CITOYEN",
    email: "president@espoircitoyen.org",
    role: "admin"
  });
});

app.get('/stats', (req, res) => {
  db.get("SELECT COUNT(*) as total FROM Membres", [], (err, rowMembres) => {
    db.get("SELECT SUM(montant) as total FROM Cotisations", [], (err, rowCotis) => {
      res.json({
        membres: rowMembres?.total || 0,
        projets: 0,
        cotisations: rowCotis?.total || 0,
        solde: rowCotis?.total || 0
      });
    });
  });
});

app.get('/api/dashboard', (req, res) => {
  db.get("SELECT COUNT(*) as total FROM Membres", [], (err, rowMembres) => {
    db.get("SELECT SUM(montant) as total FROM Cotisations", [], (err, rowCotis) => {
      res.json({
        message: 'Bienvenue sur le dashboard ESPOIR CITOYEN',
        membres: rowMembres?.total || 0,
        projets: 0,
        cotisations: rowCotis?.total || 0,
        solde: rowCotis?.total || 0
      });
    });
  });
});

app.get('/api/comptabilite', (req, res) => {
  db.get("SELECT SUM(montant) as total FROM Cotisations", [], (err, row) => {
    const totalCotisations = row?.total || 0;
    res.json({
      recettes: totalCotisations,
      depenses: 0,
      solde: totalCotisations
    });
  });
});

app.get('/api/membres', (req, res) => {
  db.all("SELECT id, nom, email, role, date_inscription FROM Membres", [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.get('/api/cotisations', (req, res) => {
  db.all(`
    SELECT c.*, m.nom as membre_nom, m.email as membre_email
    FROM Cotisations c
    JOIN Membres m ON c.membre_id = m.id
    ORDER BY c.date_cotisation DESC
  `, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/cotisations', (req, res) => {
  const { membre_id, montant, mois, annee, methode, note } = req.body;

  if (!membre_id ||!montant ||!mois ||!annee) {
    return res.status(400).json({ error: 'Champs obligatoires manquants' });
  }

  db.run(
    `INSERT INTO Cotisations (membre_id, montant, mois, annee, methode, note)
     VALUES (?,?,?,?,?,?)`,
    [membre_id, montant, mois, annee, methode || 'Espèces', note || ''],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        success: true,
        id: this.lastID,
        message: 'Cotisation enregistrée'
      });
    }
  );
});

app.get('/api/projets', (req, res) => res.json([]));
app.get('/api/depenses', (req, res) => res.json([]));
app.get('/api/recettes', (req, res) => res.json([]));
app.get('/api/evenements', (req, res) => res.json([]));
app.get('/api/reunions', (req, res) => res.json([]));
app.get('/api/presences', (req, res) => res.json([]));
app.get('/api/documents', (req, res) => res.json([]));
app.get('/api/archives', (req, res) => res.json([]));
app.get('/api/rapports', (req, res) => res.json([]));

app.get('/debug-users', (req, res) => {
  db.all("SELECT id, email, nom, role FROM Membres", [], (err, rows) => {
    if (err) return res.json({ error: err.message });
    res.json({ total: rows.length, users: rows });
  });
});

// === FRONTEND - TOUJOURS EN DERNIER ===
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur ESPOIR CITOYEN V13 démarré sur port ${PORT}`);
});
