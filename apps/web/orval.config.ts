import { defineConfig } from "orval";

export default defineConfig({
  weeklyrun: {
    input: {
      target: "../api/openapi.json",
    },
    output: {
      mode: "tags-split",
      target: "./src/lib/api/__generated__",
      schemas: "./src/lib/api/__generated__/schemas",
      client: "react-query",
      httpClient: "axios",
      override: {
        mutator: {
          path: "./src/lib/api/client.ts",
          name: "apiClient",
        },
        query: {
          useQuery: true,
          useMutation: true,
        },
      },
    },
  },
});
