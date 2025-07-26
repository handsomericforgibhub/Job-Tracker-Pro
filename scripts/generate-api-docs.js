#!/usr/bin/env node

/**
 * API Documentation Generator
 * 
 * ADR Phase 3: Infrastructure & Optimization - Documentation Automation
 * This script automatically generates comprehensive API documentation
 * from route files, schemas, and type definitions.
 */

const fs = require('fs').promises
const path = require('path')
const { exec } = require('child_process')
const { promisify } = require('util')

const execAsync = promisify(exec)

// Configuration
const API_ROUTES_DIR = path.join(__dirname, '../src/app/api')
const DOCS_OUTPUT_DIR = path.join(__dirname, '../docs/api')
const TYPES_DIR = path.join(__dirname, '../src/lib/types')

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
}

function log(message, color = colors.reset) {
  console.log(`${color}${message}${colors.reset}`)
}

/**
 * Extract API route information from file content
 */
function extractRouteInfo(content, filePath) {
  const routes = []
  const httpMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  
  // Extract JSDoc comments and function signatures
  const exportPattern = /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\([^)]*\)\s*{/g
  const jsdocPattern = /\/\*\*\s*([\s\S]*?)\*\//g
  
  let match
  let jsdocComments = []
  
  // Extract JSDoc comments
  while ((match = jsdocPattern.exec(content)) !== null) {
    jsdocComments.push({
      content: match[1].trim(),
      startIndex: match.index
    })
  }
  
  // Extract exported functions
  while ((match = exportPattern.exec(content)) !== null) {
    const method = match[1]
    const functionStartIndex = match.index
    
    // Find the nearest preceding JSDoc comment
    const nearestJsdoc = jsdocComments
      .filter(jsdoc => jsdoc.startIndex < functionStartIndex)
      .pop()
    
    // Extract route path from file path
    const relativePath = path.relative(API_ROUTES_DIR, filePath)
    const routePath = '/' + relativePath
      .replace(/\/route\.(ts|js)$/, '')
      .replace(/\[([^\]]+)\]/g, ':$1') // Convert [id] to :id
      .replace(/\\/g, '/') // Normalize path separators
    
    routes.push({
      method,
      path: routePath,
      filePath: relativePath,
      jsdoc: nearestJsdoc ? parseJsdoc(nearestJsdoc.content) : null
    })
  }
  
  return routes
}

/**
 * Parse JSDoc comment into structured data
 */
function parseJsdoc(jsdocContent) {
  const lines = jsdocContent.split('\n').map(line => line.replace(/^\s*\*\s?/, '').trim())
  const result = {
    description: '',
    params: [],
    returns: '',
    examples: [],
    tags: {}
  }
  
  let currentSection = 'description'
  let currentExample = ''
  
  for (const line of lines) {
    if (line.startsWith('@param')) {
      currentSection = 'params'
      const paramMatch = line.match(/@param\s+(?:\{([^}]+)\})?\s+(\w+)\s*-?\s*(.*)/)
      if (paramMatch) {
        result.params.push({
          type: paramMatch[1] || 'unknown',
          name: paramMatch[2],
          description: paramMatch[3] || ''
        })
      }
    } else if (line.startsWith('@returns') || line.startsWith('@return')) {
      currentSection = 'returns'
      result.returns = line.replace(/@returns?\s*(?:\{[^}]+\})?\s*/, '')
    } else if (line.startsWith('@example')) {
      currentSection = 'example'
      currentExample = ''
    } else if (line.startsWith('@')) {
      const tagMatch = line.match(/@(\w+)\s*(.*)/)
      if (tagMatch) {
        result.tags[tagMatch[1]] = tagMatch[2]
      }
    } else if (currentSection === 'description' && line) {
      result.description += (result.description ? ' ' : '') + line
    } else if (currentSection === 'example') {
      if (line === '' && currentExample) {
        result.examples.push(currentExample)
        currentExample = ''
      } else {
        currentExample += (currentExample ? '\n' : '') + line
      }
    }
  }
  
  if (currentExample) {
    result.examples.push(currentExample)
  }
  
  return result
}

/**
 * Extract type definitions from TypeScript files
 */
async function extractTypeDefinitions() {
  const typeFiles = []
  
  try {
    const files = await fs.readdir(TYPES_DIR, { recursive: true })
    
    for (const file of files) {
      if (file.endsWith('.ts') && !file.endsWith('.test.ts')) {
        const filePath = path.join(TYPES_DIR, file)
        const content = await fs.readFile(filePath, 'utf8')
        
        // Extract interfaces and types
        const interfaces = extractInterfaces(content)
        const types = extractTypes(content)
        
        if (interfaces.length > 0 || types.length > 0) {
          typeFiles.push({
            file,
            interfaces,
            types
          })
        }
      }
    }
  } catch (error) {
    log(`Warning: Could not read types directory: ${error.message}`, colors.yellow)
  }
  
  return typeFiles
}

