# OpenTab VS Code Extension

![OpenTab logo](./logo.png)

OpenTab is a minimal, explicit tablature format. This extension adds editor support for `.otab` files.

## Features

- Syntax highlighting for OpenTab files
- Comment support
- Formatting command (`OpenTab: Format Document`)
- (Optional) Validation support when the bundled validator is enabled

## Screenshots

_Coming soon. Screenshots will be added once the Marketplace listing is live._

## Install

### From Marketplace

_Placeholder until published._  
https://marketplace.visualstudio.com/items?itemName=Homeputers.opentab-vscode

### From VSIX

1. Build the package:
   ```bash
   npx vsce package
   ```
2. Install the generated `.vsix`:
   ```bash
   code --install-extension opentab-vscode-*.vsix
   ```

### Dev run

1. Open this folder (`editors/vscode`) in VS Code.
2. Press `F5` to launch an Extension Development Host.
3. In the new window, open or create an `.otab` file to see highlighting.

## Contributing

See the root documentation and specification for OpenTab guidelines:

- https://github.com/homeputers/opentab/blob/main/README.md
- https://github.com/homeputers/opentab/blob/main/spec/
