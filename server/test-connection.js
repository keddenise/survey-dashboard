const { MongoClient } = require('mongodb');

async function main() {
  const client = new MongoClient(process.env.MONGODB_URI);
  await client.connect();
  await client.db('admin').command({ ping: 1 });
  console.log('Connected to Atlas!');
  await client.close();
}

main().catch((err) => console.error('Connection failed:', err.message));