const express = require("express");
const body = require("body-parser");
const db = require("./database");

const app = express();
app.use(body.json());

// ================= FLIGHT =================
app.post("/flight/add",(req,res)=>{
db.addFlight(req.body);
res.json({ok:true});
});

app.get("/flight",(req,res)=>{
res.json(db.getFlights());
});

// ================= INFO =================
app.post("/info/add",(req,res)=>{
db.addInfo(req.body);
res.json({ok:true});
});

app.get("/info",(req,res)=>{
res.json(db.getInfo());
});

// ================= ANNOUNCE =================
app.post("/announce",(req,res)=>{
db.addAnnounce(req.body.text);
res.json({ok:true});
});

app.listen(4000,()=>console.log("Dashboard ON"));