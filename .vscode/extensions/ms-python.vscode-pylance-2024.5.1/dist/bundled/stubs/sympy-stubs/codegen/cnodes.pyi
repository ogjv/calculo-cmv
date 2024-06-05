from typing import Self
from sympy.codegen.ast import FunctionCall, Node, String, Token
from sympy.core.basic import Basic

void = ...
restrict = ...
volatile = ...
static = ...
def alignof(arg) -> FunctionCall:
    ...

def sizeof(arg) -> FunctionCall:
    ...

class CommaOperator(Basic):
    def __new__(cls, *args) -> Self:
        ...
    


class Label(Node):
    _fields = ...
    defaults = ...
    _construct_name = String


class goto(Token):
    _fields = ...
    _construct_label = Label


class PreDecrement(Basic):
    nargs = ...


class PostDecrement(Basic):
    nargs = ...


class PreIncrement(Basic):
    nargs = ...


class PostIncrement(Basic):
    nargs = ...


class struct(Node):
    _fields = ...
    defaults = ...
    _construct_name = String


class union(struct):
    __slots__ = ...


