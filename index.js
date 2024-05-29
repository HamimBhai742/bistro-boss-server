const express = require('express')
const app = express()
require('dotenv').config()
const cors = require('cors')
const stripe = require("stripe")(process.env.PAY_API_KEY)
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000


app.use(cors())
app.use(express.json())

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.bls3tyg.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
console.log(uri);
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
        // Connect the client to the server	(optional starting in v4.7)
        // await client.connect();
        // Send a ping to confirm a successful connection
        const database = client.db("menuDB");
        const menuCollection = database.collection("menu");
        const cartCollection = database.collection("cart");
        const userCollection = database.collection("users");
        const paymentCollection = database.collection("payments");



        app.post('/jwt', async (req, res) => {
            const user = req.body
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECURE, { expiresIn: '1h' });
            res.send({ token })
        })

        const verifyToken = (req, res, next) => {
            // console.log(req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unothories access' })
            }
            const token = req.headers.authorization.split(' ')[1]
            console.log(token);
            jwt.verify(token, process.env.ACCESS_TOKEN_SECURE, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unothories access' })
                }
                req.decoded = decoded
                next()
            })

        }

        const verifyAdmin = async (req, res, next) => {
            console.log(req.decoded);
            const email = req.decoded?.email
            console.log(email);
            const query = { email: email }
            const user = await userCollection.findOne(query)
            const isAdmin = user?.role === 'admin'
            console.log(isAdmin);
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            next()
        }

        app.post('/users', async (req, res) => {
            const user = req.body
            const query = { email: user.email }
            const assigsent = await userCollection.findOne(query)
            if (assigsent) {
                return res.send({ message: 'user already created' })
            }
            const result = await userCollection.insertOne(user);
            res.send(result)
        })

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const cursor = userCollection.find();
            const result = await cursor.toArray()
            res.send(result)
        })

        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            if (email != req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }
            const query = { email: email }
            const user = await userCollection.findOne(query)
            let admin = false
            if (user) {
                admin = user?.role === 'admin'
            }
            res.send({ admin })
        })

        app.get('/users/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.findOne(query)
            res.send(result)
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) };
            const result = await userCollection.deleteOne(query);
            res.send(result)
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await userCollection.updateOne(filter, updateDoc);
            res.send(result)
        })

        app.get('/menu', async (req, res) => {
            const cursor = menuCollection.find();
            const result = await cursor.toArray()
            res.send(result)
        })

        app.post('/menu', async (req, res) => {
            const menuItem = req.body
            const result = await menuCollection.insertOne(menuItem);
            res.send(result)
        })

        app.delete('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id
            console.log(id);
            const query = { _id: new ObjectId(id) }
            const result = await menuCollection.deleteOne(query)
            res.send(result)
        })

        app.patch('/menu/:id', verifyToken, verifyAdmin, async (req, res) => {
            const menuUp = req.body
            console.log(menuUp);
            console.log(menuUp.name, menuUp.recipe);
            const id = req.params.id
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    name: menuUp?.name,
                    category: menuUp?.category,
                    price: menuUp?.price,
                    recipe: menuUp?.recipe
                },
            };
            const result = await menuCollection.updateOne(filter, updateDoc)
            res.send(result)
        })

        app.post('/cart', async (req, res) => {
            const cartItem = req.body
            console.log(cartItem);
            const result = await cartCollection.insertOne(cartItem);
            res.send(result)
        })

        app.get('/cart', async (req, res) => {
            const email = req.query.email
            console.log(email);
            const query = { userEmail: email }
            const result = await cartCollection.find(query).toArray()
            res.send(result)
        })

        app.get('/cart/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) }
            const result = await cartCollection.findOne(query)
            res.send(result)
        })

        app.delete('/cart/:id', async (req, res) => {
            const id = req.params.id
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result)
        })


        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100)
            console.log(amount);
            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"]
            });
            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });

        app.post('/payment', async (req, res) => {
            const payUser = req.body
            const payResult = await paymentCollection.insertOne(payUser)

            const query = {
                _id: {
                    $in: payUser.cartIds.map(id => new ObjectId(id))
                }
            }
            const deletRes = await cartCollection.deleteMany(query)
            res.send({ payResult, deletRes })
        })

        app.get('/payment/:email', verifyToken, async (req, res) => {
            const email = req.params.email
            const query = { email: email }
            const result = await paymentCollection.find(query).toArray()
            res.send(result)
        })

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);

app.get('/', (req, res) => {
    res.send('Hello World!')
})

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`)
})