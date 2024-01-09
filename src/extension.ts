// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';


const { exec } = require("child_process");

// lets see if we can define a tree data provider for Catharsys infos
// adapted from example code https://code.visualstudio.com/api/extension-guides/tree-view


import * as pythy from "./PythonInterface"
import * as ModifierSupport from "./ModifierSupport"
import * as inlineIson from "./inlineIson"
import { rejects } from 'assert';
import { sDTI_tree } from './sDTI_tree';
import { CatharsysTreeProvider, catharsys_action_TreeItem } from './CatharsysTreeProvider';

// Decoration provider responsible for the markup of catharsys module elements in the side panel
class ModuleDecorationProvider {
	disposables
	constructor() {
		this.disposables = [];
		this.disposables.push(vscode.window.registerFileDecorationProvider(this));
	}

	provideFileDecoration(uri) {
		let data = uri.path.split(",", 3)
		let color: vscode.ThemeColor
		if (data[0] == "/moduleinfo") {
			if (data[1] == "main") {
				// in devel branch
				if (data[2] == "0") {
					// up to date
					return {
						color: new vscode.ThemeColor("Modulestatus.devel_uptodate"),
					};
				}
				else {
					// not up to date, but devel branch at least
					return {
						color: new vscode.ThemeColor("Modulestatus.devel_outdated"),
					};
				}
			} else {
				// not in devel branch
				if (data[2] == "0") {
					// up to date
					return {
						color: new vscode.ThemeColor("Modulestatus.nondevel_uptodate"),
					};
				} else {
					// not up to date
					return {
						color: new vscode.ThemeColor("Modulestatus.nondevel_outdated"),
					};
				}
			}
		}
		// todo separate colordefinitions from the modulestatus color definitions
		if (data[0] == "/lsfinfo") {
			if (data[1] == "Done") {
				return {
					color: new vscode.ThemeColor("Modulestatus.devel_uptodate"),
				};

			}
			else if (data[1] == "Pending") {
				return {
					color: new vscode.ThemeColor("Modulestatus.devel_outdated"),
				};
			} else {
				return {
					color: new vscode.ThemeColor("Modulestatus.nondevel_outdated"),
				};
			}
		}
	}

	dispose() {
		this.disposables.forEach((d) => d.dispose());
	}
}

export class modulestatus {
	name: string;
	branch: string;
	branches: string[];
	outdatecounter: number;
	repopath: string;
	ready: Promise<boolean>;
	constructor(repopath: string, branches: string[]) {
		this.repopath = repopath
		this.branches = branches

		this.name = path.basename(repopath)

		this.ready = this.refresh()

	}

	// setup constructing the modulestatus by querying git, returns promise to be stored in this.ready to make sure the async queries are done before the values are used
	refresh(): Promise<boolean> {
		return new Promise((resolve, reject) => {
			// fetch_promise.then((res) => {
			console.log("fetched successfully from origin")
			// construct promise to extract pathname
			let branchname_promise = new Promise((resolve, reject) => {
				let callstring = `cd ${this.repopath} && git branch --show - current`
				exec(callstring, (error, stdout, stderr) => {
					if (error) {
						console.log(`error: ${error.message}`);
						reject(error);
					}
					if (stderr) {
						console.log(`stderr: ${stderr}`);
						reject(stderr);
					}
					// Attempt to parse the data returned
					try {
						resolve(stdout.split("\n", 1)[0])
					}
					catch (e) {
						console.log("Something went wrong extracting the git branchname:")
						console.log(stdout)
						reject(stdout);
					}
				});
			});

			branchname_promise.then((branchname: string) => {
				console.log(`Repo currently in branch ${branchname}`)
				this.branch = branchname
				// construct promes extracting how many commits we are behind origin
				let revisions_behind_promise = new Promise((resolve, reject) => {
					let callstring_revisions_behind = `cd ${this.repopath} && git rev-list --left-right --count ${branchname}...remotes/origin/${branchname}`
					exec(callstring_revisions_behind, { timeout: 5000 }, (error, stdout, stderr) => {
						if (error) {
							// command failed, usually this is due to a branch missing an upstream branch to track
							resolve(-1)
						}
						if (stderr) {
							// command failed, usually this is due to a branch missing an upstream branch to track
							resolve(-1)
						}
						// Attempt to parse the json data returned by the python script
						try {
							resolve(Number(stdout[2]))
						}
						catch (e) {
							console.log("Something went wrong parsing the returned JSON data:")
							console.log(stdout)
						}
					});
				});
				revisions_behind_promise.then((n_behind: number) => {
					this.outdatecounter = n_behind
					console.log(`We are ${n_behind} commits behind origin`)
					resolve(true)
				})

			})

		})

	}

