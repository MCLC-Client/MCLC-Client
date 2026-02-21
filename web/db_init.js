const pool = require('./database');
const fs = require('fs');
const path = require('path');

const createTables = async () => {
    try {
        const connection = await pool.getConnection();
        await connection.query(`
            CREATE TABLE IF NOT EXISTS users (
                id INT AUTO_INCREMENT PRIMARY KEY,
                google_id VARCHAR(255) UNIQUE NOT NULL,
                username VARCHAR(50) UNIQUE NOT NULL,
                email VARCHAR(100),
                avatar VARCHAR(255),
                bio TEXT,
                role ENUM('user', 'admin') DEFAULT 'user',
                last_login DATETIME,
                ip_address VARCHAR(45),
                banned BOOLEAN DEFAULT FALSE,
                ban_reason TEXT,
                ban_expires DATETIME NULL,
                warn_count INT DEFAULT 0,
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
                banner_path VARCHAR(255),
                status ENUM('pending', 'approved', 'rejected', 'action_required') DEFAULT 'pending',
                downloads INT DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('[Database] Extensions table checked/created.');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS extension_versions (
                id INT AUTO_INCREMENT PRIMARY KEY,
                extension_id INT NOT NULL,
                version VARCHAR(20) NOT NULL,
                changelog TEXT,
                file_path VARCHAR(255) NOT NULL,
                downloads INT DEFAULT 0,
                status ENUM('pending', 'approved', 'rejected', 'action_required') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
            )
        `);
        console.log('[Database] Extension versions table checked/created.');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS extension_metadata_drafts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                extension_id INT NOT NULL,
                name VARCHAR(100),
                summary VARCHAR(255),
                description TEXT,
                banner_path VARCHAR(255),
                status ENUM('pending', 'approved', 'rejected', 'action_required') DEFAULT 'pending',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (extension_id) REFERENCES extensions(id) ON DELETE CASCADE
            )
        `);
        console.log('[Database] Extension metadata drafts table checked/created.');
        await connection.query(`
            CREATE TABLE IF NOT EXISTS notifications (
                id INT AUTO_INCREMENT PRIMARY KEY,
                user_id INT NOT NULL,
                message TEXT NOT NULL,
                type ENUM('info', 'success', 'warning', 'error') DEFAULT 'info',
                is_read BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            )
        `);
        console.log('[Database] Notifications table checked/created.');
        const ensureColumn = async (table, column, definition) => {
            try {
                const [cols] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE ?`, [column]);
                if (cols.length === 0) {
                    console.log(`[Database] Migrating: Adding ${column} to ${table}`);
                    await connection.query(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
                }
            } catch (err) {
                console.error(`[Database] Migration failed for ${table}.${column}:`, err.message);
            }
        };
        await ensureColumn('users', 'role', "ENUM('user', 'admin') DEFAULT 'user'");
        await ensureColumn('users', 'avatar', "VARCHAR(255) AFTER email");
        await ensureColumn('users', 'bio', "TEXT AFTER avatar");
        await ensureColumn('users', 'last_login', "DATETIME AFTER role");
        await ensureColumn('users', 'ip_address', "VARCHAR(45) AFTER last_login");
        await ensureColumn('users', 'banned', "BOOLEAN DEFAULT FALSE AFTER ip_address");
        await ensureColumn('users', 'ban_reason', "TEXT AFTER banned");
        await ensureColumn('users', 'ban_expires', "DATETIME NULL AFTER ban_reason");
        await ensureColumn('users', 'warn_count', "INT DEFAULT 0 AFTER ban_expires");

        // Ensure username uniqueness on existing tables
        try {
            const [indexes] = await connection.query("SHOW INDEX FROM users WHERE Column_name = 'username'");
            if (indexes.length === 0) {
                console.log('[Database] Migrating: Adding UNIQUE index to username');
                await connection.query('ALTER TABLE users ADD UNIQUE (username)');
            }
        } catch (err) {
            console.error('[Database] Failed to add unique index to username:', err.message);
        }

        await ensureColumn('extensions', 'updated_at', "TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at");
        await ensureColumn('extensions', 'identifier', "VARCHAR(100) UNIQUE AFTER name");
        await ensureColumn('extensions', 'summary', "VARCHAR(255) AFTER identifier");
        await ensureColumn('extensions', 'status', "ENUM('pending', 'approved', 'rejected', 'action_required') DEFAULT 'pending' AFTER banner_path");
        await ensureColumn('extensions', 'type', "ENUM('extension', 'theme') DEFAULT 'extension' AFTER description");
        await ensureColumn('extensions', 'visibility', "ENUM('public', 'unlisted') DEFAULT 'public' AFTER type");
        await ensureColumn('extensions', 'banner_path', "VARCHAR(255) AFTER file_path");
        await ensureColumn('extensions', 'downloads', "INT DEFAULT 0 AFTER status");
        const upgradeStatusEnum = async (table) => {
            try {

                const [cols] = await connection.query(`SHOW COLUMNS FROM ${table} LIKE 'status'`);
                if (cols.length > 0 && !cols[0].Type.includes('action_required')) {
                    console.log(`[Database] Migrating: Upgrading status ENUM for ${table}...`);
                    await connection.query(`ALTER TABLE ${table} MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'action_required') DEFAULT 'pending'`);
                }
            } catch (err) {
                console.error(`[Database] Failed to upgrade status ENUM for ${table}:`, err.message);
            }
        };

        await upgradeStatusEnum('extensions');
        await upgradeStatusEnum('extension_versions');
        await upgradeStatusEnum('extension_metadata_drafts');
        try {
            const [cols] = await connection.query(`SHOW COLUMNS FROM extensions LIKE 'file_path'`);
            if (cols.length > 0) {
                console.log('[Database] Migrating file_path from extensions to extension_versions...');
                const [extensions] = await connection.query('SELECT id, file_path, status, downloads, created_at FROM extensions');
                for (const ext of extensions) {
                    if (ext.file_path) {

                        const [versions] = await connection.query('SELECT id FROM extension_versions WHERE extension_id = ? AND version = ?', [ext.id, '1.0.0']);
                        if (versions.length === 0) {
                            await connection.query('INSERT INTO extension_versions (extension_id, version, changelog, file_path, downloads, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
                                [ext.id, '1.0.0', 'Initial upload', ext.file_path, ext.downloads, ext.status, ext.created_at]);
                        }
                    }
                }
            }
        } catch (err) {
            console.error('[Database] Data migration failed:', err.message);
        }

        connection.release();
        return true;
    } catch (err) {
        console.error('[Database] Error initializing tables:', err);
        return false;
    } finally {
        if (connection) connection.release();
    }
};

module.exports = { createTables };
if (require.main === module) {
    createTables().then(success => {
        process.exit(success ? 0 : 1);
    });
}