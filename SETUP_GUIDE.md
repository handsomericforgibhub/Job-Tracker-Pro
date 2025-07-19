# JobTracker Pro Web Application - Setup Guide

## Quick Start

### 1. Prerequisites
- Node.js 18+ installed
- Access to your Supabase project (same as mobile app)
- Git (optional)

### 2. Environment Setup
1. Navigate to the web application directory:
   ```bash
   cd /path/to/jobtracker-web
   ```

2. Copy your Supabase credentials from the mobile app's `.env` file:
   ```bash
   # Edit .env.local file
   NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
   ```

### 3. Installation & Development
```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open `http://localhost:3000` in your browser.

### 4. Test the Application

#### Create Test Accounts
1. Go to `http://localhost:3000/register`
2. Create accounts with different roles:
   - **Owner**: Can create a new company
   - **Foreman**: Will need to join existing company
   - **Worker**: Basic access level
   - **Client**: Project visibility only

#### Test Cross-Platform Integration
1. Log in with the same credentials you use in the mobile app
2. Verify that data is synchronized between platforms
3. Test role-based dashboard access

## Features Available

### ✅ Phase 1 Complete
- **Authentication System**: Login, register, logout
- **Role-Based Dashboards**: Customized views for each user type
- **Responsive Layout**: Professional sidebar navigation
- **Cross-Platform Sync**: Shares database with mobile app

### 🔄 Real-Time Features
- User authentication syncs across mobile and web
- Dashboard data updates automatically
- Shared user roles and permissions

## Troubleshooting

### Common Issues

**1. "Supabase client error"**
- Verify `.env.local` has correct Supabase URL and key
- Check that mobile app connection works first

**2. "Login not working"**
- Ensure you're using the same credentials as mobile app
- Check browser console for errors
- Verify Supabase project is accessible

**3. "Build errors"**
- Run `npm run build` to check for TypeScript errors
- Fix any linting issues that appear

**4. "Blank dashboard"**
- Check user role is set correctly in database
- Verify RLS policies allow web access
- Check browser console for API errors

### Database Verification
1. Ensure the mobile app is working correctly first
2. Check that users table has proper role assignments
3. Verify companies table has entries for owners
4. Test authentication works in Supabase dashboard

## Development Commands

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint

# Type checking
npx tsc --noEmit     # Check TypeScript types
```

## Browser Requirements

**Recommended**: Chrome, Firefox, Safari, Edge (latest versions)
**Minimum**: ES2020 support, CSS Grid, Flexbox

## Next Development Phase

Ready to continue with **Phase 2** implementation:
- Job management CRUD operations
- Document management interface  
- Worker management system
- Advanced data tables

The foundation is now complete and ready for building the full platform!