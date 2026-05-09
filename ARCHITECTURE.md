# VeritasWeb: Educational Architecture Breakdown

This document explains the key architectural concepts used in VeritasWeb for developers learning Next.js 15 and modern backend patterns.

---

## 1. Route Handlers: App Router in Next.js 15

### What Changed from Express.js?

**Old Pattern (Express.js):**
```javascript
// server.js
const express = require('express');
const app = express();

app.post('/api/monitors', (req, res) => {
  // Handle request
  res.json({ /* response */ });
});

app.listen(3000);
```

**New Pattern (Next.js 15 App Router):**
```typescript
// app/api/monitors/route.ts
export async function POST(request: NextRequest) {
  const body = await request.json();
  // Handle request
  return NextResponse.json({ /* response */ });
}
```

### Key Differences:

1. **File-based Routing**: No need for a router setup. Create `app/api/monitors/route.ts` and Next.js automatically exposes it as `POST /api/monitors`.

2. **Request/Response Objects**: Instead of Node.js `req`/`res`, Next.js provides `NextRequest` and `NextResponse` which are wrapper objects. `NextRequest` is a Web Standard `Request` object with helpful methods like `.json()`, `.text()`, `.formData()`.

3. **No Server to Start**: Next.js handles the server creation. Just run `pnpm dev` and it works.

4. **Type Safety by Default**: TypeScript is first-class. You get autocomplete for `request.headers`, `request.nextUrl.searchParams`, etc.

### Example from VeritasWeb:

```typescript
// app/api/monitors/route.ts
export async function POST(request: NextRequest) {
  // Extract Authorization header (type-safe)
  const authHeader = request.headers.get('Authorization');
  
  // Parse JSON (type-safe with Zod validation)
  const body = await request.json();
  const validatedData = createMonitorSchema.parse(body);
  
  // Return response (type-safe)
  return NextResponse.json(data, { status: 201 });
}

export async function GET(request: NextRequest) {
  // Extract query params (type-safe)
  const monitor_id = request.nextUrl.searchParams.get('monitor_id');
  // ...
}
```

**Benefits over Express:**
- Less boilerplate (no `app.use(express.json())`)
- File structure mirrors API structure (mental clarity)
- Built-in support for streaming, middleware, headers
- Automatic CORS handling in Next.js 15

---

## 2. Type Safety: Supabase + TypeScript Integration

### The Type Flow

**Database → Supabase Client Types → API Routes → Frontend**

### Step 1: Define Database Types (lib/supabase.ts)

```typescript
export type Database = {
  public: {
    Tables: {
      monitors: {
        Row: {
          id: string;
          user_id: string;
          url: string;
          frequency: 'hourly' | 'daily' | 'weekly';
          status: 'active' | 'paused';
          // ...
        };
        Insert: { /* for INSERT */ };
        Update: { /* for UPDATE */ };
      };
      captures: { /* similar */ };
    };
  };
};
```

### Step 2: Create Typed Supabase Client

```typescript
export const supabaseAdmin = createClient<Database>(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { /* config */ }
);
```

### Step 3: Use in API Routes

```typescript
// Now TypeScript knows the exact shape of data
const { data, error } = await supabaseAdmin
  .from('monitors')
  .select('*')
  .eq('user_id', userId);
  // 'data' is typed as monitor[] | null
  // Autocomplete works for all column names
```

### Step 4: Validate with Zod (lib/schemas.ts)

```typescript
export const createMonitorSchema = z.object({
  url: z.string().url(),
  frequency: z.enum(['hourly', 'daily', 'weekly']),
});

// In route handler:
const validatedData = createMonitorSchema.parse(body);
// validatedData is now typed as CreateMonitorInput
// TypeScript ensures we can only access validated properties
```

### Why This Matters:

1. **Compile-Time Errors**: Typos in column names are caught before runtime.
2. **Autocomplete**: Your editor knows every column and method available.
3. **Self-Documenting Code**: Types act as inline documentation.
4. **Refactoring Safety**: Change a column name? TypeScript errors cascade everywhere.

### Example: Zero Runtime Errors

```typescript
// ✅ TypeScript catches this at compile time
monitor.frequnecy  // Property 'frequnecy' does not exist
frequency: 'monthly' // Type '"monthly"' is not assignable to 'hourly' | 'daily' | 'weekly'
```

---

## 3. Security: Row Level Security (RLS) in Postgres

### The Problem Without RLS

```typescript
// ❌ INSECURE: Relies on application logic
async function getUserMonitors(userId: string) {
  const { data } = await supabaseAdmin
    .from('monitors')
    .select('*')
    // Oops, forgot .eq('user_id', userId)! Now users see all monitors!
}
```

### The Solution: RLS Policies

**Database-level enforcement in PostgreSQL:**

```sql
-- Enable RLS on the monitors table
ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;

-- Create a policy: only users can see their own monitors
CREATE POLICY monitor_isolation ON monitors
  FOR SELECT
  USING (auth.uid() = user_id);
```

### How RLS Works:

