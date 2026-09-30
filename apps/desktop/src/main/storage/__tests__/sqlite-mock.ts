interface ApiKeyRecord {
  id: string;
  label: string;
  safe_storage_ref: string;
  status: string;
  last_checked_at: string | null;
}

interface GenerationDbRecord {
  id: string;
  project_id: string | null;
  prompt_text: string;
  reference_images: string | null;
  model_used: string;
  thinking_level: string;
  blueprint_json: string | null;
  code_text: string | null;
  token_usage: number | null;
  created_at: string;
}

interface MockDbTables {
  apiKeys: ApiKeyRecord[];
  generations: GenerationDbRecord[];
}

// In-memory store that survives re-instantiations if the path is the same,
// simulating persistent SQLite files on disk!
const tablesByPath = new Map<string, MockDbTables>();

function getOrCreateTables(dbPath: string): MockDbTables {
  let tables = tablesByPath.get(dbPath);
  if (!tables) {
    tables = { apiKeys: [], generations: [] };
    tablesByPath.set(dbPath, tables);
  }
  return tables;
}

export function createBetterSqliteMock() {
  return function MockDatabase(dbPath: string) {
    const tables = getOrCreateTables(dbPath);

    return {
      pragma: () => {},
      exec: () => {},
      close: () => {},
      prepare: (sql: string) => {
        const cleanSql = sql.replace(/\s+/g, ' ').trim();

        // --- api_keys table ---
        if (cleanSql.startsWith('INSERT INTO api_keys')) {
          return {
            run: (...params: unknown[]) => {
              const [id, label, safeStorageRef, status, lastCheckedAt] = params as [
                string,
                string,
                string,
                string,
                string,
              ];
              tables.apiKeys.push({
                id,
                label,
                safe_storage_ref: safeStorageRef,
                status,
                last_checked_at: lastCheckedAt,
              });
              return { changes: 1 };
            },
          };
        }

        if (cleanSql.startsWith('SELECT id, label, status, last_checked_at FROM api_keys')) {
          return {
            all: () => tables.apiKeys.map((r) => ({ ...r })),
          };
        }

        if (cleanSql.startsWith('SELECT') && cleanSql.includes('FROM api_keys WHERE id = ?')) {
          return {
            get: (id: string) => {
              const found = tables.apiKeys.find((r) => r.id === id);
              return found ? { ...found } : undefined;
            },
          };
        }

        if (
          cleanSql.startsWith('UPDATE api_keys SET status = ?, last_checked_at = ? WHERE id = ?')
        ) {
          return {
            run: (status: string, lastCheckedAt: string, id: string) => {
              const target = tables.apiKeys.find((r) => r.id === id);
              if (target) {
                target.status = status;
                target.last_checked_at = lastCheckedAt;
                return { changes: 1 };
              }
              return { changes: 0 };
            },
          };
        }

        if (cleanSql.startsWith('DELETE FROM api_keys WHERE id = ?')) {
          return {
            run: (id: string) => {
              const initialLen = tables.apiKeys.length;
              tables.apiKeys = tables.apiKeys.filter((r) => r.id !== id);
              return { changes: initialLen - tables.apiKeys.length };
            },
          };
        }

        // --- generations table ---
        if (cleanSql.startsWith('INSERT INTO generations')) {
          return {
            run: (...params: unknown[]) => {
              const [
                id,
                projectId,
                promptText,
                referenceImages,
                modelUsed,
                thinkingLevel,
                blueprintJson,
                codeText,
                tokenUsage,
                createdAt,
              ] = params as [
                string,
                string | null,
                string,
                string | null,
                string,
                string,
                string | null,
                string | null,
                number | null,
                string,
              ];
              tables.generations.push({
                id,
                project_id: projectId,
                prompt_text: promptText,
                reference_images: referenceImages,
                model_used: modelUsed,
                thinking_level: thinkingLevel,
                blueprint_json: blueprintJson,
                code_text: codeText,
                token_usage: tokenUsage,
                created_at: createdAt,
              });
              return { changes: 1 };
            },
          };
        }

        if (
          cleanSql.startsWith('SELECT') &&
          cleanSql.includes('FROM generations') &&
          cleanSql.includes('ORDER BY created_at DESC')
        ) {
          return {
            all: (limit: number = 20) => {
              const sorted = [...tables.generations].sort((a, b) =>
                String(b.created_at).localeCompare(String(a.created_at)),
              );
              return sorted.slice(0, limit).map((r) => ({ ...r }));
            },
          };
        }

        if (
          cleanSql.startsWith('SELECT') &&
          cleanSql.includes('FROM generations WHERE id = ?')
        ) {
          return {
            get: (id: string) => {
              const found = tables.generations.find((r) => r.id === id);
              return found ? { ...found } : undefined;
            },
          };
        }

        return {
          run: () => ({ changes: 0 }),
          get: () => undefined,
          all: () => [],
        };
      },
    };
  };
}

export function clearMockDatabases() {
  tablesByPath.clear();
}
