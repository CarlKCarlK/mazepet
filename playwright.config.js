const { defineConfig } = require('@playwright/test');
module.exports = defineConfig({
  testDir: './tests',
  use: { baseURL: 'http://127.0.0.1:8765', browserName: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL, headless: true },
  webServer: {
    command: 'npm run build -- --preview && python3 -u -m http.server 8765 --bind 127.0.0.1 --directory _site',
    wait: { stdout: /Serving HTTP/ },
    stderr: 'ignore',
    reuseExistingServer: false,
  },
});
