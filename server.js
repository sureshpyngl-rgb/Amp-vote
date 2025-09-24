require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();

// ✅ General CORS (for testing in browser/Postman)
const corsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// ✅ AMP-specific CORS middleware
app.use((req, res, next) => {
    // Check if the request is from an AMP client
    const sourceOrigin = req.query.__amp_source_origin;
    if (sourceOrigin) {
        // Set the required AMP CORS headers
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Expose-Headers', 'AMP-Access-Control-Allow-Source-Origin');
        res.setHeader('AMP-Access-Control-Allow-Source-Origin', sourceOrigin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
    }
    next();
});

// ✅ MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.error('❌ MongoDB error:', err));

// ✅ Poll schema
const pollSchema = new mongoose.Schema({
  question: String,
  options: [String],
  votes: [Number]
});

const Poll = mongoose.model('Poll', pollSchema);

// ✅ Create initial poll if not exists
(async () => {
  try {
    const poll = await Poll.findOne({});
    if (!poll) {
      await Poll.create({
        question: "What's your favorite social media platform?",
        options: ["Instagram", "Twitter (X)", "LinkedIn", "YouTube"],
        votes: [0, 0, 0, 0]
      });
      console.log("✅ Initial poll created");
    }
  } catch (err) {
    console.error("❌ Error creating initial poll:", err);
  }
})();

// ✅ Get current poll
app.get('/api/polls/current', async (req, res) => {
  try {
    const poll = await Poll.findOne({});
    if (!poll) return res.status(404).json({ success: false, message: "No poll found" });
    res.json(poll);
  } catch (err) {
    res.status(500).json({ success: false, message: "Error fetching poll" });
  }
});

// ✅ Submit vote
app.post('/api/polls/vote', async (req, res) => {
  try {
    const { optionId } = req.body;
    const poll = await Poll.findOne({});
    if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });

    const index = parseInt(optionId.replace('opt', '')) - 1;
    if (index < 0 || index >= poll.options.length) {
      return res.status(400).json({ success: false, message: 'Invalid option' });
    }

    poll.votes[index] += 1;
    await poll.save();

    res.json({ success: true, message: 'Vote submitted!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Error submitting vote' });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`🚀 Server running on port ${process.env.PORT || 3000}`);
});
