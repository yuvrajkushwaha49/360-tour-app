const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const db = require('./database');
const { hashPassword, verifyPassword, generateToken, authenticateToken, JWT_SECRET, jwt } = require('./auth');

const app = express();
const PORT = process.env.PORT || 5000;

// Native .env file loader (supports server/.env and root .env)
function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      content.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx !== -1) {
            const key = trimmed.substring(0, eqIdx).trim();
            const val = trimmed.substring(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '');
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
      console.log(`[Config] Loaded environment variables from: ${filePath}`);
    } catch (e) {
      console.warn(`[Config] Failed to parse ${filePath}:`, e.message);
    }
  }
}

loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '..', '.env'));

// Ensure uploads directory exists
const UPLOADS_DIR = path.join(__dirname, 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// AWS S3 & CloudFront CDN Configuration
let s3Client = null;
const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME || '';
const S3_REGION = process.env.AWS_REGION || 'ap-south-1';
const CLOUDFRONT_DOMAIN = (process.env.AWS_CLOUDFRONT_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

// Fast CDN / S3 asset URL resolver
function getPublicAssetUrl(key) {
  if (CLOUDFRONT_DOMAIN) {
    return `https://${CLOUDFRONT_DOMAIN}/${key}`;
  }
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

if (S3_BUCKET) {
  try {
    const { S3Client } = require('@aws-sdk/client-s3');
    const s3Config = { region: S3_REGION };
    if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
      s3Config.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim()
      };
      console.log(`[AWS S3] ✅ S3 Client initialized with explicit Access Key ID!`);
    } else {
      console.log(`[AWS S3] ℹ️ S3 Client initialized using AWS Default Credential Chain (IAM Role / System).`);
    }

    s3Client = new S3Client(s3Config);
    console.log(`         Bucket: ${S3_BUCKET}`);
    console.log(`         Region: ${S3_REGION}`);
    if (CLOUDFRONT_DOMAIN) {
      console.log(`[CloudFront CDN] ⚡ Active Global CDN Domain: https://${CLOUDFRONT_DOMAIN}`);
    }
  } catch (e) {
    console.warn('[AWS S3 Error]: Could not initialize S3 Client:', e.message);
  }
} else {
  console.log('[AWS S3 Status]: AWS_S3_BUCKET_NAME is not set in environment.');
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
app.post('/api/upload', (req, res, next) => {
  upload.any()(req, res, (err) => {
    if (err) {
      console.error('[Upload Multer Error]:', err);
      return res.status(400).json({ error: err.message || 'File upload failed.' });
    }
    if (req.files && req.files.length > 0) {
      req.file = req.files[0];
    }
    next();
  });
}, async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided for upload.' });
    }

    const allowFallback = req.body.allowFallback === 'true' || req.query.allowFallback === 'true';

    if (s3Client && S3_BUCKET) {
      try {
        const { PutObjectCommand } = require('@aws-sdk/client-s3');
        const fileStream = fs.createReadStream(req.file.path);
        const key = `uploads/${req.file.filename}`;
        const ext = path.extname(req.file.originalname).toLowerCase();
        const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';

        const uploadParams = {
          Bucket: S3_BUCKET,
          Key: key,
          Body: fileStream,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable'
        };

        await s3Client.send(new PutObjectCommand(uploadParams));

        // Clean up temporary local file
        fs.unlink(req.file.path, () => {});

        const assetUrl = getPublicAssetUrl(key);
        console.log(`[CloudFront/S3] ✅ Upload success: ${assetUrl}`);
        return res.json({
          url: assetUrl,
          filename: req.file.filename,
          storage: CLOUDFRONT_DOMAIN ? 'cloudfront' : 's3'
        });
      } catch (s3Err) {
        console.error('[S3 Upload Error]:', s3Err.message);
      }
    }

    // S3 unavailable or failed: Check if user has confirmed server fallback
    if (!allowFallback) {
      // Clean up temporary file until user confirms
      fs.unlink(req.file.path, () => {});
      return res.status(409).json({
        fallbackRequired: true,
        message: 'AWS S3 Cloud Storage is currently unavailable or encountered an issue. Would you like to save this file directly to the local server disk as a fallback?'
      });
    }

    // User confirmed fallback -> Save to local server disk
    const localUrl = `/uploads/${req.file.filename}`;
    console.log(`[Local Storage Fallback] ✅ User confirmed fallback: ${localUrl}`);
    res.json({
      url: localUrl,
      filename: req.file.filename,
      storage: 'local'
    });
  } catch (err) {
    console.error('[Upload Error]:', err);
    res.status(500).json({ error: err.message || 'Internal server error during upload.' });
  }
});

