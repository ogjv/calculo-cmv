import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
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
