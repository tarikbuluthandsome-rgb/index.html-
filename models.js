const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username:    { type: String, required: true, unique: true, trim: true, maxlength: 30 },
    email:       { type: String, required: true, unique: true, trim: true, lowercase: true, maxlength: 120 },
    password:    { type: String, required: true },
    fullName:    { type: String, required: true, maxlength: 80 },
    role:        { type: String, enum: ['master','subscriber'], default: 'subscriber' },
    status:      { type: String, enum: ['pending','active','passive','blocked','banned'], default: 'pending' },
    banReason:   { type: String, default: null },
    banDate:     { type: Date,   default: null },
    violationCount: { type: Number, default: 0 },
    lastLogin:   { type: Date,   default: null },
    requestDate: { type: Date,   default: Date.now },
    approvedDate:{ type: Date,   default: null },
}, { timestamps: true });

const dilekceSchema = new mongoose.Schema({
    userId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true },
    title:    { type: String, required: true, maxlength: 200 },
    content:  { type: String, required: true },
    davaType: { type: String, default: '' },
}, { timestamps: true });

const User    = mongoose.models.User    || mongoose.model('User',    userSchema);
const Dilekce = mongoose.models.Dilekce || mongoose.model('Dilekce', dilekceSchema);

module.exports = { User, Dilekce };
