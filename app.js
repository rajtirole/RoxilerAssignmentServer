const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const transactionsRoute = require('./routes/transaction')
require("dotenv").config();

const app = express();

const corsOptions = {
    origin: process.env.frontend_url, // The frontend URL
    credentials: true // Allow credentials (cookies, authorization headers, etc.)
  };
  app.use(cors(corsOptions));
app.use(bodyParser.json());
app.use('/api', transactionsRoute);
app.get('/test',(req,res)=>{
    res.status(200).json({
        success:true,
        message:'server running'
    })
})

mongoose.connect(process.env.mongodb_url).then(() => console.log('MongoDB connected'))
  .catch(err => console.log(err));

app.listen(5000, () => {
    console.log('Server is running on port 5000');
});
