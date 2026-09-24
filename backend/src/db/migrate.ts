import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db, pool } from "./client";

async function main() {
  console.log("Aplicando migraciones...");
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
  console.log("Migraciones aplicadas correctamente.");
  await pool.end();
}

main().catch((err) => {
  console.error("Error aplicando migraciones:", err);
  process.exit(1);
});