	// construct uri string to be used for Decorating module entries in the side panel
	get_uri_string(): string {
		return `moduleinfo,${this.branch},${this.outdatecounter}`
	}
	// constructs display name consisting of repo name and branch in brackets
	get_display_name(): string {
		var oinfo: string
		if (this.outdatecounter == -1) {
			oinfo = "Local Branch"
		} else if (this.outdatecounter == 0) {
			oinfo = `Up to date`
		} else {
			oinfo = `Behind Origin by ${this.outdatecounter}`
		}
		return `${this.name} [${this.branch}] - [${oinfo}]`
	}
}


export function find_all_cathycommands(): Thenable<string[] | undefined> {
	// find all cathycommands.json files in the workspace and concatenate the stashed commands
	// Alternative would be via some kind of magic commands within files
	var cathycommands: string[] = [];
	let allFiles = vscode.workspace.findFiles('**/cathycommands.json', '**/_render/**').then(
		(value) => {
			for (let f of value) {
				// this works, but bricks when trying to refresh, require stuff is cached since normally used for modules
				// let fcontents = require(f.fsPath);
				try {
					var fcontents = JSON.parse(fs.readFileSync(f.fsPath, 'utf8'));
					cathycommands = cathycommands.concat(fcontents);
				}
				catch (e) {
					vscode.window.showInformationMessage(`Something went wrong parsing ${f.fsPath}, skipping cathycommands.json file`)
				}
			}
			return cathycommands;
		},
		(reason) => {
			console.log("Something went wrong looking for cathycommands.json files")
			return cathycommands;
		}
	);

	return allFiles
}


// Dataclass for storing the information of a lsf sub job
export class lsf_sub_job {
	public jobname: string
	public status: string   // ["Done", "Exited", "Pending"]
	public lsf_id: number  	// running lsf number
	public subjob_id: number   // id of the subjob,
	constructor(
		jobname: string,
		status: string,
		lsf_id: number,
		subjob_id: number,
	) {
		this.jobname = jobname
		this.status = status
		this.lsf_id = lsf_id
		this.subjob_id = subjob_id
	}

	static load_from_lsf_file(file): lsf_sub_job {
		// check if file exists, if not the job is still Pending
		var fcontents = fs.readFileSync(file, 'utf8').split("\n");
		var l1 = fcontents[1]

		let name = l1.split(" ")[3].slice(1, -1)
		let status = l1.split(" ").slice(-1)[0]

		let lsf_id = l1.split(" ")[2].slice(0, -1)

		// x/y subjobs
		let jobnumbers = name.split(":")[1].split("/")

		var res = new lsf_sub_job(name, status, Number(lsf_id), Number(jobnumbers[0]))

		return res
	}
	// construct string to be displayed in the side panel
	get_display_name(): string {
		return `[${this.lsf_id}] - ${this.jobname} - [${this.status}]`
	}
	// produce uri string for visual markup in side panel
	get_uri_string(): string {
		return `lsfinfo,${this.status}`
	}

}

// Dataclass storing information of a lsf job
export class lsf_job {
	public jobname: string
	public subjobs: lsf_sub_job[]
	constructor(jobname: string) {
		this.jobname = jobname
		this.subjobs = []
	}

