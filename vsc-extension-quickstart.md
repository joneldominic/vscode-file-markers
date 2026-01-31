# Welcome to your VS Code Extension

## What's in the folder

* This folder contains all of the files necessary for your extension.
* `package.json` - this is the manifest file in which you declare your extension and command.
  * The sample plugin registers a command and defines its title and command name. With this information VS Code can show the command in the command palette. It doesn’t yet need to load the plugin.
* `src/extension.ts` - this is the main file where you will provide the implementation of your command.
  * The file exports one function, `activate`, which is called the very first time your extension is activated (in this case by executing the command). Inside the `activate` function we call `registerCommand`.
  * We pass the function containing the implementation of the command as the second parameter to `registerCommand`.

## Setup

* install the recommended extensions (amodio.tsl-problem-matcher, ms-vscode.extension-test-runner, and dbaeumer.vscode-eslint)


## Get up and running straight away

* Press `F5` to open a new window with your extension loaded.
* Run your command from the command palette by pressing (`Ctrl+Shift+P` or `Cmd+Shift+P` on Mac) and typing `Hello World`.
* Set breakpoints in your code inside `src/extension.ts` to debug your extension.
* Find output from your extension in the debug console.

## Make changes

* You can relaunch the extension from the debug toolbar after changing code in `src/extension.ts`.
* You can also reload (`Ctrl+R` or `Cmd+R` on Mac) the VS Code window with your extension to load your changes.


## Explore the API

* You can open the full set of our API when you open the file `node_modules/@types/vscode/index.d.ts`.

## Run tests

* Install the [Extension Test Runner](https://marketplace.visualstudio.com/items?itemName=ms-vscode.extension-test-runner)
* Run the "watch" task via the **Tasks: Run Task** command. Make sure this is running, or tests might not be discovered.
* Open the Testing view from the activity bar and click the Run Test" button, or use the hotkey `Ctrl/Cmd + ; A`
* See the output of the test result in the Test Results view.
* Make changes to `src/test/extension.test.ts` or create new test files inside the `test` folder.
  * The provided test runner will only consider files matching the name pattern `**.test.ts`.
  * You can create folders inside the `test` folder to structure your tests any way you want.

## Publishing to VS Code Marketplace

### Prerequisites

1. **Azure DevOps Account** - Create one at [dev.azure.com](https://dev.azure.com)
2. **Personal Access Token (PAT)** - Required for authentication
3. **Publisher Account** - Create at [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)

### Step 1: Create Personal Access Token (PAT)

1. Go to [dev.azure.com](https://dev.azure.com) and sign in
2. Click your profile picture → **Personal access tokens**
3. Click **New Token**
4. Configure:
   - **Name**: `vscode-marketplace` (or any descriptive name)
   - **Organization**: Select **All accessible organizations**
   - **Expiration**: Set appropriate duration
   - **Scopes**: Select **Marketplace** → **Manage** (full access)
5. Click **Create** and **copy the token immediately** (shown only once)

### Step 2: Create Publisher (First Time Only)

1. Go to [marketplace.visualstudio.com/manage](https://marketplace.visualstudio.com/manage)
2. Click **Create publisher**
3. Fill in:
   - **ID**: `joneldominic-dev` (cannot be changed later)
   - **Name**: Your display name

### Step 3: Login with vsce

```bash
npx @vscode/vsce login joneldominic-dev
# Paste your PAT when prompted
```

### Step 4: Package the Extension

```bash
# Create .vsix package (for testing or manual distribution)
npx @vscode/vsce package

# This creates: file-markers-1.0.0.vsix
```

### Step 5: Publish

```bash
# Publish current version
npx @vscode/vsce publish

# Or publish with version bump
npx @vscode/vsce publish patch  # 1.0.0 → 1.0.1
npx @vscode/vsce publish minor  # 1.0.0 → 1.1.0
npx @vscode/vsce publish major  # 1.0.0 → 2.0.0
```

### Verifying Publication

After publishing, verify at:
- Marketplace: `https://marketplace.visualstudio.com/items?itemName=joneldominic-dev.file-markers`
- Install command: `code --install-extension joneldominic-dev.file-markers`

### Publishing Checklist

Before each release:

- [ ] Update version in `package.json`
- [ ] Update `CHANGELOG.md` with new version
- [ ] Run `pnpm run compile` (checks types and linting)
- [ ] Test extension locally with F5
- [ ] Run `npx @vscode/vsce ls` to verify package contents
- [ ] Run `npx @vscode/vsce package` to create .vsix
- [ ] Install .vsix locally to verify: `code --install-extension file-markers-X.X.X.vsix`
- [ ] Publish: `npx @vscode/vsce publish`

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing publisher" | Add `"publisher": "joneldominic-dev"` to package.json |
| "Icon not found" | Ensure `images/icon.png` exists and path is correct |
| "Invalid version" | Use semver format: `major.minor.patch` only |
| PAT expired | Create a new PAT and run `vsce login` again |

### Useful Commands

```bash
# Check what files will be included
npx @vscode/vsce ls

# Package without publishing
npx @vscode/vsce package

# Unpublish (remove from marketplace)
npx @vscode/vsce unpublish joneldominic-dev.file-markers

# Show extension info
npx @vscode/vsce show joneldominic-dev.file-markers
```

## Go further

* Reduce the extension size and improve the startup time by [bundling your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
* [Publish your extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VS Code extension marketplace.
* Automate builds by setting up [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration).
