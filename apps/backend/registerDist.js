//Production alias: `@backend/*` → the compiled `dist/*` (dev resolves it over the .ts sources with tsconfig-paths/register).
//Used by `npm start`: node -r ./registerDist.js dist/server.js
const path = require('path')
require('tsconfig-paths').register({baseUrl: process.env.BACKEND_DIST || path.join(__dirname, 'dist'), paths: {'@backend/*': ['./*']}})
