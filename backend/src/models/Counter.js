const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. 'travelRequest'
  seq: { type: Number, default: 10000 },
});

const Counter = mongoose.model('Counter', counterSchema);

async function nextSequence(key) {
  const counter = await Counter.findOneAndUpdate(
    { _id: key },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return counter.seq;
}

module.exports = Counter;
module.exports.nextSequence = nextSequence;
