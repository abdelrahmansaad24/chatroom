import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || "chatrooms";

if (!uri) {
  throw new Error("Missing MONGODB_URI environment variable");
}

// Cache the client across hot-reloads in dev and across invocations in prod
// so we don't open a new connection on every request.
let cachedClientPromise = global._mongoClientPromise;

if (!cachedClientPromise) {
  const client = new MongoClient(uri);
  cachedClientPromise = client.connect();
  global._mongoClientPromise = cachedClientPromise;
}

async function getDb() {
  const client = await cachedClientPromise;
  return client.db(dbName);
}

// Returns messages for a room created after `since` (a Date), oldest first.
// Used by the JSON API (e.g. the J2ME client) for lightweight polling.
export async function getMessagesSince(room, since, limit = 50) {
  const db = await getDb();
  const query = { room };
  if (since) {
    query.createdAt = { $gt: since };
  }
  const docs = await db
    .collection("messages")
    .find(query)
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
  return docs;
}

// Returns the last `limit` messages for a room, oldest first.
export async function getMessages(room, limit = 50) {
  const db = await getDb();
  const docs = await db
    .collection("messages")
    .find({ room })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.reverse();
}

export async function addMessage(room, name, text) {
  const db = await getDb();
  await db.collection("messages").insertOne({
    room,
    name,
    text,
    createdAt: new Date(),
  });
}
