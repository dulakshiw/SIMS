# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
# SIMS
This is the official repository for Smart inventory management system for IT Faculty of UOM

## Database Setup

This project now includes an Express.js API in [server/index.js](server/index.js) that connects to MySQL.

1. Install dependencies:
	`npm install`
2. Copy `.env.example` to `.env`
3. Update the MySQL settings in `.env`
4. Start the API server:
	`npm run dev:server`
5. Start the frontend in a second terminal:
	`npm run dev`

### Environment Variables

- `DB_HOST`: MySQL host
- `DB_PORT`: MySQL port
- `DB_USER`: MySQL username
- `DB_PASSWORD`: MySQL password
- `DB_NAME`: MySQL database name
- `DB_ITEMS_TABLE`: table used by the inventory form
- `AUTO_CREATE_TABLES=true`: create the inventory items table automatically on startup
- `VITE_API_BASE_URL`: optional base URL if frontend and backend are not served from the same origin

### Inventory Table

The inventory form writes to `inventory_items`. You can either:

- let the server create it automatically with `AUTO_CREATE_TABLES=true`, or
- run the SQL in [server/schema.sql](server/schema.sql) manually.

### Health Check

Once the API server is running, verify the database connection at:

`http://localhost:4000/api/health`
