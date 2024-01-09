# Interface providing potential catharsys variable defintions for the catharsys painkiller addon
# import rbpy.debug

# rbpy.debug.wait4Debugger()

import json
import os, sys
from anybase.file import LoadJson


class NoPrinting:
    def __enter__(self):
        self._original_stdout = sys.stdout
        sys.stdout = open(os.devnull, "w")

    def __exit__(self, exc_type, exc_val, exc_tb):
        sys.stdout.close()
        sys.stdout = self._original_stdout


def find_recursively_in_dict(search_dict, field):
    results = []

    # Iterate over items
    for key, value in search_dict.items():
        if key == field:
            results.append(value)
        elif isinstance(value, dict):
            # value is a dict, call recursively and append
            res_deeper = find_recursively_in_dict(value, field)
            for another_result in res_deeper:
                results.append(another_result)
        elif isinstance(value, list):
            # Value is a list, call recursively on all list elements and append
            for item in value:
                if isinstance(item, dict):
                    res_deeper = find_recursively_in_dict(item, field)
                    for another_result in res_deeper:
                        results.append(another_result)

    return results


def flatten_dict(d, sFile):
    """Flatten dict, append sFile and linenumber =0

    Args:
        d (dict): Dictionary to flatten
        sFile (string): Filename

    Returns:
        list of lists: List of key entries for later lookup
    """
    ret = []
    if not isinstance(d, dict):
        return ret
    for key, value in d.items():
        ret = ret + [[key, sFile, 0]] + flatten_dict(value, sFile)
    return ret


def flatten_dict_only_leafs(d, sFile, excludes):
    """Flatten dict, append sFile and linenumber =0

    Args:
        d (dict): Dictionary to flatten
        sFile (string): Filename

    Returns:
        list of lists: List of key entries for later lookup
    """
    ret = []
    if not isinstance(d, dict):
        return ret
    for key, value in d.items():
        if isinstance(value, dict):
            ret = ret + flatten_dict_only_leafs(value, sFile, excludes)
        else:
            if key not in excludes:
                ret = ret + [[key, sFile, 0]]
    return ret


def extract_var_defs(scanroot):
    """Iterate over folder subtree and extract all potential variable definitions

    Args:
        scanroot (string): root folder to start searching

    Returns:
        list of [variablename, filename, linenumber]: Search data for completion
    """
    variables = []
    excludedirs = ["_blender"]
    excludes = ["sDTI"]

    for root, dirs, files in os.walk(scanroot, topdown=True):
        dirs[:] = [d for d in dirs if d not in excludedirs]
        for f in files:
            # check if file is ison5
            _, ext = os.path.splitext(f)
            if ext in [".json5"]:
                f_abs = os.path.join(root, f)
                # print(f_abs)
                content = LoadJson(f_abs)
                if isinstance(content, dict):
                    # Actually a dict on top level
                    candidates = [
                        "__globals__",
                        "__locals__",
                        "mGlobalArgs",
                        "mConfig",
                    ]
                    for variable_source in candidates:
                        found_items = find_recursively_in_dict(content, variable_source)
                        for g in found_items:
                            variables += flatten_dict_only_leafs(g, f_abs, excludes)

    return variables


def main(condaenv, workspacefolder):
    with NoPrinting():
        print(
            "Need to suppress catharsys prints since they go right back to the addon messing up json based ipc"
        )

        import catharsys.api as capi

        os.chdir(workspacefolder)
        os.environ["CONDA_DEFAULT_ENV"] = condaenv

        wsX = capi.CWorkspace()

        variables = extract_var_defs(wsX.pathConfig)

        Data_out = {"variables": variables}

        Data_s = json.dumps(Data_out)

    print(Data_s)


if __name__ == "__main__":
    # import rbpy

    # rbpy.rb_debug.wait4Debugger()
    main(sys.argv[1], sys.argv[2])
