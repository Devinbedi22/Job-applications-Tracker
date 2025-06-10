const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = 5500;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB connection
mongoose.connect('mongodb://localhost:27017/job-tracker', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log('MongoDB connected'))
  .catch(err => console.error('MongoDB connection error:', err));

// Models
const userSchema = new mongoose.Schema({
  email: String,
  password: String,
});

const applicationSchema = new mongoose.Schema({
  jobTitle: String,
  company: String,
  location: String,
  status: String,
  notes: String,
  dateApplied: { type: Date, default: Date.now },
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
});

const User = mongoose.model('User', userSchema);
const Application = mongoose.model('Application', applicationSchema);

// JWT Secret
const SECRET = 'job-tracker-secret';

// Middleware to authenticate JWT
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, SECRET, (err, user) => {
    if (err) return res.sendStatus(403);
    req.user = user;
    next();
  });
}

// Auth Routes
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  try {
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ error: 'User already exists' });

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ email, password: hashed });
    await user.save();

    res.status(201).json({ message: 'User registered' });
  } catch (err) {
    console.error('Register Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, SECRET, { expiresIn: '1h' });
    res.json({ token });
  } catch (err) {
    console.error('Login Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Application Routes
app.get('/api/applications', authenticateToken, async (req, res) => {
  try {
    const apps = await Application.find({ user: req.user.id }).sort({ dateApplied: -1 });
    res.json(apps);
  } catch (err) {
    console.error('Fetch Applications Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/applications', authenticateToken, async (req, res) => {
  try {
    const { jobTitle, company, location, status, notes, dateApplied } = req.body;

    if (!jobTitle || !company || !location || !status) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const newApp = new Application({
      jobTitle,
      company,
      location,
      status,
      notes,
      user: req.user.id,
      dateApplied: dateApplied ? new Date(dateApplied) : new Date()
    });

    await newApp.save();
    res.status(201).json(newApp);
  } catch (err) {
    console.error('Add Application Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Update application
app.put('/api/applications/:id', authenticateToken, async (req, res) => {
  try {
    const updated = await Application.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      req.body,
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: 'Application not found' });

    res.json(updated);
  } catch (err) {
    console.error('Update Application Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Delete application
app.delete('/api/applications/:id', authenticateToken, async (req, res) => {
  try {
    const deleted = await Application.findOneAndDelete({
      _id: req.params.id,
      user: req.user.id
    });

    if (!deleted) return res.status(404).json({ error: 'Application not found' });

    res.json({ message: 'Application deleted' });
  } catch (err) {
    console.error('Delete Application Error:', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// External Job Search
app.get('/api/external-jobs', async (req, res) => {
  const query = req.query.query;
  if (!query) return res.status(400).json({ error: 'Missing query parameter' });

  try {
    const options = {
      method: 'GET',
      url: 'https://jsearch.p.rapidapi.com/search',
      params: {
        query,
        page: '1',
        num_pages: '1',
      },
      headers: {
        'X-RapidAPI-Key': process.env.RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'jsearch.p.rapidapi.com'
      }
    };

    const response = await axios.request(options);
    res.json(response.data.data);
  } catch (err) {
    console.error('External Jobs Error:', err);
    res.status(500).json({ error: 'Failed to fetch external jobs' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
