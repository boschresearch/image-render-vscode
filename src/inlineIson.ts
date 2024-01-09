// module provides support for ison 
//inline functions
// hover over tooltip
// source provider
//ison variables
//source provider

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as pythy from "./PythonInterface"

//set up hover over provider for ison inline functions
export function set_up_ison_inline_tooltips(isonFuncData) {
    vscode.languages.registerHoverProvider(['json', "json5", "ison"], {
        provideHover(document, position, token) {
            var cont = [];
            let range = document.getWordRangeAtPosition(position);

            // looking for special Catharsys functions
            if (range) {
                let r2 = new vscode.Range(new vscode.Position(range.start.line, range.start.character - 1),
                    new vscode.Position(range.end.line, range.end.character + 2))
                let word = document.getText(r2);
                // handle special case of commands ending with a *, tokenization does not work properly for those cases
                if (word.slice(-2, -1) == "*") {
                    var command: string = word.slice(1, -1)
                } else {
                    var command: string = word.slice(1, -2)
                    word = word.slice(0, -1)
                }
                if ((word[0] == "$") && (word.slice(-1) == "{")) {
                    // Actually a catharsys magic inline command token
                    if (command in isonFuncData) {
                        // found tooltip
                        cont.push(isonFuncData[command]["tooltip"])
                    } else {
                        cont.push("Unnknown catharsys inline command, probably a bug!")
                    }
                }
            }

            return {
                contents: cont
            };
        }
    });

}

//set up Definition provider for ison inline functions
export function set_up_ison_inline_definition_provider(isonFuncData) {
    vscode.languages.registerDefinitionProvider(['json', "json5", "ison"], {
        provideDefinition(document, position, token) {
            let range = document.getWordRangeAtPosition(position);
            var cont: vscode.Location[] = [];

            // looking for special Catharsys functions
            if (range) {
                let r2 = new vscode.Range(new vscode.Position(range.start.line, range.start.character - 1),
                    new vscode.Position(range.end.line, range.end.character + 2))
                let word = document.getText(r2);
                // handle special case of commands ending with a *, tokenization does not work properly for those cases
                if (word.slice(-2, -1) == "*") {
                    var command: string = word.slice(1, -1)
                } else {
                    var command: string = word.slice(1, -2)
                    word = word.slice(0, -1)
                }
                if ((word[0] == "$") && (word.slice(-1) == "{")) {
                    // Actually a catharsys magic inline command token
                    if (command in isonFuncData) {
                        // found tooltip
                        let uriTarget = vscode.Uri.file(isonFuncData[command]["filename"]);
                        let rangeTarget = new vscode.Range(isonFuncData[command]["lineno"], 0, isonFuncData[command]["lineno"], 0);
                        cont = [new vscode.Location(uriTarget!, rangeTarget)];
                    }
                }
            }
            return cont;
        }
    });
}

// function to set up definition provider for user defined ison variables
// this variant expects static variable definitions
export function set_up_catharsys_variable_definition_provider(potential_definitions) {
    vscode.languages.registerDefinitionProvider(['json', "json5", "ison"], {
        provideDefinition(document, position, token) {
            let range = document.getWordRangeAtPosition(position);
            let variable = document.getText(range);

            let r2 = new vscode.Range(new vscode.Position(range.start.line, range.start.character - 2),
                new vscode.Position(range.end.line, range.end.character + 1))
            let subcommand = document.getText(r2);

            var cont: vscode.Location[] = [];

            let regex = /\${.*}/g
            if (regex.test(subcommand)) {
                // token is in fact catharsys variable
                // search for all fitting entries and construct Location objects accordingly
                for (var x of potential_definitions["variables"]) {
                    if (x[0] == variable) {
                        let uriTarget = vscode.Uri.file(x[1]);
                        let rangeTarget = new vscode.Range(x[2], 0, x[2], 0);
                        let l = new vscode.Location(uriTarget!, rangeTarget)
                        cont.push(l);
                    }
                }
            }
            return cont;
        }
    });
}


// function to set up definition provider for user defined ison variables
// this variant scanns the folder when needed, might be slow but it does not miss new variables :)
export function set_up_catharsys_variable_definition_provider_wip() {
    vscode.languages.registerDefinitionProvider(['json', "json5", "ison"], {
        provideDefinition(document, position, token) {
            var catharsys_variable_sources = pythy.find_all_variable_defs()
            var cont: vscode.Location[] = [];
            return catharsys_variable_sources.then(
                (potential_definitions) => {
                    let range = document.getWordRangeAtPosition(position);
                    let variable = document.getText(range);

                    let r2 = new vscode.Range(new vscode.Position(range.start.line, range.start.character - 2),
                        new vscode.Position(range.end.line, range.end.character + 1))
                    let subcommand = document.getText(r2);


                    let regex = /\${.*}/g
                    if (regex.test(subcommand)) {
                        // token is in fact catharsys variable
                        // search for all fitting entries and construct Location objects accordingly
                        for (var x of potential_definitions["variables"]) {
                            if (x[0] == variable) {
                                let uriTarget = vscode.Uri.file(x[1]);
                                let rangeTarget = new vscode.Range(x[2], 0, x[2], 0);
                                let l = new vscode.Location(uriTarget!, rangeTarget)
                                cont.push(l);
                            }
                        }
                    }
                    return cont;
                }
            )
        }
    });
}


// This function provides a list of outocomplete options for inline ISON functions
function complete_ison(document, position, token, context, isonFuncData) {
    var cont: vscode.CompletionItem[] = [];

    // Extract text from beginning of line to cursor position
    let range_to_cursor = new vscode.Range(new vscode.Position(position.line, 0), position)
    let linedata = document.getText(range_to_cursor)

    // find strig from $ sign to end of line
    let linedatatokens = linedata.split("$").reverse()
    let target = linedatatokens[0]
    // collect all ison functions which start with the target
    for (const k in isonFuncData) {
        if (k.startsWith(target)) {
            var compitem = new vscode.CompletionItem(k);
            compitem.documentation = "ISON function: \n" + isonFuncData[k].tooltip;
            cont.push(compitem)
        }
    }
    return cont
}

// set up Auto completion provider to complete sDTIs
export function set_up_ison_inline_auto_completion(isonFuncData) {

    vscode.languages.registerCompletionItemProvider(['json', "json5", "ison"],
        {
            provideCompletionItems(document, position, token, context) {
                return complete_ison(document, position, token, context, isonFuncData)
            }
        },
        "$"
    );

}
