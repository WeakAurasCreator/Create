import os, json
from luaparser import ast as lua_ast
from luaparser.astnodes import Table, Field, Index, Name, Number, String, TrueExpr, FalseExpr, Nil, Assign, UMinusOp, LocalAssign
from luaparser.builder import BuilderVisitor
from luaparser.parser.LuaLexer import LuaLexer
from luaparser.parser.LuaParser import LuaParser
from antlr4 import InputStream, CommonTokenStream, Token
from antlr4.error.ErrorListener import ConsoleErrorListener

# --- Helpers ---
def expr_to_py(node):
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
        if field.key is None:
            array_elems.append(val)
        else:
            dict_elems[expr_to_py(field.key)] = val
    if dict_elems:
        for i, v in enumerate(array_elems, start=1):
            dict_elems[i] = v
        return dict_elems
    return array_elems

# --- Extraction fns from section 3 ---
def extract_trigger_templates(tree):
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

    # 2) Extract triggers
    trigger_file = os.path.join(
        wa2_path, "WeakAurasTemplates", "TriggerTemplatesData.lua"
    )

    # Triggers
    trigger_tree = parse_lua(open(trigger_file, encoding="utf8").read())
    triggers = extract_trigger_templates(trigger_tree)

    # Regions
    regions = {}
    region_dir = os.path.join(wa2_path, "WeakAurasOptions", "RegionOptions")
    for fn in os.listdir(region_dir):
        if fn.endswith(".lua"):
            tree = parse_lua(open(os.path.join(region_dir, fn)).read())
            key = os.path.splitext(fn)[0].lower()
            regions[key] = extract_region_templates(tree)

    out_dir = os.path.join(repo_root, "templates")
    os.makedirs(out_dir, exist_ok=True)
    # Write JSON
    with open(os.path.join(out_dir, "triggers.json"), "w", encoding="utf8") as f:
        json.dump(triggers, f, indent=2, ensure_ascii=False)  

    with open(os.path.join(out_dir, "regions.json"), "w", encoding="utf8") as f:
        json.dump(regions, f, indent=2, ensure_ascii=False)    

    print(f"Wrote {len(triggers)} triggers and {len(regions)} region sets into {out_dir}")

if __name__ == "__main__":
    main()
