# Provides funktionality to run git fetch on all catharsys module repos and the catharsys installation repo itself
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
    from catharsys.setup import util, repos

    path_to_core = util.TryGetReposPath().parent.as_posix()
    Module_paths = [x.as_posix() for x in repos.ProvideReposPath().iterdir() if x.is_dir()]

    from git import Repo

    all_repos = [path_to_core] + Module_paths
    
    Data_out = {"loglines":[]}

    for p in all_repos:
        try:
            r=Repo(p)
            r.remote().fetch()
        except:
            Data_out["loglines"].append(f"Fetching repo ${p} failed")
         
    Data_s = json.dumps(Data_out)

    print(Data_s)


if __name__ == "__main__":
    # import rbpy

    # rbpy.rb_debug.wait4Debugger()
    # Data_in = json.loads(sys.argv[1])
    main()
