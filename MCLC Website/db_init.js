const pool = require('./database');
const fs = require('fs');
const path = require('path');

const createTables = async () => {
    try {
        const connection = await pool.getConnection();

        // 1. Users Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                google_id VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(50) NOT NULL,
                email VARCHAR(100),
                avatar VARCHAR(255),
                bio TEXT,
                role ENUM('user', 'admin') DEFAULT 'user',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('[Database] Users table checked/created.');

        // 2. Extensions Table
        await connection.query(`
            CREATE TABLE IF NOT EXISTS extensions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                description TEXT,
                file_path VARCHAR(255) NOT NULL,
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('[Database] Extensions table checked/created.');

        connection.release();
        return true;
    } catch (err) {
        console.error('[Database] Error initializing tables:', err);
        return false;
    }
};

module.exports = { createTables };

// Allow running as a standalone script
if (require.main === module) {
    createTables().then(success => {
        process.exit(success ? 0 : 1);
    });
}
