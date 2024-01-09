// Defines Autocomplete, hover over tooltips and Defintion providers for Catharsys Modifiers

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { sDTI_tree, sDTI_group } from "./sDTI_tree";

// Function providing hover over docstrings for given location and linktargetdata to search
export function hover_over_sDTI_docstring(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, linktargetdata: sDTI_tree) {
    var cont: string[] = [];

    // check if string "sDTI" is present in line
    let location = document.lineAt(position.line).text.indexOf("sDTI");

    if (location > -1) {
        var lt_subtree = linktargetdata.match_sDTI_tree(document.lineAt(position.line).text)
        // var lt_subtree = match_sDTI_tree(document.lineAt(position.line).text, linktargetdata)
        if (lt_subtree != undefined) {
            let lt_subtree_ensured = lt_subtree as sDTI_group
            if (lt_subtree_ensured.leaf) {
                // echter modifier
                cont = ["This sDTI is a Catharsys modifier", "Modifier docstring:"].concat(lt_subtree_ensured.data.docstrings);
            } else {
                // intermediate modifier
                cont = ["This sDTI is a Catharsys modifier group"]
            }
        } else {
            // modifier was not found in tree
            cont = ["This sDTI is unknown, possibly a manually defined sDTI"]
        }
    }

    return {
        contents: cont
    };
}


// function providing defintion locations of catharsys modifiers
// for some reason I do not understand, the second time this function is called, a broken promise error (timeout 1s, c.replace is not a function) is thrown, 
// afterwards it runs perfect. Runtime in general is <0.2 ms, can't be the issue here  
export function provide_definition_sDTI(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, linktargetdata: sDTI_tree) {
    var cont: vscode.Location[] = [];

    // check if string "sDTI" is present in line
    let location = document.lineAt(position.line).text.indexOf("sDTI");

    if (location == -1) {
        // sDTI not found, thus nothing to provide herer
        return cont
    }
    var lt = linktargetdata.match_sDTI_tree(document.lineAt(position.line).text)
    if (lt != undefined) {
        let lt_ensured = lt as sDTI_group
        let uriTarget = vscode.Uri.file(lt_ensured.data.linkTarget);
        let rangeTarget = new vscode.Range(lt_ensured.data.line, 0, lt_ensured.data.line, 0);
        cont.push(new vscode.Location(uriTarget, rangeTarget))
    }
    return cont;
}


