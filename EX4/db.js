const { Pool } = require("pg");

// Local PostgreSQL (Task 4). The values come from .env.
const pool = new Pool({
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT),
    database: process.env.PGDATABASE,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD
});

// Optional Neon extension: comment out the Pool above and use this one instead.
// const pool = new Pool({
//     connectionString: process.env.DATABASE_URL
// });

module.exports = pool;
