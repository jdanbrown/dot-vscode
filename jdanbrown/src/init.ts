// Tracking
//  - https://paper.dropbox.com/doc/atom-vscode--B_1pTajtClXUnlRg8vKINs~QAg-h1pVZyCsdouFUaDxCTofw

import * as path from "path";
import * as vscode from "vscode";
import { spawn } from "child_process";

// Used to have these, add them back to package.json if we need them again
// import * as CryptoJS from 'crypto-js';
// import * as _ from "lodash";

export function activate(context: vscode.ExtensionContext) {
  console.info('[jdanbrown] activate');
  fixLostFocusBug(context);
  registerCommandsQuitAndRestart(context);
  registerCommandsTerminalScrollHalfPage(context);
  registerCommandsTerminalRerunCommandInRecentTerminal(context);
  registerCommandsToggleGutter(context);
  registerCommandsQuickOpenMagit(context);
  registerCommandsFixWorkspaceSettings(context);
  registerCommandsPylance(context);
  registerImageViewer(context);
  console.info('[jdanbrown] activate: Done');
}

// HACK Fix lost-focus bug when a terminal editor closes because the process exits (e.g. ^D in a shell)
//  - [2023-09-18] I can't even find a github issue about it :/ (and I haven't slowed down to file one, but I should)
export function fixLostFocusBug(context: vscode.ExtensionContext) {
  console.info('[jdanbrown] fixLostFocusBug');
  vscode.window.onDidCloseTerminal((editor: vscode.Terminal) => {
    if (!editor) { return; }
    // console.log(editor) // XXX Debug
    vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
  });
}

export function registerCommandsQuitAndRestart(context: vscode.ExtensionContext) {
  console.info('[jdanbrown] registerCommandsQuitAndRestart');
  context.subscriptions.push(
    vscode.commands.registerCommand('jdanbrown.quitAndRestart', async () => {
      // Distinguish "Visual Studio Code" vs. "Visual Studio Code - Insiders"
      const appName = vscode.env.appName;
      // vscode doesn't expose electron `app.quit(); app.relaunch()`, so we have to DIY this
      //  - Poll for the app to finish exiting, else the relaunch will do nothing
      //  - To relaunch, I do `.../bin/code` instead of `open -a "${appName}"` because the latter does nothing (with detach)
      //    - [claude] Maybe because `open` goes through macos LaunchServices, which gets messed up under detach 🤷
      const command = `
        osascript \
          -e 'quit app "${appName}"' \
          -e 'repeat with i from 1 to 100' \
          -e '  if not (application "${appName}" is running) then exit repeat' \
          -e '  delay 0.1' \
          -e 'end repeat' \
          && '/Applications/${appName}.app/Contents/Resources/app/bin/code'
      `;
      console.info(`[jdanbrown.quitAndRestart] spawn: ${command}`);
      // Must spawn (not exec) for the child process to keep running after our process exits
      //  - https://nodejs.org/api/child_process.html#child_processspawncommand-args-options
      const subprocess = spawn(command, {
        // Detach from the parent
        detached: true,
        stdio: 'ignore',
        // Run command in a shell
        shell: true,
      });
      // Prevent the parent from waiting for the detached child to exit
      subprocess.unref();
    }),
  );
}

export function registerCommandsTerminalScrollHalfPage(context: vscode.ExtensionContext) {
  console.info('[jdanbrown] registerCommandsTerminalScrollHalfPage');

  function terminalScrollHalfPage(direction: 'up' | 'down') {

    // Get terminal
    const terminal = vscode.window.activeTerminal;
    if (!terminal) {
      // Noop if active tab isn't a terminal
      return;
    };

    // Get terminal rows/height
    //  - Bug (2023-09-18, v1.82.0): Terminal.dimensions is undefined on persistent terminals restored after window reload
    // @ts-ignore: TODO Why type error on .dimensions?
    const dims: undefined | {rows: number, columns: number} = terminal.dimensions;
    // Terminals have 255 rows when maximized on my big vertical monitors
    //  - NOTE This will scroll too much (usually by 2x) when terminals are inside vertical splits
    const NUM_ROWS_IF_UNDEFINED = 255;
    if (!dims) {
      console.warn(
        `Terminal.dimensions undefined, using rows=${NUM_ROWS_IF_UNDEFINED} (bug with persistent terminals after reload)`
      );
    }
    const rows = dims ? dims.rows : NUM_ROWS_IF_UNDEFINED;
    // vscode.window.showInformationMessage(`Hello: dims[${JSON.stringify(dims)}], rows[${rows}]`); // XXX Debug

    // Scroll terminal
    //  - Terminal api doesn't expose scrolling/revealRange, so instead we resort to lots of scrollDown/scrollUp
    //    - Good details here on why:
    //      - https://github.com/microsoft/vscode/issues/79063
    //    - Compare with revealRange in TextEditor/NotebookEditor:
    //      - https://code.visualstudio.com/api/references/vscode-api#TextEditor -> revealRange
    //      - https://code.visualstudio.com/api/references/vscode-api#NotebookEditor -> revealRange
    //      - https://code.visualstudio.com/api/references/vscode-api#Terminal -> nope
    for (let _ in range(Math.floor(rows / 2))) {
      vscode.commands.executeCommand({
        'down': 'workbench.action.terminal.scrollDown',
        'up': 'workbench.action.terminal.scrollUp',
      }[direction]);
    }

  }

  context.subscriptions.push(
    vscode.commands.registerCommand('jdanbrown.terminal.scrollUpHalfPage', () => terminalScrollHalfPage('up')),
    vscode.commands.registerCommand('jdanbrown.terminal.scrollDownHalfPage', () => terminalScrollHalfPage('down')),
  );

}

