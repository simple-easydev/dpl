#!/usr/bin/env node

/**
 * Database Configuration Validator
 *
 * This script validates that the correct Supabase credentials are configured
 * and provides tools to restore them if they've been changed.
 */

const fs = require('fs');
const path = require('path');

// CORRECT production credentials
const CORRECT_SUPABASE_URL = 'https://cqztylidsbekbbrkusxg.supabase.co';
const CORRECT_PROJECT_ID = 'cqztylidsbekbbrkusxg';


const ENV_FILE = path.join(__dirname, '..', '.env');
const ENV_EXAMPLE_FILE = path.join(__dirname, '..', '.env.example');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }

  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  const env = {};

  for (const line of lines) {
    const match = line.match(/^VITE_SUPABASE_URL=(.+)$/);
    if (match) {
      env.VITE_SUPABASE_URL = match[1].trim();
    }
    const keyMatch = line.match(/^VITE_SUPABASE_ANON_KEY=(.+)$/);
    if (keyMatch) {
      env.VITE_SUPABASE_ANON_KEY = keyMatch[1].trim();
    }
  }

  return env;
}

function validateConfig() {
  console.log('\n🔍 Validating Supabase configuration...\n');

  const env = readEnvFile(ENV_FILE);

  if (!env) {
    console.error('❌ ERROR: .env file not found!');
    console.log('\n💡 To fix: Copy .env.example to .env');
    process.exit(1);
  }

  if (!env.VITE_SUPABASE_URL) {
    console.error('❌ ERROR: VITE_SUPABASE_URL not found in .env!');
    process.exit(1);
  }

  if (!env.VITE_SUPABASE_ANON_KEY) {
    console.error('❌ ERROR: VITE_SUPABASE_ANON_KEY not found in .env!');
    process.exit(1);
  }

  // Check if using correct credentials
  if (!env.VITE_SUPABASE_URL.includes(CORRECT_PROJECT_ID)) {
    console.error('❌ ERROR: Supabase URL does not match expected project!');
    console.error(`   Current URL: ${env.VITE_SUPABASE_URL}`);
    console.error(`   Expected Project: ${CORRECT_PROJECT_ID}`);
    console.error('');
    console.error('✅ Correct URL: ' + CORRECT_SUPABASE_URL);
    console.error('');
    console.error('💡 To fix: Run "npm run fix-db-config"');
    process.exit(1);
  }

  // All good!
  console.log('✅ Supabase URL: ' + env.VITE_SUPABASE_URL);
  console.log('✅ Project ID: ' + CORRECT_PROJECT_ID);
  console.log('✅ Configuration is CORRECT!');
  console.log('');
}

function restoreConfig() {
  console.log('\n🔧 Restoring correct Supabase configuration...\n');

  const example = readEnvFile(ENV_EXAMPLE_FILE);

  if (!example) {
    console.error('❌ ERROR: .env.example file not found!');
    console.error('   Cannot restore configuration without template file.');
    process.exit(1);
  }

  if (!example.VITE_SUPABASE_URL || !example.VITE_SUPABASE_ANON_KEY) {
    console.error('❌ ERROR: .env.example is missing required Supabase credentials!');
    process.exit(1);
  }

  // Read current .env
  let envContent = '';
  if (fs.existsSync(ENV_FILE)) {
    envContent = fs.readFileSync(ENV_FILE, 'utf8');
  }

  // Replace the Supabase credentials
  const lines = envContent.split('\n');
  const newLines = [];
  let foundUrl = false;
  let foundKey = false;

  for (const line of lines) {
    if (line.startsWith('VITE_SUPABASE_URL=')) {
      newLines.push(`VITE_SUPABASE_URL=${example.VITE_SUPABASE_URL}`);
      foundUrl = true;
    } else if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) {
      newLines.push(`VITE_SUPABASE_ANON_KEY=${example.VITE_SUPABASE_ANON_KEY}`);
      foundKey = true;
    } else {
      newLines.push(line);
    }
  }

  // If not found, read from example file
  if (!foundUrl || !foundKey) {
    console.log('⚠️  Credentials not found in .env, copying entire .env.example');
    fs.copyFileSync(ENV_EXAMPLE_FILE, ENV_FILE);
  } else {
    fs.writeFileSync(ENV_FILE, newLines.join('\n'));
  }

  console.log('✅ Configuration restored successfully!');
  console.log('✅ Supabase URL: ' + example.VITE_SUPABASE_URL);
  console.log('');
  console.log('💡 You can now run: npm run dev');
  console.log('');
}

// Main execution
const command = process.argv[2];

if (command === 'restore' || command === 'fix') {
  restoreConfig();
  validateConfig();
} else {
  validateConfig();
}
