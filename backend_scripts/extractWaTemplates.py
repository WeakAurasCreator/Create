import os, json
from luaparser import ast as lua_ast
from luaparser.astnodes import Table, Field, Index, Name, Number, String, TrueExpr, FalseExpr, Nil, Assign
from luaparser.builder import BuilderVisitor
from luaparser.parser.LuaLexer import LuaLexer
from luaparser.parser.LuaParser import LuaParser
from antlr4 import InputStream, CommonTokenStream, Token
from antlr4.error.ErrorListener import ConsoleErrorListener

# --- Helpers from sections 1 & 2 above ---
def expr_to_py(node):
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
    for stmt in tree.body.body:
        if isinstance(stmt, Assign):
            for target, value in zip(stmt.targets, stmt.values):
                if isinstance(target, Index) and isinstance(target.idx, Name) and target.idx.id == "class":
                    return lua_table_to_py(value)
    return {}

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
    base = os.path.dirname(__file__)
    wa2 = os.path.join(base, "weakauras2")

    # Triggers
    trigger_tree = parse_lua(open(os.path.join(
        wa2, "WeakAurasTemplates/TriggerTemplatesData.lua"
    )).read())
    triggers = extract_trigger_templates(trigger_tree)

    # Regions
    regions = {}
    region_dir = os.path.join(wa2, "WeakAurasOptions/RegionOptions")
    for fn in os.listdir(region_dir):
        if fn.endswith(".lua"):
            tree = parse_lua(open(os.path.join(region_dir, fn)).read())
            key = os.path.splitext(fn)[0].lower()
            regions[key] = extract_region_templates(tree)

    # Write JSON
    out = {"triggers": triggers, "regions": regions}
    with open(os.path.join(base, "weakaura-templates.json"), "w", encoding="utf8") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
    print("Wrote weakaura-templates.json")

if __name__ == "__main__":
    main()
