# Interface providing a list of all catharsys repos installed
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


def main():
    with NoPrinting():
        print(
            "Need to suppress catharsys prints since they go right back to the addon messing up json based ipc"
        )

        from catharsys.setup import util, repos

        path_to_core = util.TryGetReposPath().parent.as_posix()
        Module_paths = [
            x.as_posix() for x in repos.ProvideReposPath().iterdir() if x.is_dir()
        ]

        res = [path_to_core] + Module_paths

        from git import Repo

        R_core = Repo(path_to_core)
        Branches_core = [b.name for b in R_core.branches]

        R_modules = [Repo(mpath) for mpath in Module_paths]
        Branches_modules = [[b.name for b in R.branches] for R in R_modules]

        res_branches = [Branches_core] + Branches_modules

        res_repodata = [[path, Branches] for (path, Branches) in zip(res, res_branches)]

        Data_out = {}
        Data_out["Repodata"] = res_repodata

        Data_s = json.dumps(Data_out)

    print(Data_s)


if __name__ == "__main__":
    # import rbpy

    # rbpy.rb_debug.wait4Debugger()
    # Data_in = json.loads(sys.argv[1])
    main()
