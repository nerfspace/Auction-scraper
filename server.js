'use strict';

const crypto = require('crypto');
const mongoose = require('mongoose');
mongoose.connect('mongodb://<username>:<password>@localhost:27017/<dbname>', { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected!'))
    .catch(err => console.error('MongoDB connection error:', err));

const express = require('express');
// ...rest of your server code
