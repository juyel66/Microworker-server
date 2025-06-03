

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

    // Middleware 
    const verifyToken = (req, res, next) => {
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'unauthorized access' });
      }
      const token = req.headers.authorization.split(' ')[1];
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(400).send({ message: 'invalid token' });
        }
        req.decoded = decoded;
        next();
      });
    };

    const verifyRole = (role) => {
      return async (req, res, next) => {
        const email = req.decoded.email;
        const user = await usersCollection.findOne({ email });
        if (user?.role !== role) {
          return res.status(403).send({ message: 'forbidden access' });
        }
        next();
      };
    };

    // JWT related API 
    app.post('/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
      res.send({ token });
    });





















    

    // Payment intent 
    app.post('/create-payment-intent', async (req, res) => {
      const { price } = req.body;
      try {
        const paymentIntent = await stripe.paymentIntents.create({
          amount: price * 100, // amount in cents
          currency: 'usd',
        });
        res.send({ clientSecret: paymentIntent.client_secret });
      } catch (error) {
        res.status(500).send({ error: error.message });
      }
    });


    app.post('/payment', async (req, res) => {
      try {
        const {email,price,transactionId,date,status} = req.body;
        // console.log('payment info',paymentInfo);
        let coin = 0;
        if(price === 1){
          coin= 10;
        }
        else if(price === 9){
          coin = 100;
        }
        else if(price === 19){
          coin = 500
        }
        else if ( price === 39){
          coin = 1000
        }
        else{
          return res.send({message: 'invalid amount'})
        }
         const paymentInfo = {
          email,transactionId,status,date, price
         }
        const result = await paymentCollection.insertOne(paymentInfo);
        const query = {email: email} 
        const updatedDoc = {
          $inc: {
            coin: coin
          }
        } 
        const updatedCoin =await usersCollection.updateOne(query,updatedDoc)
        res.send({result,updatedDoc})
        // res.status(200).json({ success: true, message: "Payment saved successfully" });
      } catch (error) {
        console.error('Error saving payment to database:', error);
        res.status(500).json({ success: false, message: "Failed to save payment to database" });
      }
    });



    app.get('/payment/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const result = await paymentCollection.find({ email }).toArray();
        res.send(result);
      } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).send('Server error');
      }
    });

    // User related API 
    app.post('/users', async (req, res) => {
      const { name, photoURL, email, role, password } = req.body;
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        res.send({ message: 'user already exists', insertedId: null });
        return;
      }
      const coin = role === 'worker' ? 10 : 50;
      const newUser = { name, email, photoURL, role, password, coin };
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    app.get('/users/:email', verifyToken, async (req, res) => {
      const email = req.params.email;
      const result = await usersCollection.findOne({ email });
      res.send(result);
    });

    app.get('/users', verifyToken, verifyRole('admin'), async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.get('/user', async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    

    app.delete('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
      const id = req.params.id;
      const result = await usersCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.patch('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
      try {
        const id = req.params.id;
        const newRole = req.body.role;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: newRole } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.status(200).json({ modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/users/admin/:email', verifyToken, verifyRole('admin'), async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: 'forbidden access' });
        return;
      }
      const user = await usersCollection.findOne({ email });
      const admin = user ? user.role === 'admin' : false;
      res.send({ admin });
    });
    

    // approve and reject related api 
    // app.post('/submission', async(req, res) =>{
    //   const approve = req.body;
      // const result = await 
    // })

    // withdraw related api 
    app.post('/withdraw', async(req,res) => {
      const withdraw = req.body;
      const result = await withdrawCollection.insertOne(withdraw);
      res.send(result)
    })

    app.get('/withdraw', async(req, res) => {
      const result = await withdrawCollection.find().toArray();
      res.send(result);
    })

    app.delete('/withdraw/:id', async (req, res) => {
      const id = req.params.id;
      const result = await withdrawCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.patch('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
      try {
        const id = req.params.id;
        const newRole = req.body.role;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: newRole } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.status(200).json({ modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/users/admin/:email', verifyToken, verifyRole('admin'), async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: 'forbidden access' });
        return;
      }
      const user = await usersCollection.findOne({ email });
      const admin = user ? user.role === 'admin' : false;
      res.send({ admin });
    });
    

    // approve and reject related api 
    // app.post('/submission', async(req, res) =>{
    //   const approve = req.body;
      // const result = await 
    // })

    // withdraw related api 
    app.post('/withdraw', async(req,res) => {
      const withdraw = req.body;
      const result = await withdrawCollection.insertOne(withdraw);
      res.send(result)
    })

    app.get('/withdraw', async(req, res) => {
      const result = await withdrawCollection.find().toArray();
      res.send(result);
    })

    app.delete('/withdraw/:id', async (req, res) => {
      const id = req.params.id;
      const result = await withdrawCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.patch('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
      try {
        const id = req.params.id;
        const newRole = req.body.role;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: newRole } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.status(200).json({ modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/users/admin/:email', verifyToken, verifyRole('admin'), async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: 'forbidden access' });
        return;
      }
      const user = await usersCollection.findOne({ email });
      const admin = user ? user.role === 'admin' : false;
      res.send({ admin });
    });
    

    // approve and reject related api 
    // app.post('/submission', async(req, res) =>{
    //   const approve = req.body;
      // const result = await 
    // })

    // withdraw related api 
    app.post('/withdraw', async(req,res) => {
      const withdraw = req.body;
      const result = await withdrawCollection.insertOne(withdraw);
      res.send(result)
    })

    app.get('/withdraw', async(req, res) => {
      const result = await withdrawCollection.find().toArray();
      res.send(result);
    })

    app.delete('/withdraw/:id', async (req, res) => {
      const id = req.params.id;
      const result = await withdrawCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.patch('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
      try {
        const id = req.params.id;
        const newRole = req.body.role;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: newRole } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.status(200).json({ modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/users/admin/:email', verifyToken, verifyRole('admin'), async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: 'forbidden access' });
        return;
      }
      const user = await usersCollection.findOne({ email });
      const admin = user ? user.role === 'admin' : false;
      res.send({ admin });
    });
    

    // approve and reject related api 
    // app.post('/submission', async(req, res) =>{
    //   const approve = req.body;
      // const result = await 
    // })

    // withdraw related api 
    app.post('/withdraw', async(req,res) => {
      const withdraw = req.body;
      const result = await withdrawCollection.insertOne(withdraw);
      res.send(result)
    })

    app.get('/withdraw', async(req, res) => {
      const result = await withdrawCollection.find().toArray();
      res.send(result);
    })

    app.delete('/withdraw/:id', async (req, res) => {
      const id = req.params.id;
      const result = await withdrawCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.patch('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
      try {
        const id = req.params.id;
        const newRole = req.body.role;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: newRole } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.status(200).json({ modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/users/admin/:email', verifyToken, verifyRole('admin'), async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: 'forbidden access' });
        return;
      }
      const user = await usersCollection.findOne({ email });
      const admin = user ? user.role === 'admin' : false;
      res.send({ admin });
    });
    

    // approve and reject related api 
    // app.post('/submission', async(req, res) =>{
    //   const approve = req.body;
      // const result = await 
    // })

    // withdraw related api 
    app.post('/withdraw', async(req,res) => {
      const withdraw = req.body;
      const result = await withdrawCollection.insertOne(withdraw);
      res.send(result)
    })

    app.get('/withdraw', async(req, res) => {
      const result = await withdrawCollection.find().toArray();
      res.send(result);
    })

    app.delete('/withdraw/:id', async (req, res) => {
      const id = req.params.id;
      const result = await withdrawCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.patch('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
      try {
        const id = req.params.id;
        const newRole = req.body.role;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: newRole } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.status(200).json({ modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/users/admin/:email', verifyToken, verifyRole('admin'), async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: 'forbidden access' });
        return;
      }
      const user = await usersCollection.findOne({ email });
      const admin = user ? user.role === 'admin' : false;
      res.send({ admin });
    });
    

    // approve and reject related api 
    // app.post('/submission', async(req, res) =>{
    //   const approve = req.body;
      // const result = await 
    // })

    // withdraw related api 
    app.post('/withdraw', async(req,res) => {
      const withdraw = req.body;
      const result = await withdrawCollection.insertOne(withdraw);
      res.send(result)
    })

    app.get('/withdraw', async(req, res) => {
      const result = await withdrawCollection.find().toArray();
      res.send(result);
    })

    app.delete('/withdraw/:id', async (req, res) => {
      const id = req.params.id;
      const result = await withdrawCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.patch('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
      try {
        const id = req.params.id;
        const newRole = req.body.role;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: newRole } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.status(200).json({ modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });

    app.get('/users/admin/:email', verifyToken, verifyRole('admin'), async (req, res) => {
      const email = req.params.email;
      if (email !== req.decoded.email) {
        res.status(403).send({ message: 'forbidden access' });
        return;
      }
      const user = await usersCollection.findOne({ email });
      const admin = user ? user.role === 'admin' : false;
      res.send({ admin });
    });
    

    // approve and reject related api 
    // app.post('/submission', async(req, res) =>{
    //   const approve = req.body;
      // const result = await 
    // })

    // withdraw related api 
    app.post('/withdraw', async(req,res) => {
      const withdraw = req.body;
      const result = await withdrawCollection.insertOne(withdraw);
      res.send(result)
    })

    app.get('/withdraw', async(req, res) => {
      const result = await withdrawCollection.find().toArray();
      res.send(result);
    })

    app.delete('/withdraw/:id', async (req, res) => {
      const id = req.params.id;
      const result = await withdrawCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });
    app.patch('/users/:id', verifyToken, verifyRole('admin'), async (req, res) => {
      try {
        const id = req.params.id;
        const newRole = req.body.role;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = { $set: { role: newRole } };
        const result = await usersCollection.updateOne(filter, updateDoc);
        res.status(200).json({ modifiedCount: result.modifiedCount });
      } catch (error) {
        console.error('Error updating user role:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    });



    // Add new task
    // app.post('/addTask', async (req, res) => {
    //   const task = req.body;
    //   console.log("Received task:", task);
    //   const user = await usersCollection.findOne({ email: task.email });
    //   const taskCost = task.quantity * task.amount;

    //   if (user.coin < taskCost) {
    //     return res.status(400).send({ message: 'Not enough coins. Please purchase more coins.' });
    //   }


      

    //   // Add the task to the database
    //   const result = await addTaskCollection.insertOne(task);
    //   console.log("Task insert result:", result);

    //   // Deduct coins from the user
    //   await usersCollection.updateOne(
    //     { email: task.email },
    //     { $inc: { coin: -taskCost } }
    //   );

    //   res.send(result);
    // });




    // app.post('/addTask', async(req, res) =>{
    //   const task = req.body;
    //   const result = await addTaskCollection.insertOne(task)
    //   res.send(result)
    // })


    app.post('/addTask', async (req, res) => {
      try {
        const { email, totalAmount } = req.body;
        const user = await usersCollection.findOne({ email: email });
    
        if (!user || user.coin < totalAmount) {
          return res.status(400).json({ success: false, message: "Not enough coins available" });
        }
    
        const query = { email: email };
        const updateDoc = {
          $inc: {
            coin: -totalAmount
          }
        };
    
        const updatedCoin = await usersCollection.updateOne(query, updateDoc);
        const result = await addTaskCollection.insertOne(req.body)
        res.send({updatedCoin,result});
      } catch (error) {
        console.error('Error updating coin:', error);
        res.status(500).json({ success: false, message: "Failed to update coin" });
      }
    });
    
    



    


    app.get('/addTask', async (req, res) => {
      const result = await addTaskCollection.find().toArray();
      res.send(result);
    });

    app.get('/addTask/:id', async (req, res) => {
      const id = req.params.id;
      const result = await addTaskCollection.findOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.delete('/addTask/:id', async (req, res) => {
      const id = req.params.id;
      const result = await addTaskCollection.deleteOne({ _id: new ObjectId(id) });
      res.send(result);
    });

    app.get('/tasks/:email', async (req, res) => {
      try {
        const email = req.params.email;
        const result = await addTaskCollection.find({ email }).toArray();
        res.send(result);
        console.log(email)
      } catch (error) {
        console.error('Error fetching tasks:', error);
        res.status(500).send('Server error');
      }
    });

    app.patch('/tasks/:id', async (req, res) => {
      const task = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          title: task.title,
          details: task.details,
          SubmissionInfo: task.SubmissionInfo,
        }
      };
      const result = await addTaskCollection.updateOne(filter, updatedDoc);
      res.send(result);
    });

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

