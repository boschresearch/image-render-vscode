// Python interface to call the various python scripts

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
const { exec } = require("child_process");

// Helper function to produce absolute path to python scripts shipped with this extension in the ressources folder
export function get_python_script_path(Name: string): string {
	var extensiondata = vscode.extensions.getExtension('undefined_publisher.CatharsysPainkiller')
	var extensionpath = extensiondata!.extensionPath
	return path.join(extensionpath, 'resources', Name);
}

// Helper function that produces the absolute path to the catharsys workspace folder, i.e. the folder containing 
// the workspapce file in case of a multiroot ws, or the workspacefolder if vscode is running in folder mode
export function get_cathy_workspace_folder(): string {
	if (vscode.workspace.workspaceFile) {
		return vscode.workspace.getWorkspaceFolder(vscode.workspace.workspaceFile).uri.fsPath
	}
	else {
		return vscode.workspace.workspaceFolders[0].uri.fsPath
	}
}

// Helper function that executes the passed callstring as systemcommand, collects the stdout and returns it as JSON
export function exec_return_json(callstring: string): Thenable<JSON> {
	console.log(`executing: ${callstring}`)

	interface Execution_Options {
		shell?: string,
		timeout?: number,
	}
	var Exec_opts: Execution_Options;

	if (check_for_linux()) {
		Exec_opts = { shell: "/bin/bash", timeout: 50000 }
	}
	else {
		Exec_opts = { timeout: 50000 }
	}
	return new Promise((resolve, reject) => {
		exec(callstring, Exec_opts, (error, stdout, stderr) => {
			if (error) {
				console.log(`stdout: ${stdout}`);
				console.log(``);
				console.log(`error: ${error.message}`);
				reject(error);
			}
			if (stderr) {
				console.log(`stdout: ${stdout}`);
				console.log(``);
				console.log(`stderr: ${stderr}`);
				reject(stderr);
			}
			// Attempt to parse the json data returned by the python script
			try {
				let res = JSON.parse(stdout)
				resolve(res)
			}
			catch (e) {
				console.log("Something went wrong parsing the returned JSON data:")
				console.log(stdout)
				reject(stdout);
			}
		});
	})
}

// need to check if running on linux to decide whether conda deactivate is needed or not
export function check_for_linux(): boolean {
	const os = require('node:os');
	if (os.platform() == "linux") {
		console.log("Running on Linux!!!")
	}
	else {
		console.log("Running not on Linux!!!")
	}
	return (os.platform() == "linux")
}

// Helper function to construct the correct call string for calling a python script
export function construct_conda_call_path(pythonscriptname: string) {
	var condaenvironment = vscode.workspace.getConfiguration("Image-Render-Automation").condaenv;
	var condapath = vscode.workspace.getConfiguration("Image-Render-Automation").condapath;

	// need to extract the extensionpath to acutally find the python scripts shipped with the extension
	var myPythonScriptPath = get_python_script_path(pythonscriptname)
	var workspacefolder = get_cathy_workspace_folder()

	if (check_for_linux()) {
		// if running on linux, use the condapath to ensure correct python is called
		return `${condapath} run -n ${condaenvironment} python "${myPythonScriptPath}" ${condaenvironment} ${workspacefolder}`
	}
	else {
		return `conda deactivate && conda run -n ${condaenvironment} python "${myPythonScriptPath}" ${condaenvironment} ${workspacefolder}`
	}
}


//  Wrapper calling the python script using the catharsys api to get all configs and their actions
export function find_all_configs_and_actions(): Thenable<JSON> {
	return exec_return_json(construct_conda_call_path('get_cathy_configs.py'))
}

//  Wrapper calling the python script using the catharsys api to get all magic inline functions and their tooltips
export function find_all_inline_tooltips(): Thenable<JSON> {
	return exec_return_json(construct_conda_call_path('get_cathy_inline_tooltips.py'))
}

//  Wrapper calling the python script using the catharsys api to extract all catharsys inline variable defintion sources in the workspace
export function find_all_variable_defs(): Thenable<JSON> {
	return exec_return_json(construct_conda_call_path('get_cathy_variables.py'))
}

//  Wrapper calling the python script extracting linktargets
export function extract_linktarget_data(): Thenable<JSON> {
	return exec_return_json(construct_conda_call_path('extract_linktargetdata.py'))
}

// Wrapper calling the python script extracting catharsys installation repo information
export function extract_installation_status(): Thenable<JSON> {
	return exec_return_json(construct_conda_call_path('get_cathy_repos.py'))
}

// Wrapper calling the python script executing git fetch on all catharsys installation repos
export function fetch_cathy_repos(): Thenable<JSON> {
	return exec_return_json(construct_conda_call_path('fetch_cathy_repos.py'))
}