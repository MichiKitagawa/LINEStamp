declare global {
  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV: 'development' | 'production' | 'test';
      PORT: string;
      FIREBASE_PROJECT_ID: string;
      FIREBASE_PRIVATE_KEY: string;
      FIREBASE_CLIENT_EMAIL: string;
      FIREBASE_API_KEY: string;
      FIREBASE_AUTH_DOMAIN: string;
      FIREBASE_STORAGE_BUCKET: string;
      STRIPE_SECRET_KEY: string;
      STRIPE_WEBHOOK_SECRET: string;
      STRIPE_PUBLISHABLE_KEY: string;
      API_BASE_URL: string;
      PUPPETEER_EXECUTABLE_PATH: string;
      PUPPETEER_HEADLESS: string;
      LINE_CREATORS_USERNAME: string;
      LINE_CREATORS_PASSWORD: string;
      GCP_PROJECT_ID: string;
      CLOUD_RUN_REGION: string;
      FIRESTORE_EMULATOR_HOST: string;
      FIREBASE_AUTH_EMULATOR_HOST: string;
      FIREBASE_STORAGE_EMULATOR_HOST: string;
    }
  }
}

export {}; 