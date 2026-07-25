const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const Groq = require('groq-sdk');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));

const JWT_SECRET = process.env.JWT_SECRET || 'zone_dev_secret_change_in_prod';

// ─── MongoDB connection ───────────────────────────────────────────────────────
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch((err) => { console.error('MongoDB connection error:', err); process.exit(1); });

// ─── User schema ──────────────────────────────────────────────────────────────
const userSchema = new mongoose.Schema(
  {
    email:        { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.passwordHash;
        return ret;
      },
    },
  }
);

const User = mongoose.model('User', userSchema);

// ─── Task schema ──────────────────────────────────────────────────────────────
const taskSchema = new mongoose.Schema(
  {
    userId:          { type: String, required: true },
    title:           { type: String, required: true, trim: true },
    description:     { type: String, default: '' },
    dueDate:         { type: Date, default: null },
    priority:        { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
    completed:       { type: Boolean, default: false },
    category:        { type: String, default: 'General', trim: true },
    tags:            { type: [String], default: [] },
    estimateMinutes: { type: Number, default: 30 },
    energy:          { type: String, default: null },
    nextAction:      { type: String, default: '' },
    parentTaskId:    { type: String, default: null },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: (_, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
      },
    },
  }
);

const Task = mongoose.model('Task', taskSchema);

// ─── Focus Session schema ─────────────────────────────────────────────────────
const focusSessionSchema = new mongoose.Schema({
  userId:          { type: String, required: true },
  taskId:          { type: String, required: true },
  taskTitle:       { type: String, required: true },
  estimateMinutes: { type: Number, default: 0 },
  actualMinutes:   { type: Number, required: true },
  feelingRating:   { type: String, enum: ['easy', 'okay', 'hard'], required: true },
  category:        { type: String, default: 'General' },
  completedAt:     { type: Date, default: Date.now },
}, { timestamps: true });

const FocusSession = mongoose.model('FocusSession', focusSessionSchema);

// ─── Auth middleware ──────────────────────────────────────────────────────────
function authenticateToken(req, res, next) {
  const header = req.headers['authorization'];
  const token = header && header.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.userId = payload.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// ─── POST /auth/register ──────────────────────────────────────────────────────
app.post('/auth/register', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) return res.status(409).json({ error: 'An account with this email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ email: email.toLowerCase().trim(), passwordHash });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.status(201).json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'Registration failed' });
  }
});

// ─── POST /auth/login ─────────────────────────────────────────────────────────
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const match = await bcrypt.compare(password, user.passwordHash);
    if (!match) return res.status(401).json({ error: 'Invalid email or password' });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '30d' });
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: 'Login failed' });
  }
});

// ─── GET all tasks ────────────────────────────────────────────────────────────
app.get('/tasks', authenticateToken, async (req, res) => {
  try {
    const { completed, category, tag, parentTaskId } = req.query;
    const filter = { userId: req.userId };
    if (completed    !== undefined) filter.completed    = completed === 'true';
    if (category)                   filter.category     = category;
    if (tag)                        filter.tags         = tag;
    if (parentTaskId !== undefined) filter.parentTaskId = parentTaskId === 'null' ? null : parentTaskId;
    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// ─── GET single task ──────────────────────────────────────────────────────────
app.get('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    res.status(400).json({ error: 'Invalid task ID' });
  }
});

// ─── POST create task ─────────────────────────────────────────────────────────
app.post('/tasks', authenticateToken, async (req, res) => {
  try {
    const { title, description, dueDate, priority, completed, category, tags,
            estimateMinutes, energy, nextAction, parentTaskId } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });
    const task = await Task.create({
      userId:          req.userId,
      title:           title.trim(),
      description:     description ?? '',
      dueDate:         dueDate     ?? null,
      priority:        priority    ?? 'medium',
      completed:       completed   ?? false,
      category:        category?.trim() || 'General',
      tags:            Array.isArray(tags) ? tags.filter(Boolean) : [],
      estimateMinutes: estimateMinutes ?? 30,
      energy:          energy ?? null,
      nextAction:      nextAction ?? '',
      parentTaskId:    parentTaskId ?? null,
    });
    res.status(201).json(task);
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// ─── PUT update task ──────────────────────────────────────────────────────────
app.put('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const { title, description, dueDate, priority, completed, category, tags,
            estimateMinutes, energy, nextAction } = req.body;
    const updates = {};
    if (title           !== undefined) updates.title           = title.trim();
    if (description     !== undefined) updates.description     = description;
    if (dueDate         !== undefined) updates.dueDate         = dueDate;
    if (priority        !== undefined) updates.priority        = priority;
    if (completed       !== undefined) updates.completed       = completed;
    if (category        !== undefined) updates.category        = category?.trim() || 'General';
    if (tags            !== undefined) updates.tags            = Array.isArray(tags) ? tags.filter(Boolean) : [];
    if (estimateMinutes !== undefined) updates.estimateMinutes = estimateMinutes;
    if (energy          !== undefined) updates.energy          = energy;
    if (nextAction      !== undefined) updates.nextAction      = nextAction;
    const task = await Task.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      updates,
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json(task);
  } catch (err) {
    if (err.name === 'ValidationError') return res.status(400).json({ error: err.message });
    res.status(400).json({ error: 'Invalid task ID or data' });
  }
});

