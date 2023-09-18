// Tracking
//  - https://paper.dropbox.com/doc/atom-vscode--B_1pTajtClXUnlRg8vKINs~QAg-h1pVZyCsdouFUaDxCTofw

// This file is run by this extension: https://github.com/bodil/vscode-init-script
//  - NOTE Must `cd ~/Library/Application Support/Code/User/ && npm install`
//    - https://github.com/bodil/vscode-init-script/pull/3/files
//    - https://www.npmjs.com/package/vscode (1.1.37) -> https://www.npmjs.com/package/@types/vscode (^1.62.0)
//  - NOTE If you upgrade "@types/vscode":"1.62.0" in package.json, I _think_ you have to upgrade package.json in the extension as well
//    - When I tried upgrading our ~/.code/package.json from 1.62.0 -> 1.82.0 I got a lot of weird errors (from the extension?)
//    - To update the extension's package.json, clone it into ~/hack/vscode/ and install it locally as a vsix (like advanced-open-file)

// XXX Got stuck on node imports, gave up and switched to lodash + crypto-js
// import "node";
// import * as crypto from "crypto";
// import * as path from "path";
// import "node/crypto";
// import "node/path";

import * as vscode from "vscode";

// import * as CryptoJS from 'crypto-js';
// import * as _ from "lodash";

export async function init(context: vscode.ExtensionContext) {
  const config = vscode.workspace.getConfiguration();
  const output = vscode.window.createOutputChannel('init.ts')

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

  // HACK Fix lost-focus bug when a terminal editor closes because the process exits (e.g. ^D in a shell)
  //  - [2023-09-18] I can't even find a github issue about it :/ (and I haven't slowed down to file one, but I should)
  function fixFocus(editor: any) {
    if (!editor) return;
    // output.appendLine(`editor: ${editor}`); // Where does this logging go?
    // throw `STOP_01: ${editor}`; // Logging hack
    vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
  }
  vscode.window.onDidCloseTerminal(fixFocus);
  // vscode.window.onDidChangeActiveTextEditor(fixFocus);
  // vscode.window.onDidChangeActiveTerminal(fixFocus);
  // vscode.window.onDidChangeActiveNotebookEditor(fixFocus); // TODO Requires upgrading @types/vscode in package.json (see note at top)

}

//
// Utils
//

function jsonPretty(x: any): string {
  return JSON.stringify(x, null, 2);
}

// function sha1HexShort(x: string, n: number = 8): string {
//   return sha1Hex(x).substr(0, n);
// }
//
// function sha1Hex(x: string): string {
//   return CryptoJS.SHA256(x).toString(CryptoJS.enc.Hex);
// }
