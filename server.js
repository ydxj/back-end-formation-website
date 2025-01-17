import express from 'express';
import mysql from 'mysql2/promise'; 
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';

const app = express();

app.use(
  cors({
    origin: 'http://localhost:3000', 
    methods: ['GET', 'POST'],
    credentials: true, 
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_strong_secret_key', 
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production', 
      maxAge: 1000 * 60 * 60 * 24,
      sameSite: 'lax', 
    },
  })
);

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'chu e-learning',
});

app.get('/menu', async (req, res) => {
  try {
    if (req.session.username) {
      return res.json({
        valid: true,
        username: req.session.username,
        role: req.session.role,
      });
    } else {
      return res.json({ valid: false });
    }
  } catch (error) {
    console.error('Error in /menu route:', error);
    return res.status(500).json({ message: 'Internal server error' }); 
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await pool.query('SELECT * FROM employee WHERE email = ? AND password = ?', [email, password]);
    if (rows.length > 0) {
      const user = rows[0];
      req.session.role = user.role;
      req.session.username = user.username;
      return res.json({ Login: true, username: user.username, role: user.role });
    } else {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  } catch (error) {
    console.error('Error in /login route:', error);
    return res.status(500).json({ message: 'Internal server error' }); // Handle errors gracefully
  }
});
app.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.json({ success: false, message: 'Failed to log out' });
        }
        res.clearCookie('connect.sid'); // Clear the session cookie
        return res.json({ success: true, message: 'Logged out successfully' });
    });
});
app.listen(8081, () => {
  console.log('Server listening on port 8081');
});