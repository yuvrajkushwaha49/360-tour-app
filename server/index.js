const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./database');
const { hashPassword, verifyPassword, generateToken, authenticateToken, JWT_SECRET, jwt } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// AWS S3 Configuration
let s3Client = null;
const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || '';
const S3_REGION = process.env.AWS_REGION || 'ap-south-1';

if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && S3_BUCKET) {
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    s3Client = new S3Client({
      region: S3_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
      }
    });
    console.log(`[AWS S3] Initialized S3 Client for bucket: ${S3_BUCKET} in region: ${S3_REGION}`);
  } catch (e) {
    console.warn('[AWS S3 Notice]: Install @aws-sdk/client-s3 to enable direct cloud S3 upload.');
  }
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const prefix = req.body.prefix || 'img';
    const cleanName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${prefix}-${Date.now()}-${cleanName}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 200 * 1024 * 1024 } }); // 200MB max

app.use(cors());
app.use(express.json({ limit: '100mb' }));

// S3 / Local Image Upload Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file provided for upload.' });
  }

  if (s3Client && S3_BUCKET) {
    try {
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      const fileStream = fs.createReadStream(req.file.path);
      const key = `uploads/${req.file.filename}`;
      const ext = path.extname(req.file.originalname).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

      const uploadParams = {
        Bucket: S3_BUCKET,
        Key: key,
        Body: fileStream,
        ContentType: contentType
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      // Clean up temporary local file
      fs.unlink(req.file.path, () => {});

      const s3Url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
      return res.json({
        url: s3Url,
        filename: req.file.filename,
        storage: 's3'
      });
    } catch (s3Err) {
      console.error('[S3 Upload Error]:', s3Err.message);
    }
  }

  // Fallback to local server upload URL
  const localUrl = `/uploads/${req.file.filename}`;
  res.json({
    url: localUrl,
    filename: req.file.filename,
    storage: 'local'
  });
});

// S3 Batch Image Upload Endpoint (For fast Studio multi-tile uploads)
app.post('/api/upload-batch', upload.array('files', 100), async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'No files provided.' });
  }

  const results = [];

  for (const file of files) {
    if (s3Client && S3_BUCKET) {
      try {
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        const fileStream = fs.createReadStream(file.path);
        const key = `uploads/${file.filename}`;
        const ext = path.extname(file.originalname).toLowerCase();
        const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';

        const uploadParams = {
          Bucket: S3_BUCKET,
          Key: key,
          Body: fileStream,
          ContentType: contentType
        };

        await s3Client.send(new PutObjectCommand(uploadParams));
        fs.unlink(file.path, () => {});

        const s3Url = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
        results.push({ name: file.originalname, path: s3Url, storage: 's3' });
        continue;
      } catch (err) {
        console.error('[S3 Batch Upload Error]:', err.message);
      }
    }

    // Local server storage fallback
    results.push({ name: file.originalname, path: `/uploads/${file.filename}`, storage: 'local' });
  }

  res.json({ files: results });
});

// Serve uploaded images as static files with explicit CORS & CORP headers
app.use('/uploads', cors(), express.static(UPLOADS_DIR, {
  setHeaders: (res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  }
}));

// Local file proxy endpoint (safely streams local Windows/project files over CORS for web browser & Electron)
app.get('/api/local-image', cors(), (req, res) => {
  const rawPath = req.query.path;
  if (!rawPath) {
    return res.status(400).json({ error: 'Missing path query parameter.' });
  }

  const decoded = decodeURIComponent(rawPath).replace(/^file:\/\/\/?/, '');
  let targetPath = path.resolve(decoded);

  if (!fs.existsSync(targetPath)) {
    targetPath = path.normalize(rawPath.replace(/^file:\/\/\/?/, ''));
  }

  if (!fs.existsSync(targetPath)) {
    const rootRelative = path.join(__dirname, '..', decoded);
    if (fs.existsSync(rootRelative)) {
      targetPath = rootRelative;
    }
  }

  if (!fs.existsSync(targetPath)) {
    const impIdx = decoded.indexOf('imported_images');
    if (impIdx !== -1) {
      const relImp = decoded.substring(impIdx);
      const projImp = path.join(__dirname, '..', relImp);
      if (fs.existsSync(projImp)) {
        targetPath = projImp;
      }
    }
  }

  if (!fs.existsSync(targetPath)) {
    const filename = path.basename(decoded);
    const searchRoot = path.join(__dirname, '..');
    const findFile = (dir) => {
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist-renderer') continue;
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            const found = findFile(full);
            if (found) return found;
          } else if (entry.name === filename) {
            return full;
          }
        }
      } catch (e) {}
      return null;
    };
    const found = findFile(searchRoot);
    if (found) {
      targetPath = found;
    }
  }

  if (!fs.existsSync(targetPath)) {
    // Return clean fallback 1x1 placeholder so Three.js TextureLoader never errors on missing local PC paths
    const placeholderPng = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64'
    );
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
    return res.send(placeholderPng);
  }

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.sendFile(targetPath);
});

