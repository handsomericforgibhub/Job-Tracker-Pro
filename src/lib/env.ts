/**
 * Environment Variable Validation
 * 
 * ADR Phase 1: Infrastructure Conventions Compliance
 * This module validates required environment variables at application startup
 * to ensure proper configuration and early error detection.
 */

// =============================================
// Required Environment Variables
// =============================================

const REQUIRED_ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY'
] as const;

const OPTIONAL_ENV_VARS = [
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_ENVIRONMENT',
  'DATABASE_URL',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'GOOGLE_MAPS_API_KEY',
  'WEBHOOK_SECRET',
  'LOG_LEVEL'
] as const;

// =============================================
// Type Definitions
// =============================================

export interface EnvironmentConfig {
  supabase: {
    url: string;
    anonKey: string;
    serviceRoleKey: string;
  };
  app: {
    url: string;
    environment: 'development' | 'staging' | 'production';
  };
  database: {
    url?: string;
  };
  smtp: {
    host?: string;
    port?: string;
    user?: string;
    password?: string;
  };
  integrations: {
    googleMapsApiKey?: string;
    webhookSecret?: string;
  };
  logging: {
    level: 'debug' | 'info' | 'warn' | 'error';
  };
}

export interface ValidationResult {
  isValid: boolean;
  missingVars: string[];
  invalidVars: { name: string; reason: string }[];
  warnings: string[];
}

// =============================================
// Validation Functions
// =============================================

/**
 * Validates that all required environment variables are present and valid
 */
export function validateEnvironment(): ValidationResult {
  const missingVars: string[] = [];
  const invalidVars: { name: string; reason: string }[] = [];
  const warnings: string[] = [];

  // Check required variables
  for (const varName of REQUIRED_ENV_VARS) {
    const value = process.env[varName];
    
    if (!value) {
      missingVars.push(varName);
      continue;
    }

    // Validate specific variables
    switch (varName) {
      case 'NEXT_PUBLIC_SUPABASE_URL':
        if (!isValidUrl(value)) {
          invalidVars.push({
            name: varName,
            reason: 'Must be a valid URL'
          });
        }
        break;
      
      case 'NEXT_PUBLIC_SUPABASE_ANON_KEY':
      case 'SUPABASE_SERVICE_ROLE_KEY':
        if (value.length < 100) {
          invalidVars.push({
            name: varName,
            reason: 'Appears to be too short for a valid Supabase key'
          });
        }
        break;
    }
  }

  // Check optional variables and provide warnings for common issues
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (appUrl && !isValidUrl(appUrl)) {
    warnings.push('NEXT_PUBLIC_APP_URL is set but appears to be an invalid URL');
  }

  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT;
  if (environment && !['development', 'staging', 'production'].includes(environment)) {
    warnings.push('NEXT_PUBLIC_ENVIRONMENT should be one of: development, staging, production');
  }

  const smtpPort = process.env.SMTP_PORT;
  if (smtpPort && (isNaN(parseInt(smtpPort)) || parseInt(smtpPort) < 1 || parseInt(smtpPort) > 65535)) {
    warnings.push('SMTP_PORT should be a valid port number (1-65535)');
  }

  const logLevel = process.env.LOG_LEVEL;
  if (logLevel && !['debug', 'info', 'warn', 'error'].includes(logLevel.toLowerCase())) {
    warnings.push('LOG_LEVEL should be one of: debug, info, warn, error');
  }

  return {
    isValid: missingVars.length === 0 && invalidVars.length === 0,
    missingVars,
    invalidVars,
    warnings
  };
}

/**
 * Gets validated environment configuration
 * Throws an error if validation fails
 */
