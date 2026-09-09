import { request } from "node:http";

const CLICKHOUSE_HOST = process.env["CLICKHOUSE_HOST"] ?? "127.0.0.1";
const CLICKHOUSE_PORT = Number(process.env["CLICKHOUSE_PORT"] ?? 8123);
// The container image gives `default` a random password; a native install does not.
const CLICKHOUSE_USER = process.env["CLICKHOUSE_USER"] ?? "";
const CLICKHOUSE_PASSWORD = process.env["CLICKHOUSE_PASSWORD"] ?? "";

export async function queryClickHouse(sql: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: CLICKHOUSE_HOST,
        port: CLICKHOUSE_PORT,
        method: "POST",
        path: "/?database=sentinel&default_format=JSONCompactEachRowWithNamesAndTypes",
        headers: CLICKHOUSE_USER
          ? { "X-ClickHouse-User": CLICKHOUSE_USER, "X-ClickHouse-Key": CLICKHOUSE_PASSWORD }
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
