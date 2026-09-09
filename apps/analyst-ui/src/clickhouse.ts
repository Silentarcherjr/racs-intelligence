import { request } from "node:http";

// Read lazily, not at module scope: an ESM import is evaluated before the
// importing module's body runs, so a module-scope constant would capture
// process.env before loadEnv() had a chance to populate it.
const host = () => process.env["CLICKHOUSE_HOST"] ?? "127.0.0.1";
const port = () => Number(process.env["CLICKHOUSE_PORT"] ?? 8123);
// The container image gives `default` a random password; a native install does not.
const user = () => process.env["CLICKHOUSE_USER"] ?? "";
const pass = () => process.env["CLICKHOUSE_PASSWORD"] ?? "";

export async function queryClickHouse(sql: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: host(),
        port: port(),
        method: "POST",
        path: "/?database=sentinel&default_format=JSONCompactEachRowWithNamesAndTypes",
        headers: user()
          ? { "X-ClickHouse-User": user(), "X-ClickHouse-Key": pass() }
          : {},
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) {
              reject(new Error(`ClickHouse error: ${data}`));
              return;
            }
            const lines = data.trim().split("\n").filter((l) => l.length > 0);
            // JSONCompactEachRowWithNamesAndTypes emits THREE kinds of line:
            // names, then types, then the rows. Slicing from 1 turns the types
            // line into a bogus first row — every table renders a junk row of
            // "String", "DateTime64(3)" and nobody notices until a demo.
            if (lines.length < 3) {
              resolve([]);
              return;
            }
            const names = JSON.parse(lines[0]!);
            const rows = lines.slice(2).map((line) => JSON.parse(line));
            const result = rows.map((row) => {
              const obj: any = {};
              row.forEach((val: any, i: number) => {
                obj[names[i]] = val;
              });
              return obj;
            });
            resolve(result);
          } catch (err) {
            reject(err);
          }
        });
      },
    );
    req.on("error", reject);
    req.write(sql);
    req.end();
  });
}