// S3 Batch Image Upload Endpoint (For fast Studio multi-tile uploads)
app.post('/api/upload-batch', upload.array('files', 100), async (req, res) => {
  const files = req.files || [];
  if (files.length === 0) {
    return res.status(400).json({ error: 'No files provided.' });
  }

  const allowFallback = req.body.allowFallback === 'true' || req.query.allowFallback === 'true';
  console.log(`[Upload Batch] Received ${files.length} file(s) for upload... (allowFallback: ${allowFallback})`);
  const results = [];
  let s3Failures = 0;

  for (const file of files) {
    let uploadedToS3 = false;
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
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable'
        };

        await s3Client.send(new PutObjectCommand(uploadParams));
        fs.unlink(file.path, () => {});

        const assetUrl = getPublicAssetUrl(key);
        results.push({ name: file.originalname, path: assetUrl, storage: CLOUDFRONT_DOMAIN ? 'cloudfront' : 's3' });
        uploadedToS3 = true;
      } catch (err) {
        console.error(`[AWS S3 Error] Failed to upload ${file.originalname}:`, err.message);
        s3Failures++;
      }
    } else {
      s3Failures++;
    }

    if (!uploadedToS3) {
      if (!allowFallback) {
        // Delete temporary file since fallback not yet confirmed
        fs.unlink(file.path, () => {});
      } else {
        results.push({ name: file.originalname, path: `/uploads/${file.filename}`, storage: 'local' });
      }
    }
  }

  // If S3 failed and fallback is not yet confirmed by user
  if (s3Failures > 0 && !allowFallback && results.length < files.length) {
    return res.status(409).json({
      fallbackRequired: true,
      message: 'AWS S3 Cloud Storage is currently unavailable or encountered an issue. Would you like to save these files directly to the local server disk as a fallback?'
    });
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

// Diagnostic endpoint to check AWS S3 status & connectivity
app.get('/api/s3-status', cors(), async (req, res) => {
  const status = {
    s3Bucket: S3_BUCKET || '(not configured)',
    region: S3_REGION,
    cloudfrontDomain: CLOUDFRONT_DOMAIN || '(not configured)',
    hasAccessKeyId: !!process.env.AWS_ACCESS_KEY_ID,
    hasSecretKey: !!process.env.AWS_SECRET_ACCESS_KEY,
    s3ClientInitialized: !!s3Client
  };

  if (s3Client && S3_BUCKET) {
    try {
      const { HeadBucketCommand } = require('@aws-sdk/client-s3');
      await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
      status.s3Connection = 'CONNECTED_SUCCESSFULLY';
    } catch (err) {
      status.s3Connection = 'CONNECTION_FAILED';
      status.error = {
        name: err.name,
        message: err.message,
        code: err.$metadata?.httpStatusCode
      };
    }
  } else {
    status.s3Connection = 'NOT_INITIALIZED';
  }

  res.json(status);
});

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
  db.all(`SELECT id, name, email, role, logo_url FROM users ORDER BY name ASC`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// Add a new client / user (Admin endpoint)
app.post('/api/users/add', authenticateToken, async (req, res) => {
  const { name, email, password, role, logo_url } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email, and password are required.' });
  }

  try {
    const passwordHash = await hashPassword(password);
    const userId = `usr-${Date.now()}`;
    const userRole = role === 'admin' ? 'admin' : 'client';

    db.run(
      `INSERT INTO users (id, name, email, password_hash, role, logo_url) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, name, email, passwordHash, userRole, logo_url || null],
      function (err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(400).json({ error: 'Email already registered.' });
          }
          return res.status(500).json({ error: err.message });
        }
        
        res.status(201).json({
          message: 'Client account created successfully.',
          user: { id: userId, name, email, role: userRole, logo_url: logo_url || null }
        });
      }
    );
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update client / user details (Admin endpoint)
app.put('/api/users/:id', authenticateToken, async (req, res) => {
  if (req.userRole !== 'admin') {
    return res.status(403).json({ error: 'Only administrators can update user profiles.' });
  }

  const { id } = req.params;
  const { name, email, role, logo_url, password } = req.body;

  if (!name || !email) {
    return res.status(400).json({ error: 'Name and email are required.' });
  }

  try {
    const userRole = role === 'admin' ? 'admin' : 'client';

    if (password && password.trim().length > 0) {
      const passwordHash = await hashPassword(password.trim());
      db.run(
        `UPDATE users SET name = ?, email = ?, role = ?, logo_url = ?, password_hash = ? WHERE id = ?`,
        [name.trim(), email.trim().toLowerCase(), userRole, logo_url || null, passwordHash, id],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return res.status(400).json({ error: 'Email is already registered with another account.' });
            }
            return res.status(500).json({ error: err.message });
          }
          res.json({
            message: 'User profile updated successfully.',
            user: { id, name: name.trim(), email: email.trim().toLowerCase(), role: userRole, logo_url: logo_url || null }
          });
        }
      );
    } else {
      db.run(
        `UPDATE users SET name = ?, email = ?, role = ?, logo_url = ? WHERE id = ?`,
        [name.trim(), email.trim().toLowerCase(), userRole, logo_url || null, id],
        function (err) {
          if (err) {
            if (err.message.includes('UNIQUE constraint failed')) {
              return res.status(400).json({ error: 'Email is already registered with another account.' });
            }
            return res.status(500).json({ error: err.message });
          }
          res.json({
            message: 'User profile updated successfully.',
            user: { id, name: name.trim(), email: email.trim().toLowerCase(), role: userRole, logo_url: logo_url || null }
          });
        }
      );
    }
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
    ? `SELECT projects.id, projects.user_id, projects.name, projects.is_public, projects.data, projects.created_at, users.name as client_name, users.email as client_email, users.logo_url as client_logo FROM projects LEFT JOIN users ON projects.user_id = users.id ORDER BY projects.created_at DESC`
    : `SELECT projects.id, projects.user_id, projects.name, projects.is_public, projects.data, projects.created_at, users.name as client_name, users.email as client_email, users.logo_url as client_logo FROM projects LEFT JOIN users ON projects.user_id = users.id WHERE projects.user_id = ? OR projects.is_public = 1 ORDER BY projects.created_at DESC`;
  
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
      client_logo: row.client_logo,
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
  const requestedUserId = target_user_id || req.userId || 'admin-001';
  const isPublicVal = is_public === false ? 0 : 1;
  const initialData = JSON.stringify(data || { locations: [], activeLocationId: '', resolution: 4096 });

  // Ensure assigned user exists in users table to prevent Foreign Key constraint failure
  db.get('SELECT id FROM users WHERE id = ?', [requestedUserId], (err, userRow) => {
    let finalUserId = requestedUserId;
    if (!userRow) {
      finalUserId = req.userId || 'admin-001';
    }

    db.get('SELECT id FROM users WHERE id = ?', [finalUserId], (err2, finalRow) => {
      if (!finalRow) {
        db.get('SELECT id FROM users LIMIT 1', [], (err3, firstRow) => {
          finalUserId = firstRow ? firstRow.id : 'admin-001';
          doInsert(finalUserId);
        });
      } else {
        doInsert(finalUserId);
      }
    });
  });

  function doInsert(assignedUserId) {
    db.run(
      `INSERT INTO projects (id, user_id, name, data, is_public) VALUES (?, ?, ?, ?, ?)`,
      [projectId, assignedUserId, name, initialData, isPublicVal],
      function (err) {
        if (err) {
          console.error('[Error creating project]:', err.message);
          return res.status(500).json({ error: err.message });
        }
        res.status(201).json({
          message: 'Project created successfully.',
          project: { id: projectId, user_id: assignedUserId, name, is_public: !!isPublicVal, data: data || {} }
        });
      }
    );
  }
});

// Save/Update project details (with auto-upsert if missing)
app.put('/api/projects/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const { name, data, is_public, target_user_id } = req.body;

  if (!name || !data) {
    return res.status(400).json({ error: 'Project name and data are required.' });
  }

  const dataStr = typeof data === 'string' ? data : JSON.stringify(data);
  const isPublicInt = is_public === false ? 0 : 1;
  const requestedUserId = target_user_id || req.userId || 'admin-001';

  // Check if project exists in database
  db.get('SELECT * FROM projects WHERE id = ?', [id], (err, existingProj) => {
    if (err) {
      console.error('[Database Error]:', err.message);
      return res.status(500).json({ error: err.message });
    }

    // Verify valid user_id to prevent foreign key errors
    db.get('SELECT id FROM users WHERE id = ?', [requestedUserId], (errU, uRow) => {
      let finalUserId = uRow ? requestedUserId : (existingProj ? existingProj.user_id : (req.userId || 'admin-001'));

      db.get('SELECT id FROM users WHERE id = ?', [finalUserId], (errF, fRow) => {
        if (!fRow) {
          db.get('SELECT id FROM users LIMIT 1', [], (errL, lRow) => {
            finalUserId = lRow ? lRow.id : 'admin-001';
            performSave(existingProj, finalUserId);
          });
        } else {
          performSave(existingProj, finalUserId);
        }
      });
    });
  });

  function performSave(existingProj, validUserId) {
    if (existingProj) {
      if (req.userRole !== 'admin' && existingProj.user_id !== req.userId) {
        return res.status(403).json({ error: 'Unauthorized to modify this project.' });
      }

      db.run(
        `UPDATE projects SET name = ?, data = ?, is_public = ?, user_id = ? WHERE id = ?`,
        [name, dataStr, isPublicInt, validUserId, id],
        function (errUpdate) {
          if (errUpdate) {
            console.error('[Error updating project]:', errUpdate.message);
            return res.status(500).json({ error: errUpdate.message });
          }
          res.json({ message: 'Project saved successfully.', id });
        }
      );
    } else {
      // Auto-upsert if project ID did not exist in this database
      db.run(
        `INSERT INTO projects (id, user_id, name, data, is_public) VALUES (?, ?, ?, ?, ?)`,
        [id, validUserId, name, dataStr, isPublicInt],
        function (errInsert) {
          if (errInsert) {
            console.error('[Error inserting project]:', errInsert.message);
            return res.status(500).json({ error: errInsert.message });
          }
          res.status(201).json({ message: 'Project created and saved successfully.', id });
        }
      );
    }
  }
});

// Helper to extract S3 object keys from URLs / data structures
function extractS3KeysFromData(obj) {
  const keys = new Set();
  const scan = (val) => {
    if (!val) return;
    if (typeof val === 'string') {
      const match = val.match(/uploads\/([^"'\s?#]+)/);
      if (match) {
        keys.add(`uploads/${match[1]}`);
      }
    } else if (Array.isArray(val)) {
      val.forEach(scan);
    } else if (typeof val === 'object') {
      Object.values(val).forEach(scan);
    }
  };
  scan(obj);
  return Array.from(keys);
}

// Delete objects from AWS S3 bucket and local server disk
async function deleteAssets(keys) {
  if (!keys || keys.length === 0) return;
  console.log(`[Delete Assets] Purging ${keys.length} asset(s) from S3 & disk:`, keys);

  // 1. Delete from AWS S3
  if (s3Client && S3_BUCKET) {
    try {
      const { DeleteObjectsCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
      if (keys.length === 1) {
        await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: keys[0] }));
      } else {
        await s3Client.send(new DeleteObjectsCommand({
          Bucket: S3_BUCKET,
          Delete: { Objects: keys.map(k => ({ Key: k })), Quiet: true }
        }));
      }
      console.log(`[AWS S3] 🗑️ Successfully deleted ${keys.length} object(s) from S3 bucket: ${S3_BUCKET}`);
    } catch (s3Err) {
      console.error('[AWS S3 Delete Error]:', s3Err.message);
    }
  }

  // 2. Delete from local server disk (/uploads/)
  for (const key of keys) {
    try {
      const filename = path.basename(key);
      const localFilePath = path.join(UPLOADS_DIR, filename);
      if (fs.existsSync(localFilePath)) {
        fs.unlinkSync(localFilePath);
      }
    } catch (e) {}
  }
}

// Helper to check if any S3 key is used by other projects before deleting
function filterUnusedKeys(keysToCheck, excludeProjectId, callback) {
  if (!keysToCheck || keysToCheck.length === 0) {
    return callback([]);
  }

  db.all(`SELECT id, data FROM projects WHERE id != ?`, [excludeProjectId || ''], (err, rows) => {
    if (err || !rows) {
      // In case of database error, play it safe: do not delete any asset from S3
      console.warn('[Safe S3 Deletion] Database query error, skipping S3 purge to protect assets:', err?.message);
      return callback([]);
    }

    const usedKeysInOtherProjects = new Set();
    for (const r of rows) {
      if (r.data) {
        try {
          const parsed = JSON.parse(r.data);
          const otherKeys = extractS3KeysFromData(parsed);
          otherKeys.forEach(k => usedKeysInOtherProjects.add(k));
        } catch (e) {
          // Fallback string matching for resilience
          for (const k of keysToCheck) {
            const baseName = path.basename(k);
            if (r.data.includes(baseName)) {
              usedKeysInOtherProjects.add(k);
            }
          }
        }
      }
    }

    // Only allow deletion of keys that are NOT used in any other project!
    const safeToDelete = keysToCheck.filter(k => !usedKeysInOtherProjects.has(k));
    const preservedCount = keysToCheck.length - safeToDelete.length;
    if (preservedCount > 0) {
      console.log(`[Safe S3 Asset Protection] 🛡️ Retained ${preservedCount} image(s) because they are actively used in other projects.`);
    }
    callback(safeToDelete);
  });
}

// Bulk Asset Deletion Endpoint (Used when clearing faces or deleting rooms)
app.post('/api/delete-assets', (req, res) => {
  const { paths, keys, currentProjectId } = req.body;
  const targetKeys = keys || extractS3KeysFromData(paths);
  if (targetKeys && targetKeys.length > 0) {
    filterUnusedKeys(targetKeys, currentProjectId, async (safeToDeleteKeys) => {
      if (safeToDeleteKeys.length > 0) {
        await deleteAssets(safeToDeleteKeys);
      }
    });
  }
  res.json({ message: 'Assets cleanup processed safely' });
});

// Delete project and automatically purge its S3 images & database records
app.delete('/api/projects/:id', authenticateToken, (req, res) => {
  const { id } = req.params;
  const selectQuery = req.userRole === 'admin'
    ? `SELECT data FROM projects WHERE id = ?`
    : `SELECT data FROM projects WHERE id = ? AND user_id = ?`;
  const params = req.userRole === 'admin' ? [id] : [id, req.userId];

  db.get(selectQuery, params, async (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) {
      return res.status(200).json({ message: 'Project already deleted or does not exist on server.' });
    }

    // 1. Purge ONLY S3 images & local uploads that are NOT used in any other project
    try {
      const projectData = JSON.parse(row.data);
      const keysToDelete = extractS3KeysFromData(projectData);
      if (keysToDelete.length > 0) {
        filterUnusedKeys(keysToDelete, id, async (safeKeys) => {
          if (safeKeys.length > 0) {
            await deleteAssets(safeKeys);
          }
        });
      }
    } catch (parseErr) {
      console.warn('Could not parse project data for asset cleanup:', parseErr);
    }

    // 2. Delete project from SQLite database
    const deleteQuery = req.userRole === 'admin'
      ? `DELETE FROM projects WHERE id = ?`
      : `DELETE FROM projects WHERE id = ? AND user_id = ?`;

    db.run(deleteQuery, params, function (delErr) {
      if (delErr) return res.status(500).json({ error: delErr.message });
      res.json({ message: 'Project and all associated S3 images deleted successfully.' });
    });
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
  const { exp, sig } = req.query;
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

  // Cryptographic share signature verification
  const SHARE_SECURITY_SALT = 'kalaakchar_virtual_360_secure_salt_2026';
  let hasValidShareSignature = false;
  let isShareLinkExpiredOrTampered = false;

  if (exp) {
    const crypto = require('crypto');
    const cleanExp = String(exp).trim();
    const cleanSig = String(sig || '').trim().toLowerCase();
    const expectedSig = crypto.createHash('sha256')
      .update(`${id}:${cleanExp}:${SHARE_SECURITY_SALT}`)
      .digest('hex')
      .slice(0, 16);

    if (cleanSig && cleanSig === expectedSig.toLowerCase()) {
      const expNum = Number(cleanExp);
      if (!isNaN(expNum) && Date.now() <= expNum) {
        hasValidShareSignature = true;
      } else {
        isShareLinkExpiredOrTampered = true;
      }
    } else {
      isShareLinkExpiredOrTampered = true;
    }
  }

  db.get(`SELECT projects.id, projects.user_id, projects.name, projects.is_public, projects.data, users.name as client_name, users.logo_url as client_logo FROM projects LEFT JOIN users ON projects.user_id = users.id WHERE projects.id = ?`, [id], (err, row) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    if (!row) {
      return res.status(404).json({ error: 'Tour not found.' });
    }

    // If accessed via an expired or tampered share link, reject immediately unless user is an authenticated admin
    if (isShareLinkExpiredOrTampered && requestUserRole !== 'admin') {
      return res.status(410).json({ error: 'This share link has expired or is invalid.', is_expired: true });
    }

    if (row.is_public === 0) {
      const isAuthorized = requestUserRole === 'admin' || (requestUserId && requestUserId === row.user_id) || hasValidShareSignature;
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
      clientName: row.client_name,
      clientLogo: row.client_logo,
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
