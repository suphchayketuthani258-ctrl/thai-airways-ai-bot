const fs = require("fs");

const DB_PATH = "./database.json";

function safeRead() {
    try {
        return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    } catch (e) {
        return { flights: [], info: [] };
    }
}

function getFlights() {
    return safeRead().flights || [];
}

function getInfo() {
    return safeRead().info || [];
}

module.exports = {
    getFlights,
    getInfo
};