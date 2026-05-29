import db from "./dbConnect";


async function getDatabaseVersion(): Promise<void> {
    // We don't call .connect() manually with a Pool for simple queries.
    // The pool handles connecting and disconnecting for you.

    try {
        // .query() automatically:
        // 1. Picks a client from the pool
        // 2. Runs the query
        // 3. Returns the client to the pool
        const result = await db.query('SELECT VERSION()');

        const version = result.rows[0].version;
        console.log(`Connected! PostgreSQL Version: ${version}`);

    } catch (error) {
        console.error('Database query error:', error);
    }
    // NOTE: Do NOT call db.end() here. 
    // If you close the pool, other parts of your app won't be able to use the DB!
}

export default getDatabaseVersion;


