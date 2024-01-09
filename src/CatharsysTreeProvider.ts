import * as vscode from 'vscode';
import { lsf_job, lsf_sub_job, modulestatus } from './extension';


// Tree data provider for the side panel.
export class CatharsysTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    Data: catharsys_action_TreeItem;
    constructor(
        // public configs: JSON,
        // public cathycommands: string[],
        // public core_repostatus: modulestatus,
        // public module_repostatus: modulestatus[]
    ) {
        this.Data = new catharsys_action_TreeItem("root", "", "", "group", "", vscode.TreeItemCollapsibleState.Expanded);

        this.build_basic_tree();

        // this.build_tree()
        // This can be used in tandem with the getTreeItem function to execute something on tree item selection.
        // Superseded by the context value method, could still be useful though
        // vscode.commands.registerCommand('cwt_cucumber.on_item_clicked', item => this.onItemClicked(item));
    }

    // set up basic structure of side panel, i.e. "the captions"
    private build_basic_tree(): void {
        let Configs_root = new catharsys_action_TreeItem("Configs", "", "", "group", "", vscode.TreeItemCollapsibleState.Collapsed);
        this.Data.children.push(Configs_root);
        let cathy_commands = new catharsys_action_TreeItem("Cathy commands", "", "", "group", "", vscode.TreeItemCollapsibleState.Collapsed);
        this.Data.children.push(cathy_commands);
        let Installation_status = new catharsys_action_TreeItem("Image-Render-Automation Installation Status", "", "", "group", "", vscode.TreeItemCollapsibleState.Collapsed);
        Installation_status.contextValue = "Catharsys_Installation_Status";
        this.Data.children.push(Installation_status);
        let lsf_status = new catharsys_action_TreeItem("lsf Status", "", "", "group", "", vscode.TreeItemCollapsibleState.Collapsed);
        this.Data.children.push(lsf_status);
    }

    // build/update the config tree in the side panel
    public build_config_tree(configdata: JSON): void {
        this.Data.children[0].children = [];
        let x = CatharsysTreeProvider.construct_ac_tree(configdata);
        for (let c of x.children) {
            this.Data.children[0].children.push(c);
        }
        this._onDidChangeTreeData.fire();
    }

    // build/update the cathycommands section in the side panel
    public build_cathycommands_tree(cathycommands: string[]): void {
        var cathy_commands = this.Data.children[1];
        cathy_commands.children = [];
        for (let c of cathycommands) {
            let ch = new catharsys_action_TreeItem(c, "", "", "command", "", vscode.TreeItemCollapsibleState.None);
            ch.contextValue = "command";
            cathy_commands.children.push(ch);
        }
        this._onDidChangeTreeData.fire();
    }

    // build/update the installation status section in the side panel
    public build_installation_status_tree(core_repostatus: modulestatus, module_repostatus: modulestatus[]) {
        let Installation_status = this.Data.children[2];
        Installation_status.children = [];

        let catharsys_core = new catharsys_action_TreeItem(core_repostatus.get_display_name(), `cd ${core_repostatus.repopath}`, "", "module", "", vscode.TreeItemCollapsibleState.None, core_repostatus.get_uri_string(), core_repostatus.branches);
        catharsys_core.contextValue = "CatharsysCore";
        Installation_status.children.push(catharsys_core);

        let Modules = new catharsys_action_TreeItem("Modules", "", "", "group", "", vscode.TreeItemCollapsibleState.Collapsed);
        // m.contextValue = "CatharsysModuleGroup"
        Installation_status.children.push(Modules);

        for (let m of module_repostatus) {
            let ch1 = new catharsys_action_TreeItem(m.get_display_name(), `cd ${m.repopath}`, "", "module", "", vscode.TreeItemCollapsibleState.None, m.get_uri_string(), m.branches);
            ch1.contextValue = "CatharsysModule";
            Modules.children.push(ch1);
        }
        this._onDidChangeTreeData.fire();
    }

    // build/update the lsf section in the side panel
    public build_lsf_tree(lsf_info: lsf_job[]): void {
        var lsf_status = this.Data.children[3];
        lsf_status.children = [];
        for (let lj of lsf_info) {
            let lsf_group_treeitem = new catharsys_action_TreeItem(lj.get_display_name(), "", "", "group", "", vscode.TreeItemCollapsibleState.Collapsed, lj.get_uri_string());
            lsf_group_treeitem.contextValue = "lsf_group";
            lsf_group_treeitem.lsf_status_data = lj
            for (let sj of lj.subjobs) {
                let lsf_treeitem = new catharsys_action_TreeItem(sj.get_display_name(), "", "", "", "", vscode.TreeItemCollapsibleState.None, sj.get_uri_string());
                lsf_treeitem.lsf_subjob_data = sj
                lsf_treeitem.command = { command: "Cathystuff.navigate_to_lsflog", title: "navigate", arguments: [lsf_treeitem] }
                lsf_group_treeitem.children.push(lsf_treeitem)
            }
            lsf_status.children.push(lsf_group_treeitem);
        }
        this._onDidChangeTreeData.fire();
    }


    private _onDidChangeTreeData: vscode.EventEmitter<catharsys_action_TreeItem | undefined | null | void> = new vscode.EventEmitter<catharsys_action_TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<catharsys_action_TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: catharsys_action_TreeItem): Thenable<catharsys_action_TreeItem[]> {
        if (element) {
            return Promise.resolve(element.children);
        } else {
            return Promise.resolve(this.Data.children.filter((ch) => { return ch.visible }))
            // return Promise.resolve(this.Data.children);
        }
    }

    // constructs the action/config tree from passed JSON
    static construct_ac_tree(data: JSON) {
        // console.log(name)
        let leaf = data["children"].length == 0
        // let leaf = Object.keys(linktargetdata).includes("line")
        var res: catharsys_action_TreeItem
        if (leaf) {
            // construct leaf and return it
            res = new catharsys_action_TreeItem(data["fullname"], data["cathycommand"], data["cathy_blender_show_command"], data["type"], data["fullname"], vscode.TreeItemCollapsibleState.None)
            res.contextValue = "Catharsys_Action"
        } else {
            res = new catharsys_action_TreeItem(data["name"], data["cathycommand"], data["cathy_blender_show_command"], data["type"], data["fullname"], vscode.TreeItemCollapsibleState.Collapsed)
            if (data["type"] === "config") {
                res.contextValue = "catharsysconfig"
            }
            // recurse over children
            for (var c of data["children"]) {
                let sub = CatharsysTreeProvider.construct_ac_tree(c)
                res.children.push(sub)
            }
        }
        return res
    }
}