	// Compute overall status based on the stati of the subjobs
	get_status(): string {
		let b_Pending = false
		let b_Crashed = false
		for (let sj of this.subjobs) {
			if (sj.status == "Exited") {
				b_Crashed = true
			}
			if (sj.status == "Pending") {
				b_Pending = true
			}
		}
		if (b_Crashed) {
			return "Crashed"
		}
		if (b_Pending) {
			return "Pending"
		}
		return "Done"
	}

	// construct string to be displayed in the side panel
	get_display_name(): string {
		return `${this.jobname} - [${this.get_status()}]`
	}

	// produce uri string for visual markup in side panel
	get_uri_string(): string {
		return `lsfinfo,${this.get_status()}`
	}

	// delete the logfolders of all children
	public purge_lsf_logs() {
		for (let sj of this.subjobs) {
			let lsf_path = path.join(vscode.workspace.getWorkspaceFolder(vscode.workspace.workspaceFile).uri.fsPath, "lsf", String(sj.lsf_id))
			fs.rmSync(lsf_path, { recursive: true, force: true })
		}
	}

}

// Interpret the lsf folder to extract current lsf job information
export function find_lsf_status(): Promise<lsf_job[]> {
	return new Promise((resolve, reject) => {
		var lsf_path = path.join(vscode.workspace.getWorkspaceFolder(vscode.workspace.workspaceFile).uri.fsPath, "lsf")
		var res: lsf_job[] = []

		if (!fs.existsSync(lsf_path)) {
			console.log("No LFS output folder in workspace present")
			resolve(res)
		} else {
			fs.readdir(lsf_path, (err, files: string[]) => {
				var subjobs: lsf_sub_job[] = []
				// [todo] make this a configuration parameter of the addon
				let n_max_lsf_files = 300
				if (files.length > n_max_lsf_files) {
					files = files.slice(-n_max_lsf_files, -1)
				}
				// iterate all files in lsf folder
				files.forEach((file) => {
					const uri = vscode.Uri.file(file);
					// only consider folders
					let lst = fs.lstatSync(path.join(lsf_path, file))
					if (lst.isDirectory()) {
						let lsf_stdout_path = path.join(lsf_path, file, 'stdout.txt')

						var sj: lsf_sub_job
						let next_job = false
						if (fs.existsSync(lsf_stdout_path)) {
							sj = lsf_sub_job.load_from_lsf_file(lsf_stdout_path)
							if (subjobs.length > 0) {
								// already at least one subjob in array
								next_job = sj.subjob_id < subjobs.slice(-1)[0].subjob_id
							}
						} else {
							sj = new lsf_sub_job("??????", "Pending", Number(file), -1)
							next_job = false
						}

						if (next_job) {
							// make lsf job object with the collected subjobs
							let lsfj = new lsf_job(subjobs[0].jobname.split(":")[0])
							lsfj.subjobs = subjobs
							res.push(lsfj)
							// start collecting subjobs for next job
							subjobs = [sj]
						} else {
							// still the same lsf job => append sub_subjob and continue
							subjobs.push(sj)
						}
					}
				});
				if (subjobs.length > 0) {
					// edge case, lsf folder does not contain any lsf logs
					let lsfj = new lsf_job(subjobs[0].jobname.split(":")[0])
					lsfj.subjobs = subjobs
					res.push(lsfj)
				}
				resolve(res)
			});
		}

	});
}

// Refreshes the installation status information in the sidepanel
export function sidepanel_refresh_installstatus(CatharsysSidepaneltreeDataProvider) {
	var installationstatus = pythy.extract_installation_status()
	installationstatus.then((cathy_install_status) => {
		// construct modulestatus for catharsys core
		let status_core = new modulestatus(cathy_install_status["Repodata"][0][0], cathy_install_status["Repodata"][0][1])

		let status_modules: modulestatus[] = []
		let module_promises: Promise<boolean>[] = [status_core.ready]

		// construct module status for all installed catharsys modules
		for (let repo_dat of cathy_install_status["Repodata"].slice(1)) {
			let status_m = new modulestatus(repo_dat[0], repo_dat[1])
			status_modules.push(status_m)
			module_promises.push(status_m.ready)
		}

		// wait till moduledata is ready
		Promise.all(module_promises).then((res) => {
			CatharsysSidepaneltreeDataProvider.build_installation_status_tree(status_core, status_modules)

		}, (reason) => {
			console.log("Refreshing Catharsys install Status Failed!");
		})
	},
		(reason) => {
			console.log("Python script extracting Catharsys Install Status failed!");
		}
	)
}

