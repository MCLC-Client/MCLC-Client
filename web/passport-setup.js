const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const pool = require('./database');
require('dotenv').config();

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [id]);
        if (rows.length > 0) {
            done(null, rows[0]);
        } else {
            done(new Error('User not found'), null);
        }
    } catch (err) {
        done(err, null);
    }
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.CALLBACK_URL || "/auth/google/callback",
    proxy: true,
    passReqToCallback: true
},
    async (req, accessToken, refreshToken, profile, done) => {
        console.log(`[Google OAuth] Callback received for user: ${profile.displayName} (${profile.id})`);
        try {
            let ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
            if (ip && ip.includes(',')) ip = ip.split(',')[0].trim();
            const now = new Date();
            console.log(`[Google OAuth] Querying database for google_id: ${profile.id}`);
            const [rows] = await pool.query('SELECT * FROM users WHERE google_id = ?', [profile.id]);

            if (rows.length > 0) {
                const user = rows[0];
                if (user.banned) {
                    if (user.ban_expires && new Date(user.ban_expires) < now) {

                        await pool.query('UPDATE users SET banned = FALSE, ban_reason = NULL, ban_expires = NULL WHERE id = ?', [user.id]);
                    } else {
                        return done(null, false, { message: user.ban_reason || 'You are banned from this platform.' });
                    }
                }
                await pool.query('UPDATE users SET last_login = ?, ip_address = ? WHERE id = ?', [now, ip, user.id]);
                user.last_login = now;
                user.ip_address = ip;

                return done(null, user);
            } else {

                const newUser = {
                    google_id: profile.id,
                    username: profile.displayName,
                    email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
                    avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
                    bio: 'Project MCLC Member',
                    role: 'user',
                    last_login: now,
                    ip_address: ip
                };

                const [result] = await pool.query(
                    'INSERT INTO users (google_id, username, email, avatar, bio, role, last_login, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
                    [newUser.google_id, newUser.username, newUser.email, newUser.avatar, newUser.bio, newUser.role, newUser.last_login, newUser.ip_address]
                );
                newUser.id = result.insertId;
                console.log(`[Google OAuth] New user created with ID: ${newUser.id}`);
                return done(null, newUser);
            }
        } catch (err) {
            console.error('[Google OAuth] Authorization Error:', err);
            if (err.data) {
                try {
                    console.error('[Google OAuth] Error Data:', JSON.stringify(err.data, null, 2));
                } catch (e) {
                    console.error('[Google OAuth] Error Data (raw):', err.data);
                }
            }
            console.error('[Google OAuth] Error Stack:', err.stack);
            return done(err, null);
        }
    }));

module.exports = passport;