export function getEnvironmentConfig(): EnvironmentConfig {
  const validation = validateEnvironment();
  
  if (!validation.isValid) {
    const errorMessage = createValidationErrorMessage(validation);
    throw new Error(errorMessage);
  }

  // Log warnings in development
  if (validation.warnings.length > 0 && process.env.NODE_ENV === 'development') {
    console.warn('Environment configuration warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  return {
    supabase: {
      url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    },
    app: {
      url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      environment: (process.env.NEXT_PUBLIC_ENVIRONMENT as any) || 'development',
    },
    database: {
      url: process.env.DATABASE_URL,
    },
    smtp: {
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      user: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
    },
    integrations: {
      googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
      webhookSecret: process.env.WEBHOOK_SECRET,
    },
    logging: {
      level: (process.env.LOG_LEVEL?.toLowerCase() as any) || 'info',
    },
  };
}

/**
 * Validates environment at startup and throws if invalid
 * This should be called early in the application lifecycle
 */
export function validateEnvironmentOrThrow(): void {
  const validation = validateEnvironment();
  
  if (!validation.isValid) {
    const errorMessage = createValidationErrorMessage(validation);
    console.error('❌ Environment validation failed:');
    console.error(errorMessage);
    throw new Error(`Environment validation failed: ${errorMessage}`);
  }

  // Log success and warnings
  console.log('✅ Environment validation passed');
  
  if (validation.warnings.length > 0) {
    console.warn('⚠️ Environment warnings:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
  }

  // Log configuration summary in development
  if (process.env.NODE_ENV === 'development') {
    const config = getEnvironmentConfig();
    console.log('📋 Environment configuration:');
    console.log(`  - Environment: ${config.app.environment}`);
    console.log(`  - App URL: ${config.app.url}`);
    console.log(`  - Supabase URL: ${config.supabase.url}`);
    console.log(`  - Log Level: ${config.logging.level}`);
    
    if (config.integrations.googleMapsApiKey) {
      console.log('  - Google Maps API: Configured');
    }
    
    if (config.smtp.host) {
      console.log(`  - SMTP: ${config.smtp.host}:${config.smtp.port || '587'}`);
    }
  }
}

/**
 * Checks if the application is running in a specific environment
 */
export function isEnvironment(env: 'development' | 'staging' | 'production'): boolean {
  const currentEnv = process.env.NEXT_PUBLIC_ENVIRONMENT || 'development';
  return currentEnv === env;
}

/**
 * Checks if the application is running in production
 */
export function isProduction(): boolean {
  return isEnvironment('production');
}

/**
 * Checks if the application is running in development
 */
export function isDevelopment(): boolean {
  return isEnvironment('development');
}

// =============================================
// Utility Functions
// =============================================

/**
 * Validates if a string is a valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    return ['http:', 'https:'].includes(url.protocol);
  } catch {
    return false;
  }
}

/**
 * Creates a formatted error message from validation results
 */
function createValidationErrorMessage(validation: ValidationResult): string {
  const errors: string[] = [];

  if (validation.missingVars.length > 0) {
    errors.push(`Missing required environment variables: ${validation.missingVars.join(', ')}`);
  }

  if (validation.invalidVars.length > 0) {
    const invalidDetails = validation.invalidVars
      .map(({ name, reason }) => `${name} (${reason})`)
      .join(', ');
    errors.push(`Invalid environment variables: ${invalidDetails}`);
  }

  return errors.join('; ');
}

/**
 * Gets environment variable with fallback
 */
export function getEnvVar(name: string, fallback?: string): string {
  const value = process.env[name];
  if (!value) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Gets boolean environment variable
 */
export function getBooleanEnvVar(name: string, fallback: boolean = false): boolean {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  return ['true', '1', 'yes', 'on'].includes(value.toLowerCase());
}

/**
 * Gets numeric environment variable
 */
export function getNumericEnvVar(name: string, fallback?: number): number {
  const value = process.env[name];
  if (!value) {
    if (fallback !== undefined) {
      return fallback;
    }
    throw new Error(`Required environment variable ${name} is not set`);
  }
  
  const numValue = parseInt(value, 10);
  if (isNaN(numValue)) {
    throw new Error(`Environment variable ${name} must be a valid number, got: ${value}`);
  }
  
  return numValue;
}

// =============================================
// Environment Presets
// =============================================

/**
 * Gets common environment presets for different deployment scenarios
 */
export function getEnvironmentPreset(): {
  name: string;
  description: string;
  recommendedVars: string[];
} {
  const environment = process.env.NEXT_PUBLIC_ENVIRONMENT || 'development';
  
  switch (environment) {
    case 'production':
      return {
        name: 'Production',
        description: 'Production deployment with full monitoring and security',
        recommendedVars: [
          'NEXT_PUBLIC_APP_URL',
          'DATABASE_URL',
          'SMTP_HOST',
          'SMTP_PORT',
          'SMTP_USER',
          'SMTP_PASSWORD',
          'WEBHOOK_SECRET',
          'LOG_LEVEL'
        ]
      };
    
    case 'staging':
      return {
        name: 'Staging',
        description: 'Staging environment for testing and QA',
        recommendedVars: [
          'NEXT_PUBLIC_APP_URL',
          'DATABASE_URL',
          'SMTP_HOST',
          'LOG_LEVEL'
        ]
      };
    
    default:
      return {
        name: 'Development',
        description: 'Local development environment',
        recommendedVars: [
          'GOOGLE_MAPS_API_KEY',
          'LOG_LEVEL'
        ]
      };
  }
}

// =============================================
// Development Helpers
// =============================================

/**
 * Prints environment configuration summary (development only)
 */
export function printEnvironmentSummary(): void {
  if (!isDevelopment()) {
    return;
  }

  const validation = validateEnvironment();
  const preset = getEnvironmentPreset();

  console.log('\n📊 Environment Configuration Summary');
  console.log('=====================================');
  console.log(`Environment: ${preset.name}`);
  console.log(`Description: ${preset.description}`);
  console.log(`Validation: ${validation.isValid ? '✅ Valid' : '❌ Invalid'}`);
  
  if (validation.missingVars.length > 0) {
    console.log(`Missing required: ${validation.missingVars.join(', ')}`);
  }
  
  if (validation.invalidVars.length > 0) {
    console.log('Invalid variables:');
    validation.invalidVars.forEach(({ name, reason }) => {
      console.log(`  - ${name}: ${reason}`);
    });
  }
  
  if (validation.warnings.length > 0) {
    console.log('Warnings:');
    validation.warnings.forEach(warning => {
      console.log(`  - ${warning}`);
    });
  }
  
  const missingRecommended = preset.recommendedVars.filter(
    varName => !process.env[varName]
  );
  
  if (missingRecommended.length > 0) {
    console.log(`Missing recommended: ${missingRecommended.join(', ')}`);
  }
  
  console.log('=====================================\n');
}