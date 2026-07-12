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

// Initialisation base de données
const db = new sqlite3.Database('./ong.db', (err) => {
  if (err) {
    console.error('Erreur connexion DB:', err.message);
  } else {
    console.log('✅ Connecté à la base SQLite.');
    db.run(`CREATE TABLE IF NOT EXISTS Membres (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nom TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      mot_de_passe TEXT NOT NULL,
      role TEXT DEFAULT 'membre',
      date_inscription DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) {
        console.error('Erreur création table Membres:', err.message);
      } else {
        // Création des users par défaut
        const users = [
          ['Président ESPOIR CITOYEN', 'president@espoircitoyen.org', 'admin123', 'admin'],
          ['Trésorier ESPOIR CITOYEN', 'tresorier@espoircitoyen.org', 'admin123', 'admin'],
          ['Secrétaire ESPOIR CITOYEN', 'secretaire@espoircitoyen.org', 'admin123', 'admin']
        ];
        
        users.forEach(([nom, email, password, role]) => {
          bcrypt.hash(password, 10, (err, hash) => {
            if (!err) {
              db.run(
                `INSERT OR IGNORE INTO Membres (nom, email, mot_de_passe, role) VALUES (?, ?, ?, ?)`,
                [nom, email, hash, role],
                (err) => {
                  if (!err) console.log(`✅ User créé: ${email}`);
                }
              );
            }
          });
        });
      }
    });
  }
});

// Route de connexion
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  
  db.get(`SELECT * FROM Membres WHERE email = ?`, [email], (err, user) => {
    if (err) {
      return res.status(500).json({ error: 'Erreur serveur' });
    }
    if (!user) {
      return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
    }
    
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

// Route de debug pour voir les users - DOIT ÊTRE AVANT app.get('*')
app.get('/debug-users', (req, res) => {
  db.all("SELECT id, email, nom, role FROM Membres", [], (err, rows) => {
    if (err) return res.json({ error: err.message });
    res.json({ total: rows.length, users: rows });
  });
});

// SERVE FRONTEND - TOUJOURS EN DERNIER
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Serveur ESPOIR CITOYEN V13 démarré sur port ${PORT}`);
});
