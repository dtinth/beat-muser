import { defineConfig } from "allure";

export default defineConfig({
  name: "Beat Muser CI Report",
  output: "ci-reports/allure",
  plugins: {
    awesome: {
      options: {
        reportName: "Beat Muser Tests",
        singleFile: false,
        reportLanguage: "en",
      },
    },
  },
});
