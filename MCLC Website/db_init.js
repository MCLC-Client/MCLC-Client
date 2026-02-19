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

        await connection.query(`
            CREATE TABLE IF NOT EXISTS extensions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                name VARCHAR(100) NOT NULL,
                identifier VARCHAR(100) UNIQUE,
                summary VARCHAR(255),
                description TEXT,
                type ENUM('extension', 'theme') DEFAULT 'extension',
                visibility ENUM('public', 'unlisted') DEFAULT 'public',
                file_path VARCHAR(255) NOT NULL,
                banner_path VARCHAR(255),
                status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
                downloads INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('[Database] Extensions table checked/created.');

        // Migration: Ensure new columns exist if table was created previously
        const [columns] = await connection.query('SHOW COLUMNS FROM extensions');
        const columnNames = columns.map(c => c.Field);

        if (!columnNames.includes('identifier')) {
            await connection.query('ALTER TABLE extensions ADD COLUMN identifier VARCHAR(100) UNIQUE AFTER name');
            console.log('[Database] Added identifier column to extensions.');
        }
        if (!columnNames.includes('summary')) {
            await connection.query('ALTER TABLE extensions ADD COLUMN summary VARCHAR(255) AFTER identifier');
            console.log('[Database] Added summary column to extensions.');
        }
        if (!columnNames.includes('banner_path')) {
            await connection.query('ALTER TABLE extensions ADD COLUMN banner_path VARCHAR(255) AFTER file_path');
            console.log('[Database] Added banner_path column to extensions.');
        }
        if (!columnNames.includes('type')) {
            await connection.query("ALTER TABLE extensions ADD COLUMN type ENUM('extension', 'theme') DEFAULT 'extension' AFTER description");
            console.log('[Database] Added type column to extensions.');
        }
        if (!columnNames.includes('visibility')) {
            await connection.query("ALTER TABLE extensions ADD COLUMN visibility ENUM('public', 'unlisted') DEFAULT 'public' AFTER type");
            console.log('[Database] Added visibility column to extensions.');
        }

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
