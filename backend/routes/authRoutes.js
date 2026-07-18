const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/db');

// ==========================================
// REGISTER ROUTE
// ==========================================
router.post('/register', async (req, res) => {
    const { full_name, email, password, gender = null, country = null, age = null, topics = [] } = req.body;

    if (!full_name || !email || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    try {
        const [existing] = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existing.length > 0) {
            return res.status(409).json({ success: false, message: "An account with this email already exists" });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(password, saltRounds);

        const [result] = await pool.query(
            'INSERT INTO users (full_name, email, password_hash, gender, country, age) VALUES (?, ?, ?, ?, ?, ?)',
            [full_name, email, passwordHash, gender, country, age ? parseInt(age, 10) : null]
        );

        const newUserId = result.insertId;

        if (Array.isArray(topics) && topics.length > 0) {
            const values = topics.map(topic => [newUserId, topic.trim()]);
            await pool.query(
                'INSERT IGNORE INTO user_topics (user_id, topic_name) VALUES ?',
                [values]
            );
        }

        return res.status(201).json({ 
            success: true, 
            message: "Registration Successful" 
        });

    } catch (error) {
        console.error("Registration error:", error);
        return res.status(500).json({ success: false, message: "Database server error" });
    }
});

// ==========================================
// LOGIN ROUTE
// ==========================================
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ success: false, message: "All fields are required" });
    }

    try {
        const [users] = await pool.query(
            'SELECT id, full_name, email, password_hash, gender, country, age, github_username, profile_picture, headline, career_goal, linkedin_url, preferred_languages FROM users WHERE email = ?', 
            [email]
        );

        if (users.length === 0) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(password, user.password_hash);

        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Invalid email or password" });
        }

        const [userTopics] = await pool.query(
            'SELECT topic_name FROM user_topics WHERE user_id = ?',
            [user.id]
        );
        const topicsList = userTopics.map(t => t.topic_name);

        const userPayload = {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            gender: user.gender,
            country: user.country,
            age: user.age,
            github_username: user.github_username,
            profile_picture: user.profile_picture,
            headline: user.headline,
            career_goal: user.career_goal,
            linkedin_url: user.linkedin_url,
            preferred_languages: user.preferred_languages,
            topics: topicsList
        };

        return res.status(200).json({
            success: true,
            user: userPayload
        });

    } catch (error) {
        console.error("Login error:", error);
        return res.status(500).json({ success: false, message: "Database server error" });
    }
});

// ==========================================
// FETCH USER PROFILE & TOPICS ROUTE
// ==========================================
router.get('/profile/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const [users] = await pool.query(
            'SELECT id, full_name, email, gender, country, age, github_username, profile_picture, headline, career_goal, linkedin_url, preferred_languages, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        const user = users[0];
        const [userTopics] = await pool.query(
            'SELECT topic_name FROM user_topics WHERE user_id = ?',
            [userId]
        );

        user.topics = userTopics.map(t => t.topic_name);
        return res.status(200).json({ success: true, user });
    } catch (error) {
        console.error("Profile fetch error:", error);
        return res.status(500).json({ success: false, message: "Database server error" });
    }
});

// ==========================================
// UPDATE USER PROFILE & AVATAR ROUTE
// ==========================================
router.put('/profile/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { full_name, gender = null, country = null, age = null, github_username = null, profile_picture = null, headline = null, career_goal = null, linkedin_url = null, preferred_languages = null, topics = [] } = req.body;

        await pool.query(
            'UPDATE users SET full_name = ?, gender = ?, country = ?, age = ?, github_username = ?, headline = ?, career_goal = ?, linkedin_url = ?, preferred_languages = ?, profile_picture = COALESCE(?, profile_picture) WHERE id = ?',
            [full_name, gender, country, age ? parseInt(age, 10) : null, github_username, headline, career_goal, linkedin_url, preferred_languages, profile_picture, userId]
        );

        if (Array.isArray(topics)) {
            await pool.query('DELETE FROM user_topics WHERE user_id = ?', [userId]);
            if (topics.length > 0) {
                const values = topics.map(t => [userId, t.trim()]);
                await pool.query('INSERT IGNORE INTO user_topics (user_id, topic_name) VALUES ?', [values]);
            }
        }

        const [users] = await pool.query(
            'SELECT id, full_name, email, gender, country, age, github_username, profile_picture, headline, career_goal, linkedin_url, preferred_languages, created_at FROM users WHERE id = ?',
            [userId]
        );

        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found after update" });
        }

        const updatedUser = users[0];
        const [userTopics] = await pool.query('SELECT topic_name FROM user_topics WHERE user_id = ?', [userId]);
        updatedUser.topics = userTopics.map(t => t.topic_name);

        return res.status(200).json({
            success: true,
            message: "Profile updated successfully",
            user: updatedUser
        });
    } catch (error) {
        console.error("Profile update error:", error);
        return res.status(500).json({ success: false, message: "Database server error during profile update" });
    }
});

// ==========================================
// CHANGE PASSWORD ROUTE
// ==========================================
router.put('/password/:id', async (req, res) => {
    try {
        const userId = req.params.id;
        const { current_password, new_password } = req.body;

        if (!current_password || !new_password) {
            return res.status(400).json({ success: false, message: "Current password and new password are required." });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ success: false, message: "New password must be at least 6 characters long." });
        }

        const [users] = await pool.query('SELECT id, password_hash FROM users WHERE id = ?', [userId]);
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: "User not found." });
        }

        const user = users[0];
        const isMatch = await bcrypt.compare(current_password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ success: false, message: "Current password does not match your existing password." });
        }

        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(new_password, saltRounds);

        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [passwordHash, userId]);

        return res.status(200).json({ success: true, message: "Password updated successfully!" });
    } catch (error) {
        console.error("Password change error:", error);
        return res.status(500).json({ success: false, message: "Database server error while updating password." });
    }
});

module.exports = router;
