# Interface providing tooltips of catharsys inline functions
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

with NoPrinting():
    print(
        "Need to suppress catharsys prints since they go right back to the addon messing up json based ipc"
    )
    # import needed to avoid circular import...
    from anybase import config
    from anybase.cls_anycml import CAnyCML

    # construct catharsys ison parser
    inter = CAnyCML()

    # Extract tooltips if availlable
    tooltipdict = {}
    for (k, v) in inter.dicFunc.items():
        if "tooltip" in v.__dict__.keys():
            tooltipdict[k] = {
                "tooltip": v.tooltip,
                "filename": v.__code__.co_filename,
                "lineno": v.__code__.co_firstlineno,
            }
        else:
            tooltipdict[k] = {
                "tooltip": "Cathy magic function, but no tooltip availlable",
                "filename": "",
                "lineno": -1,
            }

    Data_s = json.dumps(tooltipdict)

print(Data_s)
