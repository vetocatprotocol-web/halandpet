const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');

const db = new DatabaseSync('./prisma/dev.db');

async function main() {
  const pinHash = await bcrypt.hash('123456', 10);
  db.exec(`
    CREATE TABLE IF NOT EXISTS "User" (
      id TEXT PRIMARY KEY NOT NULL,
      username TEXT NOT NULL UNIQUE,
      pinHash TEXT NOT NULL,
      name TEXT NOT NULL,
      phone TEXT,
      role TEXT NOT NULL,
      isActive BOOLEAN NOT NULL DEFAULT 1,
      isLocked BOOLEAN NOT NULL DEFAULT 0,
      mustChangePin BOOLEAN NOT NULL DEFAULT 1,
      failedPinAttempts INTEGER NOT NULL DEFAULT 0,
      lockedUntil DATETIME,
      createdById TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const stmt = db.prepare(`
    INSERT INTO "User" (id, username, pinHash, name, role, mustChangePin, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(username) DO NOTHING
  `);

  stmt.run('owner-001', 'owner', pinHash, 'Owner', 'OWNER', 1);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => {
    db.close();
  });
