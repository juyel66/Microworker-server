

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.Stripe_Secret_Kay);
const app = express();
const port = process.env.PORT || 5000;

// Middleware 
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@juyel.zm7wayi.mongodb.net/?retryWrites=true&w=majority&appName=JUYEL`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect(); // Ensure the client is connected
    console.log("Connected to MongoDB!");

    const usersCollection = client.db('MicroWorkers').collection('user');
    const addTaskCollection = client.db('MicroWorkers').collection('addTask');
    const submissionCollection = client.db('MicroWorkers').collection('submission');
    const paymentCollection = client.db('MicroWorkers').collection('Payment');
    const withdrawCollection = client.db('MicroWorkers').collection('Withdraw');



    // Submission related API 
    app.post('/submission', async (req, res) => {
      const submission = req.body;
      const result = await submissionCollection.insertOne(submission);
      res.send(result);
    });

    // app.get('/submission/:email', async (req, res) => {
    //   try {
    //     const email = req.params.email;
    //     const result = await submissionCollection.find({ email }).toArray();
    //     if (result.length === 0) {
    //       return res.status(404).send({ message: "No submissions found with this email" });
    //     }
    //     res.send(result);
    //   } catch (error) {
    //     console.error("Error fetching submission:", error);
    //     res.status(500).send({ message: "An error occurred while fetching the submission" });
    //   }
    // });


    app.get('/submission/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const result = await submissionCollection.find({ email }).toArray();
        res.send(result);
        console.log(email)
      } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).send('Server error');
      }
    });


    app.get('/submission', async (req, res) => {
      const result = await submissionCollection.find().toArray();
      res.send(result);
    });

    app.patch('/submission/:id', async(req, res) => {
      const id = req.params.id;
      const status = req.body;
      const query = {_id: new ObjectId(id)}
      const updatedDoc = {
        $set: status,
      }
      const result = await submissionCollection.updateOne(query, updatedDoc);
      res.send(result);
    })


    // Task-Creator Home States
    app.get('/task-creator/home/:email', verifyToken, verifyRole('task-creator'), async (req, res) => {
      const email = req.params.email;
      try {
        const user = await usersCollection.findOne({ email });
        const tasks = await addTaskCollection.find({ email }).toArray();
        const pendingTasks = tasks.reduce((sum, task) => sum + task.quantity, 0);
        const totalPayment = await paymentCollection.find({ email }).toArray();
        const totalPaymentSum = totalPayment.reduce((sum, payment) => sum + payment.amount, 0);

        res.send({
          coin: user.coin,
          pendingTasks,
          totalPayment: totalPaymentSum,
        });
      } catch (error) {
        console.error('Error fetching task-creator home state:', error);
        res.status(500).send({ message: 'Internal server error' });
      }
    });

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('MicroWorker server is running');
});

app.listen(port, () => {
  console.log(`MicroWorker server is running on port:${port}`);
});