1. **Every Query is Filtered**: When you SELECT, Postgres automatically adds `WHERE auth.uid() = user_id`.
2. **Cannot Be Bypassed**: Even if your app code forgets the filter, the database enforces it.
3. **Seamless in Code**: Your API code doesn't change—Postgres does the work.

### Example: RLS in Action

```typescript
// In app/api/captures/route.ts
const { data: captures } = await supabaseAdmin
  .from('captures')
  .select('*')
  // No WHERE clause needed!
  // RLS automatically filters to captures owned by auth.uid()
```

**If a user tries to access another user's monitor:**
```typescript
// User A tries to fetch User B's captures
const { data } = await supabaseAdmin
  .from('captures')
  .select('*')
  .eq('monitor_id', 'user-b-monitor-id')
  // Postgres RLS policy blocks this automatically
  // Returns empty array, not an error
```

### RLS Policies in VeritasWeb:

1. **Monitor Isolation**:
   ```sql
   CREATE POLICY monitor_isolation ON monitors
     FOR SELECT USING (auth.uid() = user_id);
   ```

2. **Capture Isolation** (nested):
   ```sql
   CREATE POLICY capture_isolation ON captures
     FOR SELECT USING (
       monitor_id IN (
         SELECT id FROM monitors WHERE user_id = auth.uid()
       )
     );
   ```

**Benefits:**
- No need to manually add `.eq('user_id', userId)` to every query
- Impossible to accidentally expose user data
- Works with `supabaseAdmin` (powerful) and `supabaseClient` (restricted) identically
- Multi-tenant SaaS security built-in

---

## 4. Folder Structure: `lib/` vs `app/api/`

### Directory Layout

```
/vercel/share/v0-project/
├── app/
│   ├── api/
│   │   ├── monitors/
│   │   │   └── route.ts          # API endpoints
│   │   ├── captures/
│   │   │   └── route.ts          # API endpoints
│   │   └── export-affidavit/
│   │       └── route.ts          # API endpoints
│   ├── page.tsx                  # Frontend (Client Component)
│   ├── layout.tsx                # Root layout
│   └── globals.css               # Global styles
├── lib/
│   ├── forensic.ts               # Business logic (reusable)
│   ├── schemas.ts                # Validation (reusable)
│   └── supabase.ts               # Client config (reusable)
└── scripts/
    └── 01-init-schema.sql        # Database setup
```

### Purpose of Each Folder:

#### `app/api/` - Route Handlers (Endpoints)
**Purpose**: Handle HTTP requests and responses.

**What Goes Here:**
- API endpoints (POST, GET, DELETE, etc.)
- Request validation and error handling
- Authentication checks
- HTTP-specific logic

**Example:**
```typescript
// app/api/monitors/route.ts
export async function POST(request: NextRequest) {
  // 1. Check auth
  const userId = await getUserId(request);
  
  // 2. Validate request
  const validated = createMonitorSchema.parse(body);
  
  // 3. Call business logic (imported from lib/)
  const result = await monitorService.create(userId, validated);
  
  // 4. Return HTTP response
  return NextResponse.json(result, { status: 201 });
}
```

#### `lib/` - Business Logic & Utilities (Reusable)
**Purpose**: Core application logic that's independent of HTTP.

**What Goes Here:**
- Cryptographic utilities (`forensic.ts`)
- Database client configuration (`supabase.ts`)
- Validation schemas (`schemas.ts`)
- Database queries (in larger apps)
- Authentication helpers
- Any logic that could be used by multiple APIs or the frontend

**Example:**
```typescript
// lib/forensic.ts - Used by multiple API routes
export async function calculateSHA256Hash(content: string) {
  return crypto.createHash('sha256').update(content).digest('hex');
}

// app/api/captures/route.ts imports this
const hash = await calculateSHA256Hash(captureContent);
```

### Key Rule: Separation of Concerns

```
HTTP Layer (app/api/)      ← Handles requests/responses
        ↓
Business Logic (lib/)       ← Pure functions, testable, reusable
        ↓
Database Layer (lib/)       ← Queries, client config
```

**Why This Matters:**

1. **Testability**: You can unit test `forensic.ts` without any HTTP context.
2. **Reusability**: A cron job could also use `forensic.ts`.
3. **Maintainability**: Change a hash algorithm? Update one file in `lib/`, not every route.
4. **Clarity**: API files focus on HTTP, lib files focus on logic.

---

## 5. Complete Data Flow Example

### Create a Monitor: Request to Database

