import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The address of the ASP.NET Core API (the https port shown by `dotnet run --launch-profile https`).
const apiUrl = process.env.HMS_API_URL ?? 'https://localhost:7019'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    strictPort: true,
    // The proxy forwards every /api request to the API.
    // The browser only ever talks to localhost:5173, so the login cookie works
    // and we do not need to open up CORS.
    proxy: {
      '/api': {
        target: apiUrl,
        changeOrigin: true,
        // The development HTTPS certificate is self-signed; accept it in development only.
        secure: false,
      },
    },
  },
})
