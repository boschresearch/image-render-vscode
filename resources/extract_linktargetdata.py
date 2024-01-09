# Function to extract linktargetdata of the catharsys installation
# import rbpy.debug

# rbpy.debug.wait4Debugger()

import json
import os, sys
from anybase.file import LoadJson

import pkgutil
import ast


class NoPrinting:
    def __enter__(self):
        self._original_stdout = sys.stdout
        sys.stdout = open(os.devnull, "w")

    def __exit__(self, exc_type, exc_val, exc_tb):
        sys.stdout.close()
        sys.stdout = self._original_stdout


def find_line_number(filepath, functionname):
    """Find the line number in which functionname is defined as function or class in file

    Parameters
    ----------
    filepath : string
        Path to the python source file
    functionname : string
        Name of the function to be located

    Returns
    -------
    integer
        Linenumber of function/class definition
    """
    with open(filepath) as f:
        lines = f.readlines()

    sSearch_def = f"def {functionname}"
    sSearch_class = f"class {functionname}"
    treffer = [sSearch_def in l or sSearch_class in l for l in lines]
    # todo: abfangen kein treffer, debug output
    if sum(treffer)==0:
        # did not find class or function definition, return line 0 instead.
        i = 0
    else:
        i = treffer.index(True)

    return i

# Takes an ast.call of the CParamFields.<> family and formats the encoded information
def format_hint_information(a):
    s=[]
    if a.func.attr=="HINT":
        # if "sHint" in [x.arg for x in a.keywords]:    
        # s+=["# Hint: " + kw.value.value for kw in a.keywords if kw.arg=="sHint"]
        # handle Hints passed directly as argument
        if len(a.args)==1:
            # s+=[f"{a.args[0]}"]
            s+=[f"{ast.literal_eval(a.args[0])} \n"]

        # handle hints passed as namend argument
        keywords_filtered = [kw for kw in a.keywords if kw.arg=="sHint"]
        s+=[f"{kw.value.value} \n" for kw in keywords_filtered]

    if a.func.attr=="OPTIONS":
        # Extracting list of possible values, always passed in the first argument
        # s+=["# Valid Settings:"] + [f"- \"{el.value}\"" for el in a.args[0].elts]
        s+=["Valid Settings:"] + [f"- \"{el.value}\" " for el in a.args[0].elts] 
        # Extract default value if present
        default_value=[x.value.value for x in a.keywords if x.arg=="xDefault"]
        if len(default_value)==1:
            # s+=[f"# Default Value: \n - \"{default_value[0]}\""]
            s+=[f"\nDefault Value: \n  - \"{default_value[0]}\""]

    if a.func.attr == "REQUIRED":
        s+=["Mandatory field \n"]
    if a.func.attr == "DEPRECATED":
        s+=[f"Deprecated Alias: \"{a.args[0].value}\" \n"]
    if a.func.attr == "DEFAULT":
        if len(a.args)==1:
            s+= [f"Default Value: {ast.unparse(a.args[0])}"]

    return s

# Takes ast.annAssign object encoding a member variable of @paramclass decorated class and collects the documentation information
def extract_modifier_Dirk_docu(f):
    if isinstance(f.value,ast.Tuple):
        # several information blocks present, thus extract them all, then flatten the list
        s = [format_hint_information(a) for a in f.value.elts]
        s = [l for list in s for l in list]
    else:
        # only one information block present
        s = format_hint_information(f.value)
    return s


