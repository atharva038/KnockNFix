const mongoose = require("mongoose");

let listenersAttached = false;
let shutdownHandlerAttached = false;

function attachConnectionListeners() {
  if (listenersAttached) {
    return;
  }

  mongoose.connection.on("connected", () => {
    console.log("✅ Mongoose connected to MongoDB Atlas");
  });

  mongoose.connection.on("error", (err) => {
    console.error("❌ Mongoose connection error:", err.message);
  });

  mongoose.connection.on("disconnected", () => {
    console.log("⚠️ Mongoose disconnected from MongoDB Atlas");
  });

  mongoose.connection.on("reconnected", () => {
    console.log("✅ Mongoose reconnected to MongoDB Atlas");
  });

  listenersAttached = true;
}

function attachShutdownHandler() {
  if (shutdownHandlerAttached) {
    return;
  }

  process.on("SIGINT", async () => {
    try {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log("📴 MongoDB connection closed through app termination");
      }
      process.exit(0);
    } catch (err) {
      console.error("Error closing MongoDB connection:", err);
      process.exit(1);
    }
  });

  shutdownHandlerAttached = true;
}

async function connectDatabase() {
  attachConnectionListeners();
  attachShutdownHandler();

  try {
    await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
      maxPoolSize: 10,
      minPoolSize: 5,
      maxIdleTimeMS: 30000,
    });
    console.log("✅ Connected to MongoDB Atlas");
  } catch (error) {
    console.error("❌ MongoDB Atlas connection error:", error.message);
    console.error("Full error:", error);
    console.error("Connection string exists:", !!process.env.MONGO_URI);

    if (process.env.NODE_ENV === "development") {
      console.log("⚠️ Continuing in development mode without database...");
      console.log(
        "⚠️ Database operations will fail until connection is restored"
      );
    } else {
      process.exit(1);
    }
  }
}

function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

function getDatabaseStatus() {
  const states = {
    0: "Disconnected",
    1: "Connected",
    2: "Connecting",
    3: "Disconnecting",
  };

  return {
    status: states[mongoose.connection.readyState],
    state: mongoose.connection.readyState,
    uri: process.env.MONGO_URI ? "URI configured" : "URI missing",
    timestamp: new Date().toISOString(),
  };
}

module.exports = {
  connectDatabase,
  isDatabaseConnected,
  getDatabaseStatus,
  mongoose,
};
