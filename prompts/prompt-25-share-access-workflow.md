# Prompt 25: Share Links and Access Control Workflow

## Context
We need to implement a robust sharing mechanism that allows board owners to share read-only links and manage edit access requests smoothly. Guests should be able to view the board without an account but must log in to edit. The access request flow should be seamless and notify the board owner to approve or reject the request.

## Requirements
1. **Public View Links**:
   - Board owners can generate a public, view-only link using a JWT token (`/view/:id?token=...`).
   - The frontend router (`src/main.js`) must correctly handle the `#/view/:id` and `#/join/:key` paths to prevent guests from being redirected to the landing page.
   - `BoardPage.js` should initialize in `isPublicView` mode if a view token is present, hiding edit controls.
   - `SyncManager.js` must establish a WebSocket connection using the view token if the user is not authenticated.

2. **Access Request Workflow**:
   - Guests viewing the board can click a "Request Edit Access" button.
   - Unauthenticated users should be prompted with a sleek popup to log in or register before they can request access.
   - After successfully authenticating, the application should automatically redirect them back to the board and seamlessly trigger the access request on their behalf using a URL hash flag (`request_access=1`).

3. **Owner Management**:
   - The board owner should see all pending access requests inside the `ShareModal.js`.
   - The modal must fetch the requests from the backend (`GET /api/boards/:id/access/requests?status=pending`).
   - The owner can click "Approve" or "Reject". This must send a `POST` request with the correct JSON payload (`{"requestId": "..."}`) to the backend endpoints.
   - Upon approval, the backend updates the request status, adds the user as a collaborator, and sends a WebSocket notification to the requester, immediately granting them edit capabilities.

## Execution
Please ensure that the frontend changes perfectly align with the existing Go backend `ApproveAccess` and `RejectAccess` handlers, keeping data structures consistent (e.g., using `requestId` instead of `userId` where required).
