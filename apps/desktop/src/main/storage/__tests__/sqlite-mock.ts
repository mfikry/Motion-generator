interface ApiKeyRecord {
  id: string;
  label: string;
  safe_storage_ref: string;
  status: string;
  last_checked_at: string | null;
}

// In-memory store that survives re-instantiations if the path is the same,
// simulating persistent SQLite files on disk!
const tablesByPath = new Map<string, ApiKeyRecord[]>();

export function createBetterSqliteMock() {
  return function MockDatabase(dbPath: string) {
    if (!tablesByPath.has(dbPath)) {
      tablesByPath.set(dbPath, []);
    }

    const getRows = () => tablesByPath.get(dbPath) ?? [];
    const setRows = (rows: ApiKeyRecord[]) => tablesByPath.set(dbPath, rows);

    return {
      pragma: () => {},
      exec: () => {},
      close: () => {},
      prepare: (sql: string) => {
        const cleanSql = sql.replace(/\s+/g, ' ').trim();

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
              const rows = getRows();
              rows.push({
                id,
                label,
                safe_storage_ref: safeStorageRef,
                status,
                last_checked_at: lastCheckedAt,
              });
              setRows(rows);
              return { changes: 1 };
            },
          };
        }

        if (cleanSql.startsWith('SELECT id, label, status, last_checked_at FROM api_keys')) {
          return {
            all: () => getRows().map((r) => ({ ...r })),
          };
        }

        if (cleanSql.startsWith('SELECT safe_storage_ref FROM api_keys WHERE id = ?')) {
          return {
            get: (id: string) => {
              const found = getRows().find((r) => r.id === id);
              return found ? { safe_storage_ref: found.safe_storage_ref } : undefined;
            },
          };
        }

        if (cleanSql.startsWith('SELECT * FROM api_keys WHERE id = ?')) {
          return {
            get: (id: string) => {
              const found = getRows().find((r) => r.id === id);
              return found ? { ...found } : undefined;
            },
          };
        }

        if (
          cleanSql.startsWith('UPDATE api_keys SET status = ?, last_checked_at = ? WHERE id = ?')
        ) {
          return {
            run: (status: string, lastCheckedAt: string, id: string) => {
              const rows = getRows();
              const target = rows.find((r) => r.id === id);
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
              const rows = getRows();
              const initialLen = rows.length;
              const filtered = rows.filter((r) => r.id !== id);
              setRows(filtered);
              return { changes: initialLen - filtered.length };
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
