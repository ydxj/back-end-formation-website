import express from 'express';
import mysql from 'mysql';
import cors from 'cors';
import session from 'express-session';
import cookieParser from 'cookie-parser';
import multer from "multer";
import path from "path";

const app = express();

app.use(
  cors({
    origin: 'http://localhost:3000', 
    methods: ['GET', 'POST','PUT','DELETE'],
    credentials: true, 
  })
);

app.use(express.json());
app.use(cookieParser());
app.use(
  session({
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
// Configuration de Multer pour upload des fichier
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // Specify the folder for storing files
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});
const upload = multer({ storage });
const db = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'chu e-learning',
});

db.connect((err) => {
  if (err) {
    console.error('Error connecting to the database:', err);
    process.exit(1); 
  } else {
    console.log('Connected to the MySQL database.');
  }
});

app.get('/menu', (req, res) => {
  try {
    if (req.session.fullname) {
      return res.json({
        valid: true,
        id: req.session.userId,
        username: req.session.fullname,
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

app.post('/login', (req, res) => {
  const { email, password } = req.body;

  const sql = 'SELECT * FROM employee WHERE email = ? AND password = ?';

  db.query(sql, [email, password], (err, results) => {
    if (err) {
      console.error('Error in /login route:', err);
      return res.status(500).json({ message: 'Internal server error' });
    }

    if (results.length > 0) {
      const user = results[0];
      req.session.role = user.role;
      req.session.fullname = user.fullname;
      req.session.userId = user.id;
      return res.json({ Login: true, username: user.fullname, role: user.role,id: user.id });
    } else {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
  });
});

// Route pour récupérer les formations
app.get('/formations', (req, res) => {
  const query = `
    SELECT f.id, f.titre, f.duree, f.date_debut, f.date_fin, f.description,
          fl.filename, fl.filepath
    FROM formations f
    LEFT JOIN files fl ON f.id = fl.formation_id
  `;
  db.query(query, (err, result) => {
    if (err) {
      console.error('Erreur lors de la récupération des formations:', err);
      return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
    return res.json(result);
  });
});

// Route pour ajouter une formation
// Add formation with file upload
app.post("/formations", upload.single("file"), (req, res) => {
  console.log("Body:", req.body);
  console.log("File:", req.file); // Check if the file is coming through  
  const { titre, duree, description, date_debut, date_fin } = req.body;
  const file = req.file;
  if (!file) {
    return res.status(400).json({ message: "File upload is required." });
  }
  // Insert formation into the database
  const formationQuery = "INSERT INTO formations (titre, duree, description, date_debut, date_fin) VALUES (?, ?, ?, ?, ?)";
  db.query(formationQuery,[titre, duree,description, date_debut, date_fin ],(err, formationResult) => {
      if (err) {
        console.error("Error adding formation:", err);
        return res.status(500).json({ message: "Error adding formation." });
      }
      const formationId = formationResult.insertId;
      // Insert file into the files table
      const fileQuery = "INSERT INTO files (filename, filepath, formation_id) VALUES (?, ?, ?)";
      db.query(fileQuery,[file.filename, file.path, formationId],(err, fileResult) => {
          if (err) {
            console.error("Error saving file:", err);
            return res.status(500).json({ message: "Error saving file." });
          }
          res.json({
            message: "Formation and file uploaded successfully.",
            formationId,
            fileId: fileResult.insertId,
          });
        }
      );
    }
  );
});
// Endpoint to retrieve the list of files
app.get("/files", (req, res) => {
  const query = "SELECT * FROM files";
  db.query(query, (err, results) => {
    if (err) {
      console.error("Error retrieving files from database:", err);
      return res.status(500).json({ message: "Server error." });
    }
    res.json(results);
  });
});
// Serve uploaded files statically for downloads
app.use("/uploads", express.static("uploads"));
// Route pour supprimer une formation
app.delete('/formations/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM formations WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Erreur lors de la suppression de la formation:', err);
      return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
    return res.json({ message: 'Formation supprimée avec succès.' });
  });
});
// Route to update a formation
app.put('/formations/:id', (req, res) => {
  const { id } = req.params;
  const { titre,duree, description, date_debut, date_fin, formateur } = req.body;

  const query = 'UPDATE formations SET titre = ?,duree = ?, description = ?, date_debut = ?, date_fin = ?, formateur = ? WHERE id = ?';
  
  db.query(query, [titre,duree, description, date_debut, date_fin, formateur, id], (err, result) => {
    if (err) {
      console.error('Erreur lors de la mise à jour de la formation:', err);
      return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
    if (result.affectedRows > 0) {
      return res.json({ message: 'Formation mise à jour avec succès.' });
    } else {
      return res.status(404).json({ message: 'Formation non trouvée.' });
    }
  });
});

// Route pour récupérer tous les employés
app.get('/employees', (req, res) => {
  const query = 'SELECT * FROM employee';
  db.query(query, (err, result) => {
    if (err) {
      console.error('Erreur lors de la récupération des employés:', err);
      return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
    return res.json(result);
  });
});

// Route pour ajouter un employé
app.post('/employees', async (req, res) => {
  const { name,service, email, role, password } = req.body;

  try {
    const query = 'INSERT INTO employee (fullname, service, email, role, password) VALUES (?, ?, ?, ?, ?)';
    db.query(query, [name,service, email, role, password], (err, result) => {
      if (err) {
        console.error('Error adding employee:', err);
        return res.json({ message: 'Server error.' });
      }
      res.json({ id: result.insertId, message: 'Employee added successfully.' });
    });
  } catch (err) {
    console.error('Error : ', err);
    res.json({ message: 'Server error.' });
  }
});
// Route to update an employee's password
app.put('/employees/:id/password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;

  try {
    const query = 'UPDATE employee SET password = ? WHERE id = ?';
    db.query(query, [password, id], (err, result) => {
      if (err) {
        console.error('Error updating password:', err);
        return res.status(500).json({ message: 'Server error.' });
      }
      if (result.affectedRows > 0) {
        res.json({ message: 'Password updated successfully.' });
      } else {
        res.status(404).json({ message: 'Employee not found.' });
      }
    });
  } catch (err) {
    console.error('Error password:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});
// Route pour mettre à jour un employé
app.put('/employees/:id', (req, res) => {
  const { id } = req.params;
  const { name, email, role } = req.body;
  const query = 'UPDATE employee SET fullname = ?, email = ?, role = ? WHERE id = ?';
  db.query(query, [name, email, role, id], (err, result) => {
    if (err) {
      console.error('Erreur lors de la mise à jour de l\'employé:', err);
      return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
    if (result.affectedRows > 0) {
      return res.json({ message: 'Employé mis à jour avec succès.' });
    } else {
      return res.status(404).json({ message: 'Employé non trouvé.' });
    }
  });
});

// Route pour supprimer un employé
app.delete('/employees/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM employee WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      console.error('Erreur lors de la suppression de l\'employé:', err);
      return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
    return res.json({ message: 'Employé supprimé avec succès.' });
  });
});
// update user password
app.put('/employeess/:id/password', (req, res) => {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;

  const getUserQuery = 'SELECT password FROM employee WHERE id = ?';
  db.query(getUserQuery, [id], (err, results) => {
    if (err) {
      console.error('Error fetching user:', err);
      return res.status(500).json({ message: 'Server error.' });
    }

    if (results.length === 0) {
      return res.status(404).json({ message: 'User not found.' });
    }

    const storedPassword = results[0].password;

    if (storedPassword !== currentPassword) {
      return res.status(400).json({ message: 'Current password is incorrect.' });
    }

    const updateQuery = 'UPDATE employee SET password = ? WHERE id = ?';
    db.query(updateQuery, [newPassword, id], (err) => {
      if (err) {
        console.error('Error updating password:', err);
        return res.status(500).json({ message: 'Server error.' });
      }
      res.json({ message: 'Password updated successfully.' });
    });
  });
});


// Route to save a formation request (inscription)
app.post('/formation-requests', (req, res) => {
  const { employee_id, formation_id } = req.body;

  const query = 'INSERT INTO formation_requests (employee_id, formation_id) VALUES (?, ?)';
  db.query(query, [employee_id, formation_id], (err, result) => {
    if (err) {
      console.error('Erreur lors de l\'inscription à la formation:', err);
      return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
    return res.json({ id: result.insertId, message: 'Inscription enregistrée avec succès.' });
  });
});

// Route to fetch all pending formation requests
app.get('/formation-requests', (req, res) => {
  const query = `
    SELECT 
      fr.id AS request_id, 
      e.fullname AS employee_name, 
      e.service, 
      f.titre AS formation_title, 
      f.date_debut, 
      fr.status 
    FROM formation_requests fr
    JOIN employee e ON fr.employee_id = e.id
    JOIN formations f ON fr.formation_id = f.id
    WHERE fr.status = 'pending'
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération des demandes de formation:', err);
      return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
    return res.json(results);
  });
});
// Route to fetch all doned pending formation requests
app.get('/formation-requestsdone', (req, res) => {
  const query = `
    SELECT 
      fr.id AS request_id, 
      e.fullname AS employee_name, 
      e.service, 
      f.titre AS formation_title, 
      f.date_debut,
      f.date_fin,
      fr.status 
    FROM formation_requests fr
    JOIN employee e ON fr.employee_id = e.id
    JOIN formations f ON fr.formation_id = f.id
    WHERE fr.status != 'pending'
    ORDER BY request_id desc
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Erreur lors de la récupération des demandes de formation:', err);
      return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
    return res.json(results);
  });
});

// Route to update the status of a formation request
app.put('/formation-requests/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body; // Status can be 'validated' or 'rejected'

  const query = 'UPDATE formation_requests SET status = ? WHERE id = ?';
  db.query(query, [status, id], (err, result) => {
    if (err) {
      console.error('Erreur lors de la mise à jour de la demande de formation:', err);
      return res.status(500).json({ message: 'Erreur interne du serveur.' });
    }
    if (result.affectedRows > 0) {
      return res.json({ message: `Demande ${status === 'validated' ? 'validée' : 'refusée'} avec succès.` });
    } else {
      return res.status(404).json({ message: 'Demande non trouvée.' });
    }
  });
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