// register run command for updating the Installation
export function register_cathy_repos_update(context: vscode.ExtensionContext) {
	let update_installation = vscode.commands.registerCommand('Cathystuff.cathy_repos_update', (item) => {
		vscode.window.activeTerminal?.sendText("cathy repos update")
	});
	context.subscriptions.push(update_installation);
}

// register run command for executing a stashed command in the shell
export function register_run_stashed_command(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.run_stashed_command', (item) => {
		vscode.window.activeTerminal?.sendText(item.label)
	});
	context.subscriptions.push(disposable);
}

// register run command for feeding the cathy command attached to side panel object into the shell
export function register_run_action(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.run_action', (item) => {
		vscode.window.activeTerminal?.sendText(item.cathycommand)
	});
	context.subscriptions.push(disposable);
}

// register run action command for feeding the cathy command attached to side panel object into the shell with --debug
export function register_run_action_debug(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.run_action_debug', (item) => {
		//splicing in the --debug
		let command = item.cathycommand.substring(0, 6) + "--debug " + item.cathycommand.substring(6);
		vscode.window.activeTerminal?.sendText(command)
	});
	context.subscriptions.push(disposable);
}

// run action with added --config-only and --config-vars for config debugging
export function register_run_action_debug_config_only(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.run_action_debug_config_only', (item) => {
		let command = item.cathycommand + " --config-vars --config-only"
		vscode.window.activeTerminal?.sendText(command)
	});
	context.subscriptions.push(disposable);
}

// register function to execute blender init
export function register_cathy_blender_init(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.cathy_blender_init', (item) => {
		vscode.window.activeTerminal?.sendText(item.cathycommand)
	});
	context.subscriptions.push(disposable);
}

//  register function to navigate to config folder 
export function register_navigate_to_config(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.navigate_to_config', (item) => {
		let config_basepath = path.join(vscode.workspace.getWorkspaceFolder(vscode.workspace.workspaceFile).uri.fsPath, "config")
		let uri = vscode.Uri.file(path.join(config_basepath, item.fullname, 'launch.json5'));
		let success = vscode.commands.executeCommand('revealInExplorer', uri);
	});
	context.subscriptions.push(disposable);
}

// register command to execute cathy blender show
export function register_cathy_blender_show(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.cathy_blender_show', (item) => {
		vscode.window.activeTerminal?.sendText(item.cathy_blender_show_command)
	});
	context.subscriptions.push(disposable);
}

// register Command to store the selected catharsys config in the side panel for later use in combination with blender show or config duplication
export function register_remember_selected_config(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.remember_selected_config', (item) => {
		if (item.contextValue == "catharsysconfig") {
			vscode.commands.executeCommand('setContext', 'Cathystuff.catharsys_config_selected', true);
			context.workspaceState.update("cathy_selected_config", item.fullname)
		} else {
			vscode.commands.executeCommand('setContext', 'Cathystuff.catharsys_config_selected', false);
			context.workspaceState.update("cathy_selected_config", "")
		}
	});
	context.subscriptions.push(disposable);
}

// register command to feed cathy blender show into the command line according to the selected config
export function register_cathy_blender_show_file(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.cathy_blender_show_file', (item) => {
		// cathy blender show -c .\config\group04\GT_validation\ -f .\blend\Blender-anytruth-label-0001-rq0004-group04-dataset_14-45000.blend
		let selected_config: string = context.workspaceState.get("cathy_selected_config")
		if (selected_config != "") {
			vscode.window.activeTerminal?.sendText(`cathy blender show -c ./config/${selected_config} -f "${item.fsPath}"`)
		} else {
			vscode.window.showInformationMessage("No config selected in Catharsys outline")
		}
	});
	context.subscriptions.push(disposable);
}