export function registerCommandsTerminalRerunCommandInRecentTerminal(context: vscode.ExtensionContext) {
  console.info('[jdanbrown] registerCommandsTerminalRerunCommandInRecentTerminal');
  context.subscriptions.push(
    vscode.commands.registerCommand('jdanbrown.terminal.rerunCommandInRecentTerminal', async () => {
      const config = vscode.workspace.getConfiguration();

      // Save focused editor
      //  - "The active editor is the one that currently has focus or, when none has focus, the one that has changed input most recently"
      //    - https://code.visualstudio.com/api/references/vscode-api#window
      //  - TODO Only save if active editor is focused
      //    - Blocked on this request to add isFocused to the api:
      //      - https://github.com/microsoft/vscode/issues/117980 API to determine whether integrated terminal has focus
      //    - Workaround: Guard the whole command on "when":"editorFocus" in keybindings.json, so that we never save unfocused editors
      const textEditor = vscode.window.activeTextEditor;
      if (textEditor) {
        await textEditor.document.save();
      }

      // Get last focused terminal
      //  - "The active terminal is the one that currently has focus or most recently had focus"
      //    - https://code.visualstudio.com/api/references/vscode-api#window
      const terminal = vscode.window.activeTerminal;
      if (terminal) {

        // Make terminal visible in case it wasn't
        //  - Do this to give the user feedback that they triggered this, e.g. in case it was unintentional
        terminal.show(true); // true to preserve existing focus (don't switch focus to the terminal)

        // Send control characters
        //  - http://xtermjs.org/docs/api/vtfeatures/
        const esc = '\x1B';
        const csi = `${esc}[`;
        const up = `${csi}A`;
        const enter = '\n';
        const keys = [
          // up, enter, // Oops, nope, I disabled up/down arrow keys in .inputrc
          esc, 'k', enter, // This works if .inputrc uses `editing-mode vi`
        ];
        terminal.sendText(keys.join(''), false); // false for no final newline

      }
    }),
  );
}

export function registerCommandsToggleGutter(context: vscode.ExtensionContext) {
  console.info('[jdanbrown] registerCommandsToggleGutter');

  // Toggle gutter visibility
  //  - Useful e.g. for showing debug breakpoint decorations
  //  - Here we only toggle glyphMargin because that's the only one we ever care about
  //    - https://code.visualstudio.com/docs/getstarted/settings
  //        // Controls whether the editor should render the vertical glyph margin. Glyph margin is mostly used for debugging.
  //        "editor.glyphMargin": true,
  //  - What are all the parts of the gutter?
  //    - https://github.com/microsoft/vscode/issues/30795#issuecomment-410998882
  //        "editor.glyphMargin": false,
  //        "editor.folding": false,
  //        "editor.lineNumbers": "off",
  //        "workbench.activityBar.visible": false
  //        "editor.lineDecorationsWidth": 0, // undocumented
  //        "editor.lineNumbersMinChars": 0,  // undocumented
  //  - Example code for how to use Configuration
  //    - https://github.com/microsoft/vscode-extension-samples/blob/main/configuration-sample/src/extension.ts
  //  - Docs
  //    - https://code.visualstudio.com/api/references/vscode-api#WorkspaceConfiguration
  context.subscriptions.push(
    vscode.commands.registerCommand('jdanbrown.editor.toggleGutter', async () => {
      const config = vscode.workspace.getConfiguration();
      // Toggle visibility for:
      //  - breakpoints -- glyphMargin
      //  - bookmarks -- glyphMargin
      //  - git decorations -- folding
      await config.update('editor.glyphMargin', !config.get<boolean>('editor.glyphMargin'), vscode.ConfigurationTarget.Workspace);
      await config.update('editor.folding', !config.get<boolean>('editor.folding'), vscode.ConfigurationTarget.Workspace);
    }),
  );

}

