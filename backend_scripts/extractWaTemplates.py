import os, json
import warnings
from luaparser import ast as lua_ast
from luaparser.astnodes import Table, Field, Index, Name, Number, String, TrueExpr, FalseExpr, Nil, Assign, UMinusOp, LocalAssign, AnonymousFunction, Function, Concat, Call
from luaparser.builder import BuilderVisitor
from luaparser.parser.LuaLexer import LuaLexer
from luaparser.parser.LuaParser import LuaParser
from antlr4 import InputStream, CommonTokenStream, Token
from antlr4.error.ErrorListener import ConsoleErrorListener

# --- Helpers ---
def expr_to_py(node):
    if isinstance(node, (AnonymousFunction, Function)):
        return None  # skip or replace with a placeholder if desired
    if isinstance(node, Call):
        return None
    if isinstance(node, Concat):
        left = expr_to_py(node.left)
        right = expr_to_py(node.right)
        if isinstance(left, str) and isinstance(right, str):
            return left + right
        return None
    if isinstance(node, Index):
        return expr_to_py(node.idx)
    if isinstance(node, Table):
        return lua_table_to_py(node)
    if isinstance(node, Number):
        return node.n
    if isinstance(node, String):
        return node.s
    if isinstance(node, TrueExpr):
        return True
    if isinstance(node, FalseExpr):
        return False
    if isinstance(node, Nil):
        return None
    if isinstance(node, Name):
        return node.id
    if isinstance(node, UMinusOp):
        return -expr_to_py(node.operand)  
    raise TypeError(f"Unsupported AST node: {type(node)}")

def lua_table_to_py(node: Table):
    array_elems, dict_elems = [], {}
    for field in node.fields:
        val = expr_to_py(field.value)
        # skip functions and unsupported nodes
        if val is None:
            continue

        if field.key is None:
            array_elems.append(val)
        else:
            key = expr_to_py(field.key)
            if key is not None:
                dict_elems[key] = val

    # if there are named keys, merge array entries under numeric indices
    if dict_elems:
        for i, v in enumerate(array_elems, start=1):
            dict_elems[i] = v
        return dict_elems

    return array_elems

def extract_class_templates(tree):
    triggers = {}
    for stmt in tree.body.body:
        # catch both `templates.class = …` and `local templates = …`
        if isinstance(stmt, (Assign, LocalAssign)):
            # both Assign and LocalAssign expose .targets and .values
            for target, value in zip(stmt.targets, stmt.values):
                # look for templates.class.<CLASSNAME> = { … }
                if isinstance(target, Index):
                    inner = target.value
                    # inner should be the `templates.class` index
                    if (
                        isinstance(inner, Index)
                        and isinstance(inner.value, Name)
                        and inner.value.id == "templates"
                        and isinstance(inner.idx, Name)
                        and inner.idx.id == "class"
                    ):
                        # the outer idx is the class name (e.g. "EVOKER", "WARRIOR")
                        class_name = expr_to_py(target.idx)
                        triggers[class_name] = lua_table_to_py(value)
    return triggers

def extract_region_templates(tree):
    for stmt in tree.body.body:
        if isinstance(stmt, Assign):
            for t, v in zip(stmt.targets, stmt.values):
                if isinstance(t, Name) and t.id == "templates":
                    return lua_table_to_py(v)
    return []

# --- Main driver ---
def parse_lua(source: str):
    lex = LuaLexer(InputStream(source))
    lex.removeErrorListeners()
    lex.addErrorListener(ConsoleErrorListener())
    stream = CommonTokenStream(lex, channel=Token.DEFAULT_CHANNEL)
    parser = LuaParser(stream)
    parser.removeErrorListeners()
    parser.addErrorListener(ConsoleErrorListener())
    tree = parser.start_()
    return BuilderVisitor(stream).visit(tree)

def noop(*args, **kwargs): pass

# ——— Extract Private.* tables from Types.lua ——————————————————
def extract_private_types(types_path):
    src = open(types_path, encoding="utf8").read()
    root = parse_lua(src)
    mapping = {}
    for stmt in root.body.body:
        # look for Assign where target is Index(Name 'Private', 'XXX')
        if isinstance(stmt, Assign):
            for tgt, val in zip(stmt.targets, stmt.values):
                if isinstance(tgt, Index) and isinstance(tgt.value, Name) and tgt.value.id == "Private":
                    key = expr_to_py(tgt.idx)
                    if isinstance(val, Table):
                        mapping[key] = lua_table_to_py(val)
    return mapping