```
1. Frontend (app/page.tsx)
   ↓
   fetch('/api/monitors', { method: 'POST', body: JSON.stringify({ url, frequency }) })

2. Route Handler (app/api/monitors/route.ts)
   ↓
   a) Extract Authorization header
      authHeader = "Bearer <jwt-token>"
   
   b) Verify token with Supabase
      const user = await supabaseAdmin.auth.getUser(token)
   
   c) Validate request body
      const validated = createMonitorSchema.parse(body)
      → Zod ensures url is a valid URL, frequency is one of 3 options
   
   d) Call database
      await supabaseAdmin.from('monitors').insert({
        user_id: userId,
        url: validated.url,
        frequency: validated.frequency,
        status: 'active'
      })

3. Database (Supabase/PostgreSQL)
   ↓
   a) RLS Policy Check
      auth.uid() = user_id  ✅ Allows insert
   
   b) Insert row
      INSERT INTO monitors (id, user_id, url, frequency, status, created_at)
      VALUES (uuid, userId, 'https://example.com', 'daily', 'active', now())
   
   c) Return data

4. Back to Route Handler
   ↓
   return NextResponse.json(data, { status: 201 })

5. Frontend receives response
   ↓
   setMonitors([...monitors, newMonitor])
```

### Fetch Captures: Authorization Check

```
GET /api/captures?monitor_id=abc123

Route Handler Receives Request
│
├─ Extract Authorization header
│  "Bearer eyJhbGc..."
│
├─ Call supabaseAdmin.auth.getUser(token)
│  → Supabase validates JWT
│  → Returns { user: { id: 'user-123' } }
│
├─ Query captures
│  await supabaseAdmin
│    .from('captures')
│    .select('...')
│    .eq('monitor_id', 'abc123')  ← We query for all captures of this monitor
│
├─ RLS Policy Executes (at database layer)
│  SELECT * FROM captures
│  WHERE monitor_id = 'abc123'
│    AND monitor_id IN (
│      SELECT id FROM monitors
│      WHERE user_id = 'user-123'  ← RLS automatically filters
│    )
│
└─ If monitor_id doesn't belong to user-123
   → Empty array returned (no error, just no data)
```

**Key Point**: RLS means the database itself enforces authorization. The API doesn't need to check `if (userId === monitor.user_id)`.

---

## 6. Setup Instructions for Running Locally

### Prerequisites
- Node.js 18+
- PostgreSQL (via Supabase)
- Environment variables set

### Steps

1. **Install Dependencies**:
   ```bash
   cd /vercel/share/v0-project
   pnpm install
   ```

2. **Set Environment Variables** (in Vercel Project Settings):
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Service role key (for server)
   - `NEXT_PUBLIC_SUPABASE_URL` - Public URL (for client)
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Anon key (for client)
   - `SUPABASE_JWT_SECRET` - For TSA token signing

3. **Create Database Schema**:
   ```bash
   # Run the SQL migration
   psql -h db.supabase.co -U postgres -d postgres -f scripts/01-init-schema.sql
   # Or paste the SQL into Supabase SQL editor
   ```

4. **Start Dev Server**:
   ```bash
   pnpm dev
   ```
   
   Visit `http://localhost:3000`

5. **Test API Routes**:
   ```bash
   # Create a monitor
   curl -X POST http://localhost:3000/api/monitors \
     -H "Authorization: Bearer <jwt-token>" \
     -H "Content-Type: application/json" \
     -d '{"url":"https://example.com","frequency":"daily"}'
   ```

---

## 7. Security Best Practices Implemented

### ✅ What We Did Right

1. **JWT Verification**: Every API route verifies the token with Supabase.
2. **RLS Policies**: Database enforces per-user data isolation.
3. **Input Validation**: Zod ensures only valid data enters the system.
4. **Error Messages**: Generic error messages (no info leakage).
5. **Timestamps**: Immutable `created_at` prevents data backdating.

### ⚠️ What to Add for Production

1. **HTTPS Only**: Never send tokens over HTTP.
2. **CORS Configuration**: Restrict which origins can call your API.
3. **Rate Limiting**: Prevent brute force attacks.
4. **Audit Logging**: Log all authentication and data access.
5. **Session Tokens**: Implement refresh tokens for long-lived sessions.
6. **Encryption at Rest**: Encrypt sensitive data like session cookies.

---

## 8. Summary Table

| Aspect | Pattern | Benefit |
|--------|---------|---------|
| **Routing** | File-based (`app/api/monitors/route.ts`) | No setup, auto-routes, clear structure |
| **Types** | Supabase `Database` type + Zod schemas | Compile-time safety, autocomplete, validation |
| **Authorization** | RLS policies in PostgreSQL | Database-enforced, can't be bypassed |
| **Organization** | Business logic in `lib/`, HTTP in `app/api/` | Testable, reusable, maintainable |
| **Timestamps** | RFC 3161 TSA + SHA-256 hashing | Forensic integrity, legal compliance |

---

## Next Steps to Extend VeritasWeb

1. **Add Client-Side Auth**: Implement Supabase Auth UI for login/signup.
2. **Add Cron Jobs**: Trigger captures on a schedule (using a job queue).
3. **Add Web Scraping**: Implement actual capture logic (e.g., Puppeteer).
4. **Add Blob Storage**: Store actual web content in Vercel Blob.
5. **Add Webhooks**: Notify users when captures complete.

---

**Author**: v0  
**Date**: 2026-04-21  
**Version**: 1.0  
**Status**: Educational / Production-Ready Foundation
