# Interface providing catharsys configs and their actions to the catharsys painkiller addon
# import rbpy.debug

# rbpy.debug.wait4Debugger()

import json
import os, sys

# Environment to suppress printing
class NoPrinting:
    def __enter__(self):
        self._original_stdout = sys.stdout
        sys.stdout = open(os.devnull, "w")

    def __exit__(self, exc_type, exc_val, exc_tb):
        sys.stdout.close()
        sys.stdout = self._original_stdout

# recursively sort the passed tree alphabetically
def sorttree(tree):
    def key(k):
        return k["name"]
    tree["children"].sort(key=key)
    for stree in tree["children"]:
        sorttree(stree)
    return     

def main(conda_env, workspacefolder):
    with NoPrinting():
        print(
            "Need to suppress catharsys prints since they go right back to the addon messing up json based ipc"
        )

        import catharsys.api as capi

        os.chdir(workspacefolder)
        os.environ["CONDA_DEFAULT_ENV"] = conda_env

        wsX = capi.CWorkspace()
        wsX.dicProjects
        wsX.PrintInfo()

        Data_out = {}
        Data_out["Configs"] = []
        Data_out["configtree"] = {"name": "root",
                                  "type": "group",
                                  "children": [],
                                  "fullname": "",
                                  "cathycommand":"",
                                  "cathy_blender_show_command": ""}
        
        for config in wsX.dicProjects.keys():
            conf = {"Name": config, "Actions": wsX.dicProjects[config].lActions}
            Data_out["Configs"].append(conf)

            children=Data_out["configtree"]["children"]

            cpath = config.split("/")
            for p in cpath[:-1]:
                # Adding intermediate group nodes
                if p not in [x["name"] for x in children]:
                    children.append({"name":p,
                                     "type":"group",
                                     "children": [],
                                     "fullname": "",
                                     "cathycommand":"",
                                     "cathy_blender_show_command": ""})
                children=[c for c in children if c["name"]==p][0]["children"]
            # adding the actual config
            children.append({"name":cpath[-1],
                    "type":"config",
                    "children": [],
                    "fullname": config,
                    "cathycommand":f"cathy blender init -c {config}",
                    "cathy_blender_show_command": ""})
            
            # get ready for sorting actions
            children_toplevel=[c for c in children if c["name"]==cpath[-1]][0]["children"]
            
            for action in wsX.dicProjects[config].lActions:
                children=children_toplevel
                apath= action.split("/")
                # Adding intermediate group nodes
                for p in apath[:-1]:
                    if p not in [x["name"] for x in children]:
                        children.append({"name":p,
                                        "type":"group",
                                        "children": [],
                                        "fullname": "",
                                        "cathycommand":"",
                                        "cathy_blender_show_command": ""})
                    children=[c for c in children if c["name"]==p][0]["children"]
                # Adding the actual action
                children.append({"name":apath[-1],
                    "type":"action",
                    "children": [],
                    "fullname": action,
                    "cathycommand": f"cathy ws launch -c ./config/{config} -a {action}",
                    "cathy_blender_show_command": f"cathy blender show -c ./config/{config} -a {action}"})

        sorttree(Data_out["configtree"])
            
        Data_s = json.dumps(Data_out)

    print(Data_s)


if __name__ == "__main__":
    # import rbpy

    # rbpy.rb_debug.wait4Debugger()
    # Data_in = json.loads(sys.argv[1])
    main(conda_env=sys.argv[1], workspacefolder=sys.argv[2])
