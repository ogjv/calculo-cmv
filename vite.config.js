import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    // O dashboard e servido em https://grest.com.br/dashboard via rewrite da Vercel.
    // base + outDir mantem o prefixo /dashboard identico nos dois projetos.
    base: "/dashboard/",
    plugins: [react()],
    build: {
        outDir: "dist/dashboard",
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    if (id.includes("node_modules")) {
                        if (id.includes("@supabase")) {
                            return "supabase";
                        }
                        if (id.includes("react")) {
                            return "react-vendor";
                        }
                        return "vendor";
                    }
                    if (id.includes("src/components/accountPanels")) {
                        return "account-panels";
                    }
                    if (id.includes("src/components/teamPanels")) {
                        return "team-panels";
                    }
                    if (id.includes("src/components/drePanels")) {
                        return "dre-panels";
                    }
                    if (id.includes("src/components/cmvPanels")) {
                        return "cmv-panels";
                    }
                    return undefined;
                }
            }
        }
    }
});