export function registerCommandsQuickOpenMagit(context: vscode.ExtensionContext) {
  console.info('[jdanbrown] registerCommandsQuickOpenMagit');
  context.subscriptions.push(
    vscode.commands.registerCommand('jdanbrown.workbench.action.quickOpen.magit', () => {
      vscode.commands.executeCommand('workbench.action.quickOpen', '>magit:');
    }),
  );
}

export function registerCommandsFixWorkspaceSettings(context: vscode.ExtensionContext) {
  console.info('[jdanbrown] registerCommandsFixWorkspaceSettings');
  context.subscriptions.push(
    // HACK One of the databricks extensions keeps writing "jupyter.interactiveWindow.cellMarker.default": "# COMMAND ----------"
    //  - It only does it in the workspace settings
    //  - Not sure what causes it to trigger, but it seems to pretty reliably happen within ~1d or so
    //  - Not sure which databricks extension is doing it (official Databricks, or 3p Databricks Power Tools)
    //  - It messes up the "Jupyter: Insert Cell *" commands, because cellMarker is what those commands use for the `# %%` line
    vscode.commands.registerCommand('jdanbrown.fixWorkspaceSetting.jupyter.cellMarker', async () => {
      const config = vscode.workspace.getConfiguration();
      await config.update('jupyter.interactiveWindow.cellMarker.default', '# %%', vscode.ConfigurationTarget.Workspace);
    }),
  );
}

export function registerCommandsPylance(context: vscode.ExtensionContext) {
  console.info('[jdanbrown] registerCommandsPylance');
  context.subscriptions.push(
    vscode.commands.registerCommand('jdanbrown.python.pylance.undisable', async () => {
      const config = vscode.workspace.getConfiguration();
      await config.update('python.languageServer', undefined, vscode.ConfigurationTarget.Workspace);
    }),
    vscode.commands.registerCommand('jdanbrown.python.pylance.disable', async () => {
      const config = vscode.workspace.getConfiguration();
      await config.update('python.languageServer', 'None', vscode.ConfigurationTarget.Workspace);
    }),
  );
}

//
// ImageViewer
//

export function registerImageViewer(context: vscode.ExtensionContext) {
  console.info('[jdanbrown] registerImageViewer');
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider("imageViewer", new ImageViewerProvider(context), {
      supportsMultipleEditorsPerDocument: true,
    })
  );
}

class ImageViewerProvider implements vscode.CustomEditorProvider<ImageDocument> {
  private readonly context: vscode.ExtensionContext;

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
  }

  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Promise<ImageDocument> {
    return new ImageDocument(uri);
  }

  async resolveCustomEditor(
    document: ImageDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.file(path.dirname(document.uri.fsPath))
      ],
    };
    const imageUri = webviewPanel.webview.asWebviewUri(document.uri);
    webviewPanel.webview.html = this.makeHtml(imageUri.toString());
  }

  private makeHtml(imageSrc: string): string {
    return `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              margin: 0;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              background-color: var(--vscode-editor-background);
            }
            img {
              max-width: 100%;
              max-height: 100%;
            }
          </style>
        </head>
        <body>
          <img src="${imageSrc}" />
        </body>
      </html>
    `;
  }

  // Noop
  onDidChangeCustomDocument: vscode.Event<vscode.CustomDocumentContentChangeEvent<ImageDocument>> =
    new vscode.EventEmitter<vscode.CustomDocumentContentChangeEvent<ImageDocument>>().event;

  // Noop
  saveCustomDocument(document: ImageDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return Promise.resolve();
  }

  // Noop
  saveCustomDocumentAs(
    document: ImageDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Thenable<void> {
    return Promise.resolve();
  }

  // Noop
  revertCustomDocument(document: ImageDocument, cancellation: vscode.CancellationToken): Thenable<void> {
    return Promise.resolve();
  }

  // Noop
  backupCustomDocument(
    document: ImageDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Thenable<vscode.CustomDocumentBackup> {
    return Promise.resolve({
      id: document.uri.toString(),
      delete: () => {},
    });
  }

}

class ImageDocument implements vscode.CustomDocument {
  readonly uri: vscode.Uri;

  constructor(uri: vscode.Uri) {
    this.uri = uri;
  }

  dispose(): void {
    // Clean up resources if needed
  }
}

//
// Utils
//

function jsonPretty(x: any): string {
  return JSON.stringify(x, null, 2);
}

function range(n: number): Array<number> {
  if (!Number.isInteger(n)) {
    throw new Error(`Must be integer: n[${n}]`);
  }
  return Array.from(Array(n).keys());
}

// function sha1HexShort(x: string, n: number = 8): string {
//   return sha1Hex(x).substr(0, n);
// }
//
// function sha1Hex(x: string): string {
//   return CryptoJS.SHA256(x).toString(CryptoJS.enc.Hex);
// }
