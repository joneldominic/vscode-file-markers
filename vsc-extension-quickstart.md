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

## Publishing to Open VSX (for Cursor, VSCodium, Gitpod)

The VS Code Marketplace is only available in Microsoft's VS Code. For other editors like **Cursor**, **VSCodium**, and **Gitpod**, you need to publish to the **Open VSX Registry**.

| Editor | Marketplace |
|--------|-------------|
| VS Code | [marketplace.visualstudio.com](https://marketplace.visualstudio.com) |
| Cursor, VSCodium, Gitpod | [open-vsx.org](https://open-vsx.org) |

### Prerequisites

1. **Eclipse Account** - Register at [accounts.eclipse.org](https://accounts.eclipse.org) with your GitHub username matching your open-vsx.org account
2. **Publisher Agreement** - Sign the Eclipse Publisher Agreement via your open-vsx.org profile settings
3. **Access Token** - Generate from open-vsx.org for authentication

### Step 1: Create Open VSX Account

1. Go to [open-vsx.org](https://open-vsx.org)
2. Click **Sign in** (use GitHub account)
3. Go to your profile settings and sign the **Eclipse Publisher Agreement**

### Step 2: Create Access Token

1. Go to [open-vsx.org/user-settings/tokens](https://open-vsx.org/user-settings/tokens)
2. Click **Generate New Token**
3. Give it a description (e.g., "CLI publishing")
4. **Copy the token immediately** - it's never displayed again after closing the dialog!

> **Security Tip**: Generate separate tokens for different environments (local machine, CI builds, cloud IDEs).

### Step 3: Create Namespace (First Time Only)

Before publishing, create a namespace matching your `publisher` field in package.json:

```bash
npx ovsx create-namespace joneldominic-dev -p <your-token>
```

> **Note**: Creating a namespace doesn't automatically verify ownership. To get the "verified" badge, claim it separately through your profile settings.

### Step 4: Publish to Open VSX

```bash
# Option A: Publish using existing .vsix file (recommended)
npx ovsx publish file-markers-1.0.0.vsix -p <your-token>

# Option B: Publish from source (runs vscode:prepublish script)
npx ovsx publish -p <your-token>

# For Yarn projects, add --yarn flag
npx ovsx publish --yarn -p <your-token>
```

### Verifying Publication

After publishing, verify at:
- Open VSX: `https://open-vsx.org/extension/joneldominic-dev/file-markers`
- The extension should now appear in Cursor's extension search

### Manual Installation (Alternative)

If you haven't published to Open VSX yet, users can install manually:

1. Download the `.vsix` file
2. In Cursor/VSCodium, press `Cmd+Shift+P` (or `Ctrl+Shift+P`)
3. Type **"Install from VSIX"**
4. Select the `.vsix` file

### Publishing to Both Marketplaces

For maximum reach, publish to both marketplaces:

```bash
# Build the package once
npx @vscode/vsce package

# Publish to VS Code Marketplace
npx @vscode/vsce publish

# Publish to Open VSX (use the .vsix created above)
npx ovsx publish file-markers-1.0.0.vsix -p <your-ovsx-token>
```

### CI/CD Automation

For automated publishing, use the [publish-vscode-extension](https://github.com/HaaLeo/publish-vscode-extension) GitHub Action:

```yaml
# .github/workflows/publish.yml
name: Publish Extension

on:
  release:
    types: [published]

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm install
      - name: Publish to VS Code Marketplace
        uses: HaaLeo/publish-vscode-extension@v2
        with:
          pat: ${{ secrets.VSCE_PAT }}
          registryUrl: https://marketplace.visualstudio.com
      - name: Publish to Open VSX
        uses: HaaLeo/publish-vscode-extension@v2
        with:
          pat: ${{ secrets.OVSX_PAT }}
          registryUrl: https://open-vsx.org
```

### Open VSX Useful Commands

```bash
# Create namespace (first time only)
npx ovsx create-namespace <name> -p <token>

# Publish .vsix file
npx ovsx publish <file.vsix> -p <token>

# Publish from source
npx ovsx publish -p <token>

# Get extension info
npx ovsx get joneldominic-dev.file-markers
```

### References

- [Open VSX Publishing Guide](https://github.com/eclipse/openvsx/wiki/Publishing-Extensions)
- [publish-vscode-extension GitHub Action](https://github.com/HaaLeo/publish-vscode-extension)

## Go further

* Reduce the extension size and improve the startup time by [bundling your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension).
* [Publish your extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) on the VS Code extension marketplace.
* Automate builds by setting up [Continuous Integration](https://code.visualstudio.com/api/working-with-extensions/continuous-integration).
