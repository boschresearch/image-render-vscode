// Classes to build an sDTI Tree for quick matching sDTIs and retrieving the correct data for autocompletion

// Data class storing sDTI data of a leaf, i.e. an actual modifier
export class sDTI_leaf_data {
    public linkTarget: string;
    public docstrings: string[];
    public line: number;
    public parameters: string[];
    public parameter_info: string[];
    constructor(data: JSON) {
        this.linkTarget = data["linkTarget"]
        this.docstrings = data["docstrings"]
        this.line = data["line"]
        this.parameters = data["parameters"]
        this.parameter_info = data["parameters_info"]
    }
}

// Data class stroring the data of a modifier group
export class sDTI_group {
    public Elements: sDTI_group[];
    public name: string;
    public data: sDTI_leaf_data;
    public leaf: boolean;
    constructor(name: string) {
        this.Elements = [];
        this.name = name;
    }
    traverse_down(name: string) {
        let x = 1
        return this.Elements.filter((x) => { return (x.name == name) })[0]
    }
}

// Data class storing a complete sDTI tree
export class sDTI_tree {
    public root: sDTI_group;
    constructor(
        private linktargetdata: JSON) {
        var ltd = linktargetdata["catharsys"];
        this.root = new sDTI_group("root");
        this.root.Elements.push(sDTI_tree.construct_tree("catharsys", ltd));
        // This can be used in tandem with the getTreeItem function to execute something on tree item selection.
        // Superseded by the context value method, could still be useful though
    }

    // Construct an sDTI tree based on passed JSON data, extracted using the extract_linktargetdata.py python script
    static construct_tree(name: string, linktargetdata: JSON) {
        // Check if ther is a line field present, indicating a leaf node, since groups do not have a line
        let leaf = Object.keys(linktargetdata).includes("line");
        var res: sDTI_group;
        if (leaf) {
            // construct leaf and return it
            res = new sDTI_group(name);
            res.leaf = true;
            res.data = new sDTI_leaf_data(linktargetdata);
        } else {
            res = new sDTI_group(name);
            // recurse over fields
            for (var fieldname of Object.keys(linktargetdata)) {
                // todo, check if leaf
                let sub = sDTI_tree.construct_tree(fieldname, linktargetdata[fieldname]);
                res.Elements.push(sub);
            }
        }
        return res;
    }

    match_sDTI_tree(sDTI_line: string, parent: Boolean = false) {
        let regex = /".*"/g;
        let sDTI_array = sDTI_line.match(regex);
        if (sDTI_array) {
            if (sDTI_array.length != 1) {
                // error case, no double quoted string at all or more than one
                return 0;
            } else {
                let sDTI = sDTI_array[0].substring(1, sDTI_array[0].length - 1);
                let path = sDTI.split("/");
                if (path[0] != "") {
                    path.unshift("catharsys");
                }
                if (parent) {
                    path.pop();
                }
                var res = this.root;
                for (var s of path) {
                    if ((s != "")) {
                        res = res.traverse_down(s);
                        if (res == undefined) {
                            return res;
                        }
                    }
                }
            }
            return res;
        }
        return undefined;
    }
}
