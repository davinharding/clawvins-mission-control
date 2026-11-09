# Mission Control - Task Edit & Comments Feature

## Goal
Add ability to edit tasks and add comments/discussion threads to tasks in the Kanban board.

## Current State
- Tasks display in Kanban columns ✅
- Can create new tasks ✅
- Can drag to move between columns ✅
- **Missing:** Edit task details, add comments, delete tasks

## Requirements

### 1. Task Edit Modal
When user clicks on a task card, open a modal/dialog with:
- **Title field** (editable text input)
- **Description field** (editable textarea)
- **Priority dropdown** (low, medium, high, critical)
- **Assigned Agent dropdown** (list of agents)
- **Tags** (editable, multi-select or comma-separated)
- **Status dropdown** (backlog, todo, in-progress, done)
- **Delete button** (with confirmation)
- **Save button** (updates task via API)
- **Cancel button** (closes modal without saving)

### 2. Comments Section
In the edit modal, below the task fields:
- **Comments thread** (list of comments with author, timestamp, text)
- **Add comment** textarea + "Post" button
- Comments display in chronological order (oldest first)
- Each comment shows:
  - Author name and avatar/initials
  - Timestamp (relative: "2 hours ago")
  - Comment text

### 3. Backend API Changes

#### New Endpoint: Comments
**POST /api/tasks/:taskId/comments**
- Auth required
- Body: `{ text: string }`
- Returns: `{ comment: { id, taskId, authorId, authorName, text, createdAt } }`
- Side effect: Create event, broadcast WebSocket `comment.created`

**GET /api/tasks/:taskId/comments**
- Auth required
- Returns: `{ comments: [{ id, taskId, authorId, authorName, text, createdAt }] }`

#### Database Schema
New table: `comments`
```sql
CREATE TABLE comments (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  author_id TEXT NOT NULL,
  author_name TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
);
```

#### Update DELETE /api/tasks/:id
- When deleting a task, also delete associated comments (CASCADE)

### 4. Frontend Implementation

#### New Components Needed
- `src/components/TaskEditModal.tsx` - Main edit modal dialog
- `src/components/CommentsSection.tsx` - Comments thread UI
- `src/components/CommentItem.tsx` - Individual comment display

#### UI/UX
- Use shadcn/ui `Dialog` component for modal
- Use shadcn/ui `Textarea` for description and comment input
- Use shadcn/ui `Select` for dropdowns
- Use shadcn/ui `Button` for actions
- Add loading states for API calls
- Add error handling with toast notifications

#### API Integration
Create `src/lib/api.ts` functions:
```typescript
export async function updateTask(id: string, updates: Partial<Task>)
export async function deleteTask(id: string)
export async function getComments(taskId: string)
export async function createComment(taskId: string, text: string)
```

#### WebSocket Events
Listen for:
- `comment.created` - New comment added to a task
- `task.updated` - Task edited by another user
- `task.deleted` - Task deleted by another user

Update UI in real-time when events received.

### 5. Validation
- Title: required, min 1 char, max 200 chars
- Description: optional, max 2000 chars
- Comment text: required, min 1 char, max 1000 chars

Add Zod schemas in `server/schemas.js`.

## Implementation Steps

1. **Backend first:**
   - Add comments table to `server/db.js`
   - Add comment queries (getComments, createComment)
   - Create `server/routes/comments.js`
   - Add comment validation schema
   - Update task deletion to cascade comments
   - Test API endpoints with curl

2. **Frontend components:**
   - Create `TaskEditModal.tsx` with form fields
   - Create `CommentsSection.tsx` with thread UI
   - Create `CommentItem.tsx` for individual comments
   - Wire up API calls in modal
   - Add WebSocket listeners for real-time updates

3. **Integration:**
   - Update `App.tsx` to open modal when task card clicked
   - Pass task data to modal
   - Handle save/delete actions
   - Test full flow: edit, comment, delete

4. **Polish:**
   - Add loading spinners
   - Add error toast notifications
   - Add confirmation dialog for delete
   - Test real-time updates (open two browser tabs)

## Expected Behavior

**Edit Task Flow:**
1. User clicks task card → modal opens with current task data
2. User edits fields → clicks Save
3. API call to PATCH /api/tasks/:id
4. Modal closes, Kanban updates immediately
5. WebSocket broadcasts task.updated to other clients
6. Other users see update in real-time

**Add Comment Flow:**
1. User opens task modal → scrolls to comments section
2. Types comment → clicks Post
3. API call to POST /api/tasks/:taskId/comments
4. Comment appears in thread immediately
5. WebSocket broadcasts comment.created to other clients
6. Other users viewing same task see new comment

**Delete Task Flow:**
1. User clicks Delete in modal → confirmation dialog
2. User confirms → API call to DELETE /api/tasks/:id
3. Modal closes, task removed from Kanban
4. WebSocket broadcasts task.deleted to other clients
5. Other users see task disappear

## Testing Checklist
- [ ] Can open edit modal by clicking task card
- [ ] Can edit all task fields (title, description, priority, assignee, tags, status)
- [ ] Can save changes and see update in Kanban
- [ ] Can add comments to task
- [ ] Can see existing comments in thread
- [ ] Can delete task (with confirmation)
- [ ] Real-time: Changes appear for other users without refresh
- [ ] Real-time: Comments appear for other users viewing same task
- [ ] Real-time: Deleted tasks disappear for other users
- [ ] Validation: Title required, character limits enforced
- [ ] Error handling: API failures show toast notification

## Working Directory
`/home/node/code/mission-control`

## Time Estimate
45-60 minutes

## Notes
- Use existing backend auth (JWT from login)
- Use existing WebSocket setup (Socket.io)
- Match existing UI style (dark theme, glassmorphism)
- No new dependencies needed (shadcn/ui already has Dialog component)
- Frontend served at http://localhost:9000/mission_control
- Backend API at http://localhost:9000/api (proxied to :3002)
