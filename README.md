# Equity Calculator Backend

This is the backend API for the Equity Calculator application that handles user data persistence and workspace management.

## Features

- RESTful API for workspace management
- SQLite database for data persistence
- Session-based user management
- Data validation and error handling
- Offline-first architecture support

## Installation

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

   Or for production:
   ```bash
   npm start
   ```

## API Endpoints

### Users
- `POST /api/users/session` - Create or retrieve user session
- `GET /api/users/:userId` - Get user profile
- `PATCH /api/users/:userId` - Update user email

### Workspaces
- `GET /api/workspaces` - Get all workspaces for a user
- `GET /api/workspaces/:workspaceId` - Get specific workspace
- `POST /api/workspaces` - Create new workspace
- `PUT /api/workspaces/:workspaceId` - Update workspace
- `DELETE /api/workspaces/:workspaceId` - Delete workspace

### Health Check
- `GET /api/health` - API health status

## Database Schema

The application uses SQLite with the following main tables:
- `users` - User profiles and session management
- `workspaces` - Workspace metadata
- `founders` - Founder information per workspace
- `reserved_pools` - Equity reserve pools
- `ratings` - Rating responses (Q7-Q9)
- `equity_adjustments` - Manual equity distribution adjustments
- `factors` - Additional equity factors and allocations
- `visited_questions` - Question completion tracking

## Environment Variables

- `PORT` - Server port (default: 5000)
- `NODE_ENV` - Environment (development/production)
- `DATABASE_PATH` - SQLite database file path

## Development

The backend automatically creates the database and runs migrations on startup. The database file will be created in `database/data/equity_calculator.db`.

For development, use:
```bash
npm run dev
```

This starts the server with nodemon for automatic restarts on file changes.