// providing sDTI modifier autocompletion using the new tree data structure
export function complete_sDTI(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken, context: vscode.CompletionContext, linktargetdata: sDTI_tree) {
    var cont: vscode.CompletionItem[] = [];

    // check if we are in the sDTI line already
    var location = -1;
    location = document.lineAt(position.line).text.indexOf("sDTI");

    if (location > -1) {
        // We are in a line containing the sDTI definition
        var tree = linktargetdata.match_sDTI_tree(document.lineAt(position.line).text, true)
        if (tree == undefined) {
            // sDTI not found, nothing to provide
            return cont
        }

        let tree_ensured = tree as sDTI_group
        for (var lt of tree_ensured.Elements) {
            if (lt.leaf) {
                // proper modifier
                var compitem = new vscode.CompletionItem(lt.name);
                compitem.documentation = lt.data.docstrings.join("\n");
                if (lt.data.parameters.length == 0) {
                    compitem.documentation = ["<Ask your Maintainer to properly document this modifier to enable parameter autocompletion ^^> \n\n"] + compitem.documentation
                }
            } else {
                // modifier group
                if (lt.name == "catharsys") {
                    var compitem = new vscode.CompletionItem("/" + lt.name + "/");
                } else {
                    var compitem = new vscode.CompletionItem(lt.name + "/");
                }
            }
            cont.push(compitem);
        }
        return cont
    } else {
        // not in sDTI definition line
        // find preceding curly braces
        // [Todo] verify this is always true. might be incorrect assumption in case of nested modifiers for instance
        var sDTI = "";
        for (let i = position.line; i--; i === 0) {
            let line = document.lineAt(i);

            // check if the sDTI is defined in this line
            let location = line.text.indexOf("sDTI");
            if (location > -1) {
                // found the sDTI of the modifier, extract it and stop looping
                sDTI = line.text.substring(location + 6);
                let locationStart = sDTI.indexOf("\"");
                sDTI = sDTI.substring(locationStart + 1);
                let locationEnd = sDTI.indexOf("\"");
                sDTI = sDTI.substring(0, locationEnd);
                break;
            }
            // simpliefied check: the next line above containing exactly one opening and no closing curly brace is the beginning of the modifier block, thus search for sDTI can stop now.
            // This assumes: that the open brace is always in a separate line, and that there are no multiline curly braces blocks in between the current line and the beginning 
            // of the modifier block
            if (line.text.split("{").length == 2 && line.text.split("}").length == 1) {
                break;
            }
        }
        // [Todo] add same loop as above in forward direction till next } in case the sDTI is not the first parameter
        if (sDTI !== "") {
            // found an sDTI within curly braces
            // search corresponding data
            var lt_hit = linktargetdata.match_sDTI_tree("\"" + sDTI + "\"")
            if (lt_hit == undefined) {
                return cont
            }

            let lt_ensured = lt_hit as sDTI_group

            if (lt_ensured.leaf) {
                for (let i = 0; i < lt_ensured.data.parameters.length; i++) {
                    let compitem = new vscode.CompletionItem(lt_ensured.data.parameters[i], 4);

                    // construct and set doc string of the catharsys parameter completion item
                    let mark = new vscode.MarkdownString()
                    mark.appendMarkdown(lt_ensured.data.parameter_info[i])
                    if (lt_ensured.data.parameter_info[i] != "") {
                        compitem.documentation = mark
                    }

                    cont.push(compitem)
                }
            }
        }
    }
    return cont;
}

// set up semantic token Builder to provide semantic information for sDTIs, in particular whether the sDTI belongs 
// to a modifier, a modifier group or an unknown/manual sDTI
// This is used for highlighting in the editor
export function set_up_semantic_tokens(linktargetdata: sDTI_tree) {
    const tokenTypes = ['sDTI'];
    const tokenModifiers = ['truesDTI', 'manualsDTI', 'groupsDTI'];
    const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

    const provider: vscode.DocumentSemanticTokensProvider = {
        provideDocumentSemanticTokens(
            document: vscode.TextDocument
        ): vscode.ProviderResult<vscode.SemanticTokens> {
            // analyze the document and return semantic tokens
            const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
            // identifiying sDTIs
            // iterate lines of the document
            for (var i = 0; i < document.lineCount; i++) {
                let location = document.lineAt(i).text.indexOf("sDTI");
                if (location > -1) {
                    // find sDTI
                    let candidate = linktargetdata.match_sDTI_tree(document.lineAt(i).text)
                    if (candidate != undefined) {
                        // modifier or modifier group
                        let candidate_ensured = candidate as sDTI_group
                        if (candidate_ensured.leaf) {
                            //modifier
                            tokensBuilder.push(
                                document.lineAt(i).range,
                                'sDTI',
                                ['truesDTI']
                            );
                        } else {
                            // modifier group
                            tokensBuilder.push(
                                document.lineAt(i).range,
                                'sDTI',
                                ['groupsDTI']
                            );
                        }
                    } else {
                        // manual sDTI
                        tokensBuilder.push(
                            document.lineAt(i).range,
                            'sDTI',
                            ['manualsDTI']
                        );
                    }
                }

            }

            return tokensBuilder.build();
        }
    };

    const selector = { language: 'ison', scheme: 'file' }; // register for all ison documents from the local file system

    vscode.languages.registerDocumentSemanticTokensProvider(selector, provider, legend);
}