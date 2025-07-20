import { defineConfig } from 'tsup';

export default defineConfig([
  {
    // Main application entry points
    entryPoints: [
      'src/index.ts',
      'src/enhanced-index.ts'
    ],
    
    // Output formats - ESM only (CJS has issues with top-level await)
    format: ['esm'],
    
    // Generate TypeScript declaration files
    dts: true,
    
    // Don't minify for better debugging in production
    minify: false,
    
    // Output directory
    outDir: 'dist/',
    
    // Clean dist directory before build
    clean: true,
    
    // Generate sourcemaps for debugging
    sourcemap: true,
    
    // Bundle dependencies (except node_modules)
    bundle: true,
    
    // Code splitting for better performance
    splitting: false,
    
    // Custom extensions for dual publishing
    outExtension(ctx) {
      return {
        dts: ctx.format === 'cjs' ? '.d.cts' : '.d.ts',
        js: ctx.format === 'cjs' ? '.cjs' : '.mjs',
      };
    },
    
    // Tree shaking for smaller bundles
    treeshake: true,
    
    // Target modern Node.js
    target: 'es2022',
    
    // Platform-specific optimizations
    platform: 'node',
    
    // Use project tsconfig
    tsconfig: './tsconfig.json',
    
    // CommonJS interop
    cjsInterop: true,
    
    // Keep function names for better debugging
    keepNames: true,
    
    // Don't bundle node_modules
    skipNodeModulesBundle: true,
    
    // External dependencies (don't bundle these)
    external: [
      // Database drivers
      'pg',
      'redis',
      
      // Large ML libraries
      '@xenova/transformers',
      
      // Express ecosystem
      'express',
      'compression',
      'cors',
      'helmet',
      'express-rate-limit',
      
      // Fastify ecosystem  
      'fastify',
      '@fastify/*',
      
      // Other large deps
      'winston',
      'prom-client',
      'jsonwebtoken',
      'dotenv'
    ],
  },
]);