def generate_catharsys_painkiller_linktargets(filename=None):
    """Analyses Catharsys installation and produces the configuration data file to be used by Catharsys Painkiller language support addon

    Returns
    -------
    list of dicts
        Each list entry contains the data of one catharsys modifier/modifier group
                "linkPattern": sDTI String to look for within cathy config files,
                "linkTarget": file uri of the source code executed by the modifier,
                "docstrings": List of strings, contains the docstring of the function/class to be executed,
                "line": Linenumber where exactly within the file the function/class definition is located,
                "parent": Parent modifier group,
                "modifier": modifier name,
                "parameters": List of parameters the modifier accepts,

    """
    # Variant using the non deprecated importlib instead of pkg_ressources
    from importlib.metadata import entry_points

    # Find all catharsys related entry point groups
    eps=entry_points()
    catharsys_groups= [x for x in eps.groups if "catharsys" in x]

    linkspatterns_tree = {}

    # Construct all link patterns found
    linkpatterns = []
    # Iterate catharsys related entry point groups
    for g in catharsys_groups:
        # Get all entry points allocated to the group
        scripts = eps.select(group=g)
        # iterate and extract information
        for d in scripts:
            identifier = d.name
            path = d.module
            value=d.value

            # if a colon is present, a function is called, otherwise the entry point points towards a module
            if ":" in value:
                _ , FunctionOrClassName = value.split(":")
            else:
                FunctionOrClassName = None

            # Find linenumber of the function/class addressed by the entry point in question by parsing
            mloader = pkgutil.get_loader(path)
            modulefilename = mloader.get_filename()
            if FunctionOrClassName is None:
                # module is called directly, therfore we point to the top of the file
                Linenumber = 0
            else:
                # Function/class within module is targeted
                Linenumber = find_line_number(modulefilename, FunctionOrClassName)
            # Construct link pattern
            splitarray = identifier.rsplit("/", 1)
            if len(splitarray) < 2:
                # Not a catharsys modifier, these entry points are used to provide catharsys cli commands. Can be skipped
                continue

            parent = splitarray[0]
            modifier = splitarray[1]

            # Extract doc strings of the function/class/module addressed by the modifier using the abstract syntax tree
            # of python to avoid running into the blender python packages issue
            docstrings = []
            parameters = []
            parameter_docstrings = []
            if FunctionOrClassName is None:
                # Module is loaded entirely
                docstrings = ["Todo: extract module docstring instead"]
            else:
                with open(modulefilename) as f:
                    module = ast.parse(f.read())
                    # Extract the correct function
                    functions = [
                        f
                        for f in ast.walk(module)
                        if isinstance(f, ast.FunctionDef)
                    ]
                    targetfun = [
                        f for f in functions if f.name == FunctionOrClassName
                    ]

                    if len(targetfun) == 0:
                        docstrings = ["Todo: add AST parsing for classes"]
                    else:
                        # Analyse Dirks Entry point decorator, that then takes precedence over my proof of concept cdoc decorator

                        # Only grab modifier that are of call type
                        DirksEntryPoints = [x for x in targetfun[0].decorator_list if isinstance(x,ast.Call)]
                        # of those only grab those that are an Entry point modifier
                        DirksEntryPoints=[x for x in DirksEntryPoints if x.func.id=="EntryPoint"]
                        # Rule out Entrypoint modifiers with the clsInterfaceDoc keyword argument missing
                        DirksEntryPoints=[x for x in DirksEntryPoints if "clsInterfaceDoc"in [word.arg for word in x.keywords]]

                        Dirk_Tooltip_Data = []
                        if len(DirksEntryPoints)>0:
                            # Function has the Entrypoint decorator
                            # Find the name of the class defining the modifier arguments as argument of the decorator
                            arg_class_name=DirksEntryPoints[0].keywords[0].value.id

                            # get all classes
                            classes = [c for c in ast.walk(module) if isinstance(c,ast.ClassDef)]
                            # find the right one
                            c=[obj for obj in classes if obj.name==arg_class_name]
                            # extract the parameter names from the body of the class body
                            parameters_ast_objs = [x for x in c[0].body if isinstance(x,ast.AnnAssign)]
                            parameters = [x.target.id for x in parameters_ast_objs]

                            # Extract the documentation data for all modifier parameters
                            Dirk_Tooltip_Data = [extract_modifier_Dirk_docu(x) for x in parameters_ast_objs]
                            parameter_docstrings = []
                            for p, infos in zip(parameters,Dirk_Tooltip_Data):
                                parameter_doc_md=f""
                                for l in infos:
                                    parameter_doc_md+=f"{l} \n"
                                parameter_docstrings+=[parameter_doc_md]
                            
                        docstring = ast.get_docstring(targetfun[0])
                        targetfun[0]
                        if docstring is None:
                            docstrings = ["Modifier function has no Docstring"]
                        else:
                            docstrings = docstring.split("\n")
            if Linenumber==0:
                docstrings = ["LINE NUMBER EXTRACTION FAILED, TALK TO JOCHEN!!!"] + docstrings

            # construct linkPattern data
            lp = {
                "linkPattern": f"{identifier}",
                "linkTarget": f"{modulefilename}".replace("\\", "/"),
                "docstrings": docstrings,
                "line": Linenumber,
                "parent": parent,
                "modifier": modifier,
                "parameters": parameters,
                "parameters_info":parameter_docstrings
            }
            linkpatterns.append(lp)

            # Place in Treevariant of result
            lp_walker = linkspatterns_tree
            modfifierpath = parent.split("/")
            for mg in modfifierpath[1:]:
                if mg in lp_walker.keys():
                    pass
                else:
                    lp_walker[mg] = {}
                lp_walker = lp_walker[mg]
            lp_walker[modifier] = lp

    # Add intermediate groups link patterns
    # Intermediate group link patterns are not modifier themselves but intermediate steps within the modifier sDTI path, i.e.
    # /catharsys/modify/somemodifier:1.1 implies intermediate link targets /catharsys/modify and /catharsys/
    # Intermediate modifier groups end with a "/" to make them discernible from real modifiers and for easy tab autocompletion
    linkpatterns_extra = []
    for i, lp in enumerate(linkpatterns):
        s_parent = lp["parent"]
        while len(s_parent) > 0:
            # Determine if parent exists already as a link pattern
            s_parent_lp = f"{s_parent}/"
            splitarray = s_parent.rsplit("/", 1)
            if len(splitarray) < 2:
                # Arrived at the first / before catharsys, nothing left to do
                continue
            hits_lp = [l for l in linkpatterns if l["linkPattern"] == s_parent_lp]
            hits_lp_extra = [
                l for l in linkpatterns_extra if l["linkPattern"] == s_parent_lp
            ]

            parent = splitarray[0]
            modifier = splitarray[1]
            # Add leading / for root catharsys identifier
            if modifier == "catharsys":
                modifier = "/catharsys"
            if (len(hits_lp) == 0) and (len(hits_lp_extra) == 0):
                # intermediate link target does not exist yet, add it
                lp = {
                    "linkPattern": s_parent_lp,
                    "linkTarget": "",
                    "docstrings": ["intermediate modifier Group"],
                    "line": 0,
                    "parent": parent,
                    "modifier": f"{modifier}/",
                    "parameters": [],
                }
                linkpatterns_extra.append(lp)
            s_parent = parent

    # combine linkpatterns and modifier gropu link patterns and sort them by lenght
    all_linkpatterns = linkpatterns_extra + linkpatterns
    all_linkpatterns = sorted(all_linkpatterns, key=lambda lt: len(lt["linkPattern"]))

    if filename is not None:
        with open(filename, "w") as out_file:
            json.dump(all_linkpatterns, out_file, indent=4)
        with open(f"tree_{filename}", "w") as out_file:
            json.dump(linkspatterns_tree, out_file, indent=4)
    return linkspatterns_tree


def main():
    with NoPrinting():
        print(
            "Need to suppress catharsys prints since they go right back to the addon messing up json based ipc"
        )

        variables = generate_catharsys_painkiller_linktargets()

        Data_s = json.dumps(variables)

    print(Data_s)


if __name__ == "__main__":
    # import rbpy

    # rbpy.rb_debug.wait4Debugger()
    variables = generate_catharsys_painkiller_linktargets()
    Data_s = json.dumps(variables)
    print(Data_s)
