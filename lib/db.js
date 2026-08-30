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
    query.createdAt = { $gt: typeof since === "number" || typeof since === "string" ? new Date(since) : since };
  }
  const docs = await db
    .collection("messages")
    .find(query)
    .sort({ createdAt: 1 })
    .limit(limit)
    .toArray();
  return docs;
}

// Returns messages for a room created before `before` (a Date / timestamp), oldest first.
// Used for infinite scroll pagination (loading 10 older messages).
export async function getMessagesBefore(room, before, limit = 10) {
  const db = await getDb();
  const query = { room };
  if (before) {
    query.createdAt = { $lt: typeof before === "number" || typeof before === "string" ? new Date(before) : before };
  }
  const docs = await db
    .collection("messages")
    .find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.reverse();
}

// Returns the last `limit` messages for a room, oldest first.
export async function getMessages(room, limit = 10) {
  const db = await getDb();
  const docs = await db
    .collection("messages")
    .find({ room })
    .sort({ createdAt: -1 })
    .limit(limit)
    .toArray();
  return docs.reverse();
}

export async function addMessage(room, name, text, replyTo = null) {
  const db = await getDb();
  const doc = {
    room,
    name,
    text,
    createdAt: new Date(),
  };
  if (replyTo && typeof replyTo === "object") {
    doc.replyTo = {
      id: String(replyTo.id || ""),
      name: String(replyTo.name || "").slice(0, 20),
      text: String(replyTo.text || "").slice(0, 500),
    };
  }
  const result = await db.collection("messages").insertOne(doc);
  return { ...doc, _id: result.insertedId };
}

// --- FCM push token storage -------------------------------------------
// One document per device token (a user may have several devices/tabs).
// Tokens are keyed by `token` so re-registering (e.g. after refresh)
// just updates the timestamp instead of creating duplicates.

export async function saveFcmToken(room, name, token) {
  const db = await getDb();
  await db.collection("push_tokens").updateOne(
    { token },
    { $set: { room, name, token, updatedAt: new Date() } },
    { upsert: true }
  );
}

export async function removeFcmToken(token) {
  const db = await getDb();
  await db.collection("push_tokens").deleteOne({ token });
}

export async function removeFcmTokens(tokens) {
  if (!tokens || tokens.length === 0) return;
  const db = await getDb();
  await db.collection("push_tokens").deleteMany({ token: { $in: tokens } });
}

// Returns the device tokens for a specific user in a room
export async function getTokensForUser(room, name) {
  const db = await getDb();
  const docs = await db
    .collection("push_tokens")
    .find({ room, name })
    .toArray();
  return docs.map((d) => d.token);
}

// Returns the device tokens for everyone in `room` except `excludeNames`,
// so the sender doesn't get a push notification for their own message.
export async function getTokensForRoom(room, excludeNames) {
  const db = await getDb();
  const query = { room };
  if (Array.isArray(excludeNames)) {
    query.name = { $nin: excludeNames };
  } else if (excludeNames) {
    query.name = { $ne: excludeNames };
  }
  const docs = await db
    .collection("push_tokens")
    .find(query)
    .toArray();
  return docs.map((d) => d.token);
}
