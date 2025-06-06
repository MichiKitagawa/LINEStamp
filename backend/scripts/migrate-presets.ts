import { firestore } from '../src/utils/firebaseAdmin';
import { DEFAULT_PRESETS } from '../src/types/images';

async function migratePresets() {
  console.log('Starting one-time preset migration...');
  
  const batch = firestore.batch();
  
  for (const [presetId, defaultData] of Object.entries(DEFAULT_PRESETS)) {
    const presetRef = firestore.collection('presets').doc(presetId);
    
    batch.update(presetRef, {
      'config.prompts': defaultData.config.prompts
    });
    
    console.log(`Updated preset: ${presetId}`);
  }
  
  await batch.commit();
  console.log('Migration completed!');
  process.exit(0);
}

migratePresets().catch(console.error); 