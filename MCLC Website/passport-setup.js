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
    proxy: true
},
    async (accessToken, refreshToken, profile, done) => {
        try {
            // Check if user exists
            const [rows] = await pool.query('SELECT * FROM users WHERE google_id = ?', [profile.id]);

            if (rows.length > 0) {
                // User exists, return user
                return done(null, rows[0]);
            } else {
                // New user, create
                const newUser = {
                    google_id: profile.id,
                    username: profile.displayName,
                    email: profile.emails && profile.emails.length > 0 ? profile.emails[0].value : null,
                    avatar: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : null,
                    bio: 'Project MCLC Member',
                    role: 'user'
                };

                const [result] = await pool.query(
                    'INSERT INTO users (google_id, username, email, avatar, bio, role) VALUES (?, ?, ?, ?, ?, ?)',
                    [newUser.google_id, newUser.username, newUser.email, newUser.avatar, newUser.bio, newUser.role]
                );
                newUser.id = result.insertId;
                return done(null, newUser);
            }
        } catch (err) {
            console.error('Stats Update Error', err);
            return done(err, null);
        }
    }));

module.exports = passport;
