# OpenTab VS Code Extension

![OpenTab logo](./logo.png)

OpenTab is a minimal, explicit tablature format. This extension adds editor support for `.otab` files.

## Features

- Syntax highlighting
- Format Document
- Preview (ASCII)
- Export ASCII
- Export MIDI
- Play MIDI (opens default player)

## How to use

1. Install the extension.
2. Open or create an `.otab` file.
3. Use the Command Palette to run OpenTab commands:
   - `OpenTab: Format Document`
   - `OpenTab: Preview (ASCII)`
   - `OpenTab: Export ASCII`
   - `OpenTab: Export MIDI`
   - `OpenTab: Play MIDI`

## Screenshots

_Screenshot placeholders (add images when available):_

- Preview (ASCII)
- Export MIDI

## Install

### From Marketplace

_Placeholder until published._  
https://marketplace.visualstudio.com/items?itemName=Homeputers.opentab-vscode

### From VSIX

1. Build the package:
   ```bash
   npm run vsce:package
   ```
2. Install the generated `.vsix`:
   ```bash
   code --install-extension opentab-vscode-*.vsix
   ```

### Publish

Ensure dependencies are installed before publishing (required for `vsce` validation):

```bash
npm run vsce:publish
```

### Dev run

1. Open this folder (`editors/vscode`) in VS Code.
2. Press `F5` to launch an Extension Development Host.
3. In the new window, open or create an `.otab` file to see highlighting.

## Contributing

See the root documentation and specification for OpenTab guidelines:

- https://github.com/homeputers/opentab/blob/main/README.md
- https://github.com/homeputers/opentab/blob/main/spec/
