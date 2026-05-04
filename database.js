const fs = require("fs");

const DB_PATH = "./database.json";

function read() {
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
}

function save(data) {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// =========================
// FLIGHTS
// =========================
function addFlight(flight) {
    const db = read();
    db.flights.push(flight);
    save(db);
}

function getFlights() {
    return read().flights;
}

// =========================
// INFO
// =========================
function addInfo(info) {
    const db = read();
    db.info.push(info);
    save(db);
}

function getInfo() {
    return read().info;
}

// =========================
// EXPORT (สำคัญมาก)
// =========================
module.exports = {
    addFlight,
    getFlights,
    addInfo,
    getInfo
};