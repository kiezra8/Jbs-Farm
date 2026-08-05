const Dexie = require('dexie');

// We need to define the DB exactly as it is in the application
const db = new Dexie('JBSFarmDB');
db.version(6).stores({
  animals: 'id, tag, name, status, breed, type, dob, gender, weight, healthStatus, location, updatedAt',
  milkRecords: 'id, animalId, tag, date, session, quantity, unitPrice, totalAmount, recordedBy, syncStatus',
  healthRecords: 'id, animalId, tag, date, diagnosis, treatment, cost, veterinarian, status, syncStatus',
  breedingRecords: 'id, cowId, cowTag, sireId, breedMethod, breedDate, confirmDate, estCalvingDate, status, syncStatus',
  feedRecords: 'id, feedType, quantityUsed, date, costPerUnit, totalCost, recordedBy, syncStatus',
  finances: 'id, date, type, source, category, amount, description, reference, syncStatus',
  staff: 'id, name, role, email, phone, salary, joinDate, status, syncStatus',
  saccoMembers: 'id, name, phone, nin, category, photo, total, shares, difference, noOfShares, savings, correctBalance, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, sheetSource, financialYear, updatedAt',
  saccoShares: 'id, memberId, shareCount, updatedAt',
  saccoSavings: 'id, memberId, savingAmount, updatedAt',
  saccoInvestors: 'id, memberId, name, category, investorType, investmentPhase, marketingStrategy, investmentAmount, programAmount, balance, status, cowsPerYear, createdAt, updatedAt',
  saccoTransactions: 'id, memberId, date, type, source, category, amount, description, paymentMethod, isBanked, reference, createdAt',
  saccoYearlySavings: 'id, memberId, year, jan, feb, mar, apr, may, jun, jul, aug, sep, oct, nov, dec, updatedAt'
});

async function run() {
  const allFinances = await db.finances.toArray();
  console.log(`Total petty cash transactions: ${allFinances.length}`);
  
  const badDates = allFinances.filter(f => f.date === '2026-08-04' || f.date === '2026-08-05');
  console.log(`Transactions on 4th/5th August: ${badDates.length}`);
  badDates.forEach(f => {
    console.log(`- ID: ${f.id}, Type: ${f.type}, Category: ${f.category}, Amount: ${f.amount}, Desc: ${f.description}, Ref: ${f.reference}`);
  });
  
  db.close();
}

run().catch(console.error);