// ─── DELETE task ──────────────────────────────────────────────────────────────
app.delete('/tasks/:id', authenticateToken, async (req, res) => {
  try {
    const task = await Task.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: 'Invalid task ID' });
  }
});

// ─── POST complete focus session ──────────────────────────────────────────────
app.post('/tasks/:id/complete-focus', authenticateToken, async (req, res) => {
  try {
    const { actualMinutes, feelingRating } = req.body;
    const task = await Task.findOne({ _id: req.params.id, userId: req.userId });
    if (!task) return res.status(404).json({ error: 'Task not found' });
    await FocusSession.create({
      userId:          req.userId,
      taskId:          task.id,
      taskTitle:       task.title,
      estimateMinutes: task.estimateMinutes,
      actualMinutes,
      feelingRating,
      category:        task.category,
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to log focus session' });
  }
});

// ─── POST AI plan task ────────────────────────────────────────────────────────
app.post('/ai/plan-task', authenticateToken, async (req, res) => {
  try {
    const { title, description, category, totalHours } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

    const prompt = `You are a student productivity coach. Break this task into manageable subtasks.

Task: "${title.trim()}"
${description ? `Details: ${description}` : ''}
${category ? `Category: ${category}` : ''}
${totalHours ? `Time available: ${totalHours} hours` : ''}

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "feasibility": {
    "ok": true,
    "message": "This looks achievable in the time given."
  },
  "subtasks": [
    {
      "title": "Short subtask title",
      "description": "1-2 sentences explaining what this step involves and why it matters.",
      "estimateMinutes": 20,
      "nextAction": "The very first small thing to do — make it feel easy to start",
      "energy": "medium"
    }
  ]
}

Rules:
- If totalHours is given and seems unrealistic for the task, set feasibility.ok to false and explain gently.
- Create 4-7 subtasks covering the full scope of the task. Each must feel non-overwhelming.
- description: briefly explain what this subtask involves (1-2 sentences).
- nextAction should be a single specific micro-step (like "Open a blank doc and jot 3 bullet points").
- estimateMinutes per subtask should be 10-60 min.
- energy must be "high", "medium", or "low".
- Total estimated time across all subtasks should roughly match totalHours if given.
- IMPORTANT: Always output a complete, valid JSON object with ALL subtasks fully written out. Never truncate.`;

    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 2000,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0].message.content.trim();
    const parsed = JSON.parse(raw);

    res.json(parsed);
  } catch (err) {
    console.error('AI plan error:', err.message);
    res.status(500).json({ error: 'AI planning failed' });
  }
});

// ─── POST bulk create tasks ───────────────────────────────────────────────────
app.post('/tasks/bulk', authenticateToken, async (req, res) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks) || !tasks.length) {
      return res.status(400).json({ error: 'tasks array is required' });
    }
    const created = await Task.insertMany(
      tasks.map(t => ({
        userId:          req.userId,
        title:           t.title?.trim(),
        description:     t.description ?? '',
        dueDate:         t.dueDate ?? null,
        priority:        t.priority ?? 'medium',
        completed:       false,
        category:        t.category?.trim() || 'General',
        tags:            Array.isArray(t.tags) ? t.tags.filter(Boolean) : [],
        estimateMinutes: t.estimateMinutes ?? 30,
        energy:          t.energy ?? null,
        nextAction:      t.nextAction ?? '',
        parentTaskId:    t.parentTaskId ?? null,
      }))
    );
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Bulk create failed' });
  }
});

// Keep Render free tier alive by self-pinging every 14 minutes
const https = require('https');
setInterval(() => {
  https.get('https://taskmanager-pn0w.onrender.com/tasks', (res) => {
    console.log(`Keep-alive ping: ${res.statusCode}`);
  }).on('error', (err) => {
    console.error('Keep-alive failed:', err.message);
  });
}, 14 * 60 * 1000);

// ─── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
