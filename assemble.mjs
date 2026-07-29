import { cp, mkdir, rm } from "node:fs/promises";

// Monta a saida final que a Vercel publica:
//   dist/index.html        -> landing (raiz do repositorio)
//   dist/dashboard/**       -> build do app (dashboard/dist)
await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await cp("index.html", "dist/index.html");
await cp("dashboard/dist", "dist/dashboard", { recursive: true });

console.log("assemble: dist/ pronto (landing em / e dashboard em /dashboard/)");
