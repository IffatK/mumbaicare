/** Run the ETL from the command line: npm run etl */
import mongoose from 'mongoose';
import { connectDb } from '../db';
import { runEtl } from '../services/etl';
connectDb().then(runEtl).then(r => { console.log(JSON.stringify(r, null, 2)); return mongoose.disconnect(); }).catch(e => { console.error(e.message); process.exit(1); });