// Log incoming requests
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ==========================================
// 1. Authentication Endpoints
// ==========================================

// Public Register User (Disabled - Only Admin can create user accounts)
app.post('/api/auth/register', (req, res) => {
  return res.status(403).json({ error: 'Public registration is disabled. Only Admins can create client accounts.' });
});

// Login User
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    try {
      const isMatch = await verifyPassword(password, user.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: 'Invalid email or password.' });
      }

      const userRole = user.role || 'client';
      const token = generateToken(user.id, userRole);
      res.json({
        message: 'Login successful.',
        token,
        user: { id: user.id, name: user.name, email: user.email, role: userRole }
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
});

// Get current user profile
app.get('/api/auth/me', authenticateToken, (req, res) => {
  db.get(`SELECT id, name, email, role FROM users WHERE id = ?`, [req.userId], (err, user) => {
    if (err || !user) {
      return res.status(404).json({ error: 'User not found.' });
    }
    res.json({ user });
  });
});

// List all users (Admin & Client users)
app.get('/api/users', authenticateToken, (req, res) => {
  db.all(`SELECT id, name, email, role FROM users ORDER BY name ASC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Add a new client / user (Admin endpoint)
app.post('/api/users/add', authenticateToken, async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const passwordHash = await hashPassword(password);
    const userId = `usr-${Date.now()}`;
    const userRole = role === 'admin' ? 'admin' : 'client';

    db.run(
      `INSERT INTO users (id, name, email, password_hash, role) VALUES (?, ?, ?, ?, ?)`,
      [userId, name, email, passwordHash, userRole],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already registered.' });
          }
          return res.status(500).json({ error: err.message });
        }
        
        res.status(201).json({
          message: 'Client account created successfully.',
          user: { id: userId, name, email, role: userRole }
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==========================================
// 2. Client & Admin Projects API
// ==========================================

// Get all projects for current user (Clients see their assigned projects, Admins see all)
app.get('/api/projects', authenticateToken, (req, res) => {
  const query = req.userRole === 'admin' 
    ? `SELECT projects.id, projects.user_id, projects.name, projects.is_public, projects.data, projects.created_at, users.name as client_name, users.email as client_email FROM projects LEFT JOIN users ON projects.user_id = users.id ORDER BY projects.created_at DESC`
    : `SELECT projects.id, projects.user_id, projects.name, projects.is_public, projects.data, projects.created_at, users.name as client_name, users.email as client_email FROM projects LEFT JOIN users ON projects.user_id = users.id WHERE projects.user_id = ? OR projects.is_public = 1 ORDER BY projects.created_at DESC`;
  
  const params = req.userRole === 'admin' ? [] : [req.userId];

  db.all(query, params, (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    
    const projects = rows.map(row => ({
      id: row.id,
      user_id: row.user_id,
      name: row.name,
      client_name: row.client_name,
      client_email: row.client_email,
      is_public: !!row.is_public,
      created_at: row.created_at,
      data: JSON.parse(row.data)
    }));
    
    res.json(projects);
  });
});

// Create a new project (Admin or Client)
app.post('/api/projects', authenticateToken, (req, res) => {
  const { name, data, target_user_id, is_public } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Project name is required.' });
  }

  const projectId = `proj-${Date.now()}`;
  const assignedUserId = target_user_id || req.userId;
  const isPublicVal = is_public === false ? 0 : 1;
  const initialData = JSON.stringify(data || { locations: [], activeLocationId: '', resolution: 4096 });

  db.run(
    `INSERT INTO projects (id, user_id, name, data, is_public) VALUES (?, ?, ?, ?, ?)`,
    [projectId, assignedUserId, name, initialData, isPublicVal],
    function (err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.status(201).json({
        message: 'Project created successfully.',
        project: { id: projectId, user_id: assignedUserId, name, is_public: !!isPublicVal, data: data || {} }
      });
    }
  );
});

// Save/Update project details
app.put('/api/projects/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, data, is_public, target_user_id } = req.body;

  if (!name || !data) {
    return res.status(400).json({ error: 'Project name and data are required.' });
  }

  const dataStr = JSON.stringify(data);
  const isPublicInt = is_public === false ? 0 : 1;

  if (req.userRole === 'admin') {
    db.run(
      `UPDATE projects SET name = ?, data = ?, is_public = ?, user_id = COALESCE(?, user_id) WHERE id = ?`,
      [name, dataStr, isPublicInt, target_user_id, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Project saved successfully by Admin.' });
      }
    );
  } else {
    db.run(
      `UPDATE projects SET name = ?, data = ?, is_public = ? WHERE id = ? AND user_id = ?`,
      [name, dataStr, isPublicInt, id, req.userId],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        if (this.changes === 0) return res.status(404).json({ error: 'Project not found or unauthorized.' });
        res.json({ message: 'Project saved successfully.' });
      }
    );
  }
});

// Delete project
app.delete('/api/projects/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const query = req.userRole === 'admin'
    ? `DELETE FROM projects WHERE id = ?`
    : `DELETE FROM projects WHERE id = ? AND user_id = ?`;
  const params = req.userRole === 'admin' ? [id] : [id, req.userId];

  db.run(query, params, function (err) {
    if (err) return res.status(500).json({ error: err.message });
    if (this.changes === 0) return res.status(404).json({ error: 'Project not found or unauthorized.' });
    res.json({ message: 'Project deleted successfully.' });
  });
});

// ==========================================
// 3. Public Tour API (No Authentication required)
// ==========================================

function renderPrivateTourHtml(tourName) {
  return `<!DOCTYPE html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Private Virtual Tour - 360 Studio</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      background: radial-gradient(circle at 50% 0%, #0d1021 0%, #050609 70%, #020305 100%);
      color: #ffffff;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .private-card {
      background: rgba(14, 16, 25, 0.95);
      border: 1px solid rgba(245, 158, 11, 0.35);
      border-radius: 1.75rem;
      padding: 3rem 2.5rem;
      max-width: 32rem;
      width: 90%;
      text-align: center;
      box-shadow: 0 30px 70px rgba(0, 0, 0, 0.8), 0 0 30px rgba(245, 158, 11, 0.15);
      backdrop-filter: blur(16px);
    }
    .lock-icon-box {
      width: 5rem;
      height: 5rem;
      border-radius: 50%;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem auto;
      box-shadow: 0 10px 25px rgba(245, 158, 11, 0.2);
    }
    .badge-private {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
      padding: 0.4rem 1.25rem;
      border-radius: 50rem;
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: inline-block;
      margin-bottom: 1.25rem;
    }
    .btn-action {
      border-radius: 0.75rem;
      padding: 0.65rem 1.5rem;
      font-size: 0.875rem;
      font-weight: 500;
      text-decoration: none;
      transition: all 0.2s ease;
    }
  </style>
</head>
<body>
  <div class="private-card">
    <div class="lock-icon-box">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
      </svg>
    </div>

    <span class="badge-private">🔒 Private Virtual Tour</span>

    <h1 class="h3 font-weight-bold mb-2">This Virtual Tour is Private</h1>
    <p style="color: #94a3b8; font-size: 0.875rem; line-height: 1.6; margin-bottom: 1.75rem;">
      The owner of this 360° virtual tour ${tourName ? `("${tourName}")` : ''} has marked it as Private. Only authorized clients or administrators can view this property tour.
    </p>

    <div class="d-flex align-items-center justify-content-center gap-3">
      <a href="/" class="btn btn-secondary btn-action" style="background: #1e2444; border-color: #2e3654; color: #fff;">
        ← Return to Home Page
      </a>
    </div>
  </div>
</body>
</html>`;
}

// Get a public/private tour configuration for 360 viewer rendering
app.get('/api/tours/:id', (req, res) => {
  const { id } = req.params;
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  let requestUserId = null;
  let requestUserRole = null;

  if (token) {
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
      if (!err && decoded) {
        requestUserId = decoded.userId;
        requestUserRole = decoded.role;
      }
    });
  }

  db.get(`SELECT id, user_id, name, is_public, data FROM projects WHERE id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Tour not found.' });
    }
    if (row.is_public === 0) {
      const isAuthorized = requestUserRole === 'admin' || (requestUserId && requestUserId === row.user_id);
      if (!isAuthorized) {
        const wantsHtml = req.headers.accept && req.headers.accept.includes('text/html');
        if (wantsHtml) {
          return res.status(403).send(renderPrivateTourHtml(row.name));
        }
        return res.status(403).json({ error: 'This virtual tour is private.', is_private: true });
      }
    }

    res.json({
      id: row.id,
      name: row.name,
      tourData: JSON.parse(row.data)
    });
  });
});

// ==========================================
// 4. Image Upload API (Auth required)
// ==========================================

// Serve built frontend web app (dist-renderer) if available
const DIST_RENDERER = path.join(__dirname, '..', 'dist-renderer');
if (fs.existsSync(DIST_RENDERER)) {
  app.use(express.static(DIST_RENDERER));
}

// 404 Handler for API & Uploads / SPA Fallback for Web App
app.use((req, res) => {
  if (req.path.startsWith('/api/') || req.path.startsWith('/uploads/')) {
    return res.status(404).json({ error: `Resource '${req.path}' not found on server.` });
  }
  if (fs.existsSync(DIST_RENDERER)) {
    return res.sendFile(path.join(DIST_RENDERER, 'index.html'));
  }
  res.status(404).json({ error: `Resource '${req.path}' not found on server.` });
});

// Start Server on 0.0.0.0
app.listen(PORT, '0.0.0.0', () => {
  console.log(`================================================`);
  console.log(`  360 Panorama CRM Server running on port ${PORT} `);
  console.log(`  Local:   http://localhost:${PORT}`);
  console.log(`  Network: http://0.0.0.0:${PORT}`);
  console.log(`================================================`);
});