/**
 * Extract interface definitions from TypeScript content
 */
function extractInterfaces(content) {
  const interfaces = []
  const interfacePattern = /export\s+interface\s+(\w+)\s*(?:<[^>]*>)?\s*{([^}]*)}/g
  
  let match
  while ((match = interfacePattern.exec(content)) !== null) {
    const name = match[1]
    const body = match[2]
    
    const properties = extractProperties(body)
    
    interfaces.push({
      name,
      properties,
      raw: match[0]
    })
  }
  
  return interfaces
}

/**
 * Extract type definitions from TypeScript content
 */
function extractTypes(content) {
  const types = []
  const typePattern = /export\s+type\s+(\w+)\s*=\s*([^;\n]+)/g
  
  let match
  while ((match = typePattern.exec(content)) !== null) {
    types.push({
      name: match[1],
      definition: match[2].trim(),
      raw: match[0]
    })
  }
  
  return types
}

/**
 * Extract properties from interface body
 */
function extractProperties(body) {
  const properties = []
  const propertyPattern = /(\w+)(\??):\s*([^;\n]+)/g
  
  let match
  while ((match = propertyPattern.exec(body)) !== null) {
    properties.push({
      name: match[1],
      optional: match[2] === '?',
      type: match[3].trim()
    })
  }
  
  return properties
}

/**
 * Generate markdown documentation for routes
 */
function generateRouteMarkdown(routes) {
  let markdown = `# API Routes Documentation

Generated on: ${new Date().toISOString()}

## Overview

This document provides comprehensive documentation for all API routes in the JobTracker application.

## Authentication

All API routes require authentication unless otherwise specified. Include the following headers:

\`\`\`
Authorization: Bearer <your-jwt-token>
Content-Type: application/json
\`\`\`

## Standard Response Format

All API responses follow this standard format:

\`\`\`json
{
  "success": true,
  "data": { /* response data */ },
  "metadata": {
    "requestId": "uuid",
    "timestamp": "2025-01-01T00:00:00Z",
    "processingTime": 123
  }
}
\`\`\`

Error responses:

\`\`\`json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "retryable": false
  }
}
\`\`\`

## Routes

`

  // Group routes by path
  const groupedRoutes = routes.reduce((groups, route) => {
    if (!groups[route.path]) {
      groups[route.path] = []
    }
    groups[route.path].push(route)
    return groups
  }, {})

  // Sort paths
  const sortedPaths = Object.keys(groupedRoutes).sort()

  for (const path of sortedPaths) {
    const pathRoutes = groupedRoutes[path]
    
    markdown += `\n### \`${path}\`\n\n`
    markdown += `**File:** \`${pathRoutes[0].filePath}\`\n\n`

    for (const route of pathRoutes) {
      markdown += `#### ${route.method} ${route.path}\n\n`
      
      if (route.jsdoc) {
        if (route.jsdoc.description) {
          markdown += `${route.jsdoc.description}\n\n`
        }
        
        if (route.jsdoc.params.length > 0) {
          markdown += `**Parameters:**\n\n`
          for (const param of route.jsdoc.params) {
            markdown += `- **${param.name}** (\`${param.type}\`): ${param.description}\n`
          }
          markdown += '\n'
        }
        
        if (route.jsdoc.returns) {
          markdown += `**Returns:** ${route.jsdoc.returns}\n\n`
        }
        
        if (route.jsdoc.examples.length > 0) {
          markdown += `**Examples:**\n\n`
          for (const example of route.jsdoc.examples) {
            markdown += `\`\`\`${example.startsWith('GET') || example.startsWith('POST') ? 'http' : 'json'}\n${example}\n\`\`\`\n\n`
          }
        }
        
        // Add common error codes
        markdown += `**Common Error Codes:**\n\n`
        markdown += `- \`401\` - Authentication required\n`
        markdown += `- \`403\` - Insufficient permissions\n`
        markdown += `- \`404\` - Resource not found\n`
        markdown += `- \`422\` - Validation error\n`
        markdown += `- \`500\` - Internal server error\n\n`
      }
      
      markdown += '---\n\n'
    }
  }

  return markdown
}

/**
 * Generate markdown documentation for types
 */
