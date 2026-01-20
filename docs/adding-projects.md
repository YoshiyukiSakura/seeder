# Adding Projects

This guide explains how to add and manage projects in Seedbed.

## Prerequisites

### Private Repository Access

If you need to clone private repositories, you must first give the server's GitHub account access to your repository:

1. Go to your repository's **Settings** > **Collaborators**
2. Add the server's GitHub account as a collaborator
3. The server account will need at least **Read** access

> Note: Contact your administrator to get the server's GitHub account username.

---

## Adding Projects via UI (Recommended)

### From the Project Selector

1. Click on the **Project Selector** dropdown in the chat interface
2. Click **+ New Project** at the bottom of the dropdown
3. Fill in the project details:

| Field | Required | Description |
|-------|----------|-------------|
| Name | Yes | A descriptive name for your project |
| Description | No | Brief description of the project |
| Git URL | No | Repository URL (HTTPS or SSH format) |
| Git Branch | No | Branch to checkout (default: `main`) |
| Tech Stack | No | Comma-separated list of technologies |

4. Click **Create Project**
5. If you provided a Git URL, the system will automatically clone the repository

### Saving a Local Project

If you see a local project in the Project Selector (marked with "Local" tag), you can save it to the database:

1. Open the Project Selector dropdown
2. Find the local project you want to save
3. Click the **save icon** (down arrow) next to the project
4. Review and update the project details
5. Click **Create Project**

---

## Managing Projects in Settings

Access the Settings page to view, edit, or delete your projects.

### Viewing Projects

1. Click on your avatar or go to **Settings**
2. Scroll down to the **Projects** section
3. You'll see all projects with:
   - Name and description
   - Tech stack tags
   - Git branch (if connected to a repository)
   - Number of plans associated

### Editing a Project

1. Find the project you want to edit
2. Click the **edit icon** (pencil)
3. Update the project details
4. Click **Save Changes**

### Deleting a Project

1. Find the project you want to delete
2. Click the **delete icon** (trash)
3. Confirm the deletion

> **Warning**: Deleting a project will also delete all associated plans and tasks. This action cannot be undone.

---

## Adding Projects via API (Advanced)

For automation or scripting, you can create projects via the API.

### Create a New Project

```bash
curl -X POST http://localhost:38966/api/projects \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=YOUR_AUTH_TOKEN" \
  -d '{
    "name": "My Project",
    "description": "A sample project",
    "gitUrl": "https://github.com/owner/repo.git",
    "gitBranch": "main",
    "techStack": ["React", "TypeScript", "Node.js"]
  }'
```

### API Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Project name |
| `description` | string | No | Project description |
| `gitUrl` | string | No | Git repository URL |
| `gitBranch` | string | No | Branch name (default: `main`) |
| `techStack` | string[] | No | Array of technology names |
| `localPath` | string | No | Local filesystem path (auto-generated if gitUrl provided) |

### Supported Git URL Formats

- HTTPS: `https://github.com/owner/repo.git`
- SSH: `git@github.com:owner/repo.git`

---

## Troubleshooting

### "Permission denied" when cloning

- Ensure the server's GitHub account has access to the repository
- For private repositories, add the server account as a collaborator

### "Repository not found"

- Verify the Git URL is correct
- Check if the repository exists and is accessible

### "Branch does not exist"

- Verify the branch name is correct
- Ensure the branch exists in the remote repository

### Clone takes too long

Large repositories may take longer to clone. The system has a 5-minute timeout for clone operations.
