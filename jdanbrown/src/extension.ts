// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.info('[jdanbrown-init] activate');

  function scrollHalfPage(direction: 'up' | 'down') {

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
    vscode.commands.registerCommand('jdanbrown-init.terminal.scrollUpHalfPage', () => scrollHalfPage('up')),
    vscode.commands.registerCommand('jdanbrown-init.terminal.scrollDownHalfPage', () => scrollHalfPage('down')),
  );

}

// This method is called when your extension is deactivated
export function deactivate() {}

function range(n: number): Array<number> {
  if (!Number.isInteger(n)) {
    throw new Error(`Must be integer: n[${n}]`);
  }
  return [...Array(n).keys()];
}
