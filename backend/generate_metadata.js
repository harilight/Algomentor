const mysql = require('mysql2/promise');
require('dotenv').config();

function parsePythonSignature(code) {
    if (!code) return null;
    const match = code.match(/def\s+([a-zA-Z0-9_]+)\s*\(\s*self\s*(?:,\s*([^)]+))?\)\s*(?:->\s*([^:]+))?:/);
    if (!match) return null;

    const methodName = match[1];
    const paramsStr = match[2];
    const returnStr = match[3];

    const params = [];
    if (paramsStr && paramsStr.trim().length > 0) {
        // Split parameters taking into account nested brackets for types like List[List[int]]
        let current = "";
        let depth = 0;
        for (let i = 0; i < paramsStr.length; i++) {
            const ch = paramsStr[i];
            if (ch === '[') depth++;
            else if (ch === ']') depth--;
            else if (ch === ',' && depth === 0) {
                params.push(current.trim());
                current = "";
                continue;
            }
            current += ch;
        }
        if (current.trim()) params.push(current.trim());
    }

    const parsedParams = params.map(p => {
        const parts = p.split(':');
        return {
            name: parts[0].trim(),
            type: parts[1] ? parts[1].trim() : 'any'
        };
    });

    return {
        name: methodName,
        params: parsedParams,
        return: {
            type: returnStr ? returnStr.trim() : 'any'
        }
    };
}

async function run() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '1234',
        database: process.env.DB_NAME || 'algomentor'
    });

    console.log("Fetching problems with missing meta_data...");
    const [rows] = await pool.query(`
        SELECT p.id, p.title, p.starter_code 
        FROM problems p 
        JOIN problem_details pd ON p.id = pd.problem_id 
        WHERE pd.meta_data IS NULL OR JSON_TYPE(pd.meta_data) = 'NULL'
    `);

    console.log(`Found ${rows.length} problems to update.`);
    let successCount = 0;
    let failCount = 0;

    for (const row of rows) {
        const meta = parsePythonSignature(row.starter_code);
        if (meta) {
            await pool.query('UPDATE problem_details SET meta_data = ? WHERE problem_id = ?', [JSON.stringify(meta), row.id]);
            successCount++;
        } else {
            failCount++;
        }
    }

    console.log(`\nMigration complete!`);
    console.log(`Successfully generated metadata for: ${successCount} problems.`);
    console.log(`Failed to parse metadata for: ${failCount} problems (likely missing Python starter code or unconventional format).`);
    process.exit(0);
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