export class catharsys_action_TreeItem extends (vscode.TreeItem) {
    cathycommand: string; 	// If item is a stashed cathy command, this gets executed if triggered
    cathy_blender_show_command: string 	// if item is an action, this stores the cathy command for executing blender show
    command: vscode.Command 	// general command getting executed on selection, used to remember last clicked action for context menu cathy blender show on .blend files in Explorer
    branches: string[]
    type: string 				// encodes the type of the catharsys action item, either "group" or "action"
    children: catharsys_action_TreeItem[]
    fullname: string
    visible: boolean
    lsf_status_data: lsf_job   // storing the underlying lsf_job object for easy log purging
    lsf_subjob_data: lsf_sub_job // storing the underlying lsf_sub_job object for easy navigation
    constructor(label: string | vscode.TreeItemLabel,
        cathycommand: string,
        cathy_blender_show_command: string,
        type: string,
        fullname: string,
        collapsibleState?: vscode.TreeItemCollapsibleState,
        uristring?: string,
        branches?: string[],
    ) {
        super(label, collapsibleState)
        this.cathycommand = cathycommand
        this.cathy_blender_show_command = cathy_blender_show_command
        this.type = type
        this.fullname = fullname

        if (uristring) {
            this.resourceUri = vscode.Uri.parse(uristring);
        }

        if (branches) {
            this.branches = branches;
        } else {
            this.branches = [];
        }

        this.children = []
        this.command = { command: "Cathystuff.remember_selected_config", title: "remember config", arguments: [this] }
        this.visible = true
    }
}