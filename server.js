'use strict';

//import required modules
const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const client = require('prom-client');

//define server setup constants
const PORT = 8080;
const HOST = '0.0.0.0';

//monbodb connection string
const DB_URI = process.env.MONGO_URI || 'mongodb://mongouser:securepass@mongo-service:27017';
const DB_NAME = 'myapp';

//mongodb retry delay.  was experiencing issues where server was ready before monbodb and connection was failing
const RETRY_DELAY = 2000;

//create app
const app = express();
app.use(express.json());

//prometheus metric
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics();

//collect data
app.get('/metrics', async (req, res) => {
    res.set('Content-Type', client.register.contentType);
    res.end(await client.register.metrics());
  });

//db reference
let db;

//connect to mongodb.  keeps retrying until database is available
async function connectWithRetry() {
  try {
    const client = await MongoClient.connect(DB_URI, { useUnifiedTopology: true });
    db = client.db(DB_NAME);

    //log connection to db
    console.log("Connected to MongoDB");

    app.get('/', (req, res) => {
      res.send('Hello World with MongoDB!');
    });

    //test route that inserts document and counts total documents
    app.get('/', (req, res) => {
        res.send('MongoDB with CRUD!');
      });
    
    //CRUD - create
    app.post('/items', async (req, res) => {
        try {
          const result = await db.collection('items').insertOne(req.body);
          res.status(201).send(result);
        } catch (err) {
          res.status(500).send({ error: err.message });
        }
      });
  
      //CRUD - read
      app.get('/items', async (req, res) => {
        try {
          const items = await db.collection('items').find().toArray();
          res.send(items);
        } catch (err) {
          res.status(500).send({ error: err.message });
        }
      });
  
      //CRUD - update
      app.put('/items/:id', async (req, res) => {
        try {
          const result = await db.collection('items').updateOne(
            { _id: new ObjectId(req.params.id) },
            { $set: req.body }
          );
          res.send(result);
        } catch (err) {
          res.status(500).send({ error: err.message });
        }
      });
  
      //CRUD - delete
      app.delete('/items/:id', async (req, res) => {
        try {
          const result = await db.collection('items').deleteOne(
            { _id: new ObjectId(req.params.id) }
          );
          res.send(result);
        } catch (err) {
          res.status(500).send({ error: err.message });
        }
      });

    //start server once connected to db
    app.listen(PORT, HOST, () => {
      console.log(`Server running on http://${HOST}:${PORT}`);
    });

  } catch (err) {
    //connection fail and retry
    console.error("MongoDB connection failed, retrying in 2 seconds...", err.message);
    setTimeout(connectWithRetry, RETRY_DELAY);
  }
}

connectWithRetry();
