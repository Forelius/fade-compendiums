# Project-Specific PowerShell Profile Setup

This directory contains PowerShell scripts that provide a project-specific development environment with:
- **Separate command history** - Commands are saved to `PowerShell_History.txt` in the project root
- **Auto-detected npm script aliases** - Automatically creates shortcuts for all npm scripts in package.json
- **Project context** - Window title shows the current project name

## Usage

### PowerShell launch
```powershell
cd "path\to\your\project"
powershell.exe -NoExit -ExecutionPolicy Bypass -Command "& 'scripts\ps\PowerShell_Profile.ps1' -ProjectName 'your-project'"
```

## Available Aliases

The profile automatically detects and creates aliases for **all npm scripts** in your `package.json`. For this project, that includes:
- `packdump` - Dump packs from LevelDB
- `packrestore` - Restore packs to LevelDB  
- `packextract` - Extract packs to JSON
- `packcompile` - Compile JSON to packs
- `decomppacks` - Full decompile workflow
- `comppacks` - Full compile workflow

## Features

- **Isolated History**: Command history is saved separately per project in `PowerShell_History.txt`
- **Dynamic Project Context**: Window title automatically shows the current project name
- **Auto-detection**: Automatically discovers npm scripts from `package.json`
- **Welcome Message**: Shows available aliases and project info when profile loads

## Customization

To adapt this setup for your project:

1. **Copy the files**: Copy the `scripts\ps` folder to your new project
2. **Update project name**: Change the project name when calling the PowerShell profile script
3. **Add to .gitignore**: Ensure `PowerShell_History.txt` is ignored by version control

## File Structure

```
your-project/
├── PowerShell_History.txt        # Project command history (auto-created, git-ignored)
└── scripts/
    └── ps/
        ├── PowerShell_Profile.ps1 # Main profile script
        └── README.md              # This documentation
```