const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

const DB_PATH = "./database.json";

function read() {
    return JSON.parse(fs.readFileSync(DB_PATH));
}

function save(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// =============================
// ADD FLIGHT
// =============================
app.post("/flight/add", (req, res) => {
    const db = read();

    db.flights.push({
        id: req.body.id,
        from: req.body.from,
        to: req.body.to,
        time: req.body.time
    });

    save(db);

    res.json({ success: true });
});

// =============================
// GET FLIGHTS
// =============================
app.get("/flight", (req, res) => {
    res.json(read().flights);
});

app.listen(4000, () => {
    console.log("Dashboard running http://localhost:4000");
});