const express = require("express");
const db = require("./database");

const app = express();
app.use(express.json());
app.use(express.static("public"));

let trainingData = [];

app.get("/flights", (req, res) => {
    res.json(db.getFlights());
});

app.post("/add-flight", (req, res) => {
    const { from, to, time } = req.body;
    db.addFlight(from, to, time);
    res.sendStatus(200);
});

app.post("/train", (req, res) => {
    trainingData.push(req.body.text);
    res.sendStatus(200);
});

app.get("/train", (req, res) => {
    res.json(trainingData);
});

app.listen(3000, () => {
    console.log("🌐 Web running on http://localhost:3000");
});