function generateTypesMarkdown(typeFiles) {
  let markdown = `# Type Definitions

Generated on: ${new Date().toISOString()}

## Overview

This document provides comprehensive documentation for all TypeScript types and interfaces used in the JobTracker API.

`

  for (const typeFile of typeFiles) {
    markdown += `\n## ${typeFile.file}\n\n`
    
    if (typeFile.interfaces.length > 0) {
      markdown += `### Interfaces\n\n`
      
      for (const iface of typeFile.interfaces) {
        markdown += `#### ${iface.name}\n\n`
        
        if (iface.properties.length > 0) {
          markdown += `| Property | Type | Optional | Description |\n`
          markdown += `|----------|------|----------|-------------|\n`
          
          for (const prop of iface.properties) {
            markdown += `| ${prop.name} | \`${prop.type}\` | ${prop.optional ? '✓' : '✗'} | |\n`
          }
          
          markdown += '\n'
        }
        
        markdown += `\`\`\`typescript\n${iface.raw}\n\`\`\`\n\n`
      }
    }
    
    if (typeFile.types.length > 0) {
      markdown += `### Types\n\n`
      
      for (const type of typeFile.types) {
        markdown += `#### ${type.name}\n\n`
        markdown += `\`\`\`typescript\n${type.raw}\n\`\`\`\n\n`
      }
    }
  }

  return markdown
}

/**
 * Generate OpenAPI specification
 */
function generateOpenApiSpec(routes, typeFiles) {
  const spec = {
    openapi: '3.0.0',
    info: {
      title: 'JobTracker API',
      version: '1.0.0',
      description: 'Multi-tenant construction job management API',
      contact: {
        name: 'JobTracker Support',
        email: 'support@jobtracker.com'
      }
    },
    servers: [
      {
        url: 'http://localhost:3000/api',
        description: 'Development server'
      },
      {
        url: 'https://api.jobtracker.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      },
      schemas: {}
    },
    security: [
      {
        bearerAuth: []
      }
    ],
    paths: {}
  }

  // Add type definitions to components
  for (const typeFile of typeFiles) {
    for (const iface of typeFile.interfaces) {
      spec.components.schemas[iface.name] = {
        type: 'object',
        properties: iface.properties.reduce((props, prop) => {
          props[prop.name] = {
            type: inferOpenApiType(prop.type),
            description: ''
          }
          return props
        }, {}),
        required: iface.properties.filter(p => !p.optional).map(p => p.name)
      }
    }
  }

  // Add standard response schemas
  spec.components.schemas.ApiResponse = {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      data: { type: 'object' },
      metadata: {
        type: 'object',
        properties: {
          requestId: { type: 'string', format: 'uuid' },
          timestamp: { type: 'string', format: 'date-time' },
          processingTime: { type: 'number' }
        }
      }
    },
    required: ['success']
  }

  spec.components.schemas.ErrorResponse = {
    type: 'object',
    properties: {
      success: { type: 'boolean', enum: [false] },
      error: {
        type: 'object',
        properties: {
          message: { type: 'string' },
          code: { type: 'string' },
          retryable: { type: 'boolean' }
        },
        required: ['message', 'code', 'retryable']
      }
    },
    required: ['success', 'error']
  }

  // Add routes to paths
  const groupedRoutes = routes.reduce((groups, route) => {
    if (!groups[route.path]) {
      groups[route.path] = {}
    }
    groups[route.path][route.method.toLowerCase()] = route
    return groups
  }, {})

  for (const [path, methods] of Object.entries(groupedRoutes)) {
    spec.paths[path] = {}
    
    for (const [method, route] of Object.entries(methods)) {
      const operation = {
        summary: route.jsdoc?.description || `${method.toUpperCase()} ${path}`,
        description: route.jsdoc?.description || '',
        responses: {
          '200': {
            description: 'Success',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ApiResponse' }
              }
            }
          },
          '400': {
            description: 'Bad Request',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '401': {
            description: 'Unauthorized',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '403': {
            description: 'Forbidden',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          },
          '500': {
            description: 'Internal Server Error',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/ErrorResponse' }
              }
            }
          }
        }
      }

      // Add parameters for path variables
      const pathParams = path.match(/:\w+/g)
      if (pathParams) {
        operation.parameters = pathParams.map(param => ({
          name: param.substring(1),
          in: 'path',
          required: true,
          schema: { type: 'string' },
          description: `${param.substring(1)} identifier`
        }))
      }

      // Add request body for POST/PUT/PATCH
      if (['post', 'put', 'patch'].includes(method)) {
        operation.requestBody = {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object' }
            }
          }
        }
      }

      spec.paths[path][method] = operation
    }
  }

  return spec
}

/**
 * Infer OpenAPI type from TypeScript type
 */
function inferOpenApiType(tsType) {
  if (tsType.includes('string')) return 'string'
  if (tsType.includes('number')) return 'number'
  if (tsType.includes('boolean')) return 'boolean'
  if (tsType.includes('Date')) return 'string'
  if (tsType.includes('[]')) return 'array'
  return 'object'
}

