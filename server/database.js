const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const dbPath = path.join(__dirname, 'crm.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeTables();
  }
});

function initializeTables() {
  db.serialize(() => {
    // 1. Users Table (Clients & Admins)
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT DEFAULT 'client'
      )
    `, (err) => {
      if (err) console.error('Error creating users table:', err.message);
    });

    // 2. Projects Table
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        data TEXT NOT NULL,
        is_public INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      )
    `, (err) => {
      if (err) console.error('Error creating projects table:', err.message);
    });

    // Seed default Admin Account
    const bcrypt = require('bcryptjs');
    db.get(`SELECT * FROM users WHERE email = ?`, ['admin@360soft.com'], (err, row) => {
      if (!row) {
        const hash = bcrypt.hashSync('admin123', 10);
        db.run(`INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
          ['admin-001', 'System Admin', 'admin@360soft.com', hash, 'admin']
        );
        console.log('Seeded default Admin user: admin@360soft.com / admin123');
      }
    });

    // Seed default Client Account
    db.get(`SELECT * FROM users WHERE email = ?`, ['yuvraj@gmail.com'], (err, row) => {
      if (!row) {
        const hash = bcrypt.hashSync('client123', 10);
        db.run(`INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
          ['client-001', 'Yuvraj Client', 'yuvraj@gmail.com', hash, 'client']
        );
        console.log('Seeded default Client user: yuvraj@gmail.com / client123');
      }
    });
  });
}

module.exports = db;
