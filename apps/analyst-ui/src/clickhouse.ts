import { request } from "node:http";

const CLICKHOUSE_HOST = process.env["CLICKHOUSE_HOST"] ?? "127.0.0.1";
const CLICKHOUSE_PORT = Number(process.env["CLICKHOUSE_PORT"] ?? 8123);

export async function queryClickHouse(sql: string): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const req = request(
      {
        hostname: CLICKHOUSE_HOST,
        port: CLICKHOUSE_PORT,
        method: "POST",
        path: "/?database=sentinel&default_format=JSONCompactEachRowWithNamesAndTypes",
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
            if (lines.length < 2) {
              resolve([]);
              return;
            }
            const names = JSON.parse(lines[0]!);
            const rows = lines.slice(1).map((line) => JSON.parse(line));
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
