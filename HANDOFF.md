# RenewFlo Onboarding Handoff

This repo contains the source of truth for the RenewFlo onboarding form.

Deployment has 2 separate parts:

1. Frontend page in Squarespace
2. Backend upload handler in Google Apps Script

Squarespace does not automatically sync with this repo. The live page is a pasted snapshot of `frontend/index.html` inside a Squarespace Code Block.

## What Must Be Updated For Changes

### If you change only the backend

Examples:
- Google Drive folder creation
- spreadsheet logging
- notification email behavior
- upload parsing

Then you only need to:

1. Update `backend/google-apps-script/Code.gs`
2. Update `backend/google-apps-script/appsscript.json` if needed
3. Paste the new code into the Google Apps Script project
4. Deploy a new web app version

You do not need to change the Squarespace page if the web app URL stays the same.

### If you change the frontend

Examples:
- form fields
- validation rules
- progress/completion logic
- styling
- upload payload structure

Then you need to:

1. Update `frontend/index.html`
2. Test locally
3. Copy the full updated HTML into the Squarespace Code Block
4. Save and republish the Squarespace page

If the frontend depends on a backend change, deploy both.

## For The Current Bug Fix

This repair changed both the frontend and the Apps Script backend.

To publish the current fix:

1. Copy `backend/google-apps-script/Code.gs` into the client Apps Script project
2. Confirm `backend/google-apps-script/appsscript.json` still matches the project manifest
3. Deploy a new version of the Apps Script web app
4. Copy the full contents of `frontend/index.html` into the Squarespace Code Block
5. Save and republish the page
6. Run a live test submission

## Standard Update Process

Use this process for any future change.

1. Make the change in this repo first
2. Test locally
3. If backend changed, redeploy Apps Script
4. If frontend changed, repaste `frontend/index.html` into Squarespace
5. Run a live submission test
6. Confirm Google Drive, email notifications, and any spreadsheet logs still work

## Files To Know

- `frontend/index.html`: production frontend used for Squarespace
- `frontend/demo.html`: demo-only version with mock data
- `backend/google-apps-script/Code.gs`: upload backend and Drive save logic
- `backend/google-apps-script/appsscript.json`: Apps Script manifest
- `QUICKSTART.txt`: short setup checklist
- `config/client-intake-template.txt`: client-specific handoff notes

## How To Update The Squarespace Page

1. Open the production page in Squarespace
2. Edit the Code Block that contains the onboarding form
3. Remove the old code
4. Paste the full contents of `frontend/index.html`
5. Save
6. Republish the page
7. Test on desktop and mobile

Important: do not paste `frontend/demo.html` into Squarespace unless you intentionally want demo behavior.

## How To Update Google Apps Script

1. Open the client-owned Apps Script project
2. Replace the contents of `Code.gs` with `backend/google-apps-script/Code.gs`
3. If needed, update the manifest from `backend/google-apps-script/appsscript.json`
4. Confirm `APP_CONFIG.rootFolderId` is correct
5. Deploy the project as a Web App
6. Keep the existing web app URL if possible
7. If the URL changes, update `FORM_CONFIG.submitEndpoint` in `frontend/index.html`
8. If the frontend endpoint changed, repaste the frontend into Squarespace

## Validation Checklist After Any Release

Run at least one real submission with files.

Check all of the following:

1. A submission folder is created in Google Drive
2. A per-property folder is created for each submitted property
3. Uploaded files appear inside the correct per-property folder
4. Required fields block submission when incomplete
5. Property confetti only fires after all required items are complete
6. If Claims = Yes, claim details are required before completion
7. Success screen appears only after the submission request succeeds
8. Spreadsheet log and notification email still work if enabled

## Notes About The Current Upload Implementation

The frontend now sends files as base64-encoded JSON.

This was done because Google Apps Script web apps do not reliably expose browser `fetch(FormData)` uploads through `e.files` in this setup. The current implementation avoids that limitation by:

1. Reading files in the browser
2. Sending them in JSON
3. Rebuilding Drive blobs in Apps Script before saving them

If anyone changes the upload method later, they must update both `frontend/index.html` and `backend/google-apps-script/Code.gs` together.

## Safe Bug-Fix Workflow

When repairing a bug:

1. Reproduce the issue locally or in a controlled test
2. Identify whether the issue is frontend, backend, or both
3. Make the change in this repo first
4. Test the exact affected path
5. Deploy only the layers that changed
6. Run one live submission test before closing the fix

## Recommended Handoff To Client

Tell the client:

1. This repo is the editable source of truth
2. Squarespace is a manual publish target, not a synced environment
3. Apps Script is the backend runtime and must be redeployed for backend changes
4. Frontend changes require repasting the HTML into Squarespace
5. They should always test one real submission after any change