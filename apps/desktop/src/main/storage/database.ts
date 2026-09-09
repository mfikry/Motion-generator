import Database from 'better-sqlite3';
import { app } from 'electron';
import path from 'node:path';

let db: Database.Database | null = null;

/**
 * Initialize the SQLite database.
 * Called once from main process on app.whenReady().
 * Stores metadata only — API key values are in safeStorage, NOT here.
 */
export function initDatabase(customPath?: string): Database.Database {
  if (db) return db;

  const dbPath = customPath ?? (app ? path.join(app.getPath('userData'), 'genc.db') : ':memory:');
  db = new Database(dbPath);

  // Enable WAL mode for file databases (not memory)
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');

  // Create tables — api_keys for E2, others as stubs for future epics
  db.exec(`
    CREATE TABLE IF NOT EXISTS api_keys (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      safe_storage_ref TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'valid',
      last_checked_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT,
      created_at DATETIME,
      updated_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      project_id TEXT REFERENCES projects(id),
      prompt_text TEXT,
      reference_images TEXT,
      model_used TEXT,
      thinking_level TEXT,
      blueprint_json TEXT,
      token_usage INTEGER,
      created_at DATETIME
    );

    CREATE TABLE IF NOT EXISTS render_jobs (
      id TEXT PRIMARY KEY,
      generation_id TEXT REFERENCES generations(id),
      status TEXT,
      resolution TEXT,
      fps INTEGER,
      format TEXT,
      compute_mode TEXT,
      bitrate INTEGER,
      output_path TEXT,
      error_message TEXT,
      started_at DATETIME,
      finished_at DATETIME
    );
  `);

  return db;
}

/**
 * Get the database instance. Throws if not initialized.
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Close the database connection gracefully.
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