/**
 * Recursively find all route files
 */
async function findRouteFiles(dir) {
  const files = []
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      
      if (entry.isDirectory()) {
        const subFiles = await findRouteFiles(fullPath)
        files.push(...subFiles)
      } else if (entry.name === 'route.ts' || entry.name === 'route.js') {
        files.push(fullPath)
      }
    }
  } catch (error) {
    log(`Warning: Could not read directory ${dir}: ${error.message}`, colors.yellow)
  }
  
  return files
}

/**
 * Main documentation generation function
 */
async function generateDocumentation() {
  log('🚀 Starting API documentation generation...', colors.bright)
  
  try {
    // Ensure output directory exists
    await fs.mkdir(DOCS_OUTPUT_DIR, { recursive: true })
    
    // Find all route files
    log('📂 Finding API route files...', colors.blue)
    const routeFiles = await findRouteFiles(API_ROUTES_DIR)
    log(`   Found ${routeFiles.length} route files`, colors.cyan)
    
    // Extract route information
    log('🔍 Extracting route information...', colors.blue)
    const allRoutes = []
    
    for (const filePath of routeFiles) {
      try {
        const content = await fs.readFile(filePath, 'utf8')
        const routes = extractRouteInfo(content, filePath)
        allRoutes.push(...routes)
      } catch (error) {
        log(`   Warning: Could not process ${filePath}: ${error.message}`, colors.yellow)
      }
    }
    
    log(`   Extracted ${allRoutes.length} routes`, colors.cyan)
    
    // Extract type definitions
    log('📝 Extracting type definitions...', colors.blue)
    const typeFiles = await extractTypeDefinitions()
    log(`   Found ${typeFiles.length} type files`, colors.cyan)
    
    // Generate documentation
    log('📚 Generating documentation...', colors.blue)
    
    // Generate routes documentation
    const routesMarkdown = generateRouteMarkdown(allRoutes)
    await fs.writeFile(path.join(DOCS_OUTPUT_DIR, 'routes.md'), routesMarkdown)
    log('   ✓ Generated routes.md', colors.green)
    
    // Generate types documentation
    const typesMarkdown = generateTypesMarkdown(typeFiles)
    await fs.writeFile(path.join(DOCS_OUTPUT_DIR, 'types.md'), typesMarkdown)
    log('   ✓ Generated types.md', colors.green)
    
    // Generate OpenAPI specification
    const openApiSpec = generateOpenApiSpec(allRoutes, typeFiles)
    await fs.writeFile(
      path.join(DOCS_OUTPUT_DIR, 'openapi.json'),
      JSON.stringify(openApiSpec, null, 2)
    )
    log('   ✓ Generated openapi.json', colors.green)
    
    // Generate summary
    const summary = `# API Documentation Summary

Generated on: ${new Date().toISOString()}

## Statistics

- **Total Routes:** ${allRoutes.length}
- **Route Files:** ${routeFiles.length}
- **Type Files:** ${typeFiles.length}
- **Interfaces:** ${typeFiles.reduce((sum, tf) => sum + tf.interfaces.length, 0)}
- **Type Aliases:** ${typeFiles.reduce((sum, tf) => sum + tf.types.length, 0)}

## Files Generated

- [API Routes](./routes.md) - Complete API endpoint documentation
- [Type Definitions](./types.md) - TypeScript interfaces and types
- [OpenAPI Specification](./openapi.json) - Machine-readable API spec

## HTTP Methods Distribution

${['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map(method => {
  const count = allRoutes.filter(r => r.method === method).length
  return `- **${method}:** ${count} endpoints`
}).join('\n')}

## Most Common Routes

${Object.entries(
  allRoutes.reduce((counts, route) => {
    const basePath = route.path.split('/')[1] || 'root'
    counts[basePath] = (counts[basePath] || 0) + 1
    return counts
  }, {})
)
.sort(([,a], [,b]) => b - a)
.slice(0, 10)
.map(([path, count]) => `- **/${path}:** ${count} endpoints`)
.join('\n')}
`

    await fs.writeFile(path.join(DOCS_OUTPUT_DIR, 'README.md'), summary)
    log('   ✓ Generated README.md', colors.green)
    
    log('✅ Documentation generation completed successfully!', colors.green)
    log(`📁 Output directory: ${DOCS_OUTPUT_DIR}`, colors.cyan)
    
  } catch (error) {
    log(`❌ Documentation generation failed: ${error.message}`, colors.red)
    console.error(error)
    process.exit(1)
  }
}

// Execute if run directly
if (require.main === module) {
  generateDocumentation()
}

module.exports = {
  generateDocumentation,
  extractRouteInfo,
  generateRouteMarkdown,
  generateOpenApiSpec
}