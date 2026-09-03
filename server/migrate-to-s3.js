const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const sqlite3 = require('sqlite3').verbose();

// 1. Load environment variables
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
      console.log(`[Config] Loaded environment from: ${filePath}`);
    } catch (e) {
      console.warn(`[Config] Warning reading ${filePath}:`, e.message);
    }
  }
}

loadEnvFile(path.join(__dirname, '.env'));
loadEnvFile(path.join(__dirname, '..', '.env'));

const S3_BUCKET = process.env.AWS_S3_BUCKET_NAME;
const S3_REGION = process.env.AWS_REGION || 'ap-south-1';
const CLOUDFRONT_DOMAIN = (process.env.AWS_CLOUDFRONT_DOMAIN || '').replace(/^https?:\/\//, '').replace(/\/$/, '');

if (!S3_BUCKET) {
  console.error('❌ Error: AWS_S3_BUCKET_NAME is not set in .env file.');
  process.exit(1);
}

const s3Config = { region: S3_REGION };
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Config.credentials = {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID.trim(),
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY.trim()
  };
  console.log('🔑 Using explicit AWS Access Key Credentials.');
} else {
  console.log('ℹ️ Using default AWS IAM / Instance Profile credentials.');
}

const s3Client = new S3Client(s3Config);

function getAssetUrl(key) {
  if (CLOUDFRONT_DOMAIN) {
    return `https://${CLOUDFRONT_DOMAIN}/${key}`;
  }
  return `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
}

const UPLOADS_DIR = path.join(__dirname, 'uploads');
const dbPath = path.join(__dirname, 'crm.db');

async function runMigration() {
  console.log('\n🚀 Starting Local-to-S3 Assets Migration...');
  console.log(`📦 S3 Bucket:       ${S3_BUCKET}`);
  console.log(`🌍 Region:          ${S3_REGION}`);
  console.log(`⚡ CloudFront CDN:   ${CLOUDFRONT_DOMAIN || '(direct S3)'}`);
  console.log(`📂 Uploads Folder:  ${UPLOADS_DIR}\n`);

  if (!fs.existsSync(UPLOADS_DIR)) {
    console.log('ℹ️ Uploads folder does not exist. Nothing to upload.');
    return;
  }

  const files = fs.readdirSync(UPLOADS_DIR);
  if (files.length === 0) {
    console.log('ℹ️ Uploads folder is empty. No files to migrate.');
  } else {
    console.log(`🔍 Found ${files.length} file(s) in local uploads folder.`);

    for (let i = 0; i < files.length; i++) {
      const filename = files[i];
      const filePath = path.join(UPLOADS_DIR, filename);

      if (fs.statSync(filePath).isDirectory()) continue;

      const ext = path.extname(filename).toLowerCase();
      const contentType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : ext === '.svg' ? 'image/svg+xml' : 'image/jpeg';
      const s3Key = `uploads/${filename}`;

      try {
        const fileStream = fs.createReadStream(filePath);
        await s3Client.send(new PutObjectCommand({
          Bucket: S3_BUCKET,
          Key: s3Key,
          Body: fileStream,
          ContentType: contentType,
          CacheControl: 'public, max-age=31536000, immutable'
        }));

        const cdnUrl = getAssetUrl(s3Key);
        console.log(`[${i + 1}/${files.length}] ✅ Uploaded: ${filename} ➔ ${cdnUrl}`);
      } catch (err) {
        console.error(`[${i + 1}/${files.length}] ❌ Failed to upload ${filename}:`, err.message);
      }
    }
  }

  // Database URL rewrite
  if (fs.existsSync(dbPath)) {
    console.log('\n🔄 Updating Database records to use CloudFront / S3 CDN URLs...');
    const db = new sqlite3.Database(dbPath);

    db.all(`SELECT id, data FROM projects`, [], (err, projects) => {
      if (err) {
        console.error('❌ Error reading projects from db:', err.message);
        return;
      }

      console.log(`📊 Found ${projects.length} project(s) to scan & update.`);
      let updatedCount = 0;

      projects.forEach(project => {
        let rawData = project.data;
        if (!rawData) return;

        // Replace local uploads paths with S3 CDN url
        const targetPrefix = CLOUDFRONT_DOMAIN ? `https://${CLOUDFRONT_DOMAIN}/uploads/` : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/uploads/`;

        // Matches /uploads/<filename> or http://<domain>/uploads/<filename>
        const updatedData = rawData
          .replace(/https?:\/\/[^\/]+\/uploads\//g, targetPrefix)
          .replace(/"\/uploads\//g, `"${targetPrefix}`)
          .replace(/'\/uploads\//g, `'${targetPrefix}`);

        if (updatedData !== rawData) {
          db.run(`UPDATE projects SET data = ? WHERE id = ?`, [updatedData, project.id], (upErr) => {
            if (upErr) console.error(`Error updating project ${project.id}:`, upErr.message);
            else console.log(`  ✅ Updated Project [${project.id}] image URLs`);
          });
          updatedCount++;
        }
      });

      // Update Users logo_url
      db.all(`SELECT id, logo_url FROM users WHERE logo_url IS NOT NULL`, [], (uErr, users) => {
        if (!uErr && users) {
          const targetPrefix = CLOUDFRONT_DOMAIN ? `https://${CLOUDFRONT_DOMAIN}/uploads/` : `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/uploads/`;
          users.forEach(user => {
            if (user.logo_url && (user.logo_url.startsWith('/uploads/') || user.logo_url.includes('/uploads/'))) {
              const filename = user.logo_url.split('/uploads/').pop();
              const newLogoUrl = `${targetPrefix}${filename}`;
              db.run(`UPDATE users SET logo_url = ? WHERE id = ?`, [newLogoUrl, user.id], () => {
                console.log(`  ✅ Updated User [${user.id}] logo URL ➔ ${newLogoUrl}`);
              });
            }
          });
        }
      });

      console.log(`\n🎉 Migration Complete! All existing files uploaded and database references updated.`);
    });
  } else {
    console.log('ℹ️ SQLite database file crm.db not found.');
  }
}

runMigration().catch(err => {
  console.error('Fatal Migration Error:', err);
});
