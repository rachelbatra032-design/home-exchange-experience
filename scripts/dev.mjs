import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import path from "node:path";
import EmbeddedPostgres from "embedded-postgres";

const dir = path.join(process.cwd(), ".pgdata");
const port = 5433;
process.env.DATABASE_URL ||= `postgresql://aangan:aangan@127.0.0.1:${port}/home_exchange`;
process.env.SESSION_SECRET ||= "aangan-preview-secret";

function listening() {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: "127.0.0.1" });
    socket.on("connect", () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(" ")} exited ${code}`));
    });
  });
}

if (!(await listening())) {
  const pg = new EmbeddedPostgres({
    databaseDir: dir,
    user: "aangan",
    password: "aangan",
    port,
    persistent: true,
    initdbFlags: ["--encoding=UTF8", "--locale=en_US.UTF-8"],
    onLog: () => {},
    onError: (message) => console.error(message),
  });
  if (!fs.existsSync(path.join(dir, "PG_VERSION"))) {
    await pg.initialise();
  }
  await pg.start();
  try {
    await pg.createDatabase("home_exchange");
  } catch (error) {
    const message = String(error instanceof Error ? error.message : error);
    if (!message.toLowerCase().includes("already")) console.error(message);
  }
}

await run("npx", ["prisma", "migrate", "deploy"]);
await run("npx", ["tsx", "prisma/seed.ts", "--if-empty"]);

const next = spawn("npx", ["next", "dev", "--turbopack"], {
  stdio: "inherit",
  env: process.env,
});
next.on("exit", (code) => process.exit(code ?? 0));
