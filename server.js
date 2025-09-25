require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
// const bodyParser = require('body-parser'); // <-- We'll use express built-ins instead

const app = express();

// 🛑 CRITICAL FIX: Add both body parsers for JSON and URL-encoded data
// AMP form submissions from amp-selector are often URL-encoded.
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ CORRECTED AMP-specific CORS middleware (This part is correct)
app.use((req, res, next) => {
    const sourceOrigin = req.query.__amp_source_origin;
    const requestOrigin = req.headers.origin; // Get the dynamic Origin (Gmail or AMP Cache)

    if (sourceOrigin && requestOrigin) {
        // 1. Crucial Fix: Reflect the actual Origin for CORS to pass in all AMP environments
        res.setHeader('Access-Control-Allow-Origin', requestOrigin); 
        
        // 2. Reflect the __amp_source_origin parameter (your domain, e.g., https://pyngl.com)
        res.setHeader('AMP-Access-Control-Allow-Source-Origin', sourceOrigin);

        // 3. Required for credentials and exposing the custom AMP header
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Expose-Headers', 'AMP-Access-Control-Allow-Source-Origin');
    }

    // Set general CORS headers for all methods
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, *');

    // Handle the OPTIONS (preflight) request and exit early
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
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

// ✅ Submit vote (The action-xhr target: https://api.pyngl.com/api/polls/vote)
app.post('/api/polls/vote', async (req, res) => {
    try {
        const { optionId } = req.body;
        
        // Ensure data is received after fixing body parser
        if (!optionId) {
             return res.status(400).json({ success: false, message: 'Option must be selected (Did the body-parser fix work?).' });
        }
        
        const poll = await Poll.findOne({});
        if (!poll) return res.status(404).json({ success: false, message: 'Poll not found' });

        // 🛑 CRITICAL FIX: Check if poll.options is a valid array before accessing its length
        if (!Array.isArray(poll.options) || poll.options.length === 0) {
            console.error("❌ Poll data corrupted: 'options' array is missing or empty.");
            return res.status(500).json({ success: false, message: 'Poll configuration is invalid.' });
        }

        // Logic to update the vote count
        const index = parseInt(optionId.replace('opt', '')) - 1;
        
        // This line is now safe due to the check above
        if (index < 0 || index >= poll.options.length) { 
            return res.status(400).json({ success: false, message: 'Invalid option' });
        }

        poll.votes[index] += 1;
        await poll.save();

        // AMP forms expect a JSON response for success
        res.json({ success: true, message: 'Vote submitted!' }); 

    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error submitting vote' });
    }
});

// Start the server
app.listen(process.env.PORT || 3000, () => {
    console.log(`🚀 Server running on port ${process.env.PORT || 3000}`);
});