# OpenTab VS Code Webview Message Protocol

This document defines the message contract between the OpenTab VS Code extension
and the preview webview. All messages use a shared envelope:

```json
{
  "type": "<message-type>",
  "payload": { }
}
```

## Extension → Webview

### `init`
Sent when the preview webview is first rendered.

```json
{
  "type": "init",
  "payload": {
    "filename": "example.otab",
    "html": "<div class=\"tab\">...</div>",
    "validationHtml": "<section class=\"validation\">...</section>",
    "midi": {
      "dataBase64": "...",
      "timingMap": {
        "events": [],
        "measures": []
      }
    }
  }
}
```

### `update`
Sent whenever the preview content changes (e.g., document edits).

```json
{
  "type": "update",
  "payload": {
    "filename": "example.otab",
    "html": "<div class=\"tab\">...</div>",
    "validationHtml": "<section class=\"validation\">...</section>",
    "midi": {
      "dataBase64": "...",
      "timingMap": {
        "events": [],
        "measures": []
      }
    }
  }
}
```

### `errors`
Sent when rendering fails.

```json
{
  "type": "errors",
  "payload": {
    "message": "Invalid OpenTab syntax.",
    "lineNumber": 12
  }
}
```

### `play`
Requests the webview to begin playback.

```json
{
  "type": "play",
  "payload": {
    "positionSeconds": 0
  }
}
```

### `pause`
Requests the webview to pause playback.

```json
{
  "type": "pause",
  "payload": {
    "positionSeconds": 12.4
  }
}
```

### `stop`
Requests the webview to stop playback and reset position.

```json
{
  "type": "stop",
  "payload": {
    "positionSeconds": 0
  }
}
```

### `seek`
Requests a seek to a specific playback position.

```json
{
  "type": "seek",
  "payload": {
    "positionSeconds": 42.5
  }
}
```

## Webview → Extension

### `ready`
Indicates the webview has loaded and is ready to receive messages.

```json
{
  "type": "ready",
  "payload": {}
}
```

### `play`
Sent when the webview begins playback via its UI.

```json
{
  "type": "play",
  "payload": {
    "positionSeconds": 0
  }
}
```

### `pause`
Sent when the webview pauses playback via its UI.

```json
{
  "type": "pause",
  "payload": {
    "positionSeconds": 12.4
  }
}
```

### `seek`
Sent when the user seeks to a new playback position.

```json
{
  "type": "seek",
  "payload": {
    "positionSeconds": 42.5
  }
}
```