# ——— Extract args from an Options file —————————————————————
def extract_args(options_path):
    root = parse_lua(options_path)
    # find the Table assigned to local named 'animation' (or 'conditions', etc.)
    for stmt in root.body.body:
        # look for `local animation = { … }`
        if isinstance(stmt, lua_ast.LocalAssign):
            for tgt, val in zip(stmt.targets, stmt.values):
                if isinstance(tgt, Name) and tgt.id.endswith("animation") and isinstance(val, Table):
                    # find the Field 'args' inside this Table
                    for f in val.fields:
                        if f.key and expr_to_py(f.key) == "args":
                            args_tbl = f.value
                            return { expr_to_py(field.key): lua_table_to_py(field.value)
                                     for field in args_tbl.fields
                                     if isinstance(field, Field) }


def main():
    repo_root = os.environ.get("GITHUB_WORKSPACE")
    if not repo_root:
        # start from script dir
        repo_root = os.path.abspath(os.path.dirname(__file__))
        # climb until we find weakauras2/ folder or hit filesystem root
        while repo_root and not os.path.isdir(os.path.join(repo_root, "weakauras2")):
            parent = os.path.dirname(repo_root)
            if parent == repo_root:
                break
            repo_root = parent

    # allow explicit override
    wa2_path = os.environ.get("WA2_PATH",
                  os.path.join(repo_root, "weakauras2"))
    wa_opts = os.path.join(wa2_path, "WeakAurasOptions")
    types_file = os.path.join(wa2_path, "WeakAuras", "Types.lua")

    # 2) Extract triggers
    trigger_file = os.path.join(
        wa2_path, "WeakAurasTemplates", "TriggerTemplatesData.lua"
    )

    # Triggers
    trigger_tree = parse_lua(open(trigger_file, encoding="utf8").read())
    classes = extract_class_templates(trigger_tree)

    # Regions
    regions = {}
    region_dir = os.path.join(wa2_path, "WeakAurasOptions", "RegionOptions")
    for fn in os.listdir(region_dir):
        if fn.endswith(".lua"):
            tree = parse_lua(open(os.path.join(region_dir, fn)).read())
            key = os.path.splitext(fn)[0].lower()
            regions[key] = extract_region_templates(tree)

    # 3) Sub-region templates (optional)
    subregions = {}
    subdir = os.path.join(wa2_path, "WeakAurasOptions", "SubRegionOptions")
    if os.path.isdir(subdir):
        for fn in os.listdir(subdir):
            if fn.endswith(".lua"):
                key = fn[:-4].lower()
                tree = parse_lua(open(os.path.join(subdir, fn), encoding="utf8").read())
                subregions[key] = extract_region_templates(tree)
    priv = extract_private_types(types_file)
    # Generic templates
    categories = {
        "conditions": "ConditionOptions.lua",
        "actions":    "ActionOptions.lua",
        "animations": "AnimationOptions.lua",
        "load":       "LoadOptions.lua",
        "display":    "DisplayOptions.lua"
    }
    out = {}
    for name, fn in categories.items():
        path = os.path.join(wa_opts, fn)
        args = extract_args(path)
        # inline values tables
        for ctrl, props in args.items():
            if isinstance(props.get("values"), str):
                var = props["values"]
                props["values"] = priv.get(var, {})
        out[name] = args

    out_dir = os.path.join(repo_root, "templates")
    os.makedirs(out_dir, exist_ok=True)
    # Write JSON
    with open(os.path.join(out_dir, "classes.json"), "w", encoding="utf8") as f:
        json.dump(classes, f, indent=2, ensure_ascii=False)  

    with open(os.path.join(out_dir, "regions.json"), "w", encoding="utf8") as f:
        json.dump(regions, f, indent=2, ensure_ascii=False)  
    with open(os.path.join(out_dir, "subregions.json"), "w", encoding="utf8") as f:  
        json.dump(subregions, f, indent=2, ensure_ascii=False)
    for name, data in out.items():
        with open(f"templates/{name}_opts.json", "w", encoding="utf8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        print(f"Wrote templates/{name}_opts.json")

    print(f"Extracted {len(classes)} class templates")
    print(f"Extracted {len(regions)} region templates")
    print(f"Extracted {len(subregions)} subregion templates")
    print(f"Extracted {len(out)} generic templates")
    print(f"Extracted {len(priv)} private types")

if __name__ == "__main__":
    main()
