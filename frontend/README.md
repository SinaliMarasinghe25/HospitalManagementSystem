# Frontend: HMS web app

React 19 + TypeScript, built with Vite, styled with Tailwind CSS, routed with React Router.

```powershell
cd frontend
npm install       # first time and after package.json changes
npm run dev       # http://localhost:5173 (forwards /api to https://localhost:7019)
npm test          # Vitest + React Testing Library
npm run lint      # oxlint
npm run build     # type check and production build into dist/
```

The API must be running for `npm run dev`. Set `HMS_API_URL` if it is not on `https://localhost:7019`.

- Folder layout and design: [architecture](../docs/architecture/architecture.md#frontend-frontendsrc)
- Which role sees what: [roles and permissions](../docs/architecture/roles-and-permissions.md)
- Screens per role: [user manual](../docs/guides/user-manual.md)
