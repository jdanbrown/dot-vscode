// Tracking
//  - https://paper.dropbox.com/doc/atom-vscode--B_1pTajtClXUnlRg8vKINs~QAg-h1pVZyCsdouFUaDxCTofw

import * as vscode from 'vscode';

// Used to have these, add them back to package.json if we need them again
// import * as CryptoJS from 'crypto-js';
// import * as _ from "lodash";

export function activate(context: vscode.ExtensionContext) {
  console.info('[jdanbrown] activate');
  fixLostFocusBug(context);
  registerCommandsTerminalScrollHalfPage(context);
  registerCommandsToggleGutter(context);
  _attic(context);
}

export function _attic(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration();
  const output = vscode.window.createOutputChannel('init.ts');

  // output.appendLine(`terminals: ${jsonPretty(vscode.window.terminals.map(x => ({name: x.name, processId: x.processId})))}`);
  // output.appendLine(`workspace: ${jsonPretty({
  //   name: vscode.workspace.name,
  //   workspaceFile: vscode.workspace.workspaceFile,
  //   rootPath: vscode.workspace.rootPath,
  // })}`);
  // output.appendLine(`context: ${jsonPretty({
  //   workspaceState: {
  //     keys: context.workspaceState.keys(),
  //   },
  // })}`);

  // NOTE Howto persist state (across restart/reload) at workspace scope (global scope also available, which we don't want)
  //  - https://code.visualstudio.com/api/references/vscode-api#ExtensionContext
  //  - https://code.visualstudio.com/api/references/vscode-api#Memento
  // await context.workspaceState.update('junk-0', 'a');       // Update key
  // await context.workspaceState.update('junk-0', undefined); // Delete key

  // // TODO
  // //  - Rename command
  // //  - Good otherwise?
  // vscode.commands.registerCommand('userInitTs.terminal.new', () => {
  //   const workspacePath = vscode.workspace.workspaceFile.path // TODO Don't persist terminals if no path (i.e. workspace isn't saved)
  //   const workspacePathBasename = workspacePath.split('/').pop().split('.')[0];
  //   const nowStr = new Date().toISOString().replace(/[-:.]/g, '');
  //   const termUid = `${workspacePathBasename}-${sha1HexShort(workspacePath)}-${nowStr}`;
  //   // output.appendLine(`termUid: ${termUid}`);
  //   // vscode.window.showInformationMessage(`termUid: ${termUid}`);
  //   vscode.window.createTerminal({
  //     // shellPath: 'bash', shellArgs: ['-l'], // XXX Debug
  //     shellPath: 'tmux-new-or-attach-vscode-term-uid', // NOTE Requires "terminal.integrated.inheritEnv":true (default)
  //     env: {VSCODE_TERM_UID: termUid}, // For tmux-new-or-attach-vscode-term-uid
  //   });
  // });

  // TODO Terminal persistence
  //  - [updated] Review vscode's WIP first
  //    - https://github.com/microsoft/vscode/labels/terminal-persistence
  //  - How to reopen `foo-*` terms after restart? (reload already works, via its own magic)
  //    - Add a command that lists them and then manually opens them all
  //    - Pane positions/layout won't be restored, but that's fine (and status quo)
  //  - https://code.visualstudio.com/api/references/vscode-api
  //    - https://code.visualstudio.com/api/references/vscode-api#Terminal
  //    - https://code.visualstudio.com/api/references/vscode-api#TerminalOptions

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
  vscode.commands.registerCommand('jdanbrown.editor.toggleGutter', async () => {
    const config = vscode.workspace.getConfiguration();
    await config.update('editor.glyphMargin', !config.get<boolean>('editor.glyphMargin'), vscode.ConfigurationTarget.Workspace);
  });

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
  return [...Array(n).keys()];
}

// function sha1HexShort(x: string, n: number = 8): string {
//   return sha1Hex(x).substr(0, n);
// }
//
// function sha1Hex(x: string): string {
//   return CryptoJS.SHA256(x).toString(CryptoJS.enc.Hex);
// }