// Register Command for pasting a config using cathy ws copy config
export function register_paste_config(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand("Cathystuff.paste_config", (dat: any) => {
		let target = dat.fsPath
		let config_source: string = context.workspaceState.get("cathy_copied_config")

		// check if target is a folder, we can only copy to folders!
		if (!fs.lstatSync(target).isDirectory()) {
			console.log("Can only copy config into a folder!")
			return
		}

		let configlastname_source = path.basename(config_source)
		var config_target: string = path.join(target, configlastname_source)

		// Add _copy tot the target config name if config name already exists
		while (fs.existsSync(config_target)) {
			config_target = `${config_target}_copy`
		}

		// Extract basepath of the config folder in the workspace
		var config_basepath = path.join(vscode.workspace.getWorkspaceFolder(vscode.workspace.workspaceFile).uri.fsPath, "config")

		// Make paths relative to config folder to get catharsys paths
		let config_source_rel = path.relative(config_basepath, config_source)
		let config_target_rel = path.relative(config_basepath, config_target)

		// enforce only copy pasting within the config folder!
		if ((config_source_rel.substring(0, 3) == "..\\") || (config_target_rel.substring(0, 3) == "..\\")) {
			console.log("Can only copy configs within the config folder!")
			return
		}

		// [todo] add leading config/ once christian changes the interface of cathy ws copy config

		// turn path into catharsys paths
		let config_source_cath = config_source_rel.replace("\\", "/")
		let config_target_cath = config_target_rel.replace("\\", "/")
		let cathycommand = `cathy ws copy config ${config_source_cath} ${config_target_cath}`

		// console.log(cathycommand)
		vscode.window.activeTerminal?.sendText(cathycommand)
		vscode.commands.executeCommand('setContext', 'Cathystuff.catharsys_config_copied', false);
	});
	context.subscriptions.push(disposable);
}

// register command to copy selected config
export function register_copy_config(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand("Cathystuff.copy_config", (dat: any) => {
		context.workspaceState.update("cathy_copied_config", dat.fsPath)
		vscode.commands.executeCommand('setContext', 'Cathystuff.catharsys_config_copied', true);
	})
	context.subscriptions.push(disposable);
}

// register command to refresh the sidepanel
export function register_refresh_sidepanel(context: vscode.ExtensionContext, CatharsysSidepaneltreeDataProvider: CatharsysTreeProvider) {
	let disposable = vscode.commands.registerCommand('Cathystuff.refresh_sidepanel', (item) => {
		// handle cathy commands
		find_all_cathycommands().then(
			(cathcommands) => {
				CatharsysSidepaneltreeDataProvider.build_cathycommands_tree(cathcommands)
			}
		)
		// handle configs and actions
		pythy.find_all_configs_and_actions().then(
			(cathyconfigs) => {
				CatharsysSidepaneltreeDataProvider.build_config_tree(cathyconfigs["configtree"])
			}
		)
		// handle catharsys install status
		sidepanel_refresh_installstatus(CatharsysSidepaneltreeDataProvider)
		// handle lsf status and build according subtree
		let lsf_status_enabled = true
		if (lsf_status_enabled) {
			console.log("starting lsf log analysis")
			find_lsf_status().then((lsf_info) => {
				CatharsysSidepaneltreeDataProvider.Data.children[3].visible = true
				console.log("Building lsf tree")
				CatharsysSidepaneltreeDataProvider.build_lsf_tree(lsf_info)
			},
				(rejected) => {
					console.log("lsf log analysis failed somehow")
					CatharsysSidepaneltreeDataProvider.Data.children[3].visible = false
				})
		}

	});
	context.subscriptions.push(disposable);
}

// register command to delete selected lsf log group
export function register_cathy_delete_lsf_group(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand("Cathystuff.cathy_delete_lsf_group", (dat: catharsys_action_TreeItem) => {
		dat.lsf_status_data.purge_lsf_logs()
		vscode.commands.executeCommand("Cathystuff.refresh_sidepanel")
	})
	context.subscriptions.push(disposable);
}

