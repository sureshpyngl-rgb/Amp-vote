require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
// Add this BEFORE your routes
const corsOptions = {
  origin: '*', // AMP allows requests from any origin
  methods: ['GET','POST'],
  allowedHeaders: ['Content-Type']
};
app.use(cors(corsOptions));
app.use(bodyParser.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
.then(() => console.log('✅ MongoDB connected'))
.catch(err => console.error('❌ MongoDB error:', err));



// Poll schema
const pollSchema = new mongoose.Schema({
  question: String,
  options: [String],
  votes: [Number]  // votes[i] corresponds to options[i]
});

const Poll = mongoose.model('Poll', pollSchema);

// Create initial poll if not exists
// Create initial poll if not exists
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



// Get current poll
app.get('/api/polls/current', async (req, res) => {
  const poll = await Poll.findOne({});
  res.json(poll);
});

// Submit vote
app.post('/api/polls/vote', async (req, res) => {
  try {
    const { optionId } = req.body; // opt1, opt2...
    const poll = await Poll.findOne({});
    if (!poll) return res.status(404).send('Poll not found');

    const index = parseInt(optionId.replace('opt', '')) - 1;
    poll.votes[index] += 1;
    await poll.save();

    res.send({ success: true, message: 'Vote submitted!' });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: 'Error submitting vote' });
  }
});

app.listen(process.env.PORT || 3000, () => {
  console.log(`Server running on port ${process.env.PORT || 3000}`);
});
