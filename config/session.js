const session = require("express-session");
const flash = require("connect-flash");
const connectMongo = require("connect-mongo");

function resolveMongoStoreFactory() {
  return (
    connectMongo.default ||
    connectMongo.MongoStore ||
    connectMongo
  );
}

function createSessionStore() {
  const isProduction = process.env.NODE_ENV === "production";
  const mongoUrl = process.env.MONGO_URI;

  if (!mongoUrl) {
    if (isProduction) {
      throw new Error("MONGO_URI env var is required in production for session storage.");
    }
    console.warn("⚠️ MONGO_URI is missing. Falling back to in-memory session store for development.");
    return null;
  }

  const MongoStore = resolveMongoStoreFactory();

  const storeConfig = {
    mongoUrl,
    collectionName: "sessions",
    ttl: 7 * 24 * 60 * 60,
    autoRemove: "native",
    stringify: false,
  };

  const store =
    typeof MongoStore.create === "function"
      ? MongoStore.create(storeConfig)
      : new MongoStore(storeConfig);

  store.on("error", (error) => {
    console.error("❌ Session store error:", error.message);
  });

  return store;
}

function configureSession(app) {
  const isProduction = process.env.NODE_ENV === "production";
  const sessionSecret = process.env.SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error("SESSION_SECRET env var is required.");
  }

  const store = createSessionStore();

  if (isProduction) {
    app.set("trust proxy", 1);
  }

  const sessionOptions = {
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    ...(store ? { store } : {}),
    cookie: {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
    },
  };

  app.use(session(sessionOptions));
  app.use(flash());
}

module.exports = configureSession;
