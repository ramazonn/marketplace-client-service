/**
 * One-time script: create home feed index and backfill randomBucket (0..49)
 * for products where randomBucket is missing or 0.
 *
 * Run manually with mongosh:
 *   mongosh "mongodb://localhost:27017/your_db_name" --file scripts/backfill-product-random-bucket.mongo.js
 *
 * Or set DB name below and run:
 *   mongosh "mongodb://..." --file scripts/backfill-product-random-bucket.mongo.js
 */

// Optionally switch DB (if not already set by connection string)
// db = db.getSiblingDB('your_db_name');

const coll = db.products;

// 1. Create index for home feed (status, randomBucket, createdAt)
print('Creating index: { status: 1, randomBucket: 1, createdAt: -1 }');
coll.createIndex(
  { status: 1, randomBucket: 1, createdAt: -1 },
  { name: 'status_1_randomBucket_1_createdAt_-1' }
);
print('Index created.');

// 2. Backfill: set randomBucket to random 0..49 where missing or 0
const filter = {
  $or: [
    { randomBucket: { $exists: false } },
    { randomBucket: null },
    { randomBucket: 0 },
  ],
};
const updatePipeline = [
  {
    $set: {
      randomBucket: { $floor: { $multiply: [{ $rand: {} }, 50] } },
    },
  },
];

print('Running backfill update...');
const result = coll.updateMany(filter, updatePipeline);
print('Backfill done. Matched: ' + result.matchedCount + ', Modified: ' + result.modifiedCount);