// register command to open the stdout.txt file associated with an lsf subjob. Is executed when the user clicks the element in the sidebar
export function register_navigate_to_lsflog(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.navigate_to_lsflog', (item) => {
		var lsf_path = path.join(vscode.workspace.getWorkspaceFolder(vscode.workspace.workspaceFile).uri.fsPath, "lsf")
		var stdout_path = path.join(lsf_path, String(item.lsf_subjob_data.lsf_id), "stdout.txt")
		if (fs.existsSync(stdout_path)) {
			vscode.workspace.openTextDocument(vscode.Uri.file(stdout_path)).then(
				(a: vscode.TextDocument) => {
					vscode.window.showTextDocument(a, 1, false)
				});
		}
	});
	context.subscriptions.push(disposable);
}

// register command to open the repo folder of catharsys core or mordule
export function register_open_in_terminal(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.open_in_terminal', (item) => {
		vscode.window.activeTerminal?.sendText(item.cathycommand)
	});
	context.subscriptions.push(disposable);
}


// register command to Show all local branches of an installed catharsys module, 
// let user select one and check out if user clicks an option
export function register_switch_module_branch(context: vscode.ExtensionContext) {
	let disposable = vscode.commands.registerCommand('Cathystuff.switch_module_branch', (item) => {

		let items: vscode.QuickPickItem[] = [];

		let yourHXRResultItems = item.branches
		for (let index = 0; index < yourHXRResultItems.length; index++) {
			let item = yourHXRResultItems[index];
			items.push({
				label: item,
				description: `git checkout ${item}`,
			});
		}

		vscode.window.showQuickPick(items).then(selection => {
			// the user canceled the selection
			if (!selection) {
				return;
			}
			// console.log(selection.label)
			let workingdirpath = vscode.workspace.getWorkspaceFolder(vscode.workspace.workspaceFile).uri.fsPath
			// cd into install folder
			vscode.window.activeTerminal?.sendText(item.cathycommand)
			// switch branch
			vscode.window.activeTerminal?.sendText(selection.description)
			// cd back into working space folder
			vscode.window.activeTerminal?.sendText(`cd ${workingdirpath}`)

			vscode.commands.executeCommand("Cathystuff.refresh_sidepanel")
		});

	});
	context.subscriptions.push(disposable);
}


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Activating Catharsys Painkiller Extension');

	let Mdecprov = new ModuleDecorationProvider()

	register_cathy_delete_lsf_group(context)

	// register cathy_repos_update command
	register_cathy_repos_update(context)
	// register run command to execute stashed catharsys commands
	register_run_stashed_command(context)

	// register run command to execute cathy ws launch -c ... -a commands to launch the associated config and action pair
	register_run_action(context)

	// register run command to execute cathy --debug ws launch ...
	register_run_action_debug(context)

	// register run command to execute cathy ws launch .... --config-only --config-vars
	register_run_action_debug_config_only(context)

	// register run command to execute cathy blender init for the config in question
	register_cathy_blender_init(context)

	// register command to open the config folder of selected config
	register_navigate_to_config(context)

	// register run command to execute cathy blender show for the config + action in question
	register_cathy_blender_show(context)

	// workspace level flag indicating when a config has been selected in the side panel. Needed for cathy blender show -f feature
	vscode.commands.executeCommand('setContext', 'Cathystuff.catharsys_config_selected', false);
	context.workspaceState.update("cathy_selected_config", "")

	// Register Action to be executed on click of Catharsys outline sidepanel tree items.
	// Stores selected Catharsys actions for later reuse for cathy blender show -f context menu in Explorer on .blend files
	register_remember_selected_config(context)

	// register run command to execute cathy blender show for a .blend file selected in the file explore panel 
	// using the blender configuration of the config selected in catharsys outline panel
	register_cathy_blender_show_file(context)

	// workspace level flag indicating when a config has been copied
	vscode.commands.executeCommand('setContext', 'Cathystuff.catharsys_config_copied', false);

	// register command for pasting a config using cathy ws copy config
	register_paste_config(context)

	// command to store data of copied config for later use in Cathystuff.paste_config
	register_copy_config(context)

	// command to navigate to logfile of lsf subjob when clicking in the sidepanel
	register_navigate_to_lsflog(context)

	// command to open installation path in terminal for catharsys modules
	register_open_in_terminal(context)

	// command to show all local branches of module and allows to checkout
	register_switch_module_branch(context)

	console.log('Registering Commands complete!');

	// setting up linktargetdata functionality
	pythy.extract_linktarget_data().then((linktargetdata) => {
		// set up hover over provider for catharsys modifier docstring
		var T = new sDTI_tree(linktargetdata)
		vscode.languages.registerHoverProvider(['json', "json5", "ison"], {
			provideHover(document, position, token) {
				return ModifierSupport.hover_over_sDTI_docstring(document, position, token, T)
			}
		});

		// set up Definition link provider to link back to catharsys modifier definition
		vscode.languages.registerDefinitionProvider(['json', "json5", "ison"], {
			provideDefinition(document, position, token) {
				return ModifierSupport.provide_definition_sDTI(document, position, token, T)
			}
		});
		// set up Auto completion provider to complete sDTIs
		vscode.languages.registerCompletionItemProvider(['json', "json5", "ison"],
			{
				provideCompletionItems(document, position, token, context) {
					return ModifierSupport.complete_sDTI(document, position, token, context, T)
				}
			},
			"\""
		);
		// semantic token provider to perform highlighting of true sDTIs, manual sDTIs and group sDTIs
		// Used for color coding sDTIs depending on their subtype, modifier, group or manual/unknown sDTI
		ModifierSupport.set_up_semantic_tokens(T)

		console.log('Registering sDTI support providers complete!');

	})

	// Setting up Catharsys inline magic functions support
	var catharsys_magic_functions = pythy.find_all_inline_tooltips()
	Promise.all([catharsys_magic_functions]).then(
		(results) => {
			var magic = results[0]
			if (magic) {
				// set up Hoover over provider for magic functions
				inlineIson.set_up_ison_inline_tooltips(magic)
				// set up source definition provider for Catharsys inline magic functions 	
				inlineIson.set_up_ison_inline_definition_provider(magic)
				// set up inline ISON autocompletion support
				inlineIson.set_up_ison_inline_auto_completion(magic)
			}
			console.log('Registering Magic inline command support complete!');
		}
	)


	// Setting up catharsys variable definition provider, static version
	var catharsys_variable_sources = pythy.find_all_variable_defs()
	catharsys_variable_sources.then(
		(result) => {
			inlineIson.set_up_catharsys_variable_definition_provider(result)
			console.log('Registering catharsys variable definition provider complete!');
		}
	)

	// Dynamic version turned out to be way too slow, makes everything sluggish
	// inlineIson.set_up_catharsys_variable_definition_provider_wip()


	// setting up the Catharsys side panel

	// setup side panel, at this point still empty
	var CatharsysSidepaneltreeDataProvider = new CatharsysTreeProvider()
	vscode.window.createTreeView('Cathystuff', {
		treeDataProvider: CatharsysSidepaneltreeDataProvider
	});

	// register refresh side panel command, this refreshes all elements of the side panel
	register_refresh_sidepanel(context, CatharsysSidepaneltreeDataProvider)

	// refresh the first time
	vscode.commands.executeCommand("Cathystuff.refresh_sidepanel")
	console.log('Setting up side panel complete!');

	// Updating installation status information
	console.log('Fetching Catharsys installation repos')

	let fetch_active = false
	// turned out that fetching on every startup is quite often very slow
	// [todo] turn this into a setting
	if (fetch_active) {
		pythy.fetch_cathy_repos().then((log) => {
			for (var l of log["loglines"]) {
				console.log(l)
			}
			console.log("Fetching complete, updating side panel")
			// refresh the second time, this is needed due to the async fetch_cathy_repos function, which takes a while to complete
			vscode.commands.executeCommand("Cathystuff.refresh_sidepanel")
		},
			(reason) => {
				console.log('Failed fetching cathy repos!')
			})
	}
}


