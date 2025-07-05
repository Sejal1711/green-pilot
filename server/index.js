require("dotenv").config();
const app= require("./app");
const mongoose= require("mongoose");
require("dotenv").config();

const PORT=process.env.PORT || 5050;
mongoose.connect(process.env.MONGO_URI)
.then(()=>{
    console.log("Connected to MongoDB");
    app.listen(PORT, ()=>{
        console.log(`Server running on http://localhost:${PORT}`);
    });
})
.catch((err)=> {
    console.error("MongoDB connection error", err.message);
})