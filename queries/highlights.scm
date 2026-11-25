; ---------------------------------------------------------------
; comments
; ---------------------------------------------------------------

(line_comment) @comment
(block_comment) @comment
(doc_comment) @comment.block.documentation

; ---------------------------------------------------------------
; literals
; ---------------------------------------------------------------

(number) @constant.numeric
(string) @string
(system_path) @string.special.path
(wildcard) @variable.builtin

((identifier) @constant.builtin.boolean
  (#match? @constant.builtin.boolean "^(true|false)$"))

; ---------------------------------------------------------------
; keywords
; ---------------------------------------------------------------

"fn" @keyword.function

[
  "struct"
  "datatype"
  "newtype"
  "typedef"
  "sortdef"
] @keyword.storage.type

[
  "pub"
  "abstract"
  "linear"
  "extern"
] @keyword.storage.modifier

[
  "if"
  "then"
  "else"
  "case"
  "of"
  "guard"
] @keyword.control.conditional

"val" @keyword

[
  "use"
  "as"
] @keyword.control.import

; ---------------------------------------------------------------
; operators and punctuation
; ---------------------------------------------------------------

[
  "+" "-" "*" "/" "%"
  "==" "!=" "<" ">" "<=" ">="
  "=" "=>" "->" "|"
  "~" "!"
  "|>"
] @operator

[ "(" ")" "[" "]" "{" "}" ] @punctuation.bracket
[ "," ":" "::" ] @punctuation.delimiter

; ---------------------------------------------------------------
; types
; ---------------------------------------------------------------

((type_identifier) @type.builtin
  (#match? @type.builtin "^(type|utype|nat|int|bool|one)$"))

((type_identifier) @type
  (#not-match? @type "^(type|utype|nat|int|bool|one)$"))

(scoped_type_identifier
  namespace: (identifier) @namespace
  name: (identifier) @type)

; ---------------------------------------------------------------
; declarations
; ---------------------------------------------------------------

(function_declaration
  name: (identifier) @function)

(constructor
  name: (identifier) @constructor)

(parameter
  name: (identifier) @variable.parameter)

(sort_parameter
  name: (identifier) @variable.parameter)

(use_declaration
  alias: (identifier) @namespace)

; ---------------------------------------------------------------
; names
; ---------------------------------------------------------------

(scoped_identifier
  namespace: (identifier) @namespace)

; calls: Cons(x, xs) is a constructor, f(x) is a function
(call_expression
  function: (identifier) @constructor
  (#match? @constructor "^[A-Z]"))

(call_expression
  function: (identifier) @function.call
  (#not-match? @function.call "^[A-Z]"))

(call_expression
  function: (scoped_identifier
    name: (identifier) @constructor)
  (#match? @constructor "^[A-Z]"))

(call_expression
  function: (scoped_identifier
    name: (identifier) @function.call)
  (#not-match? @function.call "^[A-Z]"))

(constructor_pattern
  constructor: (identifier) @constructor)

(constructor_pattern
  constructor: (scoped_identifier
    name: (identifier) @constructor))

; bare capitalised names in patterns and expressions are nullary constructors
(case_arm
  pattern: (identifier) @constructor
  (#match? @constructor "^[A-Z]"))

(consuming_pattern
  (identifier) @constructor
  (#match? @constructor "^[A-Z]"))

(scoped_identifier
  name: (identifier) @constructor
  (#match? @constructor "^[A-Z